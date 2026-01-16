"""
Narration and TTS pipeline for slide-based presentations.

- Generates per-slide narration using Gemini
- Synthesizes speech using ElevenLabs TTS via LangChain
- Stores audio locally and returns durations
"""

import os
import re
import time
from typing import List, Dict, Any, Optional
from pathlib import Path
from elevenlabs.client import ElevenLabs
from elevenlabs.play import play
from mutagen import File as MutagenFile
from langchain_google_genai import ChatGoogleGenerativeAI
# from langchain_community.tools import ElevenLabsText2SpeechTool


OUTPUT_DIR = Path(__file__).parent / "output" / "audio"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)


def _clean_text(text: str) -> str:
    text = re.sub(r"\s+", " ", text).strip()
    return text


def _get_audio_duration_seconds(file_path: Path) -> float:
    audio = MutagenFile(str(file_path))
    if audio is None or not hasattr(audio, "info") or audio.info is None:
        return 0.0
    return float(audio.info.length or 0.0)


def _generate_slide_narration(
    slide: Dict[str, Any],
    model: Optional[str],
    target_words: int,
) -> str:
    title = slide.get("title", "")
    content = slide.get("content", "")
    subtitle = slide.get("subtitle", "")

    prompt = f"""
You are a professional narrator. Write a spoken narration for one presentation slide.

Slide title: {title}
Slide subtitle: {subtitle}
Slide content: {content}

Guidelines:
- Sound natural and conversational
- 1 slide only; do not mention other slides
- Target length: about {target_words} words
- Avoid lists; use sentences
- Do not include markdown or bullet symbols
- End with a complete sentence

Return only the narration text.
"""

    llm = ChatGoogleGenerativeAI(
        model = "gemini-2.5-flash",
        temperature=0.4,
    )

    response = llm.invoke(prompt)
    return _clean_text(response.content or "")


def _elevenlabs_tts(text: str) -> bytes:
    api_key = os.getenv("ELEVENLABS_API_KEY")
    if not api_key:
        raise RuntimeError("ELEVENLABS_API_KEY is not configured")
    elevenlabs = ElevenLabs(api_key=api_key)

    audio_generator = elevenlabs.text_to_speech.convert(
        text=text,
        voice_id="JBFqnCBsd6RMkjVDRZzb",
        model_id="eleven_multilingual_v2",
        output_format="mp3_44100_128",
    )
    
    # Consume the generator and return bytes
    return b"".join(audio_generator)


def generate_narrated_audio(
    slides: List[Dict[str, Any]],
    voice: str = "",
    audio_format: str = "mp3",
    target_words: int = 90,
    model: Optional[str] = None,
    model_id: Optional[str] = None,
) -> Dict[str, Any]:
    narrated_slides = []
    total_duration = 0.0

    for idx, slide in enumerate(slides):
        narration_text = _generate_slide_narration(slide, model, target_words)
        audio_bytes = _elevenlabs_tts(narration_text)
        timestamp = int(time.time())
        file_name = f"slide_{idx + 1}_{timestamp}.{audio_format}"
        file_path = OUTPUT_DIR / file_name
        file_path.write_bytes(audio_bytes)

        duration_seconds = _get_audio_duration_seconds(file_path)
        total_duration += duration_seconds

        narrated_slides.append(
            {
                "slide_index": idx,
                "title": slide.get("title", ""),
                "narration_text": narration_text,
                "audio_file": file_name,
                "duration_seconds": duration_seconds,
            }
        )

    return {
        "slides": narrated_slides,
        "total_duration_seconds": total_duration,
    }
