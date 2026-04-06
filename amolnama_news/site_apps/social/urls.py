from django.urls import path

from . import views
from . import views_api

app_name = 'social'

urlpatterns = [
    path('', views.home, name='home'),
    path('@<str:username_handle>/', views.public_profile, name='public_profile'),
    path('@<str:username_handle>/followers/', views.followers_page, name='followers_page'),
    path('@<str:username_handle>/following/', views.following_page, name='following_page'),
    path('lists/', views.lists_page, name='lists_page'),
    path('api/follow/<int:user_profile_id>/', views_api.api_follow_toggle, name='api_follow_toggle'),
    path('api/follow-list/<int:user_profile_id>/', views_api.api_follow_list, name='api_follow_list'),
    path('api/block/<int:user_profile_id>/', views_api.api_block_toggle, name='api_block_toggle'),
    path('api/list/create/', views_api.api_list_create, name='api_list_create'),
    path('api/list/member/toggle/', views_api.api_list_member_toggle, name='api_list_member_toggle'),
]
