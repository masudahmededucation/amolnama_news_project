"""PyMuPDF extraction engine — extracts text from PDF files with page structure.
Falls back to OCR for scanned/image-only pages."""

import logging
import os

logger = logging.getLogger(__name__)

# Minimum words per page to consider it "has text" (not scanned)
MIN_WORDS_FOR_TEXT_PAGE = 5


def _ocr_page_image(page, page_index):
    """Render a scanned PDF page to image and run OCR on it.
    Returns (text, confidence, success). Never crashes — returns empty on any failure."""
    try:
        from .engine_easyocr import extract as easyocr_extract
    except ImportError:
        logger.info('EasyOCR not available — skipping OCR for scanned page %d', page_index + 1)
        return '', 0.0, False

    temp_image_path = None
    try:
        pixmap = page.get_pixmap(dpi=200)
        temp_image_path = f'_temp_pdf_page_{page_index}.png'
        pixmap.save(temp_image_path)

        ocr_result = easyocr_extract(temp_image_path)

        if ocr_result.get('success'):
            return ocr_result.get('text', ''), ocr_result.get('confidence', 0.0), True
        return '', 0.0, False

    except Exception as ocr_error:
        logger.warning('OCR fallback failed for page %d: %s', page_index + 1, ocr_error)
        return '', 0.0, False
    finally:
        if temp_image_path:
            try:
                os.remove(temp_image_path)
            except OSError:
                pass


def extract(file_path, on_progress=None):
    """Extract text from PDF using PyMuPDF. Falls back to OCR for scanned pages.
    on_progress(current_page, total_pages) called per page for real-time progress."""
    try:
        import fitz  # PyMuPDF
    except ImportError:
        return {'success': False, 'error': 'PyMuPDF (fitz) not installed. Run: pip install PyMuPDF'}

    if not os.path.exists(file_path):
        return {'success': False, 'error': 'File not found'}

    try:
        document = fitz.open(file_path)
    except Exception as open_error:
        return {'success': False, 'error': f'Cannot open PDF: {str(open_error)}'}

    all_text_parts = []
    pages = []
    total_word_count = 0
    total_confidence = 0.0
    has_ocr_pages = False
    total_pages = len(document)

    for page_index in range(total_pages):
        # Report progress
        if on_progress:
            on_progress(page_index + 1, total_pages)

        page = document[page_index]
        page_text = page.get_text('text') or ''
        page_word_count = len(page_text.split()) if page_text.strip() else 0
        page_confidence = 1.0
        page_was_ocr = False

        # If page has very little text, it might be a scanned image — try OCR
        if page_word_count < MIN_WORDS_FOR_TEXT_PAGE:
            ocr_text, ocr_confidence, ocr_success = _ocr_page_image(page, page_index)
            if ocr_success and len(ocr_text.split()) > page_word_count:
                logger.info('Page %d: scanned image detected, OCR extracted %d words',
                            page_index + 1, len(ocr_text.split()))
                page_text = ocr_text
                page_word_count = len(ocr_text.split())
                page_confidence = ocr_confidence
                page_was_ocr = True
                has_ocr_pages = True

        total_word_count += page_word_count
        total_confidence += page_confidence

        # Get structured blocks for text-based pages
        block_data = []
        if not page_was_ocr:
            page_blocks = page.get_text('dict', flags=fitz.TEXT_PRESERVE_WHITESPACE)
            for block in page_blocks.get('blocks', []):
                if block.get('type') == 0:
                    for line in block.get('lines', []):
                        line_text = ''
                        for span in line.get('spans', []):
                            line_text += span.get('text', '')
                        if line_text.strip():
                            block_data.append({
                                'text': line_text,
                                'bbox': block.get('bbox'),
                                'font': line['spans'][0].get('font', '') if line.get('spans') else '',
                                'size': line['spans'][0].get('size', 0) if line.get('spans') else 0,
                                'flags': line['spans'][0].get('flags', 0) if line.get('spans') else 0,
                            })

        pages.append({
            'page_number': page_index + 1,
            'text': page_text,
            'word_count': page_word_count,
            'structured_blocks': block_data,
            'was_ocr': page_was_ocr,
        })

        all_text_parts.append(page_text)

    document.close()

    combined_text = '\n\n'.join(all_text_parts)
    average_confidence = total_confidence / len(pages) if pages else 1.0

    # Extract tables using pdfplumber
    tables_data = _extract_tables(file_path)

    return {
        'success': True,
        'text': combined_text,
        'word_count': total_word_count,
        'page_count': len(pages),
        'confidence': round(average_confidence, 4),
        'has_ocr_pages': has_ocr_pages,
        'pages': pages,
        'tables': tables_data,
    }


def _extract_tables(file_path):
    """Extract tables from PDF using pdfplumber. Returns list of table dicts."""
    try:
        import pdfplumber
    except ImportError:
        return []

    tables = []
    try:
        with pdfplumber.open(file_path) as pdf:
            for page_index, page in enumerate(pdf.pages):
                page_tables = page.extract_tables()
                for table_index, table_data in enumerate(page_tables):
                    if not table_data or len(table_data) < 2:
                        continue
                    # Convert to CSV string
                    csv_rows = []
                    for row in table_data:
                        csv_rows.append(','.join(cell or '' for cell in row))
                    tables.append({
                        'page_number': page_index + 1,
                        'table_index': table_index,
                        'row_count': len(table_data),
                        'column_count': len(table_data[0]) if table_data else 0,
                        'csv': '\n'.join(csv_rows),
                    })
    except Exception as table_error:
        logger.warning('Table extraction failed: %s', table_error)

    return tables
