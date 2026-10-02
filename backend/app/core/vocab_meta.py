"""
Vocabulary notebook metadata: the fixed topic list (used by the AI when it suggests upgrades and by the
notebook filters) and the phrase kinds ACTFL IH/AL expects (collocations, phrasal verbs, idioms, topic words).
"""
from typing import Dict, Optional

VOCAB_TOPICS: Dict[str, str] = {
    "home": "Nhà ở",
    "park": "Công viên & thiên nhiên",
    "shopping": "Mua sắm",
    "travel": "Du lịch",
    "work": "Công việc & học tập",
    "environment": "Môi trường",
    "technology": "Công nghệ & truyền thông",
    "food": "Ăn uống & cà phê",
    "health": "Sức khỏe & thể thao",
    "leisure": "Giải trí & sở thích",
    "society": "Xã hội & văn hóa",
    "general": "Chung",
}

VOCAB_KINDS: Dict[str, str] = {
    "collocation": "Collocation",
    "phrasal_verb": "Phrasal verb",
    "idiom": "Idiom",
    "topic_word": "Từ vựng chủ đề",
}

VOCAB_STATUSES = ("learning", "mastered")

# Question category (app.core.question_meta) -> notebook topic, used when the AI gives no valid topic
_CATEGORY_TO_TOPIC = {
    "home": "home",
    "leisure": "leisure",
    "environment": "environment",
    "global_workplace": "work",
    "communication_media": "technology",
    "socio_cultural": "society",
    "human_rights": "society",
    "unexpected": "general",
}


def topic_for_category(category: Optional[str]) -> str:
    return _CATEGORY_TO_TOPIC.get(category or "", "general")


def normalize_topic(topic: Optional[str], fallback: str = "general") -> str:
    key = (topic or "").strip().lower().replace(" ", "_").replace("-", "_")
    return key if key in VOCAB_TOPICS else fallback


def normalize_kind(kind: Optional[str]) -> str:
    key = (kind or "").strip().lower().replace(" ", "_").replace("-", "_")
    if key in ("phrasal", "phrasalverb"):
        key = "phrasal_verb"
    return key if key in VOCAB_KINDS else "collocation"
