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
    sessions = db.query(TestSession).filter(TestSession.user_id == current_user.id).order_by(TestSession.started_at.desc()).all()
    result = []
    for s in sessions:
        questions = db.query(Question).filter(Question.session_id == s.id).order_by(Question.order_index).all()
        if not questions:
            continue
        q_ids = [q.id for q in questions]
        models_by_q = {}
        for m in db.query(ModelAnswer).filter(ModelAnswer.question_id.in_(q_ids)).all():
            models_by_q.setdefault(m.question_id, []).append(m)
        answers_by_q = {a.question_id: a for a in db.query(Answer).filter(Answer.question_id.in_(q_ids)).all()}

        items = []
        for q in questions:
            answer = answers_by_q.get(q.id)
            versions = [v for v in (answer.versions if answer else []) if (v.transcript or "").strip()]
            latest_eval = None
            for v in reversed(versions):
                if v.evaluations:
                    latest_eval = v.evaluations[0]
                    break
            items.append({
                "id": q.id,
                "order_index": q.order_index,
                "topic": q.topic,
                "question_type": q.question_type,
                "question_text": q.question_text,
                "audio_path": cached_speech_url(q.question_text) or q.audio_path,
                "model_answers": [
                    {"level": m.level, "text": m.text, "rationale": m.rationale, "audio_path": cached_speech_url(m.text)}
                    for m in sorted(models_by_q.get(q.id, []), key=lambda m: MODEL_LEVELS.index(m.level) if m.level in MODEL_LEVELS else 9)
                ],
                "practice_count": len(versions),
                "answer_id": answer.id if answer else None,
                "last_level": latest_eval.estimated_level if latest_eval else None,
            })

        result.append({
            "session_id": s.id,
            "mode": s.mode,
            "status": s.status,
            "started_at": s.started_at,
            "self_assessment_level": s.self_assessment_level,
            "default_model_level": default_model_level(s),
            "topics": s.topics or [],
            "questions": items,
        })
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
        level = req.level or default_model_level(s)
        model = db.query(ModelAnswer).filter(ModelAnswer.question_id == q.id, ModelAnswer.level == level).first()
        if not model:
            missing.append(q.id)
            continue
        if req.include_question:
            segments.append({"kind": "question", "text": q.question_text})
        segments.append({"kind": "answer", "text": model.text})

    if missing:
        raise HTTPException(status_code=409, detail={"message": "Model answers not generated yet.", "missing_question_ids": missing})

    try:
        return request_playlist(segments)
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
