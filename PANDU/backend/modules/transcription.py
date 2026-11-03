import os
import tempfile
from functools import lru_cache
from pathlib import Path

try:
    from faster_whisper import WhisperModel
except ImportError:  # pragma: no cover - dependency may be absent in constrained environments
    WhisperModel = None


@lru_cache(maxsize=1)
def _get_model():
    if WhisperModel is None:
        raise RuntimeError(
            "Local Whisper is not installed. Install the backend requirements or use a configured remote transcription service."
        )

    model_size = os.getenv("WHISPER_MODEL_SIZE", "base")
    return WhisperModel(model_size, device="cpu", compute_type="int8")


def transcribe_audio(audio: bytes, suffix: str) -> str:
    allowed_suffixes = {".webm", ".wav", ".mp3", ".m4a", ".mp4", ".ogg", ".flac"}
    suffix = suffix if suffix in allowed_suffixes else ".webm"
    file_descriptor, audio_path = tempfile.mkstemp(suffix=suffix)

    try:
        with os.fdopen(file_descriptor, "wb") as audio_file:
            audio_file.write(audio)

        segments, _ = _get_model().transcribe(audio_path, vad_filter=True)
        return " ".join(segment.text.strip() for segment in segments).strip()
    finally:
        Path(audio_path).unlink(missing_ok=True)