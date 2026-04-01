"""OCR Worker — runs in Python 3.13 venv with PaddleOCR for fast Bengali PDF extraction.
Called by the main app via subprocess. Takes PDF path, outputs JSON to stdout."""

import json
import os
import sys
import time

# MUST be set BEFORE importing paddle — disables PIR executor (Windows oneDNN/PIR crash)
os.environ['FLAGS_enable_pir_api'] = '0'
os.environ['PPOCR_LOG_LEVEL'] = '0'

from pathlib import Path

import cv2
import fitz
import numpy as np
from paddleocr import PaddleOCR


def _build_ocr_engine():
    """Build PaddleOCR with stable settings for Windows CPU."""
    return PaddleOCR(
        ocr_version='PP-OCRv4',
        use_doc_orientation_classify=False,
        use_doc_unwarping=False,
        use_textline_orientation=False,
        enable_mkldnn=False,
        cpu_threads=4,
        device='cpu',
    )


def _page_to_bgr_image(page, dpi=150):
    """Render PDF page to BGR numpy array at given DPI."""
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


def _extract_text_from_result(result_object):
    """Extract recognized text from PaddleOCR 3.x result object."""
    data = result_object.json if hasattr(result_object, 'json') else None
    if callable(data):
        data = data()

    if not data and hasattr(result_object, 'to_json'):
        data = result_object.to_json()

    if isinstance(data, str):
        data = json.loads(data)

    if not isinstance(data, dict):
        return ''

    # PaddleOCR 3.x output structure
    recognized_texts = data.get('res', {}).get('rec_texts')
    if isinstance(recognized_texts, list):
        return '\n'.join(text for text in recognized_texts if isinstance(text, str) and text.strip())

    # Fallback keys
    texts = []
    for key in ('rec_texts', 'texts'):
        value = data.get(key)
        if isinstance(value, list):
            texts.extend([text for text in value if isinstance(text, str) and text.strip()])

    return '\n'.join(texts)


def extract_pdf(pdf_path):
    """Extract text from PDF using PaddleOCR. Returns dict with pages and metadata."""
    start_time = time.time()

    pdf_path = Path(pdf_path)
    if not pdf_path.exists():
        return {'success': False, 'error': f'PDF not found: {pdf_path}'}

    ocr_engine = _build_ocr_engine()
    document = fitz.open(pdf_path)
    total_pages = len(document)

    pages = []
    all_text_parts = []

    for page_index in range(total_pages):
        page = document[page_index]
        image = _page_to_bgr_image(page, dpi=150)

        # PaddleOCR 3.x API: predict() not ocr()
        results = ocr_engine.predict(image)

        page_text_parts = []
        for result_object in results:
            text = _extract_text_from_result(result_object)
            if text.strip():
                page_text_parts.append(text.strip())

        page_text = '\n'.join(page_text_parts).strip()
        page_word_count = len(page_text.split()) if page_text.strip() else 0

        pages.append({
            'page_number': page_index + 1,
            'text': page_text,
            'word_count': page_word_count,
        })
        all_text_parts.append(page_text)

        # Progress to stderr
        elapsed = time.time() - start_time
        print(f'Page {page_index + 1}/{total_pages} done ({page_word_count} words, {elapsed:.1f}s)', file=sys.stderr)
        sys.stderr.flush()

    document.close()

    combined_text = '\n\n'.join(all_text_parts)
    total_word_count = sum(page['word_count'] for page in pages)
    processing_time = int((time.time() - start_time) * 1000)

    return {
        'success': True,
        'text': combined_text,
        'word_count': total_word_count,
        'page_count': total_pages,
        'confidence': 0.90,
        'detected_language': 'bn',
        'processing_time_milliseconds': processing_time,
        'pages': pages,
    }


if __name__ == '__main__':
    if len(sys.argv) != 2:
        print(json.dumps({'success': False, 'error': 'Usage: ocr_worker.py <pdf_path>'}))
        sys.exit(2)

    pdf_file_path = sys.argv[1]

    try:
        result = extract_pdf(pdf_file_path)
        print(json.dumps(result, ensure_ascii=False))
    except Exception as unexpected_error:
        print(json.dumps({'success': False, 'error': f'{type(unexpected_error).__name__}: {str(unexpected_error)}'}))
        sys.exit(1)
