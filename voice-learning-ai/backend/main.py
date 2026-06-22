import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from pydantic import BaseModel

from db.database import init_db
from routers import interview, questions, progress, resume
from services.llm import ollama_models, DEEPSEEK_MODELS
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
    }


@app.get("/models")
async def get_models():
    """All available models grouped by provider."""
    ol = ollama_models()
    ds_configured = bool(settings.deepseek_api_key)
    return {
        "ollama": ol,
        "deepseek": sorted(DEEPSEEK_MODELS),
        "deepseek_configured": ds_configured,
        "default": settings.ollama_model,
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
    if engine not in {"kokoro", "apple"}:
        from fastapi import HTTPException
        raise HTTPException(400, "TTS engine must be 'kokoro' or 'apple'")

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
