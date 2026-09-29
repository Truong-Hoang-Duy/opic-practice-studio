from typing import List, Dict, Any
from app.core.seed_data import (
    TOPIC_QUESTIONS_BANK,
    ROLE_PLAY_QUESTIONS,
    SURVEY_QUESTIONS_MAP,
)
from app.services.tts_service import synthesize_speech

def generate_15_opic_questions(
    survey_data: Dict[str, Any],
    self_assessment_level: int,
    chosen_topics: List[str]
) -> List[Dict[str, Any]]:
    """
    Constructs the 15-question test set based on:
    - Q1: Self-introduction
    - Q2-Q4: Combo 1 (Survey Topic - Living situation or routine)
    - Q5-Q7: Combo 2 (Survey Topic - Leisure / Café / Park / Travel)
    - Q8-Q10: Combo 3 (Chosen Topic 1)
    - Q11-Q12: Role-Play combo (Ask 3-4 questions, then handle unexpected complication)
    - Q13: Unexpected situation / Complication (Chosen Topic 2)
    - Q14: Advanced Comparison past vs present / Generational (Chosen Topic 3)
    - Q15: Thought-provoking trend or reflection
    """
    difficulty_map = {1: "IL", 2: "IL", 3: "IM", 4: "IM", 5: "IH", 6: "IH"}
    base_diff = difficulty_map.get(self_assessment_level, "IM")

    questions: List[Dict[str, Any]] = []

    # Q1: Self Introduction
    q1 = {
        "order_index": 1,
        "question_text": "Let's start the interview now. Tell me something about yourself. What is your name, what do you do, and what are some things you enjoy doing in your free time?",
        "question_type": "self_intro",
        "topic": "Personal Background",
        "difficulty": base_diff,
        "vietnamese_guide": {
            "overview": "Câu 1 luôn là Giới thiệu bản thân (Self-introduction). Hãy nói trôi chảy, tự nhiên trong khoảng 60-90 giây.",
            "target_pattern": "Greeting -> Name/Job/Major -> Living/Hometown -> Hobbies/Leisure -> Friendly wrap-up",
            "steps": [
                {"step_number": 1, "title": "Warm Greeting & Name", "hint_vi": "Chào Eva, giới thiệu tên và công việc/ngành học.", "example_phrases": ["Hello Eva, it's a pleasure to take this test today. My name is Alex, and I am currently working as a software developer."]},
                {"step_number": 2, "title": "Living Environment", "hint_vi": "Sống ở đâu, với ai.", "example_phrases": ["I was born and raised in Hanoi, but currently I reside in a lively neighborhood."]},
                {"step_number": 3, "title": "Interests & Passions", "hint_vi": "Sở thích và thời gian rảnh rỗi.", "example_phrases": ["When I'm off the clock, I'm passionate about jogging around West Lake and brewing specialty coffee."]},
                {"step_number": 4, "title": "Conclusion", "hint_vi": "Kết lại và chào mừng buổi phỏng vấn.", "example_phrases": ["That's a brief snapshot of who I am. I'm excited for our conversation!"]}
            ],
            "recommended_vocabulary": ["pleasure to meet you", "currently residing", "off the clock", "passionate about", "snapshot"],
            "sample_sentence_starters": ["First of all, my name is...", "In my spare time, I often..."]
        }
    }
    questions.append(q1)

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
    t1_qs = TOPIC_QUESTIONS_BANK.get(topic_1, [])
    for idx, tq in enumerate(t1_qs[:3]):
        questions.append({
            "order_index": 8 + idx,
            "question_text": tq["text"],
            "question_type": tq["type"],
            "topic": topic_1.replace("_", " ").title(),
            "difficulty": "IM" if idx < 2 else "IH",
            "vietnamese_guide": tq.get("guide", {})
        })

    # Q11-Q12: Role-Play Combo
    rp1 = ROLE_PLAY_QUESTIONS[0]
    rp2 = ROLE_PLAY_QUESTIONS[1]
    questions.append({
        "order_index": 11,
        "question_text": rp1["text"],
        "question_type": rp1["type"],
        "topic": rp1["topic"],
        "difficulty": "IM",
        "vietnamese_guide": rp1["guide"]
    })
    questions.append({
        "order_index": 12,
        "question_text": rp2["text"],
        "question_type": rp2["type"],
        "topic": rp2["topic"],
        "difficulty": "IH",
        "vietnamese_guide": rp2["guide"]
    })

    # Q13: Chosen Topic 2 (Complication or Past Experience)
    topic_2 = chosen_topics[1] if len(chosen_topics) > 1 else "communication_media"
    t2_qs = TOPIC_QUESTIONS_BANK.get(topic_2, [])
    # Pick a past_experience or unexpected_situation
    t2_pick = next((q for q in t2_qs if q["type"] in ["past_experience", "unexpected_situation"]), t2_qs[0] if t2_qs else None)
    if t2_pick:
        questions.append({
            "order_index": 13,
            "question_text": t2_pick["text"],
            "question_type": t2_pick["type"],
            "topic": topic_2.replace("_", " ").title(),
            "difficulty": "IH",
            "vietnamese_guide": t2_pick.get("guide", {})
        })
    else:
        questions.append({
            "order_index": 13,
            "question_text": f"Tell me about a difficult challenge you faced regarding {topic_2.replace('_', ' ')} and how you handled it.",
            "question_type": "unexpected_situation",
            "topic": topic_2.replace("_", " ").title(),
            "difficulty": "IH",
            "vietnamese_guide": {"overview": "Kể thử thách và cách vượt qua.", "steps": []}
        })

    # Q14-Q15: Chosen Topic 3 (Comparison and Trend / Advanced Discourse)
    topic_3 = chosen_topics[2] if len(chosen_topics) > 2 else "global_workplace"
    t3_qs = TOPIC_QUESTIONS_BANK.get(topic_3, [])
    t3_comp = next((q for q in t3_qs if q["type"] == "comparison"), t3_qs[0] if t3_qs else None)
    if t3_comp:
        questions.append({
            "order_index": 14,
            "question_text": t3_comp["text"],
            "question_type": t3_comp["type"],
            "topic": topic_3.replace("_", " ").title(),
            "difficulty": "IH",
            "vietnamese_guide": t3_comp.get("guide", {})
        })
    else:
        questions.append({
            "order_index": 14,
            "question_text": f"How has {topic_3.replace('_', ' ')} changed over the last 10 years? Compare the past with current realities.",
            "question_type": "comparison",
            "topic": topic_3.replace("_", " ").title(),
            "difficulty": "IH",
            "vietnamese_guide": {"overview": "So sánh quá khứ và hiện tại.", "steps": []}
        })

    # Q15: Thought-provoking current trend / reflection
    questions.append({
        "order_index": 15,
        "question_text": f"Looking ahead, what major changes or innovations do you anticipate in {topic_3.replace('_', ' ')} or in how people collaborate globally? Share your personal insights and future outlook.",
        "question_type": "comparison",
        "topic": topic_3.replace("_", " ").title() + " (Future Outlook)",
        "difficulty": "IH",
        "vietnamese_guide": {
            "overview": "Câu 15 thường là câu nâng cao về xu hướng tương lai và nhận định cá nhân. Hãy dùng thì tương lai kết hợp hiện tại và đưa ra luận điểm rõ ràng để đạt IH tối đa.",
            "target_pattern": "Current status -> Future prediction 1 -> Future prediction 2 -> Personal closing stance",
            "steps": [
                {"step_number": 1, "title": "Present Foundation", "hint_vi": "Nêu thực trạng hiện nay.", "example_phrases": ["As technology advances at breakneck speed, our daily landscape will evolve dramatically."]},
                {"step_number": 2, "title": "Future Projections", "hint_vi": "Dự báo các thay đổi trong 5-10 năm tới (will, is likely to).", "example_phrases": ["In the coming decade, AI-driven automation will likely reshape how we collaborate across borders."]},
                {"step_number": 3, "title": "Balanced Stance", "hint_vi": "Cân bằng cơ hội và thách thức.", "example_phrases": ["While this brings immense efficiency, maintaining human connection will be more vital than ever."]}
            ],
            "recommended_vocabulary": ["breakneck speed", "evolve dramatically", "reshape", "immense efficiency", "vital"],
            "sample_sentence_starters": ["Looking toward the future...", "I strongly believe that in the next few years..."]
        }
    })

    return questions
