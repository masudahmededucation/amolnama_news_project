"""PaddleOCR extraction engine — fast Bengali PDF OCR via Python 3.13 sidecar.
Runs ocr_worker.py in a separate Python 3.13 venv with PaddleOCR (5x faster than EasyOCR).
Used as fallback when PyMuPDF detects garbled font encoding in Bengali PDFs."""

import json
import logging
import os
import subprocess

logger = logging.getLogger(__name__)

# Path to the Python 3.13 venv (relative to project root)
_OCR_VENV_PYTHON = None


def _get_venv_python():
    """Find the Python 3.13 venv executable."""
    global _OCR_VENV_PYTHON
    if _OCR_VENV_PYTHON:
        return _OCR_VENV_PYTHON

    # Look for ocr_venv relative to project root
    from django.conf import settings
    project_root = settings.BASE_DIR
    venv_python = os.path.join(project_root, 'ocr_venv', 'Scripts', 'python.exe')

    if not os.path.exists(venv_python):
        # Try Unix path
        venv_python = os.path.join(project_root, 'ocr_venv', 'bin', 'python')

    if not os.path.exists(venv_python):
        return None

    _OCR_VENV_PYTHON = venv_python
    return _OCR_VENV_PYTHON


def is_available():
    """Check if PaddleOCR sidecar is available."""
    return _get_venv_python() is not None


def extract(file_path, on_progress=None):
    """Extract text from PDF using PaddleOCR via subprocess.
    Returns same format as other engines."""
    venv_python = _get_venv_python()
    if not venv_python:
        return {'success': False, 'error': 'PaddleOCR venv not found (ocr_venv/Scripts/python.exe)'}

    # Path to the worker script
    worker_script = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'ocr_worker.py')
    if not os.path.exists(worker_script):
        return {'success': False, 'error': 'ocr_worker.py not found'}

    logger.info('Starting PaddleOCR sidecar for: %s', os.path.basename(file_path))

    try:
        process = subprocess.run(
            [venv_python, worker_script, file_path],
            capture_output=True,
            text=True,
            encoding='utf-8',
            timeout=600,  # 10 minute max
        )

        if process.returncode != 0:
            error_message = process.stderr.strip()[-500:] if process.stderr else 'Unknown error'
            return {'success': False, 'error': f'PaddleOCR failed: {error_message}'}

        # Parse JSON output from worker
        result = json.loads(process.stdout)
        return result

    except subprocess.TimeoutExpired:
        return {'success': False, 'error': 'PaddleOCR timed out (10 min limit)'}
    except json.JSONDecodeError as json_error:
        return {'success': False, 'error': f'Invalid output from PaddleOCR worker: {str(json_error)}'}
    except Exception as unexpected_error:
        return {'success': False, 'error': f'PaddleOCR subprocess error: {str(unexpected_error)}'}
