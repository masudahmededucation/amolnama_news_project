from django import forms

from amolnama_news.site_apps.core.validators import validate_no_html, validate_postal_code


COUNTRY_CHOICES = [
    ("Popular", [
        ("+880", "\U0001F1E7\U0001F1E9 Bangladesh"),
        ("+966", "\U0001F1F8\U0001F1E6 Saudi Arabia"),
        ("+971", "\U0001F1E6\U0001F1EA UAE"),
        ("+60", "\U0001F1F2\U0001F1FE Malaysia"),
        ("+968", "\U0001F1F4\U0001F1F2 Oman"),
    ]),
    ("All Countries", [
        ("+61", "\U0001F1E6\U0001F1FA Australia"),
        ("+43", "\U0001F1E6\U0001F1F9 Austria"),
        ("+973", "\U0001F1E7\U0001F1ED Bahrain"),
        ("+32", "\U0001F1E7\U0001F1EA Belgium"),
        ("+55", "\U0001F1E7\U0001F1F7 Brazil"),
        ("+673", "\U0001F1E7\U0001F1F3 Brunei"),
        ("+855", "\U0001F1F0\U0001F1ED Cambodia"),
        ("+1", "\U0001F1E8\U0001F1E6 Canada"),
        ("+357", "\U0001F1E8\U0001F1FE Cyprus"),
        ("+420", "\U0001F1E8\U0001F1FF Czechia"),
        ("+45", "\U0001F1E9\U0001F1F0 Denmark"),
        ("+358", "\U0001F1EB\U0001F1EE Finland"),
        ("+33", "\U0001F1EB\U0001F1F7 France"),
        ("+49", "\U0001F1E9\U0001F1EA Germany"),
        ("+30", "\U0001F1EC\U0001F1F7 Greece"),
        ("+36", "\U0001F1ED\U0001F1FA Hungary"),
        ("+91", "\U0001F1EE\U0001F1F3 India"),
        ("+964", "\U0001F1EE\U0001F1F6 Iraq"),
        ("+353", "\U0001F1EE\U0001F1EA Ireland"),
        ("+39", "\U0001F1EE\U0001F1F9 Italy"),
        ("+81", "\U0001F1EF\U0001F1F5 Japan"),
        ("+962", "\U0001F1EF\U0001F1F4 Jordan"),
        ("+965", "\U0001F1F0\U0001F1FC Kuwait"),
        ("+996", "\U0001F1F0\U0001F1EC Kyrgyzstan"),
        ("+961", "\U0001F1F1\U0001F1E7 Lebanon"),
        ("+218", "\U0001F1F1\U0001F1FE Libya"),
        ("+960", "\U0001F1F2\U0001F1FB Maldives"),
        ("+230", "\U0001F1F2\U0001F1FA Mauritius"),
        ("+31", "\U0001F1F3\U0001F1F1 Netherlands"),
        ("+64", "\U0001F1F3\U0001F1FF New Zealand"),
        ("+47", "\U0001F1F3\U0001F1F4 Norway"),
        ("+92", "\U0001F1F5\U0001F1F0 Pakistan"),
        ("+48", "\U0001F1F5\U0001F1F1 Poland"),
        ("+351", "\U0001F1F5\U0001F1F9 Portugal"),
        ("+974", "\U0001F1F6\U0001F1E6 Qatar"),
        ("+40", "\U0001F1F7\U0001F1F4 Romania"),
        ("+7", "\U0001F1F7\U0001F1FA Russia"),
        ("+248", "\U0001F1F8\U0001F1E8 Seychelles"),
        ("+65", "\U0001F1F8\U0001F1EC Singapore"),
        ("+27", "\U0001F1FF\U0001F1E6 South Africa"),
        ("+82", "\U0001F1F0\U0001F1F7 South Korea"),
        ("+34", "\U0001F1EA\U0001F1F8 Spain"),
        ("+46", "\U0001F1F8\U0001F1EA Sweden"),
        ("+41", "\U0001F1E8\U0001F1ED Switzerland"),
        ("+90", "\U0001F1F9\U0001F1F7 Turkey"),
        ("+44", "\U0001F1EC\U0001F1E7 UK"),
        ("+1", "\U0001F1FA\U0001F1F8 USA"),
    ]),
]


class AddressFieldsMixin:
    """Mixin that adds address fields to any Django form.

    Django's DeclarativeFieldsMetaclass only collects fields from bases
    that already have ``declared_fields``, so a plain mixin can't declare
    fields at class level.  Instead, call ``_init_address_fields()`` from
    your form's ``__init__`` — it injects the fields dynamically.

    Usage:
        class MyForm(AddressFieldsMixin, forms.Form):
            def __init__(self, *args, **kwargs):
                super().__init__(*args, **kwargs)
                self._init_address_fields()

    Template:
        {% include "locations/partials/address_fields.html" %}

    JS (load in extra_js block):
        <script src="{% static 'locations/js/address.js' %}"></script>
    """

    def _init_address_fields(self):
        """Add address fields to self.fields and populate dynamic choices."""
        from .models import District

        # ── Inject address fields ──
        self.fields["country"] = forms.ChoiceField(
            choices=COUNTRY_CHOICES,
            initial="+880",
            required=False,
            label="Country",
        )
        self.fields["link_district_id"] = forms.ChoiceField(
            label="District", required=False,
        )
        self.fields["link_upazila_id"] = forms.IntegerField(
            label="Upazila", required=False, widget=forms.Select,
        )
        self.fields["link_union_parishad_id"] = forms.IntegerField(
            label="Union Parishad", required=False, widget=forms.Select,
        )
        self.fields["address_line_one"] = forms.CharField(
            max_length=255, required=False,
            validators=[validate_no_html],
            widget=forms.TextInput(attrs={
                "placeholder": "Building, floor, unit, house no.",
            }),
        )
        self.fields["address_line_two"] = forms.CharField(
            max_length=255, required=False,
            validators=[validate_no_html],
            widget=forms.TextInput(attrs={
                "placeholder": "Street name",
            }),
        )
        self.fields["local_area_name"] = forms.CharField(
            max_length=100, required=False,
            validators=[validate_no_html],
            widget=forms.TextInput(attrs={"placeholder": "Local area / Village"}),
        )
        self.fields["city_town"] = forms.CharField(
            max_length=100, required=False,
            validators=[validate_no_html],
            widget=forms.TextInput(attrs={"placeholder": "City / Town"}),
        )
        self.fields["postal_code"] = forms.CharField(
            max_length=20, required=False,
            validators=[validate_postal_code],
            widget=forms.TextInput(attrs={"placeholder": "Postal code"}),
        )
        self.fields["region_province_state_division"] = forms.CharField(
            max_length=100, required=False,
            validators=[validate_no_html],
            widget=forms.TextInput(attrs={
                "placeholder": "Region / Province / State / Division",
            }),
        )

        # ── Populate dynamic choices ──
        districts = District.objects.filter(is_active=True).order_by("district_name_en")
        self.fields["link_district_id"].choices = [
            ("", "-- Select district --"),
        ] + [(d.district_id, d.district_name_en) for d in districts]

        # Upazila and Union Parishad are populated via JS (AJAX cascading).
        self.fields["link_upazila_id"].widget.choices = [
            ("", "-- Select upazila --"),
        ]
        self.fields["link_union_parishad_id"].widget.choices = [
            ("", "-- Select union parishad --"),
        ]
