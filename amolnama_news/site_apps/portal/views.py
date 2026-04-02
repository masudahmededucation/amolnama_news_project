"""Portal views — user profile pages (personal, contact, address, settings)."""

from django.contrib import messages
from django.contrib.auth import login
from django.contrib.auth.decorators import login_required
from django.shortcuts import redirect, render
from django.utils import timezone
from django.views.decorators.http import require_http_methods

from amolnama_news.site_apps.user_account.models import (
    Email, Person, PersonAddress, Phone, UserProfile,
)
from amolnama_news.site_apps.user_account.views import (
    _load_person_and_profile, _build_full_phone, EMAIL_AUTH_BACKEND,
)
from amolnama_news.site_apps.user_account.forms import (
    PersonalDetailsForm, ContactInfoForm, HomeAddressForm, ChangePasswordForm,
)


def home(request):
    """Portal landing — redirect to profile if logged in, else show placeholder."""
    if request.user.is_authenticated:
        return redirect('portal:profile_public')
    return render(request, 'core/base.html')


@login_required
def profile_redirect_view(request):
    """Redirect /portal/profile/ → /portal/profile/public/."""
    return redirect('portal:profile_public')


@login_required
@require_http_methods(["GET", "POST"])
def profile_public_view(request):
    """Edit public profile: display name, @username, bio, location, website."""
    profile, person = _load_person_and_profile(request.user)

    if request.method == "POST":
        display_name = (request.POST.get('display_name') or '').strip() or None
        bio_summary = (request.POST.get('professional_bio_summary_bn') or '').strip() or None
        bio_description = (request.POST.get('professional_bio_description_bn') or '').strip() or None
        profile_location = (request.POST.get('profile_location') or '').strip() or None
        profile_website_url = (request.POST.get('profile_website_url') or '').strip() or None
        username_handle = (request.POST.get('username_handle') or '').strip() or None

        # Validate username handle uniqueness
        if username_handle:
            import re
            username_handle = re.sub(r'[^a-z0-9]', '', username_handle.lower())[:30]
            existing = UserProfile.objects.filter(username_handle=username_handle).exclude(user_profile_id=profile.user_profile_id).exists()
            if existing:
                messages.error(request, f'@{username_handle} ইতিমধ্যে ব্যবহৃত হচ্ছে। অন্য একটি বেছে নিন।')
                return redirect('portal:profile_public')

        profile.display_name = display_name
        profile.professional_bio_summary_bn = bio_summary
        profile.professional_bio_description_bn = bio_description
        profile.profile_location = profile_location
        profile.profile_website_url = profile_website_url
        profile.username_handle = username_handle
        profile.updated_at = timezone.now()
        profile.save(update_fields=[
            'display_name', 'professional_bio_summary_bn', 'professional_bio_description_bn',
            'profile_location', 'profile_website_url', 'username_handle', 'updated_at',
        ])

        messages.success(request, 'পাবলিক প্রোফাইল আপডেট হয়েছে।')
        return redirect('portal:profile_public')

    return render(request, 'portal/pages/profile_public.html', {
        'profile': profile,
        'active_tab': 'public',
        'seo': {'title': 'পাবলিক প্রোফাইল — পোর্টাল'},
    })


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
                "link_marital_status_id": int(data["link_marital_status_id"]) if data.get("link_marital_status_id") else None,
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

            display = f"{data['first_name_en']} {data['last_name_en']}".strip()
            if display and profile:
                profile.display_name = display
                profile.updated_at = timezone.now()
                profile.save(update_fields=["display_name", "updated_at"])

            messages.success(request, "Personal details updated.")
            return redirect("portal:profile_personal")
    else:
        initial = {}
        if person:
            initial = {
                "first_name_en": person.first_name_en,
                "last_name_en": person.last_name_en,
                "first_name_bn": person.first_name_bn,
                "last_name_bn": person.last_name_bn,
                "date_of_birth": person.date_of_birth,
                "link_gender_id": person.link_gender_id,
                "link_marital_status_id": person.link_marital_status_id,
                "link_religion_id": person.link_religion_id,
                "nid_number": person.nid_card_number,
                "notes": person.notes,
            }
        form = PersonalDetailsForm(initial=initial)

    # Get avatar URL if exists
    avatar_url = None
    if profile and profile.link_avatar_asset_id:
        from django.db import connection
        with connection.cursor() as cursor:
            cursor.execute(
                "SELECT '/media/' + [file_storage_path] FROM [media].[asset] WHERE [asset_id] = %s AND [is_active] = 1",
                [profile.link_avatar_asset_id],
            )
            row = cursor.fetchone()
            if row:
                avatar_url = row[0]

    return render(request, "portal/pages/profile_personal.html", {
        "form": form,
        "active_tab": "personal",
        "avatar_url": avatar_url,
        "seo": {"noindex": True, "breadcrumbs": [{"name": "হোম", "url": "/"}, {"name": "পোর্টাল", "url": "/portal/"}, {"name": "প্রোফাইল"}]},
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

            if not person:
                person = Person.objects.create(
                    first_name_en=request.user.email,
                    last_name_en=None,
                    is_active=True,
                    created_at=timezone.now(),
                    modified_at=timezone.now(),
                )
                profile.link_person_id = person.person_id
                profile.updated_at = timezone.now()
                profile.save(update_fields=["link_person_id", "updated_at"])

            person.primary_mobile_number = full_phone
            person.primary_email_address = email_val
            person.modified_at = timezone.now()
            person.save(update_fields=[
                "primary_mobile_number", "primary_email_address", "modified_at",
            ])

            raw_number = data.get("mobile_number") or None
            phone_number = raw_number.lstrip("0") if raw_number else None
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
            return redirect("portal:profile_contact")
    else:
        initial = {"country": "+880"}
        if person:
            phone_rec = Phone.objects.filter(
                link_person_id=person.person_id,
                is_active=True,
            ).first()
            if phone_rec:
                initial["country"] = phone_rec.country_calling_code or "+880"
                initial["mobile_number"] = phone_rec.phone_number

            email_rec = Email.objects.filter(
                link_person_id=person.person_id,
                is_active=True,
            ).first()
            if email_rec:
                initial["email_address"] = email_rec.email_address
        form = ContactInfoForm(initial=initial)

    return render(request, "portal/pages/profile_contact.html", {
        "form": form,
        "active_tab": "contact",
        "seo": {"noindex": True, "breadcrumbs": [{"name": "হোম", "url": "/"}, {"name": "পোর্টাল", "url": "/portal/"}, {"name": "প্রোফাইল"}]},
    })


@login_required
@require_http_methods(["GET", "POST"])
def profile_address_view(request):
    """Edit home address with cascading location dropdowns."""
    from amolnama_news.site_apps.locations.models import Address, Upazila

    profile, person = _load_person_and_profile(request.user)

    address = None
    if person:
        person_address = PersonAddress.objects.filter(
            link_person_id=person.person_id,
            is_current=True,
            is_active=True,
        ).first()
        if person_address:
            try:
                address = Address.objects.get(address_id=person_address.link_address_id)
            except Address.DoesNotExist:
                pass

    if request.method == "POST":
        form = HomeAddressForm(request.POST)
        if form.is_valid():
            data = form.cleaned_data

            if not person:
                person = Person.objects.create(
                    first_name_en=request.user.email,
                    last_name_en=None,
                    is_active=True,
                    created_at=timezone.now(),
                    modified_at=timezone.now(),
                )
                profile.link_person_id = person.person_id
                profile.updated_at = timezone.now()
                profile.save(update_fields=["link_person_id", "updated_at"])

            union_id = data.get("link_union_parishad_id") or None
            address_line_one = (data.get("address_line_one") or "").strip() or None
            address_line_two = data.get("address_line_two") or None
            city_town = (data.get("city_town") or "").strip() or None
            has_address = union_id or address_line_one or city_town

            if has_address and not address_line_one:
                form.add_error("address_line_one", "Address line one is required.")
            if has_address and not city_town:
                form.add_error("city_town", "City / Town is required.")

            if not form.errors:
                if has_address:
                    address_fields = {
                        "link_union_parishad_id": union_id,
                        "address_line_one": address_line_one,
                        "address_line_two": address_line_two,
                        "local_area_name": data.get("local_area_name") or None,
                        "city_town": city_town,
                        "region_province_state_division": data.get("region_province_state_division") or None,
                        "postal_code": data.get("postal_code") or None,
                    }
                    if address:
                        for field, value in address_fields.items():
                            setattr(address, field, value)
                        address.modified_at = timezone.now()
                        address.save()
                    else:
                        address = Address.objects.create(
                            **address_fields,
                            is_active=True,
                            created_at=timezone.now(),
                        )

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
                return redirect("portal:profile_address")
    else:
        initial = {}
        if address:
            initial["address_line_one"] = address.address_line_one
            initial["address_line_two"] = address.address_line_two
            initial["local_area_name"] = address.local_area_name
            initial["city_town"] = address.city_town
            initial["region_province_state_division"] = address.region_province_state_division
            initial["postal_code"] = address.postal_code
            initial["link_union_parishad_id"] = address.link_union_parishad_id
            if address.link_union_parishad_id:
                try:
                    from amolnama_news.site_apps.locations.models import UnionParishad
                    union_parishad = UnionParishad.objects.get(
                        union_parishad_id=address.link_union_parishad_id
                    )
                    if union_parishad.link_upazila_id:
                        initial["link_upazila_id"] = union_parishad.link_upazila_id
                        upazila = Upazila.objects.filter(
                            upazila_id=union_parishad.link_upazila_id
                        ).first()
                        if upazila and upazila.link_district_id:
                            initial["link_district_id"] = upazila.link_district_id
                except UnionParishad.DoesNotExist:
                    pass
        form = HomeAddressForm(initial=initial)

    from django.urls import reverse

    return render(request, "portal/pages/profile_address.html", {
        "form": form,
        "active_tab": "address",
        "api_upazilas_url": reverse("user_account:api_upazilas"),
        "api_unions_url": reverse("user_account:api_union_parishads"),
        "seo": {"noindex": True, "breadcrumbs": [{"name": "হোম", "url": "/"}, {"name": "পোর্টাল", "url": "/portal/"}, {"name": "প্রোফাইল"}]},
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
            login(request, request.user, backend=EMAIL_AUTH_BACKEND)
            messages.success(request, "Password changed successfully.")
            return redirect("portal:profile_settings")
    else:
        form = ChangePasswordForm(user=request.user)
    return render(request, "portal/pages/profile_settings.html", {
        "active_tab": "settings",
        "form": form,
        "seo": {"noindex": True, "breadcrumbs": [{"name": "হোম", "url": "/"}, {"name": "পোর্টাল", "url": "/portal/"}, {"name": "প্রোফাইল"}]},
    })


@login_required
def content_dashboard_view(request):
    """Content dashboard — list all content from all apps with publish status toggle."""
    if not request.user.is_staff:
        return redirect('portal:home')

    content_items = []

    # Newshub articles
    from amolnama_news.site_apps.newshub.models import PubArticle
    for article in PubArticle.objects.all().order_by('-created_at')[:50]:
        content_items.append({
            'content_type': 'newshub',
            'content_type_label': 'NEWS',
            'content_type_color': 'rose',
            'content_id': article.pub_article_id,
            'content_title': article.pub_article_headline_bn or '(no title)',
            'content_slug': article.pub_article_slug or '',
            'content_url': f'/newshub/article/{article.pub_article_slug}/' if article.pub_article_slug else '',
            'is_published': article.is_published,
            'created_at': article.created_at,
            'created_at_formatted': article.created_at.strftime('%d %b %Y, %I:%M %p') if article.created_at else '',
        })

    # Poems
    from amolnama_news.site_apps.poem.models import CollPoemEntry
    for poem in CollPoemEntry.objects.all().order_by('-created_at')[:50]:
        is_published = getattr(poem, 'poem_status_code', '') == 'published'
        content_items.append({
            'content_type': 'poem',
            'content_type_label': 'POEM',
            'content_type_color': 'purple',
            'content_id': poem.poem_coll_poem_entry_id,
            'content_title': poem.poem_title_bn or '(no title)',
            'content_slug': poem.poem_slug or '',
            'content_url': f'/bangla-kobita-gaan/{poem.poem_slug}/' if poem.poem_slug else '',
            'is_published': is_published,
            'created_at': poem.created_at,
            'created_at_formatted': poem.created_at.strftime('%d %b %Y, %I:%M %p') if poem.created_at else '',
        })

    # Stories
    from amolnama_news.site_apps.stories.models import CollStory
    for story in CollStory.objects.all().order_by('-created_at')[:50]:
        content_items.append({
            'content_type': 'stories',
            'content_type_label': 'STORY',
            'content_type_color': 'amber',
            'content_id': story.stories_coll_story_id,
            'content_title': story.story_title_bn or '(no title)',
            'content_slug': story.story_slug or '',
            'content_url': f'/stories-for-kids/{story.story_slug}/' if story.story_slug else '',
            'is_published': story.is_published,
            'created_at': story.created_at,
            'created_at_formatted': story.created_at.strftime('%d %b %Y, %I:%M %p') if story.created_at else '',
        })

    # Art
    from amolnama_news.site_apps.art.models import CollArtwork
    for artwork in CollArtwork.objects.all().order_by('-created_at')[:50]:
        content_items.append({
            'content_type': 'art',
            'content_type_label': 'ART',
            'content_type_color': 'blue',
            'content_id': artwork.art_coll_artwork_id,
            'content_title': artwork.artwork_title_bn or '(no title)',
            'content_slug': artwork.artwork_slug or '',
            'content_url': f'/art-and-craft/{artwork.artwork_slug}/' if artwork.artwork_slug else '',
            'is_published': artwork.is_published,
            'created_at': artwork.created_at,
            'created_at_formatted': artwork.created_at.strftime('%d %b %Y, %I:%M %p') if artwork.created_at else '',
        })

    # Travel destinations
    from amolnama_news.site_apps.bangladesh.models import CollDestination
    for destination in CollDestination.objects.all().order_by('-created_at')[:50]:
        is_published = getattr(destination, 'destination_status', '') == 'published'
        content_items.append({
            'content_type': 'travel',
            'content_type_label': 'TRAVEL',
            'content_type_color': 'green',
            'content_id': destination.bangladesh_coll_destination_id,
            'content_title': destination.destination_name_bn or destination.destination_name_en or '(no title)',
            'content_slug': destination.destination_slug or '',
            'content_url': f'/bangladesh-tourist-destinations/travel/{destination.destination_slug}/' if destination.destination_slug else '',
            'is_published': is_published,
            'created_at': destination.created_at,
            'created_at_formatted': destination.created_at.strftime('%d %b %Y, %I:%M %p') if destination.created_at else '',
        })

    # Sort all by date — latest first
    content_items.sort(key=lambda item: item.get('created_at') or timezone.now(), reverse=True)

    return render(request, 'portal/pages/content-dashboard.html', {
        'content_items': content_items,
        'seo': {
            'noindex': True,
            'breadcrumbs': [
                {'name': 'হোম', 'url': '/'},
                {'name': 'পোর্টাল', 'url': '/portal/'},
                {'name': 'Content Dashboard'},
            ],
        },
    })


@login_required
def analytics_dashboard_view(request):
    """Analytics dashboard — engagement stats across all content. Staff only."""
    if not request.user.is_staff:
        return redirect('portal:home')

    from django.db.models import Sum
    from amolnama_news.site_apps.post.models import Post

    # Post engagement totals
    post_stats = Post.objects.filter(is_published=True, is_active=True).aggregate(
        total_posts=Sum('post_post_id'),
        total_likes=Sum('like_count'),
        total_views=Sum('view_count'),
        total_replies=Sum('reply_count'),
        total_reposts=Sum('repost_count'),
    )

    # Content counts per app
    content_counts = []

    from amolnama_news.site_apps.newshub.models import PubArticle
    content_counts.append({'label': 'News Articles', 'color': 'rose', 'count': PubArticle.objects.filter(is_published=True).count()})

    from amolnama_news.site_apps.poem.models import CollPoemEntry
    content_counts.append({'label': 'Poems', 'color': 'purple', 'count': CollPoemEntry.objects.filter(poem_status_code='published').count()})

    from amolnama_news.site_apps.stories.models import CollStory
    content_counts.append({'label': 'Stories', 'color': 'amber', 'count': CollStory.objects.filter(is_published=True, is_active=True).count()})

    from amolnama_news.site_apps.art.models import CollArtwork
    content_counts.append({'label': 'Artworks', 'color': 'blue', 'count': CollArtwork.objects.filter(is_published=True, is_active=True).count()})

    from amolnama_news.site_apps.bangladesh.models import CollDestination
    content_counts.append({'label': 'Travel Destinations', 'color': 'green', 'count': CollDestination.objects.filter(destination_status='published').count()})

    from amolnama_news.site_apps.debate.models import CollTopic
    content_counts.append({'label': 'Debates', 'color': 'amber', 'count': CollTopic.objects.filter(is_active=True).count()})

    post_count = Post.objects.filter(is_published=True, is_active=True).count()
    content_counts.append({'label': 'User Posts', 'color': 'blue', 'count': post_count})

    # Top performing posts
    top_posts = Post.objects.filter(
        is_published=True, is_active=True,
    ).order_by('-like_count')[:10]

    top_post_items = []
    for post in top_posts:
        top_post_items.append({
            'post_post_id': post.post_post_id,
            'post_text_preview': (post.post_text_bn or '')[:80],
            'like_count': post.like_count or 0,
            'view_count': post.view_count or 0,
            'reply_count': post.reply_count or 0,
        })

    return render(request, 'portal/pages/analytics-dashboard.html', {
        'post_stats': post_stats,
        'content_counts': content_counts,
        'top_posts': top_post_items,
        'seo': {
            'noindex': True,
            'breadcrumbs': [
                {'name': 'হোম', 'url': '/'},
                {'name': 'পোর্টাল', 'url': '/portal/'},
                {'name': 'Analytics'},
            ],
        },
    })


@login_required
def moderation_queue_view(request):
    """Moderation queue — flagged content for staff review. Staff only."""
    if not request.user.is_staff:
        return redirect('portal:home')

    flagged_items = []

    # Debate posts with fact-check flags
    from amolnama_news.site_apps.debate.models import CollPost as DebatePost
    flagged_debate_posts = DebatePost.objects.filter(
        fact_check_flag_count__gt=0, is_deleted=False, is_active=True,
    ).order_by('-fact_check_flag_count')[:20]

    for post in flagged_debate_posts:
        flagged_items.append({
            'content_type': 'debate_post',
            'content_type_label': 'DEBATE',
            'content_type_color': 'amber',
            'content_id': post.debate_coll_post_id,
            'content_preview': (post.post_content or '')[:100],
            'flag_count': post.fact_check_flag_count,
            'is_fact_check_needed': post.is_fact_check_needed,
            'content_url': f'/debate/topic/{post.link_topic_id}/',
        })

    # Auto-flagged posts from content classifier
    from amolnama_news.site_apps.post.models import Post
    auto_flagged_posts = Post.objects.filter(
        is_auto_flagged=True, is_active=True,
    ).order_by('-created_at')[:20]

    for post in auto_flagged_posts:
        flagged_items.append({
            'content_type': 'auto_flagged_post',
            'content_type_label': (post.content_category_code or 'flagged').upper(),
            'content_type_color': 'rose',
            'content_id': post.post_post_id,
            'content_preview': (post.post_text_bn or '')[:100],
            'flag_count': 1,
            'is_fact_check_needed': post.content_category_code == 'misinformation',
            'content_url': f'/post/{post.post_post_id}/',
            'content_category_code': post.content_category_code or '',
        })

    # User-flagged posts (PostFlag)
    try:
        from amolnama_news.site_apps.post.models import PostFlag
        flagged_posts = PostFlag.objects.filter(
            is_active=True,
        ).order_by('-created_at')[:20]

        for flag in flagged_posts:
            flagged_items.append({
                'content_type': 'post_flag',
                'content_type_label': 'USER FLAG',
                'content_type_color': 'amber',
                'content_id': flag.link_post_id,
                'content_preview': flag.flag_reason_code or 'Flagged',
                'flag_count': 1,
                'is_fact_check_needed': False,
                'content_url': f'/post/{flag.link_post_id}/',
            })
    except Exception:
        pass

    return render(request, 'portal/pages/moderation-queue.html', {
        'flagged_items': flagged_items,
        'seo': {
            'noindex': True,
            'breadcrumbs': [
                {'name': 'হোম', 'url': '/'},
                {'name': 'পোর্টাল', 'url': '/portal/'},
                {'name': 'Moderation Queue'},
            ],
        },
    })
