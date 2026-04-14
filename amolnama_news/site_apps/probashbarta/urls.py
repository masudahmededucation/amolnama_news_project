from django.urls import path

from . import views

app_name = 'probashbarta'

urlpatterns = [
    path('', views.home, name='home'),
]
