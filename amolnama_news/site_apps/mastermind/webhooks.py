"""Mastermind webhooks — outbound HTTP POST when an event fires.

Lets staff plug Mastermind into Zapier, Make, Slack incoming webhooks,
Discord, n8n, custom services. Every dispatch:

  - Runs in a background thread (newsengine.run_background_task) so request
    threads are never blocked.
  - Carries an HMAC-SHA256 signature header (X-Mastermind-Signature) when a
    webhook_secret is registered, so receivers can verify authenticity.
  - Records last_dispatch_at + status + response_code into the subscription
    row so admins see at-a-glance health.
  - Soft-fails on every error — never raises.

Public API:
  fire_event(event_code, payload_dict)
  list_supported_event_codes()  -> list of event codes
"""
import hashlib
import hmac
import json
import logging

from django.utils import timezone


logger = logging.getLogger(__name__)


SUPPORTED_EVENT_CODES = (
    'quiz_session_completed',
    'quiz_session_passed',
    'quiz_session_failed',
    'ai_generation_completed',
    'quiz_creator_permission_granted',
    'proctoring_violation_logged',
    'lobby_started',
    'lobby_completed',
)

DISPATCH_TIMEOUT_SECONDS = 8


def list_supported_event_codes():
    """Return the canonical list of event codes admins can subscribe to."""
    return list(SUPPORTED_EVENT_CODES)


def fire_event(event_code, payload_dict):
    """Trigger every active subscription for this event_code.

    Caller does not block — dispatch happens on a background thread.
    Soft-fails: never raises.
    """
    if not event_code:
        return
    if event_code not in SUPPORTED_EVENT_CODES:
        logger.warning('Mastermind webhook fire ignored — unknown event_code: %s', event_code)
        return

    try:
        from .models import CollWebhookSubscription
        active_subscriptions = list(
            CollWebhookSubscription.objects
            .filter(webhook_event_code=event_code, is_active=True)
            .values(
                'mastermind_coll_webhook_subscription_id',
                'webhook_target_url',
                'webhook_secret',
                'webhook_label',
            )
        )
    except Exception:
        logger.exception('Mastermind webhook lookup failed for event %s', event_code)
        return

    if not active_subscriptions:
        return

    # Stable envelope around the user-supplied payload — receivers parse this shape.
    envelope = {
        'event_code': event_code,
        'fired_at': timezone.now().isoformat(),
        'payload': payload_dict or {},
    }

    try:
        from amolnama_news.site_apps.newsengine.utils import run_background_task
        for subscription in active_subscriptions:
            run_background_task(_dispatch_to_one_subscription, subscription, envelope)
    except Exception:
        logger.exception('Mastermind webhook background dispatch enqueue failed')
        for subscription in active_subscriptions:
            try:
                _dispatch_to_one_subscription(subscription, envelope)
            except Exception:
                logger.exception('Inline dispatch fallback also failed')


def _dispatch_to_one_subscription(subscription, envelope):
    """Send one POST. Update the subscription row with the outcome."""
    subscription_id = subscription['mastermind_coll_webhook_subscription_id']
    target_url = subscription['webhook_target_url']
    webhook_secret = subscription.get('webhook_secret')

    body_bytes = json.dumps(envelope, ensure_ascii=False).encode('utf-8')
    request_headers = {
        'Content-Type': 'application/json; charset=utf-8',
        'User-Agent': 'AmolnamaMastermind/1.0',
        'X-Mastermind-Event': envelope['event_code'],
    }
    if webhook_secret:
        signature_hex = hmac.new(
            webhook_secret.encode('utf-8'), body_bytes, hashlib.sha256,
        ).hexdigest()
        request_headers['X-Mastermind-Signature'] = f'sha256={signature_hex}'

    response_code = None
    error_message = None
    try:
        import urllib.request
        import urllib.error
        request = urllib.request.Request(
            url=target_url, data=body_bytes, headers=request_headers, method='POST',
        )
        with urllib.request.urlopen(request, timeout=DISPATCH_TIMEOUT_SECONDS) as response:
            response_code = response.status
    except urllib.error.HTTPError as http_error:
        response_code = getattr(http_error, 'code', None)
        error_message = f'HTTP {response_code}: {str(http_error.reason)[:400]}'
    except Exception as dispatch_error:
        error_message = str(dispatch_error)[:400]

    is_success = response_code is not None and 200 <= response_code < 300
    _record_dispatch_outcome(
        subscription_id=subscription_id,
        is_success=is_success,
        response_code=response_code,
        error_message=error_message,
    )


def _record_dispatch_outcome(subscription_id, is_success, response_code, error_message):
    """Update the subscription row with the latest dispatch outcome."""
    try:
        from django.db.models import F
        from .models import CollWebhookSubscription
        update_kwargs = {
            'last_dispatch_at': timezone.now(),
            'last_dispatch_status_code': 'success' if is_success else 'failure',
            'last_dispatch_response_code': response_code,
            'last_dispatch_error_message': error_message,
            'updated_at': timezone.now(),
        }
        if is_success:
            update_kwargs['dispatch_success_count'] = F('dispatch_success_count') + 1
        else:
            update_kwargs['dispatch_failure_count'] = F('dispatch_failure_count') + 1

        CollWebhookSubscription.objects.filter(
            mastermind_coll_webhook_subscription_id=subscription_id,
        ).update(**update_kwargs)
    except Exception:
        logger.exception('Mastermind webhook outcome record failed for subscription %s', subscription_id)
