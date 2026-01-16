import addOnSandboxSdk from "add-on-sdk-document-sandbox";
import { editor, colorUtils, constants } from "express-document-sdk";

const { runtime } = addOnSandboxSdk.instance;


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

function makeFill(color: ColorValue) {
    return editor.makeColorFill({
        red: color.red,
        green: color.green,
        blue: color.blue,
        alpha: color.alpha
    });
}

function wrapText(text: string, maxCharsPerLine: number): string[] {
    const words = text.split(/\s+/);
    const lines: string[] = [];
    let currentLine = '';

    for (const word of words) {
        const testLine = currentLine ? currentLine + ' ' + word : word;
        if (testLine.length <= maxCharsPerLine) {
            currentLine = testLine;
        } else {
            if (currentLine) {
                lines.push(currentLine);
            }
            // Handle very long words
            if (word.length > maxCharsPerLine) {
                let remaining = word;
                while (remaining.length > maxCharsPerLine) {
                    lines.push(remaining.substring(0, maxCharsPerLine - 1) + '-');
                    remaining = remaining.substring(maxCharsPerLine - 1);
                }
                currentLine = remaining;
            } else {
                currentLine = word;
            }
        }
    }
    if (currentLine) {
        lines.push(currentLine);
    }
    return lines;
}

// Calculate max characters per line based on slide width and font size
function getMaxCharsPerLine(slideWidth: number, fontSize: number, padding: number): number {
    // Approximate character width as 0.5 * fontSize for most fonts
    const availableWidth = slideWidth - (padding * 2);
    const charWidth = fontSize * 0.5;
    return Math.floor(availableWidth / charWidth);
}

function start() {
    runtime.exposeApi({
        /**
         * Main function to generate a complete presentation from slide data with settings
         */
        generatePresentation: async (input: PresentationInput) => {
            const { slides, settings } = input;
            
            if (!slides || slides.length === 0) {
                console.error("No slides provided");
                return;
            }

            const { colors, slideWidth, slideHeight, fontSizes } = settings;
            const padding = Math.min(slideWidth, slideHeight) * 0.06; 

            console.log(`Generating ${slides.length} slides at ${slideWidth}x${slideHeight}`);

            // Generate each slide
            for (let i = 0; i < slides.length; i++) {
                const slideData = slides[i];
                console.log(`Creating slide ${i + 1}: ${slideData.type}`);

                try {
                    // For subsequent slides, create new pages
                    if (i > 0) {
                        editor.documentRoot.pages.addPage({
                            width: slideWidth,
                            height: slideHeight
                        });
                    }

                    const artboard = editor.context.insertionParent;

                    switch (slideData.type) {
                        case "title":
                            createTitleSlide(artboard, slideData, colors, slideWidth, slideHeight, fontSizes, padding);
                            break;
                        case "content":
                            createContentSlide(artboard, slideData, colors, slideWidth, slideHeight, fontSizes, padding, i + 1);
                            break;
                        case "closing":
                            createClosingSlide(artboard, slideData, colors, slideWidth, slideHeight, fontSizes, padding);
                            break;
                        default:
                            createContentSlide(artboard, slideData, colors, slideWidth, slideHeight, fontSizes, padding, i + 1);
                    }

                } catch (err) {
                    console.error(`Error creating slide ${i + 1}:`, err);
                }
            }

            console.log("Presentation complete!");
        },
    });
}

/**
 * Creates a title slide
 */
function createTitleSlide(
    artboard: any,
    slideData: SlideData,
    colors: TemplateColors,
    width: number,
    height: number,
    fontSizes: FontSizes,
    padding: number
) {
    // Background
    artboard.fill = makeFill(colors.titleBg);

    const accentBar = editor.createRectangle();
    accentBar.width = width;
    accentBar.height = Math.max(8, height * 0.01);
    accentBar.translation = { x: 0, y: height - accentBar.height };
    accentBar.fill = makeFill(colors.accent);
    artboard.children.append(accentBar);

    // Decorative circle (top right)
    const circle1 = editor.createEllipse();
    const circleSize = Math.min(width, height) * 0.15;
    circle1.rx = circleSize;
    circle1.ry = circleSize;
    circle1.translation = { x: width - circleSize * 0.5, y: -circleSize * 0.5 };
    circle1.fill = makeFill({ ...colors.accent, alpha: 0.15 });
    artboard.children.append(circle1);

    // Decorative circle (bottom left)
    const circle2 = editor.createEllipse();
    const circleSize2 = Math.min(width, height) * 0.1;
    circle2.rx = circleSize2;
    circle2.ry = circleSize2;
    circle2.translation = { x: padding, y: height - padding - circleSize2 * 2 };
    circle2.fill = makeFill({ ...colors.titleText, alpha: 0.08 });
    artboard.children.append(circle2);

    // Title text
    const titleText = slideData.title || "Presentation";
    const maxTitleChars = getMaxCharsPerLine(width, fontSizes.title, padding * 1.5);
    const titleLines = wrapText(titleText, maxTitleChars);
    const displayTitle = titleLines.slice(0, 3).join('\n'); // Max 3 lines for title

    const title = editor.createText(displayTitle);
    title.textAlignment = constants.TextAlignment.center;
    
    // Position title in center-upper area
    const titleY = height * 0.35;
    artboard.children.append(title);
    
    // Center the title
    title.setPositionInParent(
        { x: width / 2, y: titleY },
        { x: title.boundsLocal.width / 2, y: 0 }
    );

    // Subtitle if available
    if (slideData.subtitle) {
        const maxSubtitleChars = getMaxCharsPerLine(width, fontSizes.subtitle, padding * 2);
        const subtitleLines = wrapText(slideData.subtitle, maxSubtitleChars);
        const displaySubtitle = subtitleLines.slice(0, 4).join('\n'); // Max 4 lines

        const subtitle = editor.createText(displaySubtitle);
        subtitle.textAlignment = constants.TextAlignment.center;
        artboard.children.append(subtitle);
        
        // Position below title
        const subtitleY = height * 0.55;
        subtitle.setPositionInParent(
            { x: width / 2, y: subtitleY },
            { x: subtitle.boundsLocal.width / 2, y: 0 }
        );
    }
}

/**
 * Creates a content slide
 */
function createContentSlide(
    artboard: any,
    slideData: SlideData,
    colors: TemplateColors,
    width: number,
    height: number,
    fontSizes: FontSizes,
    padding: number,
    slideNumber: number
) {
    // Background
    artboard.fill = makeFill(colors.contentBg);

    // Top accent bar
    const accentBar = editor.createRectangle();
    accentBar.width = width;
    accentBar.height = Math.max(6, height * 0.008);
    accentBar.translation = { x: 0, y: 0 };
    accentBar.fill = makeFill(colors.accent);
    artboard.children.append(accentBar);

    // Left accent stripe
    const leftStripe = editor.createRectangle();
    leftStripe.width = Math.max(4, width * 0.004);
    leftStripe.height = height * 0.6;
    leftStripe.translation = { x: padding * 0.5, y: height * 0.15 };
    leftStripe.fill = makeFill({ ...colors.accent, alpha: 0.3 });
    artboard.children.append(leftStripe);

    // Slide heading
    const headingText = slideData.title || "Content";
    const maxHeadingChars = getMaxCharsPerLine(width, fontSizes.heading, padding * 2);
    const headingLines = wrapText(headingText, maxHeadingChars);
    const displayHeading = headingLines.slice(0, 2).join('\n'); // Max 2 lines for heading

    const heading = editor.createText(displayHeading);
    heading.textAlignment = constants.TextAlignment.left;
    artboard.children.append(heading);
    
    const headingY = height * 0.12;
    heading.setPositionInParent(
        { x: padding, y: headingY },
        { x: 0, y: 0 }
    );

    // Content body
    if (slideData.content) {
        const maxBodyChars = getMaxCharsPerLine(width, fontSizes.body, padding * 2);
        const bodyLines = wrapText(slideData.content, maxBodyChars);
        
        // Calculate max lines that fit
        const lineHeight = fontSizes.body * 1.8;
        const availableHeight = height * 0.55;
        const maxLines = Math.floor(availableHeight / lineHeight);
        
        const displayBody = bodyLines.slice(0, maxLines).join('\n');

        const body = editor.createText(displayBody);
        body.textAlignment = constants.TextAlignment.left;
        artboard.children.append(body);
        
        const bodyY = height * 0.28;
        body.setPositionInParent(
            { x: padding, y: bodyY },
            { x: 0, y: 0 }
        );
    }

    // Slide number indicator
    const numberBg = editor.createRectangle();
    const numberSize = Math.min(width, height) * 0.04;
    numberBg.width = numberSize;
    numberBg.height = numberSize;
    numberBg.translation = { x: width - padding - numberSize, y: height - padding - numberSize };
    numberBg.fill = makeFill(colors.accent);
    artboard.children.append(numberBg);

    const numberText = editor.createText(slideNumber.toString());
    numberText.textAlignment = constants.TextAlignment.center;
    artboard.children.append(numberText);
    numberText.setPositionInParent(
        { x: width - padding - numberSize / 2, y: height - padding - numberSize + numberSize * 0.25 },
        { x: numberText.boundsLocal.width / 2, y: 0 }
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
    padding: number
) {
    // Background
    artboard.fill = makeFill(colors.closingBg);

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

    // Large decorative circles
    const circle1 = editor.createEllipse();
    const size1 = Math.min(width, height) * 0.25;
    circle1.rx = size1;
    circle1.ry = size1;
    circle1.translation = { x: -size1 * 0.3, y: height - size1 * 1.2 };
    circle1.fill = makeFill({ ...colors.titleText, alpha: 0.05 });
    artboard.children.append(circle1);

    const circle2 = editor.createEllipse();
    const size2 = Math.min(width, height) * 0.18;
    circle2.rx = size2;
    circle2.ry = size2;
    circle2.translation = { x: width - size2 * 1.5, y: size2 * 0.3 };
    circle2.fill = makeFill({ ...colors.accent, alpha: 0.2 });
    artboard.children.append(circle2);

    // Main title (Thank You)
    const titleText = slideData.title || "Thank You!";
    const title = editor.createText(titleText);
    title.textAlignment = constants.TextAlignment.center;
    artboard.children.append(title);
    
    title.setPositionInParent(
        { x: width / 2, y: height * 0.4 },
        { x: title.boundsLocal.width / 2, y: 0 }
    );

    // Footer/source text
    if (slideData.content) {
        const maxFooterChars = getMaxCharsPerLine(width, fontSizes.body * 0.8, padding * 3);
        const footerLines = wrapText(slideData.content, maxFooterChars);
        const displayFooter = footerLines.slice(0, 2).join('\n');

        const footer = editor.createText(displayFooter);
        footer.textAlignment = constants.TextAlignment.center;
        artboard.children.append(footer);
        
        footer.setPositionInParent(
            { x: width / 2, y: height * 0.75 },
            { x: footer.boundsLocal.width / 2, y: 0 }
        );
    }
}

start();
