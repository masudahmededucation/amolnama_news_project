"""bookwriter API endpoints — JSON over POST/GET.

Phase 1B endpoints (chapter authoring):

  POST /bookwriter/api/chapter/<id>/autosave/
       Save chapter body HTML. Idempotent — full-body replace.

  POST /bookwriter/api/chapter/<id>/title/
       Save chapter title. Idempotent — full-field replace.

  GET  /bookwriter/api/chapter/<id>/
       Load a chapter (used by the rail click handler when switching
       between chapters in Write mode).

  POST /bookwriter/api/book/<id>/chapter/create/
       Create a new chapter at the end of the book. Returns the new
       chapter so the JS can append a row to the rail.

All four enforce owner-check via the chapter → book → user_profile_id
chain. Caller must be authenticated and must own the parent book.
"""

import json
import logging
import re

from django.contrib.auth.decorators import login_required
from django.db.models import Max
from django.http import (
    HttpResponseBadRequest,
    HttpResponseForbidden,
    JsonResponse,
)
from django.utils import timezone
from django.views.decorators.http import require_GET, require_POST

from amolnama_news.site_apps.core.utils import (
    get_user_profile_id,
    sanitize_user_html,
)

from .models import Chapter, CollBook


logger = logging.getLogger(__name__)


# Cap the per-request payload at ~2 MB of HTML. A novel chapter rarely
# exceeds 50 KB; anything larger is almost certainly a paste of binary
# content or an attempted DoS. The DB column is NVARCHAR(MAX) so the
# constraint is purely defensive.
MAX_CHAPTER_HTML_BYTES = 2 * 1024 * 1024
MAX_CHAPTER_TITLE_LENGTH = 500


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


@login_required
@require_POST
def api_bookwriter_chapter_autosave(request, chapter_id):
    """Save chapter body HTML.

    Request JSON: { "chapter_text_html": "<p>…</p>" }
    Response on success: {
        "ok": true,
        "chapter_word_count": 1234,
        "saved_at": "2026-04-19T14:32:11Z"
    }
    """
    user_profile_id = get_user_profile_id(request)
    if user_profile_id is None:
        return HttpResponseForbidden('No user profile')

    payload, error_response = _read_json_body(request)
    if error_response is not None:
        return error_response

    raw_html = payload.get('chapter_text_html')
    if not isinstance(raw_html, str):
        return HttpResponseBadRequest('chapter_text_html must be a string')

    resolved, error_response = _resolve_chapter_for_owner(chapter_id, user_profile_id)
    if error_response is not None:
        return error_response
    chapter, _owning_book = resolved

    sanitized_html = sanitize_user_html(raw_html) or None
    plain_text = _strip_html_to_plain(sanitized_html)
    word_count = _count_words(plain_text)
    saved_at = timezone.now()

    chapter.chapter_text_html = sanitized_html
    chapter.chapter_text_plain = plain_text or None
    chapter.chapter_word_count = word_count
    chapter.last_edited_at = saved_at
    chapter.updated_at = saved_at
    chapter.save(update_fields=[
        'chapter_text_html',
        'chapter_text_plain',
        'chapter_word_count',
        'last_edited_at',
        'updated_at',
    ])

    return JsonResponse({
        'ok': True,
        'chapter_word_count': word_count,
        'saved_at': saved_at.isoformat(),
    })


@login_required
@require_POST
def api_bookwriter_chapter_title_save(request, chapter_id):
    """Save chapter title (full-field replace, idempotent).

    Request JSON: { "chapter_title": "The Letter that Arrived in Winter" }
    Response on success: { "ok": true, "saved_at": "..." }

    The submitted title is treated as plain text — any HTML tags are
    stripped before storing. Empty or whitespace-only titles save NULL
    so the rail's `|default:"Untitled"` filter can render a placeholder.
    """
    user_profile_id = get_user_profile_id(request)
    if user_profile_id is None:
        return HttpResponseForbidden('No user profile')

    payload, error_response = _read_json_body(request)
    if error_response is not None:
        return error_response

    raw_title = payload.get('chapter_title')
    if not isinstance(raw_title, str):
        return HttpResponseBadRequest('chapter_title must be a string')

    cleaned_title = _strip_html_to_plain(raw_title).strip()[:MAX_CHAPTER_TITLE_LENGTH]

    resolved, error_response = _resolve_chapter_for_owner(chapter_id, user_profile_id)
    if error_response is not None:
        return error_response
    chapter, _owning_book = resolved

    saved_at = timezone.now()
    chapter.chapter_title_en = cleaned_title or None
    chapter.last_edited_at = saved_at
    chapter.updated_at = saved_at
    chapter.save(update_fields=[
        'chapter_title_en',
        'last_edited_at',
        'updated_at',
    ])

    return JsonResponse({'ok': True, 'saved_at': saved_at.isoformat()})


@login_required
@require_GET
def api_bookwriter_chapter_load(request, chapter_id):
    """Load a chapter for the rail click handler.

    Response: {
        "ok": true,
        "chapter": {
            "id": 42,
            "number": 3,
            "title": "...",
            "html": "<p>…</p>",
            "word_count": 1234
        }
    }
    """
    user_profile_id = get_user_profile_id(request)
    if user_profile_id is None:
        return HttpResponseForbidden('No user profile')

    resolved, error_response = _resolve_chapter_for_owner(chapter_id, user_profile_id)
    if error_response is not None:
        return error_response
    chapter, _owning_book = resolved

    return JsonResponse({
        'ok': True,
        'chapter': {
            'id': chapter.bookwriter_chapter_id,
            'number': chapter.chapter_number,
            'title': (
                chapter.chapter_title_en
                or chapter.chapter_title_bn
                or ''
            ),
            'html': chapter.chapter_text_html or '',
            'word_count': chapter.chapter_word_count or 0,
        },
    })


@login_required
@require_POST
def api_bookwriter_book_chapter_create(request, book_id):
    """Append a new (blank) chapter to the end of a book.

    Owner-check: caller must own the book.
    Returns the created chapter so the JS can append the row.

    Numbering: takes max(chapter_number) + 1 to avoid collisions even
    if the user has reordered or deleted earlier chapters.
    """
    user_profile_id = get_user_profile_id(request)
    if user_profile_id is None:
        return HttpResponseForbidden('No user profile')

    owning_book, error_response = _resolve_book_for_owner(book_id, user_profile_id)
    if error_response is not None:
        return error_response

    aggregate = (
        Chapter.objects
        .filter(link_bookwriter_coll_book_id=book_id, is_active=True)
        .aggregate(highest_number=Max('chapter_number'), highest_sort=Max('sort_order'))
    )
    next_number = (aggregate['highest_number'] or 0) + 1
    next_sort = (aggregate['highest_sort'] or 0) + 1

    now = timezone.now()
    new_chapter = Chapter.objects.create(
        link_bookwriter_coll_book_id=book_id,
        chapter_number=next_number,
        chapter_title_en=None,
        chapter_word_count=0,
        chapter_status_code='blank',
        chapter_visibility_code='private',
        sort_order=next_sort,
        is_active=True,
        created_at=now,
    )

    return JsonResponse({
        'ok': True,
        'chapter': {
            'id': new_chapter.bookwriter_chapter_id,
            'number': new_chapter.chapter_number,
            'title': '',
            'html': '',
            'word_count': 0,
        },
    })
