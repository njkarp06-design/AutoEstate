---
name: listing-to-social
description: Use when a real estate agent provides new listing details (facts about a property, and optionally photo descriptions or attached photos) and wants ready-to-post content. Turns raw listing facts into platform-formatted Hebrew and English captions for Instagram, a Facebook group, and Yad2.
version: 0.3.1
author: AutoEstate
license: MIT
metadata:
  hermes:
    tags: [real-estate, social-media, content-generation, hebrew, tel-aviv]
    related_skills: [listing-status-update]
---

# Listing-to-Social Pipeline

## Overview

A real estate agent sends the facts about a new listing (and optionally rough
descriptions of the photos) instead of writing three separate social posts by
hand. This skill turns those facts into ready-to-use, platform-formatted
content in Hebrew and English, which the agent reviews and posts themselves.
This skill only produces text — it does not post anything automatically and
does not edit or select photos.

## When to Use

- The agent provides listing facts (address/area, rooms, size, price, floor,
  condition, standout features) for a property they want to advertise.
- Don't use for: answering buyer questions, drafting private replies to a
  lead, or anything that isn't producing shareable listing content.

## Required Input

Before generating anything, confirm you have (ask for anything missing —
never invent it):

- **Area / neighborhood** (e.g. Florentin, Tel Aviv)
- **Sale or rental** — determines price phrasing (see Output Format); never
  assume one or the other
- **Rooms** and **size in sqm**
- **Price** (in ₪ unless told otherwise) — for rentals, confirm it's a
  monthly figure
- **Floor** (and whether there's an elevator, if known)
- At least one or two **standout features** (renovated kitchen, balcony,
  parking, view, etc.)
- Optional: condition, nearby highlights (park, beach, transit), photo
  descriptions or attached photos, contact info to include (if given,
  include it on all three platforms, not just one)

Nearby highlights must come from the agent — never infer them from general
knowledge of the neighborhood (e.g. don't add "walking distance to the
beach" just because the area is known for that, unless the agent said it).

If the agent's message is missing something on this list, ask a single
follow-up question batching everything missing — don't generate partial
content and don't guess.

Photos may arrive two ways: as rough **typed descriptions**, or as **real
attached images** (a photo sent directly over WhatsApp/Telegram, which
Hermes passes to you as actual image content, not just a filename). Treat
both the same way: draw only specific, concrete details that are actually
described or actually visible (e.g. "sun-lit balcony," "renovated marble
kitchen") to enrich the captions — never elaborate or invent beyond what's
there. When a real image is attached, look at it directly for details
rather than relying only on any auto-generated caption text, which is
generic and not written for real estate listings. A photo is a source of
concrete facts like any other — it doesn't license condition or
availability claims the agent didn't make (see Common Pitfalls).

## Never Blend Properties

A response must never mix facts from more than one property into the same
piece of content. Because agent messages can arrive as several rapid
consecutive WhatsApp/Telegram messages, facts belonging to two different
properties can end up looking like a single request — either because a
second listing's facts arrive after you already answered an earlier one in
this conversation, or because two properties' facts are already mixed
together within the same incoming message before you've responded to
either.

- **A new listing arrives after you've already answered an earlier one:**
  treat it as its own fresh response using only its own facts — don't
  reference or carry over facts from the earlier, already-answered
  listing.
- **Two properties' facts are mixed within a single incoming message:**
  treat each complete, distinguishable set of facts as its own separate
  listing, and produce a separate, clearly-labeled, complete response for
  each one (its own full three-platform, two-language output) rather than
  trying to merge them into one. The failure this rule exists to prevent
  is a *single platform's content* citing facts from more than one
  property (e.g. one Instagram caption with property A's rooms and
  property B's price) — not the presence of more than one listing in a
  reply. If any one property's own facts are incomplete on their own, ask
  the normal batched follow-up for that property specifically, rather than
  filling the gap with another property's details.

## Output Format

Produce all three, each with a Hebrew version first and an English version
second, clearly labeled with headers. Do not skip a platform or a language
unless the agent explicitly asks for only one.

For rentals, phrase price as a monthly amount (e.g. "₪6,500/month" /
"₪6,500 לחודש"). For sales, phrase it as the total (e.g. "₪3,200,000").
Never present one as the other.

If the agent gives contact info, include it on all three platforms, not
just one.

**1. Instagram caption**
Short (3-5 sentences), engaging, light emoji use (not excessive). No formal
structure — reads like a post, not a listing. End with 5-8 hashtags mixing
Hebrew and English, built from what's actually in the input:
- 1-2 location tags (neighborhood + city, e.g. #פלורנטין #תלאביב)
- 1-2 tags matching the confirmed sale/rental type (e.g. #דירהלמכירה /
  #למכירה for a sale, #דירהלהשכרה / #להשכרה for a rental)
- 1-2 generic real-estate tags (e.g. #נדלן #TelAvivRealEstate)
- Optionally 1 tag tied to a stated standout feature (e.g. #מרפסת /
  #balcony) — only if that feature was actually given, never invented

**2. Facebook group post**
Slightly longer and more conversational than Instagram, no hashtags. Israeli
Facebook real-estate groups expect a clear structure: a one-line hook,
then a short bullet list of key facts (rooms, size, price, floor), then a
closing line with a call to action ("לפרטים ותיאום צפייה..." / "For details
and viewing...").

**3. Yad2-style listing description**
Formal and factual — this is a property listing, not a social post. No
emoji, no hashtags. Structured as short paragraphs: location and property
type, then rooms/size/floor/price, then condition and features, then
nearby highlights if given. Matches how a serious buyer scans a listing
site.

## Common Pitfalls

1. **Inventing facts.** Never add a price, room count, address detail, or
   feature that wasn't given. If it's ambiguous, ask rather than assume.
   This includes condition/availability claims: "renovated" does not mean
   "move-in ready" or "vacant" — don't upgrade a stated feature into a
   stronger claim the agent didn't make. It also includes neighborhood
   claims: don't add "walking distance to the beach" or similar just
   because it's generally true of the area — only use nearby highlights the
   agent actually stated.
2. **Skipping a language or platform.** All three platforms, both
   languages, every time, unless explicitly told otherwise.
3. **Wrong tone per platform.** Don't write Yad2's formal listing tone for
   Instagram, or Instagram's casual tone for Yad2 — see Output Format above.
4. **Exclusionary phrasing.** Describe the property, not an "ideal" tenant
   or buyer (e.g. avoid phrasing that implies preference by family status,
   religion, or similar) — keep language about the property's features, not
   who should live there.
5. **Wrong units/currency.** Sqm, not sqft. ₪, not $, unless told otherwise.
6. **Conflating sale and rental pricing.** A rental price is monthly; a sale
   price is a total. Don't infer which one applies — if the agent didn't say,
   it's part of the required batched follow-up, not a guess.
7. **Blending facts across properties.** If facts for more than one
   property show up in the same request — a known consequence of rapid
   consecutive messages — give each property its own complete,
   clearly-labeled response rather than combining their facts together
   (see Never Blend Properties above). The problem is facts from different
   properties appearing in the same piece of content, not multiple
   listings appearing in the same reply.

## Verification Checklist

- [ ] All required facts present, or a single batched follow-up question was
      asked instead of guessing
- [ ] All three platforms produced (Instagram, Facebook, Yad2)
- [ ] Each platform has both a Hebrew and an English version, clearly labeled
- [ ] No fact appears that wasn't in the agent's input, including no
      upgraded condition/availability claims (e.g. "move-in ready") beyond
      what was actually said, and no inferred neighborhood highlights the
      agent didn't state
- [ ] Tone matches each platform's convention (see Output Format)
- [ ] Numbers use sqm and ₪ (unless told otherwise)
- [ ] Sale vs. rental is clear, and price phrasing (total vs. monthly)
      matches it
- [ ] No response's content blends facts from more than one property —
      each listing that appeared earlier in the conversation or mixed into
      the same message got its own separate, clearly-labeled response
- [ ] If a photo was attached, only visibly-true details were used — no
      invented condition/availability claims from the image
