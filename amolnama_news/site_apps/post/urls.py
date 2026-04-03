from django.urls import path

from . import views
from . import views_api

app_name = 'post'

urlpatterns = [
    path('', views.home, name='home'),
    path('bookmarks/', views.bookmarks, name='bookmarks'),
    path('<int:post_post_id>/', views.post_detail, name='post_detail'),
    path('<int:post_post_id>/embed/', views.post_embed, name='post_embed'),
    path('api/oembed/', views.api_post_oembed, name='api_post_oembed'),
    path('api/create/', views_api.api_post_create, name='api_post_create'),
    path('api/<int:post_post_id>/like/', views_api.api_post_like_toggle, name='api_post_like_toggle'),
    path('api/<int:post_post_id>/vote/', views_api.api_post_vote_toggle, name='api_post_vote_toggle'),
    path('api/<int:post_post_id>/follow-post/', views_api.api_post_follow_toggle, name='api_post_follow_toggle'),
    path('api/<int:post_post_id>/flag/', views_api.api_post_flag_create, name='api_post_flag_create'),
    path('api/<int:post_post_id>/bookmark/', views_api.api_post_bookmark_toggle, name='api_post_bookmark_toggle'),
    path('api/<int:post_post_id>/view/', views_api.api_post_view_increment, name='api_post_view_increment'),
    path('api/<int:post_post_id>/repost/', views_api.api_post_repost, name='api_post_repost'),
    path('api/<int:post_post_id>/reply/', views_api.api_post_reply, name='api_post_reply'),
    path('api/<int:post_post_id>/edit/', views_api.api_post_edit, name='api_post_edit'),
    path('api/<int:post_post_id>/delete/', views_api.api_post_delete, name='api_post_delete'),
    path('api/<int:post_post_id>/replies/', views_api.api_post_replies, name='api_post_replies'),
    path('api/<int:post_post_id>/poll-vote/', views_api.api_poll_vote, name='api_poll_vote'),
    path('api/<int:post_post_id>/pin/', views_api.api_post_pin_toggle, name='api_post_pin_toggle'),
    path('api/mentions/autocomplete/', views_api.api_mention_autocomplete, name='api_mention_autocomplete'),
]
