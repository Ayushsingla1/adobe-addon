// Color interface
export interface ColorValue {
    red: number;
    green: number;
    blue: number;
    alpha: number;
}

// Template colors
export interface TemplateColors {
    titleBg: ColorValue;
    contentBg: ColorValue;
    closingBg: ColorValue;
    accent: ColorValue;
    titleText: ColorValue;
    bodyText: ColorValue;
    subtitleText: ColorValue;
}

// Font sizes configuration
export interface FontSizes {
    title: number;
    subtitle: number;
    heading: number;
    body: number;
}

// Presentation settings passed to the sandbox
export interface PresentationSettings {
    template: string;
    colors: TemplateColors;
    slideWidth: number;
    slideHeight: number;
    fontSizes: FontSizes;
}

// Slide data from the backend
export interface SlideData {
    type: string;
    title: string;
    content?: string;
    subtitle?: string;
    slide_number?: number;
}

// Complete presentation input
export interface PresentationInput {
    slides: SlideData[];
    settings: PresentationSettings;
}
export interface DocumentSandboxApi {
    generatePresentation(input: PresentationInput): Promise<void>;
}
