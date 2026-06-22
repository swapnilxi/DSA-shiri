from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # LLM — Ollama
    ollama_base_url: str = "http://localhost:11434"
    ollama_model: str = "llama3.1:8b"

    # LLM — DeepSeek (OpenAI-compatible API)
    deepseek_api_key: str = ""
    deepseek_base_url: str = "https://api.deepseek.com"

    # STT — faster-whisper
    # "large-v3-turbo" is best for M4 (speed + accuracy). Falls back to "base" on low RAM.
    whisper_model: str = "large-v3-turbo"
    whisper_device: str = "auto"  # "auto" uses CoreML on Apple Silicon

    # TTS — Kokoro voices: af_heart, af_bella, am_adam, bf_emma
    tts_engine: str = "kokoro"  # "kokoro" or "apple"
    tts_voice: str = "af_heart"
    tts_speed: float = 1.0

    # Database
    database_path: str = "../data/voicelearning.db"

    # Assessment
    session_timeout_minutes: int = 60
    max_questions_per_session: int = 10

    class Config:
        env_file = ".env"


settings = Settings()
