from django.urls import path

from . import views
from . import views_api

app_name = 'messenger'

urlpatterns = [
    path('', views.home, name='home'),

    # Unread count (polled globally from sidebar)
    path('api/unread-count/', views_api.api_unread_count, name='api_unread_count'),

    # Conversation API
    path('api/conversations/', views_api.api_conversation_list, name='api_conversation_list'),
    path('api/conversations/start/', views_api.api_conversation_start, name='api_conversation_start'),

    # Message API
    path('api/messages/<int:conversation_id>/', views_api.api_message_list, name='api_message_list'),
    path('api/messages/<int:conversation_id>/send/', views_api.api_message_send, name='api_message_send'),
    path('api/messages/<int:conversation_id>/poll/', views_api.api_message_poll, name='api_message_poll'),
    path('api/messages/<int:conversation_id>/read/', views_api.api_message_mark_read, name='api_message_mark_read'),

    # Auto-delete + Clear
    path('api/conversations/<int:conversation_id>/set-auto-delete/', views_api.api_conversation_set_auto_delete, name='api_conversation_set_auto_delete'),
    path('api/conversations/<int:conversation_id>/clear-all/', views_api.api_conversation_clear_all, name='api_conversation_clear_all'),

    # Pin / Mute
    path('api/conversations/<int:conversation_id>/pin/', views_api.api_conversation_pin, name='api_conversation_pin'),
    path('api/conversations/<int:conversation_id>/mute/', views_api.api_conversation_mute, name='api_conversation_mute'),

    # Delete + Edit
    path('api/messages/<int:conversation_id>/delete-for-me/<int:message_id>/', views_api.api_message_delete_for_me, name='api_message_delete_for_me'),
    path('api/messages/<int:conversation_id>/delete-for-everyone/<int:message_id>/', views_api.api_message_delete_for_everyone, name='api_message_delete_for_everyone'),
    path('api/messages/<int:conversation_id>/edit/<int:message_id>/', views_api.api_message_edit, name='api_message_edit'),

    # Typing indicator
    path('api/typing/<int:conversation_id>/', views_api.api_typing_indicator, name='api_typing_indicator'),
    path('api/typing/<int:conversation_id>/status/', views_api.api_typing_status, name='api_typing_status'),

    # Call
    path('api/call/initiate/', views_api.api_call_initiate, name='api_call_initiate'),
    path('api/call/privacy/', views_api.api_call_privacy_update, name='api_call_privacy_update'),
]
