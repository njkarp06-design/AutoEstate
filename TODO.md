# AutoEstate — TODO

Task status, order, and sub-checklists. CLAUDE.md owns the brief/phase/architecture; the session-handoff file owns where work stopped. This file owns what's left to do.

Last updated: 2026-07-25.

---

## 🔜 Next up (in order)

### 1. (Optional) Close PR #28's turn-two live verification
Low-risk, not blocking. The no-locator sale/status confirmation-deferral fix is merged and turn one is verified live; only the confirming "yes" turn is unverified with plugin v1.4 in place.
- [ ] Send "Great news, the apartment sold! Make a sold post" from the operator's WhatsApp (no street name).
- [ ] Confirm the reply leads with the descriptive intro + confirmation question, and has **no** Listing Record footer.
- [ ] Reply "yes"; confirm the footer is appended and the **Ben Gurion** listing flips `ACTIVE` → `SOLD` (check `GET /api/listings/active` or the `Listing` row directly; dev id `cmry5rje00004u8u6ctv54q67`).
- [ ] Note: the Ben Gurion dev-DB listing is currently sitting `ACTIVE` and un-recorded mid-test — this step also cleans that up.

### 2. Buyer-inquiry auto-reply skill (last roadmap item, biggest scope)
An inbound skill: auto-respond to a prospective buyer's question about a listing. Deliberately last — it's a different product shape from everything so far (inbound, not outbound marketing content).
- [ ] Design the **new inbound trust surface**: a sender/allowlist model distinct from the current operator-only allowlist (a buyer is not the operator).
- [ ] Decide the guardrails: what it may answer from listing data vs. when it must defer to the human agent; never invent facts (same no-recall/no-invention discipline as the other skills).
- [ ] Plan via plan mode with an explicit adversarial self-review before implementing (standing expectation).
- [ ] Confirm reporting-app impact (likely a new interaction type to display).
- [ ] Build, test via `hermes -z`, then real live-WhatsApp test with go-ahead.

---

## 🚀 Before onboarding a real customer (deferred, not blocking dev)

### 3. `terraform apply` to a real Hetzner account
Infra module (`infra/modules/hermes-instance/`) is written and validated (`terraform validate`/`fmt` clean) but **never applied** — no real Hetzner account exists yet.
- [ ] Create a Hetzner Cloud account (account-level action — needs user sign-off).
- [ ] `terraform apply` a first per-customer instance and verify boot/cloud-init/secret-injection end to end.

### 4. Deploy the reporting app to Vercel Pro
Still `npm run dev`-only (local, port 4127).
- [ ] Set up the Vercel Pro project (account-level — needs user sign-off).
- [ ] Wire Neon Postgres + Clerk production env vars.
- [ ] Deploy and verify authenticated multi-tenant access.

---

## 🔒 Phase 5 — deferred security hardening (revisit before public exposure)

### 5. OS-level isolation
`terminal.backend: local` — no sandboxing; Hermes's own docs call this "outside the supported security posture" for an agent ingesting external messages. Deferred because containerizing this Windows prototype would likely be redone once a real Linux deployment target is picked (see item 3).
- [ ] Containerize / isolate on the real deployment target when it exists.

### 6. Supply-chain dependency CVEs
`hermes security audit` flagged 48–50 CVEs in pinned upstream packages (several HIGH). None currently reachable (no exposed HTTP surface, no MCP servers, no real image processing, allowlist-gated senders). `hermes update` doesn't touch the upstream-locked versions.
- [ ] Re-run `hermes security audit` and reassess once public exposure and/or MCP servers make any of these bugs reachable.

### 7. Official WhatsApp Business Cloud API
Currently on the **Baileys/QR bridge** (unofficial, carries a ban risk, mitigated by a throwaway eSIM number). Fine for the prototype; a real public product needs the official API.
- [ ] Migrate to the official WhatsApp Business Cloud API (needs a real public server + Meta Business Verification).

---

## 💤 Deferred further still

### 8. Real Instagram auto-posting
The reporting app has a per-platform Instagram post-action preference, but the auto-post options are inert ("coming soon"). Facebook Group and Yad2 stay permanently manual (Meta retired third-party Group posting in 2024; Yad2 has no posting API).
- [ ] Requires Meta Business Verification (an account-level commitment not yet made) before this can be built.

---

## 🧰 Repo tooling / docs automation

### 9. End-of-session hook that updates README.md
Wanted 2026-07-25. The doc-sync hook keeps `CLAUDE.md`, `TODO.md` and the session-handoff file current *during* a session, but `README.md` is untouched by it and drifts. Goal: refresh the README properly when a session ends.

- [ ] Confirm the mechanism. A `Stop` hook is the likely fit (fires when a session finishes) — check the current Claude Code hooks reference via `/hooks` rather than assuming, since `UserPromptSubmit` (what doc-sync uses) is the wrong event for this.
- [ ] Resolve the core design problem before building: a hook runs a **shell command**, so it cannot write good prose by itself. It must either (a) feed instructions back to the model and let it make the edit, or (b) run a deterministic script that regenerates only mechanical sections. Pick one — (b) is more reliable, (a) is more useful.
- [ ] Decide what "properly" means, i.e. which README sections are hook-owned vs. hand-written. README is the **public-facing** description; CLAUDE.md is the internal brief. Blindly syncing internal state into it would leak working detail and make it worse, not better.
- [ ] Decide churn tolerance — a README rewritten every session makes noisy diffs in a history that is otherwise meaningful PRs. Consider firing only when something user-visible actually changed.
- [ ] Make it respect the branch-and-PR workflow (never commit straight to `main`), same as the doc-sync hook.
- [ ] Verify it fails open — a `Stop` hook that errors or blocks makes ending a session painful.

---

## 🐛 Known small issues / awareness (not blocking, no owner yet)

- [ ] **Batched-follow-up rule occasionally violated:** the agent sometimes asks for missing facts (e.g. rooms, then sqm) as separate single-field questions instead of one batched question. Pre-existing, flagged in PR #26, unrelated to the locator feature.
- [ ] **Reporting-app platform parser misses some real headers:** `platform-content.ts` doesn't always recognize plain-caps `INSTAGRAM` / `עברית:` headers (vs. the spec's bold/ATX format), so an occasional real reply fails to split into platform sections. The Listing-record parser is independently robust; this only affects the platform-split display.
- [ ] **`app/page.tsx` Activity list still `max-w-3xl`:** PR #17 was believed to have widened it to `max-w-5xl`, but only its empty-state branch was widened. One-line fix, left out of scope.
- [ ] **Anthropic Console auto-reload billing not confirmed enabled:** the `autoestate` profile's API credits have run dry repeatedly across sessions, causing live outages. Recommended enabling auto-reload at console.anthropic.com — not confirmed done.
- [ ] **Gateway silently depends on ambient Claude Code OAuth credentials:** the profile's own `ANTHROPIC_API_KEY` keeps going dry and the `credential_pool` is empty, so the gateway falls back to the machine's ambient Claude Code OAuth login. Fragile single point of failure for a customer-facing bot — restarting the gateway from a Claude Code agent environment has knocked this out and caused a full outage before.

---

## ✅ Done (recent, for context)

- Weekly-digest skill + Listing tracking (PR #19/#21/#22/#23) — real Listing data flowing end-to-end.
- Re-engagement / just-sold skills (PR #25) — live-tested.
- Locator-based listing lookup (PR #26) — name a listing instead of retyping facts.
- No-locator confirmation-deferral fix (PR #28) — rule moved into the always-injected `listing-footer-reminder` plugin (v1.4); turn one verified live.
