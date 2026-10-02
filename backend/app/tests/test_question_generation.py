import itertools
import pytest
from pydantic import ValidationError
from app.core.seed_data import TOPIC_QUESTIONS_BANK, SELF_INTRO_QUESTION
from app.schemas.question import GeneratedQuestionSet, ROLE_PLAY_SLOTS
from app.services import question_generator
from app.services.question_generator import build_session_questions, generate_15_opic_questions


def _valid_payload():
    questions = []
    for idx in range(2, 16):  # Q1 is fixed, the LLM only writes Q2-Q15
        questions.append({
            "order_index": idx,
            "question_text": f"Sample spoken question number {idx} for the learner.",
            "question_type": ROLE_PLAY_SLOTS.get(idx, "description"),
            "topic": "Sample",
            "difficulty": "IM",
        })
    return {"questions": questions}


def test_generated_set_accepts_valid_structure():
    payload = _valid_payload()
    payload["questions"].reverse()  # order in the LLM output should not matter
    parsed = GeneratedQuestionSet.model_validate(payload)
    assert [q.order_index for q in parsed.questions] == list(range(2, 16))


def test_generated_set_requires_three_role_play_questions():
    payload = _valid_payload()
    payload["questions"][11]["question_type"] = "past_experience"  # Q13 must be role_play_experience
    with pytest.raises(ValidationError):
        GeneratedQuestionSet.model_validate(payload)


def test_generated_set_rejects_llm_self_intro():
    payload = _valid_payload()
    payload["questions"].insert(0, {**payload["questions"][0], "order_index": 1, "question_type": "self_intro"})
    with pytest.raises(ValidationError):
        GeneratedQuestionSet.model_validate(payload)


def test_generated_set_requires_all_14_questions():
    payload = _valid_payload()
    payload["questions"].pop()
    with pytest.raises(ValidationError):
        GeneratedQuestionSet.model_validate(payload)


def test_curated_bank_always_has_15_questions_with_role_play_combo():
    for topics in itertools.permutations(TOPIC_QUESTIONS_BANK.keys(), 3):
        questions = generate_15_opic_questions({}, 4, list(topics))
        assert [q["order_index"] for q in questions] == list(range(1, 16))
        assert questions[0]["question_text"] == SELF_INTRO_QUESTION["question_text"]
        by_index = {q["order_index"]: q for q in questions}
        for idx, expected_type in ROLE_PLAY_SLOTS.items():
            assert by_index[idx]["question_type"] == expected_type


def test_build_falls_back_to_bank_when_llm_fails(monkeypatch):
    monkeypatch.setattr(question_generator.settings, "AI_QUESTION_GENERATION", True)
    monkeypatch.setattr(question_generator, "generate_questions_llm", lambda *args, **kwargs: None)
    questions, usage, source = build_session_questions({}, 4, ["environment", "human_rights", "socio_cultural"])
    assert source == "bank"
    assert usage is None
    assert len(questions) == 15


def test_build_uses_llm_questions_with_default_guides(monkeypatch):
    parsed = GeneratedQuestionSet.model_validate(_valid_payload())
    monkeypatch.setattr(question_generator.settings, "AI_QUESTION_GENERATION", True)
    monkeypatch.setattr(question_generator, "generate_questions_llm", lambda *args, **kwargs: (parsed, 100, 200, 0.01))
    questions, usage, source = build_session_questions({"living_situation": "apartment"}, 5, ["environment", "human_rights", "socio_cultural"])
    assert source == "ai"
    assert usage == (100, 200, 0.01)
    assert [q["order_index"] for q in questions] == list(range(1, 16))
    assert questions[0]["question_type"] == "self_intro"
    assert questions[0]["question_text"] == SELF_INTRO_QUESTION["question_text"]
    assert questions[12]["question_type"] == "role_play_experience"
    assert all(q["vietnamese_guide"] for q in questions)


def test_unexpected_topic_draw_skips_survey_choices_recent_tests_and_shares_no_domain():
    import random
    from app.core.unexpected_topics import pick_unexpected, UNEXPECTED_TOPICS
    survey = {"hobbies": ["Getting my hair done"], "leisure_activities": ["Shopping at malls"]}
    avoid = ["Weather & Seasons", "Hotel Reservation"]
    labels = set()
    for seed in range(300):
        topic, scenario = pick_unexpected(survey, avoid, random.Random(seed))
        labels.add(topic["label"])
        assert topic["label"] not in ("Hair & Hair Salons", "Shopping Malls & Stores", "Weather & Seasons")
        assert scenario["label"] not in ("Hair Salon Booking", "Hotel Reservation")
        assert topic["domain"] != scenario["domain"]
    assert len(labels) > len(UNEXPECTED_TOPICS) // 2  # really varied


def test_ai_set_follows_real_test_layout(monkeypatch):
    parsed = GeneratedQuestionSet.model_validate(_valid_payload())
    captured = {}

    def fake_llm(survey, level, diff, topics, unexpected, role_play):
        captured.update(unexpected=unexpected, role_play=role_play)
        return parsed, 1, 1, 0.0

    monkeypatch.setattr(question_generator.settings, "AI_QUESTION_GENERATION", True)
    monkeypatch.setattr(question_generator, "generate_questions_llm", fake_llm)
    questions, _, _ = build_session_questions({}, 4, ["environment", "human_rights", "socio_cultural"], avoid_topics=["Pets"])
    cats = {q["order_index"]: q["category"] for q in questions}
    assert cats[8] == cats[9] == cats[10] == "unexpected"
    assert cats[11] == "role_play" and cats[14] == "environment" and cats[15] == "human_rights"
    assert captured["unexpected"]["label"] != "Pets"


def test_generation_prompt_carries_assigned_topics():
    from app.prompts.templates import get_generate_questions_prompt
    prompt = get_generate_questions_prompt("{}", 4, "IM", ["environment", "human_rights", "socio_cultural"],
                                           "Dentists & Dental Care", "Hotel Reservation", "book a hotel room")
    assert 'Unexpected topic (Q8-Q10): Dentists & Dental Care' in prompt
    assert 'Hotel Reservation - the learner needs to book a hotel room' in prompt
    assert 'Issue topic 1 (Q14): Environment' in prompt and 'Issue topic 2 (Q15): Human Rights' in prompt
