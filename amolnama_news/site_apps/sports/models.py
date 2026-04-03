from django.db import models


# ---------------------------------------------------------------------------
# Sports form fact — Steps 4-6 of the Sports multi-step form
# DB table:  [investigation].[sports_form_fact]
# ---------------------------------------------------------------------------
class SportsFormFact(models.Model):
    sports_form_fact_id     = models.BigAutoField(primary_key=True)
    link_newshub_coll_news_entry_id = models.BigIntegerField()

    # Step 3: Sport Type & News Sub-Type
    link_ref_status_sports_form_sport_list_id      = models.IntegerField(blank=True, null=True)
    link_ref_status_sports_form_sub_issue_type_id   = models.IntegerField(blank=True, null=True)

    # Match & Event Details (ম্যাচ ও ইভেন্ট তথ্য)
    event_tournament_name                   = models.CharField(max_length=255, blank=True, null=True)
    event_link_ref_tournament_round_stage_id    = models.IntegerField(blank=True, null=True, db_column='link_ref_status_sports_form_tournament_round_stage_id')
    event_tournament_round_stage            = models.CharField(max_length=100, blank=True, null=True)
    event_venue_stadium                     = models.CharField(max_length=255, blank=True, null=True)
    event_match_date                           = models.DateField(blank=True, null=True)
    event_link_ref_match_status_id             = models.IntegerField(blank=True, null=True, db_column='link_ref_status_sports_form_match_status_id')

    # Teams / Players & Result (দল / খেলোয়াড় ও ফলাফল)
    match_team_player_a                     = models.CharField(max_length=255, blank=True, null=True)
    match_team_player_b                     = models.CharField(max_length=255, blank=True, null=True)
    match_score_a                              = models.CharField(max_length=100, blank=True, null=True)
    match_score_b                              = models.CharField(max_length=100, blank=True, null=True)
    match_result_summary                    = models.CharField(max_length=500, blank=True, null=True)
    match_toss_winner                       = models.CharField(max_length=100, blank=True, null=True)
    match_toss_decision                     = models.CharField(max_length=100, blank=True, null=True)
    match_player_of_the_match               = models.CharField(max_length=255, blank=True, null=True)

    # Key Performances & Records (মূল পারফরম্যান্স ও রেকর্ড)
    perf_top_performer_1_name               = models.CharField(max_length=255, blank=True, null=True)
    perf_top_performer_1_desc               = models.CharField(max_length=500, blank=True, null=True)
    perf_top_performer_2_name               = models.CharField(max_length=255, blank=True, null=True)
    perf_top_performer_2_desc               = models.CharField(max_length=500, blank=True, null=True)
    perf_top_performer_3_name               = models.CharField(max_length=255, blank=True, null=True)
    perf_top_performer_3_desc               = models.CharField(max_length=500, blank=True, null=True)
    perf_records_milestones                 = models.TextField(blank=True, null=True)   # NVARCHAR(MAX)
    perf_tournament_standing                = models.CharField(max_length=500, blank=True, null=True)

    created_at = models.DateTimeField()
    updated_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = '[investigation].[sports_form_fact]'

    def __str__(self):
        return f"SportsFormFact({self.sports_form_fact_id})"
