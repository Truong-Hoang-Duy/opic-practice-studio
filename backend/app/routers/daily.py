import datetime
import logging
import os
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.concurrency import run_in_threadpool
from sqlalchemy.orm import Session

from app.config import settings
from app.core.daily_bank import FOCUS_TENSES, TASK_REQUIREMENTS
from app.core.security import get_current_user
from app.database import get_db
from app.models.daily import DailyWorkout
from app.models.report import LLMUsageLog
from app.models.user import User
from app.services import daily_service
from app.services.llm_service import daily_feedback_llm
from app.services.speech_metrics import compute_speech_metrics
from app.services.stt_service import (
    TranscriptionError, mock_transcribe, parse_words_with_confidence, save_raw_audio, transcribe_audio_file,
)
from app.services.tts_service import prefetch_speech

logger = logging.getLogger("opic_daily")

router = APIRouter(prefix="/daily", tags=["Daily Workout"])


def _today_payload(db: Session, user: User) -> dict:
    workout = daily_service.get_or_create_today(db, user.id)
    data = daily_service.workout_to_dict(workout)
    if not data["audio_path"]:
        prefetch_speech([workout.question_text])  # Eva's audio is ready on a later poll; the browser voice covers now
    return {
        "workout": data,
        "streak": daily_service.streak_info(db, user.id),
        "resets_at": daily_service.next_reset().isoformat(),
        "server_now": daily_service.local_now().isoformat(),
    }


@router.get("/today")
def get_today(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Today's challenge (assigned on first request of the day), the streak and when the next challenge unlocks."""
    return _today_payload(db, current_user)


@router.get("/history")
def get_history(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return {
        "items": daily_service.history(db, current_user.id, limit=90),
        "streak": daily_service.streak_info(db, current_user.id),
    }


@router.get("/{workout_id}")
def get_workout(workout_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """One past workout with its recording, transcript and feedback (History review)."""
    workout = db.query(DailyWorkout).filter(DailyWorkout.id == workout_id, DailyWorkout.user_id == current_user.id).first()
    if not workout:
        raise HTTPException(status_code=404, detail="Không tìm thấy thử thách.")
    return daily_service.workout_to_dict(workout)


@router.post("/{workout_id}/submit")
async def submit_workout(
    workout_id: int,
    duration_seconds: float = Form(0.0),
    transcript_raw: str = Form(""),
    mock: bool = Form(False),
    audio_file: Optional[UploadFile] = File(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Records one attempt: STT (Soniox) -> speech flow metrics -> quick 3-pillar feedback.
    Re-submitting the same day replaces the previous attempt; only answers with recognised speech count for the streak.
    """
    workout = db.query(DailyWorkout).filter(DailyWorkout.id == workout_id, DailyWorkout.user_id == current_user.id).first()
    if not workout:
        raise HTTPException(status_code=404, detail="Không tìm thấy thử thách.")
    if not daily_service.can_submit(workout):
        raise HTTPException(status_code=409, detail="Thử thách này đã hết hạn. Hãy mở thử thách của hôm nay.")

    # DEV shortcut (local UI testing only): simulate STT and AI
    mock = bool(mock) and settings.ENVIRONMENT != "production"

    audio_url, file_bytes, filename = None, b"", None
    if audio_file:
        file_bytes = await audio_file.read()
        ext = os.path.splitext(audio_file.filename or "")[1] or ".webm"
        filename = f"daily_{current_user.id}_{workout.challenge_date.isoformat()}_{uuid.uuid4().hex[:6]}{ext}"
        audio_url = await save_raw_audio(file_bytes, filename)

    stt_problem = None
    if transcript_raw.strip():
        words = parse_words_with_confidence(transcript_raw)
    elif mock:
        result = mock_transcribe(duration_seconds)
        transcript_raw, words = result["text"], result["words"]
    else:
        if not file_bytes:
            raise HTTPException(status_code=422, detail="Không có bản ghi âm. Vui lòng ghi âm lại.")
        try:
            result = await run_in_threadpool(
                transcribe_audio_file, file_bytes, filename, audio_file.content_type if audio_file else None
            )
            transcript_raw, words = result["text"], result["words"]
        except TranscriptionError as e:
            logger.error(f"Daily workout {workout.id}: transcription failed: {e}")
            transcript_raw, words, stt_problem = "", [], "transcription_failed"

    metrics = compute_speech_metrics(words, duration_seconds)
    workout.attempts = (workout.attempts or 0) + 1
    workout.audio_path = audio_url or workout.audio_path
    workout.duration_seconds = duration_seconds
    workout.transcript = transcript_raw
    workout.speech_metrics = metrics

    if not transcript_raw.strip():
        workout.feedback = daily_service.empty_answer_feedback(workout.question_type, duration_seconds, stt_problem or "no_speech")
        workout.estimated_level = workout.feedback["estimated_level"]
    else:
        await _grade(db, workout, mock)
    db.commit()
    db.refresh(workout)

    return {
        "workout": daily_service.workout_to_dict(workout),
        "streak": daily_service.streak_info(db, current_user.id),
    }


async def _grade(db: Session, workout: DailyWorkout, mock: bool) -> None:
    """
    AI grading of the stored transcript. On AI failure the attempt is kept with grading_failed=True
    (the learner can press "Chấm lại") instead of showing canned feedback.
    """
    _, focus_label = FOCUS_TENSES.get(workout.question_type, ("present", "Hiện tại"))
    result = await run_in_threadpool(
        daily_feedback_llm, workout.question_text, workout.question_type,
        TASK_REQUIREMENTS.get(workout.question_type, ""), focus_label,
        workout.duration_seconds or 0, workout.transcript or "", workout.speech_metrics, mock
    )
    if not result:
        logger.error(f"Daily workout {workout.id}: AI grading failed")
        workout.feedback = {"grading_failed": True}
        return
    llm_data, p_tok, c_tok, cost = result
    db.add(LLMUsageLog(
        session_id=None, call_type="daily_feedback", model="llm",
        prompt_tokens=p_tok, completion_tokens=c_tok, total_tokens=p_tok + c_tok, estimated_cost=cost
    ))
    workout.feedback = daily_service.build_feedback(
        workout.question_type, workout.duration_seconds or 0, workout.speech_metrics, llm_data, workout.transcript or ""
    )
    workout.estimated_level = workout.feedback["estimated_level"]
    # Only a graded real answer keeps the streak alive
    workout.status = "completed"
    workout.completed_at = workout.completed_at or datetime.datetime.utcnow()


@router.post("/{workout_id}/regrade")
async def regrade_workout(
    workout_id: int,
    mock: bool = Form(False),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Re-runs AI grading on the last recorded attempt (after an AI failure) without recording again."""
    workout = db.query(DailyWorkout).filter(DailyWorkout.id == workout_id, DailyWorkout.user_id == current_user.id).first()
    if not workout:
        raise HTTPException(status_code=404, detail="Không tìm thấy thử thách.")
    if not (workout.transcript or "").strip():
        raise HTTPException(status_code=409, detail="Chưa có bài nói để chấm. Hãy ghi âm lại.")
    if not daily_service.can_submit(workout):
        raise HTTPException(status_code=409, detail="Thử thách này đã hết hạn. Hãy mở thử thách của hôm nay.")
    await _grade(db, workout, bool(mock) and settings.ENVIRONMENT != "production")
    db.commit()
    db.refresh(workout)
    return {
        "workout": daily_service.workout_to_dict(workout),
        "streak": daily_service.streak_info(db, current_user.id),
    }
