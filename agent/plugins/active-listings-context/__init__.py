"""Fetches the customer's currently-active listings from the reporting
webapp (GET /api/listings/active) and injects them as LLM context, for the
weekly-digest skill to draft a roundup without the agent retyping anything.

Uses a pre_llm_call hook, like sync-to-webapp - but unlike sync-to-webapp,
which always returns None (its return value is never used), this hook's
return value IS the injected context (see hermes_cli/plugins.py's
invoke_hook contract for pre_llm_call).

Keyword-gated, not every-turn: fetching on every ordinary listing-to-social/
listing-status-update turn would couple its latency/reliability to the
webapp's uptime for a context payload that's irrelevant except on digest
requests. The two failure directions aren't symmetric, so the keyword list
below is deliberately biased broad: if this regex fires but Hermes's own
skill-routing doesn't pick weekly-digest, the fetched context is just
unused (harmless). If routing picks weekly-digest but this regex didn't
fire, the skill gets no context and, per its own "say so plainly" rule,
incorrectly tells the agent there are no active listings when there are - a
wrong answer, not a graceful fallback. Keep this phrase list in sync with
weekly-digest/SKILL.md's own `description` field (whatever drives Hermes's
real routing decision), and validate the two agree across a range of
natural phrasings via `hermes -z` rather than treating this list as final.

This call is a genuinely BLOCKING httpx.get (unlike sync-to-webapp's
background-threaded POSTs) - acceptable specifically because the keyword
gate makes it rare and the timeout is short. Do not "fix" this into a
background thread: a threaded call can't return a value in time to be used
as pre_llm_call's injected context, which is the entire point of this hook.
"""

import logging
import os
import re

import httpx

logger = logging.getLogger("plugins.active-listings-context")

# Reused from sync-to-webapp's own env vars - no separate secret/URL to
# provision. LISTINGS_URL is derived from INGESTION_URL rather than reading
# a new env var, so there's nothing new to roll out to a customer instance
# beyond enabling this plugin.
INGESTION_URL = os.getenv("AUTOESTATE_INGESTION_URL")  # e.g. https://.../api/ingest
INGESTION_SECRET = os.getenv("AUTOESTATE_INGESTION_SECRET")
LISTINGS_URL = (
    INGESTION_URL.replace("/api/ingest", "/api/listings/active")
    if INGESTION_URL and INGESTION_URL.endswith("/api/ingest")
    else None
)

SYNCED_PLATFORMS = {"whatsapp", "telegram"}
TIMEOUT_SECONDS = 3

# Deliberately broad - see module docstring on why false positives (unused
# context) are far cheaper than false negatives (a wrong "no listings"
# reply). Keep in sync with weekly-digest/SKILL.md's `description` field.
DIGEST_KEYWORDS = re.compile(
    r"digest|roundup|round-up|round up|still active|still on the market|"
    r"what'?s active|what'?s still|weekly update|summary|"
    r"סיכום|עדכון שבועי|מה עוד פעיל|מה נשאר",
    re.IGNORECASE,
)


def inject_active_listings_context(session_id, turn_id, user_message, platform, **kwargs):
    if platform not in SYNCED_PLATFORMS:
        return None
    if not (LISTINGS_URL and INGESTION_SECRET):
        return None
    if not user_message or not DIGEST_KEYWORDS.search(user_message):
        return None

    try:
        resp = httpx.get(
            LISTINGS_URL,
            headers={"Authorization": f"Bearer {INGESTION_SECRET}"},
            timeout=TIMEOUT_SECONDS,
        )
        resp.raise_for_status()
        listings = resp.json().get("listings", [])
    except Exception as e:
        logger.warning("active-listings-context: fetch failed, no context injected: %s", e)
        return None

    if not listings:
        return "Active listings context: no currently active listings on record."

    lines = ["Active listings context (from reporting system - use ONLY these, never invent others):"]
    for l in listings:
        price = f"₪{l['price']}" if l.get("price") is not None else "price N/A"
        lines.append(f"- {l['area']}, {l['rooms']} rooms, {l['sqm']} sqm, {price} ({l['transactionType']})")
    return "\n".join(lines)


def register(ctx):
    ctx.register_hook("pre_llm_call", inject_active_listings_context)
