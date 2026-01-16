# Adobe Essence - AI-Powered Presentation Generator

Transform any URL (YouTube videos, blog posts, articles) into beautiful, narrated presentations with AI-powered content extraction and video export capabilities.

## 🚀 Features

### Core Functionality
- **URL to Presentation**: Convert YouTube videos or blog posts into structured presentation slides
- **AI-Powered Content Extraction**: Uses Google Gemini 2.5 Flash to intelligently extract and summarize content
- **Smart Slide Generation**: Automatically creates title, content, and closing slides with proper formatting
- **Multiple Templates**: Choose from Modern, Vibrant, Nature, Sunset, and Glassmorphism themes
- **Customizable Design**: Adjust slide sizes, fonts, layouts, and color schemes

### Advanced Features
- **AI Narration**: Generate natural-sounding narration for each slide using ElevenLabs TTS
- **Brand Identity Injection**: Upload your logo to extract brand colors and automatically apply them to slides
- **Video Export**: Export presentations as MP4 videos with synchronized audio and smooth transitions
- **Live Slide Preview**: Preview slides before generating the final presentation
- **Narrated Slideshow**: Play through slides with synchronized audio narration

## 📋 Prerequisites

### Frontend (Adobe Express Add-on)
- Node.js 18 or above ([Download](https://nodejs.org/en/download))
- npm or yarn
- Adobe Express account ([Sign up](https://new.express.adobe.com))
- Git ([Install](https://git-scm.com/downloads))

### Backend (Python API)
- Python 3.12 or above
- pip package manager
- Google API Key for Gemini ([Get API Key](https://makersuite.google.com/app/apikey))
- ElevenLabs API Key for TTS ([Get API Key](https://elevenlabs.io))

## 🏗️ Architecture

This project consists of two main components:

1. **Frontend (Adobe Express Add-on)**: React + TypeScript add-on that runs in Adobe Express
2. **Backend (FastAPI Server)**: Python backend with LangGraph workflow for content processing

```
┌─────────────────────────────────────────────────────────┐
│              Adobe Express Add-on (Frontend)             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │   React UI   │  │ Document SDK │  │  Sandbox     │  │
│  │  (index.tsx) │  │  (code.ts)   │  │  Runtime     │  │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  │
└─────────┼─────────────────┼─────────────────┼──────────┘
          │                 │                 │
          └─────────────────┴─────────────────┘
                            │
                            ▼
          ┌─────────────────────────────────────┐
          │      FastAPI Backend Server         │
          │  ┌──────────────────────────────┐  │
          │  │   LangGraph Workflow          │  │
          │  │  - URL Detection              │  │
          │  │  - Content Extraction         │  │
          │  │  - AI Refinement (Gemini)     │  │
          │  │  - Presentation Generation    │  │
          │  └──────────────────────────────┘  │
          │  ┌──────────────────────────────┐  │
          │  │   Narration Service           │  │
          │  │  - Text Generation (Gemini)  │  │
          │  │  - TTS (ElevenLabs)           │  │
          │  └──────────────────────────────┘  │
          │  ┌──────────────────────────────┐  │
          │  │   Video Generation            │  │
          │  │  - Image Processing (Pillow)  │  │
          │  │  - Video Assembly (MoviePy)   │  │
          │  └──────────────────────────────┘  │
          └─────────────────────────────────────┘
```

## 🛠️ Setup Instructions

### 1. Clone the Repository

```bash
git clone <repository-url>
cd express-addon-example
```

### 2. Frontend Setup

```bash
# Install dependencies
npm install

# Start development server
npm run start

# Build for production
npm run build

# Package for distribution
npm run package
```

The add-on will be available at `http://localhost:3000` (or the port shown in terminal).

### 3. Backend Setup

```bash
# Navigate to backend directory
cd backend

# Create virtual environment
python -m venv venv

# Activate virtual environment
# On macOS/Linux:
source venv/bin/activate
# On Windows:
venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

### 4. Configure Environment Variables

Create a `.env` file in the `backend` directory:

```env
# Google API Key for Gemini 2.5 Flash
GOOGLE_API_KEY=your_google_api_key_here

# ElevenLabs API Key for Text-to-Speech
ELEVENLABS_API_KEY=your_elevenlabs_api_key_here

# Server Configuration (optional)
PORT=8000
```

### 5. Start the Backend Server

```bash
# From the backend directory
python server.py
```

The API server will run at `http://localhost:8000` (or the port specified in `.env`).

### 6. Update Frontend API URL

In `src/ui/index.tsx`, ensure the `API_BASE_URL` points to your backend:

```typescript
const API_BASE_URL = "http://localhost:8000";
```

## 📖 Usage Guide

### Basic Workflow

1. **Open Adobe Express** and create a new document
2. **Launch the Add-on** from the Add-ons panel
3. **Enter a URL** (YouTube video or blog post)
4. **Configure Options**:
   - Select number of slides
   - Choose template theme
   - Adjust slide size and font settings
5. **Generate Presentation** - Click "Create Presentation"
6. **Add Narration** (Optional):
   - Go to "Narration" tab
   - Configure voice and length settings
   - Click "Generate Narration"
7. **Export Video** (Optional):
   - After generating narration, click "Export Video"
   - Download the MP4 file

### Brand Identity Feature

1. Go to **Settings Panel**
2. Scroll to **Brand Identity** section
3. **Upload Logo** - Click to upload your brand logo
4. The add-on will:
   - Extract dominant color from your logo
   - Apply brand color as accent color across all slides
   - Add logo watermark to every slide

### Customization Options

- **Templates**: Modern, Vibrant, Nature, Sunset, Glassmorphism
- **Slide Sizes**: Widescreen (1920x1080), Square (1080x1080), Portrait (1080x1920)
- **Font Styles**: Modern, Classic, Handwritten
- **Layout Styles**: Mixed, Card, Split, Classic
- **Narration Length**: Short (60 words), Medium (90 words), Long (120 words)

## 🔌 API Endpoints

### Health Check
- `GET /` - Basic health check
- `GET /health` - Detailed health status with API key validation

### Presentation Generation
- `POST /api/generate-presentation`
  ```json
  {
    "url": "https://www.youtube.com/watch?v=...",
    "slide_count": 8
  }
  ```

### Narration Generation
- `POST /api/generate-narration`
  ```json
  {
    "slides": [...],
    "options": {
      "voice": "",
      "audio_format": "mp3",
      "target_words": 90,
      "transition_ms": 400,
      "model": "gemini-2.5-flash",
      "model_id": "eleven_multilingual_v2"
    }
  }
  ```

### Video Export
- `POST /api/export-video`
  ```json
  {
    "slides": [...],
    "slide_images": ["base64..."],
    "audio_files": ["/audio/file1.mp3"],
    "template_settings": {...}
  }
  ```

### Video Download
- `GET /api/download-video/{filename}` - Download generated video file

## 🎨 Templates

### Modern
- Clean, professional design
- Subtle gradients and shadows
- Perfect for business presentations

### Vibrant
- Bold, energetic colors
- High contrast design
- Great for creative content

### Nature
- Earth tones and organic shapes
- Calming aesthetic
- Ideal for environmental topics

### Sunset
- Warm color palette
- Gradient backgrounds
- Perfect for inspirational content

### Glassmorphism
- Frosted glass effects
- Translucent overlays
- Modern, trendy design

## 🧩 Tech Stack

### Frontend
- **React 18.2.0** - UI framework
- **TypeScript** - Type safety
- **Framer Motion** - Animations
- **Adobe Express SDK** - Document manipulation
- **Webpack** - Build tool

### Backend
- **Python 3.12+** - Runtime
- **FastAPI** - Web framework
- **LangGraph** - Agentic workflow orchestration
- **LangChain** - LLM integration
- **Google Gemini 2.5 Flash** - Content generation
- **ElevenLabs** - Text-to-speech
- **MoviePy** - Video processing
- **Pillow** - Image processing
- **BeautifulSoup4** - Web scraping
- **YouTube Transcript API** - Video transcript extraction

## 📁 Project Structure

```
express-addon-example/
├── src/
│   ├── ui/
│   │   ├── index.tsx          # Main React component
│   │   └── components/
│   │       └── App.css        # Styles
│   ├── sandbox/
│   │   └── code.ts            # Document SDK code
│   ├── manifest.json          # Add-on manifest
│   └── index.html             # Entry HTML
├── backend/
│   ├── server.py              # FastAPI server
│   ├── workflow.py            # LangGraph workflow
│   ├── narration.py           # TTS generation
│   ├── video_gen.py           # Video generation
│   ├── requirements.txt       # Python dependencies
│   └── output/                # Generated files
│       ├── audio/             # Generated audio files
│       └── video/             # Generated video files
├── package.json               # Node dependencies
├── webpack.config.js          # Webpack configuration
└── README.md                  # This file
```

## 🐛 Troubleshooting

### Add-on Not Loading
- Ensure backend server is running
- Check `API_BASE_URL` in `src/ui/index.tsx`
- Verify CORS is enabled in backend

### API Errors
- Check `.env` file has correct API keys
- Verify API keys are valid and have sufficient credits
- Check backend server logs for detailed error messages

### Video Export Fails
- Ensure `moviepy` and `Pillow` are installed
- Check that audio files exist in `backend/output/audio/`
- Verify sufficient disk space for video generation

### Narration Not Generating
- Verify ElevenLabs API key is set
- Check API rate limits
- Ensure audio output directory is writable

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License.

## 🙏 Acknowledgments

- Adobe Express Add-on SDK
- Google Gemini API
- ElevenLabs TTS
- LangGraph framework
- MoviePy library

## 📧 Support

For issues, questions, or contributions, please open an issue on the repository.

---

**Made with ❤️ for Adobe Express**
