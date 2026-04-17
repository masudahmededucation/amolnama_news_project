"""Mastermind multi-player lobby engine — Kahoot/Quizizz-style live group quizzes.

Public surface:
    create_lobby(host_user_profile_id, quiz_id, ...)
    join_lobby(join_code, user_profile_id)
    leave_lobby(lobby_id, user_profile_id)
    mark_ready(lobby_id, user_profile_id, is_ready=True)
    start_lobby(lobby_id, host_user_profile_id)
    advance_question(lobby_id, host_user_profile_id, expected_index)
    submit_lobby_answer(lobby_id, user_profile_id, question_index, answer_payload)
    finalise_lobby(lobby_id)
    get_lobby_state(lobby_id_or_join_code)

The Channels consumer is a thin transport layer over these functions; the same
functions can be called from HTTP API endpoints to bootstrap the UI before the
WebSocket connects.
"""
import json
import logging
import random
import secrets
from decimal import Decimal

from django.utils import timezone

from .models import (
    CollQuestion,
    CollQuestionMatchPair,
    CollQuestionOption,
    CollQuiz,
    CollQuizLobby,
    CollQuizLobbyEvent,
    CollQuizLobbyPlayer,
    MapQuizQuestionPool,
)

logger = logging.getLogger(__name__)


# Unambiguous alphabet for join codes — no I/O/0/1 (Kahoot pattern)
JOIN_CODE_ALPHABET = 'BCDFGHJKLMNPQRSTVWXYZ23456789'
JOIN_CODE_LENGTH = 6


# ================================================================
# Lifecycle
# ================================================================

def create_lobby(host_user_profile_id, quiz_id, mode_code='host_advances',
                 max_players=50, question_seconds=None):
    """Create a waiting-state lobby and return its full state.

    The host is the only one who can start, advance, or end. Anyone with a
    join_code can join (capped at max_players). Mode codes:
      'host_advances'       — host clicks "Next" to move everyone forward
      'timed_per_question'  — server auto-advances every question_seconds
    """
    if not host_user_profile_id:
        return {'error': 'host_user_profile_id is required.'}
    if mode_code not in ('host_advances', 'timed_per_question'):
        return {'error': "mode_code must be 'host_advances' or 'timed_per_question'."}
    quiz = CollQuiz.objects.filter(
        mastermind_coll_quiz_id=quiz_id,
        exam_status_code='published',
        is_active=True,
    ).first()
    if not quiz:
        return {'error': 'Quiz not found or not published.'}

    join_code = _generate_unique_join_code()
    lobby = CollQuizLobby.objects.create(
        link_mastermind_coll_quiz_id=quiz_id,
        link_host_user_profile_id=host_user_profile_id,
        lobby_join_code=join_code,
        lobby_status_code='waiting',
        lobby_mode_code=mode_code,
        lobby_max_players=max_players,
        lobby_question_seconds=question_seconds,
        created_at=timezone.now(),
    )
    _log_event(lobby.mastermind_coll_quiz_lobby_id, host_user_profile_id,
               'lobby_created', {'mode': mode_code})
    return get_lobby_state(lobby.mastermind_coll_quiz_lobby_id)


def join_lobby(join_code, user_profile_id):
    """Join an existing lobby by 6-char code. Returns full state or error."""
    if not user_profile_id:
        return {'error': 'user_profile_id is required.'}
    code = (join_code or '').strip().upper()
    if not code:
        return {'error': 'join_code is required.'}

    lobby = CollQuizLobby.objects.filter(lobby_join_code=code, is_active=True).first()
    if not lobby:
        return {'error': 'Lobby not found.'}
    if lobby.lobby_status_code in ('completed', 'abandoned'):
        return {'error': 'Lobby has ended.'}

    existing = CollQuizLobbyPlayer.objects.filter(
        link_mastermind_coll_quiz_lobby_id=lobby.mastermind_coll_quiz_lobby_id,
        link_user_profile_id=user_profile_id,
    ).first()
    if existing and existing.is_active and not existing.player_has_left:
        # Already in — return current state, no error
        return get_lobby_state(lobby.mastermind_coll_quiz_lobby_id)

    active_count = CollQuizLobbyPlayer.objects.filter(
        link_mastermind_coll_quiz_lobby_id=lobby.mastermind_coll_quiz_lobby_id,
        is_active=True, player_has_left=False,
    ).count()
    if active_count >= lobby.lobby_max_players:
        return {'error': 'Lobby is full.'}

    if existing:
        # Re-joining after leaving
        CollQuizLobbyPlayer.objects.filter(
            mastermind_coll_quiz_lobby_player_id=existing.mastermind_coll_quiz_lobby_player_id,
        ).update(
            player_has_left=False,
            player_left_at=None,
            is_active=True,
            updated_at=timezone.now(),
        )
    else:
        CollQuizLobbyPlayer.objects.create(
            link_mastermind_coll_quiz_lobby_id=lobby.mastermind_coll_quiz_lobby_id,
            link_user_profile_id=user_profile_id,
            player_join_order=active_count + 1,
            created_at=timezone.now(),
        )
    _log_event(lobby.mastermind_coll_quiz_lobby_id, user_profile_id, 'player_joined', {})
    return get_lobby_state(lobby.mastermind_coll_quiz_lobby_id)


def leave_lobby(lobby_id, user_profile_id):
    """Mark a player as left. Soft-delete (history preserved)."""
    updated = CollQuizLobbyPlayer.objects.filter(
        link_mastermind_coll_quiz_lobby_id=lobby_id,
        link_user_profile_id=user_profile_id,
        is_active=True,
    ).update(
        player_has_left=True,
        player_left_at=timezone.now(),
        updated_at=timezone.now(),
    )
    if updated:
        _log_event(lobby_id, user_profile_id, 'player_left', {})
    return get_lobby_state(lobby_id)


def mark_ready(lobby_id, user_profile_id, is_ready=True):
    """Toggle a player's ready flag. Used by the waiting-room screen."""
    updated = CollQuizLobbyPlayer.objects.filter(
        link_mastermind_coll_quiz_lobby_id=lobby_id,
        link_user_profile_id=user_profile_id,
        is_active=True,
        player_has_left=False,
    ).update(
        player_is_ready=bool(is_ready),
        updated_at=timezone.now(),
    )
    if updated:
        _log_event(lobby_id, user_profile_id, 'player_ready', {'is_ready': bool(is_ready)})
    return get_lobby_state(lobby_id)


def start_lobby(lobby_id, host_user_profile_id):
    """Host begins the game. Snapshots question + option order so all players see the same set."""
    lobby = CollQuizLobby.objects.filter(
        mastermind_coll_quiz_lobby_id=lobby_id, is_active=True,
    ).first()
    if not lobby:
        return {'error': 'Lobby not found.'}
    if lobby.link_host_user_profile_id != host_user_profile_id:
        return {'error': 'Only the host can start the lobby.'}
    if lobby.lobby_status_code != 'waiting':
        return {'error': 'Lobby is not in waiting state.'}

    snapshot = _build_question_snapshot(lobby.link_mastermind_coll_quiz_id)
    if 'error' in snapshot:
        return snapshot

    now = timezone.now()
    CollQuizLobby.objects.filter(mastermind_coll_quiz_lobby_id=lobby_id).update(
        lobby_status_code='playing',
        lobby_started_at=now,
        lobby_current_question_index=0,
        lobby_question_started_at=now,
        lobby_question_snapshot_json=json.dumps(snapshot),
        updated_at=now,
    )
    _log_event(lobby_id, host_user_profile_id, 'lobby_started', {
        'question_count': len(snapshot.get('questions', [])),
    })

    # Fire webhook event (background)
    try:
        from .webhooks import fire_event
        fire_event('lobby_started', {
            'lobby_id': lobby_id,
            'quiz_id': lobby.link_mastermind_coll_quiz_id,
            'host_user_profile_id': host_user_profile_id,
            'mode_code': lobby.lobby_mode_code,
        })
    except Exception:
        logger.exception('Webhook fire failed for lobby_started')

    return get_lobby_state(lobby_id)


def advance_question(lobby_id, host_user_profile_id, expected_index=None):
    """Move everyone forward by one question. Idempotent if expected_index matches.

    If expected_index is given, the current state must match it before advancing —
    this prevents double-clicks from skipping ahead two questions.
    """
    lobby = CollQuizLobby.objects.filter(
        mastermind_coll_quiz_lobby_id=lobby_id, is_active=True,
    ).first()
    if not lobby:
        return {'error': 'Lobby not found.'}
    if lobby.link_host_user_profile_id != host_user_profile_id:
        return {'error': 'Only the host can advance.'}
    if lobby.lobby_status_code != 'playing':
        return {'error': 'Lobby is not in playing state.'}

    if expected_index is not None and expected_index != lobby.lobby_current_question_index:
        # Stale advance — ignore and return current state (idempotent)
        return get_lobby_state(lobby_id)

    snapshot = _safe_load_snapshot(lobby)
    questions = snapshot.get('questions', [])
    next_index = lobby.lobby_current_question_index + 1

    if next_index >= len(questions):
        return finalise_lobby(lobby_id)

    now = timezone.now()
    CollQuizLobby.objects.filter(mastermind_coll_quiz_lobby_id=lobby_id).update(
        lobby_current_question_index=next_index,
        lobby_question_started_at=now,
        updated_at=now,
    )
    _log_event(lobby_id, host_user_profile_id, 'question_advance', {
        'question_index': next_index,
    })
    return get_lobby_state(lobby_id)


def submit_lobby_answer(lobby_id, user_profile_id, question_index, answer_payload):
    """Score a player's answer. Late or wrong-index submissions are ignored.

    answer_payload mirrors the solo /api/exam/answer/ payload shape:
      mcq_single / true_false:  {selected_option_id: int}
      mcq_multi:                {selected_option_id: 'csv,of,ids'}
      fill_blank:               {fill_blank_answer_text: 'text'}
      matching:                 {matching_pairs: [{stem_pair_id, response_pair_id}, ...]}
      ordering:                 {ordering_option_ids: [int, int, ...]}
    """
    lobby = CollQuizLobby.objects.filter(
        mastermind_coll_quiz_lobby_id=lobby_id, is_active=True,
    ).first()
    if not lobby or lobby.lobby_status_code != 'playing':
        return {'error': 'Lobby is not playing.'}
    if question_index != lobby.lobby_current_question_index:
        # Late answer — silently drop, return current scores
        return {'late': True, 'state': get_lobby_state(lobby_id)}

    player = CollQuizLobbyPlayer.objects.filter(
        link_mastermind_coll_quiz_lobby_id=lobby_id,
        link_user_profile_id=user_profile_id,
        is_active=True, player_has_left=False,
    ).first()
    if not player:
        return {'error': 'Player not in lobby.'}

    # Idempotency: if this player already answered this question, return their previous score
    answer_key = f'q{question_index}_answered'
    payload_key = answer_payload.get('_idempotency_key') or answer_key
    existing_log = CollQuizLobbyEvent.objects.filter(
        link_mastermind_coll_quiz_lobby_id=lobby_id,
        link_user_profile_id=user_profile_id,
        event_type_code='answer_submitted',
        event_payload_json__contains=f'"question_index": {question_index}',
    ).exists()
    if existing_log:
        return {'duplicate': True, 'state': get_lobby_state(lobby_id)}

    snapshot = _safe_load_snapshot(lobby)
    questions = snapshot.get('questions', [])
    if question_index >= len(questions):
        return {'error': 'question_index out of range.'}
    question_payload = questions[question_index]
    is_correct, base_points = _grade_lobby_answer(question_payload, answer_payload)

    elapsed_seconds = 0
    if lobby.lobby_question_started_at:
        elapsed_seconds = max(0, (timezone.now() - lobby.lobby_question_started_at).total_seconds())

    quiz = CollQuiz.objects.filter(mastermind_coll_quiz_id=lobby.link_mastermind_coll_quiz_id).first()
    final_points = _apply_lobby_bonuses(
        is_correct=is_correct,
        base_points=base_points,
        elapsed_seconds=elapsed_seconds,
        max_seconds=lobby.lobby_question_seconds or 30,
        current_streak=player.player_streak_count,
        speed_bonus_enabled=bool(quiz and quiz.exam_lobby_speed_bonus_enabled),
        streak_bonus_enabled=bool(quiz and quiz.exam_lobby_streak_bonus_enabled),
    )

    new_streak = (player.player_streak_count + 1) if is_correct else 0
    CollQuizLobbyPlayer.objects.filter(
        mastermind_coll_quiz_lobby_player_id=player.mastermind_coll_quiz_lobby_player_id,
    ).update(
        player_current_score=Decimal(str(player.player_current_score)) + Decimal(str(final_points)),
        player_correct_count=player.player_correct_count + (1 if is_correct else 0),
        player_streak_count=new_streak,
        updated_at=timezone.now(),
    )

    _log_event(lobby_id, user_profile_id, 'answer_submitted', {
        'question_index': question_index,
        'is_correct': is_correct,
        'points_earned': float(final_points),
        'elapsed_seconds': elapsed_seconds,
    })
    return {
        'is_correct': is_correct,
        'points_earned': float(final_points),
        'state': get_lobby_state(lobby_id),
    }


def finalise_lobby(lobby_id):
    """Mark lobby completed and return the final state with leaderboard."""
    lobby = CollQuizLobby.objects.filter(
        mastermind_coll_quiz_lobby_id=lobby_id, is_active=True,
    ).first()
    if not lobby:
        return {'error': 'Lobby not found.'}
    if lobby.lobby_status_code == 'completed':
        return get_lobby_state(lobby_id)

    now = timezone.now()
    CollQuizLobby.objects.filter(mastermind_coll_quiz_lobby_id=lobby_id).update(
        lobby_status_code='completed',
        lobby_completed_at=now,
        updated_at=now,
    )
    _log_event(lobby_id, None, 'lobby_completed', {})

    # Fire webhook event
    try:
        from .webhooks import fire_event
        state = get_lobby_state(lobby_id)
        fire_event('lobby_completed', {
            'lobby_id': lobby_id,
            'quiz_id': lobby.link_mastermind_coll_quiz_id,
            'final_leaderboard': state.get('leaderboard', []),
        })
    except Exception:
        logger.exception('Webhook fire failed for lobby_completed')

    return get_lobby_state(lobby_id)


# ================================================================
# Read API (used by both Channels consumer and HTTP endpoints)
# ================================================================

def get_lobby_state(lobby_id_or_join_code):
    """Return the full client-renderable state for a lobby.

    Accepts either an integer lobby_id or a 6-char join_code (string) so the
    /play/<code>/ page can resolve directly without a separate lookup.
    """
    lobby = None
    if isinstance(lobby_id_or_join_code, str) and not lobby_id_or_join_code.isdigit():
        lobby = CollQuizLobby.objects.filter(
            lobby_join_code=lobby_id_or_join_code.strip().upper(),
            is_active=True,
        ).first()
    else:
        lobby = CollQuizLobby.objects.filter(
            mastermind_coll_quiz_lobby_id=int(lobby_id_or_join_code), is_active=True,
        ).first()

    if not lobby:
        return {'error': 'Lobby not found.'}

    quiz = CollQuiz.objects.filter(
        mastermind_coll_quiz_id=lobby.link_mastermind_coll_quiz_id
    ).first()

    players = list(
        CollQuizLobbyPlayer.objects
        .filter(link_mastermind_coll_quiz_lobby_id=lobby.mastermind_coll_quiz_lobby_id)
        .order_by('player_join_order')
        .values(
            'mastermind_coll_quiz_lobby_player_id',
            'link_user_profile_id', 'player_join_order',
            'player_is_ready', 'player_current_score',
            'player_correct_count', 'player_streak_count',
            'player_has_left',
        )
    )
    user_profile_ids = [p['link_user_profile_id'] for p in players]
    display_names = _resolve_display_names(user_profile_ids)
    for player in players:
        player['display_name'] = display_names.get(player['link_user_profile_id'], '')
        player['player_current_score'] = float(player['player_current_score'])

    leaderboard = sorted(
        [p for p in players if not p['player_has_left'] or lobby.lobby_status_code == 'completed'],
        key=lambda p: (-p['player_current_score'], -p['player_correct_count']),
    )

    snapshot = _safe_load_snapshot(lobby)
    questions = snapshot.get('questions', [])
    current_question = None
    if lobby.lobby_status_code == 'playing' and 0 <= lobby.lobby_current_question_index < len(questions):
        current_question = _strip_answers(questions[lobby.lobby_current_question_index])

    return {
        'lobby_id': lobby.mastermind_coll_quiz_lobby_id,
        'join_code': lobby.lobby_join_code,
        'quiz_id': lobby.link_mastermind_coll_quiz_id,
        'quiz_title_bn': quiz.exam_title_bn if quiz else '',
        'quiz_title_en': quiz.exam_title_en if quiz else '',
        'host_user_profile_id': lobby.link_host_user_profile_id,
        'status_code': lobby.lobby_status_code,
        'mode_code': lobby.lobby_mode_code,
        'max_players': lobby.lobby_max_players,
        'question_seconds': lobby.lobby_question_seconds,
        'current_question_index': lobby.lobby_current_question_index,
        'question_started_at': (
            lobby.lobby_question_started_at.isoformat() if lobby.lobby_question_started_at else None
        ),
        'started_at': lobby.lobby_started_at.isoformat() if lobby.lobby_started_at else None,
        'completed_at': lobby.lobby_completed_at.isoformat() if lobby.lobby_completed_at else None,
        'total_questions': len(questions),
        'current_question': current_question,
        'players': players,
        'leaderboard': leaderboard,
    }


# ================================================================
# Internal helpers
# ================================================================

def _generate_unique_join_code():
    for _ in range(8):
        code = ''.join(secrets.choice(JOIN_CODE_ALPHABET) for _ in range(JOIN_CODE_LENGTH))
        if not CollQuizLobby.objects.filter(lobby_join_code=code).exists():
            return code
    raise RuntimeError('Could not generate a unique lobby join code after 8 retries.')


def _build_question_snapshot(quiz_id):
    """Pick + freeze the question / option order ONCE so every player sees the same set.

    Returns {'questions': [{question_id, options, ...}, ...]} or {'error': '...'}.
    """
    quiz = CollQuiz.objects.filter(mastermind_coll_quiz_id=quiz_id).first()
    if not quiz:
        return {'error': 'Quiz not found.'}

    pool_question_ids = list(
        MapQuizQuestionPool.objects
        .filter(link_mastermind_coll_quiz_id=quiz_id)
        .values_list('link_mastermind_coll_question_id', flat=True)
    )

    if not pool_question_ids:
        # Fall back to all published questions for this quiz's topic / book
        question_filter = {'question_status_code': 'published', 'is_active': True}
        if quiz.link_mastermind_coll_quiz_topic_id:
            question_filter['link_mastermind_coll_quiz_topic_id'] = quiz.link_mastermind_coll_quiz_topic_id
        if quiz.link_mastermind_coll_book_id:
            question_filter['link_mastermind_coll_book_id'] = quiz.link_mastermind_coll_book_id
        pool_question_ids = list(
            CollQuestion.objects.filter(**question_filter)
            .values_list('mastermind_coll_question_id', flat=True)
        )

    if not pool_question_ids:
        return {'error': 'No questions available for this quiz.'}

    if len(pool_question_ids) > quiz.exam_total_questions:
        pool_question_ids = random.sample(pool_question_ids, quiz.exam_total_questions)

    if quiz.exam_shuffle_questions:
        random.shuffle(pool_question_ids)

    questions_data = list(
        CollQuestion.objects.filter(mastermind_coll_question_id__in=pool_question_ids)
    )
    questions_by_id = {q.mastermind_coll_question_id: q for q in questions_data}

    options = list(
        CollQuestionOption.objects
        .filter(link_mastermind_coll_question_id__in=pool_question_ids, is_active=True)
        .order_by('sort_order', 'mastermind_coll_question_option_id')
    )
    options_by_question_id = {}
    for option in options:
        options_by_question_id.setdefault(option.link_mastermind_coll_question_id, []).append(option)

    match_pairs_by_question_id = {}
    for pair in CollQuestionMatchPair.objects.filter(
        link_mastermind_coll_question_id__in=pool_question_ids, is_active=True,
    ).order_by('sort_order'):
        match_pairs_by_question_id.setdefault(
            pair.link_mastermind_coll_question_id, []
        ).append(pair)

    from .engine import _get_question_type_code  # reuse the cached resolver

    snapshot_questions = []
    for question_id in pool_question_ids:
        question = questions_by_id.get(question_id)
        if not question:
            continue
        question_options = list(options_by_question_id.get(question_id, []))
        if quiz.exam_shuffle_options:
            random.shuffle(question_options)

        question_type_code = _get_question_type_code(
            question.link_mastermind_ref_quiz_question_type_id
        )

        match_stems = []
        match_responses = []
        if question_type_code == 'matching':
            pairs = match_pairs_by_question_id.get(question_id, [])
            match_stems = [
                {
                    'pair_id': pair.mastermind_coll_question_match_pair_id,
                    'stem_text_bn': pair.stem_text_bn,
                    'stem_text_en': pair.stem_text_en,
                }
                for pair in pairs if pair.stem_text_bn or pair.stem_text_en
            ]
            match_responses = [
                {
                    'pair_id': pair.mastermind_coll_question_match_pair_id,
                    'response_text_bn': pair.response_text_bn,
                    'response_text_en': pair.response_text_en,
                }
                for pair in pairs if pair.response_text_bn or pair.response_text_en
            ]
            if quiz.exam_shuffle_options:
                random.shuffle(match_responses)

        snapshot_questions.append({
            'question_id': question.mastermind_coll_question_id,
            'question_text_bn': question.question_text_bn,
            'question_text_en': question.question_text_en,
            'question_image_url': question.question_image_url,
            'question_type_code': question_type_code,
            'question_points': question.question_points,
            'options': [
                {
                    'option_id': option.mastermind_coll_question_option_id,
                    'option_label': option.option_label,
                    'option_text_bn': option.option_text_bn,
                    'option_text_en': option.option_text_en,
                    'is_correct': option.is_correct,  # kept; stripped before broadcast
                }
                for option in question_options
            ],
            'match_stems': match_stems,
            'match_responses': match_responses,
            'correct_option_ids': [
                option.mastermind_coll_question_option_id
                for option in question_options if option.is_correct
            ],
        })
    return {'questions': snapshot_questions}


def _safe_load_snapshot(lobby):
    if not lobby.lobby_question_snapshot_json:
        return {'questions': []}
    try:
        return json.loads(lobby.lobby_question_snapshot_json)
    except (TypeError, ValueError):
        return {'questions': []}


def _strip_answers(question):
    """Return a player-safe copy of a question — no is_correct flags, no answer ids."""
    safe = {k: v for k, v in question.items() if k not in ('correct_option_ids',)}
    safe['options'] = [
        {k: v for k, v in option.items() if k != 'is_correct'}
        for option in question.get('options', [])
    ]
    return safe


def _grade_lobby_answer(question_payload, answer_payload):
    """Return (is_correct, base_points) for one answer against a snapshotted question."""
    question_type_code = question_payload.get('question_type_code')
    base_points = float(question_payload.get('question_points') or 1)
    correct_ids = set(question_payload.get('correct_option_ids') or [])

    if question_type_code in ('mcq_single', 'true_false'):
        selected = answer_payload.get('selected_option_id')
        if selected is None:
            return False, 0.0
        try:
            return (int(selected) in correct_ids), base_points
        except (TypeError, ValueError):
            return False, 0.0

    if question_type_code == 'mcq_multi':
        raw = answer_payload.get('selected_option_id')
        if not raw:
            return False, 0.0
        if isinstance(raw, str):
            chosen = {int(part) for part in raw.split(',') if part.strip().isdigit()}
        elif isinstance(raw, (list, tuple, set)):
            chosen = {int(part) for part in raw}
        else:
            chosen = {int(raw)}
        return (chosen == correct_ids), base_points

    if question_type_code == 'fill_blank':
        # Compare normalised text against any correct option text
        import unicodedata
        student_text = (answer_payload.get('fill_blank_answer_text') or '').strip().lower()
        if not student_text:
            return False, 0.0
        normalised = unicodedata.normalize('NFC', student_text)
        for option in question_payload.get('options', []):
            if not option.get('is_correct'):
                continue
            for key in ('option_text_bn', 'option_text_en'):
                target = (option.get(key) or '').strip().lower()
                if target and unicodedata.normalize('NFC', target) == normalised:
                    return True, base_points
        return False, 0.0

    if question_type_code == 'matching':
        pairs = answer_payload.get('matching_pairs') or []
        # Correct iff every stem's chosen response is its own pair_id
        if not pairs:
            return False, 0.0
        for entry in pairs:
            if entry.get('stem_pair_id') != entry.get('response_pair_id'):
                return False, 0.0
        return True, base_points

    if question_type_code == 'ordering':
        student_order = answer_payload.get('ordering_option_ids') or []
        canonical = [option['option_id'] for option in question_payload.get('options', [])]
        try:
            student_order = [int(option_id) for option_id in student_order]
        except (TypeError, ValueError):
            return False, 0.0
        return (student_order == canonical), base_points

    # short_answer / essay → manual grading; treat as no auto-score in lobby
    return False, 0.0


def _apply_lobby_bonuses(is_correct, base_points, elapsed_seconds, max_seconds,
                         current_streak, speed_bonus_enabled, streak_bonus_enabled):
    """Kahoot-style bonuses. Returns the final point value (float).

    speed_bonus: correct_points × (1 - elapsed/max × 0.5). Bounded in [0.5, 1.0]
                 multiplier. Faster correct answers get more, slower ones get half.
    streak_bonus: +10% per consecutive correct, capped at +50% (after 5 in a row).
    Both apply only on correct answers.
    """
    if not is_correct:
        return 0.0
    points = float(base_points)
    if speed_bonus_enabled and max_seconds and max_seconds > 0:
        ratio = max(0.0, min(1.0, elapsed_seconds / max_seconds))
        points *= (1.0 - ratio * 0.5)
    if streak_bonus_enabled:
        # current_streak is BEFORE this answer; new_streak = current_streak + 1
        new_streak = current_streak + 1
        bonus_multiplier = 1.0 + min(0.5, max(0, new_streak - 1) * 0.1)
        points *= bonus_multiplier
    return round(points, 2)


def _resolve_display_names(user_profile_ids):
    if not user_profile_ids:
        return {}
    try:
        from amolnama_news.site_apps.user_account.models import UserProfile
        return {
            row['user_profile_id']: row.get('display_name') or ''
            for row in UserProfile.objects
            .filter(user_profile_id__in=list(set(user_profile_ids)))
            .values('user_profile_id', 'display_name')
        }
    except Exception:
        logger.exception('Display name lookup failed for lobby state')
        return {}


def _log_event(lobby_id, user_profile_id, event_type_code, payload):
    """Append-only event log row. Soft-fail — never raise into the request path."""
    try:
        CollQuizLobbyEvent.objects.create(
            link_mastermind_coll_quiz_lobby_id=lobby_id,
            link_user_profile_id=user_profile_id,
            event_type_code=event_type_code,
            event_payload_json=json.dumps(payload, ensure_ascii=False) if payload else None,
            created_at=timezone.now(),
        )
    except Exception:
        logger.exception('Lobby event log write failed (lobby=%s, type=%s)',
                         lobby_id, event_type_code)
