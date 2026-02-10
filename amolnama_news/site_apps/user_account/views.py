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
    code = data.get("country", "")
    number = (data.get("mobile_number") or "").lstrip("0")
    if code and number:
        return f"{code}{number}"
    return number or None


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

    return render(request, "user_account/login.html", {"form": form})


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

    return render(request, "user_account/mobile_login.html", {"form": form})


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

    return render(request, "user_account/signup.html", {"form": form})


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
        {"form": form, "masked_email": masked},
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
        {"form": form, "email": email},
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

    return render(request, "user_account/mobile_signup.html", {"form": form})


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
                user = User.objects.get(phone=phone)
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
        {"form": form, "masked_phone": masked},
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
                now = timezone.now()
                person = Person.objects.create(
                    first_name_en=phone,
                    last_name_en="",
                    primary_mobile_number=phone,
                    is_active=True,
                    created_at=now,
                    modified_at=now,
                )
                profile = UserProfile.objects.get(
                    link_user_account_user_id=user.pk,
                )
                profile.link_person_id = person.person_id
                profile.display_name = phone
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
        {"form": form, "masked_phone": masked},
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

    return render(request, "user_account/forgot_password.html", {"form": form})


@require_http_methods(["GET", "POST"])
def forgot_password_phone_view(request):
    """Step 1 (phone path): enter phone to receive reset OTP."""
    form = ForgotPasswordPhoneForm(request.POST or None)
    if request.method == "POST" and form.is_valid():
        full_phone = form.cleaned_data["full_phone"]
        from django.contrib.auth import get_user_model
        User = get_user_model()
        user = User.objects.get(phone=full_phone)

        code = generate_otp()
        masked = "*" * (len(full_phone) - 4) + full_phone[-4:]
        store_reset_otp(request.session, masked, code)
        request.session["reset_user_pk"] = user.pk
        send_otp(full_phone, code)
        messages.info(request, "OTP sent to your phone.")
        return redirect("user_account:forgot_password_verify")

    return render(
        request, "user_account/forgot_password_phone.html", {"form": form},
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
        {"form": form, "identifier": identifier},
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
        request, "user_account/forgot_password_reset.html", {"form": form},
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


@login_required
def profile_redirect_view(request):
    """Redirect /profile/ → /profile/personal/."""
    return redirect("user_account:profile_personal")


@login_required
@require_http_methods(["GET", "POST"])
def profile_personal_view(request):
    """Edit personal details: names, DOB, gender, religion, NID, notes."""
    profile, person = _load_person_and_profile(request.user)

    if request.method == "POST":
        form = PersonalDetailsForm(request.POST)
        if form.is_valid():
            data = form.cleaned_data

            person_fields = {
                "first_name_en": data["first_name_en"],
                "last_name_en": data["last_name_en"],
                "first_name_bn": data.get("first_name_bn") or None,
                "last_name_bn": data.get("last_name_bn") or None,
                "date_of_birth": data.get("date_of_birth") or None,
                "link_gender_id": int(data["link_gender_id"]) if data.get("link_gender_id") else None,
                "link_religion_id": int(data["link_religion_id"]) if data.get("link_religion_id") else None,
                "nid_card_number": data.get("nid_number") or None,
                "notes": data.get("notes") or None,
                "modified_at": timezone.now(),
            }

            if person:
                for field, value in person_fields.items():
                    setattr(person, field, value)
                person.save(update_fields=list(person_fields.keys()))
            else:
                person_fields["is_active"] = True
                person_fields["created_at"] = timezone.now()
                person = Person.objects.create(**person_fields)
                profile.link_person_id = person.person_id
                profile.updated_at = timezone.now()
                profile.save(update_fields=["link_person_id", "updated_at"])

            # Sync display_name on UserProfile
            display = f"{data['first_name_en']} {data['last_name_en']}".strip()
            if display and profile:
                profile.display_name = display
                profile.updated_at = timezone.now()
                profile.save(update_fields=["display_name", "updated_at"])

            messages.success(request, "Personal details updated.")
            return redirect("user_account:profile_personal")
    else:
        initial = {}
        if person:
            initial = {
                "first_name_en": person.first_name_en or "",
                "last_name_en": person.last_name_en or "",
                "first_name_bn": person.first_name_bn or "",
                "last_name_bn": person.last_name_bn or "",
                "date_of_birth": person.date_of_birth,
                "link_gender_id": person.link_gender_id or "",
                "link_religion_id": person.link_religion_id or "",
                "nid_number": person.nid_card_number or "",
                "notes": person.notes or "",
            }
        form = PersonalDetailsForm(initial=initial)

    return render(request, "user_account/profile_personal.html", {
        "form": form,
        "active_tab": "personal",
    })


@login_required
@require_http_methods(["GET", "POST"])
def profile_contact_view(request):
    """Edit contact info: mobile number + email."""
    profile, person = _load_person_and_profile(request.user)

    if request.method == "POST":
        form = ContactInfoForm(request.POST)
        if form.is_valid():
            data = form.cleaned_data

            full_phone = _build_full_phone(data) or None
            email_val = data.get("email_address") or None

            # Ensure Person exists
            if not person:
                person = Person.objects.create(
                    first_name_en=request.user.email,
                    last_name_en="",
                    is_active=True,
                    created_at=timezone.now(),
                    modified_at=timezone.now(),
                )
                profile.link_person_id = person.person_id
                profile.updated_at = timezone.now()
                profile.save(update_fields=["link_person_id", "updated_at"])

            # Update Person's denormalized contact fields
            person.primary_mobile_number = full_phone
            person.primary_email_address = email_val
            person.modified_at = timezone.now()
            person.save(update_fields=[
                "primary_mobile_number", "primary_email_address", "modified_at",
            ])

            # Save or update Phone record
            phone_number = (data.get("mobile_number") or "").lstrip("0")
            country_code = data.get("country") or "+880"
            if phone_number:
                Phone.objects.update_or_create(
                    link_person_id=person.person_id,
                    is_active=True,
                    defaults={
                        "country_calling_code": country_code,
                        "phone_number": phone_number,
                        "is_primary": True,
                    },
                )

            # Save or update Email record
            if email_val:
                Email.objects.update_or_create(
                    link_person_id=person.person_id,
                    is_active=True,
                    defaults={
                        "email_address": email_val,
                        "is_primary": True,
                    },
                )

            messages.success(request, "Contact info updated.")
            return redirect("user_account:profile_contact")
    else:
        initial = {"country": "+880", "mobile_number": "", "email_address": ""}
        if person:
            phone_rec = Phone.objects.filter(
                link_person_id=person.person_id,
                is_active=True,
            ).first()
            if phone_rec:
                initial["country"] = phone_rec.country_calling_code or "+880"
                initial["mobile_number"] = phone_rec.phone_number or ""

            email_rec = Email.objects.filter(
                link_person_id=person.person_id,
                is_active=True,
            ).first()
            if email_rec:
                initial["email_address"] = email_rec.email_address or ""
        form = ContactInfoForm(initial=initial)

    return render(request, "user_account/profile_contact.html", {
        "form": form,
        "active_tab": "contact",
    })


@login_required
@require_http_methods(["GET", "POST"])
def profile_address_view(request):
    """Edit home address with cascading location dropdowns."""
    from amolnama_news.site_apps.locations.models import Address, Upazila

    profile, person = _load_person_and_profile(request.user)

    # Load existing address via PersonAddress junction table
    address = None
    if person:
        pa = PersonAddress.objects.filter(
            link_person_id=person.person_id,
            is_current=True,
            is_active=True,
        ).first()
        if pa:
            try:
                address = Address.objects.get(address_id=pa.link_address_id)
            except Address.DoesNotExist:
                pass

    if request.method == "POST":
        form = HomeAddressForm(request.POST)
        if form.is_valid():
            data = form.cleaned_data

            # Ensure Person exists
            if not person:
                person = Person.objects.create(
                    first_name_en=request.user.email,
                    last_name_en="",
                    is_active=True,
                    created_at=timezone.now(),
                    modified_at=timezone.now(),
                )
                profile.link_person_id = person.person_id
                profile.updated_at = timezone.now()
                profile.save(update_fields=["link_person_id", "updated_at"])

            # Save or update Address
            union_id = data.get("link_union_parishad_id") or None
            addr_line_1 = (data.get("address_line_one") or "").strip()
            addr_line_2 = data.get("address_line_two") or None
            city = (data.get("city_town") or "").strip()
            has_address = union_id or addr_line_1 or city

            if has_address:
                addr_fields = {
                    "link_union_parishad_id": union_id,
                    "address_line_one": addr_line_1,
                    "address_line_two": addr_line_2,
                    "local_area_name": data.get("local_area_name") or None,
                    "city_town": city,
                    "region_province_state_division": data.get("region_province_state_division") or None,
                    "postal_code": data.get("postal_code") or None,
                }
                if address:
                    for field, value in addr_fields.items():
                        setattr(address, field, value)
                    address.modified_at = timezone.now()
                    address.save()
                else:
                    address = Address.objects.create(
                        **addr_fields,
                        is_active=True,
                        created_at=timezone.now(),
                    )

            # Link Person ↔ Address via junction table
            if address:
                PersonAddress.objects.update_or_create(
                    link_person_id=person.person_id,
                    is_current=True,
                    defaults={
                        "link_address_id": address.address_id,
                        "is_active": True,
                        "updated_at": timezone.now(),
                    },
                )

            messages.success(request, "Address updated.")
            return redirect("user_account:profile_address")
    else:
        initial = {}
        if address:
            initial["address_line_one"] = address.address_line_one or ""
            initial["address_line_two"] = address.address_line_two or ""
            initial["local_area_name"] = address.local_area_name or ""
            initial["city_town"] = address.city_town or ""
            initial["region_province_state_division"] = address.region_province_state_division or ""
            initial["postal_code"] = address.postal_code or ""
            initial["link_union_parishad_id"] = address.link_union_parishad_id or ""
            # Derive district and upazila from union_parishad for cascading
            if address.link_union_parishad_id:
                try:
                    from amolnama_news.site_apps.locations.models import UnionParishad
                    up = UnionParishad.objects.get(
                        union_parishad_id=address.link_union_parishad_id
                    )
                    if up.link_upazila_id:
                        initial["link_upazila_id"] = up.link_upazila_id
                        upazila = Upazila.objects.filter(
                            upazila_id=up.link_upazila_id
                        ).first()
                        if upazila and upazila.link_district_id:
                            initial["link_district_id"] = upazila.link_district_id
                except UnionParishad.DoesNotExist:
                    pass
        form = HomeAddressForm(initial=initial)

    from django.urls import reverse

    return render(request, "user_account/profile_address.html", {
        "form": form,
        "active_tab": "address",
        "api_upazilas_url": reverse("user_account:api_upazilas"),
        "api_unions_url": reverse("user_account:api_union_parishads"),
    })


@login_required
@require_http_methods(["GET", "POST"])
def profile_settings_view(request):
    """Account settings — change password."""
    if request.method == "POST":
        form = ChangePasswordForm(request.POST, user=request.user)
        if form.is_valid():
            request.user.set_password(form.cleaned_data["new_password"])
            request.user.save(update_fields=["password"])
            # Re-authenticate so the user stays logged in after password change
            login(request, request.user, backend=EMAIL_AUTH_BACKEND)
            messages.success(request, "Password changed successfully.")
            return redirect("user_account:profile_settings")
    else:
        form = ChangePasswordForm(user=request.user)
    return render(request, "user_account/profile_settings.html", {
        "active_tab": "settings",
        "form": form,
    })


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
