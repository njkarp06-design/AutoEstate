"""Fetches the customer's currently-active listings from the reporting
webapp (GET /api/listings/active) and injects them as LLM context. Used by
four skills: weekly-digest (a roundup of everything active), and - as of
the listing-lookup-by-locator feature - listing-reengagement,
listing-status-update, and just-sold, so an agent can say "the Dizengoff
place sold" instead of retyping every fact, with the skill matching the
named locator against this injected list rather than trusting the model's
own conversation memory (a real, verified backend record is a categorically
different trust level than recall - see each consuming skill's own
Required Input section for exactly how it's used and disambiguated).

Uses a pre_llm_call hook, like sync-to-webapp - but unlike sync-to-webapp,
which always returns None (its return value is never used), this hook's
return value IS the injected context (see hermes_cli/plugins.py's
invoke_hook contract for pre_llm_call).

Keyword-gated, not every-turn: fetching on every ordinary listing-to-social
turn (a brand-new listing, nothing to look up) would couple its
latency/reliability to the webapp's uptime for a context payload that's
never useful there. The two failure directions aren't symmetric in the same
way for every consumer, though:
  - For weekly-digest: a missed keyword means the skill gets no context and,
    per its own "say so plainly" rule, incorrectly tells the agent there are
    no active listings when there are - a wrong answer, not a graceful
    fallback.
  - For the three locator-lookup skills: a missed keyword just means no
    context gets injected, and the skill falls back to its original,
    already-shipped "ask the agent to restate every fact" behavior - a
    softer degradation, not a wrong answer.
Given that, the keyword list below stays deliberately biased broad across
all four skills' trigger vocabulary: a false positive (context fetched but
unused, e.g. a listing-to-social message that happens to contain "reduced"
in a feature description) is free either way. Keep this phrase list roughly
in sync with each consuming skill's own `description` field (whatever
drives Hermes's real routing decision), and validate via `hermes -z` rather
than treating this list as final.

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

# The fields a row must carry to be describable. A row missing any of them is
# skipped rather than rendered with a hole in it - weekly-digest reproduces
# this block verbatim, so a half-described listing becomes a half-described
# post.
REQUIRED_FIELDS = ("area", "rooms", "sqm", "transactionType")

NO_LISTINGS_CONTEXT = "Active listings context: no currently active listings on record."

# Deliberately broad across all four consuming skills' vocabulary - see
# module docstring on the asymmetric cost of a false positive (free) vs.
# false negative (wrong answer for weekly-digest; softer fallback for the
# three locator-lookup skills). Keep roughly in sync with each skill's own
# `description` field.
LISTING_LOOKUP_KEYWORDS = re.compile(
    # weekly-digest
    r"digest|roundup|round-up|round up|still active|still on the market|"
    r"what'?s active|what'?s still|weekly update|summary|"
    # listing-reengagement (incl. "it's been a few weeks", one of that skill's
    # own documented trigger phrases, which this gate was missing)
    r"re-?post|remind (?:people|them|buyers)|hasn'?t sold|re-?promote|"
    r"still available|been a (?:few|couple of) weeks|"
    # listing-status-update
    r"price drop|reduced|lowered the price|under contract|"
    # just-sold
    r"\bsold\b|closed on|"
    # Hebrew, spanning all four
    r"סיכום|עדכון שבועי|מה עוד פעיל|מה נשאר|"
    r"עדיין זמינה|תזכיר|תפרסם שוב|ירד במחיר|בהליכי מכירה|נמכר",
    re.IGNORECASE,
)


def inject_active_listings_context(session_id, turn_id, user_message, platform, **kwargs):
    if platform not in SYNCED_PLATFORMS:
        return None
    if not (LISTINGS_URL and INGESTION_SECRET):
        return None
    if not user_message or not LISTING_LOOKUP_KEYWORDS.search(user_message):
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
        return NO_LISTINGS_CONTEXT

    # Formatting is inside a try and every field is read with .get(): an
    # unexpected response shape must degrade to "no context injected", never
    # raise out of the hook. This block previously indexed
    # area/rooms/sqm/transactionType directly and sat outside any try, so one
    # missing key would have propagated a KeyError out of pre_llm_call.
    try:
        lines = ["Active listings context (from reporting system - use ONLY these, never invent others):"]
        for listing in listings:
            if not isinstance(listing, dict) or any(
                listing.get(f) is None for f in REQUIRED_FIELDS
            ):
                logger.warning(
                    "active-listings-context: skipping malformed listing row (missing %s)",
                    REQUIRED_FIELDS,
                )
                continue
            price = f"₪{listing['price']}" if listing.get("price") is not None else "price N/A"
            floor = f"floor {listing['floor']}" if listing.get("floor") is not None else "floor N/A"
            lines.append(
                f"- {listing['area']}, {listing['rooms']} rooms, {listing['sqm']} sqm, "
                f"{floor}, {price} ({listing['transactionType']})"
            )
    except Exception as e:
        logger.warning("active-listings-context: could not format listings, no context injected: %s", e)
        return None

    # Every row was malformed - say so plainly rather than emit a bare header,
    # which weekly-digest would read as "here are the listings" and find none.
    if len(lines) == 1:
        return NO_LISTINGS_CONTEXT

    return "\n".join(lines)


def register(ctx):
    ctx.register_hook("pre_llm_call", inject_active_listings_context)
