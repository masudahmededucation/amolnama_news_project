"""Poem app models — mapped to SQL Server [poem] schema (managed=False)."""

from django.db import models


class RefPoemCategory(models.Model):
    """Reference table for poem categories. Maps to [poem].[ref_poem_category]."""

    poem_ref_poem_category_id = models.IntegerField(primary_key=True)
    poem_category_name_bn = models.CharField(max_length=100)
    poem_category_name_en = models.CharField(max_length=100)
    sort_order = models.IntegerField(blank=True, null=True)
    is_active = models.BooleanField()
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = "[poem].[ref_poem_category]"

    def __str__(self):
        return self.poem_category_name_en


class CollPoemEntry(models.Model):
    """User-submitted poem/song lyrics. Maps to [poem].[coll_poem_entry]."""

    poem_coll_poem_entry_id = models.BigAutoField(primary_key=True)
    link_user_profile_id = models.BigIntegerField()
    link_poem_ref_poem_category_id = models.IntegerField()
    poem_title_bn = models.CharField(max_length=200, blank=True, null=True)
    poem_title_en = models.CharField(max_length=200, blank=True, null=True)
    poem_body_bn = models.TextField(blank=True, null=True)
    poem_body_en = models.TextField(blank=True, null=True)
    poem_backstory_bn = models.TextField(blank=True, null=True)
    poem_backstory_en = models.TextField(blank=True, null=True)
    poem_interpretation_bn = models.TextField(blank=True, null=True)
    poem_interpretation_en = models.TextField(blank=True, null=True)
    poem_language_code = models.CharField(max_length=100)
    poem_author_display_name = models.CharField(max_length=200)
    poem_audio_url = models.CharField(max_length=1000, blank=True, null=True)
    poem_audio_reciter_name = models.CharField(max_length=200, blank=True, null=True)
    poem_audio_description = models.CharField(max_length=500, blank=True, null=True)
    poem_type_code = models.CharField(max_length=50)
    poem_status_code = models.CharField(max_length=100)
    like_count = models.IntegerField()
    view_count = models.IntegerField()
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = "[poem].[coll_poem_entry]"

    def __str__(self):
        return self.poem_title_bn or self.poem_title_en or f"Poem({self.poem_coll_poem_entry_id})"


class EngPoemLike(models.Model):
    """Like/heart on a poem. Maps to [poem].[eng_poem_like]."""

    poem_eng_poem_like_id = models.BigAutoField(primary_key=True)
    link_poem_coll_poem_entry_id = models.BigIntegerField()
    link_user_profile_id = models.BigIntegerField()
    created_at = models.DateTimeField()

    class Meta:
        managed = False
        db_table = "[poem].[eng_poem_like]"
        unique_together = [["link_poem_coll_poem_entry_id", "link_user_profile_id"]]

    def __str__(self):
        return f"PoemLike({self.poem_eng_poem_like_id})"
