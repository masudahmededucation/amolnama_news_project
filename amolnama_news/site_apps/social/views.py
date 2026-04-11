"""Social views — home, user lists, public profiles, followers/following, bookmarks."""

import logging

from django.contrib.auth.decorators import login_required
from django.shortcuts import render
from django.views.decorators.csrf import ensure_csrf_cookie

logger = logging.getLogger(__name__)


def home(request):
    """Social home — shows current user's followers/following, or login prompt."""
    from amolnama_news.site_apps.user_account.models import UserProfile

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

    # Fetch all published content by this user from content registry — render as
    # promo cards using the SAME shared content-promo-card component used by the
    # home wall, with per-content-type metadata (badge/color/cta) from the single
    # source of truth in content/bookmarks.py and live cover URLs from
    # content/cover_urls.py registry.
    import logging
    logger = logging.getLogger(__name__)
    articles = []
    try:
        from amolnama_news.site_apps.content.models import ContentRegistry, RefContentCategory, RefContentSubcategory
        from amolnama_news.site_apps.content.bookmarks import get_content_type_metadata
        from amolnama_news.site_apps.content.cover_urls import get_cover_urls_for_content_refs

        registry_items = list(ContentRegistry.objects.filter(
            link_user_profile_id=profile.user_profile_id,
            is_published=True,
            is_active=True,
        ).order_by('-published_at', '-created_at'))

        # Build subcategory lookup for display badges (Bengali names)
        subcategory_ids = [item.link_content_ref_content_subcategory_id for item in registry_items if item.link_content_ref_content_subcategory_id]
        subcategory_name_by_id = {}
        if subcategory_ids:
            for subcategory in RefContentSubcategory.objects.filter(content_ref_content_subcategory_id__in=subcategory_ids):
                subcategory_name_by_id[subcategory.content_ref_content_subcategory_id] = subcategory.subcategory_name_bn

        # Category code lookup for content_type discriminator
        category_code_by_id = {}
        category_ids = set(item.link_content_ref_content_category_id for item in registry_items)
        if category_ids:
            for category in RefContentCategory.objects.filter(content_ref_content_category_id__in=category_ids):
                category_code_by_id[category.content_ref_content_category_id] = category.content_category_code

        # Map ContentRegistry to per-app source rows for cover-URL resolution.
        # The cover_urls helper takes (content_type_code, source_table_id) tuples,
        # but ContentRegistry stores its own ID — we need to fetch the per-app
        # source table primary key by URL slug.
        from amolnama_news.site_apps.poem.models import CollPoemEntry
        from amolnama_news.site_apps.art.models import CollArtwork
        from amolnama_news.site_apps.stories.models import CollStory
        from amolnama_news.site_apps.bangladesh.models import CollDestination

        # Group source PKs by content_type for bulk cover lookup
        registry_to_source_id = {}
        for item in registry_items:
            type_code = category_code_by_id.get(item.link_content_ref_content_category_id, '')
            slug = item.content_slug or ''
            source_id = None
            if type_code == 'art' and slug:
                row = CollArtwork.objects.filter(artwork_slug=slug).only('blog_art_coll_artwork_id').first()
                source_id = row.blog_art_coll_artwork_id if row else None
            elif type_code == 'story' and slug:
                row = CollStory.objects.filter(story_slug=slug).only('blog_stories_coll_story_id').first()
                source_id = row.blog_stories_coll_story_id if row else None
            elif type_code == 'destination' and slug:
                row = CollDestination.objects.filter(destination_slug=slug).only('blog_bangladesh_coll_destination_id').first()
                source_id = row.blog_bangladesh_coll_destination_id if row else None
            elif type_code == 'poem' and slug:
                row = CollPoemEntry.objects.filter(poem_slug=slug).only('blog_poem_coll_poem_entry_id').first()
                source_id = row.blog_poem_coll_poem_entry_id if row else None
            if source_id:
                registry_to_source_id[item.content_registry_id] = (type_code, source_id)

        # Bulk-fetch covers for all source rows in one call per content type
        cover_url_lookup = get_cover_urls_for_content_refs(list(registry_to_source_id.values()))

        for item in registry_items:
            title_text = item.content_title_bn or item.content_title_en or ''
            summary_text = item.content_summary_bn or ''
            # Only show summary if different from title
            description = ''
            if summary_text and summary_text.strip() != title_text.strip():
                description = summary_text

            type_code = category_code_by_id.get(item.link_content_ref_content_category_id, '')
            metadata = get_content_type_metadata(type_code) if type_code else {'badge': '', 'color': 'blue', 'cta': 'পড়ুন'}
            published_at = item.published_at or item.created_at

            # Cover URL — first try the cached column on ContentRegistry, then fall back
            # to a live lookup against the source app's asset table
            cover_url = item.content_cover_image_url or ''
            if not cover_url and item.content_registry_id in registry_to_source_id:
                cover_url = cover_url_lookup.get(registry_to_source_id[item.content_registry_id], '')

            # Badge: prefer the subcategory name (more specific), fall back to type metadata
            badge = subcategory_name_by_id.get(item.link_content_ref_content_subcategory_id) or metadata['badge']

            articles.append({
                'promo_id': item.content_registry_id,
                'item_type': type_code or 'content',
                'promo_url': item.content_url or '#',
                'promo_badge': badge,
                'promo_color': metadata['color'],
                'promo_title': title_text,
                'promo_description': description,
                'promo_author': '',
                'promo_date_formatted': published_at.strftime('%d %b %Y') if published_at else '',
                'promo_cover_image_url': cover_url,
                'promo_like_count': None,
                'promo_view_count': None,
                'promo_extra_stat': None,
                'promo_cta': metadata['cta'],
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


# Bookmarks page lives in views_bookmarks.py — atomic, independent feature.
# Re-exported here so URL patterns can keep importing from views.
from amolnama_news.site_apps.social.views_bookmarks import bookmarks  # noqa: F401
