from typing import List, Optional, Dict, Any
from datetime import datetime
from pydantic import BaseModel, ConfigDict

class WordConfidence(BaseModel):
    word: str
    confidence: float # 0.0 to 1.0
    start_ms: Optional[int] = None
    end_ms: Optional[int] = None

class AnswerSubmit(BaseModel):
    question_id: int
    duration_seconds: float = 0.0
    transcript_raw: str
    word_confidences: Optional[List[WordConfidence]] = None

class TranscriptEdit(BaseModel):
    transcript_edited: str
    notes: Optional[str] = "User edited transcript"

class AnswerVersionResponse(BaseModel):
    id: int
    answer_id: int
    version_number: int
    transcript: str
    source: str
    notes: Optional[str] = None
    audio_path: Optional[str] = None
    duration_seconds: Optional[float] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class AnswerResponse(BaseModel):
    id: int
    question_id: int
    session_id: int
    audio_path: Optional[str] = None
    duration_seconds: float = 0.0
    transcript_raw: Optional[str] = None
    transcript_edited: Optional[str] = None
    word_confidences: Optional[List[Dict[str, Any]]] = None
    created_at: datetime
    versions: List[AnswerVersionResponse] = []

    model_config = ConfigDict(from_attributes=True)
