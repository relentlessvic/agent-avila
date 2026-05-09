# Autopilot Discord Status (template — ARC-8 Channel 2)

> **Author rule:** Autopilot DRAFTS this message. The operator publishes (or autopilot publishes only after explicit Gate-10-class authority widening, which has NOT been granted as of ARC-8-DOCS-B). Autopilot does NOT auto-publish. Future automation (Ruflo, Relay, successors) MAY NEVER auto-publish (per `orchestrator/HANDOFF-RULES.md` future-automation rules and `orchestrator/AUTOPILOT-RULES.md` ARC-8 Discord rules).
>
> **No message substitutes for any approval gate.** This message is a status surface; it does not approve, authorize, or trigger any action.

Author: Autopilot (Claude orchestrator-process; DRAFT until operator publishes)
Channel: ARC-8 Channel 2 (operator-facing status / closeout)
Generated: `<UTC timestamp>`

## Format

One line per event with the fixed prefix `ARC-8: <phase-id> <event>`. Optional one-line context follows on a second line. Hard cap: 2 lines per event.

### Event types

- `PHASE_OPENED` — `ARC-8: <phase-id> opened (mode: <MODE>)`
- `PHASE_CLOSED` — `ARC-8: <phase-id> closed at HEAD <short-sha>`
- `CODEX_VERDICT` — `ARC-8: <phase-id> Codex returned <PASS | PASS WITH REQUIRED EDITS | FAIL>`
- `COMMIT_LANDED` — `ARC-8: <phase-id> commit <short-sha> staged-by-name (<n> files)`
- `PUSH_COMPLETED` — `ARC-8: <phase-id> pushed; origin/main = <short-sha>`
- `HALTED` — `ARC-8: <phase-id> HALTED (<halt-class>); see AUTOPILOT-HALT.md`

## Forbidden content (mirrors `orchestrator/HANDOFF-RULES.md` "Forbidden content")

This message MUST NEVER contain:

- Secrets, API keys, credentials, signed tokens, OAuth tokens, session cookies.
- Production env values (`DATABASE_URL`, `MANUAL_LIVE_ARMED`, `KRAKEN_API_KEY`, `KRAKEN_API_SECRET`, etc.).
- Production-DB content (query results, row data, table dumps).
- Live Kraken endpoints, order IDs, position data, SL / TP / SELL_ALL values, balance figures.
- Migration-apply commands, runner invocations targeting production, `psql` commands against production, `node scripts/run-migrations.js` against production.
- Production DB write commands (`INSERT`, `UPDATE`, `DELETE`, `TRUNCATE`, `DROP`, schema mutation).
- Deploy triggers (`railway deploy`, `railway up`, `railway run` against production, deploy webhook URLs, CI/CD deploy commands).
- Approval-like language not issued by Victor (e.g., "approved by Codex", "approved by automation", "approved by clean tree", "approved by green tests").
- Instructions to install or invoke triggers, MCP servers, schedulers, webhooks, hooks, or live transport.
- Instructions to widen automation authority.
- Position.json contents.

## Pre-publish Codex sanity check

Per `orchestrator/AUTOPILOT-RULES.md` ARC-8 "Discord channels and content rules", every Channel 2 message produced by autopilot is reviewed by Codex (lightweight forbidden-content check) before posting. If Codex flags forbidden content, the message is REDACTED and the redaction surfaced to the operator.

## Append-only history rule

Channel 2 messages are not edited or deleted after posting. If a correction is needed, a new message is posted with the prefix `ARC-8 correction: <phase-id> <correction>` referencing the prior message.

## Rate limit

Maximum 5 Channel 2 messages per phase. Higher rates require explicit operator instruction.

## What this template is NOT

- Not an approval signal of any kind.
- Not a packet (per `orchestrator/HANDOFF-RULES.md`); it is an external-channel status surface drafted from this template.
- Not authorization to publish to Discord without operator action; autopilot does not auto-publish.
- Not authorization to install a Discord bot, webhook, or any automated publishing surface; that requires Gate-10-class operator approval.
- Not canonical over `orchestrator/STATUS.md` / `orchestrator/CHECKLIST.md` / `orchestrator/NEXT-ACTION.md` / `git log`.
