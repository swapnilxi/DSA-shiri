"""
Text-to-speech — five engines:
  kokoro        : local 82M-param model (~50ms/sentence on M4), fully offline
  piper         : local ONNX model (~50MB voice file, real-time on any CPU), fully offline
  cartesia      : cloud API, ~80ms latency, free tier ~500K chars/month
  deepgram      : cloud Aura API, ~200ms, $200 one-time signup credit
  apple         : macOS `say` command fallback
"""
import io
import asyncio
import numpy as np
import httpx

from config import settings

_kokoro = None
_piper_voice = None


def _get_kokoro():
    global _kokoro
    if _kokoro is None:
        try:
            from kokoro import KPipeline
            _kokoro = KPipeline(lang_code="a")  # "a" = American English
        except ImportError:
            pass
    return _kokoro


async def speak(text: str) -> bytes:
    """
    Convert text to speech. Returns WAV audio bytes.
    Dispatches to Cartesia, Piper, Kokoro, or Apple TTS based on settings.tts_engine.
    """
    if settings.tts_engine == "cartesia":
        return await _cartesia_speak(text)
    if settings.tts_engine == "deepgram":
        return await _deepgram_speak(text)
    if settings.tts_engine == "piper":
        return await asyncio.to_thread(_piper_speak, text)
    if settings.tts_engine == "apple":
        return await _say_speak(text)

    kokoro = _get_kokoro()
    if kokoro is not None:
        return await asyncio.to_thread(_kokoro_speak, text, kokoro)
    return await _say_speak(text)


async def _cartesia_speak(text: str) -> bytes:
    """Cartesia TTS — ~80ms latency, free tier ~500K chars/month."""
    if not settings.cartesia_api_key:
        raise ValueError("Cartesia API key is not configured. Add it in Settings.")

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            "https://api.cartesia.ai/tts/bytes",
            headers={
                "X-API-Key": settings.cartesia_api_key,
                "Cartesia-Version": "2024-06-10",
                "Content-Type": "application/json",
            },
            json={
                "model_id": settings.cartesia_model,
                "transcript": text,
                "voice": {"mode": "id", "id": settings.cartesia_voice_id},
                "output_format": {
                    "container": "wav",
                    "sample_rate": 24000,
                    "encoding": "pcm_f32le",
                },
            },
        )
        resp.raise_for_status()
        return resp.content


async def _deepgram_speak(text: str) -> bytes:
    """Deepgram Aura TTS — ~200ms latency, $200 one-time signup credit."""
    if not settings.deepgram_api_key:
        raise ValueError("Deepgram API key is not configured. Add it in Settings.")

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            f"https://api.deepgram.com/v1/speak?model={settings.deepgram_model}",
            headers={
                "Authorization": f"Token {settings.deepgram_api_key}",
                "Content-Type": "application/json",
            },
            json={"text": text},
        )
        resp.raise_for_status()
        return resp.content


def _piper_speak(text: str) -> bytes:
    """Piper TTS — local ONNX model, ~50MB voice file, real-time on any CPU."""
    global _piper_voice
    try:
        from piper.voice import PiperVoice
    except ImportError:
        raise RuntimeError("Piper not installed. Run: pip install piper-tts")

    import wave

    if _piper_voice is None or getattr(_piper_voice, "_model_name", None) != settings.piper_voice_model:
        _piper_voice = PiperVoice.load(settings.piper_voice_model)
        _piper_voice._model_name = settings.piper_voice_model  # type: ignore[attr-defined]

    buf = io.BytesIO()
    with wave.open(buf, "wb") as wav_file:
        _piper_voice.synthesize(text, wav_file)
    return buf.getvalue()


def _kokoro_speak(text: str, pipeline) -> bytes:
    import soundfile as sf

    audio_chunks = []
    for _, _, audio in pipeline(text, voice=settings.tts_voice, speed=settings.tts_speed):
        if audio is not None:
            audio_chunks.append(audio)

    if not audio_chunks:
        return b""

    combined = np.concatenate(audio_chunks)
    buf = io.BytesIO()
    sf.write(buf, combined, samplerate=24000, format="WAV")
    return buf.getvalue()


async def _say_speak(text: str) -> bytes:
    """macOS built-in TTS fallback — writes to an AIFF then converts to WAV."""
    import tempfile, os
    with tempfile.NamedTemporaryFile(suffix=".aiff", delete=False) as f:
        tmp_path = f.name

    proc = await asyncio.create_subprocess_exec(
        "say", "-o", tmp_path, text,
        stdout=asyncio.subprocess.DEVNULL,
        stderr=asyncio.subprocess.DEVNULL,
    )
    await proc.wait()

    # Convert AIFF → WAV using afconvert (built-in on macOS)
    wav_path = tmp_path.replace(".aiff", ".wav")
    proc = await asyncio.create_subprocess_exec(
        "afconvert", "-f", "WAVE", "-d", "LEI16@16000", tmp_path, wav_path,
        stdout=asyncio.subprocess.DEVNULL,
        stderr=asyncio.subprocess.DEVNULL,
    )
    await proc.wait()

    with open(wav_path, "rb") as f:
        data = f.read()

    os.unlink(tmp_path)
    os.unlink(wav_path)
    return data
