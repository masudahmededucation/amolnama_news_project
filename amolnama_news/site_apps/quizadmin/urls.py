from django.urls import path

from . import views, views_api

app_name = 'quizadmin'

urlpatterns = [
    path('',              views.dashboard_page,           name='dashboard'),
    path('review/',       views.review_queue_page,        name='review_queue'),
    path('books/',        views.books_page,               name='books'),
    path('jobs/',         views.generation_jobs_page,     name='generation_jobs'),
    path('questions/',    views.question_bank_page,       name='question_bank'),
    path('question/create/',           views.question_create_page,    name='question_create'),
    path('question/<int:question_id>/edit/', views.question_edit_page, name='question_edit'),
    path('question/<int:question_id>/analytics/', views.question_analytics_page, name='question_analytics'),
    path('quiz/',                          views.quiz_list_page,         name='quiz_list'),
    path('quiz/create/',                   views.quiz_create_page,       name='quiz_create'),
    path('quiz/<int:exam_id>/edit/',       views.quiz_edit_page,         name='quiz_edit'),
    path('quiz/<int:exam_id>/leaderboard/',views.quiz_leaderboard_page,  name='quiz_leaderboard'),
    path('quiz/<int:exam_id>/preview/',    views.quiz_preview_page,      name='quiz_preview'),

    path('api/approve/',  views_api.api_coll_question_approve,   name='api_coll_question_approve'),
    path('api/reject/',   views_api.api_coll_question_reject,    name='api_coll_question_reject'),
    path('api/skip/',     views_api.api_coll_question_skip,      name='api_coll_question_skip'),
    path('api/question/create/',                   views_api.api_coll_question_create,   name='api_coll_question_create'),
    path('api/question/<int:question_id>/update/', views_api.api_coll_question_update,   name='api_coll_question_update'),
    path('api/question/<int:question_id>/delete/', views_api.api_coll_question_delete,   name='api_coll_question_delete'),
    path('api/question/bulk-status/',              views_api.api_coll_question_bulk_status, name='api_coll_question_bulk_status'),
    path('api/question/export-csv/',               views_api.api_coll_question_export_csv,  name='api_coll_question_export_csv'),
    path('api/question/import-csv/',               views_api.api_coll_question_import_csv,  name='api_coll_question_import_csv'),
    path('api/quiz/create/',               views_api.api_coll_exam_create,  name='api_coll_exam_create'),
    path('api/quiz/<int:exam_id>/update/', views_api.api_coll_exam_update,  name='api_coll_exam_update'),
    path('api/quiz/<int:exam_id>/clone/',  views_api.api_coll_exam_clone,   name='api_coll_exam_clone'),
    path('api/quiz/<int:exam_id>/delete/', views_api.api_coll_exam_delete,  name='api_coll_exam_delete'),
]
