"""
OTP generation and verification helpers.

Dev mode: OTP is printed to the console.
Swap `send_otp` for a real SMS gateway (Twilio, AWS SNS, etc.) in production.
"""
import logging
import secrets
import time

logger = logging.getLogger(__name__)

OTP_LENGTH = 6
OTP_EXPIRY_SECONDS = 300  # 5 minutes


def generate_otp() -> str:
    """Return a random numeric OTP of OTP_LENGTH digits."""
    return "".join(str(secrets.randbelow(10)) for _ in range(OTP_LENGTH))


def send_otp(phone: str, code: str) -> None:
    """Send OTP to the given phone number (console-only for dev)."""
    logger.info("[OTP] Code for %s: %s", phone, code)
    print(f"\n{'='*40}")
    print(f"  [OTP] Code for {phone}: {code}")
    print(f"{'='*40}\n")


def store_otp_in_session(session, phone: str, code: str) -> None:
    """Persist OTP data in the Django session."""
    session["otp_phone"] = phone
    session["otp_code"] = code
    session["otp_created_at"] = time.time()


def verify_otp_from_session(session, submitted_code: str) -> tuple[bool, str]:
    """
    Check the submitted OTP against the session.
    Returns (success: bool, error_message: str).
    """
    stored_code = session.get("otp_code")
    created_at = session.get("otp_created_at")

    if not stored_code or not created_at:
        return False, "No OTP was requested. Please start again."

    if time.time() - created_at > OTP_EXPIRY_SECONDS:
        return False, "OTP has expired. Please request a new one."

    if submitted_code != stored_code:
        return False, "Incorrect OTP. Please try again."

    return True, ""


def clear_otp_from_session(session) -> None:
    """Remove OTP data from session after successful verification."""
    for key in ("otp_code", "otp_created_at"):
        session.pop(key, None)


# ── Password-reset OTP helpers ─────────────────────────────────────
# Use separate session keys (reset_*) so a reset flow never collides
# with an in-progress signup OTP flow.

def send_otp_email(email: str, code: str) -> None:
    """Send OTP to the given email address (console-only for dev)."""
    logger.info("[OTP-EMAIL] Code for %s: %s", email, code)
    print(f"\n{'='*40}")
    print(f"  [OTP-EMAIL] Code for {email}: {code}")
    print(f"{'='*40}\n")


def store_reset_otp(session, identifier: str, code: str) -> None:
    """Persist password-reset OTP data in the Django session."""
    session["reset_otp_code"] = code
    session["reset_otp_created_at"] = time.time()
    session["reset_identifier"] = identifier


def verify_reset_otp(session, submitted_code: str) -> tuple[bool, str]:
    """Check the submitted OTP against the reset session data."""
    stored_code = session.get("reset_otp_code")
    created_at = session.get("reset_otp_created_at")

    if not stored_code or not created_at:
        return False, "No OTP was requested. Please start again."

    if time.time() - created_at > OTP_EXPIRY_SECONDS:
        return False, "OTP has expired. Please request a new one."

    if submitted_code != stored_code:
        return False, "Incorrect OTP. Please try again."

    return True, ""


def clear_reset_otp(session) -> None:
    """Remove all password-reset keys from the session."""
    for key in ("reset_otp_code", "reset_otp_created_at",
                "reset_identifier", "reset_user_pk", "reset_verified"):
        session.pop(key, None)
