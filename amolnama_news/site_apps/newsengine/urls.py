from django.urls import path

from . import views
from . import views_api

app_name = 'newsengine'

urlpatterns = [
    # APIs — global notifications
    path('api/notifications/', views_api.api_notifications_list, name='api_notifications_list'),
    path('api/notifications/mark-read/', views_api.api_notifications_mark_read, name='api_notifications_mark_read'),

    # APIs — universal bookmarks
    path('api/bookmark/toggle/', views_api.api_bookmark_toggle, name='api_bookmark_toggle'),

    # APIs — feed pagination
    path('api/feed/', views_api.api_feed_page, name='api_feed_page'),

    # APIs — recommendations + hashtags
    path('api/recommendations/', views_api.api_recommendations, name='api_recommendations'),
    path('api/hashtags/trending/', views_api.api_trending_hashtags, name='api_trending_hashtags'),

    # APIs — link preview (shared by post + debate)
    path('api/link-preview/', views_api.api_link_preview, name='api_link_preview'),

    # APIs — related content (cache-first)
    path('api/related-content/', views_api.api_related_content, name='api_related_content'),

    # APIs — muted words
    path('api/muted-words/', views_api.api_muted_words_list, name='api_muted_words_list'),
    path('api/muted-words/add/', views_api.api_muted_word_add, name='api_muted_word_add'),
    path('api/muted-words/remove/', views_api.api_muted_word_remove, name='api_muted_word_remove'),
]
