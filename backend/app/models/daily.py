import datetime
from sqlalchemy import Column, Integer, String, Text, Float, Date, DateTime, ForeignKey, JSON, UniqueConstraint
from app.database import Base


class DailyWorkout(Base):
    """
    One 5-minute daily challenge per learner per day. Kept apart from test_sessions so micro-practice
    never mixes into full 15-question exam results.
    """
    __tablename__ = "daily_workouts"
    __table_args__ = (UniqueConstraint("user_id", "challenge_date", name="uq_daily_workout_user_date"),)

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    challenge_date = Column(Date, nullable=False, index=True)  # local challenge day (see DAILY_UTC_OFFSET_HOURS)

    # The assigned question (copied, so the day's challenge never changes if the bank does)
    question_key = Column(String(40), nullable=False)
    question_text = Column(Text, nullable=False)
    question_type = Column(String(50), nullable=False)
    bucket = Column(String(20), nullable=False)  # past | routine | role_play
    topic_label = Column(String(100), nullable=True)
    # Question Bank item this challenge revisits (null = curated fallback for learners without test sets yet)
    source_question_id = Column(Integer, nullable=True)

    status = Column(String(20), default="pending")  # pending | completed
    attempts = Column(Integer, default=0)
    audio_path = Column(String(255), nullable=True)
    duration_seconds = Column(Float, nullable=True)
    transcript = Column(Text, nullable=True)
    speech_metrics = Column(JSON, nullable=True)
    feedback = Column(JSON, nullable=True)  # quick IH feedback: tense / fluency & length / golden tip
    estimated_level = Column(String(20), nullable=True)

    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)
