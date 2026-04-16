"""Mastermind models — quiz/exam engine for cross-app intelligence (all unmanaged)."""

from django.db import models
from django.utils import timezone


# ================================================================
# TIER 1 — Source Material
# ================================================================

class CollBook(models.Model):
    """Source book/document fed into the system."""
    mastermind_coll_book_id = models.AutoField(primary_key=True)
    book_title_bn = models.CharField(max_length=500)
    book_title_en = models.CharField(max_length=500, null=True, blank=True)
    book_author_bn = models.CharField(max_length=300, null=True, blank=True)
    book_author_en = models.CharField(max_length=300, null=True, blank=True)
    book_edition = models.CharField(max_length=100, null=True, blank=True)
    book_publisher_bn = models.CharField(max_length=300, null=True, blank=True)
    book_publisher_en = models.CharField(max_length=300, null=True, blank=True)
    book_isbn = models.CharField(max_length=30, null=True, blank=True)
    book_cover_image_url = models.CharField(max_length=1000, null=True, blank=True)
    book_description = models.TextField(null=True, blank=True)
    book_language_code = models.CharField(max_length=10, default='bn')
    book_file_path = models.CharField(max_length=1000, null=True, blank=True)
    book_total_pages = models.IntegerField(null=True, blank=True)
    sort_order = models.IntegerField(default=0)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        managed = False
        db_table = '[mastermind].[coll_book]'

    def __str__(self):
        return self.book_title_bn


class CollBookChapter(models.Model):
    """Chapter within a source book."""
    mastermind_coll_book_chapter_id = models.AutoField(primary_key=True)
    link_mastermind_coll_book_id = models.IntegerField()
    chapter_number = models.IntegerField()
    chapter_title_bn = models.CharField(max_length=500)
    chapter_title_en = models.CharField(max_length=500, null=True, blank=True)
    chapter_page_start = models.IntegerField(null=True, blank=True)
    chapter_page_end = models.IntegerField(null=True, blank=True)
    sort_order = models.IntegerField(default=0)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        managed = False
        db_table = '[mastermind].[coll_book_chapter]'

    def __str__(self):
        return f"Ch.{self.chapter_number}: {self.chapter_title_bn}"


# ================================================================
# TIER 2 — Question Classification
# ================================================================

class CollQuizTopic(models.Model):
    """Quiz topic (constitution, history, BCS, Quran, grammar, etc.)."""
    mastermind_coll_quiz_topic_id = models.AutoField(primary_key=True)
    topic_code = models.CharField(max_length=50, unique=True)
    topic_name_bn = models.CharField(max_length=200)
    topic_name_en = models.CharField(max_length=200, null=True, blank=True)
    topic_description = models.CharField(max_length=500, null=True, blank=True)
    topic_icon = models.CharField(max_length=10, null=True, blank=True)
    sort_order = models.IntegerField(default=0)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        managed = False
        db_table = '[mastermind].[coll_quiz_topic]'

    def __str__(self):
        return self.topic_name_bn


class RefQuizQuestionType(models.Model):
    """Question type (mcq_single, mcq_multi, true_false, fill_blank, short_answer)."""
    mastermind_ref_quiz_question_type_id = models.AutoField(primary_key=True)
    question_type_code = models.CharField(max_length=30, unique=True)
    question_type_name_bn = models.CharField(max_length=100)
    question_type_name_en = models.CharField(max_length=100, null=True, blank=True)
    is_auto_gradable = models.BooleanField(default=True)
    sort_order = models.IntegerField(default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        managed = False
        db_table = '[mastermind].[ref_quiz_question_type]'

    def __str__(self):
        return self.question_type_code


class RefQuizDifficultyLevel(models.Model):
    """Difficulty level (easy, medium, hard, expert)."""
    mastermind_ref_quiz_difficulty_level_id = models.AutoField(primary_key=True)
    difficulty_code = models.CharField(max_length=20, unique=True)
    difficulty_name_bn = models.CharField(max_length=50)
    difficulty_name_en = models.CharField(max_length=50, null=True, blank=True)
    difficulty_weight = models.DecimalField(max_digits=3, decimal_places=2, default=1.00)
    sort_order = models.IntegerField(default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        managed = False
        db_table = '[mastermind].[ref_quiz_difficulty_level]'

    def __str__(self):
        return self.difficulty_code


class RefQuizQuestionTag(models.Model):
    """Cross-cutting tag for questions."""
    mastermind_ref_quiz_question_tag_id = models.AutoField(primary_key=True)
    tag_name_bn = models.CharField(max_length=200)
    tag_name_en = models.CharField(max_length=200, null=True, blank=True)
    tag_slug = models.CharField(max_length=200, unique=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        managed = False
        db_table = '[mastermind].[ref_quiz_question_tag]'

    def __str__(self):
        return self.tag_name_bn


# ================================================================
# TIER 3 — Question Bank
# ================================================================

class CollQuestion(models.Model):
    """Question in the universal question bank."""
    mastermind_coll_question_id = models.BigAutoField(primary_key=True)
    link_mastermind_ref_quiz_question_type_id = models.IntegerField()
    link_mastermind_ref_quiz_difficulty_level_id = models.IntegerField()
    link_mastermind_coll_quiz_topic_id = models.IntegerField()

    # Variant grouping (affirmative/negative pairs share same group_id)
    question_group_id = models.BigIntegerField(null=True, blank=True)
    question_variant_code = models.CharField(max_length=20, default='affirmative')

    # Content
    question_text_bn = models.TextField()
    question_text_en = models.TextField(null=True, blank=True)
    question_explanation_bn = models.TextField(null=True, blank=True)
    question_explanation_en = models.TextField(null=True, blank=True)
    question_hint_bn = models.CharField(max_length=500, null=True, blank=True)
    question_hint_en = models.CharField(max_length=500, null=True, blank=True)
    question_image_url = models.CharField(max_length=1000, null=True, blank=True)

    # Scoring
    question_points = models.IntegerField(default=1)
    question_time_limit_seconds = models.IntegerField(null=True, blank=True)
    question_negative_marking_points = models.DecimalField(
        max_digits=6, decimal_places=2, default=0
    )

    # Source citation (the "anti-lying" feature)
    link_mastermind_coll_book_id = models.IntegerField(null=True, blank=True)
    link_mastermind_coll_book_chapter_id = models.IntegerField(null=True, blank=True)
    source_page_number = models.IntegerField(null=True, blank=True)
    source_snippet_text = models.TextField(null=True, blank=True)

    # Authorship
    link_created_by_user_profile_id = models.BigIntegerField(null=True, blank=True)
    question_generation_source_code = models.CharField(max_length=20, default='manual')

    # Status
    question_status_code = models.CharField(max_length=20, default='draft')

    # Analytics (cached)
    usage_count = models.IntegerField(default=0)
    correct_answer_rate = models.DecimalField(
        max_digits=5, decimal_places=2, null=True, blank=True
    )

    # NLI confidence scores (AI-generated questions only)
    nli_similarity_score = models.DecimalField(
        max_digits=6, decimal_places=4, null=True, blank=True
    )
    nli_entailment_score = models.DecimalField(
        max_digits=6, decimal_places=4, null=True, blank=True
    )
    nli_contradiction_score = models.DecimalField(
        max_digits=6, decimal_places=4, null=True, blank=True
    )
    nli_verdict_code = models.CharField(max_length=30, null=True, blank=True)
    nli_confidence_level_code = models.CharField(max_length=20, null=True, blank=True)

    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        managed = False
        db_table = '[mastermind].[coll_question]'

    def __str__(self):
        return self.question_text_bn[:80] if self.question_text_bn else ''


class CollQuestionOption(models.Model):
    """Answer option for a question."""
    mastermind_coll_question_option_id = models.BigAutoField(primary_key=True)
    link_mastermind_coll_question_id = models.BigIntegerField()
    option_label = models.CharField(max_length=5)
    option_text_bn = models.TextField()
    option_text_en = models.TextField(null=True, blank=True)
    option_image_url = models.CharField(max_length=1000, null=True, blank=True)
    is_correct = models.BooleanField(default=False)
    option_explanation_bn = models.TextField(null=True, blank=True)
    sort_order = models.IntegerField(default=0)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        managed = False
        db_table = '[mastermind].[coll_question_option]'

    def __str__(self):
        return f"{self.option_label}: {self.option_text_bn[:50]}"


# ================================================================
# TIER 3c — Junction Tables
# ================================================================

class MapQuizQuestionSource(models.Model):
    """Question-to-book/chapter junction (multi-source references)."""
    mastermind_map_quiz_question_source_id = models.BigAutoField(primary_key=True)
    link_mastermind_coll_question_id = models.BigIntegerField()
    link_mastermind_coll_book_id = models.IntegerField()
    link_mastermind_coll_book_chapter_id = models.IntegerField(null=True, blank=True)
    source_page_number = models.IntegerField(null=True, blank=True)
    source_note = models.CharField(max_length=500, null=True, blank=True)
    is_primary_source = models.BooleanField(default=False)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        managed = False
        db_table = '[mastermind].[map_quiz_question_source]'


class MapQuizQuestionTag(models.Model):
    """Question-to-tag junction."""
    mastermind_map_quiz_question_tag_id = models.BigAutoField(primary_key=True)
    link_mastermind_coll_question_id = models.BigIntegerField()
    link_mastermind_ref_quiz_question_tag_id = models.IntegerField()
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        managed = False
        db_table = '[mastermind].[map_quiz_question_tag]'


# ================================================================
# TIER 4 — Exam Definition
# ================================================================

class CollQuiz(models.Model):
    """Exam/quiz definition with configuration."""
    mastermind_coll_quiz_id = models.BigAutoField(primary_key=True)
    exam_title_bn = models.CharField(max_length=500)
    exam_title_en = models.CharField(max_length=500, null=True, blank=True)
    exam_description_bn = models.TextField(null=True, blank=True)
    exam_slug = models.CharField(max_length=300, unique=True)
    link_mastermind_coll_quiz_topic_id = models.IntegerField(null=True, blank=True)
    link_mastermind_coll_book_id = models.IntegerField(null=True, blank=True)

    # Exam config
    exam_total_questions = models.IntegerField()
    exam_time_limit_minutes = models.IntegerField(null=True, blank=True)
    exam_pass_percentage = models.DecimalField(max_digits=5, decimal_places=2, default=50.00)
    exam_negative_marking_per_wrong = models.DecimalField(
        max_digits=6, decimal_places=2, default=0
    )
    exam_shuffle_questions = models.BooleanField(default=True)
    exam_shuffle_options = models.BooleanField(default=True)
    exam_show_explanation_code = models.CharField(max_length=20, default='each_question')
    exam_allow_review = models.BooleanField(default=True)
    exam_max_attempts = models.IntegerField(null=True, blank=True)

    # Scheduling
    exam_scheduled_publish_at = models.DateTimeField(null=True, blank=True)
    exam_scheduled_close_at = models.DateTimeField(null=True, blank=True)

    # Rewards (V1 — nullable so legacy exams without rewards still work)
    exam_rewards_enabled = models.BooleanField(default=False)
    exam_reward_criteria_code = models.CharField(max_length=20, null=True, blank=True)
    exam_reward_threshold_percent = models.DecimalField(
        max_digits=5, decimal_places=2, null=True, blank=True,
    )
    exam_reward_top_n = models.IntegerField(null=True, blank=True)
    link_reward_badge_id = models.IntegerField(null=True, blank=True)
    exam_reward_description = models.CharField(max_length=500, null=True, blank=True)

    # Status
    exam_status_code = models.CharField(max_length=20, default='draft')
    link_created_by_user_profile_id = models.BigIntegerField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        managed = False
        db_table = '[mastermind].[coll_quiz]'

    def __str__(self):
        return self.exam_title_bn


class MapQuizQuestionPool(models.Model):
    """Which questions belong to which exam's pool."""
    mastermind_map_quiz_question_pool_id = models.BigAutoField(primary_key=True)
    link_mastermind_coll_quiz_id = models.BigIntegerField()
    link_mastermind_coll_question_id = models.BigIntegerField()
    is_mandatory = models.BooleanField(default=False)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        managed = False
        db_table = '[mastermind].[map_quiz_question_pool]'


# ================================================================
# TIER 5 — Exam Session + Responses
# ================================================================

class CollQuizSession(models.Model):
    """User's exam attempt (session)."""
    mastermind_coll_quiz_session_id = models.BigAutoField(primary_key=True)
    link_mastermind_coll_quiz_id = models.BigIntegerField()
    link_user_profile_id = models.BigIntegerField()

    session_started_at = models.DateTimeField(default=timezone.now)
    session_completed_at = models.DateTimeField(null=True, blank=True)
    session_status_code = models.CharField(max_length=20, default='in_progress')

    session_total_questions = models.IntegerField()
    session_total_answered = models.IntegerField(default=0)
    session_total_correct = models.IntegerField(default=0)
    session_total_wrong = models.IntegerField(default=0)
    session_total_skipped = models.IntegerField(default=0)
    session_score_raw = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    session_score_max = models.DecimalField(max_digits=10, decimal_places=2)
    session_score_percentage = models.DecimalField(
        max_digits=5, decimal_places=2, null=True, blank=True
    )
    session_time_taken_seconds = models.IntegerField(null=True, blank=True)
    session_is_passed = models.BooleanField(null=True, blank=True)
    session_attempt_number = models.IntegerField(default=1)

    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        managed = False
        db_table = '[mastermind].[coll_quiz_session]'

    def __str__(self):
        return f"Session {self.mastermind_coll_quiz_session_id}"


class CollQuizSessionQuestion(models.Model):
    """Per-question snapshot within an exam session."""
    mastermind_coll_quiz_session_question_id = models.BigAutoField(primary_key=True)
    link_mastermind_coll_quiz_session_id = models.BigIntegerField()
    link_mastermind_coll_question_id = models.BigIntegerField()

    question_display_order = models.IntegerField()
    option_display_order = models.CharField(max_length=200, null=True, blank=True)

    # Response
    link_selected_option_id = models.BigIntegerField(null=True, blank=True)
    fill_blank_answer_text = models.TextField(null=True, blank=True)
    short_answer_text = models.TextField(null=True, blank=True)

    is_correct = models.BooleanField(null=True, blank=True)
    is_bookmarked = models.BooleanField(default=False)
    points_earned = models.DecimalField(max_digits=6, decimal_places=2, default=0)
    time_spent_seconds = models.IntegerField(null=True, blank=True)
    answered_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        managed = False
        db_table = '[mastermind].[coll_quiz_session_question]'


# ================================================================
# TIER 6 — Gamification
# ================================================================

class RefQuizBadge(models.Model):
    """Badge definition."""
    mastermind_ref_quiz_badge_id = models.AutoField(primary_key=True)
    badge_code = models.CharField(max_length=50, unique=True)
    badge_name_bn = models.CharField(max_length=200)
    badge_name_en = models.CharField(max_length=200, null=True, blank=True)
    badge_description_bn = models.CharField(max_length=500, null=True, blank=True)
    badge_icon = models.CharField(max_length=10, null=True, blank=True)
    badge_criteria_json = models.TextField(null=True, blank=True)
    sort_order = models.IntegerField(default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        managed = False
        db_table = '[mastermind].[ref_quiz_badge]'

    def __str__(self):
        return self.badge_code


class CollUserQuizBadge(models.Model):
    """Badge earned by a user."""
    mastermind_coll_user_quiz_badge_id = models.BigAutoField(primary_key=True)
    link_user_profile_id = models.BigIntegerField()
    link_mastermind_ref_quiz_badge_id = models.IntegerField()
    earned_at = models.DateTimeField(default=timezone.now)
    is_active = models.BooleanField(default=True)

    class Meta:
        managed = False
        db_table = '[mastermind].[coll_user_quiz_badge]'


class CollUserStreak(models.Model):
    """Daily quiz activity tracking (one row per active day)."""
    mastermind_coll_user_streak_id = models.BigAutoField(primary_key=True)
    link_user_profile_id = models.BigIntegerField()
    streak_date = models.DateField()
    session_count = models.IntegerField(default=1)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        managed = False
        db_table = '[mastermind].[coll_user_streak]'


class EngUserQuizTopicMastery(models.Model):
    """Per-user per-topic mastery tracking (Khan Academy pattern)."""
    mastermind_eng_user_quiz_topic_mastery_id = models.BigAutoField(primary_key=True)
    link_user_profile_id = models.BigIntegerField()
    link_mastermind_coll_quiz_topic_id = models.IntegerField()
    mastery_level_code = models.CharField(max_length=20, default='not_started')
    total_questions_attempted = models.IntegerField(default=0)
    total_questions_correct = models.IntegerField(default=0)
    accuracy_percentage = models.DecimalField(
        max_digits=5, decimal_places=2, null=True, blank=True
    )
    last_practiced_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        managed = False
        db_table = '[mastermind].[eng_user_quiz_topic_mastery]'


# ================================================================
# TIER 5b — AI Generation (Book Chunks + Jobs)
# ================================================================

class CollBookChunk(models.Model):
    """Text segment extracted from a book page — used for question generation."""
    mastermind_coll_book_chunk_id = models.BigAutoField(primary_key=True)
    link_mastermind_coll_book_id = models.IntegerField()
    link_mastermind_coll_book_chapter_id = models.IntegerField(null=True, blank=True)
    chunk_page_number = models.IntegerField(null=True, blank=True)
    chunk_paragraph_index = models.IntegerField(default=0)
    chunk_text = models.TextField()
    chunk_word_count = models.IntegerField(default=0)
    chunk_sequence_order = models.IntegerField(default=0)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        managed = False
        db_table = '[mastermind].[coll_book_chunk]'


class CollGenerationJob(models.Model):
    """AI question generation job tracking."""
    mastermind_coll_generation_job_id = models.BigAutoField(primary_key=True)
    link_mastermind_coll_book_id = models.IntegerField()
    link_mastermind_coll_book_chapter_id = models.IntegerField(null=True, blank=True)
    link_mastermind_coll_quiz_topic_id = models.IntegerField()
    link_started_by_user_profile_id = models.BigIntegerField(null=True, blank=True)
    generation_model_name = models.CharField(max_length=100, default='llama3.2:3b')
    generation_prompt_template_code = models.CharField(max_length=30, default='mcq_single')
    generation_questions_requested = models.IntegerField(default=5)
    generation_questions_created = models.IntegerField(default=0)
    generation_questions_rejected = models.IntegerField(default=0)
    generation_status_code = models.CharField(max_length=20, default='queued')
    generation_error_message = models.TextField(null=True, blank=True)
    generation_processing_time_seconds = models.IntegerField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(default=timezone.now)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        managed = False
        db_table = '[mastermind].[coll_generation_job]'


# ================================================================
# TIER 5c — Semantic Embeddings + Background Jobs
# ================================================================

class EngQuizSemanticEmbedding(models.Model):
    """Polymorphic embedding storage — used for chunks and questions.

    Stores 384-dim float32 vectors as binary bytes (1536 bytes per vector).
    Using varbinary(max) avoids the pyodbc ntext/UTF-8 collation trap entirely.
    """
    mastermind_eng_quiz_semantic_embedding_id = models.BigAutoField(primary_key=True)
    embedding_target_type_code = models.CharField(max_length=30)
    embedding_target_id = models.BigIntegerField()
    embedding_model_name = models.CharField(
        max_length=100, default='paraphrase-multilingual-MiniLM-L12-v2'
    )
    embedding_vector_bytes = models.BinaryField()
    embedding_dimension = models.IntegerField(default=384)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        managed = False
        db_table = '[mastermind].[eng_quiz_semantic_embedding]'


class CollBackgroundJob(models.Model):
    """Background job tracking for long-running tasks with progress visibility."""
    mastermind_coll_background_job_id = models.BigAutoField(primary_key=True)
    job_type_code = models.CharField(max_length=30)
    link_target_id = models.BigIntegerField(null=True, blank=True)
    job_status_code = models.CharField(max_length=20, default='queued')
    job_progress_current = models.IntegerField(default=0)
    job_progress_total = models.IntegerField(default=0)
    job_result_json = models.TextField(null=True, blank=True)
    job_error_message = models.TextField(null=True, blank=True)
    link_started_by_user_profile_id = models.BigIntegerField(null=True, blank=True)
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        managed = False
        db_table = '[mastermind].[coll_background_job]'


# ================================================================
# TIER 6b — Spaced Repetition + Streak Freeze + Analytics
# ================================================================

class CollUserCard(models.Model):
    """Anki-style per-user per-question card for spaced repetition."""
    mastermind_coll_user_card_id = models.BigAutoField(primary_key=True)
    link_user_profile_id = models.BigIntegerField()
    link_mastermind_coll_question_id = models.BigIntegerField()
    card_ease_factor = models.DecimalField(max_digits=4, decimal_places=2, default=2.50)
    card_interval_days = models.IntegerField(default=1)
    card_repetition_count = models.IntegerField(default=0)
    card_next_review_at = models.DateTimeField(default=timezone.now)
    card_last_review_at = models.DateTimeField(null=True, blank=True)
    card_times_correct = models.IntegerField(default=0)
    card_times_wrong = models.IntegerField(default=0)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        managed = False
        db_table = '[mastermind].[coll_user_card]'


class CollStreakFreeze(models.Model):
    """Streak freeze — skip 1 day without breaking streak (Duolingo pattern)."""
    mastermind_coll_streak_freeze_id = models.BigAutoField(primary_key=True)
    link_user_profile_id = models.BigIntegerField()
    freeze_date = models.DateField()
    freeze_source_code = models.CharField(max_length=20, default='earned')
    is_used = models.BooleanField(default=False)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        managed = False
        db_table = '[mastermind].[coll_streak_freeze]'


class EngQuestionOptionAnalytics(models.Model):
    """Per-option selection tracking for distractor analysis."""
    mastermind_eng_quiz_question_option_analytics_id = models.BigAutoField(primary_key=True)
    link_mastermind_coll_question_id = models.BigIntegerField()
    link_mastermind_coll_question_option_id = models.BigIntegerField()
    times_selected = models.IntegerField(default=0)
    times_selected_correctly = models.IntegerField(default=0)
    updated_at = models.DateTimeField(default=timezone.now)

    class Meta:
        managed = False
        db_table = '[mastermind].[eng_quiz_question_option_analytics]'


# ================================================================
# TIER 6c — Question Reports
# ================================================================

class CollQuestionReport(models.Model):
    """User-reported issues with questions."""
    mastermind_coll_question_report_id = models.BigAutoField(primary_key=True)
    link_mastermind_coll_question_id = models.BigIntegerField()
    link_user_profile_id = models.BigIntegerField()
    report_reason_code = models.CharField(max_length=30)
    report_description = models.CharField(max_length=1000, null=True, blank=True)
    report_status_code = models.CharField(max_length=20, default='pending')
    reviewed_by_user_profile_id = models.BigIntegerField(null=True, blank=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        managed = False
        db_table = '[mastermind].[coll_question_report]'


# ================================================================
# TIER 7 — Transparency Ledger
# ================================================================

class CollQuestionVersion(models.Model):
    """Immutable version snapshot — each edit creates a new version."""
    mastermind_coll_question_version_id = models.BigAutoField(primary_key=True)
    link_mastermind_coll_question_id = models.BigIntegerField()
    version_number = models.IntegerField(default=1)
    question_text_bn = models.TextField()
    question_text_en = models.TextField(null=True, blank=True)
    question_explanation_bn = models.TextField(null=True, blank=True)
    question_explanation_en = models.TextField(null=True, blank=True)
    question_metadata_json = models.TextField(null=True, blank=True)
    link_modified_by_user_profile_id = models.BigIntegerField(null=True, blank=True)
    change_summary = models.CharField(max_length=500, null=True, blank=True)
    is_current = models.BooleanField(default=True)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        managed = False
        db_table = '[mastermind].[coll_question_version]'


class MapQuizRoleAssignment(models.Model):
    """Per-quiz role assignment — creator, reviewer, publisher."""
    mastermind_map_quiz_role_assignment_id = models.BigAutoField(primary_key=True)
    link_mastermind_coll_quiz_id = models.BigIntegerField()
    link_user_profile_id = models.BigIntegerField()
    role_code = models.CharField(max_length=20)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        managed = False
        db_table = '[mastermind].[map_quiz_role_assignment]'


class CollQuizWorkflowLog(models.Model):
    """Audit trail of quiz status transitions — who changed what, when."""
    mastermind_coll_quiz_workflow_log_id = models.BigAutoField(primary_key=True)
    link_mastermind_coll_quiz_id = models.BigIntegerField()
    from_status_code = models.CharField(max_length=20, null=True, blank=True)
    to_status_code = models.CharField(max_length=20)
    link_user_profile_id = models.BigIntegerField()
    role_code = models.CharField(max_length=20)
    workflow_comment = models.CharField(max_length=500, null=True, blank=True)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        managed = False
        db_table = '[mastermind].[coll_quiz_workflow_log]'


class CollQuestionMatchPair(models.Model):
    """Stem-response pair for matching questions. NULL stem = distractor."""
    mastermind_coll_question_match_pair_id = models.BigAutoField(primary_key=True)
    link_mastermind_coll_question_id = models.BigIntegerField()
    stem_text_bn = models.CharField(max_length=500, null=True, blank=True)
    stem_text_en = models.CharField(max_length=500, null=True, blank=True)
    response_text_bn = models.CharField(max_length=500)
    response_text_en = models.CharField(max_length=500, null=True, blank=True)
    sort_order = models.IntegerField(default=0)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        managed = False
        db_table = '[mastermind].[coll_question_match_pair]'


class CollQuizSourceRegistry(models.Model):
    """Public record of books in the system — proves questions aren't biased."""
    mastermind_coll_quiz_source_registry_id = models.BigAutoField(primary_key=True)
    link_mastermind_coll_book_id = models.IntegerField()
    ledger_added_at = models.DateTimeField(default=timezone.now)
    ledger_added_by_user_profile_id = models.BigIntegerField(null=True, blank=True)
    ledger_notes = models.TextField(null=True, blank=True)
    question_count = models.IntegerField(default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        managed = False
        db_table = '[mastermind].[coll_quiz_source_registry]'
