"""Poem app — JSON API endpoints."""

import json

from django.db.models import F, Q
from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.http import require_GET, require_POST

from .helpers import get_smart_related_poems
from .models import CollPoemEntry, EngPoemLike, RefPoemCategory


PAGE_SIZE = 12


def _time_ago(dt):
    """Human-readable time-ago string."""
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


def _get_user_profile_id(request):
    """Resolve user_profile_id from the authenticated user."""
    if not request.user.is_authenticated:
        return None
    from amolnama_news.site_apps.user_account.models import UserProfile
    try:
        return UserProfile.objects.only("user_profile_id").get(
            link_user_account_user_id=request.user.pk
        ).user_profile_id
    except UserProfile.DoesNotExist:
        return None


def _categories_map():
    """Return {id: category} dict for active categories."""
    return {
        c.poem_ref_poem_category_id: c
        for c in RefPoemCategory.objects.filter(is_active=True)
    }


@require_GET
def api_poem_entry_list(request):
    """GET /poem/api/poems/ — paginated poem list with filters."""
    page = int(request.GET.get("page", 1))
    category = request.GET.get("category", "").strip()
    q = request.GET.get("q", "").strip()
    poem_type = request.GET.get("type", "").strip()
    exclude_id = request.GET.get("exclude", "").strip()
    custom_limit = request.GET.get("limit", "").strip()

    qs = CollPoemEntry.objects.order_by("-created_at")

    if poem_type:
        qs = qs.filter(poem_type_code=poem_type)

    if category:
        qs = qs.filter(link_poem_ref_poem_category_id=int(category))

    if exclude_id and exclude_id.isdigit():
        qs = qs.exclude(poem_coll_poem_entry_id=int(exclude_id))

    if q:
        qs = qs.filter(
            Q(poem_title_bn__icontains=q)
            | Q(poem_title_en__icontains=q)
            | Q(poem_body_bn__icontains=q)
            | Q(poem_body_en__icontains=q)
            | Q(poem_author_display_name__icontains=q)
        )

    page_size = int(custom_limit) if custom_limit and custom_limit.isdigit() else PAGE_SIZE
    offset = (page - 1) * page_size
    poems = list(qs[offset: offset + page_size + 1])
    has_next = len(poems) > page_size
    poems = poems[:page_size]

    cats = _categories_map()
    result = []
    for p in poems:
        cat = cats.get(p.link_poem_ref_poem_category_id)
        body = p.poem_body_bn or p.poem_body_en or ""
        result.append({
            "id": p.poem_coll_poem_entry_id,
            "title_bn": p.poem_title_bn or "",
            "title_en": p.poem_title_en or "",
            "display_title": p.poem_title_bn or p.poem_title_en or "শিরোনামহীন",
            "body_preview": body[:120].strip(),
            "category_name": cat.poem_category_name_bn if cat else "",
            "category_name_en": cat.poem_category_name_en if cat else "",
            "author_display_name": p.poem_author_display_name,
            "like_count": p.like_count,
            "language": p.poem_language_code,
            "type": p.poem_type_code,
            "time_ago": _time_ago(p.created_at),
        })

    return JsonResponse({"poems": result, "has_next": has_next})


@require_POST
def api_poem_entry_create(request):
    """POST /poem/api/poems/create/ — create a new poem."""
    import traceback
    try:
        if not request.user.is_authenticated:
            return JsonResponse({"success": False, "error": "Login required"}, status=401)

        profile_id = _get_user_profile_id(request)
        if not profile_id:
            return JsonResponse({"success": False, "error": "User profile not found"}, status=400)

        try:
            data = json.loads(request.body)
        except (json.JSONDecodeError, ValueError):
            return JsonResponse({"success": False, "error": "Invalid JSON"}, status=400)

        lang = data.get("poem_language", "bn")
        if lang not in ("bn", "en"):
            lang = "bn"

        title_bn = (data.get("poem_title_bn") or "").strip() or None
        title_en = (data.get("poem_title_en") or "").strip() or None
        body_bn = (data.get("poem_body_bn") or "").strip() or None
        body_en = (data.get("poem_body_en") or "").strip() or None

        # Validate: at least one title and one body
        if not title_bn and not title_en:
            return JsonResponse({"success": False, "error": "Title is required"}, status=400)
        if not body_bn and not body_en:
            return JsonResponse({"success": False, "error": "Poem body is required"}, status=400)

        category_id = data.get("link_poem_category_id")
        if not category_id:
            return JsonResponse({"success": False, "error": "Category is required"}, status=400)

        # Validate category exists
        if not RefPoemCategory.objects.filter(poem_ref_poem_category_id=category_id, is_active=True).exists():
            return JsonResponse({"success": False, "error": "Invalid category"}, status=400)

        # Writer's name — user-provided, required
        display_name = (data.get("poem_author_display_name") or "").strip()
        if not display_name:
            return JsonResponse({"success": False, "error": "Writer's name is required"}, status=400)

        backstory_bn = (data.get("poem_backstory_bn") or "").strip() or None
        backstory_en = (data.get("poem_backstory_en") or "").strip() or None
        interpretation_bn = (data.get("poem_interpretation_bn") or "").strip() or None
        interpretation_en = (data.get("poem_interpretation_en") or "").strip() or None
        audio_url = (data.get("poem_audio_url") or "").strip() or None
        audio_reciter = (data.get("poem_audio_reciter_name") or "").strip() or None
        audio_desc = (data.get("poem_audio_description") or "").strip() or None
        poem_type = (data.get("poem_type_code") or "poem").strip()
        if poem_type not in ("poem", "song"):
            poem_type = "poem"

        poem = CollPoemEntry.objects.create(
            link_user_profile_id=profile_id,
            link_poem_ref_poem_category_id=category_id,
            poem_type_code=poem_type,
            poem_title_bn=title_bn,
            poem_title_en=title_en,
            poem_body_bn=body_bn,
            poem_body_en=body_en,
            poem_backstory_bn=backstory_bn,
            poem_backstory_en=backstory_en,
            poem_interpretation_bn=interpretation_bn,
            poem_interpretation_en=interpretation_en,
            poem_language_code=lang,
            poem_author_display_name=display_name,
            poem_audio_url=audio_url,
            poem_audio_reciter_name=audio_reciter,
            poem_audio_description=audio_desc,
            poem_status_code="published",
            like_count=0,
            view_count=0,
            created_at=timezone.now(),
        )

        return JsonResponse({"success": True, "poem_id": poem.poem_coll_poem_entry_id})
    except Exception:
        return JsonResponse({"success": False, "error": traceback.format_exc()}, status=500)


@require_POST
def api_poem_entry_update(request, poem_id):
    """POST /poem/api/poems/<id>/update/ — update an existing poem."""
    if not request.user.is_authenticated:
        return JsonResponse({"success": False, "error": "Login required"}, status=401)

    profile_id = _get_user_profile_id(request)

    # Permission: admin or owner
    try:
        poem = CollPoemEntry.objects.get(poem_coll_poem_entry_id=poem_id)
    except CollPoemEntry.DoesNotExist:
        return JsonResponse({"success": False, "error": "Poem not found"}, status=404)

    is_admin = request.user.is_staff or request.user.is_superuser
    if not is_admin and (not profile_id or poem.link_user_profile_id != profile_id):
        return JsonResponse({"success": False, "error": "Not authorized"}, status=403)

    try:
        data = json.loads(request.body)
    except (json.JSONDecodeError, ValueError):
        return JsonResponse({"success": False, "error": "Invalid JSON"}, status=400)

    lang = data.get("poem_language", poem.poem_language_code)
    if lang not in ("bn", "en"):
        lang = poem.poem_language_code

    title_bn = (data.get("poem_title_bn") or "").strip() or None
    title_en = (data.get("poem_title_en") or "").strip() or None
    body_bn = (data.get("poem_body_bn") or "").strip() or None
    body_en = (data.get("poem_body_en") or "").strip() or None

    if not title_bn and not title_en:
        return JsonResponse({"success": False, "error": "Title is required"}, status=400)
    if not body_bn and not body_en:
        return JsonResponse({"success": False, "error": "Poem body is required"}, status=400)

    category_id = data.get("link_poem_category_id")
    if not category_id:
        return JsonResponse({"success": False, "error": "Category is required"}, status=400)
    if not RefPoemCategory.objects.filter(poem_ref_poem_category_id=category_id, is_active=True).exists():
        return JsonResponse({"success": False, "error": "Invalid category"}, status=400)

    display_name = (data.get("poem_author_display_name") or "").strip()
    if not display_name:
        return JsonResponse({"success": False, "error": "Writer's name is required"}, status=400)

    CollPoemEntry.objects.filter(poem_coll_poem_entry_id=poem_id).update(
        poem_title_bn=title_bn,
        poem_title_en=title_en,
        poem_body_bn=body_bn,
        poem_body_en=body_en,
        poem_backstory_bn=(data.get("poem_backstory_bn") or "").strip() or None,
        poem_backstory_en=(data.get("poem_backstory_en") or "").strip() or None,
        poem_interpretation_bn=(data.get("poem_interpretation_bn") or "").strip() or None,
        poem_interpretation_en=(data.get("poem_interpretation_en") or "").strip() or None,
        poem_language_code=lang,
        poem_author_display_name=display_name,
        poem_audio_url=(data.get("poem_audio_url") or "").strip() or None,
        poem_audio_reciter_name=(data.get("poem_audio_reciter_name") or "").strip() or None,
        poem_audio_description=(data.get("poem_audio_description") or "").strip() or None,
        link_poem_ref_poem_category_id=category_id,
        updated_at=timezone.now(),
    )

    return JsonResponse({"success": True, "poem_id": poem_id})


@require_POST
def api_poem_entry_like_toggle(request, poem_id):
    """POST /poem/api/poems/<id>/like/ — toggle like on a poem."""
    if not request.user.is_authenticated:
        return JsonResponse({"success": False, "error": "Login required"}, status=401)

    profile_id = _get_user_profile_id(request)
    if not profile_id:
        return JsonResponse({"success": False, "error": "User profile not found"}, status=400)

    # Check poem exists
    if not CollPoemEntry.objects.filter(poem_coll_poem_entry_id=poem_id).exists():
        return JsonResponse({"success": False, "error": "Poem not found"}, status=404)

    existing = EngPoemLike.objects.filter(
        link_poem_coll_poem_entry_id=poem_id,
        link_user_profile_id=profile_id,
    ).first()

    if existing:
        existing.delete()
        CollPoemEntry.objects.filter(poem_coll_poem_entry_id=poem_id).update(
            like_count=F("like_count") - 1
        )
        liked = False
    else:
        EngPoemLike.objects.create(
            link_poem_coll_poem_entry_id=poem_id,
            link_user_profile_id=profile_id,
            created_at=timezone.now(),
        )
        CollPoemEntry.objects.filter(poem_coll_poem_entry_id=poem_id).update(
            like_count=F("like_count") + 1
        )
        liked = True

    new_count = CollPoemEntry.objects.filter(poem_coll_poem_entry_id=poem_id).values_list("like_count", flat=True).first() or 0

    return JsonResponse({"success": True, "liked": liked, "like_count": new_count})


@require_GET
def api_poem_next(request, poem_id):
    """GET /poem/api/poems/<id>/next/ — smart radio: play same category first,
    then move to next category when exhausted. Accepts played IDs to avoid repeats.

    Query params:
      played    — comma-separated IDs of already-played poems
      exhausted — comma-separated category IDs already fully played
    """
    try:
        current = CollPoemEntry.objects.get(poem_coll_poem_entry_id=poem_id)
    except CollPoemEntry.DoesNotExist:
        return JsonResponse({"success": False, "error": "Not found"}, status=404)

    # Parse played IDs and exhausted categories from query params
    played_raw = request.GET.get("played", "")
    played_ids = set()
    for x in played_raw.split(","):
        x = x.strip()
        if x.isdigit():
            played_ids.add(int(x))
    played_ids.add(poem_id)  # always exclude current

    exhausted_raw = request.GET.get("exhausted", "")
    exhausted_cats = set()
    for x in exhausted_raw.split(","):
        x = x.strip()
        if x.isdigit():
            exhausted_cats.add(int(x))

    # Use shared smart selection — same logic as related poems section
    # Returns poems in priority order: same author, same category, similar, popular
    smart_list = get_smart_related_poems(
        current, limit=1, exclude_ids=played_ids, require_audio=True,
    )

    current_cat = current.link_poem_ref_poem_category_id

    # If smart list is empty, reset exhausted and try again with no exclusions
    if not smart_list:
        smart_list = get_smart_related_poems(
            current, limit=1, exclude_ids={poem_id}, require_audio=True,
        )
        exhausted_cats = set()

    if not smart_list:
        return JsonResponse({"success": False, "next": None})

    p = smart_list[0]
    cats = _categories_map()
    cat = cats.get(p.link_poem_ref_poem_category_id)

    return JsonResponse({
        "success": True,
        "next": {
            "id": p.poem_coll_poem_entry_id,
            "title": p.poem_title_bn or p.poem_title_en or "শিরোনামহীন",
            "author": p.poem_author_display_name,
            "body": p.poem_body_bn or p.poem_body_en or "",
            "category": cat.poem_category_name_bn if cat else "",
            "language": p.poem_language_code,
            "type": p.poem_type_code,
            "audio_url": p.poem_audio_url,
            "audio_reciter": p.poem_audio_reciter_name or "",
            "audio_description": p.poem_audio_description or "",
            "backstory": p.poem_backstory_bn or p.poem_backstory_en or "",
            "interpretation": p.poem_interpretation_bn or p.poem_interpretation_en or "",
            "like_count": p.like_count,
            "view_count": p.view_count,
            "category_id": p.link_poem_ref_poem_category_id,
            "url": "/poem/" + str(p.poem_coll_poem_entry_id) + "/",
        },
        "exhausted_categories": sorted(exhausted_cats),
        "category_changed": p.link_poem_ref_poem_category_id != current_cat,
    })


@require_GET
def api_poem_category_list(request):
    """GET /poem/api/categories/ — active categories for dropdowns."""
    cats = RefPoemCategory.objects.filter(is_active=True).order_by("sort_order", "poem_category_name_en")
    return JsonResponse({
        "categories": [
            {
                "id": c.poem_ref_poem_category_id,
                "name_bn": c.poem_category_name_bn,
                "name_en": c.poem_category_name_en,
            }
            for c in cats
        ]
    })
