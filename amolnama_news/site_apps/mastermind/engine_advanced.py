"""Mastermind advanced engine — leaderboard, spaced repetition, retry, readiness, badges, analytics."""

import json
import logging
import math
from datetime import date, timedelta
from decimal import Decimal

from django.db.models import Avg, Count, F, Q, Sum
from django.utils import timezone

from .models import (
    CollQuiz,
    CollQuizSession,
    CollQuizSessionQuestion,
    CollQuestion,
    CollQuestionOption,
    CollStreakFreeze,
    CollUserQuizBadge,
    CollUserCard,
    CollUserStreak,
    EngQuestionOptionAnalytics,
    EngUserQuizTopicMastery,
    RefQuizBadge,
    CollQuizTopic,
)

logger = logging.getLogger(__name__)


# ================================================================
# 1. LEADERBOARD — weekly/all-time per topic, merit ranking
# ================================================================

def get_leaderboard(topic_id=None, period='all_time', limit=50):
    """Get leaderboard — ranked by accuracy then total correct.

    Args:
        topic_id: Filter by topic (None = all topics)
        period: 'weekly', 'monthly', 'all_time'
        limit: Max entries to return

    Returns list of dicts with rank, user_profile_id, accuracy, totals.
    """
    session_filter = {
        'session_status_code': 'completed',
    }

    if topic_id:
        # Get exam IDs for this topic
        exam_ids = list(
            CollQuiz.objects.filter(
                link_mastermind_coll_quiz_topic_id=topic_id,
                is_active=True,
            ).values_list('mastermind_coll_quiz_id', flat=True)
        )
        session_filter['link_mastermind_coll_quiz_id__in'] = exam_ids

    if period == 'weekly':
        week_start = date.today() - timedelta(days=date.today().weekday())
        session_filter['session_completed_at__date__gte'] = week_start
    elif period == 'monthly':
        month_start = date.today().replace(day=1)
        session_filter['session_completed_at__date__gte'] = month_start

    leaderboard_data = list(
        CollQuizSession.objects.filter(**session_filter).values(
            'link_user_profile_id'
        ).annotate(
            total_sessions=Count('mastermind_coll_quiz_session_id'),
            total_correct=Sum('session_total_correct'),
            total_answered=Sum('session_total_answered'),
            average_score_percentage=Avg('session_score_percentage'),
            total_score_raw=Sum('session_score_raw'),
        ).order_by('-average_score_percentage', '-total_correct')[:limit]
    )

    # Add rank
    ranked_entries = []
    for rank, entry in enumerate(leaderboard_data, start=1):
        total_answered = entry['total_answered'] or 0
        total_correct = entry['total_correct'] or 0
        ranked_entries.append({
            'rank': rank,
            'user_profile_id': entry['link_user_profile_id'],
            'total_sessions': entry['total_sessions'],
            'total_correct': total_correct,
            'total_answered': total_answered,
            'accuracy_percentage': float(entry['average_score_percentage'] or 0),
            'total_score_raw': float(entry['total_score_raw'] or 0),
        })

    return ranked_entries


def get_user_rank(user_profile_id, topic_id=None, period='all_time'):
    """Get a specific user's rank on the leaderboard."""
    leaderboard = get_leaderboard(topic_id=topic_id, period=period, limit=10000)
    for entry in leaderboard:
        if entry['user_profile_id'] == user_profile_id:
            return entry
    return {'rank': None, 'message': 'No completed sessions found.'}


# ================================================================
# 2. RETRY WRONG ONLY — quiz from past mistakes
# ================================================================

def get_wrong_answers_for_retry(user_profile_id, topic_id=None, limit=20):
    """Get questions the user answered incorrectly for retry.

    Returns list of question IDs that the user got wrong,
    deduplicated and excluding questions they later got right.
    """
    wrong_filter = {
        'is_correct': False,
        'link_mastermind_coll_quiz_session_id__in': CollQuizSession.objects.filter(
            link_user_profile_id=user_profile_id,
            session_status_code='completed',
        ).values_list('mastermind_coll_quiz_session_id', flat=True),
    }

    wrong_question_ids = set(
        CollQuizSessionQuestion.objects.filter(
            **wrong_filter
        ).values_list('link_mastermind_coll_question_id', flat=True)
    )

    if not wrong_question_ids:
        return {'questions': [], 'total_wrong': 0}

    # Exclude questions they later got correct
    later_correct_ids = set(
        CollQuizSessionQuestion.objects.filter(
            link_mastermind_coll_question_id__in=wrong_question_ids,
            is_correct=True,
            link_mastermind_coll_quiz_session_id__in=CollQuizSession.objects.filter(
                link_user_profile_id=user_profile_id,
                session_status_code='completed',
            ).values_list('mastermind_coll_quiz_session_id', flat=True),
        ).values_list('link_mastermind_coll_question_id', flat=True)
    )

    still_wrong_ids = wrong_question_ids - later_correct_ids

    # Filter by topic if specified
    if topic_id:
        still_wrong_ids = set(
            CollQuestion.objects.filter(
                mastermind_coll_question_id__in=still_wrong_ids,
                link_mastermind_coll_quiz_topic_id=topic_id,
                is_active=True,
            ).values_list('mastermind_coll_question_id', flat=True)
        )

    question_ids = list(still_wrong_ids)[:limit]

    return {
        'question_ids': question_ids,
        'total_wrong': len(still_wrong_ids),
        'showing': len(question_ids),
    }


def create_retry_wrong_exam(user_profile_id, topic_id=None, max_questions=20):
    """Create a temporary exam from the user's wrong answers.

    Returns exam start result (same format as start_exam_session).
    """
    from .engine import start_exam_session

    wrong_data = get_wrong_answers_for_retry(
        user_profile_id, topic_id=topic_id, limit=max_questions
    )
    question_ids = wrong_data.get('question_ids', [])

    if not question_ids:
        return {'error': 'No wrong answers to retry.'}

    # Create a temporary exam
    from amolnama_news.site_apps.core.utils import english_slug_from_text

    topic_name = ''
    if topic_id:
        topic = CollQuizTopic.objects.filter(mastermind_coll_quiz_topic_id=topic_id).first()
        if topic:
            topic_name = f" — {topic.topic_name_bn}"

    exam = CollQuiz.objects.create(
        exam_title_bn=f"ভুল উত্তর পুনরায় চেষ্টা{topic_name}",
        exam_title_en='Retry Wrong Answers',
        exam_slug=english_slug_from_text(text_bn=f"retry-wrong-{user_profile_id}-{date.today().isoformat()}"),
        link_mastermind_coll_quiz_topic_id=topic_id,
        exam_total_questions=len(question_ids),
        exam_pass_percentage=Decimal('60.00'),
        exam_shuffle_questions=True,
        exam_shuffle_options=True,
        exam_show_explanation_code='each_question',
        exam_allow_review=True,
        exam_status_code='published',
        created_at=timezone.now(),
    )

    # Add wrong questions to pool
    from .models import MapQuizQuestionPool
    for question_id in question_ids:
        MapQuizQuestionPool.objects.create(
            link_mastermind_coll_quiz_id=exam.mastermind_coll_quiz_id,
            link_mastermind_coll_question_id=question_id,
            is_mandatory=True,
            created_at=timezone.now(),
        )

    return start_exam_session(exam.mastermind_coll_quiz_id, user_profile_id)


# ================================================================
# 3. SPACED REPETITION — Anki SM-2 algorithm
# ================================================================

def get_due_cards(user_profile_id, topic_id=None, limit=20):
    """Get cards due for review (spaced repetition).

    Returns questions whose next_review_at <= now.
    """
    card_filter = {
        'link_user_profile_id': user_profile_id,
        'card_next_review_at__lte': timezone.now(),
        'is_active': True,
    }

    if topic_id:
        # Get question IDs for this topic
        topic_question_ids = list(
            CollQuestion.objects.filter(
                link_mastermind_coll_quiz_topic_id=topic_id,
                is_active=True,
            ).values_list('mastermind_coll_question_id', flat=True)
        )
        card_filter['link_mastermind_coll_question_id__in'] = topic_question_ids

    due_cards = list(
        CollUserCard.objects.filter(**card_filter).order_by(
            'card_next_review_at'
        )[:limit].values(
            'mastermind_coll_user_card_id',
            'link_mastermind_coll_question_id',
            'card_ease_factor',
            'card_interval_days',
            'card_repetition_count',
            'card_times_correct',
            'card_times_wrong',
        )
    )

    return {
        'due_count': CollUserCard.objects.filter(**card_filter).count(),
        'cards': due_cards,
    }


def review_card(user_profile_id, card_id, quality_rating):
    """Review a spaced repetition card using SM-2 algorithm.

    Args:
        quality_rating: 0-5 scale (Anki convention)
            0 = complete blackout
            1 = wrong, remembered after seeing answer
            2 = wrong, but answer seemed easy
            3 = correct with serious difficulty
            4 = correct after hesitation
            5 = perfect, instant recall
    """
    try:
        card = CollUserCard.objects.get(
            mastermind_coll_user_card_id=card_id,
            link_user_profile_id=user_profile_id,
            is_active=True,
        )
    except CollUserCard.DoesNotExist:
        return {'error': 'Card not found.'}

    if quality_rating < 0 or quality_rating > 5:
        return {'error': 'quality_rating must be 0-5.'}

    now = timezone.now()
    ease_factor = float(card.card_ease_factor)
    interval = card.card_interval_days
    repetition = card.card_repetition_count

    # SM-2 algorithm
    if quality_rating >= 3:
        # Correct answer
        if repetition == 0:
            interval = 1
        elif repetition == 1:
            interval = 6
        else:
            interval = math.ceil(interval * ease_factor)

        repetition += 1
        card.card_times_correct += 1
    else:
        # Wrong answer — reset
        repetition = 0
        interval = 1
        card.card_times_wrong += 1

    # Update ease factor (never below 1.3)
    ease_factor = ease_factor + (0.1 - (5 - quality_rating) * (0.08 + (5 - quality_rating) * 0.02))
    if ease_factor < 1.3:
        ease_factor = 1.3

    card.card_ease_factor = Decimal(str(round(ease_factor, 2)))
    card.card_interval_days = interval
    card.card_repetition_count = repetition
    card.card_next_review_at = now + timedelta(days=interval)
    card.card_last_review_at = now
    card.updated_at = now
    card.save()

    return {
        'card_id': card.mastermind_coll_user_card_id,
        'next_review_at': card.card_next_review_at.isoformat(),
        'interval_days': interval,
        'ease_factor': float(card.card_ease_factor),
        'repetition_count': repetition,
        'is_correct': quality_rating >= 3,
    }


def create_cards_from_session(user_profile_id, session_id):
    """After completing an exam, create SRS cards for wrong answers.

    Correct answers also get cards but with longer initial intervals.
    """
    session_questions = list(
        CollQuizSessionQuestion.objects.filter(
            link_mastermind_coll_quiz_session_id=session_id,
            is_correct__isnull=False,
        ).values('link_mastermind_coll_question_id', 'is_correct')
    )

    cards_created = 0
    for session_question in session_questions:
        question_id = session_question['link_mastermind_coll_question_id']
        is_correct = session_question['is_correct']

        card, created = CollUserCard.objects.get_or_create(
            link_user_profile_id=user_profile_id,
            link_mastermind_coll_question_id=question_id,
            defaults={
                'card_interval_days': 6 if is_correct else 1,
                'card_next_review_at': timezone.now() + timedelta(days=6 if is_correct else 1),
                'card_times_correct': 1 if is_correct else 0,
                'card_times_wrong': 0 if is_correct else 1,
                'created_at': timezone.now(),
            }
        )

        if not created and not is_correct:
            # Reset card on wrong answer
            card.card_interval_days = 1
            card.card_repetition_count = 0
            card.card_next_review_at = timezone.now() + timedelta(days=1)
            card.card_times_wrong += 1
            card.updated_at = timezone.now()
            card.save()

        if created:
            cards_created += 1

    return {'cards_created': cards_created, 'total_processed': len(session_questions)}


# ================================================================
# 4. READINESS GAUGE — confidence score per topic (DVSA pattern)
# ================================================================

def get_readiness_gauge(user_profile_id, topic_id):
    """Calculate readiness score for a topic.

    Factors:
    - Accuracy percentage (40% weight)
    - Question coverage — % of topic questions attempted (30% weight)
    - Consistency — recent streak activity (15% weight)
    - Recency — days since last practice (15% weight)

    Returns dict with readiness_score (0-100), level, breakdown.
    """
    # Get mastery data
    mastery = EngUserQuizTopicMastery.objects.filter(
        link_user_profile_id=user_profile_id,
        link_mastermind_coll_quiz_topic_id=topic_id,
    ).first()

    if not mastery or mastery.total_questions_attempted == 0:
        return {
            'readiness_score': 0,
            'readiness_level': 'not_started',
            'readiness_label_bn': 'শুরু করুন',
            'readiness_label_en': 'Get Started',
            'breakdown': {
                'accuracy': 0,
                'coverage': 0,
                'consistency': 0,
                'recency': 0,
            },
        }

    # 1. Accuracy (0-100)
    accuracy_score = float(mastery.accuracy_percentage or 0)

    # 2. Coverage — what % of available questions has user attempted?
    total_topic_questions = CollQuestion.objects.filter(
        link_mastermind_coll_quiz_topic_id=topic_id,
        question_status_code='published',
        is_active=True,
    ).count()

    if total_topic_questions > 0:
        coverage_score = min(100, (mastery.total_questions_attempted / total_topic_questions) * 100)
    else:
        coverage_score = 0

    # 3. Consistency — streak days in last 14 days
    two_weeks_ago = date.today() - timedelta(days=14)
    recent_streak_days = CollUserStreak.objects.filter(
        link_user_profile_id=user_profile_id,
        streak_date__gte=two_weeks_ago,
    ).count()
    consistency_score = min(100, (recent_streak_days / 14) * 100)

    # 4. Recency — days since last practice (0 = today = 100, 30+ = 0)
    if mastery.last_practiced_at:
        days_since = (timezone.now() - mastery.last_practiced_at).days
        recency_score = max(0, 100 - (days_since * 3.33))  # 0 after 30 days
    else:
        recency_score = 0

    # Weighted combination
    readiness_score = (
        accuracy_score * 0.40
        + coverage_score * 0.30
        + consistency_score * 0.15
        + recency_score * 0.15
    )
    readiness_score = round(readiness_score, 1)

    # Determine level
    if readiness_score >= 85:
        readiness_level = 'ready'
        label_bn = 'প্রস্তুত'
        label_en = 'Ready'
    elif readiness_score >= 65:
        readiness_level = 'almost_ready'
        label_bn = 'প্রায় প্রস্তুত'
        label_en = 'Almost Ready'
    elif readiness_score >= 40:
        readiness_level = 'needs_practice'
        label_bn = 'আরো অনুশীলন করুন'
        label_en = 'Needs Practice'
    else:
        readiness_level = 'not_ready'
        label_bn = 'প্রস্তুত নন'
        label_en = 'Not Ready'

    return {
        'readiness_score': readiness_score,
        'readiness_level': readiness_level,
        'readiness_label_bn': label_bn,
        'readiness_label_en': label_en,
        'breakdown': {
            'accuracy': round(accuracy_score, 1),
            'coverage': round(coverage_score, 1),
            'consistency': round(consistency_score, 1),
            'recency': round(recency_score, 1),
        },
    }


# ================================================================
# 5. BADGE AUTO-EVALUATION — process criteria_json, award automatically
# ================================================================

def evaluate_and_award_badges(user_profile_id):
    """Check all badge criteria and award any newly earned badges.

    criteria_json format examples:
        {"type": "first_quiz"}
        {"type": "perfect_score"}
        {"type": "streak", "days": 7}
        {"type": "streak", "days": 30}
        {"type": "accuracy", "min_percentage": 90, "min_sessions": 10}
        {"type": "book_complete", "min_percentage": 80}
        {"type": "speed", "max_seconds_per_question": 10, "min_questions": 20}

    Returns list of newly awarded badge codes.
    """
    # Get already earned badges
    earned_codes = set(
        CollUserQuizBadge.objects.filter(
            link_user_profile_id=user_profile_id,
            is_active=True,
        ).values_list('link_mastermind_ref_quiz_badge_id', flat=True)
    )

    # Get all active badges
    all_badges = list(
        RefQuizBadge.objects.filter(is_active=True)
    )

    newly_awarded = []

    for badge in all_badges:
        # Skip already earned
        if badge.mastermind_ref_quiz_badge_id in earned_codes:
            continue

        criteria = _parse_badge_criteria(badge)
        if not criteria:
            continue

        earned = _check_badge_criteria(user_profile_id, criteria)
        if earned:
            CollUserQuizBadge.objects.create(
                link_user_profile_id=user_profile_id,
                link_mastermind_ref_quiz_badge_id=badge.mastermind_ref_quiz_badge_id,
                earned_at=timezone.now(),
            )
            newly_awarded.append({
                'badge_code': badge.badge_code,
                'badge_name_bn': badge.badge_name_bn,
                'badge_icon': badge.badge_icon,
            })

    return newly_awarded


def _parse_badge_criteria(badge):
    """Parse badge criteria_json safely."""
    if not badge.badge_criteria_json:
        # Fall back to code-based matching
        return {'type': badge.badge_code}
    try:
        return json.loads(badge.badge_criteria_json)
    except (json.JSONDecodeError, TypeError):
        return {'type': badge.badge_code}


def _check_badge_criteria(user_profile_id, criteria):
    """Check if a user meets the badge criteria."""
    criteria_type = criteria.get('type', '')

    if criteria_type == 'first_quiz':
        return CollQuizSession.objects.filter(
            link_user_profile_id=user_profile_id,
            session_status_code='completed',
        ).exists()

    elif criteria_type == 'perfect_score':
        return CollQuizSession.objects.filter(
            link_user_profile_id=user_profile_id,
            session_status_code='completed',
            session_score_percentage=Decimal('100.00'),
        ).exists()

    elif criteria_type == 'streak':
        required_days = criteria.get('days', 7)
        from .engine import get_user_streak_count
        return get_user_streak_count(user_profile_id) >= required_days

    elif criteria_type in ('streak_7', 'streak_30'):
        required_days = 7 if criteria_type == 'streak_7' else 30
        from .engine import get_user_streak_count
        return get_user_streak_count(user_profile_id) >= required_days

    elif criteria_type in ('accuracy', 'accuracy_90'):
        min_percentage = criteria.get('min_percentage', 90)
        min_sessions = criteria.get('min_sessions', 10)
        completed_sessions = CollQuizSession.objects.filter(
            link_user_profile_id=user_profile_id,
            session_status_code='completed',
        )
        if completed_sessions.count() < min_sessions:
            return False
        average_accuracy = completed_sessions.aggregate(
            average=Avg('session_score_percentage')
        )['average']
        return average_accuracy is not None and average_accuracy >= min_percentage

    elif criteria_type in ('book_complete', 'chapter_master'):
        # User has completed 80%+ of questions from at least one book/chapter
        min_percentage = criteria.get('min_percentage', 80)
        mastery_entries = EngUserQuizTopicMastery.objects.filter(
            link_user_profile_id=user_profile_id,
            accuracy_percentage__gte=min_percentage,
            total_questions_attempted__gte=20,
        )
        return mastery_entries.exists()

    elif criteria_type in ('speed', 'speed_demon'):
        max_seconds = criteria.get('max_seconds_per_question', 10)
        min_questions = criteria.get('min_questions', 20)
        fast_answers = CollQuizSessionQuestion.objects.filter(
            link_mastermind_coll_quiz_session_id__in=CollQuizSession.objects.filter(
                link_user_profile_id=user_profile_id,
                session_status_code='completed',
            ).values_list('mastermind_coll_quiz_session_id', flat=True),
            is_correct=True,
            time_spent_seconds__lte=max_seconds,
            time_spent_seconds__isnull=False,
        ).count()
        return fast_answers >= min_questions

    return False


# ================================================================
# 6. STREAK FREEZE — skip 1 day without breaking streak
# ================================================================

def get_streak_with_freeze(user_profile_id):
    """Calculate streak count considering freeze days.

    A streak freeze fills a gap of 1 day. Max 1 freeze per gap.
    """
    streak_dates = set(
        CollUserStreak.objects.filter(
            link_user_profile_id=user_profile_id,
        ).order_by('-streak_date').values_list('streak_date', flat=True)[:365]
    )

    if not streak_dates:
        return {'streak_count': 0, 'freeze_available': _count_available_freezes(user_profile_id)}

    # Get available (unused) freezes
    available_freezes = list(
        CollStreakFreeze.objects.filter(
            link_user_profile_id=user_profile_id,
            is_used=False,
        ).order_by('-created_at').values_list(
            'mastermind_coll_streak_freeze_id', flat=True
        )
    )

    today = date.today()
    current_date = today
    count = 0
    freezes_used = 0

    # Walk backwards from today
    while True:
        if current_date in streak_dates:
            count += 1
            current_date -= timedelta(days=1)
        elif available_freezes and freezes_used < len(available_freezes):
            # Use a freeze for this gap
            freeze_id = available_freezes[freezes_used]
            CollStreakFreeze.objects.filter(
                mastermind_coll_streak_freeze_id=freeze_id
            ).update(is_used=True, freeze_date=current_date)
            freezes_used += 1
            count += 1
            current_date -= timedelta(days=1)
        elif current_date == today:
            # Today hasn't been played yet — that's OK, check yesterday
            current_date -= timedelta(days=1)
        else:
            break

    return {
        'streak_count': count,
        'freezes_used': freezes_used,
        'freeze_available': len(available_freezes) - freezes_used,
    }


def _count_available_freezes(user_profile_id):
    """Count unused streak freezes."""
    return CollStreakFreeze.objects.filter(
        link_user_profile_id=user_profile_id,
        is_used=False,
    ).count()


def award_streak_freeze(user_profile_id, source_code='earned'):
    """Award a streak freeze to a user (e.g., for perfect score)."""
    freeze = CollStreakFreeze.objects.create(
        link_user_profile_id=user_profile_id,
        freeze_date=date.today(),
        freeze_source_code=source_code,
        created_at=timezone.now(),
    )
    return {
        'freeze_id': freeze.mastermind_coll_streak_freeze_id,
        'freeze_available': _count_available_freezes(user_profile_id),
    }


# ================================================================
# 7. QUESTION ANALYTICS — per-option selection %, distractor analysis
# ================================================================

def update_question_analytics(session_id):
    """Update analytics for all questions in a completed session.

    Tracks how many times each option was selected and whether correctly.
    """
    session_questions = list(
        CollQuizSessionQuestion.objects.filter(
            link_mastermind_coll_quiz_session_id=session_id,
            answered_at__isnull=False,
        ).values(
            'link_mastermind_coll_question_id',
            'link_selected_option_id',
            'is_correct',
        )
    )

    now = timezone.now()
    for session_question in session_questions:
        question_id = session_question['link_mastermind_coll_question_id']
        selected_option_id = session_question['link_selected_option_id']
        is_correct = session_question['is_correct']

        if not selected_option_id:
            continue

        analytics, created = EngQuestionOptionAnalytics.objects.get_or_create(
            link_mastermind_coll_question_id=question_id,
            link_mastermind_coll_question_option_id=selected_option_id,
            defaults={
                'times_selected': 1,
                'times_selected_correctly': 1 if is_correct else 0,
                'updated_at': now,
            }
        )
        if not created:
            analytics.times_selected += 1
            if is_correct:
                analytics.times_selected_correctly += 1
            analytics.updated_at = now
            analytics.save()

        # Update question-level correct_answer_rate
        _update_question_correct_rate(question_id)


def _update_question_correct_rate(question_id):
    """Recompute cached correct_answer_rate on coll_question."""
    total_analytics = EngQuestionOptionAnalytics.objects.filter(
        link_mastermind_coll_question_id=question_id,
    ).aggregate(
        total_selected=Sum('times_selected'),
        total_correct=Sum('times_selected_correctly'),
    )
    total_selected = total_analytics['total_selected'] or 0
    total_correct = total_analytics['total_correct'] or 0

    if total_selected > 0:
        rate = Decimal(str(round((total_correct / total_selected) * 100, 2)))
        CollQuestion.objects.filter(
            mastermind_coll_question_id=question_id
        ).update(
            correct_answer_rate=rate,
            usage_count=total_selected,
        )


def get_question_analytics(question_id):
    """Get distractor analysis for a question.

    Shows how often each option is selected — useful for identifying
    too-easy distractors (never selected) or misleading options (selected often).
    """
    options = list(
        CollQuestionOption.objects.filter(
            link_mastermind_coll_question_id=question_id,
            is_active=True,
        ).values(
            'mastermind_coll_question_option_id',
            'option_label',
            'option_text_bn',
            'is_correct',
        )
    )

    analytics = {
        analytics_row['link_mastermind_coll_question_option_id']: analytics_row
        for analytics_row in EngQuestionOptionAnalytics.objects.filter(
            link_mastermind_coll_question_id=question_id,
        ).values(
            'link_mastermind_coll_question_option_id',
            'times_selected',
            'times_selected_correctly',
        )
    }

    total_responses = sum(
        analytics_entry.get('times_selected', 0) for analytics_entry in analytics.values()
    )

    option_analysis = []
    for option in options:
        option_id = option['mastermind_coll_question_option_id']
        analytics_data = analytics.get(option_id, {})
        times_selected = analytics_data.get('times_selected', 0)
        selection_percentage = (
            round((times_selected / total_responses) * 100, 1)
            if total_responses > 0 else 0
        )

        option_analysis.append({
            'option_id': option_id,
            'option_label': option['option_label'],
            'option_text_bn': option['option_text_bn'],
            'is_correct': option['is_correct'],
            'times_selected': times_selected,
            'selection_percentage': selection_percentage,
            'is_weak_distractor': not option['is_correct'] and selection_percentage < 5,
            'is_misleading': not option['is_correct'] and selection_percentage > 40,
        })

    question = CollQuestion.objects.filter(
        mastermind_coll_question_id=question_id
    ).values('correct_answer_rate', 'usage_count').first()

    return {
        'question_id': question_id,
        'total_responses': total_responses,
        'correct_answer_rate': float(question['correct_answer_rate'] or 0) if question else 0,
        'usage_count': question['usage_count'] if question else 0,
        'options': option_analysis,
    }


# ================================================================
# 8. TIMED EXAM AUTO-EXPIRY
# ================================================================

def check_and_expire_timed_sessions(user_profile_id):
    """Auto-complete any in-progress sessions that have exceeded their time limit.

    Called before starting a new session or loading user stats.
    Returns list of expired session IDs.
    """
    in_progress_sessions = list(
        CollQuizSession.objects.filter(
            link_user_profile_id=user_profile_id,
            session_status_code='in_progress',
        ).values(
            'mastermind_coll_quiz_session_id',
            'link_mastermind_coll_quiz_id',
            'session_started_at',
        )
    )

    expired_session_ids = []
    now = timezone.now()

    for session_data in in_progress_sessions:
        exam = CollQuiz.objects.filter(
            mastermind_coll_quiz_id=session_data['link_mastermind_coll_quiz_id']
        ).values('exam_time_limit_minutes').first()

        if not exam or not exam['exam_time_limit_minutes']:
            continue

        elapsed_seconds = (now - session_data['session_started_at']).total_seconds()
        allowed_seconds = exam['exam_time_limit_minutes'] * 60

        if elapsed_seconds > allowed_seconds:
            session_id = session_data['mastermind_coll_quiz_session_id']
            # Auto-complete via the main engine
            from .engine import complete_exam_session
            result = complete_exam_session(session_id, user_profile_id)
            if 'error' not in result:
                # Override status to timed_out
                CollQuizSession.objects.filter(
                    mastermind_coll_quiz_session_id=session_id
                ).update(session_status_code='timed_out')
                expired_session_ids.append(session_id)

    return expired_session_ids


# ================================================================
# 9. ADAPTIVE QUIZ — dynamic difficulty based on live performance
# ================================================================

def get_adaptive_next_question(session_id, user_profile_id):
    """For adaptive mode exams, pick the next question based on current performance.

    Logic:
    - If user got last 3 correct → increase difficulty
    - If user got last 3 wrong → decrease difficulty
    - Otherwise → same difficulty

    Returns question_id or None if all questions answered.
    """
    session_questions = list(
        CollQuizSessionQuestion.objects.filter(
            link_mastermind_coll_quiz_session_id=session_id,
        ).order_by('question_display_order').values(
            'link_mastermind_coll_question_id',
            'is_correct',
            'answered_at',
        )
    )

    answered = [session_question for session_question in session_questions if session_question['answered_at'] is not None]
    unanswered_ids = [
        session_question['link_mastermind_coll_question_id']
        for session_question in session_questions
        if session_question['answered_at'] is None
    ]

    if not unanswered_ids:
        return None

    # Determine target difficulty based on recent performance
    recent_results = [session_question['is_correct'] for session_question in answered[-3:]]

    if len(recent_results) >= 3 and all(recent_results):
        # 3 correct in a row → harder
        target_shift = 1
    elif len(recent_results) >= 3 and not any(recent_results):
        # 3 wrong in a row → easier
        target_shift = -1
    else:
        target_shift = 0

    # Get difficulty levels of unanswered questions
    unanswered_questions = list(
        CollQuestion.objects.filter(
            mastermind_coll_question_id__in=unanswered_ids,
        ).values(
            'mastermind_coll_question_id',
            'link_mastermind_ref_quiz_difficulty_level_id',
        )
    )

    if not unanswered_questions:
        return None

    # Get current difficulty (from last answered question)
    current_difficulty_id = None
    if answered:
        last_question = CollQuestion.objects.filter(
            mastermind_coll_question_id=answered[-1]['link_mastermind_coll_question_id']
        ).values('link_mastermind_ref_quiz_difficulty_level_id').first()
        if last_question:
            current_difficulty_id = last_question['link_mastermind_ref_quiz_difficulty_level_id']

    # Get difficulty hierarchy
    from .models import RefQuizDifficultyLevel
    difficulty_order = list(
        RefQuizDifficultyLevel.objects.filter(is_active=True).order_by('sort_order').values_list(
            'mastermind_ref_quiz_difficulty_level_id', flat=True
        )
    )

    if current_difficulty_id and current_difficulty_id in difficulty_order:
        current_index = difficulty_order.index(current_difficulty_id)
        target_index = max(0, min(len(difficulty_order) - 1, current_index + target_shift))
        target_difficulty_id = difficulty_order[target_index]
    else:
        target_difficulty_id = difficulty_order[0] if difficulty_order else None

    # Find best matching question
    best_match = None
    for question in unanswered_questions:
        if question['link_mastermind_ref_quiz_difficulty_level_id'] == target_difficulty_id:
            best_match = question['mastermind_coll_question_id']
            break

    # Fallback: just pick first unanswered
    if best_match is None:
        best_match = unanswered_questions[0]['mastermind_coll_question_id']

    return best_match


# ================================================================
# 10. DIFFICULTY AUTO-CALIBRATION
# ================================================================

def auto_calibrate_question_difficulty(minimum_responses=20):
    """Re-calibrate difficulty levels based on actual correct_answer_rate.

    Questions with high correct rate → easier difficulty.
    Questions with low correct rate → harder difficulty.

    Only touches questions with enough response data.
    """
    from .models import RefQuizDifficultyLevel

    difficulty_levels = list(
        RefQuizDifficultyLevel.objects.filter(is_active=True).order_by('sort_order')
    )
    if len(difficulty_levels) < 2:
        return {'calibrated': 0}

    # Map rate ranges to difficulty
    # 80%+ correct → easy, 60-80% → medium, 40-60% → hard, <40% → expert
    rate_boundaries = [
        (80, difficulty_levels[0].mastermind_ref_quiz_difficulty_level_id),  # easy
        (60, difficulty_levels[1].mastermind_ref_quiz_difficulty_level_id if len(difficulty_levels) > 1 else difficulty_levels[0].mastermind_ref_quiz_difficulty_level_id),  # medium
        (40, difficulty_levels[2].mastermind_ref_quiz_difficulty_level_id if len(difficulty_levels) > 2 else difficulty_levels[1].mastermind_ref_quiz_difficulty_level_id),  # hard
        (0, difficulty_levels[3].mastermind_ref_quiz_difficulty_level_id if len(difficulty_levels) > 3 else difficulty_levels[-1].mastermind_ref_quiz_difficulty_level_id),  # expert
    ]

    questions = list(
        CollQuestion.objects.filter(
            usage_count__gte=minimum_responses,
            correct_answer_rate__isnull=False,
            is_active=True,
        ).values(
            'mastermind_coll_question_id',
            'correct_answer_rate',
            'link_mastermind_ref_quiz_difficulty_level_id',
        )
    )

    calibrated_count = 0
    for question in questions:
        rate = float(question['correct_answer_rate'])
        suggested_difficulty_id = rate_boundaries[-1][1]
        for boundary_rate, difficulty_id in rate_boundaries:
            if rate >= boundary_rate:
                suggested_difficulty_id = difficulty_id
                break

        if suggested_difficulty_id != question['link_mastermind_ref_quiz_difficulty_level_id']:
            CollQuestion.objects.filter(
                mastermind_coll_question_id=question['mastermind_coll_question_id']
            ).update(
                link_mastermind_ref_quiz_difficulty_level_id=suggested_difficulty_id,
                updated_at=timezone.now(),
            )
            calibrated_count += 1

    return {'calibrated': calibrated_count, 'total_evaluated': len(questions)}


# ================================================================
# 11. QUESTION REPORT/FLAG
# ================================================================

def report_question(user_profile_id, question_id, reason_code, description=None):
    """Report a bad question (wrong answer, unclear, wrong source, etc.)."""
    from .models import CollQuestionReport

    valid_reasons = (
        'wrong_answer', 'unclear_question', 'wrong_source',
        'duplicate', 'offensive', 'other',
    )
    if reason_code not in valid_reasons:
        return {'error': f'Invalid reason_code. Valid: {", ".join(valid_reasons)}'}

    # Check if already reported by this user
    existing = CollQuestionReport.objects.filter(
        link_mastermind_coll_question_id=question_id,
        link_user_profile_id=user_profile_id,
        report_status_code='pending',
        is_active=True,
    ).exists()
    if existing:
        return {'error': 'You have already reported this question.'}

    report = CollQuestionReport.objects.create(
        link_mastermind_coll_question_id=question_id,
        link_user_profile_id=user_profile_id,
        report_reason_code=reason_code,
        report_description=description or None,
        created_at=timezone.now(),
    )

    # Auto-archive question if 3+ pending reports
    pending_count = CollQuestionReport.objects.filter(
        link_mastermind_coll_question_id=question_id,
        report_status_code='pending',
        is_active=True,
    ).count()
    auto_archived = False
    if pending_count >= 3:
        CollQuestion.objects.filter(
            mastermind_coll_question_id=question_id
        ).update(question_status_code='archived', updated_at=timezone.now())
        auto_archived = True

    return {
        'report_id': report.mastermind_coll_question_report_id,
        'pending_reports': pending_count,
        'auto_archived': auto_archived,
    }


# ================================================================
# 12. BULK QUESTION IMPORT — CSV/JSON
# ================================================================

def bulk_import_questions(questions_data, topic_id, book_id=None, chapter_id=None,
                          user_profile_id=None):
    """Import questions from a structured list (CSV/JSON parsed upstream).

    Each entry in questions_data:
    {
        'question_text_bn': str (required),
        'question_text_en': str (optional),
        'question_type_code': str (default 'mcq_single'),
        'difficulty_code': str (default 'medium'),
        'explanation_bn': str (optional),
        'source_page_number': int (optional),
        'source_snippet_text': str (optional),
        'options': [
            {'text_bn': str, 'is_correct': bool},
            ...
        ]
    }

    Returns summary dict.
    """
    from .models import RefQuizDifficultyLevel, RefQuizQuestionType

    # Cache lookups
    question_type_map = {
        question_type.question_type_code: question_type.mastermind_ref_quiz_question_type_id
        for question_type in RefQuizQuestionType.objects.filter(is_active=True)
    }
    difficulty_map = {
        difficulty.difficulty_code: difficulty.mastermind_ref_quiz_difficulty_level_id
        for difficulty in RefQuizDifficultyLevel.objects.filter(is_active=True)
    }

    created_count = 0
    skipped_count = 0
    errors = []

    for index, entry in enumerate(questions_data):
        question_text_bn = (entry.get('question_text_bn') or '').strip()
        if not question_text_bn:
            skipped_count += 1
            errors.append(f"Row {index + 1}: missing question_text_bn")
            continue

        question_type_code = entry.get('question_type_code', 'mcq_single')
        difficulty_code = entry.get('difficulty_code', 'medium')

        question_type_id = question_type_map.get(question_type_code)
        difficulty_id = difficulty_map.get(difficulty_code)

        if not question_type_id:
            skipped_count += 1
            errors.append(f"Row {index + 1}: unknown question_type_code '{question_type_code}'")
            continue
        if not difficulty_id:
            skipped_count += 1
            errors.append(f"Row {index + 1}: unknown difficulty_code '{difficulty_code}'")
            continue

        options_data = entry.get('options', [])
        if question_type_code in ('mcq_single', 'mcq_multi', 'true_false') and len(options_data) < 2:
            skipped_count += 1
            errors.append(f"Row {index + 1}: need at least 2 options")
            continue

        question = CollQuestion.objects.create(
            link_mastermind_ref_quiz_question_type_id=question_type_id,
            link_mastermind_ref_quiz_difficulty_level_id=difficulty_id,
            link_mastermind_coll_quiz_topic_id=topic_id,
            question_text_bn=question_text_bn,
            question_text_en=(entry.get('question_text_en') or '').strip() or None,
            question_explanation_bn=(entry.get('explanation_bn') or '').strip() or None,
            question_points=entry.get('question_points', 1),
            link_mastermind_coll_book_id=book_id,
            link_mastermind_coll_book_chapter_id=chapter_id,
            source_page_number=entry.get('source_page_number'),
            source_snippet_text=(entry.get('source_snippet_text') or '').strip() or None,
            link_created_by_user_profile_id=user_profile_id,
            question_generation_source_code='imported',
            question_status_code='published',
            created_at=timezone.now(),
        )

        for option_index, option_entry in enumerate(options_data):
            option_text_bn = (option_entry.get('text_bn') or '').strip()
            if not option_text_bn:
                continue
            label = chr(ord('a') + option_index)
            CollQuestionOption.objects.create(
                link_mastermind_coll_question_id=question.mastermind_coll_question_id,
                option_label=label,
                option_text_bn=option_text_bn,
                option_text_en=(option_entry.get('text_en') or '').strip() or None,
                is_correct=option_entry.get('is_correct', False),
                sort_order=option_index,
                created_at=timezone.now(),
            )

        created_count += 1

    return {
        'created': created_count,
        'skipped': skipped_count,
        'total': len(questions_data),
        'errors': errors[:20],  # Cap error list
    }


# ================================================================
# 13. PRACTICE MODE vs EXAM MODE
# ================================================================

def start_practice_session(topic_id, user_profile_id, question_count=10):
    """Start an untimed practice session with instant feedback.

    Practice mode:
    - No time limit
    - Show explanation after each question
    - No negative marking
    - Unlimited attempts
    - Doesn't count toward leaderboard
    """
    from amolnama_news.site_apps.core.utils import english_slug_from_text

    topic = CollQuizTopic.objects.filter(
        mastermind_coll_quiz_topic_id=topic_id, is_active=True
    ).first()
    if not topic:
        return {'error': 'Topic not found.'}

    # Create a practice exam
    practice_exam = CollQuiz.objects.create(
        exam_title_bn=f"অনুশীলন — {topic.topic_name_bn}",
        exam_title_en=f"Practice — {topic.topic_name_en or topic.topic_code}",
        exam_slug=english_slug_from_text(
            text_en=f"practice-{topic.topic_code}-{user_profile_id}-{timezone.now().strftime('%Y%m%d%H%M%S')}"
        ),
        link_mastermind_coll_quiz_topic_id=topic_id,
        exam_total_questions=question_count,
        exam_time_limit_minutes=None,  # Untimed
        exam_pass_percentage=Decimal('0'),  # No pass/fail
        exam_negative_marking_per_wrong=Decimal('0'),
        exam_shuffle_questions=True,
        exam_shuffle_options=True,
        exam_show_explanation_code='each_question',
        exam_allow_review=True,
        exam_max_attempts=None,  # Unlimited
        exam_status_code='published',
        created_at=timezone.now(),
    )

    from .engine import start_exam_session
    return start_exam_session(practice_exam.mastermind_coll_quiz_id, user_profile_id)


# ================================================================
# 14. EXAM ATTEMPT HISTORY
# ================================================================

def get_exam_attempt_history(user_profile_id, exam_id=None, limit=20):
    """Get user's attempt history — optionally filtered by exam.

    Returns list of attempts with score comparison across tries.
    """
    attempt_filter = {
        'link_user_profile_id': user_profile_id,
        'session_status_code__in': ['completed', 'timed_out'],
    }
    if exam_id:
        attempt_filter['link_mastermind_coll_quiz_id'] = exam_id

    attempts = list(
        CollQuizSession.objects.filter(**attempt_filter).order_by(
            '-session_completed_at'
        )[:limit].values(
            'mastermind_coll_quiz_session_id',
            'link_mastermind_coll_quiz_id',
            'session_score_percentage',
            'session_total_correct',
            'session_total_wrong',
            'session_total_skipped',
            'session_is_passed',
            'session_time_taken_seconds',
            'session_attempt_number',
            'session_status_code',
            'session_completed_at',
        )
    )

    # Calculate improvement trend
    if len(attempts) >= 2:
        latest_score = float(attempts[0]['session_score_percentage'] or 0)
        previous_score = float(attempts[1]['session_score_percentage'] or 0)
        improvement = round(latest_score - previous_score, 1)
    else:
        improvement = None

    # Best score
    best_score = 0
    for attempt in attempts:
        score = float(attempt['session_score_percentage'] or 0)
        if score > best_score:
            best_score = score

    return {
        'attempts': attempts,
        'total_attempts': len(attempts),
        'best_score': best_score,
        'improvement_from_last': improvement,
    }


# ================================================================
# POST-SESSION HOOK — call after every session completion
# ================================================================

def post_session_processing(user_profile_id, session_id):
    """Run all post-session processing in one call.

    Called after complete_exam_session(). Handles:
    - Create SRS cards from answers
    - Update question analytics
    - Evaluate and award badges
    - Award streak freeze for perfect score
    """
    # 1. Create SRS cards
    cards_result = create_cards_from_session(user_profile_id, session_id)

    # 2. Update question analytics
    update_question_analytics(session_id)

    # 3. Evaluate badges
    new_badges = evaluate_and_award_badges(user_profile_id)

    # 4. Award streak freeze for perfect score
    session = CollQuizSession.objects.filter(
        mastermind_coll_quiz_session_id=session_id,
    ).values('session_score_percentage').first()

    freeze_awarded = False
    if session and session['session_score_percentage'] == Decimal('100.00'):
        award_streak_freeze(user_profile_id, source_code='earned')
        freeze_awarded = True

    return {
        'cards_created': cards_result['cards_created'],
        'new_badges': new_badges,
        'freeze_awarded': freeze_awarded,
    }
