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
    transcript: str
) -> str:
    template = load_template("evaluate.txt")
    rubrics = get_rubric_prompt_text()
    return template.format(
        RUBRICS=rubrics,
        QUESTION_TEXT=question_text,
        QUESTION_TYPE=question_type,
        TOPIC=topic,
        TARGET_LEVEL=target_level,
        TRANSCRIPT=transcript.strip()
    )

def get_rewrite_prompt(
    question_text: str,
    current_level: str,
    target_level: str,
    transcript: str
) -> str:
    template = load_template("rewrite.txt")
    rubrics = get_rubric_prompt_text()
    return template.format(
        RUBRICS=rubrics,
        QUESTION_TEXT=question_text,
        CURRENT_LEVEL=current_level,
        TARGET_LEVEL=target_level,
        TRANSCRIPT=transcript.strip()
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
    topics: list
) -> str:
    template = load_template("generate_questions.txt")
    labels = [t.replace("_", " ").title() for t in topics]
    return template.format(
        SURVEY_JSON=survey_json,
        LEVEL=level,
        BASE_DIFFICULTY=base_difficulty,
        LEVEL_GUIDANCE=LEVEL_GUIDANCE.get(level, LEVEL_GUIDANCE[4]),
        TOPIC_1=labels[0],
        TOPIC_2=labels[1],
        TOPIC_3=labels[2]
    )

def get_generate_guides_prompt(questions_json: str, level: int, base_difficulty: str) -> str:
    template = load_template("generate_guides.txt")
    return template.format(
        QUESTIONS_JSON=questions_json,
        LEVEL=level,
        BASE_DIFFICULTY=base_difficulty
    )
