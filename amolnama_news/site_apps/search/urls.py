from django.urls import path

from . import views
from . import views_api

app_name = 'search'

urlpatterns = [
    path('', views.home, name='home'),
]
