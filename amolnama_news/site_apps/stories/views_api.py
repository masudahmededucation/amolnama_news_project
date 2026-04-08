"""Stories for Kids API views — create, like, bookmark."""

import json
import logging
import os
import uuid

from django.conf import settings
from django.contrib.auth.decorators import login_required
from django.db import connection
from django.db.models import F
from django.http import JsonResponse
from django.views.decorators.http import require_POST

from .models import CollStory, EngagementStoryLike, EngagementStoryBookmark, EngagementStoryComment

logger = logging.getLogger(__name__)


@require_POST
@login_required
def api_story_create(request):
    """Create a new story."""
    from amolnama_news.site_apps.user_account.models import UserProfile
    from amolnama_news.site_apps.core.utils import bangla_slugify

    story_title_bn = (request.POST.get('story_title_bn') or '').strip()
    story_title_en = (request.POST.get('story_title_en') or '').strip() or None
    story_summary_bn = (request.POST.get('story_summary_bn') or '').strip() or None
    story_content_html_bn = (request.POST.get('story_content_html_bn') or '').strip()
    story_source_attribution_bn = (request.POST.get('story_source_attribution_bn') or '').strip() or None
    link_blog_stories_ref_story_category_id = request.POST.get('link_blog_stories_ref_story_category_id')
    link_blog_stories_ref_story_age_group_id = request.POST.get('link_blog_stories_ref_story_age_group_id')
    reading_time_minutes = request.POST.get('reading_time_minutes') or 5

    if not story_title_bn:
        return JsonResponse({'success': False, 'error': 'গল্পের নাম দিন'}, status=400)
    if not story_content_html_bn:
        return JsonResponse({'success': False, 'error': 'গল্প লিখুন'}, status=400)
    if not link_blog_stories_ref_story_category_id:
        return JsonResponse({'success': False, 'error': 'বিভাগ নির্বাচন করুন'}, status=400)
    if not link_blog_stories_ref_story_age_group_id:
        return JsonResponse({'success': False, 'error': 'বয়সভিত্তিক শ্রেণী নির্বাচন করুন'}, status=400)

    try:
        user_profile = UserProfile.objects.get(link_user_account_user_id=request.user.pk)
    except UserProfile.DoesNotExist:
        return JsonResponse({'success': False, 'error': 'প্রোফাইল পাওয়া যায়নি'}, status=400)

    story_slug = bangla_slugify(story_title_bn)

    story_guid = str(uuid.uuid4())
    with connection.cursor() as cursor:
        cursor.execute("""
            INSERT INTO [blog_stories].[coll_story]
                ([story_guid], [link_user_profile_id], [link_blog_stories_ref_story_category_id], [link_blog_stories_ref_story_age_group_id],
                 [story_title_bn], [story_title_en], [story_slug], [story_summary_bn],
                 [story_content_html_bn], [story_source_attribution_bn],
                 [story_type_code], [reading_time_minutes], [is_published], [is_active])
            OUTPUT INSERTED.blog_stories_coll_story_id
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, CAST(%s AS NVARCHAR(MAX)), %s, %s, %s, %s, %s)
        """, [
            story_guid, user_profile.user_profile_id, link_blog_stories_ref_story_category_id,
            link_blog_stories_ref_story_age_group_id, story_title_bn, story_title_en, story_slug,
            story_summary_bn, story_content_html_bn, story_source_attribution_bn,
            'text', reading_time_minutes, 1, 1,
        ])
        story_id = cursor.fetchone()[0]

    # Handle cover image if uploaded
    uploaded_file = request.FILES.get('story_cover_image')
    if uploaded_file:
        media_root = os.path.join(settings.MEDIA_ROOT, 'stories', str(story_id))
        os.makedirs(media_root, exist_ok=True)
        asset_guid = str(uuid.uuid4())
        extension = os.path.splitext(uploaded_file.name)[1] or '.jpg'
        file_name = f'{asset_guid}{extension}'
        file_path = os.path.join(media_root, file_name)

        with open(file_path, 'wb') as destination_file:
            for chunk in uploaded_file.chunks():
                destination_file.write(chunk)

        with connection.cursor() as cursor:
            cursor.execute("""
                INSERT INTO [media].[asset]
                    ([asset_guid], [original_file_name], [file_extension], [file_size_bytes], [is_active])
                OUTPUT INSERTED.asset_id
                VALUES (%s, %s, %s, %s, %s)
            """, [asset_guid, uploaded_file.name, extension, uploaded_file.size, 1])
            asset_id = cursor.fetchone()[0]

            cursor.execute("""
                INSERT INTO [blog_stories].[story_asset]
                    ([link_blog_stories_coll_story_id], [link_asset_id], [asset_group_code], [is_cover], [sort_order], [is_active])
                VALUES (%s, %s, %s, %s, %s, %s)
            """, [story_id, asset_id, 'cover', 1, 0, 1])

    # Register in content registry
    try:
        from amolnama_news.site_apps.content.utils import register_content
        content_registry_id = register_content(
            content_category_id=4,  # story
            user_profile_id=user_profile.user_profile_id,
            title_bn=story_title_bn,
            title_en=story_title_en,
            slug=story_slug,
            summary_bn=story_summary_bn,
            content_url=f'/stories-for-kids/{story_slug}/',
            is_published=True,
        )
        if content_registry_id:
            CollStory.objects.filter(blog_stories_coll_story_id=story_id).update(link_content_registry_id=content_registry_id)
    except Exception:
        import logging
        logging.getLogger(__name__).exception('Content registry failed for story %s', story_id)

    return JsonResponse({
        'success': True,
        'story_id': story_id,
        'story_slug': story_slug,
    })


@require_POST
@login_required
def api_story_like_toggle(request, story_id):
    """Toggle like on a story."""
    from amolnama_news.site_apps.user_account.models import UserProfile

    try:
        user_profile = UserProfile.objects.get(link_user_account_user_id=request.user.pk)
    except UserProfile.DoesNotExist:
        return JsonResponse({'success': False, 'error': 'প্রোফাইল পাওয়া যায়নি'}, status=400)

    existing_like = EngagementStoryLike.objects.filter(
        link_blog_stories_coll_story_id=story_id,
        link_user_profile_id=user_profile.user_profile_id,
    ).first()

    if existing_like and existing_like.is_active:
        existing_like.is_active = False
        existing_like.save(update_fields=['is_active'])
        liked = False
    elif existing_like and not existing_like.is_active:
        existing_like.is_active = True
        existing_like.save(update_fields=['is_active'])
        liked = True
    else:
        EngagementStoryLike.objects.create(
            link_blog_stories_coll_story_id=story_id,
            link_user_profile_id=user_profile.user_profile_id,
            is_active=True,
        )
        liked = True

    actual_count = EngagementStoryLike.objects.filter(link_blog_stories_coll_story_id=story_id, is_active=True).count()
    CollStory.objects.filter(blog_stories_coll_story_id=story_id).update(like_count=actual_count)

    return JsonResponse({'success': True, 'liked': liked, 'like_count': actual_count})


@require_POST
@login_required
def api_story_bookmark_toggle(request, story_id):
    """Toggle bookmark on a story."""
    from amolnama_news.site_apps.user_account.models import UserProfile

    try:
        user_profile = UserProfile.objects.get(link_user_account_user_id=request.user.pk)
    except UserProfile.DoesNotExist:
        return JsonResponse({'success': False, 'error': 'প্রোফাইল পাওয়া যায়নি'}, status=400)

    existing_bookmark = EngagementStoryBookmark.objects.filter(
        link_blog_stories_coll_story_id=story_id,
        link_user_profile_id=user_profile.user_profile_id,
    ).first()

    if existing_bookmark and existing_bookmark.is_active:
        existing_bookmark.is_active = False
        existing_bookmark.save(update_fields=['is_active'])
        bookmarked = False
    elif existing_bookmark and not existing_bookmark.is_active:
        existing_bookmark.is_active = True
        existing_bookmark.save(update_fields=['is_active'])
        bookmarked = True
    else:
        EngagementStoryBookmark.objects.create(
            link_blog_stories_coll_story_id=story_id,
            link_user_profile_id=user_profile.user_profile_id,
            is_active=True,
        )
        bookmarked = True

    actual_count = EngagementStoryBookmark.objects.filter(link_blog_stories_coll_story_id=story_id, is_active=True).count()
    CollStory.objects.filter(blog_stories_coll_story_id=story_id).update(bookmark_count=actual_count)

    return JsonResponse({'success': True, 'bookmarked': bookmarked, 'bookmark_count': actual_count})


@require_POST
def api_story_view_increment(request, story_id):
    """Increment view count."""
    CollStory.objects.filter(blog_stories_coll_story_id=story_id).update(view_count=F('view_count') + 1)
    story = CollStory.objects.filter(blog_stories_coll_story_id=story_id).values_list('view_count', flat=True).first()
    return JsonResponse({'success': True, 'view_count': story or 0})
