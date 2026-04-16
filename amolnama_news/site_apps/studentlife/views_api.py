"""Student Life API — JSON endpoints."""

import json
import logging

from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.http import require_POST

from amolnama_news.site_apps.content.models import RefContentSubcategory
from amolnama_news.site_apps.core.utils import english_slug_from_text, get_user_profile_id, sanitize_user_html

from .models import CollCampusEntry

logger = logging.getLogger(__name__)


@login_required
@require_POST
def api_campus_entry_create(request):
    """POST — create a new campus entry."""
    user_profile_id = get_user_profile_id(request)
    if not user_profile_id:
        return JsonResponse({'success': False, 'error': 'প্রোফাইল পাওয়া যায়নি'}, status=400)

    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'success': False, 'error': 'Invalid JSON'}, status=400)

    title_bn = (data.get('campus_entry_title_bn') or '').strip()
    title_en = (data.get('campus_entry_title_en') or '').strip() or None
    if not title_bn:
        return JsonResponse({'success': False, 'error': 'শিরোনাম আবশ্যক'}, status=400)

    category_id = data.get('link_content_ref_content_subcategory_id')
    if category_id:
        category_exists = RefContentSubcategory.objects.filter(
            content_ref_content_subcategory_id=category_id,
            group_code='blog_studentlife_category',
            is_active=True,
        ).exists()
        if not category_exists:
            return JsonResponse({'success': False, 'error': 'Invalid category'}, status=400)

    # Sanitize HTML
    description_bn = data.get('campus_entry_description_bn') or None
    if description_bn:
        description_bn = sanitize_user_html(description_bn)

    description_en = data.get('campus_entry_description_en') or None
    if description_en:
        description_en = sanitize_user_html(description_en)

    # Generate slug
    slug_source = title_bn or title_en
    campus_entry_slug = english_slug_from_text(text_bn=slug_source)

    # Deduplicate slug
    existing_slug_count = CollCampusEntry.objects.filter(campus_entry_slug=campus_entry_slug).count()
    if existing_slug_count > 0:
        campus_entry_slug = f'{campus_entry_slug}-{existing_slug_count + 1}'

    now = timezone.now()
    entry = CollCampusEntry.objects.create(
        link_user_profile_id=user_profile_id,
        campus_entry_title_bn=title_bn,
        campus_entry_title_en=title_en,
        campus_entry_slug=campus_entry_slug,
        campus_entry_short_description_bn=(data.get('campus_entry_short_description_bn') or '').strip() or None,
        campus_entry_short_description_en=(data.get('campus_entry_short_description_en') or '').strip() or None,
        campus_entry_description_bn=description_bn,
        campus_entry_description_en=description_en,
        link_content_ref_content_subcategory_id=category_id or None,
        institution_name_bn=(data.get('institution_name_bn') or '').strip() or None,
        institution_name_en=(data.get('institution_name_en') or '').strip() or None,
        institution_type_code=(data.get('institution_type_code') or '').strip() or None,
        institution_location_bn=(data.get('institution_location_bn') or '').strip() or None,
        cover_image_url=(data.get('cover_image_url') or '').strip() or None,
        campus_entry_status_code='published',
        created_at=now,
    )

    return JsonResponse({
        'success': True,
        'campus_entry_id': entry.blog_studentlife_coll_campus_entry_id,
        'campus_entry_slug': entry.campus_entry_slug,
    })
