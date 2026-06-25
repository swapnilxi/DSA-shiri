"""
Speech-to-text — four engines:
  whisper   : local faster-whisper (CoreML on Apple Silicon), free, offline
  moonshine : local ONNX ~25 MB, faster than Whisper base on Apple Silicon ✅ M2
  groq      : cloud Groq Whisper, free tier ~18K sec/month, ~300× realtime
  deepgram  : cloud Deepgram Nova-3, ~100ms, uses same Deepgram API key as TTS
"""
import asyncio
import io

import httpx
import numpy as np

from config import settings

_whisper_model = None
_moonshine_model = None


def _get_whisper():
    global _whisper_model
    if _whisper_model is None:
        from faster_whisper import WhisperModel
        _whisper_model = WhisperModel(
            settings.whisper_model,
            device="cpu",
            compute_type="int8",
        )
    return _whisper_model


def _get_moonshine():
    global _moonshine_model
    if _moonshine_model is None:
        try:
            from moonshine_onnx import MoonshineOnnxModel
            _moonshine_model = MoonshineOnnxModel(model_name=settings.moonshine_model)
        except ImportError:
            raise RuntimeError(
                "moonshine-onnx not installed. Run: pip install moonshine-onnx"
            )
    return _moonshine_model


async def transcribe(audio_bytes: bytes, sample_rate: int = 16000) -> tuple[str, float]:
    """
    Transcribe audio. Returns (transcript, duration_seconds).
    Dispatches based on settings.stt_engine.
    """
    if settings.stt_engine == "moonshine":
        return await asyncio.to_thread(_moonshine_transcribe, audio_bytes, sample_rate)
    if settings.stt_engine == "groq":
        return await _groq_transcribe(audio_bytes)
    if settings.stt_engine == "deepgram":
        return await _deepgram_transcribe(audio_bytes)
    return await asyncio.to_thread(_whisper_transcribe, audio_bytes, sample_rate)


def _whisper_transcribe(audio_bytes: bytes, sample_rate: int = 16000) -> tuple[str, float]:
    is_encoded = audio_bytes.startswith((b"\x1aE\xdf\xa3", b"RIFF", b"OggS", b"fLaC", b"ID3"))
    if is_encoded:
        audio_input = io.BytesIO(audio_bytes)
        duration = 0.0
    else:
        audio_input = np.frombuffer(audio_bytes, dtype=np.int16).astype(np.float32) / 32768.0
        duration = len(audio_input) / sample_rate

    model = _get_whisper()
    segments, info = model.transcribe(
        audio_input,
        language="en",
        beam_size=5,
        vad_filter=True,
        vad_parameters={"min_silence_duration_ms": 500},
    )

    transcript = " ".join(seg.text.strip() for seg in segments).strip()
    if is_encoded:
        duration = float(getattr(info, "duration", 0.0) or 0.0)
    return transcript, duration


def _moonshine_transcribe(audio_bytes: bytes, sample_rate: int = 16000) -> tuple[str, float]:
    """Moonshine ONNX — ~25 MB tiny model, faster than Whisper base on Apple Silicon."""
    # Moonshine expects float32 numpy array at 16 kHz mono
    is_encoded = audio_bytes.startswith((b"\x1aE\xdf\xa3", b"RIFF", b"OggS", b"fLaC", b"ID3"))
    if is_encoded:
        # Decode with soundfile if available, otherwise fall back to whisper
        try:
            import soundfile as sf
            audio_array, sr = sf.read(io.BytesIO(audio_bytes), dtype="float32", always_2d=False)
            if sr != 16000:
                from scipy.signal import resample
                audio_array = resample(audio_array, int(len(audio_array) * 16000 / sr))
            duration = len(audio_array) / 16000
        except Exception:
            return _whisper_transcribe(audio_bytes, sample_rate)
    else:
        audio_array = np.frombuffer(audio_bytes, dtype=np.int16).astype(np.float32) / 32768.0
        duration = len(audio_array) / sample_rate

    model = _get_moonshine()
    tokens = model.generate(audio_array[np.newaxis, :])
    transcript = model.tokenizer.decode_batch(tokens)[0].strip()
    return transcript, duration


async def _groq_transcribe(audio_bytes: bytes) -> tuple[str, float]:
    """Groq Whisper — cloud, free tier ~18K sec/month, ~300× realtime."""
    if not settings.groq_api_key:
        raise ValueError("Groq API key is not configured. Add it in Settings.")

    # Detect format from magic bytes
    if audio_bytes.startswith(b"\x1aE\xdf\xa3"):
        filename, content_type = "audio.webm", "audio/webm"
    elif audio_bytes.startswith(b"RIFF"):
        filename, content_type = "audio.wav", "audio/wav"
    elif audio_bytes.startswith(b"OggS"):
        filename, content_type = "audio.ogg", "audio/ogg"
    else:
        filename, content_type = "audio.webm", "audio/webm"

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            "https://api.groq.com/openai/v1/audio/transcriptions",
            headers={"Authorization": f"Bearer {settings.groq_api_key}"},
            files={"file": (filename, audio_bytes, content_type)},
            data={"model": settings.groq_stt_model, "language": "en"},
        )
        resp.raise_for_status()
        data = resp.json()

    transcript = data.get("text", "").strip()
    duration = float(data.get("duration", 0.0))
    return transcript, duration


async def _deepgram_transcribe(audio_bytes: bytes) -> tuple[str, float]:
    """Deepgram Nova-3 — cloud, ~100ms, uses same API key as Deepgram TTS."""
    if not settings.deepgram_api_key:
        raise ValueError("Deepgram API key is not configured. Add it in Settings.")

    if audio_bytes.startswith(b"\x1aE\xdf\xa3"):
        content_type = "audio/webm"
    elif audio_bytes.startswith(b"RIFF"):
        content_type = "audio/wav"
    elif audio_bytes.startswith(b"OggS"):
        content_type = "audio/ogg"
    else:
        content_type = "audio/webm"

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            f"https://api.deepgram.com/v1/listen?model={settings.deepgram_stt_model}&language=en&smart_format=true",
            headers={
                "Authorization": f"Token {settings.deepgram_api_key}",
                "Content-Type": content_type,
            },
            content=audio_bytes,
        )
        resp.raise_for_status()
        data = resp.json()

    channels = data.get("results", {}).get("channels", [])
    if not channels:
        return "", 0.0
    alternatives = channels[0].get("alternatives", [])
    transcript = alternatives[0].get("transcript", "").strip() if alternatives else ""
    duration = float(data.get("metadata", {}).get("duration", 0.0))
    return transcript, duration
