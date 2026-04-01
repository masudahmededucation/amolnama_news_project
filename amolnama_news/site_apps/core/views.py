from django.shortcuts import redirect, render
from .models import Article


def home(request):
    """Homepage — pulse feed with tabs (For You / Following / My Posts)."""
    from amolnama_news.site_apps.post.views import build_post_feed_items, _build_my_posts

    active_tab = request.GET.get('tab', 'for_you')

    if active_tab == 'my_posts' and request.user.is_authenticated:
        post_items, current_user_avatar_url = _build_my_posts(request)
    elif active_tab == 'following' and request.user.is_authenticated:
        from amolnama_news.site_apps.post.views import _build_following_posts
        from amolnama_news.site_apps.social.models import UserFollow
        from amolnama_news.site_apps.user_account.models import UserProfile as FollowUserProfile
        post_items, current_user_avatar_url = _build_following_posts(request)
        try:
            follow_profile = FollowUserProfile.objects.get(link_user_account_user_id=request.user.pk)
            following_count = UserFollow.objects.filter(link_follower_user_profile_id=follow_profile.user_profile_id, is_active=True).count()
        except FollowUserProfile.DoesNotExist:
            following_count = 0
    else:
        active_tab = 'for_you'
        post_items, current_user_avatar_url = build_post_feed_items(request)

    # Inject promo cards from ALL content apps — sorted by date, latest on top
    # To add a new app: add a builder function in core/promo_builders.py
    if active_tab == 'for_you':
        from .promo_builders import build_all_promo_items
        all_promo_items = build_all_promo_items()
        for index, promo in enumerate(all_promo_items):
            post_items.insert(index, promo)

    return render(request, 'pulse/pages/pulse-home.html', {
        'posts': post_items,
        'current_user_avatar_url': current_user_avatar_url,
        'active_tab': active_tab,
        'following_count': following_count if active_tab == 'following' else 0,
        'seo': {
            'title': 'আমলনামা নিউজ — সত্যই আমাদের শক্তি | Amolnama News',
            'description': 'আমলনামা নিউজ — বাংলাদেশের স্বাধীন সংবাদ মাধ্যম।',
            'og_type': 'website',
        },
    })


def article_detail(request, slug):
    article = Article.objects.filter(slug=slug).first()
    if not article:
        context = {
            "message": "This article is no longer available.",
            "slug": slug,
            "seo": {"noindex": True},
        }
        return render(request, "core/article_not_found.html", context)

    # Build article description from body (first 160 chars)
    description = (article.body or "")[:160].strip()
    if len(article.body or "") > 160:
        description += "..."

    # Build OG image
    og_image = None
    if article.hero_image:
        og_image = request.build_absolute_uri(article.hero_image.url)

    # JSON-LD NewsArticle schema
    article_ld = {
        "@context": "https://schema.org",
        "@type": "NewsArticle",
        "headline": article.title,
        "description": description,
        "author": {
            "@type": "Person",
            "name": article.author or "Amolnama News",
        },
        "publisher": {
            "@type": "Organization",
            "name": "Amolnama News",
            "logo": {
                "@type": "ImageObject",
                "url": request.build_absolute_uri("/static/core/assets/img/logo.png"),
            },
        },
        "mainEntityOfPage": {
            "@type": "WebPage",
            "@id": request.build_absolute_uri(),
        },
    }
    if article.published_at:
        article_ld["datePublished"] = article.published_at.isoformat()
    if article.hero_image:
        article_ld["image"] = og_image
    if article.read_time:
        article_ld["timeRequired"] = f"PT{article.read_time}M"

    context = {
        "article": article,
        "seo": {
            "title": f"{article.title} — আমলনামা নিউজ",
            "description": description,
            "og_type": "article",
            "og_image": og_image,
            "json_ld": article_ld,
            "breadcrumbs": [
                {"name": "হোম", "url": "/"},
                {"name": article.section or "Article", "url": f"/category/{article.section}/" if article.section else "/"},
                {"name": article.title, "url": f"/article/{article.slug}/"},
            ],
        },
    }
    return render(request, "core/article_detail.html", context)


def category(request, slug):
    context = {
        "slug": slug,
        "seo": {
            "title": f"{slug.replace('-', ' ').title()} — আমলনামা নিউজ",
            "description": f"{slug.replace('-', ' ').title()} বিভাগের সকল খবর — আমলনামা নিউজ। "
                           f"Latest news from the {slug.replace('-', ' ')} section.",
            "breadcrumbs": [
                {"name": "হোম", "url": "/"},
                {"name": slug.replace("-", " ").title(), "url": f"/category/{slug}/"},
            ],
        },
    }
    return render(request, "core/category.html", context)


def about(request):
    context = {
        "seo": {
            "title": "আমাদের সম্পর্কে — আমলনামা নিউজ | About Us",
            "description": (
                "আমলনামা নিউজ সম্পর্কে জানুন — বাংলাদেশের স্বাধীন সংবাদ মাধ্যম। "
                "Learn about Amolnama News — Bangladesh's independent news platform."
            ),
            "breadcrumbs": [
                {"name": "হোম", "url": "/"},
                {"name": "আমাদের সম্পর্কে", "url": "/about/"},
            ],
        },
    }
    return render(request, "core/about.html", context)


def contact(request):
    context = {
        "seo": {
            "title": "যোগাযোগ — আমলনামা নিউজ | Contact Us",
            "description": (
                "আমলনামা নিউজের সাথে যোগাযোগ করুন। "
                "Contact Amolnama News for tips, inquiries, and collaborations."
            ),
            "breadcrumbs": [
                {"name": "হোম", "url": "/"},
                {"name": "যোগাযোগ", "url": "/contact/"},
            ],
        },
    }
    return render(request, "core/contact.html", context)


def communityvoice(request):
    context = {
        "seo": {
            "title": "জনকণ্ঠ — আমলনামা নিউজ | Community Voice",
            "description": (
                "জনকণ্ঠ — জনগণের কথা, জনগণের মঞ্চ। "
                "Community Voice — a platform for citizen journalism and public opinion."
            ),
            "breadcrumbs": [
                {"name": "হোম", "url": "/"},
                {"name": "জনকণ্ঠ", "url": "/communityvoice/"},
            ],
        },
    }
    return render(request, "core/communityvoice.html", context)
