from django.urls import path

from . import views
from . import views_api

app_name = 'biography'

urlpatterns = [
    path('', views.home, name='home'),
    path('add/', views.add, name='add'),
    path('id/<int:biography_entry_id>/', views.detail_by_id, name='detail_by_id'),
    path('<str:biography_entry_slug>/', views.detail_by_slug, name='detail'),

    # API
    path('api/create/', views_api.api_biography_entry_create, name='api_biography_entry_create'),
]
