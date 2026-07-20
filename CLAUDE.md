# CLAUDE.md — Project Brief

> Two things still open, to decide together before real work starts: a **project name** and the **specific first workflow** (Phase 2).
>
> **Decided:** target industry = **independent real estate agents in Tel Aviv** (not big franchises/agencies). Rationale: sharp recurring pain (constant listing content, no time to produce it), WhatsApp/Facebook-group-native distribution fits the local market, ~450-570 agents in Tel Aviv is a large enough market with warm local network access for a pilot.

## 1. What we're building
I'm building a **productized marketing-automation service**. At its core is a **Hermes agent** — an open-source, CLI-based AI agent — that runs one end-to-end marketing process for a client automatically. Around that core sit two things: **secure configuration** (the client's data and credentials handled properly) and a **small reporting web app** so a non-technical person can see what the agent is doing and trust it.

The end goal: package this cleanly enough to demo and pitch to companies — starting with industries slow to adopt tech — as a finished product that delivers real, visible value.

## 2. Who it's for (so your decisions make sense)
The buyer and end-user is a **non-technical marketing lead** at a small or mid-size company. That drives every decision:
- It must be **simple to observe and trust** — clear outputs, visible results.
- It must be **secure by default** — their data, their credentials, never exposed.
- The value must be **visible** — that's the job of the reporting screens.

Optimise for legibility and trust over cleverness.

## 3. How to work with me
I'm a full-stack engineer: JS/TS, Node/Express, Next.js, Python, PostgreSQL, AWS/Terraform, git. Don't over-explain fundamentals — but **do** surface non-obvious tradeoffs, and **flag before any significant architecture, dependency, or security decision**. I want to understand and sign off on every real choice. Keep it simple: no premature abstraction, no over-engineering. Small, reviewable commits.

**My git workflow (follow it exactly):**
`git checkout main` → `git pull` → `git checkout -b feat/<task>` (existing branch: drop the `-b`) → work → `git add .` → `git commit -m "..."` → `git push -u origin feat/<task>` → open a PR into main. One feature branch per task.

## 4. Verify the ground truth before building
I'm working partly from second-hand sources about Hermes, so **before writing any code**, find and read the **official Hermes documentation** and confirm:
- what Hermes actually is and who maintains it,
- how it's installed and run (CLI / local machine / VPS),
- how skills, scheduled jobs, MCP connectors, and messaging channels really work,
- its security model — where secrets live, how auth works, how it's sandboxed.

Report back in plain English, and **flag anything that contradicts the assumptions in this brief**. Don't build on guesses.

## 5. Build order — bottom-up, one layer at a time
Do **not** skip ahead. Finish and confirm each phase with me before starting the next.

- **Phase 0 — Foundation:** clean repo, README, `.gitignore`, environment/secret scaffolding (secrets never committed). Nothing functional yet.
- **Phase 1 — Hermes running bare:** install Hermes, get the simplest possible agent responding. Prove the core works before adding anything.
- **Phase 2 — One real workflow:** automate **one** concrete marketing process fully, as a Hermes skill — input → action → output. Just one, done properly. (We choose which one together.)
- **Phase 3 — Security hardening:** lock down secrets, credentials, network, and access. This is a **first-class phase, not an afterthought** — it's the actual product differentiator.
- **Phase 4 — Reporting screens:** a small Next.js app that surfaces what the agent did — runs, outputs, status — for a non-technical viewer. Read-only, simple, clear.
- **Phase 5 — Packaging:** make it demoable and repeatably deployable — clean setup, docs — so I can stand it up in front of a prospect.

**We are at Phase 0.**

## 6. Guardrails
- Simplicity over cleverness — smallest thing that works, then iterate.
- Security is never optional and never last.
- Never silently choose an architecture, dependency, or service — explain, then let me decide.
- **Never** take irreversible or account-level actions (deploys, purchases, deleting data, adding credentials to third-party services) without asking me first.
- Prefer boring, well-supported tools over shiny ones.

## 7. Your first task
1. Set up **Phase 0**: propose a repo structure and initial scaffold, keeping the **agent** and the **reporting app** as clearly separated concerns.
2. Do the **Section 4 doc-check**: read the official Hermes docs and report what's real vs. what this brief assumed.
3. Recommend the **single best marketing process to automate first** for a Phase-2 MVP, with your reasoning.

Don't write feature code yet — lay the foundation and align with me first.
