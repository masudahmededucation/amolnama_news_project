"""Debate views — topic list (home) and arena (topic detail with blue/red boards)."""

from django.shortcuts import render
from django.http import Http404
from django.utils import timezone
from django.views.decorators.csrf import ensure_csrf_cookie

from .models import CollTopic, CollPost, CollTopicParticipant, RefTeamSide, RefTopicStatus


def _get_topic_status_map():
    """Build status_id → status_code lookup."""
    return {
        status.debate_ref_topic_status_id: status
        for status in RefTopicStatus.objects.filter(is_active=True)
    }


def _get_team_side_map():
    """Build side_id → side object lookup."""
    return {
        side.debate_ref_team_side_id: side
        for side in RefTeamSide.objects.filter(is_active=True)
    }


def _get_current_user_profile_id(request):
    """Get current user's profile ID, or None if not authenticated."""
    if not request.user.is_authenticated:
        return None
    from amolnama_news.site_apps.user_account.models import UserProfile
    try:
        return UserProfile.objects.get(link_user_account_user_id=request.user.pk).user_profile_id
    except UserProfile.DoesNotExist:
        return None


def _calculate_time_remaining(scheduled_start_at):
    """Calculate time remaining until debate starts. Returns human-readable string."""
    now = timezone.now()
    if scheduled_start_at <= now:
        return None
    delta = scheduled_start_at - now
    total_seconds = int(delta.total_seconds())
    days = total_seconds // 86400
    hours = (total_seconds % 86400) // 3600
    minutes = (total_seconds % 3600) // 60
    parts = []
    if days > 0:
        parts.append(f'{days}d')
    if hours > 0:
        parts.append(f'{hours}h')
    if minutes > 0:
        parts.append(f'{minutes}m')
    return ' '.join(parts) if parts else 'Starting soon'


@ensure_csrf_cookie
def home(request):
    """Debate home — list of topics with status, participant counts, countdown."""
    status_map = _get_topic_status_map()

    topics = CollTopic.objects.filter(
        is_active=True,
    ).order_by('-scheduled_start_at')[:50]

    topic_items = []
    for topic in topics:
        status = status_map.get(topic.link_topic_status_id)
        topic_items.append({
            'debate_coll_topic_id': topic.debate_coll_topic_id,
            'topic_title': topic.topic_title,
            'topic_description': topic.topic_description,
            'topic_status_code': status.topic_status_code if status else '',
            'topic_status_name_bn': status.topic_status_name_bn if status else '',
            'scheduled_start_at': topic.scheduled_start_at,
            'scheduled_start_at_formatted': topic.scheduled_start_at.strftime('%d %b %Y, %I:%M %p') if topic.scheduled_start_at else '',
            'time_remaining': _calculate_time_remaining(topic.scheduled_start_at),
            'blue_participant_count': topic.blue_participant_count,
            'red_participant_count': topic.red_participant_count,
            'total_post_count': topic.total_post_count,
            'topic_score': topic.topic_score,
        })

    return render(request, 'debate/pages/debate-home.html', {
        'topic_items': topic_items,
        'seo': {
            'title': 'তর্ক-বিতর্ক — Debate Arena | আমলনামা নিউজ',
            'description': 'Structured debate platform — Blue vs Red. Schedule debates, argue with logic, vote on the strongest arguments.',
        },
    })


@ensure_csrf_cookie
def topic_detail(request, topic_id):
    """Debate arena — three-column layout: Blue board | Topic | Red board."""
    try:
        topic = CollTopic.objects.get(debate_coll_topic_id=topic_id, is_active=True)
    except CollTopic.DoesNotExist:
        raise Http404

    status_map = _get_topic_status_map()
    team_side_map = _get_team_side_map()
    status = status_map.get(topic.link_topic_status_id)

    # Get current user's participation
    current_user_profile_id = _get_current_user_profile_id(request)
    current_participant = None
    current_user_side = None
    if current_user_profile_id:
        current_participant = CollTopicParticipant.objects.filter(
            link_topic_id=topic_id,
            link_user_profile_id=current_user_profile_id,
            is_active=True,
        ).first()
        if current_participant:
            side = team_side_map.get(current_participant.link_team_side_id)
            current_user_side = side.team_side_code if side else None

    # Get blue board root arguments (parent_post_id IS NULL, board_side = 1 = blue)
    blue_side_id = 1
    red_side_id = 2

    blue_root_arguments = list(CollPost.objects.filter(
        link_topic_id=topic_id,
        link_thread_board_side_id=blue_side_id,
        link_parent_post_id__isnull=True,
        is_deleted=False,
        is_auto_rejected=False,
        is_active=True,
    ).order_by('-score', 'posted_at'))

    red_root_arguments = list(CollPost.objects.filter(
        link_topic_id=topic_id,
        link_thread_board_side_id=red_side_id,
        link_parent_post_id__isnull=True,
        is_deleted=False,
        is_auto_rejected=False,
        is_active=True,
    ).order_by('-score', 'posted_at'))

    # Get all replies for this topic (for nesting under root arguments)
    all_replies = list(CollPost.objects.filter(
        link_topic_id=topic_id,
        link_parent_post_id__isnull=False,
        is_deleted=False,
        is_auto_rejected=False,
        is_active=True,
    ).order_by('post_reply_depth', 'posted_at'))

    # Build reply map: root_post_id → [replies]
    reply_map = {}
    for reply in all_replies:
        root_id = reply.link_root_post_id
        if root_id not in reply_map:
            reply_map[root_id] = []
        reply_map[root_id].append(reply)

    # Bulk-fetch author display names
    all_post_author_ids = set()
    for post in blue_root_arguments + red_root_arguments + all_replies:
        all_post_author_ids.add(post.link_author_user_profile_id)

    author_display_name_map = {}
    if all_post_author_ids:
        from amolnama_news.site_apps.user_account.models import UserProfile
        for profile in UserProfile.objects.filter(user_profile_id__in=all_post_author_ids):
            author_display_name_map[profile.user_profile_id] = profile.display_name or 'ব্যবহারকারী'

    # Build post items with author info
    def _build_post_item(post):
        side = team_side_map.get(post.link_author_team_side_id)
        return {
            'debate_coll_post_id': post.debate_coll_post_id,
            'post_content': post.post_content,
            'link_author_team_side_id': post.link_author_team_side_id,
            'author_team_side_code': side.team_side_code if side else '',
            'author_team_side_color_hex': side.team_side_color_hex if side else '',
            'author_display_name': author_display_name_map.get(post.link_author_user_profile_id, 'ব্যবহারকারী'),
            'link_author_user_profile_id': post.link_author_user_profile_id,
            'post_reply_depth': post.post_reply_depth,
            'upvote_count': post.upvote_count,
            'downvote_count': post.downvote_count,
            'score': post.score,
            'reply_count': post.reply_count,
            'post_impact_score': post.post_impact_score,
            'post_argument_strength': post.post_argument_strength,
            'is_champion': post.is_champion,
            'is_suppressed': post.is_suppressed,
            'posted_at': post.posted_at,
            'posted_at_formatted': post.posted_at.strftime('%d %b %Y, %I:%M %p') if post.posted_at else '',
            'replies': [_build_post_item(reply) for reply in reply_map.get(post.debate_coll_post_id, [])],
        }

    blue_thread_items = [_build_post_item(post) for post in blue_root_arguments]
    red_thread_items = [_build_post_item(post) for post in red_root_arguments]

    # Participant counts
    blue_participants = CollTopicParticipant.objects.filter(
        link_topic_id=topic_id, link_team_side_id=blue_side_id, is_active=True,
    ).count()
    red_participants = CollTopicParticipant.objects.filter(
        link_topic_id=topic_id, link_team_side_id=red_side_id, is_active=True,
    ).count()

    topic_item = {
        'debate_coll_topic_id': topic.debate_coll_topic_id,
        'topic_title': topic.topic_title,
        'topic_description': topic.topic_description,
        'topic_status_code': status.topic_status_code if status else '',
        'topic_status_name_bn': status.topic_status_name_bn if status else '',
        'scheduled_start_at': topic.scheduled_start_at,
        'scheduled_start_at_formatted': topic.scheduled_start_at.strftime('%d %b %Y, %I:%M %p') if topic.scheduled_start_at else '',
        'scheduled_start_at_iso': topic.scheduled_start_at.isoformat() if topic.scheduled_start_at else '',
        'time_remaining': _calculate_time_remaining(topic.scheduled_start_at),
        'is_live': status and status.topic_status_code == 'live',
        'minimum_post_character_count': topic.minimum_post_character_count,
        'maximum_reply_depth': topic.maximum_reply_depth,
        'topic_score': topic.topic_score,
        'blue_participant_count': blue_participants,
        'red_participant_count': red_participants,
        'total_post_count': topic.total_post_count,
    }

    return render(request, 'debate/pages/debate-arena.html', {
        'topic': topic_item,
        'blue_threads': blue_thread_items,
        'red_threads': red_thread_items,
        'current_user_side': current_user_side,
        'current_user_profile_id': current_user_profile_id,
        'current_participant': current_participant,
        'team_sides': list(team_side_map.values()),
        'seo': {
            'title': f'{topic.topic_title} — তর্ক-বিতর্ক | আমলনামা নিউজ',
            'description': topic.topic_description[:160] if topic.topic_description else 'Structured debate arena.',
        },
    })
