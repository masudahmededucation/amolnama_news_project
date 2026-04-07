"""
newshub/helpers.py — Article view helper functions + edit pre-population.

build_sidenote_data(news_entry) — sidenote items for two-column article view.
build_edit_data(entry_id, form_type_code) — reconstruct all form data from DB for edit mode.
"""

import logging
import re

logger = logging.getLogger(__name__)

from django.utils import timezone
from amolnama_news.site_apps.investigation.models import (
    RefStatus,
    ExtortionFormImpact,
    ExtortionFormVictimLegalAction,
    CrimeFormImpactCasualty,
    CrimeFormWeapon,
    CrimeFormVictimLegalAction,
    LandGrabbingFormFact,
    LandGrabbingFormVictimLegalAction,
    PriceHikingFormCommodityPrice,
    PriceHikingFormCommodityStockSupplyChain,
    CivicFormImpact,
    GlobalNewsFormFact,
    ConflictFormImpact,
    ConflictFormActorCountry,
    July2024FactProtest,
    WomenFormVictimProfileFact,
    WomenFormPerpetrator,
    WomenFormVictimLegalAction,
    IncidentInvolvedActorProfile,
)
# SportsFormFact and EntertainmentFormFact models not yet created — add when Phase 2 is implemented


# ========== BIT flag → status_id reverse maps (extortion) ==========

_EXTORTION_SECTOR_BIT_TO_ID = {
    'sector_is_shop_market': 427,
    'sector_is_transport_vehicle': 428,
    'sector_is_construction_site': 429,
    'sector_is_contract_tender': 430,
    'sector_is_garment_factory': 431,
    'sector_is_crops_produce': 432,
    'sector_is_school_college': 433,
    'sector_is_healthcare_clinic': 434,
    'sector_is_phone_digital': 435,
    'sector_is_other': 436,
}

_EXTORTION_AFFILIATION_BIT_TO_ID = {
    'accused_is_political_student_wing': 444,
    'accused_is_transport_association': 445,
    'accused_is_business_trade_association': 446,
    'accused_is_professional_gang': 447,
    'accused_is_law_enforcement': 448,
    'accused_is_teen_gang': 449,
    'accused_is_disguised_association_fee': 450,
    'accused_is_unknown': 451,
}

_EXTORTION_THREAT_BIT_TO_ID = {
    'threat_is_in_person': 452,
    'threat_is_phone_sms': 453,
    'threat_is_online_social_media': 454,
    'threat_is_written_letter': 455,
    'threat_is_blocking_supply': 456,
    'threat_is_physical_assault': 457,
    'threat_is_vandalism_arson': 458,
    'threat_is_abduction_hostage': 459,
    'threat_is_false_case_threat': 460,
}

_EXTORTION_CONSEQUENCE_BIT_TO_ID = {
    'consequence_is_paid_full': 461,
    'consequence_is_paid_partial': 462,
    'consequence_is_business_disrupted': 463,
    'consequence_is_physically_injured': 464,
    'consequence_is_abducted_hostage': 465,
    'consequence_is_shot_critically_injured': 466,
    'consequence_is_killed': 467,
    'consequence_is_false_case_filed': 468,
    'consequence_is_property_vandalized': 469,
    'consequence_is_none_yet': 470,
}

_EXTORTION_CONTEXT_BIT_TO_ID = {
    'context_is_law_enforcement_direct_participation': 472,
    'context_is_systematic_extortion_pattern': 473,
}

# Legal action BIT → status_id maps (code-based, need to resolve codes→IDs from DB)
_EXTORTION_LAW_BIT_TO_CODE = {
    'is_law_penal_code_383_389': 'penal_code_383_389',
    'is_law_anti_terrorism_act': 'anti_terrorism_act',
    'is_law_prevention_of_corruption_act': 'prevention_of_corruption_act',
    'is_law_money_laundering_prevention_act': 'money_laundering_prevention_act',
}

_EXTORTION_SUPPORT_BIT_TO_CODE = {
    'is_support_gov_legal_aid': 'gov_legal_aid',
    'is_support_acc_complaint': 'acc_complaint',
    'is_support_business_association': 'business_association',
    'is_support_ngo_aid': 'ngo_aid',
}

_EXTORTION_RETALIATION_BIT_TO_CODE = {
    'is_risk_threat_family_pressure': 'family_pressure',
    'is_risk_threat_settlement_pressure': 'settlement_pressure',
    'is_risk_threat_case_withdrawal_pressure': 'case_withdrawal_pressure',
    'is_risk_threat_business_loss_threat': 'business_loss_threat',
    'is_risk_threat_witness_victim_threat': 'witness_victim_threat',
    'is_risk_threat_eviction_threat': 'eviction_threat',
    'is_risk_threat_retaliation_threat': 'retaliation_threat',
    'is_risk_threat_death_or_physical_harm_threat': 'death_or_physical_harm_threat',
}


def _resolve_status(status_id):
    """Resolve a ref_status FK to its Bengali display name."""
    if not status_id:
        return None
    try:
        s = RefStatus.objects.get(status_id=status_id)
        return s.status_name_bn
    except RefStatus.DoesNotExist:
        return None


def _build_sidenote_item(item_type, icon, label, value):
    """Build a single sidenote item dict."""
    if not value:
        return None
    return {'type': item_type, 'icon': icon, 'label': label, 'value': str(value)}


def _bit_flags_to_list(obj, prefix, label_map):
    """
    Extract active BIT flag fields from an object.
    prefix: field name prefix (e.g. 'sector_is_')
    label_map: dict of {field_suffix: display_label}
    Returns list of display labels where the flag is True.
    """
    result = []
    for suffix, label in label_map.items():
        field_name = prefix + suffix
        if getattr(obj, field_name, False):
            result.append(label)
    return result


# ========== Shared sidenotes (all form types) ==========

def _shared_sidenotes(entry):
    """Sidenotes common to all form types."""
    items = []

    # Occurrence date
    if entry.occurrence_at:
        items.append(_build_sidenote_item('date', '📅', 'ঘটনার তারিখ', entry.occurrence_at.strftime('%d/%m/%Y %H:%M')))

    # Location — strip English parenthetical parts for cleaner Bengali display
    addr_parts = []
    if entry.upazila_city_corporation_name:
        addr_parts.append(re.sub(r'\s*\([^)]*\)', '', entry.upazila_city_corporation_name).strip())
    if entry.full_address_bn:
        addr_parts.append(re.sub(r'\s*\([^)]*\)', '', entry.full_address_bn).strip())
    elif entry.map_formatted_address_bn:
        addr_parts.append(re.sub(r'\s*\([^)]*\)', '', entry.map_formatted_address_bn).strip())
    if addr_parts:
        # Also strip English labels like "Municipality:", "District:"
        location_text = ', '.join(addr_parts)
        location_text = re.sub(r'\b[A-Za-z]+:\s*', '', location_text).strip()
        location_text = re.sub(r',\s*,', ',', location_text).strip(', ')
        items.append(_build_sidenote_item('place', '📍', 'স্থান', location_text))

    # Breaking news
    if entry.is_breaking:
        items.append(_build_sidenote_item('status', '🔴', 'ব্রেকিং', 'ব্রেকিং নিউজ'))

    return items


def _actor_sidenotes(entry_id):
    """Sidenotes from involved actors (accused, victims, witnesses)."""
    from amolnama_news.site_apps.user_account.models import Person

    items = []
    actors = list(IncidentInvolvedActorProfile.objects.filter(
        link_newshub_coll_news_entry_id=entry_id
    ))

    # Bulk fetch persons
    person_ids = [a.link_person_id for a in actors if a.link_person_id]
    persons_map = {}
    if person_ids:
        persons_map = {
            p.person_id: p
            for p in Person.objects.filter(person_id__in=person_ids)
        }

    accused_names = []
    victim_names = []
    witness_names = []

    for actor in actors:
        role = (actor.incident_involved_actor_role_group_code or '').lower()
        name = actor.actor_organization_name or ''
        person = persons_map.get(actor.link_person_id)
        if person:
            name = f"{person.first_name_bn or ''} {person.last_name_bn or ''}".strip()
            if not name:
                name = f"{person.first_name_en or ''} {person.last_name_en or ''}".strip()

        if not name:
            continue

        if role == 'accused':
            accused_names.append(name)
        elif role == 'victim':
            victim_names.append(name)
        elif role == 'witness':
            witness_names.append(name)

    if accused_names:
        items.append(_build_sidenote_item('person', '🔴', 'অভিযুক্ত', ', '.join(accused_names)))
    if victim_names:
        items.append(_build_sidenote_item('person', '🟠', 'ভুক্তভোগী', ', '.join(victim_names)))
    if witness_names:
        items.append(_build_sidenote_item('person', '🔵', 'সাক্ষী', ', '.join(witness_names)))

    return items


# ========== Extortion sidenotes ==========

def _extortion_sidenotes(entry_id):
    """Sidenotes specific to extortion form."""
    items = []
    try:
        extortion_impact = ExtortionFormImpact.objects.get(link_newshub_coll_news_entry_id=entry_id)
    except ExtortionFormImpact.DoesNotExist:
        return items

    # Amounts
    if extortion_impact.demand_amount_demanded_bdt:
        items.append(_build_sidenote_item('amount', '💰', 'দাবিকৃত অর্থ', f'৳{extortion_impact.demand_amount_demanded_bdt:,.0f}'))
    if extortion_impact.demand_amount_collected_bdt:
        items.append(_build_sidenote_item('amount', '💸', 'আদায়কৃত অর্থ', f'৳{extortion_impact.demand_amount_collected_bdt:,.0f}'))

    # Frequency
    freq = _resolve_status(extortion_impact.link_ref_status_extortion_form_extortion_demand_frequency_id)
    if freq:
        items.append(_build_sidenote_item('info', '🔄', 'দাবির ধরন', freq))

    # Sectors
    sector_map = {
        'shop_market': 'দোকান / বাজার',
        'transport_vehicle': 'পরিবহন / যানবাহন',
        'construction_site': 'নির্মাণ সাইট',
        'contract_tender': 'ঠিকাদারি / টেন্ডার',
        'garment_factory': 'গার্মেন্ট / কারখানা',
        'crops_produce': 'ফসল / কৃষিপণ্য',
        'school_college': 'শিক্ষা প্রতিষ্ঠান',
        'healthcare_clinic': 'স্বাস্থ্যসেবা',
        'phone_digital': 'ফোন / ডিজিটাল',
        'other': 'অন্যান্য',
    }
    sectors = _bit_flags_to_list(extortion_impact, 'sector_is_', sector_map)
    if sectors:
        items.append(_build_sidenote_item('info', '🏢', 'চাঁদাবাজির ক্ষেত্র', ', '.join(sectors)))

    # Perpetrator affiliations
    affiliation_map = {
        'political_student_wing': 'রাজনৈতিক দল / ছাত্র সংগঠন',
        'transport_association': 'পরিবহন সমিতি',
        'business_trade_association': 'ব্যবসায়িক সমিতি',
        'professional_gang': 'পেশাদার গ্যাং',
        'law_enforcement': 'আইনশৃঙ্খলা বাহিনী',
        'teen_gang': 'কিশোর গ্যাং',
        'disguised_association_fee': 'ছদ্মবেশী চাঁদা',
        'unknown': 'অজ্ঞাত',
    }
    affiliations = _bit_flags_to_list(extortion_impact, 'accused_is_', affiliation_map)
    if affiliations:
        items.append(_build_sidenote_item('person', '👥', 'অভিযুক্ত পক্ষ', ', '.join(affiliations)))

    # Threat methods
    threat_map = {
        'in_person': 'সামনাসামনি',
        'phone_sms': 'ফোন / এসএমএস',
        'online_social_media': 'অনলাইন / সামাজিক মাধ্যম',
        'written_letter': 'লিখিত চিঠি',
        'blocking_supply': 'সরবরাহ বন্ধ',
        'physical_assault': 'শারীরিক আক্রমণ',
        'vandalism_arson': 'ভাংচুর / অগ্নিসংযোগ',
        'abduction_hostage': 'অপহরণ / জিম্মি',
        'false_case_threat': 'মিথ্যা মামলার হুমকি',
    }
    threats = _bit_flags_to_list(extortion_impact, 'threat_is_', threat_map)
    if threats:
        items.append(_build_sidenote_item('info', '⚠️', 'হুমকির ধরন', ', '.join(threats)))

    # Consequences
    consequence_map = {
        'paid_full': 'পূর্ণ অর্থ প্রদান',
        'paid_partial': 'আংশিক প্রদান',
        'business_disrupted': 'ব্যবসা ক্ষতিগ্রস্ত',
        'physically_injured': 'শারীরিক আঘাত',
        'abducted_hostage': 'অপহৃত / জিম্মি',
        'shot_critically_injured': 'গুলিবিদ্ধ / গুরুতর আহত',
        'killed': 'নিহত',
        'false_case_filed': 'মিথ্যা মামলা',
        'property_vandalized': 'সম্পত্তি ভাংচুর',
        'none_yet': 'এখনো কিছু হয়নি',
    }
    consequences = _bit_flags_to_list(extortion_impact, 'consequence_is_', consequence_map)
    if consequences:
        items.append(_build_sidenote_item('status', '📋', 'পরিণতি', ', '.join(consequences)))

    # Legal status
    try:
        legal = ExtortionFormVictimLegalAction.objects.get(link_newshub_coll_news_entry_id=entry_id)
        fir_status = _resolve_status(legal.link_ref_status_law_gd_fir_status_id)
        if fir_status:
            items.append(_build_sidenote_item('legal', '⚖️', 'এফআইআর / জিডি', fir_status))
        if legal.gd_fir_case_gd_number:
            items.append(_build_sidenote_item('legal', '📝', 'মামলা নম্বর', legal.gd_fir_case_gd_number))
    except ExtortionFormVictimLegalAction.DoesNotExist:
        pass

    return items


# ========== Main builder ==========

# Map form_type group_code → sidenote builder function
_FORM_TYPE_BUILDERS = {
    'extortion': _extortion_sidenotes,
    # Phase 2: add more form types here
    # 'crime_violence': _crime_sidenotes,
    # 'land_grabbing': _land_grab_sidenotes,
    # 'price_hike_syndicate': _price_hike_sidenotes,
    # 'civic_community': _civic_sidenotes,
    # 'global_news': _global_news_sidenotes,
    # 'war_conflict': _war_conflict_sidenotes,
    # 'sports': _sports_sidenotes,
    # 'entertainment': _entertainment_sidenotes,
    # 'july_uprising_2024': _july_uprising_sidenotes,
    # 'women_child_violence': _wcv_sidenotes,
    # 'watchdog_bangladesh': _watchdog_sidenotes,
}


def build_sidenote_data(news_entry, form_type_code):
    """
    Build the sidenote data for an article view.
    Returns a list of dicts: [{type, icon, label, value}, ...]
    """
    items = []

    # Shared sidenotes (all form types)
    items.extend(_shared_sidenotes(news_entry))

    # Actor sidenotes (all form types)
    items.extend(_actor_sidenotes(news_entry.newshub_coll_news_entry_id))

    # Form-type-specific sidenotes
    builder = _FORM_TYPE_BUILDERS.get(form_type_code)
    if builder:
        items.extend(builder(news_entry.newshub_coll_news_entry_id))

    # Remove None items
    return [i for i in items if i is not None]


# ==========================================================================
# EDIT PRE-POPULATION — reconstruct form data from DB for edit mode
# ==========================================================================

def _bit_flags_to_ids(obj, bit_to_id_map):
    """Convert BIT flag fields to list of status_ids where flag is True."""
    ids = []
    for field_name, status_id in bit_to_id_map.items():
        if getattr(obj, field_name, False):
            ids.append(status_id)
    return ids


def _bit_flags_to_ids_by_code(obj, bit_to_code_map, group_code):
    """Convert BIT flag fields to list of status_ids via code lookup.

    Used for legal action fields where BIT columns map to status_codes (not direct IDs).
    Resolves codes → IDs from ref_status in one query.
    """
    active_codes = []
    for field_name, code in bit_to_code_map.items():
        if getattr(obj, field_name, False):
            active_codes.append(code)
    if not active_codes:
        return []
    # Bulk resolve codes → IDs (all codes stored lowercase in DB and maps)
    code_to_id = dict(
        RefStatus.objects.filter(
            group_code=group_code,
            status_code__in=active_codes,
            is_active=True,
        ).values_list('status_code', 'status_id')
    )
    return [code_to_id[c] for c in active_codes if c in code_to_id]


def _build_shared_edit_data(entry):
    """Build shared edit data from CollNewsEntry (steps 2-3, 9-11)."""
    from amolnama_news.site_apps.newshub.models import (
        Contributor, NewsEntryTag, NewsSocialMediaSource,
    )
    from amolnama_news.site_apps.multimedia.models import SocialUrlLibrary

    data = {}

    # Contributor (Step 2)
    contributor = {}
    if entry.link_contributor_id:
        try:
            c = Contributor.objects.get(newshub_contributor_id=entry.link_contributor_id)
            contributor = {
                'full_name_bn': c.contributor_full_name_bn or '',
                'type_id': c.link_contributor_type_id,
                'email': c.contributor_contact_email or '',
                'phone': c.contributor_contact_phone or '',
                'organization_bn': c.contributor_organization_bn or '',
            }
        except Contributor.DoesNotExist:
            pass
    data['contributor'] = contributor

    # News content (Step 3)
    data['news_entry'] = {
        'headline_bn': entry.news_headline_bn or '',
        'summary_bn': entry.news_summary_bn or '',
        'content_body_bn': entry.news_content_body_bn or '',
        'occurrence_at': entry.occurrence_at.strftime('%Y-%m-%dT%H:%M') if entry.occurrence_at else '',
    }

    # Location (Step 9)
    data['location'] = {
        'district_id': entry.link_district_id,
        'constituency_id': entry.link_constituency_id,
        'upazila_id': None,  # stored as upazila_city_corporation_name, not FK
        'upazila_city_corporation_name': entry.upazila_city_corporation_name or '',
        'union_parishad_id': entry.link_union_parishad_id,
        'ward_name': entry.link_ward_name or '',
        'village_moholla_name': entry.link_village_moholla_name or '',
        'latitude': str(entry.coll_news_entry_latitude) if entry.coll_news_entry_latitude else '',
        'longitude': str(entry.coll_news_entry_longitude) if entry.coll_news_entry_longitude else '',
        'formatted_address_bn': entry.map_formatted_address_bn or '',
        'full_address_bn': entry.full_address_bn or '',
    }

    # Social sources (Step 10) — bulk fetch to avoid N+1
    social_sources = []
    social_links = list(NewsSocialMediaSource.objects.filter(
        link_newshub_coll_news_entry_id=entry.newshub_coll_news_entry_id
    ).values_list('link_social_media_url_library_id', flat=True))
    if social_links:
        url_recs = {
            r.social_media_url_library_id: r
            for r in SocialUrlLibrary.objects.filter(social_media_url_library_id__in=social_links)
        }
        for url_id in social_links:
            url_rec = url_recs.get(url_id)
            if url_rec:
                social_sources.append({
                    'platformId': url_rec.link_social_media_platform_type_id,
                    'url': url_rec.social_url or '',
                    'embedCode': url_rec.social_embed_code or '',
                })
    data['social_sources'] = social_sources

    # Category & Tags (Step 11)
    data['category_id'] = entry.link_news_category_id
    tag_entries = NewsEntryTag.objects.filter(
        link_newshub_coll_news_entry_id=entry.newshub_coll_news_entry_id
    ).values_list('link_news_category_tag_id', flat=True)
    tag_ids = list(tag_entries)
    # Fetch tag names for JS chip rendering
    from amolnama_news.site_apps.newshub.models import RefNewsCategoryTag
    tags_with_names = []
    if tag_ids:
        for tag in RefNewsCategoryTag.objects.filter(news_category_tag_id__in=tag_ids):
            tags_with_names.append({
                'id': tag.news_category_tag_id,
                'name_bn': tag.news_tag_name_bn or '',
                'name_en': tag.news_tag_name_en or '',
            })
    data['tag_ids'] = tag_ids
    data['tags'] = tags_with_names
    data['is_breaking'] = bool(entry.is_breaking)

    return data


def _build_actor_edit_data(entry_id):
    """Build accused/victim/witness edit data from actor profiles + person table."""
    from amolnama_news.site_apps.user_account.models import Person

    actors = list(IncidentInvolvedActorProfile.objects.filter(
        link_newshub_coll_news_entry_id=entry_id
    ))

    # Bulk fetch all persons in one query
    person_ids = [a.link_person_id for a in actors if a.link_person_id]
    persons_map = {}
    if person_ids:
        persons_map = {
            p.person_id: p
            for p in Person.objects.filter(person_id__in=person_ids)
        }

    accused = []
    victims = []
    witnesses = []

    for actor in actors:
        role = (actor.incident_involved_actor_role_group_code or '').lower()

        # Get person from pre-fetched map
        first_name_en = ''
        last_name_en = ''
        first_name_bn = ''
        last_name_bn = ''
        alias = ''
        father_first_name = ''
        father_last_name = ''
        gender_id = 0
        religion_id = 0
        age = ''
        dob = ''
        district_id = 0
        person = persons_map.get(actor.link_person_id)
        if person:
            first_name_en = person.first_name_en or ''
            last_name_en = person.last_name_en or ''
            first_name_bn = person.first_name_bn or ''
            last_name_bn = person.last_name_bn or ''
            alias = person.name_alias_bn or person.name_alias_en or ''
            father_first_name = person.father_first_name_bn or ''
            father_last_name = person.father_last_name_bn or ''
            gender_id = person.link_gender_id or 0
            religion_id = person.link_religion_id or 0
            if person.date_of_birth:
                dob = person.date_of_birth.strftime('%Y-%m-%d')
            district_id = person.link_birth_district_id or 0

        actor_data = {
            'role': role.lower(),
            'involvementTypeId': actor.link_ref_status_incident_involved_actor_role_id,
            'actorTypeId': actor.link_ref_status_incident_involved_actor_type_id,
            'actorTypeDetail': actor.incident_involved_actor_type_details or '',
            'firstNameEn': first_name_en,
            'lastNameEn': last_name_en,
            'firstNameBn': first_name_bn,
            'lastNameBn': last_name_bn,
            'fatherFirstName': father_first_name,
            'fatherLastName': father_last_name,
            'genderId': gender_id,
            'religionId': religion_id,
            'age': age,
            'dob': dob,
            'districtId': district_id,
            'alias': alias,
            'designation': actor.actor_designation or '',
            'organization': actor.actor_organization_name or '',
            'patron': actor.actor_patron_name or '',
            'contact': '',
            'statement': actor.actor_statement or '',
        }

        if role == 'accused':
            accused.append(actor_data)
        elif role == 'victim':
            victims.append(actor_data)
        elif role == 'witness':
            witnesses.append(actor_data)

    return accused, victims, witnesses


def _build_extortion_edit_data(entry_id):
    """Build extortion-specific edit data (Steps 7 & 8)."""
    result = {}

    # Step 7 — Extortion incident details
    try:
        impact = ExtortionFormImpact.objects.get(link_newshub_coll_news_entry_id=entry_id)

        # Sector: exactly one BIT is True → find the status_id
        sector_id = None
        for field_name, sid in _EXTORTION_SECTOR_BIT_TO_ID.items():
            if getattr(impact, field_name, False):
                sector_id = sid
                break

        result['extortion_incident'] = {
            'sectorId': sector_id,
            'sectorOther': impact.sector_other_description or '',
            'transportLocation': impact.sector_transport_location_code or '',
            'garmentType': impact.sector_garment_extortion_type_code or '',
            'amountDemanded': float(impact.demand_amount_demanded_bdt) if impact.demand_amount_demanded_bdt else 0,
            'amountTaken': float(impact.demand_amount_collected_bdt) if impact.demand_amount_collected_bdt else 0,
            'frequencyId': impact.link_ref_status_extortion_form_extortion_demand_frequency_id or 0,
            'affiliationIds': _bit_flags_to_ids(impact, _EXTORTION_AFFILIATION_BIT_TO_ID),
            'partyName': impact.accused_political_party_org_name or '',
            'threatMethodIds': _bit_flags_to_ids(impact, _EXTORTION_THREAT_BIT_TO_ID),
            'consequenceIds': _bit_flags_to_ids(impact, _EXTORTION_CONSEQUENCE_BIT_TO_ID),
            'damageAmount': 0,  # consequence damage amount stored in separate field
            'damageDesc': impact.consequence_property_damage_description or '',
            'bangladeshContextIds': _bit_flags_to_ids(impact, _EXTORTION_CONTEXT_BIT_TO_ID),
            'remarks': impact.additional_remarks or '',
        }
    except ExtortionFormImpact.DoesNotExist:
        pass

    # Step 8 — Legal action
    try:
        legal = ExtortionFormVictimLegalAction.objects.get(link_newshub_coll_news_entry_id=entry_id)
        result['ext_legal'] = {
            'firStatusId': legal.link_ref_status_law_gd_fir_status_id,
            'policeStation': legal.gd_fir_location_display_title_en or '',
            'caseNumber': legal.gd_fir_case_gd_number or '',
            'policeRefusalStatement': legal.gd_fir_police_refusal_statement or '',
            'noFirReason': legal.gd_fir_reason_not_filing_and_plans or '',
            'applicableLawIds': _bit_flags_to_ids_by_code(
                legal, _EXTORTION_LAW_BIT_TO_CODE, 'extortion_form_law_applicable'
            ),
            'caseStatusId': legal.link_ref_status_law_case_status_id or 0,
            'supportServiceIds': _bit_flags_to_ids_by_code(
                legal, _EXTORTION_SUPPORT_BIT_TO_CODE, 'extortion_form_law_support_service'
            ),
            'retaliationIds': _bit_flags_to_ids_by_code(
                legal, _EXTORTION_RETALIATION_BIT_TO_CODE, 'common_victim_risk_threat_pressure_retaliation'
            ),
            'remarks': legal.legal_action_additional_remarks or '',
        }
    except ExtortionFormVictimLegalAction.DoesNotExist:
        pass

    return result


# Map form_type → edit data builder
_FORM_TYPE_EDIT_BUILDERS = {
    'extortion': _build_extortion_edit_data,
    # Phase 2: add more form types here
}


# =========================================================
# FORM TYPE → JS SCRIPTS MAPPING (code splitting)
# =========================================================

_JS_PREFIX = 'newshub/assets/js/components/'

# Common scripts needed by ALL form types
COMMON_FORM_SCRIPTS = [
    _JS_PREFIX + 'news-date-picker.js',
    _JS_PREFIX + 'news-quill-init.js',
    _JS_PREFIX + 'news-person-name.js',
    _JS_PREFIX + 'news-person-identity.js',
    _JS_PREFIX + 'news-person-party-details.js',
    _JS_PREFIX + 'news-searchable-dropdown.js',
    _JS_PREFIX + 'news-org-cascade.js',
    _JS_PREFIX + 'news-contributor-self.js',
    _JS_PREFIX + 'news-location-cascade.js',
    _JS_PREFIX + 'news-location-search.js',
    _JS_PREFIX + 'news-auto-location.js',
    _JS_PREFIX + 'news-category-tag-cascade.js',
    _JS_PREFIX + 'news-tag-search.js',
    _JS_PREFIX + 'news-auto-tag.js',
    _JS_PREFIX + 'news-geo-collect.js',
    _JS_PREFIX + 'news-map-pinpoint.js',
    _JS_PREFIX + 'news-map-reverse-geocode.js',
    _JS_PREFIX + 'news-map-search.js',
    _JS_PREFIX + 'news-map-location-autofill.js',
    _JS_PREFIX + 'news-occurrence-time.js',
    _JS_PREFIX + 'news-social-source-repeater.js',
    _JS_PREFIX + 'news-file-compressor.js',
    _JS_PREFIX + 'news-attachment-upload.js',
    _JS_PREFIX + 'news-char-count.js',
    _JS_PREFIX + 'news-form-validate.js',
    _JS_PREFIX + 'news-form-clear.js',
    _JS_PREFIX + 'news-form-persist.js',
    _JS_PREFIX + 'news-form-stepper.js',
]

# Shared script groups (reused by multiple form types)
_ACCUSED_SCRIPTS = [_JS_PREFIX + 'news-involved-parties.js', _JS_PREFIX + 'news-accused-repeater.js']
_VICTIM_SCRIPTS = [_JS_PREFIX + 'news-victim-repeater.js']
_WITNESS_SCRIPTS = [_JS_PREFIX + 'news-witness-repeater.js']
_LEGAL_COMMON = [_JS_PREFIX + 'news-thana-search-select.js', _JS_PREFIX + 'news-law-gd-fir.js']

# Form-type-specific scripts (only loaded for that form type)
FORM_TYPE_SPECIFIC_SCRIPTS = {
    'generic': [],

    'extortion': (
        _ACCUSED_SCRIPTS + _VICTIM_SCRIPTS + _WITNESS_SCRIPTS
        + [_JS_PREFIX + 'news-extortion-incident.js']
        + _LEGAL_COMMON + [_JS_PREFIX + 'news-extortion-legal.js']
    ),

    'crime_violence': (
        _ACCUSED_SCRIPTS + [_JS_PREFIX + 'news-victim-repeater.js']
        + _WITNESS_SCRIPTS
        + [_JS_PREFIX + 'news-crime-casualties.js', _JS_PREFIX + 'news-crime-weapons.js']
        + _LEGAL_COMMON + [_JS_PREFIX + 'news-crime-legal.js']
    ),

    'land_grabbing': (
        _ACCUSED_SCRIPTS + _VICTIM_SCRIPTS + _WITNESS_SCRIPTS
        + [_JS_PREFIX + 'news-land-grab-incident.js']
        + _LEGAL_COMMON + [_JS_PREFIX + 'news-land-grab-legal.js']
    ),

    'price_hike': (
        _ACCUSED_SCRIPTS + _VICTIM_SCRIPTS + _WITNESS_SCRIPTS
        + [_JS_PREFIX + 'news-price-hike-price-gap.js', _JS_PREFIX + 'news-price-hike-stockpiling.js']
    ),

    'watchdog_bangladesh': [
        _JS_PREFIX + 'news-watchdog-bangladesh-sub-type.js',
        _JS_PREFIX + 'news-watchdog-bangladesh-contradiction.js',
        _JS_PREFIX + 'news-watchdog-bangladesh-issue.js',
        _JS_PREFIX + 'news-watchdog-bangladesh-party-change.js',
        _JS_PREFIX + 'news-watchdog-bangladesh-proxy-puppet.js',
        _JS_PREFIX + 'news-watchdog-bangladesh-bootlicker.js',
        _JS_PREFIX + 'news-watchdog-bangladesh-women-fixer.js',
        _JS_PREFIX + 'news-watchdog-bangladesh-section-switcher.js',
        _JS_PREFIX + 'news-watchdog-bangladesh-context.js',
    ] + _ACCUSED_SCRIPTS,

    'civic_community': [
        _JS_PREFIX + 'news-civic-sub-type.js',
        _JS_PREFIX + 'news-civic-impact-duration.js',
        _JS_PREFIX + 'news-civic-current-status.js',
    ] + _ACCUSED_SCRIPTS + _VICTIM_SCRIPTS + _WITNESS_SCRIPTS,

    'war_conflict': [
        _JS_PREFIX + 'news-war-conflict-sub-type.js',
        _JS_PREFIX + 'news-war-conflict-parties.js',
        _JS_PREFIX + 'news-war-conflict-frontline.js',
        _JS_PREFIX + 'news-war-conflict-humanitarian.js',
        _JS_PREFIX + 'news-war-conflict-geopolitics.js',
    ],

    'global_news': [
        _JS_PREFIX + 'news-global-news-sub-type.js',
        _JS_PREFIX + 'news-global-news-countries.js',
        _JS_PREFIX + 'news-global-news-classification.js',
        _JS_PREFIX + 'news-global-news-bangladesh.js',
        _JS_PREFIX + 'news-global-news-reaction.js',
    ],

    'sports': [
        _JS_PREFIX + 'news-sports-sub-type.js',
        _JS_PREFIX + 'news-sports-match-event.js',
        _JS_PREFIX + 'news-sports-teams-result.js',
        _JS_PREFIX + 'news-sports-key-performances.js',
    ] + _ACCUSED_SCRIPTS,

    'entertainment': [
        _JS_PREFIX + 'news-entertainment-sub-type.js',
        _JS_PREFIX + 'news-entertainment-production.js',
        _JS_PREFIX + 'news-entertainment-cast-release.js',
        _JS_PREFIX + 'news-entertainment-performance.js',
    ] + _ACCUSED_SCRIPTS,

    'july_uprising_2024': [
        _JS_PREFIX + 'news-july-uprising-sub-type.js',
        _JS_PREFIX + 'news-july-uprising-context.js',
        _JS_PREFIX + 'news-july-martyr-home-location.js',
        _JS_PREFIX + 'news-july-martyr-home-location-search.js',
        _JS_PREFIX + 'news-july-uprising-martyr.js',
        _JS_PREFIX + 'news-july-uprising-story.js',
        _JS_PREFIX + 'news-july-uprising-cause.js',
        _JS_PREFIX + 'news-july-uprising-oppressors.js',
        _JS_PREFIX + 'news-july-uprising-evidence.js',
    ],

    'women_child_violence': [
        _JS_PREFIX + 'news-wcv-violence-type.js',
        _JS_PREFIX + 'news-wcv-victim.js',
        _JS_PREFIX + 'news-wcv-condition-injury.js',
        _JS_PREFIX + 'news-wcv-accused.js',
    ] + _WITNESS_SCRIPTS + _LEGAL_COMMON + [_JS_PREFIX + 'news-wcv-legal.js'],
}


def get_form_scripts(form_type_code):
    """Return the list of JS script paths for a given form type.
    Common scripts + form-type-specific scripts, no duplicates."""
    specific = FORM_TYPE_SPECIFIC_SCRIPTS.get(form_type_code, [])
    all_scripts = list(COMMON_FORM_SCRIPTS)
    for script in specific:
        if script not in all_scripts:
            all_scripts.append(script)
    return all_scripts


def build_edit_data(entry_id, form_type_code):
    """
    Reconstruct all form data from DB for edit pre-population.
    Returns a dict suitable for JSON serialization → client-side JS.
    """
    from amolnama_news.site_apps.newshub.models import CollNewsEntry

    entry = CollNewsEntry.objects.get(newshub_coll_news_entry_id=entry_id)

    # Shared data (all form types)
    data = _build_shared_edit_data(entry)

    # Actors (all form types)
    accused, victims, witnesses = _build_actor_edit_data(entry_id)
    data['accused'] = accused
    data['victims'] = victims
    data['witnesses'] = witnesses

    # Form-type-specific data
    builder = _FORM_TYPE_EDIT_BUILDERS.get(form_type_code)
    if builder:
        data.update(builder(entry_id))

    return data


# ========== SEO Slug Enrichment ==========

# Form type code → Bengali keyword for URL
_FORM_TYPE_SLUG_KEYWORD = {
    'extortion': 'chandabaji',
    'crime_violence': 'crime',
    'land_grabbing': 'land-grabbing',
    'price_hike_syndicate': 'price-hike',
    'watchdog_bangladesh': 'watchdog',
    'civic_community': 'civic',
    'global_news': 'global-news',
    'war_conflict': 'war-conflict',
    'sports': 'sports',
    'entertainment': 'entertainment',
    'july_uprising_2024': 'july-uprising',
    'women_child_violence': 'women-child-violence',
    'general_news': 'news',
}


def build_article_seo_slug(entry, form_type_code):
    """Build a keyword-rich SEO slug for a news article.

    Pattern: form_type-district-headline_keywords-year
    Example: chandabaji-sylhet-shahjalal-university-student-union-2026

    Args:
        entry: CollNewsEntry instance
        form_type_code: e.g. 'extortion', 'crime_violence'

    Returns:
        str: slug suitable for URL
    """
    from amolnama_news.site_apps.core.utils import bangla_slugify

    parts = []

    # 1. Form type keyword
    form_keyword = _FORM_TYPE_SLUG_KEYWORD.get(form_type_code, 'news')
    parts.append(form_keyword)

    # 2. District name (English for URL readability)
    if entry.link_district_id:
        try:
            from amolnama_news.site_apps.locations.models import District
            district = District.objects.only('district_name_en').get(
                district_id=entry.link_district_id
            )
            if district.district_name_en:
                parts.append(district.district_name_en.lower())
        except Exception as district_lookup_error:
            logger.error('District lookup for slug failed — %s', district_lookup_error)

    # 3. Headline keywords (first ~6 words from Bengali headline, transliterated)
    headline = entry.news_headline_bn or entry.news_headline_en or ""
    if headline:
        headline_slug = bangla_slugify(headline)
        # Take first ~80 chars to keep URL reasonable
        if len(headline_slug) > 80:
            headline_slug = headline_slug[:80].rsplit('-', 1)[0]
        parts.append(headline_slug)

    # 4. Year
    if getattr(entry, 'occurrence_at', None):
        parts.append(str(entry.occurrence_at.year))
    elif entry.created_at:
        parts.append(str(entry.created_at.year))

    slug = '-'.join(part for part in parts if part)
    return slug[:450] if slug else str(entry.newshub_coll_news_entry_id)


# ---------------------------------------------------------------------------
# Article photos — fetch file URLs via raw SQL (file_storage_path is computed)
# ---------------------------------------------------------------------------

def get_article_photos(newshub_coll_news_entry_id):
    """Fetch all photos for a news article, grouped by asset_group_code.

    Returns a dict:
        {
            'all': [photo_dict, ...],             — flat list, sorted by sort_order
            'cover_image_url': str or None,       — featured photo URL (or first photo)
            'groups': {                            — grouped by asset_group_code
                'evidence': [photo_dict, ...],
                'impact': [...],
                'accused': [...],
                ...
            }
        }

    Each photo_dict:
        {
            'link_asset_id': int,
            'file_url': str,                     — '/media/...' URL path
            'news_asset_caption_bn': str,
            'is_featured': bool,
            'asset_group_code': str or None,
            'view_count': int,
            'like_count': int,
            'sort_order': int,
            'file_mime_type': str,
        }
    """
    from django.db import connection

    sql = """
        SELECT [newshub].[news_asset].link_asset_id,
               [newshub].[news_asset].news_asset_caption_bn,
               [newshub].[news_asset].is_featured,
               [newshub].[news_asset].asset_group_code,
               [newshub].[news_asset].view_count,
               [newshub].[news_asset].like_count,
               [newshub].[news_asset].sort_order,
               '/media/' + [media].[asset].file_storage_path AS file_url,
               [media].[asset].file_mime_type
        FROM [newshub].[news_asset]
        JOIN [media].[asset] ON [media].[asset].asset_id = [newshub].[news_asset].link_asset_id
        WHERE [newshub].[news_asset].link_newshub_coll_news_entry_id = %s
          AND [media].[asset].is_active = 1
        ORDER BY [newshub].[news_asset].sort_order
    """

    with connection.cursor() as cursor:
        cursor.execute(sql, [newshub_coll_news_entry_id])
        columns = [col[0] for col in cursor.description]
        rows = cursor.fetchall()

    photos = [dict(zip(columns, row)) for row in rows]

    # Only include image files (not PDFs, docs, etc.)
    image_photos = [
        photo for photo in photos
        if photo.get('file_mime_type', '').startswith('image/')
    ]

    # Determine cover image URL
    cover_image_url = None
    for photo in image_photos:
        if photo.get('is_featured'):
            cover_image_url = photo['file_url']
            break
    if not cover_image_url and image_photos:
        cover_image_url = image_photos[0]['file_url']

    # Build photo_card dicts for shared template component
    for photo in image_photos:
        photo['photo_card'] = {
            'id': photo['link_asset_id'],
            'parent_id': newshub_coll_news_entry_id,
            'file_url': photo['file_url'],
            'caption': photo.get('news_asset_caption_bn') or None,
            'like_count': photo.get('like_count', 0),
            'view_count': photo.get('view_count', 0),
            'user_liked': photo.get('user_liked', False),
            'is_cover': bool(cover_image_url and cover_image_url == photo['file_url']),
        }

    # Group by asset_group_code
    groups = {}
    for photo in image_photos:
        group_code = photo.get('asset_group_code') or 'general'
        if group_code not in groups:
            groups[group_code] = []
        groups[group_code].append(photo)

    return {
        'all': image_photos,
        'cover_image_url': cover_image_url,
        'groups': groups,
    }


def get_article_cover_urls_bulk(newshub_coll_news_entry_ids):
    """Bulk fetch cover image URLs for multiple articles (for listing page).

    Returns dict: { newshub_coll_news_entry_id: file_url, ... }
    Uses is_featured=1 first, falls back to first photo (lowest sort_order).
    """
    if not newshub_coll_news_entry_ids:
        return {}

    from django.db import connection

    placeholders = ','.join(['%s'] * len(newshub_coll_news_entry_ids))
    sql = f"""
        SELECT [newshub].[news_asset].link_newshub_coll_news_entry_id,
               '/media/' + [media].[asset].file_storage_path AS file_url,
               [newshub].[news_asset].is_featured,
               [newshub].[news_asset].sort_order
        FROM [newshub].[news_asset]
        JOIN [media].[asset] ON [media].[asset].asset_id = [newshub].[news_asset].link_asset_id
        WHERE [newshub].[news_asset].link_newshub_coll_news_entry_id IN ({placeholders})
          AND [media].[asset].is_active = 1
          AND [media].[asset].file_mime_type LIKE 'image/%%'
        ORDER BY [newshub].[news_asset].link_newshub_coll_news_entry_id,
                 [newshub].[news_asset].is_featured DESC,
                 [newshub].[news_asset].sort_order
    """

    with connection.cursor() as cursor:
        cursor.execute(sql, list(newshub_coll_news_entry_ids))
        rows = cursor.fetchall()

    # Pick first row per entry (featured first due to ORDER BY)
    cover_map = {}
    for row in rows:
        entry_id = row[0]
        file_url = row[1]
        if entry_id not in cover_map:
            cover_map[entry_id] = file_url

    return cover_map
