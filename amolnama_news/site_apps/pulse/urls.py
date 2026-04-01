from django.urls import path

from . import views
from . import views_api

app_name = 'pulse'

urlpatterns = [
    path('', views.home, name='home'),
]
