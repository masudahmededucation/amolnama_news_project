"""PyMuPDF extraction engine — extracts text from PDF files.
Smart decision engine: direct extraction → validate Bengali quality → Tesseract OCR fallback.
Multiple OCR variants (4 preprocessing × 3 psm configs) scored and best picked.
Header/footer stripping, garbage token filtering, targeted Bengali OCR corrections."""

import logging
import os
import re

import cv2
import numpy as np

logger = logging.getLogger(__name__)

# =========================================================
# CONFIG
# =========================================================

MIN_WORDS_FOR_TEXT_PAGE = 5
OCR_LANG = 'ben+eng'

# Multiple Tesseract page segmentation modes — try all, pick best score
OCR_CONFIGS = [
    '--oem 1 --psm 4',   # structured blocks / legal pages
    '--oem 1 --psm 6',   # uniform text block
    '--oem 1 --psm 3',   # automatic full page
]

# Common OCR junk tokens
GARBAGE_TOKENS = {
    'SCAT', 'RECA', 'TAR', 'TR', 'WANTS', 'AT', 'AAT', 'fee',
    'ste', 'WIA', 'AECA', 'PT]', 'PT', 'Cos', 'RU)', 'Mia',
}

# Corruption markers from garbled font encoding
GARBLED_BENGALI_PATTERNS = [
    'াাং', '঳', '঱', '৞া', 'হ঱', 'চনকণ', 'ফাাং', '঳াং',
]

# Strong corruption patterns from bad direct extraction
BAD_PATTERNS = [
    'গণ্প্রজাতন্ত্রী', 'খুজাতীয়', 'এঁতিহাসিক', 'অসামগ্জস্য',
    'ভাংগিয়া', 'গপনিবেশিকতাবাদ', 'জনশ্বঙ্খলা', 'A মাধ্যমে',
    'TR বলিতে', 'প্রজাতন্ত্রী বাং', 'বাংলাদেশ সুংবিধান',
]

# Targeted post-corrections for recurring Bengali OCR mistakes
OCR_REPLACEMENTS = {
    'গণ্প্রজাতন্ত্রী': 'গণপ্রজাতন্ত্রী',
    'খুজাতীয়': 'জাতীয়',
    'এঁতিহাসিক': 'ঐতিহাসিক',
    'এঁতিহ্য': 'ঐতিহ্য',
    'অসামগ্জস্যপূর্ণ': 'অসামঞ্জস্যপূর্ণ',
    'অসামগ্জস্য': 'অসামঞ্জস্য',
    'ভাংশগিয়া': 'ভাঙ্গিয়া',
    'গপনিবেশিকতাবাদ': 'ঔপনিবেশিকতাবাদ',
    'জনশ্বঙ্খলা': 'জনশৃঙ্খলা',
    'নারীপুরুষভেদ': 'নারী-পুরুষভেদ',
    'গণপ্রজাত্রী': 'গণপ্রজাতন্ত্রী',
    'গণপ্রজাতন্ত্রী বাং': 'গণপ্রজাতন্ত্রী বাংলাদেশের',
    'বাংলাদেশ সুংবিধান': 'বাংলাদেশের সংবিধান',
    'খুআমরা': 'আমরা',
}

# Common Bengali words — if text has Bengali chars but NONE of these, it's garbled
COMMON_BENGALI_WORDS = {
    'এবং', 'করা', 'হবে', 'থেকে', 'করে', 'হয়', 'তার', 'এই', 'যে', 'একটি',
    'বাংলাদেশ', 'সরকার', 'প্রতি', 'মধ্যে', 'আইন', 'সকল', 'কোন', 'জন্য',
    'দ্বারা', 'অধীন', 'রাষ্ট্র', 'প্রজাতন্ত্রী', 'সংবিধান', 'নাগরিক',
}


# =========================================================
# TEXT UTILITIES
# =========================================================

def _normalize_whitespace(text):
    """Clean whitespace: BOM, soft hyphens, join mid-paragraph line breaks."""
    text = text.replace('\ufeff', '')
    text = text.replace('\u00ad', '')
    text = text.replace('\xa0', ' ')
    text = re.sub(r'[ \t]+', ' ', text)
    # Collapse 3+ newlines to paragraph break
    text = re.sub(r'\n{3,}', '\n\n', text)
    # Join mid-paragraph line breaks: single \n → space (preserve \n\n as paragraph break)
    text = re.sub(r'(?<!\n)\n(?!\n)', ' ', text)
    # Clean up any resulting double spaces
    text = re.sub(r'  +', ' ', text)
    return text.strip()


def _normalize_bangla_punctuation(text):
    """Normalize Bengali punctuation variants."""
    text = text.replace('৷', '।')
    text = text.replace('|]', ']')
    text = text.replace(' |]', ']')
    text = text.replace('॥]', ']')
    return text


def _strip_headers_footers(text):
    """Remove known header/footer patterns: dates, URLs, page counters."""
    kept = []
    for line in text.splitlines():
        stripped = line.strip()

        if not stripped:
            kept.append('')
            continue

        lowered = stripped.lower()

        # URLs / site lines
        if 'www.pathagar.com' in lowered or 'bdlaws.minlaw.gov.bd' in lowered or 'act-print-957.html' in lowered:
            continue

        # Date only line (30/03/2026)
        if re.fullmatch(r'\d{1,2}/\d{1,2}/\d{4}', stripped):
            continue

        # Page counter only (1/66)
        if re.fullmatch(r'\d+\s*/\s*\d+', stripped):
            continue

        # Date prefix on same line — strip the date part
        if re.match(r'^\d{1,2}/\d{1,2}/\d{4}\s+', stripped):
            stripped = re.sub(r'^\d{1,2}/\d{1,2}/\d{4}\s+', '', stripped).strip()
            if not stripped:
                continue

        # Page counter at end of line
        stripped = re.sub(r'\s+\d+\s*/\s*\d+\s*$', '', stripped).strip()
        if not stripped:
            continue

        kept.append(stripped)

    return '\n'.join(kept).strip()


def _apply_ocr_replacements(text):
    """Fix common Bengali OCR mistakes with targeted replacements."""
    for bad_text, good_text in OCR_REPLACEMENTS.items():
        text = text.replace(bad_text, good_text)
    return text


def _cleanup_text(text):
    """Full cleanup pipeline: headers → punctuation → replacements → whitespace."""
    text = _strip_headers_footers(text)
    text = _normalize_bangla_punctuation(text)
    text = _apply_ocr_replacements(text)
    text = _normalize_whitespace(text)
    return text


# =========================================================
# QUALITY SCORING
# =========================================================

def _bengali_ratio(text):
    """Calculate ratio of Bengali characters in text."""
    cleaned = re.sub(r'\s+', '', text)
    if not cleaned:
        return 0.0
    bengali_count = sum(1 for character in cleaned if '\u0980' <= character <= '\u09FF')
    return bengali_count / len(cleaned)


def _garbage_token_count(text):
    """Count known OCR junk tokens in text."""
    return sum(1 for word in re.findall(r'\S+', text) if word in GARBAGE_TOKENS)


def _bad_pattern_count(text):
    """Count corruption patterns in text."""
    return sum(text.count(pattern) for pattern in BAD_PATTERNS)


def _broken_latin_noise_count(text):
    """Count unexpected Latin word fragments in Bengali text."""
    tokens = re.findall(r'\b[A-Za-z]{2,}\b', text)
    return sum(1 for token in tokens if token.lower() not in {'www', 'http', 'https'})


def _text_quality_score(text):
    """Score text quality. Higher = better. Bengali density rewarded, corruption penalized."""
    if not text or not text.strip():
        return -1000000

    text = _cleanup_text(text)
    cleaned = re.sub(r'\s+', '', text)

    if len(cleaned) < 20:
        return -1000

    score = 0.0
    score += min(len(cleaned), 4000) * 0.01          # reward volume (capped)
    score += _bengali_ratio(text) * 100.0              # reward Bengali density
    score -= _garbage_token_count(text) * 25.0         # penalize junk tokens
    score -= _bad_pattern_count(text) * 20.0           # penalize corruption
    score -= _broken_latin_noise_count(text) * 8.0     # penalize Latin noise

    return score


def _direct_text_is_trustworthy(text):
    """Check if direct PDF text extraction is good enough to use without OCR."""
    score = _text_quality_score(text)
    return score >= 35 and _bengali_ratio(text) >= 0.35 and _bad_pattern_count(text) <= 2


def _is_garbled_bengali(text):
    """Detect garbled Bengali from font encoding issues."""
    if not text or len(text.strip()) < 50:
        return False

    cleaned = re.sub(r'\s+', '', text)
    if len(cleaned) < 40:
        return False

    if _bengali_ratio(text) < 0.25:
        return False

    # Check corruption markers
    bad_hits = sum(text.count(pattern) for pattern in GARBLED_BENGALI_PATTERNS)
    if bad_hits > 8:
        return True

    # Check common words
    for word in COMMON_BENGALI_WORDS:
        if word in text:
            return False

    return True


# =========================================================
# PAGE IMAGE PROCESSING
# =========================================================

def _render_page_to_bgr(page, dpi=300):
    """Render PDF page to BGR numpy array."""
    import fitz
    scale = dpi / 72.0
    pixmap = page.get_pixmap(matrix=fitz.Matrix(scale, scale), alpha=False)

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
    """Remove wide empty margins."""
    gray = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2GRAY)
    _, threshold = cv2.threshold(gray, 245, 255, cv2.THRESH_BINARY_INV)

    coordinates = cv2.findNonZero(threshold)
    if coordinates is None:
        return image_bgr

    bounding_x, bounding_y, bounding_width, bounding_height = cv2.boundingRect(coordinates)
    padding = 18
    crop_x0 = max(0, bounding_x - padding)
    crop_y0 = max(0, bounding_y - padding)
    crop_x1 = min(image_bgr.shape[1], bounding_x + bounding_width + padding)
    crop_y1 = min(image_bgr.shape[0], bounding_y + bounding_height + padding)

    return image_bgr[crop_y0:crop_y1, crop_x0:crop_x1]


def _remove_header_footer_bands(image_bgr):
    """Cut top 3% and bottom 4% of page image where headers/footers sit."""
    image_height, image_width = image_bgr.shape[:2]
    top_cut = int(image_height * 0.03)
    bottom_cut = int(image_height * 0.04)

    if image_height - top_cut - bottom_cut < 200:
        return image_bgr

    return image_bgr[top_cut:image_height - bottom_cut, :]


def _build_preprocessing_variants(image_bgr):
    """Generate 4 image variants for OCR — let scoring choose the best."""
    base = _remove_header_footer_bands(image_bgr)
    base = _crop_to_content(base)

    gray = cv2.cvtColor(base, cv2.COLOR_BGR2GRAY)

    sharpen_kernel = np.array([[0, -1, 0], [-1, 5, -1], [0, -1, 0]], dtype=np.float32)
    sharpened = cv2.filter2D(gray, -1, sharpen_kernel)

    _, otsu_threshold = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)

    sharpened_for_otsu = cv2.filter2D(gray, -1, sharpen_kernel)
    _, sharpened_otsu = cv2.threshold(sharpened_for_otsu, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)

    return {
        'gray': gray,
        'sharp': sharpened,
        'otsu': otsu_threshold,
        'sharp_otsu': sharpened_otsu,
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


def _best_ocr_result_from_page(page, page_index):
    """Render page, try 4 preprocessing variants × 3 OCR configs, return best.
    Returns (text, confidence, success, source_description)."""
    try:
        import pytesseract
    except ImportError:
        return '', 0.0, False, 'pytesseract not installed'

    try:
        image_bgr = _render_page_to_bgr(page, dpi=300)
        variants = _build_preprocessing_variants(image_bgr)

        best_overall = {'variant': '', 'config': '', 'text': '', 'score': -1000000}

        for variant_name, variant_image in variants.items():
            result = _ocr_with_best_config(variant_image, OCR_CONFIGS)
            if result['score'] > best_overall['score']:
                best_overall = {
                    'variant': variant_name,
                    'config': result['config'],
                    'text': result['text'],
                    'score': result['score'],
                }

        if best_overall['score'] > -1000 and len(best_overall['text'].split()) > 0:
            source_description = f"ocr ({best_overall['variant']})"
            return best_overall['text'], 0.85, True, source_description

        return '', 0.0, False, 'ocr failed'

    except Exception as ocr_error:
        logger.warning('Tesseract OCR failed for page %d: %s', page_index + 1, ocr_error)
        return '', 0.0, False, f'ocr error: {str(ocr_error)}'


# =========================================================
# PAGE DECISION ENGINE
# =========================================================

def _extract_page_text(page, page_index):
    """Smart decision: direct extraction → validate → OCR fallback.
    Returns (text, word_count, confidence, was_ocr, source_description)."""

    # Step 1: Try direct text extraction
    direct_text = _cleanup_text(page.get_text('text') or '')
    direct_word_count = len(direct_text.split()) if direct_text.strip() else 0
    direct_score = _text_quality_score(direct_text)

    # Step 2: If direct text is trustworthy, use it
    if direct_word_count >= MIN_WORDS_FOR_TEXT_PAGE and _direct_text_is_trustworthy(direct_text):
        return direct_text, direct_word_count, 1.0, False, 'direct'

    # Step 3: OCR the page — try multiple variants and configs
    ocr_text, ocr_confidence, ocr_success, ocr_source = _best_ocr_result_from_page(page, page_index)
    ocr_word_count = len(ocr_text.split()) if ocr_text.strip() else 0
    ocr_score = _text_quality_score(ocr_text)

    # Step 4: Pick the better result
    if ocr_success and ocr_score >= direct_score + 10:
        return ocr_text, ocr_word_count, ocr_confidence, True, ocr_source

    # OCR didn't beat direct — use direct as fallback if it has content
    if direct_word_count > 0 and direct_score >= ocr_score:
        return direct_text, direct_word_count, 1.0, False, 'direct fallback'

    # OCR is at least something
    if ocr_success and ocr_word_count > 0:
        return ocr_text, ocr_word_count, ocr_confidence, True, ocr_source

    # Last resort: whatever direct had
    return direct_text, direct_word_count, 0.5, False, 'direct (low quality)'


# =========================================================
# MAIN EXTRACTION
# =========================================================

def extract(file_path, on_progress=None):
    """Extract text from PDF. Smart decision per page: direct → validate → OCR.
    on_progress(current_page, total_pages, log_line) called per page."""
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
        page = document[page_index]

        page_text, page_word_count, page_confidence, page_was_ocr, page_source = _extract_page_text(page, page_index)

        if page_was_ocr:
            has_ocr_pages = True
            logger.info('Page %d: %s — %d words', page_index + 1, page_source, page_word_count)

        # Report progress with per-page log line
        if on_progress:
            log_line = f'Page {page_index + 1}: {page_source} — {page_word_count} words'
            on_progress(page_index + 1, total_pages, log_line)

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
