# AGENTS.md - Antigravity Agent Guidelines & Master Context

See full specification in [GEMINI.md](file:///d:/Project/opic-practice-studio/GEMINI.md).

## Quick Summary
- **App**: OPIc Practice Studio (Simulated test prep for Vietnamese learners targeting ACTFL Intermediate High - IH).
- **Stack**: Python 3.12, FastAPI, SQLAlchemy 2.0, Neon PostgreSQL (single unified DB for local and prod), React 18, Vite 5, Tailwind CSS.
- **LLM**: OpenAI via `OPENAI_MODEL` env var (default: `gpt-5.6-luna`), structured outputs validated with Pydantic.
- **TTS**: `TTS_PROVIDER` = `kokoro` (default, open-source Kokoro-82M on CPU, voice `af_heart`, auto-downloads model to `backend/data/tts_models/`) | `openai` | `browser`. Disk cache by `md5(text+voice+model)`. Frontend falls back to browser Web Speech API when no server audio.
- **Question generation**: Q1 is a fixed self-introduction and is never scored. LLM personalises Q2-Q15 from survey + level + topics; Q11-Q13 is always a 3-question role-play. Falls back to `seed_data.py` bank.
- **STT**: Soniox async (batch) transcription after recording: browser uploads the audio to `POST /api/answers`, backend transcribes it (`stt_service.transcribe_audio_file`). No real-time streaming. Never expose the Soniox key to the frontend.
- **VSCode Tasks**: `Ctrl+Shift+B` runs "Start All (Backend + Frontend)" in parallel.
- **Testing**: `python -m pytest backend/app/tests -v` with `PYTHONPATH="backend"`.
- **Git Commit & Push**: Tuyệt đối **không tự ý** commit/push code. Chỉ commit và push khi người dùng trực tiếp yêu cầu hoặc xác nhận cho phép. Khi commit, chỉ đưa lên **đúng 1 commit duy nhất** kèm message tóm tắt ngắn gọn các nội dung chính đã chỉnh sửa trong phiên.
