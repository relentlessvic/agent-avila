# Communication Hub Codex Warning (template — COMM-HUB)

> **Author rule:** Orchestrator (Claude) DRAFTS this warning when Codex returns a non-PASS verdict (FAIL / FAIL-WITH-CONDITIONS / REJECT / PASS WITH REQUIRED EDITS that exceed scope). The operator publishes it to `#codex-warnings`. Future Hermes auto-publish for `#codex-warnings` is NOT authorized — warnings stay operator-published forever.
>
> **No file is written, no commit, no push, no Discord publication results from drafting this warning.** The warning is conversation-only until the operator explicitly publishes it.
>
> In parallel with this warning: the orchestrator HALTS the affected phase via `orchestrator/handoffs/AUTOPILOT-HALT.md` (if autopilot-driven) or surfaces the situation in-session (if operator-driven). No commit, push, or further Loop progression occurs while the warning stands unresolved.

Author: Orchestrator (Claude) — Codex verdict transcribed
Channel: `#codex-warnings`
Generated: `<UTC timestamp>`

## Format

```
**ARC-8: <phase-id> Codex returned <PASS WITH REQUIRED EDITS | FAIL | FAIL-WITH-CONDITIONS | REJECT>**

Phase: <phase-id>
Mode: <READ-ONLY AUDIT | DESIGN-ONLY | DOCS-ONLY | SAFE IMPLEMENTATION | HIGH-RISK IMPLEMENTATION | PRODUCTION ACTION>
Round: <N>
Verdict label: <one-line label>
Summary: <one-line summary of the finding — NO file:line citations exposing prod content; NO secret values; NO Kraken / DB / env values>
Action taken: <halt-and-surface invoked | required edits applied | recovery pending operator instruction>
Reference: full verdict in `orchestrator/handoffs/CODEX-VERDICT.md` (append-only); operator-facing detail in in-session chat

(NOTE: Pre-publish Codex sanity check pending; this draft has not been auto-published; not operator-published.)
```

## Forbidden content (mirrors `orchestrator/COMM-HUB-RULES.md` + `HANDOFF-RULES.md`)

This message MUST NEVER contain:

- Secrets, API keys, credentials.
- Production env values (`DATABASE_URL`, `MANUAL_LIVE_ARMED`, `KRAKEN_API_KEY`, `KRAKEN_API_SECRET`, etc.).
- Production-DB content (query results, row data).
- Live Kraken endpoints, order IDs, position data.
- Migration-apply commands, deploy triggers, runner invocations.
- Production DB write commands.
- Approval-like language not issued by Victor.
- Automation-widening instructions.
- `position.json` contents.
- **File:line citations from the Codex verdict that would expose prod content** — verdicts citing prod-content lines should be summarized abstractly in the warning; full citations remain in the in-session chat where they are bounded by the broader chat context.

## Pre-publish Codex sanity check

Per `orchestrator/AUTOPILOT-RULES.md` ARC-8 + `orchestrator/COMM-HUB-RULES.md` pre-publish sanity check rule, every Codex warning draft is reviewed by Codex (lightweight forbidden-content + structure check) before posting. **This is a recursive Codex review of the warning text itself, ensuring no forbidden content leaks through.** Mandatory; cannot be skipped.

## Halt-and-surface protocol

When a Codex non-PASS verdict triggers a warning:

1. Orchestrator transcribes the verdict to `orchestrator/handoffs/CODEX-VERDICT.md` (append-only).
2. Orchestrator halts the affected phase:
   - If autopilot-driven: invoke `orchestrator/handoffs/AUTOPILOT-HALT.md` halt-class "Codex FAIL on a draft" (or appropriate variant).
   - If operator-driven: surface in-session chat with the verdict and recovery options.
3. Orchestrator drafts this warning per the Format above.
4. Pre-publish Codex sanity check on the warning text.
5. If Codex sanity-check PASS: operator publishes `#codex-warnings` message manually.
6. Operator decides recovery in-session chat:
   - Apply Codex required edits verbatim and re-delegate.
   - Override Codex (requires explicit operator override per `orchestrator/APPROVAL-GATES.md` "Operator override" — naming the action being authorized and acknowledging the Codex verdict).
   - Roll back autopilot-driven file modifications.
   - Abandon the phase.

## Rate limit

Maximum 1 warning per Codex round. If a single round produces multiple findings, they aggregate into one warning message with bullet points.

## What this template is NOT

- Not an approval, not a commit, not a publication, not authorization for any RED-tier action.
- Not authorization to override the Codex verdict (override requires explicit operator instruction acknowledging the verdict per `orchestrator/APPROVAL-GATES.md` "Operator override").
- Not authorization to auto-recover.
- Not authorization to install Hermes or any auto-publish role for `#codex-warnings`.
- Not canonical over `orchestrator/handoffs/CODEX-VERDICT.md`.
