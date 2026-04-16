"""Biography models — mapped to [blog_biography].* SQL Server tables (all unmanaged)."""

from django.db import models


class CollBiographyEntry(models.Model):
    blog_biography_coll_biography_entry_id = models.BigAutoField(primary_key=True)
    link_user_profile_id = models.BigIntegerField()

    # Content
    biography_entry_title_bn = models.CharField(max_length=300)
    biography_entry_title_en = models.CharField(max_length=300, blank=True, null=True)
    biography_entry_slug = models.CharField(max_length=300, blank=True, null=True)
    biography_entry_short_description_bn = models.CharField(max_length=500, blank=True, null=True)
    biography_entry_short_description_en = models.CharField(max_length=500, blank=True, null=True)
    biography_entry_description_bn = models.TextField(blank=True, null=True)
    biography_entry_description_en = models.TextField(blank=True, null=True)

    # Category
    link_content_ref_content_subcategory_id = models.IntegerField(blank=True, null=True)

    # Subject biographical data
    subject_full_name_bn = models.CharField(max_length=300, blank=True, null=True)
    subject_full_name_en = models.CharField(max_length=300, blank=True, null=True)
    subject_birth_date = models.DateField(blank=True, null=True)
    subject_death_date = models.DateField(blank=True, null=True)
    subject_birth_place_bn = models.CharField(max_length=300, blank=True, null=True)
    subject_birth_place_en = models.CharField(max_length=300, blank=True, null=True)
    subject_nationality_bn = models.CharField(max_length=100, blank=True, null=True)
    subject_occupation_bn = models.CharField(max_length=300, blank=True, null=True)
    subject_occupation_en = models.CharField(max_length=300, blank=True, null=True)
    subject_era_code = models.CharField(max_length=30, blank=True, null=True)
    subject_known_for_bn = models.CharField(max_length=500, blank=True, null=True)
    is_living_person = models.BooleanField(default=True)
    is_memoriam = models.BooleanField(default=False)

    # Media
    cover_image_url = models.CharField(max_length=1000, blank=True, null=True)

    # Status
    biography_entry_status_code = models.CharField(max_length=20, default='published')
    is_featured = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)

    # Engagement counters
    like_count = models.IntegerField(default=0)
    view_count = models.IntegerField(default=0)
    bookmark_count = models.IntegerField(default=0)
    comment_count = models.IntegerField(default=0)

    # Reference person (search-and-select)
    link_blog_biography_coll_biography_person_id = models.IntegerField(blank=True, null=True)

    # Content registry
    link_content_registry_id = models.BigIntegerField(blank=True, null=True)

    # Timestamps
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField(blank=True, null=True)

    @property
    def is_published(self):
        return self.biography_entry_status_code == 'published'

    class Meta:
        managed = False
        db_table = '[blog_biography].[coll_biography_entry]'

    def __str__(self):
        return self.biography_entry_title_bn or self.biography_entry_title_en or f'Biography {self.blog_biography_coll_biography_entry_id}'
