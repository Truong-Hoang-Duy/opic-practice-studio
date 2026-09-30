# AGENTS.md - Antigravity Agent Guidelines & Master Context

See full specification in [GEMINI.md](file:///d:/Project/opic-practice-studio/GEMINI.md).

## Quick Summary
- **App**: OPIc Practice Studio (Simulated test prep for Vietnamese learners targeting ACTFL Intermediate High - IH).
- **Stack**: Python 3.12, FastAPI, SQLAlchemy 2.0, Neon PostgreSQL (single unified DB for local and prod), React 18, Vite 5, Tailwind CSS.
- **LLM**: OpenAI via `OPENAI_MODEL` env var (default: `gpt-5.6-luna`), structured outputs validated with Pydantic.
- **TTS**: OpenAI TTS via `TTS_MODEL` (default: `gpt-4o-mini-tts`, voice: `alloy`), disk cache by `md5(text+voice+model)`.
- **STT**: Soniox WebSocket proxy `/ws/stt` and temporary key issuer `/api/stt/token`. Never expose permanent key to frontend.
- **VSCode Tasks**: `Ctrl+Shift+B` runs "Start All (Backend + Frontend)" in parallel.
- **Testing**: `python -m pytest backend/app/tests -v` with `PYTHONPATH="backend"`.
- **Git Commit & Push**: Tuyệt đối **không tự ý** commit/push code. Chỉ commit và push khi người dùng trực tiếp yêu cầu hoặc xác nhận cho phép. Khi commit, chỉ đưa lên **đúng 1 commit duy nhất** kèm message tóm tắt ngắn gọn các nội dung chính đã chỉnh sửa trong phiên.
