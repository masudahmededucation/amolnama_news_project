"""Social views — home, user lists, public profiles, followers/following."""

from django.contrib.auth.decorators import login_required
from django.shortcuts import render


def home(request):
    """Social home — shows current user's followers/following, or login prompt."""
    from amolnama_news.site_apps.user_account.models import UserProfile
    from .models import UserFollow

    if not request.user.is_authenticated:
        return render(request, 'social/pages/social-home.html', {
            'seo': {'title': 'সামাজিক — আমলনামা নিউজ', 'noindex': True},
        })

    try:
        current_profile = UserProfile.objects.get(link_user_account_user_id=request.user.pk)
    except UserProfile.DoesNotExist:
        return render(request, 'social/pages/social-home.html', {
            'seo': {'title': 'সামাজিক — আমলনামা নিউজ', 'noindex': True},
        })

    # Redirect to the user's own followers page
    from django.shortcuts import redirect
    if current_profile.username_handle:
        return redirect('social:followers_page', username_handle=current_profile.username_handle)

    return render(request, 'social/pages/social-home.html', {
        'seo': {'title': 'সামাজিক — আমলনামা নিউজ', 'noindex': True},
    })


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

    # Get avatar — shared utility
    from amolnama_news.site_apps.core.utils import get_user_avatar_url
    avatar_url = get_user_avatar_url(profile)

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


def public_profile_articles(request, username_handle):
    """View a user's published articles — articles-only profile page."""
    from amolnama_news.site_apps.user_account.models import UserProfile
    from .models import UserFollow, UserBlock

    profile = UserProfile.objects.filter(username_handle=username_handle).first()
    if not profile:
        return render(request, 'social/pages/user-profile-not-found.html', {
            'username_handle': username_handle,
            'seo': {'title': 'প্রোফাইল পাওয়া যায়নি', 'noindex': True},
        })

    # Get avatar
    from amolnama_news.site_apps.core.utils import get_user_avatar_url
    avatar_url = get_user_avatar_url(profile)

    # Follower/following counts
    follower_count = UserFollow.objects.filter(
        link_following_user_profile_id=profile.user_profile_id, is_active=True,
    ).count()
    following_count = UserFollow.objects.filter(
        link_follower_user_profile_id=profile.user_profile_id, is_active=True,
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

    # Fetch all published content by this user from content registry
    import logging
    logger = logging.getLogger(__name__)
    articles = []
    try:
        from amolnama_news.site_apps.content.models import ContentRegistry, RefContentCategory, RefContentSubcategory
        # Exclude posts — posts are not blog content (no 'post' in ref_content_category)
        # All registry items are blog content by design

        registry_items = ContentRegistry.objects.filter(
            link_user_profile_id=profile.user_profile_id,
            is_published=True,
            is_active=True,
        ).order_by('-published_at', '-created_at')

        # Build subcategory lookup for display names
        subcategory_ids = [item.link_content_ref_content_subcategory_id for item in registry_items if item.link_content_ref_content_subcategory_id]
        subcategory_map = {}
        if subcategory_ids:
            for subcategory in RefContentSubcategory.objects.filter(content_ref_content_subcategory_id__in=subcategory_ids):
                subcategory_map[subcategory.content_ref_content_subcategory_id] = subcategory.subcategory_name_bn

        for item in registry_items:
            articles.append({
                'content_registry_id': item.content_registry_id,
                'content_title_bn': item.content_title_bn or item.content_title_en or '',
                'content_url': item.content_url,
                'content_summary_bn': item.content_summary_bn or '',
                'content_category_name': subcategory_map.get(item.link_content_ref_content_subcategory_id, ''),
                'published_at': item.published_at or item.created_at,
                'link_content_category_id': item.link_content_category_id,
            })
    except Exception as articles_query_error:
        logger.error('Articles profile query failed for user %s — %s',
                     profile.user_profile_id, articles_query_error)

    # Article count
    article_count = len(articles)

    return render(request, 'social/pages/user-profile-articles.html', {
        'profile': profile,
        'avatar_url': avatar_url,
        'follower_count': follower_count,
        'following_count': following_count,
        'article_count': article_count,
        'is_own_profile': is_own_profile,
        'user_following': user_following,
        'user_blocked': user_blocked,
        'articles': articles,
        'active_profile_tab': 'articles',
        'seo': {
            'title': f'{profile.display_name or username_handle} — নিবন্ধ | আমলনামা নিউজ',
            'description': f'{profile.display_name or username_handle} এর প্রকাশিত সংবাদ ও নিবন্ধ',
            'noindex': False,
            'breadcrumbs': [
                {'name': 'হোম', 'url': '/'},
                {'name': profile.display_name or username_handle, 'url': f'/social/@{username_handle}/'},
                {'name': 'নিবন্ধ'},
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


def _build_follow_user_list(user_profile_ids, current_user_profile_id=None):
    """Build list of user data dicts from a list of profile IDs.
    Shared helper for followers and following views."""
    from amolnama_news.site_apps.user_account.models import UserProfile
    from amolnama_news.site_apps.core.utils import get_user_avatar_url
    from .models import UserFollow

    if not user_profile_ids:
        return []

    profiles = UserProfile.objects.filter(
        user_profile_id__in=user_profile_ids,
    ).order_by('display_name')

    # Batch check: which of these does the current user follow?
    current_following_ids = set()
    if current_user_profile_id:
        current_following_ids = set(
            UserFollow.objects.filter(
                link_follower_user_profile_id=current_user_profile_id,
                link_following_user_profile_id__in=user_profile_ids,
                is_active=True,
            ).values_list('link_following_user_profile_id', flat=True)
        )

    # Batch check: which of these follow the target user? (for "follows you" badge)
    follows_back_ids = set()
    if current_user_profile_id:
        follows_back_ids = set(
            UserFollow.objects.filter(
                link_follower_user_profile_id__in=user_profile_ids,
                link_following_user_profile_id=current_user_profile_id,
                is_active=True,
            ).values_list('link_follower_user_profile_id', flat=True)
        )

    user_list = []
    for profile in profiles:
        user_list.append({
            'user_profile_id': profile.user_profile_id,
            'display_name': profile.display_name or '',
            'username_handle': profile.username_handle or '',
            'avatar_url': get_user_avatar_url(profile),
            'professional_bio_summary': profile.professional_bio_summary or '',
            'is_verified': profile.is_verified or False,
            'is_following': profile.user_profile_id in current_following_ids,
            'follows_you': profile.user_profile_id in follows_back_ids,
            'is_own_profile': profile.user_profile_id == current_user_profile_id,
        })
    return user_list


def followers_page(request, username_handle):
    """View a user's followers list."""
    return _follow_list_page(request, username_handle, list_type='followers')


def following_page(request, username_handle):
    """View a user's following list."""
    return _follow_list_page(request, username_handle, list_type='following')


def _follow_list_page(request, username_handle, list_type):
    """Shared view for followers and following pages."""
    from amolnama_news.site_apps.user_account.models import UserProfile
    from .models import UserFollow

    profile = UserProfile.objects.filter(username_handle=username_handle).first()
    if not profile:
        return render(request, 'social/pages/user-profile-not-found.html', {
            'username_handle': username_handle,
            'seo': {'title': 'প্রোফাইল পাওয়া যায়নি', 'noindex': True},
        })

    # Get current user profile ID
    current_user_profile_id = None
    if request.user.is_authenticated:
        try:
            current_profile = UserProfile.objects.get(link_user_account_user_id=request.user.pk)
            current_user_profile_id = current_profile.user_profile_id
        except UserProfile.DoesNotExist:
            pass

    # Get follower/following counts (for tabs)
    follower_count = UserFollow.objects.filter(
        link_following_user_profile_id=profile.user_profile_id, is_active=True,
    ).count()
    following_count = UserFollow.objects.filter(
        link_follower_user_profile_id=profile.user_profile_id, is_active=True,
    ).count()

    # Get user IDs for the active tab (first 50 — SSR)
    if list_type == 'followers':
        user_profile_ids = list(
            UserFollow.objects.filter(
                link_following_user_profile_id=profile.user_profile_id, is_active=True,
            ).order_by('-created_at').values_list('link_follower_user_profile_id', flat=True)[:50]
        )
    else:
        user_profile_ids = list(
            UserFollow.objects.filter(
                link_follower_user_profile_id=profile.user_profile_id, is_active=True,
            ).order_by('-created_at').values_list('link_following_user_profile_id', flat=True)[:50]
        )

    users = _build_follow_user_list(user_profile_ids, current_user_profile_id)

    # Avatar for profile header
    from amolnama_news.site_apps.core.utils import get_user_avatar_url
    avatar_url = get_user_avatar_url(profile)

    tab_label = 'অনুসরণকারী' if list_type == 'followers' else 'অনুসরণ করছেন'
    total_count = follower_count if list_type == 'followers' else following_count

    return render(request, 'social/pages/follow-list.html', {
        'profile': profile,
        'avatar_url': avatar_url,
        'list_type': list_type,
        'users': users,
        'follower_count': follower_count,
        'following_count': following_count,
        'total_count': total_count,
        'has_more': total_count > 50,
        'seo': {
            'title': f'{profile.display_name or username_handle} — {tab_label} — আমলনামা নিউজ',
            'description': f'{profile.display_name or username_handle}-এর {tab_label} তালিকা',
            'noindex': False,
            'breadcrumbs': [
                {'name': 'হোম', 'url': '/'},
                {'name': profile.display_name or username_handle, 'url': f'/social/@{username_handle}/'},
                {'name': tab_label},
            ],
        },
    })
