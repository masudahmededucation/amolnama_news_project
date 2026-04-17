"""Mastermind quiz comments — engine layer.

Per-quiz discussion thread. One row per comment or reply (link_parent_comment_id
gives nesting). Sanitised HTML body via core.utils.sanitize_user_html.

Public API used by views_api endpoints:
  list_comments(quiz_id, viewer_user_profile_id)         → tree-shaped list
  create_comment(quiz_id, user_profile_id, text_html, parent_comment_id=None)
  delete_comment(comment_id, user_profile_id)            → soft-delete (owner OR staff)
  pin_comment(comment_id, user_profile_id, unpin=False)  → staff-only
  toggle_reaction(comment_id, user_profile_id, reaction_type='like')
"""
import logging
from collections import defaultdict

from django.db import transaction
from django.utils import timezone

from amolnama_news.site_apps.core.utils import sanitize_user_html

from .models import CollQuizComment, CollQuizCommentReaction

logger = logging.getLogger(__name__)

MAX_COMMENT_HTML_LENGTH = 8000  # post-sanitise cap


def list_comments(quiz_id, viewer_user_profile_id=None):
    """Return all active comments for a quiz, tree-shaped.

    Top-level comments are sorted: pinned first (newest pin first), then
    newest-first. Replies are sorted oldest-first under each parent.

    Each item carries:
      - mastermind_coll_quiz_comment_id, link_user_profile_id, comment_text_html
      - is_pinned, pinned_at, created_at, updated_at
      - reaction_count (active 'like' rows)
      - viewer_has_liked (only if viewer_user_profile_id supplied)
      - replies: list of child dicts (recursive shape)
    """
    if not quiz_id:
        return []

    rows = list(
        CollQuizComment.objects
        .filter(link_mastermind_coll_quiz_id=quiz_id, is_active=True)
        .order_by('-is_pinned', '-pinned_at', '-created_at')
        .values(
            'mastermind_coll_quiz_comment_id',
            'link_user_profile_id',
            'link_parent_comment_id',
            'comment_text_html',
            'is_pinned', 'pinned_at',
            'created_at', 'updated_at',
        )
    )
    if not rows:
        return []

    comment_ids = [row['mastermind_coll_quiz_comment_id'] for row in rows]
    reaction_counts = _aggregate_reactions(comment_ids)
    viewer_likes = _viewer_liked_set(comment_ids, viewer_user_profile_id) if viewer_user_profile_id else set()
    user_display_names = _resolve_display_names([row['link_user_profile_id'] for row in rows])

    by_parent = defaultdict(list)
    for row in rows:
        comment_id = row['mastermind_coll_quiz_comment_id']
        node = {
            **row,
            'display_name': user_display_names.get(row['link_user_profile_id']) or 'Anonymous',
            'reaction_count': reaction_counts.get(comment_id, 0),
            'viewer_has_liked': comment_id in viewer_likes,
            'replies': [],
        }
        by_parent[row['link_parent_comment_id']].append(node)

    def _attach_replies(parent_node):
        children = by_parent.get(parent_node['mastermind_coll_quiz_comment_id'], [])
        children.sort(key=lambda child: child['created_at'])
        parent_node['replies'] = children
        for child in children:
            _attach_replies(child)

    top_level = by_parent.get(None, [])
    for top_node in top_level:
        _attach_replies(top_node)
    return top_level


def create_comment(quiz_id, user_profile_id, text_html, parent_comment_id=None):
    """Create a new comment. text_html is sanitised before storage."""
    if not quiz_id or not user_profile_id:
        return {'success': False, 'error': 'quiz_id and user_profile_id required.'}
    sanitized = (sanitize_user_html(text_html or '') or '').strip()
    if not sanitized:
        return {'success': False, 'error': 'Comment text is empty after sanitisation.'}
    if len(sanitized) > MAX_COMMENT_HTML_LENGTH:
        return {'success': False, 'error': f'Comment too long (max {MAX_COMMENT_HTML_LENGTH} chars).'}

    if parent_comment_id:
        parent_exists = CollQuizComment.objects.filter(
            mastermind_coll_quiz_comment_id=parent_comment_id,
            link_mastermind_coll_quiz_id=quiz_id,
            is_active=True,
        ).exists()
        if not parent_exists:
            return {'success': False, 'error': 'Parent comment not found on this quiz.'}

    comment = CollQuizComment.objects.create(
        link_mastermind_coll_quiz_id=quiz_id,
        link_user_profile_id=user_profile_id,
        link_parent_comment_id=parent_comment_id or None,
        comment_text_html=sanitized,
        created_at=timezone.now(),
    )
    return {
        'success': True,
        'comment_id': comment.mastermind_coll_quiz_comment_id,
    }


def delete_comment(comment_id, user_profile_id, is_staff=False):
    """Soft-delete (is_active=False). Owner OR staff only."""
    if not comment_id:
        return {'success': False, 'error': 'comment_id required.'}
    comment = CollQuizComment.objects.filter(
        mastermind_coll_quiz_comment_id=comment_id, is_active=True,
    ).first()
    if not comment:
        return {'success': False, 'error': 'Comment not found.'}
    if not is_staff and comment.link_user_profile_id != user_profile_id:
        return {'success': False, 'error': 'Permission denied.'}

    CollQuizComment.objects.filter(mastermind_coll_quiz_comment_id=comment_id).update(
        is_active=False,
        deleted_at=timezone.now(),
        link_deleted_by_user_profile_id=user_profile_id,
        updated_at=timezone.now(),
    )
    return {'success': True}


def pin_comment(comment_id, user_profile_id, unpin=False):
    """Staff-only pin/unpin. Caller must verify is_staff before calling."""
    if not comment_id:
        return {'success': False, 'error': 'comment_id required.'}
    comment = CollQuizComment.objects.filter(
        mastermind_coll_quiz_comment_id=comment_id, is_active=True,
    ).first()
    if not comment:
        return {'success': False, 'error': 'Comment not found.'}
    CollQuizComment.objects.filter(mastermind_coll_quiz_comment_id=comment_id).update(
        is_pinned=not unpin,
        link_pinned_by_user_profile_id=(None if unpin else user_profile_id),
        pinned_at=(None if unpin else timezone.now()),
        updated_at=timezone.now(),
    )
    return {'success': True, 'is_pinned': not unpin}


def toggle_reaction(comment_id, user_profile_id, reaction_type='like'):
    """Toggle a user's reaction. Returns the new state + total count."""
    if not comment_id or not user_profile_id:
        return {'success': False, 'error': 'comment_id and user_profile_id required.'}

    comment_exists = CollQuizComment.objects.filter(
        mastermind_coll_quiz_comment_id=comment_id, is_active=True,
    ).exists()
    if not comment_exists:
        return {'success': False, 'error': 'Comment not found.'}

    with transaction.atomic():
        existing = CollQuizCommentReaction.objects.filter(
            link_mastermind_coll_quiz_comment_id=comment_id,
            link_user_profile_id=user_profile_id,
            reaction_type_code=reaction_type,
        ).first()
        if existing:
            new_state = not existing.is_active
            CollQuizCommentReaction.objects.filter(
                mastermind_coll_quiz_comment_reaction_id=existing.mastermind_coll_quiz_comment_reaction_id,
            ).update(is_active=new_state)
            now_active = new_state
        else:
            CollQuizCommentReaction.objects.create(
                link_mastermind_coll_quiz_comment_id=comment_id,
                link_user_profile_id=user_profile_id,
                reaction_type_code=reaction_type,
                is_active=True,
            )
            now_active = True

        total_count = CollQuizCommentReaction.objects.filter(
            link_mastermind_coll_quiz_comment_id=comment_id,
            reaction_type_code=reaction_type,
            is_active=True,
        ).count()

    return {'success': True, 'now_active': now_active, 'total_count': total_count}


# ================================================================
# Internal helpers
# ================================================================

def _aggregate_reactions(comment_ids):
    if not comment_ids:
        return {}
    from django.db.models import Count
    rows = (
        CollQuizCommentReaction.objects
        .filter(
            link_mastermind_coll_quiz_comment_id__in=comment_ids,
            reaction_type_code='like',
            is_active=True,
        )
        .values('link_mastermind_coll_quiz_comment_id')
        .annotate(reaction_count=Count('mastermind_coll_quiz_comment_reaction_id'))
    )
    return {row['link_mastermind_coll_quiz_comment_id']: row['reaction_count'] for row in rows}


def _viewer_liked_set(comment_ids, viewer_user_profile_id):
    if not comment_ids or not viewer_user_profile_id:
        return set()
    return set(
        CollQuizCommentReaction.objects
        .filter(
            link_mastermind_coll_quiz_comment_id__in=comment_ids,
            link_user_profile_id=viewer_user_profile_id,
            reaction_type_code='like',
            is_active=True,
        )
        .values_list('link_mastermind_coll_quiz_comment_id', flat=True)
    )


def _resolve_display_names(user_profile_ids):
    if not user_profile_ids:
        return {}
    try:
        from amolnama_news.site_apps.user_account.models import UserProfile
        return dict(
            UserProfile.objects
            .filter(user_profile_id__in=user_profile_ids)
            .values_list('user_profile_id', 'display_name')
        )
    except Exception:
        logger.exception('Display name lookup failed for comment authors')
        return {}
