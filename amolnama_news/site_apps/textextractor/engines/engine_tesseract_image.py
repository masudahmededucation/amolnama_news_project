"""Tesseract Image OCR engine — multi-variant Bengali text extraction from images.
Pipeline: Upscale → Multiple preprocessing variants → Multiple OCR configs → Quality scoring → Best result.
Handles noisy photos, dark backgrounds, social card images, low-contrast Bengali text.
Requires: tesseract binary + pip install pytesseract Pillow opencv-python numpy"""

import logging
import os
import re

import cv2
import numpy as np

logger = logging.getLogger(__name__)

TESSERACT_PATH = r'C:\Program Files\Tesseract-OCR\tesseract.exe'
OCR_LANG = 'ben+eng'

# Multiple page segmentation modes for different image types
OCR_CONFIGS = [
    '--oem 1 --psm 6',   # Uniform block of text
    '--oem 1 --psm 4',   # Single column of variable sizes
    '--oem 1 --psm 3',   # Fully automatic page segmentation
]

# Known OCR junk tokens
GARBAGE_TOKENS = frozenset({
    '|', '।।', '॥', '!|', '|!', '*', '**', '***', '/', '//', '///',
    '•', '••', '—', '---', '===', '~~~', '___',
})

# Common Bengali words — if found, text is likely valid
COMMON_BENGALI_WORDS = frozenset({
    'এবং', 'করে', 'হয়', 'আমি', 'তুমি', 'আপনি', 'সে', 'তারা', 'আমরা',
    'একটি', 'করা', 'হবে', 'থেকে', 'জন্য', 'কিন্তু', 'যদি', 'তাহলে',
    'নিয়ে', 'দিয়ে', 'পরে', 'আগে', 'মধ্যে', 'সাথে', 'কারণ', 'প্রতি',
})

# Bengali OCR correction replacements
OCR_REPLACEMENTS = {
    '।|': '।', '|।': '।', '||': '।', ' ।': '।',
    '( ': '(', ' )': ')',
    ',,': ',', '..': '.',
}


# =========================================================
# TEXT CLEANING
# =========================================================

def _is_garbage_line(text):
    """Detect garbage OCR output — social handles, URLs, watermarks, random chars."""
    if not text or len(text.strip()) < 2:
        return True
    stripped = text.strip()

    # Special characters ratio
    special_count = sum(1 for character in stripped if character in '[]#@{}()<>=/\\|~`^*_+£€$')
    if len(stripped) > 0 and special_count > len(stripped) * 0.2:
        return True

    # URLs, social handles, domains
    if re.search(r'(https?://|www\.|@\s*\w+|\.com|\.org|\.net|\.bd|£\d)', stripped, re.IGNORECASE):
        return True

    # Mostly Latin characters (social handles, watermarks)
    lower_latin = sum(1 for character in stripped if character.islower() and character.isascii())
    upper_latin = sum(1 for character in stripped if character.isupper() and character.isascii())
    total_latin = lower_latin + upper_latin
    if total_latin > 10 and total_latin > len(stripped.replace(' ', '')) * 0.5:
        return True
    if upper_latin > 3 and upper_latin > len(stripped.replace(' ', '')) * 0.4:
        return True

    # Single repeated character
    if len(set(stripped.replace(' ', ''))) <= 1:
        return True

    return False


def _cleanup_text(raw_text):
    """Full cleanup: garbage lines, OCR replacements, whitespace normalization."""
    if not raw_text:
        return ''

    # OCR replacements
    for bad_text, good_text in OCR_REPLACEMENTS.items():
        raw_text = raw_text.replace(bad_text, good_text)

    # Filter garbage lines and merge into paragraphs
    lines = raw_text.strip().split('\n')
    sentence_endings = {'।', '|', '.', '!', '?', ':', ';'}
    paragraphs = []
    current_paragraph = []

    for line in lines:
        line = line.strip()
        if not line:
            # Empty line = paragraph break
            if current_paragraph:
                paragraphs.append(' '.join(current_paragraph))
                current_paragraph = []
            continue
        if _is_garbage_line(line):
            continue
        current_paragraph.append(line)
        if line[-1] in sentence_endings:
            paragraphs.append(' '.join(current_paragraph))
            current_paragraph = []

    if current_paragraph:
        paragraphs.append(' '.join(current_paragraph))

    text = '\n\n'.join(paragraphs)

    # Clean whitespace
    text = text.replace('\ufeff', '')
    text = text.replace('\u00ad', '')
    text = text.replace('\xa0', ' ')
    text = re.sub(r'[ \t]+', ' ', text)
    text = re.sub(r'\n{3,}', '\n\n', text)

    return text.strip()


# =========================================================
# QUALITY SCORING (same proven pattern as PDF engine)
# =========================================================

def _bengali_ratio(text):
    """Calculate ratio of Bengali characters in text."""
    cleaned = re.sub(r'\s+', '', text)
    if not cleaned:
        return 0.0
    bengali_count = sum(1 for character in cleaned if '\u0980' <= character <= '\u09FF')
    return bengali_count / len(cleaned)


def _garbage_token_count(text):
    """Count known OCR junk tokens."""
    return sum(1 for word in re.findall(r'\S+', text) if word in GARBAGE_TOKENS)


def _broken_latin_noise_count(text):
    """Count unexpected Latin word fragments in Bengali text."""
    tokens = re.findall(r'\b[A-Za-z]{2,}\b', text)
    return sum(1 for token in tokens if token.lower() not in {'www', 'http', 'https', 'pdf', 'ocr'})


def _text_quality_score(text):
    """Score text quality. Higher = better. Bengali density rewarded, noise penalized."""
    if not text or not text.strip():
        return -1000000

    cleaned = re.sub(r'\s+', '', text)
    if len(cleaned) < 10:
        return -1000

    score = 0.0
    score += min(len(cleaned), 4000) * 0.01
    score += _bengali_ratio(text) * 100.0
    score -= _garbage_token_count(text) * 25.0
    score -= _broken_latin_noise_count(text) * 8.0

    # Reward presence of common Bengali words
    for word in COMMON_BENGALI_WORDS:
        if word in text:
            score += 5.0

    return score


# =========================================================
# IMAGE PREPROCESSING VARIANTS
# =========================================================

def _upscale_image(image, scale):
    """Upscale image for better OCR accuracy on Bengali ligatures."""
    if scale <= 1:
        return image
    return cv2.resize(image, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)


def _build_image_variants(image_bgr):
    """Generate multiple preprocessing variants — let quality scoring pick the best."""
    # Upscale 2x for Bengali ligature accuracy
    upscaled = _upscale_image(image_bgr, 2)
    gray = cv2.cvtColor(upscaled, cv2.COLOR_BGR2GRAY)

    # Variant 1: Grayscale with contrast normalization
    equalized = cv2.equalizeHist(gray)

    # Variant 2: Sharpened
    sharpen_kernel = np.array([[0, -1, 0], [-1, 5, -1], [0, -1, 0]], dtype=np.float32)
    sharpened = cv2.filter2D(gray, -1, sharpen_kernel)

    # Variant 3: Otsu threshold (good for clean documents)
    _, otsu_threshold = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)

    # Variant 4: Adaptive threshold (good for uneven lighting / photos)
    adaptive = cv2.adaptiveThreshold(
        gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY, 15, 4,
    )

    # Variant 5: Inverted for bright text on dark backgrounds (social card images)
    inverted = cv2.bitwise_not(gray)
    _, inverted_otsu = cv2.threshold(inverted, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)

    return {
        'equalized': equalized,
        'sharp': sharpened,
        'otsu': otsu_threshold,
        'adaptive': adaptive,
        'inverted_otsu': inverted_otsu,
    }


# =========================================================
# OCR ENGINE — MULTI-VARIANT SCORING
# =========================================================

def _ocr_with_best_config(image, configs):
    """Try multiple Tesseract configs on one image, return best-scoring result."""
    import pytesseract

    best_result = {'config': '', 'text': '', 'score': -1000000}

    for config in configs:
        try:
            raw_text = pytesseract.image_to_string(image, lang=OCR_LANG, config=config)
        except Exception:
            raw_text = ''

        cleaned = _cleanup_text(raw_text)
        score = _text_quality_score(cleaned)

        if score > best_result['score']:
            best_result = {'config': config, 'text': cleaned, 'score': score}

    return best_result


def extract(file_path):
    """Extract Bengali text from image using Tesseract with multi-variant quality scoring.
    Tries 5 preprocessing variants × 3 OCR configs = 15 attempts, picks best."""
    if not os.path.exists(file_path):
        return {'success': False, 'error': 'File not found'}

    if os.path.getsize(file_path) == 0:
        return {'success': False, 'error': 'File is empty'}

    try:
        import pytesseract
        if os.path.exists(TESSERACT_PATH):
            pytesseract.pytesseract.tesseract_cmd = TESSERACT_PATH
    except ImportError:
        return {'success': False, 'error': 'pytesseract not installed. Run: pip install pytesseract'}

    try:
        image_bgr = cv2.imread(file_path, cv2.IMREAD_COLOR)
        if image_bgr is None:
            return {'success': False, 'error': f'Unable to read image: {file_path}'}

        variants = _build_image_variants(image_bgr)

        best_overall = {'variant': '', 'config': '', 'text': '', 'score': -1000000}

        for variant_name, variant_image in variants.items():
            result = _ocr_with_best_config(variant_image, OCR_CONFIGS)
            logger.debug('Variant %s config %s score %.1f', variant_name, result['config'], result['score'])

            if result['score'] > best_overall['score']:
                best_overall = {
                    'variant': variant_name,
                    'config': result['config'],
                    'text': result['text'],
                    'score': result['score'],
                }

        text = best_overall['text']
        word_count = len(text.split()) if text.strip() else 0

        # Confidence based on Bengali ratio
        confidence = min(_bengali_ratio(text), 0.95) if text else 0.0

        logger.info(
            'Image OCR complete: variant=%s config=%s score=%.1f words=%d confidence=%.2f',
            best_overall['variant'], best_overall['config'],
            best_overall['score'], word_count, confidence,
        )

        return {
            'success': True,
            'text': text,
            'word_count': word_count,
            'confidence': round(confidence, 4),
            'ocr_variant': best_overall['variant'],
            'ocr_config': best_overall['config'],
            'quality_score': round(best_overall['score'], 2),
            'pages': [{
                'page_number': 1,
                'text': text,
                'word_count': word_count,
                'structured_blocks': [],
            }],
        }

    except Exception as extraction_error:
        logger.exception('Tesseract image OCR failed for %s: %s', file_path, extraction_error)
        return {'success': False, 'error': f'OCR failed: {str(extraction_error)}'}
