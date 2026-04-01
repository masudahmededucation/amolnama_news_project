"""Debate app models — all managed=False, mapped to [debate].* SQL Server tables."""

from django.db import models


# =========================================================
# REFERENCE TABLES
# =========================================================

class RefTeamSide(models.Model):
    """Blue (Pro) vs Red (Against)."""
    debate_ref_team_side_id = models.AutoField(primary_key=True)
    team_side_code = models.CharField(max_length=20)
    team_side_name_en = models.CharField(max_length=50)
    team_side_name_bn = models.CharField(max_length=50)
    team_side_color_hex = models.CharField(max_length=10, blank=True, null=True)
    sort_order = models.IntegerField(blank=True, null=True)
    is_active = models.BooleanField()
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = '[debate].[ref_team_side]'

    def __str__(self):
        return self.team_side_name_en


class RefTopicStatus(models.Model):
    """Debate lifecycle: draft → scheduled → live → paused → closed → archived."""
    debate_ref_topic_status_id = models.AutoField(primary_key=True)
    topic_status_code = models.CharField(max_length=30)
    topic_status_name_en = models.CharField(max_length=50)
    topic_status_name_bn = models.CharField(max_length=50)
    sort_order = models.IntegerField(blank=True, null=True)
    is_active = models.BooleanField()
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = '[debate].[ref_topic_status]'

    def __str__(self):
        return self.topic_status_name_en


class RefPostKind(models.Model):
    """Argument (top-level) vs Rebuttal (reply = opposition)."""
    debate_ref_post_kind_id = models.AutoField(primary_key=True)
    post_kind_code = models.CharField(max_length=20)
    post_kind_name_en = models.CharField(max_length=50)
    post_kind_name_bn = models.CharField(max_length=50)
    sort_order = models.IntegerField(blank=True, null=True)
    is_active = models.BooleanField()
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = '[debate].[ref_post_kind]'

    def __str__(self):
        return self.post_kind_name_en


class RefModerationStatus(models.Model):
    """Moderation pipeline: pending → approved → rejected → hidden → flagged."""
    debate_ref_moderation_status_id = models.AutoField(primary_key=True)
    moderation_status_code = models.CharField(max_length=30)
    moderation_status_name_en = models.CharField(max_length=50)
    moderation_status_name_bn = models.CharField(max_length=50)
    sort_order = models.IntegerField(blank=True, null=True)
    is_active = models.BooleanField()
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = '[debate].[ref_moderation_status]'

    def __str__(self):
        return self.moderation_status_name_en


class RefVoteTargetType(models.Model):
    """Vote target: topic or post."""
    debate_ref_vote_target_type_id = models.AutoField(primary_key=True)
    vote_target_type_code = models.CharField(max_length=20)
    vote_target_type_name_en = models.CharField(max_length=50)
    vote_target_type_name_bn = models.CharField(max_length=50)
    sort_order = models.IntegerField(blank=True, null=True)
    is_active = models.BooleanField()
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = '[debate].[ref_vote_target_type]'

    def __str__(self):
        return self.vote_target_type_name_en


# =========================================================
# CORE TABLES
# =========================================================

class CollTopic(models.Model):
    """Scheduled debate event — topic, rules, lifecycle, vote counts."""
    debate_coll_topic_id = models.BigAutoField(primary_key=True)
    topic_guid = models.UUIDField()
    topic_title = models.CharField(max_length=300)
    topic_description = models.TextField(blank=True, null=True)
    blue_side_label = models.CharField(max_length=200, blank=True, null=True)
    red_side_label = models.CharField(max_length=200, blank=True, null=True)
    link_topic_status_id = models.IntegerField()
    scheduled_start_at = models.DateTimeField()
    scheduled_end_at = models.DateTimeField(blank=True, null=True)
    actual_started_at = models.DateTimeField(blank=True, null=True)
    actual_closed_at = models.DateTimeField(blank=True, null=True)
    is_public = models.BooleanField()
    allow_topic_upvote = models.BooleanField()
    minimum_post_character_count = models.IntegerField()
    maximum_post_character_count = models.IntegerField(blank=True, null=True)
    minimum_sentence_count = models.IntegerField()
    allow_nested_replies = models.BooleanField()
    maximum_reply_depth = models.IntegerField()
    is_ai_moderation_enabled = models.BooleanField()
    minimum_logic_score = models.DecimalField(max_digits=5, decimal_places=4)
    topic_upvote_count = models.IntegerField()
    topic_downvote_count = models.IntegerField()
    topic_score = models.IntegerField()
    blue_participant_count = models.IntegerField()
    red_participant_count = models.IntegerField()
    total_post_count = models.IntegerField()
    # Passion Board — per-side cached aggregates
    blue_post_count = models.IntegerField()
    blue_upvote_count = models.IntegerField()
    blue_sentence_count = models.IntegerField()
    blue_character_count = models.IntegerField()
    red_post_count = models.IntegerField()
    red_upvote_count = models.IntegerField()
    red_sentence_count = models.IntegerField()
    red_character_count = models.IntegerField()
    link_created_by_user_profile_id = models.BigIntegerField()
    winning_side_code = models.CharField(max_length=10, blank=True, null=True)
    is_active = models.BooleanField()
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = '[debate].[coll_topic]'

    def __str__(self):
        return self.topic_title


class CollTopicParticipant(models.Model):
    """One user joins one topic on exactly one side."""
    debate_coll_topic_participant_id = models.BigAutoField(primary_key=True)
    link_topic_id = models.BigIntegerField()
    link_user_profile_id = models.BigIntegerField()
    link_team_side_id = models.IntegerField()
    joined_at = models.DateTimeField()
    is_active = models.BooleanField()
    is_muted = models.BooleanField()
    is_banned = models.BooleanField()
    participant_reputation_snapshot = models.IntegerField()
    participant_argument_count = models.IntegerField()
    participant_rebuttal_count = models.IntegerField()
    participant_total_vote_score = models.IntegerField()
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = '[debate].[coll_topic_participant]'


class CollPost(models.Model):
    """Argument or rebuttal — core content with routing columns."""
    debate_coll_post_id = models.BigAutoField(primary_key=True)
    post_guid = models.UUIDField()
    link_topic_id = models.BigIntegerField()
    link_coll_topic_participant_id = models.BigIntegerField()
    link_author_user_profile_id = models.BigIntegerField()
    link_author_team_side_id = models.IntegerField()
    link_post_kind_id = models.IntegerField()
    link_thread_board_side_id = models.IntegerField()
    link_parent_post_id = models.BigIntegerField(blank=True, null=True)
    link_root_post_id = models.BigIntegerField(blank=True, null=True)
    post_reply_depth = models.IntegerField()
    post_sibling_sort_order = models.IntegerField()
    post_content = models.TextField()
    post_character_count = models.IntegerField()
    post_sentence_count = models.IntegerField()
    post_emoji_ratio = models.DecimalField(max_digits=5, decimal_places=4)
    post_repeated_character_ratio = models.DecimalField(max_digits=5, decimal_places=4)
    post_non_language_ratio = models.DecimalField(max_digits=5, decimal_places=4)
    post_logic_score = models.DecimalField(max_digits=5, decimal_places=4, blank=True, null=True)
    is_emoji_only = models.BooleanField()
    is_auto_rejected = models.BooleanField()
    is_pinned = models.BooleanField()
    is_deleted = models.BooleanField()
    is_edited = models.BooleanField()
    post_impact_score = models.DecimalField(max_digits=10, decimal_places=4)
    post_argument_strength = models.DecimalField(max_digits=5, decimal_places=4)
    post_content_hash = models.CharField(max_length=64, blank=True, null=True)
    citation_source_url = models.CharField(max_length=500, blank=True, null=True)
    citation_source_text = models.CharField(max_length=200, blank=True, null=True)
    fact_check_flag_count = models.IntegerField()
    is_fact_check_needed = models.BooleanField()
    is_champion = models.BooleanField()
    is_suppressed = models.BooleanField()
    upvote_count = models.IntegerField()
    downvote_count = models.IntegerField()
    score = models.IntegerField()
    reply_count = models.IntegerField()
    posted_at = models.DateTimeField()
    edited_at = models.DateTimeField(blank=True, null=True)
    deleted_at = models.DateTimeField(blank=True, null=True)
    is_active = models.BooleanField()
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = '[debate].[coll_post]'


class FactPostModeration(models.Model):
    """Separate moderation audit trail."""
    debate_fact_post_moderation_id = models.BigAutoField(primary_key=True)
    link_post_id = models.BigIntegerField()
    link_moderation_status_id = models.IntegerField()
    moderation_reason = models.CharField(max_length=500, blank=True, null=True)
    moderation_notes = models.TextField(blank=True, null=True)
    is_length_valid = models.BooleanField()
    is_sentence_count_valid = models.BooleanField()
    is_emoji_only_valid = models.BooleanField()
    is_repeated_character_valid = models.BooleanField()
    is_non_language_valid = models.BooleanField()
    is_logic_score_valid = models.BooleanField()
    link_moderated_by_user_profile_id = models.BigIntegerField(blank=True, null=True)
    moderated_at = models.DateTimeField()
    is_active = models.BooleanField()
    created_at = models.DateTimeField()

    class Meta:
        managed = False
        db_table = '[debate].[fact_post_moderation]'


class CollVote(models.Model):
    """One vote per user per target — supports topics and posts."""
    debate_coll_vote_id = models.BigAutoField(primary_key=True)
    link_voter_user_profile_id = models.BigIntegerField()
    link_vote_target_type_id = models.IntegerField()
    target_row_id = models.BigIntegerField()
    vote_value = models.SmallIntegerField()
    voted_at = models.DateTimeField()
    is_active = models.BooleanField()
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = '[debate].[coll_vote]'


class CollPostEditHistory(models.Model):
    """Audit trail for post edits."""
    debate_coll_post_edit_history_id = models.BigAutoField(primary_key=True)
    link_post_id = models.BigIntegerField()
    previous_post_content = models.TextField()
    link_edited_by_user_profile_id = models.BigIntegerField()
    edited_at = models.DateTimeField()
    is_active = models.BooleanField()
    created_at = models.DateTimeField()

    class Meta:
        managed = False
        db_table = '[debate].[coll_post_edit_history]'
