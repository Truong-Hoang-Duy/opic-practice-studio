from app.routers.auth import router as auth_router
from app.routers.sessions import router as sessions_router
from app.routers.questions import router as questions_router
from app.routers.answers import router as answers_router
from app.routers.stt import router as stt_router
from app.routers.history import router as history_router
from app.routers.system import router as system_router
from app.routers.library import router as library_router
from app.routers.vocabulary import router as vocabulary_router
from app.routers.daily import router as daily_router

__all__ = [
    "auth_router",
    "sessions_router",
    "questions_router",
    "answers_router",
    "stt_router",
    "history_router",
    "system_router",
    "library_router",
    "vocabulary_router",
    "daily_router",
]
