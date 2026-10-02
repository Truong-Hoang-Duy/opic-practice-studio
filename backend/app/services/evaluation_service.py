from concurrent.futures import ThreadPoolExecutor
from typing import Any, Dict, List, Optional, Tuple
from sqlalchemy.orm import Session
from app.models.answer import AnswerVersion
from app.models.evaluation import Evaluation, FeedbackItem
from app.models.question import Question
from app.models.report import LLMUsageLog
from app.models.session import TestSession
from app.services.llm_service import evaluate_answer_llm
from app.services.speech_metrics import compute_speech_metrics
from app.core.question_meta import is_narrative_question
from app.core.vocab_meta import normalize_kind, normalize_topic, topic_for_category

# Self-assessment level -> level the answer is evaluated against
EXAM_LEVEL_MAP = {1: "Novice", 2: "Novice", 3: "IL", 4: "IM", 5: "IH", 6: "AL"}


def exam_level_for(session: Optional[TestSession]) -> str:
    return EXAM_LEVEL_MAP.get(session.self_assessment_level, "IM") if session else "IM"


def is_mock_session(session: Optional[TestSession]) -> bool:
    """DEV sessions simulate every AI/STT call (never honoured in production)."""
    from app.config import settings
    return bool(session and getattr(session, "dev_mock", False)) and settings.ENVIRONMENT != "production"


EMPTY_ANSWER_EVALUATION: Dict[str, Any] = {
    "estimated_level": "below_IL",
    "score_fluency": 1,
    "score_tenses": 1,
    "score_organization": 1,
    "score_vocabulary": 1,
    "score_grammar": 1,
    "score_task_completion": 1,
    "tense_control_details": {"past_used": False, "present_used": False, "future_used": False,
                              "explanation": "Không có lời nói nào được ghi nhận để đánh giá thì."},
    "complication_present": False,
    "story_narrative_present": False,
    "feedback_summary": "Không nhận dạng được lời nói trong bản ghi (im lặng, quá nhỏ hoặc lỗi nhận dạng). "
                        "Theo chuẩn OPIc, câu không có nội dung được tính ở mức thấp nhất. Bạn có thể nghe lại bản ghi, "
                        "sửa transcript bằng \"Fix Recognition Errors\" để chấm lại, hoặc ghi âm lại.",
    "actionable_steps": [
        "Kiểm tra micro và nói to, rõ ràng, gần micro hơn.",
        "Bắt đầu nói ngay sau khi Eva đọc xong câu hỏi, tránh im lặng kéo dài.",
        "Nếu bí ý, dùng câu mở đầu an toàn như \"Well, let me think...\" rồi trả lời từng ý ngắn.",
    ],
    "feedback_items": [],
    "tense_timeline": [],
    "tense_distribution": None,
    "vietlish_warnings": [],
    "vocab_upgrades": [],
}

TENSES = ("past", "present", "future", "mixed")
MAX_TIMELINE_ITEMS = 40
MAX_VIETLISH_WARNINGS = 8
MAX_VOCAB_UPGRADES = 4


def _clean_str(v: Any) -> str:
    return v.strip() if isinstance(v, str) else ""


def _normalize_distribution(raw: Any, timeline: List[Dict[str, Any]]) -> Optional[Dict[str, int]]:
    """Percentages that add up to 100. Uses the AI's numbers when sane, otherwise counts the timeline sentences."""
    keys = ("past_pct", "present_pct", "future_pct")
    values = None
    if isinstance(raw, dict):
        try:
            values = [max(0.0, float(raw.get(k) or 0)) for k in keys]
        except (TypeError, ValueError):
            values = None
    if not values or sum(values) <= 0:
        counted = [sum(1 for t in timeline if t["tense"] == name) for name in ("past", "present", "future")]
        values = [float(c) for c in counted]
    total = sum(values)
    if total <= 0:
        return None
    pcts = [round(v * 100 / total) for v in values]
    # Rounding drift goes to the largest share so the bar always fills exactly 100%
    pcts[pcts.index(max(pcts))] += 100 - sum(pcts)
    return dict(zip(keys, pcts))


def normalize_vocab_upgrades(items: Any, fallback_topic: str = "general") -> List[Dict[str, Any]]:
    """IH/AL vocabulary suggestions: keeps complete items only, with a known kind and notebook topic."""
    upgrades, seen = [], set()
    for item in items if isinstance(items, list) else []:
        if not isinstance(item, dict):
            continue
        original, upgraded = _clean_str(item.get("original_phrase")), _clean_str(item.get("upgraded_phrase"))
        if not original or not upgraded or upgraded.lower() in seen or upgraded.lower() == original.lower():
            continue
        seen.add(upgraded.lower())
        upgrades.append({
            "original_phrase": original,
            "upgraded_phrase": upgraded[:255],
            "kind": normalize_kind(item.get("kind")),
            "topic": normalize_topic(item.get("topic"), fallback_topic),
            "example_sentence": _clean_str(item.get("example_sentence")),
            "note_vi": _clean_str(item.get("note_vi")),
        })
    return upgrades[:MAX_VOCAB_UPGRADES]


def normalize_speech_intelligence(data: Dict[str, Any]) -> Dict[str, Any]:
    """Validates the AI's tense map and Vietlish warnings (they arrive as free JSON) before they are stored."""
    timeline = []
    for item in data.get("tense_timeline") or []:
        if not isinstance(item, dict) or not _clean_str(item.get("sentence")):
            continue
        tense = _clean_str(item.get("tense")).lower()
        status = _clean_str(item.get("status")).lower()
        timeline.append({
            "sentence": _clean_str(item.get("sentence")),
            "tense": tense if tense in TENSES else "mixed",
            "status": status if status in ("correct", "incorrect") else "correct",
            "note_vi": _clean_str(item.get("note_vi")),
        })
    timeline = timeline[:MAX_TIMELINE_ITEMS]

    warnings = []
    for item in data.get("vietlish_warnings") or []:
        if not isinstance(item, dict):
            continue
        original, suggested = _clean_str(item.get("original_phrase")), _clean_str(item.get("suggested_phrase"))
        if not original or not suggested:
            continue
        warnings.append({
            "original_phrase": original,
            "issue_vi": _clean_str(item.get("issue_vi")),
            "suggested_phrase": suggested,
            "explanation_vi": _clean_str(item.get("explanation_vi")),
        })

    data["tense_timeline"] = timeline
    data["tense_distribution"] = _normalize_distribution(data.get("tense_distribution"), timeline) if timeline or data.get("tense_distribution") else None
    data["vietlish_warnings"] = warnings[:MAX_VIETLISH_WARNINGS]
    return data


def run_evaluation_llm(question: Optional[Question], exam_level: str, transcript: str, mock: bool = False) -> Tuple[Dict[str, Any], int, int, float]:
    """Pure LLM call (no DB access) so it can run in worker threads. Empty answers get the standard lowest score."""
    if not (transcript or "").strip():
        return dict(EMPTY_ANSWER_EVALUATION), 0, 0, 0.0
    data, p_tok, c_tok, cost = evaluate_answer_llm(
        question_text=question.question_text if question else "General OPIc Question",
        question_type=question.question_type if question else "description",
        topic=question.topic if question else "General",
        target_level=exam_level,
        transcript=transcript,
        mock=mock
    )
    data = normalize_speech_intelligence(data)
    data["vocab_upgrades"] = normalize_vocab_upgrades(
        data.get("vocab_upgrades"), topic_for_category(getattr(question, "category", None))
    )
    return data, p_tok, c_tok, cost


def speech_metrics_for_version(version: Optional[AnswerVersion]) -> Optional[Dict[str, Any]]:
    """
    Speech flow of the audio behind a version. Typed corrections reuse the take they correct; AI rewrites
    were never spoken (None). Takes recorded before this feature are analysed on the fly when the answer
    still holds their word timings (only the latest take's words are kept on the answer).
    """
    if not version:
        return None
    if version.speech_metrics:
        return version.speech_metrics
    if version.source == "rewrite_applied":
        return None
    answer = version.answer
    takes = sorted((v for v in answer.versions if v.source == "stt"), key=lambda v: v.version_number) if answer else []
    if version.source != "stt":
        earlier = [v for v in takes if v.version_number < version.version_number]
        return speech_metrics_for_version(earlier[-1]) if earlier else None
    if takes and takes[-1].id == version.id:
        return compute_speech_metrics(answer.word_confidences, version.duration_seconds or answer.duration_seconds)
    return None


def attach_speech_intelligence(eval_obj: Evaluation, version: Optional[AnswerVersion], question: Optional[Question]) -> Evaluation:
    """Adds the non-stored fields of the evaluation response (speech metrics of the take, narrative flag)."""
    eval_obj.speech_metrics = speech_metrics_for_version(version)
    eval_obj.narrative_expected = is_narrative_question(question.question_type if question else None)
    return eval_obj


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
        tense_timeline=eval_data.get("tense_timeline") or [],
        tense_distribution=eval_data.get("tense_distribution"),
        vietlish_warnings=eval_data.get("vietlish_warnings") or [],
        vocab_upgrades=eval_data.get("vocab_upgrades") or [],
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
    mock = is_mock_session(session)
    with ThreadPoolExecutor(max_workers=min(max_workers, len(pending))) as pool:
        results = list(pool.map(lambda item: run_evaluation_llm(item[1], exam_level, item[0].transcript, mock), pending))
    for (version, _), (eval_data, p_tok, c_tok, cost) in zip(pending, results):
        save_evaluation(db, session.id, version, eval_data, p_tok, c_tok, cost)
