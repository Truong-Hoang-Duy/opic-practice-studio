import datetime
from typing import Any, Dict, List, Literal, Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import func
from sqlalchemy.orm import Session
from app.config import settings
from app.database import get_db, ensure_schema
from app.models.user import User
from app.models.session import TestSession
from app.models.question import Question, ModelAnswer
from app.models.answer import Answer
from app.models.playlist import SavedPlaylist
from app.core.security import get_current_user
from app.services.evaluation_service import exam_level_for
from app.services.playlist_service import (
    request_playlist,
    get_playlist_runtime_status,
    delete_playlist_file,
    GAP_AFTER_QUESTION_SHADOW_SEC,
    GAP_BETWEEN_SENTENCES_SHADOW_SEC,
    GAP_BETWEEN_ITEMS_SEC,
)
from app.services.tts_service import cached_speech_url
from app.services.study_pack_service import (
    DEFAULT_TOPICS,
    LEVEL_TO_ASSESSMENT,
    build_50_study_questions,
    create_exam_from_study_pack,
    generate_and_save_single_model,
    get_study_pack_progress,
    get_topic_catalog,
    infer_canonical_key_for_question,
    start_study_pack_generation,
    sync_master_curriculum,
)
from app.services.evaluation_service import is_mock_session
from app.core.question_meta import CATEGORY_LABELS, derive_category, question_timing
from app.schemas.question import UNSCORED_QUESTION_TYPES
from app.schemas.answer import AnswerResponse

router = APIRouter(prefix="/library", tags=["Question Library"])

MODEL_LEVELS = ("IL", "IM", "IH")


def default_model_level(session: TestSession) -> str:
    """Model answer level matching the learner's chosen exam level (Novice -> IL, AL -> IH)."""
    level = exam_level_for(session)
    if level in MODEL_LEVELS:
        return level
    return "IL" if level == "Novice" else "IH"


@router.get("")
def get_library(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Every AI question set the learner has taken, newest first, with model answers and practice stats."""
    sessions = (
        db.query(TestSession)
        .filter(TestSession.user_id == current_user.id)
        .order_by(TestSession.started_at.desc(), TestSession.id.desc())
        .all()
    )
    total_sessions = len(sessions)
    if not sessions:
        return []

    session_num_by_id = {s.id: total_sessions - idx for idx, s in enumerate(sessions)}
    session_ids = [s.id for s in sessions]

    # Batch fetch all questions, model answers, and answers to eliminate N+1 queries
    all_questions = (
        db.query(Question)
        .filter(Question.session_id.in_(session_ids))
        .order_by(Question.session_id, Question.order_index)
        .all()
    )
    questions_by_session: dict = {}
    all_q_ids = []
    for q in all_questions:
        questions_by_session.setdefault(q.session_id, []).append(q)
        all_q_ids.append(q.id)

    models_by_q: dict = {}
    if all_q_ids:
        for m in db.query(ModelAnswer).filter(ModelAnswer.question_id.in_(all_q_ids)).order_by(ModelAnswer.id.asc()).all():
            models_by_q.setdefault(m.question_id, []).append(m)

    # Map both exact question_text AND canonical_key to earliest generated ModelAnswer set so similar prompts stay consistent
    first_models_by_text: dict = {}
    first_models_by_key: dict = {}
    for q in sorted(all_questions, key=lambda x: x.id):
        q_models = models_by_q.get(q.id)
        norm_text = (q.question_text or "").strip()
        ckey = infer_canonical_key_for_question(q)
        if q_models and norm_text and norm_text not in first_models_by_text:
            first_models_by_text[norm_text] = q_models
        if q_models and ckey and ckey not in first_models_by_key:
            first_models_by_key[ckey] = q_models

    cloned_any = False
    for q in sorted(all_questions, key=lambda x: x.id):
        norm_text = (q.question_text or "").strip()
        ckey = infer_canonical_key_for_question(q)
        donor = first_models_by_text.get(norm_text) or first_models_by_key.get(ckey)
        if not models_by_q.get(q.id) and donor:
            cloned_list = []
            for dm in donor:
                obj = ModelAnswer(
                    question_id=q.id,
                    level=dm.level,
                    text=dm.text,
                    rationale=dm.rationale,
                    audio_path=cached_speech_url(dm.text) or dm.audio_path,
                    sentences=dm.sentences or [dm.text],
                    sentences_vi=dm.sentences_vi,
                )
                db.add(obj)
                cloned_list.append(obj)
            models_by_q[q.id] = cloned_list
            cloned_any = True
    if cloned_any:
        db.commit()

    answers_by_q: dict = {}
    if all_q_ids:
        for a in db.query(Answer).filter(Answer.question_id.in_(all_q_ids)).all():
            answers_by_q[a.question_id] = a

    now_utc = datetime.datetime.utcnow()
    result = []
    for s in sessions:
        questions = questions_by_session.get(s.id, [])
        if not questions:
            continue

        items = []
        for q in questions:
            answer = answers_by_q.get(q.id)
            versions = [v for v in (answer.versions if answer else []) if (v.transcript or "").strip()]
            latest_eval = None
            for v in reversed(versions):
                if v.evaluations:
                    latest_eval = v.evaluations[0]
                    break
            category = q.category or derive_category(q.order_index, q.question_type, q.topic, s.topics)
            has_answer_content = bool(
                answer and (answer.audio_path or (answer.transcript_raw or "").strip() or (answer.transcript_edited or "").strip())
            )
            is_due_today = bool(q.next_review_at and q.next_review_at <= now_utc)
            items.append({
                "id": q.id,
                "session_id": s.id,
                "order_index": q.order_index,
                "topic": q.topic,
                "category": category,
                "canonical_key": infer_canonical_key_for_question(q),
                "prompt_variants": q.prompt_variants or [],
                "story_tags": q.story_tags or [],
                "category_label": CATEGORY_LABELS.get(category, category),
                "difficulty": q.difficulty,
                "timing": question_timing(q.question_type, q.difficulty),
                "question_type": q.question_type,
                "question_text": q.question_text,
                "question_translation_vi": q.question_translation_vi,
                "study_status": q.study_status or "unlearned",
                "next_review_at": q.next_review_at,
                "review_interval_days": q.review_interval_days or 0,
                "review_count": q.review_count or 0,
                "is_due_today": is_due_today,
                "vietnamese_guide": q.vietnamese_guide,
                "audio_path": cached_speech_url(q.question_text) or q.audio_path,
                "model_answers": [
                    {
                        "id": m.id,
                        "question_id": q.id,
                        "level": m.level,
                        "text": m.text,
                        "rationale": m.rationale,
                        "sentences": m.sentences or [m.text],
                        "sentences_vi": m.sentences_vi or [],
                        "audio_path": cached_speech_url(m.text),
                    }
                    for m in sorted(models_by_q.get(q.id, []), key=lambda m: MODEL_LEVELS.index(m.level) if m.level in MODEL_LEVELS else 9)
                ],
                "practice_count": len(versions),
                "last_audio_path": next((v.audio_path for v in reversed(answer.versions) if v.audio_path), answer.audio_path) if answer else None,
                "last_transcript": (versions[-1].transcript if versions else None),
                "answer_id": answer.id if has_answer_content else None,
                "existing_answer": AnswerResponse.model_validate(answer).model_dump(mode="json") if has_answer_content else None,
                "last_level": latest_eval.estimated_level if latest_eval else None,
            })

        study_progress = get_study_pack_progress(db, s.id, default_model_level(s)) if s.mode == "study" else None
        result.append({
            "session_id": s.id,
            "session_number": session_num_by_id.get(s.id, s.id),
            "mode": s.mode,
            "is_study_pack": s.mode == "study",
            "study_progress": study_progress,
            "status": s.status,
            "dev_mock": bool(getattr(s, "dev_mock", False)),
            "started_at": s.started_at,
            "self_assessment_level": s.self_assessment_level,
            "default_model_level": default_model_level(s),
            "topics": s.topics or [],
            "questions": items,
        })
    total_sets = len(result)
    for idx, entry in enumerate(result):
        entry["set_number"] = total_sets - idx
    return result


class PlaylistRequest(BaseModel):
    question_ids: List[int] = Field(min_length=1, max_length=250)
    level: Optional[str] = Field(None, description="IL | IM | IH; defaults to each session's chosen level")
    include_question: bool = True
    shadowing_pause: bool = False
    title: Optional[str] = Field(None, max_length=200)
    session_id: Optional[int] = None
    save: bool = True
    force_retry: bool = False


class PlaylistRenameRequest(BaseModel):
    title: str = Field(min_length=1, max_length=200)


def _assemble_playlist_segments(
    db: Session,
    user_id: int,
    question_ids: List[int],
    level_override: Optional[str],
    include_question: bool,
    shadowing_pause: bool,
    allow_partial_deleted: bool = False,
):
    """
    Batch-loads questions, sessions, and model answers in 2 SQL queries (no N+1 per poll)
    and builds the ordered segment list for playlist_service.
    """
    rows = (
        db.query(Question, TestSession)
        .join(TestSession, Question.session_id == TestSession.id)
        .filter(Question.id.in_(question_ids), TestSession.user_id == user_id)
        .all()
    )
    by_id = {q.id: (q, s) for q, s in rows}
    if not allow_partial_deleted and len(by_id) != len(set(question_ids)):
        raise HTTPException(status_code=404, detail="Some questions were not found.")
    if allow_partial_deleted and not by_id:
        raise HTTPException(
            status_code=404,
            detail="Các câu hỏi gốc của bài nghe này đã bị xóa nên không thể tạo lại.",
        )

    # Single batch query for all ModelAnswers across all selected questions (eliminates 50+ N+1 queries per poll)
    all_models = db.query(ModelAnswer).filter(ModelAnswer.question_id.in_(list(by_id.keys()))).all()
    models_by_q_level = {(m.question_id, m.level): m for m in all_models}

    segments, missing, used_q_ids = [], [], []
    resolved_level = level_override
    resolved_session_id = None
    for qid in question_ids:
        pair = by_id.get(qid)
        if not pair:
            continue
        q, s = pair
        if q.question_type in UNSCORED_QUESTION_TYPES:
            continue  # the fixed self-introduction isn't useful for listening practice
        lvl = level_override or default_model_level(s)
        if resolved_level is None:
            resolved_level = lvl
        if resolved_session_id is None:
            resolved_session_id = s.id
        model = models_by_q_level.get((q.id, lvl))
        if not model:
            missing.append(q.id)
            continue
        used_q_ids.append(q.id)
        if include_question:
            q_seg = {"kind": "question", "text": q.question_text}
            if shadowing_pause:
                q_seg["gap_sec"] = GAP_AFTER_QUESTION_SHADOW_SEC
            segments.append(q_seg)
        if shadowing_pause and model.sentences and len(model.sentences) > 1:
            sents = [st.strip() for st in model.sentences if str(st).strip()]
            for s_idx, sent in enumerate(sents):
                segments.append({
                    "kind": "sentence",
                    "text": sent,
                    "gap_sec": GAP_BETWEEN_ITEMS_SEC if s_idx == len(sents) - 1 else GAP_BETWEEN_SENTENCES_SHADOW_SEC,
                })
        else:
            segments.append({"kind": "answer", "text": model.text})

    return segments, missing, (resolved_level or "IM"), resolved_session_id, used_q_ids


def _default_playlist_title(question_count: int, level: str, shadowing_pause: bool) -> str:
    suffix = " · Nhại" if shadowing_pause else ""
    return f"Bài nghe {question_count} câu · Mức {level}{suffix}"


def _serialize_saved_playlist(db: Session, pl: SavedPlaylist) -> Dict[str, Any]:
    rt = get_playlist_runtime_status(pl.playlist_key, total=pl.segment_count or 0)
    file_available = bool(rt["ready"])
    status = pl.status or "building"
    audio_path = pl.audio_path
    duration = pl.duration_seconds
    file_size = pl.file_size_bytes
    err_msg = pl.error_message
    dirty = False

    if file_available:
        status = "ready"
        audio_path = rt["url"]
        if rt.get("duration_seconds") is not None:
            duration = rt["duration_seconds"]
        if rt.get("file_size_bytes") is not None:
            file_size = rt["file_size_bytes"]
        err_msg = None
        if pl.status != "ready" or pl.audio_path != audio_path or pl.duration_seconds != duration:
            pl.status = "ready"
            pl.audio_path = audio_path
            pl.duration_seconds = duration
            pl.file_size_bytes = file_size
            pl.error_message = None
            dirty = True
    elif rt["status"] == "building":
        status = "building"
        err_msg = None
    elif rt["status"] == "error":
        status = "error"
        err_msg = rt.get("error") or pl.error_message
        if pl.status != "error" or pl.error_message != err_msg:
            pl.status = "error"
            pl.error_message = err_msg
            dirty = True
    elif status == "building":
        # Server restarted mid-build: no longer running in memory
        status = "error"
        err_msg = "Quá trình tạo bị gián đoạn (máy chủ khởi động lại). Bấm Tạo lại để tiếp tục."
        pl.status = status
        pl.error_message = err_msg
        dirty = True

    if dirty:
        db.commit()

    return {
        "id": pl.id,
        "session_id": pl.session_id,
        "title": pl.title,
        "level": pl.level or "IM",
        "include_question": bool(pl.include_question),
        "shadowing_pause": bool(pl.shadowing_pause),
        "question_ids": pl.question_ids or [],
        "question_count": pl.question_count or len(pl.question_ids or []),
        "segment_count": pl.segment_count or 0,
        "playlist_key": pl.playlist_key,
        "audio_path": audio_path if file_available else None,
        "file_available": file_available,
        "duration_seconds": duration,
        "file_size_bytes": file_size,
        "status": status,
        "done": rt.get("done", pl.segment_count if file_available else 0),
        "total": rt.get("total", pl.segment_count or 0),
        "phase": rt.get("phase"),
        "error_message": err_msg,
        "created_at": pl.created_at,
        "updated_at": pl.updated_at,
    }


@router.post("/playlist")
def build_playlist(
    req: PlaylistRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Builds (in the background) one MP3 with Eva's question + the model answer for each selected question,
    in the given order, and persists it in SavedPlaylist so learners can find & replay it in the Listening tab.
    Poll with the same body until "ready" is true (or "status" is "error").
    """
    if req.level and req.level not in MODEL_LEVELS:
        raise HTTPException(status_code=422, detail="level must be IL, IM or IH.")

    segments, missing, resolved_level, resolved_session_id, used_q_ids = _assemble_playlist_segments(
        db=db,
        user_id=current_user.id,
        question_ids=req.question_ids,
        level_override=req.level,
        include_question=req.include_question,
        shadowing_pause=req.shadowing_pause,
    )

    if not segments and not missing:
        raise HTTPException(status_code=422, detail="Chọn ít nhất một câu (câu 1 không có trong bài nghe).")
    if missing:
        raise HTTPException(status_code=409, detail={"message": "Model answers not generated yet.", "missing_question_ids": missing})

    try:
        res = request_playlist(segments, force_retry=req.force_retry)
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))

    if req.save and res.get("key"):
        key = res["key"]
        clean_title = (req.title or "").strip() or _default_playlist_title(
            len(used_q_ids), resolved_level, req.shadowing_pause
        )
        saved = (
            db.query(SavedPlaylist)
            .filter(SavedPlaylist.user_id == current_user.id, SavedPlaylist.playlist_key == key)
            .first()
        )
        now = datetime.datetime.utcnow()
        if saved:
            if (req.title or "").strip():
                saved.title = (req.title or "").strip()
            saved.status = res["status"]
            saved.segment_count = len(segments)
            saved.question_count = len(used_q_ids)
            if res.get("url"):
                saved.audio_path = res["url"]
            if res.get("duration_seconds") is not None:
                saved.duration_seconds = res["duration_seconds"]
            if res.get("file_size_bytes") is not None:
                saved.file_size_bytes = res["file_size_bytes"]
            saved.error_message = res.get("error")
            saved.updated_at = now
        else:
            saved = SavedPlaylist(
                user_id=current_user.id,
                session_id=req.session_id or resolved_session_id,
                title=clean_title,
                level=resolved_level,
                include_question=req.include_question,
                shadowing_pause=req.shadowing_pause,
                question_ids=used_q_ids,
                question_count=len(used_q_ids),
                segment_count=len(segments),
                playlist_key=key,
                audio_path=res.get("url"),
                duration_seconds=res.get("duration_seconds"),
                file_size_bytes=res.get("file_size_bytes"),
                status=res["status"],
                error_message=res.get("error"),
                created_at=now,
                updated_at=now,
            )
            db.add(saved)
        db.commit()
        db.refresh(saved)
        res["playlist_id"] = saved.id
        res["title"] = saved.title

    return res


@router.get("/playlists")
def list_saved_playlists(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Lists all listening playlists saved by the learner, newest first, with live status & disk availability."""
    rows = (
        db.query(SavedPlaylist)
        .filter(SavedPlaylist.user_id == current_user.id)
        .order_by(SavedPlaylist.updated_at.desc(), SavedPlaylist.id.desc())
        .all()
    )
    return [_serialize_saved_playlist(db, pl) for pl in rows]


@router.get("/playlists/{playlist_id}/status")
def get_saved_playlist_status(
    playlist_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Lightweight single-PK poll endpoint for an active playlist build.
    Eliminates repeated Question/ModelAnswer joins during long 50-question builds on Neon PostgreSQL.
    """
    pl = (
        db.query(SavedPlaylist)
        .filter(SavedPlaylist.id == playlist_id, SavedPlaylist.user_id == current_user.id)
        .first()
    )
    if not pl:
        raise HTTPException(status_code=404, detail="Không tìm thấy bài nghe đã lưu.")
    data = _serialize_saved_playlist(db, pl)
    data["ready"] = bool(data["status"] == "ready" and data["file_available"] and data["audio_path"])
    data["url"] = data["audio_path"]
    data["error"] = data["error_message"]
    return data


@router.post("/playlists/{playlist_id}/rebuild")
def rebuild_saved_playlist(
    playlist_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Rebuilds (or retries) a saved playlist's MP3 file from its saved question_ids and options."""
    pl = (
        db.query(SavedPlaylist)
        .filter(SavedPlaylist.id == playlist_id, SavedPlaylist.user_id == current_user.id)
        .first()
    )
    if not pl:
        raise HTTPException(status_code=404, detail="Không tìm thấy bài nghe đã lưu.")

    q_ids = [int(qid) for qid in (pl.question_ids or [])]
    if not q_ids:
        raise HTTPException(status_code=422, detail="Bài nghe không có danh sách câu hỏi để tạo lại.")

    segments, missing, resolved_level, _, used_q_ids = _assemble_playlist_segments(
        db=db,
        user_id=current_user.id,
        question_ids=q_ids,
        level_override=pl.level if pl.level in MODEL_LEVELS else None,
        include_question=bool(pl.include_question),
        shadowing_pause=bool(pl.shadowing_pause),
        allow_partial_deleted=True,
    )
    if missing:
        raise HTTPException(status_code=409, detail={"message": "Một số câu chưa có bài mẫu.", "missing_question_ids": missing})
    if not segments:
        raise HTTPException(status_code=422, detail="Không còn câu hợp lệ để tạo lại bài nghe.")

    try:
        res = request_playlist(segments, force_retry=True)
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))

    pl.playlist_key = res["key"]
    pl.level = resolved_level
    pl.question_ids = used_q_ids
    pl.question_count = len(used_q_ids)
    pl.segment_count = len(segments)
    pl.status = res["status"]
    pl.audio_path = res.get("url")
    pl.duration_seconds = res.get("duration_seconds")
    pl.file_size_bytes = res.get("file_size_bytes")
    pl.error_message = res.get("error")
    pl.updated_at = datetime.datetime.utcnow()
    db.commit()
    db.refresh(pl)

    res["playlist_id"] = pl.id
    res["title"] = pl.title
    return res


@router.patch("/playlists/{playlist_id}")
def rename_saved_playlist(
    playlist_id: int,
    req: PlaylistRenameRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    pl = (
        db.query(SavedPlaylist)
        .filter(SavedPlaylist.id == playlist_id, SavedPlaylist.user_id == current_user.id)
        .first()
    )
    if not pl:
        raise HTTPException(status_code=404, detail="Không tìm thấy bài nghe đã lưu.")
    clean = req.title.strip()
    if not clean:
        raise HTTPException(status_code=422, detail="Tên bài nghe không được để trống.")
    pl.title = clean
    pl.updated_at = datetime.datetime.utcnow()
    db.commit()
    db.refresh(pl)
    return _serialize_saved_playlist(db, pl)


@router.delete("/playlists/{playlist_id}")
def delete_saved_playlist(
    playlist_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    pl = (
        db.query(SavedPlaylist)
        .filter(SavedPlaylist.id == playlist_id, SavedPlaylist.user_id == current_user.id)
        .first()
    )
    if not pl:
        raise HTTPException(status_code=404, detail="Không tìm thấy bài nghe đã lưu.")
    key = pl.playlist_key
    db.delete(pl)
    db.commit()

    # Only delete the cached MP3 file if no other saved playlist shares the same key
    still_used = db.query(SavedPlaylist).filter(SavedPlaylist.playlist_key == key).first()
    if not still_used:
        delete_playlist_file(key)

    return {"deleted": True, "playlist_id": playlist_id}


class StudyPackCreateRequest(BaseModel):
    target_level: Literal["IL", "IM", "IH"] = "IM"
    topics: Optional[List[str]] = None
    survey_data: Optional[Dict[str, Any]] = None
    personal_profile: Optional[str] = Field(None, max_length=1000)
    dev_mock: bool = False


class CurriculumSyncRequest(BaseModel):
    target_level: Literal["IL", "IM", "IH"] = "IM"
    topic_ids: List[str] = Field(default_factory=list, max_length=80)
    custom_topics: List[str] = Field(default_factory=list, max_length=30)
    survey_data: Optional[Dict[str, Any]] = None
    personal_profile: Optional[str] = Field(None, max_length=1000)
    dev_mock: bool = False


class PromptVariantCreateRequest(BaseModel):
    label: Optional[str] = Field(None, max_length=100)
    question: str = Field(min_length=5, max_length=1000)
    bridge: Optional[str] = Field(None, max_length=400)


class StudyStatusUpdateRequest(BaseModel):
    study_status: Literal["unlearned", "learning", "mastered"]


class ReviewRatingRequest(BaseModel):
    rating: Literal["hard", "good", "easy"]


class StartPackExamRequest(BaseModel):
    mode: Literal["exam", "practice"] = "exam"


@router.get("/catalog")
def list_topic_catalog(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Returns the full unlimited OPIc topic catalog with ownership flags from the learner's Master Pack."""
    study_session_ids = [
        sid
        for (sid,) in db.query(TestSession.id)
        .filter(TestSession.user_id == current_user.id, TestSession.mode == "study")
        .all()
    ]
    existing_keys = set()
    if study_session_ids:
        for q in db.query(Question).filter(Question.session_id.in_(study_session_ids)).all():
            existing_keys.add(infer_canonical_key_for_question(q))
    return get_topic_catalog(existing_keys)


@router.post("/curriculum/sync")
def sync_curriculum(
    req: CurriculumSyncRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Unlimited anti-duplicate Master Curriculum sync.
    Accepts any combination of catalog topic_ids + custom_topics, preserves existing learned slots
    & model answers by canonical_key, and starts background generation only for newly added slots.
    """
    if not req.topic_ids and not req.custom_topics:
        raise HTTPException(status_code=422, detail="Vui lòng chọn ít nhất một chủ đề để tạo.")

    use_mock = bool(req.dev_mock) and settings.ENVIRONMENT != "production"
    profile = (req.personal_profile or "").strip()
    return sync_master_curriculum(
        db=db,
        user_id=current_user.id,
        topic_ids=req.topic_ids,
        custom_topics=req.custom_topics,
        target_level=req.target_level,
        personal_profile=profile,
        survey_data=req.survey_data,
        dev_mock=use_mock,
    )


@router.post("/study-pack")
def create_study_pack(
    req: StudyPackCreateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Backwards-compatible entry that syncs the classic 50-slot preset into the learner's single
    Master Pack without creating duplicate copies of existing topics.
    """
    latest = (
        db.query(TestSession)
        .filter(TestSession.user_id == current_user.id)
        .order_by(TestSession.started_at.desc(), TestSession.id.desc())
        .first()
    )
    chosen_topics = req.topics if (req.topics and len(req.topics) >= 1) else (
        latest.topics if (latest and latest.topics) else DEFAULT_TOPICS
    )
    survey = dict(req.survey_data or (latest.survey_data if latest and latest.survey_data else {}))
    profile = (req.personal_profile or "").strip()
    if profile:
        survey["personal_profile"] = profile

    picked_leisure = []
    for field in ("activities", "hobbies", "sports"):
        for val in survey.get(field) or []:
            low = str(val).strip().lower()
            if low and low not in picked_leisure:
                picked_leisure.append(low)
    for k in ("go to the movies", "go to parks", "listen to music", "cook", "walk"):
        if len(picked_leisure) >= 5:
            break
        if k not in picked_leisure:
            picked_leisure.append(k)

    topic_ids = (
        ["home_living", "staycation"]
        + picked_leisure
        + list(chosen_topics)
        + ["rp_movie_dinner", "rp_hotel", "rp_shopping_return"]
        + ["unexp_weather", "unexp_neighborhood", "unexp_phone_shopping", "unexp_health"]
    )
    use_mock = bool(req.dev_mock) and settings.ENVIRONMENT != "production"
    return sync_master_curriculum(
        db=db,
        user_id=current_user.id,
        topic_ids=topic_ids,
        target_level=req.target_level,
        personal_profile=profile,
        survey_data=survey,
        dev_mock=use_mock,
    )


@router.post("/questions/{question_id}/prioritize")
def prioritize_slot_model_answer(
    question_id: int,
    level: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Click-to-Prioritize: generates this exact slot's model answer immediately (bypassing the
    background queue) so learners never wait when creating 80-150+ slots at once.
    """
    pair = (
        db.query(Question, TestSession)
        .join(TestSession, Question.session_id == TestSession.id)
        .filter(Question.id == question_id, TestSession.user_id == current_user.id)
        .first()
    )
    if not pair:
        raise HTTPException(status_code=404, detail="Không tìm thấy câu hỏi.")
    q, sess = pair
    lvl = level if (level in MODEL_LEVELS) else default_model_level(sess)
    existing = db.query(ModelAnswer).filter(ModelAnswer.question_id == q.id, ModelAnswer.level == lvl).first()
    if existing:
        return {
            "id": existing.id,
            "question_id": q.id,
            "level": existing.level,
            "text": existing.text,
            "rationale": existing.rationale,
            "sentences": existing.sentences or [existing.text],
            "sentences_vi": existing.sentences_vi or [],
            "audio_path": cached_speech_url(existing.text) or existing.audio_path,
        }
    profile = (sess.survey_data or {}).get("personal_profile", "")
    model = generate_and_save_single_model(
        db=db,
        q=q,
        target_level=lvl,
        personal_profile=profile,
        mock=is_mock_session(sess),
    )
    return {
        "id": model.id,
        "question_id": q.id,
        "level": model.level,
        "text": model.text,
        "rationale": model.rationale,
        "sentences": model.sentences or [model.text],
        "sentences_vi": model.sentences_vi or [],
        "audio_path": cached_speech_url(model.text) or model.audio_path,
    }


@router.post("/questions/{question_id}/variants")
def add_prompt_variant(
    question_id: int,
    req: PromptVariantCreateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Attaches an alternative Eva question phrasing + optional 1-line bridge to an existing Master Slot."""
    q = (
        db.query(Question)
        .join(TestSession, Question.session_id == TestSession.id)
        .filter(Question.id == question_id, TestSession.user_id == current_user.id)
        .first()
    )
    if not q:
        raise HTTPException(status_code=404, detail="Không tìm thấy câu hỏi.")
    clean_q = req.question.strip()
    variants = list(q.prompt_variants or [])
    if not any((v.get("question") or "").strip().lower() == clean_q.lower() for v in variants):
        variants.append({
            "label": (req.label or "").strip() or f"Biến thể {len(variants) + 1}",
            "question": clean_q,
            "bridge": (req.bridge or "").strip(),
        })
        q.prompt_variants = variants
        db.commit()
    return {"question_id": q.id, "prompt_variants": q.prompt_variants or []}


@router.delete("/questions/{question_id}")
def delete_study_slot(
    question_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Removes a single slot from the learner's Master Study Pack."""
    pair = (
        db.query(Question, TestSession)
        .join(TestSession, Question.session_id == TestSession.id)
        .filter(Question.id == question_id, TestSession.user_id == current_user.id, TestSession.mode == "study")
        .first()
    )
    if not pair:
        raise HTTPException(status_code=404, detail="Không tìm thấy câu hỏi trong kho ôn tập.")
    q, _ = pair
    db.delete(q)
    db.commit()
    return {"deleted": True, "question_id": question_id}


@router.post("/study-pack/{session_id}/resume")
def resume_study_pack(
    session_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    pack = db.query(TestSession).filter(TestSession.id == session_id, TestSession.user_id == current_user.id).first()
    if not pack:
        raise HTTPException(status_code=404, detail="Không tìm thấy bộ ôn tập.")
    lvl = default_model_level(pack)
    profile = (pack.survey_data or {}).get("personal_profile", "")
    start_study_pack_generation(pack.id, target_level=lvl, personal_profile=profile)
    return get_study_pack_progress(db, pack.id, lvl)


@router.get("/study-pack/{session_id}/progress")
def study_pack_progress(
    session_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    pack = db.query(TestSession).filter(TestSession.id == session_id, TestSession.user_id == current_user.id).first()
    if not pack:
        raise HTTPException(status_code=404, detail="Không tìm thấy bộ ôn tập.")
    return get_study_pack_progress(db, pack.id, default_model_level(pack))


@router.patch("/questions/{question_id}/study-status")
def update_question_study_status(
    question_id: int,
    req: StudyStatusUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    q = (
        db.query(Question)
        .join(TestSession, Question.session_id == TestSession.id)
        .filter(Question.id == question_id, TestSession.user_id == current_user.id)
        .first()
    )
    if not q:
        raise HTTPException(status_code=404, detail="Không tìm thấy câu hỏi.")
    q.study_status = req.study_status
    db.commit()
    return {"question_id": q.id, "study_status": q.study_status}


@router.post("/questions/{question_id}/review")
def review_question_srs(
    question_id: int,
    req: ReviewRatingRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Spaced Repetition (SRS) scheduler: hard (1d), good (3d+), easy (7d -> 14d -> 30d)."""
    q = (
        db.query(Question)
        .join(TestSession, Question.session_id == TestSession.id)
        .filter(Question.id == question_id, TestSession.user_id == current_user.id)
        .first()
    )
    if not q:
        raise HTTPException(status_code=404, detail="Không tìm thấy câu hỏi.")

    prev_days = int(q.review_interval_days or 0)
    if req.rating == "hard":
        next_days = 1
        q.study_status = "learning"
    elif req.rating == "good":
        next_days = 3 if prev_days < 3 else min(14, max(3, int(round(prev_days * 1.8))))
        q.study_status = "learning"
    else:  # easy
        next_days = 7 if prev_days < 7 else min(30, max(7, int(round(prev_days * 2.0))))
        q.study_status = "mastered"

    q.review_interval_days = next_days
    q.review_count = int(q.review_count or 0) + 1
    q.next_review_at = datetime.datetime.utcnow() + datetime.timedelta(days=next_days)
    db.commit()
    return {
        "question_id": q.id,
        "study_status": q.study_status,
        "review_interval_days": q.review_interval_days,
        "review_count": q.review_count,
        "next_review_at": q.next_review_at,
        "is_due_today": False,
    }


@router.post("/study-pack/{session_id}/start-exam")
def start_exam_from_pack(
    session_id: int,
    req: StartPackExamRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Samples 15 OPIc-structured questions from the 50-question study pack to run a mock exam."""
    pack = db.query(TestSession).filter(TestSession.id == session_id, TestSession.user_id == current_user.id).first()
    if not pack:
        raise HTTPException(status_code=404, detail="Không tìm thấy bộ ôn tập.")
    exam = create_exam_from_study_pack(db, current_user.id, pack, mode=req.mode)
    return {"session_id": exam.id, "mode": exam.mode}
