import React, { useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { motion, AnimatePresence } from "framer-motion";
import addOnUISdk, { RuntimeType } from "https://new.express.adobe.com/static/add-on-sdk/sdk.js";
import "./components/App.css";

// Backend API URL - Update this when deploying
const API_BASE_URL = "http://localhost:8000";

interface Slide {
    type: string;
    title: string;
    content?: string;
    subtitle?: string;
    slide_number?: number;
}

interface PresentationResponse {
    success: boolean;
    url: string;
    url_type: string;
    title: string;
    slides: Slide[];
    error?: string;
}

interface NarratedSlide {
    slide_index: number;
    title: string;
    narration_text: string;
    audio_url: string;
    duration_seconds: number;
}

interface NarrationResponse {
    success: boolean;
    slides: NarratedSlide[];
    total_duration_seconds: number;
    transition_ms: number;
    error?: string;
}

const NARRATION_LENGTHS = {
    short: { label: "Short (30-45s)", targetWords: 60 },
    medium: { label: "Medium (45-60s)", targetWords: 90 },
    long: { label: "Long (60-90s)", targetWords: 130 },
};

const DEFAULT_ELEVENLABS_MODEL_ID = "eleven_multilingual_v2"

// Template definitions - Tuned for Geometric/Glassmorphism effects
const TEMPLATES = {
    modern: {
        name: "Neo Modern",
        description: "Dark mode with neon accents",
        preview: "M",
        gradient: "linear-gradient(135deg, #1f2937 0%, #111827 100%)",
        colors: {
            titleBg: { red: 0.07, green: 0.09, blue: 0.15, alpha: 1 }, // Deep Navy/Black
            contentBg: { red: 1, green: 1, blue: 1, alpha: 1 },         // White
            closingBg: { red: 0.07, green: 0.09, blue: 0.15, alpha: 1 },
            accent: { red: 0.39, green: 0.35, blue: 0.95, alpha: 1 },   // Vivid Violet (Great for glass effect)
            titleText: { red: 1, green: 1, blue: 1, alpha: 1 },
            bodyText: { red: 0.2, green: 0.23, blue: 0.28, alpha: 1 },
            subtitleText: { red: 0.6, green: 0.65, blue: 0.75, alpha: 1 },
        }
    },
    glass: {
        name: "Glassmorphism",
        description: "Frosted glass & gradients",
        preview: "G",
        gradient: "linear-gradient(135deg, #8EC5FC 0%, #E0C3FC 100%)",
        colors: {
            titleBg: { red: 0.95, green: 0.96, blue: 0.99, alpha: 1 },
            contentBg: { red: 0.98, green: 0.99, blue: 1.0, alpha: 1 },
            closingBg: { red: 0.15, green: 0.10, blue: 0.30, alpha: 1 },
            accent: { red: 0.4, green: 0.2, blue: 0.9, alpha: 1 },      // Deep Purple
            titleText: { red: 0.2, green: 0.2, blue: 0.3, alpha: 1 },
            bodyText: { red: 0.2, green: 0.2, blue: 0.3, alpha: 1 },
            subtitleText: { red: 0.4, green: 0.4, blue: 0.5, alpha: 1 },
        }
    },
    elegant: {
        name: "Elegant",
        description: "Soft serif & gold",
        preview: "E",
        gradient: "linear-gradient(135deg, #fdfbf7 0%, #f5f0e6 100%)",
        colors: {
            titleBg: { red: 0.98, green: 0.97, blue: 0.95, alpha: 1 },  // Cream
            contentBg: { red: 1, green: 1, blue: 1, alpha: 1 },
            closingBg: { red: 0.1, green: 0.1, blue: 0.1, alpha: 1 },   // Stark contrast for end
            accent: { red: 0.85, green: 0.65, blue: 0.40, alpha: 1 },   // Gold/Bronze
            titleText: { red: 0.1, green: 0.1, blue: 0.1, alpha: 1 },
            bodyText: { red: 0.25, green: 0.25, blue: 0.25, alpha: 1 },
            subtitleText: { red: 0.5, green: 0.5, blue: 0.5, alpha: 1 },
        }
    },
    tech: {
        name: "Tech Blue",
        description: "Professional & Trustworthy",
        preview: "T",
        gradient: "linear-gradient(135deg, #2563eb 0%, #1e40af 100%)",
        colors: {
            titleBg: { red: 0.15, green: 0.40, blue: 0.90, alpha: 1 },  // Bright Royal Blue
            contentBg: { red: 0.96, green: 0.98, blue: 1.0, alpha: 1 }, // Very faint blue white
            closingBg: { red: 0.10, green: 0.15, blue: 0.30, alpha: 1 },
            accent: { red: 0.0, green: 0.8, blue: 0.8, alpha: 1 },      // Cyan (Pops on blue)
            titleText: { red: 1, green: 1, blue: 1, alpha: 1 },
            bodyText: { red: 0.15, green: 0.20, blue: 0.35, alpha: 1 },
            subtitleText: { red: 0.8, green: 0.9, blue: 1.0, alpha: 1 },
        }
    },
    forest: {
        name: "Forest",
        description: "Calm Greenery",
        preview: "F",
        gradient: "linear-gradient(135deg, #064e3b 0%, #065f46 100%)",
        colors: {
            titleBg: { red: 0.02, green: 0.30, blue: 0.22, alpha: 1 },  // Deep Emerald
            contentBg: { red: 0.98, green: 0.99, blue: 0.98, alpha: 1 },
            closingBg: { red: 0.02, green: 0.30, blue: 0.22, alpha: 1 },
            accent: { red: 0.6, green: 0.8, blue: 0.4, alpha: 1 },      // Lime/Leaf Green
            titleText: { red: 1, green: 1, blue: 1, alpha: 1 },
            bodyText: { red: 0.1, green: 0.2, blue: 0.15, alpha: 1 },
            subtitleText: { red: 0.7, green: 0.85, blue: 0.75, alpha: 1 },
        }
    },
};
// Slide size options
const SLIDE_SIZES = {
    widescreen: { name: "Widescreen 16:9", width: 1920, height: 1080 },
    standard: { name: "Standard 4:3", width: 1440, height: 1080 },
    square: { name: "Square 1:1", width: 1080, height: 1080 },
    portrait: { name: "Portrait 9:16", width: 1080, height: 1920 },
};

// Font size options
const FONT_SIZES = {
    small: { name: "S", title: 72, subtitle: 32, heading: 48, body: 24 },
    medium: { name: "M", title: 96, subtitle: 40, heading: 56, body: 28 },
    large: { name: "L", title: 120, subtitle: 48, heading: 64, body: 32 },
};

// Animation variants
const fadeInUp = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -10 }
};

const scaleIn = {
    initial: { opacity: 0, scale: 0.95 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.95 }
};

const staggerChildren = {
    animate: {
        transition: {
            staggerChildren: 0.05
        }
    }
};

addOnUISdk.ready.then(async () => {
    const { runtime } = addOnUISdk.instance;
    const sandboxProxy: any = await runtime.apiProxy(RuntimeType.documentSandbox);
    
    function App() {
        const [url, setUrl] = useState("");
        const [isProcessing, setIsProcessing] = useState(false);
        const [status, setStatus] = useState("");
        const [error, setError] = useState("");
        const [presentationData, setPresentationData] = useState<PresentationResponse | null>(null);
        const [presentationStartIndex, setPresentationStartIndex] = useState<number | null>(null);
        
        // Customization options
        const [selectedTemplate, setSelectedTemplate] = useState<keyof typeof TEMPLATES>("modern");
        const [selectedSize, setSelectedSize] = useState<keyof typeof SLIDE_SIZES>("widescreen");
        const [selectedFontSize, setSelectedFontSize] = useState<keyof typeof FONT_SIZES>("medium");
        const [selectedFont, setSelectedFont] = useState<"modern" | "classic" | "handwritten">("modern");
        const [layoutStyle, setLayoutStyle] = useState<"mixed" | "card" | "split" | "classic">("mixed");
        const [showSettings, setShowSettings] = useState(false);
        const [desiredSlideCount, setDesiredSlideCount] = useState(8);
        
        // Narration + playback options
        const [narrationData, setNarrationData] = useState<NarrationResponse | null>(null);
        const [isNarrationGenerating, setIsNarrationGenerating] = useState(false);
        const [narrationError, setNarrationError] = useState("");
        const [elevenLabsModelId, setElevenLabsModelId] = useState(DEFAULT_ELEVENLABS_MODEL_ID);
        const [narrationLength, setNarrationLength] = useState<keyof typeof NARRATION_LENGTHS>("medium");
        const [transitionMs, setTransitionMs] = useState(400);
        const [isPlayingNarration, setIsPlayingNarration] = useState(false);
        const [currentNarrationIndex, setCurrentNarrationIndex] = useState<number | null>(null);
        const stopPlaybackRef = useRef(false);
        
        // Active section
        const [activeSection, setActiveSection] = useState<'main' | 'narration'>('main');
        
        // Process URL through the backend workflow
        const handleProcessUrl = async () => {
            if (!url.trim()) {
                setError("Please enter a URL");
                return;
            }
            
            setIsProcessing(true);
            setError("");
            setStatus("Analyzing URL...");
            setPresentationData(null);
            
            try {
                setStatus("Processing content with AI...");
                const normalizedSlideCount = Number.isFinite(desiredSlideCount)
                    ? Math.min(30, Math.max(2, desiredSlideCount))
                    : 8;

                const response = await fetch(`${API_BASE_URL}/api/generate-presentation`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        url: url.trim(),
                        slide_count: normalizedSlideCount,
                    }),
                });
                
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.detail || "Failed to process URL");
                }
                
                const data: PresentationResponse = await response.json();
                
                if (!data.success) {
                    throw new Error(data.error || "Failed to generate presentation");
                }
                
                setPresentationData(data);
                setStatus(`Ready! ${data.slides.length} slides generated`);
                
            } catch (err: any) {
                console.error("Error processing URL:", err);
                setError(err.message || "Failed to process URL. Make sure the backend server is running.");
                setStatus("");
            } finally {
                setIsProcessing(false);
            }
        };
        
        // Generate the presentation in Adobe Express
        const handleGeneratePresentation = async () => {
            if (!presentationData || !presentationData.slides.length) {
                setError("No presentation data available");
                return;
            }
            
            setIsProcessing(true);
            setStatus("Creating slides...");
            
            try {
                const template = TEMPLATES[selectedTemplate];
                const size = SLIDE_SIZES[selectedSize];
                const fontSize = FONT_SIZES[selectedFontSize];
                
                const result = await sandboxProxy.generatePresentation({
                    slides: presentationData.slides,
                    settings: {
                        template: selectedTemplate,
                        colors: template.colors,
                        slideWidth: size.width,
                        slideHeight: size.height,
                        fontSizes: fontSize,
                        layoutStyle: layoutStyle,
                        fontStyle: selectedFont,
                    }
                });

                if (result && typeof result.startPageIndex === "number") {
                    setPresentationStartIndex(result.startPageIndex);
                } else {
                    setPresentationStartIndex(0);
                }
                
                setStatus("Presentation created successfully!");
                setError("");
            } catch (err: any) {
                console.error("Error generating presentation:", err);
                setError(err.message || "Failed to create presentation");
                setStatus("");
            } finally {
                setIsProcessing(false);
            }
        };

        const handleGenerateNarration = async () => {
            if (!presentationData || !presentationData.slides.length) {
                setNarrationError("Create the presentation first.");
                return;
            }

            setIsNarrationGenerating(true);
            setNarrationError("");
            setStatus("Generating narration...");
            setNarrationData(null);

            try {
                const response = await fetch(`${API_BASE_URL}/api/generate-narration`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        slides: presentationData.slides,
                        options: {
                            model_id: elevenLabsModelId,
                            target_words: NARRATION_LENGTHS[narrationLength].targetWords,
                            transition_ms: transitionMs,
                            audio_format: "mp3",
                            model: "gemini-2.5-flash",
                        },
                    }),
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.detail || "Failed to generate narration");
                }

                const data: NarrationResponse = await response.json();
                if (!data.success) {
                    throw new Error(data.error || "Narration generation failed");
                }

                setNarrationData(data);
                setStatus(`Audio ready! ${Math.round(data.total_duration_seconds)}s total`);
            } catch (err: any) {
                console.error("Narration error:", err);
                setNarrationError(err.message || "Failed to generate narration");
                setStatus("");
            } finally {
                setIsNarrationGenerating(false);
            }
        };

        const handlePlayNarratedSlideshow = async () => {
            if (!narrationData || !narrationData.slides.length) {
                setNarrationError("Generate narration first.");
                return;
            }

            stopPlaybackRef.current = false;
            setIsPlayingNarration(true);
            setNarrationError("");

            try {
                const pageCount = await sandboxProxy.getPageCount();
                const baseIndex = presentationStartIndex ?? 0;
                for (let i = 0; i < narrationData.slides.length; i++) {
                    if (stopPlaybackRef.current) break;

                    const slide = narrationData.slides[i];
                    const targetIndex = baseIndex + slide.slide_index;
                    if (targetIndex < pageCount) {
                        await sandboxProxy.goToPage(targetIndex);
                    }

                    setCurrentNarrationIndex(i);

                    const audioUrl = `${API_BASE_URL}${slide.audio_url}`;
                    await new Promise<void>((resolve, reject) => {
                        const audio = new Audio(audioUrl);
                        audio.onended = () => resolve();
                        audio.onerror = () => reject(new Error("Audio playback failed"));
                        audio.play().catch(reject);
                    });

                    if (transitionMs > 0) {
                        await new Promise((r) => setTimeout(r, transitionMs));
                    }
                }
            } catch (err: any) {
                console.error("Playback error:", err);
                setNarrationError(err.message || "Playback failed");
            } finally {
                setIsPlayingNarration(false);
                setCurrentNarrationIndex(null);
                stopPlaybackRef.current = false;
            }
        };

        const handleStopPlayback = () => {
            stopPlaybackRef.current = true;
            setIsPlayingNarration(false);
        };
        
        const handleClear = () => {
            setUrl("");
            setPresentationData(null);
            setPresentationStartIndex(null);
            setDesiredSlideCount(8);
            setStatus("");
            setError("");
            setNarrationData(null);
            setNarrationError("");
            setCurrentNarrationIndex(null);
        };
        
        const template = TEMPLATES[selectedTemplate];
        
        return (
            <div style={styles.container}>
                {/* Header */}
                <motion.div 
                    style={styles.header}
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                >
                    <div style={styles.logoContainer}>
                        <motion.div 
                            style={styles.logo}
                            whileHover={{ scale: 1.05, rotate: 5 }}
                            transition={{ type: "spring", stiffness: 400 }}
                        >
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                                <rect x="3" y="3" width="18" height="18" rx="3" fill="url(#grad1)"/>
                                <path d="M7 12L10 15L17 8" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                <defs>
                                    <linearGradient id="grad1" x1="3" y1="3" x2="21" y2="21" gradientUnits="userSpaceOnUse">
                                        <stop stopColor="#6366f1"/>
                                        <stop offset="1" stopColor="#8b5cf6"/>
                                    </linearGradient>
                                </defs>
                            </svg>
                        </motion.div>
                        <div>
                            <h1 style={styles.title}>URL to Slides</h1>
                            <p style={styles.subtitle}>Transform any content into presentations</p>
                        </div>
                    </div>
                </motion.div>
                
                {/* URL Input Section */}
                <motion.div 
                    style={styles.inputCard}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: 0.1 }}
                >
                    <div style={styles.inputWrapper}>
                        <motion.div 
                            style={styles.inputIcon}
                            animate={{ rotate: isProcessing ? 360 : 0 }}
                            transition={{ duration: 1, repeat: isProcessing ? Infinity : 0, ease: "linear" }}
                        >
                            {isProcessing ? (
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                                    <circle cx="12" cy="12" r="10" stroke="#6366f1" strokeWidth="2" strokeDasharray="31.4 31.4" strokeLinecap="round"/>
                                </svg>
                            ) : (
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                                    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round"/>
                                    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round"/>
                                </svg>
                            )}
                        </motion.div>
                        <input
                            type="url"
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                            placeholder="Paste YouTube or article URL..."
                            style={styles.input}
                            disabled={isProcessing}
                            onKeyDown={(e) => e.key === 'Enter' && !isProcessing && handleProcessUrl()}
                        />
                        {url && (
                            <motion.button
                                onClick={handleClear}
                                style={styles.clearButton}
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.9 }}
                                initial={{ opacity: 0, scale: 0.5 }}
                                animate={{ opacity: 1, scale: 1 }}
                            >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                                    <path d="M18 6L6 18M6 6l12 12" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round"/>
                                </svg>
                            </motion.button>
                        )}
                    </div>
                    
                    <motion.button
                        onClick={handleProcessUrl}
                        disabled={isProcessing || !url.trim()}
                        style={{
                            ...styles.analyzeButton,
                            opacity: isProcessing || !url.trim() ? 0.6 : 1,
                        }}
                        whileHover={!isProcessing && url.trim() ? { scale: 1.02, y: -2 } : {}}
                        whileTap={!isProcessing && url.trim() ? { scale: 0.98 } : {}}
                    >
                        {isProcessing && !presentationData ? (
                            <span style={styles.buttonContent}>
                                <motion.span
                                    animate={{ rotate: 360 }}
                                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                                    style={{ display: 'inline-block' }}
                                >
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                                        <circle cx="12" cy="12" r="10" stroke="white" strokeWidth="2" strokeDasharray="31.4 31.4" strokeLinecap="round"/>
                                    </svg>
                                </motion.span>
                                Analyzing...
                            </span>
                        ) : (
                            <span style={styles.buttonContent}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                                    <circle cx="11" cy="11" r="8" stroke="white" strokeWidth="2"/>
                                    <path d="M21 21l-4.35-4.35" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                                </svg>
                                Analyze Content
                            </span>
                        )}
                    </motion.button>
                </motion.div>
                
                {/* Settings Toggle */}
                <div style={styles.settingGroup}>
    <label style={styles.settingLabel}>Layout Style</label>
    <div style={{ display: 'flex', gap: '8px' }}>
        {['mixed', 'card', 'split', 'classic'].map((style) => (
            <motion.button
                key={style}
                onClick={() => setLayoutStyle(style as any)}
                style={{
                    flex: 1,
                    padding: '8px',
                    fontSize: '11px',
                    fontWeight: 600,
                    borderRadius: '8px',
                    border: 'none',
                    cursor: 'pointer',
                    textTransform: 'capitalize',
                    backgroundColor: layoutStyle === style ? '#6366f1' : '#f1f5f9',
                    color: layoutStyle === style ? 'white' : '#64748b',
                }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
            >
                {style}
            </motion.button>
        ))}
    </div>
</div>
                
                {/* Settings Panel */}
                <AnimatePresence>
                    {showSettings && (
                        <motion.div 
                            style={styles.settingsPanel}
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.3 }}
                        >
                            <div style={styles.settingGroup}>
                                <label style={styles.settingLabel}>Template</label>
                                <div style={styles.templateGrid}>
                                    {Object.entries(TEMPLATES).map(([key, tmpl]) => (
                                        <motion.div
                                            key={key}
                                            onClick={() => setSelectedTemplate(key as keyof typeof TEMPLATES)}
                                            style={{
                                                ...styles.templateCard,
                                                borderColor: selectedTemplate === key ? '#6366f1' : 'transparent',
                                                backgroundColor: selectedTemplate === key ? '#f0f0ff' : '#f8fafc',
                                            }}
                                            whileHover={{ scale: 1.05, y: -2 }}
                                            whileTap={{ scale: 0.95 }}
                                        >
                                            <div style={{
                                                ...styles.templateIcon,
                                                background: tmpl.gradient,
                                            }}>
                                                {tmpl.preview}
                                            </div>
                                            <span style={styles.templateName}>{tmpl.name}</span>
                                        </motion.div>
                                    ))}
                                </div>
                            </div>
                            
                            <div style={styles.settingsRow}>
                                <div style={styles.settingGroupHalf}>
                                    <label style={styles.settingLabel}>Aspect Ratio</label>
                                    <select
                                        value={selectedSize}
                                        onChange={(e) => setSelectedSize(e.target.value as keyof typeof SLIDE_SIZES)}
                                        style={styles.select}
                                    >
                                        {Object.entries(SLIDE_SIZES).map(([key, size]) => (
                                            <option key={key} value={key}>{size.name}</option>
                                        ))}
                                    </select>
                                </div>
                                
                                <div style={styles.settingGroupHalf}>
                                    <label style={styles.settingLabel}>Slides</label>
                                    <input
                                        type="number"
                                        min={2}
                                        max={30}
                                        value={desiredSlideCount}
                                        onChange={(e) => setDesiredSlideCount(Number(e.target.value))}
                                        style={styles.numberInput}
                                    />
                                </div>
                            </div>
                            
                            <div style={styles.settingGroup}>
                                <label style={styles.settingLabel}>Text Size</label>
                                <div style={styles.fontSizeOptions}>
                                    {Object.entries(FONT_SIZES).map(([key, fs]) => (
                                        <motion.button
                                            key={key}
                                            onClick={() => setSelectedFontSize(key as keyof typeof FONT_SIZES)}
                                            style={{
                                                ...styles.fontSizeButton,
                                                backgroundColor: selectedFontSize === key ? '#6366f1' : '#f1f5f9',
                                                color: selectedFontSize === key ? 'white' : '#64748b',
                                            }}
                                            whileHover={{ scale: 1.05 }}
                                            whileTap={{ scale: 0.95 }}
                                        >
                                            {fs.name}
                                        </motion.button>
                                    ))}
                                </div>
                            </div>
                            
                            {/* Template Preview */}
                            <motion.div 
                                style={styles.templatePreview}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                key={selectedTemplate}
                            >
                                <div style={{
                                    ...styles.previewBox,
                                    background: `rgb(${template.colors.titleBg.red * 255}, ${template.colors.titleBg.green * 255}, ${template.colors.titleBg.blue * 255})`,
                                }}>
                                    <span style={{
                                        color: `rgb(${template.colors.titleText.red * 255}, ${template.colors.titleText.green * 255}, ${template.colors.titleText.blue * 255})`,
                                        fontSize: '8px',
                                        fontWeight: 600,
                                    }}>Title</span>
                                </div>
                                <div style={{
                                    ...styles.previewBox,
                                    background: `rgb(${template.colors.contentBg.red * 255}, ${template.colors.contentBg.green * 255}, ${template.colors.contentBg.blue * 255})`,
                                    border: '1px solid #e2e8f0',
                                }}>
                                    <span style={{
                                        color: `rgb(${template.colors.bodyText.red * 255}, ${template.colors.bodyText.green * 255}, ${template.colors.bodyText.blue * 255})`,
                                        fontSize: '8px',
                                        fontWeight: 600,
                                    }}>Content</span>
                                </div>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>
                
                {/* Status Display */}
                <AnimatePresence>
                    {status && (
                        <motion.div 
                            style={styles.statusBox}
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                        >
                            <motion.div 
                                style={styles.statusDot}
                                animate={{ scale: [1, 1.2, 1] }}
                                transition={{ duration: 1.5, repeat: Infinity }}
                            />
                            {status}
                        </motion.div>
                    )}
                </AnimatePresence>
                
                {/* Error Display */}
                <AnimatePresence>
                    {error && (
                        <motion.div 
                            style={styles.errorBox}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 20 }}
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                                <circle cx="12" cy="12" r="10" stroke="#ef4444" strokeWidth="2"/>
                                <path d="M12 8v4M12 16h.01" stroke="#ef4444" strokeWidth="2" strokeLinecap="round"/>
                            </svg>
                            {error}
                        </motion.div>
                    )}
                </AnimatePresence>
                
                {/* Preview Section */}
                <AnimatePresence>
                    {presentationData && presentationData.slides.length > 0 && (
                        <motion.div 
                            style={styles.previewSection}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                        >
                            {/* Tab Navigation */}
                            <div style={styles.tabNav}>
                                <motion.button
                                    onClick={() => setActiveSection('main')}
                                    style={{
                                        ...styles.tabButton,
                                        backgroundColor: activeSection === 'main' ? '#6366f1' : 'transparent',
                                        color: activeSection === 'main' ? 'white' : '#64748b',
                                    }}
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                                        <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="2"/>
                                        <path d="M3 9h18" stroke="currentColor" strokeWidth="2"/>
                                    </svg>
                                    Slides
                                </motion.button>
                                <motion.button
                                    onClick={() => setActiveSection('narration')}
                                    style={{
                                        ...styles.tabButton,
                                        backgroundColor: activeSection === 'narration' ? '#6366f1' : 'transparent',
                                        color: activeSection === 'narration' ? 'white' : '#64748b',
                                    }}
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                                        <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" stroke="currentColor" strokeWidth="2"/>
                                        <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v3M8 22h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                                    </svg>
                                    Narration
                                </motion.button>
                            </div>
                            
                            <AnimatePresence mode="wait">
                                {activeSection === 'main' && (
                                    <motion.div
                                        key="main"
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: 20 }}
                                        transition={{ duration: 0.2 }}
                                    >
                                        <div style={styles.sectionHeader}>
                                            <span style={styles.sectionTitle}>
                                                {presentationData.slides.length} Slides Ready
                                            </span>
                                            <span style={styles.badge}>{template.name}</span>
                                        </div>
                                        
                                        <motion.div 
                                            style={styles.slidePreviewContainer}
                                            variants={staggerChildren}
                                            initial="initial"
                                            animate="animate"
                                        >
                                            {presentationData.slides.map((slide, index) => (
                                                <motion.div 
                                                    key={index} 
                                                    style={styles.slidePreview}
                                                    variants={fadeInUp}
                                                    whileHover={{ 
                                                        scale: 1.02, 
                                                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                                                    }}
                                                >
                                                    <div style={{
                                                        ...styles.slideNumber,
                                                        background: template.gradient,
                                                    }}>
                                                        {index + 1}
                                                    </div>
                                                    <div style={styles.slideContent}>
                                                        <div style={styles.slideType}>
                                                            {slide.type === 'title' ? 'TITLE' : slide.type === 'closing' ? 'END' : 'CONTENT'}
                                                        </div>
                                                        <div style={styles.slideTitle}>
                                                            {slide.title}
                                                        </div>
                                                    </div>
                                                </motion.div>
                                            ))}
                                        </motion.div>
                                        
                                        {/* Design Customization in Preview */}
                                        <div style={styles.previewControls}>
                                            <div style={styles.previewControlRow}>
                                                <div style={styles.previewControlGroup}>
                                                    <label style={styles.settingLabel}>Theme</label>
                                                    <select
                                                        value={selectedTemplate}
                                                        onChange={(e) => setSelectedTemplate(e.target.value as keyof typeof TEMPLATES)}
                                                        style={styles.select}
                                                    >
                                                        {Object.entries(TEMPLATES).map(([key, tmpl]) => (
                                                            <option key={key} value={key}>{tmpl.name}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                                <div style={styles.previewControlGroup}>
                                                    <label style={styles.settingLabel}>Font</label>
                                                    <select
                                                        value={selectedFont}
                                                        onChange={(e) => setSelectedFont(e.target.value as any)}
                                                        style={styles.select}
                                                    >
                                                        <option value="modern">Modern Sans</option>
                                                        <option value="classic">Classic Serif</option>
                                                        <option value="handwritten">Handwritten</option>
                                                    </select>
                                                </div>
                                            </div>
                                            <div style={styles.previewControlGroup}>
                                                <label style={styles.settingLabel}>Layout Style</label>
                                                <div style={styles.segmentedControl}>
                                                    {['mixed', 'card', 'split', 'classic'].map((style) => (
                                                        <button
                                                            key={style}
                                                            onClick={() => setLayoutStyle(style as any)}
                                                            style={{
                                                                ...styles.segmentButton,
                                                                backgroundColor: layoutStyle === style ? '#6366f1' : 'transparent',
                                                                color: layoutStyle === style ? 'white' : '#64748b',
                                                            }}
                                                        >
                                                            {style.charAt(0).toUpperCase() + style.slice(1)}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>

                                        <motion.button
                                            onClick={handleGeneratePresentation}
                                            disabled={isProcessing}
                                            style={{
                                                ...styles.generateButton,
                                                opacity: isProcessing ? 0.6 : 1,
                                            }}
                                            whileHover={!isProcessing ? { scale: 1.02, y: -2 } : {}}
                                            whileTap={!isProcessing ? { scale: 0.98 } : {}}
                                        >
                                            {isProcessing ? (
                                                <span style={styles.buttonContent}>
                                                    <motion.span
                                                        animate={{ rotate: 360 }}
                                                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                                                        style={{ display: 'inline-block' }}
                                                    >
                                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                                                            <circle cx="12" cy="12" r="10" stroke="white" strokeWidth="2" strokeDasharray="31.4 31.4" strokeLinecap="round"/>
                                                        </svg>
                                                    </motion.span>
                                                    Creating...
                                                </span>
                                            ) : (
                                                <span style={styles.buttonContent}>
                                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                                                        <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                                    </svg>
                                                    Create Presentation
                                                </span>
                                            )}
                                        </motion.button>
                                    </motion.div>
                                )}
                                
                                {activeSection === 'narration' && (
                                    <motion.div
                                        key="narration"
                                        initial={{ opacity: 0, x: 20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: -20 }}
                                        transition={{ duration: 0.2 }}
                                    >
                                        <div style={styles.narrationControls}>
                                            <div style={styles.settingsRow}>
                                                <div style={styles.settingGroupHalf}>
                                                    <label style={styles.settingLabel}>Length</label>
                                                    <select
                                                        value={narrationLength}
                                                        onChange={(e) => setNarrationLength(e.target.value as keyof typeof NARRATION_LENGTHS)}
                                                        style={styles.select}
                                                    >
                                                        {Object.entries(NARRATION_LENGTHS).map(([key, opt]) => (
                                                            <option key={key} value={key}>{opt.label}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                                
                                                <div style={styles.settingGroupHalf}>
                                                    <label style={styles.settingLabel}>Transition</label>
                                                    <select
                                                        value={transitionMs}
                                                        onChange={(e) => setTransitionMs(Number(e.target.value))}
                                                        style={styles.select}
                                                    >
                                                        <option value={0}>None</option>
                                                        <option value={200}>200ms</option>
                                                        <option value={400}>400ms</option>
                                                        <option value={600}>600ms</option>
                                                        <option value={1000}>1s</option>
                                                    </select>
                                                </div>
                                            </div>
                                            
                                            <div style={styles.settingGroup}>
                                                <label style={styles.settingLabel}>Model ID</label>
                                                <input
                                                    value={elevenLabsModelId}
                                                    onChange={(e) => setElevenLabsModelId(e.target.value)}
                                                    style={styles.textInput}
                                                    placeholder="eleven_multilingual_v2"
                                                />
                                            </div>
                                        </div>
                                        
                                        <motion.button
                                            onClick={handleGenerateNarration}
                                            disabled={isNarrationGenerating}
                                            style={{
                                                ...styles.narrationButton,
                                                opacity: isNarrationGenerating ? 0.6 : 1,
                                            }}
                                            whileHover={!isNarrationGenerating ? { scale: 1.02, y: -2 } : {}}
                                            whileTap={!isNarrationGenerating ? { scale: 0.98 } : {}}
                                        >
                                            {isNarrationGenerating ? (
                                                <span style={styles.buttonContent}>
                                                    <motion.span
                                                        animate={{ rotate: 360 }}
                                                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                                                        style={{ display: 'inline-block' }}
                                                    >
                                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                                                            <circle cx="12" cy="12" r="10" stroke="white" strokeWidth="2" strokeDasharray="31.4 31.4" strokeLinecap="round"/>
                                                        </svg>
                                                    </motion.span>
                                                    Generating Audio...
                                                </span>
                                            ) : (
                                                <span style={styles.buttonContent}>
                                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                                                        <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" stroke="white" strokeWidth="2"/>
                                                        <path d="M19 10v2a7 7 0 0 1-14 0v-2" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                                                    </svg>
                                                    Generate Narration
                                                </span>
                                            )}
                                        </motion.button>
                                        
                                        <AnimatePresence>
                                            {narrationError && (
                                                <motion.div 
                                                    style={styles.errorBox}
                                                    initial={{ opacity: 0 }}
                                                    animate={{ opacity: 1 }}
                                                    exit={{ opacity: 0 }}
                                                >
                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                                                        <circle cx="12" cy="12" r="10" stroke="#ef4444" strokeWidth="2"/>
                                                        <path d="M12 8v4M12 16h.01" stroke="#ef4444" strokeWidth="2" strokeLinecap="round"/>
                                                    </svg>
                                                    {narrationError}
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                        
                                        <AnimatePresence>
                                            {narrationData && narrationData.slides.length > 0 && (
                                                <motion.div
                                                    initial={{ opacity: 0, y: 10 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    exit={{ opacity: 0 }}
                                                >
                                                    <div style={styles.narrationList}>
                                                        {narrationData.slides.map((slide, idx) => (
                                                            <motion.div 
                                                                key={idx} 
                                                                style={{
                                                                    ...styles.narrationItem,
                                                                    backgroundColor: currentNarrationIndex === idx ? '#f0f0ff' : 'transparent',
                                                                }}
                                                                whileHover={{ backgroundColor: '#f8fafc' }}
                                                            >
                                                                <motion.div 
                                                                    style={{
                                                                        ...styles.narrationIndex,
                                                                        background: currentNarrationIndex === idx ? '#6366f1' : '#e2e8f0',
                                                                        color: currentNarrationIndex === idx ? 'white' : '#64748b',
                                                                    }}
                                                                    animate={currentNarrationIndex === idx ? { scale: [1, 1.1, 1] } : {}}
                                                                    transition={{ duration: 0.5, repeat: Infinity }}
                                                                >
                                                                    {idx + 1}
                                                                </motion.div>
                                                                <div style={styles.narrationInfo}>
                                                                    <div style={styles.narrationTitle}>{slide.title || `Slide ${idx + 1}`}</div>
                                                                    <div style={styles.narrationMeta}>
                                                                        {Math.round(slide.duration_seconds)}s
                                                                        {currentNarrationIndex === idx && isPlayingNarration && (
                                                                            <motion.span 
                                                                                style={styles.playingBadge}
                                                                                initial={{ opacity: 0 }}
                                                                                animate={{ opacity: 1 }}
                                                                            >
                                                                                Playing
                                                                            </motion.span>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </motion.div>
                                                        ))}
                                                    </div>
                                                    
                                                    <div style={styles.playbackControls}>
                                                        {!isPlayingNarration ? (
                                                            <motion.button
                                                                onClick={handlePlayNarratedSlideshow}
                                                                style={styles.playButton}
                                                                whileHover={{ scale: 1.02 }}
                                                                whileTap={{ scale: 0.98 }}
                                                            >
                                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                                                                    <polygon points="5,3 19,12 5,21" fill="white"/>
                                                                </svg>
                                                                Play Slideshow
                                                            </motion.button>
                                                        ) : (
                                                            <motion.button
                                                                onClick={handleStopPlayback}
                                                                style={styles.stopButton}
                                                                whileHover={{ scale: 1.02 }}
                                                                whileTap={{ scale: 0.98 }}
                                                            >
                                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                                                                    <rect x="6" y="6" width="12" height="12" fill="white"/>
                                                                </svg>
                                                                Stop
                                                            </motion.button>
                                                        )}
                                                    </div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </motion.div>
                    )}
                </AnimatePresence>
                
                {/* Empty State */}
                {!presentationData && !isProcessing && (
                    <motion.div 
                        style={styles.emptyState}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.3 }}
                    >
                        <div style={styles.supportedTypes}>
                            <motion.div 
                                style={styles.supportedItem}
                                whileHover={{ scale: 1.05, y: -2 }}
                            >
                                <div style={styles.supportedIcon}>
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                                        <path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.33z" stroke="#ef4444" strokeWidth="2"/>
                                        <polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02" fill="#ef4444"/>
                                    </svg>
                                </div>
                                <span>YouTube</span>
                            </motion.div>
                            <motion.div 
                                style={styles.supportedItem}
                                whileHover={{ scale: 1.05, y: -2 }}
                            >
                                <div style={styles.supportedIcon}>
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="#3b82f6" strokeWidth="2"/>
                                        <polyline points="14 2 14 8 20 8" stroke="#3b82f6" strokeWidth="2"/>
                                        <line x1="16" y1="13" x2="8" y2="13" stroke="#3b82f6" strokeWidth="2"/>
                                        <line x1="16" y1="17" x2="8" y2="17" stroke="#3b82f6" strokeWidth="2"/>
                                    </svg>
                                </div>
                                <span>Articles</span>
                            </motion.div>
                            <motion.div 
                                style={styles.supportedItem}
                                whileHover={{ scale: 1.05, y: -2 }}
                            >
                                <div style={styles.supportedIcon}>
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                                        <circle cx="12" cy="12" r="10" stroke="#10b981" strokeWidth="2"/>
                                        <line x1="2" y1="12" x2="22" y2="12" stroke="#10b981" strokeWidth="2"/>
                                        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" stroke="#10b981" strokeWidth="2"/>
                                    </svg>
                                </div>
                                <span>Blogs</span>
                            </motion.div>
                        </div>
                    </motion.div>
                )}
            </div>
        );
    }
    
    // Styles
    const styles: { [key: string]: React.CSSProperties } = {
        container: {
            padding: "16px",
            fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
            maxWidth: "100%",
            boxSizing: "border-box",
            fontSize: "13px",
            background: "linear-gradient(180deg, #fafbfc 0%, #ffffff 100%)",
            minHeight: "100vh",
        },
        header: {
            marginBottom: "20px",
        },
        logoContainer: {
            display: "flex",
            alignItems: "center",
            gap: "12px",
        },
        logo: {
            width: "40px",
            height: "40px",
            borderRadius: "12px",
            background: "linear-gradient(135deg, #f0f0ff 0%, #e8e8ff 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 2px 8px rgba(99, 102, 241, 0.15)",
        },
        title: {
            fontSize: "18px",
            fontWeight: 700,
            margin: 0,
            color: "#1e293b",
            letterSpacing: "-0.3px",
        },
        subtitle: {
            fontSize: "12px",
            color: "#94a3b8",
            margin: 0,
            marginTop: "2px",
        },
        inputCard: {
            background: "white",
            borderRadius: "16px",
            padding: "16px",
            marginBottom: "12px",
            boxShadow: "0 1px 3px rgba(0,0,0,0.05), 0 4px 12px rgba(0,0,0,0.03)",
            border: "1px solid #f1f5f9",
        },
        inputWrapper: {
            display: "flex",
            alignItems: "center",
            gap: "10px",
            marginBottom: "12px",
            position: "relative",
        },
        inputIcon: {
            flexShrink: 0,
        },
        input: {
            flex: 1,
            padding: "12px 0",
            fontSize: "14px",
            border: "none",
            outline: "none",
            background: "transparent",
            color: "#1e293b",
        },
        clearButton: {
            width: "28px",
            height: "28px",
            borderRadius: "8px",
            border: "none",
            background: "#f1f5f9",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
        },
        analyzeButton: {
            width: "100%",
            padding: "14px 20px",
            fontSize: "14px",
            fontWeight: 600,
            borderRadius: "12px",
            border: "none",
            cursor: "pointer",
            background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
            color: "white",
            boxShadow: "0 2px 8px rgba(99, 102, 241, 0.25)",
        },
        buttonContent: {
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
        },
        settingsToggle: {
            marginBottom: "12px",
        },
        settingsButton: {
            width: "100%",
            padding: "10px 14px",
            fontSize: "13px",
            fontWeight: 500,
            backgroundColor: "white",
            border: "1px solid #e2e8f0",
            borderRadius: "10px",
            cursor: "pointer",
            color: "#64748b",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
        },
        settingsPanel: {
            backgroundColor: "white",
            borderRadius: "16px",
            padding: "16px",
            marginBottom: "12px",
            overflow: "hidden",
            border: "1px solid #f1f5f9",
            boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
        },
        settingGroup: {
            marginBottom: "16px",
        },
        settingGroupHalf: {
            flex: 1,
        },
        settingsRow: {
            display: "flex",
            gap: "12px",
            marginBottom: "16px",
        },
        settingLabel: {
            display: "block",
            fontSize: "11px",
            fontWeight: 600,
            color: "#64748b",
            marginBottom: "8px",
            textTransform: "uppercase",
            letterSpacing: "0.5px",
        },
        templateGrid: {
            display: "grid",
            gridTemplateColumns: "repeat(5, 1fr)",
            gap: "8px",
        },
        templateCard: {
            padding: "10px 6px",
            borderRadius: "10px",
            border: "2px solid transparent",
            cursor: "pointer",
            textAlign: "center",
            transition: "all 0.2s",
        },
        templateIcon: {
            width: "32px",
            height: "32px",
            borderRadius: "8px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 6px",
            color: "white",
            fontSize: "12px",
            fontWeight: 700,
        },
        templateName: {
            fontSize: "10px",
            fontWeight: 600,
            color: "#475569",
        },
        select: {
            width: "100%",
            padding: "10px 12px",
            fontSize: "13px",
            borderRadius: "8px",
            border: "1px solid #e2e8f0",
            backgroundColor: "#f8fafc",
            color: "#1e293b",
            outline: "none",
            cursor: "pointer",
        },
        numberInput: {
            width: "100%",
            padding: "10px 12px",
            fontSize: "13px",
            borderRadius: "8px",
            border: "1px solid #e2e8f0",
            backgroundColor: "#f8fafc",
            color: "#1e293b",
            outline: "none",
            boxSizing: "border-box",
        },
        textInput: {
            width: "100%",
            padding: "10px 12px",
            fontSize: "13px",
            borderRadius: "8px",
            border: "1px solid #e2e8f0",
            backgroundColor: "#f8fafc",
            color: "#1e293b",
            outline: "none",
            boxSizing: "border-box",
        },
        fontSizeOptions: {
            display: "flex",
            gap: "6px",
        },
        fontSizeButton: {
            flex: 1,
            padding: "10px",
            fontSize: "12px",
            fontWeight: 600,
            borderRadius: "8px",
            border: "none",
            cursor: "pointer",
        },
        templatePreview: {
            display: "flex",
            gap: "8px",
            marginTop: "8px",
        },
        previewBox: {
            flex: 1,
            height: "40px",
            borderRadius: "8px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
        },
        statusBox: {
            backgroundColor: "#f0f9ff",
            borderRadius: "10px",
            padding: "12px 14px",
            marginBottom: "12px",
            fontSize: "13px",
            color: "#0369a1",
            display: "flex",
            alignItems: "center",
            gap: "10px",
            border: "1px solid #e0f2fe",
        },
        statusDot: {
            width: "8px",
            height: "8px",
            borderRadius: "50%",
            backgroundColor: "#0ea5e9",
        },
        errorBox: {
            backgroundColor: "#fef2f2",
            borderRadius: "10px",
            padding: "12px 14px",
            marginBottom: "12px",
            fontSize: "13px",
            color: "#dc2626",
            display: "flex",
            alignItems: "center",
            gap: "10px",
            border: "1px solid #fee2e2",
        },
        previewSection: {
            backgroundColor: "white",
            borderRadius: "16px",
            padding: "16px",
            marginBottom: "12px",
            border: "1px solid #f1f5f9",
            boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
        },
        tabNav: {
            display: "flex",
            gap: "6px",
            marginBottom: "16px",
            padding: "4px",
            backgroundColor: "#f1f5f9",
            borderRadius: "10px",
        },
        tabButton: {
            flex: 1,
            padding: "10px 12px",
            fontSize: "12px",
            fontWeight: 600,
            borderRadius: "8px",
            border: "none",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "6px",
            transition: "all 0.2s",
        },
        sectionHeader: {
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "12px",
        },
        sectionTitle: {
            fontSize: "14px",
            fontWeight: 600,
            color: "#1e293b",
        },
        badge: {
            fontSize: "10px",
            fontWeight: 600,
            padding: "4px 8px",
            borderRadius: "6px",
            backgroundColor: "#f0f0ff",
            color: "#6366f1",
        },
        slidePreviewContainer: {
            maxHeight: "200px",
            overflowY: "auto",
            marginBottom: "12px",
        },
        slidePreview: {
            display: "flex",
            gap: "10px",
            padding: "10px",
            backgroundColor: "#f8fafc",
            borderRadius: "10px",
            marginBottom: "6px",
            cursor: "pointer",
            transition: "all 0.2s",
        },
        slideNumber: {
            width: "28px",
            height: "28px",
            borderRadius: "8px",
            color: "white",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "12px",
            fontWeight: 700,
            flexShrink: 0,
        },
        slideContent: {
            flex: 1,
            minWidth: 0,
        },
        slideType: {
            fontSize: "9px",
            color: "#94a3b8",
            fontWeight: 600,
            letterSpacing: "0.5px",
            marginBottom: "2px",
        },
        slideTitle: {
            fontSize: "12px",
            fontWeight: 600,
            color: "#1e293b",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
        },
        generateButton: {
            width: "100%",
            padding: "14px 20px",
            fontSize: "14px",
            fontWeight: 600,
            borderRadius: "12px",
            border: "none",
            cursor: "pointer",
            background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
            color: "white",
            boxShadow: "0 2px 8px rgba(16, 185, 129, 0.25)",
        },
        narrationControls: {
            marginBottom: "12px",
        },
        narrationButton: {
            width: "100%",
            padding: "14px 20px",
            fontSize: "14px",
            fontWeight: 600,
            borderRadius: "12px",
            border: "none",
            cursor: "pointer",
            background: "linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)",
            color: "white",
            boxShadow: "0 2px 8px rgba(139, 92, 246, 0.25)",
            marginBottom: "12px",
        },
        narrationList: {
            maxHeight: "160px",
            overflowY: "auto",
            backgroundColor: "#f8fafc",
            borderRadius: "10px",
            marginBottom: "12px",
        },
        narrationItem: {
            display: "flex",
            gap: "10px",
            alignItems: "center",
            padding: "10px 12px",
            borderBottom: "1px solid #f1f5f9",
            transition: "all 0.2s",
        },
        narrationIndex: {
            width: "24px",
            height: "24px",
            borderRadius: "6px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "11px",
            fontWeight: 700,
            flexShrink: 0,
            transition: "all 0.2s",
        },
        narrationInfo: {
            flex: 1,
            minWidth: 0,
        },
        narrationTitle: {
            fontSize: "12px",
            fontWeight: 600,
            color: "#1e293b",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
        },
        narrationMeta: {
            fontSize: "11px",
            color: "#94a3b8",
            display: "flex",
            alignItems: "center",
            gap: "6px",
        },
        playingBadge: {
            fontSize: "10px",
            fontWeight: 600,
            padding: "2px 6px",
            borderRadius: "4px",
            backgroundColor: "#6366f1",
            color: "white",
        },
        playbackControls: {
            display: "flex",
            gap: "8px",
        },
        playButton: {
            flex: 1,
            padding: "14px 20px",
            fontSize: "14px",
            fontWeight: 600,
            borderRadius: "12px",
            border: "none",
            cursor: "pointer",
            background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
            color: "white",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
            boxShadow: "0 2px 8px rgba(99, 102, 241, 0.25)",
        },
        stopButton: {
            flex: 1,
            padding: "14px 20px",
            fontSize: "14px",
            fontWeight: 600,
            borderRadius: "12px",
            border: "none",
            cursor: "pointer",
            background: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
            color: "white",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
            boxShadow: "0 2px 8px rgba(239, 68, 68, 0.25)",
        },
        emptyState: {
            textAlign: "center",
            padding: "20px 0",
        },
        supportedTypes: {
            display: "flex",
            justifyContent: "center",
            gap: "16px",
        },
        supportedItem: {
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "8px",
            padding: "16px 20px",
            backgroundColor: "white",
            borderRadius: "12px",
            border: "1px solid #f1f5f9",
            fontSize: "12px",
            fontWeight: 500,
            color: "#64748b",
            cursor: "pointer",
            transition: "all 0.2s",
            boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
        },
        supportedIcon: {
            width: "40px",
            height: "40px",
            borderRadius: "10px",
            backgroundColor: "#f8fafc",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
        },
        previewControls: {
            marginBottom: "16px",
            padding: "12px",
            backgroundColor: "#f8fafc",
            borderRadius: "12px",
            border: "1px solid #e2e8f0",
        },
        previewControlRow: {
            display: "flex",
            gap: "12px",
            marginBottom: "12px",
        },
        previewControlGroup: {
            flex: 1,
        },
        segmentedControl: {
            display: "flex",
            backgroundColor: "#f1f5f9",
            borderRadius: "8px",
            padding: "4px",
            gap: "4px",
        },
        segmentButton: {
            flex: 1,
            padding: "6px 8px",
            fontSize: "10px",
            fontWeight: 600,
            borderRadius: "6px",
            border: "none",
            cursor: "pointer",
            transition: "all 0.2s",
        },
    };
    
    const root = createRoot(document.getElementById("root")!);
    root.render(<App />);
});
