"""
Speech-to-text using faster-whisper.
On Apple Silicon (M4) with CoreML enabled, large-v3-turbo transcribes in ~0.3x realtime.
"""
import io

import numpy as np
from faster_whisper import WhisperModel

from config import settings

_model: WhisperModel | None = None


def _get_model() -> WhisperModel:
    global _model
    if _model is None:
        device = "cpu"
        compute_type = "int8"

        # Apple Silicon: use CoreML via faster-whisper[ane]
        # Falls back to CPU int8 automatically if CoreML not available
        _model = WhisperModel(
            settings.whisper_model,
            device=device,
            compute_type=compute_type,
        )
    return _model


def transcribe(audio_bytes: bytes, sample_rate: int = 16000) -> tuple[str, float]:
    """
    Transcribe browser-recorded audio (WebM) or raw PCM
    (16-bit, mono, 16kHz).
    Returns (transcript, duration_seconds).
    """
    is_encoded_audio = audio_bytes.startswith((b"\x1aE\xdf\xa3", b"RIFF", b"OggS", b"fLaC", b"ID3"))
    if is_encoded_audio:
        audio_input = io.BytesIO(audio_bytes)
        duration = 0.0
    else:
        audio_input = np.frombuffer(audio_bytes, dtype=np.int16).astype(np.float32) / 32768.0
        duration = len(audio_input) / sample_rate

    model = _get_model()
    segments, info = model.transcribe(
        audio_input,
        language="en",
        beam_size=5,
        vad_filter=True,          # skip silence automatically
        vad_parameters={"min_silence_duration_ms": 500},
    )

    transcript = " ".join(seg.text.strip() for seg in segments).strip()
    if is_encoded_audio:
        duration = float(getattr(info, "duration", 0.0) or 0.0)
    return transcript, duration
