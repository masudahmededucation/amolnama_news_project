"""History BD API — JSON endpoints."""

import json
import logging

from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.http import require_POST

from amolnama_news.site_apps.content.models import RefContentSubcategory
from amolnama_news.site_apps.core.utils import english_slug_from_text, get_user_profile_id, sanitize_user_html

from .models import CollHistoryEvent

logger = logging.getLogger(__name__)


@login_required
@require_POST
def api_history_event_create(request):
    """POST — create a new history event."""
    user_profile_id = get_user_profile_id(request)
    if not user_profile_id:
        return JsonResponse({'success': False, 'error': 'প্রোফাইল পাওয়া যায়নি'}, status=400)

    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'success': False, 'error': 'Invalid JSON'}, status=400)

    title_bn = (data.get('history_event_title_bn') or '').strip()
    if not title_bn:
        return JsonResponse({'success': False, 'error': 'শিরোনাম আবশ্যক'}, status=400)

    era_id = data.get('link_content_ref_content_subcategory_id')
    if era_id:
        era_exists = RefContentSubcategory.objects.filter(
            content_ref_content_subcategory_id=era_id,
            group_code='blog_historybd_era',
            is_active=True,
        ).exists()
        if not era_exists:
            return JsonResponse({'success': False, 'error': 'Invalid era'}, status=400)

    description_bn = data.get('history_event_description_bn') or None
    if description_bn:
        description_bn = sanitize_user_html(description_bn)

    significance_bn = data.get('history_event_significance_bn') or None
    if significance_bn:
        significance_bn = sanitize_user_html(significance_bn)

    slug = english_slug_from_text(text_bn=title_bn)
    existing_slug_count = CollHistoryEvent.objects.filter(history_event_slug=slug).count()
    if existing_slug_count > 0:
        slug = f'{slug}-{existing_slug_count + 1}'

    now = timezone.now()
    entry = CollHistoryEvent.objects.create(
        link_user_profile_id=user_profile_id,
        history_event_title_bn=title_bn,
        history_event_title_en=(data.get('history_event_title_en') or '').strip() or None,
        history_event_slug=slug,
        history_event_short_description_bn=(data.get('history_event_short_description_bn') or '').strip() or None,
        history_event_description_bn=description_bn,
        history_event_significance_bn=significance_bn,
        link_content_ref_content_subcategory_id=era_id or None,
        event_date_start=data.get('event_date_start') or None,
        event_date_end=data.get('event_date_end') or None,
        event_year=data.get('event_year') or None,
        event_era_code=(data.get('event_era_code') or '').strip() or None,
        event_location_bn=(data.get('event_location_bn') or '').strip() or None,
        key_figures_bn=(data.get('key_figures_bn') or '').strip() or None,
        is_turning_point=data.get('is_turning_point', False),
        cover_image_url=(data.get('cover_image_url') or '').strip() or None,
        history_event_status_code='published',
        created_at=now,
    )

    return JsonResponse({
        'success': True,
        'history_event_id': entry.blog_historybd_coll_history_event_id,
        'history_event_slug': entry.history_event_slug,
    })
