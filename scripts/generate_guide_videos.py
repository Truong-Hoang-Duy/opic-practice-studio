"""
Automated Studio Tutorial Video Generator for OPIc Practice Studio.
- Calm, unhurried, human-like narration (VieNeu-TTS v3 Turbo 'Mai Anh' for VI, Copilot HD 'Emma' for EN)
- Sentence-by-sentence exact audio & word-for-word Closed Caption (CC / WebVTT) synchronization
- Live requestAnimationFrame element-tracking spotlight (zero drift on layout shifts, auto-hides on click)
- Real live production UI recorded via Playwright + H.264 MP4 + broadcast loudnorm (-16 LUFS)

Uses an isolated temporary SQLite database so Neon/local dev DB is never touched.
"""
import asyncio
import datetime
import hashlib
import json
import os
import re
import shutil
import socket
import subprocess
import sys
import tempfile
import time
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import edge_tts
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
BACKEND_DIR = ROOT / "backend"
OUT_DIR = ROOT / "frontend" / "public" / "tutorials"
OUT_DIR.mkdir(parents=True, exist_ok=True)
TTS_CACHE_DIR = ROOT / "backend" / "data" / "tmp_guide_tts_cache"

sys.path.insert(0, str(BACKEND_DIR))

PORT = 8011
BASE_URL = f"http://127.0.0.1:{PORT}"
DEMO_EMAIL = "demo@opicstudio.app"
DEMO_PASS = "DemoPass123!"

SENTENCE_GAP_SEC = 0.52  # Calm natural breathing pause between sentences
BEAT_TAIL_GAP_SEC = 0.85  # Gentle calm pause before moving to the next scene

VOICE_CFG = {
    "vi": {"voice": "vi-VN-HoaiMyNeural", "fallback": "en-US-AvaMultilingualNeural", "rate": "-10%"},
    "en": {"voice": "en-US-EmmaMultilingualNeural", "fallback": "en-US-AvaNeural", "rate": "-12%"},
}

CHAPTER_DEFS = {
    "vi": [
        {
            "id": "overview",
            "index": 1,
            "title": "Làm quen giao diện",
            "summary": "5 mục chính, đổi ngôn ngữ VI/EN, Sáng/Tối và vòng tiến độ.",
            "actionTab": "dashboard",
            "actionLabel": "Trang chủ",
        },
        {
            "id": "study_hub",
            "index": 2,
            "title": "Học trong Kho ôn tập",
            "summary": "Lọc chủ đề 2 tầng, 1 bài mẫu nhiều biến thể, Điền khuyết & MP3.",
            "actionTab": "library",
            "actionLabel": "Kho ôn tập",
        },
        {
            "id": "mock_exam",
            "index": 3,
            "title": "Thi thử 15 câu với Eva",
            "summary": "Thi thật (ẩn đề, chấm cuối) vs Thi từ bộ đề (hiện đề, chấm ngay).",
            "actionTab": "mock_center",
            "actionLabel": "Thi thử",
        },
        {
            "id": "report",
            "index": 4,
            "title": "Báo cáo AI & Tiến độ",
            "summary": "Biểu đồ Radar 6 tiêu chí, điểm mạnh, lỗi sửa, lộ trình 4 tuần & PDF.",
            "actionTab": "history",
            "actionLabel": "Tiến độ",
        },
    ],
    "en": [
        {
            "id": "overview",
            "index": 1,
            "title": "Studio Overview",
            "summary": "5 main tabs, VI/EN mode, Light/Dark themes, and mastery ring.",
            "actionTab": "dashboard",
            "actionLabel": "Home",
        },
        {
            "id": "study_hub",
            "index": 2,
            "title": "Master the Study Hub",
            "summary": "2-tier topic filter, master scripts, Cloze drills, MP3 & Vocab.",
            "actionTab": "library",
            "actionLabel": "Study Hub",
        },
        {
            "id": "mock_exam",
            "index": 3,
            "title": "15-Question Mock Exam",
            "summary": "Real Exam (blind, final score) vs Study Pack (visible, instant).",
            "actionTab": "mock_center",
            "actionLabel": "Mock Test",
        },
        {
            "id": "report",
            "index": 4,
            "title": "AI Report & Progress",
            "summary": "6-criteria Radar chart, strengths, 4-week study plan & PDF export.",
            "actionTab": "history",
            "actionLabel": "Progress",
        },
    ],
}

# Each beat contains an ordered list of (tts_spoken_text, exact_word_for_word_cc_text) sentences.
# This guarantees Closed Captions (CC) match the narrator word-for-word and update sentence-by-sentence!
BEATS: Dict[str, List[Tuple[str, str, List[Tuple[str, str]]]]] = {
    "vi": [
        (
            "overview",
            "b1_nav",
            [
                ("Chào mừng bạn đến với Ô pích Sờ tu đi ô.", "Chào mừng bạn đến với OPIc Studio."),
                ("Bên trái là năm khu vực chính, gồm Trang chủ, Kho ôn tập, Thi thử, Tiến độ và Hướng dẫn.", "Bên trái là 5 khu vực chính: Trang chủ, Kho ôn tập, Thi thử, Tiến độ và Hướng dẫn."),
            ],
        ),
        (
            "overview",
            "b1_settings",
            [
                ("Ở góc dưới bên trái, bạn có thể đổi nhanh ngôn ngữ hiển thị giữa Tiếng Việt và Tiếng Anh.", "Ở góc dưới bên trái, bạn có thể đổi nhanh ngôn ngữ hiển thị giữa Tiếng Việt và Tiếng Anh."),
                ("Ngay bên dưới là nút chuyển chế độ Sáng và Tối cho dịu mắt.", "Ngay bên dưới là nút chuyển chế độ Sáng và Tối cho dịu mắt."),
            ],
        ),
        (
            "overview",
            "b1_cards",
            [
                ("Trên Trang chủ, vòng tròn bên phải cho biết tỷ lệ câu bạn đã thuộc.", "Trên Trang chủ, vòng tròn bên phải cho biết tỷ lệ câu bạn đã thuộc."),
                ("Hai thẻ lớn bên dưới giúp bạn vào nhanh luyện nói ngẫu nhiên, ôn bài mẫu hoặc bắt đầu thi thử.", "Hai thẻ lớn bên dưới giúp bạn vào nhanh luyện nói ngẫu nhiên, ôn bài mẫu hoặc bắt đầu thi thử."),
            ],
        ),
        (
            "study_hub",
            "b2_open",
            [
                ("Bước đầu tiên cho người mới là mở Kho ôn tập.", "Bước đầu tiên cho người mới là mở Kho ôn tập."),
                ("Bạn có thể lọc hai tầng: chọn nhóm lớn ở trên, rồi chạm chủ đề con bên dưới như Nghe nhạc để xem gọn đúng chủ đề đó.", "Bạn có thể lọc 2 tầng: chọn nhóm lớn ở trên, rồi chạm chủ đề con bên dưới như Listening to Music để xem gọn đúng chủ đề đó."),
            ],
        ),
        (
            "study_hub",
            "b2_variants",
            [
                ("Mỗi chủ đề giữ một bài mẫu gốc chuẩn, và gộp sẵn các cách hỏi biến thể của giám khảo Ê va.", "Mỗi chủ đề giữ một bài mẫu gốc chuẩn và gộp sẵn các cách hỏi biến thể của giám khảo Eva."),
                ("Nhờ đó, bạn chỉ cần học ít nhưng vẫn tự tin trả lời nhiều dạng câu hỏi khác nhau.", "Nhờ đó, bạn chỉ cần học ít nhưng vẫn tự tin trả lời nhiều dạng câu hỏi khác nhau."),
            ],
        ),
        (
            "study_hub",
            "b2_modes",
            [
                ("Bạn có thể bấm nút Dịch để xem nghĩa tiếng Việt, hoặc chuyển sang Điền khuyết để luyện nhớ từ khóa.", "Bạn có thể bấm nút Dịch để xem nghĩa tiếng Việt, hoặc chuyển sang Điền khuyết để luyện nhớ từ khóa."),
                ("Sau đó, bấm Luyện nói ngay bên dưới để ghi âm và nhận chấm điểm trực tiếp.", "Sau đó, bấm Luyện nói ngay bên dưới để ghi âm và nhận chấm điểm trực tiếp."),
            ],
        ),
        (
            "study_hub",
            "b2_audio_vocab",
            [
                ("Ngoài ra, mục Nghe giúp ghép các bài mẫu thành một tệp âm thanh để bạn nghe ngay cả khi tắt màn hình điện thoại.", "Ngoài ra, mục Nghe giúp ghép các bài mẫu thành một tệp MP3 để bạn nghe ngay cả khi tắt màn hình điện thoại."),
                ("Còn mục Từ vựng lưu lại toàn bộ các cụm từ hay để nâng điểm nói.", "Còn mục Từ vựng lưu lại toàn bộ các cụm từ hay để nâng điểm nói."),
            ],
        ),
        (
            "mock_exam",
            "b3_center",
            [
                ("Khi đã quen bài, bạn chuyển sang mục Thi thử.", "Khi đã quen bài, bạn chuyển sang mục Thi thử."),
                ("Có hai chế độ rõ ràng: Thi thật với đề mới ẩn chữ câu hỏi, hoặc Thi từ bộ đề lọc mười lăm câu từ kho bạn đã học.", "Có hai chế độ rõ ràng: Thi thật với đề mới ẩn chữ câu hỏi, hoặc Thi từ bộ đề lọc 15 câu từ kho bạn đã học."),
            ],
        ),
        (
            "mock_exam",
            "b3_step1",
            [
                ("Cả hai chế độ đều đi qua năm bước chuẩn phòng thi.", "Cả hai chế độ đều đi qua 5 bước chuẩn phòng thi."),
                ("Ở bước một, bạn có thể đọc câu mẫu để kiểm tra mic với thanh sóng âm trực tiếp, và kiểm tra video mẫu của Ê va.", "Ở Bước 1, bạn có thể đọc câu mẫu để kiểm tra micro với thanh sóng âm trực tiếp và kiểm tra video mẫu của Eva."),
            ],
        ),
        (
            "mock_exam",
            "b3_steps234",
            [
                ("Tiếp theo, bạn chọn nhanh Khảo sát nền ở bước hai, rồi chọn đúng ba chủ đề chính ở bước ba.", "Tiếp theo, bạn chọn nhanh Khảo sát nền ở Bước 2, rồi chọn đúng 3 chủ đề chính ở Bước 3."),
                ("Cuối cùng, chọn mức độ từ ba đến sáu ở bước bốn để vào phòng thi mười lăm câu.", "Cuối cùng, chọn mức độ từ Level 3 đến 6 ở Bước 4 để vào phòng thi 15 câu."),
            ],
        ),
        (
            "report",
            "b4_history",
            [
                ("Mục Tiến độ lưu toàn bộ lịch sử các bài thi của bạn.", "Mục Tiến độ lưu toàn bộ lịch sử các bài thi của bạn."),
                ("Bạn có thể làm tiếp bài đang dở, hoặc bấm vào Báo cáo để xem kết quả chi tiết.", "Bạn có thể làm tiếp bài đang dở, hoặc bấm vào Báo cáo để xem kết quả chi tiết."),
            ],
        ),
        (
            "report",
            "b4_report",
            [
                ("Trong báo cáo, hệ thống chấm sáu tiêu chí trên biểu đồ Ra đa, chỉ rõ điểm mạnh, lỗi cần sửa và lộ trình bốn tuần.", "Trong báo cáo, hệ thống chấm 6 tiêu chí trên biểu đồ Radar, chỉ rõ điểm mạnh, lỗi cần sửa và lộ trình 4 tuần."),
                ("Bạn cũng có thể tải tệp báo cáo về máy. Chúc bạn luyện nói thật tự tin mỗi ngày!", "Bạn cũng có thể tải file PDF về máy. Chúc bạn luyện nói thật tự tin mỗi ngày!"),
            ],
        ),
    ],
    "en": [
        (
            "overview",
            "b1_nav",
            [
                ("Welcome to OPIc Practice Studio.", "Welcome to OPIc Practice Studio."),
                ("On the left are five main sections: Home, Study Hub, Mock Test, Progress, and Guide.", "On the left are five main sections: Home, Study Hub, Mock Test, Progress, and Guide."),
            ],
        ),
        (
            "overview",
            "b1_settings",
            [
                ("At the bottom left, you can switch display language between Vietnamese and English anytime.", "At the bottom left, you can switch display language between Vietnamese and English anytime."),
                ("Right below it, you can toggle smoothly between Light and Dark mode.", "Right below it, you can toggle smoothly between Light and Dark mode."),
            ],
        ),
        (
            "overview",
            "b1_cards",
            [
                ("On Home, the mastery ring shows how many questions you have mastered.", "On Home, the mastery ring shows how many questions you have mastered."),
                ("The two cards below let you jump straight into random drills, script recall, or a mock exam.", "The two cards below let you jump straight into random drills, script recall, or a mock exam."),
            ],
        ),
        (
            "study_hub",
            "b2_open",
            [
                ("Your best starting point is Study Hub.", "Your best starting point is Study Hub."),
                ("Use the two-tier filter: select a broad group on top, then tap a sub-topic like Listening to Music below.", "Use the two-tier filter: select a broad group on top, then tap a sub-topic like Listening to Music below."),
            ],
        ),
        (
            "study_hub",
            "b2_variants",
            [
                ("Each topic stores one clean master script and groups Eva's prompt variations together.", "Each topic stores one clean master script and groups Eva's prompt variations together."),
                ("That way, you study less while staying ready for many different ways Eva might ask.", "That way, you study less while staying ready for many different ways Eva might ask."),
            ],
        ),
        (
            "study_hub",
            "b2_modes",
            [
                ("Switch from Read mode to Cloze fill-in-the-blanks to test your memory naturally.", "Switch from Read mode to Cloze fill-in-the-blanks to test your memory naturally."),
                ("Then click Speak at the bottom to record your voice and receive instant AI grading.", "Then click Speak at the bottom to record your voice and receive instant AI grading."),
            ],
        ),
        (
            "study_hub",
            "b2_audio_vocab",
            [
                ("The Audio tab combines prompts and model answers into one MP3 track for lock-screen listening.", "The Audio tab combines prompts and model answers into one MP3 track for lock-screen listening."),
                ("Meanwhile, the Vocab tab keeps all your saved higher-band expressions.", "Meanwhile, the Vocab tab keeps all your saved higher-band expressions."),
            ],
        ),
        (
            "mock_exam",
            "b3_center",
            [
                ("When you feel ready, open Mock Test.", "When you feel ready, open Mock Test."),
                ("Choose Real Exam for a fresh blind AI set, or From Study Pack to filter fifteen questions you already studied.", "Choose Real Exam for a fresh blind AI set, or From Study Pack to filter 15 questions you already studied."),
            ],
        ),
        (
            "mock_exam",
            "b3_step1",
            [
                ("Both modes walk you through five realistic setup steps.", "Both modes walk you through five realistic setup steps."),
                ("In Step 1, test your microphone using the read-aloud sample with live audio bars, and preview Eva's video stream.", "In Step 1, test your microphone using the read-aloud sample with live audio bars, and preview Eva's video stream."),
            ],
        ),
        (
            "mock_exam",
            "b3_steps234",
            [
                ("Next, complete the Background Survey in Step 2, and select exactly three core topics in Step 3.", "Next, complete the Background Survey in Step 2, and select exactly three core topics in Step 3."),
                ("Finally, choose Level 3 to 6 in Step 4 to launch your fifteen-question interview.", "Finally, choose Level 3 to 6 in Step 4 to launch your 15-question interview."),
            ],
        ),
        (
            "report",
            "b4_history",
            [
                ("Open Progress anytime to review your full exam history.", "Open Progress anytime to review your full exam history."),
                ("You can resume unfinished tests or click Report to inspect detailed feedback.", "You can resume unfinished tests or click Report to inspect detailed feedback."),
            ],
        ),
        (
            "report",
            "b4_report",
            [
                ("Inside your report, AI scores six ACTFL criteria on a Radar chart, highlights strengths, obstacles, and builds a four-week plan.", "Inside your report, AI scores six ACTFL criteria on a Radar chart, highlights strengths, obstacles, and builds a 4-week plan."),
                ("You can also export a clean PDF diagnostic report. Happy practicing!", "You can also export a clean PDF diagnostic report. Happy practicing!"),
            ],
        ),
    ],
}


def ffprobe_duration(path: Path) -> float:
    out = subprocess.check_output(
        [
            "ffprobe",
            "-v",
            "error",
            "-show_entries",
            "format=duration",
            "-of",
            "default=noprint_wrappers=1:nokey=1",
            str(path),
        ],
        text=True,
    ).strip()
    return float(out)


async def synth_all_audio(tmp_dir: Path, vi_override_dir: Optional[Path] = None) -> Dict[str, List[Dict[str, Any]]]:
    TTS_CACHE_DIR.mkdir(parents=True, exist_ok=True)
    result: Dict[str, List[Dict[str, Any]]] = {}

    for lang, beats in BEATS.items():
        cfg = VOICE_CFG[lang]
        beat_items = []
        for ch_id, beat_id, sentences in beats:
            sent_entries = []
            offset = 0.0
            for s_idx, (spoken_text, cc_text) in enumerate(sentences):
                override_path = (
                    (vi_override_dir / f"{beat_id}_s{s_idx}.mp3")
                    if (lang == "vi" and vi_override_dir)
                    else None
                )
                if override_path and override_path.exists() and override_path.stat().st_size > 0:
                    mp3_path = override_path
                else:
                    h = hashlib.md5(f"{cfg['voice']}|{cfg['rate']}|{spoken_text}".encode("utf-8")).hexdigest()[:10]
                    mp3_path = TTS_CACHE_DIR / f"{lang}_{beat_id}_s{s_idx}_{h}.mp3"
                    if not (mp3_path.exists() and mp3_path.stat().st_size > 0):
                        last_err = None
                        for attempt, voice_name in enumerate([cfg["voice"], cfg["voice"], cfg["fallback"]]):
                            try:
                                comm = edge_tts.Communicate(spoken_text, voice_name, rate=cfg["rate"])
                                await comm.save(str(mp3_path))
                                if mp3_path.exists() and mp3_path.stat().st_size > 0:
                                    last_err = None
                                    break
                            except Exception as exc:
                                last_err = exc
                                await asyncio.sleep(0.8 * (attempt + 1))
                        if last_err is not None:
                            raise last_err

                dur = ffprobe_duration(mp3_path)
                sent_entries.append(
                    {
                        "index": s_idx,
                        "spoken": spoken_text,
                        "cc": cc_text,
                        "mp3": mp3_path,
                        "duration": dur,
                        "offset": offset,
                    }
                )
                offset += dur + SENTENCE_GAP_SEC

            total_dur = max(0.0, offset - SENTENCE_GAP_SEC) if sent_entries else 0.0
            beat_items.append(
                {
                    "chapter_id": ch_id,
                    "beat_id": beat_id,
                    "sentences": sent_entries,
                    "duration": total_dur,
                }
            )
            print(f"  [TTS {lang}] {beat_id}: {total_dur:.2f}s ({len(sent_entries)} sentences)")
        result[lang] = beat_items
    return result


def seed_demo_database(db_path: Path) -> None:
    os.environ["DATABASE_URL"] = f"sqlite:///{db_path.as_posix()}"
    os.environ["TTS_PROVIDER"] = "browser"
    os.environ["ENVIRONMENT"] = "production"

    from app.database import Base, SessionLocal, engine, ensure_schema
    import app.models  # noqa: F401
    from app.core.security import get_password_hash
    from app.models.user import User
    from app.models.session import TestSession
    from app.models.question import Question, ModelAnswer
    from app.models.report import SessionReport
    from app.models.vocabulary import UserVocabulary
    from app.models.playlist import SavedPlaylist

    Base.metadata.create_all(bind=engine)
    ensure_schema(engine)

    db = SessionLocal()
    try:
        user = User(
            email=DEMO_EMAIL,
            hashed_password=get_password_hash(DEMO_PASS),
            full_name="Minh Anh",
            company_code="OPIC2026",
        )
        db.add(user)
        db.commit()
        db.refresh(user)

        now = datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None)

        pack = TestSession(
            user_id=user.id,
            mode="study",
            status="in_progress",
            self_assessment_level=4,
            topics=["environment", "global_workplace", "communication_media"],
            started_at=now - datetime.timedelta(days=2),
        )
        db.add(pack)
        db.commit()
        db.refresh(pack)

        pack_questions = [
            {
                "order": 1,
                "topic": "Home & Living Space",
                "category": "home",
                "type": "description",
                "status": "mastered",
                "q": "You indicated in the survey that you live with family members in a house or an apartment. Describe your home to me. What does it look like, and which room is your favorite?",
                "q_vi": "Bạn đã chọn sống cùng gia đình trong nhà hoặc căn hộ. Hãy miêu tả ngôi nhà của bạn trông như thế nào và căn phòng bạn yêu thích nhất là phòng nào?",
                "variants": [
                    {
                        "label": "Favorite room",
                        "question": "Tell me about your favorite room in your home. What furniture is in it and what do you usually do there?",
                        "bridge": "Speaking of my home, the living room is definitely my favorite spot.",
                    },
                    {
                        "label": "Neighborhood",
                        "question": "Describe the neighborhood where your house is located and what you like about living there.",
                        "bridge": "Not only is my apartment cozy inside, the neighborhood around it is also super convenient.",
                    },
                ],
                "tags": ["Cozy Home", "Family Time"],
                "sentences": [
                    "I currently live with my parents in a bright three-bedroom apartment on the tenth floor.",
                    "My favorite space is definitely the living room because big windows fill it with natural sunlight every morning.",
                    "On weekends, we gather on the soft sofa to drink iced coffee, chat about our week, and recharge together.",
                    "Although the building is near a busy street, it always feels like a peaceful retreat when I get home.",
                ],
                "sentences_vi": [
                    "Hiện tại tôi sống cùng bố mẹ trong một căn hộ ba phòng ngủ sáng sủa ở tầng 10.",
                    "Không gian yêu thích nhất của tôi chắc chắn là phòng khách vì cửa sổ lớn đón trọn ánh nắng tự nhiên mỗi sáng.",
                    "Cuối tuần, cả nhà quây quần trên ghế sofa êm ái uống cà phê đá, trò chuyện và nạp lại năng lượng.",
                    "Dù tòa nhà nằm gần con phố đông đúc, nơi đây luôn mang lại cảm giác bình yên mỗi khi tôi trở về.",
                ],
            },
            {
                "order": 2,
                "topic": "Parks & Walking",
                "category": "leisure",
                "type": "routine",
                "status": "mastered",
                "q": "You mentioned that you like going to parks. Tell me about a park you often visit and what you typically do there.",
                "q_vi": "Bạn có nhắc đến sở thích đi công viên. Hãy kể về một công viên bạn hay ghé thăm và những hoạt động thường làm ở đó.",
                "variants": [
                    {
                        "label": "Memorable visit",
                        "question": "Tell me about a memorable experience you had at a park recently. What happened?",
                        "bridge": "I go to this park every week, and actually something funny happened there last month.",
                    }
                ],
                "tags": ["Weekend Relax"],
                "sentences": [
                    "Whenever I need a break from screens, I head to a lakeside park just ten minutes from my home.",
                    "I usually go right before sunset to jog along the shaded path and enjoy the cool breeze.",
                    "Seeing families picnic and seniors practice tai chi immediately helps me unwind after a hectic workday.",
                ],
                "sentences_vi": [
                    "Mỗi khi cần rời khỏi màn hình, tôi thường ghé một công viên ven hồ chỉ cách nhà 10 phút.",
                    "Tôi hay đi ngay trước hoàng hôn để chạy bộ dọc lối đi rợp bóng cây và tận hưởng làn gió mát.",
                    "Nhìn các gia đình dã ngoại và người lớn tuổi tập dưỡng sinh giúp tôi thư giãn ngay sau ngày làm việc bận rộn.",
                ],
            },
            {
                "order": 3,
                "topic": "Listening to Music",
                "category": "leisure",
                "type": "routine",
                "status": "learning",
                "q": "You indicated that you enjoy listening to music. What types of music do you like, and when do you usually listen?",
                "q_vi": "Bạn đã chọn thích nghe nhạc. Bạn thích thể loại nhạc nào và thường nghe vào lúc nào?",
                "variants": [],
                "tags": ["Weekend Relax"],
                "sentences": [
                    "I love listening to acoustic pop and lo-fi tracks whenever I commute or wrap up work in the evening.",
                    "Soft melodies immediately calm my mind after a noisy day and help me focus without feeling stressed.",
                    "Last month I discovered a talented indie singer at a live café show, and her album has been on repeat ever since.",
                ],
                "sentences_vi": [
                    "Tôi thích nghe nhạc pop acoustic và lo-fi mỗi khi đi lại hoặc kết thúc công việc buổi tối.",
                    "Giai điệu nhẹ nhàng giúp tôi thư giãn ngay sau một ngày ồn ào và dễ tập trung hơn.",
                    "Tháng trước tôi tình cờ nghe một ca sĩ indie hát live ở quán cà phê và nghe đi nghe lại album của cô ấy từ đó.",
                ],
            },
            {
                "order": 4,
                "topic": "Coffee Shops",
                "category": "leisure",
                "type": "past_experience",
                "status": "learning",
                "q": "Tell me about a memorable time you visited a coffee shop. Who were you with, and what made it unforgettable?",
                "q_vi": "Hãy kể về một kỷ niệm đáng nhớ khi đi quán cà phê. Bạn đi cùng ai và điều gì khiến buổi đó khó quên?",
                "variants": [],
                "tags": ["Weekend Relax"],
                "sentences": [
                    "Last month I met my college friend at a quiet rooftop café in the city center.",
                    "Everything was going smoothly until a sudden tropical rainstorm poured down right as our drinks arrived.",
                    "Instead of leaving, we moved inside, listened to acoustic music, and talked for three straight hours.",
                ],
                "sentences_vi": [
                    "Tháng trước tôi hẹn bạn đại học tại một quán cà phê sân thượng yên tĩnh ở trung tâm thành phố.",
                    "Mọi thứ đang rất êm đềm thì bất ngờ một cơn mưa rào đổ xuống đúng lúc đồ uống vừa mang ra.",
                    "Thay vì ra về, chúng tôi chuyển vào trong, nghe nhạc acoustic và trò chuyện liền ba tiếng đồng hồ.",
                ],
            },
            {
                "order": 5,
                "topic": "Environment & Recycling",
                "category": "environment",
                "type": "comparison",
                "status": "mastered",
                "q": "How has environmental awareness in your country changed compared to ten years ago? What do you expect in the future?",
                "q_vi": "Ý thức bảo vệ môi trường ở đất nước bạn đã thay đổi ra sao so với 10 năm trước và bạn kỳ vọng gì trong tương lai?",
                "variants": [],
                "tags": ["Green Living"],
                "sentences": [
                    "Ten years ago, single-use plastic bags were everywhere and very few people sorted household waste.",
                    "Nowadays, younger consumers bring reusable tumblers to cafés and supermarkets charge extra for plastic bags.",
                    "In the near future, I believe electric buses and solar power will make daily life much cleaner.",
                ],
                "sentences_vi": [
                    "Mười năm trước, túi ni-lông dùng một lần xuất hiện khắp nơi và rất ít người phân loại rác tại nhà.",
                    "Ngày nay, người trẻ mang bình cá nhân đến quán cà phê và siêu thị tính thêm phí túi ni-lông.",
                    "Trong tương lai gần, tôi tin xe buýt điện và năng lượng mặt trời sẽ giúp cuộc sống sạch đẹp hơn nhiều.",
                ],
            },
            {
                "order": 6,
                "topic": "Global Workplace",
                "category": "global_workplace",
                "type": "routine",
                "status": "learning",
                "q": "Describe a typical day at your workplace or school. How do you collaborate with colleagues or classmates?",
                "q_vi": "Hãy miêu tả một ngày bình thường tại nơi làm việc hoặc trường học. Bạn phối hợp với đồng nghiệp ra sao?",
                "variants": [],
                "tags": ["Work Life"],
                "sentences": [
                    "My mornings normally start with a quick ten-minute stand-up meeting to align priorities with my team.",
                    "Because we collaborate with partners across different time zones, clear English emails are essential.",
                    "Working in a multicultural environment has taught me to stay flexible and open to new perspectives.",
                ],
                "sentences_vi": [
                    "Buổi sáng của tôi thường bắt đầu bằng cuộc họp nhanh 10 phút để thống nhất ưu tiên cùng nhóm.",
                    "Vì phải phối hợp với đối tác ở nhiều múi giờ khác nhau, viết email tiếng Anh rõ ràng là điều thiết yếu.",
                    "Làm việc trong môi trường đa văn hóa giúp tôi rèn sự linh hoạt và cởi mở với góc nhìn mới.",
                ],
            },
            {
                "order": 7,
                "topic": "Role-play: Hotel Booking",
                "category": "role_play",
                "type": "role_play_ask",
                "status": "unlearned",
                "q": "You want to book a hotel room for a weekend trip. Call the reception desk and ask three to four questions about room rates, breakfast, and check-in time.",
                "q_vi": "Bạn muốn đặt phòng khách sạn cho chuyến đi cuối tuần. Hãy gọi lễ tân và hỏi 3–4 câu về giá phòng, bữa sáng và giờ nhận phòng.",
                "variants": [],
                "tags": ["Travel"],
                "sentences": [
                    "Hello, I am planning a weekend stay next Friday and would love to check room availability.",
                    "First, could you tell me the nightly rate for a double room with a city view?",
                    "Also, is breakfast included in the price, and what is the earliest time I can check in?",
                ],
                "sentences_vi": [
                    "Xin chào, tôi dự định đặt phòng cuối tuần thứ Sáu tới và muốn kiểm tra phòng trống.",
                    "Đầu tiên, bạn cho hỏi giá mỗi đêm cho phòng đôi hướng thành phố là bao nhiêu?",
                    "Ngoài ra, giá đã bao gồm bữa sáng chưa và thời gian nhận phòng sớm nhất là mấy giờ?",
                ],
            },
            {
                "order": 8,
                "topic": "Role-play: Broken Laptop",
                "category": "role_play",
                "type": "role_play_problem",
                "status": "learning",
                "q": "You borrowed your friend's laptop for a presentation, but it suddenly stopped turning on. Leave a voice message explaining the situation and offering two or three solutions.",
                "q_vi": "Bạn mượn laptop của bạn thân để thuyết trình nhưng máy đột nhiên không bật được. Hãy để lại tin nhắn giải thích và đề xuất 2–3 hướng xử lý.",
                "variants": [],
                "tags": ["Tech Issue"],
                "sentences": [
                    "Hey Lan, I am so sorry to call with bad news, but the laptop I borrowed suddenly won't turn on.",
                    "I can take it straight to the official service center this afternoon and cover the entire repair cost.",
                    "If you need a computer urgently tonight, you are more than welcome to use my tablet until it is fixed.",
                ],
                "sentences_vi": [
                    "Lan ơi, mình rất xin lỗi phải báo tin không vui, chiếc laptop mình mượn tự nhiên không lên nguồn.",
                    "Mình có thể mang máy đến trung tâm bảo hành chính hãng ngay chiều nay và chi trả toàn bộ phí sửa.",
                    "Nếu tối nay bạn cần máy gấp, bạn cứ dùng tạm máy tính bảng của mình cho đến khi sửa xong nhé.",
                ],
            },
            {
                "order": 9,
                "topic": "Communication Media",
                "category": "communication_media",
                "type": "unexpected_situation",
                "status": "mastered",
                "q": "Have you ever experienced an unexpected internet outage when you needed to get something important done? Tell me what happened.",
                "q_vi": "Bạn đã bao giờ gặp sự cố mất mạng bất ngờ khi đang cần xử lý việc quan trọng chưa? Hãy kể lại chuyện gì đã xảy ra.",
                "variants": [],
                "tags": ["Tech Issue"],
                "sentences": [
                    "Just last week, my home Wi-Fi dropped right before an important online client demo.",
                    "At first I panicked, but then I quickly switched to my phone's 5G hotspot and rejoined the call.",
                    "That hiccup reminded me to always keep a backup connection ready before big meetings.",
                ],
                "sentences_vi": [
                    "Mới tuần trước, Wi-Fi nhà tôi bị ngắt ngay trước buổi thuyết trình trực tuyến quan trọng với khách hàng.",
                    "Ban đầu tôi khá hoảng, nhưng đã nhanh chóng bật phát sóng 5G từ điện thoại để quay lại cuộc họp.",
                    "Sự cố đó nhắc tôi luôn chuẩn bị sẵn kết nối dự phòng trước những cuộc họp lớn.",
                ],
            },
        ]

        for pq in pack_questions:
            q_obj = Question(
                session_id=pack.id,
                order_index=pq["order"],
                question_text=pq["q"],
                question_type=pq["type"],
                topic=pq["topic"],
                category=pq["category"],
                difficulty="IM",
                study_status=pq["status"],
                question_translation_vi=pq["q_vi"],
                prompt_variants=pq["variants"],
                story_tags=pq["tags"],
                next_review_at=(now - datetime.timedelta(hours=2)) if pq["status"] == "learning" else (now + datetime.timedelta(days=5)),
                review_interval_days=3 if pq["status"] == "mastered" else 1,
                review_count=2 if pq["status"] == "mastered" else 1,
            )
            db.add(q_obj)
            db.flush()
            db.add(
                ModelAnswer(
                    question_id=q_obj.id,
                    level="IM",
                    text=" ".join(pq["sentences"]),
                    rationale="Clear connected ideas with natural transitions and solid past/present/future control.",
                    sentences=pq["sentences"],
                    sentences_vi=pq["sentences_vi"],
                )
            )

        vocab_samples = [
            ("very busy schedule", "hectic workday", "collocation", "work", "Going for an evening jog helps me unwind after a hectic workday.", "Ngày làm việc bận rộn — tự nhiên hơn rất nhiều so với 'very busy'.", "mastered"),
            ("relax after work", "unwind and recharge", "idiom", "leisure", "On weekends, we gather on the sofa to chat and unwind and recharge together.", "Thư giãn và nạp lại năng lượng — cụm ăn điểm cao cho các chủ đề sở thích.", "learning"),
            ("sudden problem", "unexpected hiccup", "collocation", "role_play", "That unexpected hiccup reminded me to always keep a backup connection ready.", "Trục trặc bất ngờ — rất hợp khi kể cao trào (complication).", "learning"),
        ]
        for orig, upg, kind, topic, ex, note_vi, st in vocab_samples:
            db.add(UserVocabulary(user_id=user.id, original_phrase=orig, upgraded_phrase=upg, kind=kind, topic=topic, example_sentence=ex, note_vi=note_vi, status=st))

        db.add(
            SavedPlaylist(
                user_id=user.id,
                session_id=pack.id,
                title="Kho ôn tập · 9 câu · IM",
                level="IM",
                include_question=True,
                shadowing_pause=True,
                question_ids=[1, 2, 3, 4, 5, 6, 7, 8, 9],
                question_count=9,
                segment_count=18,
                playlist_key="demo_pack_im_9",
                audio_path=None,
                duration_seconds=465.0,
                file_size_bytes=3720000,
                status="ready",
            )
        )

        exam = TestSession(
            user_id=user.id,
            mode="exam",
            status="completed",
            self_assessment_level=4,
            topics=["environment", "global_workplace", "communication_media"],
            started_at=now - datetime.timedelta(hours=3),
            completed_at=now - datetime.timedelta(hours=2, minutes=30),
        )
        db.add(exam)
        db.commit()
        db.refresh(exam)

        db.add(Question(session_id=exam.id, order_index=1, question_text="Let's start the interview now. Tell me something about yourself.", question_type="self_intro", topic="Self Introduction", category="self_intro", difficulty="IM"))
        db.add(Question(session_id=exam.id, order_index=2, question_text="Describe your home and your favorite room in detail.", question_type="description", topic="Home & Living Space", category="home", difficulty="IM"))

        report_vi = {
            "justification": "Bạn diễn đạt trôi chảy, nối ý mạch lạc trên các chủ đề quen thuộc và hoàn thành tốt câu hỏi đóng vai. Cải thiện sự nhất quán ở thì quá khứ khi kể tình huống bất ngờ sẽ giúp bạn bứt phá vững chắc lên band IH.",
            "strengths": [
                "Phát âm rõ ràng, nhịp nói ổn định và duy trì được độ dài câu trả lời từ 60–90 giây.",
                "Biết dùng từ nối tự nhiên (however, although, instead of) để liên kết thành đoạn văn.",
                "Hoàn thành đầy đủ câu hỏi và đề xuất giải pháp hợp lý trong phần Role-play.",
            ],
            "weaknesses": [
                "Thỉnh thoảng bị trượt từ thì quá khứ về hiện tại khi kể câu chuyện bất ngờ ở tốc độ nhanh.",
                "Một số cụm từ miêu tả còn lặp lại, cần bổ sung thêm collocations theo chủ đề.",
            ],
            "frequent_mistakes": [
                {"category": "tenses", "pattern": "Quên chia động từ bất quy tắc ở thì quá khứ (go → went, buy → bought).", "count": 3},
                {"category": "grammar", "pattern": "Thiếu âm đuôi -s/-es ở ngôi thứ ba số ít khi miêu tả thói quen.", "count": 2},
            ],
            "study_plan": {
                "title": "Lộ trình 4 tuần nâng band lên IH",
                "weekly_focus": [
                    {"week": 1, "theme": "Chuẩn hóa 3 thì Quá khứ – Hiện tại – Tương lai", "activities": ["Luyện 2 câu kể chuyện quá khứ mỗi ngày", "Kiểm tra dòng thời gian thì sau mỗi bản ghi"], "target_outcome": "Không trượt thì khi kể chuyện"},
                    {"week": 2, "theme": "Bứt phá Role-play & Xử lý sự cố", "activities": ["Luyện hỏi đủ 3–4 câu trong Q11", "Đề xuất 2–3 giải pháp linh hoạt ở Q12"], "target_outcome": "Xử lý trôi chảy Q11–Q13"},
                    {"week": 3, "theme": "Từ vựng Collocations & Idioms nâng band", "activities": ["Ôn thuộc bài mẫu 10 phút/ngày", "Áp dụng 3 cụm nâng band vào câu nói"], "target_outcome": "Tăng điểm từ vựng lên 4.0+"},
                    {"week": 4, "theme": "Thi thử áp lực phòng thi thật", "activities": ["Hoàn thành 2 đề Thi thật ẩn chữ câu hỏi", "Rà soát biểu đồ Radar & báo cáo PDF"], "target_outcome": "Chạm mốc IH ổn định"},
                ],
            },
        }
        report_en = {
            "justification": "You communicate smoothly with well-connected sentences across everyday topics and handle Role-play requests effectively. Tightening past-tense consistency during unexpected stories will reliably push your performance to IH.",
            "strengths": [
                "Clear pronunciation, steady pacing, and comfortable 60–90 second answer length.",
                "Effective use of transitions (however, although, instead of) to sustain paragraph flow.",
                "Strong task completion with practical solutions during Role-play complications.",
            ],
            "weaknesses": [
                "Occasional past-tense slips back to present forms when narrating fast-paced events.",
                "Some descriptive phrases repeat; adding richer topic collocations will elevate vocabulary.",
            ],
            "frequent_mistakes": [
                {"category": "tenses", "pattern": "Dropped irregular past-tense forms during storytelling (go → went, buy → bought).", "count": 3},
                {"category": "grammar", "pattern": "Missing third-person singular -s endings in routine descriptions.", "count": 2},
            ],
            "study_plan": {
                "title": "4-Week Action Plan to IH",
                "weekly_focus": [
                    {"week": 1, "theme": "Past, Present & Future Time Frames", "activities": ["Record 2 past-experience prompts daily", "Verify tense timeline accuracy after grading"], "target_outcome": "Consistent past narration"},
                    {"week": 2, "theme": "Role-Play & Complication Handling", "activities": ["Practice asking 3–4 natural questions", "Offer 2–3 backup solutions within 90 seconds"], "target_outcome": "Confident Q11–Q13 execution"},
                    {"week": 3, "theme": "Collocations & Expressive Vocabulary", "activities": ["10 min daily Script Recall review", "Reuse 3 upgraded phrases in speaking drills"], "target_outcome": "Vocabulary score 4.0+"},
                    {"week": 4, "theme": "Full Blind Exam Simulations", "activities": ["Complete 2 strict Real Exam simulations", "Track improvements via PDF diagnostic reports"], "target_outcome": "Reliable IH readiness"},
                ],
            },
        }

        db.add(
            SessionReport(
                session_id=exam.id,
                overall_level="IM",
                justification=report_en["justification"],
                radar_scores={
                    "fluency_and_length": 4.2,
                    "tense_control": 3.6,
                    "organization": 4.0,
                    "vocabulary": 3.8,
                    "grammar": 3.5,
                    "task_completion": 4.3,
                },
                per_question_summary=[
                    {"question_num": 1, "topic": "Self Introduction", "status": "unscored", "question_text": "Let's start the interview now. Tell me something about yourself."},
                    {"question_num": 2, "topic": "Home & Living Space", "status": "scored", "estimated_level": "IH", "score_fluency": 4, "score_tenses": 4, "score_organization": 4, "score_vocabulary": 4, "score_grammar": 4, "question_text": "Describe your home and your favorite room in detail.", "transcript": "I currently live with my parents in a bright three-bedroom apartment on the tenth floor..."},
                    {"question_num": 11, "topic": "Role-play: Hotel Booking", "status": "scored", "estimated_level": "IM", "score_fluency": 4, "score_tenses": 3, "score_organization": 4, "score_vocabulary": 4, "score_grammar": 3, "question_text": "Call the reception desk and ask three to four questions about room rates, breakfast, and check-in time.", "transcript": "Hello, I am planning a weekend stay next Friday and would love to check room availability..."},
                ],
                frequent_mistakes=report_en["frequent_mistakes"],
                strengths=report_en["strengths"],
                weaknesses=report_en["weaknesses"],
                study_plan=report_en["study_plan"],
                i18n_cache={"vi": report_vi, "en": report_en},
            )
        )
        db.commit()
    finally:
        db.close()


def wait_for_port(port: int, timeout: float = 20.0) -> None:
    deadline = time.time() + timeout
    while time.time() < deadline:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            if s.connect_ex(("127.0.0.1", port)) == 0:
                return
        time.sleep(0.25)
    raise RuntimeError(f"Server did not start on port {port} within {timeout}s")


# Live requestAnimationFrame spotlight tracker:
# Tracks the ACTUAL DOM element bounding box frame-by-frame so layout shifts never leave a stale floating box!
OVERLAY_JS = r"""
() => {
  if (document.getElementById('__opic_guide_cursor')) return;
  const style = document.createElement('style');
  style.id = '__opic_guide_style';
  style.textContent = `
    #__opic_guide_cursor {
      position: fixed;
      top: 360px; left: 640px;
      width: 24px; height: 24px;
      margin: -4px 0 0 -4px;
      z-index: 2147483647;
      pointer-events: none;
      transition: left 0.45s cubic-bezier(0.22, 1, 0.36, 1), top 0.45s cubic-bezier(0.22, 1, 0.36, 1);
      filter: drop-shadow(0 4px 10px rgba(15, 23, 42, 0.45));
    }
    #__opic_guide_ripple {
      position: fixed;
      width: 44px; height: 44px;
      margin: -22px 0 0 -22px;
      border-radius: 9999px;
      border: 3px solid #38bdf8;
      background: rgba(56, 189, 248, 0.22);
      z-index: 2147483646;
      pointer-events: none;
      opacity: 0;
      transform: scale(0.35);
      transition: transform 0.45s ease-out, opacity 0.45s ease-out;
    }
    #__opic_guide_spotlight {
      position: fixed;
      z-index: 2147483645;
      pointer-events: none;
      border-radius: 16px;
      border: 2.5px solid #0ea5e9;
      box-shadow: 0 0 0 5px rgba(14, 165, 233, 0.16), 0 10px 28px rgba(14, 165, 233, 0.22);
      opacity: 0;
      transition: opacity 0.25s ease;
    }
  `;
  document.head.appendChild(style);

  const cursor = document.createElement('div');
  cursor.id = '__opic_guide_cursor';
  cursor.innerHTML = `<svg width="26" height="26" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M5 3.5L22.5 14.2L14.5 16.3L10.8 24L5 3.5Z" fill="#0f172a" stroke="#ffffff" stroke-width="2.2" stroke-linejoin="round"/>
  </svg>`;
  document.body.appendChild(cursor);

  const ripple = document.createElement('div');
  ripple.id = '__opic_guide_ripple';
  document.body.appendChild(ripple);

  const spot = document.createElement('div');
  spot.id = '__opic_guide_spotlight';
  document.body.appendChild(spot);

  window.__opicSpotEl = null;
  window.__opicSpotPad = 6;

  function syncSpot() {
    const el = window.__opicSpotEl;
    if (!el || !el.isConnected) {
      spot.style.opacity = '0';
      window.__opicSpotEl = null;
    } else {
      const r = el.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0 || r.bottom < 0 || r.top > window.innerHeight) {
        spot.style.opacity = '0';
      } else {
        const pad = window.__opicSpotPad || 6;
        spot.style.left = (r.left - pad) + 'px';
        spot.style.top = (r.top - pad) + 'px';
        spot.style.width = (r.width + pad * 2) + 'px';
        spot.style.height = (r.height + pad * 2) + 'px';
        spot.style.opacity = '1';
      }
    }
    requestAnimationFrame(syncSpot);
  }
  requestAnimationFrame(syncSpot);
}
"""


def inject_overlay(page):
    page.evaluate(OVERLAY_JS)


def move_cursor(page, x: float, y: float, pause: float = 0.5):
    inject_overlay(page)
    page.evaluate(
        """([x, y]) => {
          const c = document.getElementById('__opic_guide_cursor');
          if (c) { c.style.left = x + 'px'; c.style.top = y + 'px'; }
        }""",
        [x, y],
    )
    time.sleep(pause)


def click_ripple(page, x: float, y: float):
    inject_overlay(page)
    page.evaluate(
        """([x, y]) => {
          const r = document.getElementById('__opic_guide_ripple');
          if (!r) return;
          r.style.transition = 'none';
          r.style.left = x + 'px';
          r.style.top = y + 'px';
          r.style.opacity = '0.95';
          r.style.transform = 'scale(0.35)';
          r.offsetHeight;
          r.style.transition = 'transform 0.45s ease-out, opacity 0.45s ease-out';
          r.style.opacity = '0';
          r.style.transform = 'scale(1.65)';
        }""",
        [x, y],
    )


def hide_spotlight(page):
    inject_overlay(page)
    page.evaluate("() => { window.__opicSpotEl = null; }")


def spotlight_locator(page, locator, pad: int = 6) -> bool:
    """Attaches live frame-by-frame spotlight tracking to the full logical DOM element."""
    try:
        inject_overlay(page)
        loc = locator.first
        loc.wait_for(state="visible", timeout=5000)
        box = loc.bounding_box()
        if not box:
            return False
        cx = box["x"] + box["width"] * 0.5
        cy = box["y"] + box["height"] * 0.5
        move_cursor(page, cx, cy, pause=0.48)
        loc.evaluate(
            """(el, pad) => {
              window.__opicSpotPad = pad;
              window.__opicSpotEl = el;
            }""",
            pad,
        )
        return True
    except Exception as exc:
        print(f"    [warn] spotlight skipped: {exc}")
        return False


def click_locator(page, locator, pad: int = 4) -> bool:
    """Smoothly glides to button, pulses ripple, immediately clears spotlight, and clicks cleanly."""
    try:
        inject_overlay(page)
        loc = locator.first
        loc.wait_for(state="visible", timeout=5000)
        box = loc.bounding_box()
        if not box:
            return False
        cx = box["x"] + box["width"] * 0.5
        cy = box["y"] + box["height"] * 0.5
        move_cursor(page, cx, cy, pause=0.45)
        loc.evaluate("(el, p) => { window.__opicSpotPad = p; window.__opicSpotEl = el; }", pad)
        time.sleep(0.28)
        click_ripple(page, cx, cy)
        hide_spotlight(page)  # Always clear spotlight BEFORE click so shifting layout NEVER leaves a stale floating box!
        time.sleep(0.12)
        loc.click()
        time.sleep(0.38)
        return True
    except Exception as exc:
        print(f"    [warn] click skipped: {exc}")
        return False


def wait_until_elapsed(start_t: float, target_sec: float):
    rem = target_sec - (time.monotonic() - start_t)
    if rem > 0:
        time.sleep(rem)


def record_language(lang: str, audio_beats: List[Dict[str, Any]], tmp_dir: Path) -> Dict[str, Any]:
    print(f"\n=== Recording real UI walkthrough ({lang.upper()}) ===")
    raw_dir = tmp_dir / f"raw_{lang}"
    raw_dir.mkdir(parents=True, exist_ok=True)
    poster_path = OUT_DIR / f"poster-{lang}.jpg"

    is_vi = lang == "vi"
    recorded_beats: List[Dict[str, Any]] = []
    audio_events: List[Dict[str, Any]] = []  # Exact sentence-level audio & CC events

    with sync_playwright() as p:
        browser = None
        last_launch_err = None
        for ch in ("chrome", "msedge", None):
            try:
                kwargs = {"headless": True}
                if ch:
                    kwargs["channel"] = ch
                browser = p.chromium.launch(**kwargs)
                print(f"  [Browser] Launched chromium (channel={ch or 'bundled'})")
                break
            except Exception as exc:
                last_launch_err = exc
        if browser is None:
            raise last_launch_err

        # Step A: Login silently to get demo token
        setup_ctx = browser.new_context(viewport={"width": 1280, "height": 720})
        setup_page = setup_ctx.new_page()
        setup_page.goto(BASE_URL, wait_until="networkidle")
        token_resp = setup_page.evaluate(
            """async ([email, password]) => {
              const r = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({email, password})
              });
              return await r.json();
            }""",
            [DEMO_EMAIL, DEMO_PASS],
        )
        token = token_resp["access_token"]
        setup_ctx.close()

        # Step B: Open crisp 1280x720 recording context
        ctx = browser.new_context(
            viewport={"width": 1280, "height": 720},
            record_video_dir=str(raw_dir),
            record_video_size={"width": 1280, "height": 720},
        )
        ctx.add_init_script(
            f"""
            if (window.location && window.location.protocol && window.location.protocol.startsWith('http')) {{
              try {{
                localStorage.setItem('opic_token', {json.dumps(token)});
                localStorage.setItem('opic_ui_lang', {json.dumps(lang)});
                localStorage.setItem('opic_theme_mode', 'light');
                localStorage.setItem('opic_sidebar_collapsed', '0');
                sessionStorage.setItem('opic_active_tab', 'dashboard');
              }} catch (e) {{}}
            }}
            """
        )

        rec_start = time.monotonic()
        page = ctx.new_page()
        page.on("pageerror", lambda err: print(f"  [PAGEERROR] {err}"))
        page.on("console", lambda msg: print(f"  [CONSOLE {msg.type}] {msg.text}") if msg.type == "error" else None)
        page.goto(BASE_URL, wait_until="networkidle")
        page.wait_for_selector("aside nav", timeout=12000)
        time.sleep(0.8)
        inject_overlay(page)

        page.screenshot(path=str(poster_path), type="jpeg", quality=90)

        def run_beat(beat: Dict[str, Any], actions_fn):
            t_start = time.monotonic() - rec_start
            beat_start = time.monotonic()
            actions_fn()
            wait_until_elapsed(beat_start, beat["duration"] + BEAT_TAIL_GAP_SEC)
            t_end = time.monotonic() - rec_start

            for s in beat["sentences"]:
                s_start = round(t_start + s["offset"], 3)
                s_end = round(s_start + s["duration"] + 0.12, 3)
                audio_events.append(
                    {
                        "chapter_id": beat["chapter_id"],
                        "beat_id": beat["beat_id"],
                        "start": s_start,
                        "end": s_end,
                        "cc": s["cc"],
                        "mp3": s["mp3"],
                    }
                )

            recorded_beats.append(
                {
                    "chapter_id": beat["chapter_id"],
                    "beat_id": beat["beat_id"],
                    "start": round(t_start, 3),
                    "clip_end": round(t_end, 3),
                }
            )
            print(f"  [{lang}] {beat['beat_id']} @ {t_start:.2f}s -> {t_end:.2f}s (audio {beat['duration']:.2f}s)")

        by_id = {b["beat_id"]: b for b in audio_beats}

        # --- Chapter 1: Overview ---
        def act_b1_nav():
            spotlight_locator(page, page.locator("aside nav"), pad=8)
            time.sleep(1.5)
            nav_btns = page.locator("aside nav button")
            for i in range(nav_btns.count()):
                b = nav_btns.nth(i).bounding_box()
                if b:
                    move_cursor(page, b["x"] + b["width"] * 0.5, b["y"] + b["height"] * 0.5, pause=0.55)

        run_beat(by_id["b1_nav"], act_b1_nav)

        def act_b1_settings():
            spotlight_locator(page, page.locator("aside div[role='group']"), pad=6)
            time.sleep(3.5)
            spotlight_locator(page, page.locator("aside .grid-cols-3"), pad=6)

        run_beat(by_id["b1_settings"], act_b1_settings)

        def act_b1_cards():
            hide_spotlight(page)
            ring_btn = page.locator("main button[title*='Kho'], main button[title*='Study Hub']")
            spotlight_locator(page, ring_btn, pad=8)
            time.sleep(3.0)
            cards = page.locator("main .glass-card")
            if cards.count() >= 2:
                spotlight_locator(page, cards.nth(0), pad=6)
                time.sleep(2.4)
                spotlight_locator(page, cards.nth(1), pad=6)

        run_beat(by_id["b1_cards"], act_b1_cards)

        # --- Chapter 2: Study Hub ---
        def act_b2_open():
            hide_spotlight(page)
            click_locator(page, page.locator("aside nav button").nth(1), pad=6)
            page.wait_for_selector("main h2", timeout=8000)
            time.sleep(0.8)
            # Highlight the FULL Tier 1 filter row cleanly, then click Sở thích/Hobbies -> Listening to Music
            click_locator(page, page.get_by_role("button", name="Sở thích" if is_vi else "Hobbies"), pad=4)
            time.sleep(1.4)
            # Spotlight the FULL Tier 2 sub-topic bar!
            sub_chip = page.get_by_role("button", name="Listening to Music")
            click_locator(page, sub_chip, pad=4)
            time.sleep(2.4)
            all_btn = page.get_by_role("button", name=re.compile(r"^(Tất cả|All)\s+\d")).first
            click_locator(page, all_btn, pad=4)
            time.sleep(0.5)

        run_beat(by_id["b2_open"], act_b2_open)

        def act_b2_variants():
            hide_spotlight(page)
            home_row = page.locator("main button", has_text="Home & Living Space").first
            click_locator(page, home_row, pad=4)
            time.sleep(0.4)
            # Highlight the FULL warm prompt & variant box cleanly, then click Favorite room
            prompt_box = page.locator("main .rounded-2xl.bg-gradient-to-br").first
            spotlight_locator(page, prompt_box, pad=6)
            time.sleep(1.8)
            click_locator(page, page.get_by_role("button", name="Favorite room"), pad=4)
            spotlight_locator(page, prompt_box, pad=6)
            time.sleep(2.6)
            click_locator(page, page.get_by_role("button", name="Câu chuẩn" if is_vi else "Core Prompt"), pad=4)

        run_beat(by_id["b2_variants"], act_b2_variants)

        def act_b2_modes():
            hide_spotlight(page)
            if is_vi:
                # Click Dịch — spotlight fades IMMEDIATELY before click so NO stale box floats over the translated text!
                click_locator(page, page.get_by_role("button", name="Dịch", exact=True), pad=4)
                time.sleep(2.6)
            click_locator(page, page.get_by_role("button", name="Điền khuyết" if is_vi else "Cloze"), pad=4)
            time.sleep(2.6)
            # Highlight the FULL wide green Speak CTA button at the bottom!
            spotlight_locator(page, page.get_by_role("button", name="Luyện nói" if is_vi else "Speak"), pad=6)

        run_beat(by_id["b2_modes"], act_b2_modes)

        def act_b2_audio_vocab():
            hide_spotlight(page)
            click_locator(page, page.get_by_role("button", name="Nghe" if is_vi else "Audio", exact=True), pad=4)
            time.sleep(0.6)
            # Spotlight the FULL Audio Creator studio card
            spotlight_locator(page, page.locator("main .glass-panel").first, pad=6)
            time.sleep(4.2)
            click_locator(page, page.get_by_role("button", name="Từ vựng" if is_vi else "Vocab", exact=True), pad=4)
            time.sleep(1.2)
            hide_spotlight(page)

        run_beat(by_id["b2_audio_vocab"], act_b2_audio_vocab)

        # --- Chapter 3: Mock Exam ---
        def act_b3_center():
            hide_spotlight(page)
            click_locator(page, page.locator("aside nav button").nth(2), pad=6)
            time.sleep(1.0)
            spotlight_locator(page, page.locator("main .studio-surface").first, pad=6)
            time.sleep(3.5)
            spotlight_locator(page, page.locator("main .glass-card").first, pad=6)

        run_beat(by_id["b3_center"], act_b3_center)

        def act_b3_step1():
            hide_spotlight(page)
            click_locator(page, page.get_by_role("button", name="Bắt đầu" if is_vi else "Start").first, pad=6)
            time.sleep(1.1)
            cards = page.locator("main .glass-card")
            if cards.count() >= 4:
                spotlight_locator(page, cards.nth(2), pad=6)
                time.sleep(3.5)
                spotlight_locator(page, cards.nth(3), pad=6)

        run_beat(by_id["b3_step1"], act_b3_step1)

        def act_b3_steps234():
            hide_spotlight(page)
            click_locator(page, page.locator("main button.btn-brand-gradient").last, pad=5)
            time.sleep(2.4)
            click_locator(page, page.locator("main button.btn-brand-gradient").last, pad=5)
            time.sleep(0.9)
            topic_cards = page.locator("main .grid button")
            for idx in (0, 2, 4):
                if topic_cards.count() > idx:
                    click_locator(page, topic_cards.nth(idx), pad=4)
                    time.sleep(0.2)
            click_locator(page, page.locator("main button.btn-brand-gradient").last, pad=5)
            time.sleep(1.2)
            hide_spotlight(page)

        run_beat(by_id["b3_steps234"], act_b3_steps234)

        # --- Chapter 4: Progress & AI Report ---
        def act_b4_history():
            hide_spotlight(page)
            click_locator(page, page.locator("aside nav button").nth(3), pad=6)
            time.sleep(1.2)
            # Highlight the FULL completed exam card (not just a tiny button)
            completed_card = page.locator("main .glass-card", has_text="Bài thi #1" if is_vi else "Exam #1").first
            spotlight_locator(page, completed_card, pad=6)

        run_beat(by_id["b4_history"], act_b4_history)

        def act_b4_report():
            click_locator(page, page.get_by_role("button", name="Báo cáo" if is_vi else "Report").first, pad=5)
            time.sleep(1.8)
            hide_spotlight(page)
            for y in (260, 560, 900):
                page.evaluate(f"window.scrollTo({{top: {y}, behavior: 'smooth'}})")
                time.sleep(2.5)
            page.evaluate("window.scrollTo({top: 220, behavior: 'smooth'})")
            time.sleep(0.8)

        run_beat(by_id["b4_report"], act_b4_report)

        time.sleep(0.9)
        video_obj = page.video
        ctx.close()
        raw_video_path = Path(video_obj.path())
        browser.close()

    # Mux exact sentence-level synced audio track + broadcast loudnorm (-16 LUFS)
    raw_dur = ffprobe_duration(raw_video_path)
    out_mp4 = OUT_DIR / f"guide-{lang}.mp4"
    out_vtt = OUT_DIR / f"guide-{lang}.vtt"

    ffmpeg_cmd = ["ffmpeg", "-y", "-i", str(raw_video_path)]
    for ev in audio_events:
        ffmpeg_cmd.extend(["-i", str(ev["mp3"])])

    filter_parts = []
    mix_labels = []
    for idx, ev in enumerate(audio_events, start=1):
        delay_ms = max(0, int(round(ev["start"] * 1000)))
        lbl = f"a{idx}"
        filter_parts.append(f"[{idx}:a]adelay={delay_ms}|{delay_ms},volume=1.0[{lbl}]")
        mix_labels.append(f"[{lbl}]")

    filter_parts.append(
        f"{''.join(mix_labels)}amix=inputs={len(audio_events)}:duration=longest:normalize=0,loudnorm=I=-16:TP=-1.5:LRA=11[aout]"
    )

    ffmpeg_cmd.extend(
        [
            "-filter_complex",
            ";".join(filter_parts),
            "-map",
            "0:v:0",
            "-map",
            "[aout]",
            "-c:v",
            "libx264",
            "-preset",
            "slow",
            "-crf",
            "26",
            "-pix_fmt",
            "yuv420p",
            "-r",
            "24",
            "-c:a",
            "aac",
            "-b:a",
            "112k",
            "-movflags",
            "+faststart",
            "-shortest",
            str(out_mp4),
        ]
    )

    print(f"  [FFmpeg {lang}] Encoding {out_mp4.name} ({len(audio_events)} synced sentence tracks)...")
    subprocess.run(ffmpeg_cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)

    final_dur = ffprobe_duration(out_mp4)
    size_mb = out_mp4.stat().st_size / (1024 * 1024)
    print(f"  [OK {lang}] {out_mp4.name}: {final_dur:.1f}s, {size_mb:.2f} MB (raw {raw_dur:.1f}s)")

    # Write exact sentence-by-sentence word-for-word WebVTT subtitles
    def fmt_vtt(sec: float) -> str:
        ms = int(round(max(0.0, sec) * 1000))
        h = ms // 3600000
        ms %= 3600000
        m = ms // 60000
        ms %= 60000
        s = ms // 1000
        ms %= 1000
        return f"{h:02d}:{m:02d}:{s:02d}.{ms:03d}"

    vtt_lines = ["WEBVTT", ""]
    cues_meta = []
    for ev in audio_events:
        c_end = min(ev["end"], final_dur)
        vtt_lines.append(f"{fmt_vtt(ev['start'])} --> {fmt_vtt(c_end)}")
        vtt_lines.append(ev["cc"])
        vtt_lines.append("")
        cues_meta.append({"start": ev["start"], "end": round(c_end, 3), "text": ev["cc"]})
    out_vtt.write_text("\n".join(vtt_lines), encoding="utf-8")

    # Compute exact chapter timestamps
    chapters_meta = []
    for ch in CHAPTER_DEFS[lang]:
        ch_beats = [b for b in recorded_beats if b["chapter_id"] == ch["id"]]
        ch_start = ch_beats[0]["start"] if ch_beats else 0.0
        ch_end = ch_beats[-1]["clip_end"] if ch_beats else final_dur
        chapters_meta.append(
            {
                **ch,
                "start": round(ch_start, 2),
                "end": round(min(ch_end, final_dur), 2),
            }
        )

    return {
        "video": f"/tutorials/guide-{lang}.mp4",
        "poster": f"/tutorials/poster-{lang}.jpg",
        "vtt": f"/tutorials/guide-{lang}.vtt",
        "duration": round(final_dur, 2),
        "chapters": chapters_meta,
        "cues": cues_meta,
    }


def main():
    tmp_dir = Path(tempfile.mkdtemp(prefix="opic_guide_build_"))
    db_path = tmp_dir / "tutorial_demo.db"
    vi_override = Path(os.environ["VI_AUDIO_DIR"]) if os.environ.get("VI_AUDIO_DIR") else None
    server_proc = None
    try:
        print("1. Preparing calm sentence-by-sentence studio voiceovers (VI + EN)...")
        audio_map = asyncio.run(synth_all_audio(tmp_dir, vi_override_dir=vi_override))

        print("2. Seeding isolated temporary SQLite demo database...")
        seed_demo_database(db_path)

        print(f"3. Starting temporary demo backend on port {PORT} (serving production frontend/dist)...")
        env = os.environ.copy()
        env["PYTHONPATH"] = str(BACKEND_DIR)
        env["DATABASE_URL"] = f"sqlite:///{db_path.as_posix()}"
        env["TTS_PROVIDER"] = "browser"
        env["ENVIRONMENT"] = "production"
        server_proc = subprocess.Popen(
            [sys.executable, "-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", str(PORT)],
            cwd=str(BACKEND_DIR),
            env=env,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        wait_for_port(PORT, timeout=25.0)

        print("4. Recording VI and EN live walkthrough videos...")
        chapters_json = {}
        for lang in ("vi", "en"):
            chapters_json[lang] = record_language(lang, audio_map[lang], tmp_dir)

        meta_path = OUT_DIR / "chapters.json"
        meta_path.write_text(json.dumps(chapters_json, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"\nDONE! Saved metadata to {meta_path}")
    finally:
        if server_proc and server_proc.poll() is None:
            server_proc.terminate()
            try:
                server_proc.wait(timeout=5)
            except subprocess.TimeoutExpired:
                server_proc.kill()
        shutil.rmtree(tmp_dir, ignore_errors=True)


if __name__ == "__main__":
    main()
