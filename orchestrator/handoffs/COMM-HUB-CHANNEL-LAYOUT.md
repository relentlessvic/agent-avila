# Communication Hub Channel Layout (template — COMM-HUB)

> **Author rule:** This template defines the exact Discord channel layout, server settings, and per-channel permissions for the Agent Avila Communication Hub. It is a docs-only specification — not a runtime install. Actual Discord server / bot / webhook creation requires separate operator approval per `orchestrator/APPROVAL-GATES.md` Gate 10 (automation install / upgrade) and is NOT authorized by COMM-HUB-DOCS-A.
>
> **No Discord bot, webhook, scheduler, MCP trigger, cron job, or background automation is installed by this template.**

Author: Operator-driven manual planning (Claude as orchestrator; future installs Victor-only)
Last updated: 2026-05-05 (COMM-HUB-DOCS-A — DOCS-ONLY)

## Server-level settings

| Setting | Value |
|---|---|
| Server name | Agent Avila Hub (operator-chosen) |
| Visibility | Operator-private (Victor invite-list only at activation) |
| Invite policy | No public invite link; per-member invitation by Victor only |
| 2FA requirement | Mandatory for all members |
| Third-party integrations | None at activation; per-integration Gate-10 approval required |
| Webhook policy | None at activation; per-webhook approval required |
| `@everyone` permissions | View channels (read-only on most); no write; no DM; no mention-everyone |
| Server discovery | Disabled |
| Stage channels / forums / threads | Disabled at activation |

## Category and channel definitions

### CATEGORY A — `#governance`

#### `#approvals`

- **Purpose:** ARC-8 Channel 1; one message per pending Victor decision.
- **Format:** Per `orchestrator/handoffs/AUTOPILOT-DISCORD-APPROVAL.md` template.
- **Drafts authored by:** Orchestrator (Claude) or operator-driven manual orchestrator process.
- **Pre-publish Codex sanity check:** Mandatory.
- **Published by:** Victor (manually). Future Relay auto-publish for `#approvals` is NOT authorized — approval requests stay operator-published forever.
- **Append-only:** No (each request is independent).
- **Rate limit:** Maximum 1 message per pending Victor decision; queue limit N=2 pending requests at a time per `orchestrator/AUTOPILOT-RULES.md` ARC-8 approval-fatigue mitigation.
- **CEO write:** Yes.
- **Hub-Read read:** Yes.
- **System-Writer write:** No (NEVER for `#approvals`).
- **Forbidden content:** Per `COMM-HUB-RULES.md` and `HANDOFF-RULES.md` Forbidden content lists.
- **Critical:** "A Discord reply, emoji, or reaction is NOT an approval. Only Victor's explicit in-session chat approval counts as final approval." MUST appear verbatim in every `#approvals` message.

#### `#status`

- **Purpose:** ARC-8 Channel 2; one line per phase event.
- **Format:** `ARC-8: <phase-id> <event>` per `orchestrator/handoffs/AUTOPILOT-DISCORD-STATUS.md` template.
- **Event types:** `PHASE_OPENED`, `PHASE_CLOSED`, `CODEX_VERDICT`, `COMMIT_LANDED`, `PUSH_COMPLETED`, `HALTED`.
- **Drafts authored by:** Orchestrator.
- **Pre-publish Codex sanity check:** Mandatory.
- **Published by:** Victor (manually) at COMM-HUB-DOCS-A; future Relay after Gate-10 approval.
- **Append-only:** Yes (corrections via new "ARC-8 correction:" message; never edit prior).
- **Rate limit:** Maximum 5 messages per phase.
- **CEO write:** Yes.
- **Hub-Read read:** Yes.
- **System-Writer write:** Yes (after Relay Gate-10 install; DORMANT at COMM-HUB-DOCS-A).

#### `#codex-warnings`

- **Purpose:** High-priority Codex non-PASS verdicts, halt conditions, scope-creep flags.
- **Format:** Per `orchestrator/handoffs/COMM-HUB-CODEX-WARNING.md` template.
- **Drafts authored by:** Orchestrator (Codex verdict transcribed).
- **Pre-publish Codex sanity check:** Mandatory (Codex sanity-checks its own warning's wording, especially for forbidden-content leakage).
- **Published by:** Victor (manually). Future Relay auto-publish for warnings is NOT authorized — too high-stakes.
- **Append-only:** Yes.
- **Rate limit:** Maximum 1 message per Codex round.
- **CEO write:** Yes.
- **Hub-Read read:** Yes.
- **System-Writer / Codex-Writer write:** No at COMM-HUB-DOCS-A; Codex-Writer DORMANT.

### CATEGORY B — `#operations`

#### `#summaries`

- **Purpose:** Daily / weekly phase summaries.
- **Format:** Per `orchestrator/handoffs/COMM-HUB-DAILY-SUMMARY.md` and `orchestrator/handoffs/COMM-HUB-WEEKLY-SUMMARY.md` templates.
- **Drafts authored by:** Orchestrator (Claude); future Relay after Gate-10.
- **Pre-publish Codex sanity check:** Mandatory.
- **Published by:** Victor (manually) at COMM-HUB-DOCS-A; future Relay after Gate-10 approval.
- **Append-only:** Yes.
- **Rate limit:** Maximum 1 daily summary + 1 weekly summary.
- **CEO write:** Yes.
- **Hub-Read read:** Yes.
- **System-Writer write:** Yes (after Relay Gate-10 install; DORMANT at COMM-HUB-DOCS-A).

#### `#system-health`

- **Purpose:** System alerts (working-tree drift, three-way SHA inconsistency, autopilot CEILING-PAUSE state changes, autopilot stop-condition fires, framework anomalies).
- **Format:** Per `orchestrator/handoffs/COMM-HUB-SYSTEM-ALERT.md` template.
- **Drafts authored by:** Orchestrator on autopilot stop condition / drift detection.
- **Pre-publish Codex sanity check:** Mandatory.
- **Published by:** Victor (manually) at COMM-HUB-DOCS-A; future Relay after Gate-10.
- **Append-only:** Yes.
- **Rate limit:** Maximum 5 messages per phase.
- **CEO write:** Yes.
- **Hub-Read read:** Yes.
- **System-Writer write:** Yes (after Relay Gate-10 install; DORMANT at COMM-HUB-DOCS-A).

### CATEGORY C — `#future-trading` (DORMANT)

#### `#trading-alerts`

- **Status:** DORMANT — no source authorized at COMM-HUB-DOCS-A.
- **Channel description (must be set explicitly at server-creation time):** "DORMANT — no source authorized. Future trading alerts pending separate multi-gated activation. No bot, no webhook, no scheduler permitted in this channel until that activation."
- **Activation gate:** Multi-gated — trading-track activation phase + Trading-Writer install + per-message Victor approval.
- **CEO write:** Yes (operator may post; otherwise empty).
- **All other writers:** No.
- **Read access:** CEO + Hub-Read only.

#### `#trading-summaries`

- **Status:** DORMANT — no source authorized at COMM-HUB-DOCS-A.
- **Channel description:** Same DORMANT label as `#trading-alerts`.
- **Activation gate:** Same multi-gate.
- **CEO write:** Yes (operator may post; otherwise empty).
- **All other writers:** No.
- **Read access:** CEO + Hub-Read only.

## Forbidden content (mirrors `orchestrator/COMM-HUB-RULES.md` + `orchestrator/HANDOFF-RULES.md`)

Every Discord message — across every channel and message type defined above — MUST NEVER contain:

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

The per-channel "Forbidden content" attribute in the channel definitions above references this top-level list as canonical for this template.

## Per-role permission summary

| Role | Active at COMM-HUB-DOCS-A? | Read | Write |
|---|---|---|---|
| CEO (Victor) | Yes | All channels (A + B + C) | All channels (A + B + C) |
| Hub-Read (Victor mobile / alt) | Yes | All channels (A + B + C) | None |
| System-Writer (Relay) | DORMANT | None at activation | After Gate-10: `#status`, `#summaries`, `#system-health` only (NOT `#approvals`, NOT `#codex-warnings`, NOT category C) |
| Codex-Writer | DORMANT | None at activation | After separate gate: `#codex-warnings` only |
| Trading-Writer | DORMANT | None at activation | After multi-gated activation: `#trading-alerts`, `#trading-summaries` only |
| `@everyone` | N/A | Read-only on Category A + B (no read on C) | None |

## Hard limits

- No bot installed at COMM-HUB-DOCS-A.
- No webhook created at COMM-HUB-DOCS-A.
- No third-party integration installed at COMM-HUB-DOCS-A.
- No scheduler / cron / MCP trigger added at COMM-HUB-DOCS-A.
- All system-writer roles DORMANT until separate Gate-10 install phase.
- All Category C channels DORMANT until separate trading-track activation phase.
- No autopilot runtime activation.
- No CEILING-PAUSE break.
- No production action.

## What this template is NOT

- Not authorization to create the Discord server. Server creation is operator-owned and happens outside the repo.
- Not authorization to install a Discord bot or webhook.
- Not authorization to install Relay.
- Not authorization to activate Category C channels.
- Not authorization to break CEILING-PAUSE or open ARC-8-RUN-C.
- Not authorization to widen any role's permissions beyond the table above.
- Not canonical over `orchestrator/COMM-HUB-RULES.md`.
