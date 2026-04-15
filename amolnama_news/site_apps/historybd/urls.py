from django.urls import path

from . import views

app_name = 'historybd'

urlpatterns = [
    path('', views.home, name='home'),
]
