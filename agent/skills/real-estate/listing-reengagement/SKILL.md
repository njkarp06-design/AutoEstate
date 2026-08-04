---
name: listing-reengagement
description: Use when a real estate agent wants to re-promote or remind people about a listing they already advertised and that is still active — nothing about it has changed. Trigger phrases include "still available," "re-post this," "remind people," "hasn't sold yet," "it's been a few weeks." The agent can name just the listing (e.g. "the Dizengoff place") instead of retyping every fact, if it can be found in the reporting system's active listings. Turns the listing's core facts into a fresh round of platform-formatted Hebrew and English posts, framed as a reminder rather than a first-time introduction.
version: 0.3.1
author: AutoEstate
license: MIT
metadata:
  hermes:
    tags: [real-estate, social-media, content-generation, hebrew, tel-aviv, re-engagement]
    related_skills: [listing-to-social, listing-status-update, just-sold]
---

# Listing Re-engagement

## Overview

A real estate agent has a listing that's still on the market, hasn't sold,
and hasn't changed — but it's been a while, and they want to re-promote it
to refresh interest rather than let it go quiet. This skill turns the
listing's facts into a fresh round of ready-to-use, platform-formatted
content in Hebrew and English, framed as a reminder ("still available")
rather than a first-time introduction. The agent reviews and posts it
themselves. This skill only produces text — it does not post anything
automatically, and it never trusts conversation memory for the listing's
facts: identity comes from the agent restating them in the current message,
or from an `[ACTIVE]` locator match against this turn's injected listings
context (see Required Input) — never from recalling an earlier exchange.
(`listing-status-update` and `just-sold` follow the same rule.)

This skill never creates or transitions anything in the reporting system —
see Output Format. The listing's `Active` record already exists from the
original `listing-to-social` post.

## When to Use

- The agent explicitly wants to re-promote, re-post, or remind people about
  a listing they already advertised, and nothing about the listing has
  changed (same price, same status, still active).
- Don't use for: a brand-new listing that hasn't been advertised yet — even
  if the facts look identical, "here's a property" and "reminder: this
  property is still available" are different requests (use
  `listing-to-social` for the former). A price drop or going under contract
  — that's `listing-status-update`, even if the agent frames it as part of
  a re-engagement push (see Required Input). A sale — that's `just-sold`.
  Answering buyer questions or anything that isn't producing shareable
  reminder content.

## Required Input

**First, check whether a locator lookup applies.** If the agent's message
doesn't restate every fact below but does name a locator (a street/area
name, e.g. "Dizengoff" or "the Ben Gurion listing") — and this turn's
context contains a real, literal "Active listings context (from reporting
system...)" block (the same block `weekly-digest` requires; a memory of one
from earlier in this conversation never counts, only the literal block
delivered in *this specific turn*):

- Search that block for listings whose area reasonably matches the stated
  locator. **Only `[ACTIVE]` rows count as matches for this skill.** The
  block also carries `[UNDER CONTRACT - not available]` rows; a property
  that is spoken for must never be re-promoted as still available, so treat
  those as non-matches for the purposes of every branch below — except the
  one that names them explicitly.
- **Exactly one `[ACTIVE]` match** → use that listing's facts (area,
  transaction type, rooms, sqm, floor, price) as this post's identity
  facts, and open your reply with a short confirmation line restating them
  (e.g. "Re-posting: 4-room apartment, Ben Gurion Blvd, 95 sqm,
  ₪4,800,000") so a wrong match is visible before the agent does anything
  with the content. **A match supplies those core facts only — the injected
  context carries no features.** The standout feature this post needs (see
  below) must still come from the agent's message, or go into the single
  batched follow-up question; never invent one to fill the gap.
- **The locator matches only an `[UNDER CONTRACT - not available]` row** →
  do **not** produce re-promotion content, and do not silently treat it as
  "not found". Say plainly that that listing is under contract, so
  re-promoting it would advertise a property that is already spoken for,
  and ask whether they meant a different one — or whether the sale has now
  completed, in which case `just-sold` is the right skill. This is a real
  answer, not a refusal: the agent asked to re-promote something they may
  not remember is off the market.
- **No locator given, but the context lists exactly one `[ACTIVE]` listing**
  → same as the single-match case, use it directly. This skill has no Listing Record footer
  and makes no automatic change to any stored data (see Output Format), so
  a wrong guess here only costs a redo of draft copy, not a bad database
  write — safe to default to the sole listing rather than asking. (Contrast
  `listing-status-update`/`just-sold`, which require a locator for this
  exact reason — see their own Required Input.)
- **Zero matches** (nothing matched, and not the under-contract case above)
  → do **not** tell the agent the listing isn't on record. Say you couldn't
  find a matching *active* listing — it may be recorded under a
  differently-spelled area — then fall through to asking for facts directly
  (below) — never guess.
- **Multiple matches** (locator matches more than one `[ACTIVE]` row, or no
  locator given and more than one `[ACTIVE]` listing exists) → ask one
  specific question naming the real candidates with distinguishing facts
  (rooms/sqm/price) — not a generic "please restate everything." Never
  include an under-contract listing among the candidates you offer.
- If no such block was injected this turn, or it says there are no active
  listings, skip straight to asking for facts directly (below).

**If a locator lookup doesn't apply** (no context block this turn, zero or
ambiguous matches, or the agent already gave the facts directly), confirm
you have — restated fresh in *this* message, never invented, never assumed
from earlier in the conversation, including anything you could technically
recall from an earlier exchange or an earlier lookup in this same
conversation:

- **Area / neighborhood**, **sale or rental**, **rooms**, **size in sqm**,
  **price**, and **floor** — the same core facts `listing-to-social`
  requires. This is a standalone promotional post (often sent weeks after
  the original), so don't rely on conversation memory to fill these in.
- At least one or two **standout features**, restated (renovated kitchen,
  balcony, parking, view, etc.) — same as `listing-to-social`.
- Optional: a stated reason for re-engaging (e.g. "price is flexible,"
  "open to offers," "showings have slowed down") — only if the agent
  actually says it, never invented. This is never filled in from a matched
  listing — a locator lookup only ever supplies static identity facts.

If the agent's message restates a **different** price or status than you'd
expect for this listing, don't try to reconcile it or flag a discrepancy —
this skill has no access to stored listing data to compare against, so it
simply trusts whatever the agent restates in the moment, same as
`listing-to-social` does for a new listing. If the agent is explicitly
describing a *change* (a new price, a sale, going under contract), that's
`listing-status-update` or `just-sold`'s job, not this skill's — ask which
they mean if it's ambiguous, and don't generate a re-engagement post that
quietly folds in an unstated status change. If you route the request to
`listing-status-update` because a price actually changed, only ever use the
new price the agent stated — never invent, guess, or recall an "old" price
from anywhere (a plausible round number, a different real listing, earlier
conversation) just to complete a "before → after" comparison; see
`listing-status-update`'s own Common Pitfalls for this exact failure mode.

If the agent's message is missing something on the required list, ask a
single follow-up question batching everything missing — don't generate
partial content and don't guess.

This skill follows the same rule as `listing-to-social`'s "Never Blend
Properties" section: if facts for more than one property appear in the same
request, give each complete, distinguishable one its own separate,
clearly-labeled response — never blend facts from different properties into
the same piece of content, and never drop one in favor of the other. This
applies identically when properties are identified by locator rather than
restated facts — a message naming two streets ("re-post Dizengoff and Ben
Gurion") gets two separate locator lookups and two separate responses, each
following the matching rules above independently.

## Output Format

Produce all three, each with a Hebrew version first and an English version
second, clearly labeled with headers. Do not skip a platform or a language
unless the agent explicitly asks for only one.

For rentals, phrase price as a monthly amount; for sales, as the total —
same convention as `listing-to-social`. Never present one as the other.

**1. Instagram caption**
Short (3-5 sentences), framed as a reminder, not an introduction — e.g.
"Still available!" / "Don't miss out" / "עדיין זמינה!" rather than
presenting the property as brand-new. Light emoji use. End with 5-8
hashtags, same structure as `listing-to-social` (location, sale/rental
type, generic real-estate tags, an optional feature tag) — only from facts
actually given.

**2. Facebook group post**
Slightly longer, conversational, no hashtags — same structure as
`listing-to-social` (hook, bullet list of key facts, closing CTA), but the
hook explicitly signals this is a reminder about an existing listing, not a
new one.

**3. Yad2-style listing description**
Formal and factual, no emoji, no hashtags — same as `listing-to-social`'s
Yad2 section (location and type, then rooms/size/floor/price, then
condition/features, then nearby highlights if given).

**No Listing Record footer.** Unlike `listing-to-social`,
`listing-status-update`, and `just-sold`, this skill never appends a
Listing Record — it doesn't create or transition anything in the reporting
system; the listing's `Active` record already exists from the original
post. This is intentional, not an oversight — don't add one even though a
"Listing Record footer format" reminder may appear elsewhere in this turn's
context; that reminder applies to the other three skills, not this one.

## Common Pitfalls

1. **Inventing facts.** Never add a price, room count, address detail, or
   feature that wasn't restated in this message or supplied by a real
   locator-matched listing (see Required Input) — and remember a locator
   match supplies core facts only, **never features**: an amenity that
   didn't come from the agent's own words goes in the batched question, not
   the copy.
2. **Assuming identity facts from earlier in the conversation.** Restate
   them fresh, or match them via a real, literal locator-lookup context
   block delivered in *this* turn — never from memory of an earlier
   exchange or an earlier lookup, however confident.
3. **Guessing a locator match instead of asking.** Zero matches or multiple
   matches both mean "ask," never "pick the closest-sounding one."
4. **Treating this as a brand-new listing.** The tone must read as a
   reminder ("still available") — don't write it as if introducing the
   property for the first time.
5. **Folding in an unstated status or price change.** If the agent's
   message implies something actually changed, that's
   `listing-status-update` or `just-sold` — don't handle it here, and don't
   silently reconcile a restated or matched price against anything else
   (this skill has no such data to check against beyond the one matched
   listing).
6. **Adding a Listing Record footer.** This skill never creates or updates
   a Listing — no footer belongs in its output, even if the ambient footer
   reminder text is present in this turn's context.
7. **Skipping a language or platform.** All three platforms, both
   languages, every time.
8. **Wrong units/currency.** Sqm, not sqft. ₪, not $, unless told otherwise.
9. **Blending facts across properties.** Give each property its own
   complete, separate response — including when properties are identified
   by locator rather than restated facts.

## Verification Checklist

- [ ] Locator lookup was attempted first when facts weren't fully restated,
      using only a real, literal injected context block from *this* turn —
      never a memory of one
- [ ] A locator match was either unambiguous (single match, or no locator
      with exactly one active listing) or resolved by asking a specific
      question naming the real candidates — never guessed
- [ ] All required CORE facts present (area, sale/rental, rooms, size,
      price, floor) — via restatement or a confirmed locator match — and at
      least one feature via **restatement or the single batched follow-up
      question only** (a locator match never supplies features; the
      injected context doesn't carry them), not guessing
- [ ] If a locator match was used, the reply opens with a confirmation line
      restating the matched facts
- [ ] All three platforms produced (Instagram, Facebook, Yad2), each with
      Hebrew and English, clearly labeled
- [ ] Tone reads as a reminder about an existing listing, not a
      first-time introduction
- [ ] No implied status or price change was handled inline — anything that
      sounded like an actual change was treated as out of scope for this
      skill
- [ ] No fact appears that wasn't in the agent's current input or a real
      matched listing, including no identity facts silently carried over
      from earlier in the conversation
- [ ] Numbers use sqm and ₪ (unless told otherwise)
- [ ] No Listing Record footer present anywhere in the response
- [ ] Each distinguishable property got its own complete, separate response
      if more than one appeared in the request (by restated facts or by
      locator)
