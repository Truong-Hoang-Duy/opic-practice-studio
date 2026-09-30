from concurrent.futures import ThreadPoolExecutor
from typing import Any, Dict, List, Optional, Tuple
from sqlalchemy.orm import Session
from app.models.answer import AnswerVersion
from app.models.evaluation import Evaluation, FeedbackItem
from app.models.question import Question
from app.models.report import LLMUsageLog
from app.models.session import TestSession
from app.services.llm_service import evaluate_answer_llm

# Self-assessment level -> level the answer is evaluated against
EXAM_LEVEL_MAP = {1: "Novice", 2: "Novice", 3: "IL", 4: "IM", 5: "IH", 6: "AL"}


def exam_level_for(session: Optional[TestSession]) -> str:
    return EXAM_LEVEL_MAP.get(session.self_assessment_level, "IM") if session else "IM"


def run_evaluation_llm(question: Optional[Question], exam_level: str, transcript: str) -> Tuple[Dict[str, Any], int, int, float]:
    """Pure LLM call (no DB access) so it can run in worker threads."""
    return evaluate_answer_llm(
        question_text=question.question_text if question else "General OPIc Question",
        question_type=question.question_type if question else "description",
        topic=question.topic if question else "General",
        target_level=exam_level,
        transcript=transcript
    )


def save_evaluation(
    db: Session,
    session_id: int,
    version: AnswerVersion,
    eval_data: Dict[str, Any],
    p_tok: int,
    c_tok: int,
    cost: float
) -> Evaluation:
    db.add(LLMUsageLog(
        session_id=session_id,
        call_type="evaluation",
        model="llm",
        prompt_tokens=p_tok,
        completion_tokens=c_tok,
        total_tokens=p_tok + c_tok,
        estimated_cost=cost
    ))

    eval_obj = Evaluation(
        answer_version_id=version.id,
        estimated_level=eval_data.get("estimated_level", "IM"),
        score_fluency=eval_data.get("score_fluency", 3),
        score_tenses=eval_data.get("score_tenses", 3),
        score_organization=eval_data.get("score_organization", 3),
        score_vocabulary=eval_data.get("score_vocabulary", 3),
        score_grammar=eval_data.get("score_grammar", 3),
        score_task_completion=eval_data.get("score_task_completion", 3),
        tense_control_details=eval_data.get("tense_control_details", {}),
        complication_present=eval_data.get("complication_present", False),
        story_narrative_present=eval_data.get("story_narrative_present", False),
        feedback_summary=eval_data.get("feedback_summary", "Evaluation complete."),
        actionable_steps=eval_data.get("actionable_steps", [])
    )
    db.add(eval_obj)
    db.commit()
    db.refresh(eval_obj)

    for item in eval_data.get("feedback_items", []):
        db.add(FeedbackItem(
            evaluation_id=eval_obj.id,
            mistake=item.get("mistake", ""),
            correction=item.get("correction", ""),
            explanation_en=item.get("explanation_en", ""),
            explanation_vi=item.get("explanation_vi", ""),
            category=item.get("category", "grammar")
        ))
    db.commit()
    db.refresh(eval_obj)
    return eval_obj


def evaluate_versions_in_parallel(
    db: Session,
    session: TestSession,
    pending: List[Tuple[AnswerVersion, Question]],
    max_workers: int = 8
) -> None:
    """Evaluates many answer versions concurrently (LLM calls in threads, DB writes on this thread)."""
    if not pending:
        return
    exam_level = exam_level_for(session)
    with ThreadPoolExecutor(max_workers=min(max_workers, len(pending))) as pool:
        results = list(pool.map(lambda item: run_evaluation_llm(item[1], exam_level, item[0].transcript), pending))
    for (version, _), (eval_data, p_tok, c_tok, cost) in zip(pending, results):
        save_evaluation(db, session.id, version, eval_data, p_tok, c_tok, cost)
