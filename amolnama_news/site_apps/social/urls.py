from django.urls import path

from . import views
from . import views_api

app_name = 'social'

urlpatterns = [
    path('', views.home, name='home'),
    path('api/follow/<int:user_profile_id>/', views_api.api_follow_toggle, name='api_follow_toggle'),
]
