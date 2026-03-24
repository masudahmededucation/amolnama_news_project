from django.urls import path
from . import views, views_api, views_og

app_name = "poem"

urlpatterns = [
    # Landing
    path("", views.poem_landing, name="poem_landing"),

    # Static routes MUST come before the <str:poem_slug> catch-all
    path("create/", views.poem_create, name="poem_create"),
    path("id/<int:poem_id>/", views.poem_detail_by_id, name="poem_detail_by_id"),
    path("id/<int:poem_id>/og-image.png", views_og.poem_og_image_by_id, name="poem_og_image_by_id"),

    # API (must come before catch-all slug pattern)
    path("api/poems/", views_api.api_poem_entry_list, name="api_poem_entry_list"),
    path("api/poems/create/", views_api.api_poem_entry_create, name="api_poem_entry_create"),
    path("api/poems/<int:poem_id>/update/", views_api.api_poem_entry_update, name="api_poem_entry_update"),
    path("api/poems/<int:poem_id>/like/", views_api.api_poem_entry_like_toggle, name="api_poem_entry_like_toggle"),
    path("api/poems/<int:poem_id>/next/", views_api.api_poem_next, name="api_poem_next"),
    path("api/poems/<int:poem_id>/related/", views_api.api_poem_related, name="api_poem_related"),
    path("api/categories/", views_api.api_poem_category_list, name="api_poem_category_list"),

    # Slug-based detail pages (catch-all — MUST be last, supports Bengali Unicode)
    path("<str:poem_slug>/", views.poem_detail_by_slug, name="poem_detail"),
    path("<str:poem_slug>/edit/", views.poem_edit, name="poem_edit"),
    path("<str:poem_slug>/og-image.png", views_og.poem_og_image, name="poem_og_image"),
]
