from typing import List, Optional, Dict, Any
from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict

class FeedbackItemResponse(BaseModel):
    id: Optional[int] = None
    mistake: str
    correction: str
    explanation_en: Optional[str] = None
    explanation_vi: Optional[str] = None
    category: str = "grammar"

    model_config = ConfigDict(from_attributes=True)

class TenseControlDetails(BaseModel):
    past_used: bool = False
    present_used: bool = True
    future_used: bool = False
    explanation: str

class EvaluationResponse(BaseModel):
    id: int
    answer_version_id: int
    estimated_level: str # below_IL, IL, IM, IH
    score_fluency: int = Field(ge=1, le=5)
    score_tenses: int = Field(ge=1, le=5)
    score_organization: int = Field(ge=1, le=5)
    score_vocabulary: int = Field(ge=1, le=5)
    score_grammar: int = Field(ge=1, le=5)
    score_task_completion: int = Field(ge=1, le=5)
    tense_control_details: Dict[str, Any]
    complication_present: bool = False
    story_narrative_present: bool = False
    feedback_summary: str
    actionable_steps: List[str]
    feedback_items: List[FeedbackItemResponse] = []
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class RewriteRequest(BaseModel):
    answer_version_id: int
    target_level: Optional[str] = None

class DiffChunk(BaseModel):
    type: str # "equal", "delete", "insert"
    text: str

class RewriteResponse(BaseModel):
    original_text: str
    improved_text: str
    current_level: str
    target_level: str
    changes_explanation: str
    vietnamese_coaching_notes: str
    diff_chunks: List[DiffChunk] = []
    key_expressions_added: List[str] = []
