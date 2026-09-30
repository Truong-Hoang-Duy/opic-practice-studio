# GEMINI.md - OPIc Practice Studio Context & Engineering Guide

> **Mục đích tài liệu:** Đây là tài liệu hướng dẫn ngữ cảnh chuẩn (Master Context Specification) dành cho Gemini AI Assistant / Antigravity Agent trong mọi phiên làm việc với repository `opic-practice-studio`.

---

## 1. Tổng quan Dự án (Project Overview)
- **Tên dự án:** OPIc Practice Studio
- **Mục tiêu:** Nền tảng web mô phỏng quy trình thi OPIc thực tế (Oral Proficiency Interview - computer) và huấn luyện AI chuyên sâu giúp học viên Việt Nam nâng band từ Intermediate Low/Mid (IL/IM) lên **Intermediate High (IH)**.
- **Tuyên bố pháp lý bắt buộc (Legal Disclaimer):** OPIc Practice Studio là công cụ học tập độc lập, **KHÔNG trực thuộc, không được tài trợ hay bảo trợ bởi ACTFL hoặc Language Testing International (LTI)**. Không sao chép logo, video hay audio độc quyền của ACTFL/LTI. Footer luôn hiển thị disclaimer này.
- **Đối tượng người dùng:** Người học tiếng Anh tại Việt Nam chuẩn bị thi OPIc cho mục tiêu tuyển dụng, thăng tiến tại các tập đoàn lớn (Samsung, LG, công ty đa quốc gia).

---

## 2. Kiến trúc & Công nghệ (Tech Stack)

### Backend:
- **Ngôn ngữ:** Python 3.11+ (hiện chạy Python 3.12.6).
- **Framework:** FastAPI (REST API + WebSocket proxy).
- **ORM & DB Driver:** SQLAlchemy 2.0+ kết hợp `psycopg2-binary` (PostgreSQL) và `sqlite3`.
- **Validation:** Pydantic V2 với `SettingsConfigDict` và `ConfigDict(from_attributes=True)`.
- **Bảo mật:** Bcrypt hashing (trực tiếp qua thư viện `bcrypt`, giới hạn 72 bytes) + JWT Bearer token (`python-jose`).
- **Xuất báo cáo:** ReportLab tạo file PDF chẩn đoán tự động (`/data/reports/`).

### AI & Speech Services:
- **LLM (Đánh giá & Huấn luyện):** OpenAI Chat Completions API.
  - Model: Đọc từ biến môi trường `OPENAI_MODEL` (mặc định: `gpt-5.6-luna`), **tuyệt đối không hardcode**.
  - Định dạng: Luôn dùng Structured Outputs (`response_format={"type": "json_object"}`), validate qua Pydantic schema, retry tối đa 1 lần nếu JSON lỗi.
  - Prompts: Lưu toàn bộ trong thư mục `backend/app/prompts/*.txt`.
- **Text-to-Speech (Giám khảo ảo "Eva"):** Chọn qua `TTS_PROVIDER`:
  - `kokoro` (mặc định): mã nguồn mở **Kokoro-82M** (Apache-2.0, bản ONNX `kokoro-onnx`) chạy CPU tại backend, không cần API key. Giọng `KOKORO_VOICE` (mặc định `af_heart` - nữ trẻ Mỹ, ấm, điềm tĩnh). Model (~340MB) tự tải về `backend/data/tts_models/` ở lần chạy đầu. Tốc độ ~2x realtime trên CPU 8 nhân.
  - `openai`: OpenAI TTS (`TTS_MODEL`, `TTS_VOICE`) - chỉ dùng khi key có quyền TTS.
  - `browser`: không tạo audio ở server.
  - Nếu server không có audio (model chưa sẵn sàng/lỗi), `EvaAvatar.jsx` tự đọc câu hỏi bằng Web Speech API của trình duyệt (ưu tiên giọng nữ en-US). Không dùng âm "chime" giả.
  - Cache trên đĩa: Lưu tại `backend/data/audio_cache/` theo `md5(text + voice + model)` (.mp3). Sau khi tạo đề, audio của cả 15 câu được tổng hợp nền theo thứ tự.
- **Speech-to-Text (Nhận diện giọng nói):** Soniox **async (batch) API**, không stream realtime.
  - Trình duyệt chỉ ghi âm (`AudioRecorder.jsx`) rồi upload file qua `POST /api/answers`; backend gửi file tới Soniox (`SONIOX_ASYNC_MODEL`, mặc định `stt-async-v5`), nhận transcript + độ tin cậy từng từ (`stt_service.transcribe_audio_file`), xóa bản sao trên Soniox, rồi mới chấm điểm.
  - **Quy tắc bảo mật:** Key Soniox chỉ nằm ở backend, không bao giờ gửi xuống Frontend.
  - Mỗi lần ghi được lưu thành file riêng (`data/uploads/user_{id}_q{qid}_{timestamp}_{rand}.webm`) và gắn với `AnswerVersion.audio_path`, nên có thể nghe lại ở trang coaching (kèm các lần ghi trước), báo cáo (mở từ History) và Question Bank.
  - Nhận dạng lỗi hoặc không có lời nói **không chặn** người học: bản ghi vẫn được lưu (`notes` = `transcription_failed` / `no_speech`) và câu vẫn được chấm theo chuẩn — không có nội dung thì mức thấp nhất (`below_IL`, 1/5, không gọi LLM). Có thể sửa transcript để chấm lại.
  - Phân tích độ tin cậy từ: Highlight các từ nhận diện tự tin thấp (< 0.8) để người học phát hiện lỗi phát âm.

### Frontend:
- **Framework:** React 18 + Vite 5 + Tailwind CSS + Lucide Icons.
- **Giao diện:** Desktop-first, hỗ trợ tablet; Dark theme hiện đại, hiệu ứng Glassmorphism.
- **Trợ năng song ngữ:** Giao diện tiếng Anh kèm tooltip hướng dẫn tiếng Việt (`ViTooltip`) cho học viên Việt Nam.
- **Các thành phần độc quyền:**
  - `EvaAvatar.jsx`: Giám khảo ảo SVG với hiệu ứng mở miệng khi phát audio (`@keyframes mouthTalk`) và sóng âm thanh (`soundwave`).
  - `AudioRecorder.jsx`: Đo âm lượng mic qua Web Audio API, đếm thời gian với vạch mục tiêu 60s–120s (vùng ăn điểm IH).
  - `DiffViewer.jsx`: So sánh song song văn bản gốc vs văn bản AI nâng cấp ("Improve my answer") kèm giải thích chiến thuật bằng tiếng Việt.
  - `RadarChart.jsx`: Biểu đồ radar SVG 6 tiêu chí chấm thi đối chiếu với đường chuẩn 4.0 (IH Target).
  - `ShadowingPlayer.jsx`: Luyện nói theo bài mẫu từng câu một ở các tốc độ (0.7x, 0.85x, 1.0x, 1.2x).

---

## 3. Cơ sở dữ liệu: Dùng chung 1 DB cho cả Local và Real (Production)

Hệ thống được thiết kế để **dùng chung 1 Database duy nhất**:
- **Dịch vụ DB:** PostgreSQL Serverless miễn phí trên **[Neon.tech](https://neon.tech)** (Region Singapore `ap-southeast-1`).
- **Chuỗi kết nối:** Cấu hình qua biến môi trường `DATABASE_URL`:
  ```ini
  DATABASE_URL=postgresql://neondb_owner:password@ep-xyz.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
  ```
- **Cơ chế hoạt động:**
  - File `backend/app/database.py` tự động chuẩn hóa URL (chuyển `postgres://` thành `postgresql://`) và kích hoạt `pool_pre_ping=True`, `pool_recycle=300`.
  - Khi chạy ở máy cá nhân (Local) và khi deploy trên Cloud (Render), cả hai đều đọc/ghi vào cùng Neon DB này.
  - Nếu không có internet hoặc muốn chạy offline, chuyển `DATABASE_URL=sqlite:///./data/opic_studio.db`.

### Các bảng dữ liệu chính (SQLAlchemy Models):
1. `users`: Tài khoản ứng viên (email, mật khẩu băm, mã công ty/lớp học).
2. `test_sessions`: Phiên thi (chế độ exam/practice, survey, level tự đánh giá 1-6, 3 chủ đề đã chọn, số token & chi phí LLM).
3. `questions`: 15 câu hỏi của phiên thi (loại câu, topic, độ khó, audio path, khung hướng dẫn tiếng Việt).
4. `answers`: Bản ghi âm của ứng viên (audio_path, transcript thô, transcript đã sửa, thời lượng, word confidences).
5. `answer_versions`: Lưu lịch sử mỗi lần chỉnh sửa transcript hoặc chấp nhận bản rewrite (version 1, 2, 3...).
6. `evaluations`: Kết quả chấm điểm ACTFL cho từng version (level IL/IM/IH, 6 điểm thành phần 1-5, kiểm soát thì quá khứ/hiện tại/tương lai, kiểm tra tình huống bất ngờ - complication, 3 hành động cụ thể để đạt IH).
7. `feedback_items`: Chi tiết 3-5 lỗi ngữ pháp/từ vựng kèm câu sửa và giải thích tiếng Việt.
8. `model_answers`: 3 câu trả lời mẫu (IL ~30-45s, IM ~60s, IH ~90-120s) kèm lý do vì sao đạt level đó, phân đoạn câu cho tính năng Shadowing.
9. `session_reports`: Báo cáo tổng thể cả bài thi, biểu đồ radar 6 tiêu chí, kế hoạch ôn tập 4 tuần, đường dẫn file PDF ReportLab.
10. `llm_usage_logs`: Theo dõi lượng token prompt/completion và chi phí USD phát sinh mỗi phiên.

---

## 4. Thang điểm & Tiêu chuẩn chấm OPIc (Rubrics)

Được định nghĩa tập trung tại `backend/app/core/rubrics.py` và nhúng vào mọi prompt:
- **`below_IL` (Novice):** Câu rời rạc, từ đơn lẻ, ngập ngừng chiếm phần lớn thời lượng.
- **`IL` (Intermediate Low):** Chủ yếu câu đơn ngắn, thì hiện tại đơn, miêu tả bề nổi, ngập ngừng nhiều.
- **`IM` (Intermediate Mid):** Câu đã có liên kết (and, but, because, so), có cố gắng dùng thì quá khứ/tương lai (còn lỗi sai ở bất quy tắc), đoạn văn ngắn cơ bản.
- **`IH` (Intermediate High - MỤC TIÊU CỐT LÕI):**
  - Nói thành từng đoạn văn mạch lạc dài 60–120 giây.
  - Kiểm soát nhất quán cả 3 thì: Quá khứ (kể chuyện) &rarr; Hiện tại (miêu tả) &rarr; Tương lai (dự đoán/cảm nghĩ).
  - Có cao trào / sự cố bất ngờ (**Complication**) và cách giải quyết.
  - Xử lý mượt mà tình huống bất ngờ trong phần Role-play (Q11-Q13).

### 6 Tiêu chí đánh giá (Thang điểm 1 đến 5):
1. `fluency_and_length`: Độ trôi chảy và duy trì độ dài 60–120s.
2. `tense_control`: Khả năng làm chủ và chuyển đổi linh hoạt các thì.
3. `organization`: Bố cục đoạn văn (Mở đầu &rarr; Chi tiết &rarr; Sự cố &rarr; Kết luận).
4. `vocabulary`: Vốn từ vựng chuyên biệt theo chủ đề, collocations, phrasal verbs.
5. `grammar`: Độ chính xác ngữ pháp, chia động từ, âm đuôi (-s, -ed).
6. `task_completion`: Đáp ứng đầy đủ yêu cầu đề bài (hỏi đủ 3-4 câu trong role-play, đề xuất 2-3 giải pháp thay thế).

---

## 5. Quy trình 7 Bước của Bài Thi (The 7-Step Test Flow)

1. **System Check (Kiểm tra 5 bước chuẩn OPIc demo):**
   - Bandwidth (ping server < 1000ms).
   - Web browser (Chrome/Edge/Firefox/Safari; link hướng dẫn cấp quyền mic).
   - Microphone (Ghi âm thử, nghe lại, bấm Yes/No xác nhận).
   - Video (Kiểm tra video mẫu chạy mượt).
   - Captions (Kiểm tra và nhắc nhở tắt phụ đề tự động của trình duyệt).
   - *Chỉ khi cả 5 mục đều Pass thì nút "Next" mới kích hoạt.*
2. **Background Survey:** Khảo sát nghề nghiệp, tình trạng đi học, nơi ở, hoạt động giải trí, sở thích, thể thao, du lịch.
3. **Self-Assessment (Level 1-6):** Chọn độ khó tự đánh giá (Song ngữ EN/VI; Level 4 & 5 khuyến nghị cho mục tiêu IH).
4. **Topic Selection (Bắt buộc chọn đúng 3 trong 5 chủ đề):**
   1. Environment (Môi trường)
   2. Human Rights (Quyền con người & Bình đẳng)
   3. Global Workplace (Môi trường làm việc toàn cầu)
   4. Socio-Cultural Issues (Vấn đề Văn hóa - Xã hội)
   5. Communication Media (Phương tiện truyền thông)
   *Validation chặn nếu không đủ hoặc vượt quá 3 chủ đề.*
5. **Pre-test Setup & Warm-up:** Kiểm tra tai nghe, Eva đọc câu hỏi khởi động, ứng viên nói thử để kiểm tra âm lượng.
6. **Test (Bộ 15 câu hỏi chính thức):**
   - Q1: Tự giới thiệu bản thân - **câu cố định mặc định (`SELF_INTRO_QUESTION`), không do AI tạo và KHÔNG chấm điểm** (giống OPIc thật). Backend trả 400 nếu gọi evaluate/rewrite cho câu này; báo cáo tổng không tính Q1. Mọi câu đều có nút **Next** ở góc dưới bên phải để sang câu tiếp theo mà không cần nghe hay ghi âm (`GET /sessions/{id}/next-question?after_order=N`; ở Q15 nút thành **Finish**).
   - Q2–Q4: Combo 1 (Theo survey: Nhà ở / Thói quen / Sự cố tại nhà).
   - Q5–Q7: Combo 2 (Theo survey: Quán café / Công viên / Kỷ niệm đáng nhớ).
   - Q8–Q10: Combo 3 (Chủ đề 1 đã chọn: Miêu tả / Trải nghiệm / So sánh).
   - Q11–Q13: Role-Play Combo **3 câu bắt buộc** (Q11 hỏi 3-4 câu hỏi chi tiết → Q12 xử lý sự cố bất ngờ & đề xuất 2-3 giải pháp → Q13 kể trải nghiệm thật tương tự).
   - Q14: Chủ đề 2 đã chọn (Kể lại tình huống khó khăn / sự cố).
   - Q15: Chủ đề 3 đã chọn (So sánh quá khứ vs hiện tại & Xu hướng tương lai).
   - **Tạo đề bằng AI:** `build_session_questions()` gọi `OPENAI_MODEL` với survey + level + 3 chủ đề để tạo Q2-Q15 (prompt `prompts/generate_questions.txt`, validate `GeneratedQuestionSet` - đủ 14 câu Q2-Q15, Q11-Q13 đúng loại role-play). Lỗi/không hợp lệ → dùng ngân hàng câu hỏi `seed_data.py`. Hướng dẫn tiếng Việt cá nhân hóa được sinh nền (`prompts/generate_guides.txt`), trong lúc chờ dùng `DEFAULT_GUIDES_BY_TYPE`. Tắt bằng `AI_QUESTION_GENERATION=false`.
   - Eva đọc câu hỏi (cho phép nghe lại 1 lần). Chữ của câu hỏi bị ẩn mặc định (tắt hoàn toàn ở Exam Mode). Đồng hồ 60-120s.
   - **Công tắc "Strict exam mode"** ở bước Self-Assessment (lưu vào `test_sessions.mode`: bật = `exam`, tắt = `practice`):
     - Bật: sau khi Eva đọc xong có **5 giây** để nghe lại (1 lần, hết giờ là mất); không hiện câu hỏi/transcript; không lùi/nhảy câu; Next = bỏ qua vĩnh viễn (`POST /sessions/{id}/questions/{order}/skip` lưu câu trả lời rỗng); thoát giữa chừng vẫn lưu tiến trình và Resume tiếp tục từ câu chưa làm; kết quả chỉ hiện sau khi thi xong — báo cáo chấm song song toàn bộ câu trả lời và liệt kê đủ 15 câu (câu hỏi, câu trả lời, trạng thái).
     - Tắt: luyện tập như cũ; bấm Next vẫn mở trang coaching (câu hỏi, gợi ý, bài mẫu) nhưng không chấm điểm.
   - System Check không bắt buộc: có thể bấm Next bỏ qua.
   - **Thời gian nói theo từng câu** (`core/question_meta.py → question_timing`, trả về trong `QuestionResponse.timing`): câu dễ (tự giới thiệu, role-play hỏi) ~1 phút; miêu tả/thói quen 1:30; kể chuyện/so sánh/sự cố 2 phút; bộ đề mức IL được rút ngắn.
   - **Phân loại chủ đề** (`questions.category`, gán lúc tạo đề qua `derive_category`): self_intro, home, leisure, role_play và 5 chủ đề chính. Cột được thêm tự động bằng `ensure_schema()` khi khởi động (dự án không dùng Alembic).
   - Không còn mục tiêu cố định IH: báo cáo, lộ trình học và nhận xét được đánh giá theo mức người học đã chọn.
   - Tiếp tục phiên dở dang (Dashboard/History) sẽ quay về đúng bước setup còn thiếu (survey → chủ đề → mức độ) hoặc vào thi nếu đã có đề.
   - Chỉ khi chạy local (`npm run dev`): nút "DEV: Giả lập toàn bộ (không gọi AI)" ở bước Self-Assessment (`use_ai=false` → `test_sessions.dev_mock=true`, backend bỏ qua khi `ENVIRONMENT=production`). Phiên DEV dùng bộ đề mặc định và **giả lập mọi lệnh gọi AI/Soniox**: nhận dạng (ghi < 3 giây = im lặng, ≥ 3 giây = transcript mẫu có từ độ tin cậy thấp), chấm điểm, Improve, bài mẫu, báo cáo (dữ liệu mock trong `llm_service.get_mock_json_response`). Giao diện hiện badge "DEV".
   - Self-Assessment chỉ còn Level 3–6 (API từ chối level 1–2).
8. **Question Bank (tab "Bộ đề", `QuestionLibrary.jsx`, router `/api/library`):**
   - Hai chế độ xem: **Theo bộ đề** (từng lần thi) và **Theo chủ đề** (gom câu hỏi của mọi bộ đề theo `category`). Mỗi câu có bài mẫu (IL/IM/IH, mặc định theo mức đã thi), số lần đã luyện và level gần nhất.
   - Câu 1 (tự giới thiệu) không nằm trong bài nghe.
   - "Luyện lại": nghe Eva đọc, ghi âm, chấm điểm, sửa lỗi (dùng lại `AnswerCoaching`); mỗi lần luyện tạo `AnswerVersion` mới.
   - Nghe hằng ngày: chọn câu → `POST /api/library/playlist` ghép "câu hỏi + bài mẫu" thành **một file MP3** (`playlist_service.py`, tạo nền, client poll tiến độ, cache tại `data/audio_cache/playlists/`). Một file liền mạch giúp điện thoại vẫn phát khi tắt màn hình (kèm Media Session cho điều khiển trên màn hình khóa); có nút Lặp lại và Tải MP3.
7. **Coaching & Results (Trang phản hồi & Báo cáo):**
   - Transcript editable (mỗi lần sửa tạo 1 version).
   - Kết quả chấm điểm AI theo ACTFL, chỉ ra lỗi và giải thích tiếng Việt.
   - "Improve my answer": Rewrite lên band tiếp theo kèm diff so sánh trực quan.
   - 3 bài mẫu IL, IM, IH kèm chế độ Shadowing.
   - Báo cáo tổng thể kèm xuất file PDF ReportLab.

---

## 6. Thiết lập VSCode Tasks (Chạy Mặc định)

Thư mục `.vscode/` đã được cấu hình sẵn các file:
- `.vscode/tasks.json`:
  - **Phím tắt mặc định:** Nhấn `Ctrl + Shift + B` (hoặc mở command palette gõ `Tasks: Run Build Task`) để chạy **Start All (Backend + Frontend)**. Cả FastAPI (`port 8000`) và Vite (`port 5173`) sẽ chạy song song trên 2 terminal riêng biệt, đồng thời **tự động mở trình duyệt** tới `http://localhost:5173`.
  - Các task đơn lẻ: `Start Backend (FastAPI)`, `Start Frontend (Vite)` (kèm cờ `--open`), `Run Tests (Pytest Backend)`, `Build Frontend (Production)`.
- `.vscode/launch.json`: Hỗ trợ gõ `F5` để debug Backend FastAPI và gắn debugger Chrome.
- `.vscode/settings.json`: Cấu hình nhận diện `PYTHONPATH` cho VSCode Python extension.

---

## 7. Các lệnh vận hành nhanh (Quick Run Commands)

### Khởi động thủ công qua Terminal:
```powershell
# Chạy Backend (tại d:\Project\opic-practice-studio\backend)
python -m uvicorn app.main:app --reload --port 8000

# Chạy Frontend (tại d:\Project\opic-practice-studio\frontend)
npm run dev
```

### Chạy Unit Test & E2E Test:
```powershell
# Tại d:\Project\opic-practice-studio
$env:PYTHONPATH="backend"
python -m pytest backend/app/tests -v
```

### Build Frontend Production:
```powershell
cd frontend
npm run build
```

---

## 8. Quy tắc cho AI Agent / Gemini khi làm việc trong Repository này

1. **Không bao giờ hardcode model name:** Luôn sử dụng `settings.OPENAI_MODEL` và `settings.TTS_MODEL`.
2. **Không để lộ secret key ra phía frontend:** Mọi kết nối tới Soniox hay OpenAI bắt buộc phải đi qua backend proxy hoặc cấp token tạm thời có thời hạn ngắn.
3. **Tính toàn vẹn của Rubrics:** Mọi prompt đánh giá hay viết lại phải kế thừa từ hàm `get_rubric_prompt_text()` trong `backend/app/core/rubrics.py` để đảm bảo tiêu chí chấm điểm nhất quán.
4. **Bảo toàn dữ liệu người dùng:** Không được xóa các trường âm thanh hoặc version cũ của ứng viên. Mọi chỉnh sửa transcript hay rewrite đều phải tạo bản ghi `AnswerVersion` mới tăng dần.
5. **Giữ Disclaimer pháp lý:** Trong bất kỳ trang mới hay template báo cáo PDF nào được tạo, luôn đính kèm dòng tuyên bố miễn trừ trách nhiệm (non-affiliation disclaimer) với ACTFL / LTI.
6. **Kiểm soát Commit & Push (BẮT BUỘC):** Tuyệt đối **KHÔNG TỰ Ý** chạy lệnh `git commit` hoặc `git push` lên repository. Chỉ khi nào người dùng (USER) yêu cầu cụ thể hoặc xác nhận cho phép commit/push thì Agent mới được thực hiện. Khi hoàn thành công việc, hãy báo cáo danh sách các file đã thay đổi và chờ xác nhận từ người dùng. **Khi được người dùng xác nhận commit, chỉ đưa lên đúng 1 commit duy nhất (single commit) với commit message tóm tắt ngắn gọn, rõ ràng các nội dung chính đã chỉnh sửa trong phiên.**
