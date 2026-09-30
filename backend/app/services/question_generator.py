import logging
from concurrent.futures import ThreadPoolExecutor
from typing import List, Dict, Any, Optional, Tuple
from app.config import settings
from app.core.seed_data import (
    TOPIC_QUESTIONS_BANK,
    ROLE_PLAY_QUESTIONS,
    SURVEY_QUESTIONS_MAP,
    DEFAULT_GUIDES_BY_TYPE,
    SELF_INTRO_QUESTION,
)
from app.services.llm_service import generate_questions_llm, generate_guides_llm

logger = logging.getLogger("opic_questions")

DIFFICULTY_MAP = {1: "IL", 2: "IL", 3: "IM", 4: "IM", 5: "IH", 6: "IH"}

def generate_15_opic_questions(
    survey_data: Dict[str, Any],
    self_assessment_level: int,
    chosen_topics: List[str]
) -> List[Dict[str, Any]]:
    """
    Constructs the 15-question test set based on:
    - Q1: Self-introduction (fixed, unscored)
    - Q2-Q4: Combo 1 (Survey Topic - Living situation or routine)
    - Q5-Q7: Combo 2 (Survey Topic - Leisure / Café / Park / Travel)
    - Q8-Q10: Combo 3 (Chosen Topic 1)
    - Q11-Q13: Role-Play combo (Ask 3-4 questions -> Resolve a problem with alternatives -> Related past experience)
    - Q14: Unexpected situation / Complication (Chosen Topic 2)
    - Q15: Comparison past vs present + future outlook (Chosen Topic 3)
    """
    base_diff = DIFFICULTY_MAP.get(self_assessment_level, "IM")

    questions: List[Dict[str, Any]] = []

    # Q1: Self Introduction (fixed for every test and never scored, as in the real OPIc)
    questions.append({**SELF_INTRO_QUESTION, "difficulty": base_diff})

    # Q2-Q4: Survey Combo 1 (Living Situation)
    living_qs = SURVEY_QUESTIONS_MAP.get("living_situation", [])
    if len(living_qs) >= 2:
        q2 = {
            "order_index": 2,
            "question_text": living_qs[0]["text"],
            "question_type": living_qs[0]["type"],
            "topic": "Living Situation",
            "difficulty": base_diff,
            "vietnamese_guide": living_qs[0]["guide"]
        }
        q3 = {
            "order_index": 3,
            "question_text": living_qs[1]["text"],
            "question_type": living_qs[1]["type"],
            "topic": "Home Routine",
            "difficulty": base_diff,
            "vietnamese_guide": living_qs[1]["guide"]
        }
    else:
        q2 = {
            "order_index": 2,
            "question_text": "Describe your neighborhood or where you currently live. What are the surroundings like?",
            "question_type": "description",
            "topic": "Living Situation",
            "difficulty": base_diff,
            "vietnamese_guide": {"overview": "Miêu tả khu phố nơi bạn đang sống.", "target_pattern": "Location -> Amenities -> Atmosphere -> Closing", "steps": []}
        }
        q3 = {
            "order_index": 3,
            "question_text": "What do you usually do at home in the evening or on weekends?",
            "question_type": "routine",
            "topic": "Home Routine",
            "difficulty": base_diff,
            "vietnamese_guide": {"overview": "Thói quen ở nhà vào cuối tuần.", "target_pattern": "Morning -> Afternoon -> Evening", "steps": []}
        }

    q4 = {
        "order_index": 4,
        "question_text": "Have you ever experienced any unexpected issues or problems at your home, such as broken equipment, a power outage, or water leakage? Describe the problem in detail and how you handled it.",
        "question_type": "past_experience",
        "topic": "Home Complication",
        "difficulty": "IH" if base_diff != "IL" else "IM",
        "vietnamese_guide": {
            "overview": "Kể lại một sự cố tại nhà (mất điện, vỡ ống nước, hỏng máy lạnh) và cách xử lý (rất quan trọng cho IH).",
            "target_pattern": "Background -> The Problem -> How you took action -> Resolution",
            "steps": [
                {"step_number": 1, "title": "Context", "hint_vi": "Thời gian và thời điểm xảy ra sự cố.", "example_phrases": ["A couple of months ago, during a scorching summer weekend, my air conditioner suddenly broke down."]},
                {"step_number": 2, "title": "The Complication", "hint_vi": "Khó khăn phát sinh (nóng nực, gọi thợ khó).", "example_phrases": ["The room felt like an oven, and most technicians were fully booked."]},
                {"step_number": 3, "title": "Resolution", "hint_vi": "Cách giải quyết chủ động.", "example_phrases": ["I called an emergency repair service and used a portable fan in the meantime. Thankfully, they fixed the compressor."]}
            ],
            "recommended_vocabulary": ["scorching heat", "air conditioner broke down", "emergency repair", "portable fan"],
            "sample_sentence_starters": ["An unexpected home incident happened when...", "To fix the issue, I..."]
        }
    }
    questions.extend([q2, q3, q4])

    # Q5-Q7: Survey Combo 2 (Leisure / Cafés)
    leisure_qs = SURVEY_QUESTIONS_MAP.get("leisure_activities", [])
    q5 = {
        "order_index": 5,
        "question_text": leisure_qs[0]["text"] if leisure_qs else "Describe your favorite café, park, or leisure spot.",
        "question_type": "description",
        "topic": "Leisure Spot",
        "difficulty": base_diff,
        "vietnamese_guide": leisure_qs[0]["guide"] if leisure_qs else {}
    }
    q6 = {
        "order_index": 6,
        "question_text": "How did you first become interested in this leisure activity or visiting this spot? Describe when you first started and how your passion has grown over time.",
        "question_type": "past_experience",
        "topic": "First Experience & Evolution",
        "difficulty": "IM",
        "vietnamese_guide": {
            "overview": "Kể về lần đầu tiên biết đến sở thích hoặc địa điểm này và sự thay đổi theo thời gian.",
            "target_pattern": "First memory (years ago) -> Who introduced it -> How often you do it now",
            "steps": [
                {"step_number": 1, "title": "First Encounter", "hint_vi": "Lần đầu tiên tiếp xúc với sở thích đó.", "example_phrases": ["I first discovered this pastime back when I was a college freshman."]},
                {"step_number": 2, "title": "Evolution", "hint_vi": "Từ bỡ ngỡ trở thành thói quen không thể thiếu.", "example_phrases": ["Over the years, it transformed from a casual hobby into my primary way to decompress."]}
            ],
            "recommended_vocabulary": ["first discovered", "college freshman", "decompress", "indispensable part of my life"],
            "sample_sentence_starters": ["My interest in this began when...", "Since then, I have..."]
        }
    }
    q7 = {
        "order_index": 7,
        "question_text": leisure_qs[1]["text"] if len(leisure_qs) > 1 else "Tell me about an unexpected incident at a café or park.",
        "question_type": "past_experience",
        "topic": "Memorable Incident",
        "difficulty": "IH" if base_diff != "IL" else "IM",
        "vietnamese_guide": leisure_qs[1]["guide"] if len(leisure_qs) > 1 else {}
    }
    questions.extend([q5, q6, q7])

    # Q8-Q10: Chosen Topic 1 (e.g. chosen_topics[0])
    topic_1 = chosen_topics[0] if chosen_topics else "environment"
    t1_qs = list(TOPIC_QUESTIONS_BANK.get(topic_1, [])[:3])
    # Pad with generic prompts so the combo always has 3 questions (some banks are shorter)
    topic_1_label = topic_1.replace("_", " ")
    generic_t1 = [
        {"type": "description", "text": f"Let's talk about {topic_1_label}. Can you describe what {topic_1_label} is like in your country today?"},
        {"type": "past_experience", "text": f"Tell me about a specific experience you had related to {topic_1_label}. What happened, and how did you feel about it?"},
        {"type": "comparison", "text": f"How has {topic_1_label} in your country changed compared to the past? What do you think it will be like in the future?"},
    ]
    for g in generic_t1:
        if len(t1_qs) >= 3:
            break
        if all(q["type"] != g["type"] for q in t1_qs):
            t1_qs.append({**g, "guide": DEFAULT_GUIDES_BY_TYPE[g["type"]]})
    for idx, tq in enumerate(t1_qs[:3]):
        questions.append({
            "order_index": 8 + idx,
            "question_text": tq["text"],
            "question_type": tq["type"],
            "topic": topic_1.replace("_", " ").title(),
            "difficulty": "IM" if idx < 2 else "IH",
            "vietnamese_guide": tq.get("guide", {})
        })

    # Q11-Q13: Role-Play Combo (Ask questions -> Resolve a problem -> Related past experience)
    for idx, rp in enumerate(ROLE_PLAY_QUESTIONS[:3]):
        questions.append({
            "order_index": 11 + idx,
            "question_text": rp["text"],
            "question_type": rp["type"],
            "topic": rp["topic"],
            "difficulty": "IM" if idx == 0 else "IH",
            "vietnamese_guide": rp["guide"]
        })

    # Q14: Chosen Topic 2 (Complication or Past Experience)
    topic_2 = chosen_topics[1] if len(chosen_topics) > 1 else "communication_media"
    t2_qs = TOPIC_QUESTIONS_BANK.get(topic_2, [])
    t2_pick = next((q for q in t2_qs if q["type"] in ["past_experience", "unexpected_situation"]), t2_qs[0] if t2_qs else None)
    if t2_pick:
        questions.append({
            "order_index": 14,
            "question_text": t2_pick["text"],
            "question_type": t2_pick["type"],
            "topic": topic_2.replace("_", " ").title(),
            "difficulty": "IH",
            "vietnamese_guide": t2_pick.get("guide", {})
        })
    else:
        questions.append({
            "order_index": 14,
            "question_text": f"Tell me about a difficult challenge you faced regarding {topic_2.replace('_', ' ')} and how you handled it.",
            "question_type": "unexpected_situation",
            "topic": topic_2.replace("_", " ").title(),
            "difficulty": "IH",
            "vietnamese_guide": DEFAULT_GUIDES_BY_TYPE["unexpected_situation"]
        })

    # Q15: Chosen Topic 3 (Comparison past vs present + future outlook)
    topic_3 = chosen_topics[2] if len(chosen_topics) > 2 else "global_workplace"
    t3_qs = TOPIC_QUESTIONS_BANK.get(topic_3, [])
    t3_comp = next((q for q in t3_qs if q["type"] == "comparison"), None)
    if t3_comp:
        questions.append({
            "order_index": 15,
            "question_text": t3_comp["text"],
            "question_type": t3_comp["type"],
            "topic": topic_3.replace("_", " ").title(),
            "difficulty": "IH",
            "vietnamese_guide": t3_comp.get("guide", {})
        })
    else:
        questions.append({
            "order_index": 15,
            "question_text": f"How has {topic_3.replace('_', ' ')} changed compared to ten years ago, and what changes do you expect in the future?",
            "question_type": "comparison",
            "topic": topic_3.replace("_", " ").title(),
            "difficulty": "IH",
            "vietnamese_guide": DEFAULT_GUIDES_BY_TYPE["comparison"]
        })

    return questions


def build_session_questions(
    survey_data: Dict[str, Any],
    self_assessment_level: int,
    chosen_topics: List[str]
) -> Tuple[List[Dict[str, Any]], Optional[Tuple[int, int, float]], str]:
    """
    Builds the 15-question set: Q1 is the fixed self-introduction, Q2-Q15 are personalised
    by the LLM from the survey, level and topics.
    Falls back to the curated bank when AI generation is disabled or fails.
    Returns (questions, usage=(prompt_tokens, completion_tokens, cost) or None, source="ai"|"bank").
    """
    if settings.AI_QUESTION_GENERATION:
        base_diff = DIFFICULTY_MAP.get(self_assessment_level, "IM")
        result = generate_questions_llm(survey_data, self_assessment_level, base_diff, chosen_topics)
        if result:
            question_set, p_tok, c_tok, cost = result
            questions = [{**SELF_INTRO_QUESTION, "difficulty": base_diff}] + [
                {
                    **q.model_dump(),
                    "vietnamese_guide": DEFAULT_GUIDES_BY_TYPE.get(q.question_type, DEFAULT_GUIDES_BY_TYPE["description"]),
                }
                for q in question_set.questions
            ]
            return questions, (p_tok, c_tok, cost), "ai"
        logger.warning("AI question generation failed; using curated question bank.")

    questions = generate_15_opic_questions(survey_data, self_assessment_level, chosen_topics)
    return questions, None, "bank"


def generate_personalised_guides(
    questions: List[Dict[str, Any]],
    self_assessment_level: int,
    batch_size: int = 5
) -> Tuple[Dict[int, Dict[str, Any]], int, int, float]:
    """
    Generates tailored Vietnamese guides for AI-generated questions, in parallel batches to keep latency low.
    Returns ({order_index: guide}, prompt_tokens, completion_tokens, cost); missing batches are simply skipped.
    """
    base_diff = DIFFICULTY_MAP.get(self_assessment_level, "IM")
    compact = [
        {k: q[k] for k in ("order_index", "question_text", "question_type", "topic")}
        for q in questions
    ]
    batches = [compact[i:i + batch_size] for i in range(0, len(compact), batch_size)]

    guides: Dict[int, Dict[str, Any]] = {}
    p_total = c_total = 0
    cost_total = 0.0
    with ThreadPoolExecutor(max_workers=len(batches) or 1) as pool:
        for result in pool.map(lambda b: generate_guides_llm(b, self_assessment_level, base_diff), batches):
            if not result:
                continue
            guide_set, p_tok, c_tok, cost = result
            p_total += p_tok
            c_total += c_tok
            cost_total += cost
            for g in guide_set.guides:
                guides[g.order_index] = g.model_dump(exclude={"order_index"})
    return guides, p_total, c_total, cost_total
