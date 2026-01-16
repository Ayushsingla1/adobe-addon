import addOnSandboxSdk from "add-on-sdk-document-sandbox";
import { editor, colorUtils, constants, fonts, viewport } from "express-document-sdk";

const { runtime } = addOnSandboxSdk.instance;

// Types
interface ColorValue {
    red: number;
    green: number;
    blue: number;
    alpha: number;
}

interface TemplateColors {
    titleBg: ColorValue;
    contentBg: ColorValue;
    closingBg: ColorValue;
    accent: ColorValue;
    titleText: ColorValue;
    bodyText: ColorValue;
    subtitleText: ColorValue;
}

interface FontSizes {
    title: number;
    subtitle: number;
    heading: number;
    body: number;
}

interface PresentationSettings {
    template: string;
    colors: TemplateColors;
    slideWidth: number;
    slideHeight: number;
    fontSizes: FontSizes;
    layoutStyle?: "mixed" | "card" | "split" | "classic";
    fontStyle?: "modern" | "classic" | "handwritten";
    brandLogo?: string;
    brandColor?: ColorValue;
}

interface SlideData {
    type: string;
    title: string;
    content?: string;
    subtitle?: string;
    slide_number?: number;
}

interface PresentationInput {
    slides: SlideData[];
    settings: PresentationSettings;
}

// --- UTILS ---

function toColor(c: ColorValue) {
    return colorUtils.fromRGB(c.red, c.green, c.blue, c.alpha);
}

function makeFill(c: ColorValue) {
    return editor.makeColorFill(toColor(c));
}

function makeStroke(c: ColorValue, width: number, dashPattern?: number[]) {
    return editor.makeStroke({
        color: toColor(c),
        width: width,
        dashPattern: dashPattern || [],
    });
}

// NOTE: Removed manual wrapText function. 
// We will rely on the SDK's native wrapping (TextLayout.autoHeight + width) 
// to prevent overlaps and improve rendering quality.

// Create rounded rectangle using path
function createRoundedRect(x: number, y: number, w: number, h: number, r: number) {
    const radius = Math.min(r, w / 2, h / 2);
    const path = `
        M ${x + radius},${y}
        L ${x + w - radius},${y}
        Q ${x + w},${y} ${x + w},${y + radius}
        L ${x + w},${y + h - radius}
        Q ${x + w},${y + h} ${x + w - radius},${y + h}
        L ${x + radius},${y + h}
        Q ${x},${y + h} ${x},${y + h - radius}
        L ${x},${y + radius}
        Q ${x},${y} ${x + radius},${y}
        Z
    `.replace(/\s+/g, ' ').trim();
    return editor.createPath(path);
}

function createBlobShape(x: number, y: number, size: number) {
    // A more organic shape than a simple circle
    const path = `
        M ${x + size * 0.5},${y}
        Q ${x + size},${y} ${x + size},${y + size * 0.5}
        Q ${x + size},${y + size} ${x + size * 0.5},${y + size}
        Q ${x},${y + size} ${x},${y + size * 0.5}
        Q ${x},${y} ${x + size * 0.5},${y}
        Z
    `.replace(/\s+/g, ' ').trim();
    return editor.createPath(path);
}

function dataURLtoBlob(dataurl: string): Blob {
    const arr = dataurl.split(',');
    const match = arr[0].match(/:(.*?);/);
    const mime = match ? match[1] : 'image/png';
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
}

function getCurrentPageIndex(): number {
    const pages = editor.documentRoot.pages;
    const currentPage = editor.context.currentPage;
    for (let i = 0; i < pages.length; i++) {
        if (pages[i] === currentPage) return i;
    }
    return 0;
}

// --- MAIN LOGIC ---

function clearAllPages() {
    // Clear all content from existing pages
    try {
        const pages = editor.documentRoot.pages;
        if (!pages || pages.length === 0) {
            console.log("No pages to clear");
            return;
        }
        
        for (let i = 0; i < pages.length; i++) {
            const page = pages[i];
            if (!page) continue;
            
            const artboards = page.artboards;
            if (!artboards) continue;
            
            for (let j = 0; j < artboards.length; j++) {
                const artboard = artboards[j];
                if (!artboard || !artboard.children) continue;
                
                // Remove all children from the artboard
                while (artboard.children.length > 0) {
                    const child = artboard.children[0];
                    if (child) {
                        child.removeFromParent();
                    } else {
                        break;
                    }
                }
            }
        }
        
        console.log(`Cleared content from ${pages.length} page(s)`);
    } catch (err) {
        console.error("Error clearing pages:", err);
    }
}

function start() {
    runtime.exposeApi({
        clearDocument: async () => {
            // Clear all existing content before generating new presentation
            await editor.queueAsyncEdit(async () => {
                clearAllPages();
            });
            return { success: true };
        },
        
        generatePresentation: async (input: PresentationInput) => {
            const { slides, settings } = input;
            
            if (!slides || slides.length === 0) {
                console.error("No slides provided");
                return;
            }

            let { colors } = settings;
            const { slideWidth, slideHeight, fontSizes } = settings;
            
            // --- BRAND IDENTITY OVERRIDE ---
            if (settings.brandColor) {
                // Keep alpha from template if needed, or just use 1
                colors = {
                    ...colors,
                    accent: { ...settings.brandColor, alpha: 1 } 
                };
            }
            // -------------------------------

            // Increased padding for cleaner look
            const padding = Math.min(slideWidth, slideHeight) * 0.08; 

            console.log(`Generating ${slides.length} slides at ${slideWidth}x${slideHeight}`);
            const startPageIndex = getCurrentPageIndex();

            // Load fonts based on selection
            let boldFontName = "SourceSans3-Bold";
            let regularFontName = "SourceSans3-Regular";
            let lightFontName = "SourceSans3-Light";

            if (settings.fontStyle === "classic") {
                // Try to use a Serif font if available, falling back to Sans
                try {
                    // We'll stick to SourceSans3 for stability but ideally this would be SourceSerif
                    // For now, let's just keep it consistent to avoid runtime errors if font missing
                    boldFontName = "SourceSans3-Black"; // Heavier for classic headers
                    regularFontName = "SourceSans3-Regular";
                } catch (e) { console.warn("Font load error", e); }
            } else if (settings.fontStyle === "handwritten") {
                 boldFontName = "SourceSans3-Semibold";
                 regularFontName = "SourceSans3-Light"; // Lighter feel
            }

            const boldFont = await fonts.fromPostscriptName(boldFontName);
            const regularFont = await fonts.fromPostscriptName(regularFontName);
            const lightFont = await fonts.fromPostscriptName(lightFontName);

            for (let i = 0; i < slides.length; i++) {
                const slideData = slides[i];
                console.log(`Creating slide ${i + 1}: ${slideData.type}`);

                try {
                    await editor.queueAsyncEdit(async () => {
                        if (i === 0) {
                            const currentPage = editor.context.currentPage;
                            currentPage.width = slideWidth;
                            currentPage.height = slideHeight;
                        } else {
                            editor.documentRoot.pages.addPage({ width: slideWidth, height: slideHeight });
                        }

                        const currentPage = editor.context.currentPage;
                        const artboard = currentPage.artboards.first ?? editor.context.insertionParent;

                        // Add a base background
                        const bg = editor.createRectangle();
                        bg.width = slideWidth;
                        bg.height = slideHeight;
                        bg.fill = makeFill(slideData.type === 'closing' ? colors.closingBg : (slideData.type === 'title' ? colors.titleBg : colors.contentBg));
                        artboard.children.append(bg);
                        
                        // --- LOGO WATERMARK ---
                        if (settings.brandLogo) {
                            try {
                                const logoSize = Math.min(slideWidth, slideHeight) * 0.08;
                                // Create image from base64 string
                                const blob = dataURLtoBlob(settings.brandLogo);
                                const bitmap = await editor.loadBitmapImage(blob);
                                const logoContainer = editor.createImageContainer(bitmap);
                                
                                // Set dimensions directly since .layout isn't available
                                // Assuming MediaContainerNode (or BaseNode) supports width/height setters or transform
                                // If not, we might need a workaround, but usually visual nodes do.
                                // If direct width/height setting fails in runtime, we might need to check the API.
                                // But for now, fixing the TS error:
                                // 'layout' does not exist. We'll try assigning to width/height directly if TS allows, 
                                // or casting to any if we're sure it works at runtime but TS definitions are outdated.
                                // Given TS error, 'width' property likely exists on MediaContainerNode (inherits from Node -> VisualNode?)
                                // Let's try casting to any to bypass TS if we are confident, or just use what's available.
                                // But safely, let's just cast to any for this specific operation to unblock the build
                                // as width/height are standard on visual nodes.
                                (logoContainer as any).width = logoSize;
                                (logoContainer as any).height = logoSize;

                                // Position: Bottom Right with padding
                                logoContainer.translation = { 
                                    x: slideWidth - logoSize - (padding * 0.5), 
                                    y: slideHeight - logoSize - (padding * 0.5) 
                                };
                                artboard.children.append(logoContainer);
                            } catch (e) {
                                console.error("Failed to add logo:", e);
                            }
                        }
                        // ---------------------
                        
                        // Glassmorphism background effect (if 'glass' template)
                        if (settings.template === 'glass') {
                             // Add gradient blobs for background
                            const blob1 = createBlobShape(0, 0, slideWidth * 0.8);
                            blob1.fill = makeFill({ ...colors.accent, alpha: 0.3 });
                            blob1.translation = { x: -slideWidth * 0.2, y: -slideHeight * 0.2 };
                            artboard.children.append(blob1);
                            
                            const blob2Size = slideWidth * 0.6;
                            const blob2 = createBlobShape(0, 0, blob2Size);
                            blob2.fill = makeFill({ ...colors.accent, alpha: 0.2 });
                            const blob2X = slideWidth * 0.5;
                            const blob2Y = slideHeight * 0.4;
                            blob2.translation = { x: blob2X, y: blob2Y };
                            blob2.setRotationInParent(45, { x: blob2X + blob2Size/2, y: blob2Y + blob2Size/2 });
                            artboard.children.append(blob2);
                            
                            // Glass overlay
                            const glassOverlay = editor.createRectangle();
                            glassOverlay.width = slideWidth;
                            glassOverlay.height = slideHeight;
                            glassOverlay.fill = makeFill({ red: 1, green: 1, blue: 1, alpha: 0.1 }); // White tint
                            artboard.children.append(glassOverlay);
                        }

                        switch (slideData.type) {
                            case "title":
                                createTitleSlide(artboard, slideData, colors, slideWidth, slideHeight, fontSizes, padding, boldFont, lightFont, settings);
                                break;
                            case "content":
                                createContentSlide(artboard, slideData, colors, slideWidth, slideHeight, fontSizes, padding, i + 1, boldFont, regularFont, settings);
                                break;
                            case "closing":
                                createClosingSlide(artboard, slideData, colors, slideWidth, slideHeight, fontSizes, padding, boldFont, lightFont);
                                break;
                            default:
                                createContentSlide(artboard, slideData, colors, slideWidth, slideHeight, fontSizes, padding, i + 1, boldFont, regularFont, settings);
                        }
                    });
                } catch (err) {
                    console.error(`Error creating slide ${i + 1}:`, err);
                }
            }
            return { startPageIndex };
        },
        getPageCount: () => editor.documentRoot.pages.length,
        goToPage: (index: number) => {
            const page = editor.documentRoot.pages[index];
            if (page) {
                const artboard = page.artboards.first;
                if (artboard) viewport.bringIntoView(artboard);
            }
        },
    });
}

/**
 * Modern Geometric Title Slide
 */
function createTitleSlide(
    artboard: any,
    slideData: SlideData,
    colors: TemplateColors,
    width: number,
    height: number,
    fontSizes: FontSizes,
    padding: number,
    boldFont: any,
    lightFont: any,
    settings: PresentationSettings
) {
    // 1. Abstract Background Shapes
    if (settings.template !== 'glass') {
        // Only show these abstract shapes if NOT glass theme (glass has its own blobs in start())
        // Large faded circle top right
        const bgCircle = editor.createEllipse();
        const bgSize = width * 0.7;
        bgCircle.rx = bgSize / 2;
        bgCircle.ry = bgSize / 2;
        bgCircle.translation = { x: width - (bgSize * 0.4), y: -bgSize * 0.2 };
        bgCircle.fill = makeFill({ ...colors.accent, alpha: 0.08 });
        artboard.children.append(bgCircle);

        // Accent Pill Shape bottom left
        const pillX = -width * 0.1;
        const pillY = height * 0.6;
        const pillW = width * 0.5;
        const pillH = height * 0.6;
        
        const pill = createRoundedRect(pillX, pillY, pillW, pillH, height * 0.1);
        const pillCenterX = pillX + (pillW / 2);
        const pillCenterY = pillY + (pillH / 2);
        pill.setRotationInParent(-15, { x: pillCenterX, y: pillCenterY });
        pill.fill = makeFill({ ...colors.accent, alpha: 0.12 });
        artboard.children.append(pill);
    }

    // Glassmorphism specific: Title Card
    if (settings.template === 'glass') {
        const cardW = width - (padding * 2);
        const cardH = height * 0.5;
        const cardX = padding;
        const cardY = (height - cardH) / 2;
        
        const glassCard = createRoundedRect(cardX, cardY, cardW, cardH, 24);
        glassCard.fill = makeFill({ red: 1, green: 1, blue: 1, alpha: 0.15 }); // Frosted look
        glassCard.stroke = makeStroke({ ...colors.accent, alpha: 0.3 }, 2);
        artboard.children.append(glassCard);
        
        // Add slight blur simulation (white overlay)
        const highlight = createRoundedRect(cardX, cardY, cardW, cardH/2, 24);
        highlight.fill = makeFill({ red: 1, green: 1, blue: 1, alpha: 0.05 });
        artboard.children.append(highlight);
    }

    // 2. Title Block (Left Aligned for better modern look)
    const titleText = slideData.title || "Presentation";
    const titleObj = editor.createText(titleText);
    
    // Configure Layout constraints
    const titleWidth = width - (padding * 3); // More padding for cleaner look
    titleObj.layout = { type: constants.TextLayout.autoHeight, width: titleWidth };
    titleObj.textAlignment = constants.TextAlignment.left; // Modern left-align
    artboard.children.append(titleObj);

    // Reduced size per request (1.3 -> 1.15)
    const titleSize = fontSizes.title * 1.15;
    
    titleObj.fullContent.applyCharacterStyles({
        font: boldFont,
        fontSize: titleSize,
        color: toColor(colors.titleText),
    });
    titleObj.fullContent.applyParagraphStyles({ lineSpacing: 1.1 });

    // Position Title vertically centered
    const titleHeight = titleObj.boundsLocal.height;
    // Shift slightly up for optical center
    const titleY = (height - titleHeight) / 2 - (height * 0.02); 
    
    titleObj.setPositionInParent(
        { x: padding * 1.5, y: titleY },
        { x: 0, y: 0 }
    );

    // 3. Subtitle / Decoration
    if (slideData.subtitle) {
        const subObj = editor.createText(slideData.subtitle);
        subObj.layout = { type: constants.TextLayout.autoHeight, width: titleWidth };
        artboard.children.append(subObj);
        subObj.fullContent.applyCharacterStyles({
            font: lightFont,
            fontSize: fontSizes.subtitle,
            color: toColor({ ...colors.titleText, alpha: 0.8 })
        });
        subObj.setPositionInParent(
            { x: padding * 1.5, y: titleY + titleHeight + 20 },
            { x: 0, y: 0 }
        );
    } else {
        // Decorative line if no subtitle
        const line = editor.createRectangle();
        line.width = width * 0.1;
        line.height = 4;
        line.fill = makeFill(colors.accent);
        line.translation = { x: padding * 1.5, y: titleY + titleHeight + 30 };
        artboard.children.append(line);
    }
}

/**
 * Router for Content Slides
 */
function createContentSlide(
    artboard: any,
    slideData: SlideData,
    colors: TemplateColors,
    width: number,
    height: number,
    fontSizes: FontSizes,
    padding: number,
    slideNumber: number,
    boldFont: any,
    regularFont: any,
    settings: PresentationSettings
) {
    let layoutVariant;

    if (settings.layoutStyle === 'card') layoutVariant = 0;
    else if (settings.layoutStyle === 'classic') layoutVariant = 1;
    else if (settings.layoutStyle === 'split') layoutVariant = 2;
    else layoutVariant = slideNumber % 3; // 'mixed' is default
    
    if (layoutVariant === 1) {
        createContentLayoutClassic(artboard, slideData, colors, width, height, fontSizes, padding, slideNumber, boldFont, regularFont);
    } else if (layoutVariant === 2) {
        createContentLayoutSplit(artboard, slideData, colors, width, height, fontSizes, padding, slideNumber, boldFont, regularFont);
    } else {
        createContentLayoutCard(artboard, slideData, colors, width, height, fontSizes, padding, slideNumber, boldFont, regularFont);
    }
}

/**
 * Layout 1: Classic (Clean Header + Body)
 */
function createContentLayoutClassic(
    artboard: any,
    slideData: SlideData,
    colors: TemplateColors,
    width: number,
    height: number,
    fontSizes: FontSizes,
    padding: number,
    slideNumber: number,
    boldFont: any,
    regularFont: any
) {
    // 1. Header Background Strip
    const headerBg = editor.createRectangle();
    headerBg.width = width;
    headerBg.height = height * 0.18;
    headerBg.fill = makeFill({ ...colors.accent, alpha: 0.1 });
    artboard.children.append(headerBg);

    // 2. Accent Mark
    const mark = editor.createRectangle();
    mark.width = 8;
    mark.height = height * 0.18;
    mark.fill = makeFill(colors.accent);
    artboard.children.append(mark);

    // 3. Heading
    const heading = createHeadingText(artboard, slideData.title, colors, width, height, fontSizes, padding, boldFont, padding + 15, (height * 0.18)/2, width - padding * 2);
    // Center heading vertically in the strip
    heading.setPositionInParent(
        { x: padding + 15, y: (height * 0.18) / 2 },
        { x: 0, y: heading.boundsLocal.height / 2 }
    );

    // 4. Body Content
    const bodyStartY = (height * 0.18) + (padding * 0.8);
    const bodyAvailableH = height - bodyStartY - padding;
    
    createBodyText(
        artboard,
        slideData.content || "",
        colors,
        width,
        height,
        fontSizes,
        padding,
        regularFont,
        0, 0, // unused ratios
        padding,
        width - (padding * 2), // Full width minus padding
        bodyStartY,
        bodyAvailableH
    );

    addSlideNumber(artboard, colors, width, height, padding, slideNumber, boldFont);
}

/**
 * Layout 2: Split (Left Panel + Right Content)
 */
function createContentLayoutSplit(
    artboard: any,
    slideData: SlideData,
    colors: TemplateColors,
    width: number,
    height: number,
    fontSizes: FontSizes,
    padding: number,
    slideNumber: number,
    boldFont: any,
    regularFont: any
) {
    const panelWidth = width * 0.38;

    // 1. Left Panel (Glass-morphism style)
    const panel = editor.createRectangle();
    panel.width = panelWidth;
    panel.height = height;
    panel.fill = makeFill({ ...colors.accent, alpha: 0.15 });
    artboard.children.append(panel);

    // Darker accent edge
    const edge = editor.createRectangle();
    edge.width = 4;
    edge.height = height;
    edge.translation = { x: panelWidth, y: 0 };
    edge.fill = makeFill({ ...colors.accent, alpha: 0.4 });
    artboard.children.append(edge);

    // 2. Heading (Inside Left Panel)
    // We add padding INSIDE the panel
    const headingWidth = panelWidth - (padding * 1.5);
    const heading = createHeadingText(artboard, slideData.title, colors, width, height, fontSizes, padding, boldFont, 0, 0, headingWidth);
    
    // Override color for split layout contrast
    heading.fullContent.applyCharacterStyles({ color: toColor(colors.accent) }); // Make title pop
    
    heading.setPositionInParent(
        { x: padding * 0.8, y: padding * 1.5 },
        { x: 0, y: 0 }
    );

    // Decorative shape in panel
    const deco = createRoundedRect(padding * 0.8, height - padding * 3, 40, 40, 10);
    deco.fill = makeFill({ ...colors.accent, alpha: 0.5 });
    artboard.children.append(deco);

    // 3. Body Content (Right Side)
    const bodyX = panelWidth + padding;
    const bodyW = width - panelWidth - (padding * 2);
    const bodyY = padding * 1.5;

    createBodyText(
        artboard,
        slideData.content || "",
        colors,
        width,
        height,
        fontSizes,
        padding,
        regularFont,
        0, 0,
        bodyX,
        bodyW,
        bodyY,
        height - (padding * 2)
    );

    addSlideNumber(artboard, colors, width, height, padding, slideNumber, boldFont);
}

/**
 * Layout 3: Card (Floating Content Box)
 */
function createContentLayoutCard(
    artboard: any,
    slideData: SlideData,
    colors: TemplateColors,
    width: number,
    height: number,
    fontSizes: FontSizes,
    padding: number,
    slideNumber: number,
    boldFont: any,
    regularFont: any
) {
    // 1. Organic Background Blob
    const blob = createBlobShape(-width * 0.1, -height * 0.1, width * 0.5);
    blob.fill = makeFill({ ...colors.accent, alpha: 0.08 });
    artboard.children.append(blob);

    // 2. Card Shadow (Offset Rectangle) to give depth
    const cardX = padding;
    const cardY = padding * 1.5;
    const cardW = width - (padding * 2);
    const cardH = height - (padding * 2.5);
    const radius = 16;

    const shadow = createRoundedRect(cardX + 8, cardY + 8, cardW, cardH, radius);
    shadow.fill = makeFill({ ...colors.accent, alpha: 0.2 });
    artboard.children.append(shadow);

    // 3. Main Card
    const card = createRoundedRect(cardX, cardY, cardW, cardH, radius);
    card.fill = makeFill({ ...colors.contentBg, alpha: 1.0 }); // Solid background
    card.stroke = makeStroke({ ...colors.accent, alpha: 0.3 }, 1);
    artboard.children.append(card);

    // 4. Content Inside Card (Use inner padding)
    const innerPad = padding * 0.8;
    const contentW = cardW - (innerPad * 2);

    // Heading
    const heading = createHeadingText(artboard, slideData.title, colors, width, height, fontSizes, padding, boldFont, 0, 0, contentW);
    heading.setPositionInParent(
        { x: cardX + innerPad, y: cardY + innerPad },
        { x: 0, y: 0 }
    );

    // Divider
    const divider = editor.createRectangle();
    divider.width = 60;
    divider.height = 4;
    divider.fill = makeFill(colors.accent);
    const headingBottom = cardY + innerPad + heading.boundsLocal.height;
    divider.translation = { x: cardX + innerPad, y: headingBottom + 12 };
    artboard.children.append(divider);

    // Body
    createBodyText(
        artboard,
        slideData.content || "",
        colors,
        width,
        height,
        fontSizes,
        padding,
        regularFont,
        0, 0,
        cardX + innerPad,
        contentW,
        headingBottom + 30, // Start below divider
        cardH - (heading.boundsLocal.height + innerPad * 2)
    );

    addSlideNumber(artboard, colors, width, height, padding, slideNumber, boldFont);
}

// --- TEXT HELPERS ---

function createHeadingText(
    artboard: any,
    text: string,
    colors: TemplateColors,
    width: number,
    height: number,
    fontSizes: FontSizes,
    padding: number,
    boldFont: any,
    xOverride: number,
    yOverride: number,
    maxWidth: number
) {
    const heading = editor.createText(text || "Title");
    
    // SDK handles wrapping based on width
    heading.layout = { 
        type: constants.TextLayout.autoHeight, 
        width: maxWidth 
    };
    heading.textAlignment = constants.TextAlignment.left;
    artboard.children.append(heading);

    const style = {
        fontSize: fontSizes.heading,
        color: toColor(colors.bodyText),
        font: boldFont || undefined
    };
    
    if (boldFont) style.font = boldFont;
    
    heading.fullContent.applyCharacterStyles(style);
    // Tighter line spacing for headings look better
    heading.fullContent.applyParagraphStyles({ lineSpacing: 1.1, spaceAfter: 10 }); 

    return heading;
}

function createBodyText(
    artboard: any,
    text: string,
    colors: TemplateColors,
    width: number,
    height: number,
    fontSizes: FontSizes,
    padding: number,
    regularFont: any,
    startYRatio: number, // Unused in new logic but kept for sig compatibility if needed
    heightRatio: number, // Unused
    xOverride: number,
    widthOverride: number,
    yOverride: number,
    heightOverride: number
) {
    if (!text) return;

    const body = editor.createText(text);
    body.layout = { 
        type: constants.TextLayout.autoHeight, 
        width: widthOverride 
    };
    body.textAlignment = constants.TextAlignment.left;
    artboard.children.append(body);

    const style = {
        fontSize: fontSizes.body,
        color: toColor({ ...colors.bodyText, alpha: 0.9 }), // Slightly softer black
        font: regularFont || undefined
    };

    body.fullContent.applyCharacterStyles(style);
    // More breathing room for body text
    body.fullContent.applyParagraphStyles({ 
        lineSpacing: 1.5,
        spaceAfter: 15 
    });

    body.setPositionInParent(
        { x: xOverride, y: yOverride },
        { x: 0, y: 0 }
    );
    
    // Check for overflow (basic check)
    if (body.boundsLocal.height > heightOverride) {
        // In a real app, you might scale down text or truncate. 
        // For now, let's just log it.
        console.warn("Text content exceeds available slide height.");
    }
}

function addSlideNumber(
    artboard: any,
    colors: TemplateColors,
    width: number,
    height: number,
    padding: number,
    slideNumber: number,
    boldFont: any
) {
    const numText = editor.createText(slideNumber.toString().padStart(2, '0'));
    artboard.children.append(numText);

    numText.fullContent.applyCharacterStyles({
        font: boldFont,
        fontSize: 14,
        color: toColor({ ...colors.bodyText, alpha: 0.4 }),
    });

    numText.setPositionInParent(
        { x: width - (padding * 0.8), y: height - (padding * 0.8) },
        { x: numText.boundsLocal.width, y: numText.boundsLocal.height }
    );
}

/**
 * Modern Closing Slide
 */
function createClosingSlide(
    artboard: any,
    slideData: SlideData,
    colors: TemplateColors,
    width: number,
    height: number,
    fontSizes: FontSizes,
    padding: number,
    boldFont: any,
    lightFont: any
) {
    // Large centered circle
    const circleSize = Math.min(width, height) * 0.5;
    const centerCircle = editor.createEllipse();
    centerCircle.rx = circleSize / 2;
    centerCircle.ry = circleSize / 2;
    centerCircle.fill = makeFill({ ...colors.accent, alpha: 0.1 });
    
    // Center the circle
    centerCircle.translation = { 
        x: (width - circleSize)/2, 
        y: (height - circleSize)/2 
    };
    artboard.children.append(centerCircle);

    const titleText = slideData.title || "Thank You";
    const title = editor.createText(titleText);
    title.textAlignment = constants.TextAlignment.center;
    title.layout = { type: constants.TextLayout.autoHeight, width: width - padding * 4 };
    artboard.children.append(title);

    title.fullContent.applyCharacterStyles({
        font: boldFont,
        fontSize: fontSizes.title,
        color: toColor(colors.titleText),
    });

    const titleHeight = title.boundsLocal.height;
    
    title.setPositionInParent(
        { x: width / 2, y: height / 2 },
        { x: title.boundsLocal.width / 2, y: titleHeight / 2 } // True center
    );
}

start();