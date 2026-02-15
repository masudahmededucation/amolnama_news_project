import os

from django.conf import settings


# Map asset_type_category_name → subfolder under NEWSHUB_UPLOAD_DIR
CATEGORY_FOLDER_MAP = {
    'image': 'image',
    'video': 'video',
    'audio': 'audio',
}

# Anything that doesn't match a known category lands here
DEFAULT_FOLDER = 'files'


def get_newshub_upload_path(asset_type_category_name=None):
    """Return the absolute upload directory for a given asset category.

    Examples:
        get_newshub_upload_path('image')  → MEDIA_ROOT/upload/newshub/image
        get_newshub_upload_path('video')  → MEDIA_ROOT/upload/newshub/video
        get_newshub_upload_path('audio')  → MEDIA_ROOT/upload/newshub/audio
        get_newshub_upload_path(None)     → MEDIA_ROOT/upload/newshub/files
        get_newshub_upload_path('other')  → MEDIA_ROOT/upload/newshub/files
    """
    category = (asset_type_category_name or '').strip().lower()
    folder = CATEGORY_FOLDER_MAP.get(category, DEFAULT_FOLDER)
    return os.path.join(settings.MEDIA_ROOT, settings.NEWSHUB_UPLOAD_DIR, folder)


def get_newshub_upload_relative(asset_type_category_name=None):
    """Return the upload path relative to MEDIA_ROOT (for DB storage).

    Examples:
        get_newshub_upload_relative('video')  → 'upload/newshub/video'
    """
    category = (asset_type_category_name or '').strip().lower()
    folder = CATEGORY_FOLDER_MAP.get(category, DEFAULT_FOLDER)
    return os.path.join(settings.NEWSHUB_UPLOAD_DIR, folder)
