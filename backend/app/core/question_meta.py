"""
Normalised question metadata shared by generation, the test screen and the Question Bank:
- category: a fixed learning-topic key (the AI's free-text `topic` label varies between sets)
- timing: recommended speaking window + hard limit per question type and difficulty
"""
from typing import Dict, List, Optional

OFFICIAL_TOPICS = ["environment", "human_rights", "global_workplace", "socio_cultural", "communication_media"]

CATEGORY_LABELS: Dict[str, str] = {
    "self_intro": "Giới thiệu bản thân",
    "home": "Nhà ở & sinh hoạt",
    "leisure": "Sở thích & hoạt động",
    "role_play": "Role-play (đóng vai)",
    "unexpected": "Chủ đề đột xuất",
    "environment": "Environment (Môi trường)",
    "human_rights": "Human Rights (Quyền con người)",
    "global_workplace": "Global Workplace (Làm việc toàn cầu)",
    "socio_cultural": "Socio-Cultural Issues (Văn hóa - Xã hội)",
    "communication_media": "Communication Media (Truyền thông)",
}
CATEGORY_ORDER = list(CATEGORY_LABELS.keys())


def _topic_key(label: Optional[str]) -> Optional[str]:
    if not label:
        return None
    key = label.strip().lower().replace("-", " ").replace(" ", "_")
    key = key.replace("socio_cultural_issues", "socio_cultural")
    return key if key in OFFICIAL_TOPICS else None


def derive_category(order_index: int, question_type: str, topic_label: Optional[str], session_topics: Optional[List[str]]) -> str:
    """Category from the fixed 15-question blueprint (also used to classify older sets without a stored category)."""
    topics = list(session_topics or [])
    if question_type == "self_intro":
        return "self_intro"
    if question_type.startswith("role_play"):
        return "role_play"
    by_label = _topic_key(topic_label)
    if by_label:
        return by_label
    if 2 <= order_index <= 4:
        return "home"
    if 5 <= order_index <= 7:
        return "leisure"
    if 8 <= order_index <= 10 and topics:
        return topics[0]
    if order_index in (13, 14) and len(topics) > 1:
        return topics[1]
    if order_index == 15 and len(topics) > 2:
        return topics[2]
    return "leisure"


# Story-type prompts (combo Q3 past experience, unexpected situation, Q13 role-play experience, Q14 comparison
# "then vs now"): an IH answer has to carry a past-tense narrative
NARRATIVE_QUESTION_TYPES = {"past_experience", "unexpected_situation", "role_play_experience", "comparison"}


def is_narrative_question(question_type: Optional[str]) -> bool:
    return (question_type or "") in NARRATIVE_QUESTION_TYPES


# (recommended min seconds, recommended max seconds / hard limit) at IM-IH level
_BASE_TIMING = {
    "self_intro": (30, 60),
    "description": (45, 90),
    "routine": (45, 90),
    "role_play_ask": (30, 60),
    "role_play_problem": (45, 90),
    "past_experience": (60, 120),
    "unexpected_situation": (60, 120),
    "comparison": (60, 120),
    "role_play_experience": (60, 120),
}


def question_timing(question_type: str, difficulty: Optional[str]) -> Dict[str, int]:
    """Easy prompts get about a minute; narration/comparison prompts up to two. IL-level sets are shortened."""
    low, high = _BASE_TIMING.get(question_type, (45, 90))
    if (difficulty or "").upper() == "IL":
        low, high = max(20, round(low * 0.6 / 5) * 5), max(60, round(high * 0.67 / 5) * 5)
    return {"target_min_sec": low, "target_max_sec": high, "time_limit_sec": high}
