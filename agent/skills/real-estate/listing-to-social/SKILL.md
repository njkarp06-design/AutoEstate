---
name: listing-to-social
description: Use when a real estate agent provides new listing details (facts about a property, and optionally photo descriptions) and wants ready-to-post content. Turns raw listing facts into platform-formatted Hebrew and English captions for Instagram, a Facebook group, and Yad2.
version: 0.1.0
author: AutoEstate
license: MIT
metadata:
  hermes:
    tags: [real-estate, social-media, content-generation, hebrew, tel-aviv]
    related_skills: []
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
- **Rooms** and **size in sqm**
- **Price** (in ₪ unless told otherwise)
- **Floor** (and whether there's an elevator, if known)
- At least one or two **standout features** (renovated kitchen, balcony,
  parking, view, etc.)
- Optional: condition, nearby highlights (park, beach, transit), photo
  descriptions, contact info to include

If the agent's message is missing something on this list, ask a single
follow-up question batching everything missing — don't generate partial
content and don't guess.

## Output Format

Produce all three, each with a Hebrew version first and an English version
second, clearly labeled with headers. Do not skip a platform or a language
unless the agent explicitly asks for only one.

**1. Instagram caption**
Short (3-5 sentences), engaging, light emoji use (not excessive), ends with
5-8 relevant hashtags mixing Hebrew and English (e.g. #תלאביב #דירהלמכירה
#TelAvivRealEstate). No formal structure — reads like a post, not a listing.

**2. Facebook group post**
Slightly longer and more conversational than Instagram, no hashtags. Israeli
Facebook real-estate groups expect a clear structure: a one-line hook,
then a short bullet list of key facts (rooms, size, price, floor), then a
closing line with a call to action ("לפרטים ותיאום צפייה..." / "For details
and viewing..."). Include contact info only if the agent provided it.

**3. Yad2-style listing description**
Formal and factual — this is a property listing, not a social post. No
emoji, no hashtags. Structured as short paragraphs: location and property
type, then rooms/size/floor/price, then condition and features, then
nearby highlights if given. Matches how a serious buyer scans a listing
site.

## Common Pitfalls

1. **Inventing facts.** Never add a price, room count, address detail, or
   feature that wasn't given. If it's ambiguous, ask rather than assume.
2. **Skipping a language or platform.** All three platforms, both
   languages, every time, unless explicitly told otherwise.
3. **Wrong tone per platform.** Don't write Yad2's formal listing tone for
   Instagram, or Instagram's casual tone for Yad2 — see Output Format above.
4. **Exclusionary phrasing.** Describe the property, not an "ideal" tenant
   or buyer (e.g. avoid phrasing that implies preference by family status,
   religion, or similar) — keep language about the property's features, not
   who should live there.
5. **Wrong units/currency.** Sqm, not sqft. ₪, not $, unless told otherwise.

## Verification Checklist

- [ ] All required facts present, or a single batched follow-up question was
      asked instead of guessing
- [ ] All three platforms produced (Instagram, Facebook, Yad2)
- [ ] Each platform has both a Hebrew and an English version, clearly labeled
- [ ] No fact appears that wasn't in the agent's input
- [ ] Tone matches each platform's convention (see Output Format)
- [ ] Numbers use sqm and ₪ (unless told otherwise)
