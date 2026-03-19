from django.db import models


# ---------------------------------------------------------------------------
# Entertainment form fact — Steps 4-6 of the Entertainment multi-step form
# DB table:  [investigation].[entertainment_form_fact]
# ---------------------------------------------------------------------------
class EntertainmentFormFact(models.Model):
    entertainment_form_fact_id = models.BigAutoField(primary_key=True)
    link_coll_news_entry_id    = models.BigIntegerField()

    # Step 3: Medium & Sub-Type (মাধ্যম ও সংবাদের ধরন)
    link_ref_status_entertainment_form_medium_type_id    = models.IntegerField(blank=True, null=True)
    link_ref_status_entertainment_form_issue_sub_type_id = models.IntegerField(blank=True, null=True)

    # Step 4: Production Details (প্রযোজনার তথ্য)
    prod_title_name_bn                          = models.CharField(max_length=500)  # NOT NULL
    prod_link_ref_language_id                   = models.IntegerField(blank=True, null=True, db_column='link_ref_status_entertainment_form_language_id')
    prod_link_ref_entertainment_industry_id     = models.IntegerField(blank=True, null=True, db_column='link_ref_status_entertainment_form_entertainment_industry_id')
    prod_director_bn                            = models.CharField(max_length=100, blank=True, null=True)
    prod_producer_house_bn                      = models.CharField(max_length=100, blank=True, null=True)
    prod_writer_screenwriter_bn                 = models.CharField(max_length=100, blank=True, null=True)
    prod_music_director_singer_bn               = models.CharField(max_length=100, blank=True, null=True)

    # Step 5: Cast & Release (কাস্ট ও মুক্তি)
    cast_lead_cast_bn                           = models.CharField(max_length=2000, blank=True, null=True)
    cast_supporting_cast_bn                     = models.CharField(max_length=2000, blank=True, null=True)
    cast_release_date                           = models.DateField(blank=True, null=True)
    cast_link_ref_media_platform_id             = models.IntegerField(blank=True, null=True, db_column='link_ref_status_entertainment_form_media_platform_id')
    cast_link_ref_genre_category_id             = models.IntegerField(blank=True, null=True, db_column='link_ref_status_entertainment_form_genre_category_id')

    # Step 6: Performance & Reception (পারফরম্যান্স ও প্রতিক্রিয়া)
    perf_box_office_revenue_bn                  = models.CharField(max_length=100, blank=True, null=True)
    perf_views_streams_bn                       = models.CharField(max_length=100, blank=True, null=True)
    perf_rating_bn                              = models.CharField(max_length=100, blank=True, null=True)
    perf_link_ref_audience_response_id          = models.IntegerField(blank=True, null=True, db_column='link_ref_status_entertainment_form_audience_response_id')

    created_at = models.DateTimeField()
    updated_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = '[investigation].[entertainment_form_fact]'

    def __str__(self):
        return f"EntertainmentFormFact({self.entertainment_form_fact_id})"
