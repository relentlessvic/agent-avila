# Communication Hub Rules (COMM-HUB)

Canonical specification for the Agent Avila Communication Hub — a Discord-centered control-room surface for project updates, approval requests, Codex warnings, summaries, and system alerts.

This file is a safety-policy doc (per `orchestrator/PROTECTED-FILES.md`). Edits require Codex docs-only review **and** explicit operator approval before commit.

Last updated: 2026-05-05 (COMM-HUB-DOCS-A — DOCS-ONLY operator-directed manual phase; pending Codex docs-only review and operator approval before commit).

## Purpose

The Communication Hub gives Victor a single, professional, operator-private channel set for receiving:

- Project updates (phase opened / closed, commits landed, pushes completed)
- Codex warnings (non-PASS verdicts, halts, scope creep)
- Approval requests (autopilot-drafted or operator-driven; approval still occurs in-session in chat)
- Phase summaries (daily / weekly recaps)
- System alerts (drift, failures, halt-and-surface conditions)
- Future trading / status notifications (DORMANT until separate gated track activates them)

The hub formalizes the ARC-8 Channel 1 + Channel 2 patterns from `orchestrator/AUTOPILOT-RULES.md` ARC-8 section into actual Discord plumbing while preserving the architecture's strict separation between **communication** (Discord), **governance** (orchestrator/* docs + Codex), and **trading runtime** (`bot.js` + Kraken + production DB).

## Classification

The Communication Hub is:

- **Operator-private.** Server invite list is Victor-only at activation; no public channels; no third-party guests; no integrations beyond explicitly-gated bot installs.
- **Governance / comms layer only.** It is NOT a trading interface. It does NOT enter the live trading hot path. Live order decisions are made by `bot.js` + the operator + Kraken — not by Discord, not by any Discord bot, not by any future automation.
- **A delivery channel for status and a draft surface for approval requests** — never the approval channel itself. A Discord reply, emoji, or reaction is NEVER operator approval. Only Victor's in-session chat instruction grants approval (per `orchestrator/APPROVAL-GATES.md` "What is NOT operator approval" and `orchestrator/AUTOPILOT-RULES.md` ARC-8 Discord rules).
- **Read-from-the-system-side only at activation.** The system writes summaries; the operator publishes them. Auto-publish is gated behind separate operator-approval (Relay install, Gate-10-class authority widening).

## Channel architecture

Three categories, seven channels:

### Category A — `#governance` (high-signal, low-volume)

| Channel | Purpose | Append-only? | Rate limit |
|---|---|---|---|
| `#approvals` | One message per pending Victor decision; ARC-8 Channel 1; format per `AUTOPILOT-DISCORD-APPROVAL.md` template; pre-publish Codex sanity check mandatory | No (each request is independent) | Max 1 per pending Victor decision |
| `#status` | One line per phase event (PHASE_OPENED, PHASE_CLOSED, CODEX_VERDICT, COMMIT_LANDED, PUSH_COMPLETED, HALTED); ARC-8 Channel 2; format per `AUTOPILOT-DISCORD-STATUS.md` template | Yes | Max 5 messages per phase |
| `#codex-warnings` | High-priority Codex non-PASS verdicts, halt conditions, scope-creep flags; format per `COMM-HUB-CODEX-WARNING.md` template; distinct from `#status` so warnings aren't lost in event flow | Yes | Max 1 per Codex round |

### Category B — `#operations` (medium-volume)

| Channel | Purpose | Append-only? | Rate limit |
|---|---|---|---|
| `#summaries` | Daily / weekly phase summaries; rolled-up commit / push / Codex / approval activity; format per `COMM-HUB-DAILY-SUMMARY.md` and `COMM-HUB-WEEKLY-SUMMARY.md` templates | Yes | Max 1 daily + 1 weekly |
| `#system-health` | System alerts: working-tree drift, three-way SHA inconsistency, autopilot CEILING-PAUSE state changes, autopilot stop-condition fires, framework anomalies; format per `COMM-HUB-SYSTEM-ALERT.md` template; distinct from `#codex-warnings` | Yes | Max 5 per phase |

### Category C — `#future-trading` (DORMANT until separate gated track activates)

| Channel | Status | Activation gate |
|---|---|---|
| `#trading-alerts` | DORMANT — no source authorized | Multi-gated: trading-track activation + Relay/Trading-Writer install + per-message Victor approval |
| `#trading-summaries` | DORMANT — no source authorized | Same multi-gate |

Channel descriptions for both Category C channels MUST prominently state "DORMANT — no source authorized" so accidental publishes are visibly impossible (the channel literally has zero history at activation).

## Role / permission model

| Role | Members | Read | Write | Active at COMM-HUB-DOCS-A? |
|---|---|---|---|---|
| **CEO** | Victor | All channels | All channels | Yes |
| **Hub-Read** | Victor (alt account, mobile) | All channels | None | Yes (read-only) |
| **System-Writer** | Future Relay / scheduled summarizer | None | `#status`, `#summaries`, `#system-health` (write-only after Relay install) | DORMANT |
| **Codex-Writer** | Future Codex-publish role | None | `#codex-warnings` (after separate gate) | DORMANT |
| **Trading-Writer** | DORMANT | None | `#trading-alerts`, `#trading-summaries` (after multiple gated phases) | DORMANT |

**Key principles:**

- **Victor is the only role with write access at COMM-HUB activation.** All system writers are DORMANT roles defined for future use; their actual install requires separate operator approval per `orchestrator/APPROVAL-GATES.md` Gate 10 (automation install / upgrade) and `orchestrator/AUTOMATION-PERMISSIONS.md` future-automation rules.
- **No Discord role can self-promote.** Adding a role to a member is a Victor-only operation.
- **Codex / ChatGPT / Gemini do NOT have direct Discord roles.** They draft via the orchestrator (Claude); Claude routes to operator publication. This preserves `orchestrator/ROLE-HIERARCHY.md` no-AI-direct-action and `orchestrator/HANDOFF-RULES.md` packets-not-transports rules.
- **No bot has DM / impersonation rights.** Bots operate only within their channel scope.
- **The `@everyone` role has NO write access on any channel.** Even Victor-as-CEO posts are deliberate; the channel default is read-only-for-most.

## Message types

| Type | Channel | Author (drafts) | Publisher | Approval needed |
|---|---|---|---|---|
| Approval request | `#approvals` | Orchestrator (Claude) | Victor (manually publishes after Codex sanity-check PASS); reply still in-session chat | Drafting GREEN; publishing requires explicit Victor direction |
| Status event | `#status` | Orchestrator (Claude); future Relay after Gate-10 | Victor (or future Relay after Gate-10 approval) | Drafting GREEN; publishing requires explicit Victor direction (or future Relay Gate-10 approval) |
| Codex warning | `#codex-warnings` | Codex verdict transcribed by orchestrator (Claude) | Victor (Relay auto-publish NOT authorized for warnings — too high-stakes) | Drafting GREEN; publishing requires explicit Victor direction |
| System alert | `#system-health` | Orchestrator on autopilot stop condition / drift detection | Victor (or future Relay after Gate-10) | Same |
| Daily summary | `#summaries` | Orchestrator (Claude); future Relay after Gate-10 | Victor (or future Relay after Gate-10) | Same |
| Weekly summary | `#summaries` | Same as daily | Same as daily | Same |
| Trading alert | `#trading-alerts` | DORMANT (no active source) | DORMANT | Triple-gated: trading-track activation + Trading-Writer install + per-message Victor approval |
| Trading summary | `#trading-summaries` | DORMANT (no active source) | DORMANT | Same triple-gate |

## Forbidden content (mirrors `orchestrator/HANDOFF-RULES.md` "Forbidden content")

Every Discord message — across every channel and message type — MUST NEVER contain:

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
- `position.json` contents.

## Pre-publish Codex sanity check (mandatory)

Per `orchestrator/AUTOPILOT-RULES.md` ARC-8 "Discord channels and content rules", every Discord message produced by the orchestrator (or any future automation) is reviewed by Codex (lightweight forbidden-content + structure check) before posting. If Codex flags forbidden content or structural violations, the message is REDACTED and the redaction surfaced to the operator.

The pre-publish sanity check is a Round-3-equivalent gate per the ARC-8 four-round Codex pattern. It is mandatory and CANNOT be skipped.

## Approval-request workflow

```
1. Phase / event triggers a need for operator approval.
2. Orchestrator (Claude) drafts the request:
   a. OPERATOR-APPROVAL-PACKET.md per HANDOFF-RULES.md (in-session chat surface).
   b. AUTOPILOT-DISCORD-APPROVAL.md draft for #approvals channel.
3. Codex pre-publish sanity check on the Discord draft:
   - Forbidden-content scan.
   - Hard-limits-restated check.
   - Approval-field-NOT-marked check.
   - Victor-as-only-approver clause check.
   - Discord-reply-NOT-approval clause check.
4. If Codex PASS:
   - Operator publishes the #approvals message manually (or future Relay after Gate-10).
   - Orchestrator surfaces the in-session OPERATOR-APPROVAL-PACKET in chat.
5. Operator responds in-session chat (NOT in Discord) with Option 1 / 2 / 3 / instructions.
6. Orchestrator executes the approved action (stage by name + commit; push as separate gate).
7. After execution:
   - Orchestrator drafts #status PHASE_CLOSED + COMMIT_LANDED + PUSH_COMPLETED messages.
   - Operator publishes (or future Relay after Gate-10).
8. If Codex FAIL on the pre-publish sanity check:
   - Halt-and-surface via AUTOPILOT-HALT.md.
   - No publication; no commit; no execution.
   - Operator decides recovery in-session chat.
```

**Critical:** Discord acknowledgment / reaction / emoji / reply is NEVER approval. Per `orchestrator/AUTOPILOT-RULES.md` ARC-8 + `orchestrator/APPROVAL-GATES.md` "What is NOT operator approval", only Victor's in-session chat instruction grants approval. The Discord message is a structured request surface; approval is in chat.

## Codex warning / halt workflow

```
1. Codex returns non-PASS (FAIL / FAIL-WITH-CONDITIONS / REJECT / PASS WITH REQUIRED EDITS that exceed scope) on any artifact.
2. Orchestrator transcribes the verdict to CODEX-VERDICT.md (append-only).
3. Orchestrator drafts a #codex-warnings Discord message per COMM-HUB-CODEX-WARNING.md template:
   - Phase ID + round + verdict label
   - One-line summary of the finding (no file:line citations exposing prod content)
   - Reference to in-session chat for full verdict
4. Pre-publish Codex sanity check on the warning text itself.
5. If Codex sanity-check PASS:
   - Operator publishes #codex-warnings message.
   - In parallel: orchestrator halts the affected phase via AUTOPILOT-HALT.md (if autopilot-driven) or surfaces in-session (if operator-driven).
6. If autopilot-driven phase: HALT-AND-WAIT applies; no commit, push, or further Loop progression.
7. Operator decides recovery in-session chat.
```

## Daily / weekly summary workflow

```
Daily summary:
1. Orchestrator (Claude) drafts a summary in chat at operator-defined cadence (once per active day, or operator-on-demand).
2. Format per COMM-HUB-DAILY-SUMMARY.md template.
3. Forbidden-content scan + Codex pre-publish sanity check.
4. Operator publishes #summaries message manually.

Weekly summary:
- Same flow with broader window (7-day rollup) per COMM-HUB-WEEKLY-SUMMARY.md template.
- Includes phase-loop ceiling fire events, CEILING-PAUSE state changes, framework anomalies.

Future automation: after explicit Victor approval to install Relay (Gate 10), summaries auto-post to #summaries on cron. Until then: operator-published only.
```

## System-alert workflow

```
1. Stop condition fires (working-tree drift, three-way SHA inconsistency, autopilot stop-condition, framework anomaly).
2. Orchestrator drafts a #system-health message per COMM-HUB-SYSTEM-ALERT.md template.
3. Pre-publish Codex sanity check.
4. Operator publishes (or future Relay after Gate-10).
5. Halt-and-surface via AUTOPILOT-HALT.md if autopilot-driven; in-session surface if operator-driven.
```

## Future Relay integration point

**Canonical Relay spec:** `orchestrator/COMM-HUB-RELAY-RULES.md` (SAFE-class; filename retains `HERMES` literal pending COMM-HUB-RENAME-RELAY-FILES Phase B). The summary below is intentionally short; the canonical spec carries the full capability matrix, anti-execution boundaries, approval discipline (per-message through Stage 9; bounded class only at Stage 10a/10b with 7 documented bounds), idempotency mechanism (orchestrator-side keys + Relay-private append-only publish logs; **no Discord-side reads**), and staged activation path. If this section diverges from the canonical Relay spec, the canonical spec wins for Relay-specific detail.

**Relay** is the proposed future scheduled-summarizer / Discord-publisher role. Currently DORMANT.

Activation gate (when operator chooses to install Relay):

1. Separate dedicated COMM-HUB-HERMES-DESIGN-ONLY phase.
2. Codex docs-only review.
3. Explicit Victor approval per `orchestrator/APPROVAL-GATES.md` Gate 10 (automation install / upgrade).
4. Relay inherits ARC-8 Discord rules verbatim — no auto-publish without operator approval per channel-class; rate limits enforced; pre-publish Codex sanity check mandatory; no role can self-promote; no role can mark approval fields.
5. Phase-loop ceiling discipline: Relay is governance-only / future-automation per `orchestrator/AUTOMATION-PERMISSIONS.md` future-automation rules; cannot self-execute; cannot become a trading actor.

Scope when activated:

- `#status` PHASE_OPENED / PHASE_CLOSED / CODEX_VERDICT / COMMIT_LANDED / PUSH_COMPLETED auto-publish (after Codex sanity check).
- `#summaries` daily / weekly auto-publish on schedule.
- NOT `#approvals` (approval requests stay operator-published).
- NOT `#codex-warnings` (warnings stay operator-published; Relay can draft but operator publishes; warnings are too high-stakes for auto-publish).
- NOT `#trading-alerts` / `#trading-summaries` (separate trading-track gate).

Relay does NOT enter the trading runtime hot path. Per `orchestrator/ROLE-HIERARCHY.md` Critical separation rule, Relay is governance / comms only.

## Hard limits (canonical, repeated for emphasis)

- No Discord bot install at COMM-HUB-DOCS-A.
- No webhook creation at COMM-HUB-DOCS-A.
- No Discord server creation in repo (server is operator-owned outside the repo).
- No env / secret added (future Discord-bot tokens are a separate Gate-13 / Gate-14 approval).
- No `MANUAL_LIVE_ARMED` change.
- No production action.
- No autopilot runtime activation.
- No CEILING-PAUSE break.
- No advancement of the autopilot phase-loop counter (COMM-HUB-DOCS-A is operator-directed manual).
- No `bot.js`, `dashboard.js`, `db.js`, `migrations/`, `scripts/`, `package.json`, lockfile, `.nvmrc`, `.env*`, `position.json`, deploy config touched.
- No closed Migration 008 runbook touched.
- No autopilot template modification.
- The set of approvers remains exactly {Victor}.

## What this is NOT

- Not a trading interface.
- Not an approval channel (approval is in-session chat only).
- Not a runtime (no bot installed, no webhooks, no schedulers).
- Not authorization to install a Discord bot, webhooks, MCP, cron, or any background automation.
- Not authorization to break CEILING-PAUSE or open ARC-8-RUN-C.
- Not authorization for any RED-tier action.
- Not canonical over `orchestrator/STATUS.md` / `orchestrator/CHECKLIST.md` / `orchestrator/NEXT-ACTION.md` / `git log`.

## Cross-references

- `orchestrator/AUTOPILOT-RULES.md` ARC-8 Discord channels and content rules — canonical authority for Channel 1 + Channel 2 patterns.
- `orchestrator/AUTOMATION-PERMISSIONS.md` — GREEN / YELLOW / RED tiers; COMM-HUB-mapping.
- `orchestrator/HANDOFF-RULES.md` — packet rules; Discord forbidden-content rules.
- `orchestrator/PROTECTED-FILES.md` — per-path classification; this file is SAFE-class safety-policy doc.
- `orchestrator/ROLE-HIERARCHY.md` — five named roles + future-automation governance-only rule; Relay activation gate.
- `orchestrator/PHASE-MODES.md` — six phase modes.
- `orchestrator/APPROVAL-GATES.md` — 16-gate matrix; Gate 10 (automation install / upgrade) governs Relay / Discord-bot install.
- `orchestrator/handoffs/AUTOPILOT-DISCORD-APPROVAL.md` — Channel 1 approval-request template.
- `orchestrator/handoffs/AUTOPILOT-DISCORD-STATUS.md` — Channel 2 status-message template.
- `orchestrator/handoffs/COMM-HUB-CHANNEL-LAYOUT.md` — exact Discord channel definitions.
- `orchestrator/handoffs/COMM-HUB-DAILY-SUMMARY.md` — daily summary template.
- `orchestrator/handoffs/COMM-HUB-WEEKLY-SUMMARY.md` — weekly summary template.
- `orchestrator/handoffs/COMM-HUB-CODEX-WARNING.md` — Codex warning template.
- `orchestrator/handoffs/COMM-HUB-SYSTEM-ALERT.md` — system alert template.
- `CLAUDE.md` (repo root) — top-level role / safety / change-discipline rules.

## Change history

- **COMM-HUB-DOCS-A (2026-05-05):** Initial Communication Hub spec drafted. Operator-directed manual phase (not autopilot-driven; does not advance autopilot phase-loop counter; does not break CEILING-PAUSE). Channel architecture (3 categories, 7 channels), role/permission model, message types, approval-request workflow, Codex warning / halt workflow, daily / weekly summary workflow, system-alert workflow, Hermes integration point, forbidden-content rules, pre-publish Codex sanity check, hard limits. No Discord bot installed; no webhooks created; no schedulers; no autopilot runtime activation; no CEILING-PAUSE break. Pending Codex docs-only review and explicit operator approval before commit.
