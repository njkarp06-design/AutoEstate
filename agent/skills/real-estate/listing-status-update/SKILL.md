---
name: listing-status-update
description: Use when a real estate agent wants to announce a change to a listing they already advertised — a price drop, or going under contract/rented — and wants ready-to-post content. Not for a completed sale — see just-sold. Turns the status change plus the listing's core facts into platform-formatted Hebrew and English posts for Instagram, a Facebook group, and Yad2.
version: 0.3.0
author: AutoEstate
license: MIT
metadata:
  hermes:
    tags: [real-estate, social-media, content-generation, hebrew, tel-aviv, listing-status]
    related_skills: [listing-to-social, just-sold, listing-reengagement]
---

# Listing Status Update

## Overview

A real estate agent wants to announce that something changed about a
listing they already advertised — the price dropped, or it went under
contract (or was rented). This skill turns that status change, plus the
listing's core facts, into ready-to-use, platform-formatted content in
Hebrew and English, which the agent reviews and posts themselves. This
skill only produces text — it does not post anything automatically, and it
does not look up or remember the original listing; the agent restates the
identifying facts each time.

A completed sale is **not** handled here — that's `just-sold`, which uses a
distinct celebratory/social-proof tone rather than this skill's factual
status-note format (see When to Use).

## When to Use

- The agent has an existing listing (already posted with `listing-to-social`
  or otherwise) and wants to announce a price drop, or that it went under
  contract / was rented.
- Don't use for: a brand-new listing that hasn't been advertised yet (use
  `listing-to-social` for that). A completed sale — use `just-sold` instead,
  even if the agent's phrasing sounds like a routine status update; a sale
  gets a distinct celebratory treatment, not this skill's factual note.
  Re-promoting a listing that hasn't changed at all — that's
  `listing-reengagement`. Answering buyer questions, or anything that isn't
  announcing an actual status change.

## Required Input

Before generating anything, confirm you have (ask for anything missing —
never invent it, and never assume it from earlier in the conversation):

- **Area / neighborhood**, **rooms**, and **size in sqm** — the same core
  identity facts as the original listing, restated. A status post needs to
  stand alone as marketing copy (it's often posted days or weeks after the
  original), so don't rely on conversation memory to fill these in — this
  applies even if you can actually recall these facts from earlier in this
  same conversation (e.g. an earlier `listing-to-social` exchange). If the
  agent's current message doesn't restate them itself, treat them as
  missing and ask, even though you technically know them. The point isn't
  that the facts are unknown to you — it's that the agent must actively
  confirm them for this specific post, so a stale or misremembered detail
  can't slip through uncaught.
- **Status type** — price drop, or under contract (or rented, for a rental)
  — never assume which one; ask if it's ambiguous. If the agent actually
  means the property sold, that's `just-sold`, not a status type here.
- Status-specific facts:
  - **Price drop**: the new price. The old price is optional — only include
    it if the agent explicitly states it in this message. Never state,
    imply, or reconstruct an old price from anywhere else — not a plausible
    round number, not a real price you recognize from a different listing,
    not anything recalled from earlier in the conversation. If the agent
    doesn't give an old price, describe the price drop using only the new
    price (e.g. "now available at ₪X") — don't invent a "before → after"
    comparison just because the phrasing would read more naturally with
    one.
  - **Under contract**: no price is required. Only mention an agreed price
    if the agent explicitly wants it shared.
- Optional: a closing note (e.g. a thank-you to the community) — only if
  the agent actually gives one, never invented.

If the agent's message is missing something on this list, ask a single
follow-up question batching everything missing — don't generate partial
content and don't guess.

This skill follows the same rule as `listing-to-social`'s "Never Blend
Properties" section: if facts for more than one property appear in the same
request, give each complete, distinguishable one its own separate,
clearly-labeled response (each with its own Listing Record footer, see
Output Format) — never blend facts from different properties into the same
piece of content, and never drop one in favor of the other.

## Output Format

Produce all three platforms, each with a Hebrew version first and an
English version second, clearly labeled with headers, in this order:
Instagram, Facebook, Yad2. Do not skip a platform or a language unless the
agent explicitly asks for only one — even for an "under contract"
announcement, all three still get a section (see Yad2 note below).

**1. Instagram caption**
Short (2-4 sentences), matches the status: straightforward urgency for a
price drop ("now available at..."), a brief "pending" note for under
contract. Light emoji use. End with 3-6 hashtags mixing Hebrew and English,
drawn from the same structure as `listing-to-social` (location + status,
e.g. #בהליכיםלמכירה / #UnderContract, #ירדבמחיר / #PriceDrop) — only tags
that reflect the actual status, never invented.

**2. Facebook group post**
A short structured update: one line naming the listing (area, rooms, size),
one line stating the status change, and a closing line whose call to action
depends on the status:
- Price drop → "still available, contact for viewing" (לפרטים ותיאום
  צפייה...)
- Under contract → a brief note that it's pending, with a CTA to contact
  about *other* listings, not this one (since it's no longer actively
  accepting offers)

**3. Yad2-style update**
Formal and factual, no emoji, no hashtags — but its role depends on status:
- **Price drop**: a real, updated formal description of the listing at the
  new price (rooms, size, floor, price, condition/features if given) — this
  is still a live, actionable listing.
- **Under contract**: a short factual status note only (e.g. "דירה זו
  בהליכי מכירה ואינה זמינה לצפייה" / "This listing is under contract and no
  longer available for viewing") rather than a full re-description, since
  the property isn't actively actionable anymore.

**4. Listing Record (footer, after the Yad2 section)**
Append exactly this block, in this order, as the last thing in your reply —
nothing after it. Same fixed format as `listing-to-social`'s footer (this is
how the reporting system recognizes it's the same property and transitions
its status, rather than creating a duplicate):

```
**Listing Record:**
Area: <area, as restated>
Type: <Sale | Rental>
Rooms: <number, e.g. 3.5>
Size: <number> sqm
Floor: <number, or N/A>
Price: <₪ amount, or N/A>
Status: <Active | Under Contract>
```

`Status` reflects this update: `Active` for a price drop (still on the
market, just at a new price — use the new price in `Price`), `Under
Contract` for going under contract or rented-pending-close. `Price` is
`N/A` when this update doesn't require one (under contract with no price
shared). If more than one property's status is being updated in the same
message, give each its own complete response and its own Listing Record
footer. Never write `Status: Sold` here — a completed sale is `just-sold`'s
footer to produce, not this skill's.

## Common Pitfalls

1. **Inventing facts.** Never add a price, room count, address detail, or
   closing note that wasn't given. If it's ambiguous, ask rather than
   assume — this includes the status type itself. This especially includes
   an **old price for a price drop** — a real, observed failure mode: don't
   fabricate a plausible-sounding "before" price (or recall one from a
   different real listing) just because the agent only gave the new price.
   No old price given means no old price stated, period — describe the new
   price alone.
2. **Assuming identity facts from earlier in the conversation.** Area,
   rooms, and size must be restated for this request, not carried over
   silently — the post needs to stand alone. This includes cases where you
   can technically recall the facts from earlier in this same conversation
   (e.g. the original `listing-to-social` exchange): recalling them is not
   the same as the agent restating them, and only the latter satisfies this
   requirement. If the current message doesn't restate them, ask — don't
   fill the gap from memory just because you happen to have it.
3. **Skipping a language or platform.** All three platforms, both
   languages, every time — including a full Yad2 section for an "under
   contract" status (see Output Format), just with a different role than a
   price drop.
4. **Wrong tone per status.** Don't write an "under contract" post with a
   "contact for viewing" call to action, or a price-drop post that implies
   the listing is gone.
5. **Handling a completed sale here.** If the agent means the property
   sold, redirect to `just-sold` — don't produce a `Status: Sold` footer or
   sold-flavored content from this skill.
6. **Exclusionary phrasing.** Same rule as `listing-to-social`: describe
   the property and the update, not an "ideal" tenant or buyer.
7. **Wrong units/currency.** Sqm, not sqft. ₪, not $, unless told otherwise.
8. **Blending two properties into one response.** If facts for more than
   one property show up in the same request, give each its own complete,
   separate response (see `listing-to-social`'s "Never Blend Properties") —
   don't merge them, and don't drop one in favor of the other.
9. **Missing or malformed Listing Record footer.** Every complete response
   needs its own footer, in the exact 7-line format, immediately after that
   listing's Yad2 section. Without it (or with a wrong `Status`), the
   reporting system can't recognize this as an update to the *same*
   property and may create a duplicate instead of transitioning it.

## Verification Checklist

- [ ] All required facts present (area, rooms, size, status type, and any
      status-specific facts), or a single batched follow-up question was
      asked instead of guessing
- [ ] Status type is a price drop or under contract — not a completed sale
      (that's `just-sold`)
- [ ] All three platforms produced (Instagram, Facebook, Yad2), each with
      Hebrew and English, clearly labeled
- [ ] Status type is unambiguous, and every platform's tone/CTA matches it
      (see Output Format)
- [ ] Yad2 section matches the status: full updated description for a
      price drop, short factual status note for under contract
- [ ] No fact appears that wasn't in the agent's *current* input, including
      no identity facts silently carried over from earlier in the
      conversation — even ones you could technically recall
- [ ] Each distinguishable property got its own complete, separate response
      if more than one appeared in the request
- [ ] Numbers use sqm and ₪ (unless told otherwise)
- [ ] Every complete response ends with its own exact 7-line Listing Record
      footer, with `Status` matching this update (`Active` for a price
      drop or `Under Contract`), immediately after that listing's Yad2
      section — never `Sold`
