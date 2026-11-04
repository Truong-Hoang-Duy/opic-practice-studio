from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User
from app.models.session import TestSession
from app.models.question import Question, ModelAnswer
from app.models.answer import Answer
from app.core.security import get_current_user
from app.services.evaluation_service import exam_level_for
from app.services.playlist_service import request_playlist
from app.services.tts_service import cached_speech_url
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

    # Map each normalized question_text to its earliest generated ModelAnswer set so later tests inherit it
    first_models_by_text: dict = {}
    for q in sorted(all_questions, key=lambda x: x.id):
        q_models = models_by_q.get(q.id)
        norm_text = (q.question_text or "").strip()
        if q_models and norm_text and norm_text not in first_models_by_text:
            first_models_by_text[norm_text] = q_models

    cloned_any = False
    for q in sorted(all_questions, key=lambda x: x.id):
        norm_text = (q.question_text or "").strip()
        if not models_by_q.get(q.id) and norm_text in first_models_by_text:
            cloned_list = []
            for dm in first_models_by_text[norm_text]:
                obj = ModelAnswer(
                    question_id=q.id,
                    level=dm.level,
                    text=dm.text,
                    rationale=dm.rationale,
                    audio_path=cached_speech_url(dm.text) or dm.audio_path,
                    sentences=dm.sentences or [dm.text],
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
            items.append({
                "id": q.id,
                "session_id": s.id,
                "order_index": q.order_index,
                "topic": q.topic,
                "category": category,
                "category_label": CATEGORY_LABELS.get(category, category),
                "difficulty": q.difficulty,
                "timing": question_timing(q.question_type, q.difficulty),
                "question_type": q.question_type,
                "question_text": q.question_text,
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

        result.append({
            "session_id": s.id,
            "session_number": session_num_by_id.get(s.id, s.id),
            "mode": s.mode,
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
    question_ids: List[int] = Field(min_length=1, max_length=60)
    level: Optional[str] = Field(None, description="IL | IM | IH; defaults to each session's chosen level")
    include_question: bool = True


@router.post("/playlist")
def build_playlist(
    req: PlaylistRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Builds (in the background) one MP3 with Eva's question + the model answer for each selected question,
    in the given order. Poll with the same body until "ready" is true.
    """
    if req.level and req.level not in MODEL_LEVELS:
        raise HTTPException(status_code=422, detail="level must be IL, IM or IH.")

    rows = (
        db.query(Question, TestSession)
        .join(TestSession, Question.session_id == TestSession.id)
        .filter(Question.id.in_(req.question_ids), TestSession.user_id == current_user.id)
        .all()
    )
    by_id = {q.id: (q, s) for q, s in rows}
    if len(by_id) != len(set(req.question_ids)):
        raise HTTPException(status_code=404, detail="Some questions were not found.")

    segments, missing = [], []
    for qid in req.question_ids:
        q, s = by_id[qid]
        if q.question_type in UNSCORED_QUESTION_TYPES:
            continue  # the fixed self-introduction isn't useful for listening practice
        level = req.level or default_model_level(s)
        model = db.query(ModelAnswer).filter(ModelAnswer.question_id == q.id, ModelAnswer.level == level).first()
        if not model:
            missing.append(q.id)
            continue
        if req.include_question:
            segments.append({"kind": "question", "text": q.question_text})
        segments.append({"kind": "answer", "text": model.text})

    if not segments and not missing:
        raise HTTPException(status_code=422, detail="Chọn ít nhất một câu (câu 1 không có trong bài nghe).")
    if missing:
        raise HTTPException(status_code=409, detail={"message": "Model answers not generated yet.", "missing_question_ids": missing})

    try:
        return request_playlist(segments)
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
