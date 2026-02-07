from django.shortcuts import render
from .models import Article


def home(request):
    return render(request, "core/home.html")


def article_detail(request, slug):
    article = Article.objects.filter(slug=slug).first()
    if not article:
        context = {
            'message': 'This article is no longer available.',
            'slug': slug
        }
        return render(request, "core/article_not_found.html", context)
    return render(request, "core/article_detail.html", {"article": article})

# Remove duplicate - keep only one category function
def category(request, slug):
    context = {
        #"latest_articles": latest_articles,
        "slug": slug,  # Changed from "category_slug" to "slug"
    }
    return render(request, "core/category.html", context)


def about(request):
    return render(request, "core/about.html")


def contact(request):
    return render(request, "core/contact.html")


def communityvoice(request):
    return render(request, "core/communityvoice.html")


