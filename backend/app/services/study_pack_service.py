"""
Unlimited, Anti-Duplicate OPIc Master Curriculum Service ("1 Master Script - Multiple Prompt Variants").
Supports selecting any combination of OPIc topics (background, survey leisure, all 5 official topics,
high-frequency role-plays, unexpected topics, and unlimited custom learner topics) without a 50-question
ceiling, deduplicating via `canonical_key` so existing learned progress & model answers are always preserved.
"""
import logging
import random
import re
import threading
import unicodedata
from concurrent.futures import ThreadPoolExecutor
from typing import Any, Dict, List, Optional, Set, Tuple
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models.session import TestSession
from app.models.question import Question, ModelAnswer
from app.core.seed_data import DEFAULT_GUIDES_BY_TYPE, TOPIC_QUESTIONS_BANK, SELF_INTRO_QUESTION
from app.core.question_meta import OFFICIAL_TOPICS
from app.services.llm_service import generate_single_model_answer_llm
from app.services.tts_service import cached_speech_url, prefetch_speech
from app.services.evaluation_service import is_mock_session

logger = logging.getLogger("opic_study_pack")
logger.setLevel(logging.INFO)

DEFAULT_TOPICS = ["environment", "socio_cultural", "communication_media"]
LEVEL_TO_ASSESSMENT = {"IL": 3, "IM": 4, "IH": 5}

# Active background jobs & per-question generation locks (prevents duplicate LLM calls on click-to-prioritize)
_jobs_lock = threading.Lock()
_active_jobs: Dict[int, bool] = {}
_q_locks_guard = threading.Lock()
_q_locks: Dict[int, threading.Lock] = {}


def _lock_for_question(question_id: int) -> threading.Lock:
    with _q_locks_guard:
        lk = _q_locks.get(question_id)
        if lk is None:
            lk = threading.Lock()
            _q_locks[question_id] = lk
        return lk


def slugify_topic(text: str) -> str:
    raw = unicodedata.normalize("NFKD", str(text or "")).encode("ascii", "ignore").decode("ascii")
    slug = re.sub(r"[^a-z0-9]+", "_", raw.lower()).strip("_")
    return slug[:48] or "topic"


def make_canonical_key(category: str, topic_slug: str, question_type: str) -> str:
    cat = slugify_topic(category or "general")
    sub = slugify_topic(topic_slug or "general")
    qtype = slugify_topic(question_type or "description")
    return f"{cat}:{sub}:{qtype}"[:120]


def infer_canonical_key_for_question(q: Question) -> str:
    """Derives a stable canonical_key for legacy questions or exam questions without one."""
    if getattr(q, "canonical_key", None):
        return q.canonical_key
    cat = (q.category or "leisure").strip().lower()
    topic_low = (q.topic or "").strip().lower()
    qtype = (q.question_type or "description").strip().lower()
    # Map well-known topic phrases to canonical sub_topic slugs so exam questions link cleanly to master slots
    aliases = [
        (("home", "house", "apartment", "living with family", "family living"), "home", "home_living"),
        (("stay at home", "staycation"), "home", "staycation"),
        (("work", "office", "job", "company", "coworker"), "home", "work_office"),
        (("school", "university", "college", "class", "professor"), "home", "school_study"),
        (("movie", "cinema", "film"), "leisure", "go_to_the_movies"),
        (("park",), "leisure", "go_to_parks"),
        (("music", "song", "singer"), "leisure", "listen_to_music"),
        (("cook", "kitchen", "meal", "recipe"), "leisure", "cook"),
        (("walk",), "leisure", "walk"),
        (("cafe", "coffee"), "leisure", "going_to_cafes"),
        (("beach", "ocean", "seaside"), "leisure", "go_to_the_beach"),
        (("camp",), "leisure", "go_camping"),
        (("gym", "fitness", "health club", "workout"), "leisure", "go_to_a_health_club_or_gym"),
        (("jog", "running"), "leisure", "jog"),
        (("bike", "cycling", "bicycle"), "leisure", "bike"),
        (("domestic",), "leisure", "take_vacation_domestically"),
        (("international", "abroad", "overseas"), "leisure", "take_vacation_internationally"),
        (("pet", "dog", "cat"), "leisure", "have_pets"),
        (("game",), "leisure", "play_games"),
        (("hotel",), "role_play", "rp_hotel"),
        (("return", "exchange", "shopping", "jacket", "store"), "role_play", "rp_shopping_return"),
        (("movie & dinner", "restaurant booking", "theater"), "role_play", "rp_movie_dinner"),
        (("travel agency", "flight", "tour package"), "role_play", "rp_travel_agency"),
        (("car rental", "rent a car", "rental car"), "role_play", "rp_car_rental"),
        (("concert", "live show", "ticket box"), "role_play", "rp_concert_show"),
        (("doctor", "clinic", "hospital", "medical appointment"), "role_play", "rp_doctor_clinic"),
        (("house party", "housewarming", "birthday party"), "role_play", "rp_house_party"),
        (("bank", "credit card", "atm"), "role_play", "rp_bank_card"),
        (("furniture", "sofa", "washing machine", "appliance delivery"), "role_play", "rp_furniture_appliance"),
        (("house sitting", "pet sitting", "look after"), "role_play", "rp_pet_house_sitting"),
        (("library", "community center", "study room"), "role_play", "rp_library_course"),
        (("dentist", "dental", "toothache"), "role_play", "rp_dentist"),
        (("hair salon", "haircut", "barber"), "role_play", "rp_hair_salon"),
        (("apartment rental", "for rent", "landlord", "moving company"), "role_play", "rp_apartment_rental"),
        (("internet service", "wi-fi", "wifi", "internet plan"), "role_play", "rp_internet_plan"),
        (("post office", "package", "parcel", "courier"), "role_play", "rp_post_office"),
        (("weather", "season", "rain", "storm"), "unexpected", "unexp_weather"),
        (("neighbor", "neighborhood"), "unexpected", "unexp_neighborhood"),
        (("phone", "smartphone", "online shopping"), "unexpected", "unexp_phone_shopping"),
        (("health", "healthy", "doctor", "sick"), "unexpected", "unexp_health"),
        (("transport", "bus", "subway", "traffic"), "unexpected", "unexp_transport"),
        (("restaurant", "dining out"), "unexpected", "unexp_restaurants"),
        (("holiday", "festival", "tet"), "unexpected", "unexp_holidays"),
        (("recycl", "trash", "waste"), "unexpected", "unexp_recycling"),
        (("bank", "banking", "mobile banking"), "unexpected", "unexp_bank"),
        (("library", "reading room"), "unexpected", "unexp_library"),
        (("appointment", "schedule", "plans"), "unexpected", "unexp_appointments"),
        (("fashion", "clothes", "clothing"), "unexpected", "unexp_fashion_shopping"),
        (("appliance", "home tech", "gadget"), "unexpected", "unexp_furniture_tech"),
    ]
    if cat in OFFICIAL_TOPICS:
        return make_canonical_key(cat, cat, qtype)
    for keywords, mapped_cat, mapped_sub in aliases:
        if any(kw in topic_low for kw in keywords):
            return make_canonical_key(mapped_cat, mapped_sub, qtype)
    return make_canonical_key(cat, topic_low or cat, qtype)


def _v(label: str, question: str, bridge: str = "") -> Dict[str, str]:
    return {"label": label, "question": question, "bridge": bridge}


# ==============================================================================
# CURATED MASTER TOPIC CATALOG (30+ topics across 5 curated groups + unlimited custom)
# ==============================================================================

TOPIC_CATALOG_ITEMS: List[Dict[str, Any]] = [
    # --- GROUP 1: Nền tảng cá nhân (home / background) ---
    {
        "id": "home_living",
        "group": "home",
        "category": "home",
        "title_vi": "Nhà ở & Gia đình",
        "title_en": "Home & Living with Family",
        "default_selected": True,
        "questions": [
            {
                "question_type": "description",
                "topic": "Home & Living with Family",
                "question_text": "You indicated in the survey that you live with family members in a house or an apartment. Describe your home to me. What does it look like, what rooms does it have, and which room is your favorite?",
                "prompt_variants": [
                    _v(
                        "Hỏi về đồ nội thất",
                        "Where do you live right now? Introduce your house or apartment and tell me about the furniture inside your rooms.",
                        "Speaking of the furniture inside, we keep our place neat and cozy with...",
                    ),
                    _v(
                        "Hỏi sâu về căn phòng yêu thích",
                        "Which room in your home do you spend the most time in, and what makes it special to you?",
                        "If I had to pick my absolute favorite room in our home, it would definitely be...",
                    ),
                ],
                "story_tags": ["Không gian sống cá nhân"],
            },
            {
                "question_type": "routine",
                "topic": "Home & Living with Family",
                "question_text": "Tell me about what you and your family usually do together at home on a typical day or weekend. Who does what around the house?",
                "prompt_variants": [
                    _v(
                        "Hỏi về việc nhà (chores)",
                        "How are household chores divided among your family members? What chores do you usually handle?",
                        "When it comes to dividing chores at home, everyone pitches in—...",
                    ),
                ],
                "story_tags": ["Nhịp sống gia đình"],
            },
            {
                "question_type": "past_experience",
                "topic": "Home & Living with Family",
                "question_text": "Tell me about a memorable event or an unexpected problem that happened at your home, such as a broken appliance or a special family celebration. What happened and how did you handle it?",
                "prompt_variants": [
                    _v(
                        "Hỏi sự cố hỏng đồ gia dụng",
                        "Have you ever had a problem with an appliance or something breaking down in your home? Tell me what went wrong.",
                        "I still vividly remember one super hot weekend when our air conditioner suddenly broke down...",
                    ),
                ],
                "story_tags": ["Sự cố hỏng máy lạnh"],
            },
        ],
    },
    {
        "id": "staycation",
        "group": "home",
        "category": "home",
        "title_vi": "Nghỉ lễ tại nhà",
        "title_en": "Stay at Home for Vacation",
        "default_selected": True,
        "questions": [
            {
                "question_type": "description",
                "topic": "Stay at Home for Vacation",
                "question_text": "You mentioned that you like to stay at home for vacation. Why do you prefer staying at home instead of traveling somewhere far away, and what makes it comfortable for you?",
                "prompt_variants": [
                    _v(
                        "Lý do thích nghỉ ở nhà",
                        "Some people travel during vacations, while others stay home. What do you enjoy most about spending your time off at home?",
                        "Honestly, staying home saves me from crowds and stress, and...",
                    ),
                ],
                "story_tags": ["Không gian sống cá nhân"],
            },
            {
                "question_type": "routine",
                "topic": "Stay at Home for Vacation",
                "question_text": "When you have a few days off and spend your vacation at home, walk me through your usual daily routine from morning to night.",
                "prompt_variants": [
                    _v(
                        "Lịch trình ngày nghỉ cuối tuần",
                        "Describe a typical relaxing day when you do not have to work or go anywhere.",
                        "On a lazy day off at home, I usually wake up a bit later and...",
                    ),
                ],
                "story_tags": ["Nhịp sống gia đình"],
            },
            {
                "question_type": "past_experience",
                "topic": "Stay at Home for Vacation",
                "question_text": "Tell me about one of the most enjoyable or memorable vacations you spent at home. What did you do, who were you with, and why do you still remember it?",
                "prompt_variants": [
                    _v(
                        "Kỳ nghỉ ở nhà gần nhất",
                        "Tell me about the last holiday or long weekend you spent at home with your family.",
                        "During our last long holiday at home, we planned a cozy family cooking day...",
                    ),
                ],
                "story_tags": ["Sự cố hỏng máy lạnh"],
            },
        ],
    },
    {
        "id": "work_office",
        "group": "home",
        "category": "home",
        "title_vi": "Công việc & Văn phòng",
        "title_en": "Work & Office Life",
        "default_selected": False,
        "questions": [
            {
                "question_type": "description",
                "topic": "Work & Office Life",
                "question_text": "Tell me about the company or workplace where you currently work. What does your office look like, and what is your main role there?",
                "prompt_variants": [
                    _v(
                        "Đồng nghiệp & môi trường làm việc",
                        "Describe your workplace atmosphere and the colleagues you work with every day.",
                        "My workplace has a friendly, collaborative vibe, and...",
                    ),
                ],
                "story_tags": ["Môi trường công sở"],
            },
            {
                "question_type": "routine",
                "topic": "Work & Office Life",
                "question_text": "Walk me through a typical workday from the time you arrive at the office until you finish work.",
                "prompt_variants": [],
                "story_tags": ["Môi trường công sở"],
            },
            {
                "question_type": "past_experience",
                "topic": "Work & Office Life",
                "question_text": "Tell me about a challenging project, tight deadline, or memorable moment you experienced at work. How did you handle it?",
                "prompt_variants": [],
                "story_tags": ["Sự cố công việc gấp"],
            },
        ],
    },
    {
        "id": "school_study",
        "group": "home",
        "category": "home",
        "title_vi": "Trường học & Lớp học",
        "title_en": "School & Classes",
        "default_selected": False,
        "questions": [
            {
                "question_type": "description",
                "topic": "School & Classes",
                "question_text": "Tell me about your school or university, or a memorable class you took. What did the campus look like and what subject interested you most?",
                "prompt_variants": [],
                "story_tags": [],
            },
            {
                "question_type": "routine",
                "topic": "School & Classes",
                "question_text": "When you were taking classes, what was your usual study routine before exams or group assignments?",
                "prompt_variants": [],
                "story_tags": [],
            },
            {
                "question_type": "past_experience",
                "topic": "School & Classes",
                "question_text": "Tell me about a memorable teacher, classmate, or unexpected situation that happened during a class or exam.",
                "prompt_variants": [],
                "story_tags": [],
            },
        ],
    },

    # --- GROUP 2: Sở thích & Thể thao (leisure) ---
    {
        "id": "go to the movies",
        "group": "leisure",
        "category": "leisure",
        "title_vi": "Xem phim rạp",
        "title_en": "Going to the Movies",
        "default_selected": True,
        "questions": [
            {
                "question_type": "description",
                "topic": "Going to the Movies",
                "question_text": "You indicated that you enjoy going to the movies. What kind of movies do you like to watch, and what is your favorite movie theater like?",
                "prompt_variants": [
                    _v(
                        "Thể loại & diễn viên yêu thích",
                        "Tell me about your favorite movie genre and why you prefer watching films in a theater instead of at home.",
                        "Even though streaming is convenient, nothing beats the big screen for...",
                    ),
                ],
                "story_tags": [],
            },
            {
                "question_type": "routine",
                "topic": "Going to the Movies",
                "question_text": "Tell me about your usual routine when you go to the movies. Who do you usually go with, what do you do before the movie starts, and what do you do afterward?",
                "prompt_variants": [],
                "story_tags": [],
            },
            {
                "question_type": "past_experience",
                "topic": "Going to the Movies",
                "question_text": "Tell me about a memorable experience you had at a movie theater or a movie that left a strong impression on you. What happened and why was it special?",
                "prompt_variants": [],
                "story_tags": ["Đổi kế hoạch phút chót"],
            },
        ],
    },
    {
        "id": "go to parks",
        "group": "leisure",
        "category": "leisure",
        "title_vi": "Đi công viên",
        "title_en": "Going to Parks",
        "default_selected": True,
        "questions": [
            {
                "question_type": "description",
                "topic": "Going to Parks",
                "question_text": "You mentioned that you like going to parks. Describe the park you visit most often. Where is it located, and what does it look like?",
                "prompt_variants": [
                    _v(
                        "Cảnh vật & tiện ích công viên",
                        "What kinds of scenery, trees, or facilities can people see at the park near your house?",
                        "The park near my neighborhood is really well-maintained with...",
                    ),
                ],
                "story_tags": ["Công viên gần nhà"],
            },
            {
                "question_type": "routine",
                "topic": "Going to Parks",
                "question_text": "What do you usually do when you go to the park? When do you normally go, who do you go with, and what kinds of activities do other people do there?",
                "prompt_variants": [],
                "story_tags": ["Công viên gần nhà"],
            },
            {
                "question_type": "past_experience",
                "topic": "Going to Parks",
                "question_text": "Tell me about a memorable or unexpected thing that happened to you while visiting a park. What happened and how did you feel?",
                "prompt_variants": [],
                "story_tags": ["Cơn mưa bất ngờ ngoài trời"],
            },
        ],
    },
    {
        "id": "listen to music",
        "group": "leisure",
        "category": "leisure",
        "title_vi": "Nghe nhạc",
        "title_en": "Listening to Music",
        "default_selected": True,
        "questions": [
            {
                "question_type": "description",
                "topic": "Listening to Music",
                "question_text": "You indicated that you enjoy listening to music. What types of music and which singers or bands do you like best, and why?",
                "prompt_variants": [],
                "story_tags": [],
            },
            {
                "question_type": "routine",
                "topic": "Listening to Music",
                "question_text": "When and where do you usually listen to music during your day? What devices or apps do you use to listen to it?",
                "prompt_variants": [],
                "story_tags": [],
            },
            {
                "question_type": "past_experience",
                "topic": "Listening to Music",
                "question_text": "Has your taste in music changed over time, or is there a specific song or musical memory that means a lot to you? Tell me about it.",
                "prompt_variants": [],
                "story_tags": [],
            },
        ],
    },
    {
        "id": "cook",
        "group": "leisure",
        "category": "leisure",
        "title_vi": "Nấu ăn tại nhà",
        "title_en": "Cooking at Home",
        "default_selected": True,
        "questions": [
            {
                "question_type": "description",
                "topic": "Cooking at Home",
                "question_text": "You mentioned that you enjoy cooking. What kinds of dishes do you like to cook most, and what is your favorite meal to prepare?",
                "prompt_variants": [],
                "story_tags": [],
            },
            {
                "question_type": "routine",
                "topic": "Cooking at Home",
                "question_text": "How often do you cook, and what is your usual process from buying ingredients to serving the food? Do you usually cook alone or with family?",
                "prompt_variants": [],
                "story_tags": [],
            },
            {
                "question_type": "past_experience",
                "topic": "Cooking at Home",
                "question_text": "Tell me about a memorable time you cooked a meal, such as a time something went wrong in the kitchen or a special dish you made for others. What happened?",
                "prompt_variants": [],
                "story_tags": ["Sự cố trong bếp"],
            },
        ],
    },
    {
        "id": "walk",
        "group": "leisure",
        "category": "leisure",
        "title_vi": "Đi bộ thể dục",
        "title_en": "Walking for Exercise",
        "default_selected": True,
        "questions": [
            {
                "question_type": "description",
                "topic": "Walking for Exercise",
                "question_text": "You indicated that you enjoy walking. Where do you usually go for a walk, and what do you like about the scenery or atmosphere there?",
                "prompt_variants": [],
                "story_tags": ["Công viên gần nhà"],
            },
            {
                "question_type": "routine",
                "topic": "Walking for Exercise",
                "question_text": "How often do you go walking, and what is your usual routine? What do you wear, when do you go, and do you walk alone or with someone?",
                "prompt_variants": [],
                "story_tags": ["Công viên gần nhà"],
            },
            {
                "question_type": "past_experience",
                "topic": "Walking for Exercise",
                "question_text": "Tell me about a memorable or unusual experience you had while out for a walk. When did it happen and what made it unforgettable?",
                "prompt_variants": [],
                "story_tags": ["Cơn mưa bất ngờ ngoài trời"],
            },
        ],
    },
    {
        "id": "going to cafes",
        "group": "leisure",
        "category": "leisure",
        "title_vi": "Đi quán café",
        "title_en": "Going to Cafes",
        "default_selected": False,
        "questions": [
            {
                "question_type": "description",
                "topic": "Going to Cafes",
                "question_text": "Tell me about your favorite cafe or coffee shop. Where is it located, what does the interior look like, and what do you usually order?",
                "prompt_variants": [],
                "story_tags": [],
            },
            {
                "question_type": "routine",
                "topic": "Going to Cafes",
                "question_text": "How often do you visit cafes, who do you usually go with, and what do you normally do while you are there?",
                "prompt_variants": [],
                "story_tags": [],
            },
            {
                "question_type": "past_experience",
                "topic": "Going to Cafes",
                "question_text": "Tell me about a memorable time you spent at a coffee shop—for example, a great conversation or an unexpected incident.",
                "prompt_variants": [],
                "story_tags": ["Cơn mưa bất ngờ ngoài trời"],
            },
        ],
    },
    {
        "id": "go to the beach",
        "group": "leisure",
        "category": "leisure",
        "title_vi": "Đi biển",
        "title_en": "Going to the Beach",
        "default_selected": False,
        "questions": [
            {
                "question_type": "description",
                "topic": "Going to the Beach",
                "question_text": "You mentioned that you like going to the beach. Describe your favorite beach. What does the scenery look like and why do you enjoy going there?",
                "prompt_variants": [],
                "story_tags": ["Chuyến đi biển"],
            },
            {
                "question_type": "routine",
                "topic": "Going to the Beach",
                "question_text": "What do you usually pack and what activities do you do when you spend a day at the beach?",
                "prompt_variants": [],
                "story_tags": ["Chuyến đi biển"],
            },
            {
                "question_type": "past_experience",
                "topic": "Going to the Beach",
                "question_text": "Tell me about a memorable beach trip you took. Who went with you, what happened, and why do you still remember it?",
                "prompt_variants": [],
                "story_tags": ["Chuyến đi biển", "Cơn mưa bất ngờ ngoài trời"],
            },
        ],
    },
    {
        "id": "go to a health club or gym",
        "group": "leisure",
        "category": "leisure",
        "title_vi": "Tập gym / Thể hình",
        "title_en": "Going to the Gym",
        "default_selected": False,
        "questions": [
            {
                "question_type": "description",
                "topic": "Going to the Gym",
                "question_text": "Describe the gym or fitness center you go to. What equipment or facilities does it have, and what do you like most about it?",
                "prompt_variants": [],
                "story_tags": [],
            },
            {
                "question_type": "routine",
                "topic": "Going to the Gym",
                "question_text": "How often do you work out at the gym? Walk me through your typical exercise routine from warm-up to cool-down.",
                "prompt_variants": [],
                "story_tags": [],
            },
            {
                "question_type": "past_experience",
                "topic": "Going to the Gym",
                "question_text": "Tell me about when you first started working out or a memorable experience you had at the gym.",
                "prompt_variants": [],
                "story_tags": [],
            },
        ],
    },
    {
        "id": "take vacation domestically",
        "group": "leisure",
        "category": "leisure",
        "title_vi": "Du lịch trong nước",
        "title_en": "Domestic Travel",
        "default_selected": False,
        "questions": [
            {
                "question_type": "description",
                "topic": "Domestic Travel",
                "question_text": "You enjoy taking domestic vacations. Describe one of your favorite travel destinations in your country and what makes it worth visiting.",
                "prompt_variants": [],
                "story_tags": ["Chuyến đi biển"],
            },
            {
                "question_type": "routine",
                "topic": "Domestic Travel",
                "question_text": "How do you usually plan and prepare for a domestic trip? What things do you always bring with you?",
                "prompt_variants": [],
                "story_tags": [],
            },
            {
                "question_type": "past_experience",
                "topic": "Domestic Travel",
                "question_text": "Tell me about an unforgettable domestic trip you took, including any unexpected problem or highlight that happened along the way.",
                "prompt_variants": [],
                "story_tags": ["Chuyến đi biển"],
            },
        ],
    },
    {
        "id": "take vacation internationally",
        "group": "leisure",
        "category": "leisure",
        "title_vi": "Du lịch nước ngoài",
        "title_en": "International Travel",
        "default_selected": False,
        "questions": [
            {
                "question_type": "description",
                "topic": "International Travel",
                "question_text": "Tell me about a foreign country or city you visited—or would love to visit. What makes its culture, food, or sights interesting to you?",
                "prompt_variants": [],
                "story_tags": [],
            },
            {
                "question_type": "routine",
                "topic": "International Travel",
                "question_text": "How do you prepare before traveling abroad, such as booking flights, packing, and planning your itinerary?",
                "prompt_variants": [],
                "story_tags": [],
            },
            {
                "question_type": "past_experience",
                "topic": "International Travel",
                "question_text": "Tell me about a memorable experience or unexpected situation you faced while traveling abroad, such as a flight delay or language barrier.",
                "prompt_variants": [],
                "story_tags": [],
            },
        ],
    },
    {
        "id": "jog",
        "group": "leisure",
        "category": "leisure",
        "title_vi": "Chạy bộ",
        "title_en": "Jogging",
        "default_selected": False,
        "questions": [
            {
                "question_type": "description",
                "topic": "Jogging",
                "question_text": "Where do you usually go jogging? Describe the route, atmosphere, and why you like running there.",
                "prompt_variants": [],
                "story_tags": ["Công viên gần nhà"],
            },
            {
                "question_type": "routine",
                "topic": "Jogging",
                "question_text": "How often do you jog and what is your typical routine before, during, and after a run?",
                "prompt_variants": [],
                "story_tags": ["Công viên gần nhà"],
            },
            {
                "question_type": "past_experience",
                "topic": "Jogging",
                "question_text": "Tell me about a memorable run or a time you felt proud—or faced an obstacle—while jogging.",
                "prompt_variants": [],
                "story_tags": ["Cơn mưa bất ngờ ngoài trời"],
            },
        ],
    },
    {
        "id": "have pets",
        "group": "leisure",
        "category": "leisure",
        "title_vi": "Nuôi thú cưng",
        "title_en": "Having Pets",
        "default_selected": False,
        "questions": [
            {
                "question_type": "description",
                "topic": "Having Pets",
                "question_text": "Describe your pet (or a pet you used to have). What does it look like and what is its personality like?",
                "prompt_variants": [],
                "story_tags": [],
            },
            {
                "question_type": "routine",
                "topic": "Having Pets",
                "question_text": "How do you take care of your pet every day, such as feeding, walking, or playing together?",
                "prompt_variants": [],
                "story_tags": [],
            },
            {
                "question_type": "past_experience",
                "topic": "Having Pets",
                "question_text": "Tell me about a funny, touching, or unexpected experience you had with your pet.",
                "prompt_variants": [],
                "story_tags": [],
            },
        ],
    },
    {
        "id": "go camping",
        "group": "leisure",
        "category": "leisure",
        "title_vi": "Cắm trại",
        "title_en": "Going Camping",
        "default_selected": False,
        "questions": [
            {
                "question_type": "description",
                "topic": "Going Camping",
                "question_text": "You enjoy going camping. Describe your favorite campsite or the kind of scenery you look for when camping.",
                "prompt_variants": [],
                "story_tags": ["Cơn mưa bất ngờ ngoài trời"],
            },
            {
                "question_type": "routine",
                "topic": "Going Camping",
                "question_text": "What gear, food, and supplies do you usually pack before a camping trip, and what do you normally do at the campsite?",
                "prompt_variants": [],
                "story_tags": [],
            },
            {
                "question_type": "past_experience",
                "topic": "Going Camping",
                "question_text": "Tell me about a memorable camping trip—such as sudden bad weather, forgetting important gear, or a special night under the stars.",
                "prompt_variants": [],
                "story_tags": ["Cơn mưa bất ngờ ngoài trời"],
            },
        ],
    },
    {
        "id": "bike",
        "group": "leisure",
        "category": "leisure",
        "title_vi": "Đạp xe",
        "title_en": "Biking / Cycling",
        "default_selected": False,
        "questions": [
            {
                "question_type": "description",
                "topic": "Biking / Cycling",
                "question_text": "Describe the bicycle you ride and the cycling paths or routes you enjoy most in your area.",
                "prompt_variants": [],
                "story_tags": ["Công viên gần nhà"],
            },
            {
                "question_type": "routine",
                "topic": "Biking / Cycling",
                "question_text": "How often do you go cycling, when do you usually ride, and what safety gear or routine do you follow?",
                "prompt_variants": [],
                "story_tags": ["Công viên gần nhà"],
            },
            {
                "question_type": "past_experience",
                "topic": "Biking / Cycling",
                "question_text": "Tell me about a memorable cycling trip or a time something unexpected happened while you were riding your bike, like a flat tire or heavy rain.",
                "prompt_variants": [],
                "story_tags": ["Cơn mưa bất ngờ ngoài trời"],
            },
        ],
    },
    {
        "id": "play games",
        "group": "leisure",
        "category": "leisure",
        "title_vi": "Chơi game & Board game",
        "title_en": "Playing Games",
        "default_selected": False,
        "questions": [
            {
                "question_type": "description",
                "topic": "Playing Games",
                "question_text": "What kinds of video games, mobile games, or board games do you enjoy playing, and what makes your favorite game fun?",
                "prompt_variants": [],
                "story_tags": [],
            },
            {
                "question_type": "routine",
                "topic": "Playing Games",
                "question_text": "When do you usually play games, who do you play with, and how do you balance gaming with work or daily responsibilities?",
                "prompt_variants": [],
                "story_tags": [],
            },
            {
                "question_type": "past_experience",
                "topic": "Playing Games",
                "question_text": "Tell me about a super fun, competitive, or unforgettable gaming session you had with friends or family.",
                "prompt_variants": [],
                "story_tags": [],
            },
        ],
    },
    {
        "id": "go to concerts",
        "group": "leisure",
        "category": "leisure",
        "title_vi": "Đi xem hòa nhạc / Show",
        "title_en": "Going to Concerts",
        "default_selected": False,
        "questions": [
            {
                "question_type": "description",
                "topic": "Going to Concerts",
                "question_text": "Describe a concert venue or live music show you enjoy. What is the atmosphere like compared to listening to recorded music?",
                "prompt_variants": [],
                "story_tags": [],
            },
            {
                "question_type": "routine",
                "topic": "Going to Concerts",
                "question_text": "Walk me through what you usually do from buying tickets to arriving at the venue and heading home after a concert.",
                "prompt_variants": [],
                "story_tags": [],
            },
            {
                "question_type": "past_experience",
                "topic": "Going to Concerts",
                "question_text": "Tell me about the most unforgettable concert or live performance you ever attended. What made it special?",
                "prompt_variants": [],
                "story_tags": [],
            },
        ],
    },

    # --- GROUP 3: 5 Chủ đề Chính thức (official — select any or all 5!) ---
    {
        "id": "environment",
        "group": "official",
        "category": "environment",
        "title_vi": "Môi trường",
        "title_en": "Environment",
        "default_selected": True,
        "questions": [
            {
                "question_type": "description",
                "topic": "Environment",
                "question_text": "Environmental protection is an important issue today. What kinds of environmental problems is your city or country facing right now?",
                "prompt_variants": [
                    _v(
                        "Ô nhiễm không khí & rác nhựa",
                        "What are the biggest pollution challenges where you live, and how do they affect daily life?",
                        "In my city, the two problems everyone notices right away are air quality and plastic waste...",
                    ),
                ],
                "story_tags": ["Bảo vệ môi trường"],
            },
            {
                "question_type": "past_experience",
                "topic": "Environment",
                "question_text": "Have you ever done something to protect the environment, such as recycling or reducing plastic waste? Tell me about a specific time and what you did.",
                "prompt_variants": [],
                "story_tags": ["Bảo vệ môi trường"],
            },
            {
                "question_type": "comparison",
                "topic": "Environment",
                "question_text": "How have people's attitudes toward protecting the environment changed compared to the past? Compare the past with today.",
                "prompt_variants": [],
                "story_tags": ["Bảo vệ môi trường"],
            },
        ],
    },
    {
        "id": "human_rights",
        "group": "official",
        "category": "human_rights",
        "title_vi": "Quyền con người & Bình đẳng",
        "title_en": "Human Rights",
        "default_selected": False,
        "questions": [
            {
                "question_type": "description",
                "topic": "Human Rights",
                "question_text": "Human rights and fairness are frequently discussed today. What does equal treatment mean to you in everyday life, work, or school?",
                "prompt_variants": [],
                "story_tags": [],
            },
            {
                "question_type": "past_experience",
                "topic": "Human Rights",
                "question_text": "Tell me about a time at work, school, or in your community when fairness was important or someone was treated unfairly, and how it was handled.",
                "prompt_variants": [],
                "story_tags": [],
            },
            {
                "question_type": "comparison",
                "topic": "Human Rights",
                "question_text": "How has awareness of equality and human rights changed in your country compared to twenty years ago?",
                "prompt_variants": [],
                "story_tags": [],
            },
        ],
    },
    {
        "id": "global_workplace",
        "group": "official",
        "category": "global_workplace",
        "title_vi": "Làm việc toàn cầu",
        "title_en": "Global Workplace",
        "default_selected": False,
        "questions": [
            {
                "question_type": "description",
                "topic": "Global Workplace",
                "question_text": "Many people today work in international companies or collaborate online with people from other countries. Describe what a modern workplace looks like and what skills are helpful.",
                "prompt_variants": [],
                "story_tags": ["Môi trường công sở"],
            },
            {
                "question_type": "past_experience",
                "topic": "Global Workplace",
                "question_text": "Tell me about a memorable time you worked or cooperated with people who had different habits, opinions, or backgrounds. What happened?",
                "prompt_variants": [],
                "story_tags": ["Sự cố công việc gấp"],
            },
            {
                "question_type": "comparison",
                "topic": "Global Workplace",
                "question_text": "How has the way people work changed compared to the past, especially with remote work and online tools?",
                "prompt_variants": [],
                "story_tags": ["Môi trường công sở"],
            },
        ],
    },
    {
        "id": "socio_cultural",
        "group": "official",
        "category": "socio_cultural",
        "title_vi": "Văn hóa & Xã hội",
        "title_en": "Socio-Cultural",
        "default_selected": True,
        "questions": [
            {
                "question_type": "description",
                "topic": "Socio Cultural",
                "question_text": "Tell me about some traditions, holidays, or social customs that are important in your country. How do families usually celebrate or practice them?",
                "prompt_variants": [],
                "story_tags": ["Ngày lễ gia đình"],
            },
            {
                "question_type": "past_experience",
                "topic": "Socio Cultural",
                "question_text": "Tell me about a memorable family gathering, holiday, or cultural event you attended. Who was there and what made it special?",
                "prompt_variants": [],
                "story_tags": ["Ngày lễ gia đình"],
            },
            {
                "question_type": "comparison",
                "topic": "Socio Cultural",
                "question_text": "There are noticeable differences between older and younger generations today. Compare how older people and young people spend their free time or view life.",
                "prompt_variants": [],
                "story_tags": [],
            },
        ],
    },
    {
        "id": "communication_media",
        "group": "official",
        "category": "communication_media",
        "title_vi": "Truyền thông & Mạng xã hội",
        "title_en": "Communication Media",
        "default_selected": True,
        "questions": [
            {
                "question_type": "description",
                "topic": "Communication Media",
                "question_text": "How do you use social media, messaging apps, or news platforms in your daily life? Which apps do you use the most and why?",
                "prompt_variants": [],
                "story_tags": ["Thói quen dùng điện thoại"],
            },
            {
                "question_type": "past_experience",
                "topic": "Communication Media",
                "question_text": "Tell me about a time when a message misunderstanding, phone issue, or internet outage caused a problem for you. What happened and how did you fix it?",
                "prompt_variants": [],
                "story_tags": ["Sự cố mất mạng / điện thoại"],
            },
            {
                "question_type": "comparison",
                "topic": "Communication Media",
                "question_text": "How has the way people stay in touch with friends and family changed compared to the past? Compare the past with the present.",
                "prompt_variants": [],
                "story_tags": ["Thói quen dùng điện thoại"],
            },
        ],
    },

    # --- GROUP 4: Role-Play thực chiến (role_play) ---
    {
        "id": "rp_movie_dinner",
        "group": "role_play",
        "category": "role_play",
        "title_vi": "Đặt vé phim & Nhà hàng",
        "title_en": "Role-Play: Movie & Dinner Plans",
        "default_selected": True,
        "questions": [
            {
                "question_type": "role_play_ask",
                "topic": "Role-Play: Movie & Dinner Plans",
                "question_text": "I'd like to give you a situation and ask you to act it out. You want to invite a friend to watch a movie and have dinner this weekend. Call the movie theater or restaurant and ask three or four questions about showtimes, ticket prices, seating, or reservations.",
                "prompt_variants": [],
                "story_tags": [],
            },
            {
                "question_type": "role_play_problem",
                "topic": "Role-Play: Movie & Dinner Plans",
                "question_text": "Now, I'm sorry, but there is a problem. The movie time you wanted is completely sold out, or you suddenly have to work late and cannot make it on time. Call your friend, explain the situation, and suggest two or three alternative plans.",
                "prompt_variants": [],
                "story_tags": ["Đổi kế hoạch phút chót"],
            },
            {
                "question_type": "role_play_experience",
                "topic": "Role-Play: Movie & Dinner Plans",
                "question_text": "That's the end of the role-play. Have you ever had to cancel or change plans with a friend or family member at the last minute? Tell me what happened and how you resolved it.",
                "prompt_variants": [],
                "story_tags": ["Đổi kế hoạch phút chót"],
            },
        ],
    },
    {
        "id": "rp_hotel",
        "group": "role_play",
        "category": "role_play",
        "title_vi": "Đặt phòng khách sạn",
        "title_en": "Role-Play: Hotel Reservation",
        "default_selected": True,
        "questions": [
            {
                "question_type": "role_play_ask",
                "topic": "Role-Play: Hotel Reservation",
                "question_text": "Let's do a role-play. You are planning a short weekend trip with your family and want to book a hotel room. Call the hotel front desk and ask three or four questions about room types, prices, breakfast, and nearby attractions.",
                "prompt_variants": [],
                "story_tags": [],
            },
            {
                "question_type": "role_play_problem",
                "topic": "Role-Play: Hotel Reservation",
                "question_text": "Unfortunately, when you arrive at the hotel, there is a problem with your room—for example, the air conditioner is not working or they gave you the wrong room type. Talk to the receptionist, explain the problem, and offer two or three solutions.",
                "prompt_variants": [],
                "story_tags": ["Sự cố hỏng máy lạnh"],
            },
            {
                "question_type": "role_play_experience",
                "topic": "Role-Play: Hotel Reservation",
                "question_text": "Have you ever experienced a problem while staying at a hotel or during a trip? Tell me when it happened, what went wrong, and how it turned out in the end.",
                "prompt_variants": [],
                "story_tags": ["Sự cố hỏng máy lạnh"],
            },
        ],
    },
    {
        "id": "rp_shopping_return",
        "group": "role_play",
        "category": "role_play",
        "title_vi": "Mua sắm & Đổi trả hàng",
        "title_en": "Role-Play: Shopping & Returns",
        "default_selected": True,
        "questions": [
            {
                "question_type": "role_play_ask",
                "topic": "Role-Play: Shopping & Returns",
                "question_text": "Imagine you want to buy a new jacket or a pair of shoes at a store. Call the store staff and ask three or four questions about available sizes, colors, prices, and their return policy.",
                "prompt_variants": [],
                "story_tags": [],
            },
            {
                "question_type": "role_play_problem",
                "topic": "Role-Play: Shopping & Returns",
                "question_text": "Later, after bringing the item home, you discover that it has a defect or does not fit properly. Call the store, explain the issue clearly, and suggest two or three alternatives such as an exchange, refund, or store credit.",
                "prompt_variants": [],
                "story_tags": ["Đổi trả hàng lỗi"],
            },
            {
                "question_type": "role_play_experience",
                "topic": "Role-Play: Shopping & Returns",
                "question_text": "Have you ever bought something online or in a store that was damaged or not what you expected? Tell me about that experience and how you handled it.",
                "prompt_variants": [],
                "story_tags": ["Đổi trả hàng lỗi"],
            },
        ],
    },
    {
        "id": "rp_gym_membership",
        "group": "role_play",
        "category": "role_play",
        "title_vi": "Đăng ký phòng Gym / CLB",
        "title_en": "Role-Play: Gym Registration",
        "default_selected": False,
        "questions": [
            {
                "question_type": "role_play_ask",
                "topic": "Role-Play: Gym Registration",
                "question_text": "You want to sign up for a local fitness center or sports club. Call the front desk and ask three or four questions about membership fees, opening hours, trainers, and trial sessions.",
                "prompt_variants": [],
                "story_tags": [],
            },
            {
                "question_type": "role_play_problem",
                "topic": "Role-Play: Gym Registration",
                "question_text": "When you arrive for your scheduled class or trial session, they have no record of your booking and the class is full. Explain the situation politely and suggest two or three alternatives.",
                "prompt_variants": [],
                "story_tags": ["Đổi kế hoạch phút chót"],
            },
            {
                "question_type": "role_play_experience",
                "topic": "Role-Play: Gym Registration",
                "question_text": "Have you ever had a mix-up with a booking, membership, or appointment? Tell me what happened and how it was solved.",
                "prompt_variants": [],
                "story_tags": [],
            },
        ],
    },
    {
        "id": "rp_device_repair",
        "group": "role_play",
        "category": "role_play",
        "title_vi": "Sửa điện thoại / Bảo hành",
        "title_en": "Role-Play: Device Repair",
        "default_selected": False,
        "questions": [
            {
                "question_type": "role_play_ask",
                "topic": "Role-Play: Device Repair",
                "question_text": "Your smartphone or laptop stopped working properly. Call a repair shop and ask three or four questions about repair costs, turnaround time, warranty, and data backup.",
                "prompt_variants": [],
                "story_tags": [],
            },
            {
                "question_type": "role_play_problem",
                "topic": "Role-Play: Device Repair",
                "question_text": "The technician calls back and says the replacement part is out of stock and it will take two weeks, but you urgently need your device for work. Explain your situation and propose two or three solutions.",
                "prompt_variants": [],
                "story_tags": ["Sự cố mất mạng / điện thoại"],
            },
            {
                "question_type": "role_play_experience",
                "topic": "Role-Play: Device Repair",
                "question_text": "Have you ever had a phone, computer, or electronic device break down at the worst possible time? Tell me what happened and how you managed without it.",
                "prompt_variants": [],
                "story_tags": ["Sự cố mất mạng / điện thoại"],
            },
        ],
    },
    {
        "id": "rp_reschedule_friend",
        "group": "role_play",
        "category": "role_play",
        "title_vi": "Mượn đồ bạn & Lỡ làm hỏng",
        "title_en": "Role-Play: Borrowing from a Friend",
        "default_selected": False,
        "questions": [
            {
                "question_type": "role_play_ask",
                "topic": "Role-Play: Borrowing from a Friend",
                "question_text": "You need to borrow a camera, laptop, or suitcase from your close friend for a weekend trip. Call your friend and ask three or four questions about how to use it, when you can pick it up, and when to return it.",
                "prompt_variants": [
                    _v(
                        "Mượn sách / MP3 / đồ dã ngoại",
                        "You want to borrow camping gear or a book from a friend. Call and ask three or four questions about availability and care instructions.",
                        "Hey, I'm preparing for a quick weekend trip and was wondering if I could borrow...",
                    ),
                ],
                "story_tags": ["Khung hỏi 3–4 câu"],
            },
            {
                "question_type": "role_play_problem",
                "topic": "Role-Play: Borrowing from a Friend",
                "question_text": "Unfortunately, you accidentally scratched or broke the item you borrowed. Call your friend, apologize sincerely, explain what happened, and offer two or three ways to make it right.",
                "prompt_variants": [
                    _v(
                        "Làm mất đồ đã mượn",
                        "You realized you misplaced the item you borrowed from your friend. Call, explain honestly, and propose two or three solutions.",
                        "I feel terrible telling you this, but I accidentally misplaced...",
                    ),
                ],
                "story_tags": ["Khung xin lỗi & 2–3 giải pháp"],
            },
            {
                "question_type": "role_play_experience",
                "topic": "Role-Play: Borrowing from a Friend",
                "question_text": "Have you ever lost or damaged something that belonged to someone else—or had someone lose something of yours? Tell me what happened.",
                "prompt_variants": [],
                "story_tags": [],
            },
        ],
    },
    {
        "id": "rp_travel_agency",
        "group": "role_play",
        "category": "role_play",
        "title_vi": "Công ty du lịch & Vé máy bay",
        "title_en": "Role-Play: Travel Agency & Flights",
        "default_selected": False,
        "questions": [
            {
                "question_type": "role_play_ask",
                "topic": "Role-Play: Travel Agency & Flights",
                "question_text": "I'd like to give you a situation to act out. You are planning a vacation and want to book a tour package or flight tickets through a travel agency. Call the travel agent and ask three or four questions about prices, departure dates, included meals or hotels, and cancellation policies.",
                "prompt_variants": [
                    _v(
                        "Hỏi vé máy bay / hành lý",
                        "Call an airline customer center to book a round-trip ticket and ask three or four questions about flight schedules, baggage allowance, and seat selection.",
                        "Hello, I'm planning a trip next month and I'd like to check a few details about flights...",
                    ),
                ],
                "story_tags": ["Khung hỏi 3–4 câu"],
            },
            {
                "question_type": "role_play_problem",
                "topic": "Role-Play: Travel Agency & Flights",
                "question_text": "Now there is an unexpected problem. Due to a sudden work deadline or family matter, you cannot depart on the date you booked—or your flight was delayed/cancelled. Call the travel agency, explain the situation clearly, and suggest two or three alternatives.",
                "prompt_variants": [
                    _v(
                        "Hãng hủy/delay chuyến bay",
                        "Your flight has just been cancelled at the airport. Talk to the airline staff, explain your tight schedule, and ask for two or three alternatives.",
                        "Excuse me, my flight was just cancelled and I really need to arrive by tonight...",
                    ),
                ],
                "story_tags": ["Đổi kế hoạch phút chót", "Khung xin lỗi & 2–3 giải pháp"],
            },
            {
                "question_type": "role_play_experience",
                "topic": "Role-Play: Travel Agency & Flights",
                "question_text": "That's the end of the role-play. Have you ever experienced a flight delay, booking mistake, or sudden change of travel plans? Tell me what happened and how you handled it.",
                "prompt_variants": [],
                "story_tags": ["Chuyến đi biển", "Đổi kế hoạch phút chót"],
            },
        ],
    },
    {
        "id": "rp_car_rental",
        "group": "role_play",
        "category": "role_play",
        "title_vi": "Thuê xe tự lái (Car Rental)",
        "title_en": "Role-Play: Car Rental",
        "default_selected": False,
        "questions": [
            {
                "question_type": "role_play_ask",
                "topic": "Role-Play: Car Rental",
                "question_text": "You are planning a weekend road trip with family or friends and want to rent a car. Call a car rental company and ask three or four questions about available car models, daily rates, insurance coverage, and pick-up or drop-off rules.",
                "prompt_variants": [
                    _v(
                        "Thuê xe đạp / xe máy du lịch",
                        "You want to rent a bike or scooter while on vacation. Call the rental shop and ask three or four questions about hourly rates, helmets, and return times.",
                        "Hi there, I'm visiting this weekend and I'd love to rent a vehicle for two days...",
                    ),
                ],
                "story_tags": ["Khung hỏi 3–4 câu"],
            },
            {
                "question_type": "role_play_problem",
                "topic": "Role-Play: Car Rental",
                "question_text": "Unfortunately, after picking up the rental car, you discover a problem—such as a flat tire, broken air conditioner, or a strange engine noise—or they gave you a car that is too small. Call the rental company, explain the problem, and offer two or three solutions.",
                "prompt_variants": [],
                "story_tags": ["Sự cố hỏng máy lạnh", "Khung xin lỗi & 2–3 giải pháp"],
            },
            {
                "question_type": "role_play_experience",
                "topic": "Role-Play: Car Rental",
                "question_text": "Have you ever experienced a vehicle breakdown, flat tire, or rental problem while traveling? Tell me when it happened, what went wrong, and how it turned out.",
                "prompt_variants": [],
                "story_tags": ["Chuyến đi biển"],
            },
        ],
    },
    {
        "id": "rp_concert_show",
        "group": "role_play",
        "category": "role_play",
        "title_vi": "Đặt vé Concert & Sự cố vé",
        "title_en": "Role-Play: Concert & Live Show",
        "default_selected": False,
        "questions": [
            {
                "question_type": "role_play_ask",
                "topic": "Role-Play: Concert & Live Show",
                "question_text": "Your favorite singer or band is holding a concert in your city. Call the ticket box office and ask three or four questions about ticket prices, seat views, show duration, and parking or public transit options.",
                "prompt_variants": [
                    _v(
                        "Gọi rủ bạn đi xem ca nhạc",
                        "You want to invite your friend to a live music concert this weekend. Call and ask three or four questions to coordinate seats, time, and dinner.",
                        "Hey, my favorite artist is performing this Saturday and I wanted to check if you're free...",
                    ),
                ],
                "story_tags": ["Khung hỏi 3–4 câu"],
            },
            {
                "question_type": "role_play_problem",
                "topic": "Role-Play: Concert & Live Show",
                "question_text": "When you arrive at the concert hall (or check your tickets), there is a problem—for example, you booked the wrong date, lost your ticket, or your seat is double-booked. Talk to the box office staff, explain the situation, and propose two or three alternatives.",
                "prompt_variants": [],
                "story_tags": ["Đổi kế hoạch phút chót", "Khung xin lỗi & 2–3 giải pháp"],
            },
            {
                "question_type": "role_play_experience",
                "topic": "Role-Play: Concert & Live Show",
                "question_text": "Have you ever had an unexpected problem with tickets, seating, or schedules at a concert, movie, or public event? Tell me what happened and how you solved it.",
                "prompt_variants": [],
                "story_tags": ["Đổi kế hoạch phút chót"],
            },
        ],
    },
    {
        "id": "rp_doctor_clinic",
        "group": "role_play",
        "category": "role_play",
        "title_vi": "Đặt & Đổi lịch khám bệnh",
        "title_en": "Role-Play: Doctor Appointment",
        "default_selected": False,
        "questions": [
            {
                "question_type": "role_play_ask",
                "topic": "Role-Play: Doctor Appointment",
                "question_text": "You have not been feeling well and want to book an appointment at a local clinic or hospital. Call the reception desk and ask three or four questions about available time slots, consultation fees, health insurance, and what to bring.",
                "prompt_variants": [],
                "story_tags": ["Khung hỏi 3–4 câu"],
            },
            {
                "question_type": "role_play_problem",
                "topic": "Role-Play: Doctor Appointment",
                "question_text": "Unfortunately, an urgent meeting came up at work (or you are stuck in heavy traffic) and you cannot make your scheduled doctor appointment on time. Call the clinic, apologize, explain the reason, and suggest two or three alternatives.",
                "prompt_variants": [],
                "story_tags": ["Đổi kế hoạch phút chót", "Khung xin lỗi & 2–3 giải pháp"],
            },
            {
                "question_type": "role_play_experience",
                "topic": "Role-Play: Doctor Appointment",
                "question_text": "Have you ever had to cancel or reschedule a doctor visit or an important appointment at the last minute? Tell me what happened and how it worked out.",
                "prompt_variants": [],
                "story_tags": ["Đổi kế hoạch phút chót"],
            },
        ],
    },
    {
        "id": "rp_house_party",
        "group": "role_play",
        "category": "role_play",
        "title_vi": "Tiệc tại nhà & Đi trễ hẹn",
        "title_en": "Role-Play: House Party & Gathering",
        "default_selected": False,
        "questions": [
            {
                "question_type": "role_play_ask",
                "topic": "Role-Play: House Party & Gathering",
                "question_text": "Your close friend invited you to a housewarming or birthday party at their home this weekend. Call your friend and ask three or four questions about what time to arrive, what food or gift to bring, parking, and who else is coming.",
                "prompt_variants": [],
                "story_tags": ["Khung hỏi 3–4 câu"],
            },
            {
                "question_type": "role_play_problem",
                "topic": "Role-Play: House Party & Gathering",
                "question_text": "On the day of the party, something unexpected happens—for example, you are stuck in terrible traffic, got lost, or realized you forgot the cake or dish you promised to bring. Call your friend, explain the problem, and offer two or three solutions.",
                "prompt_variants": [],
                "story_tags": ["Đổi kế hoạch phút chót", "Cơn mưa bất ngờ ngoài trời"],
            },
            {
                "question_type": "role_play_experience",
                "topic": "Role-Play: House Party & Gathering",
                "question_text": "Have you ever been very late to a party or gathering, or forgotten something important you were supposed to bring? Tell me what happened and how everyone reacted.",
                "prompt_variants": [],
                "story_tags": ["Đổi kế hoạch phút chót"],
            },
        ],
    },
    {
        "id": "rp_bank_card",
        "group": "role_play",
        "category": "role_play",
        "title_vi": "Ngân hàng & Mất thẻ tín dụng",
        "title_en": "Role-Play: Bank & Lost Card",
        "default_selected": False,
        "questions": [
            {
                "question_type": "role_play_ask",
                "topic": "Role-Play: Bank & Lost Card",
                "question_text": "You want to open a new savings account or apply for a credit card before an upcoming trip. Call a bank representative and ask three or four questions about required documents, annual fees, interest rates, and mobile banking features.",
                "prompt_variants": [],
                "story_tags": ["Khung hỏi 3–4 câu"],
            },
            {
                "question_type": "role_play_problem",
                "topic": "Role-Play: Bank & Lost Card",
                "question_text": "Suddenly you realize your credit or debit card is missing—or you see a strange charge on your account. Call the bank's customer hotline immediately, explain the problem, and ask for two or three options to protect your money and get a replacement.",
                "prompt_variants": [],
                "story_tags": ["Khung xin lỗi & 2–3 giải pháp"],
            },
            {
                "question_type": "role_play_experience",
                "topic": "Role-Play: Bank & Lost Card",
                "question_text": "Have you ever lost your wallet, bank card, or faced an unexpected payment issue while shopping or traveling? Tell me what happened and how you fixed it.",
                "prompt_variants": [],
                "story_tags": [],
            },
        ],
    },
    {
        "id": "rp_furniture_appliance",
        "group": "role_play",
        "category": "role_play",
        "title_vi": "Mua nội thất / Đồ điện & Giao lỗi",
        "title_en": "Role-Play: Furniture & Appliance Delivery",
        "default_selected": False,
        "questions": [
            {
                "question_type": "role_play_ask",
                "topic": "Role-Play: Furniture & Appliance Delivery",
                "question_text": "You want to buy a new sofa, desk, or washing machine for your home. Call the store and ask three or four questions about sizes, delivery fees, installation service, and warranty.",
                "prompt_variants": [],
                "story_tags": ["Khung hỏi 3–4 câu", "Không gian sống cá nhân"],
            },
            {
                "question_type": "role_play_problem",
                "topic": "Role-Play: Furniture & Appliance Delivery",
                "question_text": "When the item is delivered to your home, you discover it is damaged, the wrong color, or does not work properly. Call customer service, explain the issue clearly, and suggest two or three solutions such as a free exchange, technician visit, or full refund.",
                "prompt_variants": [],
                "story_tags": ["Đổi trả hàng lỗi", "Sự cố hỏng máy lạnh"],
            },
            {
                "question_type": "role_play_experience",
                "topic": "Role-Play: Furniture & Appliance Delivery",
                "question_text": "Have you ever had a problem with a home delivery or a newly bought appliance/furniture item? Tell me what went wrong and how it was resolved.",
                "prompt_variants": [],
                "story_tags": ["Đổi trả hàng lỗi", "Sự cố hỏng máy lạnh"],
            },
        ],
    },
    {
        "id": "rp_pet_house_sitting",
        "group": "role_play",
        "category": "role_play",
        "title_vi": "Nhờ bạn trông nhà / Thú cưng",
        "title_en": "Role-Play: House & Pet Sitting",
        "default_selected": False,
        "questions": [
            {
                "question_type": "role_play_ask",
                "topic": "Role-Play: House & Pet Sitting",
                "question_text": "You are going away on vacation for a few days and your friend or neighbor agreed to look after your home, plants, or pet. Call them and ask three or four questions about their schedule, spare key handoff, and any supplies they need.",
                "prompt_variants": [],
                "story_tags": ["Khung hỏi 3–4 câu", "Không gian sống cá nhân"],
            },
            {
                "question_type": "role_play_problem",
                "topic": "Role-Play: House & Pet Sitting",
                "question_text": "While you are away, your friend calls and says an unexpected problem came up—for example, they got called away on a business trip, or there is a small leak/issue at your house. Stay calm, discuss the situation, and propose two or three backup solutions.",
                "prompt_variants": [],
                "story_tags": ["Khung xin lỗi & 2–3 giải pháp"],
            },
            {
                "question_type": "role_play_experience",
                "topic": "Role-Play: House & Pet Sitting",
                "question_text": "Have you ever asked a friend or neighbor for an urgent favor—or stepped in to help someone else with an unexpected problem at home? Tell me about that time.",
                "prompt_variants": [],
                "story_tags": [],
            },
        ],
    },
    {
        "id": "rp_library_course",
        "group": "role_play",
        "category": "role_play",
        "title_vi": "Thư viện & Khóa học cộng đồng",
        "title_en": "Role-Play: Library & Community Class",
        "default_selected": False,
        "questions": [
            {
                "question_type": "role_play_ask",
                "topic": "Role-Play: Library & Community Class",
                "question_text": "You want to use your local library's study rooms or sign up for a weekend hobby class at a community center. Call the front desk and ask three or four questions about membership cards, opening hours, seat reservations, or registration fees.",
                "prompt_variants": [],
                "story_tags": ["Khung hỏi 3–4 câu"],
            },
            {
                "question_type": "role_play_problem",
                "topic": "Role-Play: Library & Community Class",
                "question_text": "Unfortunately, you accidentally spilled coffee on a library book you borrowed (or realized you cannot attend the class time you signed up for). Call the staff, explain honestly, and offer two or three solutions.",
                "prompt_variants": [],
                "story_tags": ["Khung xin lỗi & 2–3 giải pháp"],
            },
            {
                "question_type": "role_play_experience",
                "topic": "Role-Play: Library & Community Class",
                "question_text": "Have you ever damaged a borrowed book, missed a return deadline, or had to switch a class schedule? Tell me what happened and how you handled it.",
                "prompt_variants": [],
                "story_tags": [],
            },
        ],
    },
    {
        "id": "rp_dentist",
        "group": "role_play",
        "category": "role_play",
        "title_vi": "Đặt lịch nha sĩ / Đau răng",
        "title_en": "Role-Play: Dentist Appointment",
        "default_selected": False,
        "questions": [
            {
                "question_type": "role_play_ask",
                "topic": "Role-Play: Dentist Appointment",
                "question_text": "You suddenly have a bad toothache and want to book a dental appointment. Call a nearby dental clinic and ask three or four questions about available slots, check-up fees, insurance coverage, and parking.",
                "prompt_variants": [],
                "story_tags": ["Khung hỏi 3–4 câu"],
            },
            {
                "question_type": "role_play_problem",
                "topic": "Role-Play: Dentist Appointment",
                "question_text": "When you call back, the clinic says your dentist is away at a conference and has to move your appointment, or you realize you must reschedule due to work. Explain the situation and suggest two or three alternatives.",
                "prompt_variants": [],
                "story_tags": ["Đổi kế hoạch phút chót", "Khung xin lỗi & 2–3 giải pháp"],
            },
            {
                "question_type": "role_play_experience",
                "topic": "Role-Play: Dentist Appointment",
                "question_text": "Tell me about a memorable visit to a dentist or hospital when something unexpected happened. How did you feel and how did it turn out?",
                "prompt_variants": [],
                "story_tags": [],
            },
        ],
    },
    {
        "id": "rp_hair_salon",
        "group": "role_play",
        "category": "role_play",
        "title_vi": "Đặt lịch cắt tóc / Salon",
        "title_en": "Role-Play: Hair Salon Booking",
        "default_selected": False,
        "questions": [
            {
                "question_type": "role_play_ask",
                "topic": "Role-Play: Hair Salon Booking",
                "question_text": "You want to try a new hair salon before a special event this weekend. Call the salon and ask three or four questions about haircut or styling prices, available stylists, weekend hours, and how long it takes.",
                "prompt_variants": [],
                "story_tags": ["Khung hỏi 3–4 câu"],
            },
            {
                "question_type": "role_play_problem",
                "topic": "Role-Play: Hair Salon Booking",
                "question_text": "When you arrive at the salon (or after the haircut), there is a problem—your favorite stylist called in sick, the wait is over an hour, or the style is not what you asked for. Talk to the manager politely and suggest two or three alternatives.",
                "prompt_variants": [],
                "story_tags": ["Khung xin lỗi & 2–3 giải pháp"],
            },
            {
                "question_type": "role_play_experience",
                "topic": "Role-Play: Hair Salon Booking",
                "question_text": "Have you ever had a bad haircut or an unexpected wait at a salon or barbershop? Tell me what happened and how you reacted.",
                "prompt_variants": [],
                "story_tags": [],
            },
        ],
    },
    {
        "id": "rp_apartment_rental",
        "group": "role_play",
        "category": "role_play",
        "title_vi": "Thuê căn hộ & Hỏi nhà trọ",
        "title_en": "Role-Play: Apartment Rental",
        "default_selected": False,
        "questions": [
            {
                "question_type": "role_play_ask",
                "topic": "Role-Play: Apartment Rental",
                "question_text": "You saw a listing for an apartment for rent near your workplace. Call the landlord or real estate agent and ask three or four questions about monthly rent, deposit, included utilities, parking, and when you can visit.",
                "prompt_variants": [
                    _v(
                        "Thuê dịch vụ chuyển nhà",
                        "You are moving to a new apartment next month. Call a moving company and ask three or four questions about truck size, packing boxes, pricing, and insurance.",
                        "Hello, I'm moving to a new apartment next month and would like to ask about your moving packages...",
                    ),
                ],
                "story_tags": ["Khung hỏi 3–4 câu", "Không gian sống cá nhân"],
            },
            {
                "question_type": "role_play_problem",
                "topic": "Role-Play: Apartment Rental",
                "question_text": "Shortly after moving into the apartment, you notice a problem—such as a leaking pipe, noisy neighbors, or a broken heater/AC. Call the landlord, explain the issue clearly, and offer two or three solutions.",
                "prompt_variants": [],
                "story_tags": ["Sự cố hỏng máy lạnh", "Khung xin lỗi & 2–3 giải pháp"],
            },
            {
                "question_type": "role_play_experience",
                "topic": "Role-Play: Apartment Rental",
                "question_text": "Have you ever moved to a new house or dealt with a sudden repair issue at home? Tell me what happened and how it was solved.",
                "prompt_variants": [],
                "story_tags": ["Sự cố hỏng máy lạnh"],
            },
        ],
    },
    {
        "id": "rp_internet_plan",
        "group": "role_play",
        "category": "role_play",
        "title_vi": "Lắp mạng Internet & Lỗi Wi-Fi",
        "title_en": "Role-Play: Internet Service Provider",
        "default_selected": False,
        "questions": [
            {
                "question_type": "role_play_ask",
                "topic": "Role-Play: Internet Service Provider",
                "question_text": "You want to install a faster home Wi-Fi plan for remote work and streaming. Call an internet service provider and ask three or four questions about speeds, monthly fees, router equipment, and installation dates.",
                "prompt_variants": [],
                "story_tags": ["Khung hỏi 3–4 câu"],
            },
            {
                "question_type": "role_play_problem",
                "topic": "Role-Play: Internet Service Provider",
                "question_text": "Suddenly your home internet completely stops working right before an important online meeting, and customer support says a technician cannot come for three days. Explain the urgency and suggest two or three solutions.",
                "prompt_variants": [],
                "story_tags": ["Sự cố mất mạng / điện thoại", "Khung xin lỗi & 2–3 giải pháp"],
            },
            {
                "question_type": "role_play_experience",
                "topic": "Role-Play: Internet Service Provider",
                "question_text": "Have you ever experienced a serious internet outage or tech failure right when you needed to get something done? Tell me what happened and how you fixed it.",
                "prompt_variants": [],
                "story_tags": ["Sự cố mất mạng / điện thoại"],
            },
        ],
    },
    {
        "id": "rp_post_office",
        "group": "role_play",
        "category": "role_play",
        "title_vi": "Gửi bưu kiện & Giao hàng trễ",
        "title_en": "Role-Play: Post Office & Delivery",
        "default_selected": False,
        "questions": [
            {
                "question_type": "role_play_ask",
                "topic": "Role-Play: Post Office & Delivery",
                "question_text": "You want to ship a birthday gift or important package to another city or overseas. Call a post office or courier service and ask three or four questions about shipping fees, delivery time, fragile packaging, and tracking.",
                "prompt_variants": [],
                "story_tags": ["Khung hỏi 3–4 câu"],
            },
            {
                "question_type": "role_play_problem",
                "topic": "Role-Play: Post Office & Delivery",
                "question_text": "A week later, your package still has not arrived (or arrived damaged/delivered to the wrong address). Call customer service, explain the situation, and propose two or three solutions.",
                "prompt_variants": [],
                "story_tags": ["Đổi trả hàng lỗi", "Khung xin lỗi & 2–3 giải pháp"],
            },
            {
                "question_type": "role_play_experience",
                "topic": "Role-Play: Post Office & Delivery",
                "question_text": "Have you ever had a package delayed, lost, or damaged in shipping? Tell me what was inside, what went wrong, and how it turned out.",
                "prompt_variants": [],
                "story_tags": ["Đổi trả hàng lỗi"],
            },
        ],
    },

    # --- GROUP 5: Chủ đề Đột xuất (unexpected) ---
    {
        "id": "unexp_weather",
        "group": "unexpected",
        "category": "unexpected",
        "title_vi": "Thời tiết & Các mùa",
        "title_en": "Weather & Seasons",
        "default_selected": True,
        "questions": [
            {
                "question_type": "description",
                "topic": "Weather & Seasons",
                "question_text": "Let's talk about the weather in your country. What are the different seasons like where you live, and which season do you enjoy the most?",
                "prompt_variants": [],
                "story_tags": [],
            },
            {
                "question_type": "routine",
                "topic": "Weather & Seasons",
                "question_text": "What kinds of activities do you usually do when the weather is nice, and what do you do instead on rainy or very hot days?",
                "prompt_variants": [],
                "story_tags": [],
            },
            {
                "question_type": "past_experience",
                "topic": "Weather & Seasons",
                "question_text": "Tell me about a time when unexpected bad weather, such as heavy rain or a storm, affected your plans. What happened and what did you do?",
                "prompt_variants": [],
                "story_tags": ["Cơn mưa bất ngờ ngoài trời"],
            },
        ],
    },
    {
        "id": "unexp_neighborhood",
        "group": "unexpected",
        "category": "unexpected",
        "title_vi": "Hàng xóm & Khu phố",
        "title_en": "Neighborhoods & Neighbors",
        "default_selected": True,
        "questions": [
            {
                "question_type": "description",
                "topic": "Neighborhoods & Neighbors",
                "question_text": "Describe the neighborhood where you currently live. What places are nearby, what is the atmosphere like, and what do you like or dislike about it?",
                "prompt_variants": [],
                "story_tags": ["Không gian sống cá nhân"],
            },
            {
                "question_type": "routine",
                "topic": "Neighborhoods & Neighbors",
                "question_text": "Tell me about your neighbors. Do you see or talk to them often, and how do people in your neighborhood usually interact with each other?",
                "prompt_variants": [],
                "story_tags": [],
            },
            {
                "question_type": "comparison",
                "topic": "Neighborhoods & Neighbors",
                "question_text": "How has your neighborhood changed over the past few years? Compare what it looked like in the past with how it is today.",
                "prompt_variants": [],
                "story_tags": [],
            },
        ],
    },
    {
        "id": "unexp_phone_shopping",
        "group": "unexpected",
        "category": "unexpected",
        "title_vi": "Điện thoại & Mua sắm online",
        "title_en": "Mobile Phones & Online Shopping",
        "default_selected": True,
        "questions": [
            {
                "question_type": "description",
                "topic": "Mobile Phones & Online Shopping",
                "question_text": "Let's talk about smartphones and technology. What kind of phone do you use, and what apps or features do you use the most every day?",
                "prompt_variants": [],
                "story_tags": ["Thói quen dùng điện thoại"],
            },
            {
                "question_type": "routine",
                "topic": "Mobile Phones & Online Shopping",
                "question_text": "Do you often shop online using your phone? Tell me what kinds of things you usually buy online and why you prefer it over going to physical stores.",
                "prompt_variants": [],
                "story_tags": ["Thói quen dùng điện thoại"],
            },
            {
                "question_type": "past_experience",
                "topic": "Mobile Phones & Online Shopping",
                "question_text": "Tell me about a problem you once had with your smartphone, the internet, or an online order. What went wrong and how did you solve it?",
                "prompt_variants": [],
                "story_tags": ["Đổi trả hàng lỗi", "Sự cố mất mạng / điện thoại"],
            },
        ],
    },
    {
        "id": "unexp_health",
        "group": "unexpected",
        "category": "unexpected",
        "title_vi": "Sức khỏe & Khám bệnh",
        "title_en": "Staying Healthy",
        "default_selected": True,
        "questions": [
            {
                "question_type": "routine",
                "topic": "Staying Healthy",
                "question_text": "Health is very important to many people today. What do you usually do in your daily life to stay healthy, such as your diet, sleep, or exercise habits?",
                "prompt_variants": [],
                "story_tags": [],
            },
            {
                "question_type": "past_experience",
                "topic": "Staying Healthy",
                "question_text": "Tell me about a time when you felt sick or had to visit a doctor or pharmacy. What symptoms did you have and how did you recover?",
                "prompt_variants": [],
                "story_tags": [],
            },
        ],
    },
    {
        "id": "unexp_transport",
        "group": "unexpected",
        "category": "unexpected",
        "title_vi": "Giao thông công cộng",
        "title_en": "Public Transportation",
        "default_selected": False,
        "questions": [
            {
                "question_type": "description",
                "topic": "Public Transportation",
                "question_text": "Describe the public transportation system in your city, such as buses, trains, or ride-hailing apps. What do you like or dislike about it?",
                "prompt_variants": [],
                "story_tags": [],
            },
            {
                "question_type": "routine",
                "topic": "Public Transportation",
                "question_text": "How do you usually get around your city every day? Walk me through your normal commute.",
                "prompt_variants": [],
                "story_tags": [],
            },
            {
                "question_type": "past_experience",
                "topic": "Public Transportation",
                "question_text": "Tell me about a frustrating or memorable experience you had while using public transportation or stuck in heavy traffic.",
                "prompt_variants": [],
                "story_tags": ["Cơn mưa bất ngờ ngoài trời"],
            },
        ],
    },
    {
        "id": "unexp_restaurants",
        "group": "unexpected",
        "category": "unexpected",
        "title_vi": "Nhà hàng & Ăn ngoài",
        "title_en": "Restaurants & Dining Out",
        "default_selected": False,
        "questions": [
            {
                "question_type": "description",
                "topic": "Restaurants & Dining Out",
                "question_text": "Describe your favorite restaurant. Where is it, what kind of food does it serve, and what is the atmosphere like?",
                "prompt_variants": [],
                "story_tags": [],
            },
            {
                "question_type": "routine",
                "topic": "Restaurants & Dining Out",
                "question_text": "How often do you eat out, who do you usually go with, and how do you decide which restaurant to choose?",
                "prompt_variants": [],
                "story_tags": [],
            },
            {
                "question_type": "past_experience",
                "topic": "Restaurants & Dining Out",
                "question_text": "Tell me about a memorable meal you had at a restaurant—either a wonderful celebration or a time the service went wrong.",
                "prompt_variants": [],
                "story_tags": [],
            },
        ],
    },
    {
        "id": "unexp_holidays",
        "group": "unexpected",
        "category": "unexpected",
        "title_vi": "Ngày lễ & Lễ hội",
        "title_en": "Holidays & Festivals",
        "default_selected": False,
        "questions": [
            {
                "question_type": "description",
                "topic": "Holidays & Festivals",
                "question_text": "What is the biggest or most important holiday in your country? Describe how people prepare for it and what makes it special.",
                "prompt_variants": [],
                "story_tags": ["Ngày lễ gia đình"],
            },
            {
                "question_type": "past_experience",
                "topic": "Holidays & Festivals",
                "question_text": "Tell me about a holiday celebration you still remember vividly from your childhood or recent years.",
                "prompt_variants": [],
                "story_tags": ["Ngày lễ gia đình"],
            },
        ],
    },
    {
        "id": "unexp_recycling",
        "group": "unexpected",
        "category": "unexpected",
        "title_vi": "Tái chế & Sống xanh",
        "title_en": "Recycling & Green Living",
        "default_selected": False,
        "questions": [
            {
                "question_type": "routine",
                "topic": "Recycling & Green Living",
                "question_text": "How do people recycle or sort trash in your neighborhood or home? What rules or habits do you follow?",
                "prompt_variants": [
                    _v(
                        "Quy trình phân loại rác ở Việt Nam",
                        "Explain step by step how you separate paper, plastic, glass, and food waste at home.",
                        "At my home, we try to separate recyclables into simple bins—...",
                    ),
                ],
                "story_tags": ["Bảo vệ môi trường"],
            },
            {
                "question_type": "past_experience",
                "topic": "Recycling & Green Living",
                "question_text": "Tell me about a time you noticed a recycling problem, had to dispose of a large item like old furniture, or made an effort to reduce waste.",
                "prompt_variants": [],
                "story_tags": ["Bảo vệ môi trường"],
            },
        ],
    },
    {
        "id": "unexp_bank",
        "group": "unexpected",
        "category": "unexpected",
        "title_vi": "Ngân hàng & Thanh toán số",
        "title_en": "Banks & Mobile Banking",
        "default_selected": False,
        "questions": [
            {
                "question_type": "description",
                "topic": "Banks & Mobile Banking",
                "question_text": "Describe a bank branch you visit or the banking apps you use in your country. What does the bank look like inside and what services does it offer?",
                "prompt_variants": [],
                "story_tags": ["Thói quen dùng điện thoại"],
            },
            {
                "question_type": "comparison",
                "topic": "Banks & Mobile Banking",
                "question_text": "How has the way people handle banking and daily payments changed compared to the past? Compare visiting bank branches with using mobile banking apps.",
                "prompt_variants": [],
                "story_tags": ["Thói quen dùng điện thoại"],
            },
            {
                "question_type": "past_experience",
                "topic": "Banks & Mobile Banking",
                "question_text": "Tell me about a memorable or frustrating experience you had at a bank, an ATM, or while making an online transfer.",
                "prompt_variants": [],
                "story_tags": [],
            },
        ],
    },
    {
        "id": "unexp_library",
        "group": "unexpected",
        "category": "unexpected",
        "title_vi": "Thư viện & Đọc sách",
        "title_en": "Libraries & Reading",
        "default_selected": False,
        "questions": [
            {
                "question_type": "description",
                "topic": "Libraries & Reading",
                "question_text": "Describe a library you have visited. What does it look like inside, what sections does it have, and what rules do visitors follow?",
                "prompt_variants": [],
                "story_tags": [],
            },
            {
                "question_type": "comparison",
                "topic": "Libraries & Reading",
                "question_text": "How have libraries—and your own reading habits—changed compared to when you were a child?",
                "prompt_variants": [],
                "story_tags": [],
            },
        ],
    },
    {
        "id": "unexp_appointments",
        "group": "unexpected",
        "category": "unexpected",
        "title_vi": "Lịch hẹn & Quản lý thời gian",
        "title_en": "Appointments & Schedules",
        "default_selected": False,
        "questions": [
            {
                "question_type": "routine",
                "topic": "Appointments & Schedules",
                "question_text": "How do you usually make plans and keep track of appointments with friends, family, or coworkers? What tools or apps do you use?",
                "prompt_variants": [],
                "story_tags": ["Thói quen dùng điện thoại"],
            },
            {
                "question_type": "past_experience",
                "topic": "Appointments & Schedules",
                "question_text": "Tell me about a time you forgot an appointment, arrived very late, or had to change plans suddenly. What happened?",
                "prompt_variants": [],
                "story_tags": ["Đổi kế hoạch phút chót"],
            },
        ],
    },
    {
        "id": "unexp_fashion_shopping",
        "group": "unexpected",
        "category": "unexpected",
        "title_vi": "Thời trang & Mua sắm quần áo",
        "title_en": "Fashion & Shopping",
        "default_selected": False,
        "questions": [
            {
                "question_type": "description",
                "topic": "Fashion & Shopping",
                "question_text": "What kind of clothes or style do you usually like to wear on weekdays and weekends? Describe your favorite outfit or clothing store.",
                "prompt_variants": [],
                "story_tags": [],
            },
            {
                "question_type": "past_experience",
                "topic": "Fashion & Shopping",
                "question_text": "Tell me about a memorable shopping experience—such as finding a great bargain or buying clothes that didn't fit as expected.",
                "prompt_variants": [],
                "story_tags": ["Đổi trả hàng lỗi"],
            },
        ],
    },
    {
        "id": "unexp_furniture_tech",
        "group": "unexpected",
        "category": "unexpected",
        "title_vi": "Đồ gia dụng & Công nghệ gia đình",
        "title_en": "Home Appliances & Tech",
        "default_selected": False,
        "questions": [
            {
                "question_type": "description",
                "topic": "Home Appliances & Tech",
                "question_text": "What home appliances or electronic devices do you rely on most in your house, and how do they make your daily life easier?",
                "prompt_variants": [],
                "story_tags": ["Không gian sống cá nhân"],
            },
            {
                "question_type": "past_experience",
                "topic": "Home Appliances & Tech",
                "question_text": "Tell me about a time an important home appliance—like a fridge, washing machine, or air conditioner—stopped working unexpectedly. How did you handle it?",
                "prompt_variants": [],
                "story_tags": ["Sự cố hỏng máy lạnh"],
            },
        ],
    },
]

CATALOG_BY_ID: Dict[str, Dict[str, Any]] = {item["id"]: item for item in TOPIC_CATALOG_ITEMS}

CATALOG_GROUPS_META = [
    {"key": "home", "label": "Nền tảng"},
    {"key": "leisure", "label": "Sở thích"},
    {"key": "official", "label": "Chủ đề chính"},
    {"key": "role_play", "label": "Role-play"},
    {"key": "unexpected", "label": "Đột xuất"},
]


def get_topic_catalog(existing_canonical_keys: Optional[Set[str]] = None) -> Dict[str, Any]:
    """Returns the full selectable topic catalog with ownership flags based on existing canonical keys."""
    existing = existing_canonical_keys or set()
    items = []
    for item in TOPIC_CATALOG_ITEMS:
        slot_keys = [
            make_canonical_key(item["category"], item["id"], q["question_type"])
            for q in item["questions"]
        ]
        owned = bool(slot_keys) and all(k in existing for k in slot_keys)
        items.append({
            "id": item["id"],
            "group": item["group"],
            "category": item["category"],
            "title_vi": item["title_vi"],
            "title_en": item["title_en"],
            "slot_count": len(item["questions"]),
            "default_selected": item["default_selected"],
            "owned": owned,
        })
    return {"groups": CATALOG_GROUPS_META, "topics": items}


def _build_dynamic_topic_specs(label: str, category: str = "custom", diff: str = "IM") -> List[Dict[str, Any]]:
    clean = label.strip()
    title = clean if any(ch.isupper() for ch in clean) else clean.title()
    slug = slugify_topic(clean)
    return [
        {
            "question_type": "description",
            "topic": title,
            "category": category,
            "canonical_key": make_canonical_key(category, slug, "description"),
            "difficulty": diff,
            "question_text": f"Let's talk about {clean}. Tell me more about it—what is it like, what do you enjoy most about {clean}, and why is it important to you?",
            "prompt_variants": [
                _v(
                    "Miêu tả chi tiết hơn",
                    f"Describe your favorite aspect or detail related to {clean}.",
                    f"What I appreciate most about {clean} is...",
                )
            ],
            "story_tags": [],
        },
        {
            "question_type": "routine",
            "topic": title,
            "category": category,
            "canonical_key": make_canonical_key(category, slug, "routine"),
            "difficulty": diff,
            "question_text": f"How often do you deal with or enjoy {clean}? Walk me through your usual routine from start to finish and who is usually involved.",
            "prompt_variants": [],
            "story_tags": [],
        },
        {
            "question_type": "past_experience",
            "topic": title,
            "category": category,
            "canonical_key": make_canonical_key(category, slug, "past_experience"),
            "difficulty": diff,
            "question_text": f"Tell me about a memorable or unexpected experience you had related to {clean}. When did it happen, what went on, and how did you feel?",
            "prompt_variants": [],
            "story_tags": [],
        },
    ]


def build_curriculum_questions(
    topic_ids: Optional[List[str]] = None,
    custom_topics: Optional[List[str]] = None,
    target_level: str = "IM",
) -> List[Dict[str, Any]]:
    """
    Builds an unlimited, deduplicated list of Master Slot specs for ANY combination of catalog topics
    and custom learner-entered topics.
    """
    diff = target_level if target_level in ("IL", "IM", "IH") else "IM"
    selected_ids = list(dict.fromkeys(t.strip() for t in (topic_ids or []) if str(t).strip()))
    if not selected_ids and not custom_topics:
        selected_ids = [item["id"] for item in TOPIC_CATALOG_ITEMS if item["default_selected"]]

    specs: List[Dict[str, Any]] = []
    seen_keys: Set[str] = set()

    for tid in selected_ids:
        cat_item = CATALOG_BY_ID.get(tid)
        if cat_item:
            for q in cat_item["questions"]:
                ckey = make_canonical_key(cat_item["category"], cat_item["id"], q["question_type"])
                if ckey in seen_keys:
                    continue
                seen_keys.add(ckey)
                specs.append({
                    "question_text": q["question_text"],
                    "question_type": q["question_type"],
                    "topic": q["topic"],
                    "category": cat_item["category"],
                    "canonical_key": ckey,
                    "prompt_variants": q.get("prompt_variants") or [],
                    "story_tags": q.get("story_tags") or [],
                    "difficulty": diff,
                })
        else:
            # Treat unknown survey leisure string gracefully as a dynamic 3-slot leisure combo
            for q in _build_dynamic_topic_specs(tid, category="leisure", diff=diff):
                if q["canonical_key"] in seen_keys:
                    continue
                seen_keys.add(q["canonical_key"])
                specs.append(q)

    for raw_custom in (custom_topics or []):
        clean = str(raw_custom or "").strip()
        if not clean:
            continue
        for q in _build_dynamic_topic_specs(clean, category="custom", diff=diff):
            if q["canonical_key"] in seen_keys:
                continue
            seen_keys.add(q["canonical_key"])
            specs.append(q)

    result: List[Dict[str, Any]] = []
    for idx, q in enumerate(specs, start=1):
        guide = DEFAULT_GUIDES_BY_TYPE.get(q["question_type"], DEFAULT_GUIDES_BY_TYPE["description"])
        result.append({
            **q,
            "order_index": idx,
            "vietnamese_guide": guide,
        })
    return result


def build_50_study_questions(
    chosen_topics: Optional[List[str]] = None,
    survey_data: Optional[Dict[str, Any]] = None,
    target_level: str = "IM",
) -> List[Dict[str, Any]]:
    """
    Backwards-compatible 50-question preset wrapper around `build_curriculum_questions`.
    """
    valid_topics = [t for t in (chosen_topics or []) if t in OFFICIAL_TOPICS]
    for fallback_t in DEFAULT_TOPICS:
        if len(valid_topics) >= 3:
            break
        if fallback_t not in valid_topics:
            valid_topics.append(fallback_t)
    valid_topics = valid_topics[:3]

    survey = survey_data or {}
    picked_leisure: List[str] = []
    for field in ("activities", "hobbies", "sports"):
        for val in survey.get(field) or []:
            low = str(val).strip().lower()
            if low and low not in picked_leisure:
                picked_leisure.append(low)
    for k in ("go to the movies", "go to parks", "listen to music", "cook", "walk"):
        if len(picked_leisure) >= 5:
            break
        if k not in picked_leisure:
            picked_leisure.append(k)
    picked_leisure = picked_leisure[:5]

    topic_ids = (
        ["home_living", "staycation"]
        + picked_leisure
        + valid_topics
        + ["rp_movie_dinner", "rp_hotel", "rp_shopping_return"]
        + ["unexp_weather", "unexp_neighborhood", "unexp_phone_shopping", "unexp_health"]
    )
    return build_curriculum_questions(topic_ids=topic_ids, target_level=target_level)


def get_or_create_master_pack(
    db: Session,
    user_id: int,
    target_level: str = "IM",
    chosen_topics: Optional[List[str]] = None,
    survey_data: Optional[Dict[str, Any]] = None,
    personal_profile: str = "",
    dev_mock: bool = False,
) -> TestSession:
    """
    Returns the learner's single unified Master Study Pack (`mode='study'`).
    If multiple legacy study packs exist, consolidates unique slots into the newest one while
    preserving mastered/SRS progress and model answers so nothing is duplicated or lost.
    """
    study_sessions = (
        db.query(TestSession)
        .filter(TestSession.user_id == user_id, TestSession.mode == "study")
        .order_by(TestSession.id.asc())
        .all()
    )

    if not study_sessions:
        next_id = int(db.query(func.max(TestSession.id)).scalar() or 0) + 1
        survey = dict(survey_data or {})
        if personal_profile:
            survey["personal_profile"] = personal_profile
        pack = TestSession(
            id=next_id,
            user_id=user_id,
            survey_data=survey,
            self_assessment_level=LEVEL_TO_ASSESSMENT.get(target_level, 4),
            topics=chosen_topics or DEFAULT_TOPICS,
            mode="study",
            dev_mock=dev_mock,
            status="in_progress",
        )
        db.add(pack)
        db.commit()
        db.refresh(pack)
        return pack

    master = study_sessions[0]
    # Backfill canonical_key on existing questions in master
    master_qs = (
        db.query(Question)
        .filter(Question.session_id == master.id)
        .order_by(Question.order_index.asc(), Question.id.asc())
        .all()
    )
    master_by_key: Dict[str, Question] = {}
    for q in master_qs:
        ckey = infer_canonical_key_for_question(q)
        if not q.canonical_key:
            q.canonical_key = ckey
        master_by_key.setdefault(ckey, q)

    # Merge any secondary legacy study packs into `master` without duplicating canonical slots
    if len(study_sessions) > 1:
        next_order = max((q.order_index for q in master_qs), default=0) + 1
        for extra in study_sessions[1:]:
            extra_qs = db.query(Question).filter(Question.session_id == extra.id).order_by(Question.order_index.asc()).all()
            for eq in extra_qs:
                ckey = infer_canonical_key_for_question(eq)
                target_q = master_by_key.get(ckey)
                if target_q:
                    # Merge study status (prefer higher mastery) and prompt variant if text differs
                    rank = {"unlearned": 0, "learning": 1, "mastered": 2}
                    if rank.get(eq.study_status or "unlearned", 0) > rank.get(target_q.study_status or "unlearned", 0):
                        target_q.study_status = eq.study_status
                    if (eq.review_count or 0) > (target_q.review_count or 0):
                        target_q.review_count = eq.review_count
                        target_q.review_interval_days = eq.review_interval_days
                        target_q.next_review_at = eq.next_review_at
                    if (eq.question_text or "").strip().lower() != (target_q.question_text or "").strip().lower():
                        existing_vars = list(target_q.prompt_variants or [])
                        if not any(v.get("question", "").strip().lower() == (eq.question_text or "").strip().lower() for v in existing_vars):
                            existing_vars.append(_v("Cách hỏi khác", eq.question_text.strip(), ""))
                            target_q.prompt_variants = existing_vars
                    # Copy any model answer levels missing on master slot
                    existing_lvls = {m.level for m in db.query(ModelAnswer).filter(ModelAnswer.question_id == target_q.id).all()}
                    for em in db.query(ModelAnswer).filter(ModelAnswer.question_id == eq.id).all():
                        if em.level not in existing_lvls:
                            em.question_id = target_q.id
                else:
                    eq.session_id = master.id
                    eq.canonical_key = ckey
                    eq.order_index = next_order
                    next_order += 1
                    master_by_key[ckey] = eq
            db.flush()
            db.delete(extra)
        db.commit()

    # Update profile / level preferences if passed
    survey = dict(master.survey_data or {})
    if survey_data:
        survey.update(survey_data)
    if personal_profile:
        survey["personal_profile"] = personal_profile
    master.survey_data = survey
    if target_level in LEVEL_TO_ASSESSMENT:
        master.self_assessment_level = LEVEL_TO_ASSESSMENT[target_level]
    if chosen_topics:
        master.topics = chosen_topics
    if dev_mock:
        master.dev_mock = True
    db.commit()
    db.refresh(master)
    return master


def sync_master_curriculum(
    db: Session,
    user_id: int,
    topic_ids: Optional[List[str]] = None,
    custom_topics: Optional[List[str]] = None,
    target_level: str = "IM",
    personal_profile: str = "",
    survey_data: Optional[Dict[str, Any]] = None,
    dev_mock: bool = False,
) -> Dict[str, Any]:
    """
    Idempotently syncs any number of chosen topics + custom topics into the learner's single Master Pack.
    Never duplicates existing `canonical_key` slots; preserves all learned progress & existing model answers.
    """
    official_selected = [t for t in (topic_ids or []) if t in OFFICIAL_TOPICS]
    pack = get_or_create_master_pack(
        db=db,
        user_id=user_id,
        target_level=target_level,
        chosen_topics=official_selected or None,
        survey_data=survey_data,
        personal_profile=personal_profile,
        dev_mock=dev_mock,
    )

    existing_qs = (
        db.query(Question)
        .filter(Question.session_id == pack.id)
        .order_by(Question.order_index.asc(), Question.id.asc())
        .all()
    )
    existing_by_key: Dict[str, Question] = {}
    max_order = 0
    for q in existing_qs:
        ckey = infer_canonical_key_for_question(q)
        if not q.canonical_key:
            q.canonical_key = ckey
        existing_by_key[ckey] = q
        max_order = max(max_order, q.order_index or 0)

    desired_specs = build_curriculum_questions(
        topic_ids=topic_ids,
        custom_topics=custom_topics,
        target_level=target_level,
    )

    added_count = 0
    skipped_count = 0
    for spec in desired_specs:
        ckey = spec["canonical_key"]
        if ckey in existing_by_key:
            # Enrich existing slot with curated prompt_variants & story_tags if empty, without touching learned state
            ex = existing_by_key[ckey]
            if not ex.prompt_variants and spec.get("prompt_variants"):
                ex.prompt_variants = spec["prompt_variants"]
            if not ex.story_tags and spec.get("story_tags"):
                ex.story_tags = spec["story_tags"]
            skipped_count += 1
            continue

        max_order += 1
        new_q = Question(
            session_id=pack.id,
            order_index=max_order,
            question_text=spec["question_text"],
            question_type=spec["question_type"],
            topic=spec["topic"],
            category=spec["category"],
            canonical_key=ckey,
            prompt_variants=spec.get("prompt_variants") or [],
            story_tags=spec.get("story_tags") or [],
            difficulty=spec["difficulty"],
            study_status="unlearned",
            vietnamese_guide=spec["vietnamese_guide"],
        )
        db.add(new_q)
        existing_by_key[ckey] = new_q
        added_count += 1

    db.commit()
    profile = personal_profile or (pack.survey_data or {}).get("personal_profile", "")
    start_study_pack_generation(pack.id, target_level=target_level, personal_profile=profile)
    progress = get_study_pack_progress(db, pack.id, target_level)
    progress["added_slots"] = added_count
    progress["preserved_slots"] = skipped_count
    return progress


def _split_sentences(text: str) -> List[str]:
    return [s.strip() for s in re.split(r'(?<=[.!?])\s+', (text or "").strip()) if s.strip()]


def generate_and_save_single_model(
    db: Session,
    q: Question,
    target_level: str = "IM",
    personal_profile: str = "",
    custom_instruction: str = "",
    previous_text: str = "",
    mock: bool = False,
) -> ModelAnswer:
    """Generates a single target-level model answer + Vietnamese translations and saves it in DB."""
    lvl = target_level if target_level in ("IL", "IM", "IH") else "IM"
    with _lock_for_question(q.id):
        data, _, _, _ = generate_single_model_answer_llm(
            question_text=q.question_text,
            topic=q.topic,
            question_type=q.question_type,
            target_level=lvl,
            personal_profile=personal_profile,
            custom_instruction=custom_instruction,
            previous_text=previous_text,
            mock=mock,
        )

        text = (data.get("text") or "").strip()
        sentences = [s.strip() for s in (data.get("sentences") or []) if str(s).strip()]
        if not sentences and text:
            sentences = _split_sentences(text)
        if not text and sentences:
            text = " ".join(sentences)

        sentences_vi = [str(s).strip() for s in (data.get("sentences_vi") or [])]
        if len(sentences_vi) != len(sentences):
            sentences_vi = sentences_vi[: len(sentences)] + [""] * max(0, len(sentences) - len(sentences_vi))

        q_vi = (data.get("question_translation_vi") or "").strip()
        if q_vi:
            q.question_translation_vi = q_vi

        rationale = (data.get("rationale") or f"Bài mẫu chuẩn mức {lvl}.").strip()
        audio_url = cached_speech_url(text)

        existing = (
            db.query(ModelAnswer)
            .filter(ModelAnswer.question_id == q.id, ModelAnswer.level == lvl)
            .first()
        )
        if existing:
            existing.text = text
            existing.rationale = rationale
            existing.sentences = sentences
            existing.sentences_vi = sentences_vi
            existing.audio_path = audio_url
            model_obj = existing
        else:
            model_obj = ModelAnswer(
                question_id=q.id,
                level=lvl,
                text=text,
                rationale=rationale,
                sentences=sentences,
                sentences_vi=sentences_vi,
                audio_path=audio_url,
            )
            db.add(model_obj)

        db.commit()
        db.refresh(model_obj)

    if text and not audio_url:
        prefetch_speech([text])
    return model_obj


def _process_one_question(question_id: int, target_level: str, personal_profile: str, mock: bool):
    db = SessionLocal()
    try:
        q = db.query(Question).filter(Question.id == question_id).first()
        if not q:
            return
        already = (
            db.query(ModelAnswer)
            .filter(ModelAnswer.question_id == q.id, ModelAnswer.level == target_level)
            .first()
        )
        if already:
            return
        generate_and_save_single_model(
            db,
            q,
            target_level=target_level,
            personal_profile=personal_profile,
            mock=mock,
        )
    except Exception as e:
        logger.error(f"Study pack model generation failed for Q{question_id}: {e}")
    finally:
        db.close()


def start_study_pack_generation(session_id: int, target_level: str = "IM", personal_profile: str = "") -> bool:
    """Starts (or resumes) background model-answer generation for missing questions in a study pack."""
    with _jobs_lock:
        if _active_jobs.get(session_id):
            return False
        _active_jobs[session_id] = True

    def _runner():
        try:
            db = SessionLocal()
            try:
                session = db.query(TestSession).filter(TestSession.id == session_id).first()
                if not session:
                    return
                mock = is_mock_session(session)
                profile = personal_profile or (session.survey_data or {}).get("personal_profile", "")
                questions = (
                    db.query(Question)
                    .filter(Question.session_id == session_id)
                    .order_by(Question.order_index.asc())
                    .all()
                )
                existing_q_ids = {
                    row[0]
                    for row in db.query(ModelAnswer.question_id)
                    .filter(
                        ModelAnswer.question_id.in_([q.id for q in questions]),
                        ModelAnswer.level == target_level,
                    )
                    .all()
                } if questions else set()
                missing_ids = [q.id for q in questions if q.id not in existing_q_ids]
            finally:
                db.close()

            if not missing_ids:
                return

            # 2 concurrent workers keep memory tiny on Render Free while generating 80-150+ slots swiftly
            with ThreadPoolExecutor(max_workers=2) as pool:
                list(pool.map(lambda qid: _process_one_question(qid, target_level, profile, mock), missing_ids))
        finally:
            with _jobs_lock:
                _active_jobs.pop(session_id, None)

    threading.Thread(target=_runner, name=f"study_pack_{session_id}", daemon=True).start()
    return True


def get_study_pack_progress(db: Session, session_id: int, target_level: str = "IM") -> Dict[str, Any]:
    questions = db.query(Question.id, Question.study_status).filter(Question.session_id == session_id).all()
    q_ids = [r[0] for r in questions]
    total = len(q_ids)
    done = 0
    if q_ids:
        done = (
            db.query(func.count(func.distinct(ModelAnswer.question_id)))
            .filter(ModelAnswer.question_id.in_(q_ids), ModelAnswer.level == target_level)
            .scalar()
            or 0
        )
    mastered = sum(1 for _, st in questions if st == "mastered")
    learning = sum(1 for _, st in questions if st == "learning")
    with _jobs_lock:
        running = bool(_active_jobs.get(session_id))
    return {
        "session_id": session_id,
        "target_level": target_level,
        "total": total,
        "done": done,
        "running": running,
        "mastered": mastered,
        "learning": learning,
    }


def _norm_tokens(text: str) -> Set[str]:
    """Extracts meaningful lowercase keywords for matching learner survey selections to Study Pack combos."""
    raw = unicodedata.normalize("NFKD", str(text or "")).encode("ascii", "ignore").decode("ascii").lower()
    stop = {"the", "and", "for", "with", "from", "that", "this", "your", "about", "going", "take", "play", "have", "stay", "at", "to", "in", "of", "on", "a", "an"}
    return {w for w in re.findall(r"[a-z0-9]+", raw) if len(w) >= 3 and w not in stop}


def _combo_match_score(combo: List[Question], target_tokens: Set[str]) -> int:
    if not target_tokens or not combo:
        return 0
    combo_tokens: Set[str] = set()
    for q in combo:
        combo_tokens |= _norm_tokens(q.topic or "")
        combo_tokens |= _norm_tokens((q.canonical_key or "").replace(":", " ").replace("_", " "))
        combo_tokens |= _norm_tokens((q.question_text or "")[:180])
    return len(combo_tokens & target_tokens)


def _pick_best_combo(pool: List[List[Question]], target_tokens: Set[str], rng: random.Random) -> Optional[List[Question]]:
    if not pool:
        return None
    full_combos = [c for c in pool if len(c) >= 3] or pool
    scored = [(_combo_match_score(c, target_tokens), rng.random(), c) for c in full_combos]
    scored.sort(key=lambda item: (item[0], item[1]), reverse=True)
    return scored[0][2]


def populate_session_from_study_pack(
    db: Session,
    exam_session: TestSession,
    pack_session: TestSession,
) -> List[Question]:
    """
    Populates an existing TestSession with 15 OPIc questions filtered from the learner's Master Study Pack
    based on their chosen survey_data, 3 chosen official topics, and self_assessment_level:
      - Q1: Fixed Self-Introduction (warm-up, unscored)
      - Q2-Q4: Home / Background combo best matching survey (living_situation / occupation / student_status)
      - Q5-Q7: Leisure / Hobby / Sport / Travel combo best matching survey
      - Q8-Q10: Official Topic 1 combo (from chosen_topics[0], fallback unexpected/other pack combo)
      - Q11-Q13: 3-question Role-Play combo from pack
      - Q14: Official Topic 2 (preferring past_experience / unexpected_situation)
      - Q15: Official Topic 3 (preferring comparison)
    Preserves saved ModelAnswers, translations, variants, and audio from the Study Pack.
    """
    from app.services.question_generator import DIFFICULTY_MAP, generate_15_opic_questions

    all_qs = (
        db.query(Question)
        .filter(Question.session_id == pack_session.id)
        .order_by(Question.order_index.asc())
        .all()
    )
    if not all_qs:
        raise ValueError("Study pack has no questions.")

    # Group pack questions into contiguous topic combos
    combos_by_bucket: Dict[str, List[List[Question]]] = {
        "home": [],
        "leisure": [],
        "role_play": [],
        "unexpected": [],
        "custom": [],
    }
    official_by_cat: Dict[str, List[List[Question]]] = {cat: [] for cat in OFFICIAL_TOPICS}

    current_key = None
    current_group: List[Question] = []

    def _flush_group(grp: List[Question]):
        if not grp:
            return
        cat = (grp[0].category or "leisure").strip().lower()
        if cat in OFFICIAL_TOPICS:
            official_by_cat[cat].append(grp)
        elif cat in combos_by_bucket:
            combos_by_bucket[cat].append(grp)
        else:
            combos_by_bucket["unexpected"].append(grp)

    for q in all_qs:
        g_key = ((q.category or "leisure").strip().lower(), (q.topic or "").strip().lower())
        if g_key != current_key:
            _flush_group(current_group)
            current_key = g_key
            current_group = [q]
        else:
            current_group.append(q)
    _flush_group(current_group)

    rng = random.Random()
    survey = exam_session.survey_data or {}
    chosen_topics = list(exam_session.topics or pack_session.topics or DEFAULT_TOPICS)
    level = exam_session.self_assessment_level or pack_session.self_assessment_level or 4
    base_diff = DIFFICULTY_MAP.get(level, "IM")

    home_tokens = (
        _norm_tokens(survey.get("living_situation", ""))
        | _norm_tokens(survey.get("occupation", ""))
        | _norm_tokens(survey.get("student_status", ""))
    )
    leisure_raw = " ".join(
        list(survey.get("leisure_activities") or [])
        + list(survey.get("activities") or [])
        + list(survey.get("hobbies") or [])
        + list(survey.get("sports") or [])
        + list(survey.get("travel") or [])
    )
    leisure_tokens = _norm_tokens(leisure_raw)

    picked_pack_qs: List[Question] = []
    used_ids: Set[int] = set()

    def _add_questions(qs: List[Question], limit: int) -> int:
        added = 0
        for item in qs:
            if item.id in used_ids:
                continue
            picked_pack_qs.append(item)
            used_ids.add(item.id)
            added += 1
            if added >= limit:
                break
        return added

    # Q2-Q4: Best-matching Home / Background combo
    home_pick = _pick_best_combo(combos_by_bucket["home"], home_tokens, rng)
    if home_pick:
        _add_questions(home_pick, 3)

    # Q5-Q7: Best-matching Leisure / Hobby / Sport / Travel combo
    leisure_pick = _pick_best_combo(combos_by_bucket["leisure"], leisure_tokens, rng)
    if leisure_pick:
        _add_questions(leisure_pick, 3)

    # Q8-Q10: Chosen Topic 1 (fallback: other chosen topics -> unexpected -> custom)
    t1_added = 0
    for cand_topic in chosen_topics:
        t_pool = official_by_cat.get(cand_topic, [])
        if t_pool:
            chosen_c = rng.choice([c for c in t_pool if len(c) >= 3] or t_pool)
            t1_added = _add_questions(chosen_c, 3)
            if t1_added > 0:
                break
    if t1_added < 3:
        fallback_c = _pick_best_combo(combos_by_bucket["unexpected"] + combos_by_bucket["custom"], set(), rng)
        if fallback_c:
            _add_questions(fallback_c, 3 - t1_added)

    # Q11-Q13: 3-question Role-Play combo
    rp_pool = [c for c in combos_by_bucket["role_play"] if len(c) >= 3] or combos_by_bucket["role_play"]
    if rp_pool:
        _add_questions(rng.choice(rp_pool), 3)

    # Q14: Chosen Topic 2 (prefer past_experience / unexpected_situation)
    t2_pool_qs = [q for grp in official_by_cat.get(chosen_topics[1] if len(chosen_topics) > 1 else "", []) for q in grp if q.id not in used_ids]
    if t2_pool_qs:
        t2_pref = [q for q in t2_pool_qs if q.question_type in ("past_experience", "unexpected_situation")] or t2_pool_qs
        _add_questions([t2_pref[0]], 1)

    # Q15: Chosen Topic 3 (prefer comparison)
    t3_pool_qs = [q for grp in official_by_cat.get(chosen_topics[2] if len(chosen_topics) > 2 else "", []) for q in grp if q.id not in used_ids]
    if t3_pool_qs:
        t3_pref = [q for q in t3_pool_qs if q.question_type == "comparison"] or t3_pool_qs
        _add_questions([t3_pref[0]], 1)

    # Fill any remaining slots up to 14 (Q2-Q15) from unused pack questions (preferring unexpected -> chosen topics -> others)
    if len(picked_pack_qs) < 14:
        remaining = [q for q in all_qs if q.id not in used_ids]
        rng.shuffle(remaining)
        _add_questions(remaining, 14 - len(picked_pack_qs))

    picked_pack_qs = picked_pack_qs[:14]

    # Clear any old questions on this session and rebuild cleanly
    exam_session.status = "in_progress"
    db.query(Question).filter(Question.session_id == exam_session.id).delete()
    db.flush()

    source_models_by_q: Dict[int, List[ModelAnswer]] = {}
    if picked_pack_qs:
        for m in db.query(ModelAnswer).filter(ModelAnswer.question_id.in_([q.id for q in picked_pack_qs])).all():
            source_models_by_q.setdefault(m.question_id, []).append(m)

    created: List[Question] = []

    # Q1: Fixed Self-Introduction (unscored warm-up)
    q1 = Question(
        session_id=exam_session.id,
        order_index=1,
        question_text=SELF_INTRO_QUESTION["question_text"],
        question_type=SELF_INTRO_QUESTION["question_type"],
        topic=SELF_INTRO_QUESTION["topic"],
        category="self_intro",
        difficulty=base_diff,
        audio_path=cached_speech_url(SELF_INTRO_QUESTION["question_text"]),
        vietnamese_guide=SELF_INTRO_QUESTION.get("vietnamese_guide"),
    )
    db.add(q1)
    created.append(q1)

    # Q2..Q(1+len(picked_pack_qs)): Filtered & cloned from the learner's Study Pack
    for order_idx, src_q in enumerate(picked_pack_qs, start=2):
        new_q = Question(
            session_id=exam_session.id,
            order_index=order_idx,
            question_text=src_q.question_text,
            question_type=src_q.question_type,
            topic=src_q.topic,
            category=src_q.category,
            canonical_key=infer_canonical_key_for_question(src_q),
            prompt_variants=src_q.prompt_variants,
            story_tags=src_q.story_tags,
            difficulty=base_diff,
            audio_path=cached_speech_url(src_q.question_text) or src_q.audio_path,
            question_translation_vi=src_q.question_translation_vi,
            vietnamese_guide=src_q.vietnamese_guide or DEFAULT_GUIDES_BY_TYPE.get(src_q.question_type),
        )
        db.add(new_q)
        db.flush()
        for sm in source_models_by_q.get(src_q.id, []):
            db.add(ModelAnswer(
                question_id=new_q.id,
                level=sm.level,
                text=sm.text,
                rationale=sm.rationale,
                audio_path=cached_speech_url(sm.text) or sm.audio_path,
                sentences=sm.sentences,
                sentences_vi=sm.sentences_vi,
            ))
        created.append(new_q)

    # Safety net: if the learner's pack currently has fewer than 14 total questions, pad missing slots from curated bank
    if len(created) < 15:
        bank_qs = generate_15_opic_questions(survey, level, chosen_topics)
        for q_data in bank_qs[len(created):15]:
            pad_q = Question(
                session_id=exam_session.id,
                order_index=len(created) + 1,
                question_text=q_data["question_text"],
                question_type=q_data["question_type"],
                topic=q_data["topic"],
                category=q_data.get("category") or "unexpected",
                difficulty=base_diff,
                audio_path=cached_speech_url(q_data["question_text"]),
                vietnamese_guide=q_data.get("vietnamese_guide"),
            )
            db.add(pad_q)
            created.append(pad_q)

    db.commit()
    prefetch_speech(q.question_text for q in created)
    return created


def create_exam_from_study_pack(
    db: Session,
    user_id: int,
    pack_session: TestSession,
    mode: str = "practice",
) -> TestSession:
    """
    Instant shortcut (used by API / DEV quick-start): creates a session from the learner's Master Study Pack
    and populates 15 questions preserving OPIc combo order + saved model answers.
    """
    next_exam_id = int(db.query(func.max(TestSession.id)).scalar() or 0) + 1
    exam_session = TestSession(
        id=next_exam_id,
        user_id=user_id,
        survey_data=pack_session.survey_data,
        self_assessment_level=pack_session.self_assessment_level or 4,
        topics=pack_session.topics or DEFAULT_TOPICS,
        mode="exam" if mode == "exam" else "practice",
        dev_mock=bool(pack_session.dev_mock),
        status="in_progress",
    )
    db.add(exam_session)
    db.commit()
    db.refresh(exam_session)
    populate_session_from_study_pack(db, exam_session, pack_session)
    db.refresh(exam_session)
    return exam_session
