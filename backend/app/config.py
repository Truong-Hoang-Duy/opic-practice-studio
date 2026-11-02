import os
from pathlib import Path
from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    # App Information
    APP_NAME: str = "OPIc Practice Studio"
    APP_VERSION: str = "1.0.0"
    ENVIRONMENT: str = "development"

    # OpenAI Settings
    OPENAI_API_KEY: str = ""
    OPENAI_MODEL: str = "gpt-5.6-luna"
    TTS_MODEL: str = "gpt-4o-mini-tts"
    TTS_VOICE: str = "alloy"  # Options: alloy, shimmer, nova, echo, fable, onyx

    # Eva Text-to-Speech provider:
    #   "kokoro"  -> open-source Kokoro-82M (Apache-2.0) running locally on CPU, no API key needed (default)
    #   "openai"  -> OpenAI TTS (TTS_MODEL / TTS_VOICE), requires a key with TTS access
    #   "browser" -> no server audio; the frontend reads questions with the browser's Web Speech API
    TTS_PROVIDER: str = "kokoro"
    KOKORO_VOICE: str = "af_heart"  # Young American female, calm & warm (closest to OPIc Eva). Alternatives: af_bella, af_sarah, af_nicole
    KOKORO_SPEED: float = 0.95
    KOKORO_MODEL_DIR: str = "./data/tts_models"
    KOKORO_MODEL_URL: str = "https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/kokoro-v1.0.onnx"
    KOKORO_VOICES_URL: str = "https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/voices-v1.0.bin"

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
