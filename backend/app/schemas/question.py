from typing import List, Optional, Dict, Any, Literal
from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field, model_validator

# Q1 (self-introduction) is fixed and never scored
UNSCORED_QUESTION_TYPES = {"self_intro"}

# Q11-Q13 must always be the 3-part OPIc role-play combo
ROLE_PLAY_SLOTS = {11: "role_play_ask", 12: "role_play_problem", 13: "role_play_experience"}

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


class GeneratedQuestion(BaseModel):
    """One question produced by the LLM question generator (Q2-Q15; Q1 is fixed)."""
    order_index: int = Field(ge=2, le=15)
    question_text: str = Field(min_length=10)
    question_type: str
    topic: str
    difficulty: Literal["IL", "IM", "IH"]

class GeneratedQuestionSet(BaseModel):
    questions: List[GeneratedQuestion]

    @model_validator(mode="after")
    def validate_opic_structure(self):
        indexes = sorted(q.order_index for q in self.questions)
        if indexes != list(range(2, 16)):
            raise ValueError(f"Expected questions 2..15 exactly once, got {indexes}.")
        by_index = {q.order_index: q for q in self.questions}
        for idx, expected_type in ROLE_PLAY_SLOTS.items():
            if by_index[idx].question_type != expected_type:
                raise ValueError(f"Q{idx} must be '{expected_type}', got '{by_index[idx].question_type}'.")
        self.questions.sort(key=lambda q: q.order_index)
        return self

class GeneratedGuide(VietnameseGuide):
    order_index: int = Field(ge=1, le=15)

class GeneratedGuideSet(BaseModel):
    guides: List[GeneratedGuide]
