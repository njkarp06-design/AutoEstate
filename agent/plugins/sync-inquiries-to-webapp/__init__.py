"""Syncs the buyer instance's WhatsApp/Telegram conversation turns to the
reporting webapp's inquiry ingestion API (POST /api/inquiries).

The inbound twin of sync-to-webapp: same plugin-hook mechanism
(pre_llm_call -> turn_started, post_llm_call -> turn_completed), same
background-threaded httpx.post so a slow request never delays the buyer's
reply, same platform gate excluding CLI. The differences:

  - Posts to /api/inquiries (derived from AUTOESTATE_INGESTION_URL), not
    /api/ingest. No new env var - reuses the same ingestion secret, which
    resolves to the same Customer.
  - Resolves and attaches the buyer's identity best-effort (see
    _resolve_lead below): a `sender` handle and a human-reachable
    `buyerContact`. Capturing a reachable lead is the #1 value of this
    feature, so we try - but degrade cleanly to None (the endpoint keeps the
    thread on session id and the dashboard shows "contact not captured").

Sender resolution is now settled, not tentative. The Phase-0c live Telegram
spike ran (2026-07-25) and the first real buyer conversation (2026-07-26)
confirmed exactly which kwargs the hooks pass - see _resolve_lead. Phase-0b
had already established that platform metadata never carries a dialable
number on either WhatsApp (a LID) or Telegram (a numeric user id), which is
why the buyer-inquiry skill asks for one and why the contact is extracted
from the buyer's own message text.
"""

import logging
import os
import re
import threading
import time
from datetime import datetime, timezone

import httpx

logger = logging.getLogger("plugins.sync-inquiries-to-webapp")

INGESTION_URL = os.getenv("AUTOESTATE_INGESTION_URL")  # e.g. https://.../api/ingest
INGESTION_SECRET = os.getenv("AUTOESTATE_INGESTION_SECRET")
INQUIRIES_URL = (
    INGESTION_URL.replace("/api/ingest", "/api/inquiries")
    if INGESTION_URL and INGESTION_URL.endswith("/api/ingest")
    else None
)

SYNCED_PLATFORMS = {"whatsapp", "telegram"}

# See sync-to-webapp for the full rationale; same policy, same reason. A
# dropped buyer turn loses the lead itself, which is the one thing this
# feature exists to capture.
RETRY_DELAYS_SECONDS = (1, 4)  # 3 attempts total

# Emitted once so a real buyer turn's actual identity kwargs stay visible in
# the log - this is how the wrong-kwarg-name bug below was found.
_logged_kwargs_once = False

# A dialable-looking phone (Israeli or international).
#
# The separator class is [ \t-] and NOT \s: \s matches newlines, so a message
# listing short numbers on consecutive lines ("4\n95\n3\n3950000") would be
# spliced into one 11-digit run and captured as a phone number - defeating the
# digit-count guard below using the very separator it relies on.
_PHONE_RE = re.compile(r"\+?\d[\d \t\-]{7,}\d")


def _now_iso() -> str:
    # zod's z.string().datetime() requires a literal "Z" suffix, not "+00:00".
    return (
        datetime.now(timezone.utc)
        .isoformat(timespec="milliseconds")
        .replace("+00:00", "Z")
    )


def _extract_phone(text: str | None) -> str | None:
    """A dialable number the buyer typed, or None.

    THIS is where a real contact comes from. Phase-0b established that platform
    metadata never carries a dialable number on either WhatsApp (a LID) or
    Telegram (a numeric user id), which is exactly why the buyer-inquiry skill
    ASKS for one when it defers. The buyer then types it into a message - so
    the message text is the only place it ever exists.

    Digit-count is the discriminator, not the regex shape alone: strip the
    separators and require 9-15 digits. That accepts "052-4419087" (10) and
    "+972 52 441 9087" (12) while rejecting the things that otherwise look
    phone-ish in this domain - a date like "2026-07-26" is 8 digits, a price
    like "3950000" is 7, a size or floor is far shorter. Rejecting a real
    number is recoverable (the agent calls the buyer back off the transcript);
    storing a listing price as someone's phone number is not.
    """
    if not text:
        return None
    for match in _PHONE_RE.finditer(str(text)):
        raw = match.group(0)
        digits = re.sub(r"\D", "", raw)
        if 9 <= len(digits) <= 15:
            return raw.strip()
    return None


def _resolve_lead(kwargs: dict, user_message: str | None = None) -> tuple[str | None, str | None]:
    """(sender_handle, buyer_contact). sender_handle is a stable opaque id;
    buyer_contact is a dialable number the buyer typed into their message.
    Both default to None, never a guess.

    The hooks pass exactly these kwargs, confirmed by logging them on a real
    buyer turn rather than assumed:
        conversation_history, is_first_turn, model, sender_id, task_id,
        telemetry_schema_version

    An earlier version read `sender`/`user_id`/`chat_id`/`display_name`/`phone`
    - none of which exist - so every lead silently recorded a null sender AND a
    null contact, including one where the buyer had actually given a number.
    Those lookups are gone rather than kept "just in case": each was dead, and
    together they made the code read as though a display-name fallback existed
    when it never could. If a future adapter does start carrying a name or a
    number, add it here deliberately, having checked the log line above.
    """
    global _logged_kwargs_once
    if not _logged_kwargs_once:
        logger.info("sync-inquiries: hook kwargs keys = %s", sorted(kwargs.keys()))
        _logged_kwargs_once = True

    sender = kwargs.get("sender_id")

    # The buyer's own message text is the ONLY place a dialable number ever
    # exists (Phase-0b: platform metadata carries a LID or a numeric user id on
    # both channels, never a phone), which is exactly why the skill asks.
    contact = _extract_phone(user_message)

    return (str(sender) if sender is not None else None, contact)


def _post(payload: dict) -> None:
    for attempt, delay in enumerate((*RETRY_DELAYS_SECONDS, None), start=1):
        try:
            resp = httpx.post(
                INQUIRIES_URL,
                headers={"Authorization": f"Bearer {INGESTION_SECRET}"},
                json=payload,
                timeout=5,
            )
            # 4xx is our own bug (bad payload, bad secret) - retrying cannot
            # help. Only 5xx and transport errors are worth another attempt.
            if resp.status_code < 500:
                if resp.status_code >= 400:
                    logger.warning(
                        "sync-inquiries: API returned %s, not retrying: %s",
                        resp.status_code,
                        resp.text[:200],
                    )
                return
            last_error = f"HTTP {resp.status_code}: {resp.text[:200]}"
        except Exception as e:
            last_error = str(e)

        if delay is None:
            logger.warning(
                "sync-inquiries: failed to sync %s after %s attempts, giving up: %s",
                payload.get("event"),
                attempt,
                last_error,
            )
            return
        logger.info(
            "sync-inquiries: sync of %s failed (%s), retrying in %ss",
            payload.get("event"),
            last_error,
            delay,
        )
        time.sleep(delay)


def _post_in_background(payload: dict) -> None:
    threading.Thread(target=_post, args=(payload,), daemon=True).start()


def on_turn_started(session_id, turn_id, user_message, platform, **kwargs):
    # Return value is used by Hermes to inject context - always return None.
    if not (INQUIRIES_URL and INGESTION_SECRET) or platform not in SYNCED_PLATFORMS:
        return None
    sender, buyer_contact = _resolve_lead(kwargs, user_message)
    _post_in_background({
        "event": "turn_started",
        "sessionId": session_id,
        "turnId": turn_id,
        "platform": platform,
        "userMessage": user_message,
        "sender": sender,
        "buyerContact": buyer_contact,
        "occurredAt": _now_iso(),
    })
    return None


def on_turn_completed(session_id, turn_id, user_message, assistant_response, platform, **kwargs):
    if not (INQUIRIES_URL and INGESTION_SECRET) or platform not in SYNCED_PLATFORMS:
        return
    sender, buyer_contact = _resolve_lead(kwargs, user_message)
    _post_in_background({
        "event": "turn_completed",
        "sessionId": session_id,
        "turnId": turn_id,
        "platform": platform,
        "userMessage": user_message,
        "assistantResponse": assistant_response,
        "sender": sender,
        "buyerContact": buyer_contact,
        "occurredAt": _now_iso(),
    })


def register(ctx):
    ctx.register_hook("pre_llm_call", on_turn_started)
    ctx.register_hook("post_llm_call", on_turn_completed)
