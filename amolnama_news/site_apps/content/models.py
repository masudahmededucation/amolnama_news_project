"""Content registry models — master content index across all apps.
All managed=False, mapped to [content].* SQL Server tables."""

from django.db import models


class RefContentType(models.Model):
    """Content type reference — article, post, poem, story, art, destination, media, debate."""
    ref_content_type_id = models.PositiveSmallIntegerField(primary_key=True)
    content_type_code = models.CharField(max_length=30)
    content_type_name_bn = models.CharField(max_length=100)
    content_type_name_en = models.CharField(max_length=100)
    content_type_icon = models.CharField(max_length=50, blank=True, null=True)
    content_type_sort_order = models.SmallIntegerField(default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        managed = False
        db_table = '[content].[ref_content_type]'

    def __str__(self):
        return self.content_type_code


class ContentRegistry(models.Model):
    """Master content registry — single source of truth for ALL content across all apps.
    Every content piece gets registered here first. content_registry_id is the universal ID."""
    content_registry_id = models.BigAutoField(primary_key=True)
    link_content_type_id = models.SmallIntegerField()
    link_user_profile_id = models.BigIntegerField()
    content_title_bn = models.CharField(max_length=1000, blank=True, null=True)
    content_title_en = models.CharField(max_length=1000, blank=True, null=True)
    content_slug = models.CharField(max_length=500, blank=True, null=True)
    content_summary_bn = models.CharField(max_length=500, blank=True, null=True)
    content_url = models.CharField(max_length=500)
    content_cover_image_url = models.CharField(max_length=500, blank=True, null=True)
    content_category_code = models.CharField(max_length=50, blank=True, null=True)
    link_newshub_ref_news_form_type_id = models.IntegerField(blank=True, null=True)
    is_published = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    published_at = models.DateTimeField(blank=True, null=True)
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = '[content].[content_registry]'

    def __str__(self):
        return f'{self.content_registry_id}: {self.content_title_bn or self.content_title_en or ""}'
