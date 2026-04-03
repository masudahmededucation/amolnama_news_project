"""Core utilities — shared across all apps."""

import re
import unicodedata


def get_user_avatar_url(user_profile):
    """Get avatar URL for a user profile. Shared across all apps."""
    if not user_profile or not user_profile.link_avatar_asset_id:
        return None
    from django.db import connection
    with connection.cursor() as cursor:
        cursor.execute(
            "SELECT '/media/' + [file_storage_path] FROM [media].[asset] WHERE [asset_id] = %s AND [is_active] = 1",
            [user_profile.link_avatar_asset_id],
        )
        row = cursor.fetchone()
    return row[0] if row else None


def bangla_slugify(text, max_length=450):
    """Generate a URL-safe slug that preserves Bengali characters (matras, conjuncts, chandrabindu).

    Django's built-in slugify(allow_unicode=True) uses NFKD normalization which
    strips Bengali vowel marks (া, ে, ি, ু, ্, ়, etc.). This function uses NFC
    normalization instead, preserving the full Bengali text.

    Supports mixed Bengali + English text: 'কক্সবাজার (Cox Bazar)' → 'কক্সবাজার-cox-bazar'
    """
    text = str(text)
    # NFC normalization preserves Bengali matras (unlike NFKD which strips them)
    text = unicodedata.normalize('NFC', text)
    # Replace whitespace and underscores with hyphens
    text = re.sub(r'[\s_]+', '-', text)
    # Keep Bengali chars (U+0980-U+09FF), word chars (a-z, 0-9), hyphens
    text = re.sub(r'[^\u0980-\u09FF\w-]', '', text)
    # Collapse multiple hyphens
    text = re.sub(r'-+', '-', text).strip('-')
    # Lowercase (only affects Latin characters)
    text = text.lower()
    return text[:max_length] if text else ''


def generate_username_handle(display_name):
    """Generate a unique @username handle from display name.

    Rules:
    - Lowercase alphanumeric + underscores only (no Bengali, no special chars)
    - Max 30 characters
    - If collision, appends incrementing number: middleeasteye, middleeasteye1, middleeasteye2
    - No email, no date — clean and professional
    """
    from amolnama_news.site_apps.user_account.models import UserProfile

    if not display_name:
        display_name = 'user'

    # Transliterate Bengali to approximate English (basic mapping)
    # For Bengali names, just strip non-ASCII and use whatever English chars remain
    text = str(display_name).lower().strip()
    # Remove everything except a-z, 0-9, spaces
    text = re.sub(r'[^a-z0-9\s]', '', text)
    # Replace spaces with nothing (no separators — like X)
    text = re.sub(r'\s+', '', text)

    if not text:
        text = 'user'

    # Trim to 30 chars (leave room for number suffix)
    base_handle = text[:25]

    # Check uniqueness
    candidate = base_handle
    counter = 1
    while UserProfile.objects.filter(username_handle=candidate).exists():
        candidate = f'{base_handle}{counter}'
        counter += 1

    return candidate
