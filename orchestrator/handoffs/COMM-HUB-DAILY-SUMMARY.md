# Communication Hub Daily Summary (template — COMM-HUB)

> **Author rule:** Orchestrator (Claude) DRAFTS this summary in chat. The operator publishes it to `#summaries` (or future Relay after Gate-10 install). Autopilot does NOT auto-publish at COMM-HUB-DOCS-A activation.
>
> **No file is written, no commit, no push, no Discord publication results from drafting this summary.** The summary is conversation-only until the operator explicitly publishes it.

Author: Orchestrator (Claude); future Relay after Gate-10
Channel: `#summaries`
Cadence: Once per active day, or operator-on-demand
Generated: `<UTC date>`

## Format

```
**Daily summary — <UTC date>**

PHASES:
- <phase-id> opened (mode: <MODE>) at <timestamp>
- <phase-id> closed at HEAD <short-sha> at <timestamp>

CODEX VERDICTS RECEIVED:
- <phase-id> Round <N>: <PASS | PASS WITH REQUIRED EDITS | FAIL>
- (or "No Codex verdicts received")

APPROVALS:
- <phase-id> commit-time approval granted by Victor
- <phase-id> push approval granted by Victor
- (or "No approvals requested / granted")

COMMITS LANDED:
- <short-sha> <commit-message-prefix> (<n> files, +x / -y)
- (or "No commits landed")

PUSHES COMPLETED:
- <short-sha> pushed to origin/main; three-way SHA consistency PASS
- (or "No pushes completed")

HALTS / STOP CONDITIONS:
- <halt-class> at <phase-id>: <one-line summary>
- (or "No halts encountered")

DRIFT / ANOMALIES:
- <observation>: <one-line summary>
- (or "No drift detected")

N-TRACK STATE:
- Migration 008: APPLIED at HEAD <SHA>
- N-3: closed
- (unchanged unless a new migration track opens, which would require its own runbook + Codex review + fresh Victor approval)

ARC-8 STATE:
- Phase-loop ceiling: <n of 3 | FIRED | CEILING-PAUSE active>
- Approval-fatigue queue: <n of 2>
- Autopilot runtime: DORMANT
- CEILING-PAUSE: <ACTIVE | broken by direction confirmation at <timestamp>>

HARD-LIMITS SANITY CHECK:
- No production DB action: confirmed
- No Kraken action: confirmed
- No env / secret change: confirmed
- No MANUAL_LIVE_ARMED change: confirmed
- No autopilot runtime activation: confirmed
- No scheduler / webhook / MCP / cron / Discord-bot install: confirmed
- Working tree state: <clean except pre-existing snapshot | other>
```

## Forbidden content (mirrors `orchestrator/COMM-HUB-RULES.md` + `HANDOFF-RULES.md` Forbidden content)

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

Per `orchestrator/AUTOPILOT-RULES.md` ARC-8 Discord channels and content rules + `orchestrator/COMM-HUB-RULES.md` pre-publish sanity check rule, every daily summary draft is reviewed by Codex (lightweight forbidden-content + structure check) before posting. If Codex flags forbidden content or structural violations, the message is REDACTED and the redaction surfaced to the operator. Pre-publish sanity check is mandatory; cannot be skipped.

## Rate limit

Maximum 1 daily summary per UTC day. Higher rates require explicit operator instruction.

## What this template is NOT

- Not an approval signal of any kind.
- Not authorization to publish to Discord without operator action.
- Not authorization to install schedulers, webhooks, MCP, cron, or background automation.
- Not authorization to install Relay.
- Not authorization to break CEILING-PAUSE.
- Not canonical over `orchestrator/STATUS.md` / `orchestrator/CHECKLIST.md` / `orchestrator/NEXT-ACTION.md` / `git log`.
