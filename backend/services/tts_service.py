from __future__ import annotations

from typing import Optional, Dict, Any, List

import edge_tts

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


KNOWN_VOICES: List[Dict[str, str]] = [
    {"name": "en-US-JennyNeural", "lang": "en-US", "gender": "Female", "locale": "en-US"},
    {"name": "en-US-AriaNeural", "lang": "en-US", "gender": "Female", "locale": "en-US"},
    {"name": "en-US-GuyNeural", "lang": "en-US", "gender": "Male", "locale": "en-US"},
    {"name": "en-GB-SoniaNeural", "lang": "en-GB", "gender": "Female", "locale": "en-GB"},
    {"name": "en-GB-RyanNeural", "lang": "en-GB", "gender": "Male", "locale": "en-GB"},
    {"name": "en-IN-NeerjaExpressiveNeural", "lang": "en-IN", "gender": "Female", "locale": "en-IN"},
    {"name": "en-IN-PrabhatNeural", "lang": "en-IN", "gender": "Male", "locale": "en-IN"},
    {"name": "de-DE-KatjaNeural", "lang": "de-DE", "gender": "Female", "locale": "de-DE"},
    {"name": "de-DE-ConradNeural", "lang": "de-DE", "gender": "Male", "locale": "de-DE"},
    {"name": "de-DE-AmalaNeural", "lang": "de-DE", "gender": "Female", "locale": "de-DE"},
    {"name": "ar-SA-ZariyahNeural", "lang": "ar-SA", "gender": "Female", "locale": "ar-SA"},
    {"name": "ar-SA-HamedNeural", "lang": "ar-SA", "gender": "Male", "locale": "ar-SA"},
    {"name": "hi-IN-SwaraNeural", "lang": "hi-IN", "gender": "Female", "locale": "hi-IN"},
    {"name": "hi-IN-MadhurNeural", "lang": "hi-IN", "gender": "Male", "locale": "hi-IN"},
    {"name": "ta-IN-PallaviNeural", "lang": "ta-IN", "gender": "Female", "locale": "ta-IN"},
    {"name": "ta-IN-ValluvarNeural", "lang": "ta-IN", "gender": "Male", "locale": "ta-IN"},
    {"name": "te-IN-ShrutiNeural", "lang": "te-IN", "gender": "Female", "locale": "te-IN"},
    {"name": "te-IN-MohanNeural", "lang": "te-IN", "gender": "Male", "locale": "te-IN"},
    {"name": "bn-IN-TanishaaNeural", "lang": "bn-IN", "gender": "Female", "locale": "bn-IN"},
    {"name": "bn-IN-BashkarNeural", "lang": "bn-IN", "gender": "Male", "locale": "bn-IN"},
    {"name": "gu-IN-DhwaniNeural", "lang": "gu-IN", "gender": "Female", "locale": "gu-IN"},
    {"name": "gu-IN-NiranjanNeural", "lang": "gu-IN", "gender": "Male", "locale": "gu-IN"},
    {"name": "kn-IN-SapnaNeural", "lang": "kn-IN", "gender": "Female", "locale": "kn-IN"},
    {"name": "kn-IN-GaganNeural", "lang": "kn-IN", "gender": "Male", "locale": "kn-IN"},
    {"name": "ml-IN-SobhanaNeural", "lang": "ml-IN", "gender": "Female", "locale": "ml-IN"},
    {"name": "ml-IN-MidhunNeural", "lang": "ml-IN", "gender": "Male", "locale": "ml-IN"},
    {"name": "mr-IN-AarohiNeural", "lang": "mr-IN", "gender": "Female", "locale": "mr-IN"},
    {"name": "mr-IN-ManoharNeural", "lang": "mr-IN", "gender": "Male", "locale": "mr-IN"},
]


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
    selected_voice = voice or resolve_voice(language)
    try:
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
    except Exception:
        return b""


def list_voices() -> List[Dict[str, str]]:
    return KNOWN_VOICES
