from django.shortcuts import render


def home(request):
    return render(request, "core/home.html")


def article_detail(request, slug):
    return render(request, "core/article_detail.html", {"slug": slug})

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