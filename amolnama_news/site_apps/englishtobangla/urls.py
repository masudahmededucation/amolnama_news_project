from django.urls import path
from . import views

app_name = "englishtobangla"

urlpatterns = [
    path("", views.englishtobangla, name="englishtobangla"),
]
