"""Newsengine models — feed, notifications, bookmarks, rate limiting, hashtags, muted words,
content classification, fact-check. All managed=False, grouped by feature prefix."""

from django.db import models


# =========================================================
# GROUP: feed_
# =========================================================

class FactFeedUserContentView(models.Model):
    """Tracks what content each user has viewed — used for read history."""
    newsengine_fact_feed_user_content_view_id = models.BigAutoField(primary_key=True)
    link_user_profile_id = models.BigIntegerField()
    feed_content_type_code = models.CharField(max_length=30)
    feed_content_id = models.BigIntegerField()
    feed_viewed_at = models.DateTimeField()
    is_active = models.BooleanField(default=True)

    class Meta:
        managed = False
        db_table = '[newsengine].[fact_feed_user_content_view]'


class FactFeedContentScore(models.Model):
    """Cached content ranking scores."""
    newsengine_fact_feed_content_score_id = models.BigAutoField(primary_key=True)
    feed_content_type_code = models.CharField(max_length=30)
    feed_content_id = models.BigIntegerField()
    feed_engagement_score = models.DecimalField(max_digits=10, decimal_places=4, default=0)
    feed_trending_score = models.DecimalField(max_digits=10, decimal_places=4, default=0)
    feed_recency_score = models.DecimalField(max_digits=10, decimal_places=4, default=0)
    feed_total_score = models.DecimalField(max_digits=10, decimal_places=4, default=0)
    feed_scored_at = models.DateTimeField()
    is_active = models.BooleanField(default=True)

    class Meta:
        managed = False
        db_table = '[newsengine].[fact_feed_content_score]'


# =========================================================
# GROUP: notification_
# =========================================================

class NotificationItem(models.Model):
    """Global notification — covers all apps."""
    newsengine_notification_item_id = models.BigAutoField(primary_key=True)
    link_recipient_user_profile_id = models.BigIntegerField()
    link_actor_user_profile_id = models.BigIntegerField(blank=True, null=True)
    notification_event_code = models.CharField(max_length=30)
    notification_source_app = models.CharField(max_length=30)
    link_notification_content_id = models.BigIntegerField(blank=True, null=True)
    notification_message = models.CharField(max_length=300)
    notification_url = models.CharField(max_length=500, blank=True, null=True)
    is_read = models.BooleanField(default=False)
    read_at = models.DateTimeField(blank=True, null=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField()

    class Meta:
        managed = False
        db_table = '[newsengine].[notification_item]'


# =========================================================
# GROUP: bookmark_
# =========================================================

class BookmarkContent(models.Model):
    """Universal bookmark — any content type from any app."""
    newsengine_bookmark_content_id = models.BigAutoField(primary_key=True)
    link_user_profile_id = models.BigIntegerField()
    bookmark_content_type_code = models.CharField(max_length=30)
    bookmark_content_id = models.BigIntegerField()
    bookmark_content_title = models.CharField(max_length=300, blank=True, null=True)
    bookmark_content_url = models.CharField(max_length=500, blank=True, null=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField()

    class Meta:
        managed = False
        db_table = '[newsengine].[bookmark_content]'


# =========================================================
# GROUP: rate_limit_
# =========================================================

class FactRateLimitActionLog(models.Model):
    """Rate limit tracking — logs each action."""
    newsengine_fact_rate_limit_action_log_id = models.BigAutoField(primary_key=True)
    link_user_profile_id = models.BigIntegerField()
    rate_limit_action_code = models.CharField(max_length=30)
    rate_limit_action_at = models.DateTimeField()

    class Meta:
        managed = False
        db_table = '[newsengine].[fact_rate_limit_action_log]'


# =========================================================
# GROUP: hashtag_
# =========================================================

class HashtagItem(models.Model):
    """Hashtag extracted from posts."""
    newsengine_hashtag_item_id = models.BigAutoField(primary_key=True)
    hashtag_text = models.CharField(max_length=100)
    hashtag_text_normalized = models.CharField(max_length=100)
    hashtag_post_count = models.IntegerField(default=0)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField()

    class Meta:
        managed = False
        db_table = '[newsengine].[hashtag_item]'


class HashtagPostLink(models.Model):
    """Junction: post to hashtag."""
    newsengine_hashtag_post_link_id = models.BigAutoField(primary_key=True)
    link_hashtag_id = models.BigIntegerField()
    link_post_id = models.BigIntegerField()
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField()

    class Meta:
        managed = False
        db_table = '[newsengine].[hashtag_post_link]'


# =========================================================
# GROUP: muted_word_
# =========================================================

class MutedWordItem(models.Model):
    """User's muted words — posts containing these words are hidden from feed."""
    newsengine_muted_word_item_id = models.BigAutoField(primary_key=True)
    link_user_profile_id = models.BigIntegerField()
    muted_word_text = models.CharField(max_length=100)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField()

    class Meta:
        managed = False
        db_table = '[newsengine].[muted_word_item]'


# =========================================================
# GROUP: content_classification_
# =========================================================

class RefContentClassificationCategory(models.Model):
    """Content category for classification."""
    newsengine_ref_content_classification_category_id = models.AutoField(primary_key=True)
    category_code = models.CharField(max_length=30)
    category_name_bn = models.CharField(max_length=100)
    category_name_en = models.CharField(max_length=100)
    category_action = models.CharField(max_length=20, default='allow')
    category_severity_level = models.IntegerField(default=0)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField()

    class Meta:
        managed = False
        db_table = '[newsengine].[ref_content_classification_category]'

    def __str__(self):
        return self.category_code


class RefContentClassificationFlaggedKeyword(models.Model):
    """Flagged keyword linked to a content category."""
    newsengine_ref_content_classification_flagged_keyword_id = models.BigAutoField(primary_key=True)
    link_content_classification_category_id = models.IntegerField()
    flagged_keyword_text = models.CharField(max_length=100)
    flagged_keyword_text_normalized = models.CharField(max_length=100)
    flagged_keyword_language_code = models.CharField(max_length=5, default='bn')
    flagged_keyword_weight = models.DecimalField(max_digits=5, decimal_places=2, default=1.0)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField()

    class Meta:
        managed = False
        db_table = '[newsengine].[ref_content_classification_flagged_keyword]'


class FactContentClassificationResult(models.Model):
    """Audit trail for content classification."""
    newsengine_fact_content_classification_result_id = models.BigAutoField(primary_key=True)
    content_classification_source_app = models.CharField(max_length=30)
    link_content_id = models.BigIntegerField()
    link_content_classification_category_id = models.IntegerField()
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
        db_table = '[newsengine].[fact_content_classification_result]'


# =========================================================
# GROUP: fact_check_
# =========================================================

class FactCheckResult(models.Model):
    """Fact-check result — audit trail for every claim checked."""
    newsengine_fact_check_result_id = models.BigAutoField(primary_key=True)
    link_content_id = models.BigIntegerField()
    fact_check_source_app = models.CharField(max_length=30)
    fact_check_claim_text = models.CharField(max_length=500)
    fact_check_claim_text_normalized = models.CharField(max_length=500)
    fact_check_claim_hash = models.CharField(max_length=64)
    fact_check_method = models.CharField(max_length=30, default='pattern')
    fact_check_verdict = models.CharField(max_length=30, blank=True, null=True)
    fact_check_verdict_source = models.CharField(max_length=200, blank=True, null=True)
    fact_check_verdict_url = models.CharField(max_length=500, blank=True, null=True)
    fact_check_confidence_score = models.DecimalField(max_digits=5, decimal_places=4, default=0)
    is_flagged = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField()

    class Meta:
        managed = False
        db_table = '[newsengine].[fact_check_result]'


class RefFactCheckBlacklistedDomain(models.Model):
    """Blacklisted domain — known unreliable sources."""
    newsengine_ref_fact_check_blacklisted_domain_id = models.AutoField(primary_key=True)
    blacklisted_domain_name = models.CharField(max_length=200)
    blacklisted_domain_category = models.CharField(max_length=30, default='unreliable')
    blacklisted_domain_reason = models.CharField(max_length=300, blank=True, null=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField()

    class Meta:
        managed = False
        db_table = '[newsengine].[ref_fact_check_blacklisted_domain]'


class RefFactCheckMisinformationPattern(models.Model):
    """Misinformation pattern — sensationalism/manipulation phrases."""
    newsengine_ref_fact_check_misinformation_pattern_id = models.AutoField(primary_key=True)
    misinformation_pattern_text = models.CharField(max_length=200)
    misinformation_pattern_text_normalized = models.CharField(max_length=200)
    misinformation_pattern_language_code = models.CharField(max_length=5, default='bn')
    misinformation_pattern_weight = models.DecimalField(max_digits=5, decimal_places=2, default=1.0)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField()

    class Meta:
        managed = False
        db_table = '[newsengine].[ref_fact_check_misinformation_pattern]'
