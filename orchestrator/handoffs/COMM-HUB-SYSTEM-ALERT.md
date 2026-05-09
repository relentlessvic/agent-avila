# Communication Hub System Alert (template — COMM-HUB)

> **Author rule:** Orchestrator (Claude) DRAFTS this alert when a system stop condition fires (working-tree drift, three-way SHA inconsistency, autopilot stop-condition, framework anomaly). The operator publishes it to `#system-health`. Future Relay auto-publish for `#system-health` is authorized only after Gate-10 install.
>
> **No file is written, no commit, no push, no Discord publication results from drafting this alert.** The alert is conversation-only until the operator explicitly publishes it.
>
> Distinct from `orchestrator/handoffs/COMM-HUB-CODEX-WARNING.md`: that template covers Codex non-PASS verdicts specifically; this template covers everything else (drift, SHA inconsistency, working-tree-state-diverges, autopilot stop conditions, framework anomalies).

Author: Orchestrator (Claude); future Relay after Gate-10
Channel: `#system-health`
Generated: `<UTC timestamp>`

## Alert classes

| Class | Trigger | Severity |
|---|---|---|
| `WORKING_TREE_DRIFT` | `git status --short` shows an unexpected modification or untracked file outside the active phase scope | High |
| `THREE_WAY_SHA_FAIL` | local HEAD ≠ origin/main tracking ref ≠ `git ls-remote origin HEAD` | High |
| `AUTOPILOT_STOP` | Any of the ARC-8 stop conditions per `orchestrator/AUTOPILOT-RULES.md` ARC-8 (other than Codex FAIL — that goes to `COMM-HUB-CODEX-WARNING.md`) | High |
| `CEILING_PAUSE_CHANGE` | Phase-loop ceiling fires, or operator direction-confirmation breaks ceiling and resets counter | Medium |
| `APPROVAL_FATIGUE_QUEUE_LIMIT` | N=2 pending approval requests reached | Medium |
| `PHASE_LOOP_CEILING_REACHED` | 3 sequential autopilot-driven phases without operator direction change | Medium |
| `FRAMEWORK_ANOMALY` | Self-modification HARD BLOCK at risk; indirect self-modification at risk; adversarial input detected | High |
| `SCOPE_CREEP` | Files modified outside the active phase mode's allowed scope | High |
| `MIGRATION_008_STATE_ASSERT` | Periodic confirmation that Migration 008 remains APPLIED + N-3 closed (heartbeat alert; informational) | Low |

## Format

```
**ARC-8: <alert-class> at <phase-id-or-context>**

Class: <one of the alert classes above>
Severity: <Low | Medium | High>
Phase context: <phase-id or "no active phase">
Trigger evidence: <one-line summary; NO secrets / env values / prod-DB content / Kraken values>
Action taken: <halt-and-surface invoked | informational only | drift recorded; awaiting operator instruction>
Reference: full diagnostic in in-session chat or `orchestrator/handoffs/AUTOPILOT-HALT.md` (if autopilot HALT)

(NOTE: Pre-publish Codex sanity check pending; this draft has not been auto-published; not operator-published.)
```

## Forbidden content (mirrors `orchestrator/COMM-HUB-RULES.md` + `HANDOFF-RULES.md`)

This message MUST NEVER contain:

- Secrets, API keys, credentials.
- Production env values (`DATABASE_URL`, `MANUAL_LIVE_ARMED`, `KRAKEN_API_KEY`, `KRAKEN_API_SECRET`, etc.).
- Production-DB content.
- Live Kraken endpoints, order IDs, position data.
- Migration-apply commands, deploy triggers, runner invocations.
- Production DB write commands.
- Approval-like language not issued by Victor.
- Automation-widening instructions.
- `position.json` contents.
- File:line citations from drift-detection output that would expose prod content — abstracted summaries only.

## Pre-publish Codex sanity check

Mandatory; same as `COMM-HUB-CODEX-WARNING.md`.

## Halt-and-surface protocol

When a system alert triggers:

1. Orchestrator drafts the alert per the Format above.
2. Pre-publish Codex sanity check.
3. If Codex sanity-check PASS: operator publishes `#system-health` message manually (or future Relay after Gate-10).
4. Halt-and-surface as appropriate:
   - If autopilot-driven phase + High severity: invoke `orchestrator/handoffs/AUTOPILOT-HALT.md` per appropriate halt-class.
   - If operator-driven phase: surface in-session chat with the alert and recovery options.
   - If informational only (e.g., `MIGRATION_008_STATE_ASSERT` heartbeat): no halt needed; record-only.
5. Operator decides recovery in-session chat.

## Rate limit

Maximum 5 alerts per phase. Higher rates suggest system instability and require explicit operator instruction to continue.

## What this template is NOT

- Not an approval, not a commit, not a publication, not authorization for any RED-tier action.
- Not authorization to auto-recover.
- Not authorization to override safety-policy rules.
- Not canonical over `orchestrator/handoffs/AUTOPILOT-HALT.md` for autopilot stop conditions.
- Not canonical over `orchestrator/STATUS.md` / `orchestrator/CHECKLIST.md` / `orchestrator/NEXT-ACTION.md` for phase state.
