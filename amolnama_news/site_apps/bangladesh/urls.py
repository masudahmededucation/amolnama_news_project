from django.urls import path

from . import views, views_api

app_name = "bangladesh"

urlpatterns = [
    # Landing
    path("", views.bangladesh_landing, name="bangladesh_landing"),

    # Travel Hub
    path("travel/", views.travel_hub, name="travel_hub"),
    path("travel/add/", views.travel_hub_add, name="travel_hub_add"),
    path("travel/<str:destination_slug>/", views.travel_hub_detail_by_slug, name="travel_hub_detail"),
    path("travel/id/<int:destination_id>/", views.travel_hub_detail_by_id, name="travel_hub_detail_by_id"),

    # Beauty of Bangladesh
    path("beauty/", views.beauty_hub, name="beauty_hub"),
    path("beauty/upload/", views.beauty_hub_upload, name="beauty_hub_upload"),

    # APIs
    path("api/destinations/", views_api.api_destination_list, name="api_destination_list"),
    path("api/destinations/create/", views_api.api_destination_create, name="api_destination_create"),
    path("api/destinations/<int:destination_id>/update/", views_api.api_destination_update, name="api_destination_update"),
    path("api/media/", views_api.api_media_list, name="api_media_list"),
    path("api/media/upload/", views_api.api_media_upload, name="api_media_upload"),

    # Destination — like
    path("api/destination/<int:destination_id>/like/", views_api.api_destination_like_toggle, name="api_destination_like_toggle"),

    # Destination — view tracking + likes
    path("api/destination/<int:destination_id>/photo/<int:photo_id>/view/", views_api.api_destination_photo_view, name="api_destination_photo_view"),
    path("api/destination/<int:destination_id>/photo/<int:photo_id>/like/", views_api.api_destination_photo_like_toggle, name="api_destination_photo_like_toggle"),
    path("api/destination/<int:destination_id>/video/<int:youtube_link_id>/view/", views_api.api_destination_video_view, name="api_destination_video_view"),
    path("api/destination/<int:destination_id>/video/<int:youtube_link_id>/like/", views_api.api_destination_video_like_toggle, name="api_destination_video_like_toggle"),

    # Destination community contributions — add
    path("api/destination/<int:destination_id>/review/", views_api.api_destination_review_add, name="api_destination_review_add"),
    path("api/destination/<int:destination_id>/photo/", views_api.api_destination_photo_upload, name="api_destination_photo_upload"),
    path("api/destination/<int:destination_id>/youtube/", views_api.api_destination_youtube_link_add, name="api_destination_youtube_link_add"),
    path("api/destination/<int:destination_id>/link/", views_api.api_destination_reference_link_add, name="api_destination_reference_link_add"),

    # Destination — set cover image
    path("api/destination/<int:destination_id>/photo/<int:photo_id>/set-cover/", views_api.api_destination_cover_image_set, name="api_destination_cover_image_set"),

    # Destination community contributions — edit / delete
    path("api/destination/<int:destination_id>/photo/<int:photo_id>/", views_api.api_destination_photo_update, name="api_destination_photo_update"),
    path("api/destination/<int:destination_id>/photo/<int:photo_id>/delete/", views_api.api_destination_photo_delete, name="api_destination_photo_delete"),
    path("api/destination/<int:destination_id>/youtube/<int:youtube_link_id>/", views_api.api_destination_youtube_link_update, name="api_destination_youtube_link_update"),
    path("api/destination/<int:destination_id>/youtube/<int:youtube_link_id>/delete/", views_api.api_destination_youtube_link_delete, name="api_destination_youtube_link_delete"),
    path("api/destination/<int:destination_id>/link/<int:reference_link_id>/", views_api.api_destination_reference_link_update, name="api_destination_reference_link_update"),
    path("api/destination/<int:destination_id>/link/<int:reference_link_id>/delete/", views_api.api_destination_reference_link_delete, name="api_destination_reference_link_delete"),
]
