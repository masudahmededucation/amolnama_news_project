from django import forms


class ContributorInfoForm(forms.Form):
    """Contributor / reporter identity — collected inline with news submission."""
    contributor_full_name_bn = forms.CharField(
        max_length=100,
        label='নাম (Name)',
        widget=forms.TextInput(attrs={
            'id': 'contributor-full-name',
            'placeholder': 'আপনার নাম লিখুন',
        }),
    )
    contributor_type_id = forms.IntegerField(
        label='ধরন (Contributor Type)',
        widget=forms.Select(attrs={
            'id': 'contributor-type',
        }),
    )
    contributor_contact_email = forms.EmailField(
        max_length=255,
        required=False,
        label='ইমেইল (Email)',
        widget=forms.EmailInput(attrs={
            'id': 'contributor-email',
            'placeholder': 'example@mail.com',
        }),
    )
    contributor_contact_phone = forms.CharField(
        max_length=50,
        required=False,
        label='ফোন (Phone)',
        widget=forms.TextInput(attrs={
            'id': 'contributor-phone',
            'placeholder': '+880...',
        }),
    )


class NewsEntryForm(forms.Form):
    """Primary news content — headline, summary, body, source, occurrence."""
    headline_bn = forms.CharField(
        max_length=150,  # headroom for NFKC expansion; actual DB limit (100) enforced in view
        label='সংবাদ শিরোনাম (News Headline)',
        widget=forms.TextInput(attrs={
            'id': 'news-headline-bn',
            'placeholder': 'সংবাদের শিরোনাম লিখুন',
        }),
    )
    summary_bn = forms.CharField(
        max_length=600,  # headroom for NFKC expansion; actual DB limit (400) enforced in view
        required=False,
        label='সংবাদ সংক্ষেপ (News Highlights)',
        widget=forms.Textarea(attrs={
            'id': 'news-summary-bn',
            'rows': 3,
            'placeholder': 'সংক্ষেপে সংবাদটি বর্ণনা করুন (ঐচ্ছিক)',
        }),
    )
    content_body_bn = forms.CharField(
        label='বিস্তারিত সংবাদ (Content Body)',
        widget=forms.Textarea(attrs={
            'id': 'news-content-body-bn',
            'rows': 10,
            'placeholder': 'সংবাদের বিস্তারিত বিবরণ লিখুন',
        }),
    )
    occurrence_at = forms.DateTimeField(
        label='ঘটনার সময় (Occurrence Time)',
        widget=forms.DateTimeInput(attrs={
            'id': 'news-occurrence-at',
            'type': 'datetime-local',
        }),
    )


class NewsAttachmentForm(forms.Form):
    """Media attachment — file input rendered manually in template (supports multiple)."""
    attachment_caption_bn = forms.CharField(
        max_length=1000,
        required=False,
        label='ক্যাপশন (Caption)',
        widget=forms.TextInput(attrs={
            'id': 'attachment-caption',
            'placeholder': 'ফাইলের বিবরণ (ঐচ্ছিক)',
        }),
    )


class NewsSocialSourceForm(forms.Form):
    """Social media source link and embed code."""
    platform_type_id = forms.IntegerField(
        required=False,
        label='প্ল্যাটফর্ম (Platform)',
        widget=forms.Select(attrs={
            'id': 'social-platform-type',
        }),
    )
    social_source_url = forms.URLField(
        max_length=1000,
        required=False,
        label='সোশ্যাল লিঙ্ক (Social URL)',
        widget=forms.URLInput(attrs={
            'id': 'social-source-url',
            'placeholder': 'https://facebook.com/...',
        }),
    )
    social_embed_code = forms.CharField(
        required=False,
        label='এম্বেড কোড (Embed Code)',
        widget=forms.Textarea(attrs={
            'id': 'social-embed-code',
            'rows': 3,
            'placeholder': '<iframe>...</iframe>',
        }),
    )
