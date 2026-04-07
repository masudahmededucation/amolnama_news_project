"""Bangladesh app models — mapped to SQL Server [bangladesh] schema (managed=False)."""

from django.db import models
from django.utils import timezone


# ============================================================================
# REFERENCE TABLES
# ============================================================================

class RefDestinationCategory(models.Model):
    bangladesh_ref_destination_category_id = models.IntegerField(primary_key=True)
    destination_category_code = models.CharField(max_length=50)
    destination_category_name_en = models.CharField(max_length=100)
    destination_category_name_bn = models.CharField(max_length=100)
    destination_category_icon = models.CharField(max_length=100, blank=True, null=True)
    sort_order = models.IntegerField(blank=True, null=True)
    is_active = models.BooleanField()
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = "[blog_bangladesh].[ref_destination_category]"

    def __str__(self):
        return self.destination_category_name_en


class RefSeason(models.Model):
    bangladesh_ref_season_id = models.IntegerField(primary_key=True)
    season_code = models.CharField(max_length=50)
    season_name_en = models.CharField(max_length=100)
    season_name_bn = models.CharField(max_length=100)
    season_months = models.CharField(max_length=200, blank=True, null=True)
    sort_order = models.IntegerField(blank=True, null=True)
    is_active = models.BooleanField()
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = "[blog_bangladesh].[ref_season]"

    def __str__(self):
        return self.season_name_en


class RefMediaCategory(models.Model):
    bangladesh_ref_media_category_id = models.IntegerField(primary_key=True)
    media_category_code = models.CharField(max_length=50)
    media_category_name_en = models.CharField(max_length=100)
    media_category_name_bn = models.CharField(max_length=100)
    media_category_icon = models.CharField(max_length=100, blank=True, null=True)
    sort_order = models.IntegerField(blank=True, null=True)
    is_active = models.BooleanField()
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = "[blog_bangladesh].[ref_media_category]"

    def __str__(self):
        return self.media_category_name_en


# ============================================================================
# TRAVEL HUB — COLLECTION TABLES
# ============================================================================

class CollDestination(models.Model):
    bangladesh_coll_destination_id = models.BigAutoField(primary_key=True)
    link_user_profile_id = models.BigIntegerField()
    link_destination_category_id = models.IntegerField()
    link_best_season_id = models.IntegerField(blank=True, null=True)
    link_division_id = models.IntegerField(blank=True, null=True)
    link_district_id = models.IntegerField(blank=True, null=True)
    link_upazila_id = models.IntegerField(blank=True, null=True)

    destination_name_en = models.CharField(max_length=300)
    destination_name_bn = models.CharField(max_length=300)
    destination_slug = models.CharField(max_length=300, blank=True, null=True)
    destination_description_en = models.TextField(blank=True, null=True)
    destination_description_bn = models.TextField(blank=True, null=True)
    destination_short_description_en = models.CharField(max_length=500, blank=True, null=True)
    destination_short_description_bn = models.CharField(max_length=500, blank=True, null=True)

    destination_latitude = models.DecimalField(max_digits=9, decimal_places=6, blank=True, null=True)
    destination_longitude = models.DecimalField(max_digits=9, decimal_places=6, blank=True, null=True)
    map_formatted_address_bn = models.CharField(max_length=500, blank=True, null=True)
    full_address_bn = models.CharField(max_length=300, blank=True, null=True)

    entry_fee_bdt = models.DecimalField(max_digits=10, decimal_places=2, blank=True, null=True)
    entry_fee_note_bn = models.CharField(max_length=300, blank=True, null=True)
    visiting_hours_en = models.CharField(max_length=200, blank=True, null=True)
    visiting_hours_bn = models.CharField(max_length=200, blank=True, null=True)
    difficulty_level = models.CharField(max_length=20, blank=True, null=True)

    cover_image_url = models.CharField(max_length=1000, blank=True, null=True)
    destination_status = models.CharField(max_length=20)
    is_featured = models.BooleanField()

    like_count = models.IntegerField()
    view_count = models.IntegerField()
    review_count = models.IntegerField()
    avg_rating = models.DecimalField(max_digits=3, decimal_places=2, blank=True, null=True)

    created_at = models.DateTimeField()
    updated_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = "[blog_bangladesh].[coll_destination]"

    def __str__(self):
        return self.destination_name_en


class DestinationPhoto(models.Model):
    bangladesh_destination_photo_id = models.BigAutoField(primary_key=True)
    link_coll_destination_id = models.BigIntegerField()
    link_user_profile_id = models.BigIntegerField()
    photo_url = models.CharField(max_length=1000)
    photo_thumbnail_url = models.CharField(max_length=1000, blank=True, null=True)
    caption_en = models.CharField(max_length=500, blank=True, null=True)
    caption_bn = models.CharField(max_length=500, blank=True, null=True)
    sort_order = models.IntegerField()
    is_cover = models.BooleanField()
    view_count = models.IntegerField(default=0)
    like_count = models.IntegerField(default=0)
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = "[blog_bangladesh].[destination_photo]"


class Accommodation(models.Model):
    bangladesh_accommodation_id = models.BigAutoField(primary_key=True)
    link_coll_destination_id = models.BigIntegerField()
    link_user_profile_id = models.BigIntegerField()
    accommodation_name_en = models.CharField(max_length=300)
    accommodation_name_bn = models.CharField(max_length=300, blank=True, null=True)
    accommodation_type = models.CharField(max_length=50)
    accommodation_description_en = models.TextField(blank=True, null=True)
    accommodation_description_bn = models.TextField(blank=True, null=True)
    price_range_min_bdt = models.DecimalField(max_digits=10, decimal_places=2, blank=True, null=True)
    price_range_max_bdt = models.DecimalField(max_digits=10, decimal_places=2, blank=True, null=True)
    price_note_bn = models.CharField(max_length=300, blank=True, null=True)
    amenities_json = models.TextField(blank=True, null=True)
    contact_phone = models.CharField(max_length=50, blank=True, null=True)
    contact_email = models.CharField(max_length=255, blank=True, null=True)
    contact_website = models.CharField(max_length=500, blank=True, null=True)
    contact_address_bn = models.CharField(max_length=500, blank=True, null=True)
    accommodation_latitude = models.DecimalField(max_digits=9, decimal_places=6, blank=True, null=True)
    accommodation_longitude = models.DecimalField(max_digits=9, decimal_places=6, blank=True, null=True)
    star_rating = models.DecimalField(max_digits=2, decimal_places=1, blank=True, null=True)
    is_active = models.BooleanField()
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = "[blog_bangladesh].[accommodation]"

    def __str__(self):
        return self.accommodation_name_en


class TransportRoute(models.Model):
    bangladesh_transport_route_id = models.BigAutoField(primary_key=True)
    link_coll_destination_id = models.BigIntegerField()
    link_user_profile_id = models.BigIntegerField()
    transport_mode = models.CharField(max_length=30)
    departure_point_en = models.CharField(max_length=300, blank=True, null=True)
    departure_point_bn = models.CharField(max_length=300, blank=True, null=True)
    route_description_en = models.TextField(blank=True, null=True)
    route_description_bn = models.TextField(blank=True, null=True)
    estimated_duration_minutes = models.IntegerField(blank=True, null=True)
    estimated_cost_bdt = models.DecimalField(max_digits=10, decimal_places=2, blank=True, null=True)
    cost_note_bn = models.CharField(max_length=300, blank=True, null=True)
    frequency_note_en = models.CharField(max_length=200, blank=True, null=True)
    frequency_note_bn = models.CharField(max_length=200, blank=True, null=True)
    sort_order = models.IntegerField()
    is_active = models.BooleanField()
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = "[blog_bangladesh].[transport_route]"


class TravelTip(models.Model):
    bangladesh_travel_tip_id = models.BigAutoField(primary_key=True)
    link_coll_destination_id = models.BigIntegerField()
    link_user_profile_id = models.BigIntegerField()
    tip_text_en = models.TextField(blank=True, null=True)
    tip_text_bn = models.TextField(blank=True, null=True)
    tip_category = models.CharField(max_length=30, blank=True, null=True)
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = "[blog_bangladesh].[travel_tip]"


# ============================================================================
# TRAVEL HUB — ENGAGEMENT TABLES
# ============================================================================

class EngagementDestinationReview(models.Model):
    bangladesh_engagement_destination_review_id = models.BigAutoField(primary_key=True)
    link_coll_destination_id = models.BigIntegerField()
    link_user_profile_id = models.BigIntegerField()
    rating_overall = models.IntegerField()
    rating_scenery = models.IntegerField(blank=True, null=True)
    rating_accessibility = models.IntegerField(blank=True, null=True)
    rating_safety = models.IntegerField(blank=True, null=True)
    rating_food = models.IntegerField(blank=True, null=True)
    rating_accommodation = models.IntegerField(blank=True, null=True)
    review_title_en = models.CharField(max_length=200, blank=True, null=True)
    review_title_bn = models.CharField(max_length=200, blank=True, null=True)
    review_body_en = models.TextField(blank=True, null=True)
    review_body_bn = models.TextField(blank=True, null=True)
    visited_at = models.DateField(blank=True, null=True)
    helpful_count = models.IntegerField()
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = "[blog_bangladesh].[engagement_destination_review]"


class EngagementDestinationBookmark(models.Model):
    bangladesh_engagement_destination_bookmark_id = models.BigAutoField(primary_key=True)
    link_coll_destination_id = models.BigIntegerField()
    link_user_profile_id = models.BigIntegerField()
    bookmark_note = models.CharField(max_length=300, blank=True, null=True)
    created_at = models.DateTimeField()

    class Meta:
        managed = False
        db_table = "[blog_bangladesh].[engagement_destination_bookmark]"


class EngagementDestinationPhotoLike(models.Model):
    bangladesh_engagement_destination_photo_like_id = models.BigAutoField(primary_key=True)
    link_destination_photo_id = models.BigIntegerField()
    link_user_profile_id = models.BigIntegerField()
    created_at = models.DateTimeField()

    class Meta:
        managed = False
        db_table = "[blog_bangladesh].[engagement_destination_photo_like]"
        unique_together = [["link_destination_photo_id", "link_user_profile_id"]]


class EngagementDestinationVideoLike(models.Model):
    bangladesh_engagement_destination_video_like_id = models.BigAutoField(primary_key=True)
    link_destination_youtube_link_id = models.BigIntegerField()
    link_user_profile_id = models.BigIntegerField()
    created_at = models.DateTimeField()

    class Meta:
        managed = False
        db_table = "[blog_bangladesh].[engagement_destination_video_like]"
        unique_together = [["link_destination_youtube_link_id", "link_user_profile_id"]]


class DestinationYoutubeLink(models.Model):
    bangladesh_destination_youtube_link_id = models.BigAutoField(primary_key=True)
    link_coll_destination_id = models.BigIntegerField()
    link_user_profile_id = models.BigIntegerField()
    youtube_url = models.CharField(max_length=1000)
    youtube_video_id = models.CharField(max_length=20, blank=True, null=True)
    video_platform = models.CharField(max_length=20, blank=True, null=True)
    video_thumbnail_url = models.CharField(max_length=1000, blank=True, null=True)
    video_title_bn = models.CharField(max_length=300, blank=True, null=True)
    video_title_en = models.CharField(max_length=300, blank=True, null=True)
    description_bn = models.CharField(max_length=1000, blank=True, null=True)
    sort_order = models.IntegerField(default=0)
    view_count = models.IntegerField(default=0)
    like_count = models.IntegerField(default=0)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = "[blog_bangladesh].[destination_youtube_link]"


class DestinationReferenceLink(models.Model):
    bangladesh_destination_reference_link_id = models.BigAutoField(primary_key=True)
    link_coll_destination_id = models.BigIntegerField()
    link_user_profile_id = models.BigIntegerField()
    reference_url = models.CharField(max_length=2000)
    reference_title_bn = models.CharField(max_length=300, blank=True, null=True)
    reference_title_en = models.CharField(max_length=300, blank=True, null=True)
    description_bn = models.CharField(max_length=1000, blank=True, null=True)
    sort_order = models.IntegerField(default=0)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = "[blog_bangladesh].[destination_reference_link]"


# ============================================================================
# BEAUTY OF BANGLADESH — COLLECTION TABLES
# ============================================================================

class CollMediaEntry(models.Model):
    bangladesh_coll_media_entry_id = models.BigAutoField(primary_key=True)
    link_user_profile_id = models.BigIntegerField()
    link_media_category_id = models.IntegerField()
    link_season_id = models.IntegerField(blank=True, null=True)
    link_division_id = models.IntegerField(blank=True, null=True)
    link_district_id = models.IntegerField(blank=True, null=True)

    media_title_en = models.CharField(max_length=300, blank=True, null=True)
    media_title_bn = models.CharField(max_length=300, blank=True, null=True)
    media_description_en = models.TextField(blank=True, null=True)
    media_description_bn = models.TextField(blank=True, null=True)

    media_type = models.CharField(max_length=10)

    file_original_url = models.CharField(max_length=1000)
    file_display_url = models.CharField(max_length=1000, blank=True, null=True)
    file_thumbnail_url = models.CharField(max_length=1000, blank=True, null=True)

    file_width_px = models.IntegerField(blank=True, null=True)
    file_height_px = models.IntegerField(blank=True, null=True)
    file_duration_seconds = models.IntegerField(blank=True, null=True)
    file_size_bytes = models.BigIntegerField(blank=True, null=True)
    file_mime_type = models.CharField(max_length=100, blank=True, null=True)

    exif_camera_make = models.CharField(max_length=100, blank=True, null=True)
    exif_camera_model = models.CharField(max_length=100, blank=True, null=True)
    exif_lens = models.CharField(max_length=200, blank=True, null=True)
    exif_focal_length = models.CharField(max_length=20, blank=True, null=True)
    exif_aperture = models.CharField(max_length=20, blank=True, null=True)
    exif_shutter_speed = models.CharField(max_length=20, blank=True, null=True)
    exif_iso = models.IntegerField(blank=True, null=True)

    location_name_en = models.CharField(max_length=300, blank=True, null=True)
    location_name_bn = models.CharField(max_length=300, blank=True, null=True)
    media_latitude = models.DecimalField(max_digits=9, decimal_places=6, blank=True, null=True)
    media_longitude = models.DecimalField(max_digits=9, decimal_places=6, blank=True, null=True)

    time_of_day = models.CharField(max_length=20, blank=True, null=True)
    captured_at = models.DateTimeField(blank=True, null=True)

    event_date_from = models.DateField(blank=True, null=True)
    event_date_to = models.DateField(blank=True, null=True)
    is_yearly_event = models.BooleanField()

    visibility = models.CharField(max_length=20)
    media_status = models.CharField(max_length=20)

    like_count = models.IntegerField()
    view_count = models.IntegerField()
    comment_count = models.IntegerField()

    created_at = models.DateTimeField()
    updated_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = "[blog_bangladesh].[coll_media_entry]"

    def __str__(self):
        return self.media_title_bn or self.media_title_en or f"Media({self.bangladesh_coll_media_entry_id})"


class CollMediaAlbum(models.Model):
    bangladesh_coll_media_album_id = models.BigAutoField(primary_key=True)
    link_user_profile_id = models.BigIntegerField()
    album_title_en = models.CharField(max_length=300, blank=True, null=True)
    album_title_bn = models.CharField(max_length=300, blank=True, null=True)
    album_description_en = models.TextField(blank=True, null=True)
    album_description_bn = models.TextField(blank=True, null=True)
    cover_image_url = models.CharField(max_length=1000, blank=True, null=True)
    visibility = models.CharField(max_length=20)
    entry_count = models.IntegerField()
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = "[blog_bangladesh].[coll_media_album]"

    def __str__(self):
        return self.album_title_bn or self.album_title_en or f"Album({self.bangladesh_coll_media_album_id})"


class MapMediaTag(models.Model):
    bangladesh_map_media_tag_id = models.IntegerField(primary_key=True)
    tag_name_en = models.CharField(max_length=100)
    tag_name_bn = models.CharField(max_length=100, blank=True, null=True)
    tag_slug = models.CharField(max_length=100)
    usage_count = models.IntegerField()
    created_at = models.DateTimeField()

    class Meta:
        managed = False
        db_table = "[blog_bangladesh].[map_media_tag]"

    def __str__(self):
        return self.tag_name_en


# ============================================================================
# BEAUTY OF BANGLADESH — ENGAGEMENT TABLES
# ============================================================================

class EngagementMediaLike(models.Model):
    bangladesh_engagement_media_like_id = models.BigAutoField(primary_key=True)
    link_coll_media_entry_id = models.BigIntegerField()
    link_user_profile_id = models.BigIntegerField()
    created_at = models.DateTimeField()

    class Meta:
        managed = False
        db_table = "[blog_bangladesh].[engagement_media_like]"
        unique_together = [["link_coll_media_entry_id", "link_user_profile_id"]]


class EngagementMediaComment(models.Model):
    bangladesh_engagement_media_comment_id = models.BigAutoField(primary_key=True)
    link_coll_media_entry_id = models.BigIntegerField()
    link_user_profile_id = models.BigIntegerField()
    link_parent_comment_id = models.BigIntegerField(blank=True, null=True)
    comment_text_bn = models.TextField(blank=True, null=True)
    comment_text_en = models.TextField(blank=True, null=True)
    like_count = models.IntegerField()
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = "[blog_bangladesh].[engagement_media_comment]"
