from django.db.models import Q
from django.http import JsonResponse

from .models import Commodity


def api_commodity_search(request):
    """Search commodities by name (BN or EN) or group name.
    Used by price hike form Tom Select dropdown."""
    q = request.GET.get('q', '').strip()

    qs = Commodity.objects.filter(is_active=True)
    if q:
        qs = qs.filter(
            Q(commodity_name_bn__icontains=q)
            | Q(commodity_name_en__icontains=q)
            | Q(commodity_group_name_bn__icontains=q),
        )
    qs = qs.order_by('commodity_group_code', 'sort_order', 'commodity_name_bn')[:20]

    data = []
    for c in qs:
        data.append({
            'id': c.commodity_id,
            'name_bn': c.commodity_name_bn or '',
            'name_en': c.commodity_name_en or '',
            'group_bn': c.commodity_group_name_bn or '',
            'variant_bn': c.commodity_variant_bn or '',
            'unit': c.commodity_unit or '',
        })

    return JsonResponse({'commodities': data})
