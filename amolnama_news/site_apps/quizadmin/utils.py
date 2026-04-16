"""Quizadmin utilities — shared helpers for views and API endpoints.

Keeps views.py slim by centralising query-building and data-shaping.
All functions here read mastermind models; none mutate state (mutations
live in mastermind.ai_generator).
"""
from django.db.models import Count

from amolnama_news.site_apps.mastermind.models import (
    CollBookChunk, CollGenerationJob, CollQuestion, CollQuestionOption,
    CollBook, CollBookChapter, CollQuizTopic,
)


REVIEW_ORDER_FIELDS = ('created_at', 'mastermind_coll_question_id')


def get_dashboard_metrics():
    """Aggregate counts used by the dashboard metric cards."""
    question_status_counts = dict(
        CollQuestion.objects
        .filter(is_active=True)
        .values_list('question_status_code')
        .annotate(total=Count('mastermind_coll_question_id'))
    )
    ai_generated_total = CollQuestion.objects.filter(
        is_active=True, question_generation_source_code='ai_generated',
    ).count()
    books_ingested = CollBook.objects.filter(
        is_active=True,
        mastermind_coll_book_id__in=CollBookChunk.objects
            .filter(is_active=True).values('link_mastermind_coll_book_id'),
    ).count()
    return {
        'pending_review': question_status_counts.get('review', 0),
        'published':      question_status_counts.get('published', 0),
        'draft':          question_status_counts.get('draft', 0),
        'rejected':       question_status_counts.get('archived', 0),
        'ai_generated_total': ai_generated_total,
        'books_ingested':     books_ingested,
    }


GENERATION_JOB_LIST_FIELDS = (
    'mastermind_coll_generation_job_id',
    'link_mastermind_coll_book_id',
    'generation_model_name',
    'generation_prompt_template_code',
    'generation_status_code',
    'generation_questions_requested',
    'generation_questions_created',
    'generation_questions_rejected',
    'generation_processing_time_seconds',
    'created_at',
    'completed_at',
)


def _annotate_jobs_with_book_titles(jobs):
    """Batch-join book titles into a list of job dicts. Mutates in place."""
    book_ids = {job['link_mastermind_coll_book_id'] for job in jobs if job['link_mastermind_coll_book_id']}
    if not book_ids:
        for job in jobs:
            job['book_title_bn'] = '—'
        return
    book_titles = dict(
        CollBook.objects
        .filter(mastermind_coll_book_id__in=book_ids)
        .values_list('mastermind_coll_book_id', 'book_title_bn')
    )
    for job in jobs:
        job['book_title_bn'] = book_titles.get(job['link_mastermind_coll_book_id'], '—')


def get_recent_generation_jobs(limit=10):
    """Newest-first generation jobs for the dashboard."""
    jobs = list(
        CollGenerationJob.objects
        .order_by('-created_at')
        .values(*GENERATION_JOB_LIST_FIELDS)[:limit]
    )
    _annotate_jobs_with_book_titles(jobs)
    return jobs


def get_books_with_question_counts():
    """Per-book rows for the books page."""
    books = list(
        CollBook.objects.filter(is_active=True)
        .order_by('-created_at')
        .values(
            'mastermind_coll_book_id', 'book_title_bn', 'book_title_en',
            'book_total_pages', 'created_at',
        )
    )
    book_ids = [book['mastermind_coll_book_id'] for book in books]
    chunk_counts = dict(
        CollBookChunk.objects
        .filter(is_active=True, link_mastermind_coll_book_id__in=book_ids)
        .values_list('link_mastermind_coll_book_id')
        .annotate(total=Count('mastermind_coll_book_chunk_id'))
    )
    question_rows = (
        CollQuestion.objects
        .filter(is_active=True, link_mastermind_coll_book_id__in=book_ids)
        .values('link_mastermind_coll_book_id', 'question_status_code')
        .annotate(total=Count('mastermind_coll_question_id'))
    )
    question_status_map = {book_id: {} for book_id in book_ids}
    for row in question_rows:
        question_status_map[row['link_mastermind_coll_book_id']][row['question_status_code']] = row['total']
    for book in books:
        book_id = book['mastermind_coll_book_id']
        statuses = question_status_map.get(book_id, {})
        book['chunks'] = chunk_counts.get(book_id, 0)
        book['questions_review'] = statuses.get('review', 0)
        book['questions_published'] = statuses.get('published', 0)
        book['questions_draft'] = statuses.get('draft', 0)
        book['questions_total'] = sum(statuses.values())
    return books


def get_review_queue_ids(topic_id=None, book_id=None, confidence_level=None,
                        verdict_code=None, search_query=None):
    """Return the ordered list of pending-review AI question IDs.

    Used to compute prev/next for keyboard navigation on the review page.
    """
    from django.db.models import Q

    filters = {
        'is_active': True,
        'question_status_code': 'review',
        'question_generation_source_code': 'ai_generated',
    }
    if topic_id:
        filters['link_mastermind_coll_quiz_topic_id'] = topic_id
    if book_id:
        filters['link_mastermind_coll_book_id'] = book_id
    if confidence_level:
        filters['nli_confidence_level_code'] = confidence_level
    if verdict_code:
        filters['nli_verdict_code'] = verdict_code

    queryset = CollQuestion.objects.filter(**filters)
    if search_query:
        queryset = queryset.filter(
            Q(question_text_bn__icontains=search_query) |
            Q(question_text_en__icontains=search_query)
        )
    return list(
        queryset.order_by(*REVIEW_ORDER_FIELDS)
        .values_list('mastermind_coll_question_id', flat=True)
    )


def get_review_neighbors(question_id, ordered_ids):
    """Given the full ordered list, return (previous_id, current_id, next_id).

    Missing neighbours return None. If question_id is not in the list,
    return the list-head as next (so reviewer can still navigate).
    """
    if not ordered_ids:
        return (None, None, None)
    try:
        index = ordered_ids.index(question_id)
    except ValueError:
        return (None, None, ordered_ids[0])
    previous = ordered_ids[index - 1] if index > 0 else None
    after = ordered_ids[index + 1] if index + 1 < len(ordered_ids) else None
    return (previous, question_id, after)


def build_review_question_context(question_id):
    """Full context for ONE question on the review page.

    Returns None if the question isn't found or is inactive.
    """
    question = (
        CollQuestion.objects
        .filter(mastermind_coll_question_id=question_id, is_active=True)
        .values(
            'mastermind_coll_question_id',
            'question_text_bn',
            'question_explanation_bn',
            'question_status_code',
            'question_generation_source_code',
            'nli_verdict_code',
            'nli_confidence_level_code',
            'nli_similarity_score',
            'nli_entailment_score',
            'nli_contradiction_score',
            'link_mastermind_coll_book_id',
            'link_mastermind_coll_book_chapter_id',
            'link_mastermind_coll_quiz_topic_id',
            'source_page_number',
            'source_snippet_text',
            'created_at',
        )
        .first()
    )
    if not question:
        return None

    question['options'] = list(
        CollQuestionOption.objects
        .filter(
            link_mastermind_coll_question_id=question_id,
            is_active=True,
        )
        .order_by('sort_order', 'mastermind_coll_question_option_id')
        .values(
            'mastermind_coll_question_option_id',
            'option_label', 'option_text_bn', 'is_correct',
        )
    )

    ref_ids = {
        'book_id': question['link_mastermind_coll_book_id'],
        'chapter_id': question['link_mastermind_coll_book_chapter_id'],
        'topic_id': question['link_mastermind_coll_quiz_topic_id'],
    }
    question['book_title_bn'] = (
        CollBook.objects.filter(mastermind_coll_book_id=ref_ids['book_id'])
        .values_list('book_title_bn', flat=True).first()
    ) if ref_ids['book_id'] else None
    question['chapter_title_bn'] = (
        CollBookChapter.objects.filter(mastermind_coll_book_chapter_id=ref_ids['chapter_id'])
        .values_list('chapter_title_bn', flat=True).first()
    ) if ref_ids['chapter_id'] else None
    question['topic_name_bn'] = (
        CollQuizTopic.objects.filter(mastermind_coll_quiz_topic_id=ref_ids['topic_id'])
        .values_list('topic_name_bn', flat=True).first()
    ) if ref_ids['topic_id'] else None

    return question


def get_filter_options():
    """Populate the review-queue filter bar dropdowns."""
    return {
        'topics': list(
            CollQuizTopic.objects.filter(is_active=True)
            .order_by('sort_order', 'topic_name_en')
            .values('mastermind_coll_quiz_topic_id', 'topic_code', 'topic_name_bn', 'topic_name_en')
        ),
        'books': list(
            CollBook.objects.filter(is_active=True)
            .order_by('-created_at')
            .values('mastermind_coll_book_id', 'book_title_bn')
        ),
        'confidence_levels': ['high', 'medium', 'low'],
        'verdict_codes': [
            'pass_exact_substring', 'pass_word_match',
            'pass_similarity', 'pass_nli',
        ],
    }


def _get_shared_ref_data():
    """Shared reference-table queries used by both question and quiz forms."""
    from amolnama_news.site_apps.mastermind.models import RefQuizDifficultyLevel, RefQuizQuestionType
    return {
        'question_types': list(
            RefQuizQuestionType.objects.filter(is_active=True)
            .order_by('sort_order')
            .values(
                'mastermind_ref_quiz_question_type_id',
                'question_type_code', 'question_type_name_bn', 'question_type_name_en',
            )
        ),
        'difficulty_levels': list(
            RefQuizDifficultyLevel.objects.filter(is_active=True)
            .order_by('sort_order')
            .values(
                'mastermind_ref_quiz_difficulty_level_id',
                'difficulty_code', 'difficulty_name_bn', 'difficulty_name_en',
            )
        ),
        'topics': list(
            CollQuizTopic.objects.filter(is_active=True)
            .order_by('sort_order')
            .values(
                'mastermind_coll_quiz_topic_id', 'topic_code',
                'topic_name_bn', 'topic_name_en',
            )
        ),
        'books': list(
            CollBook.objects.filter(is_active=True)
            .order_by('-created_at')
            .values('mastermind_coll_book_id', 'book_title_bn')
        ),
    }


def get_question_form_context(question_id=None):
    """Context dict for the single-question create/edit form."""
    context = _get_shared_ref_data()
    context['chapters'] = list(
        CollBookChapter.objects.filter(is_active=True)
        .order_by('chapter_number')
        .values(
            'mastermind_coll_book_chapter_id',
            'link_mastermind_coll_book_id',
            'chapter_number', 'chapter_title_bn',
        )
    )
    context['question_status_codes'] = ['draft', 'review', 'published', 'archived']
    context['question'] = build_review_question_context(question_id) if question_id else None
    return context


QUIZ_SORT_OPTIONS = {
    'newest': '-created_at',
    'oldest': 'created_at',
    'title': 'exam_title_bn',
    'most_questions': '-exam_total_questions',
}


def paginate_quizzes(page_number=1, per_page=50, sort_by=None):
    """Quiz list (coll_quiz) with question count + creator."""
    from django.core.paginator import EmptyPage, Paginator
    from amolnama_news.site_apps.mastermind.models import CollQuiz, MapQuizQuestionPool

    order_field = QUIZ_SORT_OPTIONS.get(sort_by, '-created_at')
    queryset = (
        CollQuiz.objects.filter(is_active=True)
        .order_by(order_field)
        .values(
            'mastermind_coll_quiz_id',
            'exam_title_bn', 'exam_title_en', 'exam_slug',
            'exam_total_questions', 'exam_status_code',
            'exam_rewards_enabled', 'exam_reward_criteria_code',
            'exam_pass_percentage', 'exam_time_limit_minutes',
            'created_at',
        )
    )
    paginator = Paginator(queryset, per_page)
    try:
        page = paginator.page(page_number)
    except EmptyPage:
        page = paginator.page(paginator.num_pages or 1)
    quizzes = list(page.object_list)

    # Real question counts (pool rows), not the cached exam_total_questions
    quiz_ids = [quiz['mastermind_coll_quiz_id'] for quiz in quizzes]
    pool_counts_rows = (
        MapQuizQuestionPool.objects
        .filter(link_mastermind_coll_quiz_id__in=quiz_ids)
        .values_list('link_mastermind_coll_quiz_id')
        .annotate(total=Count('mastermind_map_quiz_question_pool_id'))
    )
    pool_counts = {row[0]: row[1] for row in pool_counts_rows}
    for quiz in quizzes:
        quiz['actual_question_count'] = pool_counts.get(quiz['mastermind_coll_quiz_id'], 0)

    return {
        'quizzes': quizzes,
        'page_number': page.number,
        'total_pages': paginator.num_pages,
        'total_count': paginator.count,
        'has_previous': page.has_previous(),
        'has_next': page.has_next(),
    }


def get_quiz_form_context(exam_id=None):
    """Context dict for quiz_form.html (create + edit)."""
    from amolnama_news.site_apps.mastermind.models import (
        CollQuiz, CollQuestion, CollQuestionOption, MapQuizQuestionPool,
        RefQuizBadge,
    )
    context = _get_shared_ref_data()
    context['badges'] = list(
        RefQuizBadge.objects.filter(is_active=True)
        .order_by('sort_order')
        .values(
            'mastermind_ref_quiz_badge_id',
            'badge_code', 'badge_name_bn', 'badge_name_en', 'badge_icon',
        )
    )
    context['exam_status_codes'] = ['draft', 'review', 'published', 'archived']
    context['reward_criteria_codes'] = [
        ('threshold', 'Anyone who scores at or above the threshold'),
        ('top_n', 'Top N ranked scorers'),
        ('speed', 'Fastest passing session'),
    ]

    if not exam_id:
        context['quiz'] = None
        return context

    exam_row = (
        CollQuiz.objects.filter(mastermind_coll_quiz_id=exam_id, is_active=True)
        .values(
            'mastermind_coll_quiz_id', 'exam_title_bn', 'exam_title_en',
            'exam_description_bn', 'exam_slug',
            'link_mastermind_coll_quiz_topic_id', 'link_mastermind_coll_book_id',
            'exam_total_questions', 'exam_time_limit_minutes',
            'exam_pass_percentage', 'exam_negative_marking_per_wrong',
            'exam_shuffle_questions', 'exam_shuffle_options',
            'exam_show_explanation_code', 'exam_allow_review',
            'exam_max_attempts',
            'exam_scheduled_publish_at', 'exam_scheduled_close_at',
            'exam_rewards_enabled', 'exam_reward_criteria_code',
            'exam_reward_threshold_percent', 'exam_reward_top_n',
            'link_reward_badge_id', 'exam_reward_description',
            'exam_status_code', 'created_at', 'updated_at',
        )
        .first()
    )
    if not exam_row:
        context['quiz'] = None
        return context

    question_ids_ordered = list(
        MapQuizQuestionPool.objects
        .filter(link_mastermind_coll_quiz_id=exam_id)
        .order_by('mastermind_map_quiz_question_pool_id')
        .values_list('link_mastermind_coll_question_id', flat=True)
    )
    questions_by_id = {
        question['mastermind_coll_question_id']: question
        for question in (
            CollQuestion.objects
            .filter(mastermind_coll_question_id__in=question_ids_ordered, is_active=True)
            .values()
        )
    }
    options_by_question_id = {}
    for option_row in (
        CollQuestionOption.objects
        .filter(link_mastermind_coll_question_id__in=question_ids_ordered, is_active=True)
        .order_by('sort_order', 'mastermind_coll_question_option_id')
        .values()
    ):
        options_by_question_id.setdefault(
            option_row['link_mastermind_coll_question_id'], [],
        ).append(option_row)

    questions_in_order = []
    for question_id in question_ids_ordered:
        question = questions_by_id.get(question_id)
        if not question:
            continue
        question['options'] = options_by_question_id.get(question_id, [])
        questions_in_order.append(question)

    exam_row['questions'] = questions_in_order
    context['quiz'] = exam_row
    return context


def get_quiz_leaderboard_context(exam_id, limit=50):
    """Top scorers for one exam — anonymised to display_name only."""
    from amolnama_news.site_apps.mastermind.models import CollQuiz, CollQuizSession
    exam_row = (
        CollQuiz.objects.filter(mastermind_coll_quiz_id=exam_id, is_active=True)
        .values(
            'mastermind_coll_quiz_id', 'exam_title_bn', 'exam_title_en',
            'exam_rewards_enabled', 'exam_reward_criteria_code',
            'exam_reward_threshold_percent', 'exam_reward_top_n',
        )
        .first()
    )
    if not exam_row:
        return {'quiz': None, 'leaderboard_rows': []}

    completed_sessions = list(
        CollQuizSession.objects
        .filter(
            link_mastermind_coll_quiz_id=exam_id,
            session_status_code='completed',
        )
        .order_by('-session_score_percentage', 'session_time_taken_seconds')
        .values(
            'mastermind_coll_quiz_session_id', 'link_user_profile_id',
            'session_score_percentage', 'session_time_taken_seconds',
            'session_is_passed', 'session_completed_at',
        )[:limit]
    )

    user_profile_ids = [row['link_user_profile_id'] for row in completed_sessions]
    from amolnama_news.site_apps.user_account.models import UserProfile
    display_names_by_user_profile_id = dict(
        UserProfile.objects.filter(user_profile_id__in=user_profile_ids)
        .values_list('user_profile_id', 'display_name')
    )
    for rank_index, row in enumerate(completed_sessions, start=1):
        row['rank'] = rank_index
        row['display_name'] = display_names_by_user_profile_id.get(
            row['link_user_profile_id'], 'Anonymous',
        )
    return {'quiz': exam_row, 'leaderboard_rows': completed_sessions}


QUESTION_SORT_OPTIONS = {
    'newest': '-created_at',
    'oldest': 'created_at',
    'most_used': '-usage_count',
    'least_used': 'usage_count',
    'highest_accuracy': '-correct_answer_rate',
    'lowest_accuracy': 'correct_answer_rate',
    'id_asc': 'mastermind_coll_question_id',
    'id_desc': '-mastermind_coll_question_id',
}


def paginate_questions(page_number=1, per_page=50, topic_id=None, book_id=None,
                       status_code=None, question_type_id=None, difficulty_id=None,
                       source_code=None, search_query=None, sort_by=None):
    """Full question bank browser with filtering, search, and sorting."""
    from django.core.paginator import EmptyPage, Paginator
    from django.db.models import Q

    filters = {'is_active': True}
    if topic_id:
        filters['link_mastermind_coll_quiz_topic_id'] = topic_id
    if book_id:
        filters['link_mastermind_coll_book_id'] = book_id
    if status_code:
        filters['question_status_code'] = status_code
    if question_type_id:
        filters['link_mastermind_ref_quiz_question_type_id'] = question_type_id
    if difficulty_id:
        filters['link_mastermind_ref_quiz_difficulty_level_id'] = difficulty_id
    if source_code:
        filters['question_generation_source_code'] = source_code

    queryset = CollQuestion.objects.filter(**filters)
    if search_query:
        queryset = queryset.filter(
            Q(question_text_bn__icontains=search_query) |
            Q(question_text_en__icontains=search_query)
        )
    order_field = QUESTION_SORT_OPTIONS.get(sort_by, '-created_at')
    queryset = queryset.order_by(order_field).values(
        'mastermind_coll_question_id',
        'question_text_bn', 'question_text_en',
        'question_status_code',
        'question_generation_source_code',
        'link_mastermind_coll_quiz_topic_id',
        'link_mastermind_coll_book_id',
        'link_mastermind_ref_quiz_question_type_id',
        'link_mastermind_ref_quiz_difficulty_level_id',
        'usage_count', 'correct_answer_rate',
        'created_at',
    )

    paginator = Paginator(queryset, per_page)
    try:
        page = paginator.page(page_number)
    except EmptyPage:
        page = paginator.page(paginator.num_pages or 1)
    questions = list(page.object_list)

    topic_ids = {q['link_mastermind_coll_quiz_topic_id'] for q in questions if q['link_mastermind_coll_quiz_topic_id']}
    topic_names = dict(
        CollQuizTopic.objects.filter(mastermind_coll_quiz_topic_id__in=topic_ids)
        .values_list('mastermind_coll_quiz_topic_id', 'topic_name_bn')
    ) if topic_ids else {}

    book_ids = {q['link_mastermind_coll_book_id'] for q in questions if q['link_mastermind_coll_book_id']}
    book_names = dict(
        CollBook.objects.filter(mastermind_coll_book_id__in=book_ids)
        .values_list('mastermind_coll_book_id', 'book_title_bn')
    ) if book_ids else {}

    from amolnama_news.site_apps.mastermind.models import RefQuizQuestionType, RefQuizDifficultyLevel
    type_ids = {q['link_mastermind_ref_quiz_question_type_id'] for q in questions if q['link_mastermind_ref_quiz_question_type_id']}
    type_names = dict(
        RefQuizQuestionType.objects.filter(mastermind_ref_quiz_question_type_id__in=type_ids)
        .values_list('mastermind_ref_quiz_question_type_id', 'question_type_name_en')
    ) if type_ids else {}

    diff_ids = {q['link_mastermind_ref_quiz_difficulty_level_id'] for q in questions if q['link_mastermind_ref_quiz_difficulty_level_id']}
    diff_names = dict(
        RefQuizDifficultyLevel.objects.filter(mastermind_ref_quiz_difficulty_level_id__in=diff_ids)
        .values_list('mastermind_ref_quiz_difficulty_level_id', 'difficulty_name_en')
    ) if diff_ids else {}

    for question in questions:
        question['topic_name_bn'] = topic_names.get(question['link_mastermind_coll_quiz_topic_id'], '—')
        question['book_title_bn'] = book_names.get(question['link_mastermind_coll_book_id'], '—')
        question['question_type_name_en'] = type_names.get(question['link_mastermind_ref_quiz_question_type_id'], '—')
        question['difficulty_name_en'] = diff_names.get(question['link_mastermind_ref_quiz_difficulty_level_id'], '—')

    return {
        'questions': questions,
        'page_number': page.number,
        'total_pages': paginator.num_pages,
        'total_count': paginator.count,
        'has_previous': page.has_previous(),
        'has_next': page.has_next(),
    }


def get_question_bank_filter_options():
    """Populate filter bar dropdowns for the question bank browser."""
    from amolnama_news.site_apps.mastermind.models import RefQuizQuestionType, RefQuizDifficultyLevel
    return {
        'topics': list(
            CollQuizTopic.objects.filter(is_active=True)
            .order_by('sort_order', 'topic_name_en')
            .values('mastermind_coll_quiz_topic_id', 'topic_name_bn', 'topic_name_en')
        ),
        'books': list(
            CollBook.objects.filter(is_active=True)
            .order_by('-created_at')
            .values('mastermind_coll_book_id', 'book_title_bn')
        ),
        'question_types': list(
            RefQuizQuestionType.objects.filter(is_active=True)
            .order_by('sort_order')
            .values('mastermind_ref_quiz_question_type_id', 'question_type_name_bn', 'question_type_name_en')
        ),
        'difficulty_levels': list(
            RefQuizDifficultyLevel.objects.filter(is_active=True)
            .order_by('sort_order')
            .values('mastermind_ref_quiz_difficulty_level_id', 'difficulty_name_bn', 'difficulty_name_en')
        ),
        'status_codes': ['draft', 'review', 'published', 'archived'],
        'source_codes': ['manual', 'ai_generated', 'ai_reviewed', 'imported'],
    }


def get_question_analytics_context(question_id):
    """Per-question psychometric analytics — difficulty index, discrimination, distractor analysis."""
    from amolnama_news.site_apps.mastermind.models import (
        CollQuizSessionQuestion, CollQuizSession, CollQuestionOption,
    )

    question = (
        CollQuestion.objects
        .filter(mastermind_coll_question_id=question_id, is_active=True)
        .values(
            'mastermind_coll_question_id', 'question_text_bn', 'question_text_en',
            'question_status_code', 'usage_count', 'correct_answer_rate',
            'link_mastermind_coll_quiz_topic_id', 'link_mastermind_coll_book_id',
            'question_generation_source_code',
        )
        .first()
    )
    if not question:
        return None

    options = list(
        CollQuestionOption.objects
        .filter(link_mastermind_coll_question_id=question_id, is_active=True)
        .order_by('sort_order')
        .values('mastermind_coll_question_option_id', 'option_label', 'option_text_bn', 'is_correct')
    )

    session_questions = list(
        CollQuizSessionQuestion.objects
        .filter(link_mastermind_coll_question_id=question_id)
        .select_related()
        .values(
            'is_correct', 'link_selected_option_id', 'time_spent_seconds',
            'link_mastermind_coll_quiz_session_id',
        )
    )

    total_attempts = len(session_questions)
    total_correct = sum(1 for sq in session_questions if sq['is_correct'])

    difficulty_index = (total_correct / total_attempts * 100) if total_attempts > 0 else None

    option_selection_counts = {opt['mastermind_coll_question_option_id']: 0 for opt in options}
    for sq in session_questions:
        if sq['link_selected_option_id'] and sq['link_selected_option_id'] in option_selection_counts:
            option_selection_counts[sq['link_selected_option_id']] += 1

    for opt in options:
        opt_id = opt['mastermind_coll_question_option_id']
        opt['selection_count'] = option_selection_counts.get(opt_id, 0)
        opt['selection_percentage'] = (
            round(opt['selection_count'] / total_attempts * 100, 1) if total_attempts > 0 else 0
        )

    time_values = [sq['time_spent_seconds'] for sq in session_questions if sq['time_spent_seconds']]
    average_time_seconds = round(sum(time_values) / len(time_values), 1) if time_values else None

    discrimination_index = None
    if total_attempts >= 10:
        session_ids = [sq['link_mastermind_coll_quiz_session_id'] for sq in session_questions]
        session_scores = dict(
            CollQuizSession.objects
            .filter(mastermind_coll_quiz_session_id__in=session_ids)
            .values_list('mastermind_coll_quiz_session_id', 'session_score_percentage')
        )
        scored_attempts = []
        for sq in session_questions:
            score = session_scores.get(sq['link_mastermind_coll_quiz_session_id'])
            if score is not None:
                scored_attempts.append({'is_correct': sq['is_correct'], 'session_score': float(score)})
        if len(scored_attempts) >= 10:
            scored_attempts.sort(key=lambda x: x['session_score'], reverse=True)
            quartile_size = max(1, len(scored_attempts) // 4)
            top_quartile = scored_attempts[:quartile_size]
            bottom_quartile = scored_attempts[-quartile_size:]
            top_correct_rate = sum(1 for s in top_quartile if s['is_correct']) / len(top_quartile)
            bottom_correct_rate = sum(1 for s in bottom_quartile if s['is_correct']) / len(bottom_quartile)
            discrimination_index = round(top_correct_rate - bottom_correct_rate, 2)

    question['topic_name_bn'] = (
        CollQuizTopic.objects
        .filter(mastermind_coll_quiz_topic_id=question['link_mastermind_coll_quiz_topic_id'])
        .values_list('topic_name_bn', flat=True).first()
    ) if question['link_mastermind_coll_quiz_topic_id'] else None

    question['book_title_bn'] = (
        CollBook.objects
        .filter(mastermind_coll_book_id=question['link_mastermind_coll_book_id'])
        .values_list('book_title_bn', flat=True).first()
    ) if question['link_mastermind_coll_book_id'] else None

    return {
        'question': question,
        'options': options,
        'total_attempts': total_attempts,
        'total_correct': total_correct,
        'difficulty_index': round(difficulty_index, 1) if difficulty_index is not None else None,
        'discrimination_index': discrimination_index,
        'average_time_seconds': average_time_seconds,
    }


def get_dashboard_chart_data():
    """Aggregate data for dashboard visual charts."""
    from django.db.models import Count
    from django.db.models.functions import TruncDate

    status_distribution = dict(
        CollQuestion.objects.filter(is_active=True)
        .values_list('question_status_code')
        .annotate(total=Count('mastermind_coll_question_id'))
    )

    topic_distribution = list(
        CollQuestion.objects.filter(is_active=True)
        .values('link_mastermind_coll_quiz_topic_id')
        .annotate(total=Count('mastermind_coll_question_id'))
        .order_by('-total')[:10]
    )
    topic_ids = [row['link_mastermind_coll_quiz_topic_id'] for row in topic_distribution if row['link_mastermind_coll_quiz_topic_id']]
    topic_names = dict(
        CollQuizTopic.objects.filter(mastermind_coll_quiz_topic_id__in=topic_ids)
        .values_list('mastermind_coll_quiz_topic_id', 'topic_name_en')
    ) if topic_ids else {}
    max_topic_count = max((row['total'] for row in topic_distribution), default=1)
    for row in topic_distribution:
        row['topic_name_en'] = topic_names.get(row['link_mastermind_coll_quiz_topic_id'], 'Unknown')
        row['bar_width_percent'] = round(row['total'] / max_topic_count * 100)

    daily_generation = list(
        CollGenerationJob.objects
        .filter(generation_status_code='completed')
        .annotate(generation_date=TruncDate('created_at'))
        .values('generation_date')
        .annotate(
            total_created=Count('mastermind_coll_generation_job_id'),
        )
        .order_by('-generation_date')[:14]
    )
    daily_generation.reverse()
    max_daily = max((row['total_created'] for row in daily_generation), default=1)
    for row in daily_generation:
        row['bar_width_percent'] = round(row['total_created'] / max_daily * 100)

    return {
        'status_distribution': status_distribution,
        'topic_distribution': topic_distribution,
        'daily_generation': daily_generation,
    }


def log_quiz_workflow_transition(quiz_id, from_status, to_status, user_profile_id, role_code='staff', comment=None):
    """Record a quiz status transition in the audit log."""
    from amolnama_news.site_apps.mastermind.models import CollQuizWorkflowLog
    CollQuizWorkflowLog.objects.create(
        link_mastermind_coll_quiz_id=quiz_id,
        from_status_code=from_status,
        to_status_code=to_status,
        link_user_profile_id=user_profile_id,
        role_code=role_code,
        workflow_comment=comment,
    )


def get_quiz_workflow_log(quiz_id):
    """Audit trail for one quiz — newest first."""
    from amolnama_news.site_apps.mastermind.models import CollQuizWorkflowLog
    from amolnama_news.site_apps.user_account.models import UserProfile

    logs = list(
        CollQuizWorkflowLog.objects
        .filter(link_mastermind_coll_quiz_id=quiz_id)
        .order_by('-created_at')
        .values(
            'mastermind_coll_quiz_workflow_log_id',
            'from_status_code', 'to_status_code',
            'link_user_profile_id', 'role_code',
            'workflow_comment', 'created_at',
        )
    )

    user_ids = {log['link_user_profile_id'] for log in logs}
    display_names = dict(
        UserProfile.objects.filter(user_profile_id__in=user_ids)
        .values_list('user_profile_id', 'display_name')
    ) if user_ids else {}

    for log in logs:
        log['display_name'] = display_names.get(log['link_user_profile_id'], 'System')

    return logs


def get_question_version_history(question_id):
    """Version history for one question — newest first."""
    from amolnama_news.site_apps.mastermind.models import CollQuestionVersion
    from amolnama_news.site_apps.user_account.models import UserProfile

    versions = list(
        CollQuestionVersion.objects
        .filter(link_mastermind_coll_question_id=question_id)
        .order_by('-version_number')
        .values(
            'mastermind_coll_question_version_id', 'version_number',
            'question_text_bn', 'question_metadata_json',
            'link_modified_by_user_profile_id', 'change_summary',
            'is_current', 'created_at',
        )
    )

    user_ids = {v['link_modified_by_user_profile_id'] for v in versions if v['link_modified_by_user_profile_id']}
    display_names = dict(
        UserProfile.objects.filter(user_profile_id__in=user_ids)
        .values_list('user_profile_id', 'display_name')
    ) if user_ids else {}

    for version in versions:
        version['modified_by_display_name'] = display_names.get(
            version['link_modified_by_user_profile_id'], 'System'
        )

    return versions


def get_quiz_preview_context(exam_id):
    """Read-only preview of a quiz — shows all questions + options as a student would see them."""
    from amolnama_news.site_apps.mastermind.models import (
        CollQuiz, CollQuestion, CollQuestionOption, MapQuizQuestionPool,
    )
    exam = (
        CollQuiz.objects.filter(mastermind_coll_quiz_id=exam_id, is_active=True)
        .values(
            'mastermind_coll_quiz_id', 'exam_title_bn', 'exam_title_en',
            'exam_total_questions', 'exam_time_limit_minutes',
            'exam_pass_percentage', 'exam_negative_marking_per_wrong',
            'exam_shuffle_questions', 'exam_shuffle_options',
            'exam_status_code',
        )
        .first()
    )
    if not exam:
        return None

    question_ids = list(
        MapQuizQuestionPool.objects
        .filter(link_mastermind_coll_quiz_id=exam_id)
        .order_by('mastermind_map_quiz_question_pool_id')
        .values_list('link_mastermind_coll_question_id', flat=True)
    )

    if not question_ids:
        question_filter = {'question_status_code': 'published', 'is_active': True}
        if exam.get('link_mastermind_coll_quiz_topic_id'):
            question_filter['link_mastermind_coll_quiz_topic_id'] = exam['link_mastermind_coll_quiz_topic_id']
        question_ids = list(
            CollQuestion.objects.filter(**question_filter)
            .values_list('mastermind_coll_question_id', flat=True)[:exam['exam_total_questions']]
        )

    questions = list(
        CollQuestion.objects
        .filter(mastermind_coll_question_id__in=question_ids, is_active=True)
        .values(
            'mastermind_coll_question_id', 'question_text_bn', 'question_text_en',
            'question_explanation_bn', 'question_hint_bn',
            'question_points', 'question_image_url',
            'source_page_number', 'source_snippet_text',
            'link_mastermind_coll_book_id', 'link_mastermind_coll_book_chapter_id',
        )
    )
    questions_by_id = {q['mastermind_coll_question_id']: q for q in questions}

    all_options = list(
        CollQuestionOption.objects
        .filter(link_mastermind_coll_question_id__in=question_ids, is_active=True)
        .order_by('sort_order')
        .values(
            'link_mastermind_coll_question_id',
            'option_label', 'option_text_bn', 'is_correct',
        )
    )
    for opt in all_options:
        questions_by_id.get(opt['link_mastermind_coll_question_id'], {}).setdefault('options', []).append(opt)

    ordered_questions = []
    for qid in question_ids:
        if qid in questions_by_id:
            question = questions_by_id[qid]
            question.setdefault('options', [])
            ordered_questions.append(question)

    return {
        'quiz': exam,
        'questions': ordered_questions,
        'total_questions': len(ordered_questions),
    }


def paginate_generation_jobs(page_number=1, per_page=50):
    """Server-side pagination for the generation jobs audit page."""
    from django.core.paginator import EmptyPage, Paginator
    queryset = (
        CollGenerationJob.objects
        .order_by('-created_at')
        .values(*GENERATION_JOB_LIST_FIELDS)
    )
    paginator = Paginator(queryset, per_page)
    try:
        page = paginator.page(page_number)
    except EmptyPage:
        page = paginator.page(paginator.num_pages or 1)
    jobs = list(page.object_list)
    _annotate_jobs_with_book_titles(jobs)
    return {
        'jobs': jobs,
        'page_number': page.number,
        'total_pages': paginator.num_pages,
        'total_count': paginator.count,
        'has_previous': page.has_previous(),
        'has_next': page.has_next(),
    }
