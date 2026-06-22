"""
Unified LLM client — routes to Ollama or DeepSeek based on model name.

  deepseek-chat      → DeepSeek V3  (API)
  deepseek-reasoner  → DeepSeek R1  (API)
  anything else      → Ollama (local)
"""
import asyncio
import httpx
import ollama as _ollama

from config import settings

DEEPSEEK_MODELS = {"deepseek-chat", "deepseek-reasoner"}


async def chat(messages: list[dict], model: str | None = None) -> str:
    """Send messages to the selected model and return the response text."""
    model = model or settings.ollama_model
    if model in DEEPSEEK_MODELS:
        return await _deepseek_chat(messages, model)
    return await _ollama_chat(messages, model)


async def _ollama_chat(messages: list[dict], model: str) -> str:
    response = await asyncio.to_thread(
        _ollama.chat,
        model=model,
        messages=messages,
        stream=False,
    )
    return response["message"]["content"]


async def _deepseek_chat(messages: list[dict], model: str) -> str:
    if not settings.deepseek_api_key:
        raise ValueError("DeepSeek API key is not configured. Add it in Settings.")

    async with httpx.AsyncClient(timeout=90) as client:
        resp = await client.post(
            f"{settings.deepseek_base_url}/chat/completions",
            headers={
                "Authorization": f"Bearer {settings.deepseek_api_key}",
                "Content-Type": "application/json",
            },
            json={"model": model, "messages": messages},
        )
        resp.raise_for_status()
        return resp.json()["choices"][0]["message"]["content"]


def ollama_models() -> list[str]:
    try:
        return [m["name"] for m in _ollama.list()["models"]]
    except Exception:
        return []


def available_models() -> list[str]:
    """All models: Ollama (local) + DeepSeek (if key configured)."""
    models = ollama_models()
    if settings.deepseek_api_key:
        models += list(DEEPSEEK_MODELS)
    return models
