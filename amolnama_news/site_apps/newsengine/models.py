"""Newsengine models — content scoring and user view tracking. All managed=False."""

from django.db import models


class FactUserContentView(models.Model):
    """Tracks what content each user has viewed — used for read history / don't repeat."""
    newsengine_fact_user_content_view_id = models.BigAutoField(primary_key=True)
    link_user_profile_id = models.BigIntegerField()
    content_type_code = models.CharField(max_length=30)
    content_id = models.BigIntegerField()
    viewed_at = models.DateTimeField()
    is_active = models.BooleanField(default=True)

    class Meta:
        managed = False
        db_table = '[newsengine].[fact_user_content_view]'


class FactContentScore(models.Model):
    """Cached content ranking scores — engagement, trending, recency, total."""
    newsengine_fact_content_score_id = models.BigAutoField(primary_key=True)
    content_type_code = models.CharField(max_length=30)
    content_id = models.BigIntegerField()
    engagement_score = models.DecimalField(max_digits=10, decimal_places=4, default=0)
    trending_score = models.DecimalField(max_digits=10, decimal_places=4, default=0)
    recency_score = models.DecimalField(max_digits=10, decimal_places=4, default=0)
    total_score = models.DecimalField(max_digits=10, decimal_places=4, default=0)
    scored_at = models.DateTimeField()
    is_active = models.BooleanField(default=True)

    class Meta:
        managed = False
        db_table = '[newsengine].[fact_content_score]'
