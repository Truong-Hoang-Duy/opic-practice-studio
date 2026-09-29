from app.routers.auth import router as auth_router
from app.routers.sessions import router as sessions_router
from app.routers.questions import router as questions_router
from app.routers.answers import router as answers_router
from app.routers.stt import router as stt_router
from app.routers.history import router as history_router
from app.routers.system import router as system_router

__all__ = [
    "auth_router",
    "sessions_router",
    "questions_router",
    "answers_router",
    "stt_router",
    "history_router",
    "system_router",
]
