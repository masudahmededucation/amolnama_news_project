from django.urls import path

from . import views, views_api

app_name = 'mastermind'

urlpatterns = [
    # Public certificate verification page (no auth — serial is unforgeable)
    path('certificate/<str:certificate_serial>/', views.certificate_public_view, name='certificate_public_view'),

    # Book management
    path('api/book/create/', views_api.api_book_create, name='api_book_create'),
    path('api/book/<int:book_id>/chapter/create/', views_api.api_book_chapter_create, name='api_book_chapter_create'),
    path('api/book/<int:book_id>/ingest/', views_api.api_ingest_book_pdf, name='api_ingest_book_pdf'),

    # Question management
    path('api/question/create/', views_api.api_question_create, name='api_question_create'),
    path('api/question/<int:question_id>/analytics/', views_api.api_question_analytics, name='api_question_analytics'),
    path('api/question/report/', views_api.api_question_report, name='api_question_report'),
    path('api/question/report/list/', views_api.api_question_report_list, name='api_question_report_list'),
    path('api/question/report/<int:report_id>/review/', views_api.api_question_report_review, name='api_question_report_review'),
    path('api/question/bookmark/', views_api.api_question_bookmark_toggle, name='api_question_bookmark_toggle'),
    path('api/question/bulk-import/', views_api.api_bulk_import_questions, name='api_bulk_import_questions'),

    # AI generation (Phase 2)
    path('api/book/<int:book_id>/generate/', views_api.api_generate_questions, name='api_generate_questions'),
    path('api/review/queue/', views_api.api_review_queue, name='api_review_queue'),
    path('api/review/action/', views_api.api_review_question_action, name='api_review_question_action'),

    # Exam management
    path('api/exam/create/', views_api.api_exam_create, name='api_exam_create'),
    path('api/exam/<int:quiz_id>/clone/', views_api.api_quiz_clone, name='api_quiz_clone'),
    path('api/exam/<int:quiz_id>/archive/', views_api.api_quiz_archive, name='api_quiz_archive'),
    path('api/exam/<int:quiz_id>/unarchive/', views_api.api_quiz_unarchive, name='api_quiz_unarchive'),
    path('api/exam/<int:quiz_id>/delete/', views_api.api_quiz_delete, name='api_quiz_delete'),
    path('api/exam/<int:quiz_id>/export/', views_api.api_export_quiz, name='api_export_quiz'),

    # Bulk question export
    path('api/question/export/', views_api.api_export_questions, name='api_export_questions'),

    # Question / option image upload (returns public URL)
    path('api/question/upload-image/', views_api.api_upload_question_image, name='api_upload_question_image'),

    # Per-session accommodation override (extra time / no time limit)
    path('api/session/<int:session_id>/accommodation/', views_api.api_grant_session_accommodation, name='api_grant_session_accommodation'),

    # Per-session certificate lookup (results screen)
    path('api/session/<int:session_id>/certificate/', views_api.api_session_certificate, name='api_session_certificate'),

    # Resume an in-progress session
    path('api/exam/<int:exam_id>/resume-check/', views_api.api_session_resume_check, name='api_session_resume_check'),
    path('api/session/<int:session_id>/resume/', views_api.api_session_resume, name='api_session_resume'),

    # Webhook subscriptions (staff only)
    path('api/webhook/subscriptions/', views_api.api_webhook_subscription_list, name='api_webhook_subscription_list'),
    path('api/webhook/subscriptions/create/', views_api.api_webhook_subscription_create, name='api_webhook_subscription_create'),
    path('api/webhook/subscriptions/<int:subscription_id>/delete/', views_api.api_webhook_subscription_delete, name='api_webhook_subscription_delete'),

    # Per-quiz comments / discussion
    path('api/quiz/<int:quiz_id>/comments/', views_api.api_quiz_comments_list, name='api_quiz_comments_list'),
    path('api/quiz/<int:quiz_id>/comments/create/', views_api.api_quiz_comment_create, name='api_quiz_comment_create'),
    path('api/quiz/comment/<int:comment_id>/delete/', views_api.api_quiz_comment_delete, name='api_quiz_comment_delete'),
    path('api/quiz/comment/<int:comment_id>/pin/', views_api.api_quiz_comment_pin, name='api_quiz_comment_pin'),
    path('api/quiz/comment/<int:comment_id>/like/', views_api.api_quiz_comment_reaction_toggle, name='api_quiz_comment_reaction_toggle'),

    # Analytics (chart data)
    path('api/analytics/quiz/<int:quiz_id>/score-distribution/', views_api.api_analytics_quiz_score_distribution, name='api_analytics_quiz_score_distribution'),
    path('api/analytics/quiz/<int:quiz_id>/pass-rate/', views_api.api_analytics_quiz_pass_rate, name='api_analytics_quiz_pass_rate'),
    path('api/analytics/quiz/<int:quiz_id>/question-difficulty/', views_api.api_analytics_quiz_question_difficulty, name='api_analytics_quiz_question_difficulty'),
    path('api/analytics/topic/engagement/', views_api.api_analytics_topic_engagement, name='api_analytics_topic_engagement'),
    path('api/analytics/user/performance/', views_api.api_analytics_user_performance, name='api_analytics_user_performance'),

    # Exam session (quiz taking)
    path('api/exam/<int:exam_id>/start/', views_api.api_exam_start, name='api_exam_start'),
    path('api/exam/<int:exam_id>/answer/', views_api.api_exam_answer, name='api_exam_answer'),
    path('api/exam/<int:exam_id>/submit/', views_api.api_exam_submit, name='api_exam_submit'),
    path('api/exam/<int:exam_id>/review/', views_api.api_exam_review, name='api_exam_review'),

    # Practice mode (untimed, instant feedback)
    path('api/practice/start/', views_api.api_practice_start, name='api_practice_start'),

    # Retry wrong answers
    path('api/retry-wrong/', views_api.api_retry_wrong, name='api_retry_wrong'),

    # Spaced repetition
    path('api/cards/due/', views_api.api_due_cards, name='api_due_cards'),
    path('api/cards/review/', views_api.api_review_card, name='api_review_card'),

    # User stats + streaks + history
    path('api/user/stats/', views_api.api_user_stats, name='api_user_stats'),
    path('api/user/streak/', views_api.api_streak_with_freeze, name='api_streak_with_freeze'),
    path('api/user/history/', views_api.api_attempt_history, name='api_attempt_history'),

    # Leaderboard
    path('api/leaderboard/', views_api.api_leaderboard, name='api_leaderboard'),

    # Readiness gauge
    path('api/readiness/', views_api.api_readiness_gauge, name='api_readiness_gauge'),

    # Proctoring (Phase 1: lockdown event logging)
    path('api/proctoring/log-violation/', views_api.api_proctoring_log_violation, name='api_proctoring_log_violation'),
]
