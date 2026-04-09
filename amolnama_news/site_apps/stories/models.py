"""Stories for Kids models — mapped to [blog_stories].* SQL Server tables."""

from django.db import models


# RefStoryCategory removed — replaced by [content].[ref_content_subcategory] group_code='blog_stories_category'


class RefStoryAgeGroup(models.Model):
    blog_stories_ref_story_age_group_id = models.AutoField(primary_key=True)
    age_group_code = models.CharField(max_length=10)
    age_group_name_bn = models.CharField(max_length=100)
    age_group_name_en = models.CharField(max_length=100)
    age_min = models.IntegerField()
    age_max = models.IntegerField()
    sort_order = models.IntegerField(blank=True, null=True)
    is_active = models.BooleanField()
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = '[blog_stories].[ref_story_age_group]'

    def __str__(self):
        return self.age_group_name_en


class CollStory(models.Model):
    blog_stories_coll_story_id = models.BigAutoField(primary_key=True)
    story_guid = models.UUIDField()
    link_user_profile_id = models.BigIntegerField()
    link_blog_stories_ref_story_category_id = models.IntegerField()
    link_blog_stories_ref_story_age_group_id = models.IntegerField()
    story_title_bn = models.CharField(max_length=300)
    story_title_en = models.CharField(max_length=300, blank=True, null=True)
    story_slug = models.CharField(max_length=400)
    story_summary_bn = models.CharField(max_length=500, blank=True, null=True)
    story_content_html_bn = models.TextField()
    story_source_attribution_bn = models.CharField(max_length=500, blank=True, null=True)
    story_type_code = models.CharField(max_length=20)
    reading_time_minutes = models.IntegerField()
    is_serial = models.BooleanField()
    serial_part_number = models.IntegerField(blank=True, null=True)
    link_serial_parent_blog_stories_coll_story_id = models.BigIntegerField(blank=True, null=True)
    like_count = models.IntegerField()
    view_count = models.IntegerField()
    bookmark_count = models.IntegerField()
    completion_count = models.IntegerField()
    comment_count = models.IntegerField()
    is_featured = models.BooleanField()
    is_daily_pick = models.BooleanField()
    is_published = models.BooleanField()
    is_active = models.BooleanField()
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField(blank=True, null=True)
    link_content_registry_id = models.BigIntegerField(blank=True, null=True)
    link_content_ref_content_subcategory_id = models.IntegerField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = '[blog_stories].[coll_story]'

    def __str__(self):
        return self.story_title_bn or self.story_title_en or str(self.blog_stories_coll_story_id)


class StoryAsset(models.Model):
    blog_stories_story_asset_id = models.BigAutoField(primary_key=True)
    link_blog_stories_coll_story_id = models.BigIntegerField()
    link_asset_id = models.BigIntegerField()
    asset_group_code = models.CharField(max_length=30)
    is_cover = models.BooleanField()
    caption_bn = models.CharField(max_length=500, blank=True, null=True)
    sort_order = models.IntegerField()
    is_active = models.BooleanField()
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = '[blog_stories].[story_asset]'


class StoryPage(models.Model):
    blog_stories_story_page_id = models.BigAutoField(primary_key=True)
    link_blog_stories_coll_story_id = models.BigIntegerField()
    page_number = models.IntegerField()
    page_content_html_bn = models.TextField()
    link_illustration_asset_id = models.BigIntegerField(blank=True, null=True)
    is_active = models.BooleanField()
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = '[blog_stories].[story_page]'


class EngagementStoryLike(models.Model):
    blog_stories_engagement_story_like_id = models.BigAutoField(primary_key=True)
    link_blog_stories_coll_story_id = models.BigIntegerField()
    link_user_profile_id = models.BigIntegerField()
    is_active = models.BooleanField()
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = '[blog_stories].[engagement_story_like]'


class EngagementStoryBookmark(models.Model):
    blog_stories_engagement_story_bookmark_id = models.BigAutoField(primary_key=True)
    link_blog_stories_coll_story_id = models.BigIntegerField()
    link_user_profile_id = models.BigIntegerField()
    last_page_number = models.IntegerField(blank=True, null=True)
    is_completed = models.BooleanField()
    is_active = models.BooleanField()
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = '[blog_stories].[engagement_story_bookmark]'


class EngagementStoryComment(models.Model):
    blog_stories_engagement_story_comment_id = models.BigAutoField(primary_key=True)
    link_blog_stories_coll_story_id = models.BigIntegerField()
    link_user_profile_id = models.BigIntegerField()
    link_parent_comment_id = models.BigIntegerField(blank=True, null=True)
    comment_text_bn = models.CharField(max_length=1000)
    is_active = models.BooleanField()
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = '[blog_stories].[engagement_story_comment]'
