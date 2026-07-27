#!/usr/bin/env bash
# On-demand doc-consistency checker for AutoEstate.
#
#   Usage:  .claude/doc-consistency-check.sh [--force]
#
# RUN IT BY HAND, typically before opening a PR. There is no hook in this repo
# and this script must not acquire one: all Claude Code hooks were removed on
# 2026-07-26 at the owner's request, and PR #33 — which wired this script to a
# Stop hook — was closed on those grounds. That was a mechanism objection, not
# a quality one, which is exactly why the script survived and the hook did not.
# The `.claude/settings.json` that used to sit beside this file (restoring BOTH
# the Stop hook and a UserPromptSubmit prompt-injector) was deleted on
# 2026-07-27. Do not reintroduce either.
#
# --force skips the "nothing changed since last run" short-circuit. A manual
# pre-PR run usually wants it: without it the script exits silently whenever
# HEAD hasn't moved and the tree is clean, which is a perfectly ordinary state
# to be in when you are about to open a PR.
#
# Reads CLAUDE.md, TODO.md and the current session-handoff file against the
# repo's real state and REPORTS contradictions to .claude/doc-findings.md. It
# deliberately never edits the docs and never commits:
#
#   - the main thread writes the reasoning (why a decision was made, what a
#     spike actually proved, what was deferred and why) — none of which is
#     recoverable from a diff
#   - this agent catches the mechanical failure: a fact updated in one file
#     and left stale in the other two. That risk is higher here than in a
#     two-file project, because this repo keeps THREE files in sync and the
#     handoff file restates status by design
#   - only one writer touches the docs, so there are no lost edits, and the
#     repo's branch-and-PR workflow is never bypassed by a background process
#
# Recursion guard: this script spawns `claude`, and AUTOESTATE_DOC_CHECK
# short-circuits a nested run. Vestigial while there is no hook, kept because
# it costs nothing and is exactly right if anyone ever invokes this from a
# session that could re-enter it.

set -u

[ -n "${AUTOESTATE_DOC_CHECK:-}" ] && exit 0

FORCE=""
case "${1:-}" in
  --force) FORCE=1 ;;
  "") ;;
  *) echo "usage: $(basename "$0") [--force]" >&2; exit 2 ;;
esac

# Derive the project root from this script's own location rather than
# hardcoding it — the hook may be invoked from any cwd, and by a bash whose
# idea of "c:/" differs (Git Bash vs WSL).
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
FINDINGS="$PROJECT_DIR/.claude/doc-findings.md"
LOG="$PROJECT_DIR/.claude/doc-check.log"
STAMP_FILE="$PROJECT_DIR/.claude/.doc-check-stamp"

LOCK_DIR="$PROJECT_DIR/.claude/.doc-check-lock"

cd "$PROJECT_DIR" || exit 0

# One run at a time. mkdir is atomic on every filesystem that matters, unlike
# a test-then-touch on a lockfile. Two concurrent runs would both write
# $FINDINGS and both append $LOG, and the slower one would silently win -
# discarding the other's report with nothing to show a report was lost.
if ! mkdir "$LOCK_DIR" 2>/dev/null; then
  echo "[$(date '+%Y-%m-%d %H:%M')] another doc check is already running, skipping" >> "$LOG"
  exit 0
fi
trap 'rmdir "$LOCK_DIR" 2>/dev/null' EXIT

# Nothing committed or changed since the last check means nothing to compare -
# unless --force, which a deliberate pre-PR run almost always wants: HEAD not
# having moved is the normal state when you are about to open a PR, and the
# silent exit looks identical to a clean bill of health.
HEAD_NOW="$(git rev-parse HEAD 2>/dev/null)"
DIRTY="$(git status --porcelain 2>/dev/null | head -c 1)"
LAST="$(cat "$STAMP_FILE" 2>/dev/null || echo none)"
if [ -z "$FORCE" ] && [ "$HEAD_NOW" = "$LAST" ] && [ -z "$DIRTY" ]; then
  echo "nothing changed since the last check; re-run with --force to check anyway." >&2
  exit 0
fi

# The handoff file is dated, so name the current one explicitly rather than
# leaving the agent to guess which of several is live.
HANDOFF="$(ls -1 "$PROJECT_DIR"/session-handoff-*.md 2>/dev/null | sort | tail -n 1)"
HANDOFF_NAME="$(basename "${HANDOFF:-none}")"

# `read -d ''` ALWAYS exits non-zero here: it stops at EOF without ever seeing
# the NUL delimiter it was told to wait for. That is expected and the variable
# is fully populated regardless - but it only survives because this script sets
# `set -u` and not `set -e`. The `|| true` makes that explicit, so adding `-e`
# later (the obvious hardening instinct) doesn't kill the script on this line.
read -r -d '' PROMPT <<EOF || true
You are auditing this repository's documentation for internal consistency.
Report only — do NOT edit CLAUDE.md, TODO.md or the handoff file, do NOT commit,
and do NOT create branches. Another process owns all writes.

IGNORE .claude/doc-findings.md and .claude/doc-check.log entirely. Those are your
own previous output. Do not read them, quote them, or describe what a previous
run found — you are auditing the docs, not your own history. Your report must
stand alone as if this were the first run.

The three files that must agree, and what each owns (per TODO.md's own routing):
  - CLAUDE.md            — the brief, phase status, architecture and security
                           decisions, conventions, lessons
  - TODO.md              — task status, order, sub-checklists
  - ${HANDOFF_NAME}      — where work stopped and what to pick up next

Read all three in full, then check them against the repository's actual state
(git log, the files under agent/, infra/ and reporting-app/, schema and config
files, README).

Look for exactly these problems:

1. CONTRADICTIONS between the three files, or between two sections of one file.
   The known failure mode: a fact is updated where the work happened and left
   stale elsewhere — most often the handoff file or a phase-status line in
   CLAUDE.md still describing a superseded state. Counts, dates, phase/task
   status words, and "still pending / now done" claims are the usual suspects.
2. Claims contradicted by the repo itself — a file or path said to exist that
   does not, a skill/plugin/model/table described as doing something its code or
   schema does not do, a command or config key named that no longer matches.
3. Anything described as open, blocked or pending that a later entry says is
   done, or the reverse. Note that this project deliberately distinguishes
   VERIFIED from ASSERTED — flag anything stated as proven whose stated evidence
   is missing, and anything a doc says needs a live spike but another doc treats
   as already confirmed.

Do NOT report: missing detail, style, wording you would have phrased
differently, or anything you merely think should be documented. Only real
inconsistencies where one statement makes another false.

Print your findings as your final message. Do not write any files — your output
is captured automatically. Use this shape:

<If and ONLY if you found nothing, print exactly: "No contradictions found." and
stop. Never print that line and then go on to describe a problem — if you have a
finding, the line must not appear at all.>

## <short title of the problem>
- **Where:** file + section or line
- **Says:** the stale claim, quoted
- **But:** what is actually true, and how you know
- **Fix:** the single edit that resolves it

Be terse. A finding nobody can act on in one edit is not a finding.
EOF

# Capture stdout straight into the findings file rather than asking the agent
# to write it — one less thing that can silently not happen. Read-only tools
# only, so this process cannot touch the docs even if it decides to try.
OUT="$(AUTOESTATE_DOC_CHECK=1 claude -p "$PROMPT" \
  --model haiku \
  --allowedTools "Read" "Grep" "Glob" "Bash(git log:*)" "Bash(git status:*)" "Bash(git diff:*)" "Bash(ls:*)" \
  --max-budget-usd 0.40 \
  --no-session-persistence 2>>"$LOG")"

if [ -z "$OUT" ]; then
  echo "[$(date '+%Y-%m-%d %H:%M')] doc check produced no output — see errors above" >> "$LOG"
  exit 0
fi

{
  echo "# Doc consistency findings — $(date '+%Y-%m-%d %H:%M')"
  echo
  echo "> Written by the background checker (.claude/doc-consistency-check.sh)."
  echo "> Report only — it never edits the docs and never commits."
  echo "> Action the findings, then delete this file."
  echo
  echo "$OUT"
} > "$FINDINGS"

echo "$HEAD_NOW" > "$STAMP_FILE"
echo "[$(date '+%Y-%m-%d %H:%M')] doc check complete -> $FINDINGS" >> "$LOG"

exit 0
