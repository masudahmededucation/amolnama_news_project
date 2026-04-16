"""Quizadmin input validation.

Called from views_api.py. Returns a tuple (is_valid, payload_or_error_message).
"""
import json


def validate_question_action_payload(request_body):
    """Validate the JSON body of approve/reject/skip endpoints.

    Expected shape: {"question_id": int, "reason_code"?: str}
    """
    try:
        data = json.loads(request_body or b'{}')
    except json.JSONDecodeError:
        return (False, 'Invalid JSON body.')

    if not isinstance(data, dict):
        return (False, 'JSON root must be an object.')

    question_id = data.get('question_id')
    if not isinstance(question_id, int) or question_id <= 0:
        return (False, 'question_id must be a positive integer.')

    reason_code = data.get('reason_code')
    if reason_code is not None and not isinstance(reason_code, str):
        return (False, 'reason_code must be a string if provided.')

    return (True, {'question_id': question_id, 'reason_code': reason_code})
