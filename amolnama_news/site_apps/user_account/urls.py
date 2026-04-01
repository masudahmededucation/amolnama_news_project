from django.urls import path

from . import views

app_name = "user_account"

urlpatterns = [
    path("login/", views.login_view, name="login"),
    path("login/mobile/", views.mobile_login_view, name="mobile_login"),
    path("signup/", views.signup_view, name="signup"),
    path("signup/verify/", views.signup_verify_view, name="signup_verify"),
    path("signup/complete/", views.signup_complete_view, name="signup_complete"),
    path("signup/mobile/", views.mobile_signup_view, name="mobile_signup"),
    path("signup/mobile/verify/", views.mobile_verify_view, name="mobile_verify"),
    path("signup/mobile/password/", views.mobile_set_password_view, name="mobile_set_password"),
    path("password/forgot/", views.forgot_password_view, name="forgot_password"),
    path("password/forgot/phone/", views.forgot_password_phone_view, name="forgot_password_phone"),
    path("password/forgot/verify/", views.forgot_password_verify_view, name="forgot_password_verify"),
    path("password/forgot/reset/", views.forgot_password_reset_view, name="forgot_password_reset"),
    path("logout/", views.logout_view, name="logout"),
    # JSON APIs for cascading location dropdowns
    path("api/upazilas/", views.api_upazilas, name="api_upazilas"),
    path("api/union-parishads/", views.api_union_parishads, name="api_union_parishads"),
    # JSON API — user preferences
    path("api/language-pref/", views.api_user_language_pref_save, name="api_language_pref_save"),
]
