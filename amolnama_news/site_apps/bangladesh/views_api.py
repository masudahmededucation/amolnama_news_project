"""Bangladesh app — JSON API endpoints."""

import json
import os
import uuid

from django.conf import settings
from django.db.models import Q
from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.http import require_GET, require_POST

from .models import (
    CollDestination, RefDestinationCategory, RefSeason,
    CollMediaEntry, RefMediaCategory,
)


PAGE_SIZE = 12

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp"}
ALLOWED_VIDEO_TYPES = {"video/mp4", "video/quicktime", "video/webm"}
MAX_VIDEO_SIZE = 50 * 1024 * 1024  # 50MB
MAX_VIDEO_DURATION = 40  # seconds


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
    q = request.GET.get("q", "").strip()

    qs = CollDestination.objects.filter(destination_status="published").order_by("-is_featured", "-created_at")

    if category:
        qs = qs.filter(link_destination_category_id=int(category))
    if season:
        qs = qs.filter(link_best_season_id=int(season))
    if q:
        qs = qs.filter(
            Q(destination_name_bn__icontains=q)
            | Q(destination_name_en__icontains=q)
            | Q(destination_short_description_bn__icontains=q)
            | Q(destination_short_description_en__icontains=q)
        )

    offset = (page - 1) * PAGE_SIZE
    items = list(qs[offset: offset + PAGE_SIZE + 1])
    has_next = len(items) > PAGE_SIZE
    items = items[:PAGE_SIZE]

    cats = {c.bangladesh_ref_destination_category_id: c for c in RefDestinationCategory.objects.filter(is_active=True)}
    result = []
    for d in items:
        cat = cats.get(d.link_destination_category_id)
        result.append({
            "id": d.bangladesh_coll_destination_id,
            "name_bn": d.destination_name_bn,
            "name_en": d.destination_name_en,
            "short_desc_bn": d.destination_short_description_bn or "",
            "short_desc_en": d.destination_short_description_en or "",
            "cover_image": d.cover_image_url or "",
            "category_name_bn": cat.destination_category_name_bn if cat else "",
            "category_icon": cat.destination_category_icon if cat else "",
            "avg_rating": float(d.avg_rating) if d.avg_rating else None,
            "review_count": d.review_count,
            "view_count": d.view_count,
            "is_featured": d.is_featured,
            "time_ago": _time_ago(d.created_at),
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
        destination_description_en=(data.get("destination_description_en") or "").strip() or None,
        destination_description_bn=(data.get("destination_description_bn") or "").strip() or None,
        destination_short_description_en=(data.get("destination_short_description_en") or "").strip() or None,
        destination_short_description_bn=(data.get("destination_short_description_bn") or "").strip() or None,
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
    q = request.GET.get("q", "").strip()

    qs = CollMediaEntry.objects.filter(
        media_status="published", visibility="public"
    ).order_by("-created_at")

    if category:
        qs = qs.filter(link_media_category_id=int(category))
    if media_type in ("photo", "video"):
        qs = qs.filter(media_type=media_type)
    if season:
        qs = qs.filter(link_season_id=int(season))
    if q:
        qs = qs.filter(
            Q(media_title_bn__icontains=q)
            | Q(media_title_en__icontains=q)
            | Q(location_name_bn__icontains=q)
            | Q(location_name_en__icontains=q)
        )

    offset = (page - 1) * PAGE_SIZE
    items = list(qs[offset: offset + PAGE_SIZE + 1])
    has_next = len(items) > PAGE_SIZE
    items = items[:PAGE_SIZE]

    cats = {c.bangladesh_ref_media_category_id: c for c in RefMediaCategory.objects.filter(is_active=True)}
    result = []
    for e in items:
        cat = cats.get(e.link_media_category_id)
        result.append({
            "id": e.bangladesh_coll_media_entry_id,
            "title_bn": e.media_title_bn or "",
            "title_en": e.media_title_en or "",
            "display_title": e.media_title_bn or e.media_title_en or "",
            "media_type": e.media_type,
            "thumbnail_url": e.file_thumbnail_url or e.file_display_url or e.file_original_url,
            "category_name_bn": cat.media_category_name_bn if cat else "",
            "category_icon": cat.media_category_icon if cat else "",
            "location_bn": e.location_name_bn or "",
            "like_count": e.like_count,
            "view_count": e.view_count,
            "camera": e.exif_camera_model or "",
            "time_ago": _time_ago(e.created_at),
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

    mime = uploaded_file.content_type
    if mime in ALLOWED_IMAGE_TYPES:
        media_type = "photo"
    elif mime in ALLOWED_VIDEO_TYPES:
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
        media_description_bn=(request.POST.get("media_description_bn") or "").strip() or None,
        media_type=media_type,
        file_original_url=file_url,
        file_display_url=file_url,
        file_thumbnail_url=file_url,
        file_size_bytes=uploaded_file.size,
        file_mime_type=mime,
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
