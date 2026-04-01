"""Health URL patterns."""

from django.urls import path

from . import views

app_name = 'health'

urlpatterns = [
    path('', views.home, name='home'),
]
