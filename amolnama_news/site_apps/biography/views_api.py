"""Biography API — JSON endpoints."""

import json
import logging

from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.http import require_POST

from amolnama_news.site_apps.content.models import RefContentSubcategory
from amolnama_news.site_apps.core.utils import english_slug_from_text, get_user_profile_id, sanitize_user_html

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
    biography_entry_slug = english_slug_from_text(text_bn=slug_source)
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


# =========================================================
# PERSON SEARCH (Tom Select autocomplete)
# =========================================================

def api_biography_person_search(request):
    """GET — search coll_biography_person for Tom Select dropdown.

    Query: ?q=রবীন্দ্র or ?q=Tagore
    Returns: list of matching persons with id, name_bn, name_en, occupation.
    """
    from django.db import connection as db_connection
    from django.db.models import Q

    query = (request.GET.get('q') or '').strip()
    if len(query) < 1:
        return JsonResponse({'success': True, 'persons': []})

    try:
        with db_connection.cursor() as cursor:
            cursor.execute("""
                SELECT TOP 20 blog_biography_coll_biography_person_id,
                       person_name_bn, person_name_en,
                       person_birth_year, person_death_year,
                       person_occupation_bn, person_category_code
                FROM [blog_biography].[coll_biography_person]
                WHERE is_active = 1
                  AND (person_name_bn LIKE %s OR person_name_en LIKE %s)
                ORDER BY person_name_en
            """, [f'%{query}%', f'%{query}%'])
            persons = [
                {
                    'person_id': row[0],
                    'person_name_bn': row[1],
                    'person_name_en': row[2],
                    'person_birth_year': row[3],
                    'person_death_year': row[4],
                    'person_occupation_bn': row[5],
                    'person_category_code': row[6],
                }
                for row in cursor.fetchall()
            ]
        return JsonResponse({'success': True, 'persons': persons})
    except Exception as search_error:
        logger.exception('Biography person search failed')
        return JsonResponse({'success': False, 'error': str(search_error)}, status=500)


# =========================================================
# QUICK-ADD — stub biography + sub-content in one step
# =========================================================

def _get_or_create_stub_biography(person_id, user_profile_id):
    """Get existing biography for person, or create a minimal stub."""
    from django.db import connection as db_connection

    # Check if biography already exists for this person
    existing = CollBiographyEntry.objects.filter(
        link_blog_biography_coll_biography_person_id=person_id,
        is_active=True,
    ).first()
    if existing:
        return existing

    # Get person info from ref table
    with db_connection.cursor() as cursor:
        cursor.execute("""
            SELECT person_name_bn, person_name_en, person_occupation_bn,
                   person_category_code, person_birth_year, person_death_year
            FROM [blog_biography].[coll_biography_person]
            WHERE blog_biography_coll_biography_person_id = %s AND is_active = 1
        """, [person_id])
        row = cursor.fetchone()
        if not row:
            return None

    person_name_bn = row[0]
    person_name_en = row[1]
    person_occupation_bn = row[2]
    person_category_code = row[3]
    person_birth_year = row[4]
    person_death_year = row[5]

    # Find matching subcategory
    from amolnama_news.site_apps.content.models import RefContentSubcategory
    subcategory = RefContentSubcategory.objects.filter(
        group_code='blog_biography_category',
        subcategory_code=person_category_code,
        is_active=True,
    ).first()

    slug = english_slug_from_text(text_bn=person_name_bn or person_name_en)
    existing_slug_count = CollBiographyEntry.objects.filter(biography_entry_slug=slug).count()
    if existing_slug_count > 0:
        slug = f'{slug}-{existing_slug_count + 1}'

    now = timezone.now()
    stub = CollBiographyEntry.objects.create(
        link_user_profile_id=user_profile_id,
        biography_entry_title_bn=person_name_bn,
        biography_entry_title_en=person_name_en,
        biography_entry_slug=slug,
        biography_entry_short_description_bn=person_occupation_bn,
        link_content_ref_content_subcategory_id=subcategory.content_ref_content_subcategory_id if subcategory else None,
        link_blog_biography_coll_biography_person_id=person_id,
        subject_full_name_bn=person_name_bn,
        subject_full_name_en=person_name_en,
        subject_occupation_bn=person_occupation_bn,
        subject_birth_date=None,
        is_living_person=person_death_year is None,
        biography_entry_status_code='published',
        created_at=now,
    )
    return stub


@login_required
@require_POST
def api_biography_quick_add_quote(request):
    """POST — quick-add a quote for a person. Auto-creates stub biography if needed."""
    user_profile_id = get_user_profile_id(request)
    if not user_profile_id:
        return JsonResponse({'success': False, 'error': 'প্রোফাইল পাওয়া যায়নি'}, status=400)

    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'success': False, 'error': 'Invalid JSON'}, status=400)

    person_id = data.get('person_id')
    quote_title_bn = (data.get('quote_title_bn') or '').strip()
    quote_text_bn = (data.get('quote_text_bn') or '').strip()

    if not person_id or not quote_title_bn or not quote_text_bn:
        return JsonResponse({'success': False, 'error': 'ব্যক্তি, শিরোনাম ও উক্তি আবশ্যক'}, status=400)

    biography = _get_or_create_stub_biography(person_id, user_profile_id)
    if not biography:
        return JsonResponse({'success': False, 'error': 'ব্যক্তি পাওয়া যায়নি'}, status=400)

    from django.db import connection as db_connection
    with db_connection.cursor() as cursor:
        cursor.execute("""
            INSERT INTO [blog_biography].[biography_quote]
                (link_blog_biography_coll_biography_entry_id, quote_title_bn,
                 quote_text_bn, quote_text_en, quote_explanation_bn, quote_source_bn, sort_order)
            VALUES (%s, %s, %s, %s, %s, %s, 0)
        """, [
            biography.blog_biography_coll_biography_entry_id,
            quote_title_bn,
            quote_text_bn,
            (data.get('quote_text_en') or '').strip() or None,
            (data.get('quote_explanation_bn') or '').strip() or None,
            (data.get('quote_source_bn') or '').strip() or None,
        ])

    return JsonResponse({
        'success': True,
        'biography_slug': biography.biography_entry_slug,
    })


@login_required
@require_POST
def api_biography_quick_add_youtube(request):
    """POST — quick-add a YouTube link for a person."""
    user_profile_id = get_user_profile_id(request)
    if not user_profile_id:
        return JsonResponse({'success': False, 'error': 'প্রোফাইল পাওয়া যায়নি'}, status=400)

    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'success': False, 'error': 'Invalid JSON'}, status=400)

    person_id = data.get('person_id')
    youtube_url = (data.get('youtube_url') or '').strip()

    if not person_id or not youtube_url:
        return JsonResponse({'success': False, 'error': 'ব্যক্তি ও ভিডিও URL আবশ্যক'}, status=400)

    biography = _get_or_create_stub_biography(person_id, user_profile_id)
    if not biography:
        return JsonResponse({'success': False, 'error': 'ব্যক্তি পাওয়া যায়নি'}, status=400)

    from django.db import connection as db_connection
    with db_connection.cursor() as cursor:
        cursor.execute("""
            INSERT INTO [blog_biography].[biography_entry_youtube_link]
                (link_blog_biography_coll_biography_entry_id, link_user_profile_id,
                 youtube_url, video_title_bn, description_bn, sort_order)
            VALUES (%s, %s, %s, %s, %s, 0)
        """, [
            biography.blog_biography_coll_biography_entry_id,
            user_profile_id,
            youtube_url,
            (data.get('video_title_bn') or '').strip() or None,
            (data.get('description_bn') or '').strip() or None,
        ])

    return JsonResponse({
        'success': True,
        'biography_slug': biography.biography_entry_slug,
    })


@login_required
@require_POST
def api_biography_quick_add_photo(request):
    """POST (multipart) — quick-add a photo for a person."""
    import os
    from django.conf import settings

    user_profile_id = get_user_profile_id(request)
    if not user_profile_id:
        return JsonResponse({'success': False, 'error': 'প্রোফাইল পাওয়া যায়নি'}, status=400)

    person_id = request.POST.get('person_id')
    photo_file = request.FILES.get('photo_file')

    if not person_id or not photo_file:
        return JsonResponse({'success': False, 'error': 'ব্যক্তি ও ছবি আবশ্যক'}, status=400)

    allowed_types = ['image/jpeg', 'image/png', 'image/webp']
    if photo_file.content_type not in allowed_types:
        return JsonResponse({'success': False, 'error': 'শুধু JPG, PNG বা WebP ছবি আপলোড করুন'}, status=400)

    if photo_file.size > 10 * 1024 * 1024:
        return JsonResponse({'success': False, 'error': 'ছবির সাইজ ১০ MB এর বেশি হতে পারবে না'}, status=400)

    biography = _get_or_create_stub_biography(int(person_id), user_profile_id)
    if not biography:
        return JsonResponse({'success': False, 'error': 'ব্যক্তি পাওয়া যায়নি'}, status=400)

    upload_directory = os.path.join(settings.MEDIA_ROOT, 'app_static', 'blogs', 'biography', 'photos')
    os.makedirs(upload_directory, exist_ok=True)

    import uuid
    file_extension = os.path.splitext(photo_file.name)[1].lower()
    saved_filename = f'{uuid.uuid4().hex}{file_extension}'
    saved_filepath = os.path.join(upload_directory, saved_filename)

    with open(saved_filepath, 'wb+') as destination:
        for chunk in photo_file.chunks():
            destination.write(chunk)

    photo_url = f'/media/app_static/blogs/biography/photos/{saved_filename}'
    caption_bn = (request.POST.get('caption_bn') or '').strip() or None
    photo_era_label_bn = (request.POST.get('photo_era_label_bn') or '').strip() or None

    from django.db import connection as db_connection
    with db_connection.cursor() as cursor:
        cursor.execute("""
            INSERT INTO [blog_biography].[biography_entry_photo]
                (link_blog_biography_coll_biography_entry_id, link_user_profile_id,
                 photo_url, caption_bn, photo_era_label_bn, sort_order)
            VALUES (%s, %s, %s, %s, %s, 0)
        """, [
            biography.blog_biography_coll_biography_entry_id,
            user_profile_id,
            photo_url,
            caption_bn,
            photo_era_label_bn,
        ])

    return JsonResponse({
        'success': True,
        'biography_slug': biography.biography_entry_slug,
        'photo_url': photo_url,
    })
