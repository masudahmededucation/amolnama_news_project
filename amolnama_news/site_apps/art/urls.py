"""Art & Craft URL patterns."""

from django.urls import path

from . import views, views_api

app_name = 'art'

urlpatterns = [
    path('', views.home, name='home'),
    path('upload/', views.upload, name='upload'),
    path('api/create/', views_api.api_artwork_create, name='api_artwork_create'),
    path('api/<int:artwork_id>/like/', views_api.api_artwork_like_toggle, name='api_artwork_like_toggle'),
    path('api/<int:artwork_id>/bookmark/', views_api.api_artwork_bookmark_toggle, name='api_artwork_bookmark_toggle'),
    path('api/<int:artwork_id>/view/', views_api.api_artwork_view_increment, name='api_artwork_view_increment'),
    path('api/<int:artwork_id>/comment/', views_api.api_artwork_comment_create, name='api_artwork_comment_create'),
    path('<str:artwork_slug>/', views.detail, name='detail'),
]
