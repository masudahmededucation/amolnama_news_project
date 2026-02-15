import json
import logging
from collections import defaultdict
from urllib.parse import urlencode

from django.contrib.auth.decorators import login_required
from django.db import transaction
from django.db.models import Count, Max
from django.http import JsonResponse
from django.shortcuts import render
from django.utils import timezone
from django.views.decorators.http import require_POST

from amolnama_news.site_apps.evaluation_vote.models import AppGetPartyDetails  # used by home()
from amolnama_news.site_apps.locations.models import District, Division

from .models import (
    AppGetCurrentElection,
    AppGetPastResults,
    DigitalBallot,
    DigitalBallotRegistryBook,
    DigitalBallotVoteEntry,
)
from .services import (
    compute_identity_anchor_hash,
    generate_receipt_code,
    get_client_ip,
    validate_pre_cast,
)

logger = logging.getLogger(__name__)


# ========== Pages ==========

def home(request):
    current_elections = AppGetCurrentElection.objects.all()
    divisions = Division.objects.filter(is_active=True).order_by('division_name_en')
    parties = AppGetPartyDetails.objects.all().order_by('party_name_bn')

    past_elections = AppGetPastResults.objects.values(
        'election_evaluation_id', 'evaluation_name_bn'
    ).distinct().order_by('evaluation_name_bn')

    return render(request, 'election_vote/pages/home.html', {
        'current_elections': current_elections,
        'divisions': divisions,
        'parties': parties,
        'past_elections': past_elections,
    })


# ========== APIs ==========

@login_required
def check_eligibility(request, election_evaluation_id):
    """GET: Check if current user is eligible to vote in this election."""
    _, errors = validate_pre_cast(request, election_evaluation_id)

    if errors:
        return JsonResponse({"eligible": False, "error": " ".join(errors)})
    return JsonResponse({"eligible": True})


def api_national_results(request, election_evaluation_id):
    """GET: Return national-level party results as JSON for progress bars.
    Real-time aggregation from transaction tables so results appear immediately.
    """
    # Get ballot IDs for this election
    ballot_ids = DigitalBallot.objects.filter(
        link_election_evaluation_id=election_evaluation_id,
        is_active=True,
    ).values_list('digital_ballot_id', flat=True)

    # Count votes per party
    vote_counts = list(
        DigitalBallotVoteEntry.objects.filter(
            link_digital_ballot_id__in=ballot_ids,
            is_active=True,
        ).values('link_party_id').annotate(
            votes=Count('digital_ballot_vote_entry_id')
        ).order_by('-votes')
    )

    if not vote_counts:
        return JsonResponse({'results': [], 'total_votes': 0})

    # Get party details (names + logos)
    party_ids = [vc['link_party_id'] for vc in vote_counts]
    party_map = {}
    for p in AppGetPartyDetails.objects.filter(party_id__in=party_ids):
        party_map[p.party_id] = {
            'party_name': p.party_name_bn or '',
            'party_short_name': p.party_symbol_name_bn or '',
            'file_path': p.file_path or '',
            'file_name': p.file_name or '',
        }

    results = []
    for vc in vote_counts:
        info = party_map.get(vc['link_party_id'], {})
        results.append({
            'party_name': info.get('party_name', ''),
            'party_short_name': info.get('party_short_name', ''),
            'file_path': info.get('file_path', ''),
            'file_name': info.get('file_name', ''),
            'votes': vc['votes'],
        })

    total_votes = _calculate_percentages(results)

    return JsonResponse({
        'results': results,
        'total_votes': total_votes,
    })


@login_required
@require_POST
def cast_vote(request):
    """POST: Cast a vote in the election."""
    try:
        data = json.loads(request.body)
    except (json.JSONDecodeError, ValueError):
        return JsonResponse(
            {"success": False, "error": "Invalid JSON."}, status=400
        )

    election_evaluation_id = data.get("election_evaluation_id")
    election_id = data.get("election_id")
    constituency_id = data.get("constituency_id")
    party_id = data.get("party_id")
    candidate_id = data.get("candidate_id")
    union_parishad_id = data.get("union_parishad_id")
    bot_detection = data.get("bot_detection", {})

    if not all([election_evaluation_id, election_id, constituency_id, party_id]):
        return JsonResponse(
            {"success": False, "error": "Missing required fields."},
            status=400,
        )

    # Step 1: Pre-cast validation
    profile, errors = validate_pre_cast(request, election_evaluation_id)
    if errors:
        return JsonResponse(
            {"success": False, "error": " ".join(errors)},
            status=403,
        )

    # Steps 2-3: Transactional ballot creation
    try:
        now = timezone.now()
        ip_address = get_client_ip(request)
        receipt_code = generate_receipt_code()

        identity_hash = compute_identity_anchor_hash(
            request.user.user_auth_provider_key
        )

        with transaction.atomic():
            # Insert registry book entry (burns the voter's token)
            registry = DigitalBallotRegistryBook.objects.create(
                link_election_evaluation_id=election_evaluation_id,
                link_user_profile_id=profile.user_profile_id,
                hash_identity_anchor_binary=identity_hash,
                mobile_sim_slot_number=0,
                created_at=now,
                modified_at=now,
            )

            # Insert ballot (timestamp NULL initially)
            ballot = DigitalBallot.objects.create(
                link_digital_ballot_registry_book_id=registry.digital_ballot_registry_book_id,
                link_election_id=election_id,
                link_election_evaluation_id=election_evaluation_id,
                ballot_voter_audit_receipt_code=receipt_code,
                ballot_cast_timestamp=None,
                geofencing_ip_address=ip_address,
                is_active=True,
                created_at=now,
                modified_at=now,
            )

            # Insert vote entry
            DigitalBallotVoteEntry.objects.create(
                link_digital_ballot_id=ballot.digital_ballot_id,
                link_constituency_id=constituency_id,
                link_union_parishad_id=union_parishad_id,
                link_party_id=party_id,
                link_candidate_id=candidate_id,
                is_active=True,
                created_at=now,
                modified_at=now,
            )

            # Harden ballot — set cast timestamp and bot-detection metrics
            ballot.ballot_cast_timestamp = now
            ballot.botdetection_vote_duration_ms = bot_detection.get("vote_duration_ms")
            ballot.botdetection_interaction_count = bot_detection.get("interaction_count")
            ballot.botdetection_question_avg = bot_detection.get("question_avg")
            ballot.modified_at = now
            ballot.save(update_fields=[
                "ballot_cast_timestamp",
                "botdetection_vote_duration_ms",
                "botdetection_interaction_count",
                "botdetection_question_avg",
                "modified_at",
            ])

        # Step 4: Return receipt
        return JsonResponse({
            "success": True,
            "receipt_code": receipt_code,
        })

    except Exception as e:
        logger.exception("cast_vote: transaction failed")
        return JsonResponse(
            {"success": False, "error": "Vote submission failed. Please try again."},
            status=500,
        )


# ========== Drill-Through Past Results ==========

def _build_party_entry(row):
    """Normalize a .values() row into the party dict expected by templates."""
    return {
        'party_name': row.get('party_name_bn', ''),
        'party_short_name': row.get('party_symbol_name_bn', '') or '',
        'file_path': row.get('file_path', '') or '',
        'file_name': row.get('file_name', '') or '',
        'votes': row.get('votes', 0) or 0,
    }


def _calculate_percentages(parties_list):
    """Add 'percentage' to each party. Returns total votes."""
    total = sum(p['votes'] for p in parties_list)
    for p in parties_list:
        p['percentage'] = (p['votes'] / total * 100) if total > 0 else 0
    return total


def _group_by_location(queryset, group_id, group_name, vote_field, extra_fields=None):
    """Group pre-aggregated view rows by a location level using Max()."""
    values_fields = [group_id, group_name, 'party_id', 'party_name_bn', 'party_symbol_name_bn', 'file_path', 'file_name']
    if extra_fields:
        values_fields += extra_fields

    rows = queryset.values(*values_fields).annotate(
        votes=Max(vote_field)
    ).order_by(group_name, '-votes')

    location_data = defaultdict(lambda: {'parties': []})
    for row in rows:
        name = row[group_name]
        location_data[name][group_name] = name
        location_data[name][group_id] = row[group_id]
        if extra_fields:
            for f in extra_fields:
                location_data[name][f] = row.get(f, '') or ''
        location_data[name]['parties'].append(_build_party_entry(row))

    for data in location_data.values():
        data['total_votes'] = _calculate_percentages(data['parties'])

    return list(location_data.values())


def _build_national_results(queryset, evaluation_name, request_path):
    """Level 1: National party totals."""
    rows = queryset.values(
        'party_id', 'party_name_bn', 'party_symbol_name_bn', 'file_path', 'file_name'
    ).annotate(votes=Max('national_party_vote')).order_by('-votes')

    results = [_build_party_entry(r) for r in rows]
    total_votes = _calculate_percentages(results)

    breadcrumb = [{'name': evaluation_name, 'url': None}]
    return results, 'national', breadcrumb, total_votes


def _build_division_results(queryset, evaluation_name, request_path):
    """Level 2: Results grouped by division."""
    groups = _group_by_location(queryset, 'division_id', 'division_name_bn', 'division_party_vote')
    results = []
    for g in groups:
        results.append({
            'heading': g['division_name_bn'],
            'total_votes': g['total_votes'],
            'parties': g['parties'],
            'drilldown_url': f"{request_path}?division_id={g['division_id']}",
            'drilldown_text': 'জেলা পর্যায়ে দেখুন (View District Level)',
        })

    breadcrumb = [
        {'name': evaluation_name, 'url': request_path},
        {'name': 'বিভাগ (Divisions)', 'url': None},
    ]
    return results, 'division', breadcrumb


def _build_district_results(queryset, evaluation_name, request_path, division_id):
    """Level 3: Results grouped by district within a division."""
    qs = queryset.filter(division_id=division_id)
    division_name_bn = qs.values_list('division_name_bn', flat=True).first() or ''
    division_name_en = Division.objects.filter(division_id=division_id).values_list('division_name_en', flat=True).first() or ''
    division_label = f"{division_name_bn} ({division_name_en})" if division_name_en else division_name_bn

    groups = _group_by_location(qs, 'district_id', 'district_name_bn', 'district_party_vote')
    results = []
    for g in groups:
        results.append({
            'heading': g['district_name_bn'],
            'total_votes': g['total_votes'],
            'parties': g['parties'],
            'drilldown_url': f"{request_path}?{urlencode({'division_id': division_id, 'district_id': g['district_id']})}",
            'drilldown_text': 'আসন পর্যায়ে দেখুন (View Constituency Level)',
        })

    breadcrumb = [
        {'name': evaluation_name, 'url': request_path},
        {'name': 'বিভাগ (Divisions)', 'url': f"{request_path}?view=divisions"},
        {'name': division_label, 'url': None},
    ]
    return results, 'district', breadcrumb


def _build_constituency_results(queryset, evaluation_name, request_path, division_id, district_id):
    """Level 4: Results grouped by constituency within a district."""
    qs = queryset.filter(division_id=division_id, district_id=district_id)
    division_name_bn = qs.values_list('division_name_bn', flat=True).first() or ''
    district_name_bn = qs.values_list('district_name_bn', flat=True).first() or ''
    division_name_en = Division.objects.filter(division_id=division_id).values_list('division_name_en', flat=True).first() or ''
    district_name_en = District.objects.filter(district_id=district_id).values_list('district_name_en', flat=True).first() or ''
    division_label = f"{division_name_bn} ({division_name_en})" if division_name_en else division_name_bn
    district_label = f"{district_name_bn} ({district_name_en})" if district_name_en else district_name_bn

    groups = _group_by_location(
        qs, 'constituency_id', 'constituency_name_bn', 'seat_party_vote',
        extra_fields=['seat_number_bn']
    )
    results = []
    for g in groups:
        heading = g['constituency_name_bn']
        if g.get('seat_number_bn'):
            heading = f"{g['seat_number_bn']} — {heading}"
        results.append({
            'heading': heading,
            'total_votes': g['total_votes'],
            'parties': g['parties'],
        })

    breadcrumb = [
        {'name': evaluation_name, 'url': request_path},
        {'name': 'বিভাগ (Divisions)', 'url': f"{request_path}?view=divisions"},
        {'name': division_label, 'url': f"{request_path}?{urlencode({'division_id': division_id})}"},
        {'name': district_label, 'url': None},
    ]
    return results, 'constituency', breadcrumb


def _determine_back_url(request_path, drill_level, division_id=None):
    """Calculate the back navigation URL based on current drill level."""
    if drill_level == 'division':
        return request_path
    elif drill_level == 'district':
        return f"{request_path}?view=divisions"
    elif drill_level == 'constituency':
        return f"{request_path}?{urlencode({'division_id': division_id})}"
    return None


def past_results_drillthrough(request, election_evaluation_id):
    """Dispatcher: location-based drill-through report for election results."""
    view_level = request.GET.get('view')
    division_id = request.GET.get('division_id')
    district_id = request.GET.get('district_id')

    if division_id:
        division_id = int(division_id)
    if district_id:
        district_id = int(district_id)

    queryset = AppGetPastResults.objects.filter(
        election_evaluation_id=election_evaluation_id
    )
    first_record = queryset.values('evaluation_name_bn').first()
    evaluation_name = first_record['evaluation_name_bn'] if first_record else f"Election {election_evaluation_id}"

    total_votes = None

    if view_level == 'divisions':
        results, drill_level, breadcrumb = _build_division_results(
            queryset, evaluation_name, request.path)
    elif division_id and district_id:
        results, drill_level, breadcrumb = _build_constituency_results(
            queryset, evaluation_name, request.path, division_id, district_id)
    elif division_id:
        results, drill_level, breadcrumb = _build_district_results(
            queryset, evaluation_name, request.path, division_id)
    else:
        results, drill_level, breadcrumb, total_votes = _build_national_results(
            queryset, evaluation_name, request.path)

    back_url = _determine_back_url(request.path, drill_level, division_id)

    past_elections = AppGetPastResults.objects.values(
        'election_evaluation_id', 'evaluation_name_bn'
    ).distinct().order_by('evaluation_name_bn')

    context = {
        'evaluation_name': evaluation_name,
        'results': results,
        'drill_level': drill_level,
        'breadcrumb': breadcrumb,
        'back_url': back_url,
        'total_votes': total_votes,
        'past_elections': past_elections,
    }
    return render(request, 'election_vote/pages/past-results-drillthrough.html', context)
