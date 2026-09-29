from app.core.rubrics import LEVEL_DESCRIPTORS, SUB_SCORE_CRITERIA, get_rubric_prompt_text
from app.services.stt_service import parse_words_with_confidence
from app.routers.answers import compute_diff_chunks

def test_rubrics_completeness():
    assert "IL" in LEVEL_DESCRIPTORS
    assert "IM" in LEVEL_DESCRIPTORS
    assert "IH" in LEVEL_DESCRIPTORS
    assert "below_IL" in LEVEL_DESCRIPTORS

    # Check 6 core criteria
    assert len(SUB_SCORE_CRITERIA) == 6
    assert "fluency_and_length" in SUB_SCORE_CRITERIA
    assert "tense_control" in SUB_SCORE_CRITERIA
    assert "organization" in SUB_SCORE_CRITERIA
    assert "vocabulary" in SUB_SCORE_CRITERIA
    assert "grammar" in SUB_SCORE_CRITERIA
    assert "task_completion" in SUB_SCORE_CRITERIA

    rubric_text = get_rubric_prompt_text()
    assert "ACTFL / OPIC OFFICIAL PROFICIENCY SCALE" in rubric_text
    assert "IH" in rubric_text

def test_word_confidence_parser():
    transcript = "I live in a small apartment specifically located downtown."
    tokens = parse_words_with_confidence(transcript)

    assert len(tokens) == 9
    words = [t["word"] for t in tokens]
    assert "apartment" in words
    assert "specifically" in words

    # specifically is flagged as potential stumble
    spec_token = next(t for t in tokens if "specifically" in t["word"])
    assert spec_token["confidence"] < 0.90

def test_diff_chunks_calculation():
    original = "I like coffee shop very much."
    improved = "I really adore this cozy coffee shop very much."

    chunks = compute_diff_chunks(original, improved)
    assert len(chunks) > 0

    types = [c.type for c in chunks]
    assert "delete" in types or "insert" in types
    assert "equal" in types
