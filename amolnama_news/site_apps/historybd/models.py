"""History BD models — mapped to [blog_historybd].* SQL Server tables (all unmanaged)."""

from django.db import models


class CollHistoryEvent(models.Model):
    blog_historybd_coll_history_event_id = models.BigAutoField(primary_key=True)
    link_user_profile_id = models.BigIntegerField()

    # Content
    history_event_title_bn = models.CharField(max_length=300)
    history_event_title_en = models.CharField(max_length=300, blank=True, null=True)
    history_event_slug = models.CharField(max_length=300, blank=True, null=True)
    history_event_short_description_bn = models.CharField(max_length=500, blank=True, null=True)
    history_event_short_description_en = models.CharField(max_length=500, blank=True, null=True)
    history_event_description_bn = models.TextField(blank=True, null=True)
    history_event_description_en = models.TextField(blank=True, null=True)
    history_event_significance_bn = models.TextField(blank=True, null=True)
    history_event_significance_en = models.TextField(blank=True, null=True)

    # Category (era)
    link_content_ref_content_subcategory_id = models.IntegerField(blank=True, null=True)

    # Event dating
    event_date_start = models.DateField(blank=True, null=True)
    event_date_end = models.DateField(blank=True, null=True)
    event_year = models.IntegerField(blank=True, null=True)
    event_era_code = models.CharField(max_length=30, blank=True, null=True)

    # Event context
    event_location_bn = models.CharField(max_length=300, blank=True, null=True)
    event_location_en = models.CharField(max_length=300, blank=True, null=True)
    key_figures_bn = models.CharField(max_length=1000, blank=True, null=True)
    key_figures_en = models.CharField(max_length=1000, blank=True, null=True)
    is_turning_point = models.BooleanField(default=False)

    # Media
    cover_image_url = models.CharField(max_length=1000, blank=True, null=True)

    # Status
    history_event_status_code = models.CharField(max_length=20, default='published')
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
        return self.history_event_status_code == 'published'

    class Meta:
        managed = False
        db_table = '[blog_historybd].[coll_history_event]'

    def __str__(self):
        return self.history_event_title_bn or self.history_event_title_en or f'History Event {self.blog_historybd_coll_history_event_id}'
