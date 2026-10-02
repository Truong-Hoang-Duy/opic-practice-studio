"""
5-minute daily workout: one question per learner per day, a streak, and quick 3-pillar IH feedback
(tense control, fluency & length, one golden tip).
"""
import datetime
import random
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.config import settings
from app.core.daily_bank import DAILY_BANK, FOCUS_TENSES, TASK_REQUIREMENTS, TYPE_BADGES, TYPE_TO_BUCKET, BUCKETS, question_key
from app.core.question_meta import CATEGORY_LABELS
from app.models.daily import DailyWorkout
from app.models.question import Question
from app.models.session import TestSession
from app.services.tts_service import cached_speech_url, prefetch_speech

# Bucket per day over a 10-day cycle: 4 past stories, 3 routines, 3 role-plays (40/30/30), interleaved
BUCKET_SCHEDULE = ("past", "routine", "role_play", "past", "routine", "past", "role_play", "routine", "past", "role_play")
NO_REPEAT_DAYS = 7
TARGET_MIN_SEC = 60
TARGET_MAX_SEC = 90
PREP_SECONDS = 10
# A challenge opened just before midnight can still be submitted a few minutes into the next day
LATE_SUBMIT_GRACE_MIN = 15

VERDICTS = ("good", "partial", "missing")


# ---------- challenge day ----------

def local_tz() -> datetime.timezone:
    return datetime.timezone(datetime.timedelta(hours=settings.DAILY_UTC_OFFSET_HOURS))


def local_now() -> datetime.datetime:
    return datetime.datetime.now(local_tz())


def local_today() -> datetime.date:
    return local_now().date()


def next_reset(now: Optional[datetime.datetime] = None) -> datetime.datetime:
    now = now or local_now()
    return datetime.datetime.combine(now.date() + datetime.timedelta(days=1), datetime.time.min, tzinfo=local_tz())


def can_submit(workout: DailyWorkout, now: Optional[datetime.datetime] = None) -> bool:
    now = now or local_now()
    if workout.challenge_date == now.date():
        return True
    late = now - datetime.datetime.combine(now.date(), datetime.time.min, tzinfo=local_tz())
    return workout.challenge_date == now.date() - datetime.timedelta(days=1) and late <= datetime.timedelta(minutes=LATE_SUBMIT_GRACE_MIN)


# ---------- question selection ----------

def bucket_for(user_id: int, day: datetime.date) -> str:
    # Offset by user so learners don't all get the same type on the same day
    return BUCKET_SCHEDULE[(day.toordinal() + user_id) % len(BUCKET_SCHEDULE)]


def question_bank_items(db: Session, user_id: int) -> Dict[str, List[Dict[str, Any]]]:
    """
    The learner's own Question Bank (every question of the test sets they took, Q1 self-intro excluded),
    grouped by daily bucket; repeated texts across sets are kept once (oldest first).
    """
    rows = (
        db.query(Question)
        .join(TestSession, Question.session_id == TestSession.id)
        .filter(TestSession.user_id == user_id)
        .order_by(Question.id)
        .all()
    )
    bank: Dict[str, List[Dict[str, Any]]] = {b: [] for b in BUCKETS}
    seen = set()
    for q in rows:
        bucket = TYPE_TO_BUCKET.get(q.question_type)
        key = question_key(q.question_text)
        if not bucket or key in seen:
            continue
        seen.add(key)
        bank[bucket].append({
            "key": key, "type": q.question_type, "text": q.question_text, "bucket": bucket,
            "topic": CATEGORY_LABELS.get(q.category or "", q.topic), "question_id": q.id,
        })
    return bank


def pick_question(db: Session, user_id: int, day: datetime.date) -> Dict[str, Any]:
    """
    The day's question, revisiting the learner's own Question Bank:
    1. bucket from the 40/30/30 schedule, never a question they had in the previous 7 days;
    2. if that bucket has nothing unused, another unused question from their bank;
    3. a small bank used up this week repeats the question they practised longest ago (still their own bank);
    4. only learners with no test set yet get the curated daily bank.
    The pick is seeded with (user, day), so it is stable and reproducible.
    """
    since = day - datetime.timedelta(days=NO_REPEAT_DAYS)
    last_used: Dict[str, datetime.date] = {}
    for key, used_on in (
        db.query(DailyWorkout.question_key, DailyWorkout.challenge_date)
        .filter(DailyWorkout.user_id == user_id, DailyWorkout.challenge_date < day)
        .all()
    ):
        last_used[key] = max(used_on, last_used.get(key, used_on))
    recent = {key for key, used_on in last_used.items() if used_on >= since}
    bucket = bucket_for(user_id, day)
    rng = random.Random(f"{user_id}:{day.isoformat()}")

    own = question_bank_items(db, user_id)
    pool = own if any(own.values()) else {b: [{**q, "bucket": b, "question_id": None} for q in DAILY_BANK[b]] for b in BUCKETS}
    candidates = [q for q in pool[bucket] if q["key"] not in recent] or \
                 [q for b in BUCKETS for q in pool[b] if q["key"] not in recent]
    if candidates:
        return rng.choice(candidates)
    # Whole bank practised this week: revisit the question seen longest ago (largest gap between repeats)
    everything = [q for b in BUCKETS for q in pool[b]]
    oldest = min(last_used.get(q["key"], datetime.date.min) for q in everything)
    return rng.choice([q for q in everything if last_used.get(q["key"], datetime.date.min) == oldest])


def _assign(workout: DailyWorkout, q: Dict[str, Any]) -> None:
    workout.question_key = q["key"]
    workout.question_text = q["text"]
    workout.question_type = q["type"]
    workout.bucket = q["bucket"]
    workout.topic_label = q["topic"]
    workout.source_question_id = q.get("question_id")


def get_or_create_today(db: Session, user_id: int, day: Optional[datetime.date] = None) -> DailyWorkout:
    day = day or local_today()
    workout = db.query(DailyWorkout).filter(DailyWorkout.user_id == user_id, DailyWorkout.challenge_date == day).first()
    if workout:
        # A curated question assigned before the learner had a Question Bank is swapped until it is answered
        if workout.source_question_id is None and workout.status != "completed" and any(question_bank_items(db, user_id).values()):
            _assign(workout, pick_question(db, user_id, day))
            db.commit()
            db.refresh(workout)
            prefetch_speech([workout.question_text])
        return workout
    workout = DailyWorkout(user_id=user_id, challenge_date=day, status="pending", attempts=0)
    _assign(workout, pick_question(db, user_id, day))
    db.add(workout)
    try:
        db.commit()
    except IntegrityError:
        # Two tabs opened the dashboard at the same moment: keep the one that won
        db.rollback()
        return db.query(DailyWorkout).filter(DailyWorkout.user_id == user_id, DailyWorkout.challenge_date == day).first()
    db.refresh(workout)
    prefetch_speech([workout.question_text])
    return workout


# ---------- streak ----------

def streak_info(db: Session, user_id: int, today: Optional[datetime.date] = None) -> Dict[str, Any]:
    """Current streak counts back from today (or yesterday while today is still open); one missed day resets it."""
    today = today or local_today()
    done = {
        d for (d,) in db.query(DailyWorkout.challenge_date)
        .filter(DailyWorkout.user_id == user_id, DailyWorkout.status == "completed")
        .all()
    }
    cursor = today if today in done else today - datetime.timedelta(days=1)
    current = 0
    while cursor in done:
        current += 1
        cursor -= datetime.timedelta(days=1)

    best = run = 0
    previous = None
    for d in sorted(done):
        run = run + 1 if previous and d - previous == datetime.timedelta(days=1) else 1
        best = max(best, run)
        previous = d

    week = [
        {"date": (today - datetime.timedelta(days=i)).isoformat(), "done": (today - datetime.timedelta(days=i)) in done}
        for i in range(6, -1, -1)
    ]
    return {"current": current, "best": best, "total": len(done), "done_today": today in done, "last_7_days": week}


# ---------- quick feedback ----------

def _verdict(v: Any) -> str:
    v = (v or "").strip().lower() if isinstance(v, str) else ""
    return v if v in VERDICTS else "partial"


def _text(v: Any) -> str:
    return v.strip() if isinstance(v, str) else ""


def _length_status(duration: float) -> str:
    if duration < TARGET_MIN_SEC:
        return "short"
    return "ok"


LEVELS = ("below_IL", "IL", "IM", "IH")
# Share of sentences that must be in the focus time frame for the tense pillar to pass
FOCUS_SHARE_REQUIRED = {"past": 0.4, "past_present": 0.4, "present": 0.4, "present_questions": 0.3, "present_future": 0.3}


def tense_verdict(focus_key: str, tense: Dict[str, Any]) -> str:
    """
    Verdict from the AI's evidence (counts + quoted verb forms) rather than its own label, so the same
    answer always gets the same verdict: no sentence in the focus time frame -> missing; enough of the
    answer in it and no wrong verb form -> good; otherwise partial.
    """
    total = tense.get("total_sentences") or 0
    focus = tense.get("focus_sentences") or 0
    evidence = [e for e in (tense.get("evidence") or []) if isinstance(e, dict)]
    if total <= 0:
        return _verdict(tense.get("verdict"))
    errors = sum(1 for e in evidence if e.get("ok") is False)
    share = min(1.0, focus / total)
    required = FOCUS_SHARE_REQUIRED.get(focus_key, 0.4)
    if focus == 0 or share < required / 2:
        return "missing"
    if share >= required and errors == 0:
        return "good"
    return "partial"


def level_cap(duration: float, words: int, focus_key: str, tense: str, task_met: Optional[bool]) -> Optional[Tuple[str, str]]:
    """ACTFL text-type rules the AI may overlook: (highest possible level, Vietnamese reason) or None."""
    if words < 30 or duration < 20:
        return "IL", "Câu trả lời quá ngắn (dưới ~30 từ) chỉ thể hiện được câu đơn lẻ - tối đa IL."
    if words < 80 or duration < 45:
        return "IM", "Chưa đủ độ dài đoạn văn (~45 giây / 80 từ trở lên) nên chưa thể đạt IH."
    if focus_key in ("past", "past_present") and tense == "missing":
        return "IM", "Thiếu phần kể ở thì quá khứ mà dạng câu này bắt buộc - bị giữ ở IM."
    if task_met is False:
        return "IM", "Chưa hoàn thành yêu cầu của dạng câu hỏi nên chưa thể đạt IH."
    return None


def build_feedback(question_type: str, duration: float, metrics: Optional[Dict[str, Any]], llm: Optional[Dict[str, Any]], transcript: str = "") -> Dict[str, Any]:
    """Merges the measured length/pace with the AI's evidence-based judgement into the 3 pillars + a capped level."""
    focus_key, focus_label = FOCUS_TENSES.get(question_type, ("present", "Hiện tại"))
    llm = llm or {}
    tense = llm.get("tense_control") if isinstance(llm.get("tense_control"), dict) else {}
    coherence = llm.get("coherence") if isinstance(llm.get("coherence"), dict) else {}
    tip = llm.get("golden_tip") if isinstance(llm.get("golden_tip"), dict) else {}
    task = llm.get("task") if isinstance(llm.get("task"), dict) else {}

    duration = float(duration or 0)
    words = (metrics or {}).get("total_words") or len((transcript or "").split())
    length_status = _length_status(duration)
    pace = (metrics or {}).get("pace")
    pauses = (metrics or {}).get("pause_count") or 0
    coherence_verdict = _verdict(coherence.get("verdict")) if coherence else "partial"

    if duration < TARGET_MIN_SEC / 2:
        fluency_verdict = "missing"
    elif length_status == "ok" and coherence_verdict == "good" and pace != "too_slow" and pauses <= 1:
        fluency_verdict = "good"
    else:
        fluency_verdict = "partial"

    if length_status == "short":
        length_note = f"Bạn mới nói {round(duration)} giây - cần tối thiểu {TARGET_MIN_SEC} giây để đủ độ dài đoạn văn của band IH."
    else:
        length_note = f"Đạt mốc độ dài {TARGET_MIN_SEC}-{TARGET_MAX_SEC} giây."

    t_verdict = tense_verdict(focus_key, tense)
    task_met = task.get("met") if isinstance(task.get("met"), bool) else None
    ai_level = llm.get("estimated_level") if llm.get("estimated_level") in LEVELS else "IM"
    cap = level_cap(duration, words, focus_key, t_verdict, task_met)
    level, cap_note = ai_level, None
    if cap and LEVELS.index(ai_level) > LEVELS.index(cap[0]):
        level, cap_note = cap

    return {
        "estimated_level": level,
        "ai_level": ai_level,
        "level_cap_note_vi": cap_note,
        "task": {"met": task_met, "note_vi": _text(task.get("note_vi"))},
        "tense": {
            "focus": focus_key,
            "focus_label_vi": focus_label,
            "verdict": t_verdict,
            "focus_sentences": tense.get("focus_sentences"),
            "total_sentences": tense.get("total_sentences"),
            "evidence": [
                {"quote": _text(e.get("quote")), "ok": bool(e.get("ok")), "fix": _text(e.get("fix"))}
                for e in (tense.get("evidence") or []) if isinstance(e, dict) and _text(e.get("quote"))
            ][:6],
            "note_vi": _text(tense.get("note_vi")),
            "example_fix": _text(tense.get("example_fix")),
        },
        "fluency": {
            "verdict": fluency_verdict,
            "duration_sec": round(duration),
            "word_count": words,
            "target_min_sec": TARGET_MIN_SEC,
            "target_max_sec": TARGET_MAX_SEC,
            "length_status": length_status,
            "length_note_vi": length_note,
            "coherence_note_vi": _text(coherence.get("note_vi")),
            "wpm": (metrics or {}).get("wpm"),
            "pace_label_vi": (metrics or {}).get("pace_label_vi"),
            "pause_count": pauses,
            "filler_total": ((metrics or {}).get("fillers") or {}).get("total", 0),
        },
        "golden_tip": {
            "tip_vi": _text(tip.get("tip_vi")) or "Kể thêm một chi tiết cụ thể (ai, ở đâu, khi nào) và nối các ý bằng 'After that', 'In the end'.",
            "example": _text(tip.get("example")),
        },
    }


def empty_answer_feedback(question_type: str, duration: float, reason: str) -> Dict[str, Any]:
    fb = build_feedback(question_type, duration, None, {
        "estimated_level": "below_IL",
        "tense_control": {"verdict": "missing", "note_vi": "Không nhận dạng được lời nói nên chưa đánh giá được thì."},
        "coherence": {"verdict": "missing", "note_vi": ""},
        "golden_tip": {"tip_vi": "Kiểm tra micro, nói to và rõ hơn, rồi bấm Làm lại.", "example": "Well, let me tell you about..."},
    })
    fb["fluency"]["verdict"] = "missing"
    fb["tense"]["verdict"] = "missing"
    fb["estimated_level"] = "below_IL"
    fb["no_speech"] = True
    fb["reason"] = reason
    return fb


# ---------- serialization ----------

def workout_to_dict(w: DailyWorkout, include_feedback: bool = True) -> Dict[str, Any]:
    focus_key, focus_label = FOCUS_TENSES.get(w.question_type, ("present", "Hiện tại"))
    data = {
        "id": w.id,
        "challenge_date": w.challenge_date.isoformat(),
        "question_text": w.question_text,
        "question_type": w.question_type,
        "badge": TYPE_BADGES.get(w.question_type, w.question_type),
        "bucket": w.bucket,
        "topic_label": w.topic_label,
        "from_question_bank": w.source_question_id is not None,
        "focus_label_vi": focus_label,
        "audio_path": cached_speech_url(w.question_text),
        "status": w.status,
        "attempts": w.attempts or 0,
        "estimated_level": w.estimated_level,
        "duration_seconds": w.duration_seconds,
        "completed_at": w.completed_at.isoformat() if w.completed_at else None,
        "timing": {"prep_sec": PREP_SECONDS, "target_min_sec": TARGET_MIN_SEC, "time_limit_sec": TARGET_MAX_SEC},
    }
    if include_feedback:
        data.update({
            "transcript": w.transcript,
            "audio_answer_path": w.audio_path,
            "speech_metrics": w.speech_metrics,
            "feedback": w.feedback,
        })
    return data


def history(db: Session, user_id: int, limit: int = 30) -> List[Dict[str, Any]]:
    rows = (
        db.query(DailyWorkout)
        .filter(DailyWorkout.user_id == user_id)
        .order_by(DailyWorkout.challenge_date.desc())
        .limit(limit)
        .all()
    )
    out = []
    for w in rows:
        item = workout_to_dict(w, include_feedback=False)
        fb = w.feedback or {}
        item["tense_verdict"] = (fb.get("tense") or {}).get("verdict")
        item["fluency_verdict"] = (fb.get("fluency") or {}).get("verdict")
        out.append(item)
    return out
