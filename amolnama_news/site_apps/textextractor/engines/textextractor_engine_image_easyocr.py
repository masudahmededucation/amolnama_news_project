"""EasyOCR extraction engine — Bengali + English OCR with OpenCV preprocessing.
Pipeline: Load → Grayscale → Denoise → Sharpen → Adaptive Threshold → Deskew → OCR.
Handles noisy photos, uneven lighting, handwriting, tilted images."""

import logging
import os
import re

import cv2
import numpy as np

logger = logging.getLogger(__name__)

# Initialize reader once globally
_reader = None


def _get_reader():
    """Lazy-load EasyOCR reader (heavy init, done once)."""
    global _reader
    if _reader is None:
        try:
            import easyocr
            _reader = easyocr.Reader(['bn', 'en'], gpu=False)
        except ImportError:
            raise ImportError('EasyOCR not installed. Run: pip install easyocr')
    return _reader


def _preprocess_image(file_path):
    """Full preprocessing pipeline: grayscale → denoise → sharpen → threshold → deskew.
    Returns preprocessed OpenCV image (numpy array) ready for OCR."""
    image = cv2.imread(file_path)
    if image is None:
        return None

    # Grayscale
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

    # Denoise — removes digital noise from phone cameras
    denoised = cv2.fastNlMeansDenoising(gray, h=10)

    # Sharpen — unsharp mask technique, makes thin text strokes visible
    gaussian_blur = cv2.GaussianBlur(denoised, (9, 9), 10.0)
    sharpened = cv2.addWeighted(denoised, 1.5, gaussian_blur, -0.5, 0)

    # Adaptive threshold — handles uneven lighting/shadows
    processed = cv2.adaptiveThreshold(
        sharpened, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY, 11, 2,
    )

    # Deskew — straighten tilted photos
    processed = _deskew_image(processed)

    return processed


def _deskew_image(image):
    """Detect text tilt and rotate to horizontal."""
    try:
        inverted = cv2.bitwise_not(image)
        coords = np.column_stack(np.where(inverted > 0))
        if len(coords) < 100:
            return image

        angle = cv2.minAreaRect(coords)[-1]
        if angle < -45:
            angle = -(90 + angle)
        else:
            angle = -angle

        # Only deskew if angle is significant but not too extreme
        if abs(angle) < 0.5 or abs(angle) > 15:
            return image

        height, width = image.shape[:2]
        center = (width // 2, height // 2)
        matrix = cv2.getRotationMatrix2D(center, angle, 1.0)
        rotated = cv2.warpAffine(image, matrix, (width, height),
                                  flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)
        return rotated
    except Exception:
        return image


def _is_garbage_line(text):
    """Detect garbage OCR output — social handles, URLs, watermarks."""
    if not text or len(text.strip()) < 2:
        return True
    stripped = text.strip()
    special_count = sum(1 for character in stripped if character in '[]#@{}()<>=/\\|~`^*_+£€$')
    if len(stripped) > 0 and special_count > len(stripped) * 0.2:
        return True
    if re.search(r'(https?://|www\.|@\s*\w+|\.com|\.org|\.net|\.bd|£\d)', stripped, re.IGNORECASE):
        return True
    lower_latin = sum(1 for character in stripped if character.islower() and character.isascii())
    upper_latin = sum(1 for character in stripped if character.isupper() and character.isascii())
    total_latin = lower_latin + upper_latin
    if total_latin > 10 and total_latin > len(stripped.replace(' ', '')) * 0.5:
        return True
    if upper_latin > 3 and upper_latin > len(stripped.replace(' ', '')) * 0.4:
        return True
    if len(stripped) <= 2:
        return True
    if len(set(stripped.replace(' ', ''))) <= 1:
        return True
    return False


def _merge_lines_into_paragraphs(lines):
    """Merge OCR lines into paragraphs. Filter garbage. Join until sentence end."""
    if not lines:
        return ''

    sentence_endings = {'।', '|', '.', '!', '?', ':', ';'}
    paragraphs = []
    current_paragraph = []

    for line in lines:
        line = line.strip()
        if not line or _is_garbage_line(line):
            continue
        current_paragraph.append(line)
        if line[-1] in sentence_endings:
            paragraphs.append(' '.join(current_paragraph))
            current_paragraph = []

    if current_paragraph:
        paragraphs.append(' '.join(current_paragraph))

    return '\n'.join(paragraphs)


def extract_fast(file_path):
    """Fast OCR — detail=0, paragraph=True. Used by PDF engine for garbled pages.
    Skips bounding box math and groups text into paragraphs. ~2x faster than full extract."""
    if not os.path.exists(file_path):
        return {'success': False, 'error': 'File not found'}

    try:
        reader = _get_reader()
    except ImportError as import_error:
        return {'success': False, 'error': str(import_error)}

    try:
        results = reader.readtext(file_path, detail=0, paragraph=True)
    except Exception as ocr_error:
        return {'success': False, 'error': f'OCR failed: {str(ocr_error)}'}

    combined_text = '\n'.join(results) if results else ''
    word_count = len(combined_text.split()) if combined_text.strip() else 0

    return {
        'success': True,
        'text': combined_text,
        'word_count': word_count,
        'confidence': 0.85,  # No per-line confidence in detail=0 mode
    }


def extract(file_path):
    """Extract text from image using EasyOCR with full preprocessing pipeline."""
    if not os.path.exists(file_path):
        return {'success': False, 'error': 'File not found'}

    if os.path.getsize(file_path) == 0:
        return {'success': False, 'error': 'File is empty'}

    try:
        reader = _get_reader()
    except ImportError as import_error:
        return {'success': False, 'error': str(import_error)}

    # EasyOCR handles colored images natively — no heavy preprocessing needed
    # Just pass the original file path (EasyOCR does its own internal preprocessing)
    try:
        results = reader.readtext(file_path, detail=1)
    except Exception as ocr_error:
        return {'success': False, 'error': f'OCR failed: {str(ocr_error)}'}

    if not results:
        return {'success': True, 'text': '', 'word_count': 0, 'confidence': 0.0, 'pages': []}

    text_parts = []
    structured_blocks = []
    total_confidence = 0.0

    for bounding_box, text, confidence in results:
        if confidence < 0.3:
            continue
        text_parts.append(text)
        total_confidence += confidence
        structured_blocks.append({
            'text': text,
            'confidence': round(confidence, 4),
            'bbox': [[int(point[0]), int(point[1])] for point in bounding_box],
        })

    combined_text = _merge_lines_into_paragraphs(text_parts)
    average_confidence = total_confidence / len(structured_blocks) if structured_blocks else 0.0
    word_count = len(combined_text.split()) if combined_text.strip() else 0

    return {
        'success': True,
        'text': combined_text,
        'word_count': word_count,
        'confidence': round(average_confidence, 4),
        'pages': [{
            'page_number': 1,
            'text': combined_text,
            'word_count': word_count,
            'structured_blocks': structured_blocks,
        }],
    }
