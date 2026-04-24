"""bookwriter — shared API helpers + constants.

Imported by views_api_chapter, views_api_book, views_api_writing_artifacts,
and views_api_collaboration. NEVER imports back from any of those — keeps
the dependency graph acyclic.

Owns:
  * Module-level constants (MAX_*_LENGTH, HEX_COLOR_PATTERN)
  * Owner-resolver helpers (_resolve_*_for_owner)
  * Body-parsing helpers (_read_json_body)
  * Text/HTML utilities (_strip_html_to_plain, _count_words)
  * Hex validator (_is_valid_hex_color)
  * Writing telemetry (_record_writing_progress, _refresh_book_caches)
  * Slug + token helpers (_bangla_slugify_or_fallback, _generate_share_token)
  * Reference validators (_is_valid_bible_category_code)
  * Read-only resolvers (_resolve_published_release)
"""

import json
import logging
import re
import secrets
from datetime import timedelta

from django.db.models import Count, Sum
from django.http import HttpResponseBadRequest, HttpResponseForbidden, JsonResponse
from django.utils import timezone

from amolnama_news.site_apps.core.utils import sanitize_user_html

from .models import (
    BetaReader,
    BibleEntry,
    BookCoverDesign,
    Chapter,
    CollBook,
    EngUserStreak,
    MarginNote,
    PlotCard,
    RefBibleCategory,
    SerialRelease,
    WritingSession,
)


logger = logging.getLogger(__name__)


MAX_CHAPTER_HTML_BYTES = 2 * 1024 * 1024
MAX_CHAPTER_TITLE_LENGTH = 500

# Strict hex-colour validator — see B2 in app-troubleshooting.txt for why.
HEX_COLOR_PATTERN = re.compile(r'^#[0-9a-fA-F]{3,8}$')


def _is_valid_hex_color(value):
    return isinstance(value, str) and bool(HEX_COLOR_PATTERN.match(value))


def _count_words(plain_text):
    """Whitespace-token word count. Treats Bengali and English the same
    — both tokenise on whitespace runs."""
    if not plain_text:
        return 0
    return len(re.findall(r'\S+', plain_text))


def _strip_html_to_plain(html):
    """Strip all tags down to plain text. Used for word-count + future
    full-text search. Not for security — input has already been passed
    through sanitize_user_html()."""
    if not html:
        return ''
    return re.sub(r'<[^>]+>', '', html)


# ---- INLINE IMAGE SUPPORT FOR CHAPTER PROSE ----
# bookwriter chapter HTML is the only context in the project that allows
# <img>. The opt-in is scoped to this app via sanitize_user_html's
# additive whitelist parameters; no other app's sanitize_user_html
# behavior changes.
#
# Allowed img attrs (positive whitelist):
#   src         — must be a relative /media/upload/bookwriter/chapter/<id>/ path
#   alt         — free text, HTML-escaped on render
#   class       — bookwriter-prose-image (+ optional size + align modifier
#                 classes); also tolerates the deprecated float-* family
#                 from old saved chapters so existing data isn't dropped
#                 by the sanitizer before the JS migration runs on load
#   style       — only `width: <int>px|%` (carry-over from the old
#                 corner-resize era; new images use size classes instead)
#   data-size   — small | medium | full
#   data-align  — left | center | right
#   data-float  — left | right | center | none (deprecated, accepted for
#                 round-trip survival of pre-pivot saved chapters)
_IMG_SRC_ALLOWED_PREFIX = '/media/upload/bookwriter/chapter/'
_IMG_STYLE_PATTERN = re.compile(r'^\s*width\s*:\s*\d{1,4}(?:px|%)\s*;?\s*$')
# Block-model class set: the base + an optional size modifier + an
# optional align modifier. Old float-* classes also accepted so the
# sanitizer doesn't strip pre-pivot saved markup before the JS
# migration runs.
_IMG_CLASS_TOKEN_PATTERN = re.compile(
    r'^bookwriter-prose-image'
    r'(?:-(?:size-(?:small|medium|full)|align-(?:left|center|right)|float-(?:left|right|center|none)))?$'
)
_IMG_SIZE_ALLOWED_VALUES  = frozenset({'small', 'medium', 'full'})
_IMG_ALIGN_ALLOWED_VALUES = frozenset({'left', 'center', 'right'})
_IMG_FLOAT_ALLOWED_VALUES = frozenset({'left', 'right', 'center', 'none'})


def _validate_chapter_img_src(value):
    if not isinstance(value, str):
        return None
    if not value.startswith(_IMG_SRC_ALLOWED_PREFIX):
        return None
    # Reject path traversal segments
    if '..' in value or '\\' in value:
        return None
    return value


def _validate_chapter_img_style(value):
    if not isinstance(value, str):
        return None
    return value if _IMG_STYLE_PATTERN.match(value) else None


def _validate_chapter_img_class(value):
    """Whitelist each whitespace-separated class token individually so an
    attacker can't smuggle an unknown class by stringing it after a
    valid one. Returns the original value if every token passes; None
    otherwise (drops the attribute)."""
    if not isinstance(value, str):
        return None
    cleaned = value.strip()
    if not cleaned:
        return None
    for class_token in cleaned.split():
        if not _IMG_CLASS_TOKEN_PATTERN.match(class_token):
            return None
    return cleaned


def _validate_chapter_img_data_size(value):
    if not isinstance(value, str):
        return None
    return value if value in _IMG_SIZE_ALLOWED_VALUES else None


def _validate_chapter_img_data_align(value):
    if not isinstance(value, str):
        return None
    return value if value in _IMG_ALIGN_ALLOWED_VALUES else None


def _validate_chapter_img_data_float(value):
    if not isinstance(value, str):
        return None
    return value if value in _IMG_FLOAT_ALLOWED_VALUES else None


CHAPTER_PROSE_SANITIZER_KWARGS = {
    'extra_allowed_tags': ['img'],
    'extra_allowed_attrs_by_tag': {
        'img': ['src', 'alt', 'class', 'style', 'data-size', 'data-align', 'data-float'],
    },
    'extra_allowed_void_tags': ['img'],
    'attr_value_validators_by_tag_attr': {
        ('img', 'src'):        _validate_chapter_img_src,
        ('img', 'style'):      _validate_chapter_img_style,
        ('img', 'class'):      _validate_chapter_img_class,
        ('img', 'data-size'):  _validate_chapter_img_data_size,
        ('img', 'data-align'): _validate_chapter_img_data_align,
        ('img', 'data-float'): _validate_chapter_img_data_float,
    },
}


def sanitize_chapter_prose_html(html):
    """Sanitize chapter body HTML. Same as sanitize_user_html but
    additionally allows <img> with strict src + style + class + data-float
    constraints. Used by chapter autosave + snapshot create. Default
    sanitize_user_html stays unchanged for every other caller."""
    return sanitize_user_html(html, **CHAPTER_PROSE_SANITIZER_KWARGS)


def strip_page_break_overlay_from_html(html_text):
    """Remove the bookwriter-page-break-overlay div block(s) from HTML.

    The overlay (.bookwriter-page-break-overlay) is a JS-injected UI
    decoration that lives INSIDE the contenteditable prose at runtime
    so position:absolute resolves against the prose box. Older
    chapter_text_html rows persisted that markup because the autosave
    used to read prose.innerHTML wholesale — its child page-number
    pills ("1", "2", "3") and "page break" labels then leaked into
    PDF export, public reader, and any other server-side renderer.
    Going forward the autosave JS strips it client-side, but legacy
    rows still carry the markup. Use this helper any time you read
    chapter_text_html from the DB and pass it to a renderer.

    Uses html.parser (stdlib, no extra dep) — handles nested <div>s
    correctly with a depth counter, unlike a naive regex."""
    if not html_text or 'bookwriter-page-break-overlay' not in html_text:
        return html_text  # fast path — no overlay present
    from html.parser import HTMLParser

    class _PageBreakOverlayStripper(HTMLParser):
        def __init__(self):
            super().__init__(convert_charrefs=False)
            self.kept_html_parts = []
            self.skip_div_depth = 0  # 0 = not skipping; >0 = inside overlay subtree

        def handle_starttag(self, tag, attrs):
            attrs_dict = dict(attrs)
            class_value = attrs_dict.get('class') or ''
            if (tag == 'div'
                    and 'bookwriter-page-break-overlay' in class_value.split()):
                self.skip_div_depth = 1
                return
            if self.skip_div_depth > 0:
                if tag == 'div':
                    self.skip_div_depth += 1
                return
            attr_string = ''.join(
                ' %s="%s"' % (attr_name, (attr_value or '').replace('"', '&quot;'))
                for attr_name, attr_value in attrs
            )
            self.kept_html_parts.append('<%s%s>' % (tag, attr_string))

        def handle_endtag(self, tag):
            if self.skip_div_depth > 0:
                if tag == 'div':
                    self.skip_div_depth -= 1
                return
            self.kept_html_parts.append('</%s>' % tag)

        def handle_startendtag(self, tag, attrs):
            if self.skip_div_depth > 0:
                return
            attr_string = ''.join(
                ' %s="%s"' % (attr_name, (attr_value or '').replace('"', '&quot;'))
                for attr_name, attr_value in attrs
            )
            self.kept_html_parts.append('<%s%s/>' % (tag, attr_string))

        def handle_data(self, data):
            if self.skip_div_depth > 0:
                return
            self.kept_html_parts.append(data)

        def handle_entityref(self, name):
            if self.skip_div_depth > 0:
                return
            self.kept_html_parts.append('&%s;' % name)

        def handle_charref(self, name):
            if self.skip_div_depth > 0:
                return
            self.kept_html_parts.append('&#%s;' % name)

    stripper = _PageBreakOverlayStripper()
    stripper.feed(html_text)
    return ''.join(stripper.kept_html_parts)


def _resolve_chapter_for_owner(chapter_id, user_profile_id):
    """Look up an active chapter and verify the caller owns its book.

    Returns (chapter, owning_book) on success, or (None, error_response)
    if anything fails. Centralises the lookup + auth chain so every
    endpoint enforces the same checks.
    """
    try:
        chapter = Chapter.objects.get(
            bookwriter_chapter_id=chapter_id,
            is_active=True,
        )
    except Chapter.DoesNotExist:
        return None, JsonResponse({'ok': False, 'error': 'Chapter not found'}, status=404)

    try:
        owning_book = CollBook.objects.get(
            bookwriter_coll_book_id=chapter.link_bookwriter_coll_book_id,
        )
    except CollBook.DoesNotExist:
        logger.error(
            'chapter %s points to missing book %s',
            chapter_id, chapter.link_bookwriter_coll_book_id,
        )
        return None, JsonResponse({'ok': False, 'error': 'Book not found'}, status=404)

    if owning_book.link_owner_user_profile_id != user_profile_id:
        return None, HttpResponseForbidden('Not the owner')

    return (chapter, owning_book), None


def _resolve_book_for_owner(book_id, user_profile_id):
    """Look up an active book and verify caller ownership."""
    try:
        owning_book = CollBook.objects.get(
            bookwriter_coll_book_id=book_id,
            is_active=True,
        )
    except CollBook.DoesNotExist:
        return None, JsonResponse({'ok': False, 'error': 'Book not found'}, status=404)

    if owning_book.link_owner_user_profile_id != user_profile_id:
        return None, HttpResponseForbidden('Not the owner')

    return owning_book, None


def _read_json_body(request):
    """Decode a JSON request body to a dict. Returns (payload, error_response)."""
    declared_length = request.META.get('CONTENT_LENGTH')
    if declared_length and declared_length.isdigit() and int(declared_length) > MAX_CHAPTER_HTML_BYTES:
        return None, HttpResponseBadRequest('Payload too large')

    try:
        payload = json.loads(request.body.decode('utf-8'))
    except (ValueError, UnicodeDecodeError):
        return None, HttpResponseBadRequest('Invalid JSON')

    if not isinstance(payload, dict):
        return None, HttpResponseBadRequest('JSON body must be an object')

    return payload, None


def _record_writing_progress(user_profile_id, book_id, words_added_delta):
    """Update today's WritingSession + EngUserStreak rows after a save.

    `words_added_delta` is the change in chapter_word_count for this
    save (positive when adding text, negative when deleting). We sum
    only positive deltas so deletions don't artificially shrink the
    daily counter — matches user expectation ("words written today"
    means words produced, not net change). Returns the (today_words,
    today_active_seconds, current_streak_days) tuple for the JSON reply.
    """
    user_today = timezone.localdate()
    now = timezone.now()
    delta_to_add = max(0, int(words_added_delta or 0))

    session_row, was_created = WritingSession.objects.get_or_create(
        link_user_profile_id=user_profile_id,
        link_bookwriter_coll_book_id=book_id,
        session_date=user_today,
        defaults={
            'session_started_at': now,
            'session_words_added': delta_to_add,
            'session_active_seconds': 0,
            'is_active': True,
            'created_at': now,
        },
    )
    if not was_created:
        WritingSession.objects.filter(pk=session_row.pk).update(
            session_words_added=session_row.session_words_added + delta_to_add,
            session_ended_at=now,
            updated_at=now,
        )
        session_row.session_words_added += delta_to_add

    streak_row, streak_was_created = EngUserStreak.objects.get_or_create(
        link_user_profile_id=user_profile_id,
        streak_date=user_today,
        defaults={
            'streak_words_written': delta_to_add,
            'streak_minutes_active': 0,
            'streak_session_count': 1 if was_created else 0,
            'streak_goal_met': False,
            'is_active': True,
            'created_at': now,
        },
    )
    if not streak_was_created:
        EngUserStreak.objects.filter(pk=streak_row.pk).update(
            streak_words_written=streak_row.streak_words_written + delta_to_add,
            streak_session_count=streak_row.streak_session_count + (1 if was_created else 0),
            updated_at=now,
        )
        streak_row.streak_words_written += delta_to_add

    # Compute current streak — count back from today over consecutive
    # days that have an active streak row. Cap at 365 to bound the query.
    streak_days = (
        EngUserStreak.objects
        .filter(link_user_profile_id=user_profile_id, is_active=True)
        .order_by('-streak_date')
        .values_list('streak_date', flat=True)[:365]
    )
    consecutive_days = 0
    expected_date = user_today
    for stored_date in streak_days:
        if stored_date == expected_date:
            consecutive_days += 1
            expected_date = expected_date - timedelta(days=1)
        else:
            break

    return (
        session_row.session_words_added,
        session_row.session_active_seconds or 0,
        consecutive_days,
    )


def _refresh_book_caches(book_id):
    """Recompute book_word_count_cached + book_chapter_count_cached
    from the current set of active chapters and persist them.

    Called after any chapter mutation (autosave, create, delete,
    reorder) so the right-rail card and any future analytics stay in
    sync. Returns the (word_count, chapter_count) tuple so callers
    can echo it in their JSON reply without re-querying.
    """
    aggregate = (
        Chapter.objects
        .filter(link_bookwriter_coll_book_id=book_id, is_active=True)
        .aggregate(
            total_words=Sum('chapter_word_count'),
            total_chapters=Count('bookwriter_chapter_id'),  # SQL Server can't SUM(bit)
        )
    )
    total_words = int(aggregate['total_words'] or 0)
    total_chapters = int(aggregate['total_chapters'] or 0)

    CollBook.objects.filter(bookwriter_coll_book_id=book_id).update(
        book_word_count_cached=total_words,
        book_chapter_count_cached=total_chapters,
        updated_at=timezone.now(),
    )
    return total_words, total_chapters


def _resolve_plot_card_for_owner(plot_card_id, user_profile_id):
    """Look up an active plot card and verify the caller owns its book.
    Mirrors `_resolve_chapter_for_owner` but for the corkboard."""
    try:
        plot_card = PlotCard.objects.get(
            bookwriter_plot_card_id=plot_card_id,
            is_active=True,
        )
    except PlotCard.DoesNotExist:
        return None, JsonResponse({'ok': False, 'error': 'Plot card not found'}, status=404)

    try:
        owning_book = CollBook.objects.get(
            bookwriter_coll_book_id=plot_card.link_bookwriter_coll_book_id,
        )
    except CollBook.DoesNotExist:
        logger.error(
            'plot_card %s points to missing book %s',
            plot_card_id, plot_card.link_bookwriter_coll_book_id,
        )
        return None, JsonResponse({'ok': False, 'error': 'Book not found'}, status=404)

    if owning_book.link_owner_user_profile_id != user_profile_id:
        return None, HttpResponseForbidden('Not the owner')

    return (plot_card, owning_book), None


def _resolve_bible_entry_for_owner(bible_entry_id, user_profile_id):
    """Look up an active bible entry and verify the caller owns its book.
    Mirrors `_resolve_chapter_for_owner` and `_resolve_plot_card_for_owner`."""
    try:
        bible_entry = BibleEntry.objects.get(
            bookwriter_bible_entry_id=bible_entry_id,
            is_active=True,
        )
    except BibleEntry.DoesNotExist:
        return None, JsonResponse({'ok': False, 'error': 'Bible entry not found'}, status=404)

    try:
        owning_book = CollBook.objects.get(
            bookwriter_coll_book_id=bible_entry.link_bookwriter_coll_book_id,
        )
    except CollBook.DoesNotExist:
        logger.error(
            'bible_entry %s points to missing book %s',
            bible_entry_id, bible_entry.link_bookwriter_coll_book_id,
        )
        return None, JsonResponse({'ok': False, 'error': 'Book not found'}, status=404)

    if owning_book.link_owner_user_profile_id != user_profile_id:
        return None, HttpResponseForbidden('Not the owner')

    return (bible_entry, owning_book), None


def _is_valid_bible_category_code(category_code):
    """Validate `bible_category_code` against the seeded ref table.
    Returns True for 'characters' / 'locations' / 'objects' / 'research'
    / 'lore' (whatever's active in ref_bible_category)."""
    if not category_code:
        return False
    return RefBibleCategory.objects.filter(
        bible_category_code=category_code,
        is_active=True,
    ).exists()


def _resolve_margin_note_for_owner(margin_note_id, user_profile_id):
    try:
        margin_note = MarginNote.objects.get(
            bookwriter_margin_note_id=margin_note_id,
            is_active=True,
        )
    except MarginNote.DoesNotExist:
        return None, JsonResponse({'ok': False, 'error': 'Margin note not found'}, status=404)

    resolved, error_response = _resolve_chapter_for_owner(
        margin_note.link_bookwriter_chapter_id, user_profile_id,
    )
    if error_response is not None:
        return None, error_response
    chapter, owning_book = resolved
    return (margin_note, chapter, owning_book), None


def _bangla_slugify_or_fallback(source_text, fallback_id):
    """Generate a URL-safe slug from a chapter title. Uses the project's
    bangla_slugify for Bengali NFC handling. Falls back to 'chapter-N'
    when the title is empty or all-symbols."""
    try:
        from amolnama_news.site_apps.core.utils import bangla_slugify
        candidate_slug = bangla_slugify(source_text or '')
    except Exception:  # noqa: BLE001 — utility import / call should never crash this path
        candidate_slug = ''
    if not candidate_slug:
        candidate_slug = 'chapter-' + str(fallback_id)
    return candidate_slug[:300]


def _generate_share_token():
    """32-char URL-safe random string. Practically collision-proof
    for this scale (collision probability < 10^-30 for the lifetime
    of this app)."""
    return secrets.token_urlsafe(24)


def _resolve_beta_reader_for_owner(beta_reader_id, user_profile_id):
    try:
        beta_reader = BetaReader.objects.get(bookwriter_beta_reader_id=beta_reader_id)
    except BetaReader.DoesNotExist:
        return None, JsonResponse({'ok': False, 'error': 'Beta reader not found'}, status=404)
    owning_book, error_response = _resolve_book_for_owner(
        beta_reader.link_bookwriter_coll_book_id, user_profile_id,
    )
    if error_response is not None:
        return None, error_response
    return (beta_reader, owning_book), None


def _resolve_published_release(release_id):
    """Look up an active, published serial_release row. Returns None
    on miss so callers can decide between 404 and silent ignore."""
    try:
        return SerialRelease.objects.get(
            bookwriter_serial_release_id=release_id,
            serial_release_status_code='published',
            is_active=True,
        )
    except SerialRelease.DoesNotExist:
        return None


# =====================================================================
# LIBRARY PAGE HELPERS — single source of truth for the My Library grid.
# =====================================================================

# Eight curated cover palettes from the v02 prototype. Each palette is
# the {main, dark, gold} triplet the library card needs to paint a
# distinct leather-bound spine. Picked deterministically by book id so
# every book that has not yet had its cover designed always shows the
# same fallback cover (no flicker on reload).
BOOKWRITER_LIBRARY_FALLBACK_COVER_PALETTES = (
    {'main': '#6b1e14', 'dark': '#3d0f08', 'gold': '#c9a961'},  # burgundy
    {'main': '#1e4a2e', 'dark': '#0f2818', 'gold': '#c9a961'},  # forest
    {'main': '#1a2e5c', 'dark': '#0a1632', 'gold': '#d4b869'},  # navy
    {'main': '#8b5a2b', 'dark': '#4d2e12', 'gold': '#e8d4a0'},  # leather brown
    {'main': '#4a1e4c', 'dark': '#2a0e2e', 'gold': '#c9a961'},  # deep purple
    {'main': '#2a2a2a', 'dark': '#101010', 'gold': '#b89968'},  # charcoal
    {'main': '#2c5566', 'dark': '#132e3a', 'gold': '#d4b869'},  # sea blue
    {'main': '#7a2040', 'dark': '#401020', 'gold': '#e8c888'},  # wine
)


def resolve_book_cover_palette(book, cover_design_or_none):
    """Resolve the {main, dark, gold} hex triplet for a library book
    card. Maps from BookCoverDesign's {bg, accent, fg} overrides if
    present; missing slots fall back to the deterministic palette
    indexed by `book.bookwriter_coll_book_id`. Same book always yields
    the same fallback so covers don't flicker between page loads."""
    palette_pool_size = len(BOOKWRITER_LIBRARY_FALLBACK_COVER_PALETTES)
    fallback_palette = BOOKWRITER_LIBRARY_FALLBACK_COVER_PALETTES[
        book.bookwriter_coll_book_id % palette_pool_size
    ]
    if cover_design_or_none is None:
        return dict(fallback_palette)
    return {
        'main': cover_design_or_none.cover_palette_bg_hex_override or fallback_palette['main'],
        'dark': cover_design_or_none.cover_palette_accent_hex_override or fallback_palette['dark'],
        'gold': cover_design_or_none.cover_palette_fg_hex_override or fallback_palette['gold'],
    }


def prefetch_book_cover_designs(books):
    """Bulk-load BookCoverDesign rows for a list of books to avoid the
    N+1 query that a per-card lookup would create. Returns a dict
    {book_id: BookCoverDesign}; books without a saved design simply
    aren't present in the dict, and callers pass None to
    `resolve_book_cover_palette` for those."""
    if not books:
        return {}
    book_ids_list = [book.bookwriter_coll_book_id for book in books]
    saved_designs = BookCoverDesign.objects.filter(
        link_bookwriter_coll_book_id__in=book_ids_list,
        is_active=True,
    )
    return {
        design.link_bookwriter_coll_book_id: design
        for design in saved_designs
    }


def _estimate_book_pages_from_word_count(word_count, chapter_count):
    """Estimate book page count from word count (250 words per printed
    page is the publishing-industry convention for trade paperbacks).
    Falls back to chapter_count when no words have been written yet so
    a brand-new book with one empty chapter still shows '1 page'."""
    if word_count > 0:
        return max(1, round(word_count / 250))
    return max(1, chapter_count)


def _format_relative_time(at_timestamp):
    """Render a timestamp as an English relative-time string for the
    library card meta line. 'just now', '5 minutes ago', '2 hours ago',
    '3 days ago', '2 weeks ago', '4 months ago', '2 years ago'.
    Returns empty string when the timestamp is None."""
    if at_timestamp is None:
        return ''
    now = timezone.now()
    seconds_elapsed = int((now - at_timestamp).total_seconds())
    if seconds_elapsed < 60:
        return 'just now'
    if seconds_elapsed < 3600:
        minutes_elapsed = seconds_elapsed // 60
        return '%d minute%s ago' % (minutes_elapsed, '' if minutes_elapsed == 1 else 's')
    if seconds_elapsed < 86400:
        hours_elapsed = seconds_elapsed // 3600
        return '%d hour%s ago' % (hours_elapsed, '' if hours_elapsed == 1 else 's')
    if seconds_elapsed < 604800:
        days_elapsed = seconds_elapsed // 86400
        return '%d day%s ago' % (days_elapsed, '' if days_elapsed == 1 else 's')
    if seconds_elapsed < 2592000:
        weeks_elapsed = seconds_elapsed // 604800
        return '%d week%s ago' % (weeks_elapsed, '' if weeks_elapsed == 1 else 's')
    if seconds_elapsed < 31536000:
        months_elapsed = seconds_elapsed // 2592000
        return '%d month%s ago' % (months_elapsed, '' if months_elapsed == 1 else 's')
    years_elapsed = seconds_elapsed // 31536000
    return '%d year%s ago' % (years_elapsed, '' if years_elapsed == 1 else 's')


def build_book_card_payload(book, cover_design_or_none, viewer_display_name=''):
    """Resolve every field a library book card needs to render. Single
    source of truth — the SSR template AND any future JSON list endpoint
    must read from this dict so the two surfaces never drift."""
    book_title = (
        book.book_title_bn or book.book_title_en or 'Untitled Book'
    )
    book_subtitle = (
        book.book_subtitle_bn or book.book_subtitle_en or ''
    )
    book_author = (
        book.book_author_display_bn
        or book.book_author_display_en
        or viewer_display_name
        or ''
    )
    cover_palette = resolve_book_cover_palette(book, cover_design_or_none)
    estimated_pages = _estimate_book_pages_from_word_count(
        book.book_word_count_cached or 0,
        book.book_chapter_count_cached or 0,
    )
    last_modified_at = book.updated_at or book.created_at
    return {
        'book_id': book.bookwriter_coll_book_id,
        'book_title': book_title,
        'book_subtitle': book_subtitle,
        'book_author': book_author,
        'book_estimated_pages': estimated_pages,
        'book_relative_updated_label': _format_relative_time(last_modified_at),
        'book_chapter_count': book.book_chapter_count_cached or 0,
        'book_word_count': book.book_word_count_cached or 0,
        'cover_main_hex': cover_palette['main'],
        'cover_dark_hex': cover_palette['dark'],
        'cover_gold_hex': cover_palette['gold'],
    }


# =====================================================================
# READER PAGINATION — splits a chapter's HTML into N page-face chunks
# at top-level block boundaries so the reader never has to scroll
# inside a single page. See bookwriter_book_reader view for usage.
# =====================================================================

# Target word budget per page-face. 110 words splits a chapter with
# 1 image + 6 short-to-medium paragraphs (~200 words text + image)
# into ~3 pages, which matches what the rendered visual reality looks
# like (image takes ~half a page, text fills the rest, then overflow
# pushes to a new page). Pure-text chapters with short paragraphs
# still fit 1-2 pages naturally.
DEFAULT_READER_WORDS_PER_PAGE = 110

# Headings, images, and blockquotes count as at least this many
# words for pagination purposes — they take significant VISUAL space
# (a 510px-wide image consumes ~half the page height) while their
# text content alone is small or zero. 100 ≈ "almost a full page on
# its own" so the next paragraph after an image always pushes to a
# new page. Without this weight, an image squashed next to a couple
# of paragraphs lands on a single overcrowded page that looks
# nothing like the rendered visual reality.
READER_HEADING_OR_IMAGE_MIN_WORD_WEIGHT = 100


def _extract_top_level_blocks_from_html(html_text):
    """Return top-level (depth=1) HTML elements as a list of strings.
    Uses stdlib html.parser so the bookwriter has no extra dependency.
    Loose text outside any tag gets wrapped in <p> so the splitter
    always sees block-level units. Never splits an element across
    blocks — paragraphs, headings, blockquotes, and images each emit
    as one atomic string."""
    if not html_text:
        return []
    from html.parser import HTMLParser

    class _BlockExtractor(HTMLParser):
        def __init__(self):
            super().__init__(convert_charrefs=False)
            self.collected_blocks = []
            self.current_block_parts = []
            self.current_depth = 0

        def _format_attrs_string(self, attrs):
            return ''.join(
                ' %s="%s"' % (attr_name, (attr_value or '').replace('"', '&quot;'))
                for attr_name, attr_value in attrs
            )

        def handle_starttag(self, tag, attrs):
            self.current_block_parts.append(
                '<%s%s>' % (tag, self._format_attrs_string(attrs))
            )
            self.current_depth += 1

        def handle_endtag(self, tag):
            self.current_depth -= 1
            self.current_block_parts.append('</%s>' % tag)
            if self.current_depth <= 0:
                self.current_depth = 0
                emitted_block = ''.join(self.current_block_parts).strip()
                if emitted_block:
                    self.collected_blocks.append(emitted_block)
                self.current_block_parts = []

        def handle_startendtag(self, tag, attrs):
            tag_html = '<%s%s/>' % (tag, self._format_attrs_string(attrs))
            if self.current_depth <= 0:
                self.collected_blocks.append(tag_html)
            else:
                self.current_block_parts.append(tag_html)

        def handle_data(self, data):
            if self.current_depth > 0:
                self.current_block_parts.append(data)
            elif data.strip():
                # Loose text outside any tag — wrap so the splitter
                # treats it as a block.
                self.collected_blocks.append('<p>%s</p>' % data)

        def handle_entityref(self, name):
            if self.current_depth > 0:
                self.current_block_parts.append('&%s;' % name)

        def handle_charref(self, name):
            if self.current_depth > 0:
                self.current_block_parts.append('&#%s;' % name)

    block_extractor = _BlockExtractor()
    block_extractor.feed(html_text)
    return block_extractor.collected_blocks


def paginate_chapter_html_into_pages(
    chapter_html, target_words_per_page=DEFAULT_READER_WORDS_PER_PAGE,
):
    """Split chapter HTML into a list of page-face HTML strings, each
    targeting `target_words_per_page` words. Splits only at top-level
    block boundaries so paragraphs, headings, blockquotes, lists, and
    images stay intact. Headings + images count as min 30 words so
    they get a fresh page when the previous one is nearly full.

    Returns at least one entry — empty chapters yield [''] so the
    template still renders one (blank) page-face for that chapter.

    Known limitation: a single very long paragraph (>target words) lands
    on its own page and may overflow the visible box (CSS clips it).
    True rendered-height pagination is a future enhancement."""
    extracted_blocks = _extract_top_level_blocks_from_html(chapter_html or '')
    if not extracted_blocks:
        return ['']

    paginated_pages = []
    current_page_block_parts = []
    current_page_word_count = 0

    for block_html in extracted_blocks:
        block_plain_text = re.sub(r'<[^>]+>', '', block_html)
        block_word_count = len(re.findall(r'\S+', block_plain_text))
        if re.search(r'<\s*(h[1-6]|img|blockquote)\b', block_html, re.IGNORECASE):
            block_word_count = max(block_word_count, READER_HEADING_OR_IMAGE_MIN_WORD_WEIGHT)

        if (current_page_word_count + block_word_count > target_words_per_page
                and current_page_block_parts):
            paginated_pages.append(''.join(current_page_block_parts))
            current_page_block_parts = []
            current_page_word_count = 0

        current_page_block_parts.append(block_html)
        current_page_word_count += block_word_count

    if current_page_block_parts:
        paginated_pages.append(''.join(current_page_block_parts))

    return paginated_pages or ['']


def pack_chapter_pages_into_book_sheets(chapters_with_pages):
    """Pack each chapter's paginated pages onto book sheets (front +
    back faces, two faces per sheet). Each chapter starts a fresh
    sheet so the chapter title always lands at the top of a clean
    page (book convention). Returns a flat list of sheet dicts ready
    for the reader template:

        [{'chapter_number': 1,
          'chapter_title': 'Chapter One',
          'is_chapter_start_on_front': True,   # show title above front_html
          'front_html': '...',
          'back_html': '...' or '',
          'has_back_content': bool,
          'front_page_label': 1,                # running arabic
          'back_page_label': 2 or '',
         }, ...]

    `chapters_with_pages` is a list of dicts {chapter_number, chapter_title, pages_html_list}.
    """
    book_sheets = []
    running_page_number = 0

    for chapter_dict in chapters_with_pages:
        chapter_pages = chapter_dict['pages_html_list']
        for sheet_index_in_chapter in range(0, len(chapter_pages), 2):
            front_page_html = chapter_pages[sheet_index_in_chapter]
            has_back = (sheet_index_in_chapter + 1) < len(chapter_pages)
            back_page_html = chapter_pages[sheet_index_in_chapter + 1] if has_back else ''

            running_page_number += 1
            front_page_label = running_page_number
            if has_back:
                running_page_number += 1
                back_page_label = running_page_number
            else:
                back_page_label = ''

            book_sheets.append({
                'chapter_number': chapter_dict['chapter_number'],
                'chapter_title': chapter_dict['chapter_title'],
                'is_chapter_start_on_front': sheet_index_in_chapter == 0,
                'front_html': front_page_html,
                'back_html': back_page_html,
                'has_back_content': has_back,
                'front_page_label': front_page_label,
                'back_page_label': back_page_label,
            })

    return book_sheets


def build_bookwriter_breadcrumb_trail(*, current_book=None, current_mode_label=None):
    """Build the breadcrumb chain for any bookwriter page.

    Variants (driven by which kwargs are passed):
      - Library page: pass nothing
        -> [{Book Library, current=True}]
      - Per-book inkwell / reader / future publish/store page:
        pass current_book + current_mode_label
        -> [Book Library, [Book Title], current_mode_label]

    Returns a list of dicts: {label, href, is_current}. The template
    renders `is_current` as plain text + aria-current; everything else
    becomes a clickable link. Crumb labels are intentionally English so
    they read consistently across the whole bookwriter app — see
    notes/book-writer.txt for the language convention."""
    from django.urls import reverse  # local import — URLs aren't wired at module import time
    breadcrumb_trail = [{
        'label': 'Book Library',
        'href': reverse('bookwriter:library'),
        'is_current': current_book is None and current_mode_label is None,
    }]
    if current_book is not None:
        book_title_for_crumb = (
            current_book.book_title_bn
            or current_book.book_title_en
            or 'Untitled Book'
        )
        breadcrumb_trail.append({
            'label': book_title_for_crumb,
            'href': reverse(
                'bookwriter:write',
                kwargs={'book_id': current_book.bookwriter_coll_book_id},
            ),
            'is_current': current_mode_label is None,
        })
    if current_mode_label is not None:
        breadcrumb_trail.append({
            'label': current_mode_label,
            'href': None,
            'is_current': True,
        })
    return breadcrumb_trail

