from django.urls import path
from . import views

app_name = "tools"

urlpatterns = [
    path("", views.tools, name="tools"),
    path("reduce-file-size/", views.tools_reduce_file_size, name="tools_reduce_file_size"),
    path("file-conversion/", views.tools_file_conversion, name="tools_file_conversion"),
    path("zip-creator/", views.tools_zip_creator, name="tools_zip_creator"),
    path("passport-photo-resizer/", views.tools_passport_photo_resizer, name="tools_passport_photo_resizer"),
    path("background-remover/", views.tools_background_remover, name="tools_background_remover"),
    path("merge-documents/", views.tools_merge_documents, name="tools_merge_documents"),
    path("split-pdf/", views.tools_split_pdf, name="tools_split_pdf"),
    path("photo-album/", views.tools_photo_album, name="tools_photo_album"),
    path("gpa-calculator/", views.tools_gpa_calculator, name="tools_gpa_calculator"),
    path("age-calculator/", views.tools_age_calculator, name="tools_age_calculator"),
    path("api/transliterate/", views.api_transliterate, name="api_transliterate"),
    path("api/file-conversion-map/", views.api_file_conversion_map, name="api_file_conversion_map"),
]
