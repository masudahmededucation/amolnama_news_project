from django.urls import path

from . import views, views_api

app_name = "bangladesh"

urlpatterns = [
    # Landing
    path("", views.bangladesh_landing, name="bangladesh_landing"),

    # Travel Hub
    path("travel/", views.travel_hub, name="travel_hub"),
    path("travel/add/", views.travel_hub_add, name="travel_hub_add"),
    path("travel/<int:destination_id>/", views.travel_hub_detail, name="travel_hub_detail"),

    # Beauty of Bangladesh
    path("beauty/", views.beauty_hub, name="beauty_hub"),
    path("beauty/upload/", views.beauty_hub_upload, name="beauty_hub_upload"),

    # APIs
    path("api/destinations/", views_api.api_destination_list, name="api_destination_list"),
    path("api/destinations/create/", views_api.api_destination_create, name="api_destination_create"),
    path("api/media/", views_api.api_media_list, name="api_media_list"),
    path("api/media/upload/", views_api.api_media_upload, name="api_media_upload"),
]
