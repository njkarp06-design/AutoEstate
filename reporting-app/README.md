# reporting-app/

Read-only Next.js dashboard for a non-technical client to see what the AutoEstate agent has done — one row per WhatsApp/Telegram conversation, with the raw facts sent in and the actual generated content sent back.

## Data source

Reads directly from the `autoestate` Hermes profile's own SQLite database (`sessions` + `messages` tables) — no separate logging system. The path is set via `HERMES_STATE_DB_PATH` in `.env.local` (machine-specific, never committed).

Only `whatsapp`/`telegram` sessions are shown — CLI sessions (dev testing) are filtered out.

A run's status ("Completed" vs "In progress") is based on whether the agent has posted at least one reply yet, not on Hermes's own session `end_reason` — messaging sessions are long-lived chat threads that essentially never "close" the way a CLI session does, so that field isn't a meaningful signal here.

## Running locally

```bash
npm install
npm run dev
```

Open [http://127.0.0.1:3000](http://127.0.0.1:3000). Note: on this machine, `localhost` resolves to an unrelated app running on the same port over IPv6 — always use `127.0.0.1` explicitly.

## Structure

- `lib/db.ts` — read-only SQLite access (`better-sqlite3`).
- `app/page.tsx` — list of runs.
- `app/runs/[id]/page.tsx` — full transcript for one run, with the generated content rendered as markdown.

Both pages are forced dynamic (`export const dynamic = "force-dynamic"`) so they always reflect the live database rather than a build-time snapshot.
