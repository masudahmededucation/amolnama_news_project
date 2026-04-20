"""bookwriter — book API.

Book-level endpoints: title/metadata save (extended fields like
synopsis / status / daily target), chapter reorder, cover design save,
public-reader subscribe-toggle (book-keyed even though it lives in the
engagement domain logically)."""

import re

from django.contrib.auth.decorators import login_required
from django.http import HttpResponseBadRequest, HttpResponseForbidden, JsonResponse
from django.utils import timezone
from django.views.decorators.http import require_GET, require_POST, require_http_methods

from amolnama_news.site_apps.core.utils import get_user_profile_id, sanitize_user_html

from .models import (
    BookCoverDesign,
    Chapter,
    CollBook,
    EngagementSerialSubscriber,
    RefBookStatus,
    RefChapterVisibility,
    RefCoverBackground,
    RefCoverFont,
    RefCoverPalette,
    RefCoverTemplate,
    RefPublishCadence,
)
from .views_api_helpers import (
    _is_valid_hex_color,
    _read_json_body,
    _refresh_book_caches,
    _resolve_book_for_owner,
    _strip_html_to_plain,
)


# Cover designer ranges
ALLOWED_COVER_TITLE_SIZE_RANGE = (16, 96)
ALLOWED_COVER_LETTER_SPACING_RANGE = (-10, 40)

@login_required
@require_POST
def api_bookwriter_book_title_save(request, book_id):
    """Save book title / subtitle / author display.

    Request JSON (any combination):
        {
          "book_title":           "...",   # → book_title_en
          "book_subtitle":        "...",   # → book_subtitle_en
          "book_author_display":  "..."    # → book_author_display_en
        }
    Empty / whitespace-only values save NULL so the rail's
    `|default:"Untitled"` fallback can render. All values are
    stripped of HTML tags before storing.
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

    update_fields = []
    updates = {}

    plain_text_field_mapping = (
        ('book_title',          'book_title_en',          500),
        ('book_subtitle',       'book_subtitle_en',       500),
        ('book_author_display', 'book_author_display_en', 300),
    )
    for payload_key, model_field, max_length in plain_text_field_mapping:
        if payload_key in payload:
            raw_value = payload[payload_key]
            if not isinstance(raw_value, str):
                return HttpResponseBadRequest(payload_key + ' must be a string')
            cleaned_value = _strip_html_to_plain(raw_value).strip()[:max_length]
            updates[model_field] = cleaned_value or None
            update_fields.append(model_field)

    # Long-form synopsis (HTML allowed; passes through sanitize_user_html
    # so the writer can use bold / italics in the dashboard description).
    if 'book_synopsis' in payload:
        raw_synopsis = payload['book_synopsis']
        if raw_synopsis is not None and not isinstance(raw_synopsis, str):
            return HttpResponseBadRequest('book_synopsis must be a string or null')
        sanitized_synopsis = sanitize_user_html(raw_synopsis) if raw_synopsis else None
        updates['book_synopsis'] = sanitized_synopsis or None
        update_fields.append('book_synopsis')

    # Numeric word target (whole-book goal — drives a future progress bar).
    if 'book_word_count_target' in payload:
        raw_target = payload['book_word_count_target']
        if raw_target is None:
            updates['book_word_count_target'] = None
        elif isinstance(raw_target, int) and 0 <= raw_target <= 10_000_000:
            updates['book_word_count_target'] = raw_target
        else:
            return HttpResponseBadRequest('book_word_count_target must be a non-negative integer (or null)')
        update_fields.append('book_word_count_target')

    # Daily word target (per-day goal — drives the right-rail progress ring).
    if 'book_daily_word_target' in payload:
        raw_daily = payload['book_daily_word_target']
        if not isinstance(raw_daily, int) or raw_daily < 0 or raw_daily > 100_000:
            return HttpResponseBadRequest('book_daily_word_target must be 0..100000')
        updates['book_daily_word_target'] = raw_daily
        update_fields.append('book_daily_word_target')

    # Status / visibility — validated against ref tables so the writer
    # cannot inject an arbitrary string. Both columns are NOT NULL in SQL,
    # so null payloads are rejected.
    if 'book_status_code' in payload:
        candidate = payload['book_status_code']
        if not isinstance(candidate, str) or not RefBookStatus.objects.filter(book_status_code=candidate, is_active=True).exists():
            return HttpResponseBadRequest('book_status_code must be a known status')
        updates['book_status_code'] = candidate
        update_fields.append('book_status_code')
        # Auto-stamp book_published_at / book_archived_at on FIRST transition into
        # those statuses. Preserve existing timestamps so the row keeps a forensic
        # record of when the book first reached each lifecycle milestone, even if
        # the writer flips status back and forth.
        if (candidate == 'published'
                and owning_book.book_status_code != 'published'
                and owning_book.book_published_at is None):
            updates['book_published_at'] = timezone.now()
            update_fields.append('book_published_at')
        if (candidate == 'archived'
                and owning_book.book_status_code != 'archived'
                and owning_book.book_archived_at is None):
            updates['book_archived_at'] = timezone.now()
            update_fields.append('book_archived_at')

    if 'book_visibility_code' in payload:
        candidate = payload['book_visibility_code']
        if not isinstance(candidate, str) or not RefChapterVisibility.objects.filter(chapter_visibility_code=candidate, is_active=True).exists():
            return HttpResponseBadRequest('book_visibility_code must be a known visibility')
        updates['book_visibility_code'] = candidate
        update_fields.append('book_visibility_code')

    if 'book_language_code' in payload:
        candidate = payload['book_language_code']
        if not isinstance(candidate, str) or candidate not in ('bn', 'en'):
            return HttpResponseBadRequest('book_language_code must be "bn" or "en"')
        updates['book_language_code'] = candidate
        update_fields.append('book_language_code')

    if 'book_cover_image_url' in payload:
        raw_url = payload['book_cover_image_url']
        if raw_url is not None and (not isinstance(raw_url, str) or len(raw_url) > 1000):
            return HttpResponseBadRequest('book_cover_image_url must be a string under 1000 chars')
        updates['book_cover_image_url'] = raw_url or None
        update_fields.append('book_cover_image_url')

    if 'book_slug_en' in payload:
        raw_slug = payload['book_slug_en']
        if raw_slug is not None and not isinstance(raw_slug, str):
            return HttpResponseBadRequest('book_slug_en must be a string or null')
        if raw_slug and not re.match(r'^[a-z0-9][a-z0-9-]{0,298}$', raw_slug):
            return HttpResponseBadRequest('book_slug_en must be lowercase alphanumeric with hyphens')
        updates['book_slug_en'] = raw_slug or None
        update_fields.append('book_slug_en')

    if 'link_publish_cadence_id' in payload:
        candidate = payload['link_publish_cadence_id']
        if candidate is not None:
            if not isinstance(candidate, int) or not RefPublishCadence.objects.filter(bookwriter_ref_publish_cadence_id=candidate, is_active=True).exists():
                return HttpResponseBadRequest('link_publish_cadence_id must be a known cadence id')
        updates['link_publish_cadence_id'] = candidate
        update_fields.append('link_publish_cadence_id')

    if not update_fields:
        return HttpResponseBadRequest('No editable fields supplied')

    saved_at = timezone.now()
    updates['updated_at'] = saved_at
    update_fields.append('updated_at')

    for field_name, field_value in updates.items():
        setattr(owning_book, field_name, field_value)
    owning_book.save(update_fields=update_fields)

    return JsonResponse({'ok': True, 'saved_at': saved_at.isoformat()})


@login_required
@require_POST
def api_bookwriter_book_chapters_reorder(request, book_id):
    """Persist a new chapter order.

    Request JSON: { "chapter_ids": [42, 17, 88, ...] }
    The list must contain every active chapter id of the book and no
    others. Order in the list = new sort_order (1-indexed).

    Why strict membership check: silently dropping or adding ids
    would let a malicious caller hide / leak chapters. Better to
    reject the request than to apply a partial reorder.
    """
    user_profile_id = get_user_profile_id(request)
    if user_profile_id is None:
        return HttpResponseForbidden('No user profile')

    payload, error_response = _read_json_body(request)
    if error_response is not None:
        return error_response

    incoming_ids = payload.get('chapter_ids')
    if not isinstance(incoming_ids, list) or not all(isinstance(v, int) for v in incoming_ids):
        return HttpResponseBadRequest('chapter_ids must be a list of integers')

    owning_book, error_response = _resolve_book_for_owner(book_id, user_profile_id)
    if error_response is not None:
        return error_response

    current_ids = set(
        Chapter.objects
        .filter(link_bookwriter_coll_book_id=book_id, is_active=True)
        .values_list('bookwriter_chapter_id', flat=True)
    )

    if set(incoming_ids) != current_ids:
        return HttpResponseBadRequest(
            'chapter_ids must contain every active chapter exactly once'
        )

    saved_at = timezone.now()
    for new_sort_order, chapter_id in enumerate(incoming_ids, start=1):
        Chapter.objects.filter(
            bookwriter_chapter_id=chapter_id,
            link_bookwriter_coll_book_id=book_id,
        ).update(sort_order=new_sort_order, updated_at=saved_at)

    return JsonResponse({'ok': True, 'saved_at': saved_at.isoformat()})


@login_required
@require_POST
def api_bookwriter_book_cover_design_save(request, book_id):
    """Upsert the book's cover design (1:1 with coll_book).

    Request JSON (any subset; missing keys leave existing value alone):
        cover_template_code               -> resolved to link_cover_template_id
        cover_title_size_pt    (16-96)
        cover_letter_spacing_unit (-10..40)
        cover_palette_bg_hex_override     ('#rrggbb' or null)
        cover_palette_fg_hex_override     ('#rrggbb' or null)
        cover_palette_accent_hex_override ('#rrggbb' or null)

    First call inserts the row; subsequent calls UPDATE in place.
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

    template_id_to_set = None
    if 'cover_template_code' in payload:
        template_code = payload['cover_template_code']
        if template_code is None:
            template_id_to_set = (None, True)
        else:
            if not isinstance(template_code, str):
                return HttpResponseBadRequest('cover_template_code must be a string or null')
            try:
                ref_row = RefCoverTemplate.objects.get(
                    cover_template_code=template_code, is_active=True,
                )
            except RefCoverTemplate.DoesNotExist:
                return HttpResponseBadRequest('cover_template_code is not a known template')
            template_id_to_set = (ref_row.bookwriter_ref_cover_template_id, True)

    title_size_to_set = None
    if 'cover_title_size_pt' in payload:
        candidate = payload['cover_title_size_pt']
        lo, hi = ALLOWED_COVER_TITLE_SIZE_RANGE
        if not isinstance(candidate, int) or candidate < lo or candidate > hi:
            return HttpResponseBadRequest('cover_title_size_pt must be int in [{},{}]'.format(lo, hi))
        title_size_to_set = (candidate, True)

    spacing_to_set = None
    if 'cover_letter_spacing_unit' in payload:
        candidate = payload['cover_letter_spacing_unit']
        lo, hi = ALLOWED_COVER_LETTER_SPACING_RANGE
        if not isinstance(candidate, int) or candidate < lo or candidate > hi:
            return HttpResponseBadRequest('cover_letter_spacing_unit must be int in [{},{}]'.format(lo, hi))
        spacing_to_set = (candidate, True)

    hex_overrides = {}
    for hex_field in ('cover_palette_bg_hex_override',
                      'cover_palette_fg_hex_override',
                      'cover_palette_accent_hex_override'):
        if hex_field in payload:
            value = payload[hex_field]
            if value is not None and not _is_valid_hex_color(value):
                return HttpResponseBadRequest(hex_field + ' must be a hex colour or null')
            hex_overrides[hex_field] = value or None

    # FK ids — each validated against its ref table so we can't store
    # a dangling reference. Null is allowed (clears the choice).
    cover_fk_specs = (
        ('cover_palette_code',    'link_cover_palette_id',    RefCoverPalette,    'bookwriter_ref_cover_palette_id',   'cover_palette_code'),
        ('cover_background_code', 'link_cover_background_id', RefCoverBackground, 'bookwriter_ref_cover_background_id','cover_background_code'),
        ('cover_font_code',       'link_cover_font_id',       RefCoverFont,       'bookwriter_ref_cover_font_id',      'cover_font_code'),
    )
    cover_fk_id_updates = {}
    for payload_key, model_field, ref_class, ref_pk_field, ref_code_field in cover_fk_specs:
        if payload_key not in payload:
            continue
        candidate = payload[payload_key]
        if candidate is None:
            cover_fk_id_updates[model_field] = None
            continue
        if not isinstance(candidate, str):
            return HttpResponseBadRequest(payload_key + ' must be a code string or null')
        ref_id = (
            ref_class.objects
            .filter(**{ref_code_field: candidate, 'is_active': True})
            .values_list(ref_pk_field, flat=True)
            .first()
        )
        if ref_id is None:
            return HttpResponseBadRequest(payload_key + ' is not a known code')
        cover_fk_id_updates[model_field] = ref_id

    # Optional URL columns for custom uploaded background + the
    # rendered-preview thumbnail (set by a downstream renderer).
    extra_url_updates = {}
    for url_payload_key, model_field in (
        ('cover_custom_image_url',     'cover_custom_image_url'),
        ('cover_rendered_preview_url', 'cover_rendered_preview_url'),
    ):
        if url_payload_key in payload:
            raw_url = payload[url_payload_key]
            if raw_url is not None and (not isinstance(raw_url, str) or len(raw_url) > 1000):
                return HttpResponseBadRequest(url_payload_key + ' must be a string under 1000 chars')
            extra_url_updates[model_field] = raw_url or None

    now = timezone.now()
    cover_row = (
        BookCoverDesign.objects
        .filter(link_bookwriter_coll_book_id=book_id, is_active=True)
        .first()
    )
    if cover_row is None:
        cover_row = BookCoverDesign.objects.create(
            link_bookwriter_coll_book_id=book_id,
            link_cover_template_id=(template_id_to_set[0] if template_id_to_set else None),
            link_cover_palette_id=cover_fk_id_updates.get('link_cover_palette_id'),
            link_cover_background_id=cover_fk_id_updates.get('link_cover_background_id'),
            link_cover_font_id=cover_fk_id_updates.get('link_cover_font_id'),
            cover_title_size_pt=(title_size_to_set[0] if title_size_to_set else 42),
            cover_letter_spacing_unit=(spacing_to_set[0] if spacing_to_set else 0),
            cover_palette_bg_hex_override=hex_overrides.get('cover_palette_bg_hex_override'),
            cover_palette_fg_hex_override=hex_overrides.get('cover_palette_fg_hex_override'),
            cover_palette_accent_hex_override=hex_overrides.get('cover_palette_accent_hex_override'),
            cover_custom_image_url=extra_url_updates.get('cover_custom_image_url'),
            cover_rendered_preview_url=extra_url_updates.get('cover_rendered_preview_url'),
            is_active=True,
            created_at=now,
        )
    else:
        update_field_names = ['updated_at']
        if template_id_to_set:
            cover_row.link_cover_template_id = template_id_to_set[0]
            update_field_names.append('link_cover_template_id')
        if title_size_to_set:
            cover_row.cover_title_size_pt = title_size_to_set[0]
            update_field_names.append('cover_title_size_pt')
        if spacing_to_set:
            cover_row.cover_letter_spacing_unit = spacing_to_set[0]
            update_field_names.append('cover_letter_spacing_unit')
        for hex_field, hex_value in hex_overrides.items():
            setattr(cover_row, hex_field, hex_value)
            update_field_names.append(hex_field)
        for fk_field, fk_value in cover_fk_id_updates.items():
            setattr(cover_row, fk_field, fk_value)
            update_field_names.append(fk_field)
        for url_field, url_value in extra_url_updates.items():
            setattr(cover_row, url_field, url_value)
            update_field_names.append(url_field)
        cover_row.updated_at = now
        cover_row.save(update_fields=update_field_names)

    return JsonResponse({
        'ok': True,
        'cover_design': {
            'id': cover_row.bookwriter_book_cover_design_id,
            'link_cover_template_id': cover_row.link_cover_template_id,
            'link_cover_palette_id': cover_row.link_cover_palette_id,
            'link_cover_background_id': cover_row.link_cover_background_id,
            'link_cover_font_id': cover_row.link_cover_font_id,
            'cover_title_size_pt': cover_row.cover_title_size_pt,
            'cover_letter_spacing_unit': cover_row.cover_letter_spacing_unit,
            'cover_palette_bg_hex_override': cover_row.cover_palette_bg_hex_override,
            'cover_palette_fg_hex_override': cover_row.cover_palette_fg_hex_override,
            'cover_palette_accent_hex_override': cover_row.cover_palette_accent_hex_override,
            'cover_custom_image_url': cover_row.cover_custom_image_url,
            'cover_rendered_preview_url': cover_row.cover_rendered_preview_url,
        },
        'saved_at': now.isoformat(),
    })


@login_required
@require_POST
def api_bookwriter_book_subscribe_toggle(request, book_id):
    """Toggle the caller's subscription to a book OR change the email
    notification preference for the existing subscription.

    Request JSON (all optional):
        email_notifications_enabled  bool
            If supplied: only updates the email pref, does NOT toggle the
            is_active subscription state. Lets the reader change "send me
            the next chapter by email" without unsubscribing.
        (no fields): toggles is_active subscription state.

    Idempotent — calling twice with no fields subscribes then unsubscribes.
    UNIQUE constraint on (book, user) means we upsert by row. The first
    subscription defaults email_notifications_enabled=True.
    """
    user_profile_id = get_user_profile_id(request)
    if user_profile_id is None:
        return HttpResponseForbidden('No user profile')

    if not CollBook.objects.filter(bookwriter_coll_book_id=book_id, is_active=True).exists():
        return JsonResponse({'ok': False, 'error': 'Book not found'}, status=404)

    payload, error_response = _read_json_body(request)
    if error_response is not None and request.body:
        return error_response
    payload = payload or {}

    explicit_email_pref = payload.get('email_notifications_enabled')
    if 'email_notifications_enabled' in payload and not isinstance(explicit_email_pref, bool):
        return HttpResponseBadRequest('email_notifications_enabled must be a boolean')

    now = timezone.now()
    existing_row = (
        EngagementSerialSubscriber.objects
        .filter(link_bookwriter_coll_book_id=book_id, link_user_profile_id=user_profile_id)
        .first()
    )
    if existing_row is None:
        EngagementSerialSubscriber.objects.create(
            link_bookwriter_coll_book_id=book_id,
            link_user_profile_id=user_profile_id,
            subscribed_at=now,
            unsubscribed_at=None,
            email_notifications_enabled=(True if explicit_email_pref is None else explicit_email_pref),
            is_active=True,
            created_at=now,
        )
        return JsonResponse({
            'ok': True,
            'is_subscribed': True,
            'email_notifications_enabled': (True if explicit_email_pref is None else explicit_email_pref),
        })

    # Email-pref-only update path: client supplied the key but is otherwise
    # asking us to keep the subscription state where it is.
    if 'email_notifications_enabled' in payload:
        existing_row.email_notifications_enabled = explicit_email_pref
        existing_row.updated_at = now
        existing_row.save(update_fields=['email_notifications_enabled', 'updated_at'])
        return JsonResponse({
            'ok': True,
            'is_subscribed': bool(existing_row.is_active and existing_row.unsubscribed_at is None),
            'email_notifications_enabled': existing_row.email_notifications_enabled,
        })

    # No fields supplied → toggle is_active. Email pref unchanged.
    is_currently_subscribed = bool(existing_row.is_active and existing_row.unsubscribed_at is None)
    if is_currently_subscribed:
        existing_row.unsubscribed_at = now
        existing_row.is_active = False
    else:
        existing_row.subscribed_at = now
        existing_row.unsubscribed_at = None
        existing_row.is_active = True
    existing_row.updated_at = now
    existing_row.save(update_fields=['subscribed_at', 'unsubscribed_at', 'is_active', 'updated_at'])
    return JsonResponse({
        'ok': True,
        'is_subscribed': not is_currently_subscribed,
        'email_notifications_enabled': existing_row.email_notifications_enabled,
    })

