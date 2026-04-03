"""Social views — home, user lists."""

from django.contrib.auth.decorators import login_required
from django.shortcuts import render


def home(request):
    return render(request, 'core/base.html')


@login_required
def lists_page(request):
    """User's lists — create, manage, view list members."""
    from amolnama_news.site_apps.user_account.models import UserProfile
    from .models import UserList

    try:
        current_profile = UserProfile.objects.get(link_user_account_user_id=request.user.pk)
    except UserProfile.DoesNotExist:
        return render(request, 'social/pages/social-lists.html', {'lists': [], 'seo': {'noindex': True}})

    user_lists = UserList.objects.filter(
        link_owner_user_profile_id=current_profile.user_profile_id, is_active=True,
    ).order_by('-created_at')

    list_items = []
    for user_list in user_lists:
        from .models import UserListMember
        member_count = UserListMember.objects.filter(
            link_list_id=user_list.social_user_list_id, is_active=True,
        ).count()
        list_items.append({
            'list_id': user_list.social_user_list_id,
            'list_name': user_list.list_name,
            'list_description': user_list.list_description or '',
            'member_count': member_count,
        })

    return render(request, 'social/pages/social-lists.html', {
        'lists': list_items,
        'seo': {'title': 'তালিকা — আমলনামা নিউজ', 'noindex': True, 'breadcrumbs': [{'name': 'হোম', 'url': '/'}, {'name': 'সামাজিক', 'url': '/social/'}, {'name': 'তালিকা'}]},
    })
