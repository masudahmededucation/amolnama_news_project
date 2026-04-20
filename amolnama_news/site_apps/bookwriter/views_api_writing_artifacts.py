"""bookwriter — writing artifacts API.

Sprint timer / plot cards / bible entries / margin notes. Grouped
because all four are "writing artifacts" the writer creates while
drafting. Each shares a per-feature owner-resolver in views_api_helpers."""

import json

from django.contrib.auth.decorators import login_required
from django.db.models import Max
from django.http import HttpResponseBadRequest, HttpResponseForbidden, JsonResponse
from django.utils import timezone
from django.views.decorators.http import require_GET, require_POST, require_http_methods

from amolnama_news.site_apps.core.utils import get_user_profile_id, sanitize_user_html

from .models import (
    BibleEntry,
    Chapter,
    CollBook,
    MarginNote,
    PlotCard,
    SprintSession,
)
from .views_api_helpers import (
    _is_valid_bible_category_code,
    _is_valid_hex_color,
    _read_json_body,
    _resolve_bible_entry_for_owner,
    _resolve_book_for_owner,
    _resolve_chapter_for_owner,
    _resolve_margin_note_for_owner,
    _resolve_plot_card_for_owner,
    _strip_html_to_plain,
)


MAX_CARD_TITLE_LENGTH = 500
MAX_CARD_TAG_LENGTH = 100
MAX_ENTRY_NAME_LENGTH = 300
MAX_ENTRY_ROLE_LENGTH = 500
MAX_ENTRY_TAGS_LENGTH = 500
MAX_ENTRY_AVATAR_INITIAL_LENGTH = 5
MAX_ENTRY_AVATAR_HEX_LENGTH = 10
MAX_MARGIN_NOTE_LENGTH = 2000

@login_required
@require_POST
def api_bookwriter_sprint_start(request):
    """Log the start of a writing sprint.

    Request JSON: {
        "planned_minutes":  25,
        "book_id":          123,    # optional
        "chapter_id":       456     # optional
    }
    Returns the new sprint_session id so the JS can mark it
    completed when the timer finishes.
    """
    user_profile_id = get_user_profile_id(request)
    if user_profile_id is None:
        return HttpResponseForbidden('No user profile')

    payload, error_response = _read_json_body(request)
    if error_response is not None:
        return error_response

    planned_minutes = payload.get('planned_minutes')
    if not isinstance(planned_minutes, int) or planned_minutes < 1 or planned_minutes > 240:
        return HttpResponseBadRequest('planned_minutes must be an integer between 1 and 240')

    optional_book_id = payload.get('book_id')
    optional_chapter_id = payload.get('chapter_id')
    if optional_book_id is not None and not isinstance(optional_book_id, int):
        return HttpResponseBadRequest('book_id must be an integer')
    if optional_chapter_id is not None and not isinstance(optional_chapter_id, int):
        return HttpResponseBadRequest('chapter_id must be an integer')

    now = timezone.now()
    new_sprint = SprintSession.objects.create(
        link_user_profile_id=user_profile_id,
        link_bookwriter_coll_book_id=optional_book_id,
        link_bookwriter_chapter_id=optional_chapter_id,
        sprint_planned_minutes=planned_minutes,
        sprint_started_at=now,
        sprint_completed=False,
        sprint_words_added=0,
        is_active=True,
        created_at=now,
    )

    return JsonResponse({
        'ok': True,
        'sprint_session_id': new_sprint.bookwriter_sprint_session_id,
        'started_at': now.isoformat(),
    })


@login_required
@require_POST
def api_bookwriter_sprint_finish(request, sprint_session_id):
    """Mark a sprint as completed (or aborted) and capture the final
    duration + words written during the sprint window.

    Request JSON: {
        "completed":     true | false,
        "actual_seconds": 1500,
        "words_added":    312
    }
    """
    user_profile_id = get_user_profile_id(request)
    if user_profile_id is None:
        return HttpResponseForbidden('No user profile')

    payload, error_response = _read_json_body(request)
    if error_response is not None:
        return error_response

    completed_flag = bool(payload.get('completed'))
    actual_seconds = payload.get('actual_seconds')
    words_added = payload.get('words_added')
    if not isinstance(actual_seconds, int) or actual_seconds < 0:
        return HttpResponseBadRequest('actual_seconds must be a non-negative integer')
    if not isinstance(words_added, int) or words_added < 0:
        return HttpResponseBadRequest('words_added must be a non-negative integer')

    try:
        sprint_row = SprintSession.objects.get(
            bookwriter_sprint_session_id=sprint_session_id,
            link_user_profile_id=user_profile_id,
            is_active=True,
        )
    except SprintSession.DoesNotExist:
        return JsonResponse({'ok': False, 'error': 'Sprint not found'}, status=404)

    now = timezone.now()
    sprint_row.sprint_ended_at = now
    sprint_row.sprint_actual_seconds = actual_seconds
    sprint_row.sprint_words_added = words_added
    sprint_row.sprint_completed = completed_flag
    sprint_row.save(update_fields=[
        'sprint_ended_at',
        'sprint_actual_seconds',
        'sprint_words_added',
        'sprint_completed',
    ])

    return JsonResponse({
        'ok': True,
        'sprint_session_id': sprint_session_id,
        'ended_at': now.isoformat(),
    })


@login_required
@require_POST
def api_bookwriter_book_plot_card_create(request, book_id):
    """Append a new (mostly-blank) plot card to a book's corkboard.

    Optional payload: { "act_structure_code": "act_one" | ... }
    Returns the new card so the JS can render it without a re-fetch.
    """
    user_profile_id = get_user_profile_id(request)
    if user_profile_id is None:
        return HttpResponseForbidden('No user profile')

    payload, error_response = _read_json_body(request)
    if error_response is not None:
        return error_response

    owning_book, error_response = _resolve_book_for_owner(book_id, user_profile_id)
    if error_response is not None:
        return error_response

    act_structure_code = payload.get('act_structure_code')
    if act_structure_code is not None and not isinstance(act_structure_code, str):
        return HttpResponseBadRequest('act_structure_code must be a string')

    aggregate = (
        PlotCard.objects
        .filter(link_bookwriter_coll_book_id=book_id, is_active=True)
        .aggregate(highest_scene=Max('card_scene_number'), highest_sort=Max('sort_order'))
    )
    next_scene_number = (aggregate['highest_scene'] or 0) + 1
    next_sort_order = (aggregate['highest_sort'] or 0) + 1

    now = timezone.now()
    new_card = PlotCard.objects.create(
        link_bookwriter_coll_book_id=book_id,
        link_bookwriter_chapter_id=None,
        act_structure_code=act_structure_code or None,
        card_scene_number=next_scene_number,
        card_title=None,
        card_body=None,
        card_tag='unplaced',
        sort_order=next_sort_order,
        is_active=True,
        created_at=now,
    )

    return JsonResponse({
        'ok': True,
        'plot_card': {
            'id': new_card.bookwriter_plot_card_id,
            'scene_number': new_card.card_scene_number,
            'title': '',
            'body': '',
            'tag': new_card.card_tag,
            'act_structure_code': new_card.act_structure_code or '',
        },
    })


@login_required
@require_POST
def api_bookwriter_plot_card_save(request, plot_card_id):
    """Update title / body / tag / act_structure_code on an existing
    plot card. Any subset of fields may be supplied. All text values
    are stripped of HTML tags before storing — plot cards are plain
    notes, not rich text."""
    user_profile_id = get_user_profile_id(request)
    if user_profile_id is None:
        return HttpResponseForbidden('No user profile')

    payload, error_response = _read_json_body(request)
    if error_response is not None:
        return error_response

    resolved, error_response = _resolve_plot_card_for_owner(plot_card_id, user_profile_id)
    if error_response is not None:
        return error_response
    plot_card, _owning_book = resolved

    update_field_names = []
    if 'card_title' in payload:
        if not isinstance(payload['card_title'], str):
            return HttpResponseBadRequest('card_title must be a string')
        plot_card.card_title = (
            _strip_html_to_plain(payload['card_title']).strip()[:MAX_CARD_TITLE_LENGTH]
            or None
        )
        update_field_names.append('card_title')

    if 'card_body' in payload:
        if not isinstance(payload['card_body'], str):
            return HttpResponseBadRequest('card_body must be a string')
        plot_card.card_body = _strip_html_to_plain(payload['card_body']).strip() or None
        update_field_names.append('card_body')

    if 'card_tag' in payload:
        if payload['card_tag'] is not None and not isinstance(payload['card_tag'], str):
            return HttpResponseBadRequest('card_tag must be a string or null')
        plot_card.card_tag = (
            _strip_html_to_plain(payload['card_tag']).strip()[:MAX_CARD_TAG_LENGTH]
            if payload['card_tag']
            else None
        )
        update_field_names.append('card_tag')

    if 'act_structure_code' in payload:
        if payload['act_structure_code'] is not None and not isinstance(payload['act_structure_code'], str):
            return HttpResponseBadRequest('act_structure_code must be a string or null')
        plot_card.act_structure_code = payload['act_structure_code'] or None
        update_field_names.append('act_structure_code')

    if not update_field_names:
        return HttpResponseBadRequest('No editable fields supplied')

    saved_at = timezone.now()
    plot_card.updated_at = saved_at
    update_field_names.append('updated_at')
    plot_card.save(update_fields=update_field_names)

    return JsonResponse({'ok': True, 'saved_at': saved_at.isoformat()})


@login_required
@require_http_methods(['POST', 'DELETE'])
def api_bookwriter_plot_card_delete(request, plot_card_id):
    """Soft-delete a plot card."""
    user_profile_id = get_user_profile_id(request)
    if user_profile_id is None:
        return HttpResponseForbidden('No user profile')

    resolved, error_response = _resolve_plot_card_for_owner(plot_card_id, user_profile_id)
    if error_response is not None:
        return error_response
    plot_card, _owning_book = resolved

    saved_at = timezone.now()
    plot_card.is_active = False
    plot_card.updated_at = saved_at
    plot_card.save(update_fields=['is_active', 'updated_at'])

    return JsonResponse({
        'ok': True,
        'deleted_plot_card_id': plot_card_id,
        'saved_at': saved_at.isoformat(),
    })


@login_required
@require_POST
def api_bookwriter_plot_card_link_chapter(request, plot_card_id):
    """Set / clear the chapter a plot card belongs to.

    Request JSON: { 'chapter_id': <int> | null }

    The chapter must belong to the same book as the card. Null clears
    the link (card returns to the "unplaced" column on the corkboard).
    """
    user_profile_id = get_user_profile_id(request)
    if user_profile_id is None:
        return HttpResponseForbidden('No user profile')

    payload, error_response = _read_json_body(request)
    if error_response is not None:
        return error_response

    resolved, error_response = _resolve_plot_card_for_owner(plot_card_id, user_profile_id)
    if error_response is not None:
        return error_response
    plot_card, owning_book = resolved

    candidate_chapter_id = payload.get('chapter_id', 'NOT_SUPPLIED')
    if candidate_chapter_id == 'NOT_SUPPLIED':
        return HttpResponseBadRequest('chapter_id is required (use null to clear)')
    if candidate_chapter_id is not None:
        if not isinstance(candidate_chapter_id, int):
            return HttpResponseBadRequest('chapter_id must be an integer or null')
        owns_chapter = Chapter.objects.filter(
            bookwriter_chapter_id=candidate_chapter_id,
            link_bookwriter_coll_book_id=owning_book.bookwriter_coll_book_id,
            is_active=True,
        ).exists()
        if not owns_chapter:
            return HttpResponseBadRequest('chapter_id does not belong to the same book')

    saved_at = timezone.now()
    plot_card.link_bookwriter_chapter_id = candidate_chapter_id
    plot_card.updated_at = saved_at
    plot_card.save(update_fields=['link_bookwriter_chapter_id', 'updated_at'])
    return JsonResponse({'ok': True, 'saved_at': saved_at.isoformat()})


@login_required
@require_POST
def api_bookwriter_book_bible_entry_create(request, book_id):
    """Append a new bible entry to a book.

    Request JSON: {
        "bible_category_code": "characters",   # required, must be seeded
        "entry_name":          "Mira Calloway" # optional, defaults to "Untitled"
    }
    Returns the new entry so the JS can render the row + open the detail
    pane immediately."""
    user_profile_id = get_user_profile_id(request)
    if user_profile_id is None:
        return HttpResponseForbidden('No user profile')

    payload, error_response = _read_json_body(request)
    if error_response is not None:
        return error_response

    owning_book, error_response = _resolve_book_for_owner(book_id, user_profile_id)
    if error_response is not None:
        return error_response

    category_code = payload.get('bible_category_code')
    if not isinstance(category_code, str) or not _is_valid_bible_category_code(category_code):
        return HttpResponseBadRequest('bible_category_code must be a known category')

    raw_name = payload.get('entry_name')
    if raw_name is not None and not isinstance(raw_name, str):
        return HttpResponseBadRequest('entry_name must be a string')
    cleaned_name = (
        _strip_html_to_plain(raw_name).strip()[:MAX_ENTRY_NAME_LENGTH]
        if raw_name
        else ''
    ) or 'Untitled'

    aggregate = (
        BibleEntry.objects
        .filter(
            link_bookwriter_coll_book_id=book_id,
            bible_category_code=category_code,
            is_active=True,
        )
        .aggregate(highest_sort=Max('sort_order'))
    )
    next_sort_order = (aggregate['highest_sort'] or 0) + 1

    avatar_initial = cleaned_name[:1] or '?'

    now = timezone.now()
    new_entry = BibleEntry.objects.create(
        link_bookwriter_coll_book_id=book_id,
        bible_category_code=category_code,
        entry_name=cleaned_name,
        entry_role=None,
        entry_avatar_initial=avatar_initial,
        entry_avatar_color_hex=None,
        entry_avatar_color_hex_2=None,
        entry_image_url=None,
        entry_biography=None,
        entry_attributes_json=None,
        entry_notes=None,
        entry_tags_csv=None,
        sort_order=next_sort_order,
        is_active=True,
        created_at=now,
    )

    return JsonResponse({
        'ok': True,
        'bible_entry': {
            'id': new_entry.bookwriter_bible_entry_id,
            'category_code': new_entry.bible_category_code,
            'name': new_entry.entry_name,
            'role': '',
            'avatar_initial': new_entry.entry_avatar_initial or '',
            'avatar_color_hex': '',
            'avatar_color_hex_2': '',
            'biography': '',
            'notes': '',
            'tags_csv': '',
        },
    })


@login_required
@require_POST
def api_bookwriter_bible_entry_save(request, bible_entry_id):
    """Partial-update a bible entry. Any subset of fields may be supplied.

    Request JSON keys (all optional):
        entry_name, entry_role, entry_biography, entry_notes, entry_tags_csv,
        entry_avatar_initial, entry_avatar_color_hex, entry_avatar_color_hex_2,
        bible_category_code  (move entry to a different category)

    All text fields are stripped of HTML tags before storing — bible
    entries are plain notes, not rich text. Empty-after-strip values
    save NULL except entry_name which is NOT NULL in the DB and falls
    back to "Untitled"."""
    user_profile_id = get_user_profile_id(request)
    if user_profile_id is None:
        return HttpResponseForbidden('No user profile')

    payload, error_response = _read_json_body(request)
    if error_response is not None:
        return error_response

    resolved, error_response = _resolve_bible_entry_for_owner(bible_entry_id, user_profile_id)
    if error_response is not None:
        return error_response
    bible_entry, _owning_book = resolved

    update_field_names = []

    plain_text_field_specs = (
        ('entry_name',           'entry_name',           MAX_ENTRY_NAME_LENGTH,           True),
        ('entry_role',           'entry_role',           MAX_ENTRY_ROLE_LENGTH,           False),
        ('entry_tags_csv',       'entry_tags_csv',       MAX_ENTRY_TAGS_LENGTH,           False),
        ('entry_avatar_initial', 'entry_avatar_initial', MAX_ENTRY_AVATAR_INITIAL_LENGTH, False),
    )
    for payload_key, model_field, max_length, is_required in plain_text_field_specs:
        if payload_key not in payload:
            continue
        raw_value = payload[payload_key]
        if raw_value is not None and not isinstance(raw_value, str):
            return HttpResponseBadRequest(payload_key + ' must be a string or null')
        cleaned_value = (
            _strip_html_to_plain(raw_value).strip()[:max_length]
            if raw_value
            else ''
        )
        if is_required and not cleaned_value:
            cleaned_value = 'Untitled'
        setattr(bible_entry, model_field, cleaned_value or None)
        update_field_names.append(model_field)

    # Hex colour fields are validated against a strict pattern — never
    # passed through the plain-text path because that does not catch
    # `red";attack();"` style injection (the `"` survives strip-tags).
    for hex_field_key in ('entry_avatar_color_hex', 'entry_avatar_color_hex_2'):
        if hex_field_key not in payload:
            continue
        candidate_value = payload[hex_field_key]
        if candidate_value is not None and not isinstance(candidate_value, str):
            return HttpResponseBadRequest(hex_field_key + ' must be a hex colour or null')
        if candidate_value and not _is_valid_hex_color(candidate_value):
            return HttpResponseBadRequest(hex_field_key + ' must be a hex colour like #1a1612')
        setattr(bible_entry, hex_field_key, candidate_value or None)
        update_field_names.append(hex_field_key)

    long_text_field_specs = (
        ('entry_biography', 'entry_biography'),
        ('entry_notes',     'entry_notes'),
    )
    for payload_key, model_field in long_text_field_specs:
        if payload_key not in payload:
            continue
        raw_value = payload[payload_key]
        if raw_value is not None and not isinstance(raw_value, str):
            return HttpResponseBadRequest(payload_key + ' must be a string or null')
        cleaned_value = _strip_html_to_plain(raw_value).strip() if raw_value else ''
        setattr(bible_entry, model_field, cleaned_value or None)
        update_field_names.append(model_field)

    if 'bible_category_code' in payload:
        category_code = payload['bible_category_code']
        if not isinstance(category_code, str) or not _is_valid_bible_category_code(category_code):
            return HttpResponseBadRequest('bible_category_code must be a known category')
        bible_entry.bible_category_code = category_code
        update_field_names.append('bible_category_code')

    # Optional portrait image URL — capped at 1000 chars (DB column).
    if 'entry_image_url' in payload:
        raw_url = payload['entry_image_url']
        if raw_url is not None and (not isinstance(raw_url, str) or len(raw_url) > 1000):
            return HttpResponseBadRequest('entry_image_url must be a string under 1000 chars or null')
        bible_entry.entry_image_url = raw_url or None
        update_field_names.append('entry_image_url')

    # Free-form structured attributes (Age / Height / Eye colour /
    # whatever the writer wants). Validated as JSON-decodable so a
    # malformed payload fails loud rather than corrupting the row.
    if 'entry_attributes_json' in payload:
        raw_json = payload['entry_attributes_json']
        if raw_json is None:
            bible_entry.entry_attributes_json = None
        elif isinstance(raw_json, (dict, list)):
            bible_entry.entry_attributes_json = json.dumps(raw_json, ensure_ascii=False)
        elif isinstance(raw_json, str):
            try:
                json.loads(raw_json)  # validate
            except ValueError:
                return HttpResponseBadRequest('entry_attributes_json must be valid JSON')
            bible_entry.entry_attributes_json = raw_json
        else:
            return HttpResponseBadRequest('entry_attributes_json must be JSON-serializable or null')
        update_field_names.append('entry_attributes_json')

    if not update_field_names:
        return HttpResponseBadRequest('No editable fields supplied')

    saved_at = timezone.now()
    bible_entry.updated_at = saved_at
    update_field_names.append('updated_at')
    bible_entry.save(update_fields=update_field_names)

    return JsonResponse({'ok': True, 'saved_at': saved_at.isoformat()})


@login_required
@require_http_methods(['POST', 'DELETE'])
def api_bookwriter_bible_entry_delete(request, bible_entry_id):
    """Soft-delete a bible entry."""
    user_profile_id = get_user_profile_id(request)
    if user_profile_id is None:
        return HttpResponseForbidden('No user profile')

    resolved, error_response = _resolve_bible_entry_for_owner(bible_entry_id, user_profile_id)
    if error_response is not None:
        return error_response
    bible_entry, _owning_book = resolved

    saved_at = timezone.now()
    bible_entry.is_active = False
    bible_entry.updated_at = saved_at
    bible_entry.save(update_fields=['is_active', 'updated_at'])

    return JsonResponse({
        'ok': True,
        'deleted_bible_entry_id': bible_entry_id,
        'saved_at': saved_at.isoformat(),
    })


@login_required
@require_POST
def api_bookwriter_chapter_margin_note_create(request, chapter_id):
    """Add a margin note to a chapter. Body: { 'note_text': '...' }."""
    user_profile_id = get_user_profile_id(request)
    if user_profile_id is None:
        return HttpResponseForbidden('No user profile')

    payload, error_response = _read_json_body(request)
    if error_response is not None:
        return error_response

    raw_note = payload.get('note_text')
    if not isinstance(raw_note, str):
        return HttpResponseBadRequest('note_text must be a string')
    cleaned_note = _strip_html_to_plain(raw_note).strip()[:MAX_MARGIN_NOTE_LENGTH]
    if not cleaned_note:
        return HttpResponseBadRequest('note_text is required')

    resolved, error_response = _resolve_chapter_for_owner(chapter_id, user_profile_id)
    if error_response is not None:
        return error_response

    now = timezone.now()
    new_note = MarginNote.objects.create(
        link_bookwriter_chapter_id=chapter_id,
        note_text=cleaned_note,
        is_resolved=False,
        is_active=True,
        created_at=now,
    )
    return JsonResponse({
        'ok': True,
        'margin_note': {
            'id': new_note.bookwriter_margin_note_id,
            'note_text': cleaned_note,
            'is_resolved': False,
            'created_at': now.isoformat(),
        },
    })


@login_required
@require_GET
def api_bookwriter_chapter_margin_note_list(request, chapter_id):
    """List active margin notes on a chapter (newest first, capped 200)."""
    user_profile_id = get_user_profile_id(request)
    if user_profile_id is None:
        return HttpResponseForbidden('No user profile')

    resolved, error_response = _resolve_chapter_for_owner(chapter_id, user_profile_id)
    if error_response is not None:
        return error_response

    rows = (
        MarginNote.objects
        .filter(link_bookwriter_chapter_id=chapter_id, is_active=True)
        .order_by('-created_at')[:200]
    )
    return JsonResponse({
        'ok': True,
        'margin_notes': [
            {
                'id': row.bookwriter_margin_note_id,
                'note_text': row.note_text,
                'is_resolved': bool(row.is_resolved),
                'created_at': row.created_at.isoformat() if row.created_at else None,
            }
            for row in rows
        ],
    })


@login_required
@require_POST
def api_bookwriter_margin_note_save(request, margin_note_id):
    """Update a margin note. Body: { 'note_text'?: str, 'is_resolved'?: bool }."""
    user_profile_id = get_user_profile_id(request)
    if user_profile_id is None:
        return HttpResponseForbidden('No user profile')

    payload, error_response = _read_json_body(request)
    if error_response is not None:
        return error_response

    resolved, error_response = _resolve_margin_note_for_owner(margin_note_id, user_profile_id)
    if error_response is not None:
        return error_response
    margin_note, _chapter, _owning_book = resolved

    update_field_names = []
    if 'note_text' in payload:
        if not isinstance(payload['note_text'], str):
            return HttpResponseBadRequest('note_text must be a string')
        cleaned = _strip_html_to_plain(payload['note_text']).strip()[:MAX_MARGIN_NOTE_LENGTH]
        if not cleaned:
            return HttpResponseBadRequest('note_text cannot be empty')
        margin_note.note_text = cleaned
        update_field_names.append('note_text')
    if 'is_resolved' in payload:
        margin_note.is_resolved = bool(payload['is_resolved'])
        update_field_names.append('is_resolved')

    if not update_field_names:
        return HttpResponseBadRequest('No editable fields supplied')

    saved_at = timezone.now()
    margin_note.updated_at = saved_at
    update_field_names.append('updated_at')
    margin_note.save(update_fields=update_field_names)
    return JsonResponse({'ok': True, 'saved_at': saved_at.isoformat()})


@login_required
@require_http_methods(['POST', 'DELETE'])
def api_bookwriter_margin_note_delete(request, margin_note_id):
    """Soft-delete a margin note."""
    user_profile_id = get_user_profile_id(request)
    if user_profile_id is None:
        return HttpResponseForbidden('No user profile')

    resolved, error_response = _resolve_margin_note_for_owner(margin_note_id, user_profile_id)
    if error_response is not None:
        return error_response
    margin_note, _chapter, _owning_book = resolved

    saved_at = timezone.now()
    margin_note.is_active = False
    margin_note.updated_at = saved_at
    margin_note.save(update_fields=['is_active', 'updated_at'])
    return JsonResponse({'ok': True, 'deleted_margin_note_id': margin_note_id, 'saved_at': saved_at.isoformat()})

