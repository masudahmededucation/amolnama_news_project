"""Art & Craft views — landing, detail, upload pages."""

from django.contrib.auth.decorators import login_required
from amolnama_news.site_apps.core.utils import time_ago as _calculate_time_ago
from django.http import Http404
from django.shortcuts import render
from django.views.decorators.csrf import ensure_csrf_cookie

from .models import (
    RefArtCategory, RefArtMedium, RefArtDifficulty,
    CollArtwork, ArtworkAsset, ArtworkStep,
    ArtworkYoutubeLink, EngagementArtworkLike, EngagementArtworkBookmark,
)


def _get_artwork_cover_url(artwork_id):
    """Get cover image URL for an artwork via raw SQL (file_storage_path is computed)."""
    from django.db import connection
    with connection.cursor() as cursor:
        cursor.execute("""
            SELECT a.[file_storage_path]
            FROM [blog_art].[artwork_asset] aa
            JOIN [media].[asset] a ON a.[asset_id] = aa.[link_asset_id]
            WHERE aa.[link_artwork_id] = %s AND aa.[is_cover] = 1 AND aa.[is_active] = 1
        """, [artwork_id])
        row = cursor.fetchone()
    return row[0] if row else None


def _get_artwork_photos(artwork_id):
    """Get all photos for an artwork via raw SQL."""
    from django.db import connection
    photos = []
    with connection.cursor() as cursor:
        cursor.execute("""
            SELECT aa.[art_artwork_asset_id], a.[file_storage_path], aa.[caption_bn],
                   aa.[asset_group_code], aa.[is_cover]
            FROM [blog_art].[artwork_asset] aa
            JOIN [media].[asset] a ON a.[asset_id] = aa.[link_asset_id]
            WHERE aa.[link_artwork_id] = %s AND aa.[is_active] = 1
            ORDER BY aa.[is_cover] DESC, aa.[sort_order] ASC
        """, [artwork_id])
        for row in cursor.fetchall():
            photos.append({
                'asset_id': row[0],
                'file_url': row[1],
                'caption_bn': row[2],
                'asset_group_code': row[3],
                'is_cover': row[4],
            })
    return photos



@ensure_csrf_cookie
def home(request):
    """Art & Craft landing page — gallery grid with category filters."""
    category_filter = request.GET.get('category', '')
    medium_filter = request.GET.get('medium', '')

    artworks_queryset = CollArtwork.objects.filter(
        is_published=True, is_active=True,
    )
    if category_filter:
        artworks_queryset = artworks_queryset.filter(link_art_category_id=category_filter)
    if medium_filter:
        artworks_queryset = artworks_queryset.filter(link_art_medium_id=medium_filter)
    artworks = artworks_queryset.order_by('-is_featured', '-created_at')[:60]

    # Build artwork items with cover images
    artwork_ids = [artwork.art_coll_artwork_id for artwork in artworks]
    cover_map = {}
    if artwork_ids:
        from django.db import connection
        with connection.cursor() as cursor:
            placeholders = ','.join(['%s'] * len(artwork_ids))
            cursor.execute(f"""
                SELECT aa.[link_artwork_id], a.[file_storage_path]
                FROM [blog_art].[artwork_asset] aa
                JOIN [media].[asset] a ON a.[asset_id] = aa.[link_asset_id]
                WHERE aa.[link_artwork_id] IN ({placeholders}) AND aa.[is_cover] = 1 AND aa.[is_active] = 1
            """, artwork_ids)
            for row in cursor.fetchall():
                cover_map[row[0]] = row[1]

    # Build category map
    category_map = {
        category.art_ref_art_category_id: category
        for category in RefArtCategory.objects.filter(is_active=True).order_by('sort_order')
    }

    # Build author display names
    from amolnama_news.site_apps.user_account.models import UserProfile
    author_ids = set(artwork.link_user_profile_id for artwork in artworks)
    author_map = {}
    if author_ids:
        for profile in UserProfile.objects.filter(user_profile_id__in=author_ids):
            author_map[profile.user_profile_id] = profile.display_name or 'শিল্পী'

    artwork_items = []
    for artwork in artworks:
        category = category_map.get(artwork.link_art_category_id)
        artwork_items.append({
            'artwork_id': artwork.art_coll_artwork_id,
            'title_bn': artwork.artwork_title_bn,
            'title_en': artwork.artwork_title_en,
            'slug': artwork.artwork_slug,
            'cover_url': cover_map.get(artwork.art_coll_artwork_id),
            'category_name_bn': category.art_category_name_bn if category else '',
            'category_icon': category.art_category_icon if category else '',
            'author_name': author_map.get(artwork.link_user_profile_id, 'শিল্পী'),
            'like_count': artwork.like_count,
            'view_count': artwork.view_count,
            'is_tutorial': artwork.is_tutorial,
            'time_ago': _calculate_time_ago(artwork.created_at),
        })

    categories = RefArtCategory.objects.filter(is_active=True).order_by('sort_order')
    mediums = RefArtMedium.objects.filter(is_active=True).order_by('sort_order')

    return render(request, 'art/pages/art-landing.html', {
        'artwork_items': artwork_items,
        'categories': categories,
        'mediums': mediums,
        'active_category': category_filter,
        'active_medium': medium_filter,
        'seo': {
            'title': 'শিল্পকলা — বাংলার ঐতিহ্যবাহী ও আধুনিক শিল্প | আমলনামা নিউজ',
            'description': 'নকশি কাঁথা, পটচিত্র, আলপনা, মৃৎশিল্প — বাংলাদেশের শিল্পকলা সংগ্রহ।',
            'breadcrumbs': [{'name': 'হোম', 'url': '/'}, {'name': 'শিল্পকলা'}],
        },
    })


@ensure_csrf_cookie
def detail(request, artwork_slug):
    """Artwork detail page."""
    try:
        artwork = CollArtwork.objects.get(artwork_slug=artwork_slug, is_active=True)
    except CollArtwork.DoesNotExist:
        raise Http404

    # Author info
    from amolnama_news.site_apps.user_account.models import UserProfile
    author_profile = None
    try:
        author_profile = UserProfile.objects.get(user_profile_id=artwork.link_user_profile_id)
    except UserProfile.DoesNotExist:
        pass

    # Category & medium & difficulty
    category = RefArtCategory.objects.filter(art_ref_art_category_id=artwork.link_art_category_id).first()
    medium = RefArtMedium.objects.filter(art_ref_art_medium_id=artwork.link_art_medium_id).first() if artwork.link_art_medium_id else None
    difficulty = RefArtDifficulty.objects.filter(art_ref_art_difficulty_id=artwork.link_art_difficulty_id).first() if artwork.link_art_difficulty_id else None

    # Photos
    photos = _get_artwork_photos(artwork.art_coll_artwork_id)

    # Tutorial steps
    steps = list(ArtworkStep.objects.filter(
        link_artwork_id=artwork.art_coll_artwork_id, is_active=True,
    ).order_by('step_number'))

    # YouTube links
    youtube_links = list(ArtworkYoutubeLink.objects.filter(
        link_artwork_id=artwork.art_coll_artwork_id, is_active=True,
    ))

    # User interaction state
    user_liked = False
    user_bookmarked = False
    can_edit = False
    if request.user.is_authenticated:
        try:
            current_profile = UserProfile.objects.get(link_user_account_user_id=request.user.pk)
            current_profile_id = current_profile.user_profile_id
            user_liked = EngagementArtworkLike.objects.filter(
                link_artwork_id=artwork.art_coll_artwork_id,
                link_user_profile_id=current_profile_id, is_active=True,
            ).exists()
            user_bookmarked = EngagementArtworkBookmark.objects.filter(
                link_artwork_id=artwork.art_coll_artwork_id,
                link_user_profile_id=current_profile_id, is_active=True,
            ).exists()
            can_edit = artwork.link_user_profile_id == current_profile_id or request.user.is_staff
        except UserProfile.DoesNotExist:
            pass

    artwork_item = {
        'artwork_id': artwork.art_coll_artwork_id,
        'title_bn': artwork.artwork_title_bn,
        'title_en': artwork.artwork_title_en,
        'slug': artwork.artwork_slug,
        'description_bn': artwork.artwork_description_bn,
        'backstory_bn': artwork.artwork_backstory_bn,
        'materials_bn': artwork.artwork_materials_bn,
        'materials_en': artwork.artwork_materials_en,
        'dimensions_en': artwork.artwork_dimensions_en,
        'is_tutorial': artwork.is_tutorial,
        'is_for_sale': artwork.is_for_sale,
        'estimated_time_minutes': artwork.estimated_time_minutes,
        'like_count': artwork.like_count,
        'view_count': artwork.view_count,
        'bookmark_count': artwork.bookmark_count,
        'comment_count': artwork.comment_count,
        'user_liked': user_liked,
        'user_bookmarked': user_bookmarked,
        'can_edit': can_edit,
        'time_ago': _calculate_time_ago(artwork.created_at),
        'created_at_formatted': artwork.created_at.strftime('%d %b %Y') if artwork.created_at else '',
        'author_name': author_profile.display_name if author_profile and author_profile.display_name else 'শিল্পী',
        'category_name_bn': category.art_category_name_bn if category else '',
        'category_icon': category.art_category_icon if category else '',
        'medium_name_bn': medium.art_medium_name_bn if medium else '',
        'difficulty_name_bn': difficulty.art_difficulty_name_bn if difficulty else '',
        'photos': photos,
        'steps': steps,
        'youtube_links': youtube_links,
    }

    cover_url = photos[0]['file_url'] if photos else ''

    # Writer info for actions bar
    from amolnama_news.site_apps.core.utils import build_actions_bar_author_context, build_related_content_items
    actions_bar_author_context = build_actions_bar_author_context(artwork.link_user_profile_id, request)

    # Record content view for personalization
    if request.user.is_authenticated:
        try:
            from amolnama_news.site_apps.core.utils import get_user_profile_id
            viewer_user_profile_id = get_user_profile_id(request)
            if viewer_user_profile_id:
                from amolnama_news.site_apps.newsengine.personalization import record_content_view
                record_content_view(viewer_user_profile_id, 'art', artwork.art_coll_artwork_id)
        except Exception:
            pass

    return render(request, 'art/pages/art-detail.html', {
        'artwork': artwork_item,
        **actions_bar_author_context,
        'related_content_items': build_related_content_items(
            artwork.artwork_title_bn or artwork.artwork_description_bn or '',
            'art', artwork.art_coll_artwork_id, limit=5,
        ),
        'related_content_api_url': f'/newsengine/api/related-content/?type=art&id={artwork.art_coll_artwork_id}',
        'seo': {
            'title': f'{artwork.artwork_title_bn} — শিল্পকলা | আমলনামা নিউজ',
            'description': (artwork.artwork_description_bn or artwork.artwork_title_bn)[:200],
            'og_image': request.build_absolute_uri(cover_url) if cover_url else '',
            'og_type': 'article',
            'breadcrumbs': [{'name': 'হোম', 'url': '/'}, {'name': 'শিল্পকলা', 'url': '/art-and-craft/'}, {'name': (artwork.artwork_title_bn or '')[:40]}],
        },
    })


@login_required
@ensure_csrf_cookie
def upload(request):
    """Art upload page — create new artwork."""
    categories = RefArtCategory.objects.filter(is_active=True).order_by('sort_order')
    mediums = RefArtMedium.objects.filter(is_active=True).order_by('sort_order')
    difficulties = RefArtDifficulty.objects.filter(is_active=True).order_by('sort_order')

    return render(request, 'art/pages/art-upload.html', {
        'categories': categories,
        'mediums': mediums,
        'difficulties': difficulties,
        'seo': {
            'title': 'শিল্পকর্ম আপলোড — শিল্পকলা | আমলনামা নিউজ',
            'breadcrumbs': [{'name': 'হোম', 'url': '/'}, {'name': 'শিল্পকলা', 'url': '/art-and-craft/'}, {'name': 'আপলোড'}],
        },
    })
