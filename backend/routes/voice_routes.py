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
    audio = await text_to_speech(
        text=text,
        language=language,
        voice=voice,
        rate=rate,
    )
    if not audio:
        raise HTTPException(status_code=503, detail="TTS synthesis failed")
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
    return list_voices()


@router.post("/transcribe")
async def transcribe(
    file: UploadFile = File(...),
    language: Optional[str] = Form(None),
):
    return await transcribe_audio_file(file, language=language)
