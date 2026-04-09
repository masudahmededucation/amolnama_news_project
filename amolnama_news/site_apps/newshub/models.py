from django.db import models


# ========== Reference Tables ==========

class RefNewsFormType(models.Model):
    newshub_ref_news_form_type_id = models.IntegerField(primary_key=True)
    group_code            = models.CharField(max_length=100)
    form_name_en          = models.CharField(max_length=100)
    form_name_bn          = models.CharField(max_length=100)
    is_restricted         = models.BooleanField(default=False)
    is_active             = models.BooleanField()
    created_at            = models.DateTimeField()

    class Meta:
        managed = False
        db_table = '[newshub].[ref_news_form_type]'

    def __str__(self):
        return self.form_name_en


class NewshubUserFormAccess(models.Model):
    newshub_user_form_access_id = models.BigAutoField(primary_key=True)
    link_user_profile_id = models.BigIntegerField()
    link_newshub_ref_news_form_type_id = models.IntegerField()
    link_granted_by_user_profile_id = models.BigIntegerField()
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = '[newshub].[newshub_user_form_access]'

    def __str__(self):
        return f'FormAccess(user={self.link_user_profile_id}, form={self.link_newshub_ref_news_form_type_id})'


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


class RefSocialMediaPlatformType(models.Model):
    social_media_platform_type_id = models.IntegerField(primary_key=True)
    platform_name = models.CharField(max_length=100)
    platform_base_url = models.CharField(max_length=500, blank=True, null=True)
    platform_icon_url = models.CharField(max_length=1000, blank=True, null=True)
    is_active = models.BooleanField()
    sort_order = models.IntegerField(blank=True, null=True)
    created_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = '[media].[ref_social_media_platform_type]'

    def __str__(self):
        return self.platform_name


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


class RefActorType(models.Model):
    actor_type_id = models.IntegerField(primary_key=True)
    actor_group_code = models.CharField(max_length=50, blank=True, null=True)
    actor_type_name_en = models.CharField(max_length=100, blank=True, null=True)
    actor_type_name_bn = models.CharField(max_length=100)
    sort_order = models.IntegerField(blank=True, null=True)
    is_active = models.BooleanField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = '[newshub].[ref_actor_type]'

    def __str__(self):
        return self.actor_type_name_en or self.actor_type_name_bn



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
        db_table = '[newshub].[app_vw_news_category_tags]'

    def __str__(self):
        return self.news_tag_name_en or self.news_tag_name_bn


# ========== Collection Tables ==========

class Contributor(models.Model):
    newshub_contributor_id = models.BigAutoField(primary_key=True)
    link_user_profile_id = models.BigIntegerField(blank=True, null=True)
    link_contributor_type_id = models.IntegerField()
    contributor_full_name_bn = models.CharField(max_length=100)
    contributor_organization_bn = models.CharField(max_length=100, blank=True, null=True)
    contributor_contact_email = models.CharField(max_length=255, blank=True, null=True)
    contributor_contact_phone = models.CharField(max_length=50, blank=True, null=True)
    professional_bio_bn = models.CharField(max_length=1000, blank=True, null=True)
    is_verified = models.BooleanField()
    verification_date = models.DateTimeField(blank=True, null=True)
    created_at = models.DateTimeField()

    class Meta:
        managed = False
        db_table = '[newshub].[contributor]'

    def __str__(self):
        return self.contributor_full_name_bn



class CollNewsEntry(models.Model):
    newshub_coll_news_entry_id = models.BigAutoField(primary_key=True)
    link_form_type_id = models.IntegerField(blank=True, null=True)
    link_news_category_id = models.IntegerField()
    link_contributor_id = models.BigIntegerField()
    link_constituency_id = models.IntegerField(blank=True, null=True)
    link_district_id = models.IntegerField(blank=True, null=True)
    upazila_city_corporation_name = models.CharField(max_length=100, blank=True, null=True)
    link_union_parishad_id = models.IntegerField(blank=True, null=True)
    link_ward_name = models.CharField(max_length=100, blank=True, null=True)
    link_village_moholla_name = models.CharField(max_length=100, blank=True, null=True)
    news_headline_bn = models.CharField(max_length=100)
    news_summary_bn = models.CharField(max_length=400, blank=True, null=True)
    news_content_body_bn = models.TextField()
    news_headline_en = models.CharField(max_length=1000, blank=True, null=True)
    news_summary_en = models.CharField(max_length=2000, blank=True, null=True)
    news_content_body_en = models.TextField(blank=True, null=True)
    coll_news_entry_latitude = models.DecimalField(max_digits=9, decimal_places=6, blank=True, null=True)
    coll_news_entry_longitude = models.DecimalField(max_digits=9, decimal_places=6, blank=True, null=True)
    # coll_news_entry_geo_location — geography column; excluded from Django
    # (mssql-django cannot deserialize SQL Server geography type)
    map_formatted_address_bn = models.CharField(max_length=500, blank=True, null=True)
    full_address_bn = models.CharField(max_length=300, blank=True, null=True)
    # news_status — omitted so DB default ('pending') applies on INSERT
    link_ref_status_article_publication_status_id = models.IntegerField(db_column='link_ref_status_article_publication_status_id')
    coll_news_entry_verification_notes = models.TextField(blank=True, null=True)
    is_breaking = models.BooleanField()
    coll_news_entry_external_source_url = models.CharField(max_length=1000, blank=True, null=True)
    occurrence_at = models.DateTimeField()
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField(blank=True, null=True)
    link_content_ref_content_subcategory_id = models.IntegerField(blank=True, null=True)
    # hash_headline_check — excluded from Django model
    # so ORM never includes it in INSERT/UPDATE statements.

    class Meta:
        managed = False
        db_table = '[newshub].[coll_news_entry]'

    def __str__(self):
        return self.news_headline_bn[:80]


class NewsAsset(models.Model):
    """Junction table: news entry <-> media asset (composite PK in SQL Server)."""
    link_newshub_coll_news_entry_id = models.BigIntegerField(primary_key=True)
    link_asset_id = models.BigIntegerField()
    news_asset_caption_bn = models.CharField(max_length=1000, blank=True, null=True)
    is_featured = models.BooleanField()
    asset_group_code = models.CharField(max_length=50, blank=True, null=True)
    view_count = models.IntegerField(default=0)
    like_count = models.IntegerField(default=0)
    sort_order = models.IntegerField()
    created_at = models.DateTimeField()

    class Meta:
        managed = False
        db_table = '[newshub].[news_asset]'
        unique_together = [['link_newshub_coll_news_entry_id', 'link_asset_id']]

    def __str__(self):
        return f"NewsAsset({self.link_newshub_coll_news_entry_id}, {self.link_asset_id})"


class NewsSocialMediaSource(models.Model):
    newshub_news_social_media_source_id = models.BigAutoField(primary_key=True)
    link_newshub_coll_news_entry_id = models.BigIntegerField()
    link_social_media_url_library_id = models.BigIntegerField()
    created_at = models.DateTimeField()

    class Meta:
        managed = False
        db_table = '[newshub].[news_social_media_source]'

    def __str__(self):
        return f"NewsSocialSource({self.newshub_news_social_media_source_id})"


class NewsEntryTag(models.Model):
    """Junction table: news entry <-> tag (composite PK in SQL Server)."""
    link_newshub_coll_news_entry_id = models.BigIntegerField(primary_key=True)
    link_news_category_tag_id = models.IntegerField()
    created_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = '[newshub].[news_entry_tag]'
        unique_together = [['link_newshub_coll_news_entry_id', 'link_news_category_tag_id']]

    def __str__(self):
        return f"NewsEntryTag({self.link_newshub_coll_news_entry_id}, {self.link_news_category_tag_id})"


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
    link_content_registry_id = models.BigIntegerField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = '[newshub].[pub_article]'

    def __str__(self):
        return self.pub_article_headline_bn[:80]


# ========== Engagement Tables ==========

class EngagementArticleStat(models.Model):
    newshub_engagement_article_stat_id = models.BigAutoField(primary_key=True)
    link_pub_article_id = models.BigIntegerField()
    view_count = models.IntegerField()
    share_count = models.IntegerField()
    like_count = models.IntegerField(default=0)
    updated_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = '[newshub].[engagement_article_stat]'

    def __str__(self):
        return f"ArticleStat({self.link_pub_article_id})"


class EngagementComment(models.Model):
    newshub_engagement_comment_id = models.BigAutoField(primary_key=True)
    link_pub_article_id = models.BigIntegerField()
    link_user_id = models.IntegerField()
    parent_comment_id = models.BigIntegerField(blank=True, null=True)
    engagement_comment_text = models.TextField()
    is_approved = models.BooleanField()
    created_at = models.DateTimeField()

    class Meta:
        managed = False
        db_table = '[newshub].[engagement_comment]'

    def __str__(self):
        return f"Comment({self.newshub_engagement_comment_id})"


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


# ========== Article View Tables ==========

class ArticleEditHistory(models.Model):
    article_edit_history_id = models.BigAutoField(primary_key=True)
    link_newshub_coll_news_entry_id = models.BigIntegerField()
    link_user_profile_id = models.BigIntegerField()
    article_edit_type_code = models.CharField(max_length=50)
    article_edit_summary_bn = models.CharField(max_length=500, blank=True, null=True)
    article_edit_summary_en = models.CharField(max_length=500, blank=True, null=True)
    target_field_name = models.CharField(max_length=200, blank=True, null=True)
    target_field_old_value = models.CharField(max_length=8000, blank=True, null=True)
    target_field_new_value = models.CharField(max_length=8000, blank=True, null=True)
    is_approved = models.BooleanField()
    link_approved_by_user_profile_id = models.BigIntegerField(blank=True, null=True)
    approved_at = models.DateTimeField(blank=True, null=True)
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = '[newshub].[article_edit_history]'

    def __str__(self):
        return f"EditHistory({self.article_edit_history_id})"


class ArticleCommunityAddition(models.Model):
    article_community_addition_id = models.BigAutoField(primary_key=True)
    link_newshub_coll_news_entry_id = models.BigIntegerField()
    link_user_profile_id = models.BigIntegerField()
    community_addition_type_code = models.CharField(max_length=50)
    community_addition_title_bn = models.CharField(max_length=200, blank=True, null=True)
    community_addition_body_bn = models.CharField(max_length=8000, blank=True, null=True)
    community_addition_body_en = models.CharField(max_length=8000, blank=True, null=True)
    community_addition_source_url = models.CharField(max_length=1000, blank=True, null=True)
    status_code = models.CharField(max_length=50)
    link_reviewed_by_user_profile_id = models.BigIntegerField(blank=True, null=True)
    reviewed_at = models.DateTimeField(blank=True, null=True)
    review_note = models.CharField(max_length=500, blank=True, null=True)
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = '[newshub].[article_community_addition]'

    def __str__(self):
        return f"Addition({self.article_community_addition_id})"


class CommunityUserReputation(models.Model):
    community_user_reputation_id = models.BigAutoField(primary_key=True)
    link_user_profile_id = models.BigIntegerField()
    total_points_count = models.IntegerField()
    articles_submitted_count = models.IntegerField()
    articles_approved_count = models.IntegerField()
    edits_made_count = models.IntegerField()
    edits_approved_count = models.IntegerField()
    additions_submitted_count = models.IntegerField()
    additions_approved_count = models.IntegerField()
    current_privilege_level_count = models.IntegerField()
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = '[account].[community_user_reputation]'

    def __str__(self):
        return f"Reputation(user={self.link_user_profile_id}, points={self.total_points_count})"


class RefCommunityPrivilegeLevel(models.Model):
    ref_community_privilege_level_id = models.IntegerField(primary_key=True)
    privilege_level_code = models.CharField(max_length=50)
    name_bn = models.CharField(max_length=100)
    name_en = models.CharField(max_length=100)
    min_points_required_count = models.IntegerField()
    is_can_edit_own_article = models.BooleanField()
    is_can_suggest_edits = models.BooleanField()
    is_can_edit_others_article = models.BooleanField()
    is_can_approve_additions = models.BooleanField()
    is_can_approve_edits = models.BooleanField()
    is_can_delete_article = models.BooleanField()
    sort_order = models.IntegerField()
    is_active = models.BooleanField()
    created_at = models.DateTimeField()

    class Meta:
        managed = False
        db_table = '[account].[ref_community_privilege_level]'

    def __str__(self):
        return f"{self.name_en} (level {self.ref_community_privilege_level_id})"
