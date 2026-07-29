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

# Same env var NAMES as sync-to-webapp, and BUYER_VIEW_URL is derived from
# INGESTION_URL (same pattern as active-listings-context), so there is no extra
# URL to roll out. The SECRET is a different matter: a buyer instance holds its
# own per-customer credential, valid only on this endpoint and /api/inquiries,
# and rejected with 401 by /api/ingest. Never reuse the operator instance's
# secret here — this box is public, and that credential can mutate the
# customer's Listing rows. See reporting-app/lib/ingest-auth.ts.
INGESTION_URL = os.getenv("AUTOESTATE_INGESTION_URL")  # e.g. https://.../api/ingest
INGESTION_SECRET = os.getenv("AUTOESTATE_INGESTION_SECRET")
BUYER_VIEW_URL = (
    INGESTION_URL.replace("/api/ingest", "/api/listings/buyer-view")
    if INGESTION_URL and INGESTION_URL.endswith("/api/ingest")
    else None
)

# Say so out loud. A URL that is set but doesn't end in /api/ingest (a trailing
# slash is enough) leaves BUYER_VIEW_URL None, and the hook below then returns
# early on every turn. The skill's documented response to absent context is to
# defer everything - so the failure looks like a polite, working receptionist
# that simply never answers anything, on the one public surface in the product,
# with previously not one line anywhere explaining why.
if INGESTION_URL and not BUYER_VIEW_URL:
    logger.warning(
        "buyer-listings-context: AUTOESTATE_INGESTION_URL=%r does not end in "
        "'/api/ingest', so the buyer-view endpoint cannot be derived - THIS PLUGIN IS "
        "INERT and the skill will defer every single buyer question.",
        INGESTION_URL,
    )

# Buyer traffic only ever arrives over a real messaging channel. hermes -z
# (cli) sets neither platform, so this won't fire there — simulate the block
# manually in the prompt when testing the skill via the CLI.
# "whatsapp" is the Baileys bridge; "whatsapp_cloud" is the official Meta Cloud
# API, which Hermes ships a separate adapter for and which registers under that
# DISTINCT name. Listed ahead of any migration on purpose: this set cannot be
# shared with the other plugins (each is a standalone copy inside a profile's
# plugins/ dir), so a missing entry would silently no-op this plugin on a Cloud
# instance rather than fail visibly.
BUYER_PLATFORMS = {"whatsapp", "whatsapp_cloud", "telegram"}

# Was 3. Raised in the same change as active-listings-context's, which is where
# the measurement lives - the two plugins fetch sibling endpoints off the same
# app, so a timeout that is too tight for one is too tight for the other. It was
# fixed here at the same time deliberately: correcting one of two consumers and
# leaving the other is a failure this repo has recorded more than once, and the
# consequence is WORSE on this side. There, a missed fetch makes the operator
# retype facts; here it strips the receptionist of every listing it knows, so a
# real buyer - a stranger who just tapped an ad - gets "let me check with the
# agent" to a question the bot could have answered. That is the single moment
# this whole feature exists for.
#
# Unmeasured on this endpoint specifically: /api/listings/buyer-view has never
# been timed cold, and no buyer-side occurrence is in the logs. The change is
# made on the strength of the shared-cause argument above, not on an observation
# here - worth timing for real once the buyer instance runs against a deployed
# app rather than a laptop dev server.
TIMEOUT_SECONDS = 10

# The fields a row must carry to be describable at all. A row missing any of
# them is skipped rather than rendered with a hole in it - a half-described
# listing is worse than an absent one, since the skill answers only from what
# is in this block.
REQUIRED_FIELDS = ("area", "rooms", "sqm", "transactionType", "status")

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

    # Formatting is inside the try as well, and every field is read with
    # .get(): an unexpected response shape must degrade to "no context
    # injected" (so the skill defers everything), never raise out of the hook.
    # This block previously indexed area/rooms/sqm/transactionType directly and
    # sat OUTSIDE the try, so a single missing key would have propagated a
    # KeyError out of pre_llm_call on a PUBLIC instance, on every turn.
    try:
        header = [
            "Available listings (from the reporting system — answer ONLY from these; "
            "never call a SOLD or under-contract listing available; if a detail isn't "
            "here, do not invent it — defer to the agent).",
            # This rule lives HERE, not only in the skill file, because a
            # long-lived buyer session never reloads SKILL.md (the documented
            # tool-call compliance gap) - the injected text is the only channel
            # that reaches a conversation already in progress.
            "FEATURES ARE NOT EXHAUSTIVE: a feature not listed is UNKNOWN, never "
            "absent. If someone asks about something that isn't in a listing's "
            "features (parking, pets, storage, anything), you do NOT know the "
            "answer — say so and defer to the agent. Never answer \"no\" about a "
            "feature just because it isn't listed, and never infer one from the "
            "area, the price or the other features.",
            # Also lives here rather than only in SKILL.md, for the same reason
            # as the features rule: a conversation already in progress never
            # reloads the skill file, so an in-flight buyer would otherwise
            # never benefit from code matching.
            "REF CODES: a listing may show a code like REF-K7M2P. Buyers arrive "
            "from an ad link that prefills that code, so if their message "
            "contains one, it identifies the property EXACTLY — use that "
            "listing and do not ask which one they mean. A code always wins "
            "over a guess from the area. If the code in their message matches "
            "no listing here, say you can't find that reference and defer — "
            "never fall back to picking a property that looks similar. If they "
            "mention two different codes, ask which one they mean.",
        ]
        lines = list(header)
        for listing in listings:
            if not isinstance(listing, dict) or any(
                listing.get(f) is None for f in REQUIRED_FIELDS
            ):
                logger.warning(
                    "buyer-listings-context: skipping malformed listing row (missing %s)",
                    REQUIRED_FIELDS,
                )
                continue
            price = f"₪{listing['price']}" if listing.get("price") is not None else "price N/A"
            floor = f"floor {listing['floor']}" if listing.get("floor") is not None else "floor N/A"
            # Deliberately NOT in REQUIRED_FIELDS: every listing recorded before
            # 2026-07-28 has features=None, and treating that as malformed would
            # drop the entire existing portfolio from the buyer's context.
            raw_features = listing.get("features")
            features = (
                f" — FEATURES: {raw_features}"
                if isinstance(raw_features, str) and raw_features.strip()
                else ""
            )
            # Deliberately NOT in REQUIRED_FIELDS, same reasoning as features:
            # rows created before the column existed have no code, and treating
            # that as malformed would drop real listings out of the buyer's
            # context entirely - a far worse outcome than one row that can only
            # be matched by area.
            raw_code = listing.get("refCode")
            code = (
                f"REF-{raw_code.strip()} — "
                if isinstance(raw_code, str) and raw_code.strip()
                else ""
            )
            lines.append(
                f"- {code}{listing['area']}, {listing['rooms']} rooms, {listing['sqm']} sqm, "
                f"{floor}, {price} ({listing['transactionType']}) "
                f"— STATUS: {listing['status']}{features}"
            )
    except Exception as e:
        logger.warning("buyer-listings-context: could not format listings, no context injected: %s", e)
        return None

    # Every row was malformed - same situation as an empty list, and the skill
    # must be told so explicitly rather than handed a bare header. Keyed to the
    # header's own length, not a literal: the header grew from one entry to two
    # when the features rule was added, and a hardcoded 1 would have silently
    # stopped detecting the all-malformed case.
    if len(lines) == len(header):
        return NO_LISTINGS_CONTEXT

    return "\n".join(lines)


def register(ctx):
    ctx.register_hook("pre_llm_call", inject_buyer_listings_context)
