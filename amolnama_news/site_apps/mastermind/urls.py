from django.urls import path

from . import views_api

app_name = 'mastermind'

urlpatterns = [
    # Book management
    path('api/book/create/', views_api.api_book_create, name='api_book_create'),
    path('api/book/<int:book_id>/chapter/create/', views_api.api_book_chapter_create, name='api_book_chapter_create'),
    path('api/book/<int:book_id>/ingest/', views_api.api_ingest_book_pdf, name='api_ingest_book_pdf'),

    # Question management
    path('api/question/create/', views_api.api_question_create, name='api_question_create'),
    path('api/question/<int:question_id>/analytics/', views_api.api_question_analytics, name='api_question_analytics'),
    path('api/question/report/', views_api.api_question_report, name='api_question_report'),
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
