"""Tesseract OCR engine — fast text extraction from images. Bengali + English.
Requires: tesseract binary + pip install pytesseract Pillow"""

import logging
import os
import re

logger = logging.getLogger(__name__)

TESSERACT_PATH = r'C:\Program Files\Tesseract-OCR\tesseract.exe'


def _is_garbage_line(text):
    """Detect garbage OCR output — social handles, URLs, random chars."""
    if not text or len(text.strip()) < 2:
        return True
    stripped = text.strip()
    # Special characters ratio
    special_count = sum(1 for character in stripped if character in '[]#@{}()<>=/\\|~`^*_+£€$')
    if len(stripped) > 0 and special_count > len(stripped) * 0.2:
        return True
    # URLs, social handles, domains — also match "@ handle" with space
    if re.search(r'(https?://|www\.|@\s*\w+|\.com|\.org|\.net|\.bd|£\d)', stripped, re.IGNORECASE):
        return True
    # Has both uppercase Latin AND lowercase Latin mixed (social handle patterns like "themusimmindsbd")
    lower_latin = sum(1 for character in stripped if character.islower() and character.isascii())
    upper_latin = sum(1 for character in stripped if character.isupper() and character.isascii())
    total_latin = lower_latin + upper_latin
    if total_latin > 10 and total_latin > len(stripped.replace(' ', '')) * 0.5:
        return True
    # Mostly uppercase Latin
    if upper_latin > 3 and upper_latin > len(stripped.replace(' ', '')) * 0.4:
        return True
    # Too short
    if len(stripped) <= 2:
        return True
    # Single repeated character
    if len(set(stripped.replace(' ', ''))) <= 1:
        return True
    return False


def _clean_extracted_text(raw_text):
    """Remove garbage lines and clean up output."""
    if not raw_text:
        return ''
    lines = raw_text.strip().split('\n')
    clean_lines = []
    for line in lines:
        line = line.strip()
        if not line:
            if clean_lines and clean_lines[-1] != '':
                clean_lines.append('')
            continue
        if _is_garbage_line(line):
            continue
        clean_lines.append(line)
    while clean_lines and clean_lines[-1] == '':
        clean_lines.pop()
    return '\n'.join(clean_lines)


def extract(file_path):
    """Extract text from image using Tesseract. Simple, fast, reliable."""
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
        from PIL import Image
        image = Image.open(file_path)

        text = pytesseract.image_to_string(image, lang='ben+eng', config='--oem 1')

        # Confidence
        data = pytesseract.image_to_data(image, lang='ben+eng', config='--oem 1',
                                          output_type=pytesseract.Output.DICT)
        confidences = [int(confidence) for confidence in data['conf'] if int(confidence) > 0]
        average_confidence = sum(confidences) / len(confidences) / 100.0 if confidences else 0.0

    except Exception as tesseract_error:
        return {'success': False, 'error': f'Tesseract failed: {str(tesseract_error)}'}

    text = _clean_extracted_text(text)
    word_count = len(text.split()) if text else 0

    return {
        'success': True,
        'text': text,
        'word_count': word_count,
        'confidence': round(average_confidence, 4),
        'pages': [{
            'page_number': 1,
            'text': text,
            'word_count': word_count,
            'structured_blocks': [],
        }],
    }
