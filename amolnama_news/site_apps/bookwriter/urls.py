from django.urls import path

from . import views, views_api

app_name = "bookwriter"

urlpatterns = [
    path("", views.bookwriter_inkwell, name="landing"),

    # Phase 1B Step 1 — chapter body autosave (debounced ~800ms by JS).
    path(
        "api/chapter/<int:chapter_id>/autosave/",
        views_api.api_bookwriter_chapter_autosave,
        name="api_chapter_autosave",
    ),

    # Phase 1B Step 3 — chapter title autosave, chapter load (for rail
    # click → switch chapter), and append-new-chapter to a book.
    path(
        "api/chapter/<int:chapter_id>/title/",
        views_api.api_bookwriter_chapter_title_save,
        name="api_chapter_title_save",
    ),
    path(
        "api/chapter/<int:chapter_id>/",
        views_api.api_bookwriter_chapter_load,
        name="api_chapter_load",
    ),
    path(
        "api/book/<int:book_id>/chapter/create/",
        views_api.api_bookwriter_book_chapter_create,
        name="api_book_chapter_create",
    ),
]
