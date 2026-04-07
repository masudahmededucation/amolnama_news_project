"""Stories for Kids views — landing, detail, submit pages."""

from django.contrib.auth.decorators import login_required
from amolnama_news.site_apps.core.utils import time_ago as _calculate_time_ago
from django.http import Http404
from django.shortcuts import render
from django.views.decorators.csrf import ensure_csrf_cookie

from .models import (
    RefStoryCategory, RefStoryAgeGroup,
    CollStory, StoryAsset, StoryPage,
    EngagementStoryLike, EngagementStoryBookmark,
)


def _get_story_cover_url(story_id):
    """Get cover image URL for a story via raw SQL."""
    from django.db import connection
    with connection.cursor() as cursor:
        cursor.execute("""
            SELECT a.[file_storage_path]
            FROM [blog_stories].[story_asset] sa
            JOIN [media].[asset] a ON a.[asset_id] = sa.[link_asset_id]
            WHERE sa.[link_story_id] = %s AND sa.[is_cover] = 1 AND sa.[is_active] = 1
        """, [story_id])
        row = cursor.fetchone()
    return row[0] if row else None



@ensure_csrf_cookie
def home(request):
    """Stories landing page — story cards with category and age filters."""
    category_filter = request.GET.get('category', '')
    age_filter = request.GET.get('age', '')

    stories_queryset = CollStory.objects.filter(
        is_published=True, is_active=True,
    )
    if category_filter:
        stories_queryset = stories_queryset.filter(link_story_category_id=category_filter)
    if age_filter:
        stories_queryset = stories_queryset.filter(link_age_group_id=age_filter)
    stories = stories_queryset.order_by('-is_featured', '-is_daily_pick', '-created_at')[:60]

    # Bulk-fetch cover images
    story_ids = [story.stories_coll_story_id for story in stories]
    cover_map = {}
    if story_ids:
        from django.db import connection
        with connection.cursor() as cursor:
            placeholders = ','.join(['%s'] * len(story_ids))
            cursor.execute(f"""
                SELECT sa.[link_story_id], a.[file_storage_path]
                FROM [blog_stories].[story_asset] sa
                JOIN [media].[asset] a ON a.[asset_id] = sa.[link_asset_id]
                WHERE sa.[link_story_id] IN ({placeholders}) AND sa.[is_cover] = 1 AND sa.[is_active] = 1
            """, story_ids)
            for row in cursor.fetchall():
                cover_map[row[0]] = row[1]

    # Build maps
    category_map = {
        category.stories_ref_story_category_id: category
        for category in RefStoryCategory.objects.filter(is_active=True).order_by('sort_order')
    }
    age_group_map = {
        age_group.stories_ref_story_age_group_id: age_group
        for age_group in RefStoryAgeGroup.objects.filter(is_active=True).order_by('sort_order')
    }

    from amolnama_news.site_apps.user_account.models import UserProfile
    author_ids = set(story.link_user_profile_id for story in stories)
    author_map = {}
    if author_ids:
        for profile in UserProfile.objects.filter(user_profile_id__in=author_ids):
            author_map[profile.user_profile_id] = profile.display_name or 'লেখক'

    story_items = []
    for story in stories:
        category = category_map.get(story.link_story_category_id)
        age_group = age_group_map.get(story.link_age_group_id)
        story_items.append({
            'story_id': story.stories_coll_story_id,
            'title_bn': story.story_title_bn,
            'slug': story.story_slug,
            'summary_bn': story.story_summary_bn,
            'cover_url': cover_map.get(story.stories_coll_story_id),
            'category_name_bn': category.story_category_name_bn if category else '',
            'category_icon': category.story_category_icon if category else '',
            'age_group_name_bn': age_group.age_group_name_bn if age_group else '',
            'reading_time_minutes': story.reading_time_minutes,
            'author_name': author_map.get(story.link_user_profile_id, 'লেখক'),
            'source_attribution_bn': story.story_source_attribution_bn,
            'like_count': story.like_count,
            'view_count': story.view_count,
            'is_daily_pick': story.is_daily_pick,
            'time_ago': _calculate_time_ago(story.created_at),
        })

    categories = RefStoryCategory.objects.filter(is_active=True).order_by('sort_order')
    age_groups = RefStoryAgeGroup.objects.filter(is_active=True).order_by('sort_order')

    return render(request, 'stories/pages/stories-landing.html', {
        'story_items': story_items,
        'categories': categories,
        'age_groups': age_groups,
        'active_category': category_filter,
        'active_age': age_filter,
        'seo': {
            'title': 'গল্পের ঝুলি — ছোটদের গল্প, রূপকথা, ঠাকুরমার ঝুলি | আমলনামা নিউজ',
            'description': 'বাংলা ছোটদের গল্প — ঠাকুরমার ঝুলি, পঞ্চতন্ত্র, রূপকথা, নীতিকথা, ঘুমপাড়ানি গল্প।',
            'breadcrumbs': [{'name': 'হোম', 'url': '/'}, {'name': 'গল্পের ঝুলি'}],
        },
    })


@ensure_csrf_cookie
def detail(request, story_slug):
    """Story detail page — paginated reader."""
    try:
        story = CollStory.objects.get(story_slug=story_slug, is_active=True)
    except CollStory.DoesNotExist:
        raise Http404

    from amolnama_news.site_apps.user_account.models import UserProfile
    author_profile = None
    try:
        author_profile = UserProfile.objects.get(user_profile_id=story.link_user_profile_id)
    except UserProfile.DoesNotExist:
        pass

    category = RefStoryCategory.objects.filter(stories_ref_story_category_id=story.link_story_category_id).first()
    age_group = RefStoryAgeGroup.objects.filter(stories_ref_story_age_group_id=story.link_age_group_id).first()

    # Story pages (for paginated reading)
    pages = list(StoryPage.objects.filter(
        link_story_id=story.stories_coll_story_id, is_active=True,
    ).order_by('page_number'))

    # Cover image
    cover_url = _get_story_cover_url(story.stories_coll_story_id)

    # User state
    user_liked = False
    user_bookmarked = False
    if request.user.is_authenticated:
        try:
            current_profile = UserProfile.objects.get(link_user_account_user_id=request.user.pk)
            current_profile_id = current_profile.user_profile_id
            user_liked = EngagementStoryLike.objects.filter(
                link_story_id=story.stories_coll_story_id,
                link_user_profile_id=current_profile_id, is_active=True,
            ).exists()
            user_bookmarked = EngagementStoryBookmark.objects.filter(
                link_story_id=story.stories_coll_story_id,
                link_user_profile_id=current_profile_id, is_active=True,
            ).exists()
        except UserProfile.DoesNotExist:
            pass

    story_item = {
        'story_id': story.stories_coll_story_id,
        'title_bn': story.story_title_bn,
        'title_en': story.story_title_en,
        'slug': story.story_slug,
        'summary_bn': story.story_summary_bn,
        'content_html_bn': story.story_content_html_bn,
        'source_attribution_bn': story.story_source_attribution_bn,
        'reading_time_minutes': story.reading_time_minutes,
        'category_name_bn': category.story_category_name_bn if category else '',
        'category_icon': category.story_category_icon if category else '',
        'age_group_name_bn': age_group.age_group_name_bn if age_group else '',
        'author_name': author_profile.display_name if author_profile and author_profile.display_name else 'লেখক',
        'cover_url': cover_url,
        'like_count': story.like_count,
        'view_count': story.view_count,
        'bookmark_count': story.bookmark_count,
        'user_liked': user_liked,
        'user_bookmarked': user_bookmarked,
        'pages': pages,
        'total_pages': len(pages),
        'time_ago': _calculate_time_ago(story.created_at),
        'created_at_formatted': story.created_at.strftime('%d %b %Y') if story.created_at else '',
    }

    # Writer info for actions bar
    from amolnama_news.site_apps.core.utils import build_actions_bar_author_context, build_related_content_items
    actions_bar_author_context = build_actions_bar_author_context(story.link_user_profile_id, request, profile_suffix='articles/')

    # Record content view for personalization
    if request.user.is_authenticated:
        try:
            from amolnama_news.site_apps.core.utils import get_user_profile_id
            viewer_user_profile_id = get_user_profile_id(request)
            if viewer_user_profile_id:
                from amolnama_news.site_apps.newsengine.personalization import record_content_view
                record_content_view(viewer_user_profile_id, 'story', story.story_coll_story_id)
        except Exception:
            pass

    return render(request, 'stories/pages/stories-detail.html', {
        'story': story_item,
        **actions_bar_author_context,
        'related_content_items': build_related_content_items(
            story.story_title_bn or story.story_summary_bn or '',
            'story', story.story_coll_story_id, limit=5,
        ),
        'related_content_api_url': f'/newsengine/api/related-content/?type=story&id={story.story_coll_story_id}',
        'seo': {
            'title': f'{story.story_title_bn} — গল্পের ঝুলি | আমলনামা নিউজ',
            'description': (story.story_summary_bn or story.story_title_bn)[:200],
            'og_image': request.build_absolute_uri(cover_url) if cover_url else '',
            'og_type': 'article',
            'breadcrumbs': [{'name': 'হোম', 'url': '/'}, {'name': 'গল্পের ঝুলি', 'url': '/stories-for-kids/'}, {'name': (story.story_title_bn or '')[:40]}],
        },
    })


@login_required
@ensure_csrf_cookie
def submit(request):
    """Story submission page."""
    categories = RefStoryCategory.objects.filter(is_active=True).order_by('sort_order')
    age_groups = RefStoryAgeGroup.objects.filter(is_active=True).order_by('sort_order')

    return render(request, 'stories/pages/stories-submit.html', {
        'categories': categories,
        'age_groups': age_groups,
        'seo': {
            'title': 'গল্প জমা দিন — গল্পের ঝুলি | আমলনামা নিউজ',
            'breadcrumbs': [{'name': 'হোম', 'url': '/'}, {'name': 'গল্পের ঝুলি', 'url': '/stories-for-kids/'}, {'name': 'জমা দিন'}],
        },
    })
