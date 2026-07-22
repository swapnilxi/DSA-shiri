import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from pydantic import BaseModel

from db.database import init_db
from routers import interview, questions, progress, resume, practice
from services.llm import ollama_models, DEEPSEEK_MODELS, GEMINI_MODELS
from config import settings

ENV_PATH = os.path.join(os.path.dirname(__file__), ".env")


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield


app = FastAPI(title="Voice Learning AI API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(interview.router)
app.include_router(questions.router)
app.include_router(progress.router)
app.include_router(resume.router)
app.include_router(practice.router)


@app.get("/health")
async def health():
    ol_models = ollama_models()
    return {
        "status": "ok",
        "ollama_model": settings.ollama_model,
        "ollama_available": len(ol_models) > 0,
        "available_models": ol_models,
        "whisper_model": settings.whisper_model,
        "tts_engine": settings.tts_engine,
        "tts_voice": settings.tts_voice,
        "deepseek_configured": bool(settings.deepseek_api_key),
        "gemini_configured": bool(settings.gemini_api_key),
        "cartesia_configured": bool(settings.cartesia_api_key),
        "cartesia_model": settings.cartesia_model,
        "cartesia_voice_id": settings.cartesia_voice_id,
        "deepgram_configured": bool(settings.deepgram_api_key),
        "deepgram_model": settings.deepgram_model,
        "stt_engine": settings.stt_engine,
        "whisper_model": settings.whisper_model,
        "moonshine_model": settings.moonshine_model,
        "groq_configured": bool(settings.groq_api_key),
        "groq_stt_model": settings.groq_stt_model,
        "deepgram_stt_model": settings.deepgram_stt_model,
    }


@app.get("/models")
async def get_models():
    """All available models grouped by provider."""
    ol = ollama_models()
    ds_configured = bool(settings.deepseek_api_key)
    gemini_configured = bool(settings.gemini_api_key)
    return {
        "ollama": ol,
        "deepseek": sorted(DEEPSEEK_MODELS),
        "deepseek_configured": ds_configured,
        "gemini": sorted(GEMINI_MODELS),
        "gemini_configured": gemini_configured,
        "default": settings.ollama_model,
    }


@app.get("/settings")
async def get_settings():
    """Current app configuration (engines, models, key status)."""
    return {
        "ollama_model": settings.ollama_model,
        "stt_engine": settings.stt_engine,
        "tts_engine": settings.tts_engine,
        "whisper_model": settings.whisper_model,
        "moonshine_model": settings.moonshine_model,
        "tts_voice": settings.tts_voice,
        "deepseek_configured": bool(settings.deepseek_api_key),
        "gemini_configured": bool(settings.gemini_api_key),
        "cartesia_configured": bool(settings.cartesia_api_key),
        "deepgram_configured": bool(settings.deepgram_api_key),
        "groq_configured": bool(settings.groq_api_key),
    }


class DeepSeekKeyBody(BaseModel):
    api_key: str


class OllamaModelBody(BaseModel):
    model: str


class TtsEngineBody(BaseModel):
    engine: str


@app.post("/config/tts-engine")
async def save_tts_engine(body: TtsEngineBody):
    """Select Kokoro or macOS Apple TTS."""
    engine = body.engine.strip().lower()
    if engine not in {"kokoro", "apple", "cartesia", "piper", "deepgram"}:
        from fastapi import HTTPException
        raise HTTPException(400, "TTS engine must be 'kokoro', 'piper', 'cartesia', 'deepgram', or 'apple'")

    _upsert_env(ENV_PATH, "TTS_ENGINE", engine)
    settings.tts_engine = engine
    return {"ok": True, "engine": engine}


@app.post("/config/ollama-model")
async def save_ollama_model(body: OllamaModelBody):
    """Set the default Ollama model after verifying it is installed locally."""
    installed_models = ollama_models()
    if body.model not in installed_models:
        from fastapi import HTTPException
        raise HTTPException(
            400,
            f"Ollama model '{body.model}' is not installed. Available models: {installed_models}",
        )

    _upsert_env(ENV_PATH, "OLLAMA_MODEL", body.model)
    settings.ollama_model = body.model
    return {"ok": True, "model": body.model}


@app.post("/config/deepseek-key")
async def save_deepseek_key(body: DeepSeekKeyBody):
    """Persist DeepSeek API key to .env and apply it in-memory immediately."""
    _upsert_env(ENV_PATH, "DEEPSEEK_API_KEY", body.api_key)
    # Apply immediately without restart
    settings.deepseek_api_key = body.api_key
    return {"ok": True, "configured": bool(body.api_key)}


@app.delete("/config/deepseek-key")
async def remove_deepseek_key():
    """Clear the DeepSeek API key."""
    _upsert_env(ENV_PATH, "DEEPSEEK_API_KEY", "")
    settings.deepseek_api_key = ""
    return {"ok": True, "configured": False}


class GeminiKeyBody(BaseModel):
    api_key: str


@app.post("/config/gemini-key")
async def save_gemini_key(body: GeminiKeyBody):
    """Persist Gemini API key to .env and apply it in-memory immediately."""
    _upsert_env(ENV_PATH, "GEMINI_API_KEY", body.api_key)
    settings.gemini_api_key = body.api_key
    return {"ok": True, "configured": bool(body.api_key)}


@app.delete("/config/gemini-key")
async def remove_gemini_key():
    """Clear the Gemini API key."""
    _upsert_env(ENV_PATH, "GEMINI_API_KEY", "")
    settings.gemini_api_key = ""
    return {"ok": True, "configured": False}


class CartesiaKeyBody(BaseModel):
    api_key: str


class CartesiaVoiceBody(BaseModel):
    voice_id: str


@app.post("/config/cartesia-voice")
async def save_cartesia_voice(body: CartesiaVoiceBody):
    """Set the Cartesia voice ID."""
    voice_id = body.voice_id.strip()
    if not voice_id:
        from fastapi import HTTPException
        raise HTTPException(400, "voice_id cannot be empty")
    _upsert_env(ENV_PATH, "CARTESIA_VOICE_ID", voice_id)
    settings.cartesia_voice_id = voice_id
    return {"ok": True, "voice_id": voice_id}


class CartesiaModelBody(BaseModel):
    model: str


@app.post("/config/cartesia-model")
async def save_cartesia_model(body: CartesiaModelBody):
    """Switch between sonic-2 (quality) and sonic-english (faster/cheaper)."""
    if body.model not in {"sonic-2", "sonic-english"}:
        from fastapi import HTTPException
        raise HTTPException(400, "Cartesia model must be 'sonic-2' or 'sonic-english'")
    _upsert_env(ENV_PATH, "CARTESIA_MODEL", body.model)
    settings.cartesia_model = body.model
    return {"ok": True, "model": body.model}


@app.post("/config/cartesia-key")
async def save_cartesia_key(body: CartesiaKeyBody):
    """Persist Cartesia API key to .env and apply in-memory immediately."""
    _upsert_env(ENV_PATH, "CARTESIA_API_KEY", body.api_key)
    settings.cartesia_api_key = body.api_key
    return {"ok": True, "configured": bool(body.api_key)}


@app.delete("/config/cartesia-key")
async def remove_cartesia_key():
    """Clear the Cartesia API key."""
    _upsert_env(ENV_PATH, "CARTESIA_API_KEY", "")
    settings.cartesia_api_key = ""
    return {"ok": True, "configured": False}


class WhisperModelBody(BaseModel):
    model: str

WHISPER_MODELS = {"tiny", "base", "small", "medium", "large-v3", "large-v3-turbo"}

@app.post("/config/whisper-model")
async def save_whisper_model(body: WhisperModelBody):
    """Set the faster-whisper model size."""
    if body.model not in WHISPER_MODELS:
        from fastapi import HTTPException
        raise HTTPException(400, f"Whisper model must be one of: {sorted(WHISPER_MODELS)}")
    _upsert_env(ENV_PATH, "WHISPER_MODEL", body.model)
    settings.whisper_model = body.model
    import services.stt as _stt_mod
    _stt_mod._whisper_model = None
    return {"ok": True, "model": body.model}


class MoonshineModelBody(BaseModel):
    model: str

MOONSHINE_MODELS = {"moonshine/tiny", "moonshine/base"}

@app.post("/config/moonshine-model")
async def save_moonshine_model(body: MoonshineModelBody):
    """Set Moonshine model size (tiny ~25 MB or base ~75 MB)."""
    if body.model not in MOONSHINE_MODELS:
        from fastapi import HTTPException
        raise HTTPException(400, "Moonshine model must be 'moonshine/tiny' or 'moonshine/base'")
    _upsert_env(ENV_PATH, "MOONSHINE_MODEL", body.model)
    settings.moonshine_model = body.model
    import services.stt as _stt_mod
    _stt_mod._moonshine_model = None
    return {"ok": True, "model": body.model}


class GroqKeyBody(BaseModel):
    api_key: str

class GroqSttModelBody(BaseModel):
    model: str

GROQ_STT_MODELS = {"whisper-large-v3-turbo", "whisper-large-v3", "distil-whisper-large-v3-en"}

@app.post("/config/groq-key")
async def save_groq_key(body: GroqKeyBody):
    """Persist Groq API key (used for Whisper STT)."""
    _upsert_env(ENV_PATH, "GROQ_API_KEY", body.api_key)
    settings.groq_api_key = body.api_key
    return {"ok": True, "configured": bool(body.api_key)}

@app.delete("/config/groq-key")
async def remove_groq_key():
    _upsert_env(ENV_PATH, "GROQ_API_KEY", "")
    settings.groq_api_key = ""
    return {"ok": True, "configured": False}

@app.post("/config/groq-stt-model")
async def save_groq_stt_model(body: GroqSttModelBody):
    """Switch between Groq Whisper model variants."""
    if body.model not in GROQ_STT_MODELS:
        from fastapi import HTTPException
        raise HTTPException(400, f"Groq STT model must be one of: {sorted(GROQ_STT_MODELS)}")
    _upsert_env(ENV_PATH, "GROQ_STT_MODEL", body.model)
    settings.groq_stt_model = body.model
    return {"ok": True, "model": body.model}


class SttEngineBody(BaseModel):
    engine: str


class SttModelBody(BaseModel):
    model: str


@app.post("/config/stt-engine")
async def save_stt_engine(body: SttEngineBody):
    """Switch STT engine between 'whisper' (local) and 'deepgram' (cloud)."""
    engine = body.engine.strip().lower()
    if engine not in {"whisper", "moonshine", "groq", "deepgram"}:
        from fastapi import HTTPException
        raise HTTPException(400, "STT engine must be 'whisper', 'moonshine', 'groq', or 'deepgram'")
    _upsert_env(ENV_PATH, "STT_ENGINE", engine)
    settings.stt_engine = engine
    return {"ok": True, "engine": engine}


@app.post("/config/deepgram-stt-model")
async def save_deepgram_stt_model(body: SttModelBody):
    """Set the Deepgram STT model (nova-3, nova-2, base)."""
    if body.model not in {"nova-3", "nova-2", "base"}:
        from fastapi import HTTPException
        raise HTTPException(400, "Deepgram STT model must be 'nova-3', 'nova-2', or 'base'")
    _upsert_env(ENV_PATH, "DEEPGRAM_STT_MODEL", body.model)
    settings.deepgram_stt_model = body.model
    return {"ok": True, "model": body.model}


class DeepgramKeyBody(BaseModel):
    api_key: str


@app.post("/config/deepgram-key")
async def save_deepgram_key(body: DeepgramKeyBody):
    """Persist Deepgram API key to .env and apply in-memory immediately."""
    _upsert_env(ENV_PATH, "DEEPGRAM_API_KEY", body.api_key)
    settings.deepgram_api_key = body.api_key
    return {"ok": True, "configured": bool(body.api_key)}


@app.delete("/config/deepgram-key")
async def remove_deepgram_key():
    """Clear the Deepgram API key."""
    _upsert_env(ENV_PATH, "DEEPGRAM_API_KEY", "")
    settings.deepgram_api_key = ""
    return {"ok": True, "configured": False}


class DeepgramModelBody(BaseModel):
    model: str

DEEPGRAM_MODELS = {"aura-2-en-us", "aura-asteria-en", "aura-luna-en", "aura-stella-en"}

@app.post("/config/deepgram-model")
async def save_deepgram_model(body: DeepgramModelBody):
    """Switch between Deepgram Aura voice models."""
    if body.model not in DEEPGRAM_MODELS:
        from fastapi import HTTPException
        raise HTTPException(400, f"Unknown Deepgram model. Choose from: {sorted(DEEPGRAM_MODELS)}")
    _upsert_env(ENV_PATH, "DEEPGRAM_MODEL", body.model)
    settings.deepgram_model = body.model
    return {"ok": True, "model": body.model}


def _upsert_env(path: str, key: str, value: str) -> None:
    """Write or update a KEY=value line in a .env file."""
    lines: list[str] = []
    found = False
    if os.path.exists(path):
        with open(path) as f:
            lines = f.readlines()
        for i, line in enumerate(lines):
            if line.startswith(f"{key}=") or line.startswith(f"{key} ="):
                lines[i] = f"{key}={value}\n"
                found = True
                break
    if not found:
        lines.append(f"{key}={value}\n")
    with open(path, "w") as f:
        f.writelines(lines)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
