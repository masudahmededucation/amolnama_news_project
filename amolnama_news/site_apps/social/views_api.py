"""Social API views — follow/unfollow, block/unblock, lists."""

import json

from django.contrib.auth.decorators import login_required
from django.db import connection
from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.http import require_POST

from .models import UserBlock, UserList, UserListMember, UserFollow


@require_POST
@login_required
def api_follow_toggle(request, user_profile_id):
    """Toggle follow/unfollow a user. Cannot follow yourself."""
    from amolnama_news.site_apps.user_account.models import UserProfile

    try:
        current_profile = UserProfile.objects.get(link_user_account_user_id=request.user.pk)
    except UserProfile.DoesNotExist:
        return JsonResponse({'success': False, 'error': 'প্রোফাইল পাওয়া যায়নি'}, status=400)

    # Cannot follow yourself
    if current_profile.user_profile_id == user_profile_id:
        return JsonResponse({'success': False, 'error': 'নিজেকে ফলো করা যায় না'}, status=400)

    # Check target exists
    if not UserProfile.objects.filter(user_profile_id=user_profile_id).exists():
        return JsonResponse({'success': False, 'error': 'ব্যবহারকারী পাওয়া যায়নি'}, status=404)

    # Check existing follow (active or inactive)
    existing_follow = UserFollow.objects.filter(
        link_follower_user_profile_id=current_profile.user_profile_id,
        link_following_user_profile_id=user_profile_id,
    ).first()

    if existing_follow and existing_follow.is_active:
        # Unfollow
        existing_follow.is_active = False
        existing_follow.updated_at = timezone.now()
        existing_follow.save(update_fields=['is_active', 'updated_at'])
        following = False
    elif existing_follow and not existing_follow.is_active:
        # Re-follow
        existing_follow.is_active = True
        existing_follow.updated_at = timezone.now()
        existing_follow.save(update_fields=['is_active', 'updated_at'])
        following = True
    else:
        # First-time follow
        UserFollow.objects.create(
            link_follower_user_profile_id=current_profile.user_profile_id,
            link_following_user_profile_id=user_profile_id,
            is_active=True,
        )
        following = True

    # Count followers for the target user (from actual data)
    follower_count = UserFollow.objects.filter(
        link_following_user_profile_id=user_profile_id,
        is_active=True,
    ).count()

    return JsonResponse({
        'success': True,
        'following': following,
        'follower_count': follower_count,
    })


@require_POST
@login_required
def api_block_toggle(request, user_profile_id):
    """Toggle block/unblock a user. Blocked user's content hidden from feed."""
    from amolnama_news.site_apps.user_account.models import UserProfile

    try:
        current_profile = UserProfile.objects.get(link_user_account_user_id=request.user.pk)
    except UserProfile.DoesNotExist:
        return JsonResponse({'success': False, 'error': 'প্রোফাইল পাওয়া যায়নি'}, status=400)

    if current_profile.user_profile_id == user_profile_id:
        return JsonResponse({'success': False, 'error': 'নিজেকে ব্লক করা যায় না'}, status=400)

    existing_block = UserBlock.objects.filter(
        link_blocker_user_profile_id=current_profile.user_profile_id,
        link_blocked_user_profile_id=user_profile_id,
        is_active=True,
    ).first()

    if existing_block:
        existing_block.delete()
        blocked = False
    else:
        with connection.cursor() as cursor:
            cursor.execute("""
                INSERT INTO [social].[user_block]
                    ([link_blocker_user_profile_id], [link_blocked_user_profile_id])
                VALUES (%s, %s)
            """, [current_profile.user_profile_id, user_profile_id])
        blocked = True

    return JsonResponse({'success': True, 'blocked': blocked})


# =========================================================
# USER LISTS
# =========================================================

@require_POST
@login_required
def api_list_create(request):
    """Create a new user list."""
    from amolnama_news.site_apps.user_account.models import UserProfile

    try:
        current_profile = UserProfile.objects.get(link_user_account_user_id=request.user.pk)
    except UserProfile.DoesNotExist:
        return JsonResponse({'success': False, 'error': 'প্রোফাইল পাওয়া যায়নি'}, status=400)

    try:
        data = json.loads(request.body)
    except (json.JSONDecodeError, ValueError):
        return JsonResponse({'success': False, 'error': 'Invalid request'}, status=400)

    list_name = (data.get('list_name') or '').strip()
    list_description = (data.get('list_description') or '').strip() or None

    if not list_name or len(list_name) < 2:
        return JsonResponse({'success': False, 'error': 'তালিকার নাম কমপক্ষে ২ অক্ষর হতে হবে'}, status=400)

    with connection.cursor() as cursor:
        cursor.execute("""
            INSERT INTO [social].[user_list] ([link_owner_user_profile_id], [list_name], [list_description])
            OUTPUT INSERTED.social_user_list_id
            VALUES (%s, %s, %s)
        """, [current_profile.user_profile_id, list_name, list_description])
        list_id = cursor.fetchone()[0]

    return JsonResponse({'success': True, 'list_id': list_id})


@require_POST
@login_required
def api_list_member_toggle(request):
    """Add or remove a user from a list."""
    from amolnama_news.site_apps.user_account.models import UserProfile

    try:
        current_profile = UserProfile.objects.get(link_user_account_user_id=request.user.pk)
    except UserProfile.DoesNotExist:
        return JsonResponse({'success': False, 'error': 'প্রোফাইল পাওয়া যায়নি'}, status=400)

    try:
        data = json.loads(request.body)
    except (json.JSONDecodeError, ValueError):
        return JsonResponse({'success': False, 'error': 'Invalid request'}, status=400)

    list_id = data.get('list_id')
    member_user_profile_id = data.get('member_user_profile_id')

    if not list_id or not member_user_profile_id:
        return JsonResponse({'success': False, 'error': 'Missing list_id or member_user_profile_id'}, status=400)

    # Verify ownership
    from .models import UserList, UserListMember
    user_list = UserList.objects.filter(
        social_user_list_id=list_id, link_owner_user_profile_id=current_profile.user_profile_id, is_active=True,
    ).first()
    if not user_list:
        return JsonResponse({'success': False, 'error': 'তালিকা পাওয়া যায়নি'}, status=404)

    existing_member = UserListMember.objects.filter(
        link_list_id=list_id, link_user_profile_id=member_user_profile_id, is_active=True,
    ).first()

    if existing_member:
        existing_member.delete()
        return JsonResponse({'success': True, 'action': 'removed'})
    else:
        with connection.cursor() as cursor:
            cursor.execute("""
                INSERT INTO [social].[user_list_member] ([link_list_id], [link_user_profile_id])
                VALUES (%s, %s)
            """, [list_id, member_user_profile_id])
        return JsonResponse({'success': True, 'action': 'added'})
