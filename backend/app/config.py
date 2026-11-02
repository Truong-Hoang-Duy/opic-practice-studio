import os
from pathlib import Path
from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    # App Information
    APP_NAME: str = "OPIc Practice Studio"
    APP_VERSION: str = "1.0.0"
    ENVIRONMENT: str = "development"

    # OpenAI Settings (LLM Evaluation & Coaching)
    OPENAI_API_KEY: str = ""
    OPENAI_MODEL: str = "gpt-5.6-luna"

    # Eva Text-to-Speech (TTS):
    #   "edge"    -> Microsoft Edge Neural Voice (free, 0 MB server RAM, studio-grade natural American female voice) (default)
    #   "browser" -> no server audio; frontend reads questions with the browser's Web Speech API
    TTS_PROVIDER: str = "edge"
    EDGE_VOICE: str = "en-US-AvaNeural"  # Expressive, calm & warm American female voice (Eva)
    EDGE_RATE: str = "-4%"              # Slightly slower for optimal OPIc test comprehension

    # Question generation: personalise the 15 questions with the LLM (falls back to the curated bank on failure)
    AI_QUESTION_GENERATION: bool = True

    # Daily 5-minute workout: the challenge day starts at 00:00 in this UTC offset (Vietnam, no DST)
    DAILY_UTC_OFFSET_HOURS: int = 7

    # Speech-to-Text (STT) provider:
    #   "auto"           -> uses Groq Free Whisper API if GROQ_API_KEY is set, otherwise local faster-whisper (default)
    #   "faster_whisper" -> open-source Whisper (CTranslate2 int8) running locally on CPU, 100% free & offline
    #   "groq"           -> Groq Cloud Whisper Free API (whisper-large-v3-turbo), 0 MB RAM on Render/Vercel
    STT_PROVIDER: str = "auto"
    WHISPER_MODEL: str = "base.en"  # Options: tiny.en (~75MB), base.en (~145MB), small.en (~480MB), distil-medium.en (~750MB)
    WHISPER_COMPUTE_TYPE: str = "int8"
    WHISPER_MODEL_DIR: str = "./data/stt_models"
    WHISPER_LOW_MEMORY: bool = False  # Set true on 512MB Render Free tier (auto-detected when RENDER=true)

    # Optional Groq Free Whisper API (https://console.groq.com - free tier, 0 MB server RAM)
    GROQ_API_KEY: str = ""
    GROQ_WHISPER_MODEL: str = "whisper-large-v3-turbo"

    # Database
    DATABASE_URL: str = "sqlite:///./data/opic_studio.db"

    # Security & Auth
    SECRET_KEY: str = "super_secret_opic_jwt_key_development_2026_secure"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours

    # CORS
    CORS_ORIGINS: str = "http://localhost:5174,http://127.0.0.1:5174,http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000"

    # Directories
    BASE_DIR: Path = Path(__file__).resolve().parent.parent
    AUDIO_CACHE_DIR: str = "./data/audio_cache"
    AUDIO_UPLOAD_DIR: str = "./data/uploads"
    REPORTS_DIR: str = "./data/reports"

    @property
    def cors_origins_list(self) -> List[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]

    model_config = SettingsConfigDict(
        env_file=".env",
        extra="allow"
    )

settings = Settings()

# Ensure directories exist
os.makedirs(settings.AUDIO_CACHE_DIR, exist_ok=True)
os.makedirs(settings.AUDIO_UPLOAD_DIR, exist_ok=True)
os.makedirs(settings.REPORTS_DIR, exist_ok=True)
