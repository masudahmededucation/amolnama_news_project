from django.urls import path

from . import views
from . import views_api

app_name = 'portal'

urlpatterns = [
    path('', views.home, name='home'),
    path('profile/', views.profile_redirect_view, name='profile'),
    path('profile/public/', views.profile_public_view, name='profile_public'),
    path('profile/personal/', views.profile_personal_view, name='profile_personal'),
    path('profile/contact/', views.profile_contact_view, name='profile_contact'),
    path('profile/address/', views.profile_address_view, name='profile_address'),
    path('profile/settings/', views.profile_settings_view, name='profile_settings'),
    path('api/avatar/upload/', views_api.api_avatar_upload, name='api_avatar_upload'),
    path('content/', views.content_dashboard_view, name='content_dashboard'),
    path('analytics/', views.analytics_dashboard_view, name='analytics_dashboard'),
    path('moderation/', views.moderation_queue_view, name='moderation_queue'),
    path('api/content/toggle-publish/', views_api.api_content_toggle_publish, name='api_content_toggle_publish'),
    path('api/moderation/approve/', views_api.api_moderation_approve, name='api_moderation_approve'),
    path('api/moderation/reject/', views_api.api_moderation_reject, name='api_moderation_reject'),
    path('admin/placeholders/', views.composer_placeholders_view, name='composer_placeholders'),
    path('api/placeholders/add/', views_api.api_placeholder_add, name='api_placeholder_add'),
    path('api/placeholders/toggle/', views_api.api_placeholder_toggle, name='api_placeholder_toggle'),
    path('api/placeholders/feature/', views_api.api_placeholder_feature, name='api_placeholder_feature'),
    path('api/placeholders/delete/', views_api.api_placeholder_delete, name='api_placeholder_delete'),
]
