"""Text extraction engines — route files to the correct processor."""

import os
import logging

logger = logging.getLogger(__name__)

# Extension → engine code mapping (easyocr for images — better accuracy with preprocessing)
EXTENSION_ENGINE_MAP = {
    '.jpg': 'easyocr', '.jpeg': 'easyocr', '.png': 'easyocr',
    '.bmp': 'easyocr', '.tiff': 'easyocr', '.webp': 'easyocr',
    '.pdf': 'pymupdf',
    '.mp3': 'whisper', '.mp4': 'whisper', '.wav': 'whisper',
    '.mkv': 'whisper', '.flac': 'whisper', '.m4a': 'whisper',
    '.txt': 'plaintext', '.csv': 'plaintext', '.log': 'plaintext',
    '.md': 'plaintext', '.html': 'plaintext',
}


def get_engine_code_for_extension(extension):
    """Return the engine code for a given file extension."""
    return EXTENSION_ENGINE_MAP.get(extension.lower())


def extract_text(file_path, engine_code=None, on_progress=None):
    """Route file to the correct extraction engine. Returns dict with text, confidence, metadata.
    on_progress(current, total) callback for real-time progress updates."""
    extension = os.path.splitext(file_path)[1].lower()

    if not engine_code:
        engine_code = get_engine_code_for_extension(extension)

    if not engine_code:
        return {'success': False, 'error': f'Unsupported file type: {extension}'}

    try:
        if engine_code == 'tesseract':
            from .textextractor_engine_image_tesseract_simple import extract as engine_extract
        elif engine_code == 'easyocr':
            from .textextractor_engine_image_easyocr import extract as engine_extract
        elif engine_code == 'tesseract_image':
            from .textextractor_engine_image_tesseract import extract as engine_extract
        elif engine_code == 'whisper':
            from .textextractor_engine_audio_whisper import extract as engine_extract
        elif engine_code == 'pymupdf':
            from .textextractor_engine_pdf_pymupdf import extract as engine_extract
        elif engine_code == 'paddleocr':
            from .textextractor_engine_pdf_paddleocr import extract as engine_extract
        elif engine_code == 'plaintext':
            from .textextractor_engine_plaintext import extract as engine_extract
        else:
            return {'success': False, 'error': f'Unknown engine: {engine_code}'}

        # Pass on_progress to engines that support it (pymupdf)
        import inspect
        if on_progress and 'on_progress' in inspect.signature(engine_extract).parameters:
            result = engine_extract(file_path, on_progress=on_progress)
        else:
            result = engine_extract(file_path)
        result['engine_code'] = engine_code
        return result

    except Exception as extraction_error:
        logger.exception('Extraction failed for %s with engine %s', file_path, engine_code)
        return {'success': False, 'error': str(extraction_error), 'engine_code': engine_code}
