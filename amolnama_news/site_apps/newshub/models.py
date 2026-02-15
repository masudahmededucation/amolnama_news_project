from django.db import models


# ========== Reference Tables ==========

class RefAdPlacement(models.Model):
    ad_placement_id = models.IntegerField(primary_key=True)
    placement_name = models.CharField(max_length=100)
    placement_code = models.CharField(max_length=50)
    is_active = models.BooleanField()
    created_at = models.DateTimeField()

    class Meta:
        managed = False
        db_table = '[newshub].[ref_ad_placement]'

    def __str__(self):
        return self.placement_name


class RefContributorType(models.Model):
    contributor_type_id = models.IntegerField(primary_key=True)
    contributor_group_code = models.CharField(max_length=50, blank=True, null=True)
    contributor_type_label_bn = models.CharField(max_length=200)
    contributor_type_label_en = models.CharField(max_length=200, blank=True, null=True)
    sort_order = models.IntegerField(blank=True, null=True)
    is_active = models.BooleanField()
    created_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = '[newshub].[ref_contributor_type]'

    def __str__(self):
        return self.contributor_type_label_en or self.contributor_type_label_bn


class RefNewsCategory(models.Model):
    news_category_id = models.IntegerField(primary_key=True)
    news_group_code = models.CharField(max_length=50, blank=True, null=True)
    news_category_name_bn = models.CharField(max_length=100)
    news_category_name_en = models.CharField(max_length=100)
    news_category_description_bn = models.CharField(max_length=200, blank=True, null=True)
    news_category_slug = models.CharField(max_length=100, blank=True, null=True)
    news_category_search_aliases = models.CharField(max_length=100, blank=True, null=True)
    sort_order = models.IntegerField(blank=True, null=True)
    is_active = models.BooleanField()
    created_at = models.DateTimeField()

    class Meta:
        managed = False
        db_table = '[newshub].[ref_news_category]'

    def __str__(self):
        return self.news_category_name_en or self.news_category_name_bn


class RefPlatformType(models.Model):
    platform_type_id = models.IntegerField(primary_key=True)
    platform_name = models.CharField(max_length=100)
    platform_base_url = models.CharField(max_length=500, blank=True, null=True)
    platform_icon_url = models.CharField(max_length=1000, blank=True, null=True)
    is_active = models.BooleanField()
    sort_order = models.IntegerField(blank=True, null=True)
    created_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = '[newshub].[ref_platform_type]'

    def __str__(self):
        return self.platform_name


class RefNewsTag(models.Model):
    news_tag_id = models.IntegerField(primary_key=True)
    link_news_category_id = models.IntegerField(blank=True, null=True)
    news_tag_name_bn = models.CharField(max_length=255)
    news_tag_name_en = models.CharField(max_length=255)
    created_at = models.DateTimeField()

    class Meta:
        managed = False
        db_table = '[newshub].[ref_news_tag]'

    def __str__(self):
        return self.news_tag_name_en or self.news_tag_name_bn


class RefNewsCategoryTag(models.Model):
    news_category_tag_id = models.IntegerField(primary_key=True)
    link_news_category_id = models.IntegerField(blank=True, null=True)
    news_tag_group_code = models.CharField(max_length=50, blank=True, null=True)
    news_tag_name_bn = models.CharField(max_length=255)
    news_tag_name_en = models.CharField(max_length=255)
    news_tag_slug = models.CharField(max_length=100, blank=True, null=True)
    news_tag_search_aliases = models.CharField(max_length=100, blank=True, null=True)
    sort_order = models.IntegerField(blank=True, null=True)
    created_at = models.DateTimeField()

    class Meta:
        managed = False
        db_table = '[newshub].[ref_news_category_tag]'

    def __str__(self):
        return self.news_tag_name_en or self.news_tag_name_bn


class VwAppNewsCategoryTag(models.Model):
    news_category_id = models.IntegerField()
    news_category_name_bn = models.CharField(max_length=255)
    news_category_name_en = models.CharField(max_length=255)
    news_category_tag_id = models.IntegerField(primary_key=True)
    news_tag_group_code = models.CharField(max_length=50, blank=True, null=True)
    news_tag_name_bn = models.CharField(max_length=255)
    news_tag_name_en = models.CharField(max_length=255)
    sort_order = models.IntegerField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = '[newshub].[vw_app_news_category_tags]'

    def __str__(self):
        return self.news_tag_name_en or self.news_tag_name_bn


# ========== Collection Tables ==========

class CollContributor(models.Model):
    coll_contributor_id = models.BigAutoField(primary_key=True)
    link_user_profile_id = models.BigIntegerField(blank=True, null=True)
    link_contributor_type_id = models.IntegerField()
    coll_contributor_full_name_bn = models.CharField(max_length=100)
    coll_contributor_organization_bn = models.CharField(max_length=100, blank=True, null=True)
    coll_contributor_contact_email = models.CharField(max_length=255, blank=True, null=True)
    coll_contributor_contact_phone = models.CharField(max_length=50, blank=True, null=True)
    professional_bio_bn = models.CharField(max_length=1000, blank=True, null=True)
    is_verified = models.BooleanField()
    verification_date = models.DateTimeField(blank=True, null=True)
    created_at = models.DateTimeField()

    class Meta:
        managed = False
        db_table = '[newshub].[coll_contributor]'

    def __str__(self):
        return self.coll_contributor_full_name_bn



class CollNewsEntry(models.Model):
    coll_news_entry_id = models.BigAutoField(primary_key=True)
    coll_news_entry_headline_bn = models.CharField(max_length=100)
    coll_news_entry_summary_bn = models.CharField(max_length=400, blank=True, null=True)
    coll_news_entry_content_body_bn = models.TextField()
    coll_news_entry_headline_en = models.CharField(max_length=1000, blank=True, null=True)
    coll_news_entry_summary_en = models.CharField(max_length=2000, blank=True, null=True)
    coll_news_entry_content_body_en = models.TextField(blank=True, null=True)
    link_news_category_id = models.IntegerField()
    link_contributor_id = models.BigIntegerField()
    link_constituency_id = models.IntegerField(blank=True, null=True)
    link_union_parishad_id = models.IntegerField(blank=True, null=True)
    coll_news_entry_latitude = models.DecimalField(max_digits=9, decimal_places=6, blank=True, null=True)
    coll_news_entry_longitude = models.DecimalField(max_digits=9, decimal_places=6, blank=True, null=True)
    # coll_news_entry_geo_location — computed geography column from lat/lng; excluded from Django
    # (mssql-django cannot deserialize SQL Server geography type)
    coll_news_entry_formatted_address_bn = models.CharField(max_length=500, blank=True, null=True)
    # coll_news_entry_status — omitted so DB default applies on INSERT
    coll_news_entry_verification_notes = models.TextField(blank=True, null=True)
    coll_news_entry_is_breaking = models.BooleanField()
    coll_news_entry_external_source_url = models.CharField(max_length=1000, blank=True, null=True)
    occurrence_at = models.DateTimeField()
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField(blank=True, null=True)
    hash_headline_check = models.CharField(max_length=450, blank=True, null=True, editable=False)  # computed column — never INSERT/UPDATE

    class Meta:
        managed = False
        db_table = '[newshub].[coll_news_entry]'

    def __str__(self):
        return self.coll_news_entry_headline_bn[:80]


class CollNewsAsset(models.Model):
    """Junction table: news entry <-> media asset (composite PK in SQL Server)."""
    link_coll_news_entry_id = models.BigIntegerField(primary_key=True)
    link_asset_id = models.BigIntegerField()
    coll_news_asset_caption_bn = models.CharField(max_length=1000, blank=True, null=True)
    is_featured = models.BooleanField()
    sort_order = models.IntegerField()
    created_at = models.DateTimeField()

    class Meta:
        managed = False
        db_table = '[newshub].[coll_news_asset]'
        unique_together = [['link_coll_news_entry_id', 'link_asset_id']]

    def __str__(self):
        return f"CollNewsAsset({self.link_coll_news_entry_id}, {self.link_asset_id})"


class CollSocialSource(models.Model):
    coll_social_source_id = models.BigAutoField(primary_key=True)
    link_news_entry_id = models.BigIntegerField()
    link_platform_type_id = models.IntegerField()
    coll_social_source_url = models.CharField(max_length=1000)
    coll_social_source_embed_code = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField()

    class Meta:
        managed = False
        db_table = '[newshub].[coll_social_source]'

    def __str__(self):
        return f"SocialSource({self.coll_social_source_id})"


class CollNewsEntryTag(models.Model):
    """Junction table: news entry <-> tag (composite PK in SQL Server)."""
    link_coll_news_entry_id = models.BigIntegerField(primary_key=True)
    link_news_tag_id = models.IntegerField()
    created_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = '[newshub].[coll_news_entry_tag]'
        unique_together = [['link_coll_news_entry_id', 'link_news_tag_id']]

    def __str__(self):
        return f"CollNewsEntryTag({self.link_coll_news_entry_id}, {self.link_news_tag_id})"


# ========== Publishing Tables ==========

class PubArticle(models.Model):
    pub_article_id = models.BigAutoField(primary_key=True)
    link_news_entry_id = models.BigIntegerField()
    pub_article_slug = models.CharField(max_length=500)
    pub_article_headline_bn = models.CharField(max_length=1000)
    pub_article_content_bn = models.TextField()
    is_published = models.BooleanField()
    is_premium = models.BooleanField()
    published_at = models.DateTimeField(blank=True, null=True)
    created_at = models.DateTimeField()

    class Meta:
        managed = False
        db_table = '[newshub].[pub_article]'

    def __str__(self):
        return self.pub_article_headline_bn[:80]


# ========== Engagement Tables ==========

class EngArticleStat(models.Model):
    eng_article_stat_id = models.BigAutoField(primary_key=True)
    link_pub_article_id = models.BigIntegerField()
    view_count = models.IntegerField()
    share_count = models.IntegerField()
    updated_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = '[newshub].[eng_article_stat]'

    def __str__(self):
        return f"ArticleStat({self.link_pub_article_id})"


class EngComment(models.Model):
    eng_comment_id = models.BigAutoField(primary_key=True)
    link_pub_article_id = models.BigIntegerField()
    link_user_id = models.IntegerField()
    parent_comment_id = models.BigIntegerField(blank=True, null=True)
    eng_comment_text_bn = models.TextField()
    is_approved = models.BooleanField()
    created_at = models.DateTimeField()

    class Meta:
        managed = False
        db_table = '[newshub].[eng_comment]'

    def __str__(self):
        return f"Comment({self.eng_comment_id})"


# ========== Advertising Tables ==========

class AdsCampaign(models.Model):
    ads_campaign_id = models.BigAutoField(primary_key=True)
    link_ad_placement_id = models.IntegerField()
    ads_campaign_title_en = models.CharField(max_length=500, blank=True, null=True)
    ads_campaign_script_code = models.TextField(blank=True, null=True)
    ads_campaign_image_url = models.CharField(max_length=1000, blank=True, null=True)
    ads_campaign_redirect_url = models.CharField(max_length=1000, blank=True, null=True)
    is_active = models.BooleanField()
    start_at = models.DateTimeField()
    end_at = models.DateTimeField(blank=True, null=True)
    created_at = models.DateTimeField()

    class Meta:
        managed = False
        db_table = '[newshub].[ads_campaign]'

    def __str__(self):
        return self.ads_campaign_title_en or f"Campaign({self.ads_campaign_id})"


class AdsPerformanceLog(models.Model):
    ads_performance_log_id = models.BigAutoField(primary_key=True)
    link_ads_campaign_id = models.BigIntegerField()
    impression_count = models.IntegerField()
    click_count = models.IntegerField()
    log_date = models.DateField()

    class Meta:
        managed = False
        db_table = '[newshub].[ads_performance_log]'

    def __str__(self):
        return f"AdLog({self.link_ads_campaign_id}, {self.log_date})"


# ========== Audit Log Tables ==========

class VlogEditorialChange(models.Model):
    vlog_editorial_change_id = models.BigAutoField(primary_key=True)
    link_news_entry_id = models.BigIntegerField()
    vlog_editorial_change_edited_by_user_id = models.IntegerField()
    vlog_editorial_change_prev_headline_bn = models.CharField(max_length=1000, blank=True, null=True)
    vlog_editorial_change_prev_content_bn = models.TextField(blank=True, null=True)
    changed_at = models.DateTimeField()

    class Meta:
        managed = False
        db_table = '[newshub].[vlog_editorial_change]'

    def __str__(self):
        return f"EditChange({self.vlog_editorial_change_id})"


class VlogVerification(models.Model):
    vlog_verification_id = models.BigAutoField(primary_key=True)
    link_news_entry_id = models.BigIntegerField()
    vlog_verification_verified_by_user_id = models.IntegerField()
    vlog_verification_action_taken = models.CharField(max_length=50)
    vlog_verification_notes_bn = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField()

    class Meta:
        managed = False
        db_table = '[newshub].[vlog_verification]'

    def __str__(self):
        return f"Verification({self.vlog_verification_id})"
