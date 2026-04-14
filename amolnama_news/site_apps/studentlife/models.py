"""Student Life models — mapped to [blog_studentlife].* SQL Server tables (all unmanaged)."""

from django.db import models


class CollCampusEntry(models.Model):
    blog_studentlife_coll_campus_entry_id = models.BigAutoField(primary_key=True)
    link_user_profile_id = models.BigIntegerField()

    # Content
    campus_entry_title_bn = models.CharField(max_length=300)
    campus_entry_title_en = models.CharField(max_length=300, blank=True, null=True)
    campus_entry_slug = models.CharField(max_length=300, blank=True, null=True)
    campus_entry_short_description_bn = models.CharField(max_length=500, blank=True, null=True)
    campus_entry_short_description_en = models.CharField(max_length=500, blank=True, null=True)
    campus_entry_description_bn = models.TextField(blank=True, null=True)
    campus_entry_description_en = models.TextField(blank=True, null=True)

    # Category (unified ref_content_subcategory)
    link_content_ref_content_subcategory_id = models.IntegerField(blank=True, null=True)

    # Institution info
    institution_name_bn = models.CharField(max_length=300, blank=True, null=True)
    institution_name_en = models.CharField(max_length=300, blank=True, null=True)
    institution_type_code = models.CharField(max_length=30, blank=True, null=True)
    institution_location_bn = models.CharField(max_length=300, blank=True, null=True)

    # Media
    cover_image_url = models.CharField(max_length=1000, blank=True, null=True)

    # Status
    campus_entry_status_code = models.CharField(max_length=20, default='published')
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
        return self.campus_entry_status_code == 'published'

    class Meta:
        managed = False
        db_table = '[blog_studentlife].[coll_campus_entry]'

    def __str__(self):
        return self.campus_entry_title_bn or self.campus_entry_title_en or f'Campus Entry {self.blog_studentlife_coll_campus_entry_id}'
