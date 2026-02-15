import hashlib
import os
import unicodedata
import uuid

from django.conf import settings
from django.db import connection as db_conn, DatabaseError, IntegrityError, transaction
from django.shortcuts import redirect, render
from django.utils import timezone

from amolnama_news.site_apps.locations.models import District
from amolnama_news.site_apps.multimedia.models import Asset
from amolnama_news.site_apps.user_account.models import Organisation, OrganisationType, Person, UserProfile

from .forms import (
    ContributorInfoForm,
    NewsAttachmentForm,
    NewsEntryForm,
    NewsSocialSourceForm,
)
from .models import (
    CollContributor,
    CollNewsAsset,
    CollNewsEntry,
    CollNewsEntryTag,
    CollSocialSource,
    RefContributorType,
    RefNewsCategory,
    RefNewsCategoryTag,
    RefPlatformType,
    VwAppNewsCategoryTag,
)


# ========== Helpers ==========

def _unique_news_category_tags():
    """Return deduplicated tag list from ref_news_category_tag (unique by tag name pair).
    Uses RefNewsCategoryTag instead of the view so news_tag_search_aliases is available."""
    qs = RefNewsCategoryTag.objects.all().order_by('link_news_category_id', 'news_tag_group_code', 'sort_order')
    seen = set()
    result = []
    for tag in qs:
        key = (tag.news_tag_name_bn, tag.news_tag_name_en)
        if key not in seen:
            seen.add(key)
            result.append(tag)
    return result


def _get_user_contributor_info(user):
    """Return logged-in user's contributor details from Person, for auto-fill."""
    info = {'name': '', 'email': '', 'phone': ''}
    if not user or not user.is_authenticated:
        return info
    try:
        profile = UserProfile.objects.get(link_user_account_user_id=user.pk)
        if profile.link_person_id:
            person = Person.objects.get(person_id=profile.link_person_id)
            parts = [person.first_name_bn or '', person.last_name_bn or '']
            info['name'] = ' '.join(p for p in parts if p).strip()
            info['email'] = person.primary_email_address or user.email or ''
            info['phone'] = person.primary_mobile_number or ''
    except (UserProfile.DoesNotExist, Person.DoesNotExist):
        info['email'] = user.email or ''
    return info


def _build_form_context(contributor_form, news_entry_form, attachment_form, social_source_form, extra=None):
    """Assemble the template context with forms + reference data."""
    ctx = {
        'contributor_form': contributor_form,
        'news_entry_form': news_entry_form,
        'attachment_form': attachment_form,
        'social_source_form': social_source_form,
        'contributor_types': RefContributorType.objects.filter(is_active=True).order_by('contributor_group_code', 'sort_order'),
        'news_categories': RefNewsCategory.objects.filter(is_active=True).order_by('sort_order', 'news_category_name_bn'),
        'platform_types': RefPlatformType.objects.filter(is_active=True).order_by('sort_order', 'platform_name'),
        'tags': VwAppNewsCategoryTag.objects.all().order_by('news_category_id', 'news_tag_group_code', 'sort_order'),
        'unique_news_category_tags': _unique_news_category_tags(),
        'districts': District.objects.filter(is_active=True).order_by('district_name_bn'),
        'organisation_types': OrganisationType.objects.filter(is_active=True).order_by('sort_order', 'organisation_type_name_bn'),
        'selected_category_id': None,
        'selected_district_id': None,
        'selected_constituency_id': None,
        'selected_upazila_id': None,
        'selected_union_parishad_id': None,
        'selected_latitude': None,
        'selected_longitude': None,
        'selected_tag_ids': [],
        'is_breaking_checked': False,
    }
    if extra:
        ctx.update(extra)
    return ctx


# ========== Page Views ==========

def news_collection(request):
    """News collection form — GET shows blank form, POST validates and saves."""

    if request.method == 'POST':
        return _handle_news_submission(request)

    # GET — blank forms
    extra = {}
    if request.GET.get('submitted') == '1':
        extra['success_message'] = 'সংবাদ সফলভাবে জমা হয়েছে! (News submitted successfully)'

    extra['self_info'] = _get_user_contributor_info(request.user)

    # Anonymous users don't see the "Self" option (contributor_type_id=1)
    all_types = RefContributorType.objects.filter(is_active=True).order_by('contributor_group_code', 'sort_order')
    if request.user.is_authenticated:
        extra['contributor_types'] = all_types
        extra['default_contributor_type_id'] = 1   # Self
    else:
        extra['contributor_types'] = all_types.exclude(contributor_type_id=1)
        extra['default_contributor_type_id'] = 2   # Citizen

    ctx = _build_form_context(
        ContributorInfoForm(),
        NewsEntryForm(),
        NewsAttachmentForm(),
        NewsSocialSourceForm(),
        extra=extra,
    )
    return render(request, 'newshub/pages/news-collection.html', ctx)


def _handle_news_submission(request):
    """Validate all sub-forms and save to DB."""
    contributor_form = ContributorInfoForm(request.POST)
    news_entry_form = NewsEntryForm(request.POST)
    attachment_form = NewsAttachmentForm(request.POST, request.FILES)
    social_source_form = NewsSocialSourceForm(request.POST)

    # Sidebar fields (not in Django forms — rendered manually in widgets)
    category_id = request.POST.get('news_category_id', '')
    district_id = request.POST.get('district_id', '')
    constituency_id = request.POST.get('constituency_id', '') or None
    upazila_id = request.POST.get('upazila_id', '') or None
    union_parishad_id = request.POST.get('union_parishad_id', '') or None
    latitude = request.POST.get('latitude', '') or None
    longitude = request.POST.get('longitude', '') or None
    is_breaking = request.POST.get('is_breaking') == '1'
    tag_ids = request.POST.getlist('tag_ids')

    # If no category selected, derive from the first tag's category
    if not category_id and tag_ids:
        first_tag_id = tag_ids[0]
        if first_tag_id.isdigit():
            try:
                first_tag = RefNewsCategoryTag.objects.get(news_category_tag_id=int(first_tag_id))
                category_id = str(first_tag.link_news_category_id)
            except RefNewsCategoryTag.DoesNotExist:
                pass

    # Basic validation for sidebar required fields
    sidebar_errors = []
    if not tag_ids:
        sidebar_errors.append('অন্তত একটি ট্যাগ যুক্ত করুন (At least one tag is required)')
    if not district_id:
        sidebar_errors.append('জেলা নির্বাচন করুন (District is required)')

    all_valid = (
        contributor_form.is_valid()
        and news_entry_form.is_valid()
        and attachment_form.is_valid()
        and social_source_form.is_valid()
        and not sidebar_errors
    )

    if not all_valid:
        error_msg = ' | '.join(sidebar_errors) if sidebar_errors else 'ফর্মে ত্রুটি আছে, অনুগ্রহ করে পরীক্ষা করুন।'
        ctx = _build_form_context(
            contributor_form, news_entry_form, attachment_form, social_source_form,
            extra={
                'error_message': error_msg,
                'selected_category_id': category_id,
                'selected_district_id': district_id,
                'selected_constituency_id': constituency_id,
                'selected_upazila_id': upazila_id,
                'selected_union_parishad_id': union_parishad_id,
                'selected_latitude': latitude,
                'selected_longitude': longitude,
                'selected_tag_ids': [int(t) for t in tag_ids if t.isdigit()],
                'is_breaking_checked': is_breaking,
            },
        )
        return render(request, 'newshub/pages/news-collection.html', ctx)

    # ---- Normalize Bengali text (NFKC) and check for duplicate headline ----
    now = timezone.now()
    cd = contributor_form.cleaned_data
    nd = news_entry_form.cleaned_data

    headline_raw = nd['headline_bn']
    headline_normalized = unicodedata.normalize('NFKC', headline_raw).strip()

    # Also normalize summary
    summary_raw = nd['summary_bn']
    summary_normalized = unicodedata.normalize('NFKC', summary_raw).strip() if summary_raw else None

    # Validate length after normalization (NFKC can increase char count beyond form max_length)
    length_errors = []
    if len(headline_normalized) > 100:
        length_errors.append('শিরোনাম সর্বোচ্চ ১০০ অক্ষর হতে পারে, বর্তমানে %d অক্ষর। (Headline max 100 chars, currently %d)' % (len(headline_normalized), len(headline_normalized)))
    if summary_normalized and len(summary_normalized) > 400:
        length_errors.append('সংক্ষেপ সর্বোচ্চ ৪০০ অক্ষর হতে পারে, বর্তমানে %d অক্ষর। (Summary max 400 chars, currently %d)' % (len(summary_normalized), len(summary_normalized)))
    if length_errors:
        ctx = _build_form_context(
            contributor_form, news_entry_form, attachment_form, social_source_form,
            extra={
                'error_message': ' | '.join(length_errors),
                'selected_category_id': category_id,
                'selected_district_id': district_id,
                'selected_constituency_id': constituency_id,
                'selected_upazila_id': upazila_id,
                'selected_union_parishad_id': union_parishad_id,
                'selected_latitude': latitude,
                'selected_longitude': longitude,
                'selected_tag_ids': [int(t) for t in tag_ids if t.isdigit()],
                'is_breaking_checked': is_breaking,
            },
        )
        return render(request, 'newshub/pages/news-collection.html', ctx)

    # Duplicate check: same headline (case-insensitive, trimmed) already exists
    duplicate_exists = CollNewsEntry.objects.filter(
        coll_news_entry_headline_bn__iexact=headline_normalized,
    ).exists()
    if duplicate_exists:
        error_msg = 'এই শিরোনামে একটি সংবাদ ইতিমধ্যে জমা হয়েছে। অনুগ্রহ করে ভিন্ন শিরোনাম ব্যবহার করুন। (A news entry with this headline already exists.)'
        ctx = _build_form_context(
            contributor_form, news_entry_form, attachment_form, social_source_form,
            extra={
                'error_message': error_msg,
                'selected_category_id': category_id,
                'selected_district_id': district_id,
                'selected_constituency_id': constituency_id,
                'selected_upazila_id': upazila_id,
                'selected_union_parishad_id': union_parishad_id,
                'selected_latitude': latitude,
                'selected_longitude': longitude,
                'selected_tag_ids': [int(t) for t in tag_ids if t.isdigit()],
                'is_breaking_checked': is_breaking,
            },
        )
        return render(request, 'newshub/pages/news-collection.html', ctx)

    # ---- Save all records atomically ----

    # Resolve organisation name: dropdown ID takes priority, fallback to custom text
    from django.db.models import Q

    org_id = request.POST.get('contributor_organization_id', '') or None
    org_custom = request.POST.get('contributor_organization_custom', '').strip() or None
    org_name_bn = None
    if org_id:
        org = Organisation.objects.filter(organisation_id=int(org_id)).first()
        if org:
            org_name_bn = org.organisation_name_bn or org.organisation_name_en
    if not org_name_bn and org_custom:
        # Check if custom name already exists in organisation table (exact match)
        existing = Organisation.objects.filter(
            Q(organisation_name_bn__iexact=org_custom) | Q(organisation_name_en__iexact=org_custom),
            is_active=True,
        ).first()
        if existing:
            org_name_bn = existing.organisation_name_bn or existing.organisation_name_en
        else:
            org_name_bn = org_custom

    try:
        with transaction.atomic():
            contributor = CollContributor.objects.create(
                coll_contributor_full_name_bn=cd['contributor_full_name_bn'],
                coll_contributor_organization_bn=org_name_bn,
                coll_contributor_contact_email=cd['contributor_contact_email'] or None,
                coll_contributor_contact_phone=cd['contributor_contact_phone'] or None,
                link_contributor_type_id=cd['contributor_type_id'],
                is_verified=False,
                created_at=now,
            )

            # ---- Save news entry (using NFKC-normalized headline/summary) ----
            content_body = unicodedata.normalize('NFKC', nd['content_body_bn'])

            entry = CollNewsEntry.objects.create(
                coll_news_entry_headline_bn=headline_normalized,
                coll_news_entry_summary_bn=summary_normalized or None,
                coll_news_entry_content_body_bn=content_body,
                link_news_category_id=int(category_id) if category_id else 12,
                link_contributor_id=contributor.coll_contributor_id,
                link_constituency_id=int(constituency_id) if constituency_id else None,
                link_union_parishad_id=int(union_parishad_id) if union_parishad_id else None,
                coll_news_entry_latitude=latitude,
                coll_news_entry_longitude=longitude,
                coll_news_entry_is_breaking=is_breaking,
                occurrence_at=nd['occurrence_at'],
                created_at=now,
            )

            # ---- Save attachments (multiple files supported, max 4) ----
            # Flow: compute SHA-256 → check for duplicate → save file if new → create coll_news_asset link
            ad = attachment_form.cleaned_data
            uploaded_files = request.FILES.getlist('attachment_file')
            caption = ad.get('attachment_caption_bn') or None
            featured_idx_raw = request.POST.get('featured_file_index', '')
            featured_idx = int(featured_idx_raw) if featured_idx_raw.isdigit() else -1

            for i, uploaded_file in enumerate(uploaded_files[:4]):
                content_type = getattr(uploaded_file, 'content_type', '') or ''
                if content_type.startswith('image/'):
                    media_category = 'image'
                elif content_type.startswith('video/'):
                    media_category = 'video'
                elif content_type.startswith('audio/'):
                    media_category = 'audio'
                else:
                    media_category = None  # maps to 'files' folder

                # Compute SHA-256 hash (read in chunks for large files)
                sha256 = hashlib.sha256()
                for chunk in uploaded_file.chunks():
                    sha256.update(chunk)
                file_hash = sha256.digest()  # raw bytes for BinaryField
                uploaded_file.seek(0)  # rewind for saving

                # Check if identical file already exists in media.asset
                existing_asset = Asset.objects.filter(
                    hash_sha256=file_hash,
                    file_size_bytes=uploaded_file.size,
                    is_active=True,
                ).first()

                if existing_asset:
                    asset = existing_asset
                else:
                    file_name = uploaded_file.name
                    file_ext = os.path.splitext(file_name)[1].lower()

                    # 1. INSERT asset record first (file_storage_path is a computed column — generated by DB)
                    asset = Asset.objects.create(
                        asset_guid=str(uuid.uuid4()),
                        file_original_name=file_name,
                        file_extension=file_ext,
                        file_mime_type=content_type,
                        file_size_bytes=uploaded_file.size,
                        hash_sha256=file_hash,
                        hash_algorithm_used='SHA-256',
                        hash_is_verified=True,
                        hash_last_verify_at=now,
                        is_active=True,
                        created_at=now,
                        modified_at=now,
                    )

                    # 2. Read back the computed file_storage_path from the inserted record
                    with db_conn.cursor() as cur:
                        cur.execute(
                            "SELECT file_storage_path FROM [media].[asset] WHERE asset_id = %s",
                            [asset.asset_id],
                        )
                        storage_path = cur.fetchone()[0]

                    # 3. Save physical file to MEDIA_ROOT / file_storage_path
                    full_path = os.path.join(settings.MEDIA_ROOT, storage_path)
                    os.makedirs(os.path.dirname(full_path), exist_ok=True)

                    with open(full_path, 'wb+') as dest:
                        for chunk in uploaded_file.chunks():
                            dest.write(chunk)

                # Create junction record linking news entry to asset
                CollNewsAsset.objects.create(
                    link_coll_news_entry_id=entry.coll_news_entry_id,
                    link_asset_id=asset.asset_id,
                    coll_news_asset_caption_bn=caption if i == 0 else None,
                    is_featured=(i == featured_idx),
                    sort_order=i,
                    created_at=now,
                )

            # ---- Save social source (if URL provided) ----
            sd = social_source_form.cleaned_data
            social_url = sd.get('social_source_url')
            if social_url:
                CollSocialSource.objects.create(
                    link_news_entry_id=entry.coll_news_entry_id,
                    link_platform_type_id=sd['platform_type_id'] or 0,
                    coll_social_source_url=social_url,
                    coll_social_source_embed_code=sd.get('social_embed_code') or None,
                    created_at=now,
                )

            # ---- Save tags ----
            for tid in tag_ids:
                if tid.isdigit():
                    CollNewsEntryTag.objects.create(
                        link_coll_news_entry_id=entry.coll_news_entry_id,
                        link_news_tag_id=int(tid),
                    )

    except (IntegrityError, DatabaseError):
        # Safety net: DB-level unique constraint or data truncation
        error_msg = 'সংবাদ জমা দেওয়া সম্ভব হয়নি। সম্ভবত এই শিরোনামে ইতিমধ্যে একটি সংবাদ আছে অথবা তথ্য সীমার বেশি। (Submission failed — possible duplicate headline or data too long.)'
        ctx = _build_form_context(
            contributor_form, news_entry_form, attachment_form, social_source_form,
            extra={
                'error_message': error_msg,
                'selected_category_id': category_id,
                'selected_district_id': district_id,
                'selected_constituency_id': constituency_id,
                'selected_upazila_id': upazila_id,
                'selected_union_parishad_id': union_parishad_id,
                'selected_latitude': latitude,
                'selected_longitude': longitude,
                'selected_tag_ids': [int(t) for t in tag_ids if t.isdigit()],
                'is_breaking_checked': is_breaking,
            },
        )
        return render(request, 'newshub/pages/news-collection.html', ctx)

    # PRG: redirect to GET so browser refresh won't re-submit the form
    return redirect(request.path + '?submitted=1')
