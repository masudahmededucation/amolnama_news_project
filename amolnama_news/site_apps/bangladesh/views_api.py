"""Bangladesh app — JSON API endpoints."""

import json
import logging

logger = logging.getLogger(__name__)
from amolnama_news.site_apps.core.utils import time_ago as _time_ago
from amolnama_news.site_apps.core.utils import get_user_profile_id as _get_user_profile_id
import os
import re
import uuid

from django.conf import settings
from django.db.models import Q
from django.http import JsonResponse
from django.utils import timezone
from amolnama_news.site_apps.core.utils import bangla_slugify
from django.views.decorators.http import require_GET, require_POST, require_http_methods

from .models import (
    CollDestination, RefSeason,
    CollMediaEntry,
    DestinationPhoto, DestinationYoutubeLink, DestinationReferenceLink,
    EngagementDestinationReview, EngagementDestinationPhotoLike, EngagementDestinationVideoLike,
)


PAGE_SIZE = 12

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp"}
ALLOWED_VIDEO_TYPES = {"video/mp4", "video/quicktime", "video/webm"}
MAX_VIDEO_SIZE = 50 * 1024 * 1024  # 50MB
MAX_VIDEO_DURATION = 40  # seconds


def _sanitize_html(html):
    """Strip dangerous tags/attributes from rich text HTML. Allow safe formatting only."""
    if not html:
        return html
    # Remove script/style/iframe/object/embed tags and their content
    html = re.sub(r'<(script|style|iframe|object|embed|form)[^>]*>.*?</\1>', '', html, flags=re.DOTALL | re.IGNORECASE)
    html = re.sub(r'<(script|style|iframe|object|embed|form)[^>]*/>', '', html, flags=re.IGNORECASE)
    # Remove on* event attributes (onclick, onerror, etc.)
    html = re.sub(r'\s+on\w+\s*=\s*["\'][^"\']*["\']', '', html, flags=re.IGNORECASE)
    html = re.sub(r'\s+on\w+\s*=\s*\S+', '', html, flags=re.IGNORECASE)
    # Remove javascript: URLs
    html = re.sub(r'href\s*=\s*["\']javascript:[^"\']*["\']', 'href="#"', html, flags=re.IGNORECASE)
    return html.strip()




# ============================================================================
# TRAVEL HUB APIs
# ============================================================================

@require_GET
def api_destination_list(request):
    """GET /bangladesh/api/destinations/ — paginated destination list."""
    try:
        page = int(request.GET.get("page", 1))
    except (ValueError, TypeError):
        page = 1
    category = request.GET.get("category", "").strip()
    season = request.GET.get("season", "").strip()
    search_query = request.GET.get("q", "").strip()

    queryset = CollDestination.objects.filter(destination_status="published").order_by("-is_featured", "-created_at")

    if category:
        queryset = queryset.filter(link_content_ref_content_subcategory_id=int(category))
    if season:
        queryset = queryset.filter(link_blog_bangladesh_ref_season_id=int(season))
    if search_query:
        queryset = queryset.filter(
            Q(destination_name_bn__icontains=search_query)
            | Q(destination_name_en__icontains=search_query)
            | Q(destination_short_description_bn__icontains=search_query)
            | Q(destination_short_description_en__icontains=search_query)
        )

    offset = (page - 1) * PAGE_SIZE
    items = list(queryset[offset: offset + PAGE_SIZE + 1])
    has_next = len(items) > PAGE_SIZE
    items = items[:PAGE_SIZE]

    from amolnama_news.site_apps.content.models import RefContentSubcategory
    subcategory_map = {c.content_ref_content_subcategory_id: c for c in RefContentSubcategory.objects.filter(group_code='blog_bangladesh_destination_category', is_active=True)}
    result = []
    for destination in items:
        destination_category = subcategory_map.get(destination.link_content_ref_content_subcategory_id)
        result.append({
            "id": destination.blog_bangladesh_coll_destination_id,
            "slug": destination.destination_slug or "",
            "name_bn": destination.destination_name_bn,
            "name_en": destination.destination_name_en,
            "short_desc_bn": destination.destination_short_description_bn or "",
            "short_desc_en": destination.destination_short_description_en or "",
            "cover_image": destination.cover_image_url or "",
            "category_name_bn": destination_category.subcategory_name_bn if destination_category else "",
            "category_icon": destination_category.subcategory_icon if destination_category else "",
            "avg_rating": float(destination.avg_rating) if destination.avg_rating else None,
            "review_count": destination.review_count,
            "view_count": destination.view_count,
            "is_featured": destination.is_featured,
            "time_ago": _time_ago(destination.created_at),
        })

    return JsonResponse({"destinations": result, "has_next": has_next})


@require_POST
def api_destination_create(request):
    """POST /bangladesh/api/destinations/create/ — create a destination."""
    if not request.user.is_authenticated:
        return JsonResponse({"success": False, "error": "Login required"}, status=401)

    profile_id = _get_user_profile_id(request)
    if not profile_id:
        return JsonResponse({"success": False, "error": "User profile not found"}, status=400)

    try:
        data = json.loads(request.body)
    except (json.JSONDecodeError, ValueError):
        return JsonResponse({"success": False, "error": "Invalid JSON"}, status=400)

    name_bn = (data.get("destination_name_bn") or "").strip()
    name_en = (data.get("destination_name_en") or "").strip()
    if not name_bn and not name_en:
        return JsonResponse({"success": False, "error": "Destination name is required"}, status=400)

    category_id = data.get("link_content_ref_content_subcategory_id") or data.get("link_blog_bangladesh_ref_destination_category_id")
    if not category_id:
        return JsonResponse({"success": False, "error": "Category is required"}, status=400)

    from amolnama_news.site_apps.content.models import RefContentSubcategory
    if not RefContentSubcategory.objects.filter(
        content_ref_content_subcategory_id=category_id, group_code='blog_bangladesh_destination_category', is_active=True
    ).exists():
        return JsonResponse({"success": False, "error": "Invalid category"}, status=400)

    dest = CollDestination.objects.create(
        link_user_profile_id=profile_id,
        link_content_ref_content_subcategory_id=category_id,
        link_blog_bangladesh_ref_season_id=data.get("link_blog_bangladesh_ref_season_id") or None,
        link_division_id=data.get("link_division_id") or None,
        link_district_id=data.get("link_district_id") or None,
        link_upazila_id=data.get("link_upazila_id") or None,
        destination_name_en=name_en or name_bn,
        destination_name_bn=name_bn or name_en,
        destination_description_en=_sanitize_html((data.get("destination_description_en") or "").strip()) or None,
        destination_description_bn=_sanitize_html((data.get("destination_description_bn") or "").strip()) or None,
        destination_short_description_en=_sanitize_html((data.get("destination_short_description_en") or "").strip()) or None,
        destination_short_description_bn=_sanitize_html((data.get("destination_short_description_bn") or "").strip()) or None,
        destination_latitude=data.get("destination_latitude") or None,
        destination_longitude=data.get("destination_longitude") or None,
        map_formatted_address_bn=(data.get("map_formatted_address_bn") or "").strip() or None,
        entry_fee_bdt=data.get("entry_fee_bdt") or None,
        entry_fee_note_bn=(data.get("entry_fee_note_bn") or "").strip() or None,
        visiting_hours_en=(data.get("visiting_hours_en") or "").strip() or None,
        visiting_hours_bn=(data.get("visiting_hours_bn") or "").strip() or None,
        difficulty_level=(data.get("difficulty_level") or "").strip() or None,
        cover_image_url=(data.get("cover_image_url") or "").strip() or None,
        destination_status="published",
        is_featured=False,
        like_count=0,
        view_count=0,
        review_count=0,
        created_at=timezone.now(),
    )

    # Generate SEO slug
    _generate_destination_slug(dest)

    # Register in content registry (subcategory already set in create)
    from amolnama_news.site_apps.content.utils import register_content
    try:
        content_registry_id = register_content(
            content_category_id=6,  # destination
            user_profile_id=profile_id,
            title_bn=dest.destination_name_bn,
            title_en=dest.destination_name_en,
            slug=dest.destination_slug,
            summary_bn=(dest.destination_short_description_bn or dest.destination_description_bn or '')[:500] or None,
            content_url=f'/bangladesh-tourist-destinations/travel/{dest.destination_slug}/',
            subcategory_id=category_id,
            is_published=True,
        )
        if content_registry_id:
            CollDestination.objects.filter(blog_bangladesh_coll_destination_id=dest.blog_bangladesh_coll_destination_id).update(
                link_content_registry_id=content_registry_id
            )
    except Exception:
        logger.exception('Content registry failed for destination %s', dest.blog_bangladesh_coll_destination_id)

    return JsonResponse({"success": True, "destination_id": dest.blog_bangladesh_coll_destination_id, "destination_slug": dest.destination_slug or ""})


def _generate_destination_slug(dest):
    """Generate URL slug from destination name. Called on create and update."""
    base_name = dest.destination_name_en or dest.destination_name_bn or ""
    slug = bangla_slugify(base_name)
    if not slug:
        slug = str(dest.blog_bangladesh_coll_destination_id)
    candidate = slug
    counter = 1
    while CollDestination.objects.filter(destination_slug=candidate).exclude(
        blog_bangladesh_coll_destination_id=dest.blog_bangladesh_coll_destination_id
    ).exists():
        candidate = f"{slug}-{counter}"
        counter += 1
    dest.destination_slug = candidate
    dest.save(update_fields=["destination_slug"])


@require_POST
def api_destination_update(request, destination_id):
    """POST /bangladesh/api/destinations/<id>/update/ — update a destination."""
    if not request.user.is_authenticated:
        return JsonResponse({"success": False, "error": "Login required"}, status=401)

    profile_id = _get_user_profile_id(request)
    if not profile_id:
        return JsonResponse({"success": False, "error": "User profile not found"}, status=400)

    try:
        dest = CollDestination.objects.get(blog_bangladesh_coll_destination_id=destination_id)
    except CollDestination.DoesNotExist:
        return JsonResponse({"success": False, "error": "Destination not found"}, status=404)

    # Permission: owner or staff
    if not (request.user.is_staff or request.user.is_superuser or dest.link_user_profile_id == profile_id):
        return JsonResponse({"success": False, "error": "অনুমতি নেই"}, status=403)

    try:
        data = json.loads(request.body)
    except (json.JSONDecodeError, ValueError):
        return JsonResponse({"success": False, "error": "Invalid JSON"}, status=400)

    name_bn = (data.get("destination_name_bn") or "").strip()
    name_en = (data.get("destination_name_en") or "").strip()
    if not name_bn and not name_en:
        return JsonResponse({"success": False, "error": "Destination name is required"}, status=400)

    category_id = data.get("link_content_ref_content_subcategory_id") or data.get("link_blog_bangladesh_ref_destination_category_id")
    if not category_id:
        return JsonResponse({"success": False, "error": "Category is required"}, status=400)

    dest.link_content_ref_content_subcategory_id = category_id
    dest.link_blog_bangladesh_ref_season_id = data.get("link_blog_bangladesh_ref_season_id") or None
    dest.destination_name_bn = name_bn or name_en
    dest.destination_name_en = name_en or name_bn
    dest.destination_description_bn = _sanitize_html((data.get("destination_description_bn") or "").strip()) or None
    dest.destination_short_description_bn = _sanitize_html((data.get("destination_short_description_bn") or "").strip()) or None
    dest.difficulty_level = (data.get("difficulty_level") or "").strip() or None
    dest.entry_fee_bdt = data.get("entry_fee_bdt") or None
    dest.visiting_hours_bn = (data.get("visiting_hours_bn") or "").strip() or None
    dest.updated_at = timezone.now()
    dest.save()

    # Regenerate slug if name changed
    _generate_destination_slug(dest)

    return JsonResponse({"success": True, "destination_id": dest.blog_bangladesh_coll_destination_id})


# ============================================================================
# BEAUTY OF BANGLADESH APIs
# ============================================================================

@require_GET
def api_media_list(request):
    """GET /bangladesh/api/media/ — paginated media gallery."""
    try:
        page = int(request.GET.get("page", 1))
    except (ValueError, TypeError):
        page = 1
    category = request.GET.get("category", "").strip()
    media_type = request.GET.get("type", "").strip()
    season = request.GET.get("season", "").strip()
    search_query = request.GET.get("q", "").strip()

    queryset = CollMediaEntry.objects.filter(
        media_status="published", visibility="public"
    ).order_by("-created_at")

    if category:
        queryset = queryset.filter(link_content_ref_content_subcategory_id=int(category))
    if media_type in ("photo", "video"):
        queryset = queryset.filter(media_type=media_type)
    if season:
        queryset = queryset.filter(link_season_id=int(season))
    if search_query:
        queryset = queryset.filter(
            Q(media_title_bn__icontains=search_query)
            | Q(media_title_en__icontains=search_query)
            | Q(location_name_bn__icontains=search_query)
            | Q(location_name_en__icontains=search_query)
        )

    offset = (page - 1) * PAGE_SIZE
    items = list(queryset[offset: offset + PAGE_SIZE + 1])
    has_next = len(items) > PAGE_SIZE
    items = items[:PAGE_SIZE]

    from amolnama_news.site_apps.content.models import RefContentSubcategory
    category_map = {c.content_ref_content_subcategory_id: c for c in RefContentSubcategory.objects.filter(group_code='blog_bangladesh_media_category', is_active=True)}
    result = []
    for media_entry in items:
        media_category = category_map.get(media_entry.link_content_ref_content_subcategory_id)
        result.append({
            "id": media_entry.blog_bangladesh_coll_media_entry_id,
            "title_bn": media_entry.media_title_bn or "",
            "title_en": media_entry.media_title_en or "",
            "display_title": media_entry.media_title_bn or media_entry.media_title_en or "",
            "media_type": media_entry.media_type,
            "thumbnail_url": media_entry.file_thumbnail_url or media_entry.file_display_url or media_entry.file_original_url,
            "category_name_bn": media_category.subcategory_name_bn if media_category else "",
            "category_icon": media_category.subcategory_icon if media_category else "",
            "location_bn": media_entry.location_name_bn or "",
            "like_count": media_entry.like_count,
            "view_count": media_entry.view_count,
            "camera": media_entry.exif_camera_model or "",
            "time_ago": _time_ago(media_entry.created_at),
        })

    return JsonResponse({"entries": result, "has_next": has_next})


@require_POST
def api_media_upload(request):
    """POST /bangladesh/api/media/upload/ — upload photo/video."""
    if not request.user.is_authenticated:
        return JsonResponse({"success": False, "error": "Login required"}, status=401)

    profile_id = _get_user_profile_id(request)
    if not profile_id:
        return JsonResponse({"success": False, "error": "User profile not found"}, status=400)

    uploaded_file = request.FILES.get("file")
    if not uploaded_file:
        return JsonResponse({"success": False, "error": "No file uploaded"}, status=400)

    mime_type = uploaded_file.content_type
    if mime_type in ALLOWED_IMAGE_TYPES:
        media_type = "photo"
    elif mime_type in ALLOWED_VIDEO_TYPES:
        media_type = "video"
        if uploaded_file.size > MAX_VIDEO_SIZE:
            return JsonResponse({"success": False, "error": f"Video must be under {MAX_VIDEO_SIZE // (1024*1024)}MB"}, status=400)
    else:
        return JsonResponse({"success": False, "error": "Unsupported file type. Use JPEG, PNG, WebP, MP4, MOV, or WebM."}, status=400)

    category_id = request.POST.get("link_content_ref_content_subcategory_id")
    if not category_id:
        return JsonResponse({"success": False, "error": "Category is required"}, status=400)

    # Save file
    ext = os.path.splitext(uploaded_file.name)[1].lower()
    filename = f"{uuid.uuid4().hex}{ext}"
    upload_dir = os.path.join(settings.MEDIA_ROOT, "upload", "bangladesh", media_type)
    os.makedirs(upload_dir, exist_ok=True)
    filepath = os.path.join(upload_dir, filename)

    with open(filepath, "wb") as f:
        for chunk in uploaded_file.chunks():
            f.write(chunk)

    file_url = f"/media/upload/bangladesh/{media_type}/{filename}"

    entry = CollMediaEntry.objects.create(
        link_user_profile_id=profile_id,
        link_content_ref_content_subcategory_id=int(category_id),
        link_season_id=int(request.POST.get("link_season_id")) if request.POST.get("link_season_id") else None,
        media_title_bn=(request.POST.get("media_title_bn") or "").strip() or None,
        media_title_en=(request.POST.get("media_title_en") or "").strip() or None,
        media_description_bn=_sanitize_html((request.POST.get("media_description_bn") or "").strip()) or None,
        media_type=media_type,
        file_original_url=file_url,
        file_display_url=file_url,
        file_thumbnail_url=file_url,
        file_size_bytes=uploaded_file.size,
        file_mime_type=mime_type,
        exif_camera_make=(request.POST.get("exif_camera_make") or "").strip() or None,
        exif_camera_model=(request.POST.get("exif_camera_model") or "").strip() or None,
        location_name_bn=(request.POST.get("location_name_bn") or "").strip() or None,
        location_name_en=(request.POST.get("location_name_en") or "").strip() or None,
        time_of_day=(request.POST.get("time_of_day") or "").strip() or None,
        event_date_from=request.POST.get("event_date_from") or None,
        event_date_to=request.POST.get("event_date_to") or None,
        is_yearly_event=request.POST.get("is_yearly_event") == "1",
        visibility="public",
        media_status="published",
        like_count=0,
        view_count=0,
        comment_count=0,
        created_at=timezone.now(),
    )

    return JsonResponse({"success": True, "media_id": entry.blog_bangladesh_coll_media_entry_id})


# ============================================================================
# TRAVEL HUB — DESTINATION COMMUNITY CONTRIBUTIONS
# ============================================================================

@require_POST
def api_destination_photo_upload(request, destination_id):
    """POST — upload a photo for a destination."""
    if not request.user.is_authenticated:
        return JsonResponse({"success": False, "error": "Login required"}, status=401)

    profile_id = _get_user_profile_id(request)
    if not profile_id:
        return JsonResponse({"success": False, "error": "User profile not found"}, status=400)

    # Verify destination exists
    if not CollDestination.objects.filter(blog_bangladesh_coll_destination_id=destination_id).exists():
        return JsonResponse({"success": False, "error": "Destination not found"}, status=404)

    uploaded_file = request.FILES.get("file")
    if not uploaded_file:
        return JsonResponse({"success": False, "error": "No file uploaded"}, status=400)

    mime_type = uploaded_file.content_type
    if mime_type not in ALLOWED_IMAGE_TYPES:
        return JsonResponse({"success": False, "error": "Only JPEG, PNG, WebP images allowed."}, status=400)

    # Save file
    ext = os.path.splitext(uploaded_file.name)[1].lower()
    filename = f"{uuid.uuid4().hex}{ext}"
    upload_dir = os.path.join(settings.MEDIA_ROOT, "upload", "bangladesh", "destination-photo")
    os.makedirs(upload_dir, exist_ok=True)
    filepath = os.path.join(upload_dir, filename)

    with open(filepath, "wb") as f:
        for chunk in uploaded_file.chunks():
            f.write(chunk)

    file_url = f"/media/upload/bangladesh/destination-photo/{filename}"
    caption = (request.POST.get("caption_bn") or "").strip() or None

    # Get next sort_order
    last_order = DestinationPhoto.objects.filter(
        link_blog_bangladesh_coll_destination_id=destination_id
    ).order_by("-sort_order").values_list("sort_order", flat=True).first()
    next_order = (last_order or 0) + 1

    photo = DestinationPhoto.objects.create(
        link_blog_bangladesh_coll_destination_id=destination_id,
        link_user_profile_id=profile_id,
        photo_url=file_url,
        caption_bn=caption,
        sort_order=next_order,
        is_cover=False,
        created_at=timezone.now(),
    )

    # Auto-set as cover image if the destination doesn't have one yet
    CollDestination.objects.filter(
        blog_bangladesh_coll_destination_id=destination_id,
        cover_image_url__isnull=True,
    ).update(cover_image_url=file_url)
    # Also cover empty string
    CollDestination.objects.filter(
        blog_bangladesh_coll_destination_id=destination_id,
        cover_image_url="",
    ).update(cover_image_url=file_url)

    return JsonResponse({
        "success": True,
        "photo_id": photo.blog_bangladesh_destination_photo_id,
        "photo_url": file_url,
        "caption_bn": caption or "",
    })


@require_POST
def api_destination_youtube_link_add(request, destination_id):
    """POST — add a YouTube link for a destination."""
    if not request.user.is_authenticated:
        return JsonResponse({"success": False, "error": "Login required"}, status=401)

    profile_id = _get_user_profile_id(request)
    if not profile_id:
        return JsonResponse({"success": False, "error": "User profile not found"}, status=400)

    if not CollDestination.objects.filter(blog_bangladesh_coll_destination_id=destination_id).exists():
        return JsonResponse({"success": False, "error": "Destination not found"}, status=404)

    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({"success": False, "error": "Invalid JSON"}, status=400)

    video_url = (data.get("youtube_url") or "").strip()
    if not video_url:
        return JsonResponse({"success": False, "error": "ভিডিও লিংক দিন"}, status=400)

    # Detect platform and extract video ID / thumbnail
    platform = _detect_video_platform(video_url)
    video_id = None
    thumbnail_url = None

    if platform == "youtube":
        video_id = _extract_youtube_video_id(video_url)
        if video_id:
            video_url = f"https://www.youtube.com/watch?v={video_id}"
            thumbnail_url = f"https://i.ytimg.com/vi/{video_id}/mqdefault.jpg"
    elif platform == "tiktok":
        thumbnail_url = _fetch_tiktok_thumbnail(video_url)

    title = (data.get("video_title_bn") or "").strip() or None
    description = (data.get("description_bn") or "").strip() or None

    link = DestinationYoutubeLink.objects.create(
        link_blog_bangladesh_coll_destination_id=destination_id,
        link_user_profile_id=profile_id,
        youtube_url=video_url,
        youtube_video_id=video_id,
        video_platform=platform,
        video_thumbnail_url=thumbnail_url,
        video_title_bn=title,
        description_bn=description,
        sort_order=0,
        is_active=True,
        created_at=timezone.now(),
    )

    return JsonResponse({
        "success": True,
        "link_id": link.blog_bangladesh_destination_youtube_link_id,
        "youtube_video_id": video_id or "",
        "video_title_bn": title or "",
        "platform": platform,
        "thumbnail_url": thumbnail_url or "",
        "video_url": video_url,
    })


@require_POST
def api_destination_reference_link_add(request, destination_id):
    """POST — add a reference link for a destination."""
    if not request.user.is_authenticated:
        return JsonResponse({"success": False, "error": "Login required"}, status=401)

    profile_id = _get_user_profile_id(request)
    if not profile_id:
        return JsonResponse({"success": False, "error": "User profile not found"}, status=400)

    if not CollDestination.objects.filter(blog_bangladesh_coll_destination_id=destination_id).exists():
        return JsonResponse({"success": False, "error": "Destination not found"}, status=404)

    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({"success": False, "error": "Invalid JSON"}, status=400)

    ref_url = (data.get("reference_url") or "").strip()
    if not ref_url:
        return JsonResponse({"success": False, "error": "URL is required"}, status=400)

    title = (data.get("reference_title_bn") or "").strip() or None
    description = (data.get("description_bn") or "").strip() or None

    link = DestinationReferenceLink.objects.create(
        link_blog_bangladesh_coll_destination_id=destination_id,
        link_user_profile_id=profile_id,
        reference_url=ref_url,
        reference_title_bn=title,
        description_bn=description,
        sort_order=0,
        is_active=True,
        created_at=timezone.now(),
    )

    return JsonResponse({
        "success": True,
        "link_id": link.blog_bangladesh_destination_reference_link_id,
        "reference_title_bn": title or "",
        "reference_url": ref_url,
    })


def _extract_youtube_video_id(url):
    """Extract YouTube video ID from various URL formats."""
    patterns = [
        r'(?:youtube\.com/watch\?v=|youtu\.be/|youtube\.com/embed/)([a-zA-Z0-9_-]{11})',
        r'youtube\.com/shorts/([a-zA-Z0-9_-]{11})',
    ]
    for pattern in patterns:
        m = re.search(pattern, url)
        if m:
            return m.group(1)
    return None


def _detect_video_platform(url):
    """Detect video platform from URL. Returns: 'youtube', 'tiktok', 'instagram', or 'other'."""
    if not url:
        return "other"
    url_lower = url.lower()
    if "youtube.com" in url_lower or "youtu.be" in url_lower:
        return "youtube"
    if "tiktok.com" in url_lower:
        return "tiktok"
    if "instagram.com" in url_lower:
        return "instagram"
    if "facebook.com" in url_lower or "fb.watch" in url_lower:
        return "facebook"
    return "other"


def _fetch_tiktok_thumbnail(url):
    """Fetch TikTok video thumbnail via oEmbed API. Returns thumbnail URL or None."""
    import urllib.request
    import urllib.parse
    try:
        oembed_url = "https://www.tiktok.com/oembed?url=" + urllib.parse.quote(url, safe="")
        request = urllib.request.Request(oembed_url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(request, timeout=5) as response:
            data = json.loads(response.read().decode("utf-8"))
            return data.get("thumbnail_url") or None
    except Exception as tiktok_thumbnail_error:
        logger.warning('TikTok thumbnail fetch failed for %s — %s', url, tiktok_thumbnail_error)
        return None


@require_POST
def api_destination_photo_view(request, destination_id, photo_id):
    """POST — increment photo view count (called when lightbox opens)."""
    from django.db.models import F
    updated = DestinationPhoto.objects.filter(
        blog_bangladesh_destination_photo_id=photo_id,
        link_blog_bangladesh_coll_destination_id=destination_id,
    ).update(view_count=F('view_count') + 1)
    if not updated:
        return JsonResponse({"success": False}, status=404)
    return JsonResponse({"success": True})


@require_POST
def api_destination_video_view(request, destination_id, youtube_link_id):
    """POST — increment video view count (called when video link is clicked)."""
    from django.db.models import F
    updated = DestinationYoutubeLink.objects.filter(
        blog_bangladesh_destination_youtube_link_id=youtube_link_id,
        link_blog_bangladesh_coll_destination_id=destination_id,
    ).update(view_count=F('view_count') + 1)
    if not updated:
        return JsonResponse({"success": False}, status=404)
    return JsonResponse({"success": True})


@require_POST
def api_destination_review_add(request, destination_id):
    """POST — add a review for a destination."""
    if not request.user.is_authenticated:
        return JsonResponse({"success": False, "error": "Login required"}, status=401)

    profile_id = _get_user_profile_id(request)
    if not profile_id:
        return JsonResponse({"success": False, "error": "User profile not found"}, status=400)

    if not CollDestination.objects.filter(blog_bangladesh_coll_destination_id=destination_id).exists():
        return JsonResponse({"success": False, "error": "Destination not found"}, status=404)

    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({"success": False, "error": "Invalid JSON"}, status=400)

    rating = data.get("rating_overall")
    if not rating or int(rating) < 1 or int(rating) > 5:
        return JsonResponse({"success": False, "error": "রেটিং দিন (1-5)"}, status=400)

    # Prevent duplicate reviews from same user
    if EngagementDestinationReview.objects.filter(
        link_blog_bangladesh_coll_destination_id=destination_id, link_user_profile_id=profile_id
    ).exists():
        return JsonResponse({"success": False, "error": "আপনি ইতিমধ্যে এই গন্তব্যের জন্য রিভিউ দিয়েছেন"}, status=400)

    review_title = (data.get("review_title_bn") or "").strip() or None
    review_body = (data.get("review_body_bn") or "").strip() or None
    visited_at = data.get("visited_at") or None

    review = EngagementDestinationReview.objects.create(
        link_blog_bangladesh_coll_destination_id=destination_id,
        link_user_profile_id=profile_id,
        rating_overall=int(rating),
        review_title_bn=review_title,
        review_body_bn=review_body,
        visited_at=visited_at,
        helpful_count=0,
        created_at=timezone.now(),
    )

    # Update destination avg_rating and review_count
    from django.db.models import Avg, Count
    stats = EngagementDestinationReview.objects.filter(
        link_blog_bangladesh_coll_destination_id=destination_id
    ).aggregate(avg=Avg("rating_overall"), count=Count("bangladesh_engagement_destination_review_id"))
    CollDestination.objects.filter(blog_bangladesh_coll_destination_id=destination_id).update(
        avg_rating=stats["avg"],
        review_count=stats["count"],
    )

    return JsonResponse({
        "success": True,
        "review_id": review.bangladesh_engagement_destination_review_id,
        "rating_overall": int(rating),
        "review_title_bn": review_title or "",
        "review_body_bn": review_body or "",
    })


@require_POST
def api_destination_photo_like_toggle(request, destination_id, photo_id):
    """POST — toggle like on a destination photo."""
    if not request.user.is_authenticated:
        return JsonResponse({"success": False, "error": "Login required"}, status=401)

    profile_id = _get_user_profile_id(request)
    if not profile_id:
        return JsonResponse({"success": False, "error": "User profile not found"}, status=400)

    from django.db.models import F
    existing = EngagementDestinationPhotoLike.objects.filter(
        link_blog_bangladesh_destination_photo_id=photo_id,
        link_user_profile_id=profile_id,
    )
    if existing.exists():
        existing.delete()
        DestinationPhoto.objects.filter(blog_bangladesh_destination_photo_id=photo_id, like_count__gt=0).update(like_count=F('like_count') - 1)
        liked = False
    else:
        EngagementDestinationPhotoLike.objects.create(
            link_blog_bangladesh_destination_photo_id=photo_id,
            link_user_profile_id=profile_id,
            created_at=timezone.now(),
        )
        DestinationPhoto.objects.filter(blog_bangladesh_destination_photo_id=photo_id).update(like_count=F('like_count') + 1)
        liked = True

    new_count = DestinationPhoto.objects.filter(blog_bangladesh_destination_photo_id=photo_id).values_list('like_count', flat=True).first() or 0
    return JsonResponse({"success": True, "liked": liked, "like_count": new_count})


@require_POST
def api_destination_video_like_toggle(request, destination_id, youtube_link_id):
    """POST — toggle like on a destination video."""
    if not request.user.is_authenticated:
        return JsonResponse({"success": False, "error": "Login required"}, status=401)

    profile_id = _get_user_profile_id(request)
    if not profile_id:
        return JsonResponse({"success": False, "error": "User profile not found"}, status=400)

    from django.db.models import F
    existing = EngagementDestinationVideoLike.objects.filter(
        link_blog_bangladesh_destination_youtube_link_id=youtube_link_id,
        link_user_profile_id=profile_id,
    )
    if existing.exists():
        existing.delete()
        DestinationYoutubeLink.objects.filter(blog_bangladesh_destination_youtube_link_id=youtube_link_id, like_count__gt=0).update(like_count=F('like_count') - 1)
        liked = False
    else:
        EngagementDestinationVideoLike.objects.create(
            link_blog_bangladesh_destination_youtube_link_id=youtube_link_id,
            link_user_profile_id=profile_id,
            created_at=timezone.now(),
        )
        DestinationYoutubeLink.objects.filter(blog_bangladesh_destination_youtube_link_id=youtube_link_id).update(like_count=F('like_count') + 1)
        liked = True

    new_count = DestinationYoutubeLink.objects.filter(blog_bangladesh_destination_youtube_link_id=youtube_link_id).values_list('like_count', flat=True).first() or 0
    return JsonResponse({"success": True, "liked": liked, "like_count": new_count})


@require_POST
def api_destination_like_toggle(request, destination_id):
    """POST — toggle like on a destination. Session-based tracking."""
    from django.db.models import F

    if not CollDestination.objects.filter(blog_bangladesh_coll_destination_id=destination_id).exists():
        return JsonResponse({"success": False, "error": "Destination not found"}, status=404)

    session_like_key = 'destination_likes'
    liked_destinations = request.session.get(session_like_key, [])
    destination_key = str(destination_id)

    if destination_key in liked_destinations:
        liked_destinations.remove(destination_key)
        CollDestination.objects.filter(
            blog_bangladesh_coll_destination_id=destination_id,
            like_count__gt=0,
        ).update(like_count=F('like_count') - 1)
        liked = False
    else:
        liked_destinations.append(destination_key)
        CollDestination.objects.filter(
            blog_bangladesh_coll_destination_id=destination_id,
        ).update(like_count=F('like_count') + 1)
        liked = True

    request.session[session_like_key] = liked_destinations

    new_like_count = CollDestination.objects.filter(
        blog_bangladesh_coll_destination_id=destination_id,
    ).values_list('like_count', flat=True).first() or 0

    return JsonResponse({"success": True, "liked": liked, "like_count": new_like_count})


def _can_manage_contribution(request, contribution_profile_id, destination_id):
    """Check if user can edit/delete a community contribution.

    Allowed: contribution owner, destination owner, staff/admin.
    Returns (allowed: bool, profile_id: int|None).
    """
    if not request.user.is_authenticated:
        return False, None

    if request.user.is_staff or request.user.is_superuser:
        return True, None

    profile_id = _get_user_profile_id(request)
    if not profile_id:
        return False, None

    # Contribution owner
    if profile_id == contribution_profile_id:
        return True, profile_id

    # Destination owner
    try:
        dest = CollDestination.objects.only("link_user_profile_id").get(
            blog_bangladesh_coll_destination_id=destination_id
        )
        if dest.link_user_profile_id == profile_id:
            return True, profile_id
    except CollDestination.DoesNotExist:
        pass

    return False, profile_id


# ============================================================================
# CONTRIBUTION EDIT / DELETE APIs
# ============================================================================

@require_http_methods(["PATCH"])
def api_destination_photo_update(request, destination_id, photo_id):
    """PATCH — edit a destination photo caption."""
    try:
        photo = DestinationPhoto.objects.get(
            blog_bangladesh_destination_photo_id=photo_id,
            link_blog_bangladesh_coll_destination_id=destination_id,
        )
    except DestinationPhoto.DoesNotExist:
        return JsonResponse({"success": False, "error": "Photo not found"}, status=404)

    allowed, _ = _can_manage_contribution(request, photo.link_user_profile_id, destination_id)
    if not allowed:
        return JsonResponse({"success": False, "error": "অনুমতি নেই"}, status=403)

    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({"success": False, "error": "Invalid JSON"}, status=400)

    photo.caption_bn = (data.get("caption_bn") or "").strip() or None
    photo.updated_at = timezone.now()
    photo.save()

    return JsonResponse({"success": True, "caption_bn": photo.caption_bn or ""})


@require_http_methods(["DELETE"])
def api_destination_photo_delete(request, destination_id, photo_id):
    """DELETE — remove a destination photo."""
    try:
        photo = DestinationPhoto.objects.get(
            blog_bangladesh_destination_photo_id=photo_id,
            link_blog_bangladesh_coll_destination_id=destination_id,
        )
    except DestinationPhoto.DoesNotExist:
        return JsonResponse({"success": False, "error": "Photo not found"}, status=404)

    allowed, _ = _can_manage_contribution(request, photo.link_user_profile_id, destination_id)
    if not allowed:
        return JsonResponse({"success": False, "error": "অনুমতি নেই"}, status=403)

    photo.delete()
    return JsonResponse({"success": True})


@require_http_methods(["PATCH"])
def api_destination_cover_image_set(request, destination_id, photo_id):
    """PATCH — set a photo as the destination cover/thumbnail image.

    Only destination owner + staff/admin can change the cover image.
    """
    if not request.user.is_authenticated:
        return JsonResponse({"success": False, "error": "লগইন প্রয়োজন"}, status=401)

    try:
        destination = CollDestination.objects.get(
            blog_bangladesh_coll_destination_id=destination_id
        )
    except CollDestination.DoesNotExist:
        return JsonResponse({"success": False, "error": "Destination not found"}, status=404)

    # Permission: destination owner + staff/admin only
    profile_id = _get_user_profile_id(request)
    is_allowed = (
        request.user.is_staff
        or request.user.is_superuser
        or (profile_id and destination.link_user_profile_id == profile_id)
    )
    if not is_allowed:
        return JsonResponse({"success": False, "error": "অনুমতি নেই"}, status=403)

    try:
        photo = DestinationPhoto.objects.get(
            blog_bangladesh_destination_photo_id=photo_id,
            link_blog_bangladesh_coll_destination_id=destination_id,
        )
    except DestinationPhoto.DoesNotExist:
        return JsonResponse({"success": False, "error": "Photo not found"}, status=404)

    # Always use photo_url for consistency — auto-cover on upload also uses photo_url,
    # and the template comparison checks photo_url as the primary match.
    cover_url = photo.photo_url or ""
    destination.cover_image_url = cover_url
    destination.save(update_fields=["cover_image_url"])

    return JsonResponse({"success": True, "cover_image_url": cover_url})


@require_http_methods(["PATCH"])
def api_destination_youtube_link_update(request, destination_id, youtube_link_id):
    """PATCH — edit a destination YouTube link title/description."""
    try:
        link = DestinationYoutubeLink.objects.get(
            blog_bangladesh_destination_youtube_link_id=youtube_link_id,
            link_blog_bangladesh_coll_destination_id=destination_id,
        )
    except DestinationYoutubeLink.DoesNotExist:
        return JsonResponse({"success": False, "error": "YouTube link not found"}, status=404)

    allowed, _ = _can_manage_contribution(request, link.link_user_profile_id, destination_id)
    if not allowed:
        return JsonResponse({"success": False, "error": "অনুমতি নেই"}, status=403)

    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({"success": False, "error": "Invalid JSON"}, status=400)

    link.video_title_bn = (data.get("video_title_bn") or "").strip() or None
    link.description_bn = (data.get("description_bn") or "").strip() or None
    link.updated_at = timezone.now()
    link.save()

    return JsonResponse({
        "success": True,
        "video_title_bn": link.video_title_bn or "",
        "description_bn": link.description_bn or "",
    })


@require_http_methods(["DELETE"])
def api_destination_youtube_link_delete(request, destination_id, youtube_link_id):
    """DELETE — remove a destination YouTube link."""
    try:
        link = DestinationYoutubeLink.objects.get(
            blog_bangladesh_destination_youtube_link_id=youtube_link_id,
            link_blog_bangladesh_coll_destination_id=destination_id,
        )
    except DestinationYoutubeLink.DoesNotExist:
        return JsonResponse({"success": False, "error": "YouTube link not found"}, status=404)

    allowed, _ = _can_manage_contribution(request, link.link_user_profile_id, destination_id)
    if not allowed:
        return JsonResponse({"success": False, "error": "অনুমতি নেই"}, status=403)

    link.delete()
    return JsonResponse({"success": True})


@require_http_methods(["PATCH"])
def api_destination_reference_link_update(request, destination_id, reference_link_id):
    """PATCH — edit a destination reference link title/description."""
    try:
        link = DestinationReferenceLink.objects.get(
            blog_bangladesh_destination_reference_link_id=reference_link_id,
            link_blog_bangladesh_coll_destination_id=destination_id,
        )
    except DestinationReferenceLink.DoesNotExist:
        return JsonResponse({"success": False, "error": "Reference link not found"}, status=404)

    allowed, _ = _can_manage_contribution(request, link.link_user_profile_id, destination_id)
    if not allowed:
        return JsonResponse({"success": False, "error": "অনুমতি নেই"}, status=403)

    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({"success": False, "error": "Invalid JSON"}, status=400)

    link.reference_title_bn = (data.get("reference_title_bn") or "").strip() or None
    link.description_bn = (data.get("description_bn") or "").strip() or None
    link.updated_at = timezone.now()
    link.save()

    return JsonResponse({
        "success": True,
        "reference_title_bn": link.reference_title_bn or "",
        "description_bn": link.description_bn or "",
    })


@require_http_methods(["DELETE"])
def api_destination_reference_link_delete(request, destination_id, reference_link_id):
    """DELETE — remove a destination reference link."""
    try:
        link = DestinationReferenceLink.objects.get(
            blog_bangladesh_destination_reference_link_id=reference_link_id,
            link_blog_bangladesh_coll_destination_id=destination_id,
        )
    except DestinationReferenceLink.DoesNotExist:
        return JsonResponse({"success": False, "error": "Reference link not found"}, status=404)

    allowed, _ = _can_manage_contribution(request, link.link_user_profile_id, destination_id)
    if not allowed:
        return JsonResponse({"success": False, "error": "অনুমতি নেই"}, status=403)

    link.delete()
    return JsonResponse({"success": True})
