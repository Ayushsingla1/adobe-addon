import addOnSandboxSdk from "add-on-sdk-document-sandbox";
import { editor, colorUtils, constants, fonts } from "express-document-sdk";

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

// Convert ColorValue to Color object
function toColor(c: ColorValue) {
    return colorUtils.fromRGB(c.red, c.green, c.blue, c.alpha);
}

// Create a fill from color
function makeFill(c: ColorValue) {
    return editor.makeColorFill(toColor(c));
}

// Create a stroke from color
function makeStroke(c: ColorValue, width: number, dashPattern?: number[]) {
    return editor.makeStroke({
        color: toColor(c),
        width: width,
        dashPattern: dashPattern || [],
    });
}

// Wrap text to fit within max characters per line
function wrapText(text: string, maxChars: number): string[] {
    const words = text.split(/\s+/);
    const lines: string[] = [];
    let currentLine = '';

    for (const word of words) {
        const testLine = currentLine ? currentLine + ' ' + word : word;
        if (testLine.length <= maxChars) {
            currentLine = testLine;
        } else {
            if (currentLine) lines.push(currentLine);
            if (word.length > maxChars) {
                let remaining = word;
                while (remaining.length > maxChars) {
                    lines.push(remaining.substring(0, maxChars - 1) + '-');
                    remaining = remaining.substring(maxChars - 1);
                }
                currentLine = remaining;
            } else {
                currentLine = word;
            }
        }
    }
    if (currentLine) lines.push(currentLine);
    return lines;
}

// Calculate chars per line based on width and font size
function getCharsPerLine(width: number, fontSize: number, padding: number): number {
    const availableWidth = width - (padding * 2);
    return Math.floor(availableWidth / (fontSize * 0.55));
}

// Create rounded rectangle using path
function createRoundedRect(x: number, y: number, w: number, h: number, r: number) {
    // Ensure radius doesn't exceed half of width or height
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

// Create a wave/curve decoration
function createWavePath(startX: number, startY: number, width: number, amplitude: number) {
    const segments = 4;
    const segmentWidth = width / segments;
    let path = `M ${startX},${startY}`;
    
    for (let i = 0; i < segments; i++) {
        const x1 = startX + (i * segmentWidth) + (segmentWidth / 2);
        const y1 = startY + (i % 2 === 0 ? -amplitude : amplitude);
        const x2 = startX + ((i + 1) * segmentWidth);
        const y2 = startY;
        path += ` Q ${x1},${y1} ${x2},${y2}`;
    }
    
    return editor.createPath(path);
}

// Create diagonal stripes pattern element
function createDiagonalStripe(x: number, y: number, length: number, angle: number = 45) {
    const rad = (angle * Math.PI) / 180;
    const endX = x + Math.cos(rad) * length;
    const endY = y + Math.sin(rad) * length;
    
    const line = editor.createLine();
    line.setEndPoints(x, y, endX, endY);
    return line;
}

function start() {
    runtime.exposeApi({
        generatePresentation: async (input: PresentationInput) => {
            const { slides, settings } = input;
            
            if (!slides || slides.length === 0) {
                console.error("No slides provided");
                return;
            }

            const { colors, slideWidth, slideHeight, fontSizes } = settings;
            const padding = Math.min(slideWidth, slideHeight) * 0.07;

            console.log(`Generating ${slides.length} slides at ${slideWidth}x${slideHeight}`);

            // Load fonts
            const boldFont = await fonts.fromPostscriptName("SourceSans3-Bold");
            const regularFont = await fonts.fromPostscriptName("SourceSans3-Regular");
            const lightFont = await fonts.fromPostscriptName("SourceSans3-Light");

            // Generate slides
            for (let i = 0; i < slides.length; i++) {
                const slideData = slides[i];
                console.log(`Creating slide ${i + 1}: ${slideData.type}`);

                try {
                    // Use queueAsyncEdit for all edits (required after async font loading)
                    await editor.queueAsyncEdit(() => {
                        if (i === 0) {
                            // Ensure the first page matches the requested size
                            const currentPage = editor.context.currentPage;
                            currentPage.width = slideWidth;
                            currentPage.height = slideHeight;
                        } else {
                            editor.documentRoot.pages.addPage({
                                width: slideWidth,
                                height: slideHeight
                            });
                        }

                        const currentPage = editor.context.currentPage;
                        const artboard = currentPage.artboards.first ?? editor.context.insertionParent;

                        switch (slideData.type) {
                            case "title":
                                createTitleSlide(artboard, slideData, colors, slideWidth, slideHeight, fontSizes, padding, boldFont, lightFont);
                                break;
                            case "content":
                                createContentSlide(artboard, slideData, colors, slideWidth, slideHeight, fontSizes, padding, i + 1, boldFont, regularFont);
                                break;
                            case "closing":
                                createClosingSlide(artboard, slideData, colors, slideWidth, slideHeight, fontSizes, padding, boldFont, lightFont);
                                break;
                            default:
                                createContentSlide(artboard, slideData, colors, slideWidth, slideHeight, fontSizes, padding, i + 1, boldFont, regularFont);
                        }
                    });

                } catch (err) {
                    console.error(`Error creating slide ${i + 1}:`, err);
                }
            }

            console.log("Presentation complete!");
        },
    });
}

/**
 * Creates an elegant title slide
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
    lightFont: any
) {
    // Background
    artboard.fill = makeFill(colors.titleBg);

    // Large decorative circle (top right, partially off-screen)
    const bigCircle = editor.createEllipse();
    const bigSize = Math.min(width, height) * 0.4;
    bigCircle.rx = bigSize;
    bigCircle.ry = bigSize;
    bigCircle.translation = { x: width - bigSize * 0.3, y: -bigSize * 0.5 };
    bigCircle.fill = makeFill({ ...colors.accent, alpha: 0.12 });
    artboard.children.append(bigCircle);

    // Medium decorative circle (bottom left)
    const medCircle = editor.createEllipse();
    const medSize = Math.min(width, height) * 0.25;
    medCircle.rx = medSize;
    medCircle.ry = medSize;
    medCircle.translation = { x: -medSize * 0.4, y: height - medSize * 1.3 };
    medCircle.fill = makeFill({ ...colors.titleText, alpha: 0.06 });
    artboard.children.append(medCircle);

    // Small accent circle
    const smallCircle = editor.createEllipse();
    const smallSize = Math.min(width, height) * 0.08;
    smallCircle.rx = smallSize;
    smallCircle.ry = smallSize;
    smallCircle.translation = { x: width * 0.75, y: height * 0.65 };
    smallCircle.fill = makeFill({ ...colors.accent, alpha: 0.25 });
    artboard.children.append(smallCircle);

    // Accent bar at bottom
    const accentBar = editor.createRectangle();
    accentBar.width = width * 0.3;
    accentBar.height = Math.max(6, height * 0.008);
    accentBar.translation = { x: (width - accentBar.width) / 2, y: height - padding * 1.5 };
    accentBar.fill = makeFill(colors.accent);
    artboard.children.append(accentBar);

    // Vertical accent line (left side)
    const leftLine = editor.createRectangle();
    leftLine.width = Math.max(4, width * 0.004);
    leftLine.height = height * 0.4;
    leftLine.translation = { x: padding * 0.6, y: height * 0.3 };
    leftLine.fill = makeFill({ ...colors.accent, alpha: 0.4 });
    artboard.children.append(leftLine);

    // Title text
    const titleText = slideData.title || "Presentation";
    const maxTitleChars = getCharsPerLine(width, fontSizes.title, padding * 2);
    const titleLines = wrapText(titleText, maxTitleChars);
    const displayTitle = titleLines.slice(0, 3).join('\n');

    const title = editor.createText(displayTitle);
    title.textAlignment = constants.TextAlignment.center;
    title.layout = { type: constants.TextLayout.autoHeight, width: width - padding * 2 };
    artboard.children.append(title);

    // Style the title
    if (boldFont) {
        title.fullContent.applyCharacterStyles({
            font: boldFont,
            fontSize: fontSizes.title,
            color: toColor(colors.titleText),
        });
    } else {
        title.fullContent.applyCharacterStyles({
            fontSize: fontSizes.title,
            color: toColor(colors.titleText),
        });
    }

    // Position title
    const titleY = height * 0.32;
    title.setPositionInParent(
        { x: width / 2, y: titleY },
        { x: title.boundsLocal.width / 2, y: 0 }
    );

    // Subtitle
    if (slideData.subtitle) {
        const maxSubChars = getCharsPerLine(width, fontSizes.subtitle, padding * 3);
        const subLines = wrapText(slideData.subtitle, maxSubChars);
        const displaySub = subLines.slice(0, 4).join('\n');

        const subtitle = editor.createText(displaySub);
        subtitle.textAlignment = constants.TextAlignment.center;
        subtitle.layout = { type: constants.TextLayout.autoHeight, width: width - padding * 2.5 };
        artboard.children.append(subtitle);

        if (lightFont) {
            subtitle.fullContent.applyCharacterStyles({
                font: lightFont,
                fontSize: fontSizes.subtitle,
                color: toColor(colors.subtitleText),
            });
        } else {
            subtitle.fullContent.applyCharacterStyles({
                fontSize: fontSizes.subtitle,
                color: toColor(colors.subtitleText),
            });
        }

        subtitle.setPositionInParent(
            { x: width / 2, y: height * 0.55 },
            { x: subtitle.boundsLocal.width / 2, y: 0 }
        );
    }

    // Decorative dots row
    const dotSpacing = width * 0.03;
    const dotSize = Math.max(4, width * 0.006);
    const dotsStartX = (width - (dotSpacing * 4)) / 2;
    
    for (let i = 0; i < 5; i++) {
        const dot = editor.createEllipse();
        dot.rx = dotSize;
        dot.ry = dotSize;
        dot.translation = { x: dotsStartX + (i * dotSpacing), y: height * 0.72 };
        dot.fill = makeFill({ ...colors.accent, alpha: i === 2 ? 1 : 0.3 });
        artboard.children.append(dot);
    }
}

/**
 * Creates a content slide with better layout
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
    regularFont: any
) {
    const layoutVariant = slideNumber % 3;
    if (layoutVariant === 1) {
        createContentLayoutClassic(artboard, slideData, colors, width, height, fontSizes, padding, slideNumber, boldFont, regularFont);
    } else if (layoutVariant === 2) {
        createContentLayoutSplit(artboard, slideData, colors, width, height, fontSizes, padding, slideNumber, boldFont, regularFont);
    } else {
        createContentLayoutCard(artboard, slideData, colors, width, height, fontSizes, padding, slideNumber, boldFont, regularFont);
    }
}

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
    // Background
    artboard.fill = makeFill(colors.contentBg);

    // Top accent bar (full width)
    const topBar = editor.createRectangle();
    topBar.width = width;
    topBar.height = Math.max(8, height * 0.012);
    topBar.translation = { x: 0, y: 0 };
    topBar.fill = makeFill(colors.accent);
    artboard.children.append(topBar);

    // Left sidebar accent
    const sidebar = editor.createRectangle();
    sidebar.width = Math.max(6, width * 0.006);
    sidebar.height = height * 0.5;
    sidebar.translation = { x: padding * 0.4, y: height * 0.2 };
    sidebar.fill = makeFill({ ...colors.accent, alpha: 0.6 });
    artboard.children.append(sidebar);

    // Corner accent (top right)
    const cornerSize = Math.min(width, height) * 0.08;
    const corner = editor.createRectangle();
    corner.width = cornerSize;
    corner.height = cornerSize;
    corner.translation = { x: width - cornerSize - padding * 0.5, y: padding * 0.5 + topBar.height };
    corner.fill = makeFill({ ...colors.accent, alpha: 0.08 });
    artboard.children.append(corner);

    // Small decorative circle (bottom right)
    const decoCircle = editor.createEllipse();
    const circleSize = Math.min(width, height) * 0.12;
    decoCircle.rx = circleSize;
    decoCircle.ry = circleSize;
    decoCircle.translation = { x: width - circleSize * 1.5, y: height - circleSize * 1.5 };
    decoCircle.fill = makeFill({ ...colors.accent, alpha: 0.05 });
    artboard.children.append(decoCircle);

    const heading = createHeadingText(artboard, slideData.title || "Content", colors, width, height, fontSizes, padding, boldFont);
    const headingBottom = height * 0.12 + heading.boundsLocal.height;
    const bodyStartY = headingBottom + padding * 0.5;
    const bodyAvailableH = Math.max(height * 0.25, height - bodyStartY - padding * 0.9);

    // Underline for heading
    const headingUnderline = editor.createRectangle();
    headingUnderline.width = Math.min(heading.boundsLocal.width * 0.4, width * 0.15);
    headingUnderline.height = Math.max(3, height * 0.004);
    headingUnderline.translation = { x: padding * 1.2, y: height * 0.12 + heading.boundsLocal.height + 8 };
    headingUnderline.fill = makeFill(colors.accent);
    artboard.children.append(headingUnderline);

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
        0.28,
        0.52,
        undefined,
        undefined,
        bodyStartY,
        bodyAvailableH
    );

    addSlideNumber(artboard, colors, width, height, padding, slideNumber, boldFont);

    // Bottom decorative line
    const bottomLine = editor.createRectangle();
    bottomLine.width = width * 0.15;
    bottomLine.height = Math.max(2, height * 0.003);
    bottomLine.translation = { x: padding, y: height - padding * 0.6 };
    bottomLine.fill = makeFill({ ...colors.accent, alpha: 0.3 });
    artboard.children.append(bottomLine);
}

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
    // Background
    artboard.fill = makeFill(colors.contentBg);

    // Left color panel
    const panelWidth = width * 0.35;
    const panel = editor.createRectangle();
    panel.width = panelWidth;
    panel.height = height;
    panel.translation = { x: 0, y: 0 };
    panel.fill = makeFill({ ...colors.accent, alpha: 0.15 });
    artboard.children.append(panel);

    // Accent stripe
    const stripe = editor.createRectangle();
    stripe.width = Math.max(6, width * 0.006);
    stripe.height = height;
    stripe.translation = { x: panelWidth - stripe.width, y: 0 };
    stripe.fill = makeFill(colors.accent);
    artboard.children.append(stripe);

    // Title in left panel
    const headingText = slideData.title || "Content";
    const maxHeadingChars = getCharsPerLine(panelWidth, fontSizes.heading, padding * 1.2);
    const headingLines = wrapText(headingText, maxHeadingChars);
    const displayHeading = headingLines.slice(0, 3).join('\n');

    const heading = editor.createText(displayHeading);
    heading.textAlignment = constants.TextAlignment.left;
    heading.layout = { type: constants.TextLayout.autoHeight, width: panelWidth - padding * 1.2 };
    artboard.children.append(heading);

    if (boldFont) {
        heading.fullContent.applyCharacterStyles({
            font: boldFont,
            fontSize: fontSizes.heading,
            color: toColor(colors.bodyText),
        });
    } else {
        heading.fullContent.applyCharacterStyles({
            fontSize: fontSizes.heading,
            color: toColor(colors.bodyText),
        });
    }

    const headingY = height * 0.18;
    heading.setPositionInParent(
        { x: padding * 0.8, y: headingY },
        { x: 0, y: 0 }
    );

    // Body on right side
    const splitBodyY = headingY + heading.boundsLocal.height + padding * 0.6;
    const splitBodyH = Math.max(height * 0.3, height - splitBodyY - padding * 0.9);
    createBodyText(
        artboard,
        slideData.content || "",
        colors,
        width,
        height,
        fontSizes,
        padding,
        regularFont,
        0.18,
        0.64,
        panelWidth + padding * 0.6,
        width - panelWidth - padding * 1.2,
        splitBodyY,
        splitBodyH
    );

    // Decorative circle near bottom
    const decoCircle = editor.createEllipse();
    const circleSize = Math.min(width, height) * 0.12;
    decoCircle.rx = circleSize;
    decoCircle.ry = circleSize;
    decoCircle.translation = { x: panelWidth - circleSize * 0.5, y: height - circleSize * 1.2 };
    decoCircle.fill = makeFill({ ...colors.accent, alpha: 0.2 });
    artboard.children.append(decoCircle);

    addSlideNumber(artboard, colors, width, height, padding, slideNumber, boldFont);
}

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
    // Background
    artboard.fill = makeFill(colors.contentBg);

    // Top accent wave
    const wave = createWavePath(0, height * 0.12, width, height * 0.04);
    wave.stroke = makeStroke({ ...colors.accent, alpha: 0.6 }, Math.max(3, height * 0.004));
    artboard.children.append(wave);

    // Card container
    const cardX = padding * 0.8;
    const cardY = height * 0.18;
    const cardW = width - padding * 1.6;
    const cardH = height * 0.65;
    const cardRadius = Math.min(width, height) * 0.02;
    const card = createRoundedRect(cardX, cardY, cardW, cardH, cardRadius);
    card.fill = makeFill({ ...colors.titleText, alpha: 0.98 });
    card.stroke = makeStroke({ ...colors.accent, alpha: 0.15 }, 2);
    artboard.children.append(card);

    // Accent bar inside card
    const cardBar = editor.createRectangle();
    cardBar.width = cardW * 0.2;
    cardBar.height = Math.max(4, height * 0.005);
    cardBar.translation = { x: cardX + padding * 0.4, y: cardY + padding * 0.3 };
    cardBar.fill = makeFill(colors.accent);
    artboard.children.append(cardBar);

    // Heading inside card
    const headingText = slideData.title || "Content";
    const cardHeadingY = cardY + padding * 0.6;
    const heading = createHeadingText(artboard, headingText, colors, width, height, fontSizes, padding, boldFont, cardX + padding * 0.4, cardHeadingY, cardW - padding * 0.8);
    const cardBodyY = cardHeadingY + heading.boundsLocal.height + padding * 0.5;
    const cardBodyH = Math.max(cardH * 0.4, cardY + cardH - cardBodyY - padding * 0.4);

    // Body inside card
    createBodyText(
        artboard,
        slideData.content || "",
        colors,
        width,
        height,
        fontSizes,
        padding,
        regularFont,
        0.0,
        0.0,
        cardX + padding * 0.4,
        cardW - padding * 0.8,
        cardBodyY,
        cardBodyH
    );

    // Diagonal accent stripes
    for (let i = 0; i < 4; i++) {
        const stripe = createDiagonalStripe(
            width - padding * 0.8 - i * 16,
            height * 0.08 + i * 6,
            40,
            45
        );
        stripe.stroke = makeStroke({ ...colors.accent, alpha: 0.5 }, 3);
        artboard.children.append(stripe);
    }

    addSlideNumber(artboard, colors, width, height, padding, slideNumber, boldFont);
}

function createHeadingText(
    artboard: any,
    text: string,
    colors: TemplateColors,
    width: number,
    height: number,
    fontSizes: FontSizes,
    padding: number,
    boldFont: any,
    x?: number,
    y?: number,
    maxWidth?: number
) {
    const maxHeadingChars = getCharsPerLine(maxWidth ?? width, fontSizes.heading, padding * 2.5);
    const headingLines = wrapText(text, maxHeadingChars);
    const displayHeading = headingLines.slice(0, 2).join('\n');

    const heading = editor.createText(displayHeading);
    heading.textAlignment = constants.TextAlignment.left;
    heading.layout = { type: constants.TextLayout.autoHeight, width: (maxWidth ?? width) - padding * 0.4 };
    artboard.children.append(heading);

    if (boldFont) {
        heading.fullContent.applyCharacterStyles({
            font: boldFont,
            fontSize: fontSizes.heading,
            color: toColor(colors.bodyText),
        });
    } else {
        heading.fullContent.applyCharacterStyles({
            fontSize: fontSizes.heading,
            color: toColor(colors.bodyText),
        });
    }

    heading.setPositionInParent(
        { x: x ?? padding * 1.2, y: y ?? height * 0.12 },
        { x: 0, y: 0 }
    );
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
    startYRatio: number,
    heightRatio: number,
    xOverride?: number,
    widthOverride?: number,
    yOverride?: number,
    heightOverride?: number
) {
    if (!text) return;
    const contentWidth = widthOverride ?? (width - padding * 2.4);
    const maxBodyChars = getCharsPerLine(contentWidth, fontSizes.body, padding * 1.2);
    const bodyLines = wrapText(text, maxBodyChars);
    const lineHeight = fontSizes.body * 1.8;
    const availableHeight = heightOverride ?? (height * heightRatio);
    const maxLines = Math.max(1, Math.floor(availableHeight / lineHeight));
    const displayBody = bodyLines.slice(0, maxLines).join('\n');

    const body = editor.createText(displayBody);
    body.textAlignment = constants.TextAlignment.left;
    body.layout = { type: constants.TextLayout.autoHeight, width: contentWidth };
    artboard.children.append(body);

    if (regularFont) {
        body.fullContent.applyCharacterStyles({
            font: regularFont,
            fontSize: fontSizes.body,
            color: toColor({ ...colors.bodyText, alpha: 0.85 }),
        });
    } else {
        body.fullContent.applyCharacterStyles({
            fontSize: fontSizes.body,
            color: toColor({ ...colors.bodyText, alpha: 0.85 }),
        });
    }

    body.fullContent.applyParagraphStyles({
        lineSpacing: 1.6,
        spaceAfter: 8,
    });

    const bodyY = yOverride ?? (height * startYRatio);
    body.setPositionInParent(
        { x: xOverride ?? padding * 1.2, y: bodyY },
        { x: 0, y: 0 }
    );
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
    const numBgSize = Math.min(width, height) * 0.05;
    const numBg = editor.createEllipse();
    numBg.rx = numBgSize;
    numBg.ry = numBgSize;
    numBg.translation = { x: width - padding - numBgSize, y: height - padding - numBgSize };
    numBg.fill = makeFill(colors.accent);
    artboard.children.append(numBg);

    const numText = editor.createText(slideNumber.toString());
    numText.textAlignment = constants.TextAlignment.center;
    artboard.children.append(numText);

    if (boldFont) {
        numText.fullContent.applyCharacterStyles({
            font: boldFont,
            fontSize: numBgSize * 0.8,
            color: toColor(colors.titleText),
        });
    }

    numText.setPositionInParent(
        { x: width - padding, y: height - padding - numBgSize * 0.3 },
        { x: numText.boundsLocal.width / 2, y: numText.boundsLocal.height / 2 }
    );
}

/**
 * Creates a closing/thank you slide
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
    // Background
    artboard.fill = makeFill(colors.closingBg);

    // Large decorative circle (center, behind text)
    const bgCircle = editor.createEllipse();
    const bgSize = Math.min(width, height) * 0.35;
    bgCircle.rx = bgSize;
    bgCircle.ry = bgSize;
    bgCircle.translation = { x: (width - bgSize * 2) / 2, y: (height - bgSize * 2) / 2 - height * 0.05 };
    bgCircle.fill = makeFill({ ...colors.accent, alpha: 0.1 });
    artboard.children.append(bgCircle);

    // Second decorative circle
    const bgCircle2 = editor.createEllipse();
    const bgSize2 = Math.min(width, height) * 0.28;
    bgCircle2.rx = bgSize2;
    bgCircle2.ry = bgSize2;
    bgCircle2.translation = { x: (width - bgSize2 * 2) / 2, y: (height - bgSize2 * 2) / 2 - height * 0.05 };
    bgCircle2.fill = makeFill({ ...colors.titleText, alpha: 0.05 });
    artboard.children.append(bgCircle2);

    // Top and bottom accent bars
    const topBar = editor.createRectangle();
    topBar.width = width;
    topBar.height = Math.max(6, height * 0.008);
    topBar.translation = { x: 0, y: 0 };
    topBar.fill = makeFill(colors.accent);
    artboard.children.append(topBar);

    const bottomBar = editor.createRectangle();
    bottomBar.width = width;
    bottomBar.height = Math.max(6, height * 0.008);
    bottomBar.translation = { x: 0, y: height - bottomBar.height };
    bottomBar.fill = makeFill(colors.accent);
    artboard.children.append(bottomBar);

    // Corner decorations
    const cornerSize = Math.min(width, height) * 0.06;
    
    // Top-left corner
    const tlCorner = editor.createRectangle();
    tlCorner.width = cornerSize;
    tlCorner.height = cornerSize;
    tlCorner.translation = { x: padding * 0.5, y: padding * 0.5 + topBar.height };
    tlCorner.fill = makeFill({ ...colors.titleText, alpha: 0.08 });
    artboard.children.append(tlCorner);

    // Bottom-right corner
    const brCorner = editor.createRectangle();
    brCorner.width = cornerSize;
    brCorner.height = cornerSize;
    brCorner.translation = { x: width - padding * 0.5 - cornerSize, y: height - padding * 0.5 - cornerSize - bottomBar.height };
    brCorner.fill = makeFill({ ...colors.titleText, alpha: 0.08 });
    artboard.children.append(brCorner);

    // Main title
    const titleText = slideData.title || "Thank You!";
    
    const title = editor.createText(titleText);
    title.textAlignment = constants.TextAlignment.center;
    title.layout = { type: constants.TextLayout.autoHeight, width: width - padding * 2 };
    artboard.children.append(title);

    if (boldFont) {
        title.fullContent.applyCharacterStyles({
            font: boldFont,
            fontSize: fontSizes.title * 1.1,
            color: toColor(colors.titleText),
        });
    } else {
        title.fullContent.applyCharacterStyles({
            fontSize: fontSizes.title * 1.1,
            color: toColor(colors.titleText),
        });
    }

    title.setPositionInParent(
        { x: width / 2, y: height * 0.38 },
        { x: title.boundsLocal.width / 2, y: 0 }
    );

    // Decorative line under title
    const titleLine = editor.createRectangle();
    titleLine.width = width * 0.2;
    titleLine.height = Math.max(4, height * 0.005);
    titleLine.translation = { x: (width - titleLine.width) / 2, y: height * 0.38 + title.boundsLocal.height + 20 };
    titleLine.fill = makeFill(colors.accent);
    artboard.children.append(titleLine);

    // Footer text
    if (slideData.content) {
        const maxFooterChars = getCharsPerLine(width, fontSizes.body * 0.75, padding * 4);
        const footerLines = wrapText(slideData.content, maxFooterChars);
        const displayFooter = footerLines.slice(0, 2).join('\n');

        const footer = editor.createText(displayFooter);
        footer.textAlignment = constants.TextAlignment.center;
        footer.layout = { type: constants.TextLayout.autoHeight, width: width - padding * 3 };
        artboard.children.append(footer);

        if (lightFont) {
            footer.fullContent.applyCharacterStyles({
                font: lightFont,
                fontSize: fontSizes.body * 0.75,
                color: toColor({ ...colors.subtitleText, alpha: 0.7 }),
            });
        } else {
            footer.fullContent.applyCharacterStyles({
                fontSize: fontSizes.body * 0.75,
                color: toColor({ ...colors.subtitleText, alpha: 0.7 }),
            });
        }

        footer.setPositionInParent(
            { x: width / 2, y: height * 0.78 },
            { x: footer.boundsLocal.width / 2, y: 0 }
        );
    }

    // Decorative dots
    const dotSpacing = width * 0.025;
    const dotSize = Math.max(3, width * 0.005);
    const dotsStartX = (width - (dotSpacing * 6)) / 2;
    
    for (let i = 0; i < 7; i++) {
        const dot = editor.createEllipse();
        dot.rx = dotSize;
        dot.ry = dotSize;
        dot.translation = { x: dotsStartX + (i * dotSpacing), y: height * 0.62 };
        dot.fill = makeFill({ ...colors.accent, alpha: i === 3 ? 1 : 0.25 });
        artboard.children.append(dot);
    }
}

start();
