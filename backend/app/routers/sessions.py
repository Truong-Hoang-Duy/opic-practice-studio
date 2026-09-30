from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Query, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User
from app.models.session import TestSession
from app.models.question import Question
from app.models.answer import Answer, AnswerVersion
from app.models.evaluation import Evaluation
from app.models.report import SessionReport, LLMUsageLog
from app.schemas.session import (
    SessionCreate,
    SurveySubmit,
    SelfAssessmentSubmit,
    TopicsSubmit,
    SessionResponse,
)
from app.schemas.question import QuestionResponse, UNSCORED_QUESTION_TYPES
from app.schemas.report import SessionReportResponse
from app.core.security import get_current_user
from app.config import settings
from app.services.question_generator import build_session_questions, generate_personalised_guides
from app.services.tts_service import prefetch_speech, refresh_question_audio
from app.services.llm_service import generate_session_report_llm
from app.services.pdf_service import generate_session_pdf
from app.services.evaluation_service import evaluate_versions_in_parallel, exam_level_for, is_mock_session

router = APIRouter(prefix="/sessions", tags=["Sessions"])

@router.post("", response_model=SessionResponse)
def create_session(
    session_in: SessionCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    session = TestSession(
        user_id=current_user.id,
        mode=session_in.mode,
        status="setup"
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return session

@router.post("/{session_id}/survey")
def submit_survey(
    session_id: int,
    survey: SurveySubmit,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    session = db.query(TestSession).filter(TestSession.id == session_id, TestSession.user_id == current_user.id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found.")

    session.survey_data = survey.model_dump()
    db.commit()
    return {"message": "Survey recorded successfully."}

def _fill_personalised_guides(bind, session_id: int, questions: List[dict], level: int):
    """Background task: replaces the generic guides of AI-generated questions with tailored ones."""
    guides, p_tok, c_tok, cost = generate_personalised_guides(questions, level)
    if not guides:
        return
    with Session(bind=bind) as db:
        rows = db.query(Question).filter(Question.session_id == session_id).all()
        texts = {q["order_index"]: q["question_text"] for q in questions}
        for row in rows:
            # Skip rows that were regenerated in the meantime
            if row.order_index in guides and texts.get(row.order_index) == row.question_text:
                row.vietnamese_guide = guides[row.order_index]
        _log_llm_usage(db, session_id, "question_guides", p_tok, c_tok, cost)
        db.commit()

def _log_llm_usage(db: Session, session_id: int, call_type: str, p_tok: int, c_tok: int, cost: float):
    db.add(LLMUsageLog(
        session_id=session_id,
        call_type=call_type,
        model=settings.OPENAI_MODEL,
        prompt_tokens=p_tok,
        completion_tokens=c_tok,
        total_tokens=p_tok + c_tok,
        estimated_cost=cost
    ))
    session = db.query(TestSession).filter(TestSession.id == session_id).first()
    if session:
        session.total_tokens = (session.total_tokens or 0) + p_tok + c_tok
        session.estimated_cost = (session.estimated_cost or 0.0) + cost

def _generate_session_questions(session: TestSession, db: Session, background_tasks: BackgroundTasks, use_ai: bool = True):
    session.status = "in_progress"
    # Remove any existing questions if re-generating
    db.query(Question).filter(Question.session_id == session.id).delete()

    level = session.self_assessment_level or 4
    generated_qs, usage, source = build_session_questions(
        survey_data=session.survey_data or {},
        self_assessment_level=level,
        chosen_topics=session.topics or ["environment", "socio_cultural", "communication_media"],
        use_ai=use_ai
    )

    created_questions = []
    for q_data in generated_qs:
        question = Question(
            session_id=session.id,
            order_index=q_data["order_index"],
            question_text=q_data["question_text"],
            question_type=q_data["question_type"],
            topic=q_data["topic"],
            difficulty=q_data["difficulty"],
            category=q_data.get("category"),
            vietnamese_guide=q_data.get("vietnamese_guide")
        )
        db.add(question)
        created_questions.append(question)

    if usage:
        _log_llm_usage(db, session.id, "question_generation", *usage)
    db.commit()

    # Pre-synthesize Eva audio for all 15 questions in order (background worker, cached on disk)
    prefetch_speech(q["question_text"] for q in generated_qs)

    if source == "ai":
        ai_qs = [q for q in generated_qs if q["question_type"] not in UNSCORED_QUESTION_TYPES]
        background_tasks.add_task(_fill_personalised_guides, db.get_bind(), session.id, ai_qs, level)

    return created_questions, source

@router.post("/{session_id}/self-assessment")
def submit_self_assessment(
    session_id: int,
    assessment: SelfAssessmentSubmit,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    session = db.query(TestSession).filter(TestSession.id == session_id, TestSession.user_id == current_user.id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found.")

    session.self_assessment_level = assessment.level
    if assessment.strict_mode is not None:
        session.mode = "exam" if assessment.strict_mode else "practice"
    db.commit()

    # If topics have already been chosen (TopicSelection before SelfAssessment), generate questions!
    if session.topics and len(session.topics) == 3:
        # The "no AI" shortcut exists only for local UI testing
        use_ai = assessment.use_ai is not False or settings.ENVIRONMENT == "production"
        # DEV sessions also simulate transcription, scoring, model answers and the report
        session.dev_mock = not use_ai
        created, source = _generate_session_questions(session, db, background_tasks, use_ai=use_ai)
        return {
            "message": "Self-assessment recorded and questions generated successfully.",
            "total_questions": len(created),
            "question_source": source,
            "mode": session.mode,
            "session_id": session.id
        }

    return {"message": "Self-assessment recorded successfully.", "mode": session.mode}

@router.post("/{session_id}/topics")
def submit_topics_and_generate_questions(
    session_id: int,
    topics_in: TopicsSubmit,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    session = db.query(TestSession).filter(TestSession.id == session_id, TestSession.user_id == current_user.id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found.")

    session.topics = topics_in.topics
    db.commit()

    # Normal flow is topics -> self-assessment, which generates the questions (one LLM call).
    # Only generate here when the level was submitted first.
    if not session.self_assessment_level:
        return {"message": "Topics saved.", "total_questions": 0, "session_id": session.id}

    created_questions, source = _generate_session_questions(session, db, background_tasks)

    return {
        "message": "Questions generated successfully.",
        "total_questions": len(created_questions),
        "question_source": source,
        "session_id": session.id
    }

@router.get("/{session_id}/status")
def get_session_status(
    session_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    session = db.query(TestSession).filter(TestSession.id == session_id, TestSession.user_id == current_user.id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found.")

    total_questions = db.query(Question).filter(Question.session_id == session.id).count()
    answered_count = db.query(Answer).filter(Answer.session_id == session.id).count()

    return {
        "id": session.id,
        "mode": session.mode,
        "status": session.status,
        "total_questions": total_questions,
        "answered_count": answered_count,
        "self_assessment_level": session.self_assessment_level,
        "topics": session.topics,
        "has_survey": bool(session.survey_data),
        "dev_mock": is_mock_session(session),
        "started_at": session.started_at,
        "completed_at": session.completed_at
    }

@router.get("/{session_id}/next-question", response_model=QuestionResponse)
def get_next_question(
    session_id: int,
    background_tasks: BackgroundTasks,
    after_order: Optional[int] = Query(None, description="Order index of the question the learner is leaving (it may have been skipped)"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    session = db.query(TestSession).filter(TestSession.id == session_id, TestSession.user_id == current_user.id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found.")

    if db.query(Question).filter(Question.session_id == session.id).count() == 0:
        # Setup was never finished: don't let the client treat this as "all answered" and finish it
        raise HTTPException(status_code=409, detail="This session has no questions yet. Please start a new test.")

    answered_q_ids = [a.question_id for a in db.query(Answer.question_id).filter(Answer.session_id == session.id).all()]
    unanswered = db.query(Question).filter(
        Question.session_id == session.id,
        ~Question.id.in_(answered_q_ids) if answered_q_ids else True
    ).order_by(Question.order_index).all()

    # Q1 (self-introduction) is optional: once the learner moves past it or answers a later
    # question, it no longer counts as pending.
    moved_on = after_order is not None or bool(answered_q_ids)
    pending = [q for q in unanswered if not (moved_on and q.question_type in UNSCORED_QUESTION_TYPES)]

    # Prefer the next question after the one being left, then any earlier unanswered one
    next_q = None
    if after_order is not None:
        next_q = next((q for q in pending if q.order_index > after_order), None)
    if next_q is None and pending:
        next_q = pending[0]

    if not next_q:
        raise HTTPException(status_code=404, detail="All questions answered. Session completed.")

    # Synthesize audio if not already done
    refresh_question_audio(next_q, db)

    return next_q

@router.get("/{session_id}/questions", response_model=List[QuestionResponse])
def get_session_questions(
    session_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    session = db.query(TestSession).filter(TestSession.id == session_id, TestSession.user_id == current_user.id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found.")

    questions = db.query(Question).filter(Question.session_id == session.id).order_by(Question.order_index).all()
    return questions

@router.get("/{session_id}/questions/{order_index}", response_model=QuestionResponse)
def get_session_question_by_index(
    session_id: int,
    order_index: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    session = db.query(TestSession).filter(TestSession.id == session_id, TestSession.user_id == current_user.id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found.")

    q = db.query(Question).filter(Question.session_id == session.id, Question.order_index == order_index).first()
    if not q:
        raise HTTPException(status_code=404, detail=f"Question {order_index} not found.")

    refresh_question_audio(q, db)

    return q

@router.post("/{session_id}/questions/{order_index}/skip")
def skip_question(
    session_id: int,
    order_index: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Learner pressed "Next" without recording. In strict exam mode the question is closed for good
    (stored as an empty answer), so it can't be revisited after exiting and resuming.
    """
    session = db.query(TestSession).filter(TestSession.id == session_id, TestSession.user_id == current_user.id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found.")
    q = db.query(Question).filter(Question.session_id == session.id, Question.order_index == order_index).first()
    if not q:
        raise HTTPException(status_code=404, detail=f"Question {order_index} not found.")

    if session.mode != "exam":
        return {"skipped": False, "message": "Practice mode: question left open to revisit."}

    existing = db.query(Answer).filter(Answer.session_id == session.id, Answer.question_id == q.id).first()
    if not existing:
        db.add(Answer(
            question_id=q.id,
            session_id=session.id,
            duration_seconds=0.0,
            transcript_raw="",
            transcript_edited=""
        ))
        db.commit()
    return {"skipped": True}

@router.post("/{session_id}/finish")
def finish_session(
    session_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    session = db.query(TestSession).filter(TestSession.id == session_id, TestSession.user_id == current_user.id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found.")

    session.status = "completed"
    session.completed_at = datetime.utcnow()
    db.commit()

    return {"message": "Session completed.", "session_id": session.id}

@router.get("/{session_id}/report", response_model=SessionReportResponse)
def get_session_report(
    session_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    session = db.query(TestSession).filter(TestSession.id == session_id, TestSession.user_id == current_user.id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found.")

    existing_report = db.query(SessionReport).filter(SessionReport.session_id == session.id).first()
    if existing_report:
        existing_report.target_level = exam_level_for(session)
        return existing_report

    # Generate new report
    questions = db.query(Question).filter(Question.session_id == session.id).order_by(Question.order_index).all()
    answers_by_q = {a.question_id: a for a in db.query(Answer).filter(Answer.session_id == session.id).all()}

    def latest_version(answer):
        return db.query(AnswerVersion).filter(AnswerVersion.answer_id == answer.id).order_by(AnswerVersion.version_number.desc()).first()

    # Strict exam answers are never evaluated during the test: score them all now, in parallel
    pending = []
    for q in questions:
        a = answers_by_q.get(q.id)
        if not a or q.question_type in UNSCORED_QUESTION_TYPES:
            continue
        ver = latest_version(a)
        # Recorded answers are always scored, even when nothing was recognised (standard lowest score)
        if ver and not ver.evaluations and ((ver.transcript or "").strip() or a.audio_path):
            pending.append((ver, q))
    evaluate_versions_in_parallel(db, session, pending)

    evaluations: list[Evaluation] = []
    per_question_summary = []
    for q in questions:
        a = answers_by_q.get(q.id)
        ver = latest_version(a) if a else None
        transcript = ((ver.transcript if ver else None) or (a.transcript_edited if a else "") or "").strip()
        row = {
            "question_num": q.order_index,
            "topic": q.topic,
            "question_text": q.question_text,
            "question_type": q.question_type,
            "transcript": transcript,
            "audio_path": (ver.audio_path if ver and ver.audio_path else None) or (a.audio_path if a else None),
            "duration_seconds": a.duration_seconds if a else None,
        }
        if q.question_type in UNSCORED_QUESTION_TYPES:
            row["status"] = "unscored"
        elif not a:
            row["status"] = "unanswered"
        elif not transcript and not a.audio_path:
            row["status"] = "skipped"
        elif ver and ver.evaluations:
            ev = ver.evaluations[0]
            evaluations.append(ev)
            row.update({
                "status": "scored",
                "estimated_level": ev.estimated_level,
                "score_fluency": ev.score_fluency,
                "score_tenses": ev.score_tenses,
                "score_organization": ev.score_organization,
                "score_vocabulary": ev.score_vocabulary,
                "score_grammar": ev.score_grammar,
                "score_task_completion": ev.score_task_completion
            })
        else:
            row["status"] = "unanswered"
        per_question_summary.append(row)

    if evaluations:
        avg_fluency = sum(e.score_fluency for e in evaluations) / len(evaluations)
        avg_tenses = sum(e.score_tenses for e in evaluations) / len(evaluations)
        avg_org = sum(e.score_organization for e in evaluations) / len(evaluations)
        avg_vocab = sum(e.score_vocabulary for e in evaluations) / len(evaluations)
        avg_grammar = sum(e.score_grammar for e in evaluations) / len(evaluations)
        avg_task = sum(e.score_task_completion for e in evaluations) / len(evaluations)
    else:
        avg_fluency = avg_tenses = avg_org = avg_vocab = avg_grammar = avg_task = 3.0

    radar_scores = {
        "fluency_and_length": round(avg_fluency, 1),
        "tense_control": round(avg_tenses, 1),
        "organization": round(avg_org, 1),
        "vocabulary": round(avg_vocab, 1),
        "grammar": round(avg_grammar, 1),
        "task_completion": round(avg_task, 1)
    }

    answers_summary_text = "\n".join([
        f"Q{item['question_num']} ({item['topic']}): Level {item['estimated_level']} | Fl:{item['score_fluency']} Ten:{item['score_tenses']} Org:{item['score_organization']} Voc:{item['score_vocabulary']} Gr:{item['score_grammar']}"
        for item in per_question_summary if item["status"] == "scored"
    ])

    report_data, p_tok, c_tok, cost = generate_session_report_llm(
        target_level=exam_level_for(session),
        num_answers=len(evaluations),
        answers_summary=answers_summary_text or "No detailed answers available.",
        avg_fluency=avg_fluency,
        avg_tenses=avg_tenses,
        avg_organization=avg_org,
        avg_vocabulary=avg_vocab,
        avg_grammar=avg_grammar,
        avg_task_completion=avg_task,
        mock=is_mock_session(session)
    )

    # Log LLM usage
    llm_log = LLMUsageLog(
        session_id=session.id,
        call_type="session_report",
        model="llm",
        prompt_tokens=p_tok,
        completion_tokens=c_tok,
        total_tokens=p_tok + c_tok,
        estimated_cost=cost
    )
    db.add(llm_log)
    session.total_tokens = (session.total_tokens or 0) + (p_tok + c_tok)
    session.estimated_cost = (session.estimated_cost or 0.0) + cost

    # Generate PDF
    pdf_url = generate_session_pdf(
        session_id=session.id,
        user_name=current_user.full_name or current_user.email,
        overall_level=report_data.get("overall_level", "IM"),
        justification=report_data.get("justification", ""),
        radar_scores=radar_scores,
        strengths=report_data.get("strengths", []),
        weaknesses=report_data.get("weaknesses", []),
        study_plan=report_data.get("study_plan", {})
    )

    new_report = SessionReport(
        session_id=session.id,
        overall_level=report_data.get("overall_level", "IM"),
        justification=report_data.get("justification", "Diagnostic summary completed."),
        radar_scores=radar_scores,
        per_question_summary=per_question_summary,
        frequent_mistakes=report_data.get("frequent_mistakes", []),
        strengths=report_data.get("strengths", []),
        weaknesses=report_data.get("weaknesses", []),
        study_plan=report_data.get("study_plan", {}),
        pdf_path=pdf_url
    )
    db.add(new_report)
    db.commit()
    db.refresh(new_report)
    new_report.target_level = exam_level_for(session)

    return new_report
