from django.urls import path

from . import views

app_name = 'biography'

urlpatterns = [
    path('', views.home, name='home'),
]
