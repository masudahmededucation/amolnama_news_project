"""PyMuPDF extraction engine — extracts text from PDF files with page structure.
Falls back to Tesseract OCR (ben+eng) for scanned/garbled pages."""

import logging
import os
import re

import cv2
import numpy as np

logger = logging.getLogger(__name__)

# Minimum words per page to consider it "has text" (not scanned)
MIN_WORDS_FOR_TEXT_PAGE = 5

# Tesseract config for Bengali + English
OCR_LANG = 'ben+eng'
TESSERACT_CONFIG = '--oem 1 --psm 4'

# Corruption markers — garbled Bengali font encoding produces these patterns
GARBLED_BENGALI_PATTERNS = ['াাং', '঳', '঱', '৞া', 'হ঱', 'চনকণ', 'ফাাং', '঳াং']


def _count_bengali_characters(text):
    """Count Bengali Unicode range characters (U+0980 to U+09FF)."""
    return sum(1 for character in text if '\u0980' <= character <= '\u09FF')


def _is_garbled_bengali(text):
    """Detect if extracted text is garbled Bengali (font encoding issue).
    Uses corruption markers + Bengali ratio check."""
    if not text or len(text.strip()) < 50:
        return False

    cleaned = re.sub(r'\s+', '', text)
    if len(cleaned) < 40:
        return False

    bengali_character_count = _count_bengali_characters(cleaned)
    bengali_ratio = bengali_character_count / max(len(cleaned), 1)

    # Not a Bengali document — skip
    if bengali_ratio < 0.25:
        return False

    # Check for corruption markers
    bad_hits = sum(text.count(pattern) for pattern in GARBLED_BENGALI_PATTERNS)
    if bad_hits > 8:
        logger.info('Garbled Bengali detected: %d corruption markers found', bad_hits)
        return True

    # Also check common words — if Bengali chars present but zero common words, it's garbled
    common_words = {
        'এবং', 'করা', 'হবে', 'থেকে', 'করে', 'হয়', 'তার', 'এই', 'যে', 'একটি',
        'বাংলাদেশ', 'সরকার', 'প্রতি', 'মধ্যে', 'আইন', 'সকল', 'কোন', 'জন্য',
    }
    for word in common_words:
        if word in text:
            return False

    logger.info('Garbled Bengali detected: %d Bengali chars but no common words', bengali_character_count)
    return True


def _render_page_to_bgr(page, dpi=300):
    """Render PDF page to BGR numpy array."""
    scale = dpi / 72.0
    pixmap = page.get_pixmap(matrix=__import__('fitz').Matrix(scale, scale), alpha=False)

    if pixmap.n == 1:
        image = np.frombuffer(pixmap.samples, dtype=np.uint8).reshape(pixmap.h, pixmap.w)
        image = cv2.cvtColor(image, cv2.COLOR_GRAY2BGR)
    else:
        image = np.frombuffer(pixmap.samples, dtype=np.uint8).reshape(pixmap.h, pixmap.w, pixmap.n)
        if pixmap.n == 4:
            image = cv2.cvtColor(image, cv2.COLOR_RGBA2BGR)
        else:
            image = cv2.cvtColor(image, cv2.COLOR_RGB2BGR)

    return image


def _crop_to_content(image_bgr):
    """Remove wide empty margins — helps OCR on scanned/legal pages."""
    gray = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2GRAY)
    _, threshold = cv2.threshold(gray, 245, 255, cv2.THRESH_BINARY_INV)

    coordinates = cv2.findNonZero(threshold)
    if coordinates is None:
        return image_bgr

    bounding_x, bounding_y, bounding_width, bounding_height = cv2.boundingRect(coordinates)

    padding = 20
    crop_x0 = max(bounding_x - padding, 0)
    crop_y0 = max(bounding_y - padding, 0)
    crop_x1 = min(bounding_x + bounding_width + padding, image_bgr.shape[1])
    crop_y1 = min(bounding_y + bounding_height + padding, image_bgr.shape[0])

    return image_bgr[crop_y0:crop_y1, crop_x0:crop_x1]


def _preprocess_for_ocr(image_bgr):
    """Light preprocessing: crop margins → grayscale → sharpen. No aggressive threshold."""
    image_bgr = _crop_to_content(image_bgr)
    gray = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2GRAY)

    # Light sharpen only
    sharpen_kernel = np.array([[0, -1, 0], [-1, 5, -1], [0, -1, 0]])
    sharpened = cv2.filter2D(gray, -1, sharpen_kernel)

    return sharpened


def _ocr_page_with_tesseract(page, page_index):
    """Render page and OCR with Tesseract. Returns (text, confidence, success)."""
    try:
        import pytesseract
    except ImportError:
        logger.info('pytesseract not installed — skipping OCR for page %d', page_index + 1)
        return '', 0.0, False

    try:
        image_bgr = _render_page_to_bgr(page, dpi=300)
        processed = _preprocess_for_ocr(image_bgr)

        text = pytesseract.image_to_string(processed, lang=OCR_LANG, config=TESSERACT_CONFIG)
        text = text.strip()
        word_count = len(text.split()) if text else 0

        if word_count > 0:
            return text, 0.85, True
        return '', 0.0, False

    except Exception as ocr_error:
        logger.warning('Tesseract OCR failed for page %d: %s', page_index + 1, ocr_error)
        return '', 0.0, False


def extract(file_path, on_progress=None):
    """Extract text from PDF using PyMuPDF. Falls back to Tesseract OCR for scanned/garbled pages.
    on_progress(current_page, total_pages) called per page for real-time progress."""
    try:
        import fitz
    except ImportError:
        return {'success': False, 'error': 'PyMuPDF (fitz) not installed. Run: pip install PyMuPDF'}

    if not os.path.exists(file_path):
        return {'success': False, 'error': 'File not found'}

    try:
        document = fitz.open(file_path)
    except Exception as open_error:
        return {'success': False, 'error': f'Cannot open PDF: {str(open_error)}'}

    total_pages = len(document)
    all_text_parts = []
    pages = []
    total_word_count = 0
    total_confidence = 0.0
    has_ocr_pages = False

    for page_index in range(total_pages):
        if on_progress:
            on_progress(page_index + 1, total_pages)

        page = document[page_index]

        # Step 1: Try direct text extraction
        page_text = page.get_text('text') or ''
        page_word_count = len(page_text.split()) if page_text.strip() else 0
        page_confidence = 1.0
        page_was_ocr = False

        # Step 2: Decide if OCR is needed
        needs_ocr = page_word_count < MIN_WORDS_FOR_TEXT_PAGE or _is_garbled_bengali(page_text)

        if needs_ocr:
            ocr_reason = 'garbled font encoding' if page_word_count >= MIN_WORDS_FOR_TEXT_PAGE else 'scanned image'
            ocr_text, ocr_confidence, ocr_success = _ocr_page_with_tesseract(page, page_index)

            if ocr_success and len(ocr_text.split()) > 0:
                logger.info('Page %d: %s — Tesseract OCR extracted %d words',
                            page_index + 1, ocr_reason, len(ocr_text.split()))
                page_text = ocr_text
                page_word_count = len(ocr_text.split())
                page_confidence = ocr_confidence
                page_was_ocr = True
                has_ocr_pages = True
            elif page_word_count > 0:
                # OCR failed but direct had something — use direct as fallback
                logger.info('Page %d: OCR failed, using direct text fallback (%d words)',
                            page_index + 1, page_word_count)

        total_word_count += page_word_count
        total_confidence += page_confidence

        pages.append({
            'page_number': page_index + 1,
            'text': page_text,
            'word_count': page_word_count,
            'was_ocr': page_was_ocr,
        })

        all_text_parts.append(page_text)

    document.close()

    combined_text = '\n\n'.join(all_text_parts)
    average_confidence = total_confidence / len(pages) if pages else 1.0

    return {
        'success': True,
        'text': combined_text,
        'word_count': total_word_count,
        'page_count': len(pages),
        'confidence': round(average_confidence, 4),
        'has_ocr_pages': has_ocr_pages,
        'pages': pages,
    }
