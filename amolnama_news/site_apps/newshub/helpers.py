"""
newshub/helpers.py — Article view helper functions.

build_sidenote_data(news_entry) returns a list of sidenote items for the
two-column article view. Each item is a dict:
  { 'type': 'date|place|person|amount|legal|status|info',
    'icon': emoji,
    'label': display label,
    'value': display value }

Form-type-specific functions extract structured data from investigation tables.
"""

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

    # Location
    addr_parts = []
    if entry.upazila_city_corporation_name:
        addr_parts.append(entry.upazila_city_corporation_name)
    if entry.full_address_bn:
        addr_parts.append(entry.full_address_bn)
    elif entry.map_formatted_address_bn:
        addr_parts.append(entry.map_formatted_address_bn)
    if addr_parts:
        items.append(_build_sidenote_item('place', '📍', 'অবস্থান', ', '.join(addr_parts)))

    # Breaking news
    if entry.is_breaking:
        items.append(_build_sidenote_item('status', '🔴', 'ব্রেকিং', 'ব্রেকিং নিউজ'))

    return items


def _actor_sidenotes(entry_id):
    """Sidenotes from involved actors (accused, victims, witnesses)."""
    items = []
    actors = IncidentInvolvedActorProfile.objects.filter(
        link_coll_news_entry_id=entry_id
    ).select_related()

    accused_names = []
    victim_names = []
    witness_names = []

    for actor in actors:
        role = (actor.incident_involved_actor_role_group_code or '').upper()
        name = actor.actor_organization_name or ''
        if actor.link_person_id:
            # Try to get person name from person table
            try:
                from amolnama_news.site_apps.person.models import Person
                person = Person.objects.get(person_id=actor.link_person_id)
                name = f"{person.first_name_bn or ''} {person.last_name_bn or ''}".strip()
                if not name:
                    name = f"{person.first_name_en or ''} {person.last_name_en or ''}".strip()
            except Exception:
                pass

        if not name:
            continue

        if role == 'ACCUSED':
            accused_names.append(name)
        elif role == 'VICTIM':
            victim_names.append(name)
        elif role == 'WITNESS':
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
        extortion_impact = ExtortionFormImpact.objects.get(link_coll_news_entry_id=entry_id)
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
        legal = ExtortionFormVictimLegalAction.objects.get(link_coll_news_entry_id=entry_id)
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
    items.extend(_actor_sidenotes(news_entry.coll_news_entry_id))

    # Form-type-specific sidenotes
    builder = _FORM_TYPE_BUILDERS.get(form_type_code)
    if builder:
        items.extend(builder(news_entry.coll_news_entry_id))

    # Remove None items
    return [i for i in items if i is not None]
