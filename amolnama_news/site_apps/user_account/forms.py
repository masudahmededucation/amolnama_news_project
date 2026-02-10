from django import forms
from django.contrib.auth import get_user_model
from django.core.validators import MinLengthValidator, RegexValidator

from amolnama_news.site_apps.core.validators import validate_nid, validate_no_html

User = get_user_model()
from amolnama_news.site_apps.locations.forms import AddressFieldsMixin

# ── Name validators ──────────────────────────────────────────────
_validate_name_en = RegexValidator(
    regex=r"^[a-zA-Z\s.'\-]+$",
    message="English letters, spaces, hyphens, apostrophes, and dots only.",
)
_validate_name_bn = RegexValidator(
    regex=r"^[\u0980-\u09FF\s.\-]+$",
    message="Bengali characters, spaces, hyphens, and dots only.",
)
_validate_name_min = MinLengthValidator(2, message="Must be at least 2 characters.")

# ── Contact validators ────────────────────────────────────────────
_validate_bd_mobile = RegexValidator(
    regex=r"^0?1[3-9]\d{8}$",
    message="Enter a valid Bangladesh mobile number (e.g. 01712345678).",
)
_validate_email_address = RegexValidator(
    regex=r"^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$",
    message="Enter a valid email address.",
)


class SignupEmailForm(forms.Form):
    """Step 1: collect email only."""
    email = forms.EmailField(
        widget=forms.EmailInput(attrs={
            "placeholder": "Email address",
            "autocomplete": "email",
        })
    )

    def clean_email(self):
        email = self.cleaned_data["email"].strip().lower()
        if User.objects.filter(email=email).exists():
            raise forms.ValidationError(
                "An account with this email already exists. Please log in."
            )
        return email


class LoginForm(forms.Form):
    email = forms.EmailField(
        widget=forms.EmailInput(attrs={
            "placeholder": "Email address",
            "autofocus": True,
            "autocomplete": "email",
        })
    )
    password = forms.CharField(
        widget=forms.PasswordInput(attrs={
            "placeholder": "Password",
            "autocomplete": "current-password",
        })
    )


class SignupForm(forms.Form):
    first_name = forms.CharField(
        max_length=150,
        required=False,
        validators=[_validate_name_en, _validate_name_min],
        widget=forms.TextInput(attrs={"placeholder": "First name"}),
    )
    last_name = forms.CharField(
        max_length=150,
        required=False,
        validators=[_validate_name_en, _validate_name_min],
        widget=forms.TextInput(attrs={"placeholder": "Last name"}),
    )
    email = forms.EmailField(
        widget=forms.EmailInput(attrs={
            "placeholder": "Email address",
            "autocomplete": "email",
        })
    )
    password = forms.CharField(
        min_length=8,
        widget=forms.PasswordInput(attrs={
            "placeholder": "Password (min 8 characters)",
            "autocomplete": "new-password",
        }),
    )
    password_confirm = forms.CharField(
        min_length=8,
        widget=forms.PasswordInput(attrs={
            "placeholder": "Confirm password",
            "autocomplete": "new-password",
        }),
    )

    def clean_first_name(self):
        val = (self.cleaned_data.get("first_name") or "").strip()
        return val.title() if val else val

    def clean_last_name(self):
        val = (self.cleaned_data.get("last_name") or "").strip()
        return val.title() if val else val

    def clean(self):
        cleaned = super().clean()
        pw = cleaned.get("password")
        pw2 = cleaned.get("password_confirm")
        if pw and pw2 and pw != pw2:
            self.add_error("password_confirm", "Passwords do not match.")
        return cleaned


COUNTRY_CODE_CHOICES = [
    ("Popular", [
        ("+880", "\U0001F1E7\U0001F1E9 Bangladesh (+880)"),
        ("+966", "\U0001F1F8\U0001F1E6 Saudi Arabia (+966)"),
        ("+971", "\U0001F1E6\U0001F1EA UAE (+971)"),
        ("+60", "\U0001F1F2\U0001F1FE Malaysia (+60)"),
        ("+968", "\U0001F1F4\U0001F1F2 Oman (+968)"),
    ]),
    ("All Countries", [
        ("+61", "\U0001F1E6\U0001F1FA Australia (+61)"),
        ("+43", "\U0001F1E6\U0001F1F9 Austria (+43)"),
        ("+973", "\U0001F1E7\U0001F1ED Bahrain (+973)"),
        ("+32", "\U0001F1E7\U0001F1EA Belgium (+32)"),
        ("+55", "\U0001F1E7\U0001F1F7 Brazil (+55)"),
        ("+673", "\U0001F1E7\U0001F1F3 Brunei (+673)"),
        ("+855", "\U0001F1F0\U0001F1ED Cambodia (+855)"),
        ("+1", "\U0001F1E8\U0001F1E6 Canada (+1)"),
        ("+357", "\U0001F1E8\U0001F1FE Cyprus (+357)"),
        ("+420", "\U0001F1E8\U0001F1FF Czechia (+420)"),
        ("+45", "\U0001F1E9\U0001F1F0 Denmark (+45)"),
        ("+358", "\U0001F1EB\U0001F1EE Finland (+358)"),
        ("+33", "\U0001F1EB\U0001F1F7 France (+33)"),
        ("+49", "\U0001F1E9\U0001F1EA Germany (+49)"),
        ("+30", "\U0001F1EC\U0001F1F7 Greece (+30)"),
        ("+36", "\U0001F1ED\U0001F1FA Hungary (+36)"),
        ("+964", "\U0001F1EE\U0001F1F6 Iraq (+964)"),
        ("+353", "\U0001F1EE\U0001F1EA Ireland (+353)"),
        ("+39", "\U0001F1EE\U0001F1F9 Italy (+39)"),
        ("+81", "\U0001F1EF\U0001F1F5 Japan (+81)"),
        ("+962", "\U0001F1EF\U0001F1F4 Jordan (+962)"),
        ("+965", "\U0001F1F0\U0001F1FC Kuwait (+965)"),
        ("+996", "\U0001F1F0\U0001F1EC Kyrgyzstan (+996)"),
        ("+961", "\U0001F1F1\U0001F1E7 Lebanon (+961)"),
        ("+218", "\U0001F1F1\U0001F1FE Libya (+218)"),
        ("+960", "\U0001F1F2\U0001F1FB Maldives (+960)"),
        ("+230", "\U0001F1F2\U0001F1FA Mauritius (+230)"),
        ("+31", "\U0001F1F3\U0001F1F1 Netherlands (+31)"),
        ("+64", "\U0001F1F3\U0001F1FF New Zealand (+64)"),
        ("+47", "\U0001F1F3\U0001F1F4 Norway (+47)"),
        ("+48", "\U0001F1F5\U0001F1F1 Poland (+48)"),
        ("+351", "\U0001F1F5\U0001F1F9 Portugal (+351)"),
        ("+974", "\U0001F1F6\U0001F1E6 Qatar (+974)"),
        ("+40", "\U0001F1F7\U0001F1F4 Romania (+40)"),
        ("+7", "\U0001F1F7\U0001F1FA Russia (+7)"),
        ("+966", "\U0001F1F8\U0001F1E6 Saudi Arabia (+966)"),
        ("+248", "\U0001F1F8\U0001F1E8 Seychelles (+248)"),
        ("+65", "\U0001F1F8\U0001F1EC Singapore (+65)"),
        ("+27", "\U0001F1FF\U0001F1E6 South Africa (+27)"),
        ("+82", "\U0001F1F0\U0001F1F7 South Korea (+82)"),
        ("+34", "\U0001F1EA\U0001F1F8 Spain (+34)"),
        ("+46", "\U0001F1F8\U0001F1EA Sweden (+46)"),
        ("+41", "\U0001F1E8\U0001F1ED Switzerland (+41)"),
        ("+90", "\U0001F1F9\U0001F1F7 Turkey (+90)"),
        ("+44", "\U0001F1EC\U0001F1E7 UK (+44)"),
        ("+1", "\U0001F1FA\U0001F1F8 USA (+1)"),
    ]),
]


class MobileLoginForm(forms.Form):
    """Login with mobile number + password."""
    country_code = forms.ChoiceField(
        choices=COUNTRY_CODE_CHOICES,
        initial="+880",
    )
    phone = forms.CharField(
        max_length=15,
        validators=[
            RegexValidator(
                regex=r"^[0-9]{4,14}$",
                message="Enter digits only (without country code).",
            ),
        ],
        widget=forms.TextInput(attrs={
            "placeholder": "1XXXXXXXXX",
            "autocomplete": "tel-national",
            "inputmode": "tel",
        }),
    )
    password = forms.CharField(
        widget=forms.PasswordInput(attrs={
            "placeholder": "Password",
            "autocomplete": "current-password",
        })
    )

    def clean(self):
        cleaned = super().clean()
        code = cleaned.get("country_code", "")
        number = cleaned.get("phone", "")
        if code and number:
            number = number.lstrip("0")
            cleaned["full_phone"] = f"{code}{number}"
        return cleaned


class PhoneForm(forms.Form):
    """Collect a country code + phone number for OTP-based signup."""
    country_code = forms.ChoiceField(
        choices=COUNTRY_CODE_CHOICES,
        initial="+880",
    )
    phone = forms.CharField(
        max_length=15,
        validators=[
            RegexValidator(
                regex=r"^[0-9]{4,14}$",
                message="Enter digits only (without country code).",
            ),
        ],
        widget=forms.TextInput(attrs={
            "placeholder": "1XXXXXXXXX",
            "autocomplete": "tel-national",
            "inputmode": "tel",
        }),
    )

    def clean(self):
        cleaned = super().clean()
        code = cleaned.get("country_code", "")
        number = cleaned.get("phone", "")
        if code and number:
            # Strip leading zeros so +880 + 07831737648 → +8807831737648
            number = number.lstrip("0")
            full_phone = f"{code}{number}"
            cleaned["full_phone"] = full_phone
            if User.objects.filter(phone=full_phone).exists():
                raise forms.ValidationError(
                    "An account with this phone number already exists. "
                    "Please log in."
                )
        return cleaned


class OTPVerifyForm(forms.Form):
    """Collect the 6-digit OTP code."""
    otp_code = forms.CharField(
        min_length=6,
        max_length=6,
        widget=forms.TextInput(attrs={
            "placeholder": "Enter 6-digit code",
            "autocomplete": "one-time-code",
            "inputmode": "numeric",
            "maxlength": "6",
        }),
    )


class MobilePasswordForm(forms.Form):
    """Set password after mobile OTP verification."""
    password = forms.CharField(
        min_length=8,
        widget=forms.PasswordInput(attrs={
            "placeholder": "Password (min 8 characters)",
            "autocomplete": "new-password",
        }),
    )
    password_confirm = forms.CharField(
        min_length=8,
        widget=forms.PasswordInput(attrs={
            "placeholder": "Confirm password",
            "autocomplete": "new-password",
        }),
    )

    def clean(self):
        cleaned = super().clean()
        pw = cleaned.get("password")
        pw2 = cleaned.get("password_confirm")
        if pw and pw2 and pw != pw2:
            self.add_error("password_confirm", "Passwords do not match.")
        return cleaned


class ForgotPasswordForm(forms.Form):
    """Step 1 (email path): enter email to receive a reset OTP."""
    email = forms.EmailField(
        widget=forms.EmailInput(attrs={
            "placeholder": "Email address",
            "autofocus": True,
            "autocomplete": "email",
        })
    )

    def clean_email(self):
        email = self.cleaned_data["email"].strip().lower()
        if not User.objects.filter(email=email).exists():
            raise forms.ValidationError(
                "No account found with this email address."
            )
        return email


class ForgotPasswordPhoneForm(forms.Form):
    """Step 1 (phone path): enter phone to receive a reset OTP."""
    country_code = forms.ChoiceField(
        choices=COUNTRY_CODE_CHOICES,
        initial="+880",
    )
    phone = forms.CharField(
        max_length=15,
        validators=[
            RegexValidator(
                regex=r"^[0-9]{4,14}$",
                message="Enter digits only (without country code).",
            ),
        ],
        widget=forms.TextInput(attrs={
            "placeholder": "1XXXXXXXXX",
            "autocomplete": "tel-national",
            "inputmode": "tel",
        }),
    )

    def clean(self):
        cleaned = super().clean()
        code = cleaned.get("country_code", "")
        number = cleaned.get("phone", "")
        if code and number:
            number = number.lstrip("0")
            full_phone = f"{code}{number}"
            cleaned["full_phone"] = full_phone
            if not User.objects.filter(phone=full_phone).exists():
                raise forms.ValidationError(
                    "No account found with this phone number."
                )
        return cleaned


class ResetPasswordForm(forms.Form):
    """Set a new password after OTP verification."""
    password = forms.CharField(
        min_length=8,
        widget=forms.PasswordInput(attrs={
            "placeholder": "New password (min 8 characters)",
            "autocomplete": "new-password",
        }),
    )
    password_confirm = forms.CharField(
        min_length=8,
        widget=forms.PasswordInput(attrs={
            "placeholder": "Confirm new password",
            "autocomplete": "new-password",
        }),
    )

    def clean(self):
        cleaned = super().clean()
        pw = cleaned.get("password")
        pw2 = cleaned.get("password_confirm")
        if pw and pw2 and pw != pw2:
            self.add_error("password_confirm", "Passwords do not match.")
        return cleaned


class PersonalDetailsForm(forms.Form):
    """Personal details: names, DOB, gender, religion, NID, notes."""

    # ── Name (English) ──
    first_name_en = forms.CharField(
        max_length=100,
        validators=[_validate_name_en, _validate_name_min],
        widget=forms.TextInput(attrs={"placeholder": "First name (English)"}),
    )
    last_name_en = forms.CharField(
        max_length=100,
        validators=[_validate_name_en, _validate_name_min],
        widget=forms.TextInput(attrs={"placeholder": "Last name (English)"}),
    )

    # ── Name (Bengali) ──
    first_name_bn = forms.CharField(
        max_length=100,
        required=False,
        validators=[_validate_name_bn, _validate_name_min],
        widget=forms.TextInput(attrs={"placeholder": "\u09AA\u09CD\u09B0\u09A5\u09AE \u09A8\u09BE\u09AE (\u09AC\u09BE\u0982\u09B2\u09BE)"}),
    )
    last_name_bn = forms.CharField(
        max_length=100,
        required=False,
        validators=[_validate_name_bn, _validate_name_min],
        widget=forms.TextInput(attrs={"placeholder": "\u09B6\u09C7\u09B7 \u09A8\u09BE\u09AE (\u09AC\u09BE\u0982\u09B2\u09BE)"}),
    )

    # ── Personal ──
    date_of_birth = forms.DateField(
        widget=forms.DateInput(attrs={
            "type": "date",
            "placeholder": "Date of birth",
        }),
    )
    link_gender_id = forms.ChoiceField(label="Gender")
    link_religion_id = forms.ChoiceField(label="Religion")

    # ── NID ──
    nid_number = forms.CharField(
        max_length=20,
        required=False,
        validators=[validate_nid],
        widget=forms.TextInput(attrs={
            "placeholder": "NID number (10 or 17 digits)",
            "inputmode": "numeric",
        }),
    )

    # ── Notes ──
    notes = forms.CharField(
        max_length=1000,
        required=False,
        validators=[validate_no_html],
        widget=forms.Textarea(attrs={
            "placeholder": "Notes",
            "rows": 3,
        }),
    )

    def clean_date_of_birth(self):
        import datetime
        dob = self.cleaned_data.get("date_of_birth")
        if dob and dob > datetime.date.today():
            raise forms.ValidationError("Date of birth cannot be a future date.")
        return dob

    def clean_first_name_en(self):
        val = (self.cleaned_data.get("first_name_en") or "").strip()
        return val.title() if val else val

    def clean_last_name_en(self):
        val = (self.cleaned_data.get("last_name_en") or "").strip()
        return val.title() if val else val

    def clean_first_name_bn(self):
        return (self.cleaned_data.get("first_name_bn") or "").strip()

    def clean_last_name_bn(self):
        return (self.cleaned_data.get("last_name_bn") or "").strip()

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        import datetime
        from .models import RefGender, RefReligion

        self.fields["date_of_birth"].widget.attrs["max"] = (
            datetime.date.today().isoformat()
        )

        genders = RefGender.objects.filter(is_active=True).order_by("gender_id")
        self.fields["link_gender_id"].choices = [("", "-- Select gender --")] + [
            (g.gender_id, g.gender_name_en) for g in genders
        ]

        religions = RefReligion.objects.filter(is_active=True).order_by("religion_id")
        self.fields["link_religion_id"].choices = [("", "-- Select religion --")] + [
            (r.religion_id, r.religion_name_en) for r in religions
        ]


class ContactInfoForm(forms.Form):
    """Contact info: mobile number with country code prefix, email."""

    country = forms.ChoiceField(
        choices=COUNTRY_CODE_CHOICES,
        initial="+880",
        required=False,
        label="Country code",
    )
    mobile_number = forms.CharField(
        max_length=15,
        required=False,
        validators=[_validate_bd_mobile],
        widget=forms.TextInput(attrs={
            "placeholder": "01XXXXXXXXX",
            "inputmode": "tel",
        }),
    )
    email_address = forms.CharField(
        max_length=255,
        required=False,
        validators=[_validate_email_address],
        widget=forms.EmailInput(attrs={
            "placeholder": "Update with your real email address",
        }),
    )

    def clean_mobile_number(self):
        val = (self.cleaned_data.get("mobile_number") or "").strip()
        val = val.replace(" ", "").replace("-", "")
        return val

    def clean_email_address(self):
        return (self.cleaned_data.get("email_address") or "").strip().lower()


class HomeAddressForm(AddressFieldsMixin, forms.Form):
    """Home address with cascading location dropdowns."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._init_address_fields()


class ChangePasswordForm(forms.Form):
    """Change password: current password + new password twice."""

    current_password = forms.CharField(
        widget=forms.PasswordInput(attrs={
            "placeholder": "Current password",
            "autocomplete": "current-password",
        }),
    )
    new_password = forms.CharField(
        min_length=8,
        widget=forms.PasswordInput(attrs={
            "placeholder": "New password (min 8 characters)",
            "autocomplete": "new-password",
        }),
    )
    new_password_confirm = forms.CharField(
        min_length=8,
        widget=forms.PasswordInput(attrs={
            "placeholder": "Confirm new password",
            "autocomplete": "new-password",
        }),
    )

    def __init__(self, *args, user=None, **kwargs):
        super().__init__(*args, **kwargs)
        self.user = user

    def clean_current_password(self):
        password = self.cleaned_data.get("current_password")
        if self.user and not self.user.check_password(password):
            raise forms.ValidationError("Current password is incorrect.")
        return password

    def clean(self):
        cleaned = super().clean()
        pw = cleaned.get("new_password")
        pw2 = cleaned.get("new_password_confirm")
        if pw and pw2 and pw != pw2:
            self.add_error("new_password_confirm", "Passwords do not match.")
        return cleaned


