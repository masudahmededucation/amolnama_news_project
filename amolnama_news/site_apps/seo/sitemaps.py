"""Sitemap classes for all public pages.

Django's sitemap framework generates /sitemap.xml automatically.
Each class represents a group of URLs with their own priority and changefreq.
"""

from django.contrib.sitemaps import Sitemap
from django.urls import reverse

from amolnama_news.site_apps.core.models import Article


class StaticPageSitemap(Sitemap):
    """Static pages: home, about, contact, communityvoice."""
    changefreq = "weekly"
    priority = 0.8
    protocol = "https"

    def items(self):
        return [
            "core:home",
            "core:about",
            "core:contact",
            "core:communityvoice",
        ]

    def location(self, item):
        return reverse(item)


class ArticleSitemap(Sitemap):
    """All published articles."""
    changefreq = "daily"
    priority = 0.9
    protocol = "https"

    def items(self):
        return Article.objects.all().order_by("-published_at")

    def lastmod(self, obj):
        return obj.published_at

    def location(self, obj):
        return reverse("core:article_detail", kwargs={"slug": obj.slug})


class ToolsSitemap(Sitemap):
    """Free tools pages — high-value for SEO."""
    changefreq = "monthly"
    priority = 0.7
    protocol = "https"

    def items(self):
        return [
            "tools:tools",
            "tools:tools_reduce_file_size",
            "tools:tools_file_conversion",
            "tools:tools_zip_creator",
            "tools:tools_passport_photo_resizer",
            "tools:tools_bg_remover",
            "tools:tools_merge_documents",
            "tools:tools_split_pdf",
            "tools:tools_photo_album",
        ]

    def location(self, item):
        return reverse(item)


class VotingSitemap(Sitemap):
    """Evaluation and election vote pages."""
    changefreq = "weekly"
    priority = 0.6
    protocol = "https"

    def items(self):
        return [
            "evaluation_vote:home",
            "election_vote:home",
        ]

    def location(self, item):
        return reverse(item)


class MarriageSitemap(Sitemap):
    """Marriage service pages."""
    changefreq = "monthly"
    priority = 0.5
    protocol = "https"

    def items(self):
        return [
            "marriage:marriage",
            "marriage:marriage_form",
            "marriage:register_marriage",
            "marriage:marriage_certificate",
        ]

    def location(self, item):
        return reverse(item)


class PoemSitemap(Sitemap):
    """Poetry section."""
    changefreq = "weekly"
    priority = 0.4
    protocol = "https"

    def items(self):
        return ["poem:poem"]

    def location(self, item):
        return reverse(item)


# Registry for urls.py
SITEMAPS = {
    "static": StaticPageSitemap,
    "articles": ArticleSitemap,
    "tools": ToolsSitemap,
    "voting": VotingSitemap,
    "marriage": MarriageSitemap,
    "poem": PoemSitemap,
}
