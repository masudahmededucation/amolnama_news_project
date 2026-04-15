from django.urls import path

from . import views
from . import views_api

app_name = 'historybd'

urlpatterns = [
    path('', views.home, name='home'),
    path('add/', views.add, name='add'),
    path('id/<int:history_event_id>/', views.detail_by_id, name='detail_by_id'),
    path('<str:history_event_slug>/', views.detail_by_slug, name='detail'),

    # API
    path('api/create/', views_api.api_history_event_create, name='api_history_event_create'),
]
