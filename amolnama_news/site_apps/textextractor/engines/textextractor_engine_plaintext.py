"""Plain text extraction engine — reads .txt, .csv, .log, .md, .html files."""

import os


def extract(file_path):
    """Read plain text file and return content with word count."""
    if not os.path.exists(file_path):
        return {'success': False, 'error': 'File not found'}

    if os.path.getsize(file_path) == 0:
        return {'success': True, 'text': '', 'word_count': 0, 'confidence': 1.0}

    # Try UTF-8 first, fall back to latin-1
    text = None
    for encoding in ['utf-8', 'utf-8-sig', 'latin-1']:
        try:
            with open(file_path, 'r', encoding=encoding) as source_file:
                text = source_file.read()
            break
        except (UnicodeDecodeError, ValueError):
            continue

    if text is None:
        return {'success': False, 'error': 'Could not decode file with any supported encoding'}

    word_count = len(text.split()) if text.strip() else 0

    return {
        'success': True,
        'text': text,
        'word_count': word_count,
        'confidence': 1.0,
        'pages': [],
    }
