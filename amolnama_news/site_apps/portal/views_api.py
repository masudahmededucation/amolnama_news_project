"""Portal API views — avatar upload."""

import hashlib
import os
import uuid

from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.http import require_POST

from amolnama_news.site_apps.user_account.models import UserProfile


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
