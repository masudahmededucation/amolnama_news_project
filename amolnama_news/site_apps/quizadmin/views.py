"""Quizadmin page views — staff-only dashboards for the mastermind engine.

All mutations go through mastermind engine functions via views_api.py.
These page views are strictly read-only; they render context for the UI.
"""
from django.contrib.admin.views.decorators import staff_member_required
from django.shortcuts import render

from . import utils


def _render_not_found(request, entity_label, entity_id, back_href, back_label):
    """Shared 404 handler for any entity type."""
    return render(request, 'quizadmin/pages/not_found.html', {
        'page_title': f'{entity_label} not found',
        'entity_label': entity_label,
        'entity_id': entity_id,
        'back_href': back_href,
        'back_label': back_label,
        'quizadmin_active_tab': '',
    }, status=404)


@staff_member_required
def dashboard_page(request):
    context = {
        'page_title': 'Quiz Panel',
        'quizadmin_active_tab': 'dashboard',
        'metrics': utils.get_dashboard_metrics(),
        'charts': utils.get_dashboard_chart_data(),
        'recent_jobs': utils.get_recent_generation_jobs(limit=10),
    }
    return render(request, 'quizadmin/pages/dashboard.html', context)


@staff_member_required
def review_queue_page(request):
    topic_id_raw = request.GET.get('topic_id')
    book_id_raw = request.GET.get('book_id')
    confidence_level = request.GET.get('confidence_level') or None
    verdict_code = request.GET.get('verdict_code') or None
    search_query = request.GET.get('search') or None
    question_id_raw = request.GET.get('question_id')

    topic_id = int(topic_id_raw) if topic_id_raw and topic_id_raw.isdigit() else None
    book_id = int(book_id_raw) if book_id_raw and book_id_raw.isdigit() else None
    question_id = int(question_id_raw) if question_id_raw and question_id_raw.isdigit() else None

    ordered_ids = utils.get_review_queue_ids(
        topic_id=topic_id, book_id=book_id,
        confidence_level=confidence_level, verdict_code=verdict_code,
        search_query=search_query,
    )
    current_id = question_id if question_id in ordered_ids else (
        ordered_ids[0] if ordered_ids else None
    )
    previous_id, current_id, next_id = utils.get_review_neighbors(current_id, ordered_ids)

    context = {
        'page_title': 'Review Queue',
        'quizadmin_active_tab': 'review_queue',
        'filter_options': utils.get_filter_options(),
        'active_filters': {
            'topic_id': topic_id, 'book_id': book_id,
            'confidence_level': confidence_level, 'verdict_code': verdict_code,
            'search': search_query,
        },
        'pending_total': len(ordered_ids),
        'current_index': (ordered_ids.index(current_id) + 1) if current_id in ordered_ids else 0,
        'question': utils.build_review_question_context(current_id) if current_id else None,
        'previous_id': previous_id,
        'next_id': next_id,
    }
    return render(request, 'quizadmin/pages/review_queue.html', context)


@staff_member_required
def books_page(request):
    context = {
        'page_title': 'Books',
        'quizadmin_active_tab': 'books',
        'books': utils.get_books_with_question_counts(),
    }
    return render(request, 'quizadmin/pages/books.html', context)


@utils.staff_or_quiz_creator_required
def quiz_list_page(request):
    sort_by = request.GET.get('sort') or None
    creator_only_filter = None
    if utils.is_quiz_creator_only(request):
        from amolnama_news.site_apps.core.utils import get_user_profile_id
        creator_only_filter = get_user_profile_id(request)
    context = {
        'page_title': 'Quizzes',
        'quizadmin_active_tab': 'quiz_list',
        'sort_options': list(utils.QUIZ_SORT_OPTIONS.keys()),
        'active_sort': sort_by,
        **utils.paginate_quizzes(
            page_number=int(request.GET.get('page', '1') or 1),
            sort_by=sort_by,
            owner_user_profile_id=creator_only_filter,
        ),
    }
    return render(request, 'quizadmin/pages/quiz_list.html', context)


@utils.staff_or_quiz_creator_required
def quiz_create_page(request):
    context = {
        'page_title': 'Create Quiz',
        'quizadmin_active_tab': 'quiz_list',
        'mode': 'create',
        **utils.get_quiz_form_context(exam_id=None),
    }
    return render(request, 'quizadmin/pages/quiz_form.html', context)


@utils.staff_or_quiz_creator_required
def quiz_edit_page(request, exam_id):
    context_data = utils.get_quiz_form_context(exam_id=int(exam_id))
    if context_data.get('quiz') is None:
        return _render_not_found(request, 'Quiz', exam_id, '/quizadmin/quiz/', 'Back to quizzes')
    if utils.is_quiz_creator_only(request):
        from amolnama_news.site_apps.core.utils import get_user_profile_id
        if context_data['quiz'].get('link_created_by_user_profile_id') != get_user_profile_id(request):
            return _render_not_found(request, 'Quiz', exam_id, '/quizadmin/quiz/', 'Back to quizzes')
    context_data.update({
        'page_title': f'Edit quiz: {context_data["quiz"]["exam_title_bn"]}',
        'quizadmin_active_tab': 'quiz_list',
        'mode': 'edit',
    })
    return render(request, 'quizadmin/pages/quiz_form.html', context_data)


@staff_member_required
def quiz_leaderboard_page(request, exam_id):
    context_data = utils.get_quiz_leaderboard_context(exam_id=int(exam_id))
    if context_data.get('quiz') is None:
        return _render_not_found(request, 'Quiz', exam_id, '/quizadmin/quiz/', 'Back to quizzes')
    context_data['page_title'] = f'Leaderboard: {context_data["quiz"]["exam_title_bn"]}'
    context_data['quizadmin_active_tab'] = 'quiz_list'
    return render(request, 'quizadmin/pages/quiz_leaderboard.html', context_data)


@staff_member_required
def quiz_preview_page(request, exam_id):
    context_data = utils.get_quiz_preview_context(exam_id=int(exam_id))
    if context_data is None:
        return _render_not_found(request, 'Quiz', exam_id, '/quizadmin/quiz/', 'Back to quizzes')
    context_data['page_title'] = f'Preview: {context_data["quiz"]["exam_title_bn"]}'
    context_data['quizadmin_active_tab'] = 'quiz_list'
    return render(request, 'quizadmin/pages/quiz_preview.html', context_data)


@staff_member_required
def quiz_host_page(request, exam_id):
    """Host-side multiplayer page — auto-creates a lobby for this quiz then renders the host shell.

    The host is the calling staff user. Players join via the printed code or
    the share URL. All gameplay actions go over the WebSocket (see
    mastermind.consumers_lobby.LobbyConsumer).
    """
    from amolnama_news.site_apps.core.utils import get_user_profile_id
    from amolnama_news.site_apps.mastermind.lobby import create_lobby
    from amolnama_news.site_apps.mastermind.models import CollQuiz, CollQuizLobby

    quiz = CollQuiz.objects.filter(mastermind_coll_quiz_id=int(exam_id), is_active=True).first()
    if not quiz:
        return _render_not_found(request, 'Quiz', exam_id, '/quizadmin/quiz/', 'Back to quizzes')

    user_profile_id = get_user_profile_id(request)
    # Reuse an existing waiting lobby for this quiz hosted by the caller, if any
    existing_lobby = CollQuizLobby.objects.filter(
        link_mastermind_coll_quiz_id=quiz.mastermind_coll_quiz_id,
        link_host_user_profile_id=user_profile_id,
        lobby_status_code='waiting',
        is_active=True,
    ).order_by('-created_at').first()

    if existing_lobby is not None:
        from amolnama_news.site_apps.mastermind.lobby import get_lobby_state
        lobby_state = get_lobby_state(existing_lobby.mastermind_coll_quiz_lobby_id)
    else:
        mode_code = (request.GET.get('mode') or 'host_advances').strip().lower()
        question_seconds_raw = request.GET.get('seconds')
        question_seconds = int(question_seconds_raw) if (question_seconds_raw or '').isdigit() else None
        lobby_state = create_lobby(
            host_user_profile_id=user_profile_id,
            quiz_id=quiz.mastermind_coll_quiz_id,
            mode_code=mode_code if mode_code in ('host_advances', 'timed_per_question') else 'host_advances',
            max_players=50,
            question_seconds=question_seconds,
        )

    if 'error' in (lobby_state or {}):
        return _render_not_found(request, 'Lobby', '?', '/quizadmin/quiz/', 'Back to quizzes')

    from amolnama_news.site_apps.mastermind.views import _stringify_dates
    context = {
        'page_title': f'Host: {quiz.exam_title_bn}',
        'quizadmin_active_tab': 'quiz_list',
        'quiz': quiz,
        'lobby_state': _stringify_dates(lobby_state),
    }
    return render(request, 'quizadmin/pages/quiz_host.html', context)


@staff_member_required
def flagged_questions_page(request):
    """Staff inbox: review user-reported question issues.

    Filter via ?status=pending|resolved|invalid|all (default pending). Each row
    shows the question text, reporter, reason, optional note. Inline actions:
    Resolve (issue confirmed) or Reject (invalid report).
    """
    from amolnama_news.site_apps.mastermind.engine_advanced import list_question_reports

    status_code = (request.GET.get('status') or 'pending').strip().lower()
    if status_code not in ('pending', 'resolved', 'invalid', 'all'):
        status_code = 'pending'
    reports = list_question_reports(status_code=status_code)
    context = {
        'page_title': 'Flagged Questions',
        'quizadmin_active_tab': 'flagged',
        'reports': reports,
        'active_status': status_code,
        'status_options': ('pending', 'resolved', 'invalid', 'all'),
    }
    return render(request, 'quizadmin/pages/flagged_questions.html', context)


@staff_member_required
def webhooks_page(request):
    """Manage outbound webhook subscriptions — list + add + delete."""
    from amolnama_news.site_apps.mastermind.models import CollWebhookSubscription
    from amolnama_news.site_apps.mastermind.webhooks import list_supported_event_codes
    subscriptions = list(
        CollWebhookSubscription.objects
        .filter(is_active=True)
        .order_by('-created_at')
        .values(
            'mastermind_coll_webhook_subscription_id',
            'webhook_event_code', 'webhook_target_url', 'webhook_label',
            'last_dispatch_at', 'last_dispatch_status_code',
            'last_dispatch_response_code', 'last_dispatch_error_message',
            'dispatch_success_count', 'dispatch_failure_count', 'created_at',
        )
    )
    context = {
        'page_title': 'Webhook Subscriptions',
        'quizadmin_active_tab': 'webhooks',
        'subscriptions': subscriptions,
        'supported_event_codes': list_supported_event_codes(),
    }
    return render(request, 'quizadmin/pages/webhooks.html', context)


@staff_member_required
def quiz_take_page(request, exam_id):
    """Staff dogfood — actually take a quiz end-to-end via mastermind engine.

    Same partial used here is meant to be dropped into consumer apps
    (historybd / constitutionbd) when they're ready.
    """
    from amolnama_news.site_apps.mastermind.models import CollQuiz
    quiz = CollQuiz.objects.filter(mastermind_coll_quiz_id=int(exam_id), is_active=True).first()
    if not quiz:
        return render(request, 'quizadmin/pages/not_found.html', {'page_title': 'Quiz not found'})
    context = {
        'page_title': 'Take quiz — ' + (quiz.exam_title_bn or quiz.exam_title_en or f'#{exam_id}'),
        'quizadmin_active_tab': 'quiz_list',
        'quiz': quiz,
    }
    return render(request, 'quizadmin/pages/quiz_take.html', context)


@staff_member_required
def help_page(request):
    """Quiz Panel — workflow diagram + Q&A. Single source of truth for 'how do I…?'."""
    context = {
        'page_title': 'Help & Workflow',
        'quizadmin_active_tab': 'help',
    }
    return render(request, 'quizadmin/pages/help.html', context)


@staff_member_required
def quiz_certificate_template_page(request, exam_id):
    """Editor for the per-quiz certificate HTML template.

    Loads the current exam_certificate_template_html (or empty string if none).
    The save handler is /quizadmin/api/quiz/<id>/certificate-template/.
    """
    from amolnama_news.site_apps.mastermind.models import CollQuiz
    quiz = CollQuiz.objects.filter(mastermind_coll_quiz_id=int(exam_id), is_active=True).first()
    if not quiz:
        return render(request, 'quizadmin/pages/not_found.html', {'page_title': 'Quiz not found'})
    context = {
        'page_title': f'Certificate template — {quiz.exam_title_bn or quiz.exam_title_en}',
        'quizadmin_active_tab': 'quiz_list',
        'quiz': quiz,
        'template_html': quiz.exam_certificate_template_html or '',
    }
    return render(request, 'quizadmin/pages/quiz_certificate_template.html', context)


@staff_member_required
def analytics_dashboard_page(request):
    """Visual analytics dashboard — Chart.js widgets fed by mastermind analytics API."""
    from amolnama_news.site_apps.mastermind.models import CollQuiz
    quiz_options = list(
        CollQuiz.objects
        .filter(is_active=True)
        .order_by('-created_at')
        .values('mastermind_coll_quiz_id', 'exam_title_bn', 'exam_title_en')[:200]
    )
    context = {
        'page_title': 'Analytics Dashboard',
        'quizadmin_active_tab': 'analytics',
        'quiz_options': quiz_options,
    }
    return render(request, 'quizadmin/pages/analytics_dashboard.html', context)


@staff_member_required
def proctoring_dashboard_page(request):
    context = {
        'page_title': 'Proctoring Live Dashboard',
        'quizadmin_active_tab': 'proctoring',
        'summary': utils.get_proctoring_dashboard_summary(),
        'recent_violations': utils.get_recent_proctoring_violations(limit=50),
    }
    return render(request, 'quizadmin/pages/proctoring_dashboard.html', context)


@staff_member_required
def proctoring_dashboard_feed_partial(request):
    """HTMX-polled fragment: refreshed every 5s with the latest violations."""
    context = {
        'recent_violations': utils.get_recent_proctoring_violations(limit=50),
        'summary': utils.get_proctoring_dashboard_summary(),
    }
    return render(request, 'quizadmin/partials/proctoring_dashboard_feed.html', context)


@staff_member_required
def proctoring_session_audit_page(request, session_id):
    audit = utils.get_session_proctoring_audit(session_id=int(session_id))
    if audit is None:
        return _render_not_found(request, 'Session', session_id, '/quizadmin/proctoring/', 'Back to dashboard')
    audit['page_title'] = f'Proctoring audit: session #{session_id}'
    audit['quizadmin_active_tab'] = 'proctoring'
    return render(request, 'quizadmin/pages/proctoring_session_audit.html', audit)


@staff_member_required
def quiz_creators_page(request):
    context = {
        'page_title': 'Quiz Creators',
        'quizadmin_active_tab': 'creators',
        'creators': utils.get_quiz_creators_list(),
    }
    return render(request, 'quizadmin/pages/quiz_creators.html', context)


@staff_member_required
def quiz_workflow_log_page(request, exam_id):
    from amolnama_news.site_apps.mastermind.models import CollQuiz
    exam = (
        CollQuiz.objects.filter(mastermind_coll_quiz_id=exam_id, is_active=True)
        .values('mastermind_coll_quiz_id', 'exam_title_bn', 'exam_title_en')
        .first()
    )
    if not exam:
        return _render_not_found(request, 'Quiz', exam_id, '/quizadmin/quiz/', 'Back to quizzes')
    context = {
        'page_title': f'Workflow log: {exam["exam_title_bn"]}',
        'quizadmin_active_tab': 'quiz_list',
        'quiz': exam,
        'logs': utils.get_quiz_workflow_log(quiz_id=int(exam_id)),
    }
    return render(request, 'quizadmin/pages/quiz_workflow_log.html', context)


@staff_member_required
def question_history_page(request, question_id):
    versions = utils.get_question_version_history(question_id=int(question_id))
    context = {
        'page_title': f'Edit history: Q#{question_id}',
        'quizadmin_active_tab': 'question_bank',
        'question_id': question_id,
        'versions': versions,
    }
    return render(request, 'quizadmin/pages/question_history.html', context)


@staff_member_required
def quiz_print_page(request, exam_id):
    context_data = utils.get_quiz_preview_context(exam_id=int(exam_id))
    if context_data is None:
        return _render_not_found(request, 'Quiz', exam_id, '/quizadmin/quiz/', 'Back to quizzes')
    show_answers = request.GET.get('answers') == '1'
    context_data['page_title'] = context_data['quiz']['exam_title_bn']
    context_data['show_answers'] = show_answers
    return render(request, 'quizadmin/pages/quiz_print.html', context_data)


@staff_member_required
def question_create_page(request):
    context = {
        'page_title': 'Create question',
        'quizadmin_active_tab': '',
        'mode': 'create',
        **utils.get_question_form_context(question_id=None),
    }
    return render(request, 'quizadmin/pages/question_form.html', context)


@staff_member_required
def question_edit_page(request, question_id):
    context = utils.get_question_form_context(question_id=int(question_id))
    if not context.get('question'):
        return _render_not_found(request, 'Question', question_id, '/quizadmin/', 'Back to dashboard')
    context['page_title'] = f'Edit question #{question_id}'
    context['quizadmin_active_tab'] = ''
    context['mode'] = 'edit'
    return render(request, 'quizadmin/pages/question_form.html', context)


@staff_member_required
def question_bank_page(request):
    topic_id = int(request.GET['topic_id']) if request.GET.get('topic_id', '').isdigit() else None
    book_id = int(request.GET['book_id']) if request.GET.get('book_id', '').isdigit() else None
    question_type_id = int(request.GET['question_type_id']) if request.GET.get('question_type_id', '').isdigit() else None
    difficulty_id = int(request.GET['difficulty_id']) if request.GET.get('difficulty_id', '').isdigit() else None
    status_code = request.GET.get('status_code') or None
    source_code = request.GET.get('source_code') or None
    search_query = request.GET.get('q') or None
    sort_by = request.GET.get('sort') or None
    page_number = int(request.GET.get('page', '1') or 1)

    context = {
        'page_title': 'Question Bank',
        'quizadmin_active_tab': 'question_bank',
        'filter_options': utils.get_question_bank_filter_options(),
        'sort_options': list(utils.QUESTION_SORT_OPTIONS.keys()),
        'active_filters': {
            'topic_id': topic_id, 'book_id': book_id,
            'status_code': status_code, 'source_code': source_code,
            'question_type_id': question_type_id, 'difficulty_id': difficulty_id,
            'q': search_query, 'sort': sort_by,
        },
        **utils.paginate_questions(
            page_number=page_number, topic_id=topic_id, book_id=book_id,
            status_code=status_code, question_type_id=question_type_id,
            difficulty_id=difficulty_id, source_code=source_code,
            search_query=search_query, sort_by=sort_by,
        ),
    }
    return render(request, 'quizadmin/pages/question_bank.html', context)


@staff_member_required
def question_analytics_page(request, question_id):
    context_data = utils.get_question_analytics_context(question_id=int(question_id))
    if context_data is None:
        return _render_not_found(request, 'Question', question_id, '/quizadmin/questions/', 'Back to questions')
    context_data['page_title'] = f'Analytics: Q#{question_id}'
    context_data['quizadmin_active_tab'] = 'question_bank'
    return render(request, 'quizadmin/pages/question_analytics.html', context_data)


@staff_member_required
def generation_jobs_page(request):
    page_number_raw = request.GET.get('page', '1')
    page_number = int(page_number_raw) if page_number_raw.isdigit() else 1
    context = {
        'page_title': 'Generation Jobs',
        'quizadmin_active_tab': 'generation_jobs',
        **utils.paginate_generation_jobs(page_number=page_number),
    }
    return render(request, 'quizadmin/pages/generation_jobs.html', context)
