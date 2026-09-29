from typing import List, Dict, Any
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User
from app.models.session import TestSession
from app.models.answer import Answer, AnswerVersion
from app.models.evaluation import Evaluation
from app.models.report import SessionReport
from app.core.security import get_current_user

router = APIRouter(prefix="/history", tags=["History & Analytics"])

@router.get("")
def get_user_history(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    sessions = db.query(TestSession).filter(TestSession.user_id == current_user.id).order_by(TestSession.started_at.desc()).all()

    result = []
    for s in sessions:
        report = db.query(SessionReport).filter(SessionReport.session_id == s.id).first()
        ans_count = db.query(Answer).filter(Answer.session_id == s.id).count()
        result.append({
            "id": s.id,
            "mode": s.mode,
            "status": s.status,
            "self_assessment_level": s.self_assessment_level,
            "topics": s.topics or [],
            "answered_count": ans_count,
            "total_questions": len(s.questions),
            "overall_level": report.overall_level if report else None,
            "radar_scores": report.radar_scores if report else None,
            "pdf_path": report.pdf_path if report else None,
            "started_at": s.started_at,
            "completed_at": s.completed_at
        })

    return result

@router.get("/stats")
def get_user_stats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    sessions = db.query(TestSession).filter(TestSession.user_id == current_user.id).all()
    session_ids = [s.id for s in sessions]

    total_sessions = len(sessions)
    completed_sessions = sum(1 for s in sessions if s.status == "completed")
    
    answers = db.query(Answer).filter(Answer.session_id.in_(session_ids)).all() if session_ids else []
    total_answers = len(answers)
    total_speaking_seconds = sum(a.duration_seconds for a in answers if a.duration_seconds)

    # Level counts
    reports = db.query(SessionReport).filter(SessionReport.session_id.in_(session_ids)).all() if session_ids else []
    level_counts = {"below_IL": 0, "IL": 0, "IM": 0, "IH": 0}
    for r in reports:
        if r.overall_level in level_counts:
            level_counts[r.overall_level] += 1

    # Average radar sub-scores across all completed reports
    avg_scores = {
        "fluency_and_length": 3.0,
        "tense_control": 3.0,
        "organization": 3.0,
        "vocabulary": 3.0,
        "grammar": 3.0,
        "task_completion": 3.0
    }
    if reports:
        for k in avg_scores.keys():
            scores_k = [r.radar_scores.get(k, 3.0) for r in reports if r.radar_scores and k in r.radar_scores]
            if scores_k:
                avg_scores[k] = round(sum(scores_k) / len(scores_k), 1)

    return {
        "total_sessions": total_sessions,
        "completed_sessions": completed_sessions,
        "total_answers": total_answers,
        "total_speaking_minutes": round(total_speaking_seconds / 60.0, 1),
        "level_distribution": level_counts,
        "average_radar_scores": avg_scores,
        "target_level": "IH"
    }
