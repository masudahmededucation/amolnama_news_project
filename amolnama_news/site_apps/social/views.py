"""Social views — home, user lists, public profiles."""

from django.contrib.auth.decorators import login_required
from django.shortcuts import render, redirect


def home(request):
    return render(request, 'core/base.html')


def public_profile(request, username_handle):
    """View another user's public profile — posts, follower/following counts, follow/block buttons."""
    from amolnama_news.site_apps.user_account.models import UserProfile
    from amolnama_news.site_apps.post.models import Post
    from .models import UserFollow, UserBlock

    profile = UserProfile.objects.filter(username_handle=username_handle).first()
    if not profile:
        return render(request, 'social/pages/user-profile-not-found.html', {
            'username_handle': username_handle,
            'seo': {'title': 'প্রোফাইল পাওয়া যায়নি', 'noindex': True},
        })

    # Get avatar
    avatar_url = None
    if profile.link_avatar_asset_id:
        from django.db import connection
        with connection.cursor() as cursor:
            cursor.execute(
                "SELECT '/media/' + [file_storage_path] FROM [media].[asset] WHERE [asset_id] = %s AND [is_active] = 1",
                [profile.link_avatar_asset_id],
            )
            row = cursor.fetchone()
            if row:
                avatar_url = row[0]

    # Follower/following counts
    follower_count = UserFollow.objects.filter(
        link_following_user_profile_id=profile.user_profile_id, is_active=True,
    ).count()
    following_count = UserFollow.objects.filter(
        link_follower_user_profile_id=profile.user_profile_id, is_active=True,
    ).count()

    # Post count
    post_count = Post.objects.filter(
        link_user_profile_id=profile.user_profile_id, is_published=True, is_active=True,
        post_type_code__in=['text', 'media'],
    ).count()

    # Current user state
    current_user_profile_id = None
    is_own_profile = False
    user_following = False
    user_blocked = False
    if request.user.is_authenticated:
        try:
            current_profile = UserProfile.objects.get(link_user_account_user_id=request.user.pk)
            current_user_profile_id = current_profile.user_profile_id
            is_own_profile = current_user_profile_id == profile.user_profile_id
            if not is_own_profile:
                user_following = UserFollow.objects.filter(
                    link_follower_user_profile_id=current_user_profile_id,
                    link_following_user_profile_id=profile.user_profile_id,
                    is_active=True,
                ).exists()
                user_blocked = UserBlock.objects.filter(
                    link_blocker_user_profile_id=current_user_profile_id,
                    link_blocked_user_profile_id=profile.user_profile_id,
                    is_active=True,
                ).exists()
        except UserProfile.DoesNotExist:
            pass

    # User's posts (latest 20)
    from amolnama_news.site_apps.post.views import build_post_feed_items
    posts = Post.objects.filter(
        link_user_profile_id=profile.user_profile_id, is_published=True, is_active=True,
    ).order_by('-created_at')[:20]

    # Build feed items using existing shared function
    feed_items, _ = build_post_feed_items(request, posts=posts)

    return render(request, 'social/pages/user-profile.html', {
        'profile': profile,
        'avatar_url': avatar_url,
        'follower_count': follower_count,
        'following_count': following_count,
        'post_count': post_count,
        'is_own_profile': is_own_profile,
        'user_following': user_following,
        'user_blocked': user_blocked,
        'posts': feed_items,
        'seo': {
            'title': f'{profile.display_name or username_handle} — আমলনামা নিউজ',
            'description': profile.professional_bio_summary or '',
            'noindex': False,
            'breadcrumbs': [
                {'name': 'হোম', 'url': '/'},
                {'name': profile.display_name or username_handle},
            ],
        },
    })


@login_required
def lists_page(request):
    """User's lists — create, manage, view list members."""
    from amolnama_news.site_apps.user_account.models import UserProfile
    from .models import UserList

    try:
        current_profile = UserProfile.objects.get(link_user_account_user_id=request.user.pk)
    except UserProfile.DoesNotExist:
        return render(request, 'social/pages/social-lists.html', {'lists': [], 'seo': {'noindex': True}})

    user_lists = UserList.objects.filter(
        link_owner_user_profile_id=current_profile.user_profile_id, is_active=True,
    ).order_by('-created_at')

    list_items = []
    for user_list in user_lists:
        from .models import UserListMember
        member_count = UserListMember.objects.filter(
            link_list_id=user_list.social_user_list_id, is_active=True,
        ).count()
        list_items.append({
            'list_id': user_list.social_user_list_id,
            'list_name': user_list.list_name,
            'list_description': user_list.list_description or '',
            'member_count': member_count,
        })

    return render(request, 'social/pages/social-lists.html', {
        'lists': list_items,
        'seo': {'title': 'তালিকা — আমলনামা নিউজ', 'noindex': True, 'breadcrumbs': [{'name': 'হোম', 'url': '/'}, {'name': 'সামাজিক', 'url': '/social/'}, {'name': 'তালিকা'}]},
    })
