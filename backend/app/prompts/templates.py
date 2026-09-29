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
