from typing import List, Dict, Any
from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User
from app.models.session import TestSession
from app.models.question import Question
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
    sessions = (
        db.query(TestSession)
        .filter(TestSession.user_id == current_user.id)
        .order_by(TestSession.started_at.desc(), TestSession.id.desc())
        .all()
    )
    total = len(sessions)
    if not sessions:
        return []

    s_ids = [s.id for s in sessions]

    # Batch fetch reports to eliminate N+1 queries
    reports = db.query(SessionReport).filter(SessionReport.session_id.in_(s_ids)).all()
    report_by_sid = {r.session_id: r for r in reports}

    # Batch count answers per session
    ans_counts = (
        db.query(Answer.session_id, func.count(Answer.id))
        .filter(Answer.session_id.in_(s_ids))
        .group_by(Answer.session_id)
        .all()
    )
    ans_count_by_sid = dict(ans_counts)

    # Batch count questions per session (avoiding lazy-load queries)
    q_counts = (
        db.query(Question.session_id, func.count(Question.id))
        .filter(Question.session_id.in_(s_ids))
        .group_by(Question.session_id)
        .all()
    )
    q_count_by_sid = dict(q_counts)

    result = []
    for idx, s in enumerate(sessions):
        report = report_by_sid.get(s.id)
        ans_count = ans_count_by_sid.get(s.id, 0)
        q_count = q_count_by_sid.get(s.id, 0)
        result.append({
            "id": s.id,
            "session_number": total - idx,
            "mode": s.mode,
            "status": s.status,
            "self_assessment_level": s.self_assessment_level,
            "topics": s.topics or [],
            "answered_count": ans_count,
            "total_questions": q_count,
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

    total_answers = (
        db.query(func.count(Answer.id))
        .filter(Answer.session_id.in_(session_ids))
        .scalar()
    ) if session_ids else 0
    total_speaking_seconds = (
        db.query(func.coalesce(func.sum(Answer.duration_seconds), 0.0))
        .filter(Answer.session_id.in_(session_ids))
        .scalar()
    ) if session_ids else 0.0

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
        "total_speaking_minutes": round(float(total_speaking_seconds) / 60.0, 1),
        "level_distribution": level_counts,
        "average_radar_scores": avg_scores,
        "target_level": "IH"
    }
