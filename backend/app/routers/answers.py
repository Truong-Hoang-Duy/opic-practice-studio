import difflib
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User
from app.models.question import Question
from app.models.answer import Answer, AnswerVersion
from app.models.evaluation import Evaluation, FeedbackItem
from app.models.report import LLMUsageLog
from app.schemas.answer import (
    AnswerResponse,
    TranscriptEdit,
    AnswerVersionResponse,
)
from app.schemas.evaluation import (
    EvaluationResponse,
    RewriteRequest,
    RewriteResponse,
    DiffChunk,
)
from app.core.security import get_current_user
from app.services.stt_service import save_raw_audio, parse_words_with_confidence
from app.services.llm_service import evaluate_answer_llm, rewrite_answer_llm

router = APIRouter(prefix="/answers", tags=["Answers"])

def compute_diff_chunks(original: str, improved: str) -> List[DiffChunk]:
    """Computes word-level diffs for side-by-side comparison."""
    orig_words = original.split()
    imp_words = improved.split()
    matcher = difflib.SequenceMatcher(None, orig_words, imp_words)
    chunks: List[DiffChunk] = []

    for tag, i1, i2, j1, j2 in matcher.get_opcodes():
        if tag == 'equal':
            chunks.append(DiffChunk(type="equal", text=" ".join(orig_words[i1:i2]) + " "))
        elif tag == 'delete':
            chunks.append(DiffChunk(type="delete", text=" ".join(orig_words[i1:i2]) + " "))
        elif tag == 'insert':
            chunks.append(DiffChunk(type="insert", text=" ".join(imp_words[j1:j2]) + " "))
        elif tag == 'replace':
            chunks.append(DiffChunk(type="delete", text=" ".join(orig_words[i1:i2]) + " "))
            chunks.append(DiffChunk(type="insert", text=" ".join(imp_words[j1:j2]) + " "))

    return chunks

@router.post("", response_model=AnswerResponse)
async def submit_answer(
    question_id: int = Form(...),
    session_id: int = Form(...),
    duration_seconds: float = Form(0.0),
    transcript_raw: str = Form(...),
    audio_file: Optional[UploadFile] = File(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    audio_url = None
    if audio_file:
        file_bytes = await audio_file.read()
        filename = f"user_{current_user.id}_q{question_id}_{audio_file.filename or 'record.webm'}"
        audio_url = await save_raw_audio(file_bytes, filename)

    word_confidences = parse_words_with_confidence(transcript_raw)

    # Check if answer exists for this question
    existing = db.query(Answer).filter(Answer.question_id == question_id, Answer.session_id == session_id).first()
    if existing:
        # Update existing answer
        existing.audio_path = audio_url or existing.audio_path
        existing.duration_seconds = duration_seconds
        existing.transcript_raw = transcript_raw
        existing.transcript_edited = transcript_raw
        existing.word_confidences = word_confidences

        # Next version
        max_ver = max([v.version_number for v in existing.versions] or [0])
        new_version = AnswerVersion(
            answer_id=existing.id,
            version_number=max_ver + 1,
            transcript=transcript_raw,
            source="stt",
            notes="Re-recorded answer"
        )
        db.add(new_version)
        db.commit()
        db.refresh(existing)
        return existing

    answer = Answer(
        question_id=question_id,
        session_id=session_id,
        audio_path=audio_url,
        duration_seconds=duration_seconds,
        transcript_raw=transcript_raw,
        transcript_edited=transcript_raw,
        word_confidences=word_confidences
    )
    db.add(answer)
    db.commit()
    db.refresh(answer)

    # Initial version (v1)
    v1 = AnswerVersion(
        answer_id=answer.id,
        version_number=1,
        transcript=transcript_raw,
        source="stt",
        notes="Initial STT recognition"
    )
    db.add(v1)
    db.commit()
    db.refresh(answer)

    return answer

@router.patch("/{answer_id}/transcript", response_model=AnswerVersionResponse)
def edit_transcript(
    answer_id: int,
    edit_in: TranscriptEdit,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    answer = db.query(Answer).filter(Answer.id == answer_id).first()
    if not answer:
        raise HTTPException(status_code=404, detail="Answer not found.")

    answer.transcript_edited = edit_in.transcript_edited.strip()
    max_ver = max([v.version_number for v in answer.versions] or [0])
    
    new_version = AnswerVersion(
        answer_id=answer.id,
        version_number=max_ver + 1,
        transcript=edit_in.transcript_edited.strip(),
        source="user_edit",
        notes=edit_in.notes or "User corrected transcript"
    )
    db.add(new_version)
    db.commit()
    db.refresh(new_version)

    return new_version

@router.post("/{answer_id}/evaluate", response_model=EvaluationResponse)
def evaluate_answer(
    answer_id: int,
    version_id: Optional[int] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    answer = db.query(Answer).filter(Answer.id == answer_id).first()
    if not answer:
        raise HTTPException(status_code=404, detail="Answer not found.")

    if version_id:
        ver = db.query(AnswerVersion).filter(AnswerVersion.id == version_id, AnswerVersion.answer_id == answer.id).first()
    else:
        # Default to latest version
        ver = db.query(AnswerVersion).filter(AnswerVersion.answer_id == answer.id).order_by(AnswerVersion.version_number.desc()).first()

    if not ver:
        raise HTTPException(status_code=404, detail="Answer version not found.")

    # Check if already evaluated
    existing_eval = db.query(Evaluation).filter(Evaluation.answer_version_id == ver.id).first()
    if existing_eval:
        return existing_eval

    q = answer.question
    eval_data, p_tok, c_tok, cost = evaluate_answer_llm(
        question_text=q.question_text if q else "General OPIc Question",
        question_type=q.question_type if q else "description",
        topic=q.topic if q else "General",
        target_level="IH",
        transcript=ver.transcript
    )

    # Log usage
    llm_log = LLMUsageLog(
        session_id=answer.session_id,
        call_type="evaluation",
        model="llm",
        prompt_tokens=p_tok,
        completion_tokens=c_tok,
        total_tokens=p_tok + c_tok,
        estimated_cost=cost
    )
    db.add(llm_log)

    eval_obj = Evaluation(
        answer_version_id=ver.id,
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

    # Save feedback items
    for item in eval_data.get("feedback_items", []):
        fb = FeedbackItem(
            evaluation_id=eval_obj.id,
            mistake=item.get("mistake", ""),
            correction=item.get("correction", ""),
            explanation_en=item.get("explanation_en", ""),
            explanation_vi=item.get("explanation_vi", ""),
            category=item.get("category", "grammar")
        )
        db.add(fb)
    db.commit()
    db.refresh(eval_obj)

    return eval_obj

@router.post("/{answer_id}/rewrite", response_model=RewriteResponse)
def rewrite_answer(
    answer_id: int,
    req: RewriteRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    answer = db.query(Answer).filter(Answer.id == answer_id).first()
    if not answer:
        raise HTTPException(status_code=404, detail="Answer not found.")

    ver = db.query(AnswerVersion).filter(AnswerVersion.id == req.answer_version_id).first()
    if not ver:
        raise HTTPException(status_code=404, detail="Target answer version not found.")

    # Determine current level from evaluation if exists
    current_lvl = "IM"
    if ver.evaluations:
        current_lvl = ver.evaluations[0].estimated_level

    # Default next level upgrade: IL -> IM, IM -> IH, below_IL -> IL
    level_progression = {"below_IL": "IL", "IL": "IM", "IM": "IH", "IH": "IH"}
    target_lvl = req.target_level or level_progression.get(current_lvl, "IH")

    q = answer.question
    data, p_tok, c_tok, cost = rewrite_answer_llm(
        question_text=q.question_text if q else "General question",
        current_level=current_lvl,
        target_level=target_lvl,
        transcript=ver.transcript
    )

    improved_text = data.get("improved_text", ver.transcript)
    diff_chunks = compute_diff_chunks(ver.transcript, improved_text)

    # Log LLM
    llm_log = LLMUsageLog(
        session_id=answer.session_id,
        call_type="rewrite",
        model="llm",
        prompt_tokens=p_tok,
        completion_tokens=c_tok,
        total_tokens=p_tok + c_tok,
        estimated_cost=cost
    )
    db.add(llm_log)
    db.commit()

    return RewriteResponse(
        original_text=ver.transcript,
        improved_text=improved_text,
        current_level=current_lvl,
        target_level=target_lvl,
        changes_explanation=data.get("changes_explanation", ""),
        vietnamese_coaching_notes=data.get("vietnamese_coaching_notes", ""),
        diff_chunks=diff_chunks,
        key_expressions_added=data.get("key_expressions_added", [])
    )

@router.post("/{answer_id}/accept-rewrite", response_model=AnswerVersionResponse)
def accept_rewrite(
    answer_id: int,
    improved_text: str = Form(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    answer = db.query(Answer).filter(Answer.id == answer_id).first()
    if not answer:
        raise HTTPException(status_code=404, detail="Answer not found.")

    answer.transcript_edited = improved_text.strip()
    max_ver = max([v.version_number for v in answer.versions] or [0])

    new_version = AnswerVersion(
        answer_id=answer.id,
        version_number=max_ver + 1,
        transcript=improved_text.strip(),
        source="rewrite_applied",
        notes="Accepted AI improved version"
    )
    db.add(new_version)
    db.commit()
    db.refresh(new_version)

    return new_version

@router.delete("/{answer_id}")
def delete_answer(
    answer_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    answer = db.query(Answer).filter(Answer.id == answer_id).first()
    if not answer:
        raise HTTPException(status_code=404, detail="Answer not found.")

    db.delete(answer)
    db.commit()
    return {"message": "Answer deleted successfully."}
