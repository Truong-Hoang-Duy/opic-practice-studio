"""
Question bank for the 5-minute daily workout, grouped into the three practice buckets:
- past: past-tense storytelling (past experience, unexpected situation, then-vs-now comparison)  -> 40% of days
- routine: present-tense description of habits/places                                           -> 30%
- role_play: OPIc role-play situations (ask questions, solve a problem, tell a related story)     -> 30%
Curated daily prompts are combined with the matching prompts of the main seed bank.
"""
import hashlib
from typing import Dict, List

from app.core.seed_data import ROLE_PLAY_QUESTIONS, SURVEY_QUESTIONS_MAP, TOPIC_QUESTIONS_BANK

BUCKETS = ("past", "routine", "role_play")

TYPE_TO_BUCKET = {
    "past_experience": "past",
    "unexpected_situation": "past",
    "comparison": "past",
    "routine": "routine",
    "description": "routine",
    "role_play_ask": "role_play",
    "role_play_problem": "role_play",
    "role_play_experience": "role_play",
}

# Badge shown on the challenge card (role-play badges follow the real OPIc order Q11-Q13)
TYPE_BADGES = {
    "past_experience": "Past Experience",
    "unexpected_situation": "Unexpected Situation",
    "comparison": "Comparison",
    "routine": "Routine",
    "description": "Description",
    "role_play_ask": "Role-Play Q11",
    "role_play_problem": "Role-Play Q12",
    "role_play_experience": "Role-Play Q13",
}

# Time frame each question type is built around (the "tense control" pillar of the quick feedback)
FOCUS_TENSES = {
    "past_experience": ("past", "Quá khứ - kể chuyện theo trình tự"),
    "unexpected_situation": ("past", "Quá khứ - kể sự cố và cách xử lý"),
    "comparison": ("past_present", "Quá khứ ↔ Hiện tại - so sánh trước và nay"),
    "routine": ("present", "Hiện tại đơn - thói quen"),
    "description": ("present", "Hiện tại - miêu tả"),
    "role_play_ask": ("present_questions", "Câu hỏi ở hiện tại/tương lai (Wh-/Yes-No, lịch sự)"),
    "role_play_problem": ("present_future", "Hiện tại + Tương lai/giả định (I'd like..., Could you...?, If...)"),
    "role_play_experience": ("past", "Quá khứ - kể lại trải nghiệm tương tự"),
}

# What a rater expects from each question type (fed to the daily grading prompt)
TASK_REQUIREMENTS = {
    "description": "Describe concretely with several specific details (what it is, where, what it looks/feels like), mainly in the present tense.",
    "routine": "Describe habitual actions in order with time/frequency expressions (usually, every weekend, after that), present simple.",
    "past_experience": "Tell ONE specific event: when/where/who -> what happened step by step -> how it ended and how the learner felt; past tenses.",
    "unexpected_situation": "Tell a specific problem that happened, how the learner dealt with it, and the result; past tenses.",
    "comparison": "Compare the past with the present using specific differences and the reason for the change; past AND present (ideally a future view).",
    "role_play_ask": "Act out the call/visit talking directly to the other person, asking 3-4 relevant questions; polite present/future question forms.",
    "role_play_problem": "Talk directly to the other person: explain the problem clearly and offer 2-3 alternatives to solve it (could/would/if).",
    "role_play_experience": "Tell a REAL past experience of a similar problem and how it was resolved; past tenses.",
}

_CURATED: List[Dict[str, str]] = [
    # ---- past (storytelling) ----
    {"type": "past_experience", "topic": "Travel", "text": "Tell me about the most memorable trip you have ever taken. Where did you go, who were you with, and what happened that made it so special?"},
    {"type": "past_experience", "topic": "Home", "text": "Think about the first time you moved to a new home. What was the moving day like, and how did you feel when you finally settled in?"},
    {"type": "past_experience", "topic": "Shopping", "text": "Tell me about a time when you bought something and were really disappointed with it. What did you buy, what went wrong, and what did you do about it?"},
    {"type": "past_experience", "topic": "Park", "text": "Describe a memorable day you spent at a park or by a lake. What did you do there, and why do you still remember that day?"},
    {"type": "past_experience", "topic": "Work / Study", "text": "Tell me about a challenging project you worked on at school or at work. What was difficult about it, and how did it turn out in the end?"},
    {"type": "unexpected_situation", "topic": "Travel", "text": "Have you ever had a problem while traveling, like a cancelled flight or a lost bag? Tell me what happened from beginning to end and how you dealt with it."},
    {"type": "unexpected_situation", "topic": "Technology", "text": "Tell me about a time when your phone or computer suddenly stopped working at a bad moment. What were you doing, and how did you solve the problem?"},
    {"type": "unexpected_situation", "topic": "Food", "text": "Tell me about a time something went wrong at a restaurant or café, such as a wrong order or a long wait. What happened and how was it resolved?"},
    {"type": "comparison", "topic": "Home", "text": "How is the neighborhood you live in now different from the one you grew up in? Compare what it was like back then with what it is like today."},
    {"type": "comparison", "topic": "Technology", "text": "How has the way people communicate with their friends changed compared to ten years ago? Give me some specific examples from your own life."},
    {"type": "comparison", "topic": "Shopping", "text": "Compare how you shopped a few years ago with how you shop now. What has changed, and which way do you prefer?"},
    {"type": "comparison", "topic": "Leisure", "text": "Think about how you spent your free time when you were a teenager. How is it different from the way you relax now, and why has it changed?"},
    # ---- routine (present description) ----
    {"type": "routine", "topic": "Home", "text": "Walk me through a typical weekday for you, from the moment you wake up until you go to bed."},
    {"type": "routine", "topic": "Food", "text": "What do you usually eat during a normal day? Tell me about your breakfast, lunch and dinner habits and where you usually eat."},
    {"type": "routine", "topic": "Health", "text": "What do you usually do to stay healthy? Describe your exercise routine and how often you do it."},
    {"type": "routine", "topic": "Shopping", "text": "How do you usually do your grocery shopping? Tell me where you go, how often, and what you typically buy."},
    {"type": "routine", "topic": "Work / Study", "text": "Describe how you usually get to work or school. What transportation do you take, how long does it take, and what do you do on the way?"},
    {"type": "description", "topic": "Park", "text": "Describe a park you like to visit in your city. What does it look like, and what do people usually do there?"},
    {"type": "description", "topic": "Home", "text": "Describe your favorite room in your home. What does it look like, and what do you usually do there?"},
    {"type": "description", "topic": "Leisure", "text": "Tell me about a hobby you enjoy these days. What is it, how often do you do it, and why do you like it so much?"},
    # ---- role-play ----
    {"type": "role_play_ask", "topic": "Travel", "text": "I'd like to give you a situation and ask you to act it out. You are planning a weekend trip and want to book a hotel room. Call the hotel and ask three or four questions about the room and the facilities."},
    {"type": "role_play_ask", "topic": "Health", "text": "I'd like you to act out a situation. You want to join a new gym near your home. Call the gym and ask three or four questions to get the information you need."},
    {"type": "role_play_ask", "topic": "Shopping", "text": "Here is a situation for you to act out. You want to buy a new laptop. Go to an electronics store and ask the salesperson three or four questions to help you decide."},
    {"type": "role_play_problem", "topic": "Travel", "text": "I'm sorry, but there is a problem. When you arrive at the hotel, the receptionist says they have no record of your booking and the hotel is full. Explain the situation and offer two or three alternatives to solve the problem."},
    {"type": "role_play_problem", "topic": "Shopping", "text": "There is a problem that you need to resolve. The laptop you bought last week stopped working. Call the store, explain what happened, and suggest two or three ways to solve the problem."},
    {"type": "role_play_problem", "topic": "Leisure", "text": "There is a problem. You bought two concert tickets for a friend and yourself, but you just found out you have to work that evening. Call your friend, explain the situation, and suggest some alternatives."},
    {"type": "role_play_experience", "topic": "Shopping", "text": "That's the end of the situation. Have you ever had a problem with something you bought or a service you paid for? Tell me what happened and how you handled it."},
    {"type": "role_play_experience", "topic": "Leisure", "text": "That's the end of the situation. Have you ever had to cancel plans with a friend at the last minute? Tell me about that experience in detail."},
]


def question_key(text: str) -> str:
    return hashlib.md5(text.strip().lower().encode("utf-8")).hexdigest()[:16]


def _seed_items() -> List[Dict[str, str]]:
    items = []
    for topic, questions in TOPIC_QUESTIONS_BANK.items():
        for q in questions:
            items.append({"type": q["type"], "topic": topic.replace("_", " ").title(), "text": q["text"]})
    for questions in SURVEY_QUESTIONS_MAP.values():
        for q in questions:
            items.append({"type": q["type"], "topic": q.get("topic") or "Personal", "text": q["text"]})
    for q in ROLE_PLAY_QUESTIONS:
        items.append({"type": q["type"], "topic": q.get("topic") or "Role-Play", "text": q["text"]})
    return items


def build_daily_bank() -> Dict[str, List[Dict[str, str]]]:
    """bucket -> questions ({key, type, topic, text, badge}), duplicates removed, stable order."""
    bank: Dict[str, List[Dict[str, str]]] = {b: [] for b in BUCKETS}
    seen = set()
    for item in _CURATED + _seed_items():
        bucket = TYPE_TO_BUCKET.get(item["type"])
        key = question_key(item["text"])
        if not bucket or key in seen:
            continue
        seen.add(key)
        bank[bucket].append({**item, "key": key, "badge": TYPE_BADGES[item["type"]]})
    return bank


DAILY_BANK = build_daily_bank()
