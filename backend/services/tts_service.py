"""
Text-to-Speech service using Edge-TTS (Microsoft Edge's neural TTS API).
Free, no API key required. 100+ voices across 50+ languages.
"""
from __future__ import annotations

from typing import Optional, Dict, Any, List

import edge_tts

# Maps our app language codes to default Edge-TTS voices
LANGUAGE_VOICE_MAP: Dict[str, str] = {
    "en-US": "en-US-JennyNeural",
    "en-GB": "en-GB-SoniaNeural",
    "en-IN": "en-IN-NeerjaExpressiveNeural",
    "de-DE": "de-DE-KatjaNeural",
    "ar-SA": "ar-SA-ZariyahNeural",
    "hi-IN": "hi-IN-SwaraNeural",
    "ta-IN": "ta-IN-PallaviNeural",
    "te-IN": "te-IN-ShrutiNeural",
    "bn-IN": "bn-IN-TanishaaNeural",
    "gu-IN": "gu-IN-DhwaniNeural",
    "kn-IN": "kn-IN-SapnaNeural",
    "ml-IN": "ml-IN-SobhanaNeural",
    "mr-IN": "mr-IN-AarohiNeural",
}

FALLBACK_VOICE = "en-US-JennyNeural"


def resolve_voice(language: Optional[str]) -> str:
    if not language:
        return FALLBACK_VOICE
    base = language.split("-")[0].lower() if "-" in language else language.lower()
    for code, voice in LANGUAGE_VOICE_MAP.items():
        if code.lower().startswith(base):
            return voice
    if language in LANGUAGE_VOICE_MAP:
        return LANGUAGE_VOICE_MAP[language]
    return FALLBACK_VOICE


async def text_to_speech(
    text: str,
    language: Optional[str] = None,
    voice: Optional[str] = None,
    rate: str = "+0%",
    pitch: str = "+0Hz",
) -> bytes:
    """Synthesize text to speech and return audio bytes (MP3 format)."""
    selected_voice = voice or resolve_voice(language)
    communicate = edge_tts.Communicate(
        text,
        selected_voice,
        rate=rate,
        pitch=pitch,
    )
    audio_bytes = bytearray()
    async for chunk in communicate.stream():
        if chunk["type"] == "audio":
            audio_bytes.extend(chunk["data"])
    return bytes(audio_bytes)


async def list_voices() -> List[Dict[str, Any]]:
    voices = await edge_tts.list_voices()
    return [
        {
            "name": v["ShortName"],
            "lang": v["Locale"],
            "gender": v["Gender"],
            "friendly_name": v.get("FriendlyName", v["ShortName"]),
            "locale": v["Locale"],
        }
        for v in voices
    ]


async def list_voices_grouped() -> Dict[str, List[Dict[str, Any]]]:
    voices = await list_voices()
    grouped: Dict[str, list] = {}
    for v in voices:
        lang = v["lang"]
        base = lang.split("-")[0].lower() if "-" in lang else lang.lower()
        if base not in grouped:
            grouped[base] = []
        grouped[base].append(v)
    for base in grouped:
        grouped[base].sort(key=lambda x: x["name"])
    return grouped
