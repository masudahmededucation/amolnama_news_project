from django.urls import path
from . import views

app_name = "core"

urlpatterns = [
    # Home page at "/"
    path("", views.home, name="home"),

    # Article detail: /article/some-slug/
    path("article/<str:slug>/", views.article_detail, name="article_detail"),

    # Category listing: /category/world/
    path("category/<str:slug>/", views.category, name="category"),

    # Static pages
    path("about/", views.about, name="about"),
    path("contact/", views.contact, name="contact"),
    path("communityvoice/", views.communityvoice, name="communityvoice"),

]
