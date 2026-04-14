from django.urls import path

from . import views

app_name = 'studentlife'

urlpatterns = [
    path('', views.home, name='home'),
]
