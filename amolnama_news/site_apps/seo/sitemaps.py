"""Sitemap classes for all public pages.

Django's sitemap framework generates /sitemap.xml automatically.
Each class represents a group of URLs with their own priority and changefreq.
"""

from django.contrib.sitemaps import Sitemap
from django.urls import reverse

from amolnama_news.site_apps.core.models import Article
from amolnama_news.site_apps.art.models import CollArtwork
from amolnama_news.site_apps.bangladesh.models import CollDestination
from amolnama_news.site_apps.debate.models import CollTopic
from amolnama_news.site_apps.newshub.models import PubArticle
from amolnama_news.site_apps.poem.models import CollPoemEntry
from amolnama_news.site_apps.stories.models import CollStory
from amolnama_news.site_apps.studentlife.models import CollCampusEntry
from amolnama_news.site_apps.probashbarta.models import CollProbashEntry


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


class NewshubArticleSitemap(Sitemap):
    """Newshub published articles — investigation journalism."""
    changefreq = "daily"
    priority = 0.9
    protocol = "https"

    def items(self):
        return PubArticle.objects.filter(is_published=True).order_by("-published_at")

    def lastmod(self, article):
        return article.published_at

    def location(self, article):
        return reverse("newshub:article_detail", kwargs={"slug": article.pub_article_slug})


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
            "tools:tools_watermark_remover",
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


class PoemLandingSitemap(Sitemap):
    """Poetry landing page."""
    changefreq = "weekly"
    priority = 0.4
    protocol = "https"

    def items(self):
        return ["poem:poem_landing"]

    def location(self, item):
        return reverse(item)


class PoemDetailSitemap(Sitemap):
    """Individual poem pages."""
    changefreq = "monthly"
    priority = 0.5
    protocol = "https"

    def items(self):
        return CollPoemEntry.objects.filter(
            poem_status_code="published"
        ).exclude(poem_slug__isnull=True).exclude(poem_slug="").order_by("-created_at")

    def lastmod(self, poem):
        return poem.updated_at or poem.created_at

    def location(self, poem):
        return reverse("poem:poem_detail", kwargs={"poem_slug": poem.poem_slug})


class TravelHubSitemap(Sitemap):
    """Travel Hub destination pages — high SEO value for Bengali search."""
    changefreq = "weekly"
    priority = 0.8
    protocol = "https"

    def items(self):
        return CollDestination.objects.filter(
            destination_status="published"
        ).exclude(destination_slug__isnull=True).exclude(destination_slug="").order_by("-created_at")

    def lastmod(self, destination):
        return destination.updated_at or destination.created_at

    def location(self, destination):
        return reverse("bangladesh:travel_hub_detail", kwargs={"destination_slug": destination.destination_slug})


class BangladeshLandingSitemap(Sitemap):
    """Bangladesh app landing pages."""
    changefreq = "weekly"
    priority = 0.6
    protocol = "https"

    def items(self):
        return [
            "bangladesh:bangladesh_landing",
            "bangladesh:travel_hub",
            "bangladesh:beauty_hub",
        ]

    def location(self, item):
        return reverse(item)


class ArtLandingSitemap(Sitemap):
    """Art & Craft landing page."""
    changefreq = "weekly"
    priority = 0.6
    protocol = "https"

    def items(self):
        return ["art:home"]

    def location(self, item):
        return reverse(item)


class ArtDetailSitemap(Sitemap):
    """Individual artwork pages."""
    changefreq = "monthly"
    priority = 0.5
    protocol = "https"

    def items(self):
        return CollArtwork.objects.filter(
            is_published=True, is_active=True,
        ).exclude(artwork_slug__isnull=True).exclude(artwork_slug="").order_by("-created_at")

    def lastmod(self, artwork):
        return artwork.updated_at or artwork.created_at

    def location(self, artwork):
        return f"/art-and-craft/{artwork.artwork_slug}/"


class StoriesLandingSitemap(Sitemap):
    """Stories for Kids landing page."""
    changefreq = "weekly"
    priority = 0.6
    protocol = "https"

    def items(self):
        return ["stories:home"]

    def location(self, item):
        return reverse(item)


class StoryDetailSitemap(Sitemap):
    """Individual story pages."""
    changefreq = "monthly"
    priority = 0.5
    protocol = "https"

    def items(self):
        return CollStory.objects.filter(
            is_published=True, is_active=True,
        ).exclude(story_slug__isnull=True).exclude(story_slug="").order_by("-created_at")

    def lastmod(self, story):
        return story.updated_at or story.created_at

    def location(self, story):
        return f"/stories-for-kids/{story.story_slug}/"


class DebateLandingSitemap(Sitemap):
    """Debate landing page."""
    changefreq = "weekly"
    priority = 0.6
    protocol = "https"

    def items(self):
        return ["debate:home"]

    def location(self, item):
        return reverse(item)


class DebateTopicSitemap(Sitemap):
    """Individual debate topic pages (live + closed — public interest)."""
    changefreq = "daily"
    priority = 0.7
    protocol = "https"

    def items(self):
        return CollTopic.objects.filter(
            is_active=True,
            link_blog_debate_ref_topic_status_id__in=[3, 5],  # live + closed
        ).order_by("-created_at")

    def lastmod(self, topic):
        return topic.updated_at or topic.created_at

    def location(self, topic):
        return f"/debate/topic/{topic.topic_slug}/" if topic.topic_slug else f"/debate/topic/{topic.blog_debate_coll_topic_id}/"


class CampusLifeLandingSitemap(Sitemap):
    """Campus Life landing page."""
    changefreq = "weekly"
    priority = 0.6
    protocol = "https"

    def items(self):
        return ["studentlife:home"]

    def location(self, item):
        return reverse(item)


class CampusLifeDetailSitemap(Sitemap):
    """Individual campus life entries."""
    changefreq = "monthly"
    priority = 0.5
    protocol = "https"

    def items(self):
        return CollCampusEntry.objects.filter(
            campus_entry_status_code='published', is_active=True,
        ).exclude(campus_entry_slug__isnull=True).exclude(campus_entry_slug='').order_by('-created_at')

    def lastmod(self, entry):
        return entry.updated_at or entry.created_at

    def location(self, entry):
        return f'/campus-life/{entry.campus_entry_slug}/'


class ProbashBartaLandingSitemap(Sitemap):
    """Probash Barta landing page."""
    changefreq = "weekly"
    priority = 0.6
    protocol = "https"

    def items(self):
        return ["probashbarta:home"]

    def location(self, item):
        return reverse(item)


class ProbashBartaDetailSitemap(Sitemap):
    """Individual probash barta entries."""
    changefreq = "monthly"
    priority = 0.5
    protocol = "https"

    def items(self):
        return CollProbashEntry.objects.filter(
            probash_entry_status_code='published', is_active=True,
        ).exclude(probash_entry_slug__isnull=True).exclude(probash_entry_slug='').order_by('-created_at')

    def lastmod(self, entry):
        return entry.updated_at or entry.created_at

    def location(self, entry):
        return f'/probash-barta/{entry.probash_entry_slug}/'


# Registry for urls.py
SITEMAPS = {
    "static": StaticPageSitemap,
    "articles": ArticleSitemap,
    "newshub_articles": NewshubArticleSitemap,
    "tools": ToolsSitemap,
    "voting": VotingSitemap,
    "marriage": MarriageSitemap,
    "poem_landing": PoemLandingSitemap,
    "poem_detail": PoemDetailSitemap,
    "travel_hub": TravelHubSitemap,
    "bangladesh": BangladeshLandingSitemap,
    "art_landing": ArtLandingSitemap,
    "art_detail": ArtDetailSitemap,
    "stories_landing": StoriesLandingSitemap,
    "story_detail": StoryDetailSitemap,
    "debate_landing": DebateLandingSitemap,
    "debate_topic": DebateTopicSitemap,
    "campus_life_landing": CampusLifeLandingSitemap,
    "campus_life_detail": CampusLifeDetailSitemap,
    "probash_barta_landing": ProbashBartaLandingSitemap,
    "probash_barta_detail": ProbashBartaDetailSitemap,
}
