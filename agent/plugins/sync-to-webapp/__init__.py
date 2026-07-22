"""Syncs AutoEstate WhatsApp/Telegram conversation turns to the reporting
webapp's ingestion API (POST /api/ingest).

Uses plugin hooks (pre_llm_call / post_llm_call), not gateway hooks -
gateway's agent:end event hardcodes response[:500] before handing it to
hooks (gateway/run.py), which silently truncates our multi-platform,
bilingual generated content. post_llm_call carries the full, untruncated
assistant_response.

Plugin-hook callbacks are invoked synchronously - hermes_cli/plugins.py's
invoke_hook() does `ret = cb(**kwargs)` with no await, so an `async def`
handler here would just create a coroutine that's never awaited (silently
discarded, confirmed via a live RuntimeWarning during testing - no request
ever sent, no error raised). Handlers below are plain functions; the actual
HTTP call runs on a background thread so a slow/hanging request never delays
the reply back to the customer.

pre_llm_call also fires for CLI sessions (platform="cli"), unlike gateway
hooks - the platform filter below excludes anything that isn't a real
messaging-platform conversation.

Grouping key is turn_id, not session_id: Hermes doesn't reset a WhatsApp/
Telegram session between messages (session_reset: mode: none), so one
session can span many unrelated listings sent back-to-back in the same
chat. Grouping by session_id silently merged them into one dashboard entry
in testing - turn_id (also passed to both hooks) gives one Run per turn
instead.
"""

import logging
import os
import threading
from datetime import datetime, timezone

import httpx

logger = logging.getLogger("plugins.sync-to-webapp")

INGESTION_URL = os.getenv("AUTOESTATE_INGESTION_URL")
INGESTION_SECRET = os.getenv("AUTOESTATE_INGESTION_SECRET")
SYNCED_PLATFORMS = {"whatsapp", "telegram"}


def _now_iso() -> str:
    # zod's z.string().datetime() requires a literal "Z" suffix, not "+00:00".
    return (
        datetime.now(timezone.utc)
        .isoformat(timespec="milliseconds")
        .replace("+00:00", "Z")
    )


def _post(payload: dict) -> None:
    try:
        resp = httpx.post(
            INGESTION_URL,
            headers={"Authorization": f"Bearer {INGESTION_SECRET}"},
            json=payload,
            timeout=5,
        )
        if resp.status_code >= 400:
            logger.warning(
                "sync-to-webapp: ingestion API returned %s: %s",
                resp.status_code,
                resp.text[:200],
            )
    except Exception as e:
        logger.warning("sync-to-webapp: failed to sync %s: %s", payload.get("event"), e)


def _post_in_background(payload: dict) -> None:
    threading.Thread(target=_post, args=(payload,), daemon=True).start()


def on_turn_started(session_id, turn_id, user_message, platform, **kwargs):
    # Return value is used by Hermes to inject context into the LLM call -
    # always return None here, never a string.
    if not (INGESTION_URL and INGESTION_SECRET) or platform not in SYNCED_PLATFORMS:
        return None
    _post_in_background({
        "event": "turn_started",
        "sessionId": session_id,
        "turnId": turn_id,
        "platform": platform,
        "userMessage": user_message,
        "occurredAt": _now_iso(),
    })
    return None


def on_turn_completed(session_id, turn_id, user_message, assistant_response, platform, **kwargs):
    if not (INGESTION_URL and INGESTION_SECRET) or platform not in SYNCED_PLATFORMS:
        return
    _post_in_background({
        "event": "turn_completed",
        "sessionId": session_id,
        "turnId": turn_id,
        "platform": platform,
        "userMessage": user_message,
        "assistantResponse": assistant_response,
        "occurredAt": _now_iso(),
    })


def register(ctx):
    ctx.register_hook("pre_llm_call", on_turn_started)
    ctx.register_hook("post_llm_call", on_turn_completed)
