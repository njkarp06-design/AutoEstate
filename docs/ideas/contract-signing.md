# Idea: in-chat contract signing (replace the agent's DocuSign subscription)

**Status: idea only.** Discussed 2026-07-28. Nothing built, no schema change, no
decision made, nothing account-level actioned. This file exists so the thinking
survives the session it happened in.

**How to use it:** paste everything below the line into a fresh session as the
opening prompt. It is written to be self-contained — a new session loads
`CLAUDE.md` automatically, and this carries the rest.

---

Context: exploratory idea only. Nothing has been built, no schema changed, no docs
updated, no decision made. Read CLAUDE.md, TODO.md and the latest session-handoff
first, then engage with the idea below. Do not write code or make changes — I want
to think this through with you. Verify claims rather than trusting my summary of
them (this repo's own rule); several of the technical assertions below came from a
prior session's reasoning and are worth re-checking against the vendored Hermes
code.

## THE IDEA (discussed 2026-07-28, not started)

Real estate agents currently pay a per-seat DocuSign subscription to send their
realtor fee / services agreement (הזמנת שירותי תיווך) to a client, who signs and
returns it. Idea: cut DocuSign out. The AutoEstate buyer bot delivers the contract
to the lead, who signs it and returns it through the same conversation — no third
party, no email round trip.

## WHY IT'S STRONGER THAN IT FIRST LOOKS

1. **Timing fits the buyer bot exactly.** In Israel the broker services order is
   supposed to be signed BEFORE showing the property — that's what protects the
   commission. That moment is precisely when the counterparty is an anonymous
   inbound stranger who just tapped a Yad2/Instagram ad and is now in a live
   WhatsApp thread with our buyer receptionist. DocuSign is at its worst there:
   email → spam folder → cold lead. The real pitch is speed-to-signature while the
   lead is warm, not the per-seat subscription saving.

2. **Identity is arguably better than DocuSign's.** A basic DocuSign envelope
   authenticates "you control this email address." Our buyer arrived on a verified
   WhatsApp number. For this market that's stronger evidence of who signed.
   NOTE: this does NOT hold on Telegram — Phase 0 established Telegram sessions
   carry a numeric `user_id` + `display_name` and no dialable number. The feature
   is materially weaker on that channel.

3. **The addressable behavior is probably bigger than the DocuSign install base** —
   suspicion (unvalidated) is that most Tel Aviv agents don't use DocuSign at all,
   they photograph a signed page and send it on WhatsApp. If true, the pitch
   changes from "save a subscription" to "stop losing signatures."

## ARCHITECTURAL CONCLUSION: SEND IN CHAT, SIGN ON A LINK

(a) **The bot CAN send the contract as a real attachment** — this corrects an
    earlier read of mine that said it couldn't. Verified in the vendored source on
    2026-07-29, not assumed: outbound file delivery is triggered by the model
    emitting `MEDIA:<abs path>` in its reply TEXT; the gateway strips the tag and
    dispatches the file (`gateway/run.py` → `adapter.extract_media` →
    image/video/`send_document` partition, `gateway/platforms/base.py:1440-1460`).
    Documents/PDFs are an explicitly supported class, and `[[as_document]]` forces
    document delivery. It is NOT a tool and NOT a hook — which is why it doesn't
    show up when you go looking for a send hook, and why PR #28's "no delivery
    hook" finding (true, and still true for controlling message *boundaries*) does
    not settle this question.

    Three consequences, and together they still point at the link:

    - It is **model-triggered by emitting text**, which is precisely the class of
      action this repo has documented three times as unreliable to control by
      instruction. Making a legally binding contract's delivery contingent on the
      model choosing to emit a tag is the wrong mechanism.
    - It is **now locked down on this exact instance** — this was pending when the
      paragraph was first written and has since shipped. PR #67 (merged
      2026-07-29) sets `gateway.strict: true` **and** `trust_recent_files: false`
      on the buyer profile, because under Hermes's defaults a prompt-injected
      buyer could get the model to emit a path and exfiltrate the operator's
      `.env` or either profile's `state.db` — all three were measured as
      deliverable before the fix. Both keys are load-bearing: strict alone keeps a
      600s recency fallback, and `state.db` is rewritten every turn, so it stayed
      deliverable under strict until the second key was added. **Under that
      lockdown only files beneath the profile's cache roots are deliverable**,
      which is the constraint any contract-PDF delivery must design around.
    - So a contract PDF would have to be **written into the buyer profile's cache
      root by something other than the agent** — the instance has 3 tools and no
      file/terminal/code toolset, so it cannot produce one itself.

    Net: attachment delivery is available and is a genuine UX upgrade over a bare
    link (an agent expects to see the document), but it is a *delivery* option to
    evaluate later, not the mechanism the design should rest on. Read the
    commented lockdown block in `agent/profiles/autoestate-buyer/config.yaml`
    (and the "fourth isolation layer" section of that profile's README) before
    designing around it — the live config is machine-rewritten and comment-free,
    so the repo copy is the only place the reasoning survives.

(b) **The signing still cannot happen in chat, and this is the load-bearing
    blocker.** A signature captured as chat text ("reply YES to sign") is
    evidentially weak — no rendered document the signer demonstrably saw, no drawn
    mark, no ת.ז., no consent record. And the obvious inbound version (buyer sends
    back a photo of a signed page) is exactly the weak status quo this is meant to
    beat.

So the shape is: **THE BOT SENDS A LINK; THE SIGNING HAPPENS IN THE REPORTING
APP.**

    app.autoestate/sign/<token> → renders the contract → captures a drawn
    signature + ID number + explicit consent → records IP / user-agent /
    timestamps / the originating phone → produces a sealed PDF + audit
    certificate.

The reporting app already has the pieces: Next.js on Vercel, Neon, per-customer
scoping, and `proxy.ts` already maintains a public-route list for unauthenticated
routes. Key property of this split: the signing surface lives in Next.js, so it
adds **ZERO attack surface to the locked-down public Hermes buyer instance** —
that box keeps its 3 tools and its existing isolation untouched.

Synergy worth noting: WhatsApp Cloud API supports interactive CTA-URL buttons, so
"Sign now" can be a real button rather than a bare link. One more small argument
for the Cloud-API migration already decided on 2026-07-28 (TODO item 12b).

## THE TRIGGER MUST BE THE OPERATOR, NOT THE MODEL

Do not let the model decide who receives a legally binding fee agreement. This repo
has documented three separate times (the gateway footer-omission bug, PR #26, PR
#28) that in-context text does not reliably make the model withhold an action it
judges obviously helpful. "Only send the contract to a qualified lead" is exactly
that class of instruction, with a far worse failure mode than a bad caption.

Structural design instead: the operator triggers it — a button on the Inquiries
detail page, and/or a message on their own operator channel ("send the Rothschild
fee agreement to this lead"). The bot's only job is delivering the link, and then
**REFUSING TO DISCUSS THE CONTRACT AT ALL** — no explaining terms, no answering
legal questions, no negotiating the fee percentage. That's a new hard-defer class
the `buyer-inquiry` skill does not currently have.

## THE TWO THINGS THAT ACTUALLY DECIDE FEASIBILITY

1. **LEGAL (the real gate).** The Israeli Real Estate Brokers Law (חוק המתווכים
   במקרקעין, 1996) §9 requires a written order signed by the client, containing
   prescribed details, and the case law is strict: no valid signed order, no
   commission entitlement. Israel's Electronic Signature Law does recognise
   ordinary electronic signatures and a simple e-signature is generally fine for
   ordinary commercial contracts — but whether THIS flow satisfies §9 in a
   contested commission claim is a lawyer question, not one to reason through.
   This is the single document the customer's income depends on. If it doesn't
   hold, the failure surfaces months later as a customer losing a six-figure
   commission because of our product.

2. **WHO HOLDS THE AUDIT TRAIL.** DocuSign's actual product is not the signature
   pad — it's a NEUTRAL THIRD PARTY attesting to what happened. If AutoEstate
   hosts the record and the agent is AutoEstate's paying customer, a buyer
   contesting the commission can argue the record was manipulable by an interested
   party. Mitigations exist (append-only hash chain, RFC-3161 timestamp authority)
   but they're work, and it's still us attesting about us.

   **MIDDLE PATH WORTH PRICING:** keep the WhatsApp UX entirely, but put a
   pay-per-envelope e-sign API behind it (Dropbox Sign / Zoho Sign, or an Israeli
   certified provider such as Comsign if a certified-tier signature is ever
   wanted). Still cuts the per-seat subscription the customer pays today, still
   owns the conversion win, outsources the evidentiary burden to someone whose
   business is defending it. The per-envelope vs per-seat economics is the whole
   question — get CURRENT pricing, don't trust recalled figures.

## ROUGH BUILD SHAPE (sketch only, not designed)

- Per-customer contract template (fee %, terms, Hebrew RTL), editable in Settings.
- `SignatureRequest` model: customer, inquiry/lead, listing, IMMUTABLE SNAPSHOT of
  the rendered contract text (never a live reference to the template — a later
  template edit would otherwise rewrite history), token, status, sentAt, viewedAt,
  signedAt, signerName, ת.ז., signature image, IP, UA, originating phone.
- Public `/sign/<token>` route: no Clerk, added to `proxy.ts`'s public list, rate
  limited, expiring token.
- Signature capture: drawn canvas signature (a typed name reads as unserious for a
  broker order in this market) + explicit consent checkbox + ID number field.
- Render final PDF, hash it, store the hash, deliver a copy to both parties. The
  AUDIT CERTIFICATE is the thing that replaces DocuSign, not the signature pad.
- Notify the operator on signature — the `lib/notify-operator.ts` seam already
  exists.
- A Contracts page in the dashboard, status per lead.
- Hebrew RTL PDF generation is a known-annoying problem; budget for it.

## SCOPE FLAG

This moves AutoEstate from "marketing automation" into "contract execution."
Different liability profile, different sales conversation, and a bug stops being a
bad caption and starts being a wrong fee percentage on a binding document. Not a
reason to avoid it — a reason to do it deliberately, and probably not before the
Hetzner apply and the Vercel deploy are actually live.

## PROPOSED VALIDATION ORDER (before building anything)

1. Ask 2-3 real Tel Aviv agents what they actually use today for the fee agreement.
2. One lawyer hour on §9 + electronic signature validity. Cheapest possible
   de-risking of the only thing that can kill this outright.
3. Then decide self-hosted vs e-sign API. Everything else — schema, public signing
   page, operator trigger, dashboard status — is the same work either way.

## WHAT I WANT FROM YOU IN THIS SESSION

Pressure-test the above. Specifically: tell me where the reasoning is weak or where
I'm solving the wrong problem; work out whether `MEDIA:` attachment delivery is
worth using for the contract PDF at all given the lockdown in (a), or whether the
link alone is the whole answer; and help me decide between the self-hosted audit
trail and the e-sign-API middle path. Do not write code, change schema, or touch
docs yet.
