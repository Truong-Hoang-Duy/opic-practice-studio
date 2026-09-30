from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, status
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
from app.schemas.question import QuestionResponse
from app.schemas.report import SessionReportResponse
from app.core.security import get_current_user
from app.services.question_generator import generate_15_opic_questions
from app.services.tts_service import synthesize_speech
from app.services.llm_service import generate_session_report_llm
from app.services.pdf_service import generate_session_pdf

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

def _generate_session_questions(session: TestSession, db: Session, background_tasks: BackgroundTasks):
    session.status = "in_progress"
    # Remove any existing questions if re-generating
    db.query(Question).filter(Question.session_id == session.id).delete()

    generated_qs = generate_15_opic_questions(
        survey_data=session.survey_data or {},
        self_assessment_level=session.self_assessment_level or 4,
        chosen_topics=session.topics or ["environment", "socio_cultural", "communication_media"]
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
            vietnamese_guide=q_data.get("vietnamese_guide")
        )
        db.add(question)
        created_questions.append(question)

    db.commit()

    # Pre-synthesize Eva audio for first 3 questions in background
    for q in created_questions[:3]:
        background_tasks.add_task(synthesize_speech, q.question_text)

    return created_questions

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
    db.commit()

    # If topics have already been chosen (TopicSelection before SelfAssessment), generate questions!
    if session.topics and len(session.topics) == 3:
        created = _generate_session_questions(session, db, background_tasks)
        return {
            "message": "Self-assessment recorded and questions generated successfully.",
            "total_questions": len(created),
            "session_id": session.id
        }

    return {"message": "Self-assessment recorded successfully."}

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

    created_questions = _generate_session_questions(session, db, background_tasks)

    return {
        "message": "Questions generated successfully.",
        "total_questions": len(created_questions),
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
        "started_at": session.started_at,
        "completed_at": session.completed_at
    }

@router.get("/{session_id}/next-question", response_model=QuestionResponse)
def get_next_question(
    session_id: int,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    session = db.query(TestSession).filter(TestSession.id == session_id, TestSession.user_id == current_user.id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found.")

    # Find unanswered question with lowest order_index
    answered_q_ids = [a.question_id for a in db.query(Answer.question_id).filter(Answer.session_id == session.id).all()]
    next_q = db.query(Question).filter(
        Question.session_id == session.id,
        ~Question.id.in_(answered_q_ids) if answered_q_ids else True
    ).order_by(Question.order_index).first()

    if not next_q:
        raise HTTPException(status_code=404, detail="All questions answered. Session completed.")

    # Synthesize audio if not already done
    if not next_q.audio_path:
        next_q.audio_path = synthesize_speech(next_q.question_text)
        db.commit()

    return next_q

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
        return existing_report

    # Generate new report
    answers = db.query(Answer).filter(Answer.session_id == session.id).all()
    evaluations: list[Evaluation] = []
    per_question_summary = []

    for a in answers:
        latest_ver = db.query(AnswerVersion).filter(AnswerVersion.answer_id == a.id).order_by(AnswerVersion.version_number.desc()).first()
        if latest_ver and latest_ver.evaluations:
            ev = latest_ver.evaluations[0]
            evaluations.append(ev)
            q = a.question
            per_question_summary.append({
                "question_num": q.order_index if q else 1,
                "topic": q.topic if q else "General",
                "estimated_level": ev.estimated_level,
                "score_fluency": ev.score_fluency,
                "score_tenses": ev.score_tenses,
                "score_organization": ev.score_organization,
                "score_vocabulary": ev.score_vocabulary,
                "score_grammar": ev.score_grammar,
                "score_task_completion": ev.score_task_completion
            })

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
        for item in per_question_summary
    ])

    report_data, p_tok, c_tok, cost = generate_session_report_llm(
        target_level="IH",
        num_answers=len(answers),
        answers_summary=answers_summary_text or "No detailed answers available.",
        avg_fluency=avg_fluency,
        avg_tenses=avg_tenses,
        avg_organization=avg_org,
        avg_vocabulary=avg_vocab,
        avg_grammar=avg_grammar,
        avg_task_completion=avg_task
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

    return new_report
