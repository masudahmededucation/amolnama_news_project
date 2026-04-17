"""Mastermind exporters — bulk question / quiz export to CSV or JSON.

Used by quizadmin "Export" buttons and by staff who want to back up or
migrate a question bank. Pairs with engine_advanced.bulk_import_questions.

Output formats are intentionally round-trip compatible: an export from this
module can be re-imported via bulk_import_questions without manual editing.
"""
import csv
import io
import json

from django.utils import timezone

from .models import (
    CollQuestion,
    CollQuestionOption,
    CollQuiz,
    MapQuizQuestionPool,
    RefQuizDifficultyLevel,
    RefQuizQuestionType,
    CollQuizTopic,
    CollBook,
    CollBookChapter,
    CollQuestionMatchPair,
)


CSV_QUESTION_HEADERS = [
    'question_id',
    'question_type_code',
    'difficulty_code',
    'topic_code',
    'question_text_bn',
    'question_text_en',
    'question_explanation_bn',
    'question_explanation_en',
    'question_hint_bn',
    'question_hint_en',
    'question_image_url',
    'question_points',
    'question_time_limit_seconds',
    'question_negative_marking_points',
    'book_title_en',
    'book_chapter_title_en',
    'source_page_number',
    'source_snippet_text',
    'options_json',
    'match_pairs_json',
    'question_status_code',
    'created_at',
]


# ================================================================
# Lookups (cached per-call to avoid N+1)
# ================================================================

def _build_reference_caches():
    """Pre-load ref tables once so per-question export is O(1) lookup."""
    return {
        'question_type_codes': dict(
            RefQuizQuestionType.objects.values_list(
                'mastermind_ref_quiz_question_type_id', 'question_type_code',
            )
        ),
        'difficulty_codes': dict(
            RefQuizDifficultyLevel.objects.values_list(
                'mastermind_ref_quiz_difficulty_level_id', 'difficulty_code',
            )
        ),
        'topic_codes': dict(
            CollQuizTopic.objects.values_list(
                'mastermind_coll_quiz_topic_id', 'topic_code',
            )
        ),
        'book_titles': dict(
            CollBook.objects.values_list(
                'mastermind_coll_book_id', 'book_title_en',
            )
        ),
        'chapter_titles': dict(
            CollBookChapter.objects.values_list(
                'mastermind_coll_book_chapter_id', 'chapter_title_en',
            )
        ),
    }


# ================================================================
# Public: export functions
# ================================================================

def export_questions_to_dicts(question_id_list=None, topic_id=None, book_id=None):
    """Return a list of question dicts ready for JSON serialisation.

    Filters (any combination):
      - question_id_list: explicit set of question IDs
      - topic_id: only questions tagged with this topic
      - book_id: only questions sourced from this book

    If all filters are None, returns the entire active question bank.
    """
    query = CollQuestion.objects.filter(is_active=True)
    if question_id_list:
        query = query.filter(mastermind_coll_question_id__in=question_id_list)
    if topic_id:
        query = query.filter(link_mastermind_coll_quiz_topic_id=topic_id)
    if book_id:
        query = query.filter(link_mastermind_coll_book_id=book_id)

    questions = list(query.order_by('mastermind_coll_question_id'))
    if not questions:
        return []

    question_ids = [question.mastermind_coll_question_id for question in questions]
    options_by_question_id = _load_options_for_questions(question_ids)
    match_pairs_by_question_id = _load_match_pairs_for_questions(question_ids)
    reference_caches = _build_reference_caches()

    output = []
    for question in questions:
        output.append(_question_to_dict(
            question,
            options_by_question_id.get(question.mastermind_coll_question_id, []),
            match_pairs_by_question_id.get(question.mastermind_coll_question_id, []),
            reference_caches,
        ))
    return output


def export_questions_to_csv_bytes(question_id_list=None, topic_id=None, book_id=None):
    """Return CSV-encoded bytes (UTF-8 with BOM so Excel opens Bengali correctly)."""
    rows = export_questions_to_dicts(
        question_id_list=question_id_list, topic_id=topic_id, book_id=book_id,
    )

    buffer = io.StringIO()
    writer = csv.DictWriter(buffer, fieldnames=CSV_QUESTION_HEADERS, extrasaction='ignore')
    writer.writeheader()
    for row in rows:
        # nested objects → JSON strings inside the CSV cell
        flat_row = dict(row)
        flat_row['options_json'] = json.dumps(row.get('options', []), ensure_ascii=False)
        flat_row['match_pairs_json'] = json.dumps(row.get('match_pairs', []), ensure_ascii=False)
        writer.writerow(flat_row)

    csv_text = '\ufeff' + buffer.getvalue()
    return csv_text.encode('utf-8')


def export_quiz_to_dict(quiz_id):
    """Export one quiz row + its question pool as a single round-trip-safe dict."""
    quiz = CollQuiz.objects.filter(mastermind_coll_quiz_id=quiz_id, is_active=True).first()
    if not quiz:
        return None

    pool_question_ids = list(
        MapQuizQuestionPool.objects
        .filter(link_mastermind_coll_quiz_id=quiz_id)
        .order_by('mastermind_map_quiz_question_pool_id')
        .values_list('link_mastermind_coll_question_id', flat=True)
    )

    return {
        'quiz': {
            'mastermind_coll_quiz_id': quiz.mastermind_coll_quiz_id,
            'exam_title_bn': quiz.exam_title_bn,
            'exam_title_en': quiz.exam_title_en,
            'exam_description_bn': quiz.exam_description_bn,
            'exam_slug': quiz.exam_slug,
            'exam_total_questions': quiz.exam_total_questions,
            'exam_time_limit_minutes': quiz.exam_time_limit_minutes,
            'exam_pass_percentage': float(quiz.exam_pass_percentage) if quiz.exam_pass_percentage is not None else None,
            'exam_negative_marking_per_wrong': float(quiz.exam_negative_marking_per_wrong or 0),
            'exam_shuffle_questions': quiz.exam_shuffle_questions,
            'exam_shuffle_options': quiz.exam_shuffle_options,
            'exam_show_explanation_code': quiz.exam_show_explanation_code,
            'exam_allow_review': quiz.exam_allow_review,
            'exam_max_attempts': quiz.exam_max_attempts,
            'exam_proctoring_level': quiz.exam_proctoring_level,
            'exam_proctoring_max_score': quiz.exam_proctoring_max_score,
            'exam_status_code': quiz.exam_status_code,
            'created_at': quiz.created_at.isoformat() if quiz.created_at else None,
        },
        'questions': export_questions_to_dicts(question_id_list=pool_question_ids),
        'export_metadata': {
            'exported_at': timezone.now().isoformat(),
            'export_format_version': '1.0',
        },
    }


# ================================================================
# Internal helpers
# ================================================================

def _load_options_for_questions(question_ids):
    by_question = {}
    options = (
        CollQuestionOption.objects
        .filter(link_mastermind_coll_question_id__in=question_ids, is_active=True)
        .order_by('sort_order', 'mastermind_coll_question_option_id')
    )
    for option in options:
        bucket = by_question.setdefault(option.link_mastermind_coll_question_id, [])
        bucket.append({
            'option_label': option.option_label,
            'option_text_bn': option.option_text_bn,
            'option_text_en': option.option_text_en,
            'option_image_url': option.option_image_url,
            'is_correct': bool(option.is_correct),
            'option_explanation_bn': option.option_explanation_bn,
            'sort_order': option.sort_order,
        })
    return by_question


def _load_match_pairs_for_questions(question_ids):
    by_question = {}
    try:
        pairs = (
            CollQuestionMatchPair.objects
            .filter(link_mastermind_coll_question_id__in=question_ids, is_active=True)
            .order_by('sort_order', 'mastermind_coll_question_match_pair_id')
        )
        for pair in pairs:
            bucket = by_question.setdefault(pair.link_mastermind_coll_question_id, [])
            bucket.append({
                'stem_text_bn': pair.stem_text_bn,
                'stem_text_en': pair.stem_text_en,
                'response_text_bn': pair.response_text_bn,
                'response_text_en': pair.response_text_en,
                'sort_order': pair.sort_order,
            })
    except Exception:
        # Match pair table may not exist in older deployments — fail soft
        pass
    return by_question


def _question_to_dict(question, options, match_pairs, reference_caches):
    return {
        'question_id': question.mastermind_coll_question_id,
        'question_type_code': reference_caches['question_type_codes'].get(
            question.link_mastermind_ref_quiz_question_type_id
        ),
        'difficulty_code': reference_caches['difficulty_codes'].get(
            question.link_mastermind_ref_quiz_difficulty_level_id
        ),
        'topic_code': reference_caches['topic_codes'].get(
            question.link_mastermind_coll_quiz_topic_id
        ),
        'question_text_bn': question.question_text_bn,
        'question_text_en': question.question_text_en,
        'question_explanation_bn': question.question_explanation_bn,
        'question_explanation_en': question.question_explanation_en,
        'question_hint_bn': question.question_hint_bn,
        'question_hint_en': question.question_hint_en,
        'question_image_url': question.question_image_url,
        'question_points': question.question_points,
        'question_time_limit_seconds': question.question_time_limit_seconds,
        'question_negative_marking_points': float(question.question_negative_marking_points or 0),
        'book_title_en': reference_caches['book_titles'].get(
            question.link_mastermind_coll_book_id
        ),
        'book_chapter_title_en': reference_caches['chapter_titles'].get(
            question.link_mastermind_coll_book_chapter_id
        ),
        'source_page_number': question.source_page_number,
        'source_snippet_text': question.source_snippet_text,
        'options': options,
        'match_pairs': match_pairs,
        'question_status_code': question.question_status_code,
        'created_at': question.created_at.isoformat() if question.created_at else None,
    }


# ================================================================
# GRADEBOOK CSV — every completed session for one quiz
# ================================================================

GRADEBOOK_CSV_HEADERS = [
    'session_id', 'attempt_number', 'user_profile_id', 'recipient_display_name',
    'started_at', 'completed_at', 'time_taken_seconds',
    'total_questions', 'correct', 'wrong', 'skipped',
    'score_raw', 'score_max', 'score_percentage',
    'is_passed', 'pass_percentage_threshold',
]


def export_gradebook_to_csv_bytes(quiz_id, include_in_progress=False):
    """Stream every session for one quiz as a CSV byte string.

    Includes a UTF-8 BOM so Excel renders Bengali display names correctly. Pairs
    one row per session — score, time, pass/fail. Joined recipient_display_name
    via UserProfile in a single batch query (no N+1).
    """
    from .models import CollQuizSession

    quiz = CollQuiz.objects.filter(mastermind_coll_quiz_id=quiz_id).first()
    pass_threshold = float(quiz.exam_pass_percentage) if quiz else 0.0

    queryset = CollQuizSession.objects.filter(link_mastermind_coll_quiz_id=quiz_id)
    if not include_in_progress:
        queryset = queryset.filter(session_status_code='completed')
    sessions = list(queryset.order_by('-session_completed_at', '-session_started_at').values(
        'mastermind_coll_quiz_session_id', 'session_attempt_number',
        'link_user_profile_id',
        'session_started_at', 'session_completed_at', 'session_time_taken_seconds',
        'session_total_questions', 'session_total_correct',
        'session_total_wrong', 'session_total_skipped',
        'session_score_raw', 'session_score_max', 'session_score_percentage',
        'session_is_passed',
    ))

    display_names = {}
    if sessions:
        try:
            from amolnama_news.site_apps.user_account.models import UserProfile
            user_profile_ids = list({session['link_user_profile_id'] for session in sessions})
            display_names = {
                profile['user_profile_id']: profile.get('display_name') or ''
                for profile in UserProfile.objects.filter(
                    user_profile_id__in=user_profile_ids
                ).values('user_profile_id', 'display_name')
            }
        except Exception:
            display_names = {}

    output = io.StringIO()
    output.write('\ufeff')  # UTF-8 BOM for Excel
    writer = csv.writer(output)
    writer.writerow(GRADEBOOK_CSV_HEADERS)
    for session in sessions:
        writer.writerow([
            session['mastermind_coll_quiz_session_id'],
            session['session_attempt_number'],
            session['link_user_profile_id'],
            display_names.get(session['link_user_profile_id'], ''),
            session['session_started_at'].isoformat() if session['session_started_at'] else '',
            session['session_completed_at'].isoformat() if session['session_completed_at'] else '',
            session['session_time_taken_seconds'] or '',
            session['session_total_questions'],
            session['session_total_correct'],
            session['session_total_wrong'],
            session['session_total_skipped'],
            float(session['session_score_raw'] or 0),
            float(session['session_score_max'] or 0),
            float(session['session_score_percentage'] or 0),
            'pass' if session['session_is_passed'] is True else ('fail' if session['session_is_passed'] is False else ''),
            pass_threshold,
        ])
    return output.getvalue().encode('utf-8')


# ================================================================
# FULL BACKUP — every book + chapter + question + option + match-pair as one stream
# ================================================================

def export_full_backup_to_dict():
    """Return the full mastermind content tree as a single dict.

    Suitable for off-site backup. Streams:
      books → chapters
      topics
      questions → options + match-pairs (with topic_code / difficulty_code resolved)
      quizzes → pool entries
    Quiz sessions, certificates, comments, webhooks etc. are NOT included —
    those are run-state, not authored content.
    """
    reference_caches = _build_reference_caches()

    books = list(CollBook.objects.filter(is_active=True).values(
        'mastermind_coll_book_id', 'book_title_bn', 'book_title_en',
        'book_author_bn', 'book_author_en', 'book_publisher_bn',
        'book_publisher_en', 'book_isbn', 'book_edition',
        'book_language_code', 'book_total_pages',
        'book_cover_image_url', 'book_description', 'book_file_path',
        'created_at',
    ))
    chapters = list(CollBookChapter.objects.filter(is_active=True).values(
        'mastermind_coll_book_chapter_id', 'link_mastermind_coll_book_id',
        'chapter_number', 'chapter_title_bn', 'chapter_title_en',
        'chapter_page_start', 'chapter_page_end', 'sort_order',
    ))
    topics = list(CollQuizTopic.objects.filter(is_active=True).values(
        'mastermind_coll_quiz_topic_id', 'topic_code',
        'topic_name_bn', 'topic_name_en', 'topic_description', 'topic_icon',
        'sort_order',
    ))

    all_questions = list(CollQuestion.objects.filter(is_active=True))
    questions_payload = []
    if all_questions:
        question_ids = [question.mastermind_coll_question_id for question in all_questions]

        options_by_question_id = {}
        for option in CollQuestionOption.objects.filter(
            link_mastermind_coll_question_id__in=question_ids, is_active=True,
        ):
            options_by_question_id.setdefault(
                option.link_mastermind_coll_question_id, []
            ).append({
                'option_id': option.mastermind_coll_question_option_id,
                'option_label': option.option_label,
                'option_text_bn': option.option_text_bn,
                'option_text_en': option.option_text_en,
                'option_image_url': option.option_image_url,
                'is_correct': option.is_correct,
                'option_explanation_bn': option.option_explanation_bn,
                'sort_order': option.sort_order,
            })

        match_pairs_by_question_id = {}
        for pair in CollQuestionMatchPair.objects.filter(
            link_mastermind_coll_question_id__in=question_ids, is_active=True,
        ).order_by('sort_order'):
            match_pairs_by_question_id.setdefault(
                pair.link_mastermind_coll_question_id, []
            ).append({
                'match_pair_id': pair.mastermind_coll_question_match_pair_id,
                'stem_text_bn': pair.stem_text_bn,
                'stem_text_en': pair.stem_text_en,
                'response_text_bn': pair.response_text_bn,
                'response_text_en': pair.response_text_en,
                'sort_order': pair.sort_order,
            })

        for question in all_questions:
            questions_payload.append(_question_to_dict(
                question,
                options_by_question_id.get(question.mastermind_coll_question_id, []),
                match_pairs_by_question_id.get(question.mastermind_coll_question_id, []),
                reference_caches,
            ))

    quizzes_payload = []
    for quiz in CollQuiz.objects.filter(is_active=True):
        quiz_pool_question_ids = list(MapQuizQuestionPool.objects.filter(
            link_mastermind_coll_quiz_id=quiz.mastermind_coll_quiz_id,
        ).values_list('link_mastermind_coll_question_id', 'is_mandatory'))
        quizzes_payload.append({
            'quiz_id': quiz.mastermind_coll_quiz_id,
            'exam_title_bn': quiz.exam_title_bn,
            'exam_title_en': quiz.exam_title_en,
            'exam_description_bn': quiz.exam_description_bn,
            'exam_slug': quiz.exam_slug,
            'topic_code': reference_caches['topic_codes'].get(quiz.link_mastermind_coll_quiz_topic_id),
            'exam_total_questions': quiz.exam_total_questions,
            'exam_time_limit_minutes': quiz.exam_time_limit_minutes,
            'exam_pass_percentage': float(quiz.exam_pass_percentage),
            'exam_negative_marking_per_wrong': float(quiz.exam_negative_marking_per_wrong or 0),
            'exam_shuffle_questions': quiz.exam_shuffle_questions,
            'exam_shuffle_options': quiz.exam_shuffle_options,
            'exam_show_explanation_code': quiz.exam_show_explanation_code,
            'exam_allow_review': quiz.exam_allow_review,
            'exam_max_attempts': quiz.exam_max_attempts,
            'exam_status_code': quiz.exam_status_code,
            'pool_entries': [
                {'question_id': qid, 'is_mandatory': bool(mandatory)}
                for qid, mandatory in quiz_pool_question_ids
            ],
        })

    return {
        'export_format_version': '1.0',
        'exported_at': timezone.now().isoformat(),
        'counts': {
            'books': len(books),
            'chapters': len(chapters),
            'topics': len(topics),
            'questions': len(questions_payload),
            'quizzes': len(quizzes_payload),
        },
        'topics': topics,
        'books': books,
        'chapters': chapters,
        'questions': questions_payload,
        'quizzes': quizzes_payload,
    }
