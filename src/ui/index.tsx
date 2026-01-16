import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import addOnUISdk, { RuntimeType } from "https://new.express.adobe.com/static/add-on-sdk/sdk.js";

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

// Template definitions
const TEMPLATES = {
    modern: {
        name: "Modern",
        description: "Clean, minimal design with bold accents",
        preview: "🎨",
        colors: {
            titleBg: { red: 0.11, green: 0.11, blue: 0.14, alpha: 1 },      // Dark charcoal
            contentBg: { red: 1, green: 1, blue: 1, alpha: 1 },              // White
            closingBg: { red: 0.11, green: 0.11, blue: 0.14, alpha: 1 },    // Dark charcoal
            accent: { red: 0.40, green: 0.85, blue: 0.72, alpha: 1 },        // Teal
            titleText: { red: 1, green: 1, blue: 1, alpha: 1 },              // White
            bodyText: { red: 0.2, green: 0.2, blue: 0.2, alpha: 1 },         // Dark gray
            subtitleText: { red: 0.7, green: 0.7, blue: 0.7, alpha: 1 },     // Light gray
        }
    },
    corporate: {
        name: "Corporate",
        description: "Professional blue theme for business",
        preview: "💼",
        colors: {
            titleBg: { red: 0.05, green: 0.20, blue: 0.40, alpha: 1 },       // Navy blue
            contentBg: { red: 0.96, green: 0.97, blue: 0.98, alpha: 1 },     // Off-white
            closingBg: { red: 0.05, green: 0.20, blue: 0.40, alpha: 1 },     // Navy blue
            accent: { red: 0.95, green: 0.60, blue: 0.07, alpha: 1 },        // Gold
            titleText: { red: 1, green: 1, blue: 1, alpha: 1 },              // White
            bodyText: { red: 0.15, green: 0.15, blue: 0.15, alpha: 1 },      // Near black
            subtitleText: { red: 0.85, green: 0.88, blue: 0.92, alpha: 1 },  // Light blue-gray
        }
    },
    creative: {
        name: "Creative",
        description: "Vibrant gradients and bold colors",
        preview: "🌈",
        colors: {
            titleBg: { red: 0.55, green: 0.23, blue: 0.75, alpha: 1 },       // Purple
            contentBg: { red: 1, green: 0.98, blue: 0.95, alpha: 1 },        // Cream
            closingBg: { red: 0.94, green: 0.35, blue: 0.47, alpha: 1 },     // Coral
            accent: { red: 1, green: 0.75, blue: 0.30, alpha: 1 },           // Orange
            titleText: { red: 1, green: 1, blue: 1, alpha: 1 },              // White
            bodyText: { red: 0.25, green: 0.20, blue: 0.30, alpha: 1 },      // Dark purple
            subtitleText: { red: 0.90, green: 0.85, blue: 0.95, alpha: 1 },  // Light purple
        }
    },
    minimal: {
        name: "Minimal",
        description: "Simple, elegant black and white",
        preview: "⬜",
        colors: {
            titleBg: { red: 1, green: 1, blue: 1, alpha: 1 },                // White
            contentBg: { red: 1, green: 1, blue: 1, alpha: 1 },              // White
            closingBg: { red: 0.08, green: 0.08, blue: 0.08, alpha: 1 },     // Black
            accent: { red: 0.08, green: 0.08, blue: 0.08, alpha: 1 },        // Black
            titleText: { red: 0.08, green: 0.08, blue: 0.08, alpha: 1 },     // Black
            bodyText: { red: 0.25, green: 0.25, blue: 0.25, alpha: 1 },      // Dark gray
            subtitleText: { red: 0.5, green: 0.5, blue: 0.5, alpha: 1 },     // Gray
        }
    },
    nature: {
        name: "Nature",
        description: "Earthy greens and warm tones",
        preview: "🌿",
        colors: {
            titleBg: { red: 0.13, green: 0.37, blue: 0.31, alpha: 1 },       // Forest green
            contentBg: { red: 0.97, green: 0.96, blue: 0.93, alpha: 1 },     // Warm white
            closingBg: { red: 0.13, green: 0.37, blue: 0.31, alpha: 1 },     // Forest green
            accent: { red: 0.85, green: 0.65, blue: 0.40, alpha: 1 },        // Tan
            titleText: { red: 1, green: 1, blue: 1, alpha: 1 },              // White
            bodyText: { red: 0.20, green: 0.25, blue: 0.22, alpha: 1 },      // Dark green
            subtitleText: { red: 0.75, green: 0.82, blue: 0.78, alpha: 1 },  // Light sage
        }
    },
};

// Slide size options
const SLIDE_SIZES = {
    widescreen: { name: "Widescreen (16:9)", width: 1920, height: 1080 },
    standard: { name: "Standard (4:3)", width: 1440, height: 1080 },
    square: { name: "Square (1:1)", width: 1080, height: 1080 },
    portrait: { name: "Portrait (9:16)", width: 1080, height: 1920 },
};

// Font size options
const FONT_SIZES = {
    small: { name: "Small", title: 72, subtitle: 32, heading: 48, body: 24 },
    medium: { name: "Medium", title: 96, subtitle: 40, heading: 56, body: 28 },
    large: { name: "Large", title: 120, subtitle: 48, heading: 64, body: 32 },
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
        
        // Customization options
        const [selectedTemplate, setSelectedTemplate] = useState<keyof typeof TEMPLATES>("modern");
        const [selectedSize, setSelectedSize] = useState<keyof typeof SLIDE_SIZES>("widescreen");
        const [selectedFontSize, setSelectedFontSize] = useState<keyof typeof FONT_SIZES>("medium");
        const [showSettings, setShowSettings] = useState(false);
        
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
                
                const response = await fetch(`${API_BASE_URL}/api/generate-presentation`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ url: url.trim() }),
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
                setStatus(`Found ${data.slides.length} slides ready to create`);
                
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
            setStatus("Creating presentation slides...");
            
            try {
                const template = TEMPLATES[selectedTemplate];
                const size = SLIDE_SIZES[selectedSize];
                const fontSize = FONT_SIZES[selectedFontSize];
                
                // Call sandbox with presentation data and settings
                await sandboxProxy.generatePresentation({
                    slides: presentationData.slides,
                    settings: {
                        template: selectedTemplate,
                        colors: template.colors,
                        slideWidth: size.width,
                        slideHeight: size.height,
                        fontSizes: fontSize,
                    }
                });
                
                setStatus("✓ Presentation created successfully!");
                setError("");
            } catch (err: any) {
                console.error("Error generating presentation:", err);
                setError(err.message || "Failed to create presentation");
                setStatus("");
            } finally {
                setIsProcessing(false);
            }
        };
        
        // Clear everything
        const handleClear = () => {
            setUrl("");
            setPresentationData(null);
            setStatus("");
            setError("");
        };
        
        const template = TEMPLATES[selectedTemplate];
        
        return (
            <div style={styles.container}>
                {/* Header */}
                <div style={styles.header}>
                    <h2 style={styles.title}>🎯 URL to Presentation</h2>
                    <p style={styles.subtitle}>
                        Transform any URL into beautiful slides
                    </p>
                </div>
                
                {/* URL Input Section */}
                <div style={styles.inputSection}>
                    <label style={styles.label}>Enter URL</label>
                    <input
                        type="url"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        placeholder="YouTube video or blog URL..."
                        style={styles.input}
                        disabled={isProcessing}
                    />
                    
                    <div style={styles.buttonRow}>
                        <button
                            onClick={handleProcessUrl}
                            disabled={isProcessing || !url.trim()}
                            style={{
                                ...styles.button,
                                ...styles.primaryButton,
                                opacity: isProcessing || !url.trim() ? 0.6 : 1,
                            }}
                        >
                            {isProcessing && !presentationData ? "Processing..." : "🔍 Analyze"}
                        </button>
                        
                        {url && (
                            <button
                                onClick={handleClear}
                                disabled={isProcessing}
                                style={{...styles.button, ...styles.secondaryButton}}
                            >
                                ✕
                            </button>
                        )}
                    </div>
                </div>
                
                {/* Template & Settings Toggle */}
                <div style={styles.settingsToggle}>
                    <button
                        onClick={() => setShowSettings(!showSettings)}
                        style={styles.settingsButton}
                    >
                        ⚙️ Customize {showSettings ? "▲" : "▼"}
                    </button>
                </div>
                
                {/* Settings Panel */}
                {showSettings && (
                    <div style={styles.settingsPanel}>
                        {/* Template Selection */}
                        <div style={styles.settingGroup}>
                            <label style={styles.settingLabel}>Template</label>
                            <div style={styles.templateGrid}>
                                {Object.entries(TEMPLATES).map(([key, tmpl]) => (
                                    <div
                                        key={key}
                                        onClick={() => setSelectedTemplate(key as keyof typeof TEMPLATES)}
                                        style={{
                                            ...styles.templateCard,
                                            borderColor: selectedTemplate === key ? '#1473e6' : '#e0e0e0',
                                            backgroundColor: selectedTemplate === key ? '#f0f7ff' : 'white',
                                        }}
                                    >
                                        <span style={styles.templateIcon}>{tmpl.preview}</span>
                                        <span style={styles.templateName}>{tmpl.name}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                        
                        {/* Slide Size */}
                        <div style={styles.settingGroup}>
                            <label style={styles.settingLabel}>Slide Size</label>
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
                        
                        {/* Font Size */}
                        <div style={styles.settingGroup}>
                            <label style={styles.settingLabel}>Text Size</label>
                            <div style={styles.fontSizeOptions}>
                                {Object.entries(FONT_SIZES).map(([key, fs]) => (
                                    <button
                                        key={key}
                                        onClick={() => setSelectedFontSize(key as keyof typeof FONT_SIZES)}
                                        style={{
                                            ...styles.fontSizeButton,
                                            backgroundColor: selectedFontSize === key ? '#1473e6' : '#f0f0f0',
                                            color: selectedFontSize === key ? 'white' : '#333',
                                        }}
                                    >
                                        {fs.name}
                                    </button>
                                ))}
                            </div>
                        </div>
                        
                        {/* Template Preview */}
                        <div style={styles.templatePreview}>
                            <div style={{
                                ...styles.previewBox,
                                background: `rgb(${template.colors.titleBg.red * 255}, ${template.colors.titleBg.green * 255}, ${template.colors.titleBg.blue * 255})`,
                            }}>
                                <div style={{
                                    ...styles.previewAccent,
                                    background: `rgb(${template.colors.accent.red * 255}, ${template.colors.accent.green * 255}, ${template.colors.accent.blue * 255})`,
                                }}></div>
                                <span style={{
                                    color: `rgb(${template.colors.titleText.red * 255}, ${template.colors.titleText.green * 255}, ${template.colors.titleText.blue * 255})`,
                                    fontSize: '10px',
                                    fontWeight: 600,
                                }}>Title Slide</span>
                            </div>
                            <div style={{
                                ...styles.previewBox,
                                background: `rgb(${template.colors.contentBg.red * 255}, ${template.colors.contentBg.green * 255}, ${template.colors.contentBg.blue * 255})`,
                            }}>
                                <div style={{
                                    ...styles.previewAccentBar,
                                    background: `rgb(${template.colors.accent.red * 255}, ${template.colors.accent.green * 255}, ${template.colors.accent.blue * 255})`,
                                }}></div>
                                <span style={{
                                    color: `rgb(${template.colors.bodyText.red * 255}, ${template.colors.bodyText.green * 255}, ${template.colors.bodyText.blue * 255})`,
                                    fontSize: '10px',
                                    fontWeight: 600,
                                }}>Content</span>
                            </div>
                        </div>
                    </div>
                )}
                
                {/* Status/Error Display */}
                {status && (
                    <div style={styles.statusBox}>
                        <span style={styles.statusIcon}>
                            {isProcessing ? "⏳" : "✓"}
                        </span>
                        {status}
                    </div>
                )}
                
                {error && (
                    <div style={styles.errorBox}>
                        <span style={styles.errorIcon}>⚠️</span>
                        {error}
                    </div>
                )}
                
                {/* Preview Section */}
                {presentationData && presentationData.slides.length > 0 && (
                    <div style={styles.previewSection}>
                        <h3 style={styles.previewTitle}>
                            📊 {presentationData.slides.length} Slides Ready
                        </h3>
                        
                        <div style={styles.slidePreviewContainer}>
                            {presentationData.slides.map((slide, index) => (
                                <div key={index} style={styles.slidePreview}>
                                    <div style={{
                                        ...styles.slideNumber,
                                        background: `rgb(${template.colors.accent.red * 255}, ${template.colors.accent.green * 255}, ${template.colors.accent.blue * 255})`,
                                    }}>
                                        {index + 1}
                                    </div>
                                    <div style={styles.slideContent}>
                                        <div style={styles.slideType}>
                                            {slide.type === 'title' ? '🎬' : slide.type === 'closing' ? '🏁' : '📄'} {slide.type}
                                        </div>
                                        <div style={styles.slideTitle}>
                                            {slide.title}
                                        </div>
                                        {slide.content && (
                                            <div style={styles.slideText}>
                                                {slide.content.substring(0, 60)}
                                                {slide.content.length > 60 ? "..." : ""}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                        
                        <button
                            onClick={handleGeneratePresentation}
                            disabled={isProcessing}
                            style={{
                                ...styles.button,
                                ...styles.generateButton,
                                opacity: isProcessing ? 0.6 : 1,
                            }}
                        >
                            {isProcessing ? "Creating..." : `🚀 Create with ${template.name} Template`}
                        </button>
                    </div>
                )}
                
                {/* Instructions (only show when no data) */}
                {!presentationData && (
                    <div style={styles.instructions}>
                        <h4 style={styles.instructionsTitle}>Supported:</h4>
                        <div style={styles.supportedList}>
                            <span style={styles.supportedItem}>📺 YouTube</span>
                            <span style={styles.supportedItem}>📝 Blogs</span>
                            <span style={styles.supportedItem}>🌐 Articles</span>
                        </div>
                    </div>
                )}
            </div>
        );
    }
    
    // Styles
    const styles: { [key: string]: React.CSSProperties } = {
        container: {
            padding: "12px",
            fontFamily: "'Adobe Clean', -apple-system, BlinkMacSystemFont, sans-serif",
            maxWidth: "100%",
            boxSizing: "border-box",
            fontSize: "13px",
        },
        header: {
            marginBottom: "16px",
            textAlign: "center",
        },
        title: {
            fontSize: "18px",
            fontWeight: 700,
            margin: "0 0 4px 0",
            color: "#1a1a1a",
        },
        subtitle: {
            fontSize: "12px",
            color: "#6e6e6e",
            margin: 0,
        },
        inputSection: {
            marginBottom: "12px",
        },
        label: {
            display: "block",
            fontSize: "11px",
            fontWeight: 600,
            color: "#4a4a4a",
            marginBottom: "4px",
            textTransform: "uppercase",
            letterSpacing: "0.5px",
        },
        input: {
            width: "100%",
            padding: "10px 12px",
            fontSize: "13px",
            border: "2px solid #e0e0e0",
            borderRadius: "8px",
            boxSizing: "border-box",
            marginBottom: "8px",
            outline: "none",
            transition: "border-color 0.2s",
        },
        buttonRow: {
            display: "flex",
            gap: "6px",
        },
        button: {
            padding: "10px 14px",
            fontSize: "13px",
            fontWeight: 600,
            borderRadius: "8px",
            border: "none",
            cursor: "pointer",
            transition: "all 0.2s",
        },
        primaryButton: {
            flex: 1,
            backgroundColor: "#1473e6",
            color: "white",
        },
        secondaryButton: {
            backgroundColor: "#f0f0f0",
            color: "#666",
            padding: "10px 12px",
        },
        generateButton: {
            width: "100%",
            backgroundColor: "#12805c",
            color: "white",
            marginTop: "10px",
            padding: "12px",
            fontSize: "14px",
        },
        settingsToggle: {
            marginBottom: "8px",
        },
        settingsButton: {
            width: "100%",
            padding: "8px",
            fontSize: "12px",
            backgroundColor: "transparent",
            border: "1px dashed #ccc",
            borderRadius: "6px",
            cursor: "pointer",
            color: "#666",
        },
        settingsPanel: {
            backgroundColor: "#f8f9fa",
            borderRadius: "10px",
            padding: "12px",
            marginBottom: "12px",
        },
        settingGroup: {
            marginBottom: "12px",
        },
        settingLabel: {
            display: "block",
            fontSize: "11px",
            fontWeight: 600,
            color: "#555",
            marginBottom: "6px",
        },
        templateGrid: {
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: "6px",
        },
        templateCard: {
            padding: "8px 4px",
            borderRadius: "8px",
            border: "2px solid #e0e0e0",
            cursor: "pointer",
            textAlign: "center",
            transition: "all 0.2s",
        },
        templateIcon: {
            display: "block",
            fontSize: "18px",
            marginBottom: "2px",
        },
        templateName: {
            fontSize: "10px",
            fontWeight: 600,
            color: "#333",
        },
        select: {
            width: "100%",
            padding: "8px",
            fontSize: "12px",
            borderRadius: "6px",
            border: "1px solid #ddd",
            backgroundColor: "white",
        },
        fontSizeOptions: {
            display: "flex",
            gap: "4px",
        },
        fontSizeButton: {
            flex: 1,
            padding: "6px",
            fontSize: "11px",
            fontWeight: 600,
            borderRadius: "6px",
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
            height: "50px",
            borderRadius: "6px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
            overflow: "hidden",
        },
        previewAccent: {
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: "4px",
        },
        previewAccentBar: {
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: "4px",
        },
        statusBox: {
            backgroundColor: "#e8f4fd",
            border: "1px solid #b8d4e8",
            borderRadius: "8px",
            padding: "10px 12px",
            marginBottom: "12px",
            fontSize: "12px",
            color: "#0c5460",
            display: "flex",
            alignItems: "center",
            gap: "8px",
        },
        statusIcon: {
            fontSize: "14px",
        },
        errorBox: {
            backgroundColor: "#fef0f0",
            border: "1px solid #f5c6cb",
            borderRadius: "8px",
            padding: "10px 12px",
            marginBottom: "12px",
            fontSize: "12px",
            color: "#721c24",
            display: "flex",
            alignItems: "center",
            gap: "8px",
        },
        errorIcon: {
            fontSize: "14px",
        },
        previewSection: {
            backgroundColor: "#fafafa",
            borderRadius: "10px",
            padding: "12px",
            marginBottom: "12px",
        },
        previewTitle: {
            fontSize: "13px",
            fontWeight: 600,
            margin: "0 0 10px 0",
            color: "#1a1a1a",
        },
        slidePreviewContainer: {
            maxHeight: "200px",
            overflowY: "auto",
        },
        slidePreview: {
            display: "flex",
            gap: "8px",
            padding: "8px",
            backgroundColor: "white",
            borderRadius: "6px",
            marginBottom: "6px",
            border: "1px solid #e8e8e8",
        },
        slideNumber: {
            width: "24px",
            height: "24px",
            borderRadius: "50%",
            backgroundColor: "#1473e6",
            color: "white",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "11px",
            fontWeight: 700,
            flexShrink: 0,
        },
        slideContent: {
            flex: 1,
            minWidth: 0,
        },
        slideType: {
            fontSize: "9px",
            color: "#888",
            textTransform: "uppercase",
            letterSpacing: "0.5px",
            marginBottom: "2px",
        },
        slideTitle: {
            fontSize: "12px",
            fontWeight: 600,
            color: "#1a1a1a",
            marginBottom: "2px",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
        },
        slideText: {
            fontSize: "10px",
            color: "#888",
            lineHeight: 1.3,
        },
        instructions: {
            borderTop: "1px solid #e8e8e8",
            paddingTop: "12px",
            marginTop: "8px",
            textAlign: "center",
        },
        instructionsTitle: {
            fontSize: "11px",
            fontWeight: 600,
            color: "#666",
            margin: "0 0 8px 0",
        },
        supportedList: {
            display: "flex",
            justifyContent: "center",
            gap: "12px",
        },
        supportedItem: {
            fontSize: "11px",
            color: "#888",
        },
    };
    
    const root = createRoot(document.getElementById("root")!);
    root.render(<App />);
});
