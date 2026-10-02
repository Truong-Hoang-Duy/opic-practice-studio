from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field


class VocabularyCreate(BaseModel):
    original_phrase: Optional[str] = Field(None, max_length=500)
    upgraded_phrase: str = Field(min_length=1, max_length=255)
    kind: Optional[str] = "collocation"
    topic: Optional[str] = "general"
    example_sentence: Optional[str] = Field(None, max_length=1000)
    note_vi: Optional[str] = Field(None, max_length=1000)
    source_question_id: Optional[int] = None


class VocabularyUpdate(BaseModel):
    status: Optional[str] = None  # learning | mastered
    topic: Optional[str] = None


class VocabularyResponse(BaseModel):
    id: int
    original_phrase: Optional[str] = None
    upgraded_phrase: str
    kind: str
    topic: str
    example_sentence: Optional[str] = None
    note_vi: Optional[str] = None
    status: str
    source_question_id: Optional[int] = None
    created_at: datetime
    mastered_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class SpeakRequest(BaseModel):
    text: str = Field(min_length=1, max_length=300)
