"""Mastermind analytics — aggregation queries that feed visual dashboards.

Pure read-only. No DB schema change. Returns plain dicts ready to JSON-
encode and feed into any chart library (Chart.js, Recharts, ECharts, etc).

Public API (used by views_api endpoints):
  per_quiz_score_distribution(quiz_id)         → histogram of score percentages
  per_quiz_pass_rate_over_time(quiz_id, days)  → daily pass/fail counts
  per_quiz_question_difficulty(quiz_id)        → correct-rate per question
  per_user_performance_summary(user_profile_id) → all-time stats per topic
  topic_engagement_overview(days)              → sessions per topic
"""
import logging
from collections import defaultdict
from datetime import timedelta

from django.db.models import Avg, Count, F, Q
from django.utils import timezone

from .models import (
    CollQuestion,
    CollQuiz,
    CollQuizSession,
    CollQuizSessionQuestion,
    CollQuizTopic,
    MapQuizQuestionPool,
)

logger = logging.getLogger(__name__)

DEFAULT_LOOKBACK_DAYS = 30
SCORE_BUCKET_PERCENT = 10  # 10-percent-wide histogram buckets


def per_quiz_score_distribution(quiz_id):
    """Return a histogram of completed-session score percentages for one quiz.

    Buckets: 0-10, 10-20, 20-30, ..., 90-100 (10 buckets).
    """
    if not quiz_id:
        return {'buckets': [], 'session_count': 0}

    completed = (
        CollQuizSession.objects
        .filter(
            link_mastermind_coll_quiz_id=quiz_id,
            session_status_code='completed',
            session_score_percentage__isnull=False,
        )
        .values_list('session_score_percentage', flat=True)
    )
    counts_by_bucket = [0] * (100 // SCORE_BUCKET_PERCENT)
    session_count = 0
    for percentage in completed:
        bucket_index = min(int(float(percentage) // SCORE_BUCKET_PERCENT), len(counts_by_bucket) - 1)
        counts_by_bucket[bucket_index] += 1
        session_count += 1

    buckets = [
        {
            'bucket_label': f'{index * SCORE_BUCKET_PERCENT}-{(index + 1) * SCORE_BUCKET_PERCENT}%',
            'session_count': counts_by_bucket[index],
        }
        for index in range(len(counts_by_bucket))
    ]
    return {'buckets': buckets, 'session_count': session_count}


def per_quiz_pass_rate_over_time(quiz_id, days=DEFAULT_LOOKBACK_DAYS):
    """Daily passed/failed/in-progress counts for one quiz over the last N days."""
    if not quiz_id:
        return {'days': [], 'total_completed': 0}

    cutoff_date = (timezone.now() - timedelta(days=days)).date()
    sessions = (
        CollQuizSession.objects
        .filter(
            link_mastermind_coll_quiz_id=quiz_id,
            created_at__date__gte=cutoff_date,
        )
        .values('created_at', 'session_status_code', 'session_is_passed')
    )

    daily_counts = defaultdict(lambda: {'passed': 0, 'failed': 0, 'in_progress': 0})
    total_completed = 0
    for session in sessions:
        date_key = session['created_at'].date().isoformat()
        if session['session_status_code'] == 'in_progress':
            daily_counts[date_key]['in_progress'] += 1
        elif session['session_is_passed'] is True:
            daily_counts[date_key]['passed'] += 1
            total_completed += 1
        elif session['session_is_passed'] is False:
            daily_counts[date_key]['failed'] += 1
            total_completed += 1

    days_list = [
        {'date': date_key, **counts}
        for date_key, counts in sorted(daily_counts.items())
    ]
    return {'days': days_list, 'total_completed': total_completed}


def per_quiz_question_difficulty(quiz_id):
    """Per-question correct-answer rate for one quiz.

    Returns rows ordered by display_order with: question_id, question_text_bn,
    response_count, correct_count, correct_rate (0-1 float).
    """
    if not quiz_id:
        return {'questions': []}

    pool_question_ids = list(
        MapQuizQuestionPool.objects
        .filter(link_mastermind_coll_quiz_id=quiz_id)
        .order_by('mastermind_map_quiz_question_pool_id')
        .values_list('link_mastermind_coll_question_id', flat=True)
    )
    if not pool_question_ids:
        return {'questions': []}

    questions_by_id = {
        question.mastermind_coll_question_id: question
        for question in CollQuestion.objects.filter(mastermind_coll_question_id__in=pool_question_ids)
    }

    answered = (
        CollQuizSessionQuestion.objects
        .filter(
            link_mastermind_coll_question_id__in=pool_question_ids,
            answered_at__isnull=False,
        )
        .values('link_mastermind_coll_question_id')
        .annotate(
            response_count=Count('mastermind_coll_quiz_session_question_id'),
            correct_count=Count('mastermind_coll_quiz_session_question_id', filter=Q(is_correct=True)),
        )
    )
    stats_by_question_id = {
        row['link_mastermind_coll_question_id']: row for row in answered
    }

    rows = []
    for question_id in pool_question_ids:
        question = questions_by_id.get(question_id)
        if not question:
            continue
        stats = stats_by_question_id.get(question_id, {'response_count': 0, 'correct_count': 0})
        response_count = stats['response_count']
        correct_count = stats['correct_count']
        correct_rate = (correct_count / response_count) if response_count else None
        rows.append({
            'question_id': question_id,
            'question_text_bn': (question.question_text_bn or '')[:140],
            'response_count': response_count,
            'correct_count': correct_count,
            'correct_rate': correct_rate,
        })
    return {'questions': rows}


def per_user_performance_summary(user_profile_id):
    """All-time per-topic stats for one user."""
    if not user_profile_id:
        return {'topics': []}

    sessions = (
        CollQuizSession.objects
        .filter(
            link_user_profile_id=user_profile_id,
            session_status_code='completed',
        )
        .values('link_mastermind_coll_quiz_id', 'session_is_passed', 'session_score_percentage')
    )

    quiz_ids = list({session['link_mastermind_coll_quiz_id'] for session in sessions})
    quiz_topic_map = dict(
        CollQuiz.objects
        .filter(mastermind_coll_quiz_id__in=quiz_ids)
        .values_list('mastermind_coll_quiz_id', 'link_mastermind_coll_quiz_topic_id')
    )

    topic_ids = {topic_id for topic_id in quiz_topic_map.values() if topic_id}
    topic_label_map = dict(
        CollQuizTopic.objects
        .filter(mastermind_coll_quiz_topic_id__in=topic_ids)
        .values_list('mastermind_coll_quiz_topic_id', 'topic_name_bn')
    )

    aggregations_by_topic_id = defaultdict(lambda: {
        'attempt_count': 0, 'pass_count': 0, 'percentage_sum': 0.0,
    })
    for session in sessions:
        quiz_id = session['link_mastermind_coll_quiz_id']
        topic_id = quiz_topic_map.get(quiz_id)
        if topic_id is None:
            continue
        bucket = aggregations_by_topic_id[topic_id]
        bucket['attempt_count'] += 1
        if session['session_is_passed']:
            bucket['pass_count'] += 1
        if session['session_score_percentage'] is not None:
            bucket['percentage_sum'] += float(session['session_score_percentage'])

    topics = []
    for topic_id, bucket in aggregations_by_topic_id.items():
        attempt_count = bucket['attempt_count']
        topics.append({
            'topic_id': topic_id,
            'topic_name_bn': topic_label_map.get(topic_id) or '—',
            'attempt_count': attempt_count,
            'pass_count': bucket['pass_count'],
            'pass_rate': (bucket['pass_count'] / attempt_count) if attempt_count else 0,
            'average_score_percentage': (
                (bucket['percentage_sum'] / attempt_count) if attempt_count else None
            ),
        })
    topics.sort(key=lambda topic: topic['attempt_count'], reverse=True)
    return {'topics': topics}


def topic_engagement_overview(days=DEFAULT_LOOKBACK_DAYS):
    """Sessions started per topic over the last N days."""
    cutoff_date = (timezone.now() - timedelta(days=days)).date()
    rows = (
        CollQuizSession.objects
        .filter(created_at__date__gte=cutoff_date)
        .values('link_mastermind_coll_quiz_id')
        .annotate(session_count=Count('mastermind_coll_quiz_session_id'))
    )
    quiz_ids = [row['link_mastermind_coll_quiz_id'] for row in rows]
    quiz_topic_map = dict(
        CollQuiz.objects
        .filter(mastermind_coll_quiz_id__in=quiz_ids)
        .values_list('mastermind_coll_quiz_id', 'link_mastermind_coll_quiz_topic_id')
    )
    topic_ids = {topic_id for topic_id in quiz_topic_map.values() if topic_id}
    topic_label_map = dict(
        CollQuizTopic.objects
        .filter(mastermind_coll_quiz_topic_id__in=topic_ids)
        .values_list('mastermind_coll_quiz_topic_id', 'topic_name_bn')
    )

    counts_by_topic_id = defaultdict(int)
    for row in rows:
        topic_id = quiz_topic_map.get(row['link_mastermind_coll_quiz_id'])
        if topic_id is None:
            continue
        counts_by_topic_id[topic_id] += row['session_count']

    output = [
        {
            'topic_id': topic_id,
            'topic_name_bn': topic_label_map.get(topic_id) or '—',
            'session_count': count,
        }
        for topic_id, count in counts_by_topic_id.items()
    ]
    output.sort(key=lambda row: row['session_count'], reverse=True)
    return {'lookback_days': days, 'topics': output}
