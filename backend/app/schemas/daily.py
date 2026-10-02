from typing import List, Literal
from pydantic import BaseModel, Field

Verdict = Literal["good", "partial", "missing"]


class TenseEvidence(BaseModel):
    quote: str = Field(min_length=1, max_length=300)  # verb phrase / clause quoted from the transcript
    ok: bool
    fix: str = ""


class DailyTenseCheck(BaseModel):
    verdict: Verdict
    focus_sentences: int = Field(ge=0)  # sentences built in the focus time frame
    total_sentences: int = Field(ge=0)
    evidence: List[TenseEvidence] = Field(default_factory=list, max_length=8)
    note_vi: str = ""
    example_fix: str = ""


class DailyTask(BaseModel):
    met: bool
    note_vi: str = ""


class DailyCoherence(BaseModel):
    verdict: Verdict
    note_vi: str = ""


class DailyTip(BaseModel):
    tip_vi: str = Field(min_length=1)
    example: str = ""


class DailyFeedbackLLM(BaseModel):
    """Structured output of the daily quick-feedback prompt (validated; invalid output is retried)."""
    estimated_level: Literal["below_IL", "IL", "IM", "IH"]
    task: DailyTask
    tense_control: DailyTenseCheck
    coherence: DailyCoherence
    golden_tip: DailyTip
