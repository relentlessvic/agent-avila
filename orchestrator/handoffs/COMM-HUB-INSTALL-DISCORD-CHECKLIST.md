# Communication Hub — Discord Install Checklist (template — COMM-HUB)

> **Author rule:** This checklist codifies the click-by-click manual Discord install plan for the Agent Avila Communication Hub. It is a docs-only specification — not a runtime install. **This checklist is NOT authorization to create the Discord server, install a bot, create a webhook, install Relay, activate any DORMANT role, activate Category C, take any production action, take any trading action, or break CEILING-PAUSE.** Actual server creation by manual operator clicks requires a separate operator-approved phase (`COMM-HUB-INSTALL-DISCORD`); bot/webhook/scheduler/Relay install requires its own Gate-10 phase per `orchestrator/APPROVAL-GATES.md`; trading-channel activation requires a multi-gated activation phase.
>
> **No Discord server, bot, webhook, scheduler, MCP trigger, cron job, or background automation is installed by writing this file.**

Author: Operator-driven manual planning (Claude as orchestrator; future installs Victor-only)
Last updated: 2026-05-05 (COMM-HUB-DOCS-B-INSTALL-CHECKLIST — DOCS-ONLY)
Canonical references:
- `orchestrator/COMM-HUB-RULES.md` — Communication Hub rulebook (SAFE-class)
- `orchestrator/handoffs/COMM-HUB-CHANNEL-LAYOUT.md` — canonical channel/role/permission layout
- `orchestrator/handoffs/COMM-HUB-DAILY-SUMMARY.md`, `COMM-HUB-WEEKLY-SUMMARY.md`, `COMM-HUB-CODEX-WARNING.md`, `COMM-HUB-SYSTEM-ALERT.md` — message templates
- `orchestrator/AUTOPILOT-RULES.md` — ARC-8 phase-loop ceiling rule
- `orchestrator/APPROVAL-GATES.md` — Gate 10 automation install / upgrade
- `orchestrator/AUTOMATION-PERMISSIONS.md` — GREEN / YELLOW / RED tiers
- `orchestrator/PROTECTED-FILES.md` — SAFE / RESTRICTED / HARD BLOCK matrix
- `orchestrator/HANDOFF-RULES.md` — packet conventions and forbidden-content list

If any field below diverges from `orchestrator/COMM-HUB-RULES.md` or `orchestrator/handoffs/COMM-HUB-CHANNEL-LAYOUT.md`, the canonical files win and this checklist must be re-aligned in a follow-up DOCS-ONLY phase.

---

## Phase context

This checklist is the persistent on-disk codification of the COMM-HUB-DESIGN-DISCORD-INSTALL design (Codex review PASS — 15 of 15 questions PASS, zero required edits, zero blocking issues; conversation-only design; no commit produced by the design phase).

The downstream operator-driven manual install phase (`COMM-HUB-INSTALL-DISCORD`) will follow this checklist verbatim. That phase is **separately operator-approved** and is **operator-directed manual** (no automation; no autopilot involvement).

CEILING-PAUSE remains active and is not broken by writing this checklist or by following it later. Operator-directed manual phases do NOT advance the autopilot phase-loop counter and do NOT break CEILING-PAUSE.

---

## Discord server name

**Recommended:** `Agent Avila Hub` (matches `orchestrator/handoffs/COMM-HUB-CHANNEL-LAYOUT.md` operator-chosen example).

**Operator alternatives accepted** at server-creation time. The spec marks this as operator-chosen.

**Server icon / banner:** none at install. Visual branding is operator preference and may be added in a later separately-scoped action.

---

## Category and channel layout (3 categories, 7 channels)

Matches the canonical 3-category / 7-channel layout, ordering, channel names, and Category C DORMANT classification in `orchestrator/handoffs/COMM-HUB-CHANNEL-LAYOUT.md`. No semantic deviation.

### Category A — `governance` (3 channels, ACTIVE at install)

1. `approvals`
2. `status`
3. `codex-warnings`

### Category B — `operations` (2 channels, ACTIVE at install)

4. `summaries`
5. `system-health`

### Category C — `future-trading` (2 channels, DORMANT at install)

6. `trading-alerts`
7. `trading-summaries`

**Channel ordering convention:** governance category at the top of the sidebar (highest urgency); operations below; future-trading at the bottom (visually separated; reduces accidental interaction).

**Naming hygiene:** all lowercase; no emojis in channel names; no spaces; kebab-case for multi-word channels.

---

## Channel topics (verbatim — copy-paste at install time)

Each channel must have its `Topic` field set to the exact text below. Operator copies and pastes from this checklist into Discord's channel-edit dialog.

### `#approvals`

```
ARC-8 Channel 1 — pending Victor decisions. Drafted by orchestrator; published manually by Victor; future Relay auto-publish NOT authorized for this channel. A reply, emoji, or reaction is NEVER an approval — only Victor's in-session chat instruction is.
```

### `#status`

```
ARC-8 Channel 2 — phase events. Format: ARC-8 followed by phase id then event. Append-only; corrections via new "ARC-8 correction" message. Max 5 messages per phase. Pre-publish Codex sanity check mandatory.
```

### `#codex-warnings`

```
Codex non-PASS verdicts, halt conditions, scope-creep flags. Drafted by orchestrator (Codex transcribed); published manually by Victor. Max 1 message per Codex round. Pre-publish Codex sanity check mandatory.
```

### `#summaries`

```
Daily and weekly phase summaries. Drafted by orchestrator; published manually by Victor; future Relay auto-publish after Gate-10. Max 1 daily plus 1 weekly per UTC week. Pre-publish Codex sanity check mandatory.
```

### `#system-health`

```
System alerts: working-tree drift, three-way SHA inconsistency, autopilot CEILING-PAUSE state changes, autopilot stop-condition fires, framework anomalies. Drafted by orchestrator on autopilot stop / drift; published manually by Victor; future Relay after Gate-10. Max 5 messages per phase.
```

### `#trading-alerts` (DORMANT)

```
DORMANT — no source authorized. Future trading alerts pending separate multi-gated activation. No bot, no webhook, no scheduler permitted in this channel until that activation.
```

### `#trading-summaries` (DORMANT)

```
DORMANT — no source authorized. Future trading alerts pending separate multi-gated activation. No bot, no webhook, no scheduler permitted in this channel until that activation.
```

---

## Roles

Five roles total, only two active at install. All other roles are created at install with **zero members and zero permissions** so that the role list visually reflects the canonical role set without granting any authority.

| Role | Active at install? | Display color | Members | Authority at install |
|---|---|---|---|---|
| `CEO` | Yes | Red | Victor's primary Discord account | Server owner; Administrator |
| `Hub-Read` | Yes | Blue | Victor's mobile / alt Discord account if applicable; otherwise unassigned | Read all channels A + B + C; no write anywhere |
| `System-Writer` (Relay) | NO — DORMANT | Gray | None at install | Zero permissions; future Gate-10 install would grant write to `#status`, `#summaries`, `#system-health` only — NEVER `#approvals`, NEVER `#codex-warnings`, NEVER Category C |
| `Codex-Writer` | NO — DORMANT | Gray | None at install | Zero permissions; future separate gate would grant write to `#codex-warnings` only |
| `Trading-Writer` | NO — DORMANT | Gray | None at install | Zero permissions; future multi-gated activation would grant write to `#trading-alerts`, `#trading-summaries` only |

**Role-list hierarchy (top to bottom in Discord role order):** `CEO` → `Hub-Read` → `System-Writer` → `Codex-Writer` → `Trading-Writer`. The hierarchy enforces who can edit whom (CEO can edit everyone; Hub-Read cannot edit anyone).

**Display "this role separately":** ON for `CEO` only.

**Allow @mention this role:** OFF for every role.

---

## Per-channel permission matrix

| Channel | CEO | Hub-Read | System-Writer | Codex-Writer | Trading-Writer | @everyone |
|---|---|---|---|---|---|---|
| `#approvals` | RW | R | — (NEVER) | — | — | R only (no write, no add-reactions) |
| `#status` | RW | R | W (after Gate-10; DORMANT now) | — | — | R only |
| `#codex-warnings` | RW | R | — | W (after gate; DORMANT now) | — | R only |
| `#summaries` | RW | R | W (after Gate-10; DORMANT now) | — | — | R only |
| `#system-health` | RW | R | W (after Gate-10; DORMANT now) | — | — | R only |
| `#trading-alerts` (DORMANT) | RW (operator may post; otherwise empty) | R | — | — | W (after multi-gate; DORMANT now) | — (no read on Category C) |
| `#trading-summaries` (DORMANT) | RW (operator may post; otherwise empty) | R | — | — | W (after multi-gate; DORMANT now) | — |

`R` = read; `W` = write; `RW` = read + write; `—` = no access.

---

## `@everyone` server-level restrictions

Set the following on the `@everyone` role at server level. (Channel-level overrides for Category C are applied separately under "Category C DORMANT setup" below.)

| Permission | State |
|---|---|
| View Channels | ON (for Category A + B; Category C overridden separately) |
| Send Messages | OFF |
| Send Messages in Threads | OFF (threads disabled at server level anyway) |
| Use Application Commands | OFF |
| Embed Links | OFF |
| Attach Files | OFF |
| Mention `@everyone`, `@here`, and All Roles | OFF |
| Manage Messages | OFF |
| Read Message History | ON (for Category A + B) |
| Add Reactions | OFF (reactions are NEVER approval signals; reduces noise) |
| Send TTS Messages | OFF |
| Use External Emoji | OFF |
| Use External Stickers | OFF |
| Create Public / Private Threads | OFF |
| Send Voice Messages | OFF |
| Use Voice Activity / Connect / Speak / Stream | OFF (no voice channels at install) |

---

## Category C DORMANT setup

Category C `future-trading` is fully DORMANT at install. To enforce CEO + Hub-Read read-only and zero `@everyone` access:

1. Create category `future-trading`.
2. Edit category permissions → add `@everyone` → **deny View Channels** at category level.
3. Add `CEO` → allow View, Send Messages, Read Message History, Embed Links, Attach Files.
4. Add `Hub-Read` → allow View, Read Message History; deny Send Messages.
5. Confirm `System-Writer`, `Codex-Writer`, `Trading-Writer` have NO category-level allow override (denies via role-level zero permissions).
6. Create channels `trading-alerts` and `trading-summaries` under this category. By default they inherit category permissions.
7. Set each channel's `Topic` to the verbatim DORMANT text (see "Channel topics" section above).
8. Verify by opening Discord with a non-CEO non-Hub-Read perspective if possible, or by adding a temporary throwaway test viewer (then immediately remove); confirm Category C is invisible.

---

## Manual click-by-click install checklist for Victor

**Pre-install requirements:**
- Discord account with 2FA enabled.
- Optional Hub-Read account (Victor's mobile or alt) ready, with 2FA enabled.
- This checklist on disk and Codex-reviewed PASS.
- A separately operator-approved install phase open (e.g., `COMM-HUB-INSTALL-DISCORD`).
- 30–60 minutes of uninterrupted time.

**Steps:**

1. **Create the server.** Discord client → top-left "+ Add a Server" → "Create My Own" → "For me and my friends" → Server name `Agent Avila Hub` → upload server icon (optional; skip at install) → Create.
2. **Open Server Settings → Overview**: confirm server name; leave server region as Automatic.
3. **Server Settings → Moderation → Verification Level**: set to **Highest** ("must have a verified phone on their Discord account").
4. **Server Settings → Moderation → 2FA Requirement for Moderation**: **Enable**.
5. **Server Settings → Safety Setup → Explicit Media Filter**: set to **Filter Messages from All Members**.
6. **Server Settings → Server Boost / Server Discovery**: confirm Server Discovery is OFF.
7. **Server Settings → Roles** — create roles in this order (top → bottom of role list):
   1. `CEO` — color red — Permissions: Administrator — Display this role separately ON — Allow `@mention` OFF — assign to Victor's primary account.
   2. `Hub-Read` — color blue — Permissions: View Channels and Read Message History only — all other permissions OFF — assign to Victor's mobile/alt if applicable.
   3. `System-Writer` — color gray — Permissions: NONE — zero members — note: "DORMANT — Relay auto-publisher; future Gate-10 install required to add members and grant write to status / summaries / system-health only".
   4. `Codex-Writer` — color gray — Permissions: NONE — zero members — note: "DORMANT — future separate gate".
   5. `Trading-Writer` — color gray — Permissions: NONE — zero members — note: "DORMANT — multi-gated future activation".
8. **Server Settings → Roles → @everyone**: open and set per the `@everyone` server-level restrictions table above. Save.
9. **Create Category A `governance`**: server sidebar → "+ Create Category" → name `governance` → Private Category OFF (channel-level overrides instead). Create.
10. **Create channel `approvals` under `governance`**: "+ Create Channel" → Text Channel → Name `approvals` → set channel topic verbatim from this checklist → Create.
11. **Channel `approvals` → Edit Channel → Permissions**: add CEO (allow View, Send Messages, Read Message History, Embed Links, Attach Files); add Hub-Read (allow View, Read Message History; deny Send Messages); leave System-Writer / Codex-Writer / Trading-Writer with no overrides (denies via role-level zero permissions); @everyone allow View Channel, Read Message History; deny Send Messages, Add Reactions. Save.
12. **Repeat steps 10–11 for `status` and `codex-warnings`** under `governance`. Use each channel's verbatim topic.
13. **Create Category B `operations`**: same pattern.
14. **Create channels `summaries` and `system-health`** under `operations`. Use each channel's verbatim topic. Apply the same permission overrides as step 11.
15. **Create Category C `future-trading`**: follow the "Category C DORMANT setup" section above (8 sub-steps).
16. **Server Settings → Integrations**: confirm zero apps installed; zero webhooks created. **DO NOT add any bot. DO NOT create any webhook. DO NOT authorize any third-party integration.**
17. **Server Settings → Audit Log**: confirm visible to CEO; this is the install audit trail.
18. **Server Settings → Widget**: disable.
19. **Disable Stage Channels / Forums / Threads** at server level (Server Settings → Overview → System Channel: set to None to suppress system messages; Server Settings → Threads: ensure threads not enabled in any active channel; if any forum/stage channel was auto-created during community-features setup, delete it).
20. **Verify install** per the "Verification checklist" section below.
21. **Take screenshots** per the "Evidence checklist" section below.
22. **Do NOT post any test message** in any channel. Channels remain empty until first orchestrator-drafted, operator-published packet under separate operator-directed manual workflow.
23. **Do NOT generate any invite link.** Per `orchestrator/COMM-HUB-RULES.md`, no public invite link.
24. **If Hub-Read account is added:** Server Settings → Members → "+ Invite a Friend" → use Discord username (no link); send invite directly to Victor's mobile/alt account; assign Hub-Read role on join; confirm 2FA enabled on that account.
25. **Close install.** Operator records install completion in a separate operator-approved phase (`COMM-HUB-INSTALL-DISCORD-CLOSEOUT`) by updating STATUS / CHECKLIST / NEXT-ACTION docs.

---

## Security settings

**Server-level (mandatory at install):**
- 2FA Requirement for Moderation: **Enable**.
- Verification Level: **Highest** (verified phone required).
- Explicit Media Filter: **All members**.
- Server Discovery: **Disabled**.
- Public invite link: **None** — only direct username-based invites by Victor to known persons.
- Widget: **Disabled**.
- Stage / Forum / Thread channels: **Disabled** at activation.

**Permission-level:**
- `@everyone`: read-only on Category A + B; no read on Category C; no write; no `@mention`; no add-reactions; no DMs from server members.
- `CEO`: Administrator (server owner default).
- `Hub-Read`: read-only with no write anywhere.
- All other roles: DORMANT with zero members and zero permissions.

**Integration-level:**
- Zero apps / bots installed.
- Zero webhooks created.
- Zero third-party integrations enabled.

**Channel-level:**
- Pre-publish Codex sanity check mandatory for every drafted message (per `orchestrator/COMM-HUB-RULES.md`).
- Forbidden-content rules enforced by orchestrator pre-publish (mirrors `orchestrator/COMM-HUB-RULES.md` and `orchestrator/HANDOFF-RULES.md`).
- Append-only convention for `#status`, `#codex-warnings`, `#summaries`, `#system-health` (corrections via new message; never edit prior).

**Operator-side discipline:**
- A reply, emoji, or reaction in any channel is NEVER an approval. Approval is in-session chat instruction only.
- Recommend operator enables push notifications for `#approvals` only at install.

---

## What remains DORMANT

- **Relay (`System-Writer` role)** — DORMANT at install. Activation requires separate Gate-10 phase: `COMM-HUB-INSTALL-HERMES`. Until then, role exists with zero members and zero write permissions; `#status`, `#summaries`, `#system-health` are operator-published only.
- **`Codex-Writer` role** — DORMANT at install. Activation requires separate gate. Until then, `#codex-warnings` is operator-published only.
- **`Trading-Writer` role** — DORMANT at install. Activation requires multi-gated future trading-track activation phase. Until then, Category C is empty.
- **Category C channels** (`#trading-alerts`, `#trading-summaries`) — DORMANT at install. No source authorized. Channel topics carry the verbatim DORMANT label.
- **Bots, webhooks, schedulers, MCP triggers, cron jobs, background automation** — none at install.
- **Auto-publish for `#approvals` and `#codex-warnings`** — NEVER authorized, even after future Relay install. These channels stay operator-published forever.
- **Trading-runtime hot path** — Discord install does NOT enter the trading runtime; Discord is governance-comms only.
- **Autopilot runtime** — DORMANT (CEILING-PAUSE active and not broken by install).

---

## What is explicitly NOT authorized

**By writing this checklist (COMM-HUB-DOCS-B-INSTALL-CHECKLIST):**
- Creating the Discord server.
- Creating any channel, category, role, invite, or permission.
- Installing any bot.
- Creating any webhook.
- Installing Relay.
- Activating Codex-Writer.
- Activating Category C trading channels.
- Any Gate-10 automation install / upgrade.
- Activating autopilot runtime.
- Breaking CEILING-PAUSE.
- Running Railway commands.
- Running production DB commands.
- Touching Kraken.
- Changing env variables.
- Enabling `MANUAL_LIVE_ARMED`.
- Any RED-tier action.

**By following this checklist later in a separate operator-approved manual install phase (COMM-HUB-INSTALL-DISCORD):**
- Installing any bot or webhook (separate Gate-10 phases each).
- Activating any DORMANT role with members.
- Activating Category C.
- Modifying the canonical spec (`orchestrator/COMM-HUB-RULES.md`) or templates.
- Posting any seed or test message.
- Generating any public invite link.

**Approvals required for downstream phases:**

| Phase | Approval class | Notes |
|---|---|---|
| `COMM-HUB-INSTALL-DISCORD` | Operator-directed manual; per-step operator action | Operator clicks; no automation |
| `COMM-HUB-INSTALL-DISCORD-CLOSEOUT` | Commit-only + push approval | Records install complete in 3 status docs |
| `COMM-HUB-INSTALL-HERMES` | Gate-10 (automation install / upgrade) | Bot install; permissions grant; first auto-publish test |
| `COMM-HUB-INSTALL-CODEX-WRITER` | Gate-10 separate | Codex non-PASS auto-publisher |
| `COMM-HUB-ACTIVATE-TRADING-CHANNELS` | Multi-gated | Trading-track activation + Trading-Writer install + per-message Victor approval |

---

## Install risks

**P1 (high impact, install-blocking if mishandled):**

- **R1** — Operator clicks "Create Server" before a separate operator-approved install phase is open. Mitigation: this checklist explicitly defers server creation to a separate phase; install steps are click-instructions only after that phase opens.
- **R2** — Discord defaults to enabling community settings (rules channel, announcements) during server creation. Mitigation: step 1 specifies "For me and my friends" path which omits community-feature nudges.
- **R3** — Permission misconfiguration on Category C could leak DORMANT-channel visibility. Mitigation: Category-level `@everyone` deny View Channels override (Category C step 2) is the single enforcement point; verify at step 20 and Category C step 8.
- **R4** — Public invite link generated accidentally. Mitigation: explicit step 23 "Do NOT generate any invite link"; spec also forbids public invites.
- **R5** — Forbidden content posted in initial test messages. Mitigation: step 22 "Do NOT post any test message"; first message in any channel is an orchestrator-drafted, Codex-sanity-checked, operator-published packet.

**P2 (medium impact):**

- **R6** — Channel topic strings drift from canonical. Mitigation: this checklist contains verbatim copy-paste topics; `orchestrator/handoffs/COMM-HUB-CHANNEL-LAYOUT.md` is the canonical fallback.
- **R7** — DORMANT roles created with members or permissions. Mitigation: explicit "zero members, zero permissions" instruction; verification audits role members.
- **R8** — Add Reactions enabled on `#approvals` could create the appearance of reaction-based approval. Mitigation: Add Reactions disabled at `@everyone` level; spec rule "reaction is NEVER approval" remains the canonical guard.
- **R9** — Discord client auto-suggests "add a bot" prompt during setup. Mitigation: explicit step 16 "DO NOT add any bot"; checklist verifies zero apps.
- **R10** — Hub-Read account 2FA not enabled. Mitigation: server-level 2FA Requirement for Moderation does not enforce 2FA on read-only members; install step 24 explicitly requires confirming 2FA on Hub-Read account.

**P3 (low impact, monitoring-only):**

- **R11** — Discord UI changes between this checklist and install execution. Mitigation: setting-name terms, not click-position terms; operator adapts to UI.
- **R12** — Future Relay install reveals permission gaps. Mitigation: COMM-HUB-INSTALL-HERMES is its own design + Codex-review phase.
- **R13** — Spec drift over time. Mitigation: any spec change goes through COMM-HUB-DOCS-B successor phase; install design re-runs against new spec before any change to live server.

**Risks NOT in scope of this checklist (flagged for separate phases):**

- Relay auth-token storage (Gate-10 phase).
- Codex-Writer authentication flow.
- Trading-Writer authentication and per-message approval mechanism.
- Discord rate-limiting under burst orchestrator drafts.
- Backup / export of server-side message history.
- Operator account compromise / recovery.

---

## Verification checklist (post-install, before COMM-HUB-INSTALL-DISCORD-CLOSEOUT)

Operator confirms each item with a direct visual check in the Discord client:

- [ ] Server name matches `Agent Avila Hub` (or operator-chosen alternative).
- [ ] Verification Level is Highest.
- [ ] 2FA Requirement for Moderation is enabled.
- [ ] Explicit Media Filter is set to All Members.
- [ ] Server Discovery is disabled.
- [ ] Widget is disabled.
- [ ] No Stage / Forum / Thread channels exist.
- [ ] All 5 roles exist in correct hierarchy: `CEO` → `Hub-Read` → `System-Writer` → `Codex-Writer` → `Trading-Writer`.
- [ ] `CEO` role has Administrator permission and is assigned to Victor's primary account.
- [ ] `Hub-Read` role has only View Channels + Read Message History; if assigned, member account has 2FA enabled.
- [ ] `System-Writer`, `Codex-Writer`, `Trading-Writer` each have zero members and zero permissions.
- [ ] All 3 categories exist in correct order: governance, operations, future-trading.
- [ ] All 7 channels exist with exact names: `approvals`, `status`, `codex-warnings`, `summaries`, `system-health`, `trading-alerts`, `trading-summaries`.
- [ ] Each channel's topic matches the verbatim text in this checklist.
- [ ] `@everyone` permissions match the matrix in this checklist.
- [ ] Category C has category-level `@everyone` deny View Channels override.
- [ ] No app / bot is installed (Server Settings → Integrations confirms zero).
- [ ] No webhook is created (Server Settings → Integrations → Webhooks confirms zero).
- [ ] No third-party integration is enabled.
- [ ] No public invite link exists.
- [ ] No message has been posted in any channel.
- [ ] Relay is DORMANT (no members in `System-Writer`).
- [ ] Codex-Writer is DORMANT.
- [ ] Trading-Writer is DORMANT.
- [ ] Category C channels carry the verbatim DORMANT topic.

---

## Evidence checklist (post-install, operator stores locally; not committed)

Operator captures the following screenshots as install evidence. Screenshots are stored locally; **not committed to the repo**, **not posted to any Discord channel**, **not shared externally**.

- [ ] Server overview (server name, region, owner).
- [ ] Server Settings → Moderation (Verification Level, 2FA requirement, Explicit Media Filter).
- [ ] Server Settings → Server Discovery (showing disabled).
- [ ] Server Settings → Widget (showing disabled).
- [ ] Role list in correct hierarchy with zero members for DORMANT roles.
- [ ] Each category with its channels visible.
- [ ] Each channel's topic field showing verbatim text.
- [ ] `@everyone` permissions page showing the configured restrictions.
- [ ] Category C category-level permissions showing `@everyone` deny View Channels.
- [ ] Server Settings → Integrations (showing zero apps, zero webhooks).
- [ ] Audit Log showing the install sequence.

Each screenshot is annotated locally with timestamp and step-reference. Screenshots are **not** uploaded to any Discord channel, gist, pastebin, or cloud storage that could index them.

---

## Hard limits

- No bot is installed by writing this checklist or by following it.
- No webhook is created by writing this checklist or by following it.
- No third-party integration is installed.
- No scheduler / cron / MCP trigger / background automation is installed.
- No Relay is installed.
- No Codex-Writer is activated.
- No Trading-Writer is activated.
- No Category C channel is activated.
- No autopilot runtime activation.
- No CEILING-PAUSE break.
- No production action.
- No deploy, no Railway command, no production DB command, no Kraken action, no env change, no `MANUAL_LIVE_ARMED` change, no live trading action.
- No modification to runtime code (`bot.js`, `dashboard.js`, `db.js`), `scripts/`, `migrations/`, `package.json`, lockfiles, `.nvmrc`, `.env*`, `position.json`, deploy config, autopilot templates, COMM-HUB safety-policy doc, or the closed Migration 008 runbook.
- No public invite link.
- No test or seed message in any channel.

---

## What this checklist is NOT

- **Not authorization to create the Discord server.** Server creation requires a separate operator-approved phase (`COMM-HUB-INSTALL-DISCORD`).
- **Not authorization to install a Discord bot or webhook.** Bot / webhook install requires its own Gate-10 phase per `orchestrator/APPROVAL-GATES.md`.
- **Not authorization to install Relay.** Relay install requires `COMM-HUB-INSTALL-HERMES` Gate-10 phase.
- **Not authorization to activate the Codex-Writer or Trading-Writer role.** Each requires its own scoped operator-approved phase.
- **Not authorization to activate Category C channels.** Multi-gated activation phase required.
- **Not authorization to break CEILING-PAUSE.** Only an explicit operator direction-confirmation instruction breaks the ceiling.
- **Not authorization to take any production action, trading action, deploy action, env change, or RED-tier action.**
- **Not canonical over `orchestrator/COMM-HUB-RULES.md`.** If this checklist diverges from the rulebook, the rulebook wins.
- **Not canonical over `orchestrator/handoffs/COMM-HUB-CHANNEL-LAYOUT.md`.** If this checklist diverges from the channel layout, the channel layout wins.
