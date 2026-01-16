"""
LangGraph Agentic Workflow for URL-to-Presentation Generation

This workflow:
1. Takes a URL input (YouTube or blog/website)
2. Routes to appropriate content extractor
3. Extracts content (transcript for YouTube, scraped content for blogs)
4. Refines content using Gemini 2.5 Flash
5. Generates structured presentation data for Adobe Express
"""

import re
from typing import TypedDict, Literal, List, Optional
from langgraph.graph import StateGraph, END
from langchain_google_genai import ChatGoogleGenerativeAI
from youtube_transcript_api import YouTubeTranscriptApi
from bs4 import BeautifulSoup
import requests
import json


# Define the state for our workflow
class WorkflowState(TypedDict):
    url: str
    url_type: Literal["youtube", "blog", "unknown"]
    raw_content: str
    title: str
    refined_content: str
    presentation_slides: List[dict]
    error: Optional[str]


def detect_url_type(state: WorkflowState) -> WorkflowState:
    """
    Router node: Detects if the URL is a YouTube video or a blog/website.
    """
    url = state["url"]
    
    # YouTube URL patterns
    youtube_patterns = [
        r'(youtube\.com/watch\?v=)',
        r'(youtu\.be/)',
        r'(youtube\.com/embed/)',
        r'(youtube\.com/v/)',
        r'(youtube\.com/shorts/)',
    ]
    
    is_youtube = any(re.search(pattern, url) for pattern in youtube_patterns)
    
    if is_youtube:
        state["url_type"] = "youtube"
    else:
        state["url_type"] = "blog"
    
    return state


def extract_youtube_id(url: str) -> Optional[str]:
    """Extract video ID from various YouTube URL formats."""
    patterns = [
        r'(?:youtube\.com/watch\?v=|youtu\.be/|youtube\.com/embed/|youtube\.com/v/|youtube\.com/shorts/)([a-zA-Z0-9_-]{11})',
    ]
    
    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return match.group(1)
    return None


def extract_youtube_content(state: WorkflowState) -> WorkflowState:
    """
    Extracts transcript from a YouTube video using youtube-transcript-api.
    """
    try:
        video_id = extract_youtube_id(state["url"])
        if not video_id:
            state["error"] = "Could not extract YouTube video ID from URL"
            state["raw_content"] = ""
            return state
        
        # Get transcript
        transcript_list = YouTubeTranscriptApi.get_transcript(video_id)
        
        # Combine transcript segments into full text
        full_transcript = " ".join([segment["text"] for segment in transcript_list])
        
        # Try to get video title from YouTube oEmbed API
        try:
            oembed_url = f"https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v={video_id}&format=json"
            response = requests.get(oembed_url, timeout=10)
            if response.status_code == 200:
                data = response.json()
                state["title"] = data.get("title", "YouTube Video Presentation")
            else:
                state["title"] = "YouTube Video Presentation"
        except:
            state["title"] = "YouTube Video Presentation"
        
        state["raw_content"] = full_transcript
        state["error"] = None
        
    except Exception as e:
        state["error"] = f"Failed to extract YouTube transcript: {str(e)}"
        state["raw_content"] = ""
        state["title"] = "YouTube Video Presentation"
    
    return state


def extract_blog_content(state: WorkflowState) -> WorkflowState:
    """
    Scrapes content from a blog or website URL.
    """
    try:
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
        }
        
        response = requests.get(state["url"], headers=headers, timeout=30)
        response.raise_for_status()
        
        soup = BeautifulSoup(response.content, "html.parser")
        
        # Extract title
        title = soup.find("title")
        state["title"] = title.get_text().strip() if title else "Blog Content Presentation"
        
        # Remove script and style elements
        for element in soup(["script", "style", "nav", "footer", "header", "aside"]):
            element.decompose()
        
        # Try to find main content areas
        main_content = None
        content_selectors = [
            "article",
            "main",
            "[role='main']",
            ".post-content",
            ".entry-content",
            ".article-content",
            ".content",
            "#content",
        ]
        
        for selector in content_selectors:
            main_content = soup.select_one(selector)
            if main_content:
                break
        
        # Fallback to body if no main content found
        if not main_content:
            main_content = soup.find("body")
        
        if main_content:
            # Get text with some structure preservation
            paragraphs = main_content.find_all(["p", "h1", "h2", "h3", "h4", "h5", "h6", "li"])
            text_parts = []
            
            for p in paragraphs:
                text = p.get_text().strip()
                if text and len(text) > 20:  # Filter out very short snippets
                    text_parts.append(text)
            
            state["raw_content"] = "\n\n".join(text_parts)
        else:
            state["raw_content"] = soup.get_text(separator="\n", strip=True)
        
        # Clean up excessive whitespace
        state["raw_content"] = re.sub(r'\n{3,}', '\n\n', state["raw_content"])
        state["error"] = None
        
    except requests.RequestException as e:
        state["error"] = f"Failed to fetch blog content: {str(e)}"
        state["raw_content"] = ""
        state["title"] = "Blog Content Presentation"
    except Exception as e:
        state["error"] = f"Error processing blog content: {str(e)}"
        state["raw_content"] = ""
        state["title"] = "Blog Content Presentation"
    
    return state


def refine_content(state: WorkflowState) -> WorkflowState:
    """
    Uses Gemini 2.5 Flash to refine and structure the extracted content.
    """
    if state["error"] or not state["raw_content"]:
        return state
    
    try:
        llm = ChatGoogleGenerativeAI(
            model="gemini-2.5-flash",
            temperature=0.3,
        )
        
        # Truncate content if too long (Gemini has context limits)
        content = state["raw_content"][:50000]  # Keep first 50k chars
        
        prompt = f"""You are an expert content analyzer and summarizer. 
Given the following content from a {'YouTube video transcript' if state['url_type'] == 'youtube' else 'blog/website'}, 
create a refined, well-structured summary that captures the key points and main ideas.

Original Title: {state['title']}

Content:
{content}

Please provide:
1. A refined, engaging title for a presentation
2. A concise executive summary (2-3 sentences)
3. 5-8 key points or sections that would make good presentation slides
4. For each key point, provide a brief explanation (1-2 sentences)

Format your response as JSON with this structure:
{{
    "title": "Refined presentation title",
    "summary": "Executive summary here",
    "key_points": [
        {{
            "heading": "Key Point 1",
            "content": "Brief explanation of this point"
        }},
        ...
    ]
}}

Ensure the content is suitable for a professional presentation."""

        response = llm.invoke(prompt)
        
        # Parse the JSON response
        response_text = response.content
        
        # Try to extract JSON from the response
        json_match = re.search(r'\{[\s\S]*\}', response_text)
        if json_match:
            refined_data = json.loads(json_match.group())
            state["refined_content"] = json.dumps(refined_data)
            state["title"] = refined_data.get("title", state["title"])
        else:
            state["refined_content"] = response_text
            
        state["error"] = None
        
    except Exception as e:
        state["error"] = f"Failed to refine content with Gemini: {str(e)}"
        # Create a basic structure from raw content as fallback
        state["refined_content"] = state["raw_content"]
    
    return state


def generate_presentation(state: WorkflowState) -> WorkflowState:
    """
    Generates structured presentation slide data for Adobe Express.
    """
    if state["error"] and not state["refined_content"]:
        # Create error slide
        state["presentation_slides"] = [{
            "type": "error",
            "title": "Error",
            "content": state["error"]
        }]
        return state
    
    try:
        # Try to parse refined content as JSON
        refined_data = json.loads(state["refined_content"])
        
        slides = []
        
        # Title slide
        slides.append({
            "type": "title",
            "title": refined_data.get("title", state["title"]),
            "subtitle": refined_data.get("summary", "")[:200] if refined_data.get("summary") else ""
        })
        
        # Content slides from key points
        key_points = refined_data.get("key_points", [])
        for i, point in enumerate(key_points):
            slides.append({
                "type": "content",
                "title": point.get("heading", f"Point {i+1}"),
                "content": point.get("content", ""),
                "slide_number": i + 2
            })
        
        # Summary/Thank you slide
        slides.append({
            "type": "closing",
            "title": "Thank You",
            "content": f"Presentation generated from: {state['url']}"
        })
        
        state["presentation_slides"] = slides
        
    except json.JSONDecodeError:
        # Fallback: Create basic slides from raw content
        content = state["refined_content"] or state["raw_content"]
        
        # Split content into chunks for slides
        paragraphs = content.split("\n\n")
        chunks = []
        current_chunk = ""
        
        for para in paragraphs:
            if len(current_chunk) + len(para) < 500:
                current_chunk += para + "\n\n"
            else:
                if current_chunk:
                    chunks.append(current_chunk.strip())
                current_chunk = para + "\n\n"
        
        if current_chunk:
            chunks.append(current_chunk.strip())
        
        chunks = chunks[:10]
        
        slides = [{
            "type": "title",
            "title": state["title"],
            "subtitle": ""
        }]
        
        for i, chunk in enumerate(chunks):
            slides.append({
                "type": "content",
                "title": f"Section {i+1}",
                "content": chunk[:400], 
                "slide_number": i + 2
            })
        
        slides.append({
            "type": "closing",
            "title": "Thank You",
            "content": f"Generated from: {state['url']}"
        })
        
        state["presentation_slides"] = slides
    
    return state


def route_by_url_type(state: WorkflowState) -> str:
    """
    Routes to the appropriate content extraction node based on URL type.
    """
    if state["url_type"] == "youtube":
        return "extract_youtube"
    else:
        return "extract_blog"


def create_workflow():
    """
    Creates and returns the LangGraph workflow.
    """
    # Initialize the graph
    workflow = StateGraph(WorkflowState)
    
    # Add nodes
    workflow.add_node("detect_url_type", detect_url_type)
    workflow.add_node("extract_youtube", extract_youtube_content)
    workflow.add_node("extract_blog", extract_blog_content)
    workflow.add_node("refine_content", refine_content)
    workflow.add_node("generate_presentation", generate_presentation)
    
    # Set entry point
    workflow.set_entry_point("detect_url_type")
    
    # Add conditional routing from URL type detection
    workflow.add_conditional_edges(
        "detect_url_type",
        route_by_url_type,
        {
            "extract_youtube": "extract_youtube",
            "extract_blog": "extract_blog"
        }
    )
    
    # Add edges from extraction to refinement
    workflow.add_edge("extract_youtube", "refine_content")
    workflow.add_edge("extract_blog", "refine_content")
    
    # Add edge from refinement to presentation generation
    workflow.add_edge("refine_content", "generate_presentation")
    
    # Add edge to end
    workflow.add_edge("generate_presentation", END)
    
    # Compile the workflow
    return workflow.compile()


# Create a singleton workflow instance
presentation_workflow = create_workflow()


async def process_url(url: str) -> dict:
    """
    Main entry point for processing a URL through the workflow.
    
    Args:
        url: The URL to process (YouTube or blog)
        
    Returns:
        Dictionary containing presentation slides and metadata
    """
    initial_state: WorkflowState = {
        "url": url,
        "url_type": "unknown",
        "raw_content": "",
        "title": "",
        "refined_content": "",
        "presentation_slides": [],
        "error": None
    }
    
    # Run the workflow
    result = await presentation_workflow.ainvoke(initial_state)
    
    return {
        "success": result["error"] is None,
        "url": result["url"],
        "url_type": result["url_type"],
        "title": result["title"],
        "slides": result["presentation_slides"],
        "error": result["error"]
    }
