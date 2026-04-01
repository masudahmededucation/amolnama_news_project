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
]
