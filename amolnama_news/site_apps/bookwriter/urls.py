from django.urls import path

from . import (
    views,
    views_api,                        # backward-compat shim
    views_api_book,
    views_api_chapter,
    views_api_collaboration,
    views_api_refs,
    views_api_writing_artifacts,
)

app_name = "bookwriter"

urlpatterns = [
    # My Library landing — grid of every book the logged-in user owns.
    # Clicking a cover deep-links into `bookwriter:write` for that book.
    path("", views.bookwriter_library, name="library"),

    # Inkwell editor for ONE specific book. Owner-only (404 otherwise).
    path("write/<int:book_id>/edit/", views.bookwriter_inkwell, name="write"),

    # Library "+ New book" → POST → creates blank book + Chapter One,
    # responds with redirect_url so the JS can navigate into the editor.
    path(
        "api/book/create/",
        views_api_book.api_bookwriter_book_create,
        name="api_book_create",
    ),

    # Library card hover-action archive (soft-delete; recoverable).
    path(
        "api/book/<int:book_id>/archive/",
        views_api_book.api_bookwriter_book_archive,
        name="api_book_archive",
    ),

    # Phase 1B Step 1 — chapter body autosave (debounced ~800ms by JS).
    path(
        "api/chapter/<int:chapter_id>/autosave/",
        views_api_chapter.api_bookwriter_chapter_autosave,
        name="api_chapter_autosave",
    ),

    # Inline image upload (drag-drop into prose, multipart upload).
    path(
        "api/chapter/<int:chapter_id>/image/upload/",
        views_api_chapter.api_bookwriter_chapter_image_upload,
        name="api_chapter_image_upload",
    ),

    # Phase 1B Step 3 — chapter title autosave, chapter load (for rail
    # click → switch chapter), and append-new-chapter to a book.
    path(
        "api/chapter/<int:chapter_id>/title/",
        views_api_chapter.api_bookwriter_chapter_title_save,
        name="api_chapter_title_save",
    ),
    path(
        "api/chapter/<int:chapter_id>/",
        views_api_chapter.api_bookwriter_chapter_load,
        name="api_chapter_load",
    ),
    path(
        "api/book/<int:book_id>/chapter/create/",
        views_api_chapter.api_bookwriter_book_chapter_create,
        name="api_book_chapter_create",
    ),

    # Phase 1B Step 4 — book metadata + chapter management.
    path(
        "api/book/<int:book_id>/title/",
        views_api_book.api_bookwriter_book_title_save,
        name="api_book_title_save",
    ),
    path(
        "api/book/<int:book_id>/chapters/reorder/",
        views_api_book.api_bookwriter_book_chapters_reorder,
        name="api_book_chapters_reorder",
    ),
    # PDF export — entire book as a downloadable PDF (Edge-headless
    # via shared tools.pdf_export_utils). Owner-only. GET so the
    # toolbar's Export-PDF button can window.location to it for a
    # native browser download.
    path(
        "api/book/<int:book_id>/export/pdf/",
        views_api_book.api_bookwriter_book_export_pdf,
        name="api_bookwriter_book_export_pdf",
    ),
    path(
        "api/chapter/<int:chapter_id>/delete/",
        views_api_chapter.api_bookwriter_chapter_delete,
        name="api_chapter_delete",
    ),

    # Phase 1B Step 5 — chapter snapshots (version history).
    path(
        "api/chapter/<int:chapter_id>/snapshot/",
        views_api_chapter.api_bookwriter_chapter_snapshot_create,
        name="api_chapter_snapshot_create",
    ),
    path(
        "api/chapter/<int:chapter_id>/snapshots/",
        views_api_chapter.api_bookwriter_chapter_snapshot_list,
        name="api_chapter_snapshot_list",
    ),
    path(
        "api/chapter/<int:chapter_id>/snapshot/<int:snapshot_id>/revert/",
        views_api_chapter.api_bookwriter_chapter_snapshot_revert,
        name="api_chapter_snapshot_revert",
    ),

    # Phase 1B Step 6 — sprint timer persistence.
    path(
        "api/sprint/start/",
        views_api_writing_artifacts.api_bookwriter_sprint_start,
        name="api_sprint_start",
    ),
    path(
        "api/sprint/<int:sprint_session_id>/finish/",
        views_api_writing_artifacts.api_bookwriter_sprint_finish,
        name="api_sprint_finish",
    ),

    # Phase 1B Step 7 — plot cards (corkboard view).
    path(
        "api/book/<int:book_id>/plot-card/create/",
        views_api_writing_artifacts.api_bookwriter_book_plot_card_create,
        name="api_book_plot_card_create",
    ),
    path(
        "api/plot-card/<int:plot_card_id>/save/",
        views_api_writing_artifacts.api_bookwriter_plot_card_save,
        name="api_plot_card_save",
    ),
    path(
        "api/plot-card/<int:plot_card_id>/delete/",
        views_api_writing_artifacts.api_bookwriter_plot_card_delete,
        name="api_plot_card_delete",
    ),

    # Phase 1B Step 8 — bible entries (worldbuilding notebook).
    path(
        "api/book/<int:book_id>/bible-entry/create/",
        views_api_writing_artifacts.api_bookwriter_book_bible_entry_create,
        name="api_book_bible_entry_create",
    ),
    path(
        "api/bible-entry/<int:bible_entry_id>/save/",
        views_api_writing_artifacts.api_bookwriter_bible_entry_save,
        name="api_bible_entry_save",
    ),
    path(
        "api/bible-entry/<int:bible_entry_id>/delete/",
        views_api_writing_artifacts.api_bookwriter_bible_entry_delete,
        name="api_bible_entry_delete",
    ),

    # Phase 1B Step 9 — margin notes (chapter annotations, API-only).
    path(
        "api/chapter/<int:chapter_id>/margin-note/create/",
        views_api_writing_artifacts.api_bookwriter_chapter_margin_note_create,
        name="api_chapter_margin_note_create",
    ),
    path(
        "api/chapter/<int:chapter_id>/margin-notes/",
        views_api_writing_artifacts.api_bookwriter_chapter_margin_note_list,
        name="api_chapter_margin_note_list",
    ),
    path(
        "api/margin-note/<int:margin_note_id>/save/",
        views_api_writing_artifacts.api_bookwriter_margin_note_save,
        name="api_margin_note_save",
    ),
    path(
        "api/margin-note/<int:margin_note_id>/delete/",
        views_api_writing_artifacts.api_bookwriter_margin_note_delete,
        name="api_margin_note_delete",
    ),

    # Phase 1B Step 10 — cover designer (1:1 with book).
    path(
        "api/book/<int:book_id>/cover-design/save/",
        views_api_book.api_bookwriter_book_cover_design_save,
        name="api_book_cover_design_save",
    ),

    # Phase 1B Step 11 — beta share link (revocable secret URL).
    path(
        "api/book/<int:book_id>/beta-share/create/",
        views_api_collaboration.api_bookwriter_book_beta_share_create,
        name="api_book_beta_share_create",
    ),
    path(
        "api/book/<int:book_id>/beta-shares/",
        views_api_collaboration.api_bookwriter_book_beta_share_list,
        name="api_book_beta_share_list",
    ),
    path(
        "api/beta-share/<int:beta_share_link_id>/revoke/",
        views_api_collaboration.api_bookwriter_beta_share_revoke,
        name="api_beta_share_revoke",
    ),

    # Phase 1B Step 12 — chapter publish (serial release).
    path(
        "api/chapter/<int:chapter_id>/publish/",
        views_api_chapter.api_bookwriter_chapter_publish,
        name="api_chapter_publish",
    ),
    path(
        "api/chapter/<int:chapter_id>/unpublish/",
        views_api_chapter.api_bookwriter_chapter_unpublish,
        name="api_chapter_unpublish",
    ),

    # Phase 1B Step 13 — chapter status / visibility save.
    path(
        "api/chapter/<int:chapter_id>/status/",
        views_api_chapter.api_bookwriter_chapter_status_save,
        name="api_chapter_status_save",
    ),

    # Phase 1B Step 14 — plot card promote-to-chapter.
    path(
        "api/plot-card/<int:plot_card_id>/link-chapter/",
        views_api_writing_artifacts.api_bookwriter_plot_card_link_chapter,
        name="api_plot_card_link_chapter",
    ),

    # Phase 1B Step 15 — beta reader management.
    path(
        "api/book/<int:book_id>/beta-reader/invite/",
        views_api_collaboration.api_bookwriter_book_beta_reader_invite,
        name="api_book_beta_reader_invite",
    ),
    path(
        "api/book/<int:book_id>/beta-readers/",
        views_api_collaboration.api_bookwriter_book_beta_reader_list,
        name="api_book_beta_reader_list",
    ),
    path(
        "api/beta-reader/<int:beta_reader_id>/remove/",
        views_api_collaboration.api_bookwriter_beta_reader_remove,
        name="api_beta_reader_remove",
    ),

    # Phase 1B Step 16 — beta reader comments on chapters.
    path(
        "api/chapter/<int:chapter_id>/beta-comment/create/",
        views_api_collaboration.api_bookwriter_chapter_beta_comment_create,
        name="api_chapter_beta_comment_create",
    ),
    path(
        "api/chapter/<int:chapter_id>/beta-comments/",
        views_api_collaboration.api_bookwriter_chapter_beta_comment_list,
        name="api_chapter_beta_comment_list",
    ),
    path(
        "api/beta-comment/<int:beta_comment_id>/resolve/",
        views_api_collaboration.api_bookwriter_beta_comment_resolve,
        name="api_beta_comment_resolve",
    ),
    path(
        "api/beta-comment/<int:beta_comment_id>/delete/",
        views_api_collaboration.api_bookwriter_beta_comment_delete,
        name="api_beta_comment_delete",
    ),

    # Phase 1B Step 17 — public reader engagement.
    path(
        "api/book/<int:book_id>/subscribe/toggle/",
        views_api_book.api_bookwriter_book_subscribe_toggle,
        name="api_book_subscribe_toggle",
    ),
    path(
        "api/release/<int:serial_release_id>/reaction/toggle/",
        views_api_collaboration.api_bookwriter_release_reaction_toggle,
        name="api_release_reaction_toggle",
    ),
    path(
        "api/release/<int:serial_release_id>/comment/create/",
        views_api_collaboration.api_bookwriter_release_comment_create,
        name="api_release_comment_create",
    ),
    path(
        "api/release/<int:serial_release_id>/comments/",
        views_api_collaboration.api_bookwriter_release_comment_list,
        name="api_release_comment_list",
    ),
    path(
        "api/serial-comment/<int:comment_id>/pin/",
        views_api_collaboration.api_bookwriter_serial_comment_pin,
        name="api_serial_comment_pin",
    ),
    path(
        "api/serial-comment/<int:comment_id>/delete/",
        views_api_collaboration.api_bookwriter_serial_comment_delete,
        name="api_serial_comment_delete",
    ),
    path(
        "api/release/<int:serial_release_id>/view/",
        views_api_collaboration.api_bookwriter_release_view_record,
        name="api_release_view_record",
    ),
    path(
        "api/release/<int:serial_release_id>/preview-impression/",
        views_api_collaboration.api_bookwriter_release_preview_impression,
        name="api_release_preview_impression",
    ),

    # Phase 1B Step 18 — reference list dispatcher (standalone module).
    path(
        "api/refs/<slug:ref_group_code>/",
        views_api_refs.api_bookwriter_ref_list,
        name="api_ref_list",
    ),

    # Owner preview reader — full book in the 3D leather-bound reader.
    # Lives ABOVE the public-chapter slug pattern so a numeric path like
    # /bookwriter/read/123/ binds to this view (int converter), not the
    # slug converter below (which would also match "123" lexically).
    path(
        "read/<int:book_id>/",
        views.bookwriter_book_reader,
        name="read",
    ),

    # Public reader pages (no auth required).
    path(
        "read/<slug:public_chapter_slug>/",
        views.bookwriter_public_chapter_reader,
        name="public_chapter_reader",
    ),
    path(
        "beta/<str:share_link_token>/",
        views.bookwriter_beta_chapter_reader,
        name="beta_chapter_reader",
    ),
]
