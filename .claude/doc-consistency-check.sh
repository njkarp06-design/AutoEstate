#!/usr/bin/env bash
# Background doc-consistency checker for AutoEstate.
#
# Spawned by the Stop hook (async, non-blocking) after each turn. Reads
# CLAUDE.md, TODO.md and the current session-handoff file against the repo's
# real state and REPORTS contradictions to .claude/doc-findings.md. It
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
# Recursion guard: this script spawns `claude`, whose own Stop hook would
# spawn it again. AUTOESTATE_DOC_CHECK short-circuits the nested run.

set -u

[ -n "${AUTOESTATE_DOC_CHECK:-}" ] && exit 0

# Derive the project root from this script's own location rather than
# hardcoding it — the hook may be invoked from any cwd, and by a bash whose
# idea of "c:/" differs (Git Bash vs WSL).
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
FINDINGS="$PROJECT_DIR/.claude/doc-findings.md"
LOG="$PROJECT_DIR/.claude/doc-check.log"
STAMP_FILE="$PROJECT_DIR/.claude/.doc-check-stamp"

cd "$PROJECT_DIR" || exit 0

# Nothing committed or changed since the last check means nothing to compare.
HEAD_NOW="$(git rev-parse HEAD 2>/dev/null)"
DIRTY="$(git status --porcelain 2>/dev/null | head -c 1)"
LAST="$(cat "$STAMP_FILE" 2>/dev/null || echo none)"
if [ "$HEAD_NOW" = "$LAST" ] && [ -z "$DIRTY" ]; then
  exit 0
fi

# The handoff file is dated, so name the current one explicitly rather than
# leaving the agent to guess which of several is live.
HANDOFF="$(ls -1 "$PROJECT_DIR"/session-handoff-*.md 2>/dev/null | sort | tail -n 1)"
HANDOFF_NAME="$(basename "${HANDOFF:-none}")"

read -r -d '' PROMPT <<EOF
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
