import os
import hashlib
import wave
import struct
import math
from pathlib import Path
from typing import Optional
from openai import OpenAI
from app.config import settings

def get_audio_hash(text: str, voice: str, model: str) -> str:
    combined = f"{text.strip().lower()}_{voice}_{model}"
    return hashlib.md5(combined.encode("utf-8")).hexdigest()

def generate_fallback_wav(filepath: str, duration_sec: float = 3.0):
    """
    Generates a soft, pleasant chime WAV file when OpenAI API key is unavailable,
    ensuring browser playback, audio tests, and avatar animations always function seamlessly.
    """
    sample_rate = 24000
    n_samples = int(sample_rate * duration_sec)
    
    with wave.open(filepath, "w") as wav_file:
        wav_file.setnchannels(1) # mono
        wav_file.setsampwidth(2) # 16-bit
        wav_file.setframerate(sample_rate)
        
        # Friendly ascending chime frequencies
        freqs = [440.0, 554.37, 659.25]
        frames = bytearray()
        
        for i in range(n_samples):
            t = float(i) / sample_rate
            # Chime sequence
            chord_idx = min(int(t * 3 / duration_sec), 2)
            f = freqs[chord_idx]
            # Soft envelope decay
            envelope = math.exp(-2.0 * (t % (duration_sec / 3.0)))
            val = int(8000.0 * envelope * math.sin(2.0 * math.pi * f * t))
            frames.extend(struct.pack("<h", val))
            
        wav_file.writeframes(frames)

def synthesize_speech(
    text: str,
    voice: Optional[str] = None,
    model: Optional[str] = None
) -> str:
    """
    Synthesizes speech using OpenAI TTS. Caches audio on disk by hash(text+voice+model).
    Returns the relative path to the cached audio file.
    """
    voice = voice or settings.TTS_VOICE
    model = model or settings.TTS_MODEL

    audio_hash = get_audio_hash(text, voice, model)
    filename = f"eva_{audio_hash}.mp3"
    filepath = os.path.join(settings.AUDIO_CACHE_DIR, filename)
    relative_url = f"/data/audio_cache/{filename}"

    # Return cached file if it already exists
    if os.path.exists(filepath) and os.path.getsize(filepath) > 0:
        return relative_url

    # Check for OpenAI API key
    if not settings.OPENAI_API_KEY or settings.OPENAI_API_KEY.startswith("your_"):
        fallback_filename = f"eva_{audio_hash}.wav"
        fallback_path = os.path.join(settings.AUDIO_CACHE_DIR, fallback_filename)
        fallback_url = f"/data/audio_cache/{fallback_filename}"
        if not os.path.exists(fallback_path):
            generate_fallback_wav(fallback_path, duration_sec=3.5)
        return fallback_url

    try:
        client = OpenAI(api_key=settings.OPENAI_API_KEY, timeout=10.0)
        response = client.audio.speech.create(
            model=model if "tts" in model else "tts-1",
            voice=voice,
            input=text,
            speed=0.95  # Slightly slower for warm, professional test interviewer pacing
        )
        response.stream_to_file(filepath)
        return relative_url
    except Exception as e:
        # Fallback to neutral chime wave if OpenAI TTS fails or rate limits
        fallback_filename = f"eva_{audio_hash}.wav"
        fallback_path = os.path.join(settings.AUDIO_CACHE_DIR, fallback_filename)
        fallback_url = f"/data/audio_cache/{fallback_filename}"
        generate_fallback_wav(fallback_path, duration_sec=3.0)
        return fallback_url
