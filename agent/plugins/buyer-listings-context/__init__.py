"""Injects the customer's listings (with status) into every buyer-facing
turn, so the buyer-inquiry skill answers a stranger's questions only from
real, current listing data — never from the model's own recall or guesswork.

This is the inbound cousin of active-listings-context. Two deliberate
differences from that plugin, both driven by the buyer-inquiry design:

  1. **Always-on, no keyword gate.** active-listings-context is keyword-gated
     because most operator turns (a brand-new listing) have nothing to look
     up, and a missed keyword there degrades softly. Here the opposite holds:
     a buyer's message is unpredictable free text ("still available?", "כמה
     זה עולה?", "the Dizengoff place?") with no reliable trigger vocabulary,
     and a turn WITHOUT this context is a correctness hazard — the skill
     would have nothing to answer from and could be tempted to recall or
     guess. So this fires on every buyer turn. The endpoint read is cheap and
     the buyer instance handles far less traffic than the operator one.

  2. **Includes status (ACTIVE / UNDER_CONTRACT / SOLD), not ACTIVE-only.**
     active-listings-context hits /api/listings/active (ACTIVE only) because
     the outbound skills only ever act on live listings. The buyer skill
     needs the opposite: it must be able to tell a buyer truthfully that a
     listing is already sold or under contract, so it needs the non-active
     rows too, each labeled with its status. It reads /api/listings/buyer-view
     (added in the reporting app for exactly this) which returns every status.

Like active-listings-context, this is a genuinely BLOCKING httpx.get whose
return value IS the injected context (pre_llm_call's contract — see
hermes_cli/plugins.py). Do not "fix" it into a background thread: a threaded
call can't return a value in time to be used as this turn's context, which
is the whole point. Any failure (endpoint down, timeout, network) swallows to
None — the skill then defers everything to the agent rather than risk a wrong
answer, so reporting-app downtime degrades to "the agent will follow up,"
never a broken or invented reply.
"""

import logging
import os

import httpx

logger = logging.getLogger("plugins.buyer-listings-context")

# Reused from sync-to-webapp's own env vars — no separate secret/URL to
# provision. BUYER_VIEW_URL is derived from INGESTION_URL (same pattern as
# active-listings-context), so enabling this plugin needs nothing new rolled
# out to a buyer instance beyond the env it already has.
INGESTION_URL = os.getenv("AUTOESTATE_INGESTION_URL")  # e.g. https://.../api/ingest
INGESTION_SECRET = os.getenv("AUTOESTATE_INGESTION_SECRET")
BUYER_VIEW_URL = (
    INGESTION_URL.replace("/api/ingest", "/api/listings/buyer-view")
    if INGESTION_URL and INGESTION_URL.endswith("/api/ingest")
    else None
)

# Buyer traffic only ever arrives over a real messaging channel. hermes -z
# (cli) sets neither platform, so this won't fire there — simulate the block
# manually in the prompt when testing the skill via the CLI.
BUYER_PLATFORMS = {"whatsapp", "telegram"}
TIMEOUT_SECONDS = 3

# Maps the reporting app's ListingStatus enum to the exact tokens the
# buyer-inquiry SKILL.md keys its status-honesty rules on. Keep in sync with
# both the Prisma enum and the skill's "Status honesty" section.
STATUS_LABELS = {
    "ACTIVE": "ACTIVE",
    "UNDER_CONTRACT": "UNDER_CONTRACT",
    "SOLD": "SOLD",
}

NO_LISTINGS_CONTEXT = (
    "Available listings (from the reporting system): none on record right now. "
    "You have NO listing data to answer from — do not confirm, describe, or "
    "price any property from memory or guesswork. Take the message as a lead "
    "and defer to the agent."
)


def inject_buyer_listings_context(session_id, turn_id, user_message, platform, **kwargs):
    if platform not in BUYER_PLATFORMS:
        return None
    if not (BUYER_VIEW_URL and INGESTION_SECRET):
        return None

    try:
        resp = httpx.get(
            BUYER_VIEW_URL,
            headers={"Authorization": f"Bearer {INGESTION_SECRET}"},
            timeout=TIMEOUT_SECONDS,
        )
        resp.raise_for_status()
        listings = resp.json().get("listings", [])
    except Exception as e:
        # Swallow: the skill defers everything when it has no context, which
        # is the safe failure mode. Never inject a partial/guessed block.
        logger.warning("buyer-listings-context: fetch failed, no context injected: %s", e)
        return None

    if not listings:
        return NO_LISTINGS_CONTEXT

    lines = [
        "Available listings (from the reporting system — answer ONLY from these; "
        "never call a SOLD or under-contract listing available; if a detail isn't "
        "here, do not invent it — defer to the agent):"
    ]
    for l in listings:
        price = f"₪{l['price']}" if l.get("price") is not None else "price N/A"
        floor = f"floor {l['floor']}" if l.get("floor") is not None else "floor N/A"
        status = STATUS_LABELS.get(l.get("status"), l.get("status") or "UNKNOWN")
        lines.append(
            f"- {l['area']}, {l['rooms']} rooms, {l['sqm']} sqm, {floor}, "
            f"{price} ({l['transactionType']}) — STATUS: {status}"
        )
    return "\n".join(lines)


def register(ctx):
    ctx.register_hook("pre_llm_call", inject_buyer_listings_context)
