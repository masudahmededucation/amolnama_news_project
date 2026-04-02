import uuid

from django.db import models
from django.utils import timezone


class Post(models.Model):
    post_post_id = models.BigAutoField(primary_key=True)
    post_guid = models.UUIDField(default=uuid.uuid4)
    link_user_profile_id = models.BigIntegerField()
    link_parent_post_id = models.BigIntegerField(blank=True, null=True)
    link_repost_of_post_id = models.BigIntegerField(blank=True, null=True)
    post_text_bn = models.CharField(max_length=2000, blank=True, null=True)
    post_type_code = models.CharField(max_length=20)
    visibility_code = models.CharField(max_length=20, default='public')
    post_keywords_json = models.CharField(max_length=500, blank=True, null=True)
    is_published = models.BooleanField()
    is_active = models.BooleanField()
    bookmark_count = models.IntegerField(default=0)
    like_count = models.IntegerField(default=0)
    reply_count = models.IntegerField(default=0)
    repost_count = models.IntegerField(default=0)
    view_count = models.IntegerField(default=0)
    vote_score_count = models.IntegerField(default=0)
    suggestion_type_code = models.CharField(max_length=30, blank=True, null=True)
    is_edited = models.BooleanField(default=False)
    edited_at = models.DateTimeField(blank=True, null=True)
    is_pinned = models.BooleanField(default=False)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = '[post].[post]'

    def __str__(self):
        return f"Post({self.post_post_id})"


class PostMedia(models.Model):
    post_post_media_id = models.BigAutoField(primary_key=True)
    link_post_id = models.BigIntegerField()
    link_asset_id = models.BigIntegerField()
    sort_order = models.IntegerField(default=0)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = '[post].[post_media]'

    def __str__(self):
        return f"PostMedia({self.post_post_media_id})"


class PostLike(models.Model):
    post_post_like_id = models.BigAutoField(primary_key=True)
    link_post_id = models.BigIntegerField()
    link_user_profile_id = models.BigIntegerField()
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = '[post].[post_like]'

    def __str__(self):
        return f"PostLike({self.post_post_like_id})"


class PostBookmark(models.Model):
    post_post_bookmark_id = models.BigAutoField(primary_key=True)
    link_post_id = models.BigIntegerField()
    link_user_profile_id = models.BigIntegerField()
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = '[post].[post_bookmark]'

    def __str__(self):
        return f"PostBookmark({self.post_post_bookmark_id})"


class PostVote(models.Model):
    post_post_vote_id = models.BigAutoField(primary_key=True)
    link_post_id = models.BigIntegerField()
    link_user_profile_id = models.BigIntegerField()
    vote_value = models.SmallIntegerField(default=1)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = '[post].[post_vote]'

    def __str__(self):
        return f"PostVote({self.post_post_vote_id})"


class PostFollow(models.Model):
    post_post_follow_id = models.BigAutoField(primary_key=True)
    link_post_id = models.BigIntegerField()
    link_user_profile_id = models.BigIntegerField()
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = '[post].[post_follow]'

    def __str__(self):
        return f"PostFollow({self.post_post_follow_id})"


class PostFlag(models.Model):
    post_post_flag_id = models.BigAutoField(primary_key=True)
    link_post_id = models.BigIntegerField()
    link_user_profile_id = models.BigIntegerField()
    flag_reason_code = models.CharField(max_length=30)
    flag_description_en = models.CharField(max_length=500, blank=True, null=True)
    flag_status_code = models.CharField(max_length=20, default='pending')
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(default=timezone.now)
    reviewed_at = models.DateTimeField(blank=True, null=True)
    updated_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = '[post].[post_flag]'

    def __str__(self):
        return f"PostFlag({self.post_post_flag_id})"


class CollPoll(models.Model):
    """Poll attached to a post — 2 to 4 options."""
    post_coll_poll_id = models.BigAutoField(primary_key=True)
    link_post_id = models.BigIntegerField()
    poll_question = models.CharField(max_length=300)
    poll_option_1 = models.CharField(max_length=200)
    poll_option_2 = models.CharField(max_length=200)
    poll_option_3 = models.CharField(max_length=200, blank=True, null=True)
    poll_option_4 = models.CharField(max_length=200, blank=True, null=True)
    poll_option_1_vote_count = models.IntegerField(default=0)
    poll_option_2_vote_count = models.IntegerField(default=0)
    poll_option_3_vote_count = models.IntegerField(default=0)
    poll_option_4_vote_count = models.IntegerField(default=0)
    total_vote_count = models.IntegerField(default=0)
    poll_ends_at = models.DateTimeField(blank=True, null=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField()

    class Meta:
        managed = False
        db_table = '[post].[coll_poll]'


class CollPollVote(models.Model):
    """One vote per user per poll."""
    post_coll_poll_vote_id = models.BigAutoField(primary_key=True)
    link_poll_id = models.BigIntegerField()
    link_user_profile_id = models.BigIntegerField()
    selected_option_number = models.IntegerField()
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField()

    class Meta:
        managed = False
        db_table = '[post].[coll_poll_vote]'
