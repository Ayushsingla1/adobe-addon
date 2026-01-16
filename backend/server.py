"""
FastAPI Server for the LangGraph URL-to-Presentation Workflow

This server provides REST API endpoints for the Adobe Express add-on
to interact with the LangGraph agentic workflow.
"""

import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, HttpUrl
from typing import Optional, List
from dotenv import load_dotenv

from workflow import process_url
from narration import generate_narrated_audio

# Load environment variables
load_dotenv()

# Initialize FastAPI app
app = FastAPI(
    title="URL to Presentation API",
    description="Agentic workflow API that converts URLs (YouTube/blogs) to presentation slides",
    version="1.0.0"
)

# Serve generated audio files
audio_dir = os.path.join(os.path.dirname(__file__), "output", "audio")
os.makedirs(audio_dir, exist_ok=True)
app.mount("/audio", StaticFiles(directory=audio_dir), name="audio")

# Configure CORS for Adobe Express add-on
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Request/Response models
class URLRequest(BaseModel):
    url: str
    slide_count: Optional[int] = None
    class Config:
        json_schema_extra = {
            "example": {
                "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
                "slide_count": 8
            }
        }


class SlideData(BaseModel):
    type: str
    title: str
    content: Optional[str] = ""
    subtitle: Optional[str] = ""
    slide_number: Optional[int] = None


class NarrationOptions(BaseModel):
    voice: str = ""
    audio_format: str = "mp3"
    target_words: int = 90
    transition_ms: int = 400
    model: Optional[str] = None
    model_id: Optional[str] = None


class NarrationRequest(BaseModel):
    slides: List[SlideData]
    options: NarrationOptions = NarrationOptions()


class NarratedSlide(BaseModel):
    slide_index: int
    title: str
    narration_text: str
    audio_url: str
    duration_seconds: float


class NarrationResponse(BaseModel):
    success: bool
    slides: List[NarratedSlide]
    total_duration_seconds: float
    transition_ms: int
    error: Optional[str] = None


class PresentationResponse(BaseModel):
    success: bool
    url: str
    url_type: str
    title: str
    slides: List[SlideData]
    error: Optional[str] = None


class HealthResponse(BaseModel):
    status: str
    message: str


@app.get("/", response_model=HealthResponse)
async def root():
    """Root endpoint - health check."""
    return HealthResponse(
        status="healthy",
        message="URL to Presentation API is running"
    )


@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint."""
    # Check if Google API key is configured
    api_key = os.getenv("GOOGLE_API_KEY")
    if not api_key:
        return HealthResponse(
            status="warning",
            message="API is running but GOOGLE_API_KEY is not configured"
        )
    
    return HealthResponse(
        status="healthy",
        message="All systems operational"
    )


@app.post("/api/generate-presentation", response_model=PresentationResponse)
async def generate_presentation(request: URLRequest):
    """
    Main endpoint: Process a URL and generate presentation slides.
    
    Accepts YouTube URLs or blog/website URLs and returns structured
    presentation data suitable for Adobe Express.
    """
    try:
        # Validate URL is not empty
        if not request.url or not request.url.strip():
            raise HTTPException(status_code=400, detail="URL cannot be empty")
        
        if request.slide_count is not None and request.slide_count <= 0:
            raise HTTPException(status_code=400, detail="Slide count must be a positive integer")

        # Process the URL through the LangGraph workflow
        result = await process_url(request.url.strip(), request.slide_count)
        
        # Convert to response model
        slides = [SlideData(**slide) for slide in result["slides"]]
        
        return PresentationResponse(
            success=result["success"],
            url=result["url"],
            url_type=result["url_type"],
            title=result["title"],
            slides=slides,
            error=result["error"]
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to process URL: {str(e)}"
        )


@app.post("/api/generate-narration", response_model=NarrationResponse)
async def generate_narration(request: NarrationRequest):
    """
    Generate per-slide narration text and TTS audio using Gemini + AssemblyAI.
    Returns audio URLs and durations for timed playback.
    """
    try:
        if not request.slides:
            raise HTTPException(status_code=400, detail="Slides cannot be empty")

        result = generate_narrated_audio(
            slides=[slide.dict() for slide in request.slides],
            voice=request.options.voice,
            audio_format=request.options.audio_format,
            target_words=request.options.target_words,
            model=request.options.model,
            model_id=request.options.model_id,
        )

        narrated_slides = []
        for slide in result["slides"]:
            narrated_slides.append(
                NarratedSlide(
                    slide_index=slide["slide_index"],
                    title=slide.get("title", ""),
                    narration_text=slide["narration_text"],
                    audio_url=f"/audio/{slide['audio_file']}",
                    duration_seconds=slide["duration_seconds"],
                )
            )

        return NarrationResponse(
            success=True,
            slides=narrated_slides,
            total_duration_seconds=result["total_duration_seconds"],
            transition_ms=request.options.transition_ms,
            error=None,
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate narration: {str(e)}"
        )


@app.post("/api/detect-url-type")
async def detect_url_type(request: URLRequest):
    """
    Utility endpoint: Detect whether a URL is YouTube or blog/website.
    """
    import re
    
    url = request.url
    
    youtube_patterns = [
        r'(youtube\.com/watch\?v=)',
        r'(youtu\.be/)',
        r'(youtube\.com/embed/)',
        r'(youtube\.com/v/)',
        r'(youtube\.com/shorts/)',
    ]
    
    is_youtube = any(re.search(pattern, url) for pattern in youtube_patterns)
    
    return {
        "url": url,
        "type": "youtube" if is_youtube else "blog"
    }


if __name__ == "__main__":
    import uvicorn
    
    port = int(os.getenv("PORT", 8000))
    
    uvicorn.run(
        "server:app",
        host="0.0.0.0",
        port=port,
        reload=True
    )
