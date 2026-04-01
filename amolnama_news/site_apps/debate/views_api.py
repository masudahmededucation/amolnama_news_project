"""Debate API views — topic management, post creation (argument/rebuttal), voting."""

import hashlib
import json
import logging
import re
import uuid

from django.contrib.auth.decorators import login_required
from django.db import connection
from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.http import require_POST

from .models import (
    CollPost, CollTopic, CollTopicParticipant, CollVote,
    FactPostModeration, RefTeamSide, RefTopicStatus, RefVoteTargetType,
)

logger = logging.getLogger(__name__)


def _get_user_profile_id(request):
    """Get current user's profile ID or None."""
    if not request.user.is_authenticated:
        return None
    from amolnama_news.site_apps.user_account.models import UserProfile
    try:
        return UserProfile.objects.get(link_user_account_user_id=request.user.pk).user_profile_id
    except UserProfile.DoesNotExist:
        return None


def _raw_execute(sql, params):
    """Execute raw SQL with ? placeholders converted to %s for Django cursor."""
    django_sql = sql.replace('?', '%s')
    cursor = connection.cursor()
    cursor.execute(django_sql, params)
    return cursor


# =========================================================
# GARBAGE DETECTION
# =========================================================

def _count_sentences(text):
    """Count sentences by Bengali/English sentence endings."""
    return len(re.findall(r'[।.!?]', text))


def _calculate_emoji_ratio(text):
    """Calculate ratio of emoji characters to total characters."""
    if not text:
        return 0.0
    import unicodedata
    emoji_count = sum(1 for character in text if unicodedata.category(character) in ('So', 'Sk'))
    cleaned = re.sub(r'\s+', '', text)
    return emoji_count / max(len(cleaned), 1)


def _calculate_repeated_character_ratio(text):
    """Detect repeated character spam."""
    if not text or len(text) < 3:
        return 0.0
    cleaned = re.sub(r'\s+', '', text)
    if not cleaned:
        return 0.0
    repeated_count = sum(1 for i in range(1, len(cleaned)) if cleaned[i] == cleaned[i - 1])
    return repeated_count / max(len(cleaned), 1)


def _calculate_non_language_ratio(text):
    """Detect non-language characters."""
    if not text:
        return 0.0
    cleaned = re.sub(r'\s+', '', text)
    if not cleaned:
        return 0.0
    non_language_count = sum(1 for character in cleaned
                            if not character.isalpha() and character not in '।.!?,;:\'"()-')
    return non_language_count / max(len(cleaned), 1)


def _is_emoji_only(text):
    """Check if text contains only emojis and whitespace."""
    import unicodedata
    for character in text:
        if character.isspace():
            continue
        if unicodedata.category(character) not in ('So', 'Sk'):
            return False
    return True


def _content_hash(text):
    """SHA-256 hash of normalized text for duplicate detection."""
    normalized = re.sub(r'\s+', ' ', text.strip().lower())
    return hashlib.sha256(normalized.encode('utf-8')).hexdigest()


def _validate_post_content(text, topic):
    """Validate post content against topic rules. Returns (is_valid, error_message, metrics)."""
    text = text.strip()
    character_count = len(text)
    sentence_count = _count_sentences(text)
    emoji_ratio = _calculate_emoji_ratio(text)
    repeated_character_ratio = _calculate_repeated_character_ratio(text)
    non_language_ratio = _calculate_non_language_ratio(text)
    is_emoji_only_flag = _is_emoji_only(text)

    metrics = {
        'post_character_count': character_count,
        'post_sentence_count': sentence_count,
        'post_emoji_ratio': round(emoji_ratio, 4),
        'post_repeated_character_ratio': round(repeated_character_ratio, 4),
        'post_non_language_ratio': round(non_language_ratio, 4),
        'is_emoji_only': is_emoji_only_flag,
        'post_content_hash': _content_hash(text),
    }

    if character_count < topic.minimum_post_character_count:
        return False, f'কমপক্ষে {topic.minimum_post_character_count} অক্ষর প্রয়োজন ({character_count} দেওয়া হয়েছে)', metrics

    if topic.maximum_post_character_count and character_count > topic.maximum_post_character_count:
        return False, f'সর্বোচ্চ {topic.maximum_post_character_count} অক্ষর অনুমোদিত', metrics

    if sentence_count < topic.minimum_sentence_count:
        return False, f'কমপক্ষে {topic.minimum_sentence_count}টি বাক্য প্রয়োজন', metrics

    if is_emoji_only_flag:
        return False, 'শুধু ইমোজি দিয়ে পোস্ট করা যাবে না — লেখা যোগ করুন', metrics

    if emoji_ratio > 0.5:
        return False, 'অতিরিক্ত ইমোজি — আরও লেখা যোগ করুন', metrics

    if repeated_character_ratio > 0.5:
        return False, 'পুনরাবৃত্তিমূলক অক্ষর সনাক্ত হয়েছে', metrics

    if non_language_ratio > 0.5:
        return False, 'পোস্টে পর্যাপ্ত ভাষা নেই', metrics

    return True, None, metrics


# =========================================================
# TOPIC APIS
# =========================================================

@login_required
@require_POST
def api_topic_create(request):
    """Create a new debate topic. Staff only."""
    if not request.user.is_staff:
        return JsonResponse({'success': False, 'error': 'Staff only'}, status=403)

    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'success': False, 'error': 'Invalid JSON'}, status=400)

    topic_title = (data.get('topic_title') or '').strip()
    topic_description = (data.get('topic_description') or '').strip() or None
    blue_side_label = (data.get('blue_side_label') or '').strip() or None
    red_side_label = (data.get('red_side_label') or '').strip() or None
    scheduled_start_at_raw = data.get('scheduled_start_at')

    if not topic_title or len(topic_title) < 10:
        return JsonResponse({'success': False, 'error': 'বিষয় কমপক্ষে ১০ অক্ষর হতে হবে'}, status=400)
    if not scheduled_start_at_raw:
        return JsonResponse({'success': False, 'error': 'সময়সূচী প্রয়োজন'}, status=400)

    # Parse datetime-local string (e.g. "2026-04-01T14:00") to proper datetime
    from datetime import datetime
    try:
        scheduled_start_at = datetime.fromisoformat(scheduled_start_at_raw)
    except (ValueError, TypeError):
        return JsonResponse({'success': False, 'error': 'তারিখ ফরম্যাট সঠিক নয়'}, status=400)

    user_profile_id = _get_user_profile_id(request)
    if not user_profile_id:
        return JsonResponse({'success': False, 'error': 'প্রোফাইল পাওয়া যায়নি'}, status=400)

    live_status = RefTopicStatus.objects.filter(topic_status_code='live').first()
    if not live_status:
        return JsonResponse({'success': False, 'error': 'Status not configured'}, status=500)

    now = timezone.now()
    topic_guid = str(uuid.uuid4())
    cursor = _raw_execute("""
        INSERT INTO [debate].[coll_topic]
            ([topic_guid], [topic_title], [topic_description],
             [blue_side_label], [red_side_label],
             [link_topic_status_id],
             [scheduled_start_at], [actual_started_at], [link_created_by_user_profile_id])
        OUTPUT INSERTED.debate_coll_topic_id
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, [topic_guid, topic_title, topic_description,
          blue_side_label, red_side_label,
          live_status.debate_ref_topic_status_id, scheduled_start_at, now, user_profile_id])
    topic_id = cursor.fetchone()[0]

    return JsonResponse({'success': True, 'debate_coll_topic_id': topic_id})


@login_required
@require_POST
def api_topic_join(request, topic_id):
    """Join a debate topic on a specific side (blue/red)."""
    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'success': False, 'error': 'Invalid JSON'}, status=400)

    team_side_code = (data.get('team_side_code') or '').strip().lower()
    if team_side_code not in ('blue', 'red'):
        return JsonResponse({'success': False, 'error': 'blue বা red নির্বাচন করুন'}, status=400)

    user_profile_id = _get_user_profile_id(request)
    if not user_profile_id:
        return JsonResponse({'success': False, 'error': 'প্রোফাইল পাওয়া যায়নি'}, status=400)

    try:
        topic = CollTopic.objects.get(debate_coll_topic_id=topic_id, is_active=True)
    except CollTopic.DoesNotExist:
        return JsonResponse({'success': False, 'error': 'বিষয় পাওয়া যায়নি'}, status=404)

    existing = CollTopicParticipant.objects.filter(
        link_topic_id=topic_id, link_user_profile_id=user_profile_id, is_active=True,
    ).first()
    if existing:
        return JsonResponse({'success': False, 'error': 'আপনি ইতিমধ্যে যোগ দিয়েছেন'}, status=400)

    team_side = RefTeamSide.objects.filter(team_side_code=team_side_code, is_active=True).first()
    if not team_side:
        return JsonResponse({'success': False, 'error': 'Invalid team side'}, status=400)

    _raw_execute("""
        INSERT INTO [debate].[coll_topic_participant]
            ([link_topic_id], [link_user_profile_id], [link_team_side_id])
        VALUES (?, ?, ?)
    """, [topic_id, user_profile_id, team_side.debate_ref_team_side_id])

    count_column = 'blue_participant_count' if team_side_code == 'blue' else 'red_participant_count'
    _raw_execute(f"""
        UPDATE [debate].[coll_topic]
        SET [{count_column}] = [{count_column}] + 1, [updated_at] = ?
        WHERE [debate_coll_topic_id] = ?
    """, [timezone.now(), topic_id])

    return JsonResponse({'success': True, 'team_side_code': team_side_code})


@login_required
@require_POST
def api_topic_go_live(request, topic_id):
    """Set topic status to 'live'. Staff only."""
    if not request.user.is_staff:
        return JsonResponse({'success': False, 'error': 'Staff only'}, status=403)

    live_status = RefTopicStatus.objects.filter(topic_status_code='live').first()
    now = timezone.now()
    _raw_execute("""
        UPDATE [debate].[coll_topic]
        SET [link_topic_status_id] = ?, [actual_started_at] = ?, [updated_at] = ?
        WHERE [debate_coll_topic_id] = ?
    """, [live_status.debate_ref_topic_status_id, now, now, topic_id])

    return JsonResponse({'success': True})


@login_required
@require_POST
def api_topic_close(request, topic_id):
    """Set topic status to 'closed'. Staff only."""
    if not request.user.is_staff:
        return JsonResponse({'success': False, 'error': 'Staff only'}, status=403)

    closed_status = RefTopicStatus.objects.filter(topic_status_code='closed').first()
    now = timezone.now()
    _raw_execute("""
        UPDATE [debate].[coll_topic]
        SET [link_topic_status_id] = ?, [actual_closed_at] = ?, [updated_at] = ?
        WHERE [debate_coll_topic_id] = ?
    """, [closed_status.debate_ref_topic_status_id, now, now, topic_id])

    return JsonResponse({'success': True})


# =========================================================
# POST APIS (ARGUMENTS + REBUTTALS)
# =========================================================

@login_required
@require_POST
def api_post_argument(request, topic_id):
    """Create a new top-level argument on the user's own board."""
    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'success': False, 'error': 'Invalid JSON'}, status=400)

    post_content = (data.get('post_content') or '').strip()
    if not post_content:
        return JsonResponse({'success': False, 'error': 'পোস্ট খালি রাখা যাবে না'}, status=400)

    user_profile_id = _get_user_profile_id(request)
    if not user_profile_id:
        return JsonResponse({'success': False, 'error': 'প্রোফাইল পাওয়া যায়নি'}, status=400)

    try:
        topic = CollTopic.objects.get(debate_coll_topic_id=topic_id, is_active=True)
    except CollTopic.DoesNotExist:
        return JsonResponse({'success': False, 'error': 'বিষয় পাওয়া যায়নি'}, status=404)

    live_status = RefTopicStatus.objects.filter(topic_status_code='live').first()
    if topic.link_topic_status_id != live_status.debate_ref_topic_status_id:
        return JsonResponse({'success': False, 'error': 'বিতর্ক এখনও শুরু হয়নি'}, status=400)

    participant = CollTopicParticipant.objects.filter(
        link_topic_id=topic_id, link_user_profile_id=user_profile_id,
        is_active=True, is_banned=False, is_muted=False,
    ).first()
    if not participant:
        return JsonResponse({'success': False, 'error': 'আপনি এই বিতর্কে যোগ দেননি'}, status=403)

    is_valid, error_message, metrics = _validate_post_content(post_content, topic)
    if not is_valid:
        return JsonResponse({'success': False, 'error': error_message}, status=400)

    # Check duplicate — if exists, auto-upvote and redirect to it
    existing_duplicate = CollPost.objects.filter(
        link_topic_id=topic_id, post_content_hash=metrics['post_content_hash'],
        is_deleted=False, is_active=True,
    ).first()
    if existing_duplicate:
        # Auto-upvote the existing post for this user
        vote_target_type = RefVoteTargetType.objects.filter(vote_target_type_code='post').first()
        if vote_target_type:
            existing_vote = CollVote.objects.filter(
                link_voter_user_profile_id=user_profile_id,
                link_vote_target_type_id=vote_target_type.debate_ref_vote_target_type_id,
                target_row_id=existing_duplicate.debate_coll_post_id,
            ).first()
            if not existing_vote:
                _raw_execute("""
                    INSERT INTO [debate].[coll_vote]
                        ([link_voter_user_profile_id], [link_vote_target_type_id], [target_row_id], [vote_value])
                    VALUES (?, ?, ?, ?)
                """, [user_profile_id, vote_target_type.debate_ref_vote_target_type_id,
                      existing_duplicate.debate_coll_post_id, 1])
                # Update cached score
                _raw_execute("""
                    UPDATE [debate].[coll_post]
                    SET [upvote_count] = [upvote_count] + 1, [score] = [score] + 1, [updated_at] = ?
                    WHERE [debate_coll_post_id] = ?
                """, [timezone.now(), existing_duplicate.debate_coll_post_id])

        return JsonResponse({
            'success': False,
            'duplicate': True,
            'duplicate_post_id': existing_duplicate.debate_coll_post_id,
            'error': 'আপনার মতামত ইতিমধ্যে আছে — আপনার সমর্থন রেকর্ড করা হয়েছে! 👇',
        }, status=200)

    # INSERT argument — board side = author's own side
    post_guid = str(uuid.uuid4())
    cursor = _raw_execute("""
        INSERT INTO [debate].[coll_post]
            ([post_guid], [link_topic_id], [link_coll_topic_participant_id],
             [link_author_user_profile_id], [link_author_team_side_id],
             [link_post_kind_id], [link_thread_board_side_id],
             [post_content], [post_character_count], [post_sentence_count],
             [post_emoji_ratio], [post_repeated_character_ratio], [post_non_language_ratio],
             [is_emoji_only], [post_content_hash])
        OUTPUT INSERTED.debate_coll_post_id
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, [
        post_guid, topic_id, participant.debate_coll_topic_participant_id,
        user_profile_id, participant.link_team_side_id,
        1, participant.link_team_side_id,  # kind=argument, board=own side
        post_content, metrics['post_character_count'], metrics['post_sentence_count'],
        metrics['post_emoji_ratio'], metrics['post_repeated_character_ratio'],
        metrics['post_non_language_ratio'], 1 if metrics['is_emoji_only'] else 0,
        metrics['post_content_hash'],
    ])
    post_id = cursor.fetchone()[0]

    # Set root_post_id = self (self-reference after INSERT)
    _raw_execute("""
        UPDATE [debate].[coll_post] SET [link_root_post_id] = ? WHERE [debate_coll_post_id] = ?
    """, [post_id, post_id])

    # Update cached counts + passion board
    now = timezone.now()
    side_prefix = 'blue' if participant.link_team_side_id == 1 else 'red'
    _raw_execute(f"""
        UPDATE [debate].[coll_topic]
        SET [total_post_count] = [total_post_count] + 1,
            [{side_prefix}_post_count] = [{side_prefix}_post_count] + 1,
            [{side_prefix}_sentence_count] = [{side_prefix}_sentence_count] + ?,
            [{side_prefix}_character_count] = [{side_prefix}_character_count] + ?,
            [updated_at] = ?
        WHERE [debate_coll_topic_id] = ?
    """, [metrics['post_sentence_count'], metrics['post_character_count'], now, topic_id])
    _raw_execute("""
        UPDATE [debate].[coll_topic_participant]
        SET [participant_argument_count] = [participant_argument_count] + 1, [updated_at] = ?
        WHERE [debate_coll_topic_participant_id] = ?
    """, [now, participant.debate_coll_topic_participant_id])

    return JsonResponse({'success': True, 'debate_coll_post_id': post_id})


@login_required
@require_POST
def api_post_reply(request, topic_id):
    """Create a rebuttal — MUST be opposite side of parent (crossing-over rule)."""
    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'success': False, 'error': 'Invalid JSON'}, status=400)

    post_content = (data.get('post_content') or '').strip()
    parent_post_id = data.get('parent_post_id')

    if not post_content:
        return JsonResponse({'success': False, 'error': 'পোস্ট খালি রাখা যাবে না'}, status=400)
    if not parent_post_id:
        return JsonResponse({'success': False, 'error': 'parent_post_id প্রয়োজন'}, status=400)

    user_profile_id = _get_user_profile_id(request)
    if not user_profile_id:
        return JsonResponse({'success': False, 'error': 'প্রোফাইল পাওয়া যায়নি'}, status=400)

    try:
        topic = CollTopic.objects.get(debate_coll_topic_id=topic_id, is_active=True)
    except CollTopic.DoesNotExist:
        return JsonResponse({'success': False, 'error': 'বিষয় পাওয়া যায়নি'}, status=404)

    live_status = RefTopicStatus.objects.filter(topic_status_code='live').first()
    if topic.link_topic_status_id != live_status.debate_ref_topic_status_id:
        return JsonResponse({'success': False, 'error': 'বিতর্ক এখনও শুরু হয়নি'}, status=400)

    try:
        parent_post = CollPost.objects.get(
            debate_coll_post_id=parent_post_id, link_topic_id=topic_id,
            is_deleted=False, is_active=True,
        )
    except CollPost.DoesNotExist:
        return JsonResponse({'success': False, 'error': 'মূল পোস্ট পাওয়া যায়নি'}, status=404)

    participant = CollTopicParticipant.objects.filter(
        link_topic_id=topic_id, link_user_profile_id=user_profile_id,
        is_active=True, is_banned=False, is_muted=False,
    ).first()
    if not participant:
        return JsonResponse({'success': False, 'error': 'আপনি এই বিতর্কে যোগ দেননি'}, status=403)

    # CROSSING-OVER RULE: reply author MUST be opposite side of parent author
    # TODO: Remove admin bypass before production — only here for testing with single account
    if participant.link_team_side_id == parent_post.link_author_team_side_id and not request.user.is_staff:
        return JsonResponse({'success': False, 'error': 'আপনি নিজের পক্ষের যুক্তির উত্তর দিতে পারবেন না'}, status=400)

    new_depth = parent_post.post_reply_depth + 1
    if new_depth > topic.maximum_reply_depth:
        return JsonResponse({'success': False, 'error': f'সর্বোচ্চ উত্তর গভীরতা {topic.maximum_reply_depth} অতিক্রম'}, status=400)

    is_valid, error_message, metrics = _validate_post_content(post_content, topic)
    if not is_valid:
        return JsonResponse({'success': False, 'error': error_message}, status=400)

    # INSERT rebuttal — thread board stays on parent's board
    post_guid = str(uuid.uuid4())
    cursor = _raw_execute("""
        INSERT INTO [debate].[coll_post]
            ([post_guid], [link_topic_id], [link_coll_topic_participant_id],
             [link_author_user_profile_id], [link_author_team_side_id],
             [link_post_kind_id], [link_thread_board_side_id],
             [link_parent_post_id], [link_root_post_id], [post_reply_depth],
             [post_content], [post_character_count], [post_sentence_count],
             [post_emoji_ratio], [post_repeated_character_ratio], [post_non_language_ratio],
             [is_emoji_only], [post_content_hash])
        OUTPUT INSERTED.debate_coll_post_id
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, [
        post_guid, topic_id, participant.debate_coll_topic_participant_id,
        user_profile_id, participant.link_team_side_id,
        2, parent_post.link_thread_board_side_id,  # kind=rebuttal, board=parent's board
        parent_post_id,
        parent_post.link_root_post_id or parent_post.debate_coll_post_id,
        new_depth,
        post_content, metrics['post_character_count'], metrics['post_sentence_count'],
        metrics['post_emoji_ratio'], metrics['post_repeated_character_ratio'],
        metrics['post_non_language_ratio'], 1 if metrics['is_emoji_only'] else 0,
        metrics['post_content_hash'],
    ])
    post_id = cursor.fetchone()[0]

    # Update parent reply count + cached totals + passion board
    now = timezone.now()
    side_prefix = 'blue' if participant.link_team_side_id == 1 else 'red'
    _raw_execute("""
        UPDATE [debate].[coll_post]
        SET [reply_count] = [reply_count] + 1, [updated_at] = ?
        WHERE [debate_coll_post_id] = ?
    """, [now, parent_post_id])
    _raw_execute(f"""
        UPDATE [debate].[coll_topic]
        SET [total_post_count] = [total_post_count] + 1,
            [{side_prefix}_post_count] = [{side_prefix}_post_count] + 1,
            [{side_prefix}_sentence_count] = [{side_prefix}_sentence_count] + ?,
            [{side_prefix}_character_count] = [{side_prefix}_character_count] + ?,
            [updated_at] = ?
        WHERE [debate_coll_topic_id] = ?
    """, [metrics['post_sentence_count'], metrics['post_character_count'], now, topic_id])
    _raw_execute("""
        UPDATE [debate].[coll_topic_participant]
        SET [participant_rebuttal_count] = [participant_rebuttal_count] + 1, [updated_at] = ?
        WHERE [debate_coll_topic_participant_id] = ?
    """, [now, participant.debate_coll_topic_participant_id])

    return JsonResponse({'success': True, 'debate_coll_post_id': post_id})


@login_required
@require_POST
def api_post_edit(request, post_id):
    """Edit a post. Author or staff only. Saves edit history."""
    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'success': False, 'error': 'Invalid JSON'}, status=400)

    new_content = (data.get('post_content') or '').strip()
    if not new_content:
        return JsonResponse({'success': False, 'error': 'পোস্ট খালি রাখা যাবে না'}, status=400)

    user_profile_id = _get_user_profile_id(request)

    try:
        post = CollPost.objects.get(debate_coll_post_id=post_id, is_deleted=False, is_active=True)
    except CollPost.DoesNotExist:
        return JsonResponse({'success': False, 'error': 'পোস্ট পাওয়া যায়নি'}, status=404)

    if post.link_author_user_profile_id != user_profile_id and not request.user.is_staff:
        return JsonResponse({'success': False, 'error': 'অনুমতি নেই'}, status=403)

    _raw_execute("""
        INSERT INTO [debate].[coll_post_edit_history]
            ([link_post_id], [previous_post_content], [link_edited_by_user_profile_id])
        VALUES (?, ?, ?)
    """, [post_id, post.post_content, user_profile_id])

    now = timezone.now()
    _raw_execute("""
        UPDATE [debate].[coll_post]
        SET [post_content] = ?, [post_content_hash] = ?, [is_edited] = 1, [edited_at] = ?, [updated_at] = ?
        WHERE [debate_coll_post_id] = ?
    """, [new_content, _content_hash(new_content), now, now, post_id])

    return JsonResponse({'success': True})


@login_required
@require_POST
def api_post_delete(request, post_id):
    """Soft-delete a post. Author or staff only."""
    user_profile_id = _get_user_profile_id(request)

    try:
        post = CollPost.objects.get(debate_coll_post_id=post_id, is_deleted=False, is_active=True)
    except CollPost.DoesNotExist:
        return JsonResponse({'success': False, 'error': 'পোস্ট পাওয়া যায়নি'}, status=404)

    if post.link_author_user_profile_id != user_profile_id and not request.user.is_staff:
        return JsonResponse({'success': False, 'error': 'অনুমতি নেই'}, status=403)

    now = timezone.now()
    _raw_execute("""
        UPDATE [debate].[coll_post]
        SET [is_deleted] = 1, [deleted_at] = ?, [updated_at] = ?
        WHERE [debate_coll_post_id] = ?
    """, [now, now, post_id])

    return JsonResponse({'success': True})


# =========================================================
# VOTING APIS
# =========================================================

@login_required
@require_POST
def api_vote_topic(request, topic_id):
    """Vote on a topic. Toggle on repeat."""
    return _handle_vote(request, target_type_code='topic', target_row_id=topic_id)


@login_required
@require_POST
def api_vote_post(request, post_id):
    """Vote on a post. Toggle on repeat."""
    return _handle_vote(request, target_type_code='post', target_row_id=post_id)


def _handle_vote(request, target_type_code, target_row_id):
    """Shared vote logic — insert, toggle, or flip."""
    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'success': False, 'error': 'Invalid JSON'}, status=400)

    vote_value = data.get('vote_value')
    if vote_value not in (1, -1):
        return JsonResponse({'success': False, 'error': 'vote_value must be 1 or -1'}, status=400)

    user_profile_id = _get_user_profile_id(request)
    if not user_profile_id:
        return JsonResponse({'success': False, 'error': 'প্রোফাইল পাওয়া যায়নি'}, status=400)

    vote_target_type = RefVoteTargetType.objects.filter(vote_target_type_code=target_type_code).first()
    if not vote_target_type:
        return JsonResponse({'success': False, 'error': 'Invalid target type'}, status=400)

    vote_target_type_id = vote_target_type.debate_ref_vote_target_type_id

    existing_vote = CollVote.objects.filter(
        link_voter_user_profile_id=user_profile_id,
        link_vote_target_type_id=vote_target_type_id,
        target_row_id=target_row_id,
    ).first()

    now = timezone.now()

    if existing_vote:
        if existing_vote.vote_value == vote_value:
            # Same vote → remove (toggle off)
            _raw_execute("DELETE FROM [debate].[coll_vote] WHERE [debate_coll_vote_id] = ?",
                         [existing_vote.debate_coll_vote_id])
            _update_vote_counts(target_type_code, target_row_id, -vote_value, 0)
            return JsonResponse({'success': True, 'action': 'removed'})
        else:
            # Different vote → flip
            _raw_execute("""
                UPDATE [debate].[coll_vote] SET [vote_value] = ?, [voted_at] = ?, [updated_at] = ?
                WHERE [debate_coll_vote_id] = ?
            """, [vote_value, now, now, existing_vote.debate_coll_vote_id])
            _update_vote_counts(target_type_code, target_row_id, -existing_vote.vote_value, vote_value)
            return JsonResponse({'success': True, 'action': 'flipped'})
    else:
        # New vote
        _raw_execute("""
            INSERT INTO [debate].[coll_vote]
                ([link_voter_user_profile_id], [link_vote_target_type_id], [target_row_id], [vote_value])
            VALUES (?, ?, ?, ?)
        """, [user_profile_id, vote_target_type_id, target_row_id, vote_value])
        _update_vote_counts(target_type_code, target_row_id, 0, vote_value)
        return JsonResponse({'success': True, 'action': 'voted'})


def _update_vote_counts(target_type_code, target_row_id, remove_value, add_value):
    """Update cached vote counts on topic or post."""
    if target_type_code == 'topic':
        table = '[debate].[coll_topic]'
        pk_column = 'debate_coll_topic_id'
        upvote_column = 'topic_upvote_count'
        downvote_column = 'topic_downvote_count'
        score_column = 'topic_score'
    else:
        table = '[debate].[coll_post]'
        pk_column = 'debate_coll_post_id'
        upvote_column = 'upvote_count'
        downvote_column = 'downvote_count'
        score_column = 'score'

    now = timezone.now()
    if remove_value == 1:
        _raw_execute(f"UPDATE {table} SET [{upvote_column}] = [{upvote_column}] - 1, [{score_column}] = [{score_column}] - 1 WHERE [{pk_column}] = ?", [target_row_id])
    elif remove_value == -1:
        _raw_execute(f"UPDATE {table} SET [{downvote_column}] = [{downvote_column}] - 1, [{score_column}] = [{score_column}] + 1 WHERE [{pk_column}] = ?", [target_row_id])

    if add_value == 1:
        _raw_execute(f"UPDATE {table} SET [{upvote_column}] = [{upvote_column}] + 1, [{score_column}] = [{score_column}] + 1, [updated_at] = ? WHERE [{pk_column}] = ?", [now, target_row_id])
    elif add_value == -1:
        _raw_execute(f"UPDATE {table} SET [{downvote_column}] = [{downvote_column}] + 1, [{score_column}] = [{score_column}] - 1, [updated_at] = ? WHERE [{pk_column}] = ?", [now, target_row_id])


# =========================================================
# LIVE POLLING API
# =========================================================

def api_topic_boards(request, topic_id):
    """GET — current board counts for live polling. Public access."""
    try:
        topic = CollTopic.objects.get(debate_coll_topic_id=topic_id, is_active=True)
    except CollTopic.DoesNotExist:
        return JsonResponse({'success': False, 'error': 'Topic not found'}, status=404)

    status = RefTopicStatus.objects.filter(debate_ref_topic_status_id=topic.link_topic_status_id).first()

    return JsonResponse({
        'success': True,
        'topic_status_code': status.topic_status_code if status else '',
        'total_post_count': topic.total_post_count,
        'blue_participant_count': topic.blue_participant_count,
        'red_participant_count': topic.red_participant_count,
        'topic_score': topic.topic_score,
    })
