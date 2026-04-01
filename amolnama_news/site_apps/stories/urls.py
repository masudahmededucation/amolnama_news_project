"""Stories for Kids URL patterns."""

from django.urls import path

from . import views, views_api

app_name = 'stories'

urlpatterns = [
    path('', views.home, name='home'),
    path('submit/', views.submit, name='submit'),
    path('api/create/', views_api.api_story_create, name='api_story_create'),
    path('api/<int:story_id>/like/', views_api.api_story_like_toggle, name='api_story_like_toggle'),
    path('api/<int:story_id>/bookmark/', views_api.api_story_bookmark_toggle, name='api_story_bookmark_toggle'),
    path('api/<int:story_id>/view/', views_api.api_story_view_increment, name='api_story_view_increment'),
    path('<str:story_slug>/', views.detail, name='detail'),
]
