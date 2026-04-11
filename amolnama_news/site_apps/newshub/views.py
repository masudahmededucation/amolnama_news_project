import hashlib
import json
import logging
import os
import re
import unicodedata
import uuid

logger = logging.getLogger(__name__)
from datetime import date as _date

from django.conf import settings
from django.db import connection, DatabaseError, IntegrityError, transaction
from django.http import JsonResponse
from django.shortcuts import redirect, render
from django.urls import reverse
from django.utils import timezone

from amolnama_news.site_apps.sports.models import SportsFormFact
from amolnama_news.site_apps.entertainment.models import EntertainmentFormFact
from .helpers import form_access_required as _form_access_required

from amolnama_news.site_apps.investigation.models import (
    CivicFormImpact,
    ConflictFormActorCountry,
    ConflictFormImpact,
    CrimeFormImpactCasualty,
    CrimeFormVictimLegalAction,
    CrimeFormWeapon,
    ExtortionFormImpact,
    ExtortionFormVictimLegalAction,
    GlobalNewsFormFact,
    WomenFormVictimLegalAction,
    WomenFormPerpetrator,
    WomenFormVictimProfileFact,
    IncidentInvolvedActorProfile,
    July2024FactProtest,
    LandGrabbingFormFact,
    LandGrabbingFormVictimLegalAction,
    PriceHikingFormCommodityPrice,
    PriceHikingFormCommodityStockSupplyChain,
    RefStatus,
)
from amolnama_news.site_apps.locations.models import District
from amolnama_news.site_apps.multimedia.models import Asset, RefAssetType, SocialUrlLibrary
from amolnama_news.site_apps.user_account.models import Organisation, OrganisationType, Person, UserProfile
from amolnama_news.site_apps.person.models import JobTitle, PersonJob, PersonMarriage

from .forms import (
    ContributorInfoForm,
    NewsAttachmentForm,
    NewsEntryForm,
    NewsSocialSourceForm,
)
from .models import (
    Contributor,
    NewsAsset,
    CollNewsEntry,
    NewsEntryTag,
    NewsSocialMediaSource,

    RefContributorType,
    RefNewsFormType,
    RefNewsCategory,
    RefNewsCategoryTag,
    RefSocialMediaPlatformType,
    VwAppNewsCategoryTag,
)


# ========== Helpers ==========

def _sanitize_rich_html(html):
    """Strip dangerous tags/attributes from Quill rich text HTML."""
    if not html:
        return html
    # Remove dangerous tags and their content (matched pairs)
    html = re.sub(r'<(script|style|iframe|object|embed|form)[^>]*>.*?</\1>', '', html, flags=re.DOTALL | re.IGNORECASE)
    # Remove self-closing dangerous tags
    html = re.sub(r'<(script|style|iframe|object|embed|form)[^>]*/>', '', html, flags=re.IGNORECASE)
    # Remove orphaned opening/closing dangerous tags
    html = re.sub(r'</?(?:script|style|iframe|object|embed|form)[^>]*>', '', html, flags=re.IGNORECASE)
    # Remove on* event handler attributes
    html = re.sub(r'\s+on\w+\s*=\s*["\'][^"\']*["\']', '', html, flags=re.IGNORECASE)
    html = re.sub(r'\s+on\w+\s*=\s*\S+', '', html, flags=re.IGNORECASE)
    # Remove javascript: URLs
    html = re.sub(r'href\s*=\s*["\']javascript:[^"\']*["\']', 'href="#"', html, flags=re.IGNORECASE)
    return html.strip()


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
    """Return logged-in user's contributor details for auto-fill.
    Name comes from UserProfile.display_name (account.user_profile),
    with fallback to Person name. Email/phone from Person."""
    info = {'name': '', 'email': '', 'phone': ''}
    if not user or not user.is_authenticated:
        return info
    try:
        profile = UserProfile.objects.get(link_user_account_user_id=user.pk)
        # Name: prefer display_name from user_profile (skip if it looks like an email)
        display_name = (profile.display_name or '').strip()
        info['name'] = display_name if '@' not in display_name else ''
        if profile.link_person_id:
            person = Person.objects.get(person_id=profile.link_person_id)
            # Fallback to Person Bengali name if display_name is empty
            if not info['name']:
                parts = [person.first_name_bn or '', person.last_name_bn or '']
                info['name'] = ' '.join(p for p in parts if p).strip()
            info['email'] = person.primary_email_address or user.email or ''
            info['phone'] = person.primary_mobile_number or ''
        else:
            info['email'] = user.email or ''
    except (UserProfile.DoesNotExist, Person.DoesNotExist):
        info['email'] = user.email or ''
    return info


def _build_form_context(contributor_form, news_entry_form, attachment_form, social_source_form, extra=None):
    """Assemble the template context with forms + reference data."""
    form_context = {
        'seo': {'noindex': True},
        'contributor_form': contributor_form,
        'news_entry_form': news_entry_form,
        'attachment_form': attachment_form,
        'social_source_form': social_source_form,
        'contributor_types': RefContributorType.objects.filter(is_active=True).order_by('contributor_group_code', 'sort_order'),
        'news_categories': RefNewsCategory.objects.filter(is_active=True).order_by('sort_order', 'news_category_name_en'),
        'platform_types': RefSocialMediaPlatformType.objects.filter(is_active=True).order_by('sort_order', 'platform_name'),
        'tags': VwAppNewsCategoryTag.objects.all().order_by('news_category_id', 'news_tag_group_code', 'sort_order'),
        'unique_news_category_tags': _unique_news_category_tags(),
        'districts': District.objects.filter(is_active=True).order_by('district_name_en'),
        'organisation_types': OrganisationType.objects.filter(is_active=True).order_by('sort_order', 'organisation_type_name_en'),
        'selected_category_id': None,
        'selected_district_id': None,
        'selected_constituency_id': None,
        'selected_upazila_id': None,
        'selected_union_parishad_id': None,
        'selected_latitude': None,
        'selected_longitude': None,
        'selected_tag_ids': [],
        'is_breaking_checked': False,
        'asset_type_rules_json': json.dumps(list(
            RefAssetType.objects.exclude(is_active=False)
            .values('mime_type', 'max_size_kb', 'allowed_extension')
        )),
    }
    if extra:
        form_context.update(extra)
    # DB-driven form picker — inject if not already provided
    if 'form_type_items' not in form_context:
        from .helpers import FORM_TYPE_METADATA
        from django.urls import reverse
        all_form_types = RefNewsFormType.objects.filter(is_active=True).order_by('newshub_ref_news_form_type_id')
        form_context['form_type_items'] = [
            {
                'group_code': form_type.group_code,
                'form_name_bn': form_type.form_name_bn,
                'form_name_en': form_type.form_name_en,
                'icon': (FORM_TYPE_METADATA.get(form_type.group_code) or {}).get('icon', '📰'),
                'url': reverse((FORM_TYPE_METADATA.get(form_type.group_code) or {}).get('url_name', 'newshub:news_collection_multistep')),
                'step_labels': (FORM_TYPE_METADATA.get(form_type.group_code) or {}).get('step_labels', '[]'),
                'step_count_bn': (FORM_TYPE_METADATA.get(form_type.group_code) or {}).get('step_count_bn', ''),
                'is_restricted': form_type.is_restricted,
            }
            for form_type in all_form_types
            if form_type.group_code in FORM_TYPE_METADATA
        ]
    # Code splitting: resolve JS scripts for this form type
    form_type = form_context.get('selected_form_type') or form_context.get('form_type_code') or 'generic'
    if 'form_scripts' not in form_context:
        from .helpers import get_form_scripts
        form_context['form_scripts'] = get_form_scripts(form_type)
    return form_context


def _add_actor_person_refs(extra):
    """Add gender, religion, and district reference data for actor person repeaters.
    Call after setting actor_types_json in any view that uses the accused/victim/witness repeaters."""
    _rv = ('status_id', 'status_code', 'status_name_bn', 'status_name_en')
    extra['actor_genders_json'] = json.dumps(list(
        RefStatus.objects.filter(group_code='gender', is_active=True).order_by('sort_order').values(*_rv)
    ))
    extra['actor_religions_json'] = json.dumps(list(
        RefStatus.objects.filter(group_code='religion', is_active=True).order_by('sort_order').values(*_rv)
    ))
    extra['actor_districts_json'] = json.dumps(list(
        District.objects.filter(is_active=True).order_by('district_name_en')
        .values('district_id', 'district_name_en', 'district_name_bn')
    ))


# ========== Page Views ==========

def news_collection(request):
    """News collection form — GET shows blank form, POST validates and saves."""

    template = 'newshub/pages/news-collection.html'

    if request.method == 'POST':
        return _handle_news_submission(request, template, form_type_group_code='general_news')

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

    form_context = _build_form_context(
        ContributorInfoForm(),
        NewsEntryForm(),
        NewsAttachmentForm(),
        NewsSocialSourceForm(),
        extra=extra,
    )
    return render(request, template, form_context)


def news_collection_multistep(request):
    """Multi-step version of the news collection form — same data, stepper UI."""

    template = 'newshub/pages/news-collection-multistep.html'

    if request.method == 'POST':
        return _handle_news_submission(request, template, form_type_group_code='general_news')

    extra = {}
    if request.GET.get('submitted') == '1':
        extra['success_message'] = 'সংবাদ সফলভাবে জমা হয়েছে! (News submitted successfully)'

    # DB-driven form picker — only show forms user can access
    from .helpers import build_form_type_picker_items
    extra['form_type_items'] = build_form_type_picker_items(request.user)

    extra['self_info'] = _get_user_contributor_info(request.user)

    all_types = RefContributorType.objects.filter(is_active=True).order_by('contributor_group_code', 'sort_order')
    if request.user.is_authenticated:
        extra['contributor_types'] = all_types
        extra['default_contributor_type_id'] = 1
    else:
        extra['contributor_types'] = all_types.exclude(contributor_type_id=1)
        extra['default_contributor_type_id'] = 2

    form_context = _build_form_context(
        ContributorInfoForm(),
        NewsEntryForm(),
        NewsAttachmentForm(),
        NewsSocialSourceForm(),
        extra=extra,
    )
    return render(request, template, form_context)


def news_collection_multistep_extortion(request):
    """Extortion multi-step form — 11 steps (8 shared + 3 type-specific)."""

    template = 'newshub/pages/news-collection-multistep-extortion.html'

    if request.method == 'POST':
        return _handle_news_submission(request, template, form_type_group_code='extortion')

    extra = {'selected_form_type': 'extortion'}
    if request.GET.get('submitted') == '1':
        extra['success_message'] = 'সংবাদ সফলভাবে জমা হয়েছে! (News submitted successfully)'

    extra['self_info'] = _get_user_contributor_info(request.user)

    # ---- Edit mode: pre-populate form from existing entry ----
    edit_entry_id = request.GET.get('edit')
    if edit_entry_id:
        try:
            edit_entry_id = int(edit_entry_id)
            edit_entry = CollNewsEntry.objects.get(newshub_coll_news_entry_id=edit_entry_id)
            # Permission check: owner or admin
            can_edit = False
            if request.user.is_authenticated:
                if request.user.is_staff or request.user.is_superuser:
                    can_edit = True
                elif edit_entry.link_contributor_id:
                    try:
                        contributor = Contributor.objects.get(
                            newshub_contributor_id=edit_entry.link_contributor_id
                        )
                        if contributor.link_user_profile_id:
                            user_profile = UserProfile.objects.get(
                                link_user_account_user_id=request.user.pk
                            )
                            if contributor.link_user_profile_id == user_profile.user_profile_id:
                                can_edit = True
                    except (Contributor.DoesNotExist, UserProfile.DoesNotExist):
                        pass
            if can_edit:
                from .helpers import build_edit_data
                # Resolve form type code from entry
                _edit_form_code = 'extortion'
                if edit_entry.link_form_type_id:
                    _ft = RefNewsFormType.objects.filter(
                        newshub_ref_news_form_type_id=edit_entry.link_form_type_id
                    ).values_list('group_code', flat=True).first()
                    if _ft:
                        _edit_form_code = _ft
                edit_data = build_edit_data(edit_entry_id, _edit_form_code)
                extra['edit_entry_id'] = edit_entry_id
                extra['edit_data_json'] = json.dumps(edit_data, default=str)
            else:
                extra['error_message'] = 'এই সংবাদ সম্পাদনার অনুমতি নেই (No permission to edit this article)'
        except Exception as exc:
            import traceback
            traceback.print_exc()
            extra['error_message'] = f'সম্পাদনা তথ্য লোড করতে সমস্যা: {exc}'

    # Extortion Steps 7 & 8 — All reference data in ONE query, then split by group_code
    _ext_group_codes = [
        'extortion_form_extortion_sector',
        'extortion_form_extortion_demand_frequency',
        'extortion_form_extortion_accused_affiliation',
        'extortion_form_extortion_threat_pressure_method',
        'extortion_form_extortion_victim_consequence',
        'extortion_form_extortion_bangladesh_context',
        'law_gd_fir_status',
        'extortion_form_law_applicable',
        'law_case_status',
        'extortion_form_law_support_service',
        'common_victim_risk_threat_pressure_retaliation',
    ]
    _all_ext_statuses = list(
        RefStatus.objects.filter(group_code__in=_ext_group_codes, is_active=True)
        .order_by('group_code', 'sort_order')
        .values('status_id', 'status_code', 'status_name_bn', 'status_name_en', 'status_icon', 'group_code')
    )
    _ext_by_group = {}
    for row in _all_ext_statuses:
        _ext_by_group.setdefault(row['group_code'], []).append(row)

    extra['extortion_sectors']              = _ext_by_group.get('extortion_form_extortion_sector', [])
    extra['extortion_demand_frequencies']   = _ext_by_group.get('extortion_form_extortion_demand_frequency', [])
    extra['extortion_accused_affiliations'] = _ext_by_group.get('extortion_form_extortion_accused_affiliation', [])
    extra['extortion_threat_methods']       = _ext_by_group.get('extortion_form_extortion_threat_pressure_method', [])
    extra['extortion_victim_consequences']  = _ext_by_group.get('extortion_form_extortion_victim_consequence', [])
    extra['extortion_bangladesh_contexts']  = _ext_by_group.get('extortion_form_extortion_bangladesh_context', [])

    # Legal action reference data (JSON for <script type="application/json"> blocks)
    extra['fir_statuses_json']          = json.dumps(_ext_by_group.get('law_gd_fir_status', []))
    extra['ext_applicable_laws_json']   = json.dumps(_ext_by_group.get('extortion_form_law_applicable', []))
    extra['ext_case_status_json']       = json.dumps(_ext_by_group.get('law_case_status', []))
    extra['ext_support_services_json']  = json.dumps(_ext_by_group.get('extortion_form_law_support_service', []))
    extra['ext_retaliation_json']       = json.dumps(_ext_by_group.get('common_victim_risk_threat_pressure_retaliation', []))

    # Reference data for involved parties repeater
    extra['actor_involvement_types_json'] = json.dumps(list(
        RefStatus.objects.filter(
            group_code='incident_involved_actor_role', is_active=True,
        ).order_by('sort_order')
        .values('status_id', 'status_code', 'status_name_bn', 'status_name_en')
    ))
    extra['actor_types_json'] = json.dumps(list(
        RefStatus.objects.filter(
            group_code='incident_involved_actor_type', is_active=True,
        ).order_by('sort_order')
        .values('status_id', 'status_code', 'status_name_bn', 'status_name_en')
    ))
    _add_actor_person_refs(extra)

    all_types = RefContributorType.objects.filter(is_active=True).order_by('contributor_group_code', 'sort_order')
    if request.user.is_authenticated:
        extra['contributor_types'] = all_types
        extra['default_contributor_type_id'] = 1
    else:
        extra['contributor_types'] = all_types.exclude(contributor_type_id=1)
        extra['default_contributor_type_id'] = 2

    form_context = _build_form_context(
        ContributorInfoForm(),
        NewsEntryForm(),
        NewsAttachmentForm(),
        NewsSocialSourceForm(),
        extra=extra,
    )
    return render(request, template, form_context)


@_form_access_required('land_grabbing')
def news_collection_multistep_land_grabbing(request):
    """Land Grabbing multi-step form — 12 steps (Steps 1-3, 7-12 DB-driven)."""

    template = 'newshub/pages/news-collection-multistep-land-grabbing.html'

    if request.method == 'POST':
        return _handle_news_submission(request, template, form_type_group_code='land_grabbing')

    extra = {'selected_form_type': 'land_grabbing'}
    if request.GET.get('submitted') == '1':
        extra['success_message'] = 'সংবাদ সফলভাবে জমা হয়েছে! (News submitted successfully)'

    extra['self_info'] = _get_user_contributor_info(request.user)

    # Reference data for involved parties repeater
    extra['actor_involvement_types_json'] = json.dumps(list(
        RefStatus.objects.filter(
            group_code='incident_involved_actor_role', is_active=True,
        ).order_by('sort_order')
        .values('status_id', 'status_code', 'status_name_bn', 'status_name_en')
    ))
    extra['actor_types_json'] = json.dumps(list(
        RefStatus.objects.filter(
            group_code='incident_involved_actor_type', is_active=True,
        ).order_by('sort_order')
        .values('status_id', 'status_code', 'status_name_bn', 'status_name_en')
    ))
    _add_actor_person_refs(extra)

    # Step 7 — Incident Details (DB-driven radio cards, select, checkboxes)
    _qs = lambda gc: list(
        RefStatus.objects.filter(group_code=gc, is_active=True).order_by('sort_order')
        .values('status_id', 'status_code', 'status_name_en', 'status_name_bn', 'status_icon')
    )
    extra['land_property_type_json']          = json.dumps(_qs('land_grabbing_form_land_type'))
    extra['land_area_unit_json']              = json.dumps(_qs('land_grabbing_form_land_grab_area_amount'))
    extra['land_document_title_status_json']  = json.dumps(_qs('land_grabbing_form_land_document_title_status'))
    extra['land_grabbing_method_json']        = json.dumps(_qs('land_grabbing_form_land_grabbing_method'))
    extra['land_current_status_json']         = json.dumps(_qs('land_grabbing_form_land_current_status'))

    # Step 8 — Legal Action (DB-driven GD/FIR, case status, applicable laws, support, retaliation)
    _rv_legal = ('status_id', 'status_code', 'status_name_bn', 'status_name_en')
    extra['fir_statuses_json'] = json.dumps(list(
        RefStatus.objects.filter(group_code='law_gd_fir_status', is_active=True)
        .order_by('sort_order').values(*_rv_legal)
    ))
    extra['land_case_status_json'] = json.dumps(list(
        RefStatus.objects.filter(group_code='law_case_status', is_active=True)
        .order_by('sort_order').values(*_rv_legal)
    ))
    extra['land_applicable_law_json']   = json.dumps(_qs('land_grabbing_form_law_applicable'))
    extra['land_support_service_json']  = json.dumps(_qs('land_grabbing_form_law_support_service'))
    extra['land_retaliation_json']      = json.dumps(_qs('common_victim_risk_threat_pressure_retaliation'))

    all_types = RefContributorType.objects.filter(is_active=True).order_by('contributor_group_code', 'sort_order')
    if request.user.is_authenticated:
        extra['contributor_types'] = all_types
        extra['default_contributor_type_id'] = 1
    else:
        extra['contributor_types'] = all_types.exclude(contributor_type_id=1)
        extra['default_contributor_type_id'] = 2

    form_context = _build_form_context(
        ContributorInfoForm(),
        NewsEntryForm(),
        NewsAttachmentForm(),
        NewsSocialSourceForm(),
        extra=extra,
    )
    return render(request, template, form_context)


@_form_access_required('crime_violence')
def news_collection_multistep_crime_violence(request):
    """Crime & Violence multi-step form — 10 steps (7 shared + 3 type-specific)."""

    template = 'newshub/pages/news-collection-multistep-crime-violence.html'

    if request.method == 'POST':
        return _handle_news_submission(request, template, form_type_group_code='crime_violence')

    extra = {'selected_form_type': 'crime_violence'}
    if request.GET.get('submitted') == '1':
        extra['success_message'] = 'সংবাদ সফলভাবে জমা হয়েছে! (News submitted successfully)'

    extra['self_info'] = _get_user_contributor_info(request.user)

    # Reference data for involved parties repeater
    extra['actor_involvement_types_json'] = json.dumps(list(
        RefStatus.objects.filter(
            group_code='incident_involved_actor_role', is_active=True,
        ).order_by('sort_order')
        .values('status_id', 'status_code', 'status_name_bn', 'status_name_en')
    ))
    extra['actor_types_json'] = json.dumps(list(
        RefStatus.objects.filter(
            group_code='incident_involved_actor_type', is_active=True,
        ).order_by('sort_order')
        .values('status_id', 'status_code', 'status_name_bn', 'status_name_en')
    ))
    _add_actor_person_refs(extra)

    # Weapon types for step 8 (from investigation.ref_status group_code=crime_form_weapon_type)
    extra['weapon_types'] = RefStatus.objects.filter(
        group_code='crime_form_weapon_type', is_active=True,
    ).order_by('sort_order')

    # Step 9 — Legal Action: GD/FIR status, case status, applicable laws, victim support, risks/threats
    _rv9 = ('status_id', 'status_code', 'status_name_bn', 'status_name_en')
    extra['fir_statuses_json'] = json.dumps(list(
        RefStatus.objects.filter(group_code='law_gd_fir_status', is_active=True)
        .order_by('sort_order').values(*_rv9)
    ))
    extra['crime_case_status_json'] = json.dumps(list(
        RefStatus.objects.filter(group_code='law_case_status', is_active=True)
        .order_by('sort_order').values(*_rv9)
    ))
    extra['applicable_laws_json'] = json.dumps(list(
        RefStatus.objects.filter(group_code='crime_form_applicable_law', is_active=True)
        .order_by('sort_order').values(*_rv9)
    ))
    extra['victim_support_services_json'] = json.dumps(list(
        RefStatus.objects.filter(group_code='crime_form_victim_support_service', is_active=True)
        .order_by('sort_order').values(*_rv9)
    ))
    extra['victim_risks_threats_json'] = json.dumps(list(
        RefStatus.objects.filter(group_code='common_victim_risk_threat_pressure_retaliation', is_active=True)
        .order_by('sort_order').values(*_rv9)
    ))

    # Victim health status for step 4 involved parties (from investigation.ref_status group_code=victim_medical_condition)
    extra['victim_health_statuses_json'] = json.dumps(list(
        RefStatus.objects.filter(
            group_code='victim_medical_condition', is_active=True,
        ).order_by('sort_order')
        .values('status_id', 'status_name_bn', 'status_name_en')
    ))

    all_types = RefContributorType.objects.filter(is_active=True).order_by('contributor_group_code', 'sort_order')
    if request.user.is_authenticated:
        extra['contributor_types'] = all_types
        extra['default_contributor_type_id'] = 1
    else:
        extra['contributor_types'] = all_types.exclude(contributor_type_id=1)
        extra['default_contributor_type_id'] = 2

    form_context = _build_form_context(
        ContributorInfoForm(),
        NewsEntryForm(),
        NewsAttachmentForm(),
        NewsSocialSourceForm(),
        extra=extra,
    )
    return render(request, template, form_context)


@_form_access_required('price_hike_syndicate')
def news_collection_multistep_price_hike(request):
    """Price Hike & Syndicate multi-step form — 10 steps (6 shared + 4 type-specific)."""

    template = 'newshub/pages/news-collection-multistep-price-hike.html'

    if request.method == 'POST':
        return _handle_news_submission(request, template, form_type_group_code='price_hike_syndicate')

    extra = {'selected_form_type': 'price_syndicate'}
    if request.GET.get('submitted') == '1':
        extra['success_message'] = 'সংবাদ সফলভাবে জমা হয়েছে! (News submitted successfully)'

    extra['self_info'] = _get_user_contributor_info(request.user)

    # Reference data for involved parties repeater
    extra['actor_involvement_types_json'] = json.dumps(list(
        RefStatus.objects.filter(
            group_code='incident_involved_actor_role', is_active=True,
        ).order_by('sort_order')
        .values('status_id', 'status_code', 'status_name_bn', 'status_name_en')
    ))
    extra['actor_types_json'] = json.dumps(list(
        RefStatus.objects.filter(
            group_code='incident_involved_actor_type', is_active=True,
        ).order_by('sort_order')
        .values('status_id', 'status_code', 'status_name_bn', 'status_name_en')
    ))
    _add_actor_person_refs(extra)

    all_types = RefContributorType.objects.filter(is_active=True).order_by('contributor_group_code', 'sort_order')
    if request.user.is_authenticated:
        extra['contributor_types'] = all_types
        extra['default_contributor_type_id'] = 1
    else:
        extra['contributor_types'] = all_types.exclude(contributor_type_id=1)
        extra['default_contributor_type_id'] = 2

    form_context = _build_form_context(
        ContributorInfoForm(),
        NewsEntryForm(),
        NewsAttachmentForm(),
        NewsSocialSourceForm(),
        extra=extra,
    )
    return render(request, template, form_context)


@_form_access_required('watchdog_bangladesh')
def news_collection_multistep_watchdog_bangladesh(request):
    """Watchdog Bangladesh (নজরদারি) multi-step form — 10 steps (6 shared + 4 type-specific)."""

    template = 'newshub/pages/news-collection-multistep-watchdog-bangladesh.html'

    if request.method == 'POST':
        return _handle_news_submission(request, template, form_type_group_code='watchdog_bangladesh')

    extra = {'selected_form_type': 'watchdog_bangladesh'}
    if request.GET.get('submitted') == '1':
        extra['success_message'] = 'সংবাদ সফলভাবে জমা হয়েছে! (News submitted successfully)'

    extra['self_info'] = _get_user_contributor_info(request.user)

    # Reference data for involved parties repeater
    extra['actor_involvement_types_json'] = json.dumps(list(
        RefStatus.objects.filter(
            group_code='incident_involved_actor_role', is_active=True,
        ).order_by('sort_order')
        .values('status_id', 'status_code', 'status_name_bn', 'status_name_en')
    ))
    extra['actor_types_json'] = json.dumps(list(
        RefStatus.objects.filter(
            group_code='incident_involved_actor_type', is_active=True,
        ).order_by('sort_order')
        .values('status_id', 'status_code', 'status_name_bn', 'status_name_en')
    ))
    _add_actor_person_refs(extra)

    all_types = RefContributorType.objects.filter(is_active=True).order_by('contributor_group_code', 'sort_order')
    if request.user.is_authenticated:
        extra['contributor_types'] = all_types
        extra['default_contributor_type_id'] = 1
    else:
        extra['contributor_types'] = all_types.exclude(contributor_type_id=1)
        extra['default_contributor_type_id'] = 2

    form_context = _build_form_context(
        ContributorInfoForm(),
        NewsEntryForm(),
        NewsAttachmentForm(),
        NewsSocialSourceForm(),
        extra=extra,
    )
    return render(request, template, form_context)


@_form_access_required('civic_community')
def news_collection_multistep_civic_community(request):
    """Civic & Community multi-step form — 12 steps (6 shared + 6 type-specific)."""

    template = 'newshub/pages/news-collection-multistep-civic-community.html'

    if request.method == 'POST':
        return _handle_news_submission(request, template, form_type_group_code='civic_community')

    extra = {'selected_form_type': 'civic_community'}
    if request.GET.get('submitted') == '1':
        extra['success_message'] = 'সংবাদ সফলভাবে জমা হয়েছে! (News submitted successfully)'

    extra['self_info'] = _get_user_contributor_info(request.user)

    # Reference data for civic sub-type (Step 3) — from investigation.ref_status group_code=civic_form_sub_issue_type
    extra['issue_sub_types_json'] = json.dumps(list(
        RefStatus.objects.filter(is_active=True, group_code='civic_form_sub_issue_type')
        .order_by('sort_order')
        .values('status_id', 'status_name_bn', 'status_name_en', 'status_icon')
    ))

    # Reference data for involved parties repeater
    extra['actor_involvement_types_json'] = json.dumps(list(
        RefStatus.objects.filter(
            group_code='incident_involved_actor_role', is_active=True,
        ).order_by('sort_order')
        .values('status_id', 'status_code', 'status_name_bn', 'status_name_en')
    ))
    extra['actor_types_json'] = json.dumps(list(
        RefStatus.objects.filter(
            group_code='incident_involved_actor_type', is_active=True,
        ).order_by('sort_order')
        .values('status_id', 'status_code', 'status_name_bn', 'status_name_en')
    ))
    _add_actor_person_refs(extra)

    # Reference data for civic impact & duration (Step 7) — from investigation.ref_status
    extra['impact_categories_json'] = json.dumps(list(
        RefStatus.objects.filter(group_code='civic_form_impact_category', is_active=True)
        .order_by('sort_order')
        .values('status_id', 'status_name_bn', 'status_name_en')
    ))
    extra['duration_units_json'] = json.dumps(list(
        RefStatus.objects.filter(group_code='civic_form_time_duration_unit', is_active=True)
        .order_by('sort_order')
        .values('status_id', 'status_name_bn', 'status_name_en')
    ))

    # Reference data for civic current status (Step 8) — from investigation.ref_status
    extra['issue_statuses_json'] = json.dumps(list(
        RefStatus.objects.filter(group_code='civic_form_current_issue_status', is_active=True)
        .order_by('sort_order')
        .values('status_id', 'status_name_bn', 'status_name_en', 'status_icon')
    ))

    all_types = RefContributorType.objects.filter(is_active=True).order_by('contributor_group_code', 'sort_order')
    if request.user.is_authenticated:
        extra['contributor_types'] = all_types
        extra['default_contributor_type_id'] = 1
    else:
        extra['contributor_types'] = all_types.exclude(contributor_type_id=1)
        extra['default_contributor_type_id'] = 2

    form_context = _build_form_context(
        ContributorInfoForm(),
        NewsEntryForm(),
        NewsAttachmentForm(),
        NewsSocialSourceForm(),
        extra=extra,
    )
    return render(request, template, form_context)


def _build_common_extra(request, selected_form_type):
    """Common context fields shared by Global News and War & Conflict."""
    extra = {'selected_form_type': selected_form_type}
    if request.GET.get('submitted') == '1':
        extra['success_message'] = 'সংবাদ সফলভাবে জমা হয়েছে! (News submitted successfully)'
    extra['self_info'] = _get_user_contributor_info(request.user)
    return extra


def _finalize_form_context(request, template, extra):
    """Add contributor types + render."""
    all_types = RefContributorType.objects.filter(is_active=True).order_by('contributor_group_code', 'sort_order')
    if request.user.is_authenticated:
        extra['contributor_types'] = all_types
        extra['default_contributor_type_id'] = 1
    else:
        extra['contributor_types'] = all_types.exclude(contributor_type_id=1)
        extra['default_contributor_type_id'] = 2

    form_context = _build_form_context(
        ContributorInfoForm(),
        NewsEntryForm(),
        NewsAttachmentForm(),
        NewsSocialSourceForm(),
        extra=extra,
    )
    return render(request, template, form_context)


@_form_access_required('global_news')
def news_collection_multistep_global_news(request):
    """Global News (আন্তর্জাতিক সংবাদ) — 10 steps."""

    template = 'newshub/pages/news-collection-multistep-global-news.html'

    if request.method == 'POST':
        return _handle_news_submission(request, template, form_type_group_code='global_news')

    extra = _build_common_extra(request, 'global_news')

    # Step 3: Issue sub-type dropdown (DB-driven)
    extra['global_news_sub_types_json'] = json.dumps(list(
        RefStatus.objects.filter(group_code='global_news_form_issue_sub_type', is_active=True)
        .order_by('sort_order')
        .values('status_id', 'status_name_bn', 'status_name_en', 'status_icon', 'status_code')
    ))

    # Step 3: Classification — news significance (DB-driven radio)
    extra['news_significance_json'] = json.dumps(list(
        RefStatus.objects.filter(group_code='global_news_form_news_significance', is_active=True)
        .order_by('sort_order')
        .values('status_id', 'status_name_bn', 'status_name_en', 'status_icon')
    ))

    # Step 5: Bangladesh relevance (DB-driven radio)
    extra['bd_relevance_json'] = json.dumps(list(
        RefStatus.objects.filter(group_code='global_news_form_relevance_to_bangladesh', is_active=True)
        .order_by('sort_order')
        .values('status_id', 'status_name_bn', 'status_name_en', 'status_icon')
    ))

    # Step 6: World reaction (DB-driven radio)
    extra['global_reactions_json'] = json.dumps(list(
        RefStatus.objects.filter(group_code='conflict_form_global_reaction', is_active=True)
        .order_by('sort_order')
        .values('status_id', 'status_name_bn', 'status_name_en')
    ))

    # Step 6: Media coverage (DB-driven radio)
    extra['media_coverage_json'] = json.dumps(list(
        RefStatus.objects.filter(group_code='global_news_form_global_media_coverage', is_active=True)
        .order_by('sort_order')
        .values('status_id', 'status_name_bn', 'status_name_en', 'status_icon')
    ))

    return _finalize_form_context(request, template, extra)


@_form_access_required('war_conflict')
def news_collection_multistep_war_conflict(request):
    """War & Conflict (যুদ্ধ ও সংঘাত) — 11 steps."""

    template = 'newshub/pages/news-collection-multistep-war-conflict.html'

    if request.method == 'POST':
        return _handle_news_submission(request, template, form_type_group_code='war_conflict')

    extra = _build_common_extra(request, 'war_conflict')

    # Step 3: Conflict sub-type (DB-driven radio cards)
    extra['conflict_sub_types_json'] = json.dumps(list(
        RefStatus.objects.filter(is_active=True, group_code='conflict_form_conflict_sub_issue_type')
        .order_by('sort_order')
        .values('status_id', 'status_name_bn', 'status_name_en', 'status_icon')
    ))

    # Step 4: Conflict parties — involvement types + country list
    extra['actor_involvement_types_json'] = json.dumps(list(
        RefStatus.objects.filter(
            group_code='incident_involved_actor_role', is_active=True,
        ).order_by('sort_order')
        .values('status_id', 'status_code', 'status_name_bn', 'status_name_en')
    ))

    with connection.cursor() as cursor:
        cursor.execute(
            "SELECT country_id, country_name_en, country_name_bn, country_iso_code "
            "FROM [location].[country] WHERE is_active=1 ORDER BY country_name_en"
        )
        cols = [c[0] for c in cursor.description]
        extra['countries_json'] = json.dumps(
            [dict(zip(cols, row)) for row in cursor.fetchall()]
        )

    # Step 5: Frontline — territory status, intensity, involvement level, weapon class
    extra['territory_statuses_json'] = json.dumps(list(
        RefStatus.objects.filter(
            group_code='conflict_form_territorial_sovereignty_status', is_active=True,
        ).order_by('sort_order')
        .values('status_id', 'status_code', 'status_name_bn', 'status_name_en')
    ))
    extra['conflict_intensity_json'] = json.dumps(list(
        RefStatus.objects.filter(
            group_code='conflict_form_conflict_intensity', is_active=True,
        ).order_by('sort_order')
        .values('status_id', 'status_code', 'status_name_bn', 'status_name_en')
    ))
    extra['involvement_levels_json'] = json.dumps(list(
        RefStatus.objects.filter(
            group_code='conflict_form_involvement_level', is_active=True,
        ).order_by('sort_order')
        .values('status_id', 'status_code', 'status_name_bn', 'status_name_en')
    ))
    extra['weapon_classes_json'] = json.dumps(list(
        RefStatus.objects.filter(
            group_code='conflict_form_weapon', is_active=True,
        ).order_by('sort_order')
        .values('status_id', 'status_code', 'status_name_bn', 'status_name_en')
    ))

    # Step 7: Geopolitics — global reaction
    extra['global_reactions_json'] = json.dumps(list(
        RefStatus.objects.filter(
            group_code='conflict_form_global_reaction', is_active=True,
        ).order_by('sort_order')
        .values('status_id', 'status_code', 'status_name_bn', 'status_name_en')
    ))

    return _finalize_form_context(request, template, extra)


@_form_access_required('sports')
def news_collection_multistep_sports(request):
    """Sports multi-step form — 10 steps (6 shared + 4 type-specific)."""

    template = 'newshub/pages/news-collection-multistep-sports.html'

    if request.method == 'POST':
        return _handle_news_submission(request, template, form_type_group_code='sports')

    extra = {'selected_form_type': 'sports'}
    if request.GET.get('submitted') == '1':
        extra['success_message'] = 'সংবাদ সফলভাবে জমা হয়েছে! (News submitted successfully)'

    extra['self_info'] = _get_user_contributor_info(request.user)

    all_types = RefContributorType.objects.filter(is_active=True).order_by('contributor_group_code', 'sort_order')
    if request.user.is_authenticated:
        extra['contributor_types'] = all_types
        extra['default_contributor_type_id'] = 1
    else:
        extra['contributor_types'] = all_types.exclude(contributor_type_id=1)
        extra['default_contributor_type_id'] = 2

    form_context = _build_form_context(
        ContributorInfoForm(),
        NewsEntryForm(),
        NewsAttachmentForm(),
        NewsSocialSourceForm(),
        extra=extra,
    )
    return render(request, template, form_context)


@_form_access_required('entertainment')
def news_collection_multistep_entertainment(request):
    """Entertainment multi-step form — 10 steps (6 shared + 4 type-specific)."""

    template = 'newshub/pages/news-collection-multistep-entertainment.html'

    if request.method == 'POST':
        return _handle_news_submission(request, template, form_type_group_code='entertainment')

    extra = {'selected_form_type': 'entertainment'}
    if request.GET.get('submitted') == '1':
        extra['success_message'] = 'সংবাদ সফলভাবে জমা হয়েছে! (News submitted successfully)'

    extra['self_info'] = _get_user_contributor_info(request.user)

    all_types = RefContributorType.objects.filter(is_active=True).order_by('contributor_group_code', 'sort_order')
    if request.user.is_authenticated:
        extra['contributor_types'] = all_types
        extra['default_contributor_type_id'] = 1
    else:
        extra['contributor_types'] = all_types.exclude(contributor_type_id=1)
        extra['default_contributor_type_id'] = 2

    form_context = _build_form_context(
        ContributorInfoForm(),
        NewsEntryForm(),
        NewsAttachmentForm(),
        NewsSocialSourceForm(),
        extra=extra,
    )
    return render(request, template, form_context)


@_form_access_required('july_uprising_2024')
def news_collection_multistep_july_uprising(request):
    """July Uprising 2024 multi-step form — 12 steps (6 shared + 6 type-specific)."""

    template = 'newshub/pages/news-collection-multistep-july-uprising.html'

    if request.method == 'POST':
        return _handle_news_submission(request, template, form_type_group_code='july_uprising_2024')

    extra = {'selected_form_type': 'july_uprising_2024'}
    if request.GET.get('submitted') == '1':
        extra['success_message'] = 'তথ্য সফলভাবে নথিভুক্ত হয়েছে! (Documentation submitted successfully)'

    extra['self_info'] = _get_user_contributor_info(request.user)

    # Incident types for step 3 (group_code=july2024_incident_type)
    extra['july_incident_types'] = RefStatus.objects.filter(
        group_code='july2024_incident_type', is_active=True,
    ).order_by('sort_order').values('status_id', 'status_code', 'status_name_bn', 'status_name_en', 'status_icon')

    # Protest scale options for step 3 (group_code=july2024_protest_state_number)
    extra['july_protest_scales'] = RefStatus.objects.filter(
        group_code='july2024_protest_state_number', is_active=True,
    ).order_by('sort_order').values('status_id', 'status_name_bn', 'status_name_en')

    # Internet status options for step 3 (group_code=government_internet_speed_control)
    extra['july_internet_statuses'] = RefStatus.objects.filter(
        group_code='government_internet_speed_control', is_active=True,
    ).order_by('sort_order').values('status_id', 'status_name_bn', 'status_name_en')

    # Curfew status options for step 3 (group_code=government_curfew_status)
    extra['july_curfew_statuses'] = RefStatus.objects.filter(
        group_code='government_curfew_status', is_active=True,
    ).order_by('sort_order').values('status_id', 'status_name_bn', 'status_name_en')

    _rv = ('status_id', 'status_code', 'status_name_bn', 'status_name_en')
    _rvi = _rv + ('status_icon',)
    _rsf = RefStatus.objects.filter

    # Martyr profile: gender + baby_gender combined (baby_gender sorts first via sort_order)
    extra['july_genders'] = _rsf(
        group_code__in=['baby_gender', 'gender'], is_active=True,
    ).order_by('sort_order').values(*_rv)

    # Martyr profile: religion list (group_code=religion)
    extra['july_religions'] = _rsf(
        group_code='religion', is_active=True,
    ).order_by('sort_order').values(*_rv)

    # Martyr profile: occupation list (group_code=july2024_occupation_list)
    extra['july_occupations'] = _rsf(
        group_code='july2024_occupation_list', is_active=True,
    ).order_by('sort_order').values(*_rv)

    # Martyr profile: home district dropdown (ordered by English name)
    extra['july_districts'] = District.objects.filter(
        is_active=True,
    ).order_by('district_name_en').values('district_id', 'district_name_bn', 'district_name_en')

    # Story step: victim current status (group_code=july2024_victim_current_status)
    extra['july_victim_statuses'] = _rsf(
        group_code='july2024_victim_current_status', is_active=True,
    ).order_by('sort_order').values(*_rvi)

    # Cause step: weapon types (group_code=july2024_protest_suppression_weapon)
    extra['weapon_types'] = _rsf(
        group_code='july2024_protest_suppression_weapon', is_active=True,
    ).order_by('sort_order').values(*_rv)

    # Cause step: body injury sites (group_code=victim_body_injury_site)
    extra['injury_sites'] = _rsf(
        group_code='victim_body_injury_site', is_active=True,
    ).order_by('sort_order').values(*_rv)

    # Cause step: death evidence flags (group_code=victim_death_evidence)
    extra['july_death_evidence'] = _rsf(
        group_code='victim_death_evidence', is_active=True,
    ).order_by('sort_order').values(*_rv)

    # Oppressors step: forces involved (group_code=july2024_protest_suppression_force_involved)
    extra['july_forces_involved'] = _rsf(
        group_code='july2024_protest_suppression_force_involved', is_active=True,
    ).order_by('sort_order').values(*_rv)

    # Evidence step: verification status (group_code=verification_status)
    extra['july_verification_statuses'] = _rsf(
        group_code='verification_status', is_active=True,
    ).order_by('sort_order').values(*_rvi)

    # Evidence step: available evidence types (group_code=july2024_available_evidence)
    extra['july_available_evidence'] = _rsf(
        group_code='july2024_available_evidence', is_active=True,
    ).order_by('sort_order').values(*_rvi)

    all_types = RefContributorType.objects.filter(is_active=True).order_by('contributor_group_code', 'sort_order')
    if request.user.is_authenticated:
        extra['contributor_types'] = all_types
        extra['default_contributor_type_id'] = 1
    else:
        extra['contributor_types'] = all_types.exclude(contributor_type_id=1)
        extra['default_contributor_type_id'] = 2

    form_context = _build_form_context(
        ContributorInfoForm(),
        NewsEntryForm(),
        NewsAttachmentForm(),
        NewsSocialSourceForm(),
        extra=extra,
    )
    return render(request, template, form_context)


@_form_access_required('women_child_violence')
def news_collection_multistep_women_child_violence(request):
    """Women & Child Violence form — 12 steps (7 shared + 5 type-specific)."""

    template = 'newshub/pages/news-collection-multistep-women-child-violence.html'

    if request.method == 'POST':
        return _handle_news_submission(request, template, form_type_group_code='women_child_violence')

    extra = {'selected_form_type': 'women_child_violence'}
    if request.GET.get('submitted') == '1':
        extra['success_message'] = 'তথ্য সফলভাবে নথিভুক্ত হয়েছে! (Documentation submitted successfully)'

    extra['self_info'] = _get_user_contributor_info(request.user)

    # Reference data for victim profile — querysets for template includes
    _rs = RefStatus.objects.filter
    _rv = ('status_id', 'status_code', 'status_name_bn', 'status_name_en')

    # Victim universal identity (template-rendered via person-personal-info-fields.html)
    extra['wcv_victim_genders'] = _rs(
        group_code__in=['baby_gender', 'gender'], is_active=True,
    ).order_by('sort_order').values(*_rv)
    extra['wcv_victim_religions'] = _rs(
        group_code='religion', is_active=True,
    ).order_by('sort_order').values(*_rv)
    extra['wcv_victim_districts'] = District.objects.filter(
        is_active=True,
    ).order_by('district_name_en').values('district_id', 'district_name_bn', 'district_name_en')

    # Reference data for accused repeater JS (JSON for CSP-safe script tags)

    extra['wcv_genders'] = json.dumps(list(
        _rs(group_code__in=['baby_gender', 'gender'], is_active=True).order_by('sort_order').values(*_rv)
    ))
    extra['wcv_religions'] = json.dumps(list(
        _rs(group_code='religion', is_active=True).order_by('sort_order').values(*_rv)
    ))
    extra['wcv_districts'] = json.dumps(list(
        District.objects.filter(is_active=True).order_by('district_name_en')
        .values('district_id', 'district_name_en', 'district_name_bn')
    ))
    extra['wcv_marital_statuses'] = json.dumps(list(
        _rs(group_code='marital_status', is_active=True).order_by('sort_order').values(*_rv)
    ))
    extra['wcv_victim_occupations'] = json.dumps(list(
        _rs(group_code='women_form_victim_occupation', is_active=True).order_by('sort_order').values(*_rv)
    ))
    extra['wcv_medical_conditions'] = json.dumps(list(
        _rs(group_code='victim_medical_condition', is_active=True).order_by('sort_order').values(*_rv)
    ))
    extra['wcv_safety_statuses'] = json.dumps(list(
        _rs(group_code='victim_safety_status', is_active=True).order_by('sort_order').values(*_rv)
    ))
    extra['wcv_consent_statuses'] = json.dumps(list(
        _rs(group_code='consent_status', is_active=True).order_by('sort_order').values(*_rv)
    ))

    # Reference data for injury types + severity (Step 5)
    extra['wcv_injury_types'] = json.dumps(list(
        _rs(group_code='women_form_victim_injury_type', is_active=True).order_by('sort_order').values(*_rv)
    ))
    extra['wcv_injury_severity'] = json.dumps(list(
        _rs(group_code='women_form_victim_injury_severity', is_active=True).order_by('sort_order').values(*_rv)
    ))
    extra['wcv_psychological_symptoms'] = json.dumps(list(
        _rs(group_code='women_form_victim_psychological_symptom', is_active=True).order_by('sort_order').values(*_rv)
    ))

    # Reference data for violence type checkboxes + location type select (Step 3)
    extra['wcv_violence_types'] = json.dumps(list(
        _rs(group_code='women_form_violence_type', is_active=True).order_by('sort_order').values(*_rv)
    ))
    extra['wcv_incident_location_types'] = json.dumps(list(
        _rs(group_code='women_form_victim_incident_location_type', is_active=True).order_by('sort_order').values(*_rv)
    ))

    # Reference data for accused/perpetrator dropdowns/checkboxes (Step 6)
    extra['wcv_attacker_relationships'] = json.dumps(list(
        _rs(group_code='victim_attacker_relationship', is_active=True).order_by('sort_order').values(*_rv)
    ))
    extra['wcv_attacker_positions'] = json.dumps(list(
        _rs(group_code='women_form_attacker_power_position', is_active=True).order_by('sort_order').values(*_rv)
    ))
    extra['wcv_attacker_attributes'] = json.dumps(list(
        _rs(group_code='women_form_attacker_attribute', is_active=True).order_by('sort_order').values(*_rv)
    ))

    # Reference data for legal action & support step (Step 7)
    extra['wcv_fir_statuses'] = json.dumps(list(
        _rs(group_code='law_gd_fir_status', is_active=True).order_by('sort_order').values(*_rv)
    ))
    extra['wcv_applicable_laws'] = json.dumps(list(
        _rs(group_code='women_form_victim_law_applicable_law', is_active=True).order_by('sort_order').values(*_rv)
    ))
    extra['wcv_case_statuses'] = json.dumps(list(
        _rs(group_code='law_case_status', is_active=True).order_by('sort_order').values(*_rv)
    ))
    extra['wcv_support_services'] = json.dumps(list(
        _rs(group_code='women_form_victim_law_support_service', is_active=True).order_by('sort_order').values(*_rv)
    ))
    extra['wcv_retaliation_types'] = json.dumps(list(
        _rs(group_code='common_victim_risk_threat_pressure_retaliation', is_active=True).order_by('sort_order').values(*_rv)
    ))

    # Reference data for standard witness repeater (Step 7)
    extra['actor_involvement_types_json'] = json.dumps(list(
        RefStatus.objects.filter(
            group_code='incident_involved_actor_role', is_active=True,
        ).order_by('sort_order')
        .values('status_id', 'status_code', 'status_name_bn', 'status_name_en')
    ))
    extra['actor_types_json'] = json.dumps(list(
        RefStatus.objects.filter(
            group_code='incident_involved_actor_type', is_active=True,
        ).order_by('sort_order')
        .values('status_id', 'status_code', 'status_name_bn', 'status_name_en')
    ))
    _add_actor_person_refs(extra)

    all_types = RefContributorType.objects.filter(is_active=True).order_by('contributor_group_code', 'sort_order')
    if request.user.is_authenticated:
        extra['contributor_types'] = all_types
        extra['default_contributor_type_id'] = 1
    else:
        extra['contributor_types'] = all_types.exclude(contributor_type_id=1)
        extra['default_contributor_type_id'] = 2

    form_context = _build_form_context(
        ContributorInfoForm(),
        NewsEntryForm(),
        NewsAttachmentForm(),
        NewsSocialSourceForm(),
        extra=extra,
    )
    return render(request, template, form_context)


def news_article_landing(request):
    """Public landing page — list of published articles."""
    from .models import PubArticle, EngagementArticleStat

    published_articles = PubArticle.objects.filter(
        is_published=True
    ).order_by('-published_at')[:50]

    # Enrich with news entry data (category, contributor, occurrence date)
    articles_with_meta = []
    for published_article in published_articles:
        try:
            entry = CollNewsEntry.objects.get(
                newshub_coll_news_entry_id=published_article.link_news_entry_id
            )
        except CollNewsEntry.DoesNotExist:
            continue

        category = None
        if entry.link_news_category_id:
            try:
                category = RefNewsCategory.objects.get(
                    news_category_id=entry.link_news_category_id
                )
            except RefNewsCategory.DoesNotExist:
                pass

        contributor = None
        if entry.link_contributor_id:
            try:
                contributor = Contributor.objects.get(
                    newshub_contributor_id=entry.link_contributor_id
                )
            except Contributor.DoesNotExist:
                pass

        # Resolve contributor display name
        contributor_display_name = ''
        if contributor:
            contributor_display_name = contributor.contributor_full_name_bn or ''
            if '@' in contributor_display_name and contributor.link_user_profile_id:
                try:
                    profile = UserProfile.objects.get(
                        user_profile_id=contributor.link_user_profile_id
                    )
                    if profile.link_person_id:
                        person = Person.objects.get(person_id=profile.link_person_id)
                        real_name = f"{person.first_name_bn or ''} {person.last_name_bn or ''}".strip()
                        if not real_name:
                            real_name = f"{person.first_name_en or ''} {person.last_name_en or ''}".strip()
                        if real_name:
                            contributor_display_name = real_name
                except (UserProfile.DoesNotExist, Person.DoesNotExist):
                    pass

        form_type_obj = None
        if entry.link_form_type_id:
            try:
                form_type_obj = RefNewsFormType.objects.get(newshub_ref_news_form_type_id=entry.link_form_type_id)
            except RefNewsFormType.DoesNotExist:
                pass

        articles_with_meta.append({
            'published_article': published_article,
            'entry': entry,
            'category': category,
            'contributor': contributor,
            'contributor_display_name': contributor_display_name,
            'form_type': form_type_obj,
        })

    # Bulk-fetch cover image URLs for all articles
    from .helpers import get_article_cover_urls_bulk
    entry_ids = [a['entry'].newshub_coll_news_entry_id for a in articles_with_meta]
    cover_url_map = get_article_cover_urls_bulk(entry_ids)
    for article_meta in articles_with_meta:
        article_meta['cover_image_url'] = cover_url_map.get(
            article_meta['entry'].newshub_coll_news_entry_id
        )

    # Bulk-fetch engagement stats (like_count, view_count) for all articles
    pub_article_ids = [a['published_article'].pub_article_id for a in articles_with_meta]
    stats_map = {}
    if pub_article_ids:
        for stat in EngagementArticleStat.objects.filter(link_pub_article_id__in=pub_article_ids):
            stats_map[stat.link_pub_article_id] = stat
    for article_meta in articles_with_meta:
        stat = stats_map.get(article_meta['published_article'].pub_article_id)
        article_meta['like_count'] = stat.like_count if stat else 0
        article_meta['view_count'] = stat.view_count if stat else 0

    context = {
        'articles': articles_with_meta,
        'seo': {
            'title': 'সংবাদ — আমলনামা নিউজ | Bangladesh News',
            'description': 'বাংলাদেশের সর্বশেষ খবর ও তদন্ত প্রতিবেদন। Latest news and investigation reports from Bangladesh.',
            'og_type': 'website',
            'breadcrumbs': [
                {'name': 'হোম', 'url': '/'},
                {'name': 'সংবাদ', 'url': None},
            ],
        },
    }
    return render(request, 'newshub/pages/article-landing.html', context)


def admin_form_access(request):
    """Admin panel — manage form access permissions. Staff/superuser only."""
    if not request.user.is_authenticated or not (request.user.is_staff or request.user.is_superuser):
        from django.http import Http404
        raise Http404

    form_types = RefNewsFormType.objects.filter(is_active=True).order_by('newshub_ref_news_form_type_id')

    return render(request, 'newshub/pages/news-admin-form-access.html', {
        'form_types': form_types,
        'seo': {
            'title': 'ফর্ম প্রবেশাধিকার — অ্যাডমিন | আমলনামা নিউজ',
        },
    })


def article_detail(request, slug):
    """Public article detail view — two-column sidenote layout via pub_article slug."""
    from .helpers import build_sidenote_data
    from .models import PubArticle, EngagementComment, EngagementArticleStat
    from django.http import Http404

    # Find published article by slug
    try:
        published_article = PubArticle.objects.get(pub_article_slug=slug, is_published=True)
    except PubArticle.DoesNotExist:
        raise Http404("Article not found")

    # Get the underlying news entry
    try:
        entry = CollNewsEntry.objects.get(newshub_coll_news_entry_id=published_article.link_news_entry_id)
    except CollNewsEntry.DoesNotExist:
        raise Http404("Article not found")

    # Determine form type
    form_type_code = ''
    form_type_obj = None
    if entry.link_form_type_id:
        try:
            form_type_obj = RefNewsFormType.objects.get(newshub_ref_news_form_type_id=entry.link_form_type_id)
            form_type_code = form_type_obj.group_code
        except RefNewsFormType.DoesNotExist:
            pass

    # Build sidenote data
    sidenotes = build_sidenote_data(entry, form_type_code)

    # Publication status
    publication_status = None
    if entry.link_ref_status_article_publication_status_id:
        try:
            publication_status = RefStatus.objects.get(
                status_id=entry.link_ref_status_article_publication_status_id
            )
        except RefStatus.DoesNotExist:
            pass

    # Contributor — resolve display name (fallback to person name if email stored)
    contributor = None
    contributor_display_name = ''
    if entry.link_contributor_id:
        try:
            contributor = Contributor.objects.get(
                newshub_contributor_id=entry.link_contributor_id
            )
            contributor_display_name = contributor.contributor_full_name_bn or ''
            # If display name looks like an email, try to get real name from user profile → person
            if '@' in contributor_display_name and contributor.link_user_profile_id:
                try:
                    contributor_profile = UserProfile.objects.get(
                        user_profile_id=contributor.link_user_profile_id
                    )
                    if contributor_profile.link_person_id:
                        contributor_person = Person.objects.get(person_id=contributor_profile.link_person_id)
                        real_name = f"{contributor_person.first_name_bn or ''} {contributor_person.last_name_bn or ''}".strip()
                        if not real_name:
                            real_name = f"{contributor_person.first_name_en or ''} {contributor_person.last_name_en or ''}".strip()
                        if real_name:
                            contributor_display_name = real_name
                except Exception as person_lookup_error:
                    logger.error('Contributor person lookup failed — %s', person_lookup_error)
        except Contributor.DoesNotExist:
            pass

    # Tags
    tag_ids = NewsEntryTag.objects.filter(
        link_newshub_coll_news_entry_id=entry.newshub_coll_news_entry_id
    ).values_list('link_news_category_tag_id', flat=True)
    tags = []
    if tag_ids:
        tags = list(RefNewsCategoryTag.objects.filter(
            news_category_tag_id__in=tag_ids
        ).values('news_tag_name_bn', 'news_tag_name_en'))

    # Category
    category = None
    if entry.link_news_category_id:
        try:
            category = RefNewsCategory.objects.get(
                news_category_id=entry.link_news_category_id
            )
        except RefNewsCategory.DoesNotExist:
            pass

    # Split body into paragraphs — strip block <p> tags, keep inline formatting
    # Use the longer body — pub_article may have stale/test data, entry has the real submission
    body_paragraphs = []
    pub_body = published_article.pub_article_content_bn or ''
    entry_body = entry.news_content_body_bn or ''
    body_source = pub_body if len(pub_body) > len(entry_body) else entry_body
    if body_source:
        body_cleaned = re.sub(r'</?p[^>]*>', '\n', body_source)
        body_paragraphs = [p.strip() for p in body_cleaned.split('\n') if p.strip()]

    # Check edit permissions
    can_edit = False
    if request.user.is_authenticated:
        if request.user.is_staff or request.user.is_superuser:
            can_edit = True
        elif contributor and contributor.link_user_profile_id:
            try:
                user_profile = UserProfile.objects.get(
                    link_user_account_user_id=request.user.pk
                )
                if contributor.link_user_profile_id == user_profile.user_profile_id:
                    can_edit = True
            except UserProfile.DoesNotExist:
                pass

    # Build edit URL based on form type
    edit_url = ''
    form_type_url_map = {
        'general_news': 'newshub:news_collection_multistep',
        'extortion': 'newshub:news_collection_multistep_extortion',
        'crime_violence': 'newshub:news_collection_multistep_crime_violence',
        'land_grabbing': 'newshub:news_collection_multistep_land_grabbing',
        'price_hike_syndicate': 'newshub:news_collection_multistep_price_hike',
        'watchdog_bangladesh': 'newshub:news_collection_multistep_watchdog_bangladesh',
        'civic_community': 'newshub:news_collection_multistep_civic_community',
        'global_news': 'newshub:news_collection_multistep_global_news',
        'war_conflict': 'newshub:news_collection_multistep_war_conflict',
        'sports': 'newshub:news_collection_multistep_sports',
        'entertainment': 'newshub:news_collection_multistep_entertainment',
        'july_uprising_2024': 'newshub:news_collection_multistep_july_uprising',
        'women_child_violence': 'newshub:news_collection_multistep_women_child_violence',
    }
    url_name = form_type_url_map.get(form_type_code)
    if url_name:
        edit_url = reverse(url_name) + '?edit=' + str(entry.newshub_coll_news_entry_id)

    # Comments (approved only for public view)
    comments = list(EngagementComment.objects.filter(
        link_pub_article_id=published_article.pub_article_id,
        is_approved=True,
    ).order_by('created_at'))

    # Article stats (view count, share count) — increment view count on each page load
    from django.db.models import F
    stats_updated = EngagementArticleStat.objects.filter(
        link_pub_article_id=published_article.pub_article_id,
    ).update(view_count=F('view_count') + 1)

    if not stats_updated:
        # No stat row yet — create one with view_count=1
        EngagementArticleStat.objects.create(
            link_pub_article_id=published_article.pub_article_id,
            view_count=1,
            share_count=0,
            like_count=0,
        )

    stats = None
    try:
        stats = EngagementArticleStat.objects.get(link_pub_article_id=published_article.pub_article_id)
    except EngagementArticleStat.DoesNotExist:
        pass

    # Community additions (visible: pending + approved)
    from .models import ArticleCommunityAddition
    additions = list(ArticleCommunityAddition.objects.filter(
        link_newshub_coll_news_entry_id=entry.newshub_coll_news_entry_id,
    ).exclude(status_code='rejected').order_by('-created_at'))

    # Publication status options (for admin/editor dropdown)
    publication_status_options = []
    if can_edit:
        publication_status_options = list(RefStatus.objects.filter(
            group_code='article_publication_status', is_active=True
        ).order_by('sort_order').values('status_id', 'status_code', 'status_name_bn', 'status_icon'))

    # ---- Article like (session-based) ----
    article_like_count = stats.like_count if stats else 0
    article_view_count = stats.view_count if stats else 0
    article_user_liked = str(published_article.pub_article_id) in request.session.get('article_likes', [])

    # ---- Bookmark state (universal — uses [newsengine].[bookmark_content]) ----
    from amolnama_news.site_apps.core.utils import is_bookmarked, get_bookmark_count, get_user_profile_id
    article_user_profile_id = get_user_profile_id(request)
    article_user_bookmarked = is_bookmarked(article_user_profile_id, 'news', published_article.pub_article_id)
    article_bookmark_count = get_bookmark_count('news', published_article.pub_article_id)

    # ---- Article photos (evidence, impact, accused, victim, witness, general) ----
    from .helpers import get_article_photos
    article_photos = get_article_photos(entry.newshub_coll_news_entry_id)
    cover_image_url = article_photos['cover_image_url']
    photo_groups = article_photos['groups']

    # Annotate each photo with user_liked flag (session-based)
    liked_photo_keys = set(request.session.get('article_photo_likes', []))
    for photo in article_photos['all']:
        photo_key = str(entry.newshub_coll_news_entry_id) + '_' + str(photo['link_asset_id'])
        photo['user_liked'] = photo_key in liked_photo_keys

    # ---- SEO ----
    headline = published_article.pub_article_headline_bn or entry.news_headline_bn or "সংবাদ"
    seo_description = (entry.news_summary_bn or "")[:160]
    if not seo_description and body_paragraphs:
        # Strip HTML tags from first paragraph for meta description
        seo_description = re.sub(r'<[^>]+>', '', body_paragraphs[0])[:160]
    canonical_url = request.build_absolute_uri(
        reverse('newshub:article_detail', kwargs={'slug': slug})
    )
    form_type_label = form_type_obj.form_name_bn if form_type_obj else ""
    category_label = category.news_category_name_bn if category else ""

    # JSON-LD: NewsArticle schema
    json_ld_article = {
        "@context": "https://schema.org",
        "@type": "NewsArticle",
        "headline": headline,
        "description": seo_description,
        "url": canonical_url,
        "inLanguage": "bn",
        "publisher": {
            "@type": "NewsMediaOrganization",
            "name": "আমলনামা নিউজ",
            "url": request.build_absolute_uri("/"),
        },
    }
    if contributor_display_name:
        json_ld_article["author"] = {"@type": "Person", "name": contributor_display_name}
    if published_article.published_at:
        json_ld_article["datePublished"] = published_article.published_at.isoformat()
    if entry.updated_at:
        json_ld_article["dateModified"] = entry.updated_at.isoformat()
    if form_type_label:
        json_ld_article["articleSection"] = form_type_label

    # Breadcrumbs
    breadcrumbs = [
        {"name": "হোম", "url": "/"},
        {"name": "সংবাদ", "url": reverse('newshub:news_article_landing')},
    ]
    if category_label:
        breadcrumbs.append({"name": category_label, "url": None})
    breadcrumbs.append({"name": headline[:60], "url": None})

    seo_context = {
        "title": f"{headline} — আমলনামা নিউজ",
        "description": seo_description,
        "og_image": request.build_absolute_uri(cover_image_url) if cover_image_url else "",
        "og_type": "article",
        "canonical": canonical_url,
        "json_ld": json_ld_article,
        "breadcrumbs": breadcrumbs,
    }
    if cover_image_url:
        json_ld_article["image"] = request.build_absolute_uri(cover_image_url)

    # Writer info for actions bar
    contributor_user_profile_id = contributor.link_user_profile_id if contributor else None
    from amolnama_news.site_apps.core.utils import build_actions_bar_author_context, build_related_content_items
    actions_bar_author_context = build_actions_bar_author_context(contributor_user_profile_id, request, profile_suffix='articles/')

    # Record content view for personalization
    if request.user.is_authenticated:
        try:
            from amolnama_news.site_apps.core.utils import get_user_profile_id
            viewer_user_profile_id = get_user_profile_id(request)
            if viewer_user_profile_id:
                from amolnama_news.site_apps.newsengine.personalization import record_content_view
                record_content_view(viewer_user_profile_id, 'article', published_article.pub_article_id)
        except Exception as record_view_error:
            logger.error('record_content_view failed for article %s — %s',
                         published_article.pub_article_id, record_view_error)

    context = {
        'published_article': published_article,
        'entry': entry,
        'sidenotes': sidenotes,
        'publication_status': publication_status,
        'publication_status_options': publication_status_options,
        'contributor': contributor,
        'contributor_display_name': contributor_display_name,
        'tags': tags,
        'category': category,
        'body_paragraphs': body_paragraphs,
        'form_type_code': form_type_code,
        'form_type': form_type_obj,
        'can_edit': can_edit,
        'edit_url': edit_url,
        'comments': comments,
        'stats': stats,
        'additions': additions,
        'cover_image_url': cover_image_url,
        'photo_groups': photo_groups,
        'all_photos': article_photos['all'],
        'article_like_count': article_like_count,
        'article_view_count': article_view_count,
        'article_user_liked': article_user_liked,
        # Names the shared content_actions_bar tag reads from context:
        'user_liked': article_user_liked,
        'user_bookmarked': article_user_bookmarked,
        'bookmark_count': article_bookmark_count,
        'actions_bar_content_registry_id': getattr(published_article, 'link_content_registry_id', None),
        **actions_bar_author_context,
        'related_content_items': build_related_content_items(
            published_article.pub_article_headline_bn or published_article.pub_article_body_bn or '',
            'article', published_article.pub_article_id, limit=5,
        ),
        'related_content_api_url': f'/newsengine/api/related-content/?type=article&id={published_article.pub_article_id}',
        'seo': seo_context,
    }
    return render(request, 'newshub/pages/article-detail.html', context)


def _save_or_reuse_asset(uploaded_file, file_desc, now):
    """Hash → dedup check → create Asset if new → save file to disk.

    Returns the Asset instance (existing or newly created).
    """
    # Compute SHA-256 hash (read in chunks for large files)
    sha256 = hashlib.sha256()
    for chunk in uploaded_file.chunks():
        sha256.update(chunk)
    file_hash = sha256.digest()
    uploaded_file.seek(0)

    # Check if identical file already exists in media.asset
    existing_asset = Asset.objects.filter(
        hash_sha256=file_hash,
        file_size_bytes=uploaded_file.size,
        is_active=True,
    ).first()

    if existing_asset:
        asset = existing_asset
        if file_desc and not asset.asset_description_bn:
            asset.asset_description_bn = file_desc
            asset.save(update_fields=['asset_description_bn'])
    else:
        content_type = getattr(uploaded_file, 'content_type', '') or ''
        file_name = uploaded_file.name
        file_ext = os.path.splitext(file_name)[1].lower()

        asset = Asset.objects.create(
            asset_guid=str(uuid.uuid4()),
            file_original_name=file_name,
            file_extension=file_ext,
            file_mime_type=content_type,
            file_size_bytes=uploaded_file.size,
            asset_description_bn=file_desc,
            hash_sha256=file_hash,
            hash_algorithm_used='SHA-256',
            hash_is_verified=True,
            hash_last_verify_at=now,
            is_active=True,
            created_at=now,
            modified_at=now,
        )

        # Read back the computed file_storage_path from the inserted record
        with connection.cursor() as cur:
            cur.execute(
                "SELECT file_storage_path FROM [media].[asset] WHERE asset_id = %s",
                [asset.asset_id],
            )
            storage_path = cur.fetchone()[0]

        # Save physical file to MEDIA_ROOT / file_storage_path
        full_path = os.path.join(settings.MEDIA_ROOT, storage_path)
        os.makedirs(os.path.dirname(full_path), exist_ok=True)

        with open(full_path, 'wb+') as dest:
            for chunk in uploaded_file.chunks():
                dest.write(chunk)

    return asset


# ---------------------------------------------------------------------------
# Shared evidence/attachment file save helper — single source of truth
# ---------------------------------------------------------------------------
# Used by: crime evidence, extortion evidence, and any future form-specific
# file upload sections. All flow through _save_or_reuse_asset → NewsAsset.
# General attachments (with caption + featured) have their own block because
# of the extra caption/featured logic.

def _save_evidence_files(request, newshub_coll_news_entry_id, file_field, desc_field, max_count, now,
                         asset_group_code=None):
    """Save evidence/form-specific file uploads → media.asset + newshub.news_asset.

    Args:
        request              — Django request object
        newshub_coll_news_entry_id   — primary key of the news entry
        file_field           — POST file field name, e.g. 'crime_evidence_file'
        desc_field           — POST field name for descriptions JSON, e.g. 'crime_evidence_descriptions_json'
        max_count            — max files to save (typically 4)
        now                  — datetime for created_at
        asset_group_code     — photo group tag: 'evidence', 'impact', 'accused', 'victim', 'witness', 'general'
    """
    uploaded_files = request.FILES.getlist(file_field)
    if not uploaded_files:
        return

    descs = []
    descs_raw = request.POST.get(desc_field, '')
    if descs_raw:
        try:
            descs = json.loads(descs_raw)
        except (json.JSONDecodeError, ValueError):
            raise  # propagate to outer atomic block for full rollback

    for i, uploaded_file in enumerate(uploaded_files[:max_count]):
        file_desc = None
        if i < len(descs):
            file_desc = (descs[i] or '').strip() or None
        asset = _save_or_reuse_asset(uploaded_file, file_desc, now)
        NewsAsset.objects.create(
            link_newshub_coll_news_entry_id=newshub_coll_news_entry_id,
            link_asset_id=asset.asset_id,
            is_featured=False,
            asset_group_code=asset_group_code,
            sort_order=i,
            created_at=now,
        )


# ---------------------------------------------------------------------------
# Shared actor save helpers — single source of truth for all forms
# ---------------------------------------------------------------------------
# These functions implement the modularised data entry protocol.
# Every form that collects Name Group + Identity Group + Party Details
# uses the SAME save operation into the SAME tables:
#   [person].[person]                                → Name + Identity
#   [investigation].[incident_involved_actor_profile] → Actor Type + Party Details
#
# JS module keys → DB columns:
#   Name Group:     firstNameEn → first_name_en, lastNameEn → last_name_en,
#                   firstNameBn → first_name_bn, lastNameBn → last_name_bn,
#                   fatherFirstName → father_first_name_bn, fatherLastName → father_last_name_bn,
#                   alias → name_alias_bn
#   Identity Group: genderId → link_gender_id (ref_status), religionId → link_religion_id (ref_status),
#                   age → age, dob → date_of_birth, districtId → link_birth_district_id,
#                   contact → primary_mobile_number
#   Actor Type:     involvementTypeId → link_ref_status_incident_involved_actor_role_id,
#                   actorTypeId → link_ref_status_incident_involved_actor_type_id,
#                   actorTypeDetail → incident_involved_actor_type_details
#   Party Details:  organization → actor_organization_name, designation → actor_designation,
#                   patron → actor_patron_name, statement → actor_statement
#   Crime-specific: conditionId → link_ref_status_victim_medical_condition_id,
#                   medicalLocation → victim_medical_treatment_location_name
# ---------------------------------------------------------------------------


def _save_actor_person(actor_data, now):
    """Save Name Group + Identity Group → [person].[person].

    Returns the created Person object, or None if firstNameEn is empty.
    This is the SINGLE save operation for person data — used by all forms.
    """
    first_en = (actor_data.get('firstNameEn') or '').strip()
    if not first_en:
        return None

    # Parse DOB
    dob_val = None
    dob_str = (actor_data.get('dob') or '').strip()
    if dob_str:
        dob_val = _date.fromisoformat(dob_str)

    # Gender — store ref_status.status_id directly
    link_gender_id = int(actor_data.get('genderId') or 0) or None

    return Person.objects.create(
        first_name_en=first_en,
        last_name_en=(actor_data.get('lastNameEn') or '').strip(),
        first_name_bn=(actor_data.get('firstNameBn') or '').strip() or None,
        last_name_bn=(actor_data.get('lastNameBn') or '').strip() or None,
        father_first_name_bn=(actor_data.get('fatherFirstName') or '').strip() or None,
        father_last_name_bn=(actor_data.get('fatherLastName') or '').strip() or None,
        name_alias_bn=(actor_data.get('alias') or '').strip() or None,
        link_gender_id=link_gender_id,
        link_religion_id=int(actor_data.get('religionId') or 0) or None,
        age=int(actor_data.get('age') or 0) or None,
        date_of_birth=dob_val,
        link_birth_district_id=int(actor_data.get('districtId') or 0) or None,
        primary_mobile_number=(actor_data.get('contact') or '').strip() or None,
        is_active=True,
        created_at=now,
        modified_at=now,
    )


def _infer_org_type_id(name):
    """Infer organisation_type_id from institution name keywords."""
    nl = name.lower()
    if any(k in nl for k in ('school', 'স্কুল', 'college', 'কলেজ', 'university', 'বিশ্ববিদ্যালয়')):
        return 16  # PRIVATE_UNIV (closest for educational institutions)
    if any(k in nl for k in ('hospital', 'clinic', 'হাসপাতাল')):
        return 19  # PRIVATE_COMPANY (closest for healthcare)
    if any(k in nl for k in ('ngo', 'এনজিও')):
        return 13  # NGO
    if any(k in nl for k in ('govt', 'government', 'সরকারি')):
        return 4   # DEPARTMENT
    return 999     # UNKNOWN


def _save_actor_occupation(person_id, actor_data, now, occ_key='occupationId'):
    """Save occupation + institution → [person].[person_job].

    Shared helper used by all forms that collect occupation/institution.
    Does nothing if occupation is not selected (occupationId == 0).

    Args:
        person_id: The person's PK (person.person_id)
        actor_data: dict with occupationId (or key specified by occ_key) and institution
        now: datetime for timestamps
        occ_key: JSON key for occupation ref_status ID (default 'occupationId')
    """
    occ_ref_id = int(actor_data.get(occ_key) or 0)
    if not occ_ref_id:
        return

    occ_row = RefStatus.objects.filter(status_id=occ_ref_id).values(
        'status_name_bn', 'status_name_en'
    ).first()
    if not occ_row:
        return

    # get-or-create job_title in [career].[job_title]
    job_title_obj = JobTitle.objects.filter(
        job_title_name_bn=occ_row['status_name_bn']
    ).first()
    if not job_title_obj:
        job_title_obj = JobTitle.objects.create(
            job_title_name_en=occ_row['status_name_en'] or '',
            job_title_name_bn=occ_row['status_name_bn'] or '',
            is_active=True,
            created_at=now,
            modified_at=now,
        )

    # get-or-create organisation in [directory].[organisation]
    inst_name = (actor_data.get('institution') or '').strip()
    if not inst_name:
        return

    org_obj = (
        Organisation.objects.filter(organisation_name_bn=inst_name).first()
        or Organisation.objects.filter(organisation_name_en=inst_name).first()
    )
    if not org_obj:
        org_obj = Organisation.objects.create(
            organisation_name_bn=inst_name,
            organisation_name_en=inst_name,
            link_ref_organisation_type_id=_infer_org_type_id(inst_name),
            is_active=True,
            created_at=now,
        )

    PersonJob.objects.create(
        link_person_id=person_id,
        link_job_title_id=job_title_obj.job_title_id,
        link_organisation_id=org_obj.directory_organisation_id,
        start_date=now.date(),
        is_active=True,
        created_at=now,
    )


def _resolve_actor_role(role_code=None, role_id=None):
    """Resolve actor role to (status_id, status_code) tuple.

    Accepts either role_code (e.g. 'victim') or role_id (e.g. 39).
    Returns (status_id, status_code) or (None, None).
    Cached to avoid repeated DB hits. All codes lowercase.
    """
    if not hasattr(_resolve_actor_role, '_by_code'):
        _resolve_actor_role._by_code = {}
        _resolve_actor_role._by_id = {}

    if role_code:
        code_lower = role_code.lower()
        if code_lower not in _resolve_actor_role._by_code:
            row = RefStatus.objects.filter(
                group_code='incident_involved_actor_role', status_code=code_lower, is_active=True,
            ).values('status_id', 'status_code').first()
            if row:
                _resolve_actor_role._by_code[code_lower] = (row['status_id'], row['status_code'])
                _resolve_actor_role._by_id[row['status_id']] = (row['status_id'], row['status_code'])
            else:
                _resolve_actor_role._by_code[code_lower] = (None, None)
        return _resolve_actor_role._by_code[code_lower]

    if role_id:
        if role_id not in _resolve_actor_role._by_id:
            row = RefStatus.objects.filter(
                status_id=role_id, group_code='incident_involved_actor_role', is_active=True,
            ).values('status_id', 'status_code').first()
            if row:
                _resolve_actor_role._by_id[role_id] = (row['status_id'], row['status_code'])
            else:
                _resolve_actor_role._by_id[role_id] = (None, None)
        return _resolve_actor_role._by_id[role_id]

    return (None, None)


def _save_actor_profile(newshub_coll_news_entry_id, person_id, actor_data, form_type_id, group_code, now,
                        marriage_id=None, role_code=None):
    """Save Actor Type + Party Details → [investigation].[incident_involved_actor_profile].

    This is the SINGLE save operation for actor profile data — used by all forms.
    role_code: explicit role override (e.g. 'victim', 'accused'). When set, takes
               precedence over actor_data['involvementTypeId'].
    Stores BOTH the role status_id (FK) and the role status_code (denormalised) for
    query performance.
    """
    if role_code:
        resolved_id, resolved_code = _resolve_actor_role(role_code=role_code)
    else:
        js_role_id = int(actor_data.get('involvementTypeId') or 0) or None
        if js_role_id:
            resolved_id, resolved_code = _resolve_actor_role(role_id=js_role_id)
        else:
            resolved_id, resolved_code = None, None

    return IncidentInvolvedActorProfile.objects.create(
        link_newshub_coll_news_entry_id=newshub_coll_news_entry_id,
        link_person_id=person_id,
        link_person_marriage_id=marriage_id,
        link_ref_status_incident_involved_actor_role_id=resolved_id,
        incident_involved_actor_role_group_code=resolved_code or group_code,
        link_ref_status_incident_involved_actor_type_id=int(actor_data.get('actorTypeId') or 0) or None,
        incident_involved_actor_type_details=(actor_data.get('actorTypeDetail') or '').strip() or None,
        link_form_type_id=form_type_id,
        # Party Details
        actor_organization_name=(actor_data.get('organization') or '').strip() or None,
        actor_designation=(actor_data.get('designation') or '').strip() or None,
        actor_patron_name=(actor_data.get('patron') or '').strip() or None,
        actor_statement=(actor_data.get('statement') or '').strip() or None,
        # Crime-specific (NULL for non-crime forms)
        link_ref_status_victim_medical_condition_id=int(actor_data.get('conditionId') or 0) or None,
        victim_medical_treatment_location_name=(actor_data.get('medicalLocation') or '').strip() or None,
        created_at=now,
    )


# Map JSON field names → server-side role codes (safety net if JS doesn't send involvementTypeId)
_FIELD_TO_ROLE = {
    'accused_json': 'accused',
    'victim_json': 'victim',
    'witness_json': 'witness',
}


def _save_actors_from_json(request, newshub_coll_news_entry_id, form_type_id, group_code, now,
                           json_fields=('accused_json', 'victim_json', 'witness_json')):
    """Parse actor JSON from POST and save each actor using the shared helpers.

    This is the top-level function called by all form handlers.
    It iterates over the specified POST fields, parses JSON arrays,
    and calls _save_actor_person + _save_actor_profile for each actor.
    role_code is determined by the field name (accused_json→ACCUSED, etc.)
    and always set server-side — JS involvementTypeId is ignored.
    """
    for field_name in json_fields:
        raw = request.POST.get(field_name, '')
        if not raw:
            continue
        role_code = _FIELD_TO_ROLE.get(field_name)
        try:
            actors_list = json.loads(raw)
            for actor_data in actors_list:
                person = _save_actor_person(actor_data, now)
                if not person:
                    continue  # skip actors with no name
                _save_actor_profile(
                    newshub_coll_news_entry_id, person.person_id, actor_data,
                    form_type_id, group_code, now,
                    role_code=role_code,
                )
        except (json.JSONDecodeError, ValueError, TypeError):
            raise  # propagate to outer atomic block for full rollback


def _handle_news_submission(request, template_name='newshub/pages/news-collection.html', form_type_group_code=None):
    """Validate all sub-forms and save to DB."""
    form_type_id = (
        RefNewsFormType.objects
        .filter(group_code=form_type_group_code)
        .values_list('newshub_ref_news_form_type_id', flat=True)
        .first()
    ) if form_type_group_code else None

    contributor_form = ContributorInfoForm(request.POST)
    news_entry_form = NewsEntryForm(request.POST)
    attachment_form = NewsAttachmentForm(request.POST, request.FILES)
    social_source_form = NewsSocialSourceForm(request.POST)  # kept for _build_form_context

    # Sidebar fields (not in Django forms — rendered manually in widgets)
    category_id = request.POST.get('news_category_id', '')
    district_id = request.POST.get('district_id', '')
    constituency_id = request.POST.get('constituency_id', '') or None
    upazila_id = request.POST.get('upazila_id', '') or None
    upazila_city_corporation_name = request.POST.get('upazila_city_corporation_name', '').strip() or None
    union_parishad_id = request.POST.get('union_parishad_id', '') or None
    ward_name = request.POST.get('ward_name', '').strip() or None
    village_moholla_name = request.POST.get('village_moholla_name', '').strip() or None
    latitude = request.POST.get('latitude', '') or None
    longitude = request.POST.get('longitude', '') or None
    formatted_address_bn = request.POST.get('formatted_address_bn', '') or None
    full_address_bn = request.POST.get('full_address_bn', '') or None
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
        and not sidebar_errors
    )

    if not all_valid:
        error_msg = ' | '.join(sidebar_errors) if sidebar_errors else 'ফর্মে ত্রুটি আছে, অনুগ্রহ করে পরীক্ষা করুন।'
        form_context = _build_form_context(
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
        return render(request, template_name, form_context)

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
    # Add as field-level errors so they render inside the step panel for stepper detection.
    has_length_errors = False
    if len(headline_normalized) > 100:
        news_entry_form.add_error(
            'headline_bn',
            'শিরোনাম সর্বোচ্চ ১০০ অক্ষর হতে পারে, বর্তমানে %d অক্ষর। (Headline max 100 chars, currently %d)' % (len(headline_normalized), len(headline_normalized)),
        )
        has_length_errors = True
    if summary_normalized and len(summary_normalized) > 400:
        news_entry_form.add_error(
            'summary_bn',
            'সংক্ষেপ সর্বোচ্চ ৪০০ অক্ষর হতে পারে, বর্তমানে %d অক্ষর। (Summary max 400 chars, currently %d)' % (len(summary_normalized), len(summary_normalized)),
        )
        has_length_errors = True

    # Duplicate check: same headline (case-insensitive, trimmed) already exists
    # In edit mode, exclude the entry being edited from the duplicate check
    edit_entry_id = request.POST.get('edit_entry_id')
    duplicate_qs = CollNewsEntry.objects.filter(
        news_headline_bn__iexact=headline_normalized,
    )
    if edit_entry_id:
        duplicate_qs = duplicate_qs.exclude(newshub_coll_news_entry_id=int(edit_entry_id))
    duplicate_exists = duplicate_qs.exists()
    if duplicate_exists:
        news_entry_form.add_error(
            'headline_bn',
            'এই শিরোনামে একটি সংবাদ ইতিমধ্যে জমা হয়েছে। অনুগ্রহ করে ভিন্ন শিরোনাম ব্যবহার করুন। (A news entry with this headline already exists.)',
        )
        has_length_errors = True

    if has_length_errors:
        form_context = _build_form_context(
            contributor_form, news_entry_form, attachment_form, social_source_form,
            extra={
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
        return render(request, template_name, form_context)

    # ---- Save all records atomically ----

    # Resolve organisation name: dropdown ID takes priority, fallback to custom text
    from django.db.models import Q

    org_id = request.POST.get('contributor_organization_id', '') or None
    org_custom = request.POST.get('contributor_organization_custom', '').strip() or None
    org_name_bn = None
    if org_id:
        org = Organisation.objects.filter(directory_organisation_id=int(org_id)).first()
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

    # ---- Detect edit mode ----
    is_edit_mode = bool(edit_entry_id)
    existing_entry = None
    if is_edit_mode:
        try:
            existing_entry = CollNewsEntry.objects.get(newshub_coll_news_entry_id=int(edit_entry_id))
        except CollNewsEntry.DoesNotExist:
            is_edit_mode = False

    try:
        with transaction.atomic():
            # Resolve user profile ID for logged-in users
            contributor_user_profile_id = None
            if request.user.is_authenticated:
                try:
                    user_profile = UserProfile.objects.get(link_user_account_user_id=request.user.pk)
                    contributor_user_profile_id = user_profile.user_profile_id
                except UserProfile.DoesNotExist:
                    pass

            if is_edit_mode:
                # UPDATE existing contributor
                contributor = Contributor.objects.get(
                    newshub_contributor_id=existing_entry.link_contributor_id
                )
                contributor.contributor_full_name_bn = cd['contributor_full_name_bn']
                contributor.contributor_organization_bn = org_name_bn
                contributor.contributor_contact_email = cd['contributor_contact_email'] or None
                contributor.contributor_contact_phone = cd['contributor_contact_phone'] or None
                contributor.link_contributor_type_id = cd['contributor_type_id']
                contributor.save()
            else:
                contributor = Contributor.objects.create(
                    contributor_full_name_bn=cd['contributor_full_name_bn'],
                    contributor_organization_bn=org_name_bn,
                    contributor_contact_email=cd['contributor_contact_email'] or None,
                    contributor_contact_phone=cd['contributor_contact_phone'] or None,
                    link_contributor_type_id=cd['contributor_type_id'],
                    link_user_profile_id=contributor_user_profile_id,
                    is_verified=False,
                    created_at=now,
                )

            # ---- Save news entry (using NFKC-normalized headline/summary) ----
            content_body = _sanitize_rich_html(unicodedata.normalize('NFKC', nd['content_body_bn']))
            if summary_normalized:
                summary_normalized = _sanitize_rich_html(summary_normalized)

            if is_edit_mode:
                # UPDATE existing entry
                entry = existing_entry
                entry.news_headline_bn = headline_normalized
                entry.news_summary_bn = summary_normalized or None
                entry.news_content_body_bn = content_body
                entry.link_news_category_id = int(category_id) if category_id else 12
                entry.link_constituency_id = int(constituency_id) if constituency_id else None
                entry.link_district_id = int(district_id) if district_id else None
                entry.upazila_city_corporation_name = upazila_city_corporation_name
                entry.link_union_parishad_id = int(union_parishad_id) if union_parishad_id else None
                entry.link_ward_name = ward_name
                entry.link_village_moholla_name = village_moholla_name
                entry.coll_news_entry_latitude = latitude
                entry.coll_news_entry_longitude = longitude
                entry.map_formatted_address_bn = formatted_address_bn
                entry.full_address_bn = full_address_bn
                entry.is_breaking = is_breaking
                entry.occurrence_at = nd['occurrence_at']
                entry.save()

                # Delete old junction records for re-insertion
                NewsEntryTag.objects.filter(link_newshub_coll_news_entry_id=entry.newshub_coll_news_entry_id).delete()
                NewsSocialMediaSource.objects.filter(link_newshub_coll_news_entry_id=entry.newshub_coll_news_entry_id).delete()

                # Delete old actors (person records are NOT deleted — they may be shared)
                IncidentInvolvedActorProfile.objects.filter(link_newshub_coll_news_entry_id=entry.newshub_coll_news_entry_id).delete()

                # Delete old form-specific records for re-insertion
                from amolnama_news.site_apps.investigation.models import (
                    ExtortionFormImpact as _ExtImpact,
                    ExtortionFormVictimLegalAction as _ExtLegal,
                    CrimeFormImpactCasualty as _CrimeCas,
                    CrimeFormWeapon as _CrimeWpn,
                    CrimeFormVictimLegalAction as _CrimeLegal,
                    LandGrabbingFormFact as _LandFact,
                    LandGrabbingFormVictimLegalAction as _LandLegal,
                    PriceHikingFormCommodityPrice as _PricePrice,
                    PriceHikingFormCommodityStockSupplyChain as _PriceStock,
                    CivicFormImpact as _CivicImpact,
                    GlobalNewsFormFact as _GlobalFact,
                    ConflictFormImpact as _ConflictImpact,
                    ConflictFormActorCountry as _ConflictCountry,
                    July2024FactProtest as _JulyFact,
                    WomenFormVictimProfileFact as _WcvVictim,
                    WomenFormPerpetrator as _WcvPerp,
                    WomenFormVictimLegalAction as _WcvLegal,
                )
                _eid = entry.newshub_coll_news_entry_id
                _ExtImpact.objects.filter(link_newshub_coll_news_entry_id=_eid).delete()
                _ExtLegal.objects.filter(link_newshub_coll_news_entry_id=_eid).delete()
                _CrimeCas.objects.filter(link_newshub_coll_news_entry_id=_eid).delete()
                _CrimeWpn.objects.filter(link_newshub_coll_news_entry_id=_eid).delete()
                _CrimeLegal.objects.filter(link_newshub_coll_news_entry_id=_eid).delete()
                _LandFact.objects.filter(link_newshub_coll_news_entry_id=_eid).delete()
                _LandLegal.objects.filter(link_newshub_coll_news_entry_id=_eid).delete()
                _PricePrice.objects.filter(link_newshub_coll_news_entry_id=_eid).delete()
                _PriceStock.objects.filter(link_newshub_coll_news_entry_id=_eid).delete()
                _CivicImpact.objects.filter(link_newshub_coll_news_entry_id=_eid).delete()
                _GlobalFact.objects.filter(link_newshub_coll_news_entry_id=_eid).delete()
                _ConflictImpact.objects.filter(link_newshub_coll_news_entry_id=_eid).delete()
                _ConflictCountry.objects.filter(link_newshub_coll_news_entry_id=_eid).delete()
                _JulyFact.objects.filter(link_newshub_coll_news_entry_id=_eid).delete()
                _WcvVictim.objects.filter(link_newshub_coll_news_entry_id=_eid).delete()
                _WcvPerp.objects.filter(link_newshub_coll_news_entry_id=_eid).delete()
                _WcvLegal.objects.filter(link_newshub_coll_news_entry_id=_eid).delete()
                # NOTE: Attachments (NewsAsset) are NOT deleted — existing files kept
            else:
                entry = CollNewsEntry.objects.create(
                    link_form_type_id=form_type_id,
                    news_headline_bn=headline_normalized,
                    news_summary_bn=summary_normalized or None,
                    news_content_body_bn=content_body,
                    link_news_category_id=int(category_id) if category_id else 12,
                    link_contributor_id=contributor.newshub_contributor_id,
                    link_constituency_id=int(constituency_id) if constituency_id else None,
                    link_district_id=int(district_id) if district_id else None,
                    upazila_city_corporation_name=upazila_city_corporation_name,
                    link_union_parishad_id=int(union_parishad_id) if union_parishad_id else None,
                    link_ward_name=ward_name,
                    link_village_moholla_name=village_moholla_name,
                    coll_news_entry_latitude=latitude,
                    coll_news_entry_longitude=longitude,
                    map_formatted_address_bn=formatted_address_bn,
                    full_address_bn=full_address_bn,
                    is_breaking=is_breaking,
                    occurrence_at=nd['occurrence_at'],
                    created_at=now,
                )

            # ---- Save attachments (multiple files supported, max 4) ----
            ad = attachment_form.cleaned_data
            uploaded_files = request.FILES.getlist('attachment_file')
            caption = ad.get('attachment_caption_bn') or None
            featured_idx_raw = request.POST.get('featured_file_index', '')
            featured_idx = int(featured_idx_raw) if featured_idx_raw.isdigit() else -1

            file_descriptions = []
            desc_json_raw = request.POST.get('attachment_descriptions_json', '')
            if desc_json_raw:
                try:
                    file_descriptions = json.loads(desc_json_raw)
                except (json.JSONDecodeError, ValueError):
                    raise

            for i, uploaded_file in enumerate(uploaded_files[:4]):
                file_desc = None
                if i < len(file_descriptions):
                    file_desc = (file_descriptions[i] or '').strip() or None

                asset = _save_or_reuse_asset(uploaded_file, file_desc, now)

                NewsAsset.objects.create(
                    link_newshub_coll_news_entry_id=entry.newshub_coll_news_entry_id,
                    link_asset_id=asset.asset_id,
                    news_asset_caption_bn=caption if i == 0 else None,
                    is_featured=(i == featured_idx),
                    asset_group_code='general',
                    sort_order=i,
                    created_at=now,
                )

            # ---- Save social sources (repeater JSON) ----
            # → media.social_url_library (URL record)
            # → newshub.news_social_media_source (junction to news entry)
            social_json_raw = request.POST.get('social_source_json', '')
            if social_json_raw:
                try:
                    social_data = json.loads(social_json_raw)
                    for social_source in social_data.get('sources', []):
                        social_source_url = (social_source.get('url') or '').strip()
                        if not social_source_url:
                            continue
                        url_record = SocialUrlLibrary.objects.filter(social_url=social_source_url).first()
                        if not url_record:
                            url_record = SocialUrlLibrary.objects.create(
                                link_social_media_platform_type_id=int(social_source.get('platformId') or 0),
                                social_url=social_source_url,
                                social_embed_code=social_source.get('embedCode') or None,
                                created_at=now,
                            )
                        NewsSocialMediaSource.objects.create(
                            link_newshub_coll_news_entry_id=entry.newshub_coll_news_entry_id,
                            link_social_media_url_library_id=url_record.social_media_url_library_id,
                            created_at=now,
                        )
                except (json.JSONDecodeError, TypeError, ValueError):
                    raise

            # ---- Save tags ----
            for tid in tag_ids:
                if tid.isdigit():
                    NewsEntryTag.objects.create(
                        link_newshub_coll_news_entry_id=entry.newshub_coll_news_entry_id,
                        link_news_category_tag_id=int(tid),
                        created_at=now,
                    )

            # ---- Save involved actors (accused / victim / witness — split repeaters) ----
            # → [person].[person] + [investigation].[incident_involved_actor_profile]
            # Uses shared helpers: _save_actor_person + _save_actor_profile
            _save_actors_from_json(
                request, entry.newshub_coll_news_entry_id, form_type_id,
                form_type_group_code or 'general_news', now,
            )

            # ---- Save actor-group photos (accused / victim / witness) ----
            # → media.asset + newshub.news_asset
            # Caption: user-provided per-file description (from *_photos_descriptions_json),
            # falling back to the role status_code ('accused'/'victim'/'witness').
            # sort_order ranges: accused=100-102, victim=200-202, witness=300-302
            # (used by editorial to identify role without relying on caption alone).
            _actor_photo_groups = (
                ('accused_photos', 'accused', 100),
                ('victim_photos',  'victim',  200),
                ('witness_photos', 'witness', 300),
            )
            for _field, _code, _sort_base in _actor_photo_groups:
                _group_files = request.FILES.getlist(_field)
                if not _group_files:
                    continue
                try:
                    _descs = json.loads(
                        request.POST.get(_field + '_descriptions_json', '[]') or '[]'
                    )
                except (json.JSONDecodeError, ValueError):
                    raise
                for _j, _uploaded_file in enumerate(_group_files[:3]):
                    _asset = _save_or_reuse_asset(_uploaded_file, None, now)
                    _user_desc = (_descs[_j].strip() if _j < len(_descs) else '') or ''
                    NewsAsset.objects.create(
                        link_newshub_coll_news_entry_id=entry.newshub_coll_news_entry_id,
                        link_asset_id=_asset.asset_id,
                        news_asset_caption_bn=_user_desc or _code,
                        is_featured=False,
                        asset_group_code=_code,
                        sort_order=_sort_base + _j,
                        created_at=now,
                    )

            # ---- Save casualties & impact (crime/violence form) ----
            # → investigation.crime_form_impact_casualty (single row)
            casualties_json_raw = request.POST.get('casualties_impact_json', '')
            if casualties_json_raw:
                try:
                    casualties = json.loads(casualties_json_raw)
                    death_count = int(casualties.get('deathCount') or 0)
                    injury_count = int(casualties.get('injuryCount') or 0)
                    prop_desc = (casualties.get('propertyDestruction') or '').strip() or None
                    damage_amt = None
                    try:
                        damage_amt = float(casualties.get('damageAmount') or 0)
                        if damage_amt <= 0:
                            damage_amt = None
                    except (ValueError, TypeError):
                        raise
                    is_ongoing = bool(casualties.get('isOngoing', False))
                    CrimeFormImpactCasualty.objects.create(
                        link_newshub_coll_news_entry_id=entry.newshub_coll_news_entry_id,
                        casualty_death_count=death_count,
                        casualty_injury_count=injury_count,
                        casualty_missing_count=0,
                        casualty_arrested_count=0,
                        property_has_property_destruction=bool(prop_desc),
                        property_destruction_description=prop_desc,
                        property_estimated_damage_amount_bdt=damage_amt,
                        state_is_incident_ongoing=is_ongoing,
                        created_at=now,
                    )
                except (json.JSONDecodeError, ValueError, TypeError):
                    raise

            # ---- Save weapons & evidence (crime/violence form Step 8) ----
            # → investigation.crime_form_weapon (single row)
            weapons_json_raw = request.POST.get('weapons_evidence_json', '')
            if weapons_json_raw:
                try:
                    wpn = json.loads(weapons_json_raw)
                    wpn_ids = set(int(x) for x in (wpn.get('weaponTypeIds') or []) if x)

                    # Resolve status_codes from IDs for code-based BIT column mapping
                    wpn_code_map = {}
                    if wpn_ids:
                        for row in RefStatus.objects.filter(status_id__in=wpn_ids).values('status_id', 'status_code'):
                            wpn_code_map[row['status_id']] = row['status_code'] or ''
                    wpn_codes = {wpn_code_map[i] for i in wpn_ids if i in wpn_code_map}

                    CrimeFormWeapon.objects.create(
                        link_newshub_coll_news_entry_id=entry.newshub_coll_news_entry_id,
                        weapon_is_firearms_used='firearms' in wpn_codes,
                        weapon_is_explosives_used='explosives' in wpn_codes,
                        weapon_is_sharp_weapon_used='sharp_weapon' in wpn_codes,
                        weapon_is_sticks_rods_used='sticks_rods' in wpn_codes,
                        weapon_is_poison_chemical_used='poison_chemical' in wpn_codes,
                        weapon_other_description=(wpn.get('otherWeaponDetail') or '').strip() or None,
                        evidence_recovered_description=(wpn.get('recoveredEvidence') or '').strip() or None,
                        created_at=now,
                    )
                except (json.JSONDecodeError, ValueError, TypeError):
                    raise

            # ---- Save crime legal action (crime form Step 9) ----
            # → investigation.crime_form_victim_legal_action (single row)
            crime_legal_raw = request.POST.get('crime_legal', '')
            if crime_legal_raw:
                try:
                    cl = json.loads(crime_legal_raw)
                    law_ids         = set(int(x) for x in (cl.get('applicableLawIds') or []) if x)
                    support_ids     = set(int(x) for x in (cl.get('supportServiceIds') or []) if x)
                    retaliation_ids = set(int(x) for x in (cl.get('retaliationIds') or []) if x)
                    fir_status_id   = int(cl.get('firStatusId') or 0)
                    case_status_id  = int(cl.get('caseStatusId') or 0) or None

                    # Only save legal action if FIR status was selected (NOT NULL column)
                    if fir_status_id:
                        all_ids = (law_ids | support_ids | retaliation_ids) - {0}
                        code_map = {}
                        if all_ids:
                            for row in RefStatus.objects.filter(status_id__in=all_ids).values('status_id', 'status_code'):
                                code_map[row['status_id']] = row['status_code'] or ''
                        law_codes = {code_map[i] for i in law_ids if i in code_map}
                        support_codes = {code_map[i] for i in support_ids if i in code_map}
                        retaliation_codes = {code_map[i] for i in retaliation_ids if i in code_map}

                        CrimeFormVictimLegalAction.objects.create(
                            link_newshub_coll_news_entry_id=entry.newshub_coll_news_entry_id,
                            link_ref_status_law_gd_fir_status_id=fir_status_id,
                            case_gd_number=(cl.get('caseNumber') or '').strip() or None,
                            reason_not_filing_and_plans=(cl.get('noFirReason') or '').strip() or None,
                            police_refusal_statement=(cl.get('policeRefusalStatement') or '').strip() or None,
                            location_display_title_en=(cl.get('policeStation') or '').strip() or None,
                            is_law_penal_302_murder='penal_302_murder' in law_codes,
                            is_law_penal_307_attempt_murder='penal_307_attempt_murder' in law_codes,
                            is_law_penal_323_325_hurt='penal_323_325_hurt' in law_codes,
                            is_law_penal_392_394_robbery='penal_392_394_robbery' in law_codes,
                            is_law_arms_act='arms_act' in law_codes,
                            is_law_anti_terrorism_act='anti_terrorism_act' in law_codes,
                            is_law_narcotics_control_act='narcotics_control_act' in law_codes,
                            is_law_special_powers_act='special_powers_act' in law_codes,
                            link_ref_status_law_case_status_id=case_status_id,
                            is_victim_support_govt_legal_aid='govt_legal_aid' in support_codes,
                            is_victim_support_victim_support_center='victim_support_center' in support_codes,
                            is_victim_support_ngo_support='ngo_support' in support_codes,
                            is_victim_support_family_community_support='family_community_support' in support_codes,
                            is_risk_threat_family_pressure='family_pressure' in retaliation_codes,
                            is_risk_threat_settlement_pressure='settlement_pressure' in retaliation_codes,
                            is_risk_threat_case_withdrawal_pressure='case_withdrawal_pressure' in retaliation_codes,
                            is_risk_threat_business_loss_threat='business_loss_threat' in retaliation_codes,
                            is_risk_threat_witness_victim_threat='witness_victim_threat' in retaliation_codes,
                            is_risk_threat_eviction_threat='eviction_threat' in retaliation_codes,
                            is_risk_threat_retaliation_threat='retaliation_threat' in retaliation_codes,
                            is_risk_threat_death_or_physical_harm_threat='death_or_physical_harm_threat' in retaliation_codes,
                            legal_action_additional_remarks=(cl.get('remarks') or '').strip() or None,
                            created_at=now,
                        )
                except (json.JSONDecodeError, ValueError, TypeError):
                    raise

            # ---- Save extortion incident data (extortion form) ----
            # → investigation.extortion_form_impact (single row)
            extortion_json_raw = request.POST.get('extortion_incident_json', '')
            if extortion_json_raw:
                try:
                    ext = json.loads(extortion_json_raw)
                    sector_id   = int(ext.get('sectorId') or 0)
                    aff_ids     = set(int(x) for x in (ext.get('affiliationIds') or []))
                    threat_ids  = set(int(x) for x in (ext.get('threatMethodIds') or []))
                    cons_ids    = set(int(x) for x in (ext.get('consequenceIds') or []))
                    ctx_ids     = set(int(x) for x in (ext.get('bangladeshContextIds') or []))
                    freq_id     = int(ext.get('frequencyId') or 0) or None
                    _demanded   = float(ext.get('amountDemanded') or 0)
                    _collected  = float(ext.get('amountTaken') or 0)
                    amt_demanded  = _demanded  if _demanded  > 0 else None
                    amt_collected = _collected if _collected > 0 else None
                    sector_other  = (ext.get('sectorOther') or '').strip() or None
                    remarks       = (ext.get('remarks') or '').strip() or None

                    ExtortionFormImpact.objects.create(
                        link_newshub_coll_news_entry_id=entry.newshub_coll_news_entry_id,
                        link_ref_status_extortion_form_extortion_demand_frequency_id=freq_id,
                        # Sector (single radio → BIT flags, status_ids 427-436)
                        sector_is_shop_market=(sector_id == 427),
                        sector_is_transport_vehicle=(sector_id == 428),
                        sector_is_construction_site=(sector_id == 429),
                        sector_is_contract_tender=(sector_id == 430),
                        sector_is_garment_factory=(sector_id == 431),
                        sector_is_crops_produce=(sector_id == 432),
                        sector_is_school_college=(sector_id == 433),
                        sector_is_healthcare_clinic=(sector_id == 434),
                        sector_is_phone_digital=(sector_id == 435),
                        sector_is_other=(sector_id == 436),
                        sector_transport_location_code=(ext.get('transportLocation') or '').strip() or None,
                        sector_other_description=sector_other,
                        sector_garment_extortion_type_code=(ext.get('garmentType') or '').strip() or None,
                        # Financial
                        demand_amount_demanded_bdt=amt_demanded,
                        demand_amount_collected_bdt=amt_collected,
                        # Perpetrator affiliation (status_ids 444-451)
                        accused_is_political_student_wing=(444 in aff_ids),
                        accused_is_transport_association=(445 in aff_ids),
                        accused_is_business_trade_association=(446 in aff_ids),
                        accused_is_professional_gang=(447 in aff_ids),
                        accused_is_law_enforcement=(448 in aff_ids),
                        accused_is_teen_gang=(449 in aff_ids),
                        accused_is_disguised_association_fee=(450 in aff_ids),
                        accused_is_unknown=(451 in aff_ids),
                        accused_political_party_org_name=(ext.get('partyName') or '').strip() or None,
                        # Threat methods (status_ids 452-460)
                        threat_is_in_person=(452 in threat_ids),
                        threat_is_phone_sms=(453 in threat_ids),
                        threat_is_online_social_media=(454 in threat_ids),
                        threat_is_written_letter=(455 in threat_ids),
                        threat_is_blocking_supply=(456 in threat_ids),
                        threat_is_physical_assault=(457 in threat_ids),
                        threat_is_vandalism_arson=(458 in threat_ids),
                        threat_is_abduction_hostage=(459 in threat_ids),
                        threat_is_false_case_threat=(460 in threat_ids),
                        # Consequences (status_ids 461-470)
                        consequence_is_paid_full=(461 in cons_ids),
                        consequence_is_paid_partial=(462 in cons_ids),
                        consequence_is_business_disrupted=(463 in cons_ids),
                        consequence_is_physically_injured=(464 in cons_ids),
                        consequence_is_abducted_hostage=(465 in cons_ids),
                        consequence_is_shot_critically_injured=(466 in cons_ids),
                        consequence_is_killed=(467 in cons_ids),
                        consequence_is_false_case_filed=(468 in cons_ids),
                        consequence_is_property_vandalized=(469 in cons_ids),
                        consequence_is_none_yet=(470 in cons_ids),
                        consequence_property_damage_description=(ext.get('damageDesc') or '').strip() or None,
                        # Bangladesh context (status_ids 472-473)
                        context_is_law_enforcement_direct_participation=(472 in ctx_ids),
                        context_is_systematic_extortion_pattern=(473 in ctx_ids),
                        additional_remarks=remarks,
                        created_at=now,
                    )
                except (json.JSONDecodeError, ValueError, TypeError):
                    raise

            # ---- Save extortion legal action (extortion form Step 8) ----
            # → investigation.extortion_form_victim_legal_action (single row)
            ext_legal_raw = request.POST.get('ext_legal', '')
            if ext_legal_raw:
                try:
                    el = json.loads(ext_legal_raw)
                    law_ids         = set(int(x) for x in (el.get('applicableLawIds') or []) if x)
                    support_ids     = set(int(x) for x in (el.get('supportServiceIds') or []) if x)
                    retaliation_ids = set(int(x) for x in (el.get('retaliationIds') or []) if x)
                    fir_status_id   = int(el.get('firStatusId') or 0)
                    case_status_id  = int(el.get('caseStatusId') or 0) or None

                    # Only save legal action if FIR status was selected (NOT NULL column)
                    if fir_status_id:
                        # Resolve status_codes from IDs for code-based BIT column mapping
                        all_ids = (law_ids | support_ids | retaliation_ids) - {0}
                        code_map = {}
                        if all_ids:
                            for row in RefStatus.objects.filter(status_id__in=all_ids).values('status_id', 'status_code'):
                                code_map[row['status_id']] = row['status_code'] or ''
                        law_codes = {code_map[i] for i in law_ids if i in code_map}
                        support_codes = {code_map[i] for i in support_ids if i in code_map}
                        retaliation_codes = {code_map[i] for i in retaliation_ids if i in code_map}

                        ExtortionFormVictimLegalAction.objects.create(
                            link_newshub_coll_news_entry_id=entry.newshub_coll_news_entry_id,
                            link_ref_status_law_gd_fir_status_id=fir_status_id,
                            gd_fir_case_gd_number=(el.get('caseNumber') or '').strip() or None,
                            gd_fir_reason_not_filing_and_plans=(el.get('noFirReason') or '').strip() or None,
                            gd_fir_police_refusal_statement=(el.get('policeRefusalStatement') or '').strip() or None,
                            gd_fir_location_display_title_en=(el.get('policeStation') or '').strip() or None,
                            link_ref_status_law_case_status_id=case_status_id,
                            is_law_penal_code_383_389='penal_code_383_389' in law_codes,
                            is_law_anti_terrorism_act='anti_terrorism_act' in law_codes,
                            is_law_prevention_of_corruption_act='prevention_of_corruption_act' in law_codes,
                            is_law_money_laundering_prevention_act='money_laundering_prevention_act' in law_codes,
                            is_support_gov_legal_aid='gov_legal_aid' in support_codes,
                            is_support_acc_complaint='acc_complaint' in support_codes,
                            is_support_business_association='business_association' in support_codes,
                            is_support_ngo_aid='ngo_aid' in support_codes,
                            is_risk_threat_family_pressure='family_pressure' in retaliation_codes,
                            is_risk_threat_settlement_pressure='settlement_pressure' in retaliation_codes,
                            is_risk_threat_case_withdrawal_pressure='case_withdrawal_pressure' in retaliation_codes,
                            is_risk_threat_business_loss_threat='business_loss_threat' in retaliation_codes,
                            is_risk_threat_witness_victim_threat='witness_victim_threat' in retaliation_codes,
                            is_risk_threat_eviction_threat='eviction_threat' in retaliation_codes,
                            is_risk_threat_retaliation_threat='retaliation_threat' in retaliation_codes,
                            is_risk_threat_death_or_physical_harm_threat='death_or_physical_harm_threat' in retaliation_codes,
                            legal_action_additional_remarks=(el.get('remarks') or '').strip() or None,
                            created_at=now,
                        )
                except (json.JSONDecodeError, ValueError, TypeError):
                    raise

            # ---- Save evidence files (extortion & land-grab forms) ----
            # Uses shared helper: _save_evidence_files()
            _save_evidence_files(
                request, entry.newshub_coll_news_entry_id,
                'evidence_file', 'evidence_descriptions_json', 4, now,
                asset_group_code='evidence',
            )

            # ---- Save land grabbing incident data (land grabbing form Step 7) ----
            # → investigation.land_grabbing_form_fact (single row)
            land_grab_incident_json_raw = request.POST.get('land_grab_incident_json', '')
            if land_grab_incident_json_raw:
                try:
                    lg = json.loads(land_grab_incident_json_raw)
                    doc_ids    = set(int(x) for x in (lg.get('documentIds') or []))
                    method_ids = set(int(x) for x in (lg.get('methodIds') or []))
                    prop_type_id     = int(lg.get('propertyTypeId') or 0) or None
                    area_unit_id     = int(lg.get('areaUnitId') or 0) or None
                    current_stat_id  = int(lg.get('currentStatusId') or 0) or None
                    families         = int(lg.get('familiesEvicted') or 0) or None
                    area_amount      = None
                    try:
                        _a = float(lg.get('areaAmount') or 0)
                        if _a > 0:
                            area_amount = _a
                    except (ValueError, TypeError):
                        raise
                    LandGrabbingFormFact.objects.create(
                        link_newshub_coll_news_entry_id=entry.newshub_coll_news_entry_id,
                        link_ref_status_land_grabbing_form_land_type_id=prop_type_id,
                        land_details_other_property_type_description=(lg.get('propertyTypeOther') or '').strip() or None,
                        record_details_mouza_name=(lg.get('mouza') or '').strip() or None,
                        record_details_daag_plot_number=(lg.get('daag') or '').strip() or None,
                        record_details_khatian_number=(lg.get('khatian') or '').strip() or None,
                        record_details_area_amount=area_amount,
                        link_ref_status_land_grabbing_form_area_unit_id=area_unit_id,
                        # Document title status (status_ids 517-521)
                        ownership_status_has_khatian_porcha=(517 in doc_ids),
                        ownership_status_has_registered_deed=(518 in doc_ids),
                        ownership_status_is_inherited=(519 in doc_ids),
                        ownership_status_has_court_order=(520 in doc_ids),
                        ownership_status_no_documents=(521 in doc_ids),
                        # Grabbing methods (status_ids 522-529)
                        grabbing_method_is_forceful_armed=(522 in method_ids),
                        grabbing_method_is_forged_documents=(523 in method_ids),
                        grabbing_method_is_false_lawsuit=(524 in method_ids),
                        grabbing_method_is_political_influence=(525 in method_ids),
                        grabbing_method_is_govt_official_nexus=(526 in method_ids),
                        grabbing_method_is_gradual_encroachment=(527 in method_ids),
                        grabbing_method_is_forced_eviction=(528 in method_ids),
                        grabbing_method_is_other=(529 in method_ids),
                        grabbing_method_other_details=(lg.get('methodOther') or '').strip() or None,
                        link_ref_status_land_grabbing_form_current_status_id=current_stat_id,
                        human_impact_families_evicted_count=families,
                        human_impact_has_violence_occurred=bool(lg.get('violenceOccurred', False)),
                        human_impact_violence_description=(lg.get('violenceDesc') or '').strip() or None,
                        created_at=now,
                    )
                except (json.JSONDecodeError, ValueError, TypeError):
                    raise

            # ---- Save land grabbing legal action (land grabbing form Step 8) ----
            # → investigation.land_grabbing_form_victim_legal_action (single row)
            land_legal_json_raw = request.POST.get('land_legal', '')
            if land_legal_json_raw:
                try:
                    ll = json.loads(land_legal_json_raw)
                    law_ids         = set(int(x) for x in (ll.get('applicableLawIds') or []) if x)
                    support_ids     = set(int(x) for x in (ll.get('supportServiceIds') or []) if x)
                    retaliation_ids = set(int(x) for x in (ll.get('retaliationIds') or []) if x)
                    fir_status_id   = int(ll.get('firStatusId') or 0)
                    case_status_id  = int(ll.get('caseStatusId') or 0) or None

                    # Only save legal action if FIR status was selected (NOT NULL column)
                    if fir_status_id:
                        all_ids = (law_ids | support_ids | retaliation_ids) - {0}
                        code_map = {}
                        if all_ids:
                            for row in RefStatus.objects.filter(status_id__in=all_ids).values('status_id', 'status_code'):
                                code_map[row['status_id']] = row['status_code'] or ''
                        law_codes = {code_map[i] for i in law_ids if i in code_map}
                        support_codes = {code_map[i] for i in support_ids if i in code_map}
                        retaliation_codes = {code_map[i] for i in retaliation_ids if i in code_map}

                        LandGrabbingFormVictimLegalAction.objects.create(
                            link_newshub_coll_news_entry_id=entry.newshub_coll_news_entry_id,
                            link_ref_status_law_gd_fir_status_id=fir_status_id,
                            legal_action_case_gd_number=(ll.get('caseNumber') or '').strip() or None,
                            legal_action_reason_not_filing_desc=(ll.get('noFirReason') or '').strip() or None,
                            legal_action_police_refusal_statement=(ll.get('policeRefusalStatement') or '').strip() or None,
                            legal_action_thana_name_en=(ll.get('policeStation') or '').strip() or None,
                            is_law_crpc_145='crpc_145' in law_codes,
                            is_law_civil_suit='civil_suit' in law_codes,
                            is_law_injunction='injunction' in law_codes,
                            is_law_penal_code_fraud='penal_code_fraud' in law_codes,
                            is_law_land_reform_act='land_reform_act' in law_codes,
                            is_law_land_acquisition_act='land_acquisition_act' in law_codes,
                            link_ref_status_law_case_status_id=case_status_id,
                            is_support_service_govt_legal_aid='govt_legal_aid' in support_codes,
                            is_support_service_land_center='land_center' in support_codes,
                            is_support_service_dc_office='dc_office' in support_codes,
                            is_support_service_ngo_support='ngo_support' in support_codes,
                            is_risk_threat_family_pressure='family_pressure' in retaliation_codes,
                            is_risk_threat_settlement_pressure='settlement_pressure' in retaliation_codes,
                            is_risk_threat_case_withdrawal_pressure='case_withdrawal_pressure' in retaliation_codes,
                            is_risk_threat_business_loss_threat='business_loss_threat' in retaliation_codes,
                            is_risk_threat_witness_victim_threat='witness_victim_threat' in retaliation_codes,
                            is_risk_threat_eviction_threat='eviction_threat' in retaliation_codes,
                            is_risk_threat_retaliation_threat='retaliation_threat' in retaliation_codes,
                            is_risk_threat_death_or_physical_harm_threat='death_or_physical_harm_threat' in retaliation_codes,
                            legal_action_additional_remarks=(ll.get('remarks') or '').strip() or None,
                            created_at=now,
                        )
                except (json.JSONDecodeError, ValueError, TypeError):
                    raise

            # ---- Save crime evidence files (crime/violence form) ----
            # Uses shared helper: _save_evidence_files()
            _save_evidence_files(
                request, entry.newshub_coll_news_entry_id,
                'crime_evidence_file', 'crime_evidence_descriptions_json', 4, now,
                asset_group_code='evidence',
            )

            # ---- Save commodity price impact (price hike form Step 7) ----
            # → investigation.price_hiking_form_comodity_price (one row per commodity)
            price_gap_json_raw = request.POST.get('price_gap_json', '')
            if price_gap_json_raw:
                try:
                    pg_data = json.loads(price_gap_json_raw)
                    for commodity in pg_data.get('commodities', []):
                        commodity_id = commodity.get('commodityId')
                        if not commodity_id:
                            continue
                        govt_rate = float(commodity.get('govtRate') or 0)
                        market_rate = float(commodity.get('marketRate') or 0)
                        consumer_impact = (commodity.get('consumerImpact') or '').strip() or None
                        PriceHikingFormCommodityPrice.objects.create(
                            link_newshub_coll_news_entry_id=entry.newshub_coll_news_entry_id,
                            link_commodity_id=int(commodity_id),
                            price_govt_fixed_rate=govt_rate,
                            price_market_rate=market_rate,
                            consumer_impact_description=consumer_impact,
                            created_at=now,
                        )
                except (json.JSONDecodeError, ValueError, TypeError):
                    raise

            # ---- Save stockpiling & supply chain impact (price hike form Step 8) ----
            # → investigation.price_hiking_form_commodity_stock_supply_chain (one row per commodity)
            stockpiling_json_raw = request.POST.get('stockpiling_json', '')
            if stockpiling_json_raw:
                try:
                    stock_data = json.loads(stockpiling_json_raw)
                    for item in stock_data.get('commodities', []):
                        commodity_id = item.get('commodityId')
                        if not commodity_id:
                            continue
                        PriceHikingFormCommodityStockSupplyChain.objects.create(
                            link_newshub_coll_news_entry_id=entry.newshub_coll_news_entry_id,
                            link_commodity_id=int(commodity_id),
                            is_crisis_artificial_created=bool(item.get('artificialCrisis')),
                            stock_storage_description=(item.get('description') or '').strip() or None,
                            stock_estimated_quantity=(item.get('estimatedQuantity') or '').strip() or None,
                            supply_chain_crisis_description=(item.get('supplyChainIssue') or '').strip() or None,
                            created_at=now,
                        )
                except (json.JSONDecodeError, ValueError, TypeError):
                    raise

            # ---- Save civic evidence & impact (Step 3 sub-type + Step 7 impact + Step 8 status) ----
            # → investigation.civic_form_impact (single row combining all civic data)
            try:
                civic_sub_type_id = int(request.POST.get('civic_sub_type', '') or 0)
            except (ValueError, TypeError):
                civic_sub_type_id = 0
            civic_impact_json_raw = request.POST.get('civic_impact_json', '')
            civic_status_json_raw = request.POST.get('civic_status_json', '')

            if civic_sub_type_id:
                try:
                    # Step 7: impact & duration
                    civic = json.loads(civic_impact_json_raw) if civic_impact_json_raw else {}
                    impact_cat_id = int(civic.get('impactCategoryId') or 0)
                    people = int(civic.get('peopleAffected') or 0) or None
                    dur_val = int(civic.get('durationValue') or 0) or None
                    dur_unit_id = int(civic.get('durationUnitId') or 0) or None
                    has_complaint = bool(civic.get('previousComplaint'))
                    complaint_details = (civic.get('complaintDetails') or '').strip() or None
                    budget = (civic.get('budgetInfo') or '').strip() or None

                    # Step 8: current status
                    cs = json.loads(civic_status_json_raw) if civic_status_json_raw else {}
                    issue_status_id = int(cs.get('issueStatusId') or 0)
                    status_desc = (cs.get('description') or '').strip() or None

                    if impact_cat_id and issue_status_id:
                        CivicFormImpact.objects.create(
                            link_newshub_coll_news_entry_id=entry.newshub_coll_news_entry_id,
                            link_ref_status_civic_form_sub_issue_type_id=civic_sub_type_id,
                            link_ref_status_civic_form_impact_category_id=impact_cat_id,
                            link_ref_status_civic_form_time_duration_unit_id=dur_unit_id,
                            link_ref_status_civic_form_current_issue_status_id=issue_status_id,
                            impact_affected_people_count=people,
                            impact_time_duration_unit_number=dur_val,
                            status_description=status_desc,
                            is_complaint_filed_previously=has_complaint,
                            complaint_previous_details=complaint_details,
                            complaint_budget_project_info=budget,
                            created_at=now,
                        )
                except (json.JSONDecodeError, ValueError, TypeError):
                    raise

            # ---- Save Global News form fact (Steps 3-6) ----
            # → investigation.global_news_form_fact (single row)
            global_news_countries_json_raw = request.POST.get('global_news_countries_json', '')
            global_news_classification_json_raw = request.POST.get('global_news_classification_json', '')
            global_news_bangladesh_json_raw = request.POST.get('global_news_bangladesh_json', '')
            global_news_reaction_json_raw = request.POST.get('global_news_reaction_json', '')

            if global_news_countries_json_raw:
                try:
                    ctr = json.loads(global_news_countries_json_raw)
                    cls = json.loads(global_news_classification_json_raw) if global_news_classification_json_raw else {}
                    bd = json.loads(global_news_bangladesh_json_raw) if global_news_bangladesh_json_raw else {}
                    rxn = json.loads(global_news_reaction_json_raw) if global_news_reaction_json_raw else {}

                    primary_country = (ctr.get('primaryCountry') or '').strip()
                    if primary_country:
                        # Step 3: story status checkboxes (inside classification JSON)
                        is_breaking_val = 1 if cls.get('isBreaking') else None
                        is_developing_val = bool(cls.get('isDeveloping'))
                        is_bd_relevant_val = bool(cls.get('hasBangladeshAngle'))

                        GlobalNewsFormFact.objects.create(
                            link_newshub_coll_news_entry_id=entry.newshub_coll_news_entry_id,
                            # Step 3: Sub-type + Classification + Story Status
                            link_ref_status_global_news_form_issue_sub_type_id=int(request.POST.get('global_news_sub_type', '') or 0) or None,
                            news_issue_sub_type_other_category_details=(request.POST.get('global_news_sub_type_other_detail', '') or '').strip() or None,
                            link_ref_status_global_news_form_news_significance_id=int(cls.get('significanceId') or 0) or None,
                            is_news_breaking=is_breaking_val,
                            is_news_developing_ongoing_story=is_developing_val,
                            # Step 4: Countries & Organisations
                            geo_primary_country_or_region=primary_country,
                            geo_all_involved_countries_or_regions=(ctr.get('involvedCountries') or '').strip() or None,
                            is_org_un=bool(ctr.get('orgUN')),
                            is_org_eu=bool(ctr.get('orgEU')),
                            is_org_nato=bool(ctr.get('orgNATO')),
                            is_org_imf=bool(ctr.get('orgIMF')),
                            is_org_world_bank=bool(ctr.get('orgWorldBank')),
                            is_org_wto=bool(ctr.get('orgWTO')),
                            is_org_who=bool(ctr.get('orgWHO')),
                            is_org_asean=bool(ctr.get('orgASEAN')),
                            is_org_oic=bool(ctr.get('orgOIC')),
                            is_org_saarc=bool(ctr.get('orgSAARC')),
                            is_org_g7=bool(ctr.get('orgG7')),
                            is_org_g20=bool(ctr.get('orgG20')),
                            is_org_brics=bool(ctr.get('orgBRICS')),
                            is_org_icc=bool(ctr.get('orgICC')),
                            is_org_other=bool(ctr.get('orgOther')),
                            org_other_organization_name=(ctr.get('otherOrgName') or '').strip() or None,
                            # Step 5: Bangladesh
                            is_bd_directly_relevant_to_bangladesh=is_bd_relevant_val,
                            bd_stake_interest_details=(bd.get('stake') or '').strip() or None,
                            is_bd_expatriate_workers_affected=bool(bd.get('expatAffected')),
                            bd_estimated_affected_expatriates_count=int(bd.get('expatCount') or 0) or None,
                            bd_expatriate_impact_description=(bd.get('expatDesc') or '').strip() or None,
                            bd_economic_impact_details=(bd.get('economicImpact') or '').strip() or None,
                            bd_govt_position_statement=(bd.get('govtPosition') or '').strip() or None,
                            # Step 6: Reaction
                            intl_body_statement=(rxn.get('intlStatement') or '').strip() or None,
                            is_intl_sanctions_special_measures_imposed=bool(rxn.get('sanctionsImposed')),
                            intl_sanctions_special_measures_description=(rxn.get('sanctionsDesc') or '').strip() or None,
                            is_intl_agreement_or_resolution_adopted=bool(rxn.get('agreementReached')),
                            intl_agreement_or_resolution_description=(rxn.get('agreementDesc') or '').strip() or None,
                            link_ref_status_global_news_form_sanctions_imposed_id=int(rxn.get('worldReactionId') or 0) or None,
                            link_ref_status_global_news_form_global_media_coverage_id=int(rxn.get('mediaCoverageId') or 0) or None,
                            created_at=now,
                        )
                except (json.JSONDecodeError, ValueError, TypeError):
                    raise

            # ---- Save global conflict parties — Step 4 ----
            # → investigation.conflict_form_actor_country (one row per party)
            conflict_parties_json_raw = request.POST.get('global_conflict_parties_json', '')
            if conflict_parties_json_raw:
                try:
                    conflict_parties = json.loads(conflict_parties_json_raw)
                    for party in conflict_parties:
                        country_id = int(party.get('countryId') or 0)
                        involvement_type_id = int(party.get('involvementTypeId') or 0)
                        if not country_id or not involvement_type_id:
                            continue  # skip parties without a country or role
                        ConflictFormActorCountry.objects.create(
                            link_newshub_coll_news_entry_id=entry.newshub_coll_news_entry_id,
                            link_ref_status_actor_involvement_type_id=involvement_type_id,
                            link_country_id=country_id,
                            actor_alliance_coalition=(party.get('alliance') or '').strip() or None,
                            actor_leader_decision_maker=(party.get('leaderName') or '').strip() or None,
                            actor_official_statement=(party.get('statement') or '').strip() or None,
                            created_at=now,
                        )
                except (json.JSONDecodeError, ValueError, TypeError):
                    raise

            # ---- Save global news conflict evidence — Steps 3+5+6+7 ----
            # → investigation.conflict_form_impact (single row)
            try:
                global_sub_type_id = int(request.POST.get('global_sub_type', '') or 0) or None
            except (ValueError, TypeError):
                global_sub_type_id = None
            frontline_json_raw = request.POST.get('global_frontline_json', '')
            humanitarian_json_raw = request.POST.get('global_humanitarian_json', '')
            geopolitics_json_raw = request.POST.get('global_geopolitics_json', '')

            # Only save if at least one global-specific field is present
            if global_sub_type_id or frontline_json_raw or humanitarian_json_raw or geopolitics_json_raw:
                try:
                    fl = json.loads(frontline_json_raw) if frontline_json_raw else {}
                    hm = json.loads(humanitarian_json_raw) if humanitarian_json_raw else {}
                    gp = json.loads(geopolitics_json_raw) if geopolitics_json_raw else {}

                    ConflictFormImpact.objects.create(
                        link_newshub_coll_news_entry_id=entry.newshub_coll_news_entry_id,
                        # Step 3: conflict sub-type / type
                        link_ref_status_conflict_form_conflict_type_id=global_sub_type_id,
                        # Step 5: frontline
                        link_ref_status_conflict_form_territorial_sovereignty_status_id=int(fl.get('territoryStatusId') or 0) or None,
                        frontline_territory_name=(fl.get('territoryDescription') or '').strip() or None,
                        link_ref_status_conflict_form_conflict_intensity_id=int(fl.get('conflictIntensityId') or 0) or None,
                        link_ref_status_conflict_form_weapon_id=int(fl.get('weaponClassId') or 0) or None,
                        link_ref_status_conflict_form_involvement_level_id=int(fl.get('involvementLevelId') or 0) or None,
                        # Step 6: humanitarian / casualties (NOT NULL — default 0)
                        casualty_military_count=int(hm.get('militaryCasualties') or 0),
                        casualty_civilian_count=int(hm.get('civilianCasualties') or 0),
                        casualty_displaced_refugee_count=int(hm.get('refugees') or 0),
                        casualty_has_war_crime_allegation=bool(hm.get('warCrimes')),
                        casualty_war_crime_details=(hm.get('warCrimesDescription') or '').strip() or None,
                        # Step 7: geopolitics
                        link_ref_status_conflict_form_global_reaction_id=int(gp.get('globalReactionId') or 0) or None,
                        global_reaction_details=(gp.get('globalReactionDetails') or '').strip() or None,
                        # Step 7: strategic impact (4 bit columns, from named checkboxes)
                        global_is_impact_currency_economy=bool(gp.get('strategicCurrencyEconomy')),
                        global_is_impact_food_supply=bool(gp.get('strategicFoodSupply')),
                        global_is_impact_oil_energy=bool(gp.get('strategicOilEnergy')),
                        global_is_impact_shipping_lanes=bool(gp.get('strategicShippingLanes')),
                        # Step 7: local impact
                        local_has_bangladesh_impact=bool(gp.get('localImpact')),
                        local_impact_description=(gp.get('localImpactDescription') or '').strip() or None,
                        created_at=now,
                    )

                except (json.JSONDecodeError, ValueError, TypeError, IndexError):
                    raise

            # ---- Save WCV victim profile — Steps 3 + 4 + 5 ----
            # Step 4: person schema chain → person → person_job → person_marriage → victim_profile
            # Steps 3 + 5: flat bits table → women_form_victim_profile_fact
            wcv_victim_raw = request.POST.get('wcv_victim', '')
            wcv_condition_injury_raw = request.POST.get('wcv_condition_injury', '')
            wcv_violence_context_raw = request.POST.get('wcv_violence_context', '')
            if wcv_victim_raw:
                try:
                    vp = json.loads(wcv_victim_raw)
                    ci = json.loads(wcv_condition_injury_raw) if wcv_condition_injury_raw else {}
                    wt = json.loads(wcv_violence_context_raw) if wcv_violence_context_raw else {}

                    # ---- Step 4: Victim demographics → person schema ----

                    # ① [person].[person] — shared helper for Name + Identity
                    victim_person = _save_actor_person(vp, now)
                    if not victim_person:
                        raise ValueError('Victim first name (EN) is required')
                    victim_person_id = victim_person.person_id

                    # WCV-specific: marital status — store ref_status.status_id directly
                    marital_ref_id = int(vp.get('maritalStatusId') or 0) or None
                    if marital_ref_id:
                        Person.objects.filter(person_id=victim_person_id).update(
                            link_marital_status_id=marital_ref_id,
                        )

                    # ② Shared: Occupation + Institution → [person].[person_job]
                    _save_actor_occupation(victim_person_id, vp, now)

                    # ③ [person].[person_marriage] — only if husband name provided
                    marriage_id = None
                    husband_first = (vp.get('husbandFirstName') or '').strip()
                    husband_last  = (vp.get('husbandLastName')  or '').strip()
                    if husband_first or husband_last:
                        husband_person = Person.objects.create(
                            first_name_en=husband_first or 'Unknown',
                            last_name_en=husband_last or 'Unknown',
                            first_name_bn=husband_first or None,
                            last_name_bn=husband_last or None,
                            is_active=True,
                            created_at=now,
                            modified_at=now,
                        )
                        marriage_date_str = (vp.get('marriageDate') or '').strip()
                        try:
                            marriage_date = _date.fromisoformat(marriage_date_str) if marriage_date_str else now.date()
                        except ValueError:
                            raise
                        marriage_obj = PersonMarriage.objects.create(
                            link_husband_person_id=husband_person.person_id,
                            link_wife_person_id=victim_person_id,
                            marriage_valid_from=marriage_date,
                            created_at=now,
                        )
                        marriage_id = marriage_obj.person_marriage_id

                    # ④ Shared: Actor profile → [investigation].[incident_involved_actor_profile]
                    actor_profile = _save_actor_profile(
                        entry.newshub_coll_news_entry_id, victim_person_id, vp,
                        form_type_id, 'women_child_violence', now,
                        marriage_id=marriage_id, role_code='victim',
                    )

                    # Collect all ref_status IDs that need code lookups (Steps 3 + 5)
                    vt_ids = [int(x) for x in (wt.get('violenceTypeIds') or []) if x]
                    loc_id = int(wt.get('locationTypeId') or 0)
                    ij_ids = [int(x) for x in (ci.get('injuryTypeIds') or []) if x]
                    sev_id = int(ci.get('severityId') or 0)
                    psych_ids = [int(x) for x in (ci.get('psychSymptoms') or []) if x]
                    cond_id = int(ci.get('conditionId') or 0)
                    safety_id = int(ci.get('safetyStatusId') or 0)
                    consent_id = int(ci.get('consentId') or 0)

                    all_ref_ids = (set(vt_ids + ij_ids + psych_ids) |
                                   {loc_id, sev_id, cond_id, safety_id, consent_id}) - {0}
                    code_map = {}
                    if all_ref_ids:
                        for row in RefStatus.objects.filter(
                            status_id__in=all_ref_ids
                        ).values('status_id', 'status_code'):
                            code_map[row['status_id']] = row['status_code'] or ''

                    vt_codes = {code_map[i] for i in vt_ids if i in code_map}
                    ij_codes = {code_map[i] for i in ij_ids if i in code_map}
                    psych_codes = {code_map[i] for i in psych_ids if i in code_map}

                    # Build flat fact_victim row — all booleans start as False (matches DB DEFAULT 0)
                    # Column prefixes: violence_type_, victim_condition_, injury_type_, msc_
                    cattr = dict(
                        violence_type_rape=False, violence_type_gang_rape=False,
                        violence_type_attempted_rape=False, violence_type_sexual_assault=False,
                        violence_type_domestic_violence=False, violence_type_acid_attack=False,
                        violence_type_dowry_violence=False, violence_type_eve_teasing=False,
                        violence_type_child_marriage=False, violence_type_forced_marriage=False,
                        violence_type_trafficking=False, violence_type_cyber_harassment=False,
                        violence_type_workplace_harassment=False, violence_type_honor_killing=False,
                        violence_type_torture_or_cruelty=False, violence_type_other=False,
                        violence_type_is_recurring_violence=False,
                        victim_condition_is_pregnant=False, victim_condition_has_children=False,
                        victim_condition_has_economic_dependency=False,
                        victim_condition_has_disability=False,
                        injury_type_has_physical_injury=False, injury_type_has_sexual_injury=False,
                        injury_type_has_psychological_trauma=False,
                        injury_type_has_acid_or_burn_injury=False,
                        injury_type_has_fracture=False, injury_type_has_internal_injury=False,
                        injury_type_has_strangulation_injury=False,
                        injury_type_has_ptsd_or_flashbacks=False, injury_type_has_depression=False,
                        injury_type_has_anxiety=False, injury_type_has_sleep_disorder=False,
                        injury_type_has_suicidal_ideation=False,
                    )

                    # Step 3: Violence types — code → column violence_type_X
                    _vt_col_override = {
                        'TORTURE_CRUELTY': 'violence_type_torture_or_cruelty',
                        'OTHER': 'violence_type_other',
                    }
                    for code in vt_codes:
                        col = _vt_col_override.get(code) or ('violence_type_' + code.lower())
                        if col in cattr:
                            cattr[col] = True
                    cattr['violence_type_describe_type_of_violence'] = (wt.get('otherType') or '').strip() or None
                    cattr['violence_type_incident_location_type'] = code_map.get(loc_id) or None
                    cattr['violence_type_is_recurring_violence'] = bool(wt.get('recurring'))
                    cattr['violence_type_duration_of_violence'] = (wt.get('duration') or '').strip() or None

                    # Step 5: Victim condition checkboxes
                    if ci.get('pregnant'):
                        cattr['victim_condition_is_pregnant'] = True
                    cattr['victim_condition_months_pregnant'] = int(ci.get('pregnantMonths') or 0) or None
                    if ci.get('hasChildren'):
                        cattr['victim_condition_has_children'] = True
                    cattr['victim_condition_number_of_children'] = int(ci.get('childrenCount') or 0) or None
                    if ci.get('dependent'):
                        cattr['victim_condition_has_economic_dependency'] = True
                    if ci.get('disability'):
                        cattr['victim_condition_has_disability'] = True
                    cattr['victim_condition_disability_type'] = (ci.get('disabilityType') or '').strip() or None

                    # Step 5: Injury types — code HAS_X → column injury_type_has_x
                    # Codes include HAS_ prefix; strip it to avoid double has_
                    _ij_col_override = {
                        'HAS_PTSD_FLASHBACKS': 'injury_type_has_ptsd_or_flashbacks',
                    }
                    for code in ij_codes:
                        col = _ij_col_override.get(code)
                        if not col:
                            raw = code[4:].lower() if code.startswith('HAS_') else code.lower()
                            col = 'injury_type_has_' + raw
                        if col in cattr:
                            cattr[col] = True
                    cattr['injury_type_injury_severity'] = code_map.get(sev_id) or None

                    # Step 5: Psych symptoms — code HAS_X → column injury_type_has_x
                    for code in psych_codes:
                        col = _ij_col_override.get(code)
                        if not col:
                            raw = code[4:].lower() if code.startswith('HAS_') else code.lower()
                            col = 'injury_type_has_' + raw
                        if col in cattr:
                            cattr[col] = True

                    # Step 5: Medical / Safety / Consent (stored as code text)
                    cattr['msc_victim_current_condition'] = code_map.get(cond_id) or None
                    cattr['msc_current_safety_status'] = code_map.get(safety_id) or None
                    cattr['msc_consent_to_share_information'] = code_map.get(consent_id) or None

                    victim_profile_fact = WomenFormVictimProfileFact.objects.create(
                        link_newshub_coll_news_entry_id=entry.newshub_coll_news_entry_id,
                        link_person_id=victim_person_id,
                        link_person_marriage_id=marriage_id,
                        created_at=now,
                        **cattr,
                    )

                    # ---- Save WCV perpetrators — Step 6 (repeater: one row per accused) ----
                    # Uses shared helpers for Name + Identity → [person].[person]
                    # and Actor Type + Party Details → [investigation].[incident_involved_actor_profile]
                    # Plus WCV-specific fields → [investigation].[women_form_perpetrator]
                    # ref_status group_code=women_form_attacker_attribute codes:
                    #   HAS_THREATENED_VICTIM_OR_FAMILY, HAS_USED_DRUGS_OR_INTOXICATION, HAS_PREVIOUS_HISTORY_OF_VIOLENCE
                    wcv_accused_raw = request.POST.get('wcv_accused', '')
                    if wcv_accused_raw:
                        perps_list = json.loads(wcv_accused_raw)
                        if isinstance(perps_list, list) and perps_list:
                            all_attr_ids = set()
                            for perp_data in perps_list:
                                for x in (perp_data.get('attributeIds') or []):
                                    if x:
                                        all_attr_ids.add(int(x))
                            attr_code_map = {}
                            if all_attr_ids:
                                for row in RefStatus.objects.filter(
                                    status_id__in=all_attr_ids
                                ).values('status_id', 'status_code'):
                                    attr_code_map[row['status_id']] = row['status_code'] or ''

                            for acc in perps_list:
                                # ① Shared: Name + Identity → [person].[person]
                                person = _save_actor_person(acc, now)
                                if not person:
                                    continue

                                # ①b Shared: Occupation + Institution → [person].[person_job]
                                _save_actor_occupation(person.person_id, acc, now)

                                # ② Shared: Actor profile → [investigation].[incident_involved_actor_profile]
                                _save_actor_profile(
                                    entry.newshub_coll_news_entry_id, person.person_id, acc,
                                    form_type_id, 'women_child_violence', now,
                                    role_code='accused',
                                )
                                # ③ WCV-specific: perpetrator details → women_form_perpetrator
                                attr_id_set = set(int(x) for x in (acc.get('attributeIds') or []) if x)
                                attr_codes = {attr_code_map[i] for i in attr_id_set if i in attr_code_map}
                                WomenFormPerpetrator.objects.create(
                                    link_newshub_coll_news_entry_id=entry.newshub_coll_news_entry_id,
                                    link_person_id=person.person_id,
                                    link_women_form_victim_profile_fact_id=victim_profile_fact.women_form_victim_profile_fact_id,
                                    link_ref_status_victim_attacker_relationship_id=int(acc.get('relationshipId') or 0) or None,
                                    perp_other_relationship_details=(acc.get('relationshipOther') or '').strip() or None,
                                    perp_number_of_perpetrators=int(acc.get('accusedCount') or 0) or None,
                                    link_ref_status_women_form_attacker_power_position_id=int(acc.get('positionId') or 0) or None,
                                    perp_power_position_details=(acc.get('positionRemarks') or '').strip() or None,
                                    is_perp_threatened_victim_or_family='has_threatened_victim_or_family' in attr_codes,
                                    is_perp_used_drugs_or_intoxication='has_used_drugs_or_intoxication' in attr_codes,
                                    is_perp_history_previous_violence='has_previous_history_of_violence' in attr_codes,
                                    perp_history_previous_details=(acc.get('previousHistoryDetails') or '').strip() or None,
                                    remarks_about_perpetrator=(acc.get('remarks') or '').strip() or None,
                                    created_at=now,
                                )

                except (json.JSONDecodeError, ValueError, TypeError):
                    raise

            # ---- Save WCV witnesses — Step 7 (standard witness repeater) ----
            # Uses shared helper: _save_actors_from_json (witness_json only)
            _save_actors_from_json(
                request, entry.newshub_coll_news_entry_id, form_type_id,
                'women_child_violence', now,
                json_fields=('witness_json',),
            )

            # ---- Save WCV legal action — Step 8 ----
            # Resolves ref_status codes from IDs; saves all as direct BIT columns.
            wcv_legal_raw = request.POST.get('wcv_legal', '')
            if wcv_legal_raw:
                try:
                    lg = json.loads(wcv_legal_raw)

                    fir_status_id = int(lg.get('firStatusId') or 0)
                    case_status_id = int(lg.get('caseStatusId') or 0)
                    law_ids = set(int(x) for x in (lg.get('applicableLawIds') or []) if x)
                    support_ids = set(int(x) for x in (lg.get('supportServiceIds') or []) if x)
                    retaliation_ids = set(int(x) for x in (lg.get('retaliationIds') or []) if x)

                    all_ids = ({fir_status_id, case_status_id} | law_ids | support_ids | retaliation_ids) - {0}
                    code_map = {}
                    if all_ids:
                        for row in RefStatus.objects.filter(status_id__in=all_ids).values('status_id', 'status_code'):
                            code_map[row['status_id']] = row['status_code'] or ''

                    # Only save legal action if FIR status was selected (NOT NULL column)
                    if fir_status_id:
                        fir_code = code_map.get(fir_status_id) or None
                        fir_yes = (fir_code == 'YES')
                        fir_refused = (fir_code == 'POLICE_REFUSED')
                        fir_no = (fir_code == 'NO')

                        case_status_code = code_map.get(case_status_id) or None
                        law_codes = {code_map[i] for i in law_ids if i in code_map}
                        support_codes = {code_map[i] for i in support_ids if i in code_map}
                        retaliation_codes = {code_map[i] for i in retaliation_ids if i in code_map}

                        WomenFormVictimLegalAction.objects.create(
                            link_newshub_coll_news_entry_id=entry.newshub_coll_news_entry_id,
                            link_ref_status_law_gd_fir_status_id=fir_status_id,
                            case_gd_number=((lg.get('caseNumber') or '').strip() or None) if fir_yes else None,
                            reason_for_not_filing_and_plans=((lg.get('noFirReason') or '').strip() or None) if fir_no else None,
                            police_refusal_statement=((lg.get('policeRefusalStatement') or '').strip() or None) if fir_refused else None,
                            police_station_name=((lg.get('policeStation') or '').strip() or None) if fir_yes else None,
                            is_law_women_children_repression_2000='women_child_repression_act_2000' in law_codes,
                            is_law_penal_code_375_376_rape='penal_code_375_376_rape' in law_codes,
                            is_law_domestic_violence_2010='domestic_violence_act_2010' in law_codes,
                            is_law_acid_control_2002='acid_control_act_2002' in law_codes,
                            is_law_digital_security='digital_security_act' in law_codes,
                            is_law_dowry_prohibition_2018='dowry_prohibition_act_2018' in law_codes,
                            is_law_child_marriage_restraint_2017='child_marriage_restraint_act_2017' in law_codes,
                            is_law_human_trafficking_2012='human_trafficking_prevention_act_2012' in law_codes,
                            link_ref_status_law_case_status_id=case_status_id or None,
                            is_support_shelter_accessed='has_shelter_accessed' in support_codes,
                            is_support_legal_aid='has_legal_aid' in support_codes,
                            is_support_counseling_provided='has_counseling_provided' in support_codes,
                            is_support_one_stop_crisis_centre='has_one_stop_crisis_centre' in support_codes,
                            is_risk_threat_family_pressure='family_pressure' in retaliation_codes,
                            is_risk_threat_settlement_pressure='settlement_pressure' in retaliation_codes,
                            is_risk_threat_case_withdrawal_pressure='case_withdrawal_pressure' in retaliation_codes,
                            is_risk_threat_business_loss_threat='business_loss_threat' in retaliation_codes,
                            is_risk_threat_witness_victim_threat='witness_victim_threat' in retaliation_codes,
                            is_risk_threat_eviction_threat='eviction_threat' in retaliation_codes,
                            is_risk_threat_retaliation_threat='retaliation_threat' in retaliation_codes,
                            is_risk_threat_death_or_physical_harm_threat='death_or_physical_harm_threat' in retaliation_codes,
                            legal_action_additional_remarks=(lg.get('remarks') or '').strip() or None,
                            created_at=now,
                        )
                except (json.JSONDecodeError, ValueError, TypeError):
                    raise

            # ---- Save sports evidence — Steps 4-6 (sports form) ----
            # → investigation.sports_form_fact (single row)
            sports_sport_type_raw       = request.POST.get('sports_sport_type', '').strip()
            sports_sub_type_raw         = request.POST.get('sports_sub_type', '').strip()
            sports_match_event_raw      = request.POST.get('sports_match_event_json', '')
            sports_teams_result_raw     = request.POST.get('sports_teams_result_json', '')
            sports_key_performances_raw = request.POST.get('sports_key_performances_json', '')

            # Lookup helper: returns ref_status.status_id for a given group_code + status_code.
            # Returns None if not yet seeded; FK fields store NULL until ref_status is populated.
            def _ref_id(gc, sc):
                if not sc:
                    return None
                return RefStatus.objects.filter(
                    group_code=gc, status_code=sc
                ).values_list('status_id', flat=True).first()

            if sports_match_event_raw or sports_teams_result_raw or sports_key_performances_raw:
                try:
                    me = json.loads(sports_match_event_raw) if sports_match_event_raw else {}
                    tr = json.loads(sports_teams_result_raw) if sports_teams_result_raw else {}
                    kp = json.loads(sports_key_performances_raw) if sports_key_performances_raw else {}

                    def _s(d, k): return (d.get(k) or '').strip() or None
                    def _sdate(s):
                        if not s: return None
                        return _date.fromisoformat(s)

                    SportsFormFact.objects.create(
                        link_newshub_coll_news_entry_id=entry.newshub_coll_news_entry_id,
                        # Step 3: Sport Type & News Sub-Type
                        link_ref_status_sports_form_sport_list_id=_ref_id('sports_form_sport_list', sports_sport_type_raw) if sports_sport_type_raw else None,
                        link_ref_status_sports_form_sub_issue_type_id=_ref_id('sports_form_sub_issue_type', sports_sub_type_raw) if sports_sub_type_raw else None,
                        # Step 4: Match & Event
                        event_tournament_name=_s(me, 'competitionName'),
                        event_link_ref_tournament_round_stage_id=_ref_id('sports_form_tournament_round_stage', _s(me, 'stage')),
                        event_tournament_round_stage=_s(me, 'stageName'),
                        event_venue_stadium=_s(me, 'venue'),
                        event_match_date=_sdate(me.get('matchDate')),
                        event_link_ref_match_status_id=_ref_id('sports_form_match_status', _s(me, 'matchStatus')),
                        # Step 5: Teams & Result
                        match_team_player_a=_s(tr, 'teamA'),
                        match_team_player_b=_s(tr, 'teamB'),
                        match_score_a=_s(tr, 'scoreA'),
                        match_score_b=_s(tr, 'scoreB'),
                        match_result_summary=_s(tr, 'result'),
                        match_toss_winner=_s(tr, 'tossWinner'),
                        match_toss_decision=_s(tr, 'tossDecision'),
                        match_player_of_the_match=_s(tr, 'playerOfMatch'),
                        # Step 6: Key Performances
                        perf_top_performer_1_name=_s(kp, 'performer1Name'),
                        perf_top_performer_1_desc=_s(kp, 'performer1Detail'),
                        perf_top_performer_2_name=_s(kp, 'performer2Name'),
                        perf_top_performer_2_desc=_s(kp, 'performer2Detail'),
                        perf_top_performer_3_name=_s(kp, 'performer3Name'),
                        perf_top_performer_3_desc=_s(kp, 'performer3Detail'),
                        perf_records_milestones=_s(kp, 'records'),
                        perf_tournament_standing=_s(kp, 'standing'),
                        created_at=now,
                    )
                except (json.JSONDecodeError, ValueError, TypeError):
                    raise

            # ---- Save entertainment evidence — Steps 3-6 (entertainment form) ----
            # → investigation.entertainment_form_fact (single row)
            # Step 3: medium + sub-type (plain POST keys)
            ent_medium_code   = (request.POST.get('entertainment_medium_id', '') or '').strip() or None
            ent_sub_type_code = (request.POST.get('entertainment_sub_type', '') or '').strip() or None
            ent_production_raw   = request.POST.get('entertainment_production_json', '')
            ent_cast_release_raw = request.POST.get('entertainment_cast_release_json', '')
            ent_performance_raw  = request.POST.get('entertainment_performance_json', '')

            if ent_medium_code or ent_sub_type_code or ent_production_raw or ent_cast_release_raw or ent_performance_raw:
                try:
                    epd = json.loads(ent_production_raw) if ent_production_raw else {}
                    ecr = json.loads(ent_cast_release_raw) if ent_cast_release_raw else {}
                    epf = json.loads(ent_performance_raw) if ent_performance_raw else {}

                    def _se(d, k): return (d.get(k) or '').strip() or None
                    def _sedate(s):
                        if not s: return None
                        return _date.fromisoformat(s)

                    # prod_title_name is NOT NULL — fallback to empty string
                    title_val = _se(epd, 'title') or ''

                    EntertainmentFormFact.objects.create(
                        link_newshub_coll_news_entry_id=entry.newshub_coll_news_entry_id,
                        # Step 3: Medium & Sub-Type
                        link_ref_status_entertainment_form_medium_type_id=_ref_id('entertainment_form_medium_type', ent_medium_code),
                        link_ref_status_entertainment_form_issue_sub_type_id=_ref_id('entertainment_form_issue_sub_type', ent_sub_type_code),
                        # Step 4: Production
                        prod_title_name=title_val,
                        prod_link_ref_language_id=_ref_id('entertainment_form_language', _se(epd, 'language')),
                        prod_link_ref_entertainment_industry_id=_ref_id('entertainment_form_entertainment_industry', _se(epd, 'industry')),
                        prod_director=_se(epd, 'director'),
                        prod_producer_house=_se(epd, 'producer'),
                        prod_writer_screenwriter=_se(epd, 'writer'),
                        prod_music_director_singer=_se(epd, 'musicDirector'),
                        # Step 5: Cast & Release
                        cast_lead_cast=_se(ecr, 'leadCast'),
                        cast_supporting_cast=_se(ecr, 'suppCast'),
                        cast_release_date=_sedate(ecr.get('releaseDate')),
                        cast_link_ref_media_platform_id=_ref_id('entertainment_form_media_platform', _se(ecr, 'platform')),
                        cast_link_ref_genre_category_id=_ref_id('entertainment_form_genre_category', _se(ecr, 'genre')),
                        # Step 6: Performance
                        perf_box_office_revenue=_se(epf, 'boxOffice'),
                        perf_views_streams=_se(epf, 'viewsStreams'),
                        perf_rating=_se(epf, 'rating'),
                        perf_link_ref_audience_response_id=_ref_id('entertainment_form_audience_response', _se(epf, 'audienceResponse')),
                        created_at=now,
                    )
                except (json.JSONDecodeError, ValueError, TypeError):
                    raise

            # ---- Save July 2024 uprising data — Steps 3, 4, 5, 6, 7, 8 ----
            # → person.person              (martyr identity — always new INSERT)
            # → person.person_job         (occupation + institution, if both provided)
            # → investigation.incident_involved_actor_profile
            # → investigation.july2024_fact_protest (context + story + cause + forces + evidence)
            # NOTE: CollNewsEntry has no link_issue_sub_type_id column — july_sub_type
            #       is saved only to july2024_fact_protest.link_incident_type_id.
            july_martyr_raw = request.POST.get('july_martyr_json', '')
            if july_martyr_raw:
                try:
                    jm = json.loads(july_martyr_raw)

                    # Parse all other July-specific JSON blobs
                    jctx = json.loads(request.POST.get('july_context_json', '') or '{}')
                    js   = json.loads(request.POST.get('july_story_json', '')   or '{}')
                    jc   = json.loads(request.POST.get('july_cause_json', '')   or '{}')
                    jo   = json.loads(request.POST.get('july_oppressors_json', '') or '{}')
                    je   = json.loads(request.POST.get('july_evidence_json', '') or '{}')
                    july_martyr_status_raw = request.POST.get('july_martyr_status', '') or ''

                    # ---- Shared: Name + Identity → [person].[person] ----
                    martyr_person = _save_actor_person(jm, now)
                    if not martyr_person:
                        raise ValueError('Martyr first name (EN) is required')
                    martyr_person_id = martyr_person.person_id

                    # July-specific: mother name (not in shared helper)
                    mother_first = (jm.get('motherFirstName') or '').strip() or None
                    mother_last = (jm.get('motherLastName') or '').strip() or None
                    if mother_first or mother_last:
                        Person.objects.filter(person_id=martyr_person_id).update(
                            mother_first_name_bn=mother_first,
                            mother_last_name_bn=mother_last,
                        )

                    # ---- Shared: Occupation + Institution → [person].[person_job] ----
                    _save_actor_occupation(martyr_person_id, jm, now, occ_key='occupation')

                    # ---- Shared: Actor profile → [investigation].[incident_involved_actor_profile] ----
                    _save_actor_profile(
                        entry.newshub_coll_news_entry_id, martyr_person_id, jm,
                        form_type_id, 'july_uprising_2024', now,
                        role_code='victim',
                    )

                    # ---- Forces: status_ids → status_codes → BIT columns ----
                    _force_ids = [int(x) for x in (jo.get('forces') or []) if x]
                    force_codes = set()
                    if _force_ids:
                        for _row in RefStatus.objects.filter(status_id__in=_force_ids).values('status_code'):
                            force_codes.add(_row['status_code'] or '')

                    # ---- Evidence types: status_ids → status_codes → BIT columns ----
                    _evid_ids = [int(x) for x in (je.get('evidenceTypes') or []) if x]
                    evid_codes = set()
                    if _evid_ids:
                        for _row in RefStatus.objects.filter(status_id__in=_evid_ids).values('status_code'):
                            evid_codes.add(_row['status_code'] or '')

                    # ---- INSERT [investigation].[july2024_fact_protest] ----
                    July2024FactProtest.objects.create(
                        link_newshub_coll_news_entry_id=entry.newshub_coll_news_entry_id,
                        # Step 3: incident type + context
                        link_ref_status_incident_type_id=int(request.POST.get('july_sub_type', '') or 0) or None,
                        link_ref_status_protest_scale_id=int(jctx.get('scale') or 0) or None,
                        link_ref_status_internet_status_id=int(jctx.get('internetStatus') or 0) or None,
                        link_ref_status_curfew_status_id=int(jctx.get('curfewStatus') or 0) or None,
                        # Step 5: victim status + personal story
                        link_ref_status_victim_current_status_id=int(july_martyr_status_raw or 0) or None,
                        victim_story_final_words_or_actions=(js.get('lastWords') or '').strip() or None,
                        victim_story_biographical_note=(js.get('lifeStory') or '').strip() or None,
                        victim_story_involvement_context=(js.get('howJoined') or '').strip() or None,
                        victim_story_is_sole_breadwinner=bool(js.get('breadwinner', False)),
                        victim_story_dependents_count=int(js.get('dependents') or 0) or None,
                        victim_story_family_impact_note=(js.get('familyImpact') or '').strip() or None,
                        # Step 6: cause of death / injury
                        link_ref_status_protest_suppression_weapon_id=int(jc.get('weaponType') or 0) or None,
                        link_ref_status_victim_body_injury_site_id=int(jc.get('injurySite') or 0) or None,
                        victim_medical_injury_timestamp_text=(jc.get('timeOfInjury') or '').strip() or None,
                        victim_medical_hospital_name=(jc.get('hospital') or '').strip() or None,
                        victim_medical_death_timestamp_text=(jc.get('timeOfDeath') or '').strip() or None,
                        victim_evidence_is_autopsy_done=bool(jc.get('autopsyDone', False)),
                        victim_evidence_is_death_certificate_available=bool(jc.get('deathCertificate', False)),
                        victim_evidence_is_medical_documents_available=bool(jc.get('medicalDocs', False)),
                        # Step 4: martyr home address (from july_martyr_json)
                        link_home_district_id=int(jm.get('homeDistrictId') or 0) or None,
                        link_home_upazila_id=int(jm.get('homeUpazilaId') or 0) or None,
                        link_home_union_parishad_id=int(jm.get('homeLocalBodyId') or 0) or None,
                        link_home_ward_id=int(jm.get('homeWardId') or 0) or None,
                        # Step 7: forces — hardcoded status_code → BIT mapping
                        force_involved_is_police='police' in force_codes,
                        force_involved_is_rab='rab' in force_codes,
                        force_involved_is_bgb='bgb' in force_codes,
                        force_involved_is_army='army' in force_codes,
                        force_involved_is_db_police='db_police' in force_codes,
                        force_involved_is_bcl='bcl' in force_codes,
                        force_involved_is_jubo_league='jubo_league' in force_codes,
                        force_involved_is_unknown_plainclothes='unknown_plainclothes' in force_codes,
                        force_details_unit_or_badge_number=(jo.get('unitBadge') or '').strip() or None,
                        force_details_commanding_officer_name=(jo.get('commandingOfficer') or '').strip() or None,
                        force_details_area_oc_or_dc_name=(jo.get('ocDc') or '').strip() or None,
                        force_details_orders_or_directives=(jo.get('directives') or '').strip() or None,
                        # Step 8: evidence — hardcoded status_code → BIT mapping
                        link_ref_status_verification_status_id=int(je.get('verificationStatus') or 0) or None,
                        verification_has_video_evidence='video_evidence' in evid_codes,
                        verification_has_photo_evidence='photo_evidence' in evid_codes,
                        verification_has_cctv_footage='cctv_footage' in evid_codes,
                        verification_has_eyewitness_testimony='eyewitness_testimony' in evid_codes,
                        verification_is_listed_in_official_gazette='listed_in_gazette' in evid_codes,
                        verification_eyewitness_count=int(je.get('eyewitnessCount') or 0) or None,
                        verification_memorial_reference=(je.get('memorialRef') or '').strip() or None,
                        # Metadata
                        created_at=now,
                        created_by_user_id=request.user.id if request.user.is_authenticated else None,
                    )

                except (json.JSONDecodeError, ValueError, TypeError):
                    raise

    except (IntegrityError, DatabaseError, json.JSONDecodeError, ValueError, TypeError, IndexError) as exc:
        # Full rollback — no partial/orphan entries.
        # Catches: DB constraint violations, malformed JSON, data conversion errors.
        import traceback
        print("=== SUBMISSION ERROR ===")
        traceback.print_exc()
        print("=== END ERROR ===")
        error_msg = 'সংবাদ জমা দেওয়া সম্ভব হয়নি। অনুগ্রহ করে আবার চেষ্টা করুন। (Submission failed. Please try again.)'

        # AJAX request — return JSON error (no page reload)
        if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
            return JsonResponse({'success': False, 'error': error_msg}, status=400)

        form_context = _build_form_context(
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
        return render(request, template_name, form_context)

    # ---- Success redirect ----
    # In edit mode, redirect back to the article view page if pub_article exists
    if is_edit_mode:
        from .models import PubArticle
        try:
            pub = PubArticle.objects.get(link_news_entry_id=entry.newshub_coll_news_entry_id)
            article_url = reverse('newshub:article_detail', kwargs={'slug': pub.pub_article_slug})
            if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
                return JsonResponse({'success': True, 'redirect': article_url})
            return redirect(article_url)
        except PubArticle.DoesNotExist:
            pass  # Fall through to normal redirect

    # AJAX request — return JSON success (no page reload)
    if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
        return JsonResponse({'success': True, 'redirect': request.path + '?submitted=1'})

    # PRG: redirect to GET so browser refresh won't re-submit the form
    return redirect(request.path + '?submitted=1')
