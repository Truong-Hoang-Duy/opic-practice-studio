import datetime
from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from app.database import Base

class Evaluation(Base):
    __tablename__ = "evaluations"

    id = Column(Integer, primary_key=True, index=True)
    answer_version_id = Column(Integer, ForeignKey("answer_versions.id"), nullable=False, index=True)

    # Level Result
    estimated_level = Column(String(50), nullable=False) # below_IL, IL, IM, IH

    # 6 Sub-scores (1 to 5)
    score_fluency = Column(Integer, nullable=False, default=3)
    score_tenses = Column(Integer, nullable=False, default=3)
    score_organization = Column(Integer, nullable=False, default=3)
    score_vocabulary = Column(Integer, nullable=False, default=3)
    score_grammar = Column(Integer, nullable=False, default=3)
    score_task_completion = Column(Integer, nullable=False, default=3)

    # Detailed Analysis
    tense_control_details = Column(JSON, nullable=True) # {past_used: bool, present_used: bool, future_used: bool, notes: str}
    complication_present = Column(Boolean, default=False)
    story_narrative_present = Column(Boolean, default=False)

    # Speech Intelligence: sentence-by-sentence tense map + Vietnamese-interference ("Vietlish") warnings
    tense_timeline = Column(JSON, nullable=True)  # [{sentence, tense, status, note_vi}]
    tense_distribution = Column(JSON, nullable=True)  # {past_pct, present_pct, future_pct}
    vietlish_warnings = Column(JSON, nullable=True)  # [{original_phrase, issue_vi, suggested_phrase, explanation_vi}]
    # IH/AL vocabulary upgrades the learner can save to their notebook
    vocab_upgrades = Column(JSON, nullable=True)  # [{original_phrase, upgraded_phrase, kind, topic, example_sentence, note_vi}]

    # Feedback and IH Action Plan
    feedback_summary = Column(Text, nullable=False)
    actionable_steps = Column(JSON, nullable=True) # List of 3 concrete actions to reach IH

    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    # Relationships
    answer_version = relationship("AnswerVersion", back_populates="evaluations")
    feedback_items = relationship("FeedbackItem", back_populates="evaluation", cascade="all, delete-orphan")

class FeedbackItem(Base):
    __tablename__ = "feedback_items"

    id = Column(Integer, primary_key=True, index=True)
    evaluation_id = Column(Integer, ForeignKey("evaluations.id"), nullable=False, index=True)

    mistake = Column(Text, nullable=False)
    correction = Column(Text, nullable=False)
    explanation_en = Column(Text, nullable=True)
    explanation_vi = Column(Text, nullable=True)
    category = Column(String(50), default="grammar") # grammar, vocabulary, tense, discourse

    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    # Relationships
    evaluation = relationship("Evaluation", back_populates="feedback_items")
