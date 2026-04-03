"""Art & Craft models — mapped to [art].* SQL Server tables."""

from django.db import models


class RefArtCategory(models.Model):
    art_ref_art_category_id = models.AutoField(primary_key=True)
    art_category_code = models.CharField(max_length=50)
    art_category_name_bn = models.CharField(max_length=200)
    art_category_name_en = models.CharField(max_length=200)
    art_category_icon = models.CharField(max_length=10, blank=True, null=True)
    sort_order = models.IntegerField(blank=True, null=True)
    is_active = models.BooleanField()
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = '[art].[ref_art_category]'

    def __str__(self):
        return self.art_category_name_en


class RefArtMedium(models.Model):
    art_ref_art_medium_id = models.AutoField(primary_key=True)
    art_medium_code = models.CharField(max_length=50)
    art_medium_name_bn = models.CharField(max_length=200)
    art_medium_name_en = models.CharField(max_length=200)
    sort_order = models.IntegerField(blank=True, null=True)
    is_active = models.BooleanField()
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = '[art].[ref_art_medium]'

    def __str__(self):
        return self.art_medium_name_en


class RefArtDifficulty(models.Model):
    art_ref_art_difficulty_id = models.AutoField(primary_key=True)
    art_difficulty_code = models.CharField(max_length=20)
    art_difficulty_name_bn = models.CharField(max_length=100)
    art_difficulty_name_en = models.CharField(max_length=100)
    sort_order = models.IntegerField(blank=True, null=True)
    is_active = models.BooleanField()
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = '[art].[ref_art_difficulty]'

    def __str__(self):
        return self.art_difficulty_name_en


class CollArtwork(models.Model):
    art_coll_artwork_id = models.BigAutoField(primary_key=True)
    artwork_guid = models.UUIDField()
    link_user_profile_id = models.BigIntegerField()
    link_art_category_id = models.IntegerField()
    link_art_medium_id = models.IntegerField(blank=True, null=True)
    link_art_difficulty_id = models.IntegerField(blank=True, null=True)
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

    class Meta:
        managed = False
        db_table = '[art].[coll_artwork]'

    def __str__(self):
        return self.artwork_title_bn or self.artwork_title_en or str(self.art_coll_artwork_id)


class ArtworkAsset(models.Model):
    art_artwork_asset_id = models.BigAutoField(primary_key=True)
    link_artwork_id = models.BigIntegerField()
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
        db_table = '[art].[artwork_asset]'


class ArtworkStep(models.Model):
    art_artwork_step_id = models.BigAutoField(primary_key=True)
    link_artwork_id = models.BigIntegerField()
    step_number = models.IntegerField()
    step_instruction_bn = models.TextField()
    step_instruction_en = models.TextField(blank=True, null=True)
    link_asset_id = models.BigIntegerField(blank=True, null=True)
    is_active = models.BooleanField()
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = '[art].[artwork_step]'


class ArtworkYoutubeLink(models.Model):
    art_artwork_youtube_link_id = models.BigAutoField(primary_key=True)
    link_artwork_id = models.BigIntegerField()
    link_user_profile_id = models.BigIntegerField()
    youtube_url = models.CharField(max_length=500)
    youtube_title_bn = models.CharField(max_length=300, blank=True, null=True)
    is_active = models.BooleanField()
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = '[art].[artwork_youtube_link]'


class EngagementArtworkLike(models.Model):
    art_engagement_artwork_like_id = models.BigAutoField(primary_key=True)
    link_artwork_id = models.BigIntegerField()
    link_user_profile_id = models.BigIntegerField()
    is_active = models.BooleanField()
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = '[art].[engagement_artwork_like]'


class EngagementArtworkBookmark(models.Model):
    art_engagement_artwork_bookmark_id = models.BigAutoField(primary_key=True)
    link_artwork_id = models.BigIntegerField()
    link_user_profile_id = models.BigIntegerField()
    is_active = models.BooleanField()
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = '[art].[engagement_artwork_bookmark]'


class EngagementArtworkComment(models.Model):
    art_engagement_artwork_comment_id = models.BigAutoField(primary_key=True)
    link_artwork_id = models.BigIntegerField()
    link_user_profile_id = models.BigIntegerField()
    link_parent_comment_id = models.BigIntegerField(blank=True, null=True)
    comment_text_bn = models.CharField(max_length=1000)
    is_active = models.BooleanField()
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = '[art].[engagement_artwork_comment]'
