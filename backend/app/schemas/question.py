from typing import List, Optional, Dict, Any
from datetime import datetime
from pydantic import BaseModel, ConfigDict

class VietnameseGuide(BaseModel):
    overview: str
    target_pattern: str # e.g. "Opening -> Description -> Past Story -> Closing"
    steps: List[Dict[str, Any]]
    recommended_vocabulary: List[str]
    sample_sentence_starters: List[str]

class QuestionResponse(BaseModel):
    id: int
    session_id: int
    order_index: int
    question_text: str
    question_type: str
    topic: str
    difficulty: str
    audio_path: Optional[str] = None
    vietnamese_guide: Optional[Dict[str, Any]] = None

    model_config = ConfigDict(from_attributes=True)

class ModelAnswerResponse(BaseModel):
    id: int
    question_id: int
    level: str # IL, IM, IH
    text: str
    rationale: str
    audio_path: Optional[str] = None
    sentences: Optional[List[str]] = None

    model_config = ConfigDict(from_attributes=True)
