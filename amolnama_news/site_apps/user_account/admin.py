from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin
from .models import User, Profile, StaffUser, JournalistUser, ModeratorUser, UserRole

@admin.register(User)
class UserAdmin(DjangoUserAdmin):
    ordering = ("email",)
    list_display = ("email", "first_name", "last_name", "role", "is_staff", "is_active")
    list_filter = ("role", "is_staff", "is_active", "is_superuser")
    search_fields = ("email", "first_name", "last_name")
    fieldsets = (
        (None, {"fields": ("email", "password")}),
        ("Personal info", {"fields": ("first_name", "last_name", "phone", "profile_image", "date_of_birth", "bio")}),
        ("Permissions", {"fields": ("role", "is_active", "is_staff", "is_superuser", "groups", "user_permissions")}),
        ("Important dates", {"fields": ("last_login", "date_joined")}),
    )
    add_fieldsets = (
        (None, {"classes": ("wide",), "fields": ("email", "password1", "password2", "role")}),
    )

@admin.register(Profile)
class ProfileAdmin(admin.ModelAdmin):
    list_display = ("user", "website", "created_at")


# Separate admin sections per user type (proxy models)
@admin.register(StaffUser)
class StaffUserAdmin(UserAdmin):
    def get_queryset(self, request):
        return super().get_queryset(request).filter(role=UserRole.STAFF)

@admin.register(JournalistUser)
class JournalistUserAdmin(UserAdmin):
    def get_queryset(self, request):
        return super().get_queryset(request).filter(role=UserRole.JOURNALIST)

@admin.register(ModeratorUser)
class ModeratorUserAdmin(UserAdmin):
    def get_queryset(self, request):
        return super().get_queryset(request).filter(role=UserRole.MODERATOR)
