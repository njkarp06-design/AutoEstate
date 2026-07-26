---
name: weekly-digest
description: Use when a real estate agent asks for a digest, roundup, or summary of what's still active/on the market — not a single new listing or a single status change. Turns the reporting system's currently-active listings into one bilingual roundup post, with zero facts retyped by the agent.
version: 0.1.0
author: AutoEstate
license: MIT
metadata:
  hermes:
    tags: [real-estate, social-media, content-generation, hebrew, tel-aviv, digest]
    related_skills: [listing-to-social, listing-status-update, just-sold, listing-reengagement]
---

# Weekly Digest

## Overview

A real estate agent wants a roundup of everything they still have on the
market, without retyping the list of listings themselves. Before this
skill, that meant restating every active listing by hand each time — this
skill instead reads the reporting system's own record of what's currently
active (injected into this turn by the `active-listings-context` plugin,
see Required Input) and drafts one combined post from it. This skill only
produces text — it does not post anything, and it does not create or update
any listing (that's `listing-to-social`, `listing-status-update` and
`just-sold`'s job).

## When to Use

- The agent asks for a digest, roundup, weekly update, or summary of active
  listings — not details about one specific property.
- **Don't use for:** a brand-new listing (`listing-to-social`), a price drop
  or going under contract (`listing-status-update`), a completed sale
  (`just-sold`), re-promoting a single unchanged listing
  (`listing-reengagement`), or answering a buyer's question about one named
  property (`buyer-inquiry`, which runs on a separate instance). Each of
  those is about **one** property; this skill is the only one that covers
  the whole active set at once.

## Required Input

None from the agent — that's the point. All facts come from a real,
literal "Active listings context (from reporting system..." block that the
`active-listings-context` plugin injects into *this specific turn* when it
recognizes a digest-style request (see that plugin for its trigger
phrases).

**Only that exact, literal block — delivered in this turn — counts.**
Recalling a listing from earlier in this same conversation (an earlier
`listing-to-social` exchange, an earlier digest, anything you technically
remember) is not the same as that block being present now, and does not
satisfy this requirement — this applies even if you're confident the
recalled details are accurate. If you don't see that literal block in this
turn, treat active-listings data as absent, no matter what you recall, and
say so plainly rather than guessing, recalling, or presenting remembered
information as if it were freshly retrieved — e.g. "I don't have the
current active-listings data for this request — try asking again." Never
fabricate or reconstruct a roundup from memory, and never describe
recalled information as something you "retrieved from the database" or
similar — if it wasn't in this turn's injected block, it isn't verified
current data.

## Source of Truth & Never Invent

This is the core rule of this skill:

- Use only the listings enumerated in the injected context — never add a
  listing you recall from earlier in this conversation that isn't in the
  context (it may have since sold or been withdrawn; the context is the
  current truth, memory isn't).
- Never omit a listing that IS present in the context.
- If the context says there are zero active listings, state that plainly
  ("No active listings on record right now.") — don't invent a roundup to
  avoid an empty-feeling reply.

## Output Format

Produce **one combined bilingual post** — Hebrew version first, English
version second, clearly labeled with headers (same
`**🇮🇱 עברית:**` / `**🇬🇧 English:**` convention as the other skills).

This is deliberately **not** the other skills' 3-platform
Instagram/Facebook/Yad2 structure — a digest is a roundup, not a piece of
per-property content, so don't force it into that shape even if it would
otherwise fit. It also has **no Listing Record footer** — this skill only
reads the reporting system's data, it never creates or updates a Listing.
Both omissions are intentional; don't "fix" this skill to match the others.

List each active listing as a short line: area, rooms, sqm, price
(sale/rental phrasing matching that listing's own type), one line per
listing, in the order given. A short intro line and closing line are fine,
but keep the facts to exactly what's in the context.

## Common Pitfalls

1. **Inventing or omitting a listing.** The roundup must match the injected
   context exactly — no additions from memory, no drops.
2. **Using memory instead of the injected context.** Even if you recall
   listings from earlier in this conversation — including a listing you
   generated yourself earlier in this same session — that recall does not
   substitute for a real, literal injected context block in *this* turn.
   Only that exact block is the source of truth; a memory, however
   confident, is not "current data" and must never be presented as if it
   were retrieved just now.
3. **Forcing the 3-platform structure.** This skill produces one combined
   post, not Instagram/Facebook/Yad2 sections.
4. **Adding a Listing Record footer.** This skill never creates or updates
   a Listing — no footer belongs in its output.
5. **Ignoring the zero-listings case.** If the context lists no active
   listings, say so plainly instead of producing an empty-looking or
   fabricated roundup.
6. **Guessing when the context is missing, or misrepresenting memory as
   fresh data.** If no active-listings context was injected into this turn
   at all, say so — don't guess, don't fall back to memory, and don't
   describe recalled information as something "retrieved from the
   database" or similar, even if it happens to be accurate.

## Verification Checklist

- [ ] Every listing in the roundup came from a real, literal injected
      context block present in *this* turn — not from memory, however
      accurate that memory might be
- [ ] Every listing in the injected context appears in the roundup, and
      nothing else does
- [ ] One combined bilingual post — not the 3-platform structure
- [ ] No Listing Record footer
- [ ] Zero-active-listings case handled with a plain statement, not a
      fabricated or empty-looking roundup
- [ ] Missing-context case handled by saying so plainly — never by
      recalling or reconstructing from conversation memory, and never by
      describing memory as if it were freshly retrieved
