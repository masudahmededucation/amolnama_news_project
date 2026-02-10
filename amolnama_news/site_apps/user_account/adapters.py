from allauth.socialaccount.adapter import DefaultSocialAccountAdapter

from .services import assign_user_to_group, GROUP_VISITOR


class CustomSocialAccountAdapter(DefaultSocialAccountAdapter):
    """Assign new social-login users to the Visitor group and
    tag the request with the social provider for auth tracking."""

    def pre_social_login(self, request, sociallogin):
        """Tag the request so track_auth_event() knows the provider.

        Fires for BOTH new signups and returning logins.
        """
        super().pre_social_login(request, sociallogin)
        request._auth_method = sociallogin.account.provider

    def save_user(self, request, sociallogin, form=None):
        """Only called for NEW social signups."""
        user = super().save_user(request, sociallogin, form)
        assign_user_to_group(user, GROUP_VISITOR)
        return user
