"""Biography API — JSON endpoints."""

import json
import logging

from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.http import require_POST

from amolnama_news.site_apps.content.models import RefContentSubcategory
from amolnama_news.site_apps.core.utils import bangla_slugify, get_user_profile_id, sanitize_user_html

from .models import CollBiographyEntry

logger = logging.getLogger(__name__)


@login_required
@require_POST
def api_biography_entry_create(request):
    """POST — create a new biography entry."""
    user_profile_id = get_user_profile_id(request)
    if not user_profile_id:
        return JsonResponse({'success': False, 'error': 'প্রোফাইল পাওয়া যায়নি'}, status=400)

    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'success': False, 'error': 'Invalid JSON'}, status=400)

    title_bn = (data.get('biography_entry_title_bn') or '').strip()
    if not title_bn:
        return JsonResponse({'success': False, 'error': 'শিরোনাম আবশ্যক'}, status=400)

    category_id = data.get('link_content_ref_content_subcategory_id')
    if category_id:
        category_exists = RefContentSubcategory.objects.filter(
            content_ref_content_subcategory_id=category_id,
            group_code='blog_biography_category',
            is_active=True,
        ).exists()
        if not category_exists:
            return JsonResponse({'success': False, 'error': 'Invalid category'}, status=400)

    description_bn = data.get('biography_entry_description_bn') or None
    if description_bn:
        description_bn = sanitize_user_html(description_bn)

    slug_source = title_bn
    biography_entry_slug = bangla_slugify(slug_source)
    existing_slug_count = CollBiographyEntry.objects.filter(biography_entry_slug=biography_entry_slug).count()
    if existing_slug_count > 0:
        biography_entry_slug = f'{biography_entry_slug}-{existing_slug_count + 1}'

    now = timezone.now()
    entry = CollBiographyEntry.objects.create(
        link_user_profile_id=user_profile_id,
        biography_entry_title_bn=title_bn,
        biography_entry_title_en=(data.get('biography_entry_title_en') or '').strip() or None,
        biography_entry_slug=biography_entry_slug,
        biography_entry_short_description_bn=(data.get('biography_entry_short_description_bn') or '').strip() or None,
        biography_entry_description_bn=description_bn,
        link_content_ref_content_subcategory_id=category_id or None,
        subject_full_name_bn=(data.get('subject_full_name_bn') or '').strip() or None,
        subject_full_name_en=(data.get('subject_full_name_en') or '').strip() or None,
        subject_birth_date=data.get('subject_birth_date') or None,
        subject_death_date=data.get('subject_death_date') or None,
        subject_birth_place_bn=(data.get('subject_birth_place_bn') or '').strip() or None,
        subject_nationality_bn=(data.get('subject_nationality_bn') or '').strip() or None,
        subject_occupation_bn=(data.get('subject_occupation_bn') or '').strip() or None,
        subject_known_for_bn=(data.get('subject_known_for_bn') or '').strip() or None,
        is_living_person=data.get('is_living_person', True),
        is_memoriam=data.get('is_memoriam', False),
        cover_image_url=(data.get('cover_image_url') or '').strip() or None,
        biography_entry_status_code='published',
        created_at=now,
    )

    return JsonResponse({
        'success': True,
        'biography_entry_id': entry.blog_biography_coll_biography_entry_id,
        'biography_entry_slug': entry.biography_entry_slug,
    })
