"""Forces the exact "Listing Record" footer format into context on every
WhatsApp/Telegram turn, instead of relying on the model to reload
listing-to-social/listing-status-update's SKILL.md via skill_view.

Background: real WhatsApp usage showed the model producing a complete,
correctly-formatted listing-to-social response without ever calling
skill_view, once a long-lived session had "learned" the skill pattern from
earlier turns - so a newer skill requirement (the Listing Record footer,
added in listing-to-social v0.4.0 / PR #19) never reached the model, even
after adding an explicit "always reload the skill, don't trust memory"
instruction to the profile's own USER.md memory. That fix was tested live
and did not change the model's behavior: this is a tool-call compliance
gap, not a stale-fact gap, and no in-context instruction reliably closes it
once a session has done the task "enough times" to feel routine.

This hook sidesteps the problem rather than re-litigating it: it injects
the exact 7-line footer format directly into context on every
relevant-platform turn via pre_llm_call - the same mechanism
active-listings-context already uses - so footer presence stops depending
on whether the model decides to reload the skill that turn.

Unlike active-listings-context, this is pure static text with no network
call, so there is no latency/reliability cost to firing on every turn -
platform gating only (WhatsApp/Telegram), deliberately no message-content
keyword gate. A keyword gate here would recreate the exact failure mode
this plugin exists to close: real listing messages are often raw shorthand
facts (address, rooms, price) with no predictable trigger phrase, so a
missed keyword match would silently omit the reminder on a genuine listing
turn - the same silent-failure shape as the original bug. Costing a few
dozen extra tokens on unrelated messages is cheap next to another
silently-untracked listing.

The reminder also carries the no-locator confirmation-deferral rule for
status-mutating footers (PR #26's design). It originally lived only in
listing-status-update/just-sold's SKILL.md - which a long-lived session
never reloads (the same compliance gap above), so the first real live test
of that path emitted a Sold footer immediately, mutating the Listing table
with no confirmation: the model followed this plugin's then-unconditional
"the footer is not optional" text, the only instruction actually in its
context. The rule has to live here, in the channel the model demonstrably
obeys, not only in the skill file.
"""

SYNCED_PLATFORMS = {"whatsapp", "telegram"}

LISTING_RECORD_REMINDER = (
    "Listing Record footer format (authoritative - use this exact format, "
    "not a format remembered from earlier in this conversation, whenever "
    "your reply presents a new listing via listing-to-social, a status "
    "change via listing-status-update, or a completed sale via "
    "just-sold):\n\n"
    "For a NEW listing (listing-to-social), append after the Yad2 section, "
    "as the last thing in your reply, nothing after it:\n"
    "**Listing Record:**\n"
    "Area: <area, as given>\n"
    "Type: <Sale | Rental>\n"
    "Rooms: <number>\n"
    "Size: <number> sqm\n"
    "Floor: <number, or N/A>\n"
    "Price: <₪ amount, or N/A>\n"
    "Status: Active\n\n"
    "For a STATUS CHANGE on an existing listing (listing-status-update), "
    "same 7-line format in the same position, but Status is Active (price "
    "drop) or Under Contract instead - and Area/Rooms/Size must still be "
    "restated in the footer, not assumed from earlier in the "
    "conversation.\n\n"
    "For a COMPLETED SALE (just-sold), same 7-line format in the same "
    "position, but Status is Sold - just-sold is the only skill that ever "
    "sets Status: Sold.\n\n"
    "EXCEPTION - status change or sale with no stated identity: if the "
    "message announcing a status change or completed sale neither restates "
    "the listing's identity facts (area + rooms + size) nor names a locator "
    "(street, neighborhood, or nickname identifying which listing), do NOT "
    "append the Listing Record footer this turn - even if the active "
    "listings context shows exactly one listing. This footer updates the "
    "tracking database the moment it is sent, with no undo, so it needs a "
    "confirmed identity first. Write the post content as normal, but end "
    "with a plain confirmation question naming the listing you believe is "
    "meant (e.g. \"Reply to confirm this is the Ben Gurion listing and "
    "I'll record it\") in place of the footer, and append the footer only "
    "in the follow-up turn after the sender confirms. This exception never "
    "applies to a NEW listing (listing-to-social) - its facts are stated in "
    "the message itself, so its footer is always appended immediately.\n\n"
    "A re-engagement / \"still available\" post (listing-reengagement) "
    "gets NO footer at all - it doesn't change the listing's status, so "
    "don't add one just because this reminder is present.\n\n"
    "If a single reply covers more than one property, give each its own "
    "complete Listing Record footer. Omitting this footer, using the wrong "
    "field order, or getting Status wrong means the reporting system can't "
    "track this listing at all - it is not optional and not cosmetic."
)


def inject_listing_record_reminder(session_id, turn_id, user_message, platform, **kwargs):
    if platform not in SYNCED_PLATFORMS:
        return None
    return LISTING_RECORD_REMINDER


def register(ctx):
    ctx.register_hook("pre_llm_call", inject_listing_record_reminder)
