from django.shortcuts import render
from .models import Article


def home(request):
    context = {
        "seo": {
            "title": "আমলনামা নিউজ — সত্যই আমাদের শক্তি | Amolnama News",
            "description": (
                "আমলনামা নিউজ — বাংলাদেশের স্বাধীন সংবাদ মাধ্যম। রাজনীতি, অপরাধ, খেলাধুলা, "
                "বিনোদন, তদন্ত ও জনকণ্ঠ। Amolnama News — Bangladesh's independent news platform."
            ),
            "og_type": "website",
            "breadcrumbs": [{"name": "হোম", "url": "/"}],
        },
    }
    return render(request, "core/home.html", context)


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
