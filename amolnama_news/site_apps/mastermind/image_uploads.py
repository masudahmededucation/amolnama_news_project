"""Mastermind image uploads — single-file uploader for question / option images.

Returns a public URL string that the caller can store in
coll_question.question_image_url or coll_question_option.option_image_url.

Validates type + size, generates a UUID-based filename to prevent collisions,
and stores under MEDIA_ROOT/mastermind/{scope}/. Scope is 'question' or 'option'
so storage is partitioned cleanly.

Pure file-system writes — no DB mutation here. The caller is responsible for
patching the URL into the question / option row.
"""
import logging
import os
import uuid

from django.conf import settings


IMAGE_EXTENSION_MAP = {
    'image/jpeg': '.jpg',
    'image/png':  '.png',
    'image/webp': '.webp',
    'image/gif':  '.gif',
}
MAX_UPLOAD_FILE_SIZE_BYTES = 5 * 1024 * 1024  # 5 MB
ALLOWED_SCOPES = ('question', 'option')

logger = logging.getLogger(__name__)


def upload_question_image(uploaded_file, scope='question'):
    """Validate + store one image. Returns dict with success / image_url / error."""
    if uploaded_file is None:
        return {'success': False, 'error': 'No file provided.'}

    if scope not in ALLOWED_SCOPES:
        return {'success': False, 'error': f'Invalid scope: {scope}.'}

    content_type = (uploaded_file.content_type or '').lower()
    if content_type not in IMAGE_EXTENSION_MAP:
        return {'success': False, 'error': 'Only JPG, PNG, WEBP, or GIF images are allowed.'}

    if uploaded_file.size > MAX_UPLOAD_FILE_SIZE_BYTES:
        return {'success': False, 'error': 'Image must be 5 MB or smaller.'}

    extension = IMAGE_EXTENSION_MAP[content_type]
    file_basename = f'{uuid.uuid4().hex}{extension}'

    relative_directory = os.path.join('mastermind', scope)
    absolute_directory = os.path.join(settings.MEDIA_ROOT, relative_directory)
    os.makedirs(absolute_directory, exist_ok=True)
    absolute_path = os.path.join(absolute_directory, file_basename)

    try:
        with open(absolute_path, 'wb') as destination:
            for chunk in uploaded_file.chunks():
                destination.write(chunk)
    except OSError:
        logger.exception('Failed to save uploaded image to %s', absolute_path)
        return {'success': False, 'error': 'Server error while saving image.'}

    image_url = f'{settings.MEDIA_URL.rstrip("/")}/{relative_directory}/{file_basename}'.replace(os.sep, '/')
    return {
        'success': True,
        'image_url': image_url,
        'file_basename': file_basename,
        'scope': scope,
    }
