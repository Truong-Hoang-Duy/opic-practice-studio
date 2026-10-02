import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from app.database import Base


class UserVocabulary(Base):
    """A phrase the learner saved to their personal OPIc vocabulary notebook."""
    __tablename__ = "user_vocabularies"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)

    original_phrase = Column(Text, nullable=True)  # the basic / overused wording the learner said
    upgraded_phrase = Column(String(255), nullable=False)  # IH/AL alternative
    kind = Column(String(30), default="collocation")  # collocation | phrasal_verb | idiom | topic_word
    topic = Column(String(50), default="general", index=True)  # key of app.core.vocab_meta.VOCAB_TOPICS
    example_sentence = Column(Text, nullable=True)
    note_vi = Column(Text, nullable=True)
    status = Column(String(20), default="learning")  # learning | mastered
    # Where it came from (plain id: deleting a test set must not be blocked by saved words)
    source_question_id = Column(Integer, nullable=True)

    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
    mastered_at = Column(DateTime, nullable=True)
