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
    path('api/persons/search/', views_api.api_biography_person_search, name='api_biography_person_search'),
    path('api/quick-add/quote/', views_api.api_biography_quick_add_quote, name='api_biography_quick_add_quote'),
    path('api/quick-add/youtube/', views_api.api_biography_quick_add_youtube, name='api_biography_quick_add_youtube'),
    path('api/quick-add/photo/', views_api.api_biography_quick_add_photo, name='api_biography_quick_add_photo'),
]
