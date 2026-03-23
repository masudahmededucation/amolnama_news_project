from django.urls import path
from . import views, views_api, views_og

app_name = "poem"

urlpatterns = [
    # Pages
    path("", views.poem_landing, name="poem_landing"),
    path("<int:poem_id>/", views.poem_detail, name="poem_detail"),
    path("create/", views.poem_create, name="poem_create"),
    path("<int:poem_id>/edit/", views.poem_edit, name="poem_edit"),
    path("<int:poem_id>/og-image.png", views_og.poem_og_image, name="poem_og_image"),

    # API
    path("api/poems/", views_api.api_poem_entry_list, name="api_poem_entry_list"),
    path("api/poems/create/", views_api.api_poem_entry_create, name="api_poem_entry_create"),
    path("api/poems/<int:poem_id>/update/", views_api.api_poem_entry_update, name="api_poem_entry_update"),
    path("api/poems/<int:poem_id>/like/", views_api.api_poem_entry_like_toggle, name="api_poem_entry_like_toggle"),
    path("api/poems/<int:poem_id>/next/", views_api.api_poem_next, name="api_poem_next"),
    path("api/poems/<int:poem_id>/related/", views_api.api_poem_related, name="api_poem_related"),
    path("api/categories/", views_api.api_poem_category_list, name="api_poem_category_list"),
]
