from django.urls import path

from . import views
from . import views_api

app_name = 'search'

urlpatterns = [
    path('', views.home, name='home'),
    path('api/search/', views_api.api_search, name='api_search'),
]
