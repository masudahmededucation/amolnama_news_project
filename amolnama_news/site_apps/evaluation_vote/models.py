from django.db import models
from django.db import connection


class RefEvaluation(models.Model):
    """মূল্যায়ন - Evaluation events"""
    evaluation_id = models.IntegerField(primary_key=True)
    evaluation_name_en = models.CharField(max_length=200)
    evaluation_name_bn = models.CharField(max_length=200)
    evaluation_description_bn = models.CharField(max_length=500, blank=True, null=True)
    sort_order = models.IntegerField(blank=True, null=True)
    is_active = models.BooleanField(blank=True, null=True)
    start_date = models.DateField(blank=True, null=True)
    end_date = models.DateField(blank=True, null=True)
    created_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = '[evaluation].[ref_evaluation]'

    def __str__(self):
        return self.evaluation_name_en or f"Evaluation {self.evaluation_id}"


class RefQuestionCategory(models.Model):
    """প্রশ্ন বিভাগ - Question categories"""
    question_category_id = models.IntegerField(primary_key=True)
    link_evaluation_id = models.IntegerField()
    category_name_en = models.CharField(max_length=200, blank=True, null=True)
    category_name_bn = models.CharField(max_length=200)
    answer_mark_weight = models.IntegerField(blank=True, null=True)
    sort_order = models.IntegerField(blank=True, null=True)
    is_active = models.BooleanField()

    class Meta:
        managed = False
        db_table = '[evaluation].[ref_question_category]'

    def __str__(self):
        return self.category_name_en or self.category_name_bn

    @property
    def evaluation(self):
        """Get related evaluation"""
        return RefEvaluation.objects.filter(evaluation_id=self.link_evaluation_id).first()


class RefQuestion(models.Model):
    """প্রশ্ন - Evaluation questions"""
    question_id = models.IntegerField(primary_key=True)
    link_evaluation_id = models.IntegerField()
    link_question_category_id = models.IntegerField()
    question_no = models.IntegerField()
    question_text_en = models.CharField(max_length=300, blank=True, null=True)
    question_text_bn = models.CharField(max_length=300)
    sort_order = models.IntegerField(blank=True, null=True)
    is_active = models.BooleanField()

    class Meta:
        managed = False
        db_table = '[evaluation].[ref_question]'

    def __str__(self):
        return self.question_text_en or self.question_text_bn

    @property
    def evaluation(self):
        """Get related evaluation"""
        return RefEvaluation.objects.filter(evaluation_id=self.link_evaluation_id).first()

    @property
    def category(self):
        """Get related question category"""
        return RefQuestionCategory.objects.filter(question_category_id=self.link_question_category_id).first()


class RefQuestionOption(models.Model):
    """প্রশ্নের উত্তর - Question options/answers"""
    question_option_id = models.IntegerField(primary_key=True)
    link_question_id = models.IntegerField()
    question_option_text_en = models.CharField(max_length=300, blank=True, null=True)
    question_option_text_bn = models.CharField(max_length=300)
    answer_marks = models.IntegerField(blank=True, null=True)
    is_correct_answer = models.BooleanField(blank=True, null=True)
    sort_order = models.IntegerField(blank=True, null=True)
    is_active = models.BooleanField()
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = '[evaluation].[ref_question_option]'

    def __str__(self):
        return self.question_option_text_en or self.question_option_text_bn

    @property
    def question(self):
        """Get related question"""
        return RefQuestion.objects.filter(question_id=self.link_question_id).first()


class EvaluationResponse(models.Model):
    """মূল্যায়ন প্রতিক্রিয়া - User evaluation responses"""
    evaluation_response_id = models.BigAutoField(primary_key=True)  # Identity
    link_evaluation_id = models.IntegerField()
    link_party_id = models.IntegerField(blank=True, null=True)
    link_constituency_id = models.IntegerField(blank=True, null=True)
    link_union_parishad_id = models.IntegerField(blank=True, null=True)
    link_candidate_id = models.IntegerField(blank=True, null=True)
    link_question_id = models.IntegerField(blank=True, null=True)
    link_question_option_id = models.IntegerField(blank=True, null=True)
    link_user_session_id = models.BigIntegerField(blank=True, null=True)
    marks_awarded = models.IntegerField(blank=True, null=True)
    remarks_bn = models.CharField(max_length=500, blank=True, null=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    modified_at = models.DateTimeField(auto_now=True, blank=True, null=True)

    class Meta:
        managed = False
        db_table = '[evaluation].[evaluation_response]'

    def __str__(self):
        return f"Response {self.evaluation_response_id}"

    @property
    def evaluation(self):
        """Get related evaluation"""
        return RefEvaluation.objects.filter(evaluation_id=self.link_evaluation_id).first()

    @property
    def question(self):
        """Get related question"""
        if self.link_question_id:
            return RefQuestion.objects.filter(question_id=self.link_question_id).first()
        return None

    @property
    def question_option(self):
        """Get related question option"""
        return RefQuestionOption.objects.filter(question_option_id=self.link_question_option_id).first()

    @property
    def constituency(self):
        """Get related constituency from locations app"""
        if self.link_constituency_id:
            from amolnama_news.site_apps.locations.models import Constituency
            return Constituency.objects.filter(constituency_id=self.link_constituency_id).first()
        return None

    @property
    def union_parishad(self):
        """Get related union parishad from locations app"""
        if self.link_union_parishad_id:
            from amolnama_news.site_apps.locations.models import UnionParishad
            return UnionParishad.objects.filter(union_parishad_id=self.link_union_parishad_id).first()
        return None


class EvaluationResult(models.Model):
    """মূল্যায়ন ফলাফল - Evaluation results"""
    evaluation_result_id = models.BigAutoField(primary_key=True)
    link_evaluation_id = models.IntegerField()
    link_candidate_id = models.IntegerField()
    total_score = models.IntegerField()
    max_possible_score = models.IntegerField(blank=True, null=True)
    critical_failed = models.BooleanField()
    result_status = models.CharField(max_length=30)
    sort_order = models.IntegerField(blank=True, null=True)
    is_active = models.BooleanField()
    created_at = models.DateTimeField(blank=True, null=True)
    updated_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = '[evaluation].[evaluation_result]'

    def __str__(self):
        return f"Result {self.evaluation_result_id} - Score: {self.total_score}"

    @property
    def evaluation(self):
        """Get related evaluation"""
        return RefEvaluation.objects.filter(evaluation_id=self.link_evaluation_id).first()
    
    



# ========== Evaluator Schema Models ==========

class UserDevice(models.Model):
    user_device_id = models.BigAutoField(primary_key=True)
    hash_device_fingerprint = models.BinaryField(blank=True, null=True)
    hash_hardware_uid = models.BinaryField(blank=True, null=True)
    app_instance_id = models.CharField(max_length=64, blank=True, null=True)
    app_platform_name = models.CharField(max_length=100, blank=True, null=True)
    device_category = models.CharField(max_length=100, blank=True, null=True)
    last_ip_address = models.CharField(max_length=50, blank=True, null=True)
    browser_name = models.CharField(max_length=100, blank=True, null=True)
    first_seen_at = models.DateTimeField(blank=True, null=True)
    last_seen_at = models.DateTimeField(blank=True, null=True)
    is_blocked = models.BooleanField(blank=True, null=True)
    blocked_reason = models.CharField(max_length=200, blank=True, null=True)
    created_at = models.DateTimeField(blank=True, null=True)
    updated_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = '[evaluator].[user_device]'

    def __str__(self):
        return f"Device {self.user_device_id} - {self.app_platform_name or 'Unknown'}"


class UserProfile(models.Model):
    user_profile_id = models.BigAutoField(primary_key=True)
    phone_e164_hash = models.BinaryField(blank=True, null=True)
    phone_slot_no = models.SmallIntegerField(blank=True, null=True)
    otp_verified_at = models.DateTimeField(blank=True, null=True)
    otp_attempt_count = models.SmallIntegerField(blank=True, null=True)
    auth_provider = models.CharField(max_length=20, blank=True, null=True)
    auth_subject_hash = models.BinaryField(blank=True, null=True)
    auth_account_age_days = models.IntegerField(blank=True, null=True)
    face_embedding_hash = models.BinaryField(blank=True, null=True)
    face_verified_at = models.DateTimeField(blank=True, null=True)
    liveness_score = models.DecimalField(max_digits=5, decimal_places=2, blank=True, null=True)
    display_name = models.CharField(max_length=200, blank=True, null=True)
    age_years = models.SmallIntegerField(blank=True, null=True)
    is_blocked = models.BooleanField(blank=True, null=True)
    blocked_reason = models.CharField(max_length=200, blank=True, null=True)
    created_at = models.DateTimeField(blank=True, null=True)
    updated_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = '[evaluator].[user_profile]'

    def __str__(self):
        return self.display_name or f"Profile {self.user_profile_id}"


class UserSession(models.Model):
    user_session_id = models.BigAutoField(primary_key=True)
    link_evaluation_id = models.IntegerField()
    link_user_profile_id = models.BigIntegerField(blank=True, null=True)
    link_user_device_id = models.BigIntegerField(blank=True, null=True)
    link_geo_source_id = models.IntegerField(blank=True, null=True)
    link_intent_type_id = models.IntegerField(blank=True, null=True)
    link_respondent_type_id = models.IntegerField(blank=True, null=True)
    interaction_medium_name = models.CharField(max_length=50, blank=True, null=True)
    ip_address = models.CharField(max_length=50, blank=True, null=True)
    ip_hash = models.BinaryField(blank=True, null=True)
    is_vpn_suspected = models.BooleanField(blank=True, null=True)
    started_at = models.DateTimeField(blank=True, null=True)
    ended_at = models.DateTimeField(blank=True, null=True)
    total_questions_answered = models.IntegerField(blank=True, null=True)
    total_time_ms = models.IntegerField(blank=True, null=True)
    avg_time_per_question_ms = models.IntegerField(blank=True, null=True)
    risk_score = models.IntegerField(blank=True, null=True)
    risk_flags = models.CharField(max_length=200, blank=True, null=True)
    is_blocked = models.BooleanField(blank=True, null=True)
    blocked_reason = models.CharField(max_length=200, blank=True, null=True)
    created_at = models.DateTimeField(blank=True, null=True)
    updated_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = '[evaluator].[user_session]'

    def __str__(self):
        return f"Session {self.user_session_id}"

    @property
    def evaluation(self):
        """Get related evaluation"""
        return RefEvaluation.objects.filter(evaluation_id=self.link_evaluation_id).first()

    @property
    def user_profile(self):
        """Get related user profile"""
        if self.link_user_profile_id:
            return UserProfile.objects.filter(user_profile_id=self.link_user_profile_id).first()
        return None

    @property
    def user_device(self):
        """Get related user device"""
        if self.link_user_device_id:
            return UserDevice.objects.filter(user_device_id=self.link_user_device_id).first()
        return None
    
    
###################### party ########################
# ...existing code...

class RefParty(models.Model):
    party_id = models.BigAutoField(primary_key=True)
    link_party_status_id = models.IntegerField(blank=True, null=True)
    link_party_ideology_id = models.IntegerField(blank=True, null=True)
    link_app_asset_id = models.IntegerField(blank=True, null=True)
    party_name_en = models.CharField(max_length=200, blank=True, null=True)
    party_name_bn = models.CharField(max_length=200)
    party_short_name_en = models.CharField(max_length=50, blank=True, null=True)
    party_short_name_bn = models.CharField(max_length=50, blank=True, null=True)
    party_registration_no = models.CharField(max_length=50, blank=True, null=True)
    party_official_website = models.CharField(max_length=200, blank=True, null=True)
    party_description_en = models.TextField(blank=True, null=True)
    party_description_bn = models.TextField(blank=True, null=True)
    party_symbol_name_en = models.CharField(max_length=100, blank=True, null=True)
    party_symbol_name_bn = models.CharField(max_length=100, blank=True, null=True)
    party_establised_at = models.DateField(blank=True, null=True)
    is_active = models.BooleanField()
    created_at = models.DateTimeField()
    modified_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = '[party].[ref_party]'

    def __str__(self):
        return self.party_name_en or self.party_name_bn
    

class AppGetEvaluation(models.Model):
    evaluation_id = models.IntegerField(primary_key=True)
    evaluation_name_en = models.CharField(max_length=200)
    evaluation_name_bn = models.CharField(max_length=200)
    evaluation_description_bn = models.TextField(blank=True, null=True)
    end_date = models.DateField(blank=True, null=True)

    class Meta:
        managed = False
        db_table = '[evaluation].[vw_app_get_evaluation_current]'
        

class AppGetPartyDetails(models.Model):
    party_id = models.IntegerField(primary_key=True)
    link_app_asset_id = models.IntegerField(blank=True, null=True)
    party_name_en = models.CharField(max_length=200, blank=True, null=True)
    party_name_bn = models.CharField(max_length=200)
    party_short_name_en = models.CharField(max_length=50, blank=True, null=True)
    party_short_name_bn = models.CharField(max_length=50, blank=True, null=True)
    party_symbol_name_bn = models.CharField(max_length=100, blank=True, null=True)
    file_name = models.CharField(max_length=255, blank=True, null=True)
    file_path = models.CharField(max_length=500, blank=True, null=True)

    class Meta:
        managed = False
        db_table = '[party].[vw_app_get_party_details]'


class AppSidebarPastResults(models.Model):
    """Past election results for sidebar and drill-through reports"""

    # Computed row identifier for Django (combination of IDs makes each row unique)
    id = models.CharField(max_length=100, primary_key=True, db_column='row_id', verbose_name='Row ID')

    # ID fields
    evaluation_id = models.IntegerField(verbose_name='Evaluation ID', blank=True, null=True)
    party_id = models.IntegerField(verbose_name='Party ID', blank=True, null=True)
    division_id = models.IntegerField(verbose_name='Division ID', blank=True, null=True)
    district_id = models.IntegerField(verbose_name='District ID', blank=True, null=True)
    constituency_id = models.IntegerField(verbose_name='Constituency ID', blank=True, null=True)

    # Name/Display fields - clean column names matching database view
    evaluation_name_bn = models.CharField(max_length=200, verbose_name='মূল্যায়ন নাম')
    party_name_bn = models.CharField(max_length=200, verbose_name='দলের নাম', blank=True, null=True)
    party_name_symbol = models.CharField(max_length=250, verbose_name='দলের নাম ও প্রতীক', blank=True, null=True)
    party_short_name_bn = models.CharField(max_length=50, verbose_name='দলের সংক্ষিপ্ত নাম', blank=True, null=True)
    party_symbol_name_bn = models.CharField(max_length=100, verbose_name='দলের প্রতীক', blank=True, null=True)

    # Media fields
    file_path = models.CharField(max_length=500, verbose_name='ফাইল পাথ', blank=True, null=True)
    file_name = models.CharField(max_length=255, verbose_name='ফাইল নাম', blank=True, null=True)

    # Location fields - updated to match new view column names
    division_name_bn = models.CharField(max_length=100, verbose_name='বিভাগ', blank=True, null=True)
    district_name_bn = models.CharField(max_length=100, verbose_name='জেলা', blank=True, null=True)

    # Constituency fields - updated to match new view column names
    constituency_name_en = models.CharField(max_length=200, verbose_name='Constituency (EN)', blank=True, null=True)
    constituency_name_bn = models.CharField(max_length=200, verbose_name='আসন', blank=True, null=True)
    constituency_area_list_bn = models.TextField(verbose_name='এলাকার তালিকা', blank=True, null=True)

    # Vote count fields - clean column names
    party_national_vote = models.IntegerField(verbose_name='জাতীয় ভোট', blank=True, null=True)
    party_seat_vote = models.IntegerField(verbose_name='আসন ভোট', blank=True, null=True)
    seat_total_vote = models.IntegerField(verbose_name='মোট ভোট', blank=True, null=True)
    seat_vote_share = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        verbose_name='ভোটের শেয়ার (%)',
        blank=True,
        null=True
    )

    class Meta:
        managed = False
        db_table = '[evaluation].[vw_app_vote_sidebar_past_results]'
        verbose_name = 'Past Election Result'
        verbose_name_plural = 'Past Election Results'