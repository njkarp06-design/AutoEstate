"""Fetches the customer's non-sold listings from the reporting webapp
(GET /api/listings/active) and injects them as LLM context. Used by four
skills: weekly-digest (a roundup of everything on the market), and - as of
the listing-lookup-by-locator feature - listing-reengagement,
listing-status-update, and just-sold, so an agent can say "the Dizengoff
place sold" instead of retyping every fact, with the skill matching the
named locator against this injected list rather than trusting the model's
own conversation memory (a real, verified backend record is a categorically
different trust level than recall - see each consuming skill's own
Required Input section for exactly how it's used and disambiguated).

TWO STATUSES ARRIVE HERE, NOT ONE (since 2026-07-31). The endpoint returns
ACTIVE *and* UNDER_CONTRACT, because an under-contract listing being
invisible meant the canonical "under contract, then sold" sequence told the
agent its own listing was not on record. Every row is tagged (see
_status_tag) and the injected header states the rule, because the two are
NOT interchangeable: weekly-digest and listing-reengagement may use ACTIVE
rows only - a roundup of what is available must not advertise a property
that is spoken for, and you do not re-promote one either - while
listing-status-update and just-sold may match either. Each SKILL.md carries
its own half of that split; this plugin only reports the truth and labels
it. SOLD is excluded upstream and never appears here.

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

# Say so out loud. A URL that is set but doesn't end in /api/ingest (a trailing
# slash is enough) leaves LISTINGS_URL None, and the hook below then returns
# early on every turn - no injected context, so weekly-digest reports "no active
# listings" when there are some, and every locator lookup degrades to asking the
# agent to retype everything. Previously not one line anywhere explained it.
if INGESTION_URL and not LISTINGS_URL:
    logger.warning(
        "active-listings-context: AUTOESTATE_INGESTION_URL=%r does not end in "
        "'/api/ingest', so the listings endpoint cannot be derived - THIS PLUGIN IS "
        "INERT and no listing context will ever be injected.",
        INGESTION_URL,
    )

# "whatsapp" is the Baileys bridge; "whatsapp_cloud" is the official Meta Cloud
# API, which Hermes ships a separate adapter for and which registers under that
# DISTINCT name. Listed ahead of any migration on purpose: this set cannot be
# shared with the other plugins (each is a standalone copy inside a profile's
# plugins/ dir), so a missing entry would silently no-op this plugin on a Cloud
# instance rather than fail visibly.
SYNCED_PLATFORMS = {"whatsapp", "whatsapp_cloud", "telegram"}

# Was 3, which was measurably too tight and cost a real turn on 2026-07-29.
# The reporting app's /api/listings/active answers in ~0.5-0.7s warm but
# 3.0-3.2s cold (first request after an idle period: dev-server recompile plus
# a cold Neon connection), so a 3s budget was a coin flip rather than a margin.
# It had silently fired three times (2026-07-24, 07-25, 07-29) before anyone
# noticed, because the only visible symptom is the agent asking the operator to
# restate facts it should already have had - which reads as ordinary skill
# behaviour, not a failure.
#
# This gets WORSE in production, not better: on Vercel the endpoint becomes a
# serverless function with its own cold start in front of the same cold Neon
# connection.
#
# The cost of a longer budget is bounded and small. This is a blocking call on
# the reply path, but a dead app fails fast (connection refused, not a timeout),
# so this only extends the slow-but-alive case - and real turns already take
# 27-100s end to end, so several extra seconds is immaterial next to
# weekly-digest reporting "no active listings" while five exist.
TIMEOUT_SECONDS = 10

# The fields a row must carry to be describable. A row missing any of them is
# skipped rather than rendered with a hole in it - weekly-digest reproduces
# this block verbatim, so a half-described listing becomes a half-described
# post.
#
# `status` is deliberately NOT required: the endpoint only started sending it
# on 2026-07-31, and a row without it must still be usable rather than dropped.
# See _status_tag for why an ABSENT status renders as ACTIVE (a row without
# the key can only have come from the pre-widening route, which returned
# ACTIVE rows exclusively) while a present-but-unrecognised one renders
# unavailable. An earlier version of this comment said the opposite - it
# described a "withhold when absent" rule that was considered and rejected
# precisely because it would blank the digest during a plugin-ahead-of-app
# deploy window; the long block above _status_tag is the authority.
REQUIRED_FIELDS = ("area", "rooms", "sqm", "transactionType")

NO_LISTINGS_CONTEXT = "Active listings context: no currently active listings on record."

# The endpoint returns every non-SOLD listing. The two statuses are NOT
# interchangeable to the four consuming skills, so each row is tagged and the
# header states the rule - the skills' own SKILL.md files carry the detail.
#
# MISSING and UNRECOGNISED are deliberately NOT the same case, and conflating
# them is a real bug rather than a style choice:
#
#   key absent  -> the row came from the pre-2026-07-31 route, which returned
#                  ACTIVE rows EXCLUSIVELY. So absent genuinely means ACTIVE,
#                  and that is not a guess. This matters in one real window: a
#                  profile that gets this plugin copied in before the reporting
#                  app is redeployed. Tagging those rows unavailable would make
#                  weekly-digest report "nothing on the market" while several
#                  listings are - the asymmetric WRONG-ANSWER case this
#                  plugin's docstring calls out, manufactured by the very
#                  change meant to prevent a wrong answer.
#
#   present but not "ACTIVE" -> anything the route might add later. Renders as
#                  unavailable, which is the harmless direction: under-
#                  advertising is a missed post, over-advertising tells buyers
#                  something untrue about a home that is already spoken for.
_ACTIVE_TAG = "[ACTIVE]"
_UNAVAILABLE_TAG = "[UNDER CONTRACT - not available]"


def _status_tag(listing: dict) -> str:
    if "status" not in listing:
        return _ACTIVE_TAG
    return _ACTIVE_TAG if listing["status"] == "ACTIVE" else _UNAVAILABLE_TAG

# Deliberately broad across all four consuming skills' vocabulary - see
# module docstring on the asymmetric cost of a false positive (free) vs.
# false negative (wrong answer for weekly-digest; softer fallback for the
# three locator-lookup skills). Keep roughly in sync with each skill's own
# `description` field.
#
# Apostrophes: ['’] not a bare ' - WhatsApp/iOS smart punctuation types
# U+2019, so the exact digest phrasings this gate was written for failed on
# the punctuation real phones actually produce. And the RENTAL vocabulary is
# not optional: listing-status-update's own description covers "going under
# contract/rented" and just-sold treats a completed rental as Sold, yet the
# gate had no rented/leased/הושכר alternative at all - so the entire rental
# half of those skills' vocabulary silently never fetched locator context
# (measured 2026-08-04: "The Frishman apartment just rented" -> no match).
LISTING_LOOKUP_KEYWORDS = re.compile(
    # weekly-digest
    r"digest|roundup|round-up|round up|still active|on the market|"
    r"what['’]?s active|what['’]?s still|weekly update|summary|"
    # listing-reengagement (incl. "it's been a few weeks", one of that skill's
    # own documented trigger phrases, which this gate was missing)
    r"re-?post|remind (?:people|them|buyers)|hasn['’]?t sold|re-?promote|"
    r"still available|been a (?:few|couple(?: of)?) weeks|"
    # listing-status-update
    r"price drop|price cut|reduced|lowered the price|"
    r"dropp?ed the price|cut the price|under contract|"
    # just-sold (a completed rental counts as Sold there)
    r"\bsold\b|closed on|\brented\b|\bleased\b|rented out|"
    # Hebrew, spanning all four
    r"סיכום|עדכון שבועי|מה עוד פעיל|מה נשאר|"
    r"עדיין זמינה|תזכיר|תפרסם שוב|ירד במחיר|בהליכי מכירה|נמכר|הושכר",
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
        # The header is TWO lines as of 2026-07-31. Nothing below may compare
        # len(lines) against a literal - see the all-malformed check at the end,
        # which is keyed to len(header) for exactly this reason.
        header = [
            "Active listings context (from reporting system - use ONLY these, never invent others):",
            "Each row is tagged. [ACTIVE] = on the market. [UNDER CONTRACT - not available] = "
            "spoken for: it can still be named for a status change or a completed sale, but it "
            "must NEVER be included in a roundup of what is available, re-promoted, or offered "
            "to anyone as still on the market.",
        ]
        lines = list(header)
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
                f"{floor}, {price} ({listing['transactionType']}) "
                f"{_status_tag(listing)}"
            )
    except Exception as e:
        logger.warning("active-listings-context: could not format listings, no context injected: %s", e)
        return None

    # Every row was malformed - say so plainly rather than emit a bare header,
    # which weekly-digest would read as "here are the listings" and find none.
    # Keyed to len(header), NOT a literal: the header grew from one line to two
    # on 2026-07-31, and the hardcoded `== 1` that used to be here would have
    # silently stopped detecting this case. The sibling buyer-listings-context
    # hit exactly this landmine on 2026-07-28 and was re-keyed then; this file
    # still had the literal, so the same bug was sitting here waiting.
    if len(lines) == len(header):
        return NO_LISTINGS_CONTEXT

    return "\n".join(lines)


def register(ctx):
    ctx.register_hook("pre_llm_call", inject_active_listings_context)
