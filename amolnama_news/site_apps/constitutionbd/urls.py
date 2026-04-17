from django.urls import path

from . import views

app_name = 'constitutionbd'

urlpatterns = [
    path('', views.home, name='home'),
    path('quiz/', views.quiz_list, name='quiz_list'),
    path('quiz/<int:quiz_id>/take/', views.quiz_take, name='quiz_take'),
]
