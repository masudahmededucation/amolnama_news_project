"""Core utilities — shared across all apps."""

import logging
import re
import unicodedata

logger = logging.getLogger(__name__)


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


def get_user_profile_id(request):
    """Get current user's profile ID or None. Shared across all apps."""
    if not request.user.is_authenticated:
        return None
    try:
        from amolnama_news.site_apps.user_account.models import UserProfile
        return UserProfile.objects.get(link_user_account_user_id=request.user.pk).user_profile_id
    except UserProfile.DoesNotExist:
        return None
    except Exception as profile_lookup_error:
        logger.error('get_user_profile_id failed for user %s — %s', request.user.pk, profile_lookup_error)
        return None


def time_ago(dt):
    """Bengali time-ago string. Shared across all apps."""
    if not dt:
        return ''
    from django.utils import timezone as tz
    diff = tz.now() - dt
    seconds = int(diff.total_seconds())
    if seconds < 60:
        return 'এইমাত্র'
    minutes = seconds // 60
    if minutes < 60:
        return f'{minutes} মিনিট আগে'
    hours = minutes // 60
    if hours < 24:
        return f'{hours} ঘণ্টা আগে'
    days = hours // 24
    if days < 7:
        return f'{days} দিন আগে'
    return dt.strftime('%d %b %Y')


def normalize_text(text):
    """NFC normalize + lowercase for consistent Bengali text matching. Shared across all apps."""
    if not text:
        return ''
    return unicodedata.normalize('NFC', text.strip().lower())


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


def build_actions_bar_author_context(author_user_profile_id, request):
    """Build template context for the writer section of actions-bar.
    Returns dict with actions_bar_author_* keys. Shared across all content apps.

    Usage in views:
        from core.utils import build_actions_bar_author_context
        context.update(build_actions_bar_author_context(author_profile_id, request))
    """
    from amolnama_news.site_apps.user_account.models import UserProfile

    if not author_user_profile_id:
        return {}

    try:
        author_profile = UserProfile.objects.get(user_profile_id=author_user_profile_id)
    except UserProfile.DoesNotExist:
        return {}

    # Check if current user is the author
    current_user_profile_id = None
    is_own = False
    is_following = False
    if request.user.is_authenticated:
        try:
            current_profile = UserProfile.objects.get(link_user_account_user_id=request.user.pk)
            current_user_profile_id = current_profile.user_profile_id
            is_own = current_user_profile_id == author_user_profile_id
            if not is_own:
                from amolnama_news.site_apps.social.models import UserFollow
                is_following = UserFollow.objects.filter(
                    link_follower_user_profile_id=current_user_profile_id,
                    link_following_user_profile_id=author_user_profile_id,
                    is_active=True,
                ).exists()
        except UserProfile.DoesNotExist:
            pass

    return {
        'actions_bar_author_display_name': author_profile.display_name or '',
        'actions_bar_author_username_handle': author_profile.username_handle or '',
        'actions_bar_author_user_profile_id': author_user_profile_id,
        'actions_bar_author_is_own': is_own,
        'actions_bar_author_is_following': is_following,
    }


def build_related_content_items(text, content_type_code, content_id, limit=5):
    """Find semantically similar content using vector embeddings.
    Returns list of dicts ready for the related-content.html template.

    Falls back to empty list if embeddings not available or no matches.

    Usage in views:
        from core.utils import build_related_content_items
        related = build_related_content_items(post_text, 'post', post_id)
        context['related_content_items'] = related
    """

    CONTENT_TYPE_LABELS = {
        'post': 'পোস্ট',
        'poem': 'কবিতা',
        'story': 'গল্প',
        'art': 'শিল্পকলা',
        'article': 'নিবন্ধ',
        'debate': 'বিতর্ক',
        'destination': 'ভ্রমণ',
    }

    try:
        from amolnama_news.site_apps.newsengine.embeddings import find_similar_content_cross_type
        similar_items = find_similar_content_cross_type(
            text, limit=limit,
            exclude_type=content_type_code, exclude_id=content_id,
        )

        if not similar_items:
            return []

        # Enrich with actual titles and URLs
        results = []
        for item in similar_items:
            item_type = item['content_type_code']
            item_id = item['content_id']
            enriched = _enrich_related_content_item(item_type, item_id)
            if enriched:
                enriched['content_type_label'] = CONTENT_TYPE_LABELS.get(item_type, item_type)
                enriched['similarity'] = item['similarity']
                results.append(enriched)

        return results

    except Exception as related_error:
        logger.error('build_related_content_items failed for %s:%s — %s',
                     content_type_code, content_id, related_error)
        return []


# Data-driven config for related content enrichment — one source of truth
_RELATED_CONTENT_ENRICHMENT_MAP = {
    'post': {
        'query': "SELECT post_text, post_post_id FROM [post].[coll_post] WHERE post_post_id = %s AND is_active = 1",
        'title_index': 0,
        'slug_index': 1,
        'url_template': '/post/{slug}/',
        'author_index': None,
        'title_max_length': 80,
    },
    'poem': {
        'query': "SELECT poem_title_bn, poem_slug, poem_author_display_name FROM [poem].[coll_poem_entry] WHERE poem_coll_poem_entry_id = %s AND is_active = 1",
        'title_index': 0,
        'slug_index': 1,
        'url_template': '/bangla-kobita-gaan/{slug}/',
        'url_fallback': '/bangla-kobita-gaan/',
        'author_index': 2,
    },
    'story': {
        'query': "SELECT story_title_bn, story_slug FROM [stories].[coll_story] WHERE story_coll_story_id = %s AND is_active = 1",
        'title_index': 0,
        'slug_index': 1,
        'url_template': '/stories-for-kids/{slug}/',
        'url_fallback': '/stories-for-kids/',
    },
    'art': {
        'query': "SELECT artwork_title_bn, artwork_slug FROM [art].[coll_artwork] WHERE art_coll_artwork_id = %s AND is_active = 1",
        'title_index': 0,
        'slug_index': 1,
        'url_template': '/art/{slug}/',
        'url_fallback': '/art/',
    },
    'destination': {
        'query': "SELECT destination_name_bn, destination_slug FROM [bangladesh].[coll_destination] WHERE bangladesh_coll_destination_id = %s AND is_active = 1",
        'title_index': 0,
        'slug_index': 1,
        'url_template': '/bangladesh-tourist-destinations/travel/{slug}/',
        'url_fallback': '/bangladesh-tourist-destinations/travel/',
    },
}


def _enrich_related_content_item(content_type_code, content_id):
    """Fetch title, URL, author name for a related content item.
    Uses data-driven config map — zero duplication."""
    config = _RELATED_CONTENT_ENRICHMENT_MAP.get(content_type_code)
    if not config:
        return None

    try:
        from django.db import connection
        with connection.cursor() as cursor:
            cursor.execute(config['query'], [content_id])
            row = cursor.fetchone()

        if not row:
            return None

        title = (row[config['title_index']] or '')
        if config.get('title_max_length'):
            title = title[:config['title_max_length']]

        slug = row[config['slug_index']]
        url = config['url_template'].format(slug=slug) if slug else config.get('url_fallback', '/')

        author_name = None
        if config.get('author_index') is not None and len(row) > config['author_index']:
            author_name = row[config['author_index']] or None

        return {
            'title': title,
            'url': url,
            'author_name': author_name,
        }

    except Exception as enrich_error:
        logger.error('_enrich_related_content_item failed for %s:%s — %s',
                     content_type_code, content_id, enrich_error)
        return None
