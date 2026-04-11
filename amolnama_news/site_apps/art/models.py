"""Art & Craft models — mapped to [blog_art].* SQL Server tables."""

from django.db import models
from django.utils import timezone


# RefArtCategory removed — replaced by [content].[ref_content_subcategory] group_code='blog_art_category'
# RefArtMedium removed — replaced by [content].[ref_content_subcategory] group_code='blog_art_medium'
# RefArtDifficulty removed — replaced by [content].[ref_content_subcategory] group_code='blog_art_difficulty'


class CollArtwork(models.Model):
    blog_art_coll_artwork_id = models.BigAutoField(primary_key=True)
    artwork_guid = models.UUIDField()
    link_user_profile_id = models.BigIntegerField()
    link_blog_art_ref_art_medium_id = models.IntegerField(blank=True, null=True)
    link_blog_art_ref_art_difficulty_id = models.IntegerField(blank=True, null=True)
    artwork_title_bn = models.CharField(max_length=300)
    artwork_title_en = models.CharField(max_length=300, blank=True, null=True)
    artwork_slug = models.CharField(max_length=400)
    artwork_description_bn = models.TextField(blank=True, null=True)
    artwork_description_en = models.TextField(blank=True, null=True)
    artwork_backstory_bn = models.TextField(blank=True, null=True)
    artwork_materials_bn = models.CharField(max_length=1000, blank=True, null=True)
    artwork_materials_en = models.CharField(max_length=1000, blank=True, null=True)
    artwork_dimensions_en = models.CharField(max_length=100, blank=True, null=True)
    artwork_type_code = models.CharField(max_length=20)
    is_tutorial = models.BooleanField()
    is_for_sale = models.BooleanField()
    estimated_time_minutes = models.IntegerField(blank=True, null=True)
    like_count = models.IntegerField()
    view_count = models.IntegerField()
    bookmark_count = models.IntegerField()
    comment_count = models.IntegerField()
    is_featured = models.BooleanField()
    is_published = models.BooleanField()
    is_active = models.BooleanField()
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField(blank=True, null=True)
    link_content_registry_id = models.BigIntegerField(blank=True, null=True)
    link_content_ref_content_subcategory_id = models.IntegerField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = '[blog_art].[coll_artwork]'

    def __str__(self):
        return self.artwork_title_bn or self.artwork_title_en or str(self.blog_art_coll_artwork_id)


class ArtworkAsset(models.Model):
    blog_art_artwork_asset_id = models.BigAutoField(primary_key=True)
    link_blog_art_coll_artwork_id = models.BigIntegerField()
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
        db_table = '[blog_art].[artwork_asset]'


class ArtworkStep(models.Model):
    blog_art_artwork_step_id = models.BigAutoField(primary_key=True)
    link_blog_art_coll_artwork_id = models.BigIntegerField()
    step_number = models.IntegerField()
    step_instruction_bn = models.TextField()
    step_instruction_en = models.TextField(blank=True, null=True)
    link_asset_id = models.BigIntegerField(blank=True, null=True)
    is_active = models.BooleanField()
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = '[blog_art].[artwork_step]'


class ArtworkYoutubeLink(models.Model):
    blog_art_artwork_youtube_link_id = models.BigAutoField(primary_key=True)
    link_blog_art_coll_artwork_id = models.BigIntegerField()
    link_user_profile_id = models.BigIntegerField()
    youtube_url = models.CharField(max_length=500)
    youtube_title_bn = models.CharField(max_length=300, blank=True, null=True)
    is_active = models.BooleanField()
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = '[blog_art].[artwork_youtube_link]'


class EngagementArtworkLike(models.Model):
    blog_art_engagement_artwork_like_id = models.BigAutoField(primary_key=True)
    link_blog_art_coll_artwork_id = models.BigIntegerField()
    link_user_profile_id = models.BigIntegerField()
    is_active = models.BooleanField()
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = '[blog_art].[engagement_artwork_like]'


class EngagementArtworkBookmark(models.Model):
    blog_art_engagement_artwork_bookmark_id = models.BigAutoField(primary_key=True)
    link_blog_art_coll_artwork_id = models.BigIntegerField()
    link_user_profile_id = models.BigIntegerField()
    is_active = models.BooleanField()
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = '[blog_art].[engagement_artwork_bookmark]'


class EngagementArtworkComment(models.Model):
    blog_art_engagement_artwork_comment_id = models.BigAutoField(primary_key=True)
    link_blog_art_coll_artwork_id = models.BigIntegerField()
    link_user_profile_id = models.BigIntegerField()
    link_parent_comment_id = models.BigIntegerField(blank=True, null=True)
    comment_text_bn = models.CharField(max_length=1000)
    is_active = models.BooleanField()
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = '[blog_art].[engagement_artwork_comment]'
