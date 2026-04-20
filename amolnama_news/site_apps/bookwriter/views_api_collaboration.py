"""bookwriter — collaboration API.

Beta workflow: share-link mint/list/revoke, per-reader invite/list/remove,
chapter-anchored beta comments (create/list/resolve/delete).
Public engagement: react/comment/pin/view on a published release."""

import re

from django.contrib.auth.decorators import login_required
from django.http import HttpResponseBadRequest, HttpResponseForbidden, JsonResponse
from django.utils import timezone
from django.views.decorators.http import require_GET, require_POST, require_http_methods

from amolnama_news.site_apps.core.utils import get_user_profile_id, sanitize_user_html

from .models import (
    BetaComment,
    BetaReader,
    BetaShareLink,
    Chapter,
    CollBook,
    EngagementSerialComment,
    EngagementSerialReaction,
    EngagementSerialView,
    RefBetaPermission,
    RefViewDevice,
    RefViewReferrer,
    SerialRelease,
)
from .views_api_helpers import (
    _generate_share_token,
    _read_json_body,
    _resolve_beta_reader_for_owner,
    _resolve_book_for_owner,
    _resolve_published_release,
    _strip_html_to_plain,
)


# Constants
ALLOWED_BETA_PERMISSIONS = ('read', 'comment', 'suggest')
MAX_READER_EMAIL_LENGTH = 254
MAX_READER_DISPLAY_NAME_LENGTH = 200
MAX_BETA_COMMENT_LENGTH = 4000
MAX_BETA_COMMENT_ANCHOR_TEXT_LENGTH = 500
ALLOWED_BETA_COMMENT_KINDS = ('comment', 'suggestion', 'praise')
ALLOWED_SUGGESTION_RESOLUTIONS = ('accepted', 'rejected', 'pending')
ALLOWED_REACTION_KINDS = ('heart', 'fire', 'thinking', 'tear', 'clap')
MAX_PUBLIC_COMMENT_LENGTH = 4000

@login_required
@require_POST
def api_bookwriter_book_beta_share_create(request, book_id):
    """Mint a new revocable share link for a book.

    Request JSON (optional):
        beta_permission_code: 'read' | 'comment' | 'suggest'   (default 'read')
        share_expires_at:     ISO-8601 string                   (optional)

    Returns the token + the absolute share URL the writer copies into
    Slack / WhatsApp / email.
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

    permission_code = payload.get('beta_permission_code') or 'read'
    if permission_code not in ALLOWED_BETA_PERMISSIONS:
        return HttpResponseBadRequest('beta_permission_code must be one of ' + ','.join(ALLOWED_BETA_PERMISSIONS))

    expires_at = None
    if payload.get('share_expires_at'):
        try:
            from django.utils.dateparse import parse_datetime
            expires_at = parse_datetime(payload['share_expires_at'])
            if expires_at is None:
                raise ValueError
        except (ValueError, TypeError):
            return HttpResponseBadRequest('share_expires_at must be ISO-8601')

    now = timezone.now()
    new_share = BetaShareLink.objects.create(
        link_bookwriter_coll_book_id=book_id,
        share_link_token=_generate_share_token(),
        beta_permission_code=permission_code,
        share_expires_at=expires_at,
        link_created_by_user_profile_id=user_profile_id,
        is_active=True,
        created_at=now,
    )

    share_url = request.build_absolute_uri(
        '/bookwriter/beta/' + new_share.share_link_token + '/'
    )
    return JsonResponse({
        'ok': True,
        'beta_share_link': {
            'id': new_share.bookwriter_beta_share_link_id,
            'token': new_share.share_link_token,
            'permission_code': new_share.beta_permission_code,
            'share_url': share_url,
            'expires_at': expires_at.isoformat() if expires_at else None,
            'created_at': now.isoformat(),
        },
    })


@login_required
@require_GET
def api_bookwriter_book_beta_share_list(request, book_id):
    """List all (active + revoked) share links for the book so the
    writer can audit what's outstanding."""
    user_profile_id = get_user_profile_id(request)
    if user_profile_id is None:
        return HttpResponseForbidden('No user profile')

    owning_book, error_response = _resolve_book_for_owner(book_id, user_profile_id)
    if error_response is not None:
        return error_response

    rows = (
        BetaShareLink.objects
        .filter(link_bookwriter_coll_book_id=book_id)
        .order_by('-created_at')[:100]
    )
    return JsonResponse({
        'ok': True,
        'beta_share_links': [
            {
                'id': row.bookwriter_beta_share_link_id,
                'token': row.share_link_token,
                'permission_code': row.beta_permission_code,
                'share_url': request.build_absolute_uri('/bookwriter/beta/' + row.share_link_token + '/'),
                'expires_at': row.share_expires_at.isoformat() if row.share_expires_at else None,
                'revoked_at': row.share_revoked_at.isoformat() if row.share_revoked_at else None,
                'is_active': bool(row.is_active and row.share_revoked_at is None),
                'created_at': row.created_at.isoformat() if row.created_at else None,
            }
            for row in rows
        ],
    })


@login_required
@require_POST
def api_bookwriter_beta_share_revoke(request, beta_share_link_id):
    """Revoke a share link. Marks share_revoked_at + is_active=False
    so the public reader page returns 404 for that token."""
    user_profile_id = get_user_profile_id(request)
    if user_profile_id is None:
        return HttpResponseForbidden('No user profile')

    try:
        share_row = BetaShareLink.objects.get(bookwriter_beta_share_link_id=beta_share_link_id)
    except BetaShareLink.DoesNotExist:
        return JsonResponse({'ok': False, 'error': 'Share link not found'}, status=404)

    owning_book, error_response = _resolve_book_for_owner(
        share_row.link_bookwriter_coll_book_id, user_profile_id,
    )
    if error_response is not None:
        return error_response

    now = timezone.now()
    share_row.share_revoked_at = now
    share_row.is_active = False
    share_row.updated_at = now
    share_row.save(update_fields=['share_revoked_at', 'is_active', 'updated_at'])
    return JsonResponse({'ok': True, 'revoked_at': now.isoformat()})


@login_required
@require_POST
def api_bookwriter_book_beta_reader_invite(request, book_id):
    """Invite a beta reader to a book (by email).

    Request JSON: {
        'reader_email':         'someone@example.com',
        'reader_display_name':  'Jane Doe'    (optional),
        'beta_permission_code': 'comment'     (default 'read'),
    }
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

    reader_email = payload.get('reader_email')
    if not isinstance(reader_email, str) or '@' not in reader_email or len(reader_email) > MAX_READER_EMAIL_LENGTH:
        return HttpResponseBadRequest('reader_email must be a valid email')
    reader_email = reader_email.strip().lower()

    reader_display_name = payload.get('reader_display_name')
    if reader_display_name is not None:
        if not isinstance(reader_display_name, str):
            return HttpResponseBadRequest('reader_display_name must be a string or null')
        reader_display_name = _strip_html_to_plain(reader_display_name).strip()[:MAX_READER_DISPLAY_NAME_LENGTH] or None

    permission_code = payload.get('beta_permission_code') or 'read'
    if not RefBetaPermission.objects.filter(beta_permission_code=permission_code, is_active=True).exists():
        return HttpResponseBadRequest('beta_permission_code must be a known permission')

    avatar_initial = (reader_display_name or reader_email)[:1]
    now = timezone.now()
    new_reader = BetaReader.objects.create(
        link_bookwriter_coll_book_id=book_id,
        link_bookwriter_beta_share_link_id=None,
        reader_email=reader_email,
        link_reader_user_profile_id=None,
        reader_display_name=reader_display_name,
        reader_avatar_initial=avatar_initial,
        reader_avatar_color_hex=None,
        beta_permission_code=permission_code,
        invited_at=now,
        is_active=True,
        created_at=now,
    )
    return JsonResponse({
        'ok': True,
        'beta_reader': {
            'id': new_reader.bookwriter_beta_reader_id,
            'email': new_reader.reader_email,
            'display_name': new_reader.reader_display_name,
            'avatar_initial': new_reader.reader_avatar_initial,
            'permission_code': new_reader.beta_permission_code,
            'invited_at': now.isoformat(),
        },
    })


@login_required
@require_GET
def api_bookwriter_book_beta_reader_list(request, book_id):
    """List active beta readers for a book."""
    user_profile_id = get_user_profile_id(request)
    if user_profile_id is None:
        return HttpResponseForbidden('No user profile')

    owning_book, error_response = _resolve_book_for_owner(book_id, user_profile_id)
    if error_response is not None:
        return error_response

    rows = (
        BetaReader.objects
        .filter(link_bookwriter_coll_book_id=book_id, is_active=True)
        .order_by('-created_at')[:200]
    )
    return JsonResponse({
        'ok': True,
        'beta_readers': [
            {
                'id': row.bookwriter_beta_reader_id,
                'email': row.reader_email,
                'display_name': row.reader_display_name,
                'avatar_initial': row.reader_avatar_initial,
                'permission_code': row.beta_permission_code,
                'invited_at': row.invited_at.isoformat() if row.invited_at else None,
                'accepted_at': row.accepted_at.isoformat() if row.accepted_at else None,
                'last_visited_at': row.last_visited_at.isoformat() if row.last_visited_at else None,
            }
            for row in rows
        ],
    })


@login_required
@require_http_methods(['POST', 'DELETE'])
def api_bookwriter_beta_reader_remove(request, beta_reader_id):
    """Soft-remove a beta reader (revokes their access)."""
    user_profile_id = get_user_profile_id(request)
    if user_profile_id is None:
        return HttpResponseForbidden('No user profile')

    resolved, error_response = _resolve_beta_reader_for_owner(beta_reader_id, user_profile_id)
    if error_response is not None:
        return error_response
    beta_reader, _owning_book = resolved

    saved_at = timezone.now()
    beta_reader.is_active = False
    beta_reader.updated_at = saved_at
    beta_reader.save(update_fields=['is_active', 'updated_at'])
    return JsonResponse({'ok': True, 'removed_beta_reader_id': beta_reader_id})


@login_required
@require_POST
def api_bookwriter_chapter_beta_comment_create(request, chapter_id):
    """Author a beta comment on a chapter.

    Request JSON: {
        'beta_reader_id':              <int>,    # required, must own
        'comment_text':                str,      # required
        'comment_kind_code':           'comment' | 'suggestion' | 'praise',
        'comment_anchor_offset':       int      (optional),
        'comment_anchor_length':       int      (optional),
        'comment_anchor_text':         str      (optional, capped 500),
        'suggestion_replacement_text': str      (only for 'suggestion'),
    }
    """
    user_profile_id = get_user_profile_id(request)
    if user_profile_id is None:
        return HttpResponseForbidden('No user profile')

    payload, error_response = _read_json_body(request)
    if error_response is not None:
        return error_response

    beta_reader_id = payload.get('beta_reader_id')
    if not isinstance(beta_reader_id, int):
        return HttpResponseBadRequest('beta_reader_id must be an integer')

    try:
        beta_reader = BetaReader.objects.get(
            bookwriter_beta_reader_id=beta_reader_id,
            is_active=True,
            link_reader_user_profile_id=user_profile_id,
        )
    except BetaReader.DoesNotExist:
        return HttpResponseForbidden('Not a registered beta reader for this book')

    try:
        chapter = Chapter.objects.get(bookwriter_chapter_id=chapter_id, is_active=True)
    except Chapter.DoesNotExist:
        return JsonResponse({'ok': False, 'error': 'Chapter not found'}, status=404)
    if chapter.link_bookwriter_coll_book_id != beta_reader.link_bookwriter_coll_book_id:
        return HttpResponseForbidden('Beta reader does not have access to this chapter')

    raw_text = payload.get('comment_text')
    if not isinstance(raw_text, str):
        return HttpResponseBadRequest('comment_text must be a string')
    cleaned_text = _strip_html_to_plain(raw_text).strip()[:MAX_BETA_COMMENT_LENGTH]
    if not cleaned_text:
        return HttpResponseBadRequest('comment_text cannot be empty')

    comment_kind_code = payload.get('comment_kind_code') or 'comment'
    if comment_kind_code not in ALLOWED_BETA_COMMENT_KINDS:
        return HttpResponseBadRequest('comment_kind_code must be one of ' + ','.join(ALLOWED_BETA_COMMENT_KINDS))

    anchor_offset = payload.get('comment_anchor_offset')
    anchor_length = payload.get('comment_anchor_length')
    for anchor_value, anchor_label in ((anchor_offset, 'comment_anchor_offset'), (anchor_length, 'comment_anchor_length')):
        if anchor_value is not None and (not isinstance(anchor_value, int) or anchor_value < 0):
            return HttpResponseBadRequest(anchor_label + ' must be a non-negative integer or null')

    raw_anchor_text = payload.get('comment_anchor_text')
    cleaned_anchor_text = None
    if raw_anchor_text is not None:
        if not isinstance(raw_anchor_text, str):
            return HttpResponseBadRequest('comment_anchor_text must be a string or null')
        cleaned_anchor_text = _strip_html_to_plain(raw_anchor_text).strip()[:MAX_BETA_COMMENT_ANCHOR_TEXT_LENGTH] or None

    raw_replacement = payload.get('suggestion_replacement_text')
    cleaned_replacement = None
    if raw_replacement is not None:
        if not isinstance(raw_replacement, str):
            return HttpResponseBadRequest('suggestion_replacement_text must be a string or null')
        cleaned_replacement = _strip_html_to_plain(raw_replacement).strip() or None

    now = timezone.now()
    new_comment = BetaComment.objects.create(
        link_bookwriter_chapter_id=chapter_id,
        link_bookwriter_beta_reader_id=beta_reader_id,
        comment_anchor_offset=anchor_offset,
        comment_anchor_length=anchor_length,
        comment_anchor_text=cleaned_anchor_text,
        comment_text=cleaned_text,
        comment_kind_code=comment_kind_code,
        suggestion_replacement_text=cleaned_replacement,
        suggestion_resolution_code='pending' if comment_kind_code == 'suggestion' else None,
        is_resolved=False,
        is_active=True,
        created_at=now,
    )
    return JsonResponse({
        'ok': True,
        'beta_comment': {
            'id': new_comment.bookwriter_beta_comment_id,
            'kind': new_comment.comment_kind_code,
            'text': new_comment.comment_text,
            'anchor_text': new_comment.comment_anchor_text,
            'created_at': now.isoformat(),
        },
    })


@login_required
@require_GET
def api_bookwriter_chapter_beta_comment_list(request, chapter_id):
    """List beta comments on a chapter. Book owner sees all; a beta
    reader sees only their own. Capped 500 rows."""
    user_profile_id = get_user_profile_id(request)
    if user_profile_id is None:
        return HttpResponseForbidden('No user profile')

    try:
        chapter = Chapter.objects.get(bookwriter_chapter_id=chapter_id, is_active=True)
    except Chapter.DoesNotExist:
        return JsonResponse({'ok': False, 'error': 'Chapter not found'}, status=404)

    is_owner = CollBook.objects.filter(
        bookwriter_coll_book_id=chapter.link_bookwriter_coll_book_id,
        link_owner_user_profile_id=user_profile_id,
    ).exists()
    if is_owner:
        rows = BetaComment.objects.filter(link_bookwriter_chapter_id=chapter_id, is_active=True)
    else:
        my_reader_ids = list(
            BetaReader.objects
            .filter(
                link_bookwriter_coll_book_id=chapter.link_bookwriter_coll_book_id,
                link_reader_user_profile_id=user_profile_id,
                is_active=True,
            )
            .values_list('bookwriter_beta_reader_id', flat=True)
        )
        if not my_reader_ids:
            return HttpResponseForbidden('Not the owner or a beta reader')
        rows = BetaComment.objects.filter(
            link_bookwriter_chapter_id=chapter_id,
            link_bookwriter_beta_reader_id__in=my_reader_ids,
            is_active=True,
        )

    rows = rows.order_by('-created_at')[:500]
    return JsonResponse({
        'ok': True,
        'beta_comments': [
            {
                'id': row.bookwriter_beta_comment_id,
                'beta_reader_id': row.link_bookwriter_beta_reader_id,
                'kind': row.comment_kind_code,
                'text': row.comment_text,
                'anchor_text': row.comment_anchor_text,
                'anchor_offset': row.comment_anchor_offset,
                'anchor_length': row.comment_anchor_length,
                'suggestion_replacement_text': row.suggestion_replacement_text,
                'suggestion_resolution_code': row.suggestion_resolution_code,
                'is_resolved': bool(row.is_resolved),
                'created_at': row.created_at.isoformat() if row.created_at else None,
            }
            for row in rows
        ],
    })


@login_required
@require_POST
def api_bookwriter_beta_comment_resolve(request, beta_comment_id):
    """Book owner: mark a beta comment resolved (and optionally set
    suggestion_resolution_code = accepted | rejected for suggestions)."""
    user_profile_id = get_user_profile_id(request)
    if user_profile_id is None:
        return HttpResponseForbidden('No user profile')

    payload, error_response = _read_json_body(request)
    if error_response is not None:
        return error_response

    try:
        comment_row = BetaComment.objects.get(bookwriter_beta_comment_id=beta_comment_id, is_active=True)
    except BetaComment.DoesNotExist:
        return JsonResponse({'ok': False, 'error': 'Beta comment not found'}, status=404)

    chapter = Chapter.objects.filter(bookwriter_chapter_id=comment_row.link_bookwriter_chapter_id).first()
    if chapter is None:
        return JsonResponse({'ok': False, 'error': 'Chapter not found'}, status=404)
    is_owner = CollBook.objects.filter(
        bookwriter_coll_book_id=chapter.link_bookwriter_coll_book_id,
        link_owner_user_profile_id=user_profile_id,
    ).exists()
    if not is_owner:
        return HttpResponseForbidden('Only the book owner can resolve beta comments')

    update_field_names = []
    if 'is_resolved' in payload:
        comment_row.is_resolved = bool(payload['is_resolved'])
        update_field_names.append('is_resolved')
    if 'suggestion_resolution_code' in payload:
        candidate = payload['suggestion_resolution_code']
        if candidate is not None and candidate not in ALLOWED_SUGGESTION_RESOLUTIONS:
            return HttpResponseBadRequest('suggestion_resolution_code must be ' + ','.join(ALLOWED_SUGGESTION_RESOLUTIONS) + ' or null')
        comment_row.suggestion_resolution_code = candidate
        update_field_names.append('suggestion_resolution_code')
    if not update_field_names:
        return HttpResponseBadRequest('No editable fields supplied')

    saved_at = timezone.now()
    comment_row.updated_at = saved_at
    update_field_names.append('updated_at')
    comment_row.save(update_fields=update_field_names)
    return JsonResponse({'ok': True, 'saved_at': saved_at.isoformat()})


@login_required
@require_http_methods(['POST', 'DELETE'])
def api_bookwriter_beta_comment_delete(request, beta_comment_id):
    """Soft-delete a beta comment. Either the book owner OR the
    authoring beta reader can delete."""
    user_profile_id = get_user_profile_id(request)
    if user_profile_id is None:
        return HttpResponseForbidden('No user profile')

    try:
        comment_row = BetaComment.objects.get(bookwriter_beta_comment_id=beta_comment_id, is_active=True)
    except BetaComment.DoesNotExist:
        return JsonResponse({'ok': False, 'error': 'Beta comment not found'}, status=404)

    chapter = Chapter.objects.filter(bookwriter_chapter_id=comment_row.link_bookwriter_chapter_id).first()
    if chapter is None:
        return JsonResponse({'ok': False, 'error': 'Chapter not found'}, status=404)
    is_owner = CollBook.objects.filter(
        bookwriter_coll_book_id=chapter.link_bookwriter_coll_book_id,
        link_owner_user_profile_id=user_profile_id,
    ).exists()
    is_author = BetaReader.objects.filter(
        bookwriter_beta_reader_id=comment_row.link_bookwriter_beta_reader_id,
        link_reader_user_profile_id=user_profile_id,
        is_active=True,
    ).exists()
    if not (is_owner or is_author):
        return HttpResponseForbidden('Only the owner or comment author can delete')

    saved_at = timezone.now()
    comment_row.is_active = False
    comment_row.updated_at = saved_at
    comment_row.save(update_fields=['is_active', 'updated_at'])
    return JsonResponse({'ok': True, 'deleted_beta_comment_id': beta_comment_id})


@login_required
@require_POST
def api_bookwriter_release_reaction_toggle(request, serial_release_id):
    """Toggle a reaction on a published chapter.

    Request JSON: { 'reaction_kind_code': 'heart' | 'fire' | 'thinking' | 'tear' | 'clap' }
    UNIQUE on (release, user, kind) means we flip is_active in place.
    Bumps reaction_count_cached on the parent release (best-effort).
    """
    user_profile_id = get_user_profile_id(request)
    if user_profile_id is None:
        return HttpResponseForbidden('No user profile')

    payload, error_response = _read_json_body(request)
    if error_response is not None:
        return error_response

    reaction_kind = payload.get('reaction_kind_code') or 'heart'
    if reaction_kind not in ALLOWED_REACTION_KINDS:
        return HttpResponseBadRequest('reaction_kind_code must be one of ' + ','.join(ALLOWED_REACTION_KINDS))

    release = _resolve_published_release(serial_release_id)
    if release is None:
        return JsonResponse({'ok': False, 'error': 'Release not found'}, status=404)

    now = timezone.now()
    existing_reaction = (
        EngagementSerialReaction.objects
        .filter(
            link_bookwriter_serial_release_id=serial_release_id,
            link_user_profile_id=user_profile_id,
            reaction_kind_code=reaction_kind,
        )
        .first()
    )
    if existing_reaction is None:
        EngagementSerialReaction.objects.create(
            link_bookwriter_serial_release_id=serial_release_id,
            link_user_profile_id=user_profile_id,
            reaction_kind_code=reaction_kind,
            is_active=True,
            created_at=now,
        )
        is_reacted = True
    else:
        new_active = not existing_reaction.is_active
        existing_reaction.is_active = new_active
        existing_reaction.updated_at = now
        existing_reaction.save(update_fields=['is_active', 'updated_at'])
        is_reacted = new_active

    new_count = EngagementSerialReaction.objects.filter(
        link_bookwriter_serial_release_id=serial_release_id, is_active=True,
    ).count()
    SerialRelease.objects.filter(pk=release.pk).update(
        reaction_count_cached=new_count, updated_at=now,
    )
    return JsonResponse({'ok': True, 'is_reacted': is_reacted, 'reaction_count': new_count})


@login_required
@require_POST
def api_bookwriter_release_comment_create(request, serial_release_id):
    """Post a comment on a published chapter (top-level or reply).

    Request JSON: {
        'comment_text':  '...',
        'parent_id':     <int> | null
    }
    """
    user_profile_id = get_user_profile_id(request)
    if user_profile_id is None:
        return HttpResponseForbidden('No user profile')

    payload, error_response = _read_json_body(request)
    if error_response is not None:
        return error_response

    raw_text = payload.get('comment_text')
    if not isinstance(raw_text, str):
        return HttpResponseBadRequest('comment_text must be a string')
    cleaned_text = _strip_html_to_plain(raw_text).strip()[:MAX_PUBLIC_COMMENT_LENGTH]
    if not cleaned_text:
        return HttpResponseBadRequest('comment_text cannot be empty')

    parent_id = payload.get('parent_id')
    if parent_id is not None:
        if not isinstance(parent_id, int):
            return HttpResponseBadRequest('parent_id must be an integer or null')
        parent_exists = EngagementSerialComment.objects.filter(
            bookwriter_engagement_serial_comment_id=parent_id,
            link_bookwriter_serial_release_id=serial_release_id,
            is_active=True,
        ).exists()
        if not parent_exists:
            return HttpResponseBadRequest('parent_id must reference a comment on this release')

    release = _resolve_published_release(serial_release_id)
    if release is None:
        return JsonResponse({'ok': False, 'error': 'Release not found'}, status=404)

    now = timezone.now()
    new_comment = EngagementSerialComment.objects.create(
        link_bookwriter_serial_release_id=serial_release_id,
        link_user_profile_id=user_profile_id,
        parent_link_bookwriter_engagement_serial_comment_id=parent_id,
        comment_text=cleaned_text,
        is_pinned=False,
        is_active=True,
        created_at=now,
    )
    new_count = EngagementSerialComment.objects.filter(
        link_bookwriter_serial_release_id=serial_release_id, is_active=True,
    ).count()
    SerialRelease.objects.filter(pk=release.pk).update(
        comment_count_cached=new_count, updated_at=now,
    )
    return JsonResponse({
        'ok': True,
        'comment': {
            'id': new_comment.bookwriter_engagement_serial_comment_id,
            'text': new_comment.comment_text,
            'parent_id': parent_id,
            'created_at': now.isoformat(),
        },
        'comment_count': new_count,
    })


@require_GET
def api_bookwriter_release_comment_list(request, serial_release_id):
    """List comments on a published release. Anonymous-readable.
    Capped 500 rows newest-first."""
    if _resolve_published_release(serial_release_id) is None:
        return JsonResponse({'ok': False, 'error': 'Release not found'}, status=404)
    rows = (
        EngagementSerialComment.objects
        .filter(link_bookwriter_serial_release_id=serial_release_id, is_active=True)
        .order_by('-is_pinned', '-created_at')[:500]
    )
    return JsonResponse({
        'ok': True,
        'comments': [
            {
                'id': row.bookwriter_engagement_serial_comment_id,
                'parent_id': row.parent_link_bookwriter_engagement_serial_comment_id,
                'user_profile_id': row.link_user_profile_id,
                'text': row.comment_text,
                'is_pinned': bool(row.is_pinned),
                'created_at': row.created_at.isoformat() if row.created_at else None,
            }
            for row in rows
        ],
    })


@login_required
@require_POST
def api_bookwriter_serial_comment_pin(request, comment_id):
    """Book owner only: pin / unpin a comment to the top of the
    public reader's comment list."""
    user_profile_id = get_user_profile_id(request)
    if user_profile_id is None:
        return HttpResponseForbidden('No user profile')

    payload, error_response = _read_json_body(request)
    if error_response is not None:
        return error_response

    try:
        comment_row = EngagementSerialComment.objects.get(
            bookwriter_engagement_serial_comment_id=comment_id, is_active=True,
        )
    except EngagementSerialComment.DoesNotExist:
        return JsonResponse({'ok': False, 'error': 'Comment not found'}, status=404)

    release = SerialRelease.objects.filter(
        bookwriter_serial_release_id=comment_row.link_bookwriter_serial_release_id,
    ).first()
    if release is None:
        return JsonResponse({'ok': False, 'error': 'Release not found'}, status=404)
    is_owner = CollBook.objects.filter(
        bookwriter_coll_book_id=release.link_bookwriter_coll_book_id,
        link_owner_user_profile_id=user_profile_id,
    ).exists()
    if not is_owner:
        return HttpResponseForbidden('Only the book owner can pin')

    new_pinned_state = bool(payload.get('is_pinned'))
    saved_at = timezone.now()
    comment_row.is_pinned = new_pinned_state
    comment_row.updated_at = saved_at
    comment_row.save(update_fields=['is_pinned', 'updated_at'])
    return JsonResponse({'ok': True, 'is_pinned': new_pinned_state})


@login_required
@require_http_methods(['POST', 'DELETE'])
def api_bookwriter_serial_comment_delete(request, comment_id):
    """Comment author OR book owner can soft-delete."""
    user_profile_id = get_user_profile_id(request)
    if user_profile_id is None:
        return HttpResponseForbidden('No user profile')

    try:
        comment_row = EngagementSerialComment.objects.get(
            bookwriter_engagement_serial_comment_id=comment_id, is_active=True,
        )
    except EngagementSerialComment.DoesNotExist:
        return JsonResponse({'ok': False, 'error': 'Comment not found'}, status=404)

    release = SerialRelease.objects.filter(
        bookwriter_serial_release_id=comment_row.link_bookwriter_serial_release_id,
    ).first()
    is_owner = release is not None and CollBook.objects.filter(
        bookwriter_coll_book_id=release.link_bookwriter_coll_book_id,
        link_owner_user_profile_id=user_profile_id,
    ).exists()
    is_author = comment_row.link_user_profile_id == user_profile_id
    if not (is_owner or is_author):
        return HttpResponseForbidden('Only the owner or comment author can delete')

    saved_at = timezone.now()
    comment_row.is_active = False
    comment_row.updated_at = saved_at
    comment_row.save(update_fields=['is_active', 'updated_at'])
    if release is not None:
        new_count = EngagementSerialComment.objects.filter(
            link_bookwriter_serial_release_id=release.bookwriter_serial_release_id,
            is_active=True,
        ).count()
        SerialRelease.objects.filter(pk=release.pk).update(
            comment_count_cached=new_count, updated_at=saved_at,
        )
    return JsonResponse({'ok': True, 'deleted_comment_id': comment_id})


@require_POST
def api_bookwriter_release_view_record(request, serial_release_id):
    """Record a single read of a published chapter.

    Anonymous reads are session-hashed; logged-in reads carry the
    user's profile id. Lightweight — public reader page calls this
    once per pageload via fetch().

    Request JSON (all optional):
        view_seconds:           int
        view_completion_pct:    int 0..100
        view_referrer_code:     str (must be a known ref)
        view_device_code:       str (must be a known ref)
    """
    payload, error_response = _read_json_body(request)
    if error_response is not None:
        return error_response

    release = _resolve_published_release(serial_release_id)
    if release is None:
        return JsonResponse({'ok': False, 'error': 'Release not found'}, status=404)

    user_profile_id = get_user_profile_id(request)
    session_hash = None
    if user_profile_id is None:
        # SessionMiddleware always runs in production but RequestFactory
        # tests skip it — defend so the test path doesn't blow up.
        request_session = getattr(request, 'session', None)
        if request_session is not None:
            session_hash = (request_session.session_key or '')[:64] or None

    view_seconds = payload.get('view_seconds')
    if view_seconds is not None and (not isinstance(view_seconds, int) or view_seconds < 0 or view_seconds > 86400):
        return HttpResponseBadRequest('view_seconds must be 0..86400 or null')

    view_completion_pct = payload.get('view_completion_pct')
    if view_completion_pct is not None and (not isinstance(view_completion_pct, int) or not (0 <= view_completion_pct <= 100)):
        return HttpResponseBadRequest('view_completion_pct must be 0..100 or null')

    view_referrer_code = payload.get('view_referrer_code')
    if view_referrer_code is not None:
        if not isinstance(view_referrer_code, str) or not RefViewReferrer.objects.filter(view_referrer_code=view_referrer_code, is_active=True).exists():
            return HttpResponseBadRequest('view_referrer_code must be a known referrer')

    view_device_code = payload.get('view_device_code')
    if view_device_code is not None:
        if not isinstance(view_device_code, str) or not RefViewDevice.objects.filter(view_device_code=view_device_code, is_active=True).exists():
            return HttpResponseBadRequest('view_device_code must be a known device')

    now = timezone.now()
    EngagementSerialView.objects.create(
        link_bookwriter_serial_release_id=serial_release_id,
        link_user_profile_id=user_profile_id,
        view_session_hash=session_hash,
        view_seconds=view_seconds,
        view_completion_pct=view_completion_pct,
        view_referrer_code=view_referrer_code,
        view_device_code=view_device_code,
        created_at=now,
    )
    # Bump cached counters on the release. unique_reader_count is the
    # union of distinct user_profile_ids + session_hashes.
    total_views = EngagementSerialView.objects.filter(
        link_bookwriter_serial_release_id=serial_release_id,
    ).count()
    unique_reader_count = (
        EngagementSerialView.objects
        .filter(link_bookwriter_serial_release_id=serial_release_id)
        .values('link_user_profile_id', 'view_session_hash')
        .distinct()
        .count()
    )
    SerialRelease.objects.filter(pk=release.pk).update(
        read_count_cached=total_views,
        unique_reader_count_cached=unique_reader_count,
        updated_at=now,
    )
    return JsonResponse({'ok': True})


@require_POST
def api_bookwriter_release_preview_impression(request, serial_release_id):
    """Record a preview impression on a published release.

    Distinct from view-record: preview impressions count when the
    chapter card scrolls into view in another page's TOC (e.g. the
    "more from this book" list at the bottom of the public reader
    page) WITHOUT the reader actually opening the chapter. Cheap
    + idempotent — bumps preview_view_count_cached only.

    No body required. Anonymous-OK (no auth gate). Releases that are
    not currently published return 404 so we don't bump impressions
    for unpublished or revoked content.
    """
    release = _resolve_published_release(serial_release_id)
    if release is None:
        return JsonResponse({'ok': False, 'error': 'Release not found'}, status=404)

    SerialRelease.objects.filter(pk=release.pk).update(
        preview_view_count_cached=release.preview_view_count_cached + 1,
        updated_at=timezone.now(),
    )
    return JsonResponse({'ok': True})

