"""Art & Craft API views — create, like, bookmark, comment."""

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

from .models import CollArtwork, EngagementArtworkLike, EngagementArtworkBookmark, EngagementArtworkComment

logger = logging.getLogger(__name__)

IMAGE_EXTENSION_MAP = {
    'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif',
}


@require_POST
@login_required
def api_artwork_create(request):
    """Create a new artwork with photo upload."""
    from amolnama_news.site_apps.user_account.models import UserProfile
    from amolnama_news.site_apps.core.utils import bangla_slugify

    artwork_title_bn = (request.POST.get('artwork_title_bn') or '').strip()
    artwork_title_en = (request.POST.get('artwork_title_en') or '').strip() or None
    artwork_description_bn = (request.POST.get('artwork_description_bn') or '').strip() or None
    artwork_backstory_bn = (request.POST.get('artwork_backstory_bn') or '').strip() or None
    artwork_materials_bn = (request.POST.get('artwork_materials_bn') or '').strip() or None
    artwork_materials_en = (request.POST.get('artwork_materials_en') or '').strip() or None
    artwork_dimensions_en = (request.POST.get('artwork_dimensions_en') or '').strip() or None
    link_art_category_id = request.POST.get('link_art_category_id')
    link_art_medium_id = request.POST.get('link_art_medium_id') or None
    link_art_difficulty_id = request.POST.get('link_art_difficulty_id') or None
    is_tutorial = request.POST.get('is_tutorial') == '1'
    estimated_time_minutes = request.POST.get('estimated_time_minutes') or None

    if not artwork_title_bn:
        return JsonResponse({'success': False, 'error': 'শিল্পকর্মের নাম দিন'}, status=400)
    if not link_art_category_id:
        return JsonResponse({'success': False, 'error': 'বিভাগ নির্বাচন করুন'}, status=400)

    uploaded_files = request.FILES.getlist('artwork_media_files')
    if not uploaded_files:
        return JsonResponse({'success': False, 'error': 'অন্তত একটি ছবি আপলোড করুন'}, status=400)

    try:
        user_profile = UserProfile.objects.get(link_user_account_user_id=request.user.pk)
    except UserProfile.DoesNotExist:
        return JsonResponse({'success': False, 'error': 'প্রোফাইল পাওয়া যায়নি'}, status=400)

    artwork_slug = bangla_slugify(artwork_title_bn)

    # Create artwork via raw SQL (UUID issue with custom db_backend)
    artwork_guid = str(uuid.uuid4())
    with connection.cursor() as cursor:
        cursor.execute("""
            INSERT INTO [blog_art].[coll_artwork]
                ([artwork_guid], [link_user_profile_id], [link_art_category_id], [link_art_medium_id],
                 [link_art_difficulty_id], [artwork_title_bn], [artwork_title_en], [artwork_slug],
                 [artwork_description_bn], [artwork_backstory_bn], [artwork_materials_bn],
                 [artwork_materials_en], [artwork_dimensions_en], [artwork_type_code],
                 [is_tutorial], [estimated_time_minutes], [is_published], [is_active])
            OUTPUT INSERTED.art_coll_artwork_id
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, CAST(%s AS NVARCHAR(MAX)), CAST(%s AS NVARCHAR(MAX)), %s, %s, %s, %s, %s, %s, %s, %s)
        """, [
            artwork_guid, user_profile.user_profile_id, link_art_category_id,
            link_art_medium_id, link_art_difficulty_id, artwork_title_bn, artwork_title_en,
            artwork_slug, artwork_description_bn, artwork_backstory_bn,
            artwork_materials_bn, artwork_materials_en, artwork_dimensions_en,
            'artwork', 1 if is_tutorial else 0, estimated_time_minutes, 1, 1,
        ])
        artwork_id = cursor.fetchone()[0]

    # Upload photos
    media_root = os.path.join(settings.MEDIA_ROOT, 'art', str(artwork_id))
    os.makedirs(media_root, exist_ok=True)

    for file_index, uploaded_file in enumerate(uploaded_files):
        content_type = uploaded_file.content_type or ''
        extension = IMAGE_EXTENSION_MAP.get(content_type, '.jpg')
        asset_guid = str(uuid.uuid4())
        file_name = f'{asset_guid}{extension}'
        file_path = os.path.join(media_root, file_name)
        relative_path = f'/media/art/{artwork_id}/{file_name}'

        with open(file_path, 'wb') as destination_file:
            for chunk in uploaded_file.chunks():
                destination_file.write(chunk)

        # Create asset + link
        with connection.cursor() as cursor:
            cursor.execute("""
                INSERT INTO [media].[asset]
                    ([asset_guid], [original_file_name], [file_extension], [file_size_bytes], [is_active])
                OUTPUT INSERTED.asset_id, INSERTED.file_storage_path
                VALUES (%s, %s, %s, %s, %s)
            """, [asset_guid, uploaded_file.name, extension, uploaded_file.size, 1])
            row = cursor.fetchone()
            asset_id = row[0]

            cursor.execute("""
                INSERT INTO [blog_art].[artwork_asset]
                    ([link_artwork_id], [link_asset_id], [asset_group_code], [is_cover], [sort_order], [is_active])
                VALUES (%s, %s, %s, %s, %s, %s)
            """, [artwork_id, asset_id, 'main', 1 if file_index == 0 else 0, file_index, 1])

    return JsonResponse({
        'success': True,
        'artwork_id': artwork_id,
        'artwork_slug': artwork_slug,
    })


@require_POST
@login_required
def api_artwork_like_toggle(request, artwork_id):
    """Toggle like on an artwork."""
    from amolnama_news.site_apps.user_account.models import UserProfile

    try:
        user_profile = UserProfile.objects.get(link_user_account_user_id=request.user.pk)
    except UserProfile.DoesNotExist:
        return JsonResponse({'success': False, 'error': 'প্রোফাইল পাওয়া যায়নি'}, status=400)

    existing_like = EngagementArtworkLike.objects.filter(
        link_artwork_id=artwork_id,
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
        EngagementArtworkLike.objects.create(
            link_artwork_id=artwork_id,
            link_user_profile_id=user_profile.user_profile_id,
            is_active=True,
        )
        liked = True

    actual_count = EngagementArtworkLike.objects.filter(link_artwork_id=artwork_id, is_active=True).count()
    CollArtwork.objects.filter(art_coll_artwork_id=artwork_id).update(like_count=actual_count)

    return JsonResponse({'success': True, 'liked': liked, 'like_count': actual_count})


@require_POST
@login_required
def api_artwork_bookmark_toggle(request, artwork_id):
    """Toggle bookmark on an artwork."""
    from amolnama_news.site_apps.user_account.models import UserProfile

    try:
        user_profile = UserProfile.objects.get(link_user_account_user_id=request.user.pk)
    except UserProfile.DoesNotExist:
        return JsonResponse({'success': False, 'error': 'প্রোফাইল পাওয়া যায়নি'}, status=400)

    existing_bookmark = EngagementArtworkBookmark.objects.filter(
        link_artwork_id=artwork_id,
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
        EngagementArtworkBookmark.objects.create(
            link_artwork_id=artwork_id,
            link_user_profile_id=user_profile.user_profile_id,
            is_active=True,
        )
        bookmarked = True

    actual_count = EngagementArtworkBookmark.objects.filter(link_artwork_id=artwork_id, is_active=True).count()
    CollArtwork.objects.filter(art_coll_artwork_id=artwork_id).update(bookmark_count=actual_count)

    return JsonResponse({'success': True, 'bookmarked': bookmarked, 'bookmark_count': actual_count})


@require_POST
def api_artwork_view_increment(request, artwork_id):
    """Increment view count."""
    CollArtwork.objects.filter(art_coll_artwork_id=artwork_id).update(view_count=F('view_count') + 1)
    artwork = CollArtwork.objects.filter(art_coll_artwork_id=artwork_id).values_list('view_count', flat=True).first()
    return JsonResponse({'success': True, 'view_count': artwork or 0})


@require_POST
@login_required
def api_artwork_comment_create(request, artwork_id):
    """Create a comment on an artwork."""
    from amolnama_news.site_apps.user_account.models import UserProfile

    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'success': False, 'error': 'Invalid request'}, status=400)

    comment_text_bn = (data.get('comment_text_bn') or '').strip()
    if not comment_text_bn:
        return JsonResponse({'success': False, 'error': 'মন্তব্য লিখুন'}, status=400)

    try:
        user_profile = UserProfile.objects.get(link_user_account_user_id=request.user.pk)
    except UserProfile.DoesNotExist:
        return JsonResponse({'success': False, 'error': 'প্রোফাইল পাওয়া যায়নি'}, status=400)

    EngagementArtworkComment.objects.create(
        link_artwork_id=artwork_id,
        link_user_profile_id=user_profile.user_profile_id,
        comment_text_bn=comment_text_bn,
        is_active=True,
    )

    actual_count = EngagementArtworkComment.objects.filter(link_artwork_id=artwork_id, is_active=True).count()
    CollArtwork.objects.filter(art_coll_artwork_id=artwork_id).update(comment_count=actual_count)

    return JsonResponse({
        'success': True,
        'comment_count': actual_count,
        'author_display_name': user_profile.display_name or 'ব্যবহারকারী',
    })
