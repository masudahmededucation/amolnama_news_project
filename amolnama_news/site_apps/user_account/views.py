from django.contrib import messages
from django.contrib.auth import login, logout
from django.contrib.auth.decorators import login_required
from django.db import transaction
from django.http import JsonResponse
from django.shortcuts import redirect, render
from django.utils import timezone
from django.views.decorators.http import require_http_methods

from .forms import (
    ChangePasswordForm,
    ContactInfoForm,
    ForgotPasswordForm,
    ForgotPasswordPhoneForm,
    HomeAddressForm,
    LoginForm,
    MobileLoginForm,
    MobilePasswordForm,
    OTPVerifyForm,
    PersonalDetailsForm,
    PhoneForm,
    ResetPasswordForm,
    SignupEmailForm,
    SignupForm,
)
from .models import Email, Person, PersonAddress, Phone, UserProfile
from .otp import (
    clear_otp_from_session,
    clear_reset_otp,
    generate_otp,
    send_otp,
    send_otp_email,
    store_otp_in_session,
    store_reset_otp,
    verify_otp_from_session,
    verify_reset_otp,
)
from .services import (
    AUTH_METHOD_EMAIL,
    AUTH_METHOD_PHONE,
    authenticate_user,
    authenticate_user_by_phone,
    normalize_phone,
    register_user,
    register_user_by_phone,
)

EMAIL_AUTH_BACKEND = (
    "amolnama_news.site_apps.user_account.backends.EmailAuthBackend"
)


def _build_full_phone(data):
    """Concatenate country code + local number, stripping leading zeros."""
    code = data.get("country") or None
    number = data.get("mobile_number") or None
    if number:
        number = number.lstrip("0") or None
    if code and number:
        return f"{code}{number}"
    return number


def _split_full_phone(full_phone):
    """Split a stored phone like '+8801712345678' into (code, local).

    Tries known country-code prefixes longest-first so +880 matches
    before +88.  Returns (code, local) or ("", full_phone) if no match.
    """
    from amolnama_news.site_apps.locations.forms import COUNTRY_CHOICES

    codes = set()
    for _group, options in COUNTRY_CHOICES:
        for value, _label in options:
            codes.add(value)
    # Try longest codes first (+880 before +88)
    for code in sorted(codes, key=len, reverse=True):
        if full_phone.startswith(code):
            return code, full_phone[len(code):]
    return "", full_phone


@require_http_methods(["GET", "POST"])
def login_view(request):
    if request.user.is_authenticated:
        return redirect("/")

    form = LoginForm(request.POST or None)
    if request.method == "POST" and form.is_valid():
        user = authenticate_user(
            request,
            email=form.cleaned_data["email"],
            password=form.cleaned_data["password"],
        )
        if user is not None:
            request._auth_method = AUTH_METHOD_EMAIL
            login(request, user, backend=EMAIL_AUTH_BACKEND)
            messages.success(request, "Welcome back!")
            next_url = request.GET.get("next", "/")
            return redirect(next_url)
        else:
            messages.error(request, "Invalid email or password.")

    return render(request, "user_account/login.html", {"form": form, "seo": {"noindex": True}})


@require_http_methods(["GET", "POST"])
def mobile_login_view(request):
    """Login with phone number + password."""
    if request.user.is_authenticated:
        return redirect("/")

    form = MobileLoginForm(request.POST or None)
    if request.method == "POST" and form.is_valid():
        full_phone = form.cleaned_data.get("full_phone", "")
        user = authenticate_user_by_phone(
            request,
            phone=full_phone,
            password=form.cleaned_data["password"],
        )
        if user is not None:
            request._auth_method = AUTH_METHOD_PHONE
            login(request, user, backend=EMAIL_AUTH_BACKEND)
            messages.success(request, "Welcome back!")
            next_url = request.GET.get("next", "/")
            return redirect(next_url)
        else:
            messages.error(request, "Invalid phone number or password.")

    return render(request, "user_account/mobile_login.html", {"form": form, "seo": {"noindex": True}})


@require_http_methods(["GET", "POST"])
def signup_view(request):
    """Step 1: social buttons + email field → send OTP."""
    if request.user.is_authenticated:
        return redirect("/")

    form = SignupEmailForm(request.POST or None)
    if request.method == "POST" and form.is_valid():
        email = form.cleaned_data["email"]
        code = generate_otp()
        store_otp_in_session(request.session, email, code)
        send_otp_email(email, code)
        messages.info(request, "OTP sent to your email.")
        return redirect("user_account:signup_verify")

    return render(request, "user_account/signup.html", {"form": form, "seo": {"noindex": True}})


@require_http_methods(["GET", "POST"])
def signup_verify_view(request):
    """Step 2: verify the OTP sent to the email."""
    if request.user.is_authenticated:
        return redirect("/")

    email = request.session.get("otp_phone")  # stored by store_otp_in_session
    if not email:
        return redirect("user_account:signup")

    # Mask email for display: t***@gmail.com
    local, domain = email.split("@", 1)
    if len(local) <= 1:
        masked = f"{local}***@{domain}"
    else:
        masked = f"{local[0]}***@{domain}"

    form = OTPVerifyForm(request.POST or None)
    if request.method == "POST" and form.is_valid():
        ok, error = verify_otp_from_session(
            request.session, form.cleaned_data["otp_code"]
        )
        if not ok:
            messages.error(request, error)
        else:
            clear_otp_from_session(request.session)
            request.session["signup_email_verified"] = email
            return redirect("user_account:signup_complete")

    return render(
        request,
        "user_account/signup_verify.html",
        {"form": form, "masked_email": masked, "seo": {"noindex": True}},
    )


@require_http_methods(["GET", "POST"])
def signup_complete_view(request):
    """Step 3: name + password to finish registration."""
    if request.user.is_authenticated:
        return redirect("/")

    email = request.session.get("signup_email_verified")
    if not email:
        return redirect("user_account:signup")

    if request.method == "POST":
        form = SignupForm(request.POST)
        if form.is_valid():
            try:
                with transaction.atomic():
                    user = register_user(
                        email=email,
                        password=form.cleaned_data["password"],
                    )

                    # Create Person + link to UserProfile BEFORE login()
                    # so track_auth_event sees link_person_id already set.
                    first = form.cleaned_data.get("first_name", "")
                    last = form.cleaned_data.get("last_name", "")
                    now = timezone.now()
                    person = Person.objects.create(
                        first_name_en=first or email,
                        last_name_en=last or "",
                        primary_email_address=email,
                        is_active=True,
                        created_at=now,
                        modified_at=now,
                    )
                    profile = UserProfile.objects.get(
                        link_user_account_user_id=user.pk,
                    )
                    profile.link_person_id = person.person_id
                    profile.display_name = (
                        f"{first} {last}".strip() or email
                    )
                    profile.updated_at = now
                    profile.save(update_fields=[
                        "link_person_id", "display_name", "updated_at",
                    ])

                    # Create Email record in contact.email
                    Email.objects.get_or_create(
                        link_person_id=person.person_id,
                        email_address=email,
                        defaults={
                            "is_primary": True,
                            "is_verified": True,
                        },
                    )

                del request.session["signup_email_verified"]
                request._auth_method = AUTH_METHOD_EMAIL
                login(request, user, backend=EMAIL_AUTH_BACKEND)
                messages.success(request, "Account created successfully!")
                return redirect("/")
            except Exception as e:
                messages.error(request, str(e))
    else:
        form = SignupForm(initial={"email": email})

    return render(
        request,
        "user_account/signup_complete.html",
        {"form": form, "email": email, "seo": {"noindex": True}},
    )


@require_http_methods(["POST"])
def logout_view(request):
    logout(request)
    messages.info(request, "You have been logged out.")
    return redirect("/")


# ── Mobile OTP signup ──────────────────────────────────────────────


@require_http_methods(["GET", "POST"])
def mobile_signup_view(request):
    """Enter phone number and receive an OTP."""
    if request.user.is_authenticated:
        return redirect("/")

    form = PhoneForm(request.POST or None)
    if request.method == "POST" and form.is_valid():
        phone = normalize_phone(form.cleaned_data["full_phone"])
        code = generate_otp()
        store_otp_in_session(request.session, phone, code)
        send_otp(phone, code)
        messages.info(request, "OTP sent to your phone.")
        return redirect("user_account:mobile_verify")

    return render(request, "user_account/mobile_signup.html", {"form": form, "seo": {"noindex": True}})


@require_http_methods(["GET", "POST"])
def mobile_verify_view(request):
    """Verify the OTP code sent to the phone."""
    if request.user.is_authenticated:
        return redirect("/")

    phone = request.session.get("otp_phone")
    if not phone:
        return redirect("user_account:mobile_signup")

    phone = normalize_phone(phone)

    # Mask phone for display: show last 4 digits only
    masked = phone[:-4].replace(phone[:-4], "*" * len(phone[:-4])) + phone[-4:]

    form = OTPVerifyForm(request.POST or None)
    if request.method == "POST" and form.is_valid():
        ok, error = verify_otp_from_session(
            request.session, form.cleaned_data["otp_code"]
        )
        if not ok:
            messages.error(request, error)
        else:
            clear_otp_from_session(request.session)
            # Check if a user with this phone already exists
            from django.contrib.auth import get_user_model

            User = get_user_model()
            try:
                user = User.objects.get(user_auth_provider_key=phone)
                request._auth_method = AUTH_METHOD_PHONE
                login(request, user, backend=EMAIL_AUTH_BACKEND)
                messages.success(request, "Welcome back!")
                return redirect("/")
            except User.DoesNotExist:
                # New user — phone verified, now set up a password
                request.session["verified_phone"] = phone
                return redirect("user_account:mobile_set_password")

    return render(
        request,
        "user_account/mobile_verify.html",
        {"form": form, "masked_phone": masked, "seo": {"noindex": True}},
    )


@require_http_methods(["GET", "POST"])
def mobile_set_password_view(request):
    """Set password after mobile OTP verification (new users only)."""
    if request.user.is_authenticated:
        return redirect("/")

    phone = request.session.get("verified_phone")
    if not phone:
        return redirect("user_account:mobile_signup")

    form = MobilePasswordForm(request.POST or None)
    if request.method == "POST" and form.is_valid():
        try:
            with transaction.atomic():
                user = register_user_by_phone(
                    phone=phone,
                    password=form.cleaned_data["password"],
                )

                # Create Person + link to UserProfile BEFORE login()
                # so track_auth_event sees link_person_id already set.
                first = form.cleaned_data.get("first_name", "")
                last = form.cleaned_data.get("last_name", "")
                now = timezone.now()
                person = Person.objects.create(
                    first_name_en=first or phone,
                    last_name_en=last or "",
                    primary_mobile_number=phone,
                    is_active=True,
                    created_at=now,
                    modified_at=now,
                )
                profile = UserProfile.objects.get(
                    link_user_account_user_id=user.pk,
                )
                profile.link_person_id = person.person_id
                profile.display_name = f"{first} {last}".strip() or phone
                profile.updated_at = now
                profile.save(update_fields=[
                    "link_person_id", "display_name", "updated_at",
                ])

                # Create Phone record in contact.phone
                country_code = "+880"
                local_number = phone
                if phone.startswith("+880"):
                    country_code = "+880"
                    local_number = phone[4:]
                elif phone.startswith("+"):
                    country_code = phone[:4]
                    local_number = phone[4:]
                Phone.objects.get_or_create(
                    link_person_id=person.person_id,
                    phone_number=local_number,
                    defaults={
                        "country_calling_code": country_code,
                        "is_primary": True,
                    },
                )

            del request.session["verified_phone"]
            request._auth_method = AUTH_METHOD_PHONE
            login(request, user, backend=EMAIL_AUTH_BACKEND)
            messages.success(request, "Account created successfully!")
            return redirect("/")
        except Exception as e:
            messages.error(request, str(e))

    masked = phone[:-4].replace(phone[:-4], "*" * len(phone[:-4])) + phone[-4:]
    return render(
        request,
        "user_account/mobile_set_password.html",
        {"form": form, "masked_phone": masked, "seo": {"noindex": True}},
    )


# ── Forgot password (OTP-based reset) ─────────────────────────────


@require_http_methods(["GET", "POST"])
def forgot_password_view(request):
    """Step 1 (email path): enter email to receive reset OTP."""
    form = ForgotPasswordForm(request.POST or None)
    if request.method == "POST" and form.is_valid():
        email = form.cleaned_data["email"]
        from django.contrib.auth import get_user_model
        User = get_user_model()
        user = User.objects.get(email=email)

        code = generate_otp()
        store_reset_otp(request.session, email, code)
        request.session["reset_user_pk"] = user.pk
        send_otp_email(email, code)
        messages.info(request, "OTP sent to your email.")
        return redirect("user_account:forgot_password_verify")

    return render(request, "user_account/forgot_password.html", {"form": form, "seo": {"noindex": True}})


@require_http_methods(["GET", "POST"])
def forgot_password_phone_view(request):
    """Step 1 (phone path): enter phone to receive reset OTP."""
    form = ForgotPasswordPhoneForm(request.POST or None)
    if request.method == "POST" and form.is_valid():
        full_phone = form.cleaned_data["full_phone"]
        from django.contrib.auth import get_user_model
        User = get_user_model()
        user = User.objects.get(user_auth_provider_key=full_phone)

        code = generate_otp()
        masked = "*" * (len(full_phone) - 4) + full_phone[-4:]
        store_reset_otp(request.session, masked, code)
        request.session["reset_user_pk"] = user.pk
        send_otp(full_phone, code)
        messages.info(request, "OTP sent to your phone.")
        return redirect("user_account:forgot_password_verify")

    return render(
        request, "user_account/forgot_password_phone.html", {"form": form, "seo": {"noindex": True}},
    )


@require_http_methods(["GET", "POST"])
def forgot_password_verify_view(request):
    """Step 2: verify the OTP code."""
    if "reset_otp_code" not in request.session:
        return redirect("user_account:login")

    identifier = request.session.get("reset_identifier", "")

    form = OTPVerifyForm(request.POST or None)
    if request.method == "POST" and form.is_valid():
        ok, error = verify_reset_otp(
            request.session, form.cleaned_data["otp_code"],
        )
        if not ok:
            messages.error(request, error)
        else:
            # OTP verified — allow password reset
            request.session["reset_verified"] = True
            # Clear OTP keys but keep reset_user_pk and reset_verified
            request.session.pop("reset_otp_code", None)
            request.session.pop("reset_otp_created_at", None)
            return redirect("user_account:forgot_password_reset")

    return render(
        request,
        "user_account/forgot_password_verify.html",
        {"form": form, "identifier": identifier, "seo": {"noindex": True}},
    )


@require_http_methods(["GET", "POST"])
def forgot_password_reset_view(request):
    """Step 3: set new password after OTP verification."""
    if not request.session.get("reset_verified") or \
       not request.session.get("reset_user_pk"):
        return redirect("user_account:login")

    form = ResetPasswordForm(request.POST or None)
    if request.method == "POST" and form.is_valid():
        from django.contrib.auth import get_user_model
        User = get_user_model()
        try:
            user = User.objects.get(pk=request.session["reset_user_pk"])
            user.set_password(form.cleaned_data["password"])
            user.save(update_fields=["password"])
            clear_reset_otp(request.session)
            messages.success(
                request, "Password reset successfully. Please log in.",
            )
            return redirect("user_account:login")
        except User.DoesNotExist:
            clear_reset_otp(request.session)
            messages.error(request, "Account not found. Please try again.")
            return redirect("user_account:login")

    return render(
        request, "user_account/forgot_password_reset.html", {"form": form, "seo": {"noindex": True}},
    )


# ── Profile ───────────────────────────────────────────────────────


def _load_person_and_profile(user):
    """Shared helper: return (profile, person) for the logged-in user."""
    try:
        profile = UserProfile.objects.get(link_user_account_user_id=user.pk)
    except UserProfile.DoesNotExist:
        profile = UserProfile.objects.create(
            link_user_account_user_id=user.pk,
            created_at=timezone.now(),
        )

    person = None
    if profile.link_person_id:
        try:
            person = Person.objects.get(person_id=profile.link_person_id)
        except Person.DoesNotExist:
            pass

    return profile, person


# ── Location JSON APIs (for cascading dropdowns) ─────────────────


@require_http_methods(["GET"])
def api_upazilas(request):
    """Return upazilas for a given district_id as JSON."""
    from amolnama_news.site_apps.locations.models import Upazila

    district_id = request.GET.get("district_id")
    if not district_id:
        return JsonResponse([], safe=False)

    upazilas = (
        Upazila.objects
        .filter(link_district_id=district_id, is_active=True)
        .order_by("upazila_name_en")
        .values("upazila_id", "upazila_name_en")
    )
    return JsonResponse(list(upazilas), safe=False)


@require_http_methods(["GET"])
def api_union_parishads(request):
    """Return union parishads for a given upazila_id as JSON."""
    from amolnama_news.site_apps.locations.models import UnionParishad

    upazila_id = request.GET.get("upazila_id")
    if not upazila_id:
        return JsonResponse([], safe=False)

    unions = (
        UnionParishad.objects
        .filter(link_upazila_id=upazila_id, is_active=True)
        .order_by("union_parishad_name_en")
        .values("union_parishad_id", "union_parishad_name_en")
    )
    return JsonResponse(list(unions), safe=False)


@login_required
@require_http_methods(["POST"])
def api_user_language_pref_save(request):
    """Save the user's preferred form UI language (bn/en) to their profile."""
    lang = request.POST.get('lang', '').lower()
    if lang not in ('bn', 'en'):
        return JsonResponse({'ok': False, 'error': 'Invalid language'}, status=400)
    try:
        profile = UserProfile.objects.get(link_user_account_user_id=request.user.pk)
        profile.language_pref = lang
        profile.save(update_fields=['language_pref'])
    except UserProfile.DoesNotExist:
        return JsonResponse({'ok': False, 'error': 'Profile not found'}, status=404)
    return JsonResponse({'ok': True, 'lang': lang})
