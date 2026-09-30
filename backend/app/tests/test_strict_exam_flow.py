def _setup_session(client, email: str, strict: bool):
    reg = client.post("/api/auth/register", json={"email": email, "password": "Password123!", "full_name": "Strict Tester"})
    assert reg.status_code == 200
    headers = {"Authorization": f"Bearer {reg.json()['access_token']}"}

    session_id = client.post("/api/sessions", json={"mode": "practice"}, headers=headers).json()["id"]
    client.post(f"/api/sessions/{session_id}/survey", json={
        "occupation": "Working professional", "student_status": "Graduated", "living_situation": "Apartment alone",
        "leisure_activities": ["Going to cafes"], "hobbies": ["Cooking"], "sports": ["Jogging"], "travel": ["Domestic trips"]
    }, headers=headers)
    # Real flow: topics first, then self-assessment (with the strict toggle) generates the questions
    client.post(f"/api/sessions/{session_id}/topics", json={"topics": ["environment", "global_workplace", "communication_media"]}, headers=headers)
    assess = client.post(f"/api/sessions/{session_id}/self-assessment", json={"level": 4, "strict_mode": strict}, headers=headers)
    assert assess.status_code == 200
    return session_id, headers, assess.json()


def test_strict_mode_skips_are_final_and_report_lists_all_questions(client):
    session_id, headers, assess = _setup_session(client, "strict_on@example.com", strict=True)
    assert assess["mode"] == "exam"
    assert assess["total_questions"] == 15

    # Skip Q1 and Q2 without recording
    for order in (1, 2):
        assert client.post(f"/api/sessions/{session_id}/questions/{order}/skip", headers=headers).json()["skipped"] is True

    # "Exit and resume": no after_order -> continues at Q3, skipped questions never come back
    q3 = client.get(f"/api/sessions/{session_id}/next-question", headers=headers).json()
    assert q3["order_index"] == 3

    ans = client.post("/api/answers", data={
        "question_id": q3["id"], "session_id": session_id, "duration_seconds": 70,
        "transcript_raw": "On weekdays I usually wake up at six, make coffee and cook breakfast for myself before work."
    }, headers=headers)
    assert ans.status_code == 200

    assert client.post(f"/api/sessions/{session_id}/finish", headers=headers).status_code == 200
    report = client.get(f"/api/sessions/{session_id}/report", headers=headers).json()

    rows = {r["question_num"]: r for r in report["per_question_summary"]}
    assert sorted(rows) == list(range(1, 16))
    assert rows[1]["status"] == "unscored"
    assert rows[2]["status"] == "skipped"
    assert rows[3]["status"] == "scored"  # evaluated at report time
    assert rows[3]["question_text"] and rows[3]["transcript"]
    assert rows[4]["status"] == "unanswered"


def test_practice_mode_skip_keeps_question_open(client):
    session_id, headers, assess = _setup_session(client, "strict_off@example.com", strict=False)
    assert assess["mode"] == "practice"

    assert client.post(f"/api/sessions/{session_id}/questions/2/skip", headers=headers).json()["skipped"] is False
    # Moving on from Q2 goes to Q3; Q2 stays unanswered and can be revisited
    nxt = client.get(f"/api/sessions/{session_id}/next-question?after_order=2", headers=headers).json()
    assert nxt["order_index"] == 3
    q2 = client.get(f"/api/sessions/{session_id}/questions/2", headers=headers)
    assert q2.status_code == 200
