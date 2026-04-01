from django.urls import path

from . import views
from . import views_api

app_name = 'debate'

urlpatterns = [
    # Pages
    path('', views.home, name='home'),
    path('topic/<int:topic_id>/', views.topic_detail, name='topic_detail'),
    path('topic/<int:topic_id>/download-pdf/', views.topic_download_pdf, name='topic_download_pdf'),

    # APIs — topic management
    path('api/topic/create/', views_api.api_topic_create, name='api_topic_create'),
    path('api/topic/<int:topic_id>/join/', views_api.api_topic_join, name='api_topic_join'),
    path('api/topic/<int:topic_id>/go-live/', views_api.api_topic_go_live, name='api_topic_go_live'),
    path('api/topic/<int:topic_id>/close/', views_api.api_topic_close, name='api_topic_close'),

    # APIs — posts (arguments + rebuttals)
    path('api/topic/<int:topic_id>/argument/', views_api.api_post_argument, name='api_post_argument'),
    path('api/topic/<int:topic_id>/reply/', views_api.api_post_reply, name='api_post_reply'),
    path('api/post/<int:post_id>/edit/', views_api.api_post_edit, name='api_post_edit'),
    path('api/post/<int:post_id>/delete/', views_api.api_post_delete, name='api_post_delete'),

    # APIs — voting
    path('api/vote/topic/<int:topic_id>/', views_api.api_vote_topic, name='api_vote_topic'),
    path('api/vote/post/<int:post_id>/', views_api.api_vote_post, name='api_vote_post'),

    # APIs — live polling
    path('api/topic/<int:topic_id>/boards/', views_api.api_topic_boards, name='api_topic_boards'),
]
