from typing import List, Optional, Dict, Any
from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict, field_validator

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
    # Speech Intelligence
    tense_timeline: List[Dict[str, Any]] = []
    tense_distribution: Optional[Dict[str, int]] = None
    vietlish_warnings: List[Dict[str, Any]] = []
    vocab_upgrades: List[Dict[str, Any]] = []
    speech_metrics: Optional[Dict[str, Any]] = None  # from the audio of the evaluated take (not stored on the evaluation)
    narrative_expected: bool = False  # story-type question: past tense should carry the answer
    created_at: datetime

    @field_validator("tense_timeline", "vietlish_warnings", "vocab_upgrades", mode="before")
    @classmethod
    def _none_as_empty(cls, v):
        # Evaluations saved before Speech Intelligence have NULL here
        return v or []

    @field_validator("narrative_expected", mode="before")
    @classmethod
    def _none_as_false(cls, v):
        return bool(v)

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
