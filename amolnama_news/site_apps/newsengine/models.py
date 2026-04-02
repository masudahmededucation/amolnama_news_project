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


class CollNotification(models.Model):
    """Global notification — covers all apps (post, debate, social, etc.)."""
    newsengine_coll_notification_id = models.BigAutoField(primary_key=True)
    link_recipient_user_profile_id = models.BigIntegerField()
    link_actor_user_profile_id = models.BigIntegerField(blank=True, null=True)
    notification_event_code = models.CharField(max_length=30)
    notification_source_app = models.CharField(max_length=30)
    link_content_id = models.BigIntegerField(blank=True, null=True)
    notification_message = models.CharField(max_length=300)
    notification_url = models.CharField(max_length=500, blank=True, null=True)
    is_read = models.BooleanField(default=False)
    read_at = models.DateTimeField(blank=True, null=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField()

    class Meta:
        managed = False
        db_table = '[newsengine].[coll_notification]'


class CollContentBookmark(models.Model):
    """Universal bookmark — any content type from any app."""
    newsengine_coll_content_bookmark_id = models.BigAutoField(primary_key=True)
    link_user_profile_id = models.BigIntegerField()
    content_type_code = models.CharField(max_length=30)
    content_id = models.BigIntegerField()
    content_title = models.CharField(max_length=300, blank=True, null=True)
    content_url = models.CharField(max_length=500, blank=True, null=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField()

    class Meta:
        managed = False
        db_table = '[newsengine].[coll_content_bookmark]'


class FactRateLimitLog(models.Model):
    """Rate limit tracking — logs each action for rate limit checks."""
    newsengine_fact_rate_limit_log_id = models.BigAutoField(primary_key=True)
    link_user_profile_id = models.BigIntegerField()
    action_code = models.CharField(max_length=30)
    action_at = models.DateTimeField()

    class Meta:
        managed = False
        db_table = '[newsengine].[fact_rate_limit_log]'


class CollHashtag(models.Model):
    """Hashtag extracted from posts — tracks usage count."""
    newsengine_coll_hashtag_id = models.BigAutoField(primary_key=True)
    hashtag_text = models.CharField(max_length=100)
    hashtag_text_normalized = models.CharField(max_length=100)
    post_count = models.IntegerField(default=0)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField()

    class Meta:
        managed = False
        db_table = '[newsengine].[coll_hashtag]'


class CollPostHashtag(models.Model):
    """Junction: post ↔ hashtag."""
    newsengine_coll_post_hashtag_id = models.BigAutoField(primary_key=True)
    link_post_id = models.BigIntegerField()
    link_hashtag_id = models.BigIntegerField()
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField()

    class Meta:
        managed = False
        db_table = '[newsengine].[coll_post_hashtag]'


class CollMutedWord(models.Model):
    """User's muted words — posts containing these words are hidden from feed."""
    newsengine_coll_muted_word_id = models.BigAutoField(primary_key=True)
    link_user_profile_id = models.BigIntegerField()
    muted_word = models.CharField(max_length=100)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField()

    class Meta:
        managed = False
        db_table = '[newsengine].[coll_muted_word]'


class RefContentCategory(models.Model):
    """Content category for classification — safe, spam, adult, politics, etc."""
    newsengine_ref_content_category_id = models.AutoField(primary_key=True)
    category_code = models.CharField(max_length=30)
    category_name_bn = models.CharField(max_length=100)
    category_name_en = models.CharField(max_length=100)
    category_action = models.CharField(max_length=20, default='allow')
    category_severity_level = models.IntegerField(default=0)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField()

    class Meta:
        managed = False
        db_table = '[newsengine].[ref_content_category]'

    def __str__(self):
        return self.category_code


class RefFlaggedKeyword(models.Model):
    """Flagged keyword linked to a content category — used for classification."""
    newsengine_ref_flagged_keyword_id = models.BigAutoField(primary_key=True)
    link_content_category_id = models.IntegerField()
    flagged_keyword_text = models.CharField(max_length=100)
    flagged_keyword_text_normalized = models.CharField(max_length=100)
    flagged_keyword_language_code = models.CharField(max_length=5, default='bn')
    flagged_keyword_weight = models.DecimalField(max_digits=5, decimal_places=2, default=1.0)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField()

    class Meta:
        managed = False
        db_table = '[newsengine].[ref_flagged_keyword]'


class FactContentClassification(models.Model):
    """Audit trail for content classification — stores every classification result."""
    newsengine_fact_content_classification_id = models.BigAutoField(primary_key=True)
    content_classification_source_app = models.CharField(max_length=30)
    link_content_id = models.BigIntegerField()
    link_content_category_id = models.IntegerField()
    content_classification_score = models.DecimalField(max_digits=5, decimal_places=4, default=0)
    content_classification_method = models.CharField(max_length=20, default='keyword')
    content_classification_action_taken = models.CharField(max_length=20, blank=True, null=True)
    is_auto_flagged = models.BooleanField(default=False)
    is_admin_reviewed = models.BooleanField(default=False)
    link_reviewed_by_user_profile_id = models.BigIntegerField(blank=True, null=True)
    reviewed_at = models.DateTimeField(blank=True, null=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField()

    class Meta:
        managed = False
        db_table = '[newsengine].[fact_content_classification]'
