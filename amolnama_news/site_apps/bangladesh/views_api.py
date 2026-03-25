"""Bangladesh app — JSON API endpoints."""

import json
import os
import re
import uuid

from django.conf import settings
from django.db.models import Q
from django.http import JsonResponse
from django.utils import timezone
from django.utils.text import slugify
from django.views.decorators.http import require_GET, require_POST, require_http_methods

from .models import (
    CollDestination, RefDestinationCategory, RefSeason,
    CollMediaEntry, RefMediaCategory,
    CollDestinationPhoto, CollDestinationYoutubeLink, CollDestinationReferenceLink,
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


def _get_user_profile_id(request):
    if not request.user.is_authenticated:
        return None
    from amolnama_news.site_apps.user_account.models import UserProfile
    try:
        return UserProfile.objects.only("user_profile_id").get(
            link_user_account_user_id=request.user.pk
        ).user_profile_id
    except UserProfile.DoesNotExist:
        return None


def _time_ago(dt):
    if not dt:
        return ""
    diff = timezone.now() - dt
    seconds = int(diff.total_seconds())
    if seconds < 60:
        return "এইমাত্র"
    minutes = seconds // 60
    if minutes < 60:
        return f"{minutes}m ago"
    hours = minutes // 60
    if hours < 24:
        return f"{hours}h ago"
    days = hours // 24
    if days < 30:
        return f"{days}d ago"
    months = days // 30
    return f"{months}mo ago"


# ============================================================================
# TRAVEL HUB APIs
# ============================================================================

@require_GET
def api_destination_list(request):
    """GET /bangladesh/api/destinations/ — paginated destination list."""
    page = int(request.GET.get("page", 1))
    category = request.GET.get("category", "").strip()
    season = request.GET.get("season", "").strip()
    search_query = request.GET.get("q", "").strip()

    queryset = CollDestination.objects.filter(destination_status="published").order_by("-is_featured", "-created_at")

    if category:
        queryset = queryset.filter(link_destination_category_id=int(category))
    if season:
        queryset = queryset.filter(link_best_season_id=int(season))
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

    category_map = {c.bangladesh_ref_destination_category_id: c for c in RefDestinationCategory.objects.filter(is_active=True)}
    result = []
    for destination in items:
        destination_category = category_map.get(destination.link_destination_category_id)
        result.append({
            "id": destination.bangladesh_coll_destination_id,
            "slug": destination.destination_slug or "",
            "name_bn": destination.destination_name_bn,
            "name_en": destination.destination_name_en,
            "short_desc_bn": destination.destination_short_description_bn or "",
            "short_desc_en": destination.destination_short_description_en or "",
            "cover_image": destination.cover_image_url or "",
            "category_name_bn": destination_category.destination_category_name_bn if destination_category else "",
            "category_icon": destination_category.destination_category_icon if destination_category else "",
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

    category_id = data.get("link_destination_category_id")
    if not category_id:
        return JsonResponse({"success": False, "error": "Category is required"}, status=400)

    if not RefDestinationCategory.objects.filter(
        bangladesh_ref_destination_category_id=category_id, is_active=True
    ).exists():
        return JsonResponse({"success": False, "error": "Invalid category"}, status=400)

    dest = CollDestination.objects.create(
        link_user_profile_id=profile_id,
        link_destination_category_id=category_id,
        link_best_season_id=data.get("link_best_season_id") or None,
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

    return JsonResponse({"success": True, "destination_id": dest.bangladesh_coll_destination_id, "destination_slug": dest.destination_slug or ""})


def _generate_destination_slug(dest):
    """Generate URL slug from destination name. Called on create and update."""
    base_name = dest.destination_name_en or dest.destination_name_bn or ""
    slug = slugify(base_name, allow_unicode=True)
    if not slug:
        slug = str(dest.bangladesh_coll_destination_id)
    candidate = slug
    counter = 1
    while CollDestination.objects.filter(destination_slug=candidate).exclude(
        bangladesh_coll_destination_id=dest.bangladesh_coll_destination_id
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
        dest = CollDestination.objects.get(bangladesh_coll_destination_id=destination_id)
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

    category_id = data.get("link_destination_category_id")
    if not category_id:
        return JsonResponse({"success": False, "error": "Category is required"}, status=400)

    dest.link_destination_category_id = category_id
    dest.link_best_season_id = data.get("link_best_season_id") or None
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

    return JsonResponse({"success": True, "destination_id": dest.bangladesh_coll_destination_id})


# ============================================================================
# BEAUTY OF BANGLADESH APIs
# ============================================================================

@require_GET
def api_media_list(request):
    """GET /bangladesh/api/media/ — paginated media gallery."""
    page = int(request.GET.get("page", 1))
    category = request.GET.get("category", "").strip()
    media_type = request.GET.get("type", "").strip()
    season = request.GET.get("season", "").strip()
    search_query = request.GET.get("q", "").strip()

    queryset = CollMediaEntry.objects.filter(
        media_status="published", visibility="public"
    ).order_by("-created_at")

    if category:
        queryset = queryset.filter(link_media_category_id=int(category))
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

    category_map = {c.bangladesh_ref_media_category_id: c for c in RefMediaCategory.objects.filter(is_active=True)}
    result = []
    for media_entry in items:
        media_category = category_map.get(media_entry.link_media_category_id)
        result.append({
            "id": media_entry.bangladesh_coll_media_entry_id,
            "title_bn": media_entry.media_title_bn or "",
            "title_en": media_entry.media_title_en or "",
            "display_title": media_entry.media_title_bn or media_entry.media_title_en or "",
            "media_type": media_entry.media_type,
            "thumbnail_url": media_entry.file_thumbnail_url or media_entry.file_display_url or media_entry.file_original_url,
            "category_name_bn": media_category.media_category_name_bn if media_category else "",
            "category_icon": media_category.media_category_icon if media_category else "",
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

    category_id = request.POST.get("link_media_category_id")
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
        link_media_category_id=int(category_id),
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

    return JsonResponse({"success": True, "media_id": entry.bangladesh_coll_media_entry_id})


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
    if not CollDestination.objects.filter(bangladesh_coll_destination_id=destination_id).exists():
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
    last_order = CollDestinationPhoto.objects.filter(
        link_coll_destination_id=destination_id
    ).order_by("-sort_order").values_list("sort_order", flat=True).first()
    next_order = (last_order or 0) + 1

    photo = CollDestinationPhoto.objects.create(
        link_coll_destination_id=destination_id,
        link_user_profile_id=profile_id,
        photo_url=file_url,
        caption_bn=caption,
        sort_order=next_order,
        is_cover=False,
        created_at=timezone.now(),
    )

    return JsonResponse({
        "success": True,
        "photo_id": photo.bangladesh_coll_destination_photo_id,
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

    if not CollDestination.objects.filter(bangladesh_coll_destination_id=destination_id).exists():
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

    link = CollDestinationYoutubeLink.objects.create(
        link_coll_destination_id=destination_id,
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
        "link_id": link.bangladesh_coll_destination_youtube_link_id,
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

    if not CollDestination.objects.filter(bangladesh_coll_destination_id=destination_id).exists():
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

    link = CollDestinationReferenceLink.objects.create(
        link_coll_destination_id=destination_id,
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
        "link_id": link.bangladesh_coll_destination_reference_link_id,
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
    except Exception:
        return None


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
            bangladesh_coll_destination_id=destination_id
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
        photo = CollDestinationPhoto.objects.get(
            bangladesh_coll_destination_photo_id=photo_id,
            link_coll_destination_id=destination_id,
        )
    except CollDestinationPhoto.DoesNotExist:
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
        photo = CollDestinationPhoto.objects.get(
            bangladesh_coll_destination_photo_id=photo_id,
            link_coll_destination_id=destination_id,
        )
    except CollDestinationPhoto.DoesNotExist:
        return JsonResponse({"success": False, "error": "Photo not found"}, status=404)

    allowed, _ = _can_manage_contribution(request, photo.link_user_profile_id, destination_id)
    if not allowed:
        return JsonResponse({"success": False, "error": "অনুমতি নেই"}, status=403)

    photo.delete()
    return JsonResponse({"success": True})


@require_http_methods(["PATCH"])
def api_destination_youtube_link_update(request, destination_id, youtube_link_id):
    """PATCH — edit a destination YouTube link title/description."""
    try:
        link = CollDestinationYoutubeLink.objects.get(
            bangladesh_coll_destination_youtube_link_id=youtube_link_id,
            link_coll_destination_id=destination_id,
        )
    except CollDestinationYoutubeLink.DoesNotExist:
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
        link = CollDestinationYoutubeLink.objects.get(
            bangladesh_coll_destination_youtube_link_id=youtube_link_id,
            link_coll_destination_id=destination_id,
        )
    except CollDestinationYoutubeLink.DoesNotExist:
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
        link = CollDestinationReferenceLink.objects.get(
            bangladesh_coll_destination_reference_link_id=reference_link_id,
            link_coll_destination_id=destination_id,
        )
    except CollDestinationReferenceLink.DoesNotExist:
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
        link = CollDestinationReferenceLink.objects.get(
            bangladesh_coll_destination_reference_link_id=reference_link_id,
            link_coll_destination_id=destination_id,
        )
    except CollDestinationReferenceLink.DoesNotExist:
        return JsonResponse({"success": False, "error": "Reference link not found"}, status=404)

    allowed, _ = _can_manage_contribution(request, link.link_user_profile_id, destination_id)
    if not allowed:
        return JsonResponse({"success": False, "error": "অনুমতি নেই"}, status=403)

    link.delete()
    return JsonResponse({"success": True})
