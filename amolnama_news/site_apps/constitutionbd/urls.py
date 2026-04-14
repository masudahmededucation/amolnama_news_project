from django.urls import path

from . import views

app_name = 'constitutionbd'

urlpatterns = [
    path('', views.home, name='home'),
]
