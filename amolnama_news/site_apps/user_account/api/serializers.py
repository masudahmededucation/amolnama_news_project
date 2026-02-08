from rest_framework import serializers
from ..models import User, UserProfile


class UserProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserProfile
        fields = (
            "user_profile_id", "display_name", "age_years",
            "auth_provider", "is_phone_verified", "is_social_verified",
            "is_blocked", "last_login_at", "created_at",
        )
        read_only_fields = fields


class UserSerializer(serializers.ModelSerializer):
    groups = serializers.SlugRelatedField(
        many=True, read_only=True, slug_field="name",
    )

    class Meta:
        model = User
        fields = ("id", "email", "first_name", "last_name", "phone", "groups")
        read_only_fields = ("id", "groups")


class RegisterSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, min_length=8)
    first_name = serializers.CharField(required=False, allow_blank=True)
    last_name = serializers.CharField(required=False, allow_blank=True)


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)
