"""Core utilities — shared across all apps."""

import logging
import re
import unicodedata
from html import escape as html_escape
from html.parser import HTMLParser

logger = logging.getLogger(__name__)


# ============================================================
# HTML SANITIZER — gold-standard shared implementation
# ============================================================
#
# Whitelist-based HTML sanitizer for user-submitted rich text (Quill editor
# output) used by newshub article body, bangladesh destination descriptions,
# and any other app that stores user-provided formatted text.
#
# Uses stdlib html.parser.HTMLParser instead of regex — regex-based sanitizers
# are vulnerable to malformed input bypasses like `<scr<script>ipt>`,
# uppercase variants, attribute-wrapping tricks, and nested tag confusion.
# A real parser normalizes these into a tree we can safely whitelist.
#
# Allowed tags and attributes are deliberately minimal. If you need more,
# add them here — don't fork this function.

_SANITIZE_ALLOWED_TAGS = frozenset({
    'p', 'br', 'hr',
    'strong', 'b', 'em', 'i', 'u', 's', 'strike', 'sub', 'sup',
    'a',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'ul', 'ol', 'li',
    'blockquote', 'code', 'pre',
    'span', 'div',
})

# Tags whose contents must also be dropped (never rendered), not just unwrapped.
# For most disallowed tags we unwrap (keep text). For these we drop everything.
_SANITIZE_DROP_CONTENT_TAGS = frozenset({
    'script', 'style', 'iframe', 'object', 'embed', 'form',
    'svg', 'math', 'noscript', 'template', 'applet', 'base',
    'link', 'meta', 'frame', 'frameset',
})

_SANITIZE_ALLOWED_ATTRS_BY_TAG = {
    'a': frozenset({'href', 'title', 'rel', 'target'}),
    'span': frozenset({'class'}),
    'div': frozenset({'class'}),
    'p': frozenset({'class'}),
    'blockquote': frozenset({'class'}),
    'code': frozenset({'class'}),
    'pre': frozenset({'class'}),
    'h1': frozenset({'class'}),
    'h2': frozenset({'class'}),
    'h3': frozenset({'class'}),
    'h4': frozenset({'class'}),
    'h5': frozenset({'class'}),
    'h6': frozenset({'class'}),
    'ul': frozenset({'class'}),
    'ol': frozenset({'class'}),
    'li': frozenset({'class'}),
}

_SANITIZE_VOID_TAGS = frozenset({'br', 'hr'})

_SANITIZE_SAFE_URL_SCHEMES = frozenset({'http', 'https', 'mailto', 'tel'})


def _sanitize_is_safe_url(url):
    """Return True if URL has a safe scheme or is relative/fragment."""
    if not url:
        return False
    url_stripped = url.strip()
    if not url_stripped:
        return False
    # Relative URLs, fragments, and path-only URLs are safe
    if url_stripped.startswith(('/', '#', '?')):
        return True
    # Check for scheme
    if ':' not in url_stripped:
        return True  # no scheme = relative
    scheme = url_stripped.split(':', 1)[0].strip().lower()
    # Strip any whitespace/control characters that might hide the real scheme
    scheme = re.sub(r'[\s\x00-\x1f]', '', scheme)
    return scheme in _SANITIZE_SAFE_URL_SCHEMES


class _SanitizingHTMLParser(HTMLParser):
    """Whitelist-based HTML sanitizer.

    - Allowed tags are re-emitted with only whitelisted attributes.
    - Disallowed tags in DROP_CONTENT_TAGS drop both tag and content.
    - Other disallowed tags are unwrapped (content kept, tag removed).
    - Text is HTML-escaped (handled by the parser giving us raw text which
      we then escape on output).
    - URL schemes for href are validated — javascript:, vbscript:, data:
      are rejected.
    """

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self._output_parts = []
        self._drop_depth = 0  # >0 while inside a drop-content tag

    def handle_starttag(self, tag, attrs):
        tag = tag.lower()
        if tag in _SANITIZE_DROP_CONTENT_TAGS:
            self._drop_depth += 1
            return
        if self._drop_depth > 0:
            return
        if tag not in _SANITIZE_ALLOWED_TAGS:
            return  # unwrap: drop the tag, keep the content
        allowed_attrs = _SANITIZE_ALLOWED_ATTRS_BY_TAG.get(tag, frozenset())
        safe_attrs = []
        for attr_name, attr_value in attrs:
            if not attr_name:
                continue
            attr_name_lower = attr_name.lower()
            # Block ALL event handlers defensively (on* attributes) and
            # style attributes (can contain expression()/url(javascript:))
            if attr_name_lower.startswith('on') or attr_name_lower == 'style':
                continue
            if attr_name_lower not in allowed_attrs:
                continue
            if attr_value is None:
                safe_attrs.append((attr_name_lower, ''))
                continue
            # URL scheme validation for href
            if attr_name_lower == 'href':
                if not _sanitize_is_safe_url(attr_value):
                    attr_value = '#'
            # Force safe defaults on links
            safe_attrs.append((attr_name_lower, attr_value))
        # For <a> tags, force rel="noopener noreferrer" when target=_blank
        if tag == 'a':
            has_target_blank = any(
                k == 'target' and (v or '').lower() == '_blank'
                for k, v in safe_attrs
            )
            if has_target_blank:
                safe_attrs = [(k, v) for k, v in safe_attrs if k != 'rel']
                safe_attrs.append(('rel', 'noopener noreferrer'))
        attr_str = ''.join(
            ' {}="{}"'.format(k, html_escape(v, quote=True))
            for k, v in safe_attrs
        )
        if tag in _SANITIZE_VOID_TAGS:
            self._output_parts.append('<{}{} />'.format(tag, attr_str))
        else:
            self._output_parts.append('<{}{}>'.format(tag, attr_str))

    def handle_endtag(self, tag):
        tag = tag.lower()
        if tag in _SANITIZE_DROP_CONTENT_TAGS:
            if self._drop_depth > 0:
                self._drop_depth -= 1
            return
        if self._drop_depth > 0:
            return
        if tag not in _SANITIZE_ALLOWED_TAGS:
            return
        if tag in _SANITIZE_VOID_TAGS:
            return
        self._output_parts.append('</{}>'.format(tag))

    def handle_startendtag(self, tag, attrs):
        # Self-closing tags like <br/> or <img/>
        self.handle_starttag(tag, attrs)
        if tag.lower() not in _SANITIZE_VOID_TAGS and tag.lower() in _SANITIZE_ALLOWED_TAGS:
            self.handle_endtag(tag)

    def handle_data(self, data):
        if self._drop_depth > 0:
            return
        self._output_parts.append(html_escape(data, quote=False))

    def get_sanitized_html(self):
        return ''.join(self._output_parts)


def sanitize_user_html(html):
    """Sanitize user-submitted rich text HTML via a whitelist parser.

    Safe to render with |safe in templates. Use this for any HTML coming from
    a WYSIWYG editor (Quill, TinyMCE, etc.) before storing it in the DB.

    Returns empty string for None/empty input. Never raises — on parse error,
    returns the HTML-escaped original so nothing is ever rendered as live HTML.
    """
    if not html:
        return html
    parser = _SanitizingHTMLParser()
    try:
        parser.feed(html)
        parser.close()
        return parser.get_sanitized_html().strip()
    except Exception:
        logger.exception('sanitize_user_html failed; returning escaped original')
        return html_escape(html, quote=True)


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


# Bookmark functions live in the content app (shared blog/content feature).
# Re-exported here so legacy imports keep working.
from amolnama_news.site_apps.content.bookmarks import (  # noqa: F401
    get_content_type_metadata,
    toggle_bookmark,
    is_bookmarked,
    get_bookmark_count,
)


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


def build_actions_bar_author_context(author_user_profile_id, request, profile_suffix=''):
    """Build template context for the writer section of actions-bar.
    Returns dict with actions_bar_author_* keys. Shared across all content apps.

    Args:
        profile_suffix: URL suffix after /social/@handle/. Use 'articles/' for newshub.

    Usage in views:
        from core.utils import build_actions_bar_author_context
        context.update(build_actions_bar_author_context(author_profile_id, request))
        context.update(build_actions_bar_author_context(author_profile_id, request, profile_suffix='articles/'))
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
        'actions_bar_author_profile_suffix': profile_suffix,
    }


def build_related_content_items(text, content_type_code, content_id, limit=5):
    """Return related content from newsengine cache. Instant — single DB read.

    Cache miss returns [] so page renders immediately without blocking.
    Background compute is triggered separately on content create/update.

    Usage in views:
        from core.utils import build_related_content_items
        related = build_related_content_items(post_text, 'post', post_id)
        context['related_content_items'] = related
    """
    try:
        from amolnama_news.site_apps.newsengine.related_content import get_cached_related_content
        return get_cached_related_content(content_type_code, content_id)
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
        'query': "SELECT poem_title_bn, poem_slug, poem_author_display_name FROM [blog_poem].[coll_poem_entry] WHERE blog_poem_coll_poem_entry_id = %s AND is_active = 1",
        'title_index': 0,
        'slug_index': 1,
        'url_template': '/bangla-kobita-gaan/{slug}/',
        'url_fallback': '/bangla-kobita-gaan/',
        'author_index': 2,
    },
    'story': {
        'query': "SELECT story_title_bn, story_slug FROM [blog_stories].[coll_story] WHERE blog_stories_coll_story_id = %s AND is_active = 1",
        'title_index': 0,
        'slug_index': 1,
        'url_template': '/stories-for-kids/{slug}/',
        'url_fallback': '/stories-for-kids/',
    },
    'art': {
        'query': "SELECT artwork_title_bn, artwork_slug FROM [blog_art].[coll_artwork] WHERE blog_art_coll_artwork_id = %s AND is_active = 1",
        'title_index': 0,
        'slug_index': 1,
        'url_template': '/art/{slug}/',
        'url_fallback': '/art/',
    },
    'destination': {
        'query': "SELECT destination_name_bn, destination_slug FROM [blog_bangladesh].[coll_destination] WHERE blog_bangladesh_coll_destination_id = %s AND is_active = 1",
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
