"""Messenger views — WhatsApp-style chat page."""

from django.contrib.auth.decorators import login_required
from django.shortcuts import render


@login_required
def home(request):
    """Messenger home — two-panel layout (conversation list + chat view)."""
    conversation_id = request.GET.get('conversation', '')
    start_with_user_profile_id = request.GET.get('start', '')

    from amolnama_news.site_apps.core.utils import get_user_profile_id
    current_user_profile_id = get_user_profile_id(request) or ''

    return render(request, 'messenger/pages/messenger-home.html', {
        'initial_conversation_id': conversation_id,
        'start_with_user_profile_id': start_with_user_profile_id,
        'current_user_profile_id': current_user_profile_id,
        'seo': {
            'title': 'মেসেঞ্জার — আমলনামা নিউজ',
            'description': 'ব্যক্তিগত বার্তা পাঠান ও গ্রহণ করুন।',
        },
    })
