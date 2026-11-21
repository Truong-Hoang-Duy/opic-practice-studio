import os
import numpy as np
import soundfile as sf
from app.services import playlist_service


def _session_with_questions(client, email: str):
    reg = client.post("/api/auth/register", json={"email": email, "password": "Password123!", "full_name": "Library Tester"})
    headers = {"Authorization": f"Bearer {reg.json()['access_token']}"}
    sid = client.post("/api/sessions", json={"mode": "practice"}, headers=headers).json()["id"]
    client.post(f"/api/sessions/{sid}/survey", json={
        "occupation": "Working professional", "student_status": "Graduated", "living_situation": "Apartment alone",
        "leisure_activities": ["Going to cafes"], "hobbies": ["Cooking"], "sports": ["Jogging"], "travel": ["Domestic trips"]
    }, headers=headers)
    client.post(f"/api/sessions/{sid}/topics", json={"topics": ["environment", "global_workplace", "communication_media"]}, headers=headers)
    client.post(f"/api/sessions/{sid}/self-assessment", json={"level": 5, "strict_mode": False}, headers=headers)
    return sid, headers


def test_library_lists_question_sets_and_requires_model_answers_for_playlist(client):
    sid, headers = _session_with_questions(client, "library@example.com")

    library = client.get("/api/library", headers=headers).json()
    assert len(library) == 1
    qset = library[0]
    assert qset["session_id"] == sid
    assert qset["default_model_level"] == "IH"  # level 5
    assert len(qset["questions"]) == 15
    assert qset["questions"][0]["model_answers"] == []

    assert qset["questions"][1]["category"] == "home"
    assert qset["questions"][1]["timing"]["time_limit_sec"] > 0

    # Q1 (fixed self-introduction) is never part of a listening playlist
    q1 = qset["questions"][0]["id"]
    assert client.post("/api/library/playlist", json={"question_ids": [q1]}, headers=headers).status_code == 422

    q2 = qset["questions"][1]["id"]
    resp = client.post("/api/library/playlist", json={"question_ids": [q2]}, headers=headers)
    assert resp.status_code == 409
    assert resp.json()["detail"]["missing_question_ids"] == [q2]

    # Another learner cannot use these questions
    other = client.post("/api/auth/register", json={"email": "intruder@example.com", "password": "Password123!", "full_name": "X"})
    other_headers = {"Authorization": f"Bearer {other.json()['access_token']}"}
    assert client.post("/api/library/playlist", json={"question_ids": [q2]}, headers=other_headers).status_code == 404


def test_playlist_builder_concatenates_segments(tmp_path, monkeypatch):
    monkeypatch.setattr(playlist_service.settings, "AUDIO_CACHE_DIR", str(tmp_path))
    monkeypatch.setattr(playlist_service.settings, "TTS_PROVIDER", "edge")

    def fake_synthesize(text):
        name = f"eva_{abs(hash(text))}.mp3"
        path = os.path.join(str(tmp_path), name)
        if not os.path.exists(path):
            sf.write(path, np.full(24000, 0.1, dtype="float32"), 24000)  # 1 second
        return f"/data/audio_cache/{name}"

    monkeypatch.setattr(playlist_service, "synthesize_speech", fake_synthesize)
    segments = [{"kind": "question", "text": "Question one?"}, {"kind": "answer", "text": "Answer one."}]
    key = playlist_service.playlist_key(segments)
    playlist_service._build(key, segments)

    status = playlist_service.request_playlist(segments)
    assert status["ready"] is True
    data, sr = sf.read(os.path.join(str(tmp_path), "playlists", f"playlist_{key}.mp3"))
    expected = 2 + playlist_service.GAP_AFTER_QUESTION_SEC + playlist_service.GAP_BETWEEN_ITEMS_SEC
    assert abs(len(data) / sr - expected) < 0.3


def test_playlist_builder_fast_path_cbr_mp3_and_error_recovery(tmp_path, monkeypatch):
    """Edge TTS 48kbps 24kHz mono CBR MP3s concatenate directly via fast path with exact duration."""
    monkeypatch.setattr(playlist_service.settings, "AUDIO_CACHE_DIR", str(tmp_path))
    monkeypatch.setattr(playlist_service.settings, "TTS_PROVIDER", "edge")

    # Build two valid 1.2s Edge-format CBR MP3 clips (50 frames x 144 bytes = 7200 bytes)
    one_clip = playlist_service.SILENT_EDGE_FRAME * 50

    def fake_edge_synth(text):
        name = f"eva_{abs(hash(text))}.mp3"
        path = os.path.join(str(tmp_path), name)
        if not os.path.exists(path):
            with open(path, "wb") as fp:
                fp.write(one_clip)
        return f"/data/audio_cache/{name}"

    monkeypatch.setattr(playlist_service, "synthesize_speech", fake_edge_synth)
    monkeypatch.setattr(playlist_service, "cached_speech_url", lambda text: None)

    segments = [
        {"kind": "question", "text": "Fast path question?"},
        {"kind": "answer", "text": "Fast path answer."},
    ]
    key = playlist_service.playlist_key(segments)
    playlist_service._build(key, segments)

    out_path = os.path.join(str(tmp_path), "playlists", f"playlist_{key}.mp3")
    assert os.path.exists(out_path)
    assert playlist_service._is_uniform_edge_mp3(out_path)
    meta = playlist_service.get_playlist_file_meta(key)
    expected = 1.2 + playlist_service.GAP_AFTER_QUESTION_SEC + 1.2 + playlist_service.GAP_BETWEEN_ITEMS_SEC
    assert meta["exists"] is True
    assert abs(meta["duration_seconds"] - expected) < 0.08

    # Error reporting does not silently loop forever until force_retry=True
    monkeypatch.setattr(playlist_service, "synthesize_speech", lambda text: None)
    bad_segments = [{"kind": "question", "text": "Broken segment"}]
    bad_key = playlist_service.playlist_key(bad_segments)
    playlist_service._build(bad_key, bad_segments)
    err_status = playlist_service.request_playlist(bad_segments)
    assert err_status["status"] == "error"
    assert err_status["error"]


def test_saved_playlists_crud_and_rebuild(client, tmp_path, monkeypatch):
    monkeypatch.setattr(playlist_service.settings, "AUDIO_CACHE_DIR", str(tmp_path))
    monkeypatch.setattr(playlist_service.settings, "TTS_PROVIDER", "edge")
    monkeypatch.setattr("app.services.tts_service.settings.AUDIO_CACHE_DIR", str(tmp_path))
    monkeypatch.setattr("app.services.tts_service.settings.TTS_PROVIDER", "edge")

    one_clip = playlist_service.SILENT_EDGE_FRAME * 50

    def fake_edge_synth(text):
        name = f"eva_{abs(hash(text))}.mp3"
        path = os.path.join(str(tmp_path), name)
        if not os.path.exists(path):
            with open(path, "wb") as fp:
                fp.write(one_clip)
        return f"/data/audio_cache/{name}"

    monkeypatch.setattr(playlist_service, "synthesize_speech", fake_edge_synth)

    # Run _executor.submit synchronously inside test so build completes deterministically
    class _SyncExecutor:
        def submit(self, fn, *args, **kwargs):
            fn(*args, **kwargs)

    monkeypatch.setattr(playlist_service, "_executor", _SyncExecutor())

    sid, headers = _session_with_questions(client, "saved_pl@example.com")
    lib = client.get("/api/library", headers=headers).json()
    q2 = lib[0]["questions"][1]
    assert client.get(f"/api/questions/{q2['id']}/model-answers", headers=headers).status_code == 200

    # Create & auto-save playlist
    build_res = client.post(
        "/api/library/playlist",
        json={"question_ids": [q2["id"]], "level": "IH", "title": "Chủ đề Nhà ở · IH", "session_id": sid},
        headers=headers,
    )
    assert build_res.status_code == 200
    pl_id = build_res.json()["playlist_id"]

    # List saved playlists -> file is built & ready on disk
    listed = client.get("/api/library/playlists", headers=headers).json()
    assert len(listed) == 1
    assert listed[0]["id"] == pl_id
    assert listed[0]["title"] == "Chủ đề Nhà ở · IH"
    assert listed[0]["status"] == "ready"
    assert listed[0]["file_available"] is True
    assert listed[0]["duration_seconds"] > 0

    # Rename saved playlist
    renamed = client.patch(f"/api/library/playlists/{pl_id}", json={"title": "Nghe sáng - Nhà ở"}, headers=headers)
    assert renamed.status_code == 200
    assert renamed.json()["title"] == "Nghe sáng - Nhà ở"

    # Lightweight single-PK status endpoint returns ready metadata without joins
    st_res = client.get(f"/api/library/playlists/{pl_id}/status", headers=headers)
    assert st_res.status_code == 200
    assert st_res.json()["ready"] is True
    assert st_res.json()["file_available"] is True
    assert st_res.json()["url"] == listed[0]["audio_path"]

    # Simulate ephemeral disk restart: delete MP3 file -> file_available becomes False -> rebuild restores it
    key = listed[0]["playlist_key"]
    assert playlist_service.delete_playlist_file(key) is True
    after_wipe = client.get("/api/library/playlists", headers=headers).json()
    assert after_wipe[0]["file_available"] is False

    rebuilt = client.post(f"/api/library/playlists/{pl_id}/rebuild", headers=headers)
    assert rebuilt.status_code == 200
    after_rebuild = client.get("/api/library/playlists", headers=headers).json()
    assert after_rebuild[0]["file_available"] is True
    assert after_rebuild[0]["status"] == "ready"

    # Delete saved playlist cleans up DB row and disk MP3
    deleted = client.delete(f"/api/library/playlists/{pl_id}", headers=headers)
    assert deleted.status_code == 200
    assert client.get("/api/library/playlists", headers=headers).json() == []
    assert playlist_service.get_playlist_file_meta(key)["exists"] is False


def test_tts_sanitization_and_lru_cache_pruning(tmp_path):
    from app.services.tts_service import sanitize_tts_text

    # Markdown stripped, whitespace collapsed, punctuation-only returns empty so edge-tts never gets NoAudioReceived
    assert sanitize_tts_text("  **Hello**   world!  ") == "Hello world!"
    assert sanitize_tts_text("...") == ""
    assert sanitize_tts_text("— ! ?") == ""

    # LRU cache pruner removes oldest files beyond byte cap while protecting active files
    f1 = tmp_path / "playlist_old.mp3"
    f2 = tmp_path / "playlist_mid.mp3"
    f3 = tmp_path / "playlist_new.mp3"
    f1.write_bytes(b"a" * 100)
    f2.write_bytes(b"b" * 100)
    f3.write_bytes(b"c" * 100)
    os.utime(f1, (1000, 1000))
    os.utime(f2, (2000, 2000))
    os.utime(f3, (3000, 3000))

    removed = playlist_service.prune_directory_lru(
        str(tmp_path), max_bytes=200, prefix="playlist_", protect_paths={str(f1)}
    )
    assert removed == 1
    assert f1.exists()  # protected even though oldest
    assert not f2.exists()  # pruned
    assert f3.exists()  # kept within budget


def test_unlimited_curriculum_sync_deduplicates_and_prioritizes(client, monkeypatch):
    """Unlimited topic selection deduplicates by canonical_key, preserves learned status, and supports variants + prioritize."""
    from app.services import study_pack_service

    # Keep background generation deterministic in test (we test click-to-prioritize explicitly below)
    monkeypatch.setattr(study_pack_service, "start_study_pack_generation", lambda *a, **kw: False)

    reg = client.post("/api/auth/register", json={"email": "unlimited@example.com", "password": "Password123!", "full_name": "Unlimited Learner"})
    headers = {"Authorization": f"Bearer {reg.json()['access_token']}"}

    # 1. Catalog lists all 5 groups, >= 50 curated topics, and 20 diverse Role-Play scenarios
    cat = client.get("/api/library/catalog", headers=headers).json()
    assert len(cat["groups"]) == 5
    assert len(cat["topics"]) >= 50
    rp_topics = [t for t in cat["topics"] if t["group"] == "role_play"]
    assert len(rp_topics) == 20

    # 2. Sync ALL 5 official topics + 2 home + 6 leisure + 4 role-play + 5 unexpected + 2 custom = > 65 slots at once!
    all_official = ["environment", "human_rights", "global_workplace", "socio_cultural", "communication_media"]
    topic_ids = (
        ["home_living", "staycation"]
        + ["go to the movies", "go to parks", "listen to music", "cook", "walk", "going to cafes"]
        + all_official
        + ["rp_movie_dinner", "rp_hotel", "rp_shopping_return", "rp_gym_membership"]
        + ["unexp_weather", "unexp_neighborhood", "unexp_phone_shopping", "unexp_health", "unexp_transport"]
    )
    first_sync = client.post(
        "/api/library/curriculum/sync",
        json={
            "target_level": "IM",
            "topic_ids": topic_ids,
            "custom_topics": ["Samsung Factory Work", "Raising Kids"],
            "dev_mock": True,
        },
        headers=headers,
    )
    assert first_sync.status_code == 200
    first_data = first_sync.json()
    assert first_data["total"] >= 65
    assert first_data["added_slots"] == first_data["total"]

    # Mark first Home slot as mastered and prioritize its model answer immediately
    lib1 = client.get("/api/library", headers=headers).json()
    assert len(lib1) == 1
    home_q = lib1[0]["questions"][0]
    assert home_q["canonical_key"] == "home:home_living:description"
    assert len(home_q["prompt_variants"]) >= 1

    assert client.patch(f"/api/library/questions/{home_q['id']}/study-status", json={"study_status": "mastered"}, headers=headers).status_code == 200
    prio = client.post(f"/api/library/questions/{home_q['id']}/prioritize?level=IM", headers=headers)
    assert prio.status_code == 200
    assert prio.json()["level"] == "IM"
    assert len(prio.json()["text"]) > 10

    # 3. Re-syncing overlapping topics + 1 brand-new topic MUST NOT duplicate existing slots or lose mastered progress!
    second_sync = client.post(
        "/api/library/curriculum/sync",
        json={
            "target_level": "IM",
            "topic_ids": ["home_living", "environment", "unexp_restaurants"],
            "dev_mock": True,
        },
        headers=headers,
    )
    assert second_sync.status_code == 200
    second_data = second_sync.json()
    assert second_data["preserved_slots"] == 6  # home_living (3) + environment (3) untouched
    assert second_data["added_slots"] == 3      # only unexp_restaurants (3) added
    assert second_data["total"] == first_data["total"] + 3

    # Verify still only 1 unified Master Pack, mastered status + model answer preserved
    lib2 = client.get("/api/library", headers=headers).json()
    assert len(lib2) == 1
    refreshed_home = next(q for q in lib2[0]["questions"] if q["id"] == home_q["id"])
    assert refreshed_home["study_status"] == "mastered"
    assert len(refreshed_home["model_answers"]) == 1

    # 4. Attach a custom prompt variant + bridge line to the same Master Slot
    var_res = client.post(
        f"/api/library/questions/{home_q['id']}/variants",
        json={"label": "Hỏi khu vực sống", "question": "Where is your house located and what furniture do you have?", "bridge": "Regarding my home location..."},
        headers=headers,
    )
    assert var_res.status_code == 200
    assert any(v["label"] == "Hỏi khu vực sống" for v in var_res.json()["prompt_variants"])

    # 5. Delete a single unwanted slot cleanly
    last_q = lib2[0]["questions"][-1]
    assert client.delete(f"/api/library/questions/{last_q['id']}", headers=headers).status_code == 200
    lib3 = client.get("/api/library", headers=headers).json()
    assert len(lib3[0]["questions"]) == second_data["total"] - 1


def test_library_returns_existing_answer_and_reuses_first_model_answers(client):
    sid1, headers = _session_with_questions(client, "library_reuse@example.com")
    lib1 = client.get("/api/library", headers=headers).json()
    q2_s1 = lib1[0]["questions"][1]

    # Submit an answer for Q2 in Session 1
    ans_res = client.post("/api/answers", data={
        "question_id": q2_s1["id"],
        "session_id": sid1,
        "duration_seconds": 65,
        "transcript_raw": "I live in a bright apartment with my parents.",
    }, headers=headers)
    assert ans_res.status_code == 200

    # Generate model answers for Q2 in Session 1
    models_s1 = client.get(f"/api/questions/{q2_s1['id']}/model-answers", headers=headers).json()
    assert len(models_s1) == 3

    # Create a second session for the same user (shares Q1 self-intro and any matching questions)
    sid2 = client.post("/api/sessions", json={"mode": "practice"}, headers=headers).json()["id"]
    client.post(f"/api/sessions/{sid2}/survey", json={
        "occupation": "Working professional", "student_status": "Graduated", "living_situation": "Apartment alone",
        "leisure_activities": ["Going to cafes"], "hobbies": ["Cooking"], "sports": ["Jogging"], "travel": ["Domestic trips"]
    }, headers=headers)
    client.post(f"/api/sessions/{sid2}/topics", json={"topics": ["environment", "global_workplace", "communication_media"]}, headers=headers)
    client.post(f"/api/sessions/{sid2}/self-assessment", json={"level": 5, "strict_mode": False, "use_ai": False}, headers=headers)

    lib2 = client.get("/api/library", headers=headers).json()
    s1_in_lib = next(s for s in lib2 if s["session_id"] == sid1)
    assert s1_in_lib["questions"][1]["existing_answer"] is not None
    assert s1_in_lib["questions"][1]["existing_answer"]["id"] == ans_res.json()["id"]

    # Calling get_model_answers with regenerate=true replaces the model answers
    regenerated = client.get(f"/api/questions/{q2_s1['id']}/model-answers?regenerate=true", headers=headers).json()
    assert len(regenerated) == 3


def test_self_assessment_filters_15_questions_from_study_pack(client):
    reg = client.post(
        "/api/auth/register",
        json={"email": "pack_filter_exam@example.com", "password": "Password123!", "full_name": "Pack Filter"},
    )
    assert reg.status_code == 200
    headers = {"Authorization": f"Bearer {reg.json()['access_token']}"}

    # Seed a Study Pack containing Home, Parks, Movies, Environment, Global Workplace, Communication Media, and Role-Play
    sync = client.post(
        "/api/library/curriculum/sync",
        json={
            "target_level": "IM",
            "topic_ids": [
                "home_living",
                "go to parks",
                "go to the movies",
                "environment",
                "global_workplace",
                "communication_media",
                "rp_hotel",
            ],
            "dev_mock": True,
        },
        headers=headers,
    )
    assert sync.status_code == 200

    # Walk through the EXACT same setup steps as Real Exam, choosing Parks + Environment/Global Workplace/Communication Media
    sid = client.post("/api/sessions", json={"mode": "practice"}, headers=headers).json()["id"]
    assert client.post(
        f"/api/sessions/{sid}/survey",
        json={
            "occupation": "Working professional",
            "student_status": "Graduated",
            "living_situation": "House with family",
            "leisure_activities": ["Going to parks"],
            "hobbies": [],
            "sports": [],
            "travel": [],
        },
        headers=headers,
    ).status_code == 200
    assert client.post(
        f"/api/sessions/{sid}/topics",
        json={"topics": ["environment", "global_workplace", "communication_media"]},
        headers=headers,
    ).status_code == 200

    assess = client.post(
        f"/api/sessions/{sid}/self-assessment",
        json={"level": 5, "strict_mode": False, "from_study_pack": True, "use_ai": False},
        headers=headers,
    )
    assert assess.status_code == 200
    body = assess.json()
    assert body["question_source"] == "study_pack"
    assert body["mode"] == "practice"
    assert body["total_questions"] == 15

    # Verify Q1 self_intro, Q5-Q7 matched "Going to Parks" from survey, Q8-Q10 matched "environment", Q11-Q13 role-play
    q1 = client.get(f"/api/sessions/{sid}/questions/1", headers=headers).json()
    q5 = client.get(f"/api/sessions/{sid}/questions/5", headers=headers).json()
    q8 = client.get(f"/api/sessions/{sid}/questions/8", headers=headers).json()
    q11 = client.get(f"/api/sessions/{sid}/questions/11", headers=headers).json()
    assert q1["question_type"] == "self_intro"
    assert "park" in q5["topic"].lower()
    assert q8["category"] == "environment"
    assert q11["category"] == "role_play"
