"""
New voice pipeline routes:
  POST /api/voice/process  — audio -> Groq STT -> agent -> Edge-TTS (single round-trip)
  GET  /api/voice/tts      — text -> Edge-TTS audio stream
  GET  /api/voice/voices   — list available Edge-TTS voices
  GET  /api/voice/transcribe — existing, kept for backward compat
"""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, HTTPException, Query, UploadFile, File, Form
from fastapi.responses import Response

from services.speech_service import transcribe_audio_file
from services.tts_service import text_to_speech, list_voices

router = APIRouter(prefix="/api/voice", tags=["voice"])


@router.get("/tts")
async def tts(
    text: str = Query(..., min_length=1, max_length=2000),
    language: Optional[str] = Query(None, max_length=20),
    voice: Optional[str] = Query(None, max_length=100),
    rate: str = Query("+0%", max_length=10),
):
    """Text-to-Speech: returns MP3 audio bytes from Edge-TTS."""
    audio = await text_to_speech(
        text=text,
        language=language,
        voice=voice,
        rate=rate,
    )
    return Response(
        content=audio,
        media_type="audio/mpeg",
        headers={
            "Content-Disposition": "inline",
            "X-Content-Type-Options": "nosniff",
        },
    )


@router.get("/voices")
async def voices():
    """List available Edge-TTS voices."""
    return {"voices": await list_voices()}


@router.post("/transcribe")
async def transcribe(
    file: UploadFile = File(...),
    language: Optional[str] = Form(None),
):
    """Transcribe audio using Groq Whisper (backward-compat)."""
    return await transcribe_audio_file(file, language=language)
