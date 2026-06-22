"""
Text-to-speech using Kokoro TTS.
Kokoro is an 82M-parameter model (~300MB download) that runs at ~50ms/sentence on M4.
Falls back to macOS `say` command if Kokoro is unavailable.
"""
import io
import subprocess
import asyncio
import numpy as np

from config import settings

_kokoro = None


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
    Convert text to speech. Returns WAV audio bytes (24kHz, mono, float32).
    Uses Kokoro if available, otherwise falls back to macOS `say`.
    """
    if settings.tts_engine == "apple":
        return await _say_speak(text)

    kokoro = _get_kokoro()
    if kokoro is not None:
        return await asyncio.to_thread(_kokoro_speak, text, kokoro)
    return await _say_speak(text)


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
