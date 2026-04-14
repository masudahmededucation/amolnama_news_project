from django.urls import path

from . import views
from . import views_api

app_name = 'probashbarta'

urlpatterns = [
    path('', views.home, name='home'),
    path('add/', views.add, name='add'),
    path('id/<int:probash_entry_id>/', views.detail_by_id, name='detail_by_id'),
    path('<str:probash_entry_slug>/', views.detail_by_slug, name='detail'),

    # API
    path('api/create/', views_api.api_probash_entry_create, name='api_probash_entry_create'),
    path('api/countries/', views_api.api_country_list, name='api_country_list'),
]
