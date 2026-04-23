"""bookwriter image uploads — single-file uploader for chapter prose
inline images.

Returns the public URL the JS module embeds into chapter_text_html
as <img src="...">. The matching sanitiser path
(views_api_helpers.sanitize_chapter_prose_html) only allows src values
that begin with '/media/upload/bookwriter/chapter/' — keep the
storage prefix in lock-step with that validator.

Pure file-system writes — no DB mutation. The img tag persists with
the chapter's HTML via the chapter autosave endpoint.

Validation:
  * MIME via uploaded_file.content_type — JPG / PNG / WEBP / GIF only
  * Size cap 5 MB
  * Pillow image.verify() — confirms the bytes are an actual image
    (rejects spoofed extensions and image bombs at the parser level)
  * SVG explicitly rejected (can carry script via <foreignObject> /
    inline event handlers)
"""
import logging
import os
import uuid

from django.conf import settings


IMAGE_EXTENSION_MAP_BY_CONTENT_TYPE = {
    'image/jpeg': '.jpg',
    'image/png':  '.png',
    'image/webp': '.webp',
    'image/gif':  '.gif',
}
MAX_CHAPTER_IMAGE_FILE_SIZE_BYTES = 5 * 1024 * 1024  # 5 MB
RELATIVE_STORAGE_ROOT = os.path.join('upload', 'bookwriter', 'chapter')

logger = logging.getLogger(__name__)


def upload_chapter_image(uploaded_file, chapter_id):
    """Validate + store one inline chapter image.

    Returns a dict with either:
        {'success': True, 'image_url': '/media/upload/bookwriter/chapter/<id>/<uuid>.<ext>'}
    or:
        {'success': False, 'error': '<user-facing message>'}
    """
    if uploaded_file is None:
        return {'success': False, 'error': 'No file provided.'}
    if not chapter_id:
        return {'success': False, 'error': 'Missing chapter id.'}

    content_type = (uploaded_file.content_type or '').lower()
    if content_type not in IMAGE_EXTENSION_MAP_BY_CONTENT_TYPE:
        return {'success': False, 'error': 'Only JPG, PNG, WEBP or GIF images are allowed.'}

    if uploaded_file.size > MAX_CHAPTER_IMAGE_FILE_SIZE_BYTES:
        return {'success': False, 'error': 'Image must be 5 MB or smaller.'}

    # Pillow verify — rejects spoofed extensions, broken files, and image
    # bombs at the decoder level. Cheap because it doesn't fully decode
    # pixel data, just walks the format header.
    try:
        from PIL import Image  # local import — Pillow may be heavy on cold start
    except ImportError:
        logger.warning('Pillow not installed — skipping image.verify() check')
    else:
        try:
            uploaded_file.seek(0)
            with Image.open(uploaded_file) as image_object:
                image_object.verify()
        except Exception:
            return {'success': False, 'error': 'File does not appear to be a valid image.'}
        finally:
            uploaded_file.seek(0)

    extension = IMAGE_EXTENSION_MAP_BY_CONTENT_TYPE[content_type]
    stored_file_basename = uuid.uuid4().hex + extension

    chapter_directory_relative = os.path.join(RELATIVE_STORAGE_ROOT, str(int(chapter_id)))
    chapter_directory_absolute = os.path.join(settings.MEDIA_ROOT, chapter_directory_relative)
    try:
        os.makedirs(chapter_directory_absolute, exist_ok=True)
    except OSError:
        logger.exception('Cannot create chapter image dir: %s', chapter_directory_absolute)
        return {'success': False, 'error': 'Server error while preparing storage.'}

    stored_file_path = os.path.join(chapter_directory_absolute, stored_file_basename)
    try:
        with open(stored_file_path, 'wb') as destination_file:
            for chunk in uploaded_file.chunks():
                destination_file.write(chunk)
    except OSError:
        logger.exception('Failed to save chapter image to %s', stored_file_path)
        return {'success': False, 'error': 'Server error while saving image.'}

    image_url = '{media}/{relative}/{basename}'.format(
        media=settings.MEDIA_URL.rstrip('/'),
        relative=chapter_directory_relative.replace(os.sep, '/'),
        basename=stored_file_basename,
    )
    return {
        'success': True,
        'image_url': image_url,
        'file_basename': stored_file_basename,
    }
