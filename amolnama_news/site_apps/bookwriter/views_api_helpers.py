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

from django.db.models import Count, Max, Sum
from django.http import HttpResponseBadRequest, HttpResponseForbidden, JsonResponse
from django.utils import timezone

from amolnama_news.site_apps.core.utils import sanitize_user_html

from .models import (
    BetaReader,
    BibleEntry,
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

