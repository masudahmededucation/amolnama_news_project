"""Bangladesh app — page views."""

import json
from amolnama_news.site_apps.core.utils import time_ago as _time_ago
import re

from django.contrib.auth.decorators import login_required
from django.db.models import F
from django.http import Http404
from django.shortcuts import redirect, render
from amolnama_news.site_apps.core.utils import bangla_slugify
from django.views.decorators.csrf import ensure_csrf_cookie

from amolnama_news.site_apps.user_account.models import UserProfile

from .models import (
    CollDestination, DestinationPhoto, Accommodation,
    TransportRoute, TravelTip, EngagementDestinationReview,
    DestinationYoutubeLink, DestinationReferenceLink,
    EngagementDestinationPhotoLike, EngagementDestinationVideoLike,
    RefSeason,
    CollMediaEntry,
)
from amolnama_news.site_apps.content.models import RefContentSubcategory


PAGE_SIZE = 12



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
        RefContentSubcategory.objects.filter(group_code='blog_bangladesh_destination_category', is_active=True)
        .order_by("sort_order")
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

    # Backfill cover images: for destinations without a cover, use their first photo
    destinations_without_cover = [
        d for d in destinations if not d.cover_image_url
    ]
    if destinations_without_cover:
        destination_ids_without_cover = [d.blog_bangladesh_coll_destination_id for d in destinations_without_cover]
        # Get the first photo per destination (lowest sort_order)
        first_photos = (
            DestinationPhoto.objects
            .filter(link_blog_bangladesh_coll_destination_id__in=destination_ids_without_cover)
            .order_by("link_blog_bangladesh_coll_destination_id", "sort_order")
        )
        first_photo_map = {}
        for photo in first_photos:
            if photo.link_blog_bangladesh_coll_destination_id not in first_photo_map:
                first_photo_map[photo.link_blog_bangladesh_coll_destination_id] = photo.photo_url
        # Update in-memory objects + DB
        for destination in destinations_without_cover:
            photo_url = first_photo_map.get(destination.blog_bangladesh_coll_destination_id)
            if photo_url:
                destination.cover_image_url = photo_url
                CollDestination.objects.filter(
                    blog_bangladesh_coll_destination_id=destination.blog_bangladesh_coll_destination_id,
                ).update(cover_image_url=photo_url)

    subcategory_map = {c.content_ref_content_subcategory_id: c for c in categories}
    for destination in destinations:
        subcategory = subcategory_map.get(destination.link_content_ref_content_subcategory_id)
        destination.category_name_bn = subcategory.subcategory_name_bn if subcategory else ""
        destination.category_name_en = subcategory.subcategory_name_en if subcategory else ""
        destination.category_icon = subcategory.subcategory_icon if subcategory else ""
        destination.time_ago = _time_ago(destination.created_at)

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
                {"name": "বাংলাদেশ", "url": "/bangladesh-tourist-destinations/"},
                {"name": "ভ্রমণ কেন্দ্র", "url": None},
            ],
        },
    })


@login_required
@ensure_csrf_cookie
def travel_hub_add(request):
    """Add or edit a destination."""
    categories = list(
        RefContentSubcategory.objects.filter(group_code='blog_bangladesh_destination_category', is_active=True)
        .order_by("sort_order")
    )
    seasons = list(
        RefSeason.objects.filter(is_active=True).order_by("sort_order")
    )

    context = {
        "categories": categories,
        "seasons": seasons,
        "seo": {
            "title": "দর্শনীয় স্থান যোগ করুন | Add Destination",
            "description": "নতুন দর্শনীয় স্থান যোগ করুন।",
            "breadcrumbs": [
                {"name": "হোম", "url": "/"},
                {"name": "বাংলাদেশ", "url": "/bangladesh-tourist-destinations/"},
                {"name": "ভ্রমণ কেন্দ্র", "url": "/bangladesh-tourist-destinations/travel/"},
                {"name": "স্থান যোগ করুন", "url": None},
            ],
        },
    }

    # Edit mode — pre-populate from existing destination
    edit_id = request.GET.get("edit")
    if edit_id:
        try:
            dest = CollDestination.objects.get(blog_bangladesh_coll_destination_id=int(edit_id))
            context["edit_entry_id"] = int(edit_id)
            context["edit_data_json"] = json.dumps({
                "category_id": dest.link_content_ref_content_subcategory_id,
                "name_bn": dest.destination_name_bn or "",
                "name_en": dest.destination_name_en or "",
                "short_desc_bn": dest.destination_short_description_bn or "",
                "desc_bn": dest.destination_description_bn or "",
                "season_id": dest.link_blog_bangladesh_ref_season_id,
                "difficulty": dest.difficulty_level or "",
                "entry_fee": float(dest.entry_fee_bdt) if dest.entry_fee_bdt else "",
                "visiting_hours": dest.visiting_hours_bn or "",
            }, default=str)
            context["seo"]["title"] = "সম্পাদনা | Edit Destination"
        except (ValueError, CollDestination.DoesNotExist):
            pass

    return render(request, "bangladesh/pages/travel-hub-add.html", context)


def _ensure_destination_slug(dest):
    """Generate and save slug if missing."""
    if dest.destination_slug:
        return
    base_name = dest.destination_name_en or dest.destination_name_bn or ""
    slug = bangla_slugify(base_name)
    if not slug:
        slug = str(dest.blog_bangladesh_coll_destination_id)
    # Ensure uniqueness
    candidate = slug
    counter = 1
    while CollDestination.objects.filter(destination_slug=candidate).exclude(
        blog_bangladesh_coll_destination_id=dest.blog_bangladesh_coll_destination_id
    ).exists():
        candidate = f"{slug}-{counter}"
        counter += 1
    dest.destination_slug = candidate
    dest.save(update_fields=["destination_slug"])


def travel_hub_detail_by_id(request, destination_id):
    """Old ID-based URL → redirect to slug-based URL for SEO."""
    try:
        dest = CollDestination.objects.get(
            blog_bangladesh_coll_destination_id=destination_id,
            destination_status="published",
        )
    except CollDestination.DoesNotExist:
        raise Http404
    _ensure_destination_slug(dest)
    return redirect("bangladesh:travel_hub_detail", destination_slug=dest.destination_slug, permanent=True)


@ensure_csrf_cookie
def travel_hub_detail_by_slug(request, destination_slug):
    """Destination detail page — SEO-friendly slug URL."""
    # If slug is numeric (old ID-based URL), look up by ID and redirect to slug
    if destination_slug.isdigit():
        try:
            dest = CollDestination.objects.get(
                blog_bangladesh_coll_destination_id=int(destination_slug),
                destination_status="published",
            )
        except CollDestination.DoesNotExist:
            raise Http404
        _ensure_destination_slug(dest)
        return redirect("bangladesh:travel_hub_detail", destination_slug=dest.destination_slug, permanent=True)

    try:
        dest = CollDestination.objects.get(
            destination_slug=destination_slug,
            destination_status="published",
        )
    except CollDestination.DoesNotExist:
        raise Http404

    # Increment view (atomic to avoid race conditions)
    CollDestination.objects.filter(blog_bangladesh_coll_destination_id=dest.blog_bangladesh_coll_destination_id).update(
        view_count=F('view_count') + 1
    )

    # Category from unified subcategory table
    try:
        cat = RefContentSubcategory.objects.get(
            content_ref_content_subcategory_id=dest.link_content_ref_content_subcategory_id
        )
        dest.category_name_bn = cat.subcategory_name_bn
        dest.category_name_en = cat.subcategory_name_en
        dest.category_icon = cat.subcategory_icon
    except RefContentSubcategory.DoesNotExist:
        dest.category_name_bn = ""
        dest.category_name_en = ""
        dest.category_icon = ""

    # Season
    if dest.link_blog_bangladesh_ref_season_id:
        try:
            season = RefSeason.objects.get(blog_bangladesh_ref_season_id=dest.link_blog_bangladesh_ref_season_id)
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
        DestinationPhoto.objects.filter(link_blog_bangladesh_coll_destination_id=dest.blog_bangladesh_coll_destination_id)
        .order_by("sort_order")
    )

    # Auto-set cover image from first photo if destination has none
    if photos and not dest.cover_image_url:
        first_photo_url = photos[0].photo_url
        if first_photo_url:
            dest.cover_image_url = first_photo_url
            CollDestination.objects.filter(
                blog_bangladesh_coll_destination_id=dest.blog_bangladesh_coll_destination_id
            ).update(cover_image_url=first_photo_url)

    accommodations = list(
        Accommodation.objects.filter(
            link_blog_bangladesh_coll_destination_id=dest.blog_bangladesh_coll_destination_id, is_active=True
        ).order_by("accommodation_name_en")
    )
    transport = list(
        TransportRoute.objects.filter(
            link_blog_bangladesh_coll_destination_id=dest.blog_bangladesh_coll_destination_id, is_active=True
        ).order_by("sort_order")
    )
    tips = list(
        TravelTip.objects.filter(link_blog_bangladesh_coll_destination_id=dest.blog_bangladesh_coll_destination_id)
        .order_by("-created_at")[:20]
    )
    reviews = list(
        EngagementDestinationReview.objects.filter(link_blog_bangladesh_coll_destination_id=dest.blog_bangladesh_coll_destination_id)
        .order_by("-created_at")[:20]
    )
    youtube_links = list(
        DestinationYoutubeLink.objects.filter(
            link_blog_bangladesh_coll_destination_id=dest.blog_bangladesh_coll_destination_id, is_active=True
        ).order_by("-created_at")
    )
    reference_links = list(
        DestinationReferenceLink.objects.filter(
            link_blog_bangladesh_coll_destination_id=dest.blog_bangladesh_coll_destination_id, is_active=True
        ).order_by("-created_at")
    )

    # Current user's profile + permission flags
    current_user_profile_id = None
    is_staff_or_admin = False
    can_edit = False
    if request.user.is_authenticated:
        is_staff_or_admin = request.user.is_staff or request.user.is_superuser
        if is_staff_or_admin:
            can_edit = True
        else:
            try:
                profile = UserProfile.objects.only("user_profile_id").get(
                    link_user_account_user_id=request.user.pk
                )
                current_user_profile_id = profile.user_profile_id
                can_edit = (dest.link_user_profile_id == current_user_profile_id)
            except UserProfile.DoesNotExist:
                pass

    is_destination_owner = can_edit  # owner or staff

    # Bulk-fetch uploader display names for all contributions
    contributor_profile_ids = set()
    for photo in photos:
        contributor_profile_ids.add(photo.link_user_profile_id)
    for youtube_link in youtube_links:
        contributor_profile_ids.add(youtube_link.link_user_profile_id)
    for reference_link in reference_links:
        contributor_profile_ids.add(reference_link.link_user_profile_id)

    profile_display_names = {}
    if contributor_profile_ids:
        for user_profile in UserProfile.objects.filter(user_profile_id__in=contributor_profile_ids).only("user_profile_id", "display_name"):
            profile_display_names[user_profile.user_profile_id] = user_profile.display_name or "ব্যবহারকারী"

    # Bulk-fetch user likes for photos and videos (avoid N+1)
    user_liked_photo_ids = set()
    user_liked_video_ids = set()
    if current_user_profile_id:
        user_liked_photo_ids = set(
            EngagementDestinationPhotoLike.objects.filter(
                link_user_profile_id=current_user_profile_id,
                link_blog_bangladesh_destination_photo_id__in=[p.blog_bangladesh_destination_photo_id for p in photos],
            ).values_list("link_blog_bangladesh_destination_photo_id", flat=True)
        )
        user_liked_video_ids = set(
            EngagementDestinationVideoLike.objects.filter(
                link_user_profile_id=current_user_profile_id,
                link_blog_bangladesh_destination_youtube_link_id__in=[v.blog_bangladesh_destination_youtube_link_id for v in youtube_links],
            ).values_list("link_blog_bangladesh_destination_youtube_link_id", flat=True)
        )

    # Annotate contributions with uploader name, can_manage, time_ago, user_liked
    for photo in photos:
        photo.uploader_name = profile_display_names.get(photo.link_user_profile_id, "ব্যবহারকারী")
        photo.can_manage = is_staff_or_admin or is_destination_owner or (current_user_profile_id and photo.link_user_profile_id == current_user_profile_id)
        photo.time_ago = _time_ago(photo.created_at)
        photo.user_liked = photo.blog_bangladesh_destination_photo_id in user_liked_photo_ids
    for youtube_link in youtube_links:
        youtube_link.uploader_name = profile_display_names.get(youtube_link.link_user_profile_id, "ব্যবহারকারী")
        youtube_link.can_manage = is_staff_or_admin or is_destination_owner or (current_user_profile_id and youtube_link.link_user_profile_id == current_user_profile_id)
        youtube_link.time_ago = _time_ago(youtube_link.created_at)
        youtube_link.user_liked = youtube_link.blog_bangladesh_destination_youtube_link_id in user_liked_video_ids
    for reference_link in reference_links:
        reference_link.uploader_name = profile_display_names.get(reference_link.link_user_profile_id, "ব্যবহারকারী")
        reference_link.can_manage = is_staff_or_admin or is_destination_owner or (current_user_profile_id and reference_link.link_user_profile_id == current_user_profile_id)
        reference_link.time_ago = _time_ago(reference_link.created_at)

    # Split description into paragraphs, keep inline formatting (bold, color, etc.)
    description_raw = dest.destination_description_bn or dest.destination_description_en or ''
    # Remove block-level <p> and </p> tags so we can re-split by \n
    description_cleaned = re.sub(r'</?p[^>]*>', '\n', description_raw) if description_raw else ''
    description_paragraphs = [paragraph.strip() for paragraph in description_cleaned.split('\n') if paragraph.strip()]

    title = dest.destination_name_bn or dest.destination_name_en
    seo_description = (dest.destination_short_description_bn or dest.destination_short_description_en or "")[:160]
    # Strip HTML tags from description for meta
    seo_description_clean = re.sub(r'<[^>]+>', '', seo_description).strip()

    # OG image: first photo or cover image
    og_image_url = dest.cover_image_url or ""
    if not og_image_url and photos:
        og_image_url = photos[0].photo_url or ""

    # Build canonical URL
    canonical_path = f"/bangladesh-tourist-destinations/travel/{dest.destination_slug}/" if dest.destination_slug else f"/bangladesh-tourist-destinations/travel/id/{dest.blog_bangladesh_coll_destination_id}/"

    # JSON-LD: TouristAttraction schema for Google rich results
    json_ld_attraction = {
        "@context": "https://schema.org",
        "@type": "TouristAttraction",
        "name": dest.destination_name_bn or dest.destination_name_en,
        "description": seo_description_clean,
        "url": request.build_absolute_uri(canonical_path),
    }
    if dest.destination_name_en and dest.destination_name_bn:
        json_ld_attraction["alternateName"] = dest.destination_name_en
    if og_image_url:
        json_ld_attraction["image"] = request.build_absolute_uri(og_image_url)
    if dest.map_formatted_address_bn:
        json_ld_attraction["address"] = {
            "@type": "PostalAddress",
            "addressLocality": dest.map_formatted_address_bn,
            "addressCountry": "BD",
        }
    if dest.destination_latitude and dest.destination_longitude:
        json_ld_attraction["geo"] = {
            "@type": "GeoCoordinates",
            "latitude": float(dest.destination_latitude),
            "longitude": float(dest.destination_longitude),
        }
    if dest.avg_rating and dest.review_count:
        json_ld_attraction["aggregateRating"] = {
            "@type": "AggregateRating",
            "ratingValue": float(dest.avg_rating),
            "reviewCount": dest.review_count,
            "bestRating": 5,
        }

    # Destination like/view/bookmark counts for actions bar
    from amolnama_news.site_apps.core.utils import get_bookmark_count
    destination_like_count = dest.like_count or 0
    destination_view_count = dest.view_count or 0
    destination_bookmark_count = get_bookmark_count('destination', dest.blog_bangladesh_coll_destination_id)
    destination_user_liked = str(dest.blog_bangladesh_coll_destination_id) in request.session.get('destination_likes', [])
    from amolnama_news.site_apps.core.utils import is_bookmarked, get_user_profile_id
    destination_user_bookmarked = is_bookmarked(
        get_user_profile_id(request), 'destination', dest.blog_bangladesh_coll_destination_id,
    )

    # Edit URL for actions bar
    edit_url = ''
    if can_edit:
        from django.urls import reverse
        edit_url = reverse('bangladesh:travel_hub_add') + '?edit=' + str(dest.blog_bangladesh_coll_destination_id)

    # Writer info for actions bar
    from amolnama_news.site_apps.core.utils import build_actions_bar_author_context, build_related_content_items
    actions_bar_author_context = build_actions_bar_author_context(dest.link_user_profile_id, request, profile_suffix='articles/')

    # Record content view for personalization
    if request.user.is_authenticated:
        try:
            from amolnama_news.site_apps.core.utils import get_user_profile_id
            viewer_user_profile_id = get_user_profile_id(request)
            if viewer_user_profile_id:
                from amolnama_news.site_apps.newsengine.personalization import record_content_view
                record_content_view(viewer_user_profile_id, 'destination', dest.blog_bangladesh_coll_destination_id)
        except Exception:
            pass

    return render(request, "bangladesh/pages/travel-hub-detail.html", {
        "dest": dest,
        "description_paragraphs": description_paragraphs,
        "photos": photos,
        "accommodations": accommodations,
        "transport": transport,
        "tips": tips,
        "reviews": reviews,
        "youtube_links": youtube_links,
        "reference_links": reference_links,
        "can_edit": can_edit,
        "edit_url": edit_url,
        "destination_like_count": destination_like_count,
        "destination_view_count": destination_view_count,
        "bookmark_count": destination_bookmark_count,
        "destination_user_liked": destination_user_liked,
        "user_liked": destination_user_liked,
        "user_bookmarked": destination_user_bookmarked,
        "actions_bar_content_registry_id": getattr(dest, 'link_content_registry_id', None),
        **actions_bar_author_context,
        "related_content_items": build_related_content_items(
            dest.destination_description_bn or dest.destination_name_bn or '',
            'destination', dest.blog_bangladesh_coll_destination_id, limit=5,
        ),
        "related_content_api_url": f'/newsengine/api/related-content/?type=destination&id={dest.blog_bangladesh_coll_destination_id}',
        "seo": {
            "title": f"{title} — ভ্রমণ কেন্দ্র | Travel Hub",
            "description": seo_description_clean,
            "og_image": request.build_absolute_uri(og_image_url) if og_image_url else "",
            "og_type": "article",
            "canonical": request.build_absolute_uri(canonical_path),
            "json_ld": json_ld_attraction,
            "breadcrumbs": [
                {"name": "হোম", "url": "/"},
                {"name": "বাংলাদেশ", "url": "/bangladesh-tourist-destinations/"},
                {"name": "ভ্রমণ কেন্দ্র", "url": "/bangladesh-tourist-destinations/travel/"},
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
        RefContentSubcategory.objects.filter(group_code='blog_bangladesh_media_category', is_active=True)
        .order_by("sort_order", "subcategory_name_en")
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

    category_map = {c.content_ref_content_subcategory_id: c for c in categories}
    for media_entry in entries:
        category = category_map.get(media_entry.link_content_ref_content_subcategory_id)
        media_entry.category_name_bn = category.subcategory_name_bn if category else ""
        media_entry.category_icon = category.subcategory_icon if category else ""
        media_entry.time_ago = _time_ago(media_entry.created_at)

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
                {"name": "বাংলাদেশ", "url": "/bangladesh-tourist-destinations/"},
                {"name": "বাংলার রূপ", "url": None},
            ],
        },
    })


@login_required
@ensure_csrf_cookie
def beauty_hub_upload(request):
    """Upload photo/video."""
    categories = list(
        RefContentSubcategory.objects.filter(group_code='blog_bangladesh_media_category', is_active=True)
        .order_by("sort_order", "subcategory_name_en")
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
            "breadcrumbs": [
                {"name": "হোম", "url": "/"},
                {"name": "বাংলাদেশ", "url": "/bangladesh-tourist-destinations/"},
                {"name": "বাংলার রূপ", "url": "/bangladesh-tourist-destinations/beauty/"},
                {"name": "আপলোড", "url": None},
            ],
        },
    })
