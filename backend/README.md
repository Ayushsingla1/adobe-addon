# URL to Presentation Backend

LangGraph agentic workflow backend that converts URLs (YouTube videos or blog posts) into presentation slides for Adobe Express.

## Setup

### 1. Create Virtual Environment

```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

### 2. Install Dependencies

```bash
pip install -r requirements.txt
```

### 3. Configure Environment Variables

Create a `.env` file in the backend directory:

```env
# Google API Key for Gemini 2.5 Flash
# Get your API key from: https://makersuite.google.com/app/apikey
GOOGLE_API_KEY=your_google_api_key_here

# Server Configuration (optional)
PORT=8000
```

### 4. Run the Server

```bash
python server.py
```

Or with uvicorn directly:

```bash
uvicorn server:app --reload --port 8000
```

## API Endpoints

### Health Check
- `GET /` - Basic health check
- `GET /health` - Detailed health status

### Generate Presentation
- `POST /api/generate-presentation`
  ```json
  {
    "url": "https://www.youtube.com/watch?v=..."
  }
  ```

### Detect URL Type
- `POST /api/detect-url-type`
  ```json
  {
    "url": "https://example.com/blog-post"
  }
  ```

## Workflow Architecture

The LangGraph workflow consists of the following nodes:

1. **URL Type Detection** - Determines if URL is YouTube or blog
2. **YouTube Transcript Extraction** - Uses youtube-transcript-api
3. **Blog Content Scraping** - Uses BeautifulSoup4
4. **Content Refinement** - Uses Gemini 2.5 Flash LLM
5. **Presentation Generation** - Creates structured slide data

```
┌─────────────────────┐
│   detect_url_type   │
└──────────┬──────────┘
           │
    ┌──────┴──────┐
    ▼             ▼
┌─────────┐  ┌─────────┐
│ youtube │  │  blog   │
└────┬────┘  └────┬────┘
     │            │
     └──────┬─────┘
            ▼
   ┌────────────────┐
   │ refine_content │
   └───────┬────────┘
           ▼
┌──────────────────────┐
│ generate_presentation│
└──────────────────────┘
```
