"""Poem app — page views."""

from django.contrib.auth.decorators import login_required
from django.http import Http404
from django.shortcuts import render
from django.utils import timezone
from django.views.decorators.csrf import ensure_csrf_cookie

from .models import CollPoemEntry, RefPoemCategory


PAGE_SIZE = 12


def _time_ago(dt):
    """Human-readable time-ago string (Bengali + English)."""
    if not dt:
        return ""
    diff = timezone.now() - dt
    seconds = int(diff.total_seconds())
    if seconds < 60:
        return "এইমাত্র (just now)"
    minutes = seconds // 60
    if minutes < 60:
        return f"{minutes} মিনিট আগে ({minutes}m ago)"
    hours = minutes // 60
    if hours < 24:
        return f"{hours} ঘন্টা আগে ({hours}h ago)"
    days = hours // 24
    if days < 30:
        return f"{days} দিন আগে ({days}d ago)"
    months = days // 30
    return f"{months} মাস আগে ({months}mo ago)"


def _annotate_poem(poem, categories_map):
    """Add display helpers to a poem object."""
    poem.display_title = poem.poem_title_bn or poem.poem_title_en or "শিরোনামহীন"
    body = poem.poem_body_bn or poem.poem_body_en or ""
    poem.body_preview = body[:120].strip()
    cat = categories_map.get(poem.link_poem_ref_poem_category_id)
    poem.category_name = cat.poem_category_name_bn if cat else ""
    poem.category_name_en = cat.poem_category_name_en if cat else ""
    poem.time_ago = _time_ago(poem.created_at)
    return poem


def poem_landing(request):
    """Poem landing page — card grid with server-rendered first page."""
    categories = list(
        RefPoemCategory.objects.filter(is_active=True).order_by("sort_order", "poem_category_name_en")
    )
    categories_map = {c.poem_ref_poem_category_id: c for c in categories}

    poems_qs = CollPoemEntry.objects.order_by("-created_at")[:PAGE_SIZE + 1]
    poems_list = list(poems_qs)
    has_next = len(poems_list) > PAGE_SIZE
    poems_list = poems_list[:PAGE_SIZE]

    for p in poems_list:
        _annotate_poem(p, categories_map)

    return render(request, "poem/pages/poem-landing.html", {
        "categories": categories,
        "poems": poems_list,
        "has_next": has_next,
        "seo": {
            "title": "কবিতা — আমলনামা নিউজ | Poems",
            "description": "কবিতা ও গানের কথা পড়ুন, লিখুন ও শেয়ার করুন। Read, write and share poems & song lyrics.",
            "breadcrumbs": [
                {"name": "হোম", "url": "/"},
                {"name": "কবিতা", "url": None},
            ],
        },
    })


def poem_detail(request, poem_id):
    """Poem detail page — full poem with backstory and interpretation."""
    try:
        poem = CollPoemEntry.objects.get(poem_coll_poem_entry_id=poem_id)
    except CollPoemEntry.DoesNotExist:
        raise Http404

    # Increment view count
    CollPoemEntry.objects.filter(poem_coll_poem_entry_id=poem_id).update(
        view_count=poem.view_count + 1
    )

    categories_map = {
        c.poem_ref_poem_category_id: c
        for c in RefPoemCategory.objects.filter(is_active=True)
    }
    _annotate_poem(poem, categories_map)

    # Check if current user liked this poem
    user_liked = False
    if request.user.is_authenticated:
        from .models import EngPoemLike
        from amolnama_news.site_apps.user_account.models import UserProfile
        try:
            profile = UserProfile.objects.only("user_profile_id").get(
                link_user_account_user_id=request.user.pk
            )
            user_liked = EngPoemLike.objects.filter(
                link_poem_coll_poem_entry_id=poem_id,
                link_user_profile_id=profile.user_profile_id,
            ).exists()
        except UserProfile.DoesNotExist:
            pass

    # Related poems — smart selection: same author, same category, similar categories, popular
    # Never show empty — always find something to recommend
    SIMILAR_CATEGORIES = {
        1: [10, 4, 13, 9, 2], 2: [13, 9, 5, 1, 7], 3: [12, 6, 13, 9, 4],
        4: [1, 10, 13, 9, 5], 5: [13, 2, 9, 4, 1], 6: [12, 3, 13, 9, 4],
        7: [11, 2, 13, 9, 1], 9: [13, 4, 1, 2, 10], 10: [1, 4, 13, 9, 2],
        11: [7, 9, 13, 2, 1], 12: [6, 3, 13, 9, 4], 13: [9, 4, 2, 5, 1],
    }
    current_cat = poem.link_poem_ref_poem_category_id
    base_related = CollPoemEntry.objects.exclude(poem_coll_poem_entry_id=poem_id)
    related_ids = set()
    related = []

    # Priority 1: Same author + same category
    for r in base_related.filter(
        poem_author_display_name=poem.poem_author_display_name,
        link_poem_ref_poem_category_id=current_cat,
    ).order_by("-like_count")[:4]:
        if r.poem_coll_poem_entry_id not in related_ids:
            related.append(r)
            related_ids.add(r.poem_coll_poem_entry_id)

    # Priority 2: Same category
    if len(related) < 4:
        for r in base_related.filter(
            link_poem_ref_poem_category_id=current_cat,
        ).exclude(poem_coll_poem_entry_id__in=related_ids).order_by("-like_count")[:4 - len(related)]:
            related.append(r)
            related_ids.add(r.poem_coll_poem_entry_id)

    # Priority 3: Similar categories
    if len(related) < 4:
        for similar_cat in SIMILAR_CATEGORIES.get(current_cat, []):
            if len(related) >= 4:
                break
            for r in base_related.filter(
                link_poem_ref_poem_category_id=similar_cat,
            ).exclude(poem_coll_poem_entry_id__in=related_ids).order_by("-like_count")[:4 - len(related)]:
                related.append(r)
                related_ids.add(r.poem_coll_poem_entry_id)

    # Priority 4: Any remaining by popularity
    if len(related) < 4:
        for r in base_related.exclude(
            poem_coll_poem_entry_id__in=related_ids,
        ).order_by("-like_count", "-view_count")[:4 - len(related)]:
            related.append(r)
            related_ids.add(r.poem_coll_poem_entry_id)

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

    title = poem.display_title
    body_preview = (poem.poem_body_bn or poem.poem_body_en or "")[:160]
    og_image_path = f"/poem/{poem_id}/og-image.png"

    return render(request, "poem/pages/poem-detail.html", {
        "poem": poem,
        "user_liked": user_liked,
        "can_edit": can_edit,
        "related_poems": related,
        "og": {
            "title": title + " — " + poem.poem_author_display_name,
            "description": body_preview,
            "image": og_image_path,
            "url": f"/poem/{poem_id}/",
            "type": "article",
        },
        "seo": {
            "title": f"{title} — আমলনামা নিউজ | Poem",
            "description": body_preview,
            "breadcrumbs": [
                {"name": "হোম", "url": "/"},
                {"name": "কবিতা", "url": "/poem/"},
                {"name": title, "url": None},
            ],
        },
    })


@login_required
@ensure_csrf_cookie
def poem_edit(request, poem_id):
    """Poem edit form — only the author or admin can edit."""
    try:
        poem = CollPoemEntry.objects.get(poem_coll_poem_entry_id=poem_id)
    except CollPoemEntry.DoesNotExist:
        raise Http404

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
        RefPoemCategory.objects.filter(is_active=True).order_by("sort_order", "poem_category_name_en")
    )

    title = poem.poem_title_bn or poem.poem_title_en or "শিরোনামহীন"
    return render(request, "poem/pages/poem-edit.html", {
        "poem": poem,
        "categories": categories,
        "seo": {
            "title": f"সম্পাদনা — {title} | Edit Poem",
            "description": "কবিতা সম্পাদনা করুন। Edit your poem.",
            "breadcrumbs": [
                {"name": "হোম", "url": "/"},
                {"name": "কবিতা", "url": "/poem/"},
                {"name": title, "url": f"/poem/{poem_id}/"},
                {"name": "সম্পাদনা", "url": None},
            ],
        },
    })


@login_required
@ensure_csrf_cookie
def poem_create(request):
    """Poem creation form."""
    categories = list(
        RefPoemCategory.objects.filter(is_active=True).order_by("sort_order", "poem_category_name_en")
    )
    return render(request, "poem/pages/poem-create.html", {
        "categories": categories,
        "seo": {
            "title": "কবিতা লিখুন — আমলনামা নিউজ | Write a Poem",
            "description": "আপনার কবিতা বা গানের কথা শেয়ার করুন। Share your poem or song lyrics.",
            "breadcrumbs": [
                {"name": "হোম", "url": "/"},
                {"name": "কবিতা", "url": "/poem/"},
                {"name": "কবিতা লিখুন", "url": None},
            ],
        },
    })
