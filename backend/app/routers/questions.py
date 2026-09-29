from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.question import Question, ModelAnswer
from app.schemas.question import QuestionResponse, ModelAnswerResponse
from app.core.security import get_current_user
from app.services.tts_service import synthesize_speech
from app.services.llm_service import generate_model_answers_llm

router = APIRouter(prefix="/questions", tags=["Questions"])

@router.get("/{question_id}", response_model=QuestionResponse)
def get_question(question_id: int, db: Session = Depends(get_db)):
    q = db.query(Question).filter(Question.id == question_id).first()
    if not q:
        raise HTTPException(status_code=404, detail="Question not found.")
    
    if not q.audio_path:
        q.audio_path = synthesize_speech(q.question_text)
        db.commit()

    return q

@router.get("/{question_id}/audio")
def get_question_audio(question_id: int, db: Session = Depends(get_db)):
    q = db.query(Question).filter(Question.id == question_id).first()
    if not q:
        raise HTTPException(status_code=404, detail="Question not found.")

    if not q.audio_path:
        q.audio_path = synthesize_speech(q.question_text)
        db.commit()

    return {"audio_url": q.audio_path}

@router.get("/{question_id}/model-answers", response_model=List[ModelAnswerResponse])
def get_model_answers(
    question_id: int,
    level: Optional[str] = Query(None, description="Optional filter by level (IL, IM, IH)"),
    db: Session = Depends(get_db)
):
    q = db.query(Question).filter(Question.id == question_id).first()
    if not q:
        raise HTTPException(status_code=404, detail="Question not found.")

    existing_models = db.query(ModelAnswer).filter(ModelAnswer.question_id == q.id).all()
    if not existing_models:
        # Generate 3 model answers via LLM
        data, _, _, _ = generate_model_answers_llm(
            question_text=q.question_text,
            topic=q.topic,
            question_type=q.question_type
        )
        
        answers_list = data.get("answers", [])
        for ans in answers_list:
            lvl = ans.get("level", "IM")
            txt = ans.get("text", "")
            rationale = ans.get("rationale", "")
            sentences = ans.get("sentences", [txt])
            audio_url = synthesize_speech(txt)

            model_obj = ModelAnswer(
                question_id=q.id,
                level=lvl,
                text=txt,
                rationale=rationale,
                audio_path=audio_url,
                sentences=sentences
            )
            db.add(model_obj)
        db.commit()
        existing_models = db.query(ModelAnswer).filter(ModelAnswer.question_id == q.id).all()

    if level:
        existing_models = [m for m in existing_models if m.level.upper() == level.upper()]

    return existing_models
