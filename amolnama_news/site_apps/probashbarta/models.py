"""Probash Barta models — mapped to [blog_probashbarta].* SQL Server tables (all unmanaged)."""

from django.db import models


class CollProbashEntry(models.Model):
    blog_probashbarta_coll_probash_entry_id = models.BigAutoField(primary_key=True)
    link_user_profile_id = models.BigIntegerField()

    # Content
    probash_entry_title_bn = models.CharField(max_length=300)
    probash_entry_title_en = models.CharField(max_length=300, blank=True, null=True)
    probash_entry_slug = models.CharField(max_length=300, blank=True, null=True)
    probash_entry_short_description_bn = models.CharField(max_length=500, blank=True, null=True)
    probash_entry_short_description_en = models.CharField(max_length=500, blank=True, null=True)
    probash_entry_description_bn = models.TextField(blank=True, null=True)
    probash_entry_description_en = models.TextField(blank=True, null=True)

    # Category (unified ref_content_subcategory — topic)
    link_content_ref_content_subcategory_id = models.IntegerField(blank=True, null=True)

    # Country / Region
    probash_country_code = models.CharField(max_length=10, blank=True, null=True)
    probash_country_name_bn = models.CharField(max_length=100, blank=True, null=True)
    probash_country_name_en = models.CharField(max_length=100, blank=True, null=True)
    probash_region_code = models.CharField(max_length=30, blank=True, null=True)
    probash_city_name_bn = models.CharField(max_length=200, blank=True, null=True)

    # Media
    cover_image_url = models.CharField(max_length=1000, blank=True, null=True)

    # Status
    probash_entry_status_code = models.CharField(max_length=20, default='published')
    is_featured = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)

    # Engagement counters
    like_count = models.IntegerField(default=0)
    view_count = models.IntegerField(default=0)
    bookmark_count = models.IntegerField(default=0)
    comment_count = models.IntegerField(default=0)

    # Content registry
    link_content_registry_id = models.BigIntegerField(blank=True, null=True)

    # Timestamps
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField(blank=True, null=True)

    @property
    def is_published(self):
        return self.probash_entry_status_code == 'published'

    class Meta:
        managed = False
        db_table = '[blog_probashbarta].[coll_probash_entry]'

    def __str__(self):
        return self.probash_entry_title_bn or self.probash_entry_title_en or f'Probash Entry {self.blog_probashbarta_coll_probash_entry_id}'
