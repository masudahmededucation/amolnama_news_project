"""Poem app — page views."""

from amolnama_news.site_apps.core.utils import time_ago as _time_ago

from django.contrib.auth.decorators import login_required
from django.db.models import F
from django.http import Http404
from django.shortcuts import redirect, render
from django.urls import reverse
from django.utils import timezone
from amolnama_news.site_apps.core.utils import english_slug_from_text
from django.views.decorators.csrf import ensure_csrf_cookie

from .helpers import get_smart_related_poems
from amolnama_news.site_apps.content.models import RefContentSubcategory
from .models import CollPoemEntry


PAGE_SIZE = 12


def _ensure_poem_slug(poem):
    """Generate Bengali slug from author + title if missing."""
    if poem.poem_slug:
        return
    # Build slug: author-name + poem-title (Bengali preferred)
    parts = []
    if poem.poem_author_display_name:
        parts.append(poem.poem_author_display_name)
    title = poem.poem_title_bn or poem.poem_title_en or ""
    if title:
        parts.append(title)
    if not parts:
        parts.append(str(poem.blog_poem_coll_poem_entry_id))

    slug = english_slug_from_text(text_bn="-".join(parts))
    if not slug:
        slug = str(poem.blog_poem_coll_poem_entry_id)

    # Ensure uniqueness
    candidate = slug[:450]  # Leave room for counter suffix
    counter = 1
    while CollPoemEntry.objects.filter(poem_slug=candidate).exclude(
        blog_poem_coll_poem_entry_id=poem.blog_poem_coll_poem_entry_id
    ).exists():
        candidate = f"{slug[:445]}-{counter}"
        counter += 1
    poem.poem_slug = candidate
    poem.save(update_fields=["poem_slug"])


def poem_detail_by_id(request, poem_id):
    """Old ID-based URL → redirect to Bengali slug URL."""
    try:
        poem = CollPoemEntry.objects.get(blog_poem_coll_poem_entry_id=poem_id)
    except CollPoemEntry.DoesNotExist:
        raise Http404
    _ensure_poem_slug(poem)
    return redirect("poem:poem_detail", poem_slug=poem.poem_slug, permanent=True)


def poem_detail_by_slug(request, poem_slug):
    """Poem detail — SEO-friendly Bengali slug URL."""
    # If slug is numeric (old ID-based URL), look up by ID and redirect to slug
    if poem_slug.isdigit():
        try:
            poem = CollPoemEntry.objects.get(blog_poem_coll_poem_entry_id=int(poem_slug))
        except CollPoemEntry.DoesNotExist:
            raise Http404
        _ensure_poem_slug(poem)
        return redirect("poem:poem_detail", poem_slug=poem.poem_slug, permanent=True)

    try:
        poem = CollPoemEntry.objects.get(poem_slug=poem_slug)
    except CollPoemEntry.DoesNotExist:
        raise Http404
    return _render_poem_detail(request, poem)



def _annotate_poem(poem, categories_map):
    """Add display helpers to a poem object."""
    poem.display_title = poem.poem_title_bn or poem.poem_title_en or "শিরোনামহীন"
    body = poem.poem_body_bn or poem.poem_body_en or ""
    poem.body_preview = body[:120].strip()
    cat = categories_map.get(poem.link_content_ref_content_subcategory_id)
    poem.category_name = cat.subcategory_name_bn if cat else ""
    poem.category_name_en = cat.subcategory_name_en if cat else ""
    poem.time_ago = _time_ago(poem.created_at)
    return poem


def poem_landing(request):
    """Poem landing page — card grid with server-rendered first page."""
    from amolnama_news.site_apps.content.models import RefContentSubcategory
    categories = list(
        RefContentSubcategory.objects.filter(group_code='blog_poem_category', is_active=True).order_by("sort_order")
    )
    categories_map = {c.content_ref_content_subcategory_id: c for c in categories}

    poems_qs = CollPoemEntry.objects.order_by("-created_at")[:PAGE_SIZE + 1]
    poems_list = list(poems_qs)
    has_next = len(poems_list) > PAGE_SIZE
    poems_list = poems_list[:PAGE_SIZE]

    for p in poems_list:
        _annotate_poem(p, categories_map)

    canonical_url = request.build_absolute_uri(reverse("poem:poem_landing"))
    return render(request, "poem/pages/poem-landing.html", {
        "categories": categories,
        "poems": poems_list,
        "has_next": has_next,
        "seo": {
            "title": "কবিতা — আমলনামা নিউজ | Poems",
            "description": "কবিতা ও গানের কথা পড়ুন, লিখুন ও শেয়ার করুন। Read, write and share poems & song lyrics.",
            "canonical": canonical_url,
            "og_type": "website",
            "json_ld": {
                "@context": "https://schema.org",
                "@type": "CollectionPage",
                "name": "কবিতা ও গান",
                "description": "কবিতা ও গানের কথা পড়ুন, লিখুন ও শেয়ার করুন।",
                "url": canonical_url,
                "inLanguage": "bn",
            },
            "breadcrumbs": [
                {"name": "হোম", "url": "/"},
                {"name": "কবিতা", "url": None},
            ],
        },
    })


def _render_poem_detail(request, poem):
    """Render poem detail page — shared by slug and ID views."""
    poem_id = poem.blog_poem_coll_poem_entry_id

    # Increment view count (atomic)
    CollPoemEntry.objects.filter(blog_poem_coll_poem_entry_id=poem_id).update(
        view_count=F('view_count') + 1
    )

    categories_map = {
        c.content_ref_content_subcategory_id: c
        for c in RefContentSubcategory.objects.filter(group_code='blog_poem_category', is_active=True)
    }
    _annotate_poem(poem, categories_map)

    # Check if current user liked / bookmarked this poem
    from amolnama_news.site_apps.core.utils import is_bookmarked, get_bookmark_count, get_user_profile_id
    current_profile_id = get_user_profile_id(request)
    user_liked = False
    if current_profile_id:
        from .models import EngagementPoemLike
        user_liked = EngagementPoemLike.objects.filter(
            link_blog_poem_coll_poem_entry_id=poem_id,
            link_user_profile_id=current_profile_id,
        ).exists()
    user_bookmarked = is_bookmarked(current_profile_id, 'poem', poem_id)
    bookmark_count = get_bookmark_count('poem', poem_id)

    # Related poems — shared smart logic (same function used by autoplay API)
    related = get_smart_related_poems(poem, limit=4)
    for r in related:
        _annotate_poem(r, categories_map)

    # Can edit: admin or the poem's author
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
                can_edit = (poem.link_user_profile_id == profile.user_profile_id)
            except UserProfile.DoesNotExist:
                pass

    # Ensure slug exists for URL generation
    _ensure_poem_slug(poem)

    title = poem.display_title
    body_preview = (poem.poem_body_bn or poem.poem_body_en or "")[:160]
    poem_detail_path = reverse("poem:poem_detail", kwargs={"poem_slug": poem.poem_slug})
    og_image_path = reverse("poem:poem_og_image", kwargs={"poem_slug": poem.poem_slug})
    canonical_url = request.build_absolute_uri(poem_detail_path)
    poem_landing_path = reverse("poem:poem_landing")

    # JSON-LD: CreativeWork schema for search engines
    json_ld_poem = {
        "@context": "https://schema.org",
        "@type": "CreativeWork",
        "name": title,
        "headline": title,
        "description": body_preview,
        "url": canonical_url,
        "image": request.build_absolute_uri(og_image_path),
        "inLanguage": "bn",
        "genre": "Poetry",
        "author": {
            "@type": "Person",
            "name": poem.poem_author_display_name,
        },
    }
    if poem.created_at:
        json_ld_poem["datePublished"] = poem.created_at.isoformat()
    if poem.updated_at:
        json_ld_poem["dateModified"] = poem.updated_at.isoformat()
    if getattr(poem, 'category_name', ''):
        json_ld_poem["genre"] = poem.category_name

    # Writer info for actions bar
    from amolnama_news.site_apps.core.utils import build_actions_bar_author_context, build_related_content_items
    actions_bar_author_context = build_actions_bar_author_context(
        getattr(poem, 'link_user_profile_id', None), request, profile_suffix='articles/'
    )

    return render(request, "poem/pages/poem-detail.html", {
        "poem": poem,
        "user_liked": user_liked,
        "user_bookmarked": user_bookmarked,
        "bookmark_count": bookmark_count,
        "can_edit": can_edit,
        "edit_url": reverse('poem:poem_edit', args=[poem.poem_slug]) if can_edit else None,
        "related_poems": related,
        "actions_bar_content_registry_id": getattr(poem, 'link_content_registry_id', None),
        **actions_bar_author_context,
        "og": {
            "title": title + " — " + poem.poem_author_display_name,
            "description": body_preview,
            "image": og_image_path,
            "url": poem_detail_path,
            "type": "article",
        },
        "seo": {
            "title": f"{title} — আমলনামা নিউজ | Poem",
            "description": body_preview,
            "og_image": request.build_absolute_uri(og_image_path),
            "og_type": "article",
            "canonical": canonical_url,
            "json_ld": json_ld_poem,
            "breadcrumbs": [
                {"name": "হোম", "url": "/"},
                {"name": "কবিতা ও গান", "url": poem_landing_path},
                {"name": title, "url": None},
            ],
        },
    })


@login_required
@ensure_csrf_cookie
def poem_edit(request, poem_slug):
    """Poem edit form — only the author or admin can edit."""
    # Handle numeric slug (old ID-based URL)
    if poem_slug.isdigit():
        try:
            poem = CollPoemEntry.objects.get(blog_poem_coll_poem_entry_id=int(poem_slug))
        except CollPoemEntry.DoesNotExist:
            raise Http404
        _ensure_poem_slug(poem)
        return redirect("poem:poem_edit", poem_slug=poem.poem_slug, permanent=True)

    try:
        poem = CollPoemEntry.objects.get(poem_slug=poem_slug)
    except CollPoemEntry.DoesNotExist:
        raise Http404
    poem_id = poem.blog_poem_coll_poem_entry_id

    # Permission check: admin or owner
    from amolnama_news.site_apps.user_account.models import UserProfile
    if not (request.user.is_staff or request.user.is_superuser):
        try:
            profile = UserProfile.objects.only("user_profile_id").get(
                link_user_account_user_id=request.user.pk
            )
            if poem.link_user_profile_id != profile.user_profile_id:
                raise Http404
        except UserProfile.DoesNotExist:
            raise Http404

    categories = list(
        RefContentSubcategory.objects.filter(group_code='blog_poem_category', is_active=True).order_by("sort_order")
    )

    title = poem.poem_title_bn or poem.poem_title_en or "শিরোনামহীন"
    canonical_url = request.build_absolute_uri(reverse("poem:poem_edit", kwargs={"poem_slug": poem.poem_slug}))
    return render(request, "poem/pages/poem-edit.html", {
        "poem": poem,
        "categories": categories,
        "seo": {
            "title": f"সম্পাদনা — {title} | Edit Poem",
            "description": "কবিতা সম্পাদনা করুন। Edit your poem.",
            "canonical": canonical_url,
            "og_type": "website",
            "breadcrumbs": [
                {"name": "হোম", "url": "/"},
                {"name": "কবিতা ও গান", "url": reverse("poem:poem_landing")},
                {"name": title, "url": reverse("poem:poem_detail", kwargs={"poem_slug": poem.poem_slug})},
                {"name": "সম্পাদনা", "url": None},
            ],
        },
    })


@login_required
@ensure_csrf_cookie
def poem_create(request):
    """Poem creation form."""
    categories = list(
        RefContentSubcategory.objects.filter(group_code='blog_poem_category', is_active=True).order_by("sort_order")
    )
    canonical_url = request.build_absolute_uri(reverse("poem:poem_create"))
    return render(request, "poem/pages/poem-create.html", {
        "categories": categories,
        "seo": {
            "title": "কবিতা লিখুন — আমলনামা নিউজ | Write a Poem",
            "description": "আপনার কবিতা বা গানের কথা শেয়ার করুন। Share your poem or song lyrics.",
            "canonical": canonical_url,
            "og_type": "website",
            "breadcrumbs": [
                {"name": "হোম", "url": "/"},
                {"name": "কবিতা ও গান", "url": reverse("poem:poem_landing")},
                {"name": "কবিতা লিখুন", "url": None},
            ],
        },
    })
