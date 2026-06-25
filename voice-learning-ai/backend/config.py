from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # LLM — Ollama
    ollama_base_url: str = "http://localhost:11434"
    ollama_model: str = "llama3.1:8b"

    # LLM — DeepSeek (OpenAI-compatible API)
    deepseek_api_key: str = ""
    deepseek_base_url: str = "https://api.deepseek.com"

    # LLM — Google Gemini (OpenAI-compatible endpoint)
    gemini_api_key: str = ""
    gemini_base_url: str = "https://generativelanguage.googleapis.com/v1beta/openai"

    # STT — engine: "whisper" | "moonshine" | "groq" | "deepgram"
    stt_engine: str = "whisper"

    # STT — faster-whisper (local, default)
    # "large-v3-turbo" is best for M4; use "small" or "base" on M2.
    whisper_model: str = "large-v3-turbo"
    whisper_device: str = "auto"  # "auto" uses CoreML on Apple Silicon

    # STT — Moonshine ONNX (local, ~25 MB tiny / ~75 MB base, great for M2)
    # Install: pip install moonshine-onnx  then set STT_ENGINE=moonshine
    moonshine_model: str = "moonshine/tiny"  # or "moonshine/base"

    # STT — Groq Whisper (cloud, free tier ~18K sec/month, 300× realtime)
    groq_api_key: str = ""
    groq_stt_model: str = "whisper-large-v3-turbo"  # or "distil-whisper-large-v3-en"

    # STT — Deepgram Nova (cloud, uses same API key as Deepgram TTS)
    # nova-3 = most accurate; nova-2 = slightly faster; base = cheapest
    deepgram_stt_model: str = "nova-3"

    # TTS — Kokoro voices: af_heart, af_bella, am_adam, bf_emma
    tts_engine: str = "kokoro"  # "kokoro", "apple", or "cartesia"
    tts_voice: str = "af_heart"
    tts_speed: float = 1.0

    # TTS — Cartesia (cloud, free tier: ~500K chars/month)
    cartesia_api_key: str = ""
    cartesia_voice_id: str = "47c38ca4-5f35-497b-b1a3-415245fb35e1"  # Daniel (English)
    # sonic-2 = best quality; sonic-english = faster, cheaper
    cartesia_model: str = "sonic-2"

    # TTS — Piper (local, lightweight ~50MB voice file, real-time on CPU)
    # Install: pip install piper-tts
    # Voice model download: https://huggingface.co/rhasspy/piper-voices
    piper_voice_model: str = "en_US-lessac-medium"

    # TTS — Deepgram Aura (cloud, $200 one-time credit on signup)
    deepgram_api_key: str = ""
    # aura-2-en-us = best quality; aura-asteria-en = fastest/cheapest
    deepgram_model: str = "aura-2-en-us"

    # Database
    database_path: str = "../data/voicelearning.db"

    # Assessment
    session_timeout_minutes: int = 60
    max_questions_per_session: int = 10

    class Config:
        env_file = ".env"


settings = Settings()
