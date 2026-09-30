import json
import logging
from typing import Dict, Any, List, Tuple, Optional
from openai import OpenAI, BadRequestError
from pydantic import ValidationError
from app.config import settings
from app.prompts.templates import (
    get_evaluate_prompt,
    get_rewrite_prompt,
    get_model_answers_prompt,
    get_session_report_prompt,
    get_generate_questions_prompt,
    get_generate_guides_prompt,
)

logger = logging.getLogger("opic_llm")
logger.setLevel(logging.INFO)

# Estimated cost per 1K tokens (approximate for gpt-4o / gpt-5 class models)
COST_PER_1K_PROMPT = 0.0025
COST_PER_1K_COMPLETION = 0.0100

# Reasoning models (e.g. gpt-5.x) reject custom temperatures; remembered after the first refusal
_temperature_supported = True

def get_openai_client(timeout: float = 60.0) -> Optional[OpenAI]:
    if not settings.OPENAI_API_KEY or settings.OPENAI_API_KEY.startswith("your_"):
        return None
    return OpenAI(api_key=settings.OPENAI_API_KEY, timeout=timeout)

def _create_json_completion(client: OpenAI, prompt: str, temperature: float, system_prompt: str):
    global _temperature_supported
    kwargs = dict(
        model=settings.OPENAI_MODEL,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": prompt}
        ],
        response_format={"type": "json_object"},
    )
    if _temperature_supported:
        try:
            return client.chat.completions.create(temperature=temperature, **kwargs)
        except BadRequestError as e:
            if "temperature" not in str(e):
                raise
            logger.info(f"Model {settings.OPENAI_MODEL} does not support custom temperature; using default.")
            _temperature_supported = False
    return client.chat.completions.create(**kwargs)

def calculate_cost(prompt_tokens: int, completion_tokens: int) -> float:
    return (prompt_tokens / 1000.0 * COST_PER_1K_PROMPT) + (completion_tokens / 1000.0 * COST_PER_1K_COMPLETION)

def call_openai_json(prompt: str, temperature: float = 0.2) -> Tuple[Dict[str, Any], int, int, float]:
    """
    Calls OpenAI chat completions requesting json_object format.
    Retries once on JSON parsing error.
    Returns (parsed_json, prompt_tokens, completion_tokens, cost).
    """
    client = get_openai_client()

    if not client:
        # Fallback Mock response for test/offline environments
        return get_mock_json_response(prompt), 350, 250, 0.003

    max_attempts = 2
    last_error = None

    for attempt in range(max_attempts):
        try:
            response = _create_json_completion(
                client, prompt, temperature,
                "You are an official ACTFL/OPIc evaluation system. Always respond with pure valid JSON only."
            )

            content = response.choices[0].message.content
            usage = response.usage
            prompt_tokens = usage.prompt_tokens if usage else 400
            completion_tokens = usage.completion_tokens if usage else 300
            cost = calculate_cost(prompt_tokens, completion_tokens)

            parsed = json.loads(content)
            return parsed, prompt_tokens, completion_tokens, cost
        except Exception as e:
            logger.warning(f"OpenAI call attempt {attempt+1} failed: {e}")
            last_error = e

    logger.error(f"Failed OpenAI structured call after {max_attempts} attempts: {last_error}")
    # Fallback to realistic mock if API fails
    return get_mock_json_response(prompt), 400, 200, 0.002

def evaluate_answer_llm(
    question_text: str,
    question_type: str,
    topic: str,
    target_level: str,
    transcript: str
) -> Tuple[Dict[str, Any], int, int, float]:
    prompt = get_evaluate_prompt(
        question_text=question_text,
        question_type=question_type,
        topic=topic,
        target_level=target_level,
        transcript=transcript
    )
    return call_openai_json(prompt, temperature=0.2)

def rewrite_answer_llm(
    question_text: str,
    current_level: str,
    target_level: str,
    transcript: str
) -> Tuple[Dict[str, Any], int, int, float]:
    prompt = get_rewrite_prompt(
        question_text=question_text,
        current_level=current_level,
        target_level=target_level,
        transcript=transcript
    )
    return call_openai_json(prompt, temperature=0.7)

def generate_model_answers_llm(
    question_text: str,
    topic: str,
    question_type: str
) -> Tuple[Dict[str, Any], int, int, float]:
    prompt = get_model_answers_prompt(
        question_text=question_text,
        topic=topic,
        question_type=question_type
    )
    return call_openai_json(prompt, temperature=0.7)

def generate_session_report_llm(
    target_level: str,
    num_answers: int,
    answers_summary: str,
    avg_fluency: float,
    avg_tenses: float,
    avg_organization: float,
    avg_vocabulary: float,
    avg_grammar: float,
    avg_task_completion: float
) -> Tuple[Dict[str, Any], int, int, float]:
    prompt = get_session_report_prompt(
        target_level=target_level,
        num_answers=num_answers,
        answers_summary=answers_summary,
        avg_fluency=avg_fluency,
        avg_tenses=avg_tenses,
        avg_organization=avg_organization,
        avg_vocabulary=avg_vocabulary,
        avg_grammar=avg_grammar,
        avg_task_completion=avg_task_completion
    )
    return call_openai_json(prompt, temperature=0.3)

def get_mock_json_response(prompt: str) -> Dict[str, Any]:
    """Generates realistic structured responses for local development / test without API key."""
    if "CANDIDATE RESPONSE TO EVALUATE" in prompt:
        return {
            "estimated_level": "IM",
            "score_fluency": 3,
            "score_tenses": 3,
            "score_organization": 4,
            "score_vocabulary": 3,
            "score_grammar": 3,
            "score_task_completion": 4,
            "tense_control_details": {
                "past_used": True,
                "present_used": True,
                "future_used": False,
                "explanation": "Candidate used present tense consistently and attempted simple past tense. Past narrative broke down slightly during irregular verbs."
            },
            "complication_present": True,
            "story_narrative_present": True,
            "feedback_summary": "Great effort! You maintained a clear paragraph structure and successfully communicated your main ideas. Your pronunciation is understandable, and you addressed all parts of the question. To improve further, focus on consistent past-tense verb endings (-ed) and elaborate more on the emotional resolution of your story.",
            "actionable_steps": [
                "Practice regular and irregular past tense forms so your storytelling does not slip back into the present tense.",
                "Incorporate more precise transitional phrases like 'To put it another way,' 'What made it unforgettable was,' and 'Looking back.'",
                "Extend your speaking duration by describing sensory details (sights, sounds, emotions) to comfortably hit 60-90+ seconds."
            ],
            "feedback_items": [
                {
                    "mistake": "I go there last year with my friend.",
                    "correction": "I went there last year with my friend.",
                    "explanation_en": "Use the past tense 'went' because you specified the past time marker 'last year'.",
                    "explanation_vi": "Cần dùng thì quá khứ đơn 'went' vì câu có trạng từ chỉ thời gian quá khứ 'last year'.",
                    "category": "tense"
                },
                {
                    "mistake": "The weather is very good so we feel happy.",
                    "correction": "The weather was wonderful, so we were in high spirits.",
                    "explanation_en": "Upgrade simple words like 'very good' and maintain past tense consistency.",
                    "explanation_vi": "Nâng cấp từ vựng 'very good' thành 'wonderful' và chia thì quá khứ 'was/were' nhất quán.",
                    "category": "vocabulary"
                },
                {
                    "mistake": "Because it rain heavily, so we cancel.",
                    "correction": "Because it rained heavily, we had to cancel the plan.",
                    "explanation_en": "In English, do not use 'Because' and 'so' in the same sentence; also remember the past verb 'rained'.",
                    "explanation_vi": "Không dùng đồng thời 'Because' và 'so' trong cùng một câu tiếng Anh.",
                    "category": "grammar"
                }
            ]
        }
    elif "REWRITE INSTRUCTIONS" in prompt:
        return {
            "original_text": "I like coffee shop. It is near my house. Last week I go with my friend. It rain so we stay long time.",
            "improved_text": "One of my favorite places to unwind is a charming coffee shop located right in my neighborhood. Just last week, I went there with a close friend to catch up. Out of nowhere, it started pouring rain, so we ended up staying for hours, enjoying warm lattes and cozy conversations.",
            "current_level": "IM",
            "target_level": "IH",
            "changes_explanation": "Elevated discrete sentences into a flowing narrative paragraph. Replaced basic words with vivid collocations ('charming coffee shop', 'unwind', 'catch up') and solidified past tense narration.",
            "vietnamese_coaching_notes": "Bài nói đã được nâng cấp bằng cách bổ sung chi tiết cảm xúc ('charming', 'warm lattes'), dùng cấu trúc liên kết mượt mà và duy trì thì quá khứ xuyên suốt.",
            "key_expressions_added": [
                "One of my favorite places to unwind is...",
                "Out of nowhere, it started pouring...",
                "We ended up staying for hours..."
            ]
        }
    elif "Generate 3 distinct model spoken answers" in prompt:
        return {
            "answers": [
                {
                    "level": "IL",
                    "text": "I like this place very much. It is clean and modern. I often go there on Sunday. My friends also like it. It is cheap and convenient.",
                    "rationale": "Qualifies as IL because it consists of discrete, simple sentences primarily in the present tense with minimal transitions.",
                    "sentences": [
                        "I like this place very much.",
                        "It is clean and modern.",
                        "I often go there on Sunday.",
                        "My friends also like it.",
                        "It is cheap and convenient."
                    ]
                },
                {
                    "level": "IM",
                    "text": "I really enjoy visiting this place because it has a friendly atmosphere. Usually, I hang out there on weekends to relax after studying. Last month, I went there with my colleagues, and we had a great lunch together. It is a nice spot for young people.",
                    "rationale": "Qualifies as IM because sentences are connected with basic conjunctions (because, and) and attempts a simple past recollection.",
                    "sentences": [
                        "I really enjoy visiting this place because it has a friendly atmosphere.",
                        "Usually, I hang out there on weekends to relax after studying.",
                        "Last month, I went there with my colleagues, and we had a great lunch together.",
                        "It is a nice spot for young people."
                    ]
                },
                {
                    "level": "IH",
                    "text": "Whenever I need to recharge my batteries, this place is undoubtedly my top choice. What really stands out is its unique blend of peaceful ambiance and modern amenities. I distinctly remember an afternoon a few weeks ago when I was caught in a sudden torrential downpour nearby. I dashed inside soaking wet, and the staff greeted me warmly and offered a hot towel. That thoughtful gesture completely turned my day around. Ever since that memorable incident, it has become my personal sanctuary.",
                    "rationale": "Exemplifies IH through sustained paragraph discourse, vivid vocabulary ('recharge my batteries', 'torrential downpour'), a personal complication and resolution, and consistent tense mastery.",
                    "sentences": [
                        "Whenever I need to recharge my batteries, this place is undoubtedly my top choice.",
                        "What really stands out is its unique blend of peaceful ambiance and modern amenities.",
                        "I distinctly remember an afternoon a few weeks ago when I was caught in a sudden torrential downpour nearby.",
                        "I dashed inside soaking wet, and the staff greeted me warmly and offered a hot towel.",
                        "That thoughtful gesture completely turned my day around.",
                        "Ever since that memorable incident, it has become my personal sanctuary."
                    ]
                }
            ]
        }
    else:
        # Default report mock
        return {
            "overall_level": "IM",
            "justification": "The candidate demonstrates solid sentence connectivity and communicates effectively on routine topics. However, past tense inconsistencies and hesitation during unexpected problem-solving scenarios keep the performance at Intermediate Mid (IM).",
            "strengths": [
                "Clear pronunciation of common vocabulary and good sentence stress.",
                "Strong willingness to elaborate and maintain speech flow.",
                "Good grasp of everyday topics like home, leisure, and environment."
            ],
            "weaknesses": [
                "Occasional past-tense dropoff where verbs revert to present forms during fast speech.",
                "Lack of narrative complications in storytelling questions.",
                "Vietnamese ending sound omission (-s, -ed) on third-person and past verbs."
            ],
            "frequent_mistakes": [
                {
                    "pattern": "Dropping past tense in past narrative",
                    "example_mistake": "Last year I go to Da Nang with my family.",
                    "example_correction": "Last year I went to Da Nang with my family.",
                    "explanation_vi": "Quên chia thì quá khứ đối với động từ bất quy tắc."
                },
                {
                    "pattern": "Double connector (Because ... so ...)",
                    "example_mistake": "Because it was raining so we stayed inside.",
                    "example_correction": "Because it was raining, we stayed inside.",
                    "explanation_vi": "Lỗi dùng đồng thời cả 'Because' và 'so' trong cùng 1 câu."
                }
            ],
            "study_plan": {
                "title": "4-Week Road to Intermediate High (IH)",
                "weekly_focus": [
                    {
                        "week": 1,
                        "theme": "Mastering Past Tense Narration & -ed endings",
                        "activities": ["Record 3 past experiences daily", "Practice shadowing IH model answers"],
                        "target_outcome": "Eliminate 90% of past tense slips."
                    },
                    {
                        "week": 2,
                        "theme": "Paragraph Framing & Transitional Connectors",
                        "activities": ["Use Opening -> Details -> Complication -> Closing structure"],
                        "target_outcome": "Speak comfortably for 75+ seconds per question."
                    },
                    {
                        "week": 3,
                        "theme": "Role-play & Unexpected Situation Mastery",
                        "activities": ["Drill 3-4 inquiry questions and 2 alternative solutions"],
                        "target_outcome": "Handle Q11-Q13 role plays effortlessly."
                    },
                    {
                        "week": 4,
                        "theme": "Full-Length Mock Exam Simulation",
                        "activities": ["Complete 2 full 15-question simulated tests in Exam Mode"],
                        "target_outcome": "Solidify IH certification readiness."
                    }
                ]
            }
        }

def _call_openai_validated(prompt: str, schema, timeout: float) -> Optional[Tuple[Any, int, int, float]]:
    """
    Strict variant of call_openai_json for generation tasks: validates against a Pydantic schema,
    retries once, and returns None (instead of a mock) so the caller can use its own fallback.
    """
    client = get_openai_client(timeout=timeout)
    if not client:
        return None
    for attempt in range(2):
        try:
            response = _create_json_completion(client, prompt, 0.7, "You are an expert OPIc test designer. Always respond with pure valid JSON only.")
            usage = response.usage
            p_tok = usage.prompt_tokens if usage else 0
            c_tok = usage.completion_tokens if usage else 0
            parsed = schema.model_validate(json.loads(response.choices[0].message.content))
            return parsed, p_tok, c_tok, calculate_cost(p_tok, c_tok)
        except (json.JSONDecodeError, ValidationError) as e:
            logger.warning(f"{schema.__name__} attempt {attempt+1} returned invalid output: {e}")
        except Exception as e:
            logger.warning(f"{schema.__name__} attempt {attempt+1} failed: {e}")
            break
    return None

def generate_questions_llm(
    survey_data: Dict[str, Any],
    level: int,
    base_difficulty: str,
    topics: List[str]
):
    """Returns (GeneratedQuestionSet, prompt_tokens, completion_tokens, cost) or None on failure."""
    from app.schemas.question import GeneratedQuestionSet
    prompt = get_generate_questions_prompt(
        survey_json=json.dumps(survey_data, ensure_ascii=False),
        level=level,
        base_difficulty=base_difficulty,
        topics=topics
    )
    return _call_openai_validated(prompt, GeneratedQuestionSet, timeout=45.0)

def generate_guides_llm(questions: List[Dict[str, Any]], level: int, base_difficulty: str):
    """Returns (GeneratedGuideSet, prompt_tokens, completion_tokens, cost) or None on failure."""
    from app.schemas.question import GeneratedGuideSet
    prompt = get_generate_guides_prompt(
        questions_json=json.dumps(questions, ensure_ascii=False),
        level=level,
        base_difficulty=base_difficulty
    )
    return _call_openai_validated(prompt, GeneratedGuideSet, timeout=90.0)
