import os
from pathlib import Path
from app.core.rubrics import get_rubric_prompt_text

PROMPTS_DIR = Path(__file__).resolve().parent

def load_template(filename: str) -> str:
    filepath = PROMPTS_DIR / filename
    with open(filepath, "r", encoding="utf-8") as f:
        return f.read()

def get_evaluate_prompt(
    question_text: str,
    question_type: str,
    topic: str,
    target_level: str,
    transcript: str,
    duration_seconds: float = None
) -> str:
    template = load_template("evaluate.txt")
    rubrics = get_rubric_prompt_text()
    clean_transcript = transcript.strip()
    word_count = len(clean_transcript.split())
    duration_str = str(round(duration_seconds, 1)) if duration_seconds and duration_seconds > 0 else "unknown"
    return template.format(
        RUBRICS=rubrics,
        QUESTION_TEXT=question_text,
        QUESTION_TYPE=question_type,
        TOPIC=topic,
        TARGET_LEVEL=target_level,
        DURATION_SEC=duration_str,
        WORD_COUNT=word_count,
        TRANSCRIPT=clean_transcript
    )

def get_daily_feedback_prompt(
    question_text: str,
    question_type: str,
    task_requirement: str,
    focus_tense: str,
    duration_sec: float,
    transcript: str,
    metrics: dict = None
) -> str:
    template = load_template("daily_feedback.txt")
    metrics = metrics or {}
    return template.format(
        RUBRICS=get_rubric_prompt_text(),
        QUESTION_TEXT=question_text,
        QUESTION_TYPE=question_type,
        TASK_REQUIREMENT=task_requirement,
        FOCUS_TENSE=focus_tense,
        DURATION_SEC=round(duration_sec or 0),
        WORD_COUNT=metrics.get("total_words", len(transcript.split())),
        WPM=metrics.get("wpm") if metrics.get("wpm") is not None else "unknown",
        PAUSES=metrics.get("pause_count", "unknown") if metrics.get("has_timing", True) else "unknown",
        FILLERS=(metrics.get("fillers") or {}).get("total", 0),
        TRANSCRIPT=transcript.strip()
    )

def get_rewrite_prompt(
    question_text: str,
    current_level: str,
    target_level: str,
    transcript: str,
    custom_instruction: str = "",
    previous_text: str = ""
) -> str:
    template = load_template("rewrite.txt")
    rubrics = get_rubric_prompt_text()
    custom_block = (
        f"\nLearner's Custom Story/Wording Request (Vietnamese or English — follow faithfully):\n\"\"\"\n{custom_instruction.strip()}\n\"\"\""
        if (custom_instruction or "").strip() else ""
    )
    prev_block = (
        f"\nPREVIOUS REWRITE (avoid repeating the exact same storyline if no custom request is given):\n\"\"\"\n{previous_text.strip()}\n\"\"\""
        if (previous_text or "").strip() else ""
    )
    return template.format(
        RUBRICS=rubrics,
        QUESTION_TEXT=question_text,
        CURRENT_LEVEL=current_level,
        TARGET_LEVEL=target_level,
        TRANSCRIPT=transcript.strip(),
        CUSTOM_INSTRUCTION_BLOCK=custom_block,
        PREVIOUS_TEXT_BLOCK=prev_block,
    )

def get_model_answers_prompt(
    question_text: str,
    topic: str,
    question_type: str
) -> str:
    template = load_template("model_answers.txt")
    rubrics = get_rubric_prompt_text()
    return template.format(
        RUBRICS=rubrics,
        QUESTION_TEXT=question_text,
        TOPIC=topic,
        QUESTION_TYPE=question_type
    )

def get_single_model_answer_prompt(
    question_text: str,
    topic: str,
    question_type: str,
    target_level: str = "IM",
    personal_profile: str = "",
    custom_instruction: str = "",
    previous_text: str = ""
) -> str:
    template = load_template("single_model_answer.txt")
    rubrics = get_rubric_prompt_text()
    profile_block = (
        f"Learner Background Profile (keep details consistent with this):\n{personal_profile.strip()}"
        if (personal_profile or "").strip() else ""
    )
    custom_block = (
        f"Learner's Custom Story/Wording Request (Vietnamese or English — follow faithfully):\n\"\"\"\n{custom_instruction.strip()}\n\"\"\""
        if (custom_instruction or "").strip() else ""
    )
    prev_block = (
        f"PREVIOUS ANSWER (write a noticeably different story/example from this):\n\"\"\"\n{previous_text.strip()}\n\"\"\""
        if (previous_text or "").strip() else ""
    )
    return template.format(
        RUBRICS=rubrics,
        QUESTION_TEXT=question_text,
        TOPIC=topic,
        QUESTION_TYPE=question_type,
        TARGET_LEVEL=(target_level or "IM").upper(),
        PERSONAL_PROFILE_BLOCK=profile_block,
        CUSTOM_INSTRUCTION_BLOCK=custom_block,
        PREVIOUS_TEXT_BLOCK=prev_block,
    )

def get_session_report_prompt(
    target_level: str,
    num_answers: int,
    answers_summary: str,
    avg_fluency: float,
    avg_tenses: float,
    avg_organization: float,
    avg_vocabulary: float,
    avg_grammar: float,
    avg_task_completion: float
) -> str:
    template = load_template("session_report.txt")
    rubrics = get_rubric_prompt_text()
    return template.format(
        RUBRICS=rubrics,
        TARGET_LEVEL=target_level,
        NUM_ANSWERS=num_answers,
        ANSWERS_SUMMARY=answers_summary,
        AVG_FLUENCY=f"{avg_fluency:.1f}",
        AVG_TENSES=f"{avg_tenses:.1f}",
        AVG_ORGANIZATION=f"{avg_organization:.1f}",
        AVG_VOCABULARY=f"{avg_vocabulary:.1f}",
        AVG_GRAMMAR=f"{avg_grammar:.1f}",
        AVG_TASK_COMPLETION=f"{avg_task_completion:.1f}"
    )

LEVEL_GUIDANCE = {
    1: "Level 1-2 learner: keep prompts short and concrete; role-play problem should be simple and everyday.",
    2: "Level 1-2 learner: keep prompts short and concrete; role-play problem should be simple and everyday.",
    3: "Level 3-4 learner: connected prompts with clear past-tense storytelling; role-play problem of moderate complexity.",
    4: "Level 3-4 learner: connected prompts with clear past-tense storytelling; role-play problem of moderate complexity.",
    5: "Level 5-6 learner: multi-part prompts demanding past/present/future control, complications and comparisons; role-play problem requires negotiating 2-3 alternatives.",
    6: "Level 5-6 learner: multi-part prompts demanding past/present/future control, complications and comparisons; role-play problem requires negotiating 2-3 alternatives.",
}

def get_generate_questions_prompt(
    survey_json: str,
    level: int,
    base_difficulty: str,
    topics: list,
    unexpected_topic: str,
    role_play_label: str,
    role_play_setup: str
) -> str:
    template = load_template("generate_questions.txt")
    labels = [t.replace("_", " ").title() for t in topics]
    return template.format(
        SURVEY_JSON=survey_json,
        LEVEL=level,
        BASE_DIFFICULTY=base_difficulty,
        LEVEL_GUIDANCE=LEVEL_GUIDANCE.get(level, LEVEL_GUIDANCE[4]),
        UNEXPECTED_TOPIC=unexpected_topic,
        ROLE_PLAY_LABEL=role_play_label,
        ROLE_PLAY_SETUP=role_play_setup,
        TOPIC_1=labels[0],
        TOPIC_2=labels[1] if len(labels) > 1 else labels[0]
    )

def get_generate_guides_prompt(questions_json: str, level: int, base_difficulty: str) -> str:
    template = load_template("generate_guides.txt")
    return template.format(
        QUESTIONS_JSON=questions_json,
        LEVEL=level,
        BASE_DIFFICULTY=base_difficulty
    )


def get_translate_prompt(text: str, context_sentence: str = "", mode: str = "word") -> str:
    template = load_template("translate.txt")
    return template.format(
        MODE=mode,
        TEXT=text.strip(),
        CONTEXT_SENTENCE=(context_sentence or "").strip() or "(none)"
    )
