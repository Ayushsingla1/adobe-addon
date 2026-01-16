import os
import textwrap
from PIL import Image, ImageDraw, ImageFont
from moviepy import *
import numpy as np

def to_rgb(color_dict):
    """Convert color dict {red, green, blue} (0-1 range) to RGB tuple (0-255)."""
    return (
        int(color_dict.get('red', 0) * 255),
        int(color_dict.get('green', 0) * 255),
        int(color_dict.get('blue', 0) * 255)
    )

def draw_rounded_rectangle(draw, coords, radius, fill):
    """Draw a rounded rectangle."""
    x1, y1, x2, y2 = coords
    draw.rectangle([x1 + radius, y1, x2 - radius, y2], fill=fill)
    draw.rectangle([x1, y1 + radius, x2, y2 - radius], fill=fill)
    draw.ellipse([x1, y1, x1 + 2*radius, y1 + 2*radius], fill=fill)
    draw.ellipse([x2 - 2*radius, y1, x2, y1 + 2*radius], fill=fill)
    draw.ellipse([x1, y2 - 2*radius, x1 + 2*radius, y2], fill=fill)
    draw.ellipse([x2 - 2*radius, y2 - 2*radius, x2, y2], fill=fill)

def draw_decorative_shapes(draw, width, height, accent_color, template_name):
    """Draw decorative background shapes based on template."""
    accent_light = tuple(min(255, c + 40) for c in accent_color)
    
    if template_name in ['modern', 'vibrant', 'sunset']:
        # Corner accent circles
        draw.ellipse([-50, -50, 150, 150], fill=accent_light + (80,))
        draw.ellipse([width-150, height-150, width+50, height+50], fill=accent_light + (80,))
    elif template_name == 'nature':
        # Organic blob shapes
        draw.ellipse([width-200, -100, width+100, 200], fill=accent_light + (60,))
        draw.ellipse([-100, height-200, 200, height+100], fill=accent_light + (60,))
    elif template_name == 'glass':
        # Glassmorphism blobs
        draw.ellipse([-100, -100, 300, 300], fill=(255, 100, 150, 40))
        draw.ellipse([width-300, height-300, width+100, height+100], fill=(100, 150, 255, 40))

def get_font(size, bold=False):
    """Try to load a good font, fallback to default."""
    font_paths = [
        "/System/Library/Fonts/Helvetica.ttc",
        "/System/Library/Fonts/SFNSDisplay.ttf", 
        "/System/Library/Fonts/SFNS.ttf",
        "/Library/Fonts/Arial.ttf",
        "Arial.ttf",
    ]
    for path in font_paths:
        try:
            return ImageFont.truetype(path, size=size)
        except:
            continue
    return ImageFont.load_default(size=size)

def create_title_slide(slide, width, height, colors, template_name):
    """Create a title slide image."""
    bg_color = to_rgb(colors.get('titleBg', {'red': 0.1, 'green': 0.1, 'blue': 0.15}))
    text_color = to_rgb(colors.get('titleText', {'red': 1, 'green': 1, 'blue': 1}))
    accent_color = to_rgb(colors.get('accent', {'red': 0.4, 'green': 0.4, 'blue': 1}))
    
    # Create image with alpha for decorations
    img = Image.new('RGBA', (width, height), color=bg_color + (255,))
    draw = ImageDraw.Draw(img)
    
    # Draw decorative elements
    draw_decorative_shapes(draw, width, height, accent_color, template_name)
    
    # Fonts
    title_font = get_font(int(height * 0.08))
    
    # Title text - centered
    title = slide.get('title', 'Presentation')
    
    # Word wrap if needed
    max_chars = 30
    if len(title) > max_chars:
        words = title.split()
        lines = []
        current = ""
        for word in words:
            if len(current + " " + word) <= max_chars:
                current = (current + " " + word).strip()
            else:
                if current:
                    lines.append(current)
                current = word
        if current:
            lines.append(current)
    else:
        lines = [title]
    
    total_height = len(lines) * (height * 0.1)
    start_y = (height - total_height) / 2
    
    for i, line in enumerate(lines):
        bbox = draw.textbbox((0, 0), line, font=title_font)
        text_width = bbox[2] - bbox[0]
        x = (width - text_width) / 2
        y = start_y + i * (height * 0.1)
        draw.text((x, y), line, font=title_font, fill=text_color)
    
    # Accent line below title
    line_y = start_y + total_height + 30
    line_width = min(400, width * 0.3)
    draw.rectangle([
        (width - line_width) / 2, line_y,
        (width + line_width) / 2, line_y + 4
    ], fill=accent_color)
    
    return np.array(img.convert('RGB'))

def create_content_slide(slide, width, height, colors, template_name, slide_number=None):
    """Create a content slide image."""
    bg_color = to_rgb(colors.get('contentBg', {'red': 1, 'green': 1, 'blue': 1}))
    text_color = to_rgb(colors.get('bodyText', {'red': 0.1, 'green': 0.1, 'blue': 0.1}))
    heading_color = to_rgb(colors.get('heading', {'red': 0.1, 'green': 0.15, 'blue': 0.2}))
    accent_color = to_rgb(colors.get('accent', {'red': 0.4, 'green': 0.4, 'blue': 1}))
    
    img = Image.new('RGBA', (width, height), color=bg_color + (255,))
    draw = ImageDraw.Draw(img)
    
    padding = int(width * 0.08)
    
    # Draw subtle decorative elements
    # Top accent bar
    draw.rectangle([0, 0, width, 8], fill=accent_color)
    
    # Corner decoration
    draw.ellipse([width - 200, -100, width + 100, 200], fill=accent_color + (30,))
    
    # Fonts
    title_font = get_font(int(height * 0.05))
    body_font = get_font(int(height * 0.032))
    
    y = padding + 40
    
    # Slide number badge
    if slide_number:
        badge_size = 50
        draw_rounded_rectangle(draw, [padding, y - 10, padding + badge_size, y + badge_size - 10], 8, accent_color)
        num_font = get_font(24)
        num_text = str(slide_number)
        bbox = draw.textbbox((0, 0), num_text, font=num_font)
        num_x = padding + (badge_size - (bbox[2] - bbox[0])) / 2
        num_y = y - 10 + (badge_size - (bbox[3] - bbox[1])) / 2
        draw.text((num_x, num_y), num_text, font=num_font, fill=(255, 255, 255))
        y += badge_size + 20
    
    # Title
    title = slide.get('title', '')
    if title:
        # Word wrap title
        max_title_width = width - 2 * padding
        words = title.split()
        title_lines = []
        current_line = ""
        for word in words:
            test_line = (current_line + " " + word).strip()
            bbox = draw.textbbox((0, 0), test_line, font=title_font)
            if bbox[2] - bbox[0] <= max_title_width:
                current_line = test_line
            else:
                if current_line:
                    title_lines.append(current_line)
                current_line = word
        if current_line:
            title_lines.append(current_line)
        
        for line in title_lines:
            draw.text((padding, y), line, font=title_font, fill=heading_color)
            y += int(height * 0.06)
        
        # Accent underline
        draw.rectangle([padding, y, padding + 80, y + 4], fill=accent_color)
        y += 40
    
    # Content
    content = slide.get('content', '')
    if content:
        max_content_width = width - 2 * padding
        # Split into bullet points if contains newlines or bullet chars
        if '\n' in content or '•' in content or '-' in content[:5]:
            points = [p.strip().lstrip('•-').strip() for p in content.replace('•', '\n').split('\n') if p.strip()]
        else:
            # Wrap long content into chunks
            words = content.split()
            points = []
            current = ""
            for word in words:
                if len(current) + len(word) < 80:
                    current = (current + " " + word).strip()
                else:
                    if current:
                        points.append(current)
                    current = word
            if current:
                points.append(current)
        
        for point in points[:8]:  # Limit to 8 points
            # Bullet point
            bullet_x = padding
            bullet_y = y + int(height * 0.015)
            draw.ellipse([bullet_x, bullet_y, bullet_x + 10, bullet_y + 10], fill=accent_color)
            
            # Text with word wrap
            text_x = padding + 25
            words = point.split()
            line = ""
            for word in words:
                test = (line + " " + word).strip()
                bbox = draw.textbbox((0, 0), test, font=body_font)
                if bbox[2] - bbox[0] <= max_content_width - 30:
                    line = test
                else:
                    draw.text((text_x, y), line, font=body_font, fill=text_color)
                    y += int(height * 0.045)
                    line = word
            if line:
                draw.text((text_x, y), line, font=body_font, fill=text_color)
                y += int(height * 0.055)
    
    return np.array(img.convert('RGB'))

def create_closing_slide(slide, width, height, colors, template_name):
    """Create a closing/thank you slide."""
    bg_color = to_rgb(colors.get('closingBg', {'red': 0.1, 'green': 0.1, 'blue': 0.15}))
    text_color = to_rgb(colors.get('titleText', {'red': 1, 'green': 1, 'blue': 1}))
    accent_color = to_rgb(colors.get('accent', {'red': 0.4, 'green': 0.4, 'blue': 1}))
    
    img = Image.new('RGBA', (width, height), color=bg_color + (255,))
    draw = ImageDraw.Draw(img)
    
    # Decorative shapes
    draw_decorative_shapes(draw, width, height, accent_color, template_name)
    
    # Large "Thank You" text
    title_font = get_font(int(height * 0.1))
    text = slide.get('title', 'Thank You')
    
    bbox = draw.textbbox((0, 0), text, font=title_font)
    text_width = bbox[2] - bbox[0]
    text_height = bbox[3] - bbox[1]
    
    x = (width - text_width) / 2
    y = (height - text_height) / 2 - 30
    
    draw.text((x, y), text, font=title_font, fill=text_color)
    
    # Accent line
    line_y = y + text_height + 30
    line_width = min(200, width * 0.15)
    draw.rectangle([
        (width - line_width) / 2, line_y,
        (width + line_width) / 2, line_y + 4
    ], fill=accent_color)
    
    return np.array(img.convert('RGB'))

def create_slide_image(slide, width=1920, height=1080, template_settings=None):
    """Create a slide image based on type and template."""
    template_name = template_settings.get('template', 'modern') if template_settings else 'modern'
    
    # Default colors
    default_colors = {
        'titleBg': {'red': 0.1, 'green': 0.12, 'blue': 0.18},
        'titleText': {'red': 1, 'green': 1, 'blue': 1},
        'contentBg': {'red': 0.98, 'green': 0.98, 'blue': 1},
        'bodyText': {'red': 0.2, 'green': 0.25, 'blue': 0.3},
        'heading': {'red': 0.1, 'green': 0.15, 'blue': 0.25},
        'accent': {'red': 0.39, 'green': 0.4, 'blue': 0.95},
        'closingBg': {'red': 0.1, 'green': 0.12, 'blue': 0.18},
    }
    
    colors = template_settings.get('colors', default_colors) if template_settings else default_colors
    
    slide_type = slide.get('type', 'content')
    slide_number = slide.get('slide_number')
    
    if slide_type == 'title':
        return create_title_slide(slide, width, height, colors, template_name)
    elif slide_type == 'closing':
        return create_closing_slide(slide, width, height, colors, template_name)
    else:
        return create_content_slide(slide, width, height, colors, template_name, slide_number)

def base64_to_image_array(base64_string):
    """Convert base64 encoded image to numpy array."""
    import base64
    from io import BytesIO
    
    # Remove data URL prefix if present
    if ',' in base64_string:
        base64_string = base64_string.split(',')[1]
    
    # Decode base64 to bytes
    image_bytes = base64.b64decode(base64_string)
    
    # Open as PIL Image
    img = Image.open(BytesIO(image_bytes))
    
    # Convert to RGB if necessary (in case of RGBA)
    if img.mode == 'RGBA':
        # Create white background
        background = Image.new('RGB', img.size, (255, 255, 255))
        background.paste(img, mask=img.split()[3])  # Use alpha channel as mask
        img = background
    elif img.mode != 'RGB':
        img = img.convert('RGB')
    
    return np.array(img)


def generate_video(slides, audio_paths, output_path, template_settings=None, slide_images=None):
    """
    Generate a video from slides and audio files with transitions.
    
    If slide_images (base64 encoded) are provided, use them directly.
    Otherwise, generate slide images from slide data.
    """
    clips = []
    
    for i, (slide, audio_path) in enumerate(zip(slides, audio_paths)):
        if not os.path.exists(audio_path):
            print(f"Warning: Audio file not found: {audio_path}")
            continue
        
        # Create audio clip
        audio_clip = AudioFileClip(audio_path)
        duration = audio_clip.duration + 0.5  # Add 0.5s pause
        
        # Get image - either from provided images or generate
        if slide_images and i < len(slide_images) and slide_images[i]:
            # Use actual slide image from Adobe Express
            print(f"Using captured slide image for slide {i + 1}")
            img_array = base64_to_image_array(slide_images[i])
        else:
            # Fallback: generate slide image
            print(f"Generating slide image for slide {i + 1}")
            img_array = create_slide_image(slide, template_settings=template_settings)
        
        # Create image clip
        img_clip = ImageClip(img_array).with_duration(duration)
        
        # Set audio
        img_clip = img_clip.with_audio(audio_clip)
        
        clips.append(img_clip)
    
    if not clips:
        return None
    
    # Add crossfade transitions
    transition_duration = 0.8
    final_clips = []
    
    for i, clip in enumerate(clips):
        if i > 0:
            # Add fade in effect
            clip = clip.with_effects([vfx.CrossFadeIn(transition_duration)])
        if i < len(clips) - 1:
            # Add fade out effect
            clip = clip.with_effects([vfx.CrossFadeOut(transition_duration)])
        final_clips.append(clip)
    
    # Concatenate with slight overlap for crossfade
    final_video = concatenate_videoclips(final_clips, method="compose")
    
    # Write output
    final_video.write_videofile(
        output_path, 
        fps=24, 
        codec='libx264', 
        audio_codec='aac',
        preset='medium',
        threads=4
    )
    
    return output_path
