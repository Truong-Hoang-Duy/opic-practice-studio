"""
50-question OPIc Study Pack generator (default rank IM, no self-introduction).
Generates questions covering the learner's pre-selected survey items + 3 chosen official topics +
top role-plays + top unexpected topics, and synthesizes single-level model answers + Vietnamese
sentence translations in a resumable background job.
"""
import logging
import random
import re
import threading
from concurrent.futures import ThreadPoolExecutor
from typing import Any, Dict, List, Optional, Tuple
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models.session import TestSession
from app.models.question import Question, ModelAnswer
from app.core.seed_data import DEFAULT_GUIDES_BY_TYPE, TOPIC_QUESTIONS_BANK
from app.core.question_meta import OFFICIAL_TOPICS
from app.services.llm_service import generate_single_model_answer_llm
from app.services.tts_service import cached_speech_url, prefetch_speech
from app.services.evaluation_service import is_mock_session

logger = logging.getLogger("opic_study_pack")
logger.setLevel(logging.INFO)

DEFAULT_TOPICS = ["environment", "socio_cultural", "communication_media"]
LEVEL_TO_ASSESSMENT = {"IL": 3, "IM": 4, "IH": 5}

# Active background jobs keyed by session_id
_jobs_lock = threading.Lock()
_active_jobs: Dict[int, bool] = {}

# Exact 6 Home & Staycation questions (2 combos x 3)
HOME_COMBOS: List[Tuple[str, List[Dict[str, str]]]] = [
    (
        "Home & Family Living",
        [
            {
                "question_type": "description",
                "topic": "Home & Living with Family",
                "question_text": "You indicated in the survey that you live with family members in a house or an apartment. Describe your home to me. What does it look like, what rooms does it have, and which room is your favorite?",
            },
            {
                "question_type": "routine",
                "topic": "Home & Living with Family",
                "question_text": "Tell me about what you and your family usually do together at home on a typical day or weekend. Who does what around the house?",
            },
            {
                "question_type": "past_experience",
                "topic": "Home & Living with Family",
                "question_text": "Tell me about a memorable event or an unexpected problem that happened at your home, such as a broken appliance or a special family celebration. What happened and how did you handle it?",
            },
        ],
    ),
    (
        "Stay at Home for Vacation",
        [
            {
                "question_type": "description",
                "topic": "Stay at Home for Vacation",
                "question_text": "You mentioned that you like to stay at home for vacation. Why do you prefer staying at home instead of traveling somewhere far away, and what makes it comfortable for you?",
            },
            {
                "question_type": "routine",
                "topic": "Stay at Home for Vacation",
                "question_text": "When you have a few days off and spend your vacation at home, walk me through your usual daily routine from morning to night.",
            },
            {
                "question_type": "past_experience",
                "topic": "Stay at Home for Vacation",
                "question_text": "Tell me about one of the most enjoyable or memorable vacations you spent at home. What did you do, who were you with, and why do you still remember it?",
            },
        ],
    ),
]

# Survey leisure templates (each item -> 3-question combo). Default 5 items from USER_DEFAULT_PRESET = 15 questions.
SURVEY_LEISURE_BANK: Dict[str, Tuple[str, List[Dict[str, str]]]] = {
    "go to the movies": (
        "Going to the Movies",
        [
            {
                "question_type": "description",
                "topic": "Going to the Movies",
                "question_text": "You indicated that you enjoy going to the movies. What kind of movies do you like to watch, and what is your favorite movie theater like?",
            },
            {
                "question_type": "routine",
                "topic": "Going to the Movies",
                "question_text": "Tell me about your usual routine when you go to the movies. Who do you usually go with, what do you do before the movie starts, and what do you do afterward?",
            },
            {
                "question_type": "past_experience",
                "topic": "Going to the Movies",
                "question_text": "Tell me about a memorable experience you had at a movie theater or a movie that left a strong impression on you. What happened and why was it special?",
            },
        ],
    ),
    "go to parks": (
        "Going to Parks",
        [
            {
                "question_type": "description",
                "topic": "Going to Parks",
                "question_text": "You mentioned that you like going to parks. Describe the park you visit most often. Where is it located, and what does it look like?",
            },
            {
                "question_type": "routine",
                "topic": "Going to Parks",
                "question_text": "What do you usually do when you go to the park? When do you normally go, who do you go with, and what kinds of activities do other people do there?",
            },
            {
                "question_type": "past_experience",
                "topic": "Going to Parks",
                "question_text": "Tell me about a memorable or unexpected thing that happened to you while visiting a park. What happened and how did you feel?",
            },
        ],
    ),
    "listen to music": (
        "Listening to Music",
        [
            {
                "question_type": "description",
                "topic": "Listening to Music",
                "question_text": "You indicated that you enjoy listening to music. What types of music and which singers or bands do you like best, and why?",
            },
            {
                "question_type": "routine",
                "topic": "Listening to Music",
                "question_text": "When and where do you usually listen to music during your day? What devices or apps do you use to listen to it?",
            },
            {
                "question_type": "past_experience",
                "topic": "Listening to Music",
                "question_text": "Has your taste in music changed over time, or is there a specific song or musical memory that means a lot to you? Tell me about it.",
            },
        ],
    ),
    "cook": (
        "Cooking at Home",
        [
            {
                "question_type": "description",
                "topic": "Cooking at Home",
                "question_text": "You mentioned that you enjoy cooking. What kinds of dishes do you like to cook most, and what is your favorite meal to prepare?",
            },
            {
                "question_type": "routine",
                "topic": "Cooking at Home",
                "question_text": "How often do you cook, and what is your usual process from buying ingredients to serving the food? Do you usually cook alone or with family?",
            },
            {
                "question_type": "past_experience",
                "topic": "Cooking at Home",
                "question_text": "Tell me about a memorable time you cooked a meal, such as a time something went wrong in the kitchen or a special dish you made for others. What happened?",
            },
        ],
    ),
    "walk": (
        "Walking for Exercise",
        [
            {
                "question_type": "description",
                "topic": "Walking for Exercise",
                "question_text": "You indicated that you enjoy walking. Where do you usually go for a walk, and what do you like about the scenery or atmosphere there?",
            },
            {
                "question_type": "routine",
                "topic": "Walking for Exercise",
                "question_text": "How often do you go walking, and what is your usual routine? What do you wear, when do you go, and do you walk alone or with someone?",
            },
            {
                "question_type": "past_experience",
                "topic": "Walking for Exercise",
                "question_text": "Tell me about a memorable or unusual experience you had while out for a walk. When did it happen and what made it unforgettable?",
            },
        ],
    ),
}

DEFAULT_LEISURE_KEYS = ["go to the movies", "go to parks", "listen to music", "cook", "walk"]

# 3 high-frequency Role-play combos (3 x 3 = 9 questions)
ROLE_PLAY_COMBOS: List[Tuple[str, List[Dict[str, str]]]] = [
    (
        "Movie Theater / Restaurant Booking",
        [
            {
                "question_type": "role_play_ask",
                "topic": "Role-Play: Movie & Dinner Plans",
                "question_text": "I'd like to give you a situation and ask you to act it out. You want to invite a friend to watch a movie and have dinner this weekend. Call the movie theater or restaurant and ask three or four questions about showtimes, ticket prices, seating, or reservations.",
            },
            {
                "question_type": "role_play_problem",
                "topic": "Role-Play: Movie & Dinner Plans",
                "question_text": "Now, I'm sorry, but there is a problem. The movie time you wanted is completely sold out, or you suddenly have to work late and cannot make it on time. Call your friend, explain the situation, and suggest two or three alternative plans.",
            },
            {
                "question_type": "role_play_experience",
                "topic": "Role-Play: Movie & Dinner Plans",
                "question_text": "That's the end of the role-play. Have you ever had to cancel or change plans with a friend or family member at the last minute? Tell me what happened and how you resolved it.",
            },
        ],
    ),
    (
        "Hotel Reservation",
        [
            {
                "question_type": "role_play_ask",
                "topic": "Role-Play: Hotel Reservation",
                "question_text": "Let's do a role-play. You are planning a short weekend trip with your family and want to book a hotel room. Call the hotel front desk and ask three or four questions about room types, prices, breakfast, and nearby attractions.",
            },
            {
                "question_type": "role_play_problem",
                "topic": "Role-Play: Hotel Reservation",
                "question_text": "Unfortunately, when you arrive at the hotel, there is a problem with your room—for example, the air conditioner is not working or they gave you the wrong room type. Talk to the receptionist, explain the problem, and offer two or three solutions.",
            },
            {
                "question_type": "role_play_experience",
                "topic": "Role-Play: Hotel Reservation",
                "question_text": "Have you ever experienced a problem while staying at a hotel or during a trip? Tell me when it happened, what went wrong, and how it turned out in the end.",
            },
        ],
    ),
    (
        "Returning or Exchanging an Item",
        [
            {
                "question_type": "role_play_ask",
                "topic": "Role-Play: Shopping & Returns",
                "question_text": "Imagine you want to buy a new jacket or a pair of shoes at a store. Call the store staff and ask three or four questions about available sizes, colors, prices, and their return policy.",
            },
            {
                "question_type": "role_play_problem",
                "topic": "Role-Play: Shopping & Returns",
                "question_text": "Later, after bringing the item home, you discover that it has a defect or does not fit properly. Call the store, explain the issue clearly, and suggest two or three alternatives such as an exchange, refund, or store credit.",
            },
            {
                "question_type": "role_play_experience",
                "topic": "Role-Play: Shopping & Returns",
                "question_text": "Have you ever bought something online or in a store that was damaged or not what you expected? Tell me about that experience and how you handled it.",
            },
        ],
    ),
]

# 4 highest-frequency Unexpected topics (3 + 3 + 3 + 2 = 11 questions)
UNEXPECTED_COMBOS: List[Tuple[str, List[Dict[str, str]]]] = [
    (
        "Weather & Seasons",
        [
            {
                "question_type": "description",
                "topic": "Weather & Seasons",
                "question_text": "Let's talk about the weather in your country. What are the different seasons like where you live, and which season do you enjoy the most?",
            },
            {
                "question_type": "routine",
                "topic": "Weather & Seasons",
                "question_text": "What kinds of activities do you usually do when the weather is nice, and what do you do instead on rainy or very hot days?",
            },
            {
                "question_type": "past_experience",
                "topic": "Weather & Seasons",
                "question_text": "Tell me about a time when unexpected bad weather, such as heavy rain or a storm, affected your plans. What happened and what did you do?",
            },
        ],
    ),
    (
        "Neighborhoods & Neighbors",
        [
            {
                "question_type": "description",
                "topic": "Neighborhoods & Neighbors",
                "question_text": "Describe the neighborhood where you currently live. What places are nearby, what is the atmosphere like, and what do you like or dislike about it?",
            },
            {
                "question_type": "routine",
                "topic": "Neighborhoods & Neighbors",
                "question_text": "Tell me about your neighbors. Do you see or talk to them often, and how do people in your neighborhood usually interact with each other?",
            },
            {
                "question_type": "comparison",
                "topic": "Neighborhoods & Neighbors",
                "question_text": "How has your neighborhood changed over the past few years? Compare what it looked like in the past with how it is today.",
            },
        ],
    ),
    (
        "Mobile Phones & Online Shopping",
        [
            {
                "question_type": "description",
                "topic": "Mobile Phones & Online Shopping",
                "question_text": "Let's talk about smartphones and technology. What kind of phone do you use, and what apps or features do you use the most every day?",
            },
            {
                "question_type": "routine",
                "topic": "Mobile Phones & Online Shopping",
                "question_text": "Do you often shop online using your phone? Tell me what kinds of things you usually buy online and why you prefer it over going to physical stores.",
            },
            {
                "question_type": "past_experience",
                "topic": "Mobile Phones & Online Shopping",
                "question_text": "Tell me about a problem you once had with your smartphone, the internet, or an online order. What went wrong and how did you solve it?",
            },
        ],
    ),
    (
        "Staying Healthy",
        [
            {
                "question_type": "routine",
                "topic": "Staying Healthy",
                "question_text": "Health is very important to many people today. What do you usually do in your daily life to stay healthy, such as your diet, sleep, or exercise habits?",
            },
            {
                "question_type": "past_experience",
                "topic": "Staying Healthy",
                "question_text": "Tell me about a time when you felt sick or had to visit a doctor or pharmacy. What symptoms did you have and how did you recover?",
            },
        ],
    ),
]


def _build_dynamic_leisure_combo(label: str) -> List[Dict[str, str]]:
    clean = label.strip()
    title = clean.title()
    return [
        {
            "question_type": "description",
            "topic": title,
            "question_text": f"You indicated in the survey that you enjoy {clean}. Tell me more about it—what do you like most about {clean} and where do you usually do it?",
        },
        {
            "question_type": "routine",
            "topic": title,
            "question_text": f"How often do you {clean}? Walk me through your usual routine when you do this activity and who you usually do it with.",
        },
        {
            "question_type": "past_experience",
            "topic": title,
            "question_text": f"Tell me about a memorable or special experience you had related to {clean}. When did it happen and why was it unforgettable?",
        },
    ]


def build_50_study_questions(
    chosen_topics: Optional[List[str]] = None,
    survey_data: Optional[Dict[str, Any]] = None,
    target_level: str = "IM",
) -> List[Dict[str, Any]]:
    """
    Builds exactly 50 study questions (NO self_intro):
      - 6 Home & Staycation (home)
      - 15 Survey Leisure (5 items x 3, leisure)
      - 9 Official Topics (3 chosen topics x 3)
      - 9 Role-play (3 scenarios x 3, role_play)
      - 11 Unexpected (4 top topics: 3+3+3+2, unexpected)
    """
    diff = target_level if target_level in ("IL", "IM", "IH") else "IM"
    valid_topics = [t for t in (chosen_topics or []) if t in OFFICIAL_TOPICS]
    for fallback_t in DEFAULT_TOPICS:
        if len(valid_topics) >= 3:
            break
        if fallback_t not in valid_topics:
            valid_topics.append(fallback_t)
    valid_topics = valid_topics[:3]

    # Resolve 5 survey leisure keys from survey_data or USER_DEFAULT_PRESET
    survey = survey_data or {}
    picked_leisure: List[str] = []
    for field in ("activities", "hobbies", "sports"):
        for val in survey.get(field) or []:
            low = str(val).strip().lower()
            if low and low not in picked_leisure:
                picked_leisure.append(low)
    for k in DEFAULT_LEISURE_KEYS:
        if len(picked_leisure) >= 5:
            break
        if k not in picked_leisure:
            picked_leisure.append(k)
    picked_leisure = picked_leisure[:5]

    items: List[Dict[str, Any]] = []

    # 1. Home & Staycation (6)
    for _, qlist in HOME_COMBOS:
        for q in qlist:
            items.append({**q, "category": "home", "difficulty": diff})

    # 2. Survey Leisure (15)
    for key in picked_leisure:
        if key in SURVEY_LEISURE_BANK:
            _, qlist = SURVEY_LEISURE_BANK[key]
        else:
            qlist = _build_dynamic_leisure_combo(key)
        for q in qlist:
            items.append({**q, "category": "leisure", "difficulty": diff})

    # 3. 3 Chosen Official Topics (9)
    for t_key in valid_topics:
        bank_qs = TOPIC_QUESTIONS_BANK.get(t_key, [])[:3]
        for bq in bank_qs:
            items.append({
                "question_type": bq["type"],
                "topic": t_key.replace("_", " ").title(),
                "question_text": bq["text"],
                "category": t_key,
                "difficulty": diff,
                "vietnamese_guide": bq.get("guide"),
            })

    # 4. Role-play (9)
    for _, qlist in ROLE_PLAY_COMBOS:
        for q in qlist:
            items.append({**q, "category": "role_play", "difficulty": diff})

    # 5. Unexpected (11)
    for _, qlist in UNEXPECTED_COMBOS:
        for q in qlist:
            items.append({**q, "category": "unexpected", "difficulty": diff})

    result: List[Dict[str, Any]] = []
    for idx, q in enumerate(items, start=1):
        guide = q.get("vietnamese_guide") or DEFAULT_GUIDES_BY_TYPE.get(
            q["question_type"], DEFAULT_GUIDES_BY_TYPE["description"]
        )
        result.append({
            "order_index": idx,
            "question_text": q["question_text"],
            "question_type": q["question_type"],
            "topic": q["topic"],
            "category": q["category"],
            "difficulty": q["difficulty"],
            "vietnamese_guide": guide,
        })
    return result


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

            # 2 concurrent workers keep memory tiny on Render Free while generating ~50 items swiftly
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
            db.query(ModelAnswer.question_id)
            .filter(ModelAnswer.question_id.in_(q_ids), ModelAnswer.level == target_level)
            .distinct()
            .count()
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


def create_exam_from_study_pack(
    db: Session,
    user_id: int,
    pack_session: TestSession,
    mode: str = "exam",
) -> TestSession:
    """
    Samples 15 questions from the 50-question study pack preserving OPIc combo order
    (Home 3 + Leisure 3 + Official Topic 3 + Role-play 3 + Unexpected 3 = 15 questions)
    and clones their saved model answers & Vietnamese translations.
    """
    all_qs = (
        db.query(Question)
        .filter(Question.session_id == pack_session.id)
        .order_by(Question.order_index.asc())
        .all()
    )
    if not all_qs:
        raise ValueError("Study pack has no questions.")

    # Group contiguous combos by (category, topic)
    combos_by_group: Dict[str, List[List[Question]]] = {
        "home": [],
        "leisure": [],
        "official": [],
        "role_play": [],
        "unexpected": [],
    }
    current_key = None
    current_group: List[Question] = []
    for q in all_qs:
        g_key = (q.category or "leisure", q.topic)
        if g_key != current_key:
            if current_group:
                cat = current_group[0].category or "leisure"
                bucket = "official" if cat in OFFICIAL_TOPICS else (cat if cat in combos_by_group else "unexpected")
                combos_by_group[bucket].append(current_group)
            current_key = g_key
            current_group = [q]
        else:
            current_group.append(q)
    if current_group:
        cat = current_group[0].category or "leisure"
        bucket = "official" if cat in OFFICIAL_TOPICS else (cat if cat in combos_by_group else "unexpected")
        combos_by_group[bucket].append(current_group)

    rng = random.Random()
    picked: List[Question] = []
    for bucket in ("home", "leisure", "official", "role_play", "unexpected"):
        pool = [c for c in combos_by_group[bucket] if len(c) >= 3] or combos_by_group[bucket]
        if pool:
            chosen = rng.choice(pool)
            picked.extend(chosen[:3])

    # Top up to 15 if any bucket had fewer than 3
    picked_ids = {q.id for q in picked}
    if len(picked) < 15:
        remaining = [q for q in all_qs if q.id not in picked_ids]
        rng.shuffle(remaining)
        picked.extend(remaining[: 15 - len(picked)])
    picked = picked[:15]

    exam_session = TestSession(
        user_id=user_id,
        survey_data=pack_session.survey_data,
        self_assessment_level=pack_session.self_assessment_level or 4,
        topics=pack_session.topics or DEFAULT_TOPICS,
        mode="practice" if mode == "practice" else "exam",
        dev_mock=bool(pack_session.dev_mock),
        status="in_progress",
    )
    db.add(exam_session)
    db.commit()
    db.refresh(exam_session)

    # Batch-fetch saved model answers for picked questions
    source_models_by_q: Dict[int, List[ModelAnswer]] = {}
    for m in db.query(ModelAnswer).filter(ModelAnswer.question_id.in_([q.id for q in picked])).all():
        source_models_by_q.setdefault(m.question_id, []).append(m)

    for order_idx, src_q in enumerate(picked, start=1):
        new_q = Question(
            session_id=exam_session.id,
            order_index=order_idx,
            question_text=src_q.question_text,
            question_type=src_q.question_type,
            topic=src_q.topic,
            category=src_q.category,
            difficulty=src_q.difficulty,
            audio_path=cached_speech_url(src_q.question_text) or src_q.audio_path,
            question_translation_vi=src_q.question_translation_vi,
            vietnamese_guide=src_q.vietnamese_guide,
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

    db.commit()
    prefetch_speech(q.question_text for q in picked[:3])
    return exam_session
