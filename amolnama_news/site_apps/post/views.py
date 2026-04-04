"""Post views — feed display, post detail, and post creation."""

import re

from amolnama_news.site_apps.core.utils import time_ago as _calculate_time_ago

from django.contrib.auth.decorators import login_required
from django.http import Http404
from django.shortcuts import redirect, render
from django.utils import timezone
from django.utils.html import strip_tags
from django.views.decorators.csrf import ensure_csrf_cookie

from .models import Post, PostLike, PostBookmark


def build_post_feed_items(request, posts=None):
    """Shared helper — builds enriched post items for feed display.
    Used by all tabs: For You, Following, My Posts.
    Accepts optional pre-filtered posts queryset; defaults to all public posts."""
    from amolnama_news.site_apps.user_account.models import UserProfile

    if posts is None:
        posts = Post.objects.filter(
            is_published=True,
            is_active=True,
            link_parent_post_id__isnull=True,
        ).order_by('-created_at')[:50]

    # Build post items with author info
    post_items = []
    user_profile_ids = set(post.link_user_profile_id for post in posts)
    profile_map = {}
    if user_profile_ids:
        for profile in UserProfile.objects.filter(user_profile_id__in=user_profile_ids):
            profile_map[profile.user_profile_id] = profile

    # Bulk-fetch avatar URLs for all authors
    avatar_url_map = _get_avatar_urls_bulk(profile_map)

    # Get liked/bookmarked state for logged-in user
    user_liked_post_ids = set()
    user_bookmarked_post_ids = set()
    user_reposted_post_ids = set()
    user_voted_post_ids = set()
    user_followed_post_ids = set()
    user_following_profile_ids = set()
    current_user_profile_id = None
    if request.user.is_authenticated:
        try:
            current_profile = UserProfile.objects.get(link_user_account_user_id=request.user.pk)
            current_user_profile_id = current_profile.user_profile_id
            post_ids = [post.post_post_id for post in posts]
            if post_ids:
                user_liked_post_ids = set(
                    PostLike.objects.filter(
                        link_post_id__in=post_ids,
                        link_user_profile_id=current_user_profile_id,
                    ).values_list('link_post_id', flat=True)
                )
                user_bookmarked_post_ids = set(
                    PostBookmark.objects.filter(
                        link_post_id__in=post_ids,
                        link_user_profile_id=current_user_profile_id,
                    ).values_list('link_post_id', flat=True)
                )
                user_reposted_post_ids = set(
                    Post.objects.filter(
                        link_repost_of_post_id__in=post_ids,
                        link_user_profile_id=current_user_profile_id,
                        post_type_code='repost',
                        is_active=True,
                    ).values_list('link_repost_of_post_id', flat=True)
                )
            # Bulk-fetch votes and post follows
            from .models import PostVote, PostFollow as PostFollowModel
            user_voted_post_ids = set(
                PostVote.objects.filter(
                    link_post_id__in=post_ids, link_user_profile_id=current_user_profile_id, is_active=True,
                ).values_list('link_post_id', flat=True)
            )
            user_followed_post_ids = set(
                PostFollowModel.objects.filter(
                    link_post_id__in=post_ids, link_user_profile_id=current_user_profile_id, is_active=True,
                ).values_list('link_post_id', flat=True)
            )
        except UserProfile.DoesNotExist:
            pass

    # Bulk-fetch media URLs for all posts
    post_media_map = _get_post_media_urls_bulk([post.post_post_id for post in posts])

    # Bulk-fetch original posts for reposts
    repost_original_ids = set(
        post.link_repost_of_post_id for post in posts
        if post.link_repost_of_post_id
    )
    original_post_map = {}
    if repost_original_ids:
        for original_post in Post.objects.filter(post_post_id__in=repost_original_ids):
            original_post_map[original_post.post_post_id] = original_post
        # Get profiles for original post authors
        original_profile_ids = set(
            original_post.link_user_profile_id for original_post in original_post_map.values()
        )
        for profile in UserProfile.objects.filter(user_profile_id__in=original_profile_ids):
            if profile.user_profile_id not in profile_map:
                profile_map[profile.user_profile_id] = profile

    # Bulk-fetch follower/following counts for profile popup
    # NOTE: author_ids includes BOTH post authors AND original post authors (for reposts)
    from amolnama_news.site_apps.social.models import UserFollow
    from django.db.models import Count
    author_ids = set(post.link_user_profile_id for post in posts)
    for original_post in original_post_map.values():
        author_ids.add(original_post.link_user_profile_id)

    # Bulk-fetch who the current user is following (AFTER original authors are collected)
    if current_user_profile_id and author_ids:
        user_following_profile_ids = set(
            UserFollow.objects.filter(
                link_follower_user_profile_id=current_user_profile_id,
                link_following_user_profile_id__in=author_ids,
                is_active=True,
            ).values_list('link_following_user_profile_id', flat=True)
        )
    follower_counts = dict(
        UserFollow.objects.filter(link_following_user_profile_id__in=author_ids, is_active=True)
        .values('link_following_user_profile_id')
        .annotate(count=Count('social_user_follow_id'))
        .values_list('link_following_user_profile_id', 'count')
    )
    following_counts = dict(
        UserFollow.objects.filter(link_follower_user_profile_id__in=author_ids, is_active=True)
        .values('link_follower_user_profile_id')
        .annotate(count=Count('social_user_follow_id'))
        .values_list('link_follower_user_profile_id', 'count')
    )

    for post in posts:
        profile = profile_map.get(post.link_user_profile_id)
        author_display_name = profile.display_name if profile and profile.display_name else 'ব্যবহারকারী'
        author_avatar_url = avatar_url_map.get(post.link_user_profile_id)

        time_ago = _calculate_time_ago(post.created_at)

        keywords = _parse_keywords_json(post.post_keywords_json)
        post_text_highlighted = _highlight_text_with_entities(post.post_text, keywords)

        post_item = {
            'post_post_id': post.post_post_id,
            'post_text': post.post_text,
            'post_text_highlighted': post_text_highlighted,
            'author_display_name': author_display_name,
            'author_avatar_url': author_avatar_url,
            'author_user_profile_id': post.link_user_profile_id,
            'author_is_verified': profile.is_verified if profile and hasattr(profile, 'is_verified') else False,
            'author_bio': profile.professional_bio_summary if profile and hasattr(profile, 'professional_bio_summary') else '',
            'author_username_handle': profile.username_handle if profile and hasattr(profile, 'username_handle') else '',
            'author_follower_count': follower_counts.get(post.link_user_profile_id, 0),
            'author_following_count': following_counts.get(post.link_user_profile_id, 0),
            'user_following': post.link_user_profile_id in user_following_profile_ids,
            'time_ago': time_ago,
            'created_at_raw': post.created_at,
            'created_at_formatted': post.created_at.strftime('%d %b %Y, %I:%M %p') if post.created_at else '',
            'like_count': post.like_count,
            'reply_count': post.reply_count,
            'repost_count': post.repost_count,
            'view_count': post.view_count,
            'bookmark_count': post.bookmark_count,
            'vote_score_count': post.vote_score_count if hasattr(post, 'vote_score_count') else 0,
            'user_voted': post.post_post_id in user_voted_post_ids,
            'user_followed_post': post.post_post_id in user_followed_post_ids,
            'user_liked': post.post_post_id in user_liked_post_ids,
            'user_bookmarked': post.post_post_id in user_bookmarked_post_ids,
            'user_reposted': post.post_post_id in user_reposted_post_ids,
            'media_urls': post_media_map.get(post.post_post_id, []),
            'keywords': keywords,
            'is_repost': False,
            'can_delete': current_user_profile_id and post.link_user_profile_id == current_user_profile_id,
            'can_edit': current_user_profile_id and post.link_user_profile_id == current_user_profile_id,
            'is_edited': post.is_edited,
            'is_pinned': post.is_pinned,
            'content_category_code': post.content_category_code or '',
            'is_auto_flagged': post.is_auto_flagged,
            'scheduled_publish_at': post.scheduled_publish_at,
            'is_scheduled': post.scheduled_publish_at and not post.is_published,
            'quote_comment_text': post.quote_comment_text or '',
            'poll': None,
        }

        # If this is a repost, include original post data
        if post.link_repost_of_post_id:
            original_post = original_post_map.get(post.link_repost_of_post_id)
            if original_post:
                original_profile = profile_map.get(original_post.link_user_profile_id)
                post_item['is_repost'] = True
                post_item['original_post_text'] = original_post.post_text
                original_keywords = _parse_keywords_json(original_post.post_keywords_json)
                post_item['original_post_text_highlighted'] = _highlight_text_with_entities(original_post.post_text, original_keywords)
                post_item['original_author_display_name'] = original_profile.display_name if original_profile and original_profile.display_name else 'ব্যবহারকারী'
                post_item['original_author_user_profile_id'] = original_post.link_user_profile_id
                post_item['original_author_avatar_url'] = avatar_url_map.get(original_post.link_user_profile_id)
                post_item['original_author_is_verified'] = original_profile.is_verified if original_profile and hasattr(original_profile, 'is_verified') else False
                post_item['original_author_bio'] = original_profile.professional_bio_summary if original_profile and hasattr(original_profile, 'professional_bio_summary') else ''
                post_item['original_author_username_handle'] = original_profile.username_handle if original_profile and hasattr(original_profile, 'username_handle') else ''
                post_item['original_author_follower_count'] = follower_counts.get(original_post.link_user_profile_id, 0)
                post_item['original_author_following_count'] = following_counts.get(original_post.link_user_profile_id, 0)
                post_item['original_user_following'] = original_post.link_user_profile_id in user_following_profile_ids
                post_item['original_is_same_user'] = original_post.link_user_profile_id == post.link_user_profile_id
                post_item['original_time_ago'] = _calculate_time_ago(original_post.created_at)
                post_item['original_created_at_formatted'] = original_post.created_at.strftime('%d %b %Y, %I:%M %p') if original_post.created_at else ''
                post_item['media_urls'] = post_media_map.get(original_post.post_post_id, [])

        post_items.append(post_item)

    # Current user's avatar for composer
    current_user_avatar_url = None
    if request.user.is_authenticated and current_user_profile_id:
        current_user_avatar_url = avatar_url_map.get(current_user_profile_id)
        if not current_user_avatar_url:
            current_user_avatar_url = _get_avatar_url_single(current_user_profile_id)

    # Bulk-fetch polls for posts that have them
    try:
        from .models import PostPoll, PostPollVote
        post_ids_for_polls = [item['post_post_id'] for item in post_items]
        polls_map = {}
        for poll in PostPoll.objects.filter(link_post_id__in=post_ids_for_polls, is_active=True):
            options = []
            for option_number in range(1, 5):
                option_text = getattr(poll, f'poll_option_{option_number}', None)
                if option_text:
                    vote_count = getattr(poll, f'poll_option_{option_number}_vote_count', 0)
                    percentage = round(vote_count / max(poll.total_vote_count, 1) * 100)
                    options.append({'option_number': option_number, 'text': option_text, 'vote_count': vote_count, 'percentage': percentage})
            user_voted_option = None
            if current_user_profile_id:
                user_vote = PostPollVote.objects.filter(link_poll_id=poll.post_post_poll_id, link_user_profile_id=current_user_profile_id, is_active=True).first()
                if user_vote:
                    user_voted_option = user_vote.selected_option_number
            polls_map[poll.link_post_id] = {
                'post_post_poll_id': poll.post_post_poll_id,
                'poll_question': poll.poll_question,
                'options': options,
                'total_vote_count': poll.total_vote_count,
                'user_voted_option': user_voted_option,
            }
        for item in post_items:
            if item['post_post_id'] in polls_map:
                item['poll'] = polls_map[item['post_post_id']]
    except Exception:
        pass

    return post_items, current_user_avatar_url


def home(request):
    """Redirect to homepage — post feed now lives at /."""
    tab = request.GET.get('tab', '')
    if tab:
        return redirect('/?tab=' + tab)
    return redirect('core:home')


def _post_feed_view(request):
    """Post feed — show composer + recent posts. Supports tab filtering via ?tab= query param. (kept for reference)"""
    active_tab = request.GET.get('tab', 'for_you')

    if active_tab == 'my_posts' and request.user.is_authenticated:
        post_items, current_user_avatar_url = _build_my_posts(request)
    elif active_tab == 'following' and request.user.is_authenticated:
        post_items, current_user_avatar_url = _build_following_posts(request)
    else:
        active_tab = 'for_you'
        post_items, current_user_avatar_url = build_post_feed_items(request)

    return render(request, 'post/pages/post-home.html', {
        'posts': post_items,
        'current_user_avatar_url': current_user_avatar_url,
        'active_tab': active_tab,
        'seo': {'title': 'পোস্ট — আমলনামা নিউজ', 'noindex': True},
    })


def _build_following_posts(request):
    """Build post feed filtered to posts from users the current user follows.
    Delegates to build_post_feed_items() for enrichment — single source of truth."""
    from amolnama_news.site_apps.user_account.models import UserProfile
    from amolnama_news.site_apps.social.models import UserFollow

    try:
        current_profile = UserProfile.objects.get(link_user_account_user_id=request.user.pk)
    except UserProfile.DoesNotExist:
        return [], None

    current_user_profile_id = current_profile.user_profile_id

    following_ids = list(
        UserFollow.objects.filter(
            link_follower_user_profile_id=current_user_profile_id,
            is_active=True,
        ).values_list('link_following_user_profile_id', flat=True)
    )

    if not following_ids:
        return [], _get_avatar_url_single(current_user_profile_id)

    posts = Post.objects.filter(
        link_user_profile_id__in=following_ids,
        is_published=True,
        is_active=True,
        link_parent_post_id__isnull=True,
    ).order_by('-created_at')[:50]

    return build_post_feed_items(request, posts=posts)


def _build_my_posts(request):
    """Build post feed filtered to current user's posts only.
    Delegates to build_post_feed_items() for enrichment — single source of truth."""
    from amolnama_news.site_apps.user_account.models import UserProfile

    try:
        current_profile = UserProfile.objects.get(link_user_account_user_id=request.user.pk)
    except UserProfile.DoesNotExist:
        return [], None

    posts = Post.objects.filter(
        link_user_profile_id=current_profile.user_profile_id,
        is_active=True,
        link_parent_post_id__isnull=True,
    ).order_by('-created_at')[:50]

    return build_post_feed_items(request, posts=posts)


@login_required
@ensure_csrf_cookie
def bookmarks(request):
    """Show ALL bookmarked content — posts + universal bookmarks (poems, news, debates, etc.)."""
    from amolnama_news.site_apps.user_account.models import UserProfile

    try:
        current_profile = UserProfile.objects.get(link_user_account_user_id=request.user.pk)
    except UserProfile.DoesNotExist:
        return render(request, 'post/pages/post-bookmarks.html', {
            'posts': [],
            'universal_bookmarks': [],
            'seo': {'title': 'সংরক্ষিত — আমলনামা নিউজ', 'breadcrumbs': [{'name': 'হোম', 'url': '/'}, {'name': 'সংরক্ষিত'}]},
        })

    user_profile_id = current_profile.user_profile_id

    # 1. Post bookmarks (existing system)
    bookmarked_post_ids = list(
        PostBookmark.objects.filter(
            link_user_profile_id=user_profile_id
        ).order_by('-created_at').values_list('link_post_id', flat=True)[:50]
    )

    post_items = []
    if bookmarked_post_ids:
        posts_map = {
            post.post_post_id: post
            for post in Post.objects.filter(post_post_id__in=bookmarked_post_ids, is_active=True)
        }
        posts = [posts_map[post_id] for post_id in bookmarked_post_ids if post_id in posts_map]
        post_items, _ = build_post_feed_items(request, posts=posts)

    # 2. Collect bookmarks/likes from ALL apps into one unified list
    universal_bookmarks = []

    # Poem likes
    try:
        from amolnama_news.site_apps.poem.models import EngagementPoemLike, CollPoemEntry
        poem_like_ids = list(EngagementPoemLike.objects.filter(
            link_user_profile_id=user_profile_id,
        ).order_by('-created_at').values_list('link_poem_coll_poem_entry_id', flat=True)[:20])
        if poem_like_ids:
            poems_map = {p.poem_coll_poem_entry_id: p for p in CollPoemEntry.objects.filter(poem_coll_poem_entry_id__in=poem_like_ids)}
            for poem_id in poem_like_ids:
                poem = poems_map.get(poem_id)
                if poem:
                    universal_bookmarks.append({
                        'item_type': 'content_promo', 'promo_id': poem.poem_coll_poem_entry_id,
                        'promo_badge': 'POEM', 'promo_color': 'purple',
                        'promo_title': poem.poem_title_bn or '',
                        'promo_description': (poem.poem_body_bn or '')[:150],
                        'promo_url': f'/bangla-kobita-gaan/{poem.poem_slug}/',
                        'promo_author': None, 'promo_date_formatted': '',
                        'promo_like_count': getattr(poem, 'like_count', None),
                        'promo_view_count': getattr(poem, 'view_count', None),
                        'promo_extra_stat': None, 'promo_cta': 'পড়ুন',
                    })
    except Exception:
        pass

    # Art bookmarks
    try:
        from amolnama_news.site_apps.art.models import EngagementArtworkBookmark, CollArtwork
        art_bookmark_ids = list(EngagementArtworkBookmark.objects.filter(
            link_user_profile_id=user_profile_id,
        ).order_by('-created_at').values_list('link_artwork_id', flat=True)[:20])
        if art_bookmark_ids:
            artworks_map = {a.art_coll_artwork_id: a for a in CollArtwork.objects.filter(art_coll_artwork_id__in=art_bookmark_ids)}
            for art_id in art_bookmark_ids:
                artwork = artworks_map.get(art_id)
                if artwork:
                    universal_bookmarks.append({
                        'item_type': 'content_promo', 'promo_id': artwork.art_coll_artwork_id,
                        'promo_badge': 'ART', 'promo_color': 'blue',
                        'promo_title': artwork.artwork_title_bn or '',
                        'promo_description': (artwork.artwork_description_bn or '')[:150],
                        'promo_url': f'/art-and-craft/{artwork.artwork_slug}/',
                        'promo_author': None, 'promo_date_formatted': '',
                        'promo_like_count': getattr(artwork, 'like_count', None),
                        'promo_view_count': getattr(artwork, 'view_count', None),
                        'promo_extra_stat': None, 'promo_cta': 'দেখুন',
                    })
    except Exception:
        pass

    # Story bookmarks
    try:
        from amolnama_news.site_apps.stories.models import EngagementStoryBookmark, CollStory
        story_bookmark_ids = list(EngagementStoryBookmark.objects.filter(
            link_user_profile_id=user_profile_id,
        ).order_by('-created_at').values_list('link_story_id', flat=True)[:20])
        if story_bookmark_ids:
            stories_map = {s.stories_coll_story_id: s for s in CollStory.objects.filter(stories_coll_story_id__in=story_bookmark_ids)}
            for story_id in story_bookmark_ids:
                story = stories_map.get(story_id)
                if story:
                    universal_bookmarks.append({
                        'item_type': 'content_promo', 'promo_id': story.stories_coll_story_id,
                        'promo_badge': 'STORY', 'promo_color': 'amber',
                        'promo_title': story.story_title_bn or '',
                        'promo_description': (getattr(story, 'story_summary_bn', '') or '')[:150],
                        'promo_url': f'/stories-for-kids/{story.story_slug}/',
                        'promo_author': None, 'promo_date_formatted': '',
                        'promo_like_count': getattr(story, 'like_count', None),
                        'promo_view_count': getattr(story, 'view_count', None),
                        'promo_extra_stat': None, 'promo_cta': 'পড়ুন',
                    })
    except Exception:
        pass

    # Travel destination bookmarks
    try:
        from amolnama_news.site_apps.bangladesh.models import EngagementDestinationBookmark, CollDestination
        travel_bookmark_ids = list(EngagementDestinationBookmark.objects.filter(
            link_user_profile_id=user_profile_id,
        ).order_by('-created_at').values_list('link_coll_destination_id', flat=True)[:20])
        if travel_bookmark_ids:
            destinations_map = {d.bangladesh_coll_destination_id: d for d in CollDestination.objects.filter(bangladesh_coll_destination_id__in=travel_bookmark_ids)}
            for dest_id in travel_bookmark_ids:
                destination = destinations_map.get(dest_id)
                if destination:
                    universal_bookmarks.append({
                        'item_type': 'content_promo', 'promo_id': destination.bangladesh_coll_destination_id,
                        'promo_badge': 'TRAVEL', 'promo_color': 'green',
                        'promo_title': destination.destination_name_bn or destination.destination_name_en or '',
                        'promo_description': (destination.destination_description_bn or destination.destination_description_en or '')[:150],
                        'promo_url': f'/bangladesh-tourist-destinations/travel/{destination.destination_slug}/',
                        'promo_author': None, 'promo_date_formatted': '',
                        'promo_like_count': getattr(destination, 'like_count', None),
                        'promo_view_count': getattr(destination, 'view_count', None),
                        'promo_extra_stat': None, 'promo_cta': 'ঘুরে আসুন',
                    })
    except Exception:
        pass

    # Newsengine universal bookmarks (future — manual bookmarks from promo cards)
    try:
        from amolnama_news.site_apps.newsengine.models import BookmarkContent
        for bookmark in BookmarkContent.objects.filter(link_user_profile_id=user_profile_id, is_active=True).order_by('-created_at')[:20]:
            color_map = {'news': 'rose', 'poem': 'purple', 'story': 'amber', 'art': 'blue', 'travel': 'green', 'debate': 'amber'}
            universal_bookmarks.append({
                'item_type': 'content_promo', 'promo_id': bookmark.newsengine_bookmark_content_id,
                'promo_badge': bookmark.content_type_code.upper(), 'promo_color': color_map.get(bookmark.content_type_code, 'blue'),
                'promo_title': bookmark.content_title or '',
                'promo_description': '', 'promo_url': bookmark.content_url or '',
                'promo_author': None, 'promo_date_formatted': '',
                'promo_like_count': None, 'promo_view_count': None,
                'promo_extra_stat': None, 'promo_cta': 'দেখুন',
            })
    except Exception:
        pass

    return render(request, 'post/pages/post-bookmarks.html', {
        'posts': post_items,
        'universal_bookmarks': universal_bookmarks,
        'seo': {'title': 'সংরক্ষিত — আমলনামা নিউজ', 'breadcrumbs': [{'name': 'হোম', 'url': '/'}, {'name': 'সংরক্ষিত'}]},
    })


@ensure_csrf_cookie
def post_detail(request, post_post_id):
    """Single post detail page — shareable URL with OG meta tags for social preview."""
    try:
        post = Post.objects.get(post_post_id=post_post_id, is_active=True)
    except Post.DoesNotExist:
        raise Http404

    # Delegate to shared enricher — single source of truth
    post_items, _ = build_post_feed_items(request, posts=[post])
    post_item = post_items[0] if post_items else {}

    # OG meta tags for social share preview
    author_display_name = post_item.get('author_display_name', 'ব্যবহারকারী')
    post_text_plain = strip_tags(post.post_text or '')
    og_title = f'{author_display_name} — আমলনামা নিউজ'
    og_description = post_text_plain[:200] if post_text_plain else 'আমলনামা নিউজে পোস্ট দেখুন'
    media_urls = post_item.get('media_urls', [])
    og_image = media_urls[0] if media_urls else ''
    canonical_url = request.build_absolute_uri(f'/post/{post_post_id}/')

    # Build breadcrumb — include search context if coming from search
    breadcrumbs = [{'name': 'হোম', 'url': '/'}]
    referer = request.META.get('HTTP_REFERER', '')
    if '/search/' in referer:
        breadcrumbs.append({'name': 'অনুসন্ধান', 'url': referer})
    breadcrumbs.append({'name': 'পোস্ট'})

    return render(request, 'post/pages/post-detail.html', {
        'post_item': post_item,
        'seo': {
            'title': og_title,
            'description': og_description,
            'og_image': request.build_absolute_uri(og_image) if og_image else '',
            'og_type': 'article',
            'canonical': canonical_url,
            'breadcrumbs': breadcrumbs,
        },
    })


def post_embed(request, post_post_id):
    """Lightweight embed view — standalone HTML for iframe embedding (no sidebar/header)."""
    from amolnama_news.site_apps.user_account.models import UserProfile

    try:
        post = Post.objects.get(post_post_id=post_post_id, is_active=True)
    except Post.DoesNotExist:
        raise Http404

    profile = None
    try:
        profile = UserProfile.objects.get(user_profile_id=post.link_user_profile_id)
    except UserProfile.DoesNotExist:
        pass

    author_display_name = profile.display_name if profile and profile.display_name else 'ব্যবহারকারী'
    avatar_url_map = _get_avatar_urls_bulk({post.link_user_profile_id: profile} if profile else {})
    author_avatar_url = avatar_url_map.get(post.link_user_profile_id)

    post_media_map = _get_post_media_urls_bulk([post_post_id])
    media_urls = post_media_map.get(post_post_id, [])

    keywords = _parse_keywords_json(post.post_keywords_json)
    post_text_highlighted = _highlight_text_with_entities(post.post_text, keywords)

    post_item = {
        'post_post_id': post.post_post_id,
        'post_text': post.post_text,
        'post_text_highlighted': post_text_highlighted,
        'author_display_name': author_display_name,
        'author_is_verified': profile.is_verified if profile and hasattr(profile, 'is_verified') else False,
        'author_avatar_url': author_avatar_url,
        'time_ago': _calculate_time_ago(post.created_at),
        'created_at_formatted': post.created_at.strftime('%d %b %Y, %I:%M %p') if post.created_at else '',
        'like_count': post.like_count,
        'view_count': post.view_count,
        'media_urls': media_urls,
    }

    post_detail_url = request.build_absolute_uri(f'/post/{post_post_id}/')

    return render(request, 'post/pages/post-embed.html', {
        'post_item': post_item,
        'post_detail_url': post_detail_url,
    })


def api_post_oembed(request):
    """oEmbed API — returns JSON metadata for embed auto-discovery."""
    from django.http import JsonResponse

    url = request.GET.get('url', '')
    post_id_match = re.search(r'/post/(\d+)/', url)
    if not post_id_match:
        return JsonResponse({'error': 'Invalid URL'}, status=400)

    post_post_id = int(post_id_match.group(1))
    try:
        post = Post.objects.get(post_post_id=post_post_id, is_active=True)
    except Post.DoesNotExist:
        return JsonResponse({'error': 'Post not found'}, status=404)

    from amolnama_news.site_apps.user_account.models import UserProfile
    profile = None
    try:
        profile = UserProfile.objects.get(user_profile_id=post.link_user_profile_id)
    except UserProfile.DoesNotExist:
        pass

    author_display_name = profile.display_name if profile and profile.display_name else 'ব্যবহারকারী'
    post_text_plain = strip_tags(post.post_text or '')[:200]
    embed_url = request.build_absolute_uri(f'/post/{post_post_id}/embed/')

    return JsonResponse({
        'version': '1.0',
        'type': 'rich',
        'provider_name': 'আমলনামা নিউজ',
        'provider_url': request.build_absolute_uri('/'),
        'author_name': author_display_name,
        'author_url': request.build_absolute_uri('/post/'),
        'title': f'{author_display_name} — আমলনামা নিউজ',
        'html': f'<iframe src="{embed_url}" width="550" height="400" frameborder="0" scrolling="no" allowtransparency="true"></iframe>',
        'width': 550,
        'height': 400,
    })


    if seconds < 60:
        return 'এইমাত্র'
    elif seconds < 3600:
        minutes = seconds // 60
        return f'{minutes} মিনিট আগে'
    elif seconds < 86400:
        hours = seconds // 3600
        return f'{hours} ঘণ্টা আগে'
    elif seconds < 604800:
        days = seconds // 86400
        return f'{days} দিন আগে'
    else:
        return created_at.strftime('%d %b %Y')


def _parse_keywords_json(keywords_json):
    """Parse JSON string of keywords into a list."""
    if not keywords_json:
        return []
    try:
        import json
        return json.loads(keywords_json)
    except (json.JSONDecodeError, TypeError):
        return []


def _highlight_text_with_entities(text, keywords):
    """Highlight named entities + keywords inline within post text.

    Uses NER (person names, locations, dates, books, religious terms) + theme keywords.
    Returns HTML-safe string with color-coded <mark> tags.
    """
    from .text_highlight import highlight_entities_in_text
    return highlight_entities_in_text(text, keywords)


def _get_post_media_urls_bulk(post_ids):
    """Bulk-fetch media URLs for posts."""
    from django.db import connection

    if not post_ids:
        return {}

    placeholders = ','.join(['%s'] * len(post_ids))
    with connection.cursor() as cursor:
        cursor.execute(f"""
            SELECT [post].[post_media].link_post_id,
                   '/media/' + [media].[asset].file_storage_path
            FROM [post].[post_media]
            JOIN [media].[asset] ON [media].[asset].asset_id = [post].[post_media].link_asset_id
            WHERE [post].[post_media].link_post_id IN ({placeholders})
              AND [media].[asset].is_active = 1
            ORDER BY [post].[post_media].link_post_id, [post].[post_media].sort_order
        """, post_ids)
        rows = cursor.fetchall()

    media_map = {}
    for link_post_id, file_url in rows:
        if link_post_id not in media_map:
            media_map[link_post_id] = []
        media_map[link_post_id].append(file_url)

    return media_map


def _get_avatar_urls_bulk(profile_map):
    """Bulk-fetch avatar URLs for profiles that have link_avatar_asset_id."""
    from django.db import connection

    avatar_asset_ids = {}
    for user_profile_id, profile in profile_map.items():
        if profile.link_avatar_asset_id:
            avatar_asset_ids[profile.link_avatar_asset_id] = user_profile_id

    if not avatar_asset_ids:
        return {}

    placeholders = ','.join(['%s'] * len(avatar_asset_ids))
    with connection.cursor() as cursor:
        cursor.execute(
            f"SELECT [asset_id], '/media/' + [file_storage_path] FROM [media].[asset] WHERE [asset_id] IN ({placeholders}) AND [is_active] = 1",
            list(avatar_asset_ids.keys()),
        )
        rows = cursor.fetchall()

    avatar_url_map = {}
    for asset_id, file_url in rows:
        user_profile_id = avatar_asset_ids.get(asset_id)
        if user_profile_id:
            avatar_url_map[user_profile_id] = file_url

    return avatar_url_map


def _get_avatar_url_single(user_profile_id):
    """Fetch avatar URL for a single user profile — delegates to shared utility."""
    from amolnama_news.site_apps.user_account.models import UserProfile
    from amolnama_news.site_apps.core.utils import get_user_avatar_url

    try:
        profile = UserProfile.objects.get(user_profile_id=user_profile_id)
    except UserProfile.DoesNotExist:
        return None
    return get_user_avatar_url(profile)
