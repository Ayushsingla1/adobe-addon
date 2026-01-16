"""
FastAPI Server for the LangGraph URL-to-Presentation Workflow

This server provides REST API endpoints for the Adobe Express add-on
to interact with the LangGraph agentic workflow.
"""

import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, HttpUrl
from typing import Optional, List
from dotenv import load_dotenv

from workflow import process_url

# Load environment variables
load_dotenv()

# Initialize FastAPI app
app = FastAPI(
    title="URL to Presentation API",
    description="Agentic workflow API that converts URLs (YouTube/blogs) to presentation slides",
    version="1.0.0"
)

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
    class Config:
        json_schema_extra = {
            "example": {
                "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
            }
        }


class SlideData(BaseModel):
    type: str
    title: str
    content: Optional[str] = ""
    subtitle: Optional[str] = ""
    slide_number: Optional[int] = None


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
        
        # Process the URL through the LangGraph workflow
        result = await process_url(request.url.strip())
        
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
