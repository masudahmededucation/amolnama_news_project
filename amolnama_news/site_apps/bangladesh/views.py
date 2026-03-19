"""Bangladesh app — page views."""

from django.contrib.auth.decorators import login_required
from django.http import Http404
from django.shortcuts import render
from django.utils import timezone
from django.views.decorators.csrf import ensure_csrf_cookie

from .models import (
    CollDestination, CollDestinationPhoto, CollAccommodation,
    CollTransportRoute, CollTravelTip, EngDestinationReview,
    RefDestinationCategory, RefSeason, RefMediaCategory,
    CollMediaEntry,
)


PAGE_SIZE = 12


def _time_ago(dt):
    if not dt:
        return ""
    diff = timezone.now() - dt
    seconds = int(diff.total_seconds())
    if seconds < 60:
        return "এইমাত্র"
    minutes = seconds // 60
    if minutes < 60:
        return f"{minutes} মিনিট আগে"
    hours = minutes // 60
    if hours < 24:
        return f"{hours} ঘন্টা আগে"
    days = hours // 24
    if days < 30:
        return f"{days} দিন আগে"
    months = days // 30
    return f"{months} মাস আগে"


# ============================================================================
# LANDING PAGE
# ============================================================================

def bangladesh_landing(request):
    """Bangladesh landing page with hub cards."""
    # Stats for Travel Hub card
    destination_count = CollDestination.objects.filter(destination_status="published").count()
    # Stats for Beauty card
    media_count = CollMediaEntry.objects.filter(media_status="published").count()

    return render(request, "bangladesh/pages/bangladesh-landing.html", {
        "destination_count": destination_count,
        "media_count": media_count,
        "seo": {
            "title": "বাংলাদেশ — আমলনামা নিউজ | Bangladesh",
            "description": "বাংলাদেশ সম্পর্কিত সকল তথ্য ও খবর। All information and news about Bangladesh.",
            "breadcrumbs": [
                {"name": "হোম", "url": "/"},
                {"name": "বাংলাদেশ", "url": None},
            ],
        },
    })


# ============================================================================
# TRAVEL HUB
# ============================================================================

@ensure_csrf_cookie
def travel_hub(request):
    """Travel Hub — browse destinations."""
    categories = list(
        RefDestinationCategory.objects.filter(is_active=True)
        .order_by("sort_order", "destination_category_name_en")
    )
    seasons = list(
        RefSeason.objects.filter(is_active=True).order_by("sort_order")
    )

    destinations = list(
        CollDestination.objects.filter(destination_status="published")
        .order_by("-is_featured", "-created_at")[:PAGE_SIZE + 1]
    )
    has_next = len(destinations) > PAGE_SIZE
    destinations = destinations[:PAGE_SIZE]

    cat_map = {c.bangladesh_ref_destination_category_id: c for c in categories}
    for d in destinations:
        cat = cat_map.get(d.link_destination_category_id)
        d.category_name_bn = cat.destination_category_name_bn if cat else ""
        d.category_name_en = cat.destination_category_name_en if cat else ""
        d.category_icon = cat.destination_category_icon if cat else ""
        d.time_ago = _time_ago(d.created_at)

    return render(request, "bangladesh/pages/travel-hub.html", {
        "categories": categories,
        "seasons": seasons,
        "destinations": destinations,
        "has_next": has_next,
        "seo": {
            "title": "ভ্রমণ কেন্দ্র — আমলনামা নিউজ | Travel Hub",
            "description": "বাংলাদেশের দর্শনীয় স্থান, ভ্রমণ গাইড, হোটেল ও পরিবহন।",
            "breadcrumbs": [
                {"name": "হোম", "url": "/"},
                {"name": "বাংলাদেশ", "url": "/bangladesh/"},
                {"name": "ভ্রমণ কেন্দ্র", "url": None},
            ],
        },
    })


@login_required
@ensure_csrf_cookie
def travel_hub_add(request):
    """Add a new destination."""
    categories = list(
        RefDestinationCategory.objects.filter(is_active=True)
        .order_by("sort_order", "destination_category_name_en")
    )
    seasons = list(
        RefSeason.objects.filter(is_active=True).order_by("sort_order")
    )
    return render(request, "bangladesh/pages/travel-hub-add.html", {
        "categories": categories,
        "seasons": seasons,
        "seo": {
            "title": "দর্শনীয় স্থান যোগ করুন | Add Destination",
            "description": "নতুন দর্শনীয় স্থান যোগ করুন।",
        },
    })


def travel_hub_detail(request, destination_id):
    """Destination detail page."""
    try:
        dest = CollDestination.objects.get(
            bangladesh_coll_destination_id=destination_id,
            destination_status="published",
        )
    except CollDestination.DoesNotExist:
        raise Http404

    # Increment view
    CollDestination.objects.filter(bangladesh_coll_destination_id=destination_id).update(
        view_count=dest.view_count + 1
    )

    # Category
    try:
        cat = RefDestinationCategory.objects.get(
            bangladesh_ref_destination_category_id=dest.link_destination_category_id
        )
        dest.category_name_bn = cat.destination_category_name_bn
        dest.category_name_en = cat.destination_category_name_en
        dest.category_icon = cat.destination_category_icon
    except RefDestinationCategory.DoesNotExist:
        dest.category_name_bn = ""
        dest.category_name_en = ""
        dest.category_icon = ""

    # Season
    if dest.link_best_season_id:
        try:
            season = RefSeason.objects.get(bangladesh_ref_season_id=dest.link_best_season_id)
            dest.best_season_bn = season.season_name_bn
            dest.best_season_en = season.season_name_en
        except RefSeason.DoesNotExist:
            dest.best_season_bn = ""
            dest.best_season_en = ""
    else:
        dest.best_season_bn = ""
        dest.best_season_en = ""

    dest.time_ago = _time_ago(dest.created_at)

    # Related data
    photos = list(
        CollDestinationPhoto.objects.filter(link_coll_destination_id=destination_id)
        .order_by("sort_order")
    )
    accommodations = list(
        CollAccommodation.objects.filter(
            link_coll_destination_id=destination_id, is_active=True
        ).order_by("accommodation_name_en")
    )
    transport = list(
        CollTransportRoute.objects.filter(
            link_coll_destination_id=destination_id, is_active=True
        ).order_by("sort_order")
    )
    tips = list(
        CollTravelTip.objects.filter(link_coll_destination_id=destination_id)
        .order_by("-created_at")[:20]
    )
    reviews = list(
        EngDestinationReview.objects.filter(link_coll_destination_id=destination_id)
        .order_by("-created_at")[:20]
    )

    # Can edit
    can_edit = False
    if request.user.is_authenticated:
        if request.user.is_staff or request.user.is_superuser:
            can_edit = True
        else:
            from amolnama_news.site_apps.user_account.models import UserProfile
            try:
                profile = UserProfile.objects.only("user_profile_id").get(
                    link_user_account_user_id=request.user.pk
                )
                can_edit = (dest.link_user_profile_id == profile.user_profile_id)
            except UserProfile.DoesNotExist:
                pass

    title = dest.destination_name_bn or dest.destination_name_en
    return render(request, "bangladesh/pages/travel-hub-detail.html", {
        "dest": dest,
        "photos": photos,
        "accommodations": accommodations,
        "transport": transport,
        "tips": tips,
        "reviews": reviews,
        "can_edit": can_edit,
        "seo": {
            "title": f"{title} — ভ্রমণ কেন্দ্র | Travel Hub",
            "description": (dest.destination_short_description_bn or dest.destination_short_description_en or "")[:160],
            "breadcrumbs": [
                {"name": "হোম", "url": "/"},
                {"name": "বাংলাদেশ", "url": "/bangladesh/"},
                {"name": "ভ্রমণ কেন্দ্র", "url": "/bangladesh/travel/"},
                {"name": title, "url": None},
            ],
        },
    })


# ============================================================================
# BEAUTY OF BANGLADESH
# ============================================================================

@ensure_csrf_cookie
def beauty_hub(request):
    """Beauty of Bangladesh — photo/video gallery."""
    categories = list(
        RefMediaCategory.objects.filter(is_active=True)
        .order_by("sort_order", "media_category_name_en")
    )
    seasons = list(
        RefSeason.objects.filter(is_active=True).order_by("sort_order")
    )

    entries = list(
        CollMediaEntry.objects.filter(media_status="published", visibility="public")
        .order_by("-created_at")[:PAGE_SIZE + 1]
    )
    has_next = len(entries) > PAGE_SIZE
    entries = entries[:PAGE_SIZE]

    cat_map = {c.bangladesh_ref_media_category_id: c for c in categories}
    for e in entries:
        cat = cat_map.get(e.link_media_category_id)
        e.category_name_bn = cat.media_category_name_bn if cat else ""
        e.category_icon = cat.media_category_icon if cat else ""
        e.time_ago = _time_ago(e.created_at)

    return render(request, "bangladesh/pages/beauty-hub.html", {
        "categories": categories,
        "seasons": seasons,
        "entries": entries,
        "has_next": has_next,
        "seo": {
            "title": "বাংলার রূপ — আমলনামা নিউজ | Beauty of Bangladesh",
            "description": "বাংলাদেশের প্রাকৃতিক সৌন্দর্য — ছবি ও ভিডিও গ্যালারি।",
            "breadcrumbs": [
                {"name": "হোম", "url": "/"},
                {"name": "বাংলাদেশ", "url": "/bangladesh/"},
                {"name": "বাংলার রূপ", "url": None},
            ],
        },
    })


@login_required
@ensure_csrf_cookie
def beauty_hub_upload(request):
    """Upload photo/video."""
    categories = list(
        RefMediaCategory.objects.filter(is_active=True)
        .order_by("sort_order", "media_category_name_en")
    )
    seasons = list(
        RefSeason.objects.filter(is_active=True).order_by("sort_order")
    )
    return render(request, "bangladesh/pages/beauty-hub-upload.html", {
        "categories": categories,
        "seasons": seasons,
        "seo": {
            "title": "ছবি / ভিডিও আপলোড | Upload Photo / Video",
            "description": "বাংলাদেশের সৌন্দর্য শেয়ার করুন।",
        },
    })
