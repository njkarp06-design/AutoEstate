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

Why sender resolution is defensive/tentative here: per Phase-0b, sender
identity is NOT reliably passed to plugin hooks, and the live Telegram spike
(Phase-0c) that would confirm exactly what IS available hasn't run yet. So
this reads whatever the hook kwargs happen to carry and logs the kwarg keys
once at debug, which is exactly what the spike needs to see. When the spike
confirms the real source (kwargs vs. a read-only state.db sessions read),
tighten _resolve_lead accordingly.
"""

import logging
import os
import re
import threading
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

# Emitted once so the Phase-0c spike can see exactly which identity fields the
# hook kwargs actually carry on a real buyer turn.
_logged_kwargs_once = False

# A dialable-looking phone (Israeli or international). Used only to prefer a
# real number over a display name when picking buyerContact.
_PHONE_RE = re.compile(r"\+?\d[\d\s\-]{7,}\d")


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
    """Best-effort (sender_handle, buyer_contact). sender_handle is a stable
    opaque id; buyer_contact is the most human-reachable value we can find -
    a number the buyer typed, else a display name. Both default to None, never
    a guess.

    The kwarg names here are the ones the hook ACTUALLY passes, confirmed from
    a real buyer turn's log line rather than assumed:
        conversation_history, is_first_turn, model, sender_id, task_id,
        telemetry_schema_version
    An earlier version read `sender`/`user_id`/`chat_id`/`display_name`/`phone`,
    none of which exist, so every lead silently recorded a null sender AND a
    null contact - including one where the buyer had actually given a number.
    """
    global _logged_kwargs_once
    if not _logged_kwargs_once:
        logger.info("sync-inquiries: hook kwargs keys = %s", sorted(kwargs.keys()))
        _logged_kwargs_once = True

    sender = (
        kwargs.get("sender_id")
        or kwargs.get("sender")
        or kwargs.get("user_id")
        or kwargs.get("chat_id")
        or None
    )
    display_name = kwargs.get("display_name") or kwargs.get("name") or None

    # A number the buyer typed beats anything else; fall back to a display name
    # (a name with no number is still worth showing the operator), then to the
    # metadata fields in case a future adapter does carry one.
    contact = _extract_phone(user_message)
    if contact is None:
        for candidate in (kwargs.get("phone"), kwargs.get("sender")):
            if candidate and _extract_phone(str(candidate)):
                contact = str(candidate)
                break
    if contact is None:
        contact = display_name

    return (str(sender) if sender is not None else None, contact)


def _post(payload: dict) -> None:
    try:
        resp = httpx.post(
            INQUIRIES_URL,
            headers={"Authorization": f"Bearer {INGESTION_SECRET}"},
            json=payload,
            timeout=5,
        )
        if resp.status_code >= 400:
            logger.warning(
                "sync-inquiries: API returned %s: %s",
                resp.status_code,
                resp.text[:200],
            )
    except Exception as e:
        logger.warning("sync-inquiries: failed to sync %s: %s", payload.get("event"), e)


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
