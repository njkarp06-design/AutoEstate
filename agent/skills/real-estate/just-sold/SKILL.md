---
name: just-sold
description: Use when a real estate agent's listing just sold and they want a celebratory, shareable social-proof post about it — not a factual status note. The agent can name just the listing (e.g. "the Dizengoff place") instead of retyping every fact, if it can be found in the reporting system's active listings. Turns the sale plus the listing's core facts into platform-formatted Hebrew and English posts for Instagram, a Facebook group, and Yad2.
version: 0.2.0
author: AutoEstate
license: MIT
metadata:
  hermes:
    tags: [real-estate, social-media, content-generation, hebrew, tel-aviv, social-proof]
    related_skills: [listing-to-social, listing-status-update, listing-reengagement]
---

# Just Sold

## Overview

A real estate agent's listing just sold and they want to announce it as a
celebratory, credibility-building post — not just a factual "no longer
available" note. This skill turns the sale, plus the listing's core facts,
into ready-to-use, platform-formatted content in Hebrew and English, which
the agent reviews and posts themselves. This skill only produces text — it
does not post anything automatically, and it does not look up or remember
the original listing; the agent restates the identifying facts each time.

This is the only skill that announces a sale. `listing-status-update`
handles price drops and going under contract, but not a completed sale —
see that skill's own scope note.

## When to Use

- The agent has an existing listing (already advertised with
  `listing-to-social` or otherwise) that just sold, and wants a
  celebratory, shareable social-proof post about it.
- Don't use for: a price drop or going under contract — that's
  `listing-status-update`. A brand-new listing that hasn't sold yet — that's
  `listing-to-social`. Re-promoting a listing that's still active and
  *hasn't* sold — that's `listing-reengagement`.

## Required Input

**First, check whether a locator lookup applies.** If the agent's message
doesn't restate the identity facts below but does name a locator (a
street/area name, e.g. "Dizengoff" or "the Ben Gurion listing") — and this
turn's context contains a real, literal "Active listings context (from
reporting system...)" block (the same block `weekly-digest` requires; a
memory of one from earlier in this conversation never counts, only the
literal block delivered in *this specific turn*):

- Search that block for listings whose area reasonably matches the stated
  locator.
- **Exactly one match** → use that listing's identity facts (area,
  transaction type, rooms, sqm, floor) below, and open your reply with a
  short confirmation line restating them before the celebratory content.
- **No locator given at all** — regardless of how many active listings
  exist, including exactly one — **do not** auto-pick a listing as
  confirmed, and **do not append a Listing Record footer in this turn.**
  Unlike `listing-reengagement`, this skill's footer automatically
  transitions the `Listing` table to `Sold` the instant the message is
  sent, with no review step on that side effect and (as of this writing) no
  way to undo a wrong one in the reporting app — so the footer specifically
  needs a real confirmation first, even though the rest of the content
  doesn't. Go ahead and produce the celebratory Instagram/Facebook/Yad2
  content using the one plausible candidate's facts (or, if there's more
  than one candidate, using whichever seems most likely, clearly labeled as
  unconfirmed) — but in place of the Listing Record footer, end with a
  plain confirmation question naming the candidate(s) (e.g. "Reply to
  confirm this is your Ben Gurion listing, 4 rooms, 95 sqm, so I can record
  the sale" — or, with more than one candidate, ask which one). Only add
  the actual Listing Record footer once the agent confirms in a **later
  message** — that confirmation is itself the "locator" for the purposes of
  this section, so from that point on this is a single-match locator case
  (above), not a no-locator case.
- **Zero matches** → say so plainly, then fall through to asking for the
  identity facts directly (below) — never guess.
- **Multiple matches** → ask one specific question naming the real
  candidates with distinguishing facts (rooms/sqm/price) — not a generic
  "please restate everything."
- If no such block was injected this turn, or it says there are no active
  listings, skip straight to asking for the identity facts directly
  (below).

**If a locator lookup doesn't apply** (no context block this turn, zero or
ambiguous matches not yet resolved, or the agent already gave the facts
directly), the identity facts must be restated fresh in *this* message,
never invented, never assumed from earlier in the conversation:

- **Area / neighborhood**, **rooms**, and **size in sqm** — the same core
  identity facts as the original listing, restated. A sold post needs to
  stand alone as marketing copy (it's often posted days or weeks after the
  original listing), so don't rely on conversation memory to fill these in —
  this applies even if you can actually recall these facts from earlier in
  this same conversation (e.g. an earlier `listing-to-social` exchange). If
  the agent's current message doesn't restate them itself, treat them as
  missing and ask, even though you technically know them. The point isn't
  that the facts are unknown to you — it's that the agent must actively
  confirm them for this specific post, so a stale or misremembered detail
  can't slip through uncaught.

**Regardless of which path supplied the identity facts** (restated or
locator-matched), the following always come from the agent's *current*
message alone — never from a matched listing:

- Optional: the **final sale price** — only if the agent explicitly wants it
  shared; many agents keep it private. Don't ask "was it sold?" as if in
  doubt — the agent invoking this skill already means it sold.
- Optional: a **stated highlight** to celebrate — e.g. "sold in 2 weeks,"
  "over asking," "multiple offers" — only if the agent actually states it in
  this message. Never compute, estimate, or infer a highlight yourself (e.g.
  don't calculate days-on-market from conversation timestamps or memory) —
  an unstated highlight is simply omitted, not guessed at.
- Optional: a thank-you / testimonial note — only if the agent actually
  gives one, never invented.

If the agent's message is missing a required identity fact, ask a single
follow-up question batching everything missing — don't generate partial
content and don't guess.

This skill follows the same rule as `listing-to-social`'s "Never Blend
Properties" section: if facts for more than one property appear in the same
request, give each complete, distinguishable one its own separate,
clearly-labeled response (each with its own Listing Record footer, see
Output Format) — never blend facts from different properties into the same
piece of content, and never drop one in favor of the other. This applies
identically when a property is identified by locator rather than restated
facts — a message naming two streets gets two separate locator lookups
(each following the no-locator-auto-pick rule above independently) and two
separate responses.

## Output Format

Produce all three platforms, each with a Hebrew version first and an
English version second, clearly labeled with headers, in this order:
Instagram, Facebook, Yad2. Do not skip a platform or a language unless the
agent explicitly asks for only one.

**1. Instagram caption**
Short (2-4 sentences), celebratory and social-proof in tone — this is about
building the agent's credibility, not describing the property for sale.
Light emoji use. Include the stated highlight if one was given (e.g. "sold
in just 2 weeks!"), but never fabricate one. End with 3-6 hashtags mixing
Hebrew and English: location + sold-status tags (#נמכר / #SOLD), plus 1-2
generic real-estate tags — only tags that reflect the actual event, never
invented.

**2. Facebook group post**
A short structured update: one line naming the listing (area, rooms, size),
one line announcing "SOLD" (with the highlight if given), and a closing
thank-you line with a call to action pointing to the agent's *other*
listings — not this one, since it's no longer available.

**3. Yad2-style update**
Formal and factual, no emoji, no hashtags, no celebratory tone — Yad2 is a
listings platform, not a social feed. A short factual status note only
(e.g. "דירה זו נמכרה ואינה זמינה עוד" / "This listing has sold and is no
longer available"), not a full re-description, since the property isn't
actionable anymore.

**4. Listing Record (footer, after the Yad2 section)**
Append exactly this block, in this order, as the last thing in your reply —
nothing after it. Same fixed format `listing-to-social` and
`listing-status-update` use (this is how the reporting system recognizes
it's the same property and transitions its status, rather than creating a
duplicate). This skill is the only one that ever sets `Status: Sold`:

```
**Listing Record:**
Area: <area, as restated>
Type: <Sale | Rental>
Rooms: <number, e.g. 3.5>
Size: <number> sqm
Floor: <number, or N/A>
Price: <₪ amount, or N/A>
Status: Sold
```

`Status` is always `Sold` for this skill (a completed rental counts as
`Sold` too — "no longer on the market," don't invent a separate status for
a completed rental). `Price` is the final sale price only if the agent
explicitly wants it shared, otherwise `N/A`. If more than one property's
sale is being announced in the same message, give each its own complete
response and its own Listing Record footer. **Exception — the no-locator
case:** if the agent's message neither restated the identity facts nor named
a locator (see Required Input), omit the footer from this turn entirely and
end with a confirmation question instead — add it only once the agent
confirms in a later message.

## Common Pitfalls

1. **Inventing facts.** Never add a price, room count, address detail,
   highlight, or testimonial that wasn't given. If it's ambiguous, ask
   rather than assume.
2. **Computing a highlight instead of using a stated one.** "Sold in 2
   weeks" or "over asking" must come from the agent's own words in this
   message — never calculated from conversation timestamps, memory, or
   general knowledge.
3. **Assuming identity facts from earlier in the conversation.** Area,
   rooms, and size must be restated for this request, matched via a real,
   literal locator-lookup context block delivered in *this* turn, or
   confirmed via the required confirmation question — never carried over
   silently from memory of an earlier exchange or an earlier lookup. This
   includes cases where you can technically recall the facts from earlier
   in this same conversation: recalling them is not the same as the agent
   restating them or a real current-turn locator match.
4. **Appending a Listing Record footer with no stated locator.** Even with
   exactly one active listing on record, this skill must withhold the
   footer and ask a confirmation question in its place — see Required
   Input. (`listing-reengagement` is allowed to auto-pick and never has a
   footer anyway; this skill and `listing-status-update` are not, since
   their footer has an automatic, un-reviewed database effect.)
5. **Guessing a locator match instead of asking.** Zero matches or
   multiple matches both mean "ask," never "pick the closest-sounding one."
6. **Using a matched listing's asking price as the sale price.** A locator
   match only ever supplies identity facts (area, rooms, sqm, floor) — the
   final sale price, if shared at all, must come from the agent's current
   message; the matched listing's stored price is the pre-sale asking
   price, not necessarily what it actually sold for.
7. **Skipping a language or platform.** All three platforms, both
   languages, every time.
8. **Celebratory tone leaking into Yad2.** Yad2 stays factual and short —
   see Output Format.
9. **Exclusionary phrasing.** Describe the property and the sale, not an
   "ideal" buyer.
10. **Wrong units/currency.** Sqm, not sqft. ₪, not $, unless told otherwise.
11. **Blending two properties into one response.** If facts for more than
   one property show up in the same request, give each its own complete,
   separate response — don't merge them, and don't drop one in favor of the
   other.
12. **Missing or malformed Listing Record footer.** Every complete response
   needs its own footer, in the exact 7-line format, immediately after that
   listing's Yad2 section, with `Status: Sold` — *except* the no-stated-
   locator case (Required Input), where the footer is deliberately withheld
   until confirmed. Outside that one case, a missing footer means the
   reporting system can't recognize the sale and may leave the listing
   showing as still active.

## Verification Checklist

- [ ] Locator lookup was attempted first when identity facts weren't fully
      restated, using only a real, literal injected context block from
      *this* turn — never a memory of one
- [ ] With no stated locator, the Listing Record footer was withheld and a
      confirmation question was asked in its place — even with only one
      active listing on record — rather than committing the sale unconfirmed
- [ ] A locator match was either unambiguous (single match) or resolved by
      asking a specific question naming the real candidates — never guessed
- [ ] Area, rooms, and size present — via restatement, a confirmed locator
      match, or a single batched follow-up question, not guessing
- [ ] If a locator match was used, the reply opens with a confirmation line
      restating the matched identity facts, and any sale price came from
      the agent's current message, not the matched listing's asking price
- [ ] All three platforms produced (Instagram, Facebook, Yad2), each with
      Hebrew and English, clearly labeled
- [ ] Tone is celebratory/social-proof on Instagram and Facebook, factual
      and short on Yad2
- [ ] Any highlight or testimonial present came from the agent's own words
      in this message — nothing computed or inferred
- [ ] No fact appears that wasn't in the agent's current input or a real
      matched listing, including no identity facts silently carried over
      from earlier in the conversation
- [ ] Each distinguishable property got its own complete, separate response
      if more than one appeared in the request
- [ ] Numbers use sqm and ₪ (unless told otherwise)
- [ ] Every complete response ends with its own exact 7-line Listing Record
      footer, `Status: Sold`, immediately after that listing's Yad2 section —
      **except** the no-stated-locator case above, where the footer is
      deliberately withheld until the agent confirms in a later message
