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


def _resolve_lead(kwargs: dict) -> tuple[str | None, str | None]:
    """Best-effort (sender_handle, buyer_contact) from whatever the hook
    kwargs carry. sender_handle is a stable opaque id; buyer_contact is the
    most human-reachable value we can find (prefer a phone, else a display
    name). Both default to None - never guess."""
    global _logged_kwargs_once
    if not _logged_kwargs_once:
        logger.info("sync-inquiries: hook kwargs keys = %s", sorted(kwargs.keys()))
        _logged_kwargs_once = True

    sender = (
        kwargs.get("sender")
        or kwargs.get("user_id")
        or kwargs.get("chat_id")
        or None
    )
    display_name = kwargs.get("display_name") or kwargs.get("name") or None

    # Prefer an actual dialable number if any resolved field looks like one.
    contact = None
    for candidate in (kwargs.get("phone"), kwargs.get("sender"), display_name):
        if candidate and _PHONE_RE.search(str(candidate)):
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
    sender, buyer_contact = _resolve_lead(kwargs)
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
    sender, buyer_contact = _resolve_lead(kwargs)
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
