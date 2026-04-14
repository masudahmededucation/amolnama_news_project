"""Probash Barta API — JSON endpoints."""

import json
import logging

from django.db import connection as db_connection

from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.http import require_POST

from amolnama_news.site_apps.content.models import RefContentSubcategory
from amolnama_news.site_apps.core.utils import bangla_slugify, get_user_profile_id, sanitize_user_html

from .models import CollProbashEntry

logger = logging.getLogger(__name__)


@login_required
@require_POST
def api_probash_entry_create(request):
    """POST — create a new probash entry."""
    user_profile_id = get_user_profile_id(request)
    if not user_profile_id:
        return JsonResponse({'success': False, 'error': 'প্রোফাইল পাওয়া যায়নি'}, status=400)

    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'success': False, 'error': 'Invalid JSON'}, status=400)

    title_bn = (data.get('probash_entry_title_bn') or '').strip()
    title_en = (data.get('probash_entry_title_en') or '').strip() or None
    if not title_bn:
        return JsonResponse({'success': False, 'error': 'শিরোনাম আবশ্যক'}, status=400)

    topic_id = data.get('link_content_ref_content_subcategory_id')
    if topic_id:
        topic_exists = RefContentSubcategory.objects.filter(
            content_ref_content_subcategory_id=topic_id,
            group_code='blog_probashbarta_topic',
            is_active=True,
        ).exists()
        if not topic_exists:
            return JsonResponse({'success': False, 'error': 'Invalid topic'}, status=400)

    description_bn = data.get('probash_entry_description_bn') or None
    if description_bn:
        description_bn = sanitize_user_html(description_bn)

    slug_source = title_bn or title_en
    probash_entry_slug = bangla_slugify(slug_source)
    existing_slug_count = CollProbashEntry.objects.filter(probash_entry_slug=probash_entry_slug).count()
    if existing_slug_count > 0:
        probash_entry_slug = f'{probash_entry_slug}-{existing_slug_count + 1}'

    now = timezone.now()
    entry = CollProbashEntry.objects.create(
        link_user_profile_id=user_profile_id,
        probash_entry_title_bn=title_bn,
        probash_entry_title_en=title_en,
        probash_entry_slug=probash_entry_slug,
        probash_entry_short_description_bn=(data.get('probash_entry_short_description_bn') or '').strip() or None,
        probash_entry_description_bn=description_bn,
        link_content_ref_content_subcategory_id=topic_id or None,
        probash_country_code=(data.get('probash_country_code') or '').strip() or None,
        probash_country_name_bn=(data.get('probash_country_name_bn') or '').strip() or None,
        probash_country_name_en=(data.get('probash_country_name_en') or '').strip() or None,
        probash_region_code=(data.get('probash_region_code') or '').strip() or None,
        probash_city_name_bn=(data.get('probash_city_name_bn') or '').strip() or None,
        cover_image_url=(data.get('cover_image_url') or '').strip() or None,
        probash_entry_status_code='published',
        created_at=now,
    )

    return JsonResponse({
        'success': True,
        'probash_entry_id': entry.blog_probashbarta_coll_probash_entry_id,
        'probash_entry_slug': entry.probash_entry_slug,
    })


def api_country_list(request):
    """GET — list countries from [location].[country] for dropdown."""
    try:
        with db_connection.cursor() as cursor:
            cursor.execute("""
                SELECT country_id, country_iso_code, country_name_en, country_name_bn
                FROM [location].[country]
                WHERE is_active = 1
                ORDER BY country_name_en
            """)
            countries = [
                {
                    'country_id': row[0],
                    'country_iso_code': row[1],
                    'country_name_en': row[2],
                    'country_name_bn': row[3],
                }
                for row in cursor.fetchall()
            ]
        return JsonResponse({'success': True, 'countries': countries})
    except Exception as country_list_error:
        logger.exception('Failed to load country list')
        return JsonResponse({'success': False, 'error': str(country_list_error)}, status=500)
