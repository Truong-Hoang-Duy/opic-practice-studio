import datetime
from collections import Counter

import pytest

from app.config import settings
from app.core.daily_bank import DAILY_BANK
from app.models.daily import DailyWorkout
from app.models.user import User
from app.services import daily_service
from app.services.evaluation_service import normalize_vocab_upgrades


def _register(client, email):
    token = client.post("/api/auth/register", json={"email": email, "password": "Password123!", "full_name": "T"}).json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def mock_llm(monkeypatch):
    monkeypatch.setattr(settings, "OPENAI_API_KEY", "")


# ======================= Feature 1: vocabulary upgrader & notebook =======================

def test_normalize_vocab_upgrades_keeps_complete_unique_items():
    items = normalize_vocab_upgrades([
        {"original_phrase": "very good", "upgraded_phrase": "top-notch", "kind": "Collocation", "topic": "food",
         "example_sentence": "The coffee there is top-notch.", "note_vi": "chất lượng hàng đầu"},
        {"original_phrase": "a lot of", "upgraded_phrase": "Top-Notch"},  # duplicate (case-insensitive)
        {"original_phrase": "go out", "upgraded_phrase": "hang out", "kind": "phrasal verb", "topic": "unknown"},
        {"original_phrase": "", "upgraded_phrase": "missing original"},
        {"original_phrase": "happy", "upgraded_phrase": "happy"},  # not an upgrade
        "junk",
    ], fallback_topic="home")
    assert [i["upgraded_phrase"] for i in items] == ["top-notch", "hang out"]
    assert items[0]["kind"] == "collocation" and items[0]["topic"] == "food"
    assert items[1]["kind"] == "phrasal_verb" and items[1]["topic"] == "home"


def test_evaluation_includes_vocab_upgrades(client, mock_llm):
    headers = _register(client, "vocab_eval@example.com")
    sid = client.post("/api/sessions", json={"mode": "practice"}, headers=headers).json()["id"]
    client.post(f"/api/sessions/{sid}/survey", json={
        "occupation": "Working professional", "student_status": "Graduated", "living_situation": "Apartment alone",
        "leisure_activities": ["Parks"], "hobbies": ["Cooking"], "sports": ["Jogging"], "travel": ["Domestic trips"],
    }, headers=headers)
    client.post(f"/api/sessions/{sid}/self-assessment", json={"level": 4}, headers=headers)
    client.post(f"/api/sessions/{sid}/topics", json={"topics": ["environment", "global_workplace", "communication_media"]}, headers=headers)
    q = next(q for q in client.get(f"/api/sessions/{sid}/questions", headers=headers).json() if q["question_type"] != "self_intro")
    ans = client.post("/api/answers", data={
        "question_id": q["id"], "session_id": sid, "duration_seconds": 40,
        "transcript_raw": "I really enjoy my weekends. It was extraordinary.",
    }, headers=headers).json()
    ev = client.post(f"/api/answers/{ans['id']}/evaluate", headers=headers).json()
    assert 2 <= len(ev["vocab_upgrades"]) <= 4
    first = ev["vocab_upgrades"][0]
    assert set(first) == {"original_phrase", "upgraded_phrase", "kind", "topic", "example_sentence", "note_vi"}


def test_notebook_crud_filters_and_isolation(client):
    headers = _register(client, "notebook@example.com")
    other = _register(client, "notebook_other@example.com")

    meta = client.get("/api/vocabulary/meta", headers=headers).json()
    assert {"key": "shopping", "label": "Mua sắm"} in meta["topics"]

    body = {"original_phrase": "bad weather", "upgraded_phrase": "torrential downpour", "kind": "collocation",
            "topic": "travel", "example_sentence": "We got caught in a torrential downpour.", "note_vi": "mưa như trút nước",
            "source_question_id": 123}
    saved = client.post("/api/vocabulary", json=body, headers=headers).json()
    assert saved["status"] == "learning" and saved["topic"] == "travel"

    # Saving the same phrase again (any case) returns the existing entry
    again = client.post("/api/vocabulary", json={**body, "upgraded_phrase": "Torrential Downpour"}, headers=headers).json()
    assert again["id"] == saved["id"]

    client.post("/api/vocabulary", json={"upgraded_phrase": "hang out", "kind": "phrasal verb", "topic": "nope"}, headers=headers)
    items = client.get("/api/vocabulary", headers=headers).json()
    assert [i["upgraded_phrase"] for i in items] == ["hang out", "torrential downpour"]
    assert items[0]["kind"] == "phrasal_verb" and items[0]["topic"] == "general"
    assert [i["upgraded_phrase"] for i in client.get("/api/vocabulary?topic=travel", headers=headers).json()] == ["torrential downpour"]

    mastered = client.patch(f"/api/vocabulary/{saved['id']}", json={"status": "mastered"}, headers=headers).json()
    assert mastered["status"] == "mastered" and mastered["mastered_at"]
    assert len(client.get("/api/vocabulary?status=mastered", headers=headers).json()) == 1
    assert client.patch(f"/api/vocabulary/{saved['id']}", json={"status": "bogus"}, headers=headers).status_code == 422
    back = client.patch(f"/api/vocabulary/{saved['id']}", json={"status": "learning"}, headers=headers).json()
    assert back["mastered_at"] is None

    # Another learner can neither see nor change it
    assert client.get("/api/vocabulary", headers=other).json() == []
    assert client.patch(f"/api/vocabulary/{saved['id']}", json={"status": "mastered"}, headers=other).status_code == 404
    assert client.delete(f"/api/vocabulary/{saved['id']}", headers=other).status_code == 404

    assert client.delete(f"/api/vocabulary/{saved['id']}", headers=headers).status_code == 200
    assert len(client.get("/api/vocabulary", headers=headers).json()) == 1


def test_speak_returns_null_url_when_server_audio_is_off(client):
    headers = _register(client, "speak@example.com")
    res = client.post("/api/vocabulary/speak", json={"text": "torrential downpour"}, headers=headers)
    assert res.status_code == 200 and res.json() == {"url": None}  # tests run with TTS_PROVIDER=browser


# ======================= Feature 2: 5-minute daily workout =======================

def _user(db, email):
    u = User(email=email, hashed_password="x")
    db.add(u)
    db.commit()
    return u


def test_bucket_schedule_is_40_30_30():
    start = datetime.date(2026, 1, 1)
    for user_id in (1, 7):
        counts = Counter(daily_service.bucket_for(user_id, start + datetime.timedelta(days=i)) for i in range(100))
        assert counts == {"past": 40, "routine": 30, "role_play": 30}


def test_daily_question_never_repeats_within_7_days_and_is_stable(db):
    user = _user(db, "rotation@example.com")
    start = datetime.date(2026, 3, 1)
    keys = []
    for i in range(40):
        day = start + datetime.timedelta(days=i)
        w = daily_service.get_or_create_today(db, user.id, day)
        assert daily_service.get_or_create_today(db, user.id, day).id == w.id  # same challenge all day
        assert w.bucket == daily_service.bucket_for(user.id, day)
        keys.append(w.question_key)
    for i in range(len(keys)):
        assert keys[i] not in keys[max(0, i - 7):i]


def test_streak_counts_consecutive_completed_days(db):
    user = _user(db, "streak@example.com")
    today = datetime.date(2026, 5, 20)
    q = DAILY_BANK["past"][0]

    def add(days_ago, status="completed"):
        db.add(DailyWorkout(user_id=user.id, challenge_date=today - datetime.timedelta(days=days_ago), question_key=q["key"],
                            question_text=q["text"], question_type=q["type"], bucket="past", status=status))
        db.commit()

    for d in (1, 2, 3):  # yesterday and the 2 days before
        add(d)
    add(5)
    for d in (8, 9, 10, 11):
        add(d)
    add(6, status="pending")  # opened but never answered

    s = daily_service.streak_info(db, user.id, today)
    assert s["current"] == 3  # today still open: the streak from yesterday is alive
    assert s["best"] == 4 and s["total"] == 8 and s["done_today"] is False
    assert [d["done"] for d in s["last_7_days"]] == [False, True, False, True, True, True, False]

    add(0)
    assert daily_service.streak_info(db, user.id, today)["current"] == 4
    # A missed day breaks it
    assert daily_service.streak_info(db, user.id, today + datetime.timedelta(days=2))["current"] == 0


def test_daily_submit_gives_three_pillar_feedback_and_updates_streak(client, mock_llm):
    headers = _register(client, "daily@example.com")
    today = client.get("/api/daily/today", headers=headers).json()
    w = today["workout"]
    assert w["status"] == "pending" and w["badge"] and w["timing"]["time_limit_sec"] == 90
    assert today["streak"]["current"] == 0
    assert datetime.datetime.fromisoformat(today["resets_at"]).time() == datetime.time.min
    assert client.get("/api/daily/today", headers=headers).json()["workout"]["id"] == w["id"]

    # Nothing recognised: feedback, but the day is not completed
    empty = client.post(f"/api/daily/{w['id']}/submit", data={"duration_seconds": 2, "mock": "true"}, headers=headers).json()
    assert empty["workout"]["status"] == "pending" and empty["workout"]["feedback"]["no_speech"] is True
    assert empty["streak"]["current"] == 0

    res = client.post(f"/api/daily/{w['id']}/submit", data={
        "duration_seconds": 45,
        "transcript_raw": "Last year I go to Da Nang with my family and we have a great time, then we came back home.",
    }, headers=headers).json()
    done = res["workout"]
    fb = done["feedback"]
    assert done["status"] == "completed" and done["attempts"] == 2
    assert set(fb) >= {"estimated_level", "tense", "fluency", "golden_tip"}
    assert fb["tense"]["verdict"] in ("good", "partial", "missing") and fb["tense"]["focus_label_vi"]
    assert fb["fluency"]["length_status"] == "short" and fb["fluency"]["duration_sec"] == 45
    assert fb["golden_tip"]["tip_vi"]
    assert res["streak"] == {**res["streak"], "current": 1, "done_today": True}

    hist = client.get("/api/daily/history", headers=headers).json()
    assert hist["items"][0]["id"] == w["id"] and hist["items"][0]["tense_verdict"] == fb["tense"]["verdict"]

    # Someone else's challenge is off limits
    other = _register(client, "daily_other@example.com")
    assert client.post(f"/api/daily/{w['id']}/submit", data={"transcript_raw": "hi"}, headers=other).status_code == 404


def test_expired_challenge_cannot_be_submitted(client, db, mock_llm):
    headers = _register(client, "expired@example.com")
    w = client.get("/api/daily/today", headers=headers).json()["workout"]
    row = db.query(DailyWorkout).get(w["id"])
    row.challenge_date = daily_service.local_today() - datetime.timedelta(days=2)
    db.commit()
    res = client.post(f"/api/daily/{w['id']}/submit", data={"transcript_raw": "I went home."}, headers=headers)
    assert res.status_code == 409


def test_late_submit_grace_after_midnight():
    tz = daily_service.local_tz()
    w = DailyWorkout(challenge_date=datetime.date(2026, 6, 1))
    assert daily_service.can_submit(w, datetime.datetime(2026, 6, 1, 23, 59, tzinfo=tz))
    assert daily_service.can_submit(w, datetime.datetime(2026, 6, 2, 0, 10, tzinfo=tz))
    assert not daily_service.can_submit(w, datetime.datetime(2026, 6, 2, 0, 30, tzinfo=tz))


def _bank_session(db, user, questions):
    from app.models.session import TestSession
    from app.models.question import Question
    s = TestSession(user_id=user.id, mode="practice", status="completed")
    db.add(s)
    db.commit()
    rows = []
    for i, (qtype, text) in enumerate(questions, start=1):
        q = Question(session_id=s.id, order_index=i, question_text=text, question_type=qtype, topic="Home", category="home")
        db.add(q)
        rows.append(q)
    db.commit()
    return rows


def test_daily_questions_come_from_the_learners_question_bank(db):
    user = _user(db, "bank_daily@example.com")
    rows = _bank_session(db, user, [
        ("self_intro", "Tell me about yourself."),
        ("past_experience", "Tell me about a trip you took last year."),
        ("unexpected_situation", "Tell me about a time your phone broke."),
        ("routine", "What do you do on weekends?"),
        ("description", "Describe your home."),
        ("role_play_ask", "Call the gym and ask three questions."),
        ("role_play_problem", "The gym lost your booking. Solve it."),
    ])
    own_ids = {q.id for q in rows if q.question_type != "self_intro"}
    start = datetime.date(2026, 4, 1)
    picked = []
    for i in range(20):
        day = start + datetime.timedelta(days=i)
        w = daily_service.get_or_create_today(db, user.id, day)
        assert w.source_question_id in own_ids  # never the curated bank, never Q1
        picked.append(w.question_key)
    # 6 usable questions: still no repeat inside any 6-day stretch
    for i in range(len(picked)):
        assert picked[i] not in picked[max(0, i - 5):i]


def test_untouched_curated_challenge_switches_to_question_bank(db):
    user = _user(db, "bank_switch@example.com")
    day = datetime.date(2026, 4, 1)
    w = daily_service.get_or_create_today(db, user.id, day)
    assert w.source_question_id is None  # no test set yet: curated fallback
    rows = _bank_session(db, user, [("past_experience", "Tell me about your first job interview.")])
    w = daily_service.get_or_create_today(db, user.id, day)
    assert w.source_question_id == rows[0].id and w.question_text == rows[0].question_text


def test_tense_verdict_comes_from_the_evidence():
    v = daily_service.tense_verdict
    good = {"verdict": "partial", "focus_sentences": 4, "total_sentences": 6, "evidence": [{"quote": "I went", "ok": True}]}
    assert v("past", good) == "good"  # the AI's own label is overridden by its evidence
    slip = {**good, "evidence": [{"quote": "I went", "ok": True}, {"quote": "last year I go", "ok": False, "fix": "I went"}]}
    assert v("past", slip) == "partial"
    assert v("past", {"verdict": "good", "focus_sentences": 0, "total_sentences": 5}) == "missing"
    assert v("past", {"verdict": "good", "focus_sentences": 1, "total_sentences": 10}) == "missing"
    assert v("past", {"verdict": "missing"}) == "missing"  # no counts: fall back to the AI label


def test_level_is_capped_by_length_and_task():
    llm = {"estimated_level": "IH", "task": {"met": True},
           "tense_control": {"verdict": "good", "focus_sentences": 5, "total_sentences": 6, "evidence": []},
           "coherence": {"verdict": "good"}, "golden_tip": {"tip_vi": "x"}}
    long = {"total_words": 150, "wpm": 110, "pause_count": 0}
    assert daily_service.build_feedback("past_experience", 75, long, llm)["estimated_level"] == "IH"
    short = daily_service.build_feedback("past_experience", 35, {"total_words": 60}, llm)
    assert short["estimated_level"] == "IM" and short["ai_level"] == "IH" and short["level_cap_note_vi"]
    tiny = daily_service.build_feedback("past_experience", 15, {"total_words": 20}, llm)
    assert tiny["estimated_level"] == "IL"
    no_task = daily_service.build_feedback("role_play_ask", 75, long, {**llm, "task": {"met": False, "note_vi": "chỉ hỏi 1 câu"}})
    assert no_task["estimated_level"] == "IM" and no_task["task"]["met"] is False
    # Lower AI levels are never raised
    assert daily_service.build_feedback("routine", 75, long, {**llm, "estimated_level": "IL"})["estimated_level"] == "IL"


def test_ai_failure_is_reported_and_can_be_regraded(client, monkeypatch):
    from app.routers import daily as daily_router
    headers = _register(client, "regrade@example.com")
    w = client.get("/api/daily/today", headers=headers).json()["workout"]

    monkeypatch.setattr(daily_router, "daily_feedback_llm", lambda *a, **k: None)
    res = client.post(f"/api/daily/{w['id']}/submit", data={"duration_seconds": 70, "transcript_raw": "Last year I went to Hue."}, headers=headers).json()
    assert res["workout"]["feedback"] == {"grading_failed": True}
    assert res["workout"]["status"] == "pending" and res["streak"]["current"] == 0

    monkeypatch.setattr(settings, "OPENAI_API_KEY", "")
    monkeypatch.setattr(daily_router, "daily_feedback_llm", __import__("app.services.llm_service", fromlist=["x"]).daily_feedback_llm)
    again = client.post(f"/api/daily/{w['id']}/regrade", headers=headers).json()
    assert again["workout"]["status"] == "completed" and again["workout"]["feedback"]["tense"]["verdict"]
    assert again["workout"]["transcript"] == "Last year I went to Hue."


def test_workout_detail_for_history_review(client, mock_llm):
    headers = _register(client, "detail@example.com")
    w = client.get("/api/daily/today", headers=headers).json()["workout"]
    client.post(f"/api/daily/{w['id']}/submit", data={"duration_seconds": 70, "transcript_raw": "Last year I went to Hue with my friends."}, headers=headers)
    detail = client.get(f"/api/daily/{w['id']}", headers=headers).json()
    assert detail["transcript"] == "Last year I went to Hue with my friends." and detail["feedback"]["tense"]
    other = _register(client, "detail_other@example.com")
    assert client.get(f"/api/daily/{w['id']}", headers=other).status_code == 404
