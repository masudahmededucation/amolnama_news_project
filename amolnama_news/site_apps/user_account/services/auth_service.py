from django.contrib.auth import authenticate, get_user_model

User = get_user_model()

def register_user(email: str, password: str, first_name: str = "", last_name: str = ""):
    email = (email or "").strip().lower()
    return User.objects.create_user(
        email=email,
        password=password,
        first_name=first_name or "",
        last_name=last_name or "",
    )

def authenticate_user(email: str, password: str):
    return authenticate(username=(email or "").strip().lower(), password=password)
