"""Content registry models — master content index across all apps.
All managed=False, mapped to [content].* SQL Server tables."""

from django.db import models


class RefContentCategory(models.Model):
    """Content category — article, poem, story, art, destination, media, debate."""
    content_ref_content_category_id = models.IntegerField(primary_key=True)
    content_category_code = models.CharField(max_length=30)
    content_category_name_bn = models.CharField(max_length=100)
    content_category_name_en = models.CharField(max_length=100)
    content_category_icon = models.CharField(max_length=50, blank=True, null=True)
    content_category_sort_order = models.IntegerField(default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        managed = False
        db_table = '[content].[ref_content_category]'

    def __str__(self):
        return self.content_category_code


class RefContentSubcategory(models.Model):
    """Content subcategory — topics within each category (Crime, Love, Painting, Beach, etc.)."""
    content_ref_content_subcategory_id = models.IntegerField(primary_key=True)
    link_ref_content_category_id = models.IntegerField()
    # link_subcategory_id and link_subcategory_code are computed columns — not mapped in Django
    group_code = models.CharField(max_length=30)
    subcategory_code = models.CharField(max_length=50)
    subcategory_name_en = models.CharField(max_length=200)
    subcategory_name_bn = models.CharField(max_length=200)
    subcategory_icon = models.CharField(max_length=50, blank=True, null=True)
    sort_order = models.IntegerField(blank=True, null=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField()

    class Meta:
        managed = False
        db_table = '[content].[ref_content_subcategory]'

    def __str__(self):
        return f'{self.group_code}:{self.subcategory_code}'


class ContentRegistry(models.Model):
    """Master content registry — single source of truth for ALL blog content.
    Every content piece gets registered here. content_registry_id is the universal ID."""
    content_registry_id = models.BigAutoField(primary_key=True)
    link_content_category_id = models.IntegerField()
    link_user_profile_id = models.BigIntegerField()
    content_title_bn = models.CharField(max_length=1000, blank=True, null=True)
    content_title_en = models.CharField(max_length=1000, blank=True, null=True)
    content_slug = models.CharField(max_length=500, blank=True, null=True)
    content_summary_bn = models.CharField(max_length=500, blank=True, null=True)
    content_url = models.CharField(max_length=500)
    content_cover_image_url = models.CharField(max_length=500, blank=True, null=True)
    link_content_subcategory_id = models.IntegerField(blank=True, null=True)
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
