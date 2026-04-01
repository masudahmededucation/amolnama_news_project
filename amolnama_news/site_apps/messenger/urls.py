from django.urls import path

from . import views
from . import views_api

app_name = 'messenger'

urlpatterns = [
    path('', views.home, name='home'),
]
