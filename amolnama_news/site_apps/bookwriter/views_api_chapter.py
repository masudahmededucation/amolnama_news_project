"""bookwriter — chapter API.

Endpoints owner-checked via _resolve_chapter_for_owner. Includes
autosave / title / load / create / delete / snapshots / publish /
unpublish / status save."""

import re

from django.contrib.auth.decorators import login_required
from django.http import HttpResponseBadRequest, HttpResponseForbidden, JsonResponse
from django.utils import timezone
from django.views.decorators.http import require_GET, require_POST, require_http_methods

from amolnama_news.site_apps.core.utils import get_user_profile_id, sanitize_user_html

from .models import (
    Chapter,
    ChapterSnapshot,
    CollBook,
    RefChapterStatus,
    RefChapterVisibility,
    SerialRelease,
)
from .views_api_helpers import (
    HEX_COLOR_PATTERN,
    MAX_CHAPTER_HTML_BYTES,
    MAX_CHAPTER_TITLE_LENGTH,
    _bangla_slugify_or_fallback,
    _count_words,
    _read_json_body,
    _record_writing_progress,
    _refresh_book_caches,
    _resolve_book_for_owner,
    _resolve_chapter_for_owner,
    _strip_html_to_plain,
)


# Snapshot constants
MAX_SNAPSHOTS_PER_LIST = 50
MAX_SNAPSHOT_LABEL_LENGTH = 300
# Publish constants
MAX_CHAPTER_EXCERPT_LENGTH = 600

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

    previous_word_count = chapter.chapter_word_count or 0

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

    book_total_words, book_total_chapters = _refresh_book_caches(
        chapter.link_bookwriter_coll_book_id
    )

    today_words, today_active_seconds, current_streak_days = _record_writing_progress(
        user_profile_id,
        chapter.link_bookwriter_coll_book_id,
        word_count - previous_word_count,
    )

    return JsonResponse({
        'ok': True,
        'chapter_word_count': word_count,
        'book_total_word_count': book_total_words,
        'book_total_chapter_count': book_total_chapters,
        'today_words_written': today_words,
        'today_active_seconds': today_active_seconds,
        'current_streak_days': current_streak_days,
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

    book_total_words, book_total_chapters = _refresh_book_caches(book_id)

    return JsonResponse({
        'ok': True,
        'chapter': {
            'id': new_chapter.bookwriter_chapter_id,
            'number': new_chapter.chapter_number,
            'title': '',
            'html': '',
            'word_count': 0,
        },
        'book_total_word_count': book_total_words,
        'book_total_chapter_count': book_total_chapters,
    })


@login_required
@require_http_methods(['POST', 'DELETE'])
def api_bookwriter_chapter_delete(request, chapter_id):
    """Soft-delete a chapter (sets is_active=0).

    Accepts both POST and DELETE — DELETE is the semantic match,
    POST is here so callers without DELETE support (some proxies)
    can still hit the endpoint with a CSRF-friendly form post.

    Refreshes book caches so the right-rail counter falls
    immediately. Returns the new totals.
    """
    user_profile_id = get_user_profile_id(request)
    if user_profile_id is None:
        return HttpResponseForbidden('No user profile')

    resolved, error_response = _resolve_chapter_for_owner(chapter_id, user_profile_id)
    if error_response is not None:
        return error_response
    chapter, _owning_book = resolved

    saved_at = timezone.now()
    chapter.is_active = False
    chapter.updated_at = saved_at
    chapter.save(update_fields=['is_active', 'updated_at'])

    book_total_words, book_total_chapters = _refresh_book_caches(
        chapter.link_bookwriter_coll_book_id
    )

    return JsonResponse({
        'ok': True,
        'deleted_chapter_id': chapter_id,
        'book_total_word_count': book_total_words,
        'book_total_chapter_count': book_total_chapters,
        'saved_at': saved_at.isoformat(),
    })


@login_required
@require_POST
def api_bookwriter_chapter_snapshot_create(request, chapter_id):
    """Create a manual or auto snapshot of a chapter's current text.

    Request JSON (all optional):
        {
          "snapshot_kind_code": "manual" | "auto",
          "snapshot_label":     "Before rewrite of ornament passage"
        }
    Defaults: kind='manual', label=null.

    Captures the chapter as-of right now. The diff vs the previous
    snapshot is computed (delta of word counts) so the panel can
    show "+218 words since last".
    """
    user_profile_id = get_user_profile_id(request)
    if user_profile_id is None:
        return HttpResponseForbidden('No user profile')

    payload, error_response = _read_json_body(request)
    if error_response is not None:
        return error_response

    snapshot_kind_code = payload.get('snapshot_kind_code') or 'manual'
    if snapshot_kind_code not in ('manual', 'auto'):
        return HttpResponseBadRequest('snapshot_kind_code must be "manual" or "auto"')

    raw_label = payload.get('snapshot_label')
    if raw_label is not None and not isinstance(raw_label, str):
        return HttpResponseBadRequest('snapshot_label must be a string')
    cleaned_label = (
        _strip_html_to_plain(raw_label).strip()[:MAX_SNAPSHOT_LABEL_LENGTH]
        if raw_label
        else None
    ) or None

    resolved, error_response = _resolve_chapter_for_owner(chapter_id, user_profile_id)
    if error_response is not None:
        return error_response
    chapter, _owning_book = resolved

    previous_snapshot = (
        ChapterSnapshot.objects
        .filter(link_bookwriter_chapter_id=chapter_id, is_active=True)
        .order_by('-created_at')
        .first()
    )
    word_count_diff = (
        chapter.chapter_word_count - (previous_snapshot.snapshot_word_count or 0)
        if previous_snapshot is not None
        else None
    )

    now = timezone.now()
    new_snapshot = ChapterSnapshot.objects.create(
        link_bookwriter_chapter_id=chapter_id,
        snapshot_kind_code=snapshot_kind_code,
        snapshot_label=cleaned_label,
        snapshot_text_html=chapter.chapter_text_html,
        snapshot_text_plain=chapter.chapter_text_plain,
        snapshot_word_count=chapter.chapter_word_count or 0,
        snapshot_word_count_diff=word_count_diff,
        link_created_by_user_profile_id=user_profile_id,
        is_active=True,
        created_at=now,
    )

    return JsonResponse({
        'ok': True,
        'snapshot': {
            'id': new_snapshot.bookwriter_chapter_snapshot_id,
            'kind': snapshot_kind_code,
            'label': cleaned_label or '',
            'word_count': new_snapshot.snapshot_word_count,
            'word_count_diff': word_count_diff,
            'created_at': now.isoformat(),
        },
    })


@login_required
@require_GET
def api_bookwriter_chapter_snapshot_list(request, chapter_id):
    """Return the most recent snapshots for a chapter (newest first).

    Capped at MAX_SNAPSHOTS_PER_LIST (50) to keep responses bounded
    on chapters with long histories. Older snapshots will be
    accessible via a future paginated endpoint.
    """
    user_profile_id = get_user_profile_id(request)
    if user_profile_id is None:
        return HttpResponseForbidden('No user profile')

    resolved, error_response = _resolve_chapter_for_owner(chapter_id, user_profile_id)
    if error_response is not None:
        return error_response
    _chapter, _owning_book = resolved

    snapshot_rows = (
        ChapterSnapshot.objects
        .filter(link_bookwriter_chapter_id=chapter_id, is_active=True)
        .order_by('-created_at')[:MAX_SNAPSHOTS_PER_LIST]
    )

    return JsonResponse({
        'ok': True,
        'snapshots': [
            {
                'id': row.bookwriter_chapter_snapshot_id,
                'kind': row.snapshot_kind_code,
                'label': row.snapshot_label or '',
                'word_count': row.snapshot_word_count,
                'word_count_diff': row.snapshot_word_count_diff,
                'created_at': row.created_at.isoformat() if row.created_at else None,
            }
            for row in snapshot_rows
        ],
    })


@login_required
@require_POST
def api_bookwriter_chapter_snapshot_revert(request, chapter_id, snapshot_id):
    """Revert a chapter's body to the contents of an earlier snapshot.

    Before applying the revert we capture the CURRENT chapter as a
    new auto-snapshot labelled "Before revert" so the user can undo.
    """
    user_profile_id = get_user_profile_id(request)
    if user_profile_id is None:
        return HttpResponseForbidden('No user profile')

    resolved, error_response = _resolve_chapter_for_owner(chapter_id, user_profile_id)
    if error_response is not None:
        return error_response
    chapter, _owning_book = resolved

    try:
        snapshot_to_apply = ChapterSnapshot.objects.get(
            bookwriter_chapter_snapshot_id=snapshot_id,
            link_bookwriter_chapter_id=chapter_id,
            is_active=True,
        )
    except ChapterSnapshot.DoesNotExist:
        return JsonResponse({'ok': False, 'error': 'Snapshot not found'}, status=404)

    now = timezone.now()
    # Capture current state as a safety snapshot before overwrite.
    ChapterSnapshot.objects.create(
        link_bookwriter_chapter_id=chapter_id,
        snapshot_kind_code='auto',
        snapshot_label='Before revert',
        snapshot_text_html=chapter.chapter_text_html,
        snapshot_text_plain=chapter.chapter_text_plain,
        snapshot_word_count=chapter.chapter_word_count or 0,
        snapshot_word_count_diff=None,
        link_created_by_user_profile_id=user_profile_id,
        is_active=True,
        created_at=now,
    )

    chapter.chapter_text_html = snapshot_to_apply.snapshot_text_html
    chapter.chapter_text_plain = snapshot_to_apply.snapshot_text_plain
    chapter.chapter_word_count = snapshot_to_apply.snapshot_word_count or 0
    chapter.last_edited_at = now
    chapter.updated_at = now
    chapter.save(update_fields=[
        'chapter_text_html',
        'chapter_text_plain',
        'chapter_word_count',
        'last_edited_at',
        'updated_at',
    ])

    book_total_words, book_total_chapters = _refresh_book_caches(
        chapter.link_bookwriter_coll_book_id
    )

    return JsonResponse({
        'ok': True,
        'chapter': {
            'id': chapter.bookwriter_chapter_id,
            'number': chapter.chapter_number,
            'title': chapter.chapter_title_en or chapter.chapter_title_bn or '',
            'html': chapter.chapter_text_html or '',
            'word_count': chapter.chapter_word_count or 0,
        },
        'book_total_word_count': book_total_words,
        'book_total_chapter_count': book_total_chapters,
        'reverted_at': now.isoformat(),
    })


@login_required
@require_POST
def api_bookwriter_chapter_publish(request, chapter_id):
    """Publish a chapter — upsert serial_release with status='published'.

    Payload: {} (no fields needed; status is implied by the endpoint).

    Generates a public_chapter_slug from the chapter title (or
    'chapter-N' if untitled). Records the published_at timestamp.
    Caches a 600-char text excerpt for the index card.
    """
    user_profile_id = get_user_profile_id(request)
    if user_profile_id is None:
        return HttpResponseForbidden('No user profile')

    resolved, error_response = _resolve_chapter_for_owner(chapter_id, user_profile_id)
    if error_response is not None:
        return error_response
    chapter, owning_book = resolved

    candidate_title = chapter.chapter_title_en or chapter.chapter_title_bn or ''
    public_slug = _bangla_slugify_or_fallback(candidate_title, chapter.bookwriter_chapter_id)

    # Reject collisions on slug across the whole table — the index is
    # UNIQUE so writing duplicates would fail at the DB layer anyway.
    collision_query = (
        SerialRelease.objects
        .filter(public_chapter_slug=public_slug)
        .exclude(link_bookwriter_chapter_id=chapter_id)
    )
    if collision_query.exists():
        public_slug = public_slug + '-' + str(chapter.bookwriter_chapter_id)

    excerpt_text = (chapter.chapter_text_plain or '').strip()[:MAX_CHAPTER_EXCERPT_LENGTH]
    now = timezone.now()
    release_row = (
        SerialRelease.objects
        .filter(link_bookwriter_chapter_id=chapter_id)
        .first()
    )
    if release_row is None:
        release_row = SerialRelease.objects.create(
            link_bookwriter_chapter_id=chapter_id,
            link_bookwriter_coll_book_id=chapter.link_bookwriter_coll_book_id,
            serial_release_status_code='published',
            scheduled_at=None,
            published_at=now,
            unpublished_at=None,
            public_chapter_slug=public_slug,
            chapter_excerpt=excerpt_text or None,
            read_count_cached=0,
            unique_reader_count_cached=0,
            reaction_count_cached=0,
            comment_count_cached=0,
            preview_view_count_cached=0,
            is_active=True,
            created_at=now,
        )
    else:
        release_row.serial_release_status_code = 'published'
        release_row.published_at = now
        release_row.unpublished_at = None
        release_row.public_chapter_slug = public_slug
        release_row.chapter_excerpt = excerpt_text or None
        release_row.is_active = True
        release_row.updated_at = now
        release_row.save(update_fields=[
            'serial_release_status_code',
            'published_at',
            'unpublished_at',
            'public_chapter_slug',
            'chapter_excerpt',
            'is_active',
            'updated_at',
        ])

    return JsonResponse({
        'ok': True,
        'serial_release': {
            'id': release_row.bookwriter_serial_release_id,
            'status_code': release_row.serial_release_status_code,
            'public_chapter_slug': release_row.public_chapter_slug,
            'public_url': request.build_absolute_uri(
                '/bookwriter/read/' + release_row.public_chapter_slug + '/'
            ),
            'published_at': release_row.published_at.isoformat() if release_row.published_at else None,
        },
    })


@login_required
@require_POST
def api_bookwriter_chapter_unpublish(request, chapter_id):
    """Unpublish a chapter — flip serial_release status to 'unpublished'.
    Keeps the row + slug so re-publishing later produces the same URL."""
    user_profile_id = get_user_profile_id(request)
    if user_profile_id is None:
        return HttpResponseForbidden('No user profile')

    resolved, error_response = _resolve_chapter_for_owner(chapter_id, user_profile_id)
    if error_response is not None:
        return error_response
    chapter, _owning_book = resolved

    try:
        release_row = SerialRelease.objects.get(link_bookwriter_chapter_id=chapter_id)
    except SerialRelease.DoesNotExist:
        return JsonResponse({'ok': False, 'error': 'Chapter has never been published'}, status=404)

    now = timezone.now()
    release_row.serial_release_status_code = 'unpublished'
    release_row.unpublished_at = now
    release_row.updated_at = now
    release_row.save(update_fields=[
        'serial_release_status_code', 'unpublished_at', 'updated_at',
    ])
    return JsonResponse({'ok': True, 'unpublished_at': now.isoformat()})


@login_required
@require_POST
def api_bookwriter_chapter_status_save(request, chapter_id):
    """Save chapter_status_code and/or chapter_visibility_code.

    Request JSON (any subset):
        chapter_status_code      ('blank' / 'draft' / 'revised' / 'final')
        chapter_visibility_code  ('private' / 'beta' / 'public')
    """
    user_profile_id = get_user_profile_id(request)
    if user_profile_id is None:
        return HttpResponseForbidden('No user profile')

    payload, error_response = _read_json_body(request)
    if error_response is not None:
        return error_response

    resolved, error_response = _resolve_chapter_for_owner(chapter_id, user_profile_id)
    if error_response is not None:
        return error_response
    chapter, _owning_book = resolved

    update_field_names = []
    if 'chapter_status_code' in payload:
        candidate = payload['chapter_status_code']
        if not isinstance(candidate, str) or not RefChapterStatus.objects.filter(
            chapter_status_code=candidate, is_active=True,
        ).exists():
            return HttpResponseBadRequest('chapter_status_code must be a known status')
        chapter.chapter_status_code = candidate
        update_field_names.append('chapter_status_code')

    if 'chapter_visibility_code' in payload:
        candidate = payload['chapter_visibility_code']
        if not isinstance(candidate, str) or not RefChapterVisibility.objects.filter(
            chapter_visibility_code=candidate, is_active=True,
        ).exists():
            return HttpResponseBadRequest('chapter_visibility_code must be a known visibility')
        chapter.chapter_visibility_code = candidate
        update_field_names.append('chapter_visibility_code')

    if not update_field_names:
        return HttpResponseBadRequest('No editable fields supplied')

    saved_at = timezone.now()
    chapter.updated_at = saved_at
    update_field_names.append('updated_at')
    chapter.save(update_fields=update_field_names)
    return JsonResponse({'ok': True, 'saved_at': saved_at.isoformat()})

