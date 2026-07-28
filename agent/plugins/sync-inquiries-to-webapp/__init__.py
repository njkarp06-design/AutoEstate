"""Syncs the buyer instance's WhatsApp/Telegram conversation turns to the
reporting webapp's inquiry ingestion API (POST /api/inquiries).

The inbound twin of sync-to-webapp: same plugin-hook mechanism
(pre_llm_call -> turn_started, post_llm_call -> turn_completed), same
background-threaded httpx.post so a slow request never delays the buyer's
reply, same platform gate excluding CLI. The differences:

  - Posts to /api/inquiries (derived from AUTOESTATE_INGESTION_URL), not
    /api/ingest. Same env var NAMES as sync-to-webapp, but NOT the same
    secret VALUE: since the credential split, a buyer instance holds its own
    per-customer secret, valid only on /api/inquiries and
    /api/listings/buyer-view and rejected with 401 by /api/ingest. Never
    copy the operator instance's secret here to save a provisioning step -
    that rebuilds exactly the exposure the split removed (this box is
    public, and the operator secret can flip a property to SOLD). See
    reporting-app/lib/ingest-auth.ts and the profile's .env.example.
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

# Say so out loud. A URL that is set but doesn't end in /api/ingest (a trailing
# slash is enough) leaves INQUIRIES_URL None, and every hook below then returns
# early - no sync, no lead, and previously not one line anywhere explaining it.
# Silent self-disablement on a misconfiguration is this project's most expensive
# recurring failure shape; it produced both the footer-omission bug and the
# null-buyerContact bug.
if INGESTION_URL and not INQUIRIES_URL:
    logger.warning(
        "sync-inquiries: AUTOESTATE_INGESTION_URL=%r does not end in '/api/ingest', "
        "so the inquiries endpoint cannot be derived - THIS PLUGIN IS INERT and no "
        "buyer lead will be recorded.",
        INGESTION_URL,
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

# ...but excluding newlines only fixed half of it. The SAME splice happens on a
# single line: "4 95 3 3950000" (rooms, sqm, floor, price - an entirely
# ordinary thing to find in this domain) is 11 digits and passed the count
# guard cleanly. So group shape is checked too: in a multi-group match every
# separator-delimited group must carry at least 2 digits, and there are at most
# 5 groups. Real numbers survive - "052-4419087", "+972 52 441 9087",
# "050 123 4567", a bare "0524419087" - while any run containing a lone digit
# is rejected. Verified against every real buyer message recorded in the live
# buyer profile's state.db: identical decisions to the previous version on all
# of them, including the one genuine captured contact.
_MAX_PHONE_GROUPS = 5
_MIN_DIGITS_PER_GROUP = 2


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

    Two discriminators, because neither is sufficient alone:

    1. Digit count - strip separators, require 9-15. Rejects a date
       ("2026-07-26", 8), a price ("3950000", 7), a size or a floor.
    2. Group shape - in a multi-group match, every separator-delimited group
       must carry at least 2 digits, and there may be at most 5 groups. This
       is what rejects "4 95 3 3950000" (rooms/sqm/floor/price on one line),
       which is 11 digits and sails through the count check.

    Rejecting a real number is recoverable - the agent calls the buyer back
    off the transcript, which is right there. Storing a listing price as
    someone's phone number is not.
    """
    if not text:
        return None
    for match in _PHONE_RE.finditer(str(text)):
        raw = match.group(0).strip()
        digits = re.sub(r"\D", "", raw)
        if not (9 <= len(digits) <= 15):
            continue

        groups = [re.sub(r"\D", "", g) for g in re.split(r"[ \t\-]+", raw) if g]
        if len(groups) > 1:
            if len(groups) > _MAX_PHONE_GROUPS:
                continue
            if any(len(g) < _MIN_DIGITS_PER_GROUP for g in groups):
                continue

        return raw
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
    # Explicit None, matching on_turn_started - see sync-to-webapp for why.
    if not (INQUIRIES_URL and INGESTION_SECRET) or platform not in SYNCED_PLATFORMS:
        return None
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
