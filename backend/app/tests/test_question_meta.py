from app.core.question_meta import derive_category, question_timing, CATEGORY_LABELS
from app.services import question_generator
from app.services.question_generator import build_session_questions

TOPICS = ["global_workplace", "human_rights", "socio_cultural"]


def test_every_generated_question_gets_a_known_category():
    questions, _, _ = build_session_questions({}, 4, TOPICS, use_ai=False)
    cats = {q["order_index"]: q["category"] for q in questions}
    assert all(c in CATEGORY_LABELS for c in cats.values())
    assert cats[1] == "self_intro"
    assert {cats[2], cats[3], cats[4]} == {"home"}
    assert {cats[5], cats[6], cats[7]} == {"leisure"}
    assert {cats[8], cats[9], cats[10]} == {"global_workplace"}
    assert {cats[11], cats[12], cats[13]} == {"role_play"}
    assert cats[14] == "human_rights" and cats[15] == "socio_cultural"


def test_free_text_topic_labels_map_to_the_same_category():
    # AI labels vary ("Living Situation" vs "Home"), the category does not
    assert derive_category(2, "description", "Living Situation", TOPICS) == derive_category(2, "description", "Home", TOPICS) == "home"
    assert derive_category(9, "past_experience", "Socio Cultural", TOPICS) == "socio_cultural"


def test_timing_depends_on_question_type_and_level():
    assert question_timing("self_intro", "IM")["time_limit_sec"] == 60
    assert question_timing("description", "IH")["time_limit_sec"] == 90
    assert question_timing("past_experience", "IH")["time_limit_sec"] == 120
    # IL learners get shorter windows
    assert question_timing("past_experience", "IL")["time_limit_sec"] < 120
    assert question_timing("description", "IL")["time_limit_sec"] == 60


def test_use_ai_false_never_calls_the_llm(monkeypatch):
    monkeypatch.setattr(question_generator.settings, "AI_QUESTION_GENERATION", True)

    def boom(*args, **kwargs):
        raise AssertionError("LLM must not be called")

    monkeypatch.setattr(question_generator, "generate_questions_llm", boom)
    questions, usage, source = build_session_questions({}, 4, TOPICS, use_ai=False)
    assert source == "bank" and usage is None and len(questions) == 15
