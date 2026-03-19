from django.urls import path
from . import views, views_api

app_name = "marriage"

urlpatterns = [
    path("", views.marriage, name="marriage"),
    path("nikahnama/", views.marriage_form, name="marriage_form"),
    path("register-marriage/", views.register_marriage, name="register_marriage"),
    path("marriage-certificate/", views.marriage_certificate, name="marriage_certificate"),
    path("api/saved-offices/", views_api.api_saved_offices_list, name="api_saved_offices_list"),
    path("api/saved-offices/save/", views_api.api_saved_offices_save, name="api_saved_offices_save"),
    path("api/saved-offices/delete/", views_api.api_saved_offices_delete, name="api_saved_offices_delete"),
]
