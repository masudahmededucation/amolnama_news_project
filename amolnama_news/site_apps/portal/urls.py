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
]
