"""
User account services — user creation with Django Group assignment.
"""
from django.contrib.auth import authenticate, get_user_model
from django.contrib.auth.models import Group

User = get_user_model()

# Standard group names used across the project
GROUP_VISITOR = "Visitor"
GROUP_STAFF = "Staff"
GROUP_JOURNALIST = "Journalist"
GROUP_MODERATOR = "Moderator"

# Groups that public self-registration is allowed to assign
SELF_REGISTRATION_GROUPS = {GROUP_VISITOR}


def assign_user_to_group(user, group_name: str):
    """Add user to a Django Group (creates the Group if it does not exist)."""
    group, _ = Group.objects.get_or_create(name=group_name)
    user.groups.add(group)


def register_user(
    email: str,
    password: str,
    first_name: str = "",
    last_name: str = "",
    group_name: str = GROUP_VISITOR,
):
    """Create a new user and assign to the given group."""
    if group_name not in SELF_REGISTRATION_GROUPS:
        raise ValueError(
            f"Self-registration is not allowed for group '{group_name}'."
        )
    user = User.objects.create_user(
        email=(email or "").strip().lower(),
        password=password,
        first_name=first_name or "",
        last_name=last_name or "",
    )
    assign_user_to_group(user, group_name)
    return user


def authenticate_user(email: str, password: str):
    """Authenticate by email and password."""
    return authenticate(username=(email or "").strip().lower(), password=password)
