"""
Reusable data helpers for location-based drilldown reports.
These functions can be imported by any app (e.g., election_vote) that needs
the same drilldown report logic.
"""
from collections import defaultdict
from django.db.models import Sum


def build_party_entry(row):
    """
    Normalize a queryset values() row into a standard party data dict.
    Ensures consistent keys across all drill levels.
    """
    return {
        'party_name': row.get('party_name_symbol', ''),
        'party_short_name': row.get('party_short_name_bn') or row.get('party_name_symbol', ''),
        'party_symbol': row.get('party_symbol_name_bn', '') or '',
        'file_path': row.get('file_path', '') or '',
        'file_name': row.get('file_name', '') or '',
        'votes': row.get('votes', 0) or 0,
    }


def calculate_party_percentages(parties_list):
    """
    Add 'percentage' to each party dict based on votes.
    Returns total_votes for the group.
    """
    total = sum(p['votes'] for p in parties_list)
    for party in parties_list:
        party['percentage'] = (party['votes'] / total * 100) if total > 0 else 0
    return total


def group_results_by_location(queryset, group_id_field, group_name_field,
                               party_fields, extra_fields=None):
    """
    Group queryset by a location level, aggregate votes per party.

    Args:
        queryset: filtered queryset
        group_id_field: e.g., 'division_id'
        group_name_field: e.g., 'division_name_bn'
        party_fields: list of party-related field names to include in values()
        extra_fields: optional additional fields (e.g., ['constituency_area_list_bn'])

    Returns: list of dicts, each with location info, parties list, and total_votes
    """
    values_fields = [group_id_field, group_name_field] + party_fields
    if extra_fields:
        values_fields += extra_fields

    annotated = queryset.values(*values_fields).annotate(
        votes=Sum('party_seat_vote')
    ).order_by(group_name_field, '-votes')

    location_data = defaultdict(lambda: {'parties': []})

    for row in annotated:
        location_name = row[group_name_field]
        location_data[location_name][group_name_field] = location_name
        location_data[location_name][group_id_field] = row[group_id_field]

        if extra_fields:
            for field in extra_fields:
                location_data[location_name][field] = row.get(field, '') or ''

        location_data[location_name]['parties'].append(build_party_entry(row))

    # Calculate percentages for each location group
    for location_name, data in location_data.items():
        data['total_votes'] = calculate_party_percentages(data['parties'])

    return list(location_data.values())
