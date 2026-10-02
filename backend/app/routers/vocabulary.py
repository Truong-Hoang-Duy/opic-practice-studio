import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from fastapi.concurrency import run_in_threadpool
from sqlalchemy import func
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User
from app.models.vocabulary import UserVocabulary
from app.core.security import get_current_user
from app.core.vocab_meta import VOCAB_TOPICS, VOCAB_KINDS, VOCAB_STATUSES, normalize_kind, normalize_topic
from app.schemas.vocabulary import VocabularyCreate, VocabularyUpdate, VocabularyResponse, SpeakRequest
from app.services.tts_service import synthesize_speech

router = APIRouter(prefix="/vocabulary", tags=["Vocabulary Notebook"])


def _owned(db: Session, user: User, vocab_id: int) -> UserVocabulary:
    item = db.query(UserVocabulary).filter(UserVocabulary.id == vocab_id, UserVocabulary.user_id == user.id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Không tìm thấy cụm từ trong sổ tay.")
    return item


@router.get("/meta")
def vocabulary_meta():
    """Topic and kind labels for the notebook filters."""
    return {
        "topics": [{"key": k, "label": v} for k, v in VOCAB_TOPICS.items()],
        "kinds": [{"key": k, "label": v} for k, v in VOCAB_KINDS.items()],
    }


@router.get("", response_model=List[VocabularyResponse])
def list_vocabulary(
    topic: Optional[str] = None,
    status: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """The learner's notebook, newest first, optionally filtered by topic and learning status."""
    query = db.query(UserVocabulary).filter(UserVocabulary.user_id == current_user.id)
    if topic:
        query = query.filter(UserVocabulary.topic == topic)
    if status:
        query = query.filter(UserVocabulary.status == status)
    return query.order_by(UserVocabulary.created_at.desc(), UserVocabulary.id.desc()).all()


@router.post("", response_model=VocabularyResponse)
def save_vocabulary(
    item_in: VocabularyCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Saves a phrase (idempotent: the same upgraded phrase is stored once per learner)."""
    phrase = item_in.upgraded_phrase.strip()
    if not phrase:
        raise HTTPException(status_code=422, detail="Cụm từ không được để trống.")
    existing = (
        db.query(UserVocabulary)
        .filter(UserVocabulary.user_id == current_user.id, func.lower(UserVocabulary.upgraded_phrase) == phrase.lower())
        .first()
    )
    if existing:
        return existing
    item = UserVocabulary(
        user_id=current_user.id,
        original_phrase=(item_in.original_phrase or "").strip() or None,
        upgraded_phrase=phrase,
        kind=normalize_kind(item_in.kind),
        topic=normalize_topic(item_in.topic),
        example_sentence=(item_in.example_sentence or "").strip() or None,
        note_vi=(item_in.note_vi or "").strip() or None,
        source_question_id=item_in.source_question_id,
        status="learning",
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.patch("/{vocab_id}", response_model=VocabularyResponse)
def update_vocabulary(
    vocab_id: int,
    update_in: VocabularyUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    item = _owned(db, current_user, vocab_id)
    if update_in.status is not None:
        if update_in.status not in VOCAB_STATUSES:
            raise HTTPException(status_code=422, detail="status must be 'learning' or 'mastered'.")
        if update_in.status != item.status:
            item.status = update_in.status
            item.mastered_at = datetime.datetime.utcnow() if update_in.status == "mastered" else None
    if update_in.topic is not None:
        item.topic = normalize_topic(update_in.topic, item.topic)
    db.commit()
    db.refresh(item)
    return item


@router.delete("/{vocab_id}")
def delete_vocabulary(
    vocab_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    db.delete(_owned(db, current_user, vocab_id))
    db.commit()
    return {"message": "Đã xoá khỏi sổ tay."}


@router.post("/speak")
async def speak_phrase(req: SpeakRequest, current_user: User = Depends(get_current_user)):
    """Eva's pronunciation of a phrase/example (cached). url is null when server audio is off -> browser speech."""
    url = await run_in_threadpool(synthesize_speech, req.text.strip())
    return {"url": url}
