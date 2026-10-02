import pytest

from app.config import settings
from app.services.speech_metrics import compute_speech_metrics, find_fillers, pace_band
from app.services.evaluation_service import normalize_speech_intelligence


def _words(spec):
    """spec: list of (word, start_sec, end_sec)."""
    return [{"word": w, "confidence": 0.95, "start_ms": int(s * 1000), "end_ms": int(e * 1000)} for w, s, e in spec]


# ---------- Feature 1: speech flow & hesitation ----------

def test_wpm_uses_speaking_span_and_bands():
    # 20 words spread over 10 s of speech -> 120 WPM (ideal)
    words = _words([(f"w{i}", 0.5 * i, 0.5 * i + 0.4) for i in range(20)])
    m = compute_speech_metrics(words, duration_seconds=30)
    assert m["total_words"] == 20
    assert m["wpm"] == round(20 / 9.9 * 60)
    assert m["pace"] == "ideal"
    assert m["pace_label_vi"] == "Tốc độ lý tưởng chuẩn ACTFL IH"

    assert pace_band(80) == "too_slow"
    assert pace_band(90) == "ideal"
    assert pace_band(130) == "ideal"
    assert pace_band(140) == "slightly_fast"
    assert pace_band(151) == "too_fast"


def test_awkward_pauses_of_two_seconds_or_more():
    words = _words([("I", 1.0, 1.2), ("went", 1.3, 1.6), ("to", 3.6, 3.7), ("Hanoi", 3.8, 4.2), ("yesterday", 5.9, 6.4)])
    m = compute_speech_metrics(words)
    assert m["pause_count"] == 1  # 1.6 -> 3.6 is exactly 2.0 s; 4.2 -> 5.9 (1.7 s) is not a pause
    pause = m["pauses"][0]
    assert pause == {"start_sec": 1.6, "end_sec": 3.6, "duration_sec": 2.0, "after_word": "went", "before_word": "to"}
    assert m["longest_pause_sec"] == 2.0
    assert m["start_delay_sec"] == 1.0


def test_filler_words_counted_with_positions():
    text = "Um, I think, like, my hometown is, uh, you know, basically quiet. Do you know Hanoi? I like it, I mean really."
    words = [{"word": t, "start_ms": i * 400, "end_ms": i * 400 + 300} for i, t in enumerate(text.split())]
    fillers = find_fillers(words)
    names = [f["filler"] for f in fillers]
    assert names == ["um", "like", "uh", "you know", "basically", "i mean"]
    # "Do you know Hanoi?" is a real question and "I like it" a real verb: not fillers
    assert fillers[0]["word_index"] == 0 and fillers[0]["time_sec"] == 0.0

    m = compute_speech_metrics(words)
    assert m["fillers"]["total"] == 6
    assert m["fillers"]["counts"]["um"] == 1


def test_stretched_hesitations_are_normalised():
    words = [{"word": w} for w in ["Ummm", "so", "uhh", "erm", "ahh", "hmm"]]
    assert [f["filler"] for f in find_fillers(words)] == ["um", "uh", "er", "ah", "hmm"]


def test_no_words_gives_no_metrics_and_untimed_words_use_duration():
    assert compute_speech_metrics([], 30) is None
    assert compute_speech_metrics(None) is None
    untimed = [{"word": f"w{i}"} for i in range(50)]
    m = compute_speech_metrics(untimed, duration_seconds=30)
    assert m["wpm"] == 100
    assert m["has_timing"] is False
    assert m["pauses"] == []


# ---------- Features 2 & 3: tense timeline + Vietlish (AI output validation) ----------

def test_normalize_drops_invalid_items_and_fixes_distribution():
    data = normalize_speech_intelligence({
        "tense_timeline": [
            {"sentence": " Last year I go to Da Nang. ", "tense": "PAST", "status": "Incorrect", "note_vi": "go -> went"},
            {"sentence": "", "tense": "past"},
            "not a dict",
            {"sentence": "I would love to go back.", "tense": "conditional", "status": "?"},
        ],
        "tense_distribution": {"past_pct": 33.3, "present_pct": 33.3, "future_pct": 33.3},
        "vietlish_warnings": [
            {"original_phrase": "open the light", "suggested_phrase": "turn on the light", "issue_vi": "Dịch từng chữ"},
            {"original_phrase": "missing suggestion"},
        ],
    })
    assert data["tense_timeline"] == [
        {"sentence": "Last year I go to Da Nang.", "tense": "past", "status": "incorrect", "note_vi": "go -> went"},
        {"sentence": "I would love to go back.", "tense": "mixed", "status": "correct", "note_vi": ""},
    ]
    assert sum(data["tense_distribution"].values()) == 100
    assert len(data["vietlish_warnings"]) == 1
    assert data["vietlish_warnings"][0]["explanation_vi"] == ""


def test_distribution_falls_back_to_counting_timeline():
    data = normalize_speech_intelligence({
        "tense_timeline": [
            {"sentence": "A.", "tense": "past"}, {"sentence": "B.", "tense": "past"},
            {"sentence": "C.", "tense": "present"}, {"sentence": "D.", "tense": "future"},
        ],
        "tense_distribution": "garbage",
    })
    assert data["tense_distribution"] == {"past_pct": 50, "present_pct": 25, "future_pct": 25}

    empty = normalize_speech_intelligence({})
    assert empty["tense_timeline"] == [] and empty["tense_distribution"] is None and empty["vietlish_warnings"] == []


# ---------- API: metrics stored per take and returned with the evaluation ----------

@pytest.fixture
def mock_llm(monkeypatch):
    monkeypatch.setattr(settings, "OPENAI_API_KEY", "")


def _start_session(client, email):
    token = client.post("/api/auth/register", json={"email": email, "password": "Password123!", "full_name": "SI"}).json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    sid = client.post("/api/sessions", json={"mode": "practice"}, headers=headers).json()["id"]
    client.post(f"/api/sessions/{sid}/survey", json={
        "occupation": "Working professional", "student_status": "Graduated", "living_situation": "Apartment alone",
        "leisure_activities": ["Parks"], "hobbies": ["Cooking"], "sports": ["Jogging"], "travel": ["Domestic trips"],
    }, headers=headers)
    client.post(f"/api/sessions/{sid}/self-assessment", json={"level": 4}, headers=headers)
    client.post(f"/api/sessions/{sid}/topics", json={"topics": ["environment", "global_workplace", "communication_media"]}, headers=headers)
    questions = client.get(f"/api/sessions/{sid}/questions", headers=headers).json()
    return headers, sid, questions


def test_evaluation_returns_speech_intelligence(client, mock_llm):
    headers, sid, questions = _start_session(client, "speech_intel@example.com")
    q = next(q for q in questions if q["question_type"] == "past_experience")

    ans = client.post("/api/answers", data={
        "question_id": q["id"], "session_id": sid, "duration_seconds": 40,
        "transcript_raw": "Um, last year I, like, go to Da Nang with my family and we have a great time.",
    }, headers=headers).json()
    take = ans["versions"][0]
    assert take["speech_metrics"]["total_words"] == 18
    assert take["speech_metrics"]["fillers"]["total"] == 2

    # A typed correction keeps the speech flow of the take it corrects
    edit = client.patch(f"/api/answers/{ans['id']}/transcript", json={
        "transcript_edited": "Last year I went to Da Nang with my family and we had a great time."
    }, headers=headers).json()
    assert edit["speech_metrics"] == take["speech_metrics"]

    ev = client.post(f"/api/answers/{ans['id']}/evaluate", headers=headers).json()
    assert ev["speech_metrics"]["wpm"] == take["speech_metrics"]["wpm"]
    assert ev["narrative_expected"] is True
    assert ev["tense_timeline"] and {t["tense"] for t in ev["tense_timeline"]} <= {"past", "present", "future", "mixed"}
    assert sum(ev["tense_distribution"].values()) == 100
    assert ev["vietlish_warnings"][0]["suggested_phrase"]

    # Cached evaluation comes back with the same extra fields
    again = client.post(f"/api/answers/{ans['id']}/evaluate", headers=headers).json()
    assert again["id"] == ev["id"] and again["speech_metrics"] == ev["speech_metrics"]


def test_description_question_is_not_narrative(client, mock_llm):
    headers, sid, questions = _start_session(client, "speech_intel2@example.com")
    q = next(q for q in questions if q["question_type"] == "description")
    ans = client.post("/api/answers", data={
        "question_id": q["id"], "session_id": sid, "duration_seconds": 20,
        "transcript_raw": "My apartment is small but cozy.",
    }, headers=headers).json()
    ev = client.post(f"/api/answers/{ans['id']}/evaluate", headers=headers).json()
    assert ev["narrative_expected"] is False
