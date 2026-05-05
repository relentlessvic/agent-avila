# Communication Hub Weekly Summary (template — COMM-HUB)

> **Author rule:** Orchestrator (Claude) DRAFTS this summary in chat. The operator publishes it to `#summaries` (or future Hermes after Gate-10 install). Autopilot does NOT auto-publish at COMM-HUB-DOCS-A activation.
>
> **No file is written, no commit, no push, no Discord publication results from drafting this summary.** The summary is conversation-only until the operator explicitly publishes it.

Author: Orchestrator (Claude); future Hermes after Gate-10
Channel: `#summaries`
Cadence: Once per UTC week (operator-defined start day), or operator-on-demand
Generated: `<UTC date>` covering window `<start UTC date>` to `<end UTC date>`

## Format

```
**Weekly summary — <start UTC date> to <end UTC date>**

PHASES OPENED / CLOSED THIS WEEK (by phase chain order):
- <phase-id> <opened/closed> at <timestamp> (<HEAD or "no commit">)
- ...

CODEX VERDICT ROLLUP:
- Total Codex rounds invoked: <n>
- PASS: <n>
- PASS WITH REQUIRED EDITS: <n> (each resolved with verbatim AFTER application + re-review PASS)
- FAIL: <n> (each resolved how?)
- Codex round-trips per phase: <list>

APPROVALS GRANTED THIS WEEK:
- Commit-time approvals: <n>
- Push approvals: <n>
- Production-action approvals: <n> (must be 0 unless a separate migration track is open)

COMMITS LANDED THIS WEEK:
- <count> commits; total +<insertions> / -<deletions>
- Per-phase breakdown if relevant.

PUSHES COMPLETED THIS WEEK:
- <count> pushes; three-way SHA consistency PASS for all.

HALTS / STOP CONDITIONS THIS WEEK:
- Per-halt-class breakdown.
- (or "No halts encountered this week")

DRIFT / ANOMALIES THIS WEEK:
- Per-observation breakdown.
- (or "No drift / anomalies this week")

PHASE-LOOP CEILING EVENTS:
- Ceiling fires this week: <list of timestamps and triggering phases>
- CEILING-PAUSE break events: <list of operator direction-confirmation events that broke the ceiling and reset the counter>
- Operator-directed manual phases this week: <list> (these do NOT advance the autopilot phase-loop counter)

FRAMEWORK ANOMALIES:
- ARC-8 stop conditions fired: <list>
- Codex sanity-check redactions: <list>
- Adversarial-input detection events: <list>
- Self-modification HARD BLOCK at-risk events: <list>

N-TRACK STATE (UNCHANGED unless explicitly noted):
- Migration 008: APPLIED at HEAD <SHA>
- N-3: closed
- All six prior production-action approvals: CONSUMED
- (any change to this state requires its own runbook + Codex review + fresh Victor approval)

ARC-8 STATE:
- Autopilot phase-loop counter at end of week: <n of 3 | CEILING-PAUSE active>
- Approval-fatigue queue at end of week: <n of 2>
- Autopilot runtime: DORMANT
- ARC-8 framework validation: <COMPLETE | per-event status>

COMM-HUB STATE:
- COMM-HUB-RULES.md: <committed at HEAD … | pending>
- Hermes: DORMANT (no install authorized)
- Trading channels (Category C): DORMANT (no source authorized)

HARD-LIMITS SANITY CHECK (weekly aggregate):
- Production DB actions: 0 unauthorized (any actions must be under explicit Victor approval per APPROVAL-GATES.md gate matrix; weekly aggregate confirms no such actions outside the closed N-3 track)
- Kraken actions: 0 unauthorized
- Env / secret changes: 0 unauthorized
- MANUAL_LIVE_ARMED changes: 0
- Autopilot runtime activation events: 0
- Scheduler / webhook / MCP / cron / Discord-bot install events: 0
- Working tree state at end of week: <clean except pre-existing snapshot | other>
```

## Forbidden content (mirrors `orchestrator/COMM-HUB-RULES.md` + `HANDOFF-RULES.md`)

This message MUST NEVER contain:

- Secrets, API keys, credentials.
- Production env values (`DATABASE_URL`, `MANUAL_LIVE_ARMED`, `KRAKEN_API_KEY`, `KRAKEN_API_SECRET`, etc.).
- Production-DB content (query results, row data, table dumps).
- Live Kraken endpoints, order IDs, position data, SL / TP / SELL_ALL values, balance.
- Migration-apply commands, runner invocations targeting production.
- Production DB write commands.
- Deploy triggers.
- Approval-like language not issued by Victor.
- Instructions to install / invoke triggers, MCP, schedulers, webhooks.
- Automation-widening instructions.
- `position.json` contents.

## Pre-publish Codex sanity check

Mandatory; same as daily summary.

## Rate limit

Maximum 1 weekly summary per UTC week. Higher rates require explicit operator instruction.

## What this template is NOT

Same as `COMM-HUB-DAILY-SUMMARY.md`. Not an approval, not a commit, not a publication, not authorization for any RED-tier action.
