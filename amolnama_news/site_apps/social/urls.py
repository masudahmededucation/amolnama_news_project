from django.urls import path

from . import views
from . import views_api

app_name = 'social'

urlpatterns = [
    path('', views.home, name='home'),
    path('api/follow/<int:user_profile_id>/', views_api.api_follow_toggle, name='api_follow_toggle'),
    path('api/block/<int:user_profile_id>/', views_api.api_block_toggle, name='api_block_toggle'),
    path('api/list/create/', views_api.api_list_create, name='api_list_create'),
    path('api/list/member/toggle/', views_api.api_list_member_toggle, name='api_list_member_toggle'),
]
