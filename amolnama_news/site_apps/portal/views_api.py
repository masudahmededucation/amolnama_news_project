"""Portal API views — avatar upload, content status management."""

import hashlib
import json
import logging
import os
import uuid

from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.http import require_POST

from amolnama_news.site_apps.user_account.models import UserProfile

logger = logging.getLogger(__name__)


@require_POST
@login_required
def api_avatar_upload(request):
    """Upload cropped avatar image → save to media/ + media.asset + link to profile."""
    from django.conf import settings
    from django.db import connection

    uploaded_file = request.FILES.get('avatar_image')
    if not uploaded_file:
        return JsonResponse({'success': False, 'error': 'ছবি পাওয়া যায়নি'}, status=400)

    if uploaded_file.size > 5 * 1024 * 1024:
        return JsonResponse({'success': False, 'error': 'ছবি ৫MB এর বেশি হতে পারবে না'}, status=400)

    if uploaded_file.content_type not in ('image/jpeg', 'image/png', 'image/webp'):
        return JsonResponse({'success': False, 'error': 'শুধুমাত্র JPG, PNG বা WebP'}, status=400)

    try:
        user_profile = UserProfile.objects.get(link_user_account_user_id=request.user.pk)
    except UserProfile.DoesNotExist:
        return JsonResponse({'success': False, 'error': 'প্রোফাইল পাওয়া যায়নি'}, status=400)

    file_content = uploaded_file.read()
    sha256_hash = hashlib.sha256(file_content).digest()
    file_size = len(file_content)

    extension_map = {
        'image/jpeg': '.jpg',
        'image/png': '.png',
        'image/webp': '.webp',
    }
    file_extension = extension_map.get(uploaded_file.content_type, '.jpg')

    asset_guid = uuid.uuid4()
    with connection.cursor() as cursor:
        cursor.execute("""
            INSERT INTO [media].[asset]
                ([asset_guid], [file_original_name], [file_extension], [file_mime_type],
                 [file_size_bytes], [hash_sha256], [hash_algorithm_used], [hash_is_verified], [is_active])
            OUTPUT INSERTED.asset_id, INSERTED.file_storage_path
            VALUES (%s, %s, %s, %s, %s, %s, %s, 1, 1)
        """, [
            str(asset_guid),
            uploaded_file.name or 'avatar.jpg',
            file_extension,
            uploaded_file.content_type,
            file_size,
            sha256_hash,
            'sha256',
        ])
        row = cursor.fetchone()
        asset_id = row[0]
        file_storage_path = row[1]

    media_root = settings.MEDIA_ROOT
    full_path = os.path.join(media_root, file_storage_path)
    os.makedirs(os.path.dirname(full_path), exist_ok=True)

    with open(full_path, 'wb') as destination_file:
        destination_file.write(file_content)

    user_profile.link_avatar_asset_id = asset_id
    user_profile.updated_at = timezone.now()
    user_profile.save(update_fields=['link_avatar_asset_id', 'updated_at'])

    avatar_url = '/media/' + file_storage_path

    return JsonResponse({'success': True, 'avatar_url': avatar_url})


@require_POST
@login_required
def api_content_toggle_publish(request):
    """Toggle publish status of any content item. Staff only."""
    if not request.user.is_staff:
        return JsonResponse({'success': False, 'error': 'Permission denied'}, status=403)

    try:
        data = json.loads(request.body)
    except (json.JSONDecodeError, ValueError):
        return JsonResponse({'success': False, 'error': 'Invalid request'}, status=400)

    content_type = data.get('content_type', '')
    content_id = data.get('content_id')
    publish = data.get('publish', False)

    if not content_type or not content_id:
        return JsonResponse({'success': False, 'error': 'Missing content_type or content_id'}, status=400)

    try:
        if content_type == 'newshub':
            from amolnama_news.site_apps.newshub.models import PubArticle
            item = PubArticle.objects.get(pub_article_id=content_id)
            item.is_published = publish
            item.save(update_fields=['is_published'])

        elif content_type == 'poem':
            from amolnama_news.site_apps.poem.models import CollPoemEntry
            item = CollPoemEntry.objects.get(poem_coll_poem_entry_id=content_id)
            item.poem_status_code = 'published' if publish else 'draft'
            item.save(update_fields=['poem_status_code'])

        elif content_type == 'stories':
            from amolnama_news.site_apps.stories.models import CollStory
            item = CollStory.objects.get(stories_coll_story_id=content_id)
            item.is_published = publish
            item.save(update_fields=['is_published'])

        elif content_type == 'art':
            from amolnama_news.site_apps.art.models import CollArtwork
            item = CollArtwork.objects.get(art_coll_artwork_id=content_id)
            item.is_published = publish
            item.save(update_fields=['is_published'])

        elif content_type == 'travel':
            from amolnama_news.site_apps.bangladesh.models import CollDestination
            item = CollDestination.objects.get(bangladesh_coll_destination_id=content_id)
            item.destination_status = 'published' if publish else 'draft'
            item.save(update_fields=['destination_status'])

        else:
            return JsonResponse({'success': False, 'error': f'Unknown content type: {content_type}'}, status=400)

    except Exception as error:
        logger.exception('Failed to toggle publish for %s/%s: %s', content_type, content_id, error)
        return JsonResponse({'success': False, 'error': 'Failed to update status'}, status=500)

    status_label = 'Published' if publish else 'Draft'
    return JsonResponse({'success': True, 'is_published': publish, 'status_label': status_label})


@require_POST
@login_required
def api_moderation_approve(request):
    """Approve flagged content — clear flag counts. Staff only."""
    if not request.user.is_staff:
        return JsonResponse({'success': False, 'error': 'Permission denied'}, status=403)

    try:
        data = json.loads(request.body)
    except (json.JSONDecodeError, ValueError):
        return JsonResponse({'success': False, 'error': 'Invalid request'}, status=400)

    content_type = data.get('content_type', '')
    content_id = data.get('content_id')

    try:
        if content_type == 'debate_post':
            from amolnama_news.site_apps.debate.models import CollPost as DebatePost
            post = DebatePost.objects.get(debate_coll_post_id=content_id)
            post.fact_check_flag_count = 0
            post.is_fact_check_needed = False
            post.save(update_fields=['fact_check_flag_count', 'is_fact_check_needed'])
        elif content_type == 'auto_flagged_post':
            from amolnama_news.site_apps.post.models import Post
            post = Post.objects.get(post_post_id=content_id)
            post.is_auto_flagged = False
            post.is_published = True
            post.save(update_fields=['is_auto_flagged', 'is_published'])
        elif content_type == 'post_flag':
            from amolnama_news.site_apps.post.models import PostFlag
            PostFlag.objects.filter(link_post_id=content_id, is_active=True).update(is_active=False)
        else:
            return JsonResponse({'success': False, 'error': 'Unknown content type'}, status=400)
    except Exception as error:
        logger.exception('Moderation approve failed: %s', error)
        return JsonResponse({'success': False, 'error': 'Approve failed'}, status=500)

    return JsonResponse({'success': True})


@require_POST
@login_required
def api_moderation_reject(request):
    """Reject flagged content — soft delete. Staff only."""
    if not request.user.is_staff:
        return JsonResponse({'success': False, 'error': 'Permission denied'}, status=403)

    try:
        data = json.loads(request.body)
    except (json.JSONDecodeError, ValueError):
        return JsonResponse({'success': False, 'error': 'Invalid request'}, status=400)

    content_type = data.get('content_type', '')
    content_id = data.get('content_id')

    try:
        if content_type == 'debate_post':
            from amolnama_news.site_apps.debate.models import CollPost as DebatePost
            post = DebatePost.objects.get(debate_coll_post_id=content_id)
            post.is_deleted = True
            post.deleted_at = timezone.now()
            post.save(update_fields=['is_deleted', 'deleted_at'])
        elif content_type in ('auto_flagged_post', 'post_flag'):
            from amolnama_news.site_apps.post.models import Post
            post = Post.objects.get(post_post_id=content_id)
            post.is_active = False
            post.is_published = False
            post.save(update_fields=['is_active', 'is_published'])
        else:
            return JsonResponse({'success': False, 'error': 'Unknown content type'}, status=400)
    except Exception as error:
        logger.exception('Moderation reject failed: %s', error)
        return JsonResponse({'success': False, 'error': 'Reject failed'}, status=500)

    return JsonResponse({'success': True})


# =========================================================
# PLACEHOLDER MANAGEMENT (staff only)
# =========================================================

@require_POST
@login_required
def api_placeholder_add(request):
    """Add a new composer placeholder."""
    if not request.user.is_staff:
        return JsonResponse({'success': False, 'error': 'অনুমতি নেই'}, status=403)

    try:
        data = json.loads(request.body)
    except (json.JSONDecodeError, ValueError):
        return JsonResponse({'success': False, 'error': 'Invalid request'}, status=400)

    text = (data.get('placeholder_text') or '').strip()
    category = (data.get('placeholder_category_code') or 'general').strip()

    if not text or len(text) < 5:
        return JsonResponse({'success': False, 'error': 'প্লেসহোল্ডার কমপক্ষে ৫ অক্ষর হতে হবে'}, status=400)

    from amolnama_news.site_apps.core.utils import get_user_profile_id
    user_profile_id = get_user_profile_id(request)

    from django.db import connection
    with connection.cursor() as cursor:
        cursor.execute("""
            INSERT INTO [post].[ref_composer_placeholder] ([placeholder_text], [placeholder_category_code], [link_user_profile_id])
            OUTPUT INSERTED.post_ref_composer_placeholder_id
            VALUES (%s, %s, %s)
        """, [text, category, user_profile_id])
        placeholder_id = cursor.fetchone()[0]

    return JsonResponse({'success': True, 'placeholder_id': placeholder_id})


@require_POST
@login_required
def api_placeholder_toggle(request):
    """Toggle active/inactive on a placeholder."""
    if not request.user.is_staff:
        return JsonResponse({'success': False, 'error': 'অনুমতি নেই'}, status=403)

    try:
        data = json.loads(request.body)
    except (json.JSONDecodeError, ValueError):
        return JsonResponse({'success': False, 'error': 'Invalid request'}, status=400)

    try:
        placeholder_id = int(data.get('placeholder_id', 0))
    except (ValueError, TypeError):
        return JsonResponse({'success': False, 'error': 'Invalid ID'}, status=400)

    from amolnama_news.site_apps.post.models import RefComposerPlaceholder
    placeholder = RefComposerPlaceholder.objects.filter(post_ref_composer_placeholder_id=placeholder_id).first()
    if not placeholder:
        return JsonResponse({'success': False, 'error': 'পাওয়া যায়নি'}, status=404)

    new_value = not placeholder.is_active
    RefComposerPlaceholder.objects.filter(
        post_ref_composer_placeholder_id=placeholder_id
    ).update(is_active=new_value)

    return JsonResponse({'success': True, 'is_active': new_value})


@require_POST
@login_required
def api_placeholder_feature(request):
    """Set a placeholder as featured for X minutes."""
    if not request.user.is_staff:
        return JsonResponse({'success': False, 'error': 'অনুমতি নেই'}, status=403)

    try:
        data = json.loads(request.body)
    except (json.JSONDecodeError, ValueError):
        return JsonResponse({'success': False, 'error': 'Invalid request'}, status=400)

    try:
        placeholder_id = int(data.get('placeholder_id', 0))
        duration_minutes = int(data.get('duration_minutes', 30))
    except (ValueError, TypeError):
        return JsonResponse({'success': False, 'error': 'Invalid data'}, status=400)

    from django.utils import timezone
    from amolnama_news.site_apps.post.models import RefComposerPlaceholder

    is_featured = data.get('is_featured', True)

    # Clear any existing featured
    RefComposerPlaceholder.objects.all().update(is_featured=False)

    if is_featured:
        RefComposerPlaceholder.objects.filter(
            post_ref_composer_placeholder_id=placeholder_id
        ).update(
            is_featured=True,
            featured_start_at=timezone.now(),
            featured_duration_minutes=duration_minutes,
        )

    return JsonResponse({'success': True, 'is_featured': is_featured})


@require_POST
@login_required
def api_placeholder_delete(request):
    """Hard delete a placeholder."""
    if not request.user.is_staff:
        return JsonResponse({'success': False, 'error': 'অনুমতি নেই'}, status=403)

    try:
        data = json.loads(request.body)
    except (json.JSONDecodeError, ValueError):
        return JsonResponse({'success': False, 'error': 'Invalid request'}, status=400)

    try:
        placeholder_id = int(data.get('placeholder_id', 0))
    except (ValueError, TypeError):
        return JsonResponse({'success': False, 'error': 'Invalid ID'}, status=400)

    from amolnama_news.site_apps.post.models import RefComposerPlaceholder
    RefComposerPlaceholder.objects.filter(
        post_ref_composer_placeholder_id=placeholder_id
    ).delete()

    return JsonResponse({'success': True})
