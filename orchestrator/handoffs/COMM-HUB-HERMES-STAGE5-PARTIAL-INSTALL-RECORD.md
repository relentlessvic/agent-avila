# Communication Hub — Relay Stage 5 Partial Install Record (template — COMM-HUB)

> **Author rule:** This file is the canonical record of the partial Stage 5 Relay install executed under the `COMM-HUB-HERMES-INSTALL` Gate-10 RED-tier approval. Stage 5 was approved with the exact 21-step canonical scope from `orchestrator/handoffs/COMM-HUB-INSTALL-HERMES-CHECKLIST.md`; in execution, Steps 1–13 were completed and Steps 14–21 were deferred because the Relay runtime image / process binary does not exist yet. This document records what was actually done, what was deferred, and what would be required to resume — so the partial-install state is version-controlled and visible to any future operator-approved phase.
>
> **This document is NOT authorization to install Relay further, deploy a Relay runtime, register additional Discord applications, mint additional tokens, invite the bot to additional servers, grant additional permissions, install a webhook / scheduler / MCP trigger / cron job / Ruflo / background automation, post to Discord, run a Stage 7 dry-run, take a production action, take a trading action, or break CEILING-PAUSE.** Stage 5's Gate-10 approval was bound to the canonical 21-step scope at HEAD `40f3137e842cd60acf1adf17ecc7fe2f0b1b8935`; that approval is now CONSUMED by the partial execution. **Resuming Steps 14–21 in any future phase requires a fresh Gate-10 approval at that future HEAD, plus a Relay runtime that does not exist today.**

> **Naming convention.** Internal Avila messenger references in this file's active forward-looking wording use "Relay" per `orchestrator/COMM-HUB-HERMES-RULES.md` "Naming convention" subsection. Phase identifiers (uppercase `HERMES` literals such as `COMM-HUB-HERMES-INSTALL`, `COMM-HUB-HERMES-INSTALL-CLOSEOUT`) and the filename (`COMM-HUB-HERMES-STAGE5-PARTIAL-INSTALL-RECORD.md`) are preserved verbatim because they record historical / committed phase identifiers. Filename rename is deferred to the COMM-HUB-RENAME-RELAY-FILES Phase B as a permanent historical artifact preserve (this record records past Steps 1–13 actions performed under the original "Hermes" name at HEAD `40f3137e842cd60acf1adf17ecc7fe2f0b1b8935`).

Author: Operator-driven manual execution (Victor at install execution time; Claude as orchestrator and step-by-step guide; no Discord-side or Railway-side action by Claude)
Last updated: 2026-05-06 (COMM-HUB-HERMES-INSTALL-CLOSEOUT — DOCS-ONLY). 2026-05-08 COMM-HUB-RENAME-RELAY-CONTENT Batch 5: forward-looking internal-messenger wording renamed Hermes → Relay; phase identifiers + filename preserved as historical record.
Canonical references:
- `orchestrator/COMM-HUB-HERMES-RULES.md` — canonical Relay specification (SAFE-class)
- `orchestrator/handoffs/COMM-HUB-INSTALL-HERMES-CHECKLIST.md` — Relay Stage 5 install checklist (the 21-step canonical sequence)
- `orchestrator/handoffs/COMM-HUB-HERMES-DRY-RUN-DESIGN.md` — Stage 4 dry-run design
- `orchestrator/handoffs/COMM-HUB-HERMES-STAGE5-PRECONDITIONS.md` — Stage 5 preconditions 12–15 codification
- `orchestrator/COMM-HUB-RULES.md` — Communication Hub rulebook (SAFE-class)
- `orchestrator/handoffs/COMM-HUB-CHANNEL-LAYOUT.md` — canonical channel/role/permission layout
- `orchestrator/AUTOPILOT-RULES.md` — ARC-8 phase-loop ceiling rule
- `orchestrator/APPROVAL-GATES.md` — Gate 10 automation install / upgrade
- `orchestrator/AUTOMATION-PERMISSIONS.md` — GREEN / YELLOW / RED tiers
- `orchestrator/PROTECTED-FILES.md` — SAFE / RESTRICTED / HARD BLOCK matrix
- `orchestrator/HANDOFF-RULES.md` — packet conventions and forbidden-content list

If any field below diverges from those canonical files, the canonical files win and this record must be re-aligned in a follow-up DOCS-ONLY phase.

---

## §1 — Phase classification and scope

This Stage 6 closeout phase (`COMM-HUB-HERMES-INSTALL-CLOSEOUT`) is **DOCS-ONLY**. It does NOT install Relay further, deploy a Relay runtime, register Discord applications, mint or rotate tokens, invite the bot to additional servers, grant additional permissions, install webhooks / schedulers / MCP triggers / cron jobs / Ruflo / background automation, post to Discord, run a Stage 7 dry-run, take a production action, take a trading action, or break CEILING-PAUSE.

The closeout produces:
- This new record file (`orchestrator/handoffs/COMM-HUB-HERMES-STAGE5-PARTIAL-INSTALL-RECORD.md`).
- Updates to 3 status docs (`orchestrator/STATUS.md`, `orchestrator/CHECKLIST.md`, `orchestrator/NEXT-ACTION.md`).

Total scope = 4 files.

---

## §2 — Reference HEAD

**Stage 5 install reference HEAD (the HEAD at which Stage 5 Gate-10 install approval was granted and consumed):** `40f3137e842cd60acf1adf17ecc7fe2f0b1b8935`

This is the HEAD of the prior phase `COMM-HUB-DOCS-F-HERMES-STAGE5-PRECONDITIONS` (codified Stage 5 preconditions 12–15).

The `COMM-HUB-HERMES-INSTALL-CLOSEOUT` phase commits at a later HEAD (whichever HEAD is current at commit time per `git rev-parse HEAD`). The commit identity for the closeout itself will be captured by `git log` after commit.

---

## §3 — Stage 5 Gate-10 install approval consumption

The Stage 5 Gate-10 install approval at HEAD `40f3137e842cd60acf1adf17ecc7fe2f0b1b8935` is **CONSUMED** by the partial-install execution recorded below. Per the canonical approval-gate consumption rule (`orchestrator/APPROVAL-GATES.md` "What is NOT operator approval" + RED-tier consumption discipline), a consumed approval cannot be reused. Any future resumption of Steps 14–21 requires:

- A fresh Gate-10 install approval at the then-current HEAD per `git rev-parse HEAD`.
- A fresh Codex install-readiness review at that HEAD (precondition 11 re-attestation).
- A fresh Victor in-session attestation of preconditions 12–15 (host class, network allowlist, token storage, account good-standing).
- A Relay runtime image / process binary that does not exist today.

The Stage 5 approval explicitly named the 21-step canonical scope. The unexecuted portion (Steps 14–21) does NOT roll over to a future phase under the consumed approval; it lapses with closeout.

---

## §4 — Steps 1–13 completion record

Per the canonical install checklist `orchestrator/handoffs/COMM-HUB-INSTALL-HERMES-CHECKLIST.md` §"Discord application / bot creation" steps 1–13:

| Step | Action | State (operator-attested at install execution) |
|---|---|---|
| 1 | Open Discord developer portal | ✅ Signed in as Victor's primary account; 2FA cleared; landing page showed primary account |
| 2 | Create application "Agent Avila Relay" | ✅ Application created; landing page loaded successfully |
| 3 | Configure application identity | ✅ Description set verbatim per checklist ("DORMANT-by-default one-way Discord publisher for Agent Avila status surfaces; never approval; never trading."); saved successfully |
| 4 | Privacy Policy / Terms of Service URLs | ✅ Both URL fields left blank; Discord did not require placeholders |
| 5 | Create bot user | ✅ Bot user exists; Public Bot OFF; Requires OAuth2 Code Grant OFF; saved successfully |
| 6 | Disable all 3 Privileged Gateway Intents | ✅ Presence Intent OFF; Server Members Intent OFF; Message Content Intent OFF |
| 7 | Mint Discord bot token to chosen host secret store ONLY | ✅ Token minted; pasted into Railway secret variable `DISCORD_BOT_TOKEN` on `agent-avila-hermes` service; clipboard cleared; Discord reveal popup dismissed; no token leaked to Claude / Codex / ChatGPT / any LLM context / Discord channel / repo / handoff packet / screenshot |
| 8 | Generate OAuth2 install URL | ✅ Scope = `bot` only; bot permissions = `Send Messages` + `View Channels` only; all other permissions OFF including `Read Message History`, `Administrator`, `Manage Webhooks`, `Manage Roles`, `Manage Channels`, `Use Application Commands`, `Add Reactions`, `Embed Links`, `Attach Files`, `Mention @everyone`, all voice permissions, all stage permissions, and every other permission; install URL copied (non-secret URL pattern; not pasted in this record per token-storage discipline) |
| 9 | Invite bot to `Agent Avila Hub` ONLY | ✅ Install URL opened in primary-account browser; selected server `Agent Avila Hub`; verified scope=bot and permissions=Send Messages + View Channels on the authorize page; clicked Authorize; CAPTCHA cleared; bot `Agent Avila Relay` now visible in `Agent Avila Hub` member list; no messages posted in any channel; bot not invited to any other server |
| 10 | Assign bot to `System-Writer` role | ✅ Bot is in `System-Writer` role only (plus implicit `@everyone`); no `CEO`, `Hub-Read`, `Codex-Writer`, or `Trading-Writer` role on bot |
| 11 | Activate `System-Writer` role permissions | ✅ Role permissions: `View Channels` ON, `Send Messages` ON, all other permissions OFF including `Read Message History` and `Administrator`; saved successfully |
| 12 | Per-channel allow overrides on 3 allowed channels | ✅ `#status`, `#summaries`, `#system-health` each have a `System-Writer` row with allow `View Channel` + `Send Messages` and explicit deny on `Read Message History`, `Add Reactions`, `Embed Links`, `Attach Files`, `Mention @everyone`, `Manage Messages`, `Manage Channel`, `Manage Permissions`, `Use Application Commands`; saved on each |
| 13 | Per-channel deny overrides on 4 forbidden channels | ✅ `#approvals`, `#codex-warnings`, `#trading-alerts`, `#trading-summaries` each have a `System-Writer` row with deny on `View Channel`, `Send Messages`, `Read Message History`, every other permission; saved on each |

Operator-attested safety properties at end of Steps 1–13:

- ✅ `System-Writer` role has only `Send Messages` + `View Channels` at role level; all other permissions OFF.
- ✅ `Read Message History` is OFF at role level + explicitly denied on every channel where `System-Writer` has a row (3 allowed + 4 forbidden = 7 channels).
- ✅ `Administrator` is OFF at every layer.
- ✅ Bot is in `Agent Avila Hub` only; not invited to any other server.
- ✅ Discord bot token lives only in Railway secret variable `DISCORD_BOT_TOKEN` on the `agent-avila-hermes` service; never leaked.
- ✅ No public Discord invite link generated.
- ✅ No webhook created in `Agent Avila Hub`.
- ✅ No message posted in any channel during Steps 1–13.
- ✅ Bot has no posting capability without a running Relay process; no process is running.

---

## §5 — Steps 14–21 deferral record

Per the canonical install checklist §"Discord application / bot creation" steps 14–21, the following sub-steps are **DEFERRED** to a future operator-approved phase. The Stage 5 Gate-10 approval lapses with this closeout; resumption requires a fresh Gate-10 approval at the then-current HEAD plus a Relay runtime image that does not exist today.

| Step | Action (deferred) | Reason for deferral |
|---|---|---|
| 14 | Provision the Relay container/image on the chosen host (Railway service `agent-avila-hermes`); enforce egress allowlist; configure non-root non-privileged user; verify no git checkout / no DB credentials / no Kraken credentials / no Railway credential leakage / no `MANUAL_LIVE_ARMED` env var; configure logging endpoint env var | Relay runtime code does not exist; no image to deploy |
| 15 | Provision Relay-private append-only publish log on host | Coupled to runtime; deferred with Step 14 |
| 16 | Provision source-of-truth message store on host | Coupled to runtime; deferred |
| 17 | Configure halt-on-anomaly defaults (per the canonical 19 distinct halt classes documented in `orchestrator/handoffs/COMM-HUB-HERMES-DRY-RUN-DESIGN.md` §7) | Coupled to runtime; deferred |
| 18 | Smoke-test connectivity (boot, Discord gateway IDENTIFY+READY, channel-list inspection of 3 allowed + verification of 4 forbidden NOT visible); NO message published | Requires running Relay process; deferred |
| 19 | Stop the Relay process at end of install | No process to stop; vacuously satisfied (state at end of Steps 1–13 has no running Relay process) |
| 20 | Capture install evidence locally (tokens redacted; not committed; not posted; not shared externally) | Operator-side step; partially satisfied for Steps 1–13 (operator may have screenshots of the developer portal / Railway dashboard); fully deferred for Steps 14–18 (no runtime evidence to capture) |
| 21 | Open Stage 6 closeout (this current phase) | This current phase IS the Stage 6 closeout |

---

## §6 — Effective state of Relay (post-closeout, no runtime running)

After Stage 6 closeout commits and pushes, Relay is in a "shelved" state:

- **Discord-side:** the bot `Agent Avila Relay` is a passive member of `Agent Avila Hub` with the `System-Writer` role + canonical channel overrides (allow on 3 + explicit deny on 4). The bot **cannot post anywhere** because no Relay process is running. The bot exists only as a Discord-side member object; without a running runtime authenticated with the bot token, no Discord API call is made.
- **Railway-side:** the `agent-avila-hermes` service exists as an empty service shell with the `DISCORD_BOT_TOKEN` secret variable populated. No deployment is running. No GitHub source is connected. No trading env variables are present.
- **Trading-runtime-side:** completely separate. Relay has no link to `agent-avila-dashboard`, the production DB, Kraken, env, `MANUAL_LIVE_ARMED`, or `position.json`.
- **Process-state:** no Relay process exists anywhere. The Stage 5 approval scope did not authorize the operator to write or build a Relay runtime; no runtime authoring track has opened. Relay is, in effect, a Discord-side member with a stored token but no actual program using it.
- **Posting capability:** zero. Even if the operator started a third-party Discord-bot framework with the stored token outside the orchestrator framework, that would be (a) unauthorized per `orchestrator/COMM-HUB-HERMES-RULES.md`'s anti-execution boundaries, (b) not in scope of the consumed Stage 5 approval, and (c) detectable through log evidence and channel-content inspection. The orchestrator framework provides no path to "accidentally" post via Relay from the shelved state.
- **Read-Message-History capability:** zero at every layer (role-level OFF + explicit deny on every channel where `System-Writer` has a row).
- **Trading authority:** zero (forever forbidden per Relay spec).
- **Approval authority:** zero (forever forbidden per Relay spec).

Migration 008 remains APPLIED at HEAD `189eb1be6ef6304d914671bdaedec44d389cf877`. N-3 remains CLOSED. CEILING-PAUSE remains active and not broken. Autopilot runtime remains DORMANT. Approvers remain exactly `{Victor}`. Stage 7 `COMM-HUB-HERMES-DRY-RUN` remains separately gated and is not authorized by this closeout. Stages 8 / 9 / 10a / 10b remain separately gated.

---

## §7 — Rollback path (3-step reversibility)

If the operator decides to abandon the Relay track entirely or revert Relay to fully DORMANT state, three reversible steps:

1. **Reset the Discord bot token.** Discord developer portal → Application "Agent Avila Relay" → Bot tab → Reset Token → confirm. The new token is discarded (do NOT save it). The previously-minted token (currently in Railway secret variable) becomes invalid; any future authentication attempt with it fails. This is the fastest single-step DORMANT-revert per the canonical install checklist §"Rollback / removal steps".

2. **Kick the bot from `Agent Avila Hub`.** Server Settings → Members → `Agent Avila Relay` (bot row) → Kick Member → confirm. The bot is removed from the server immediately. The `System-Writer` role's allow / deny overrides remain on the 7 channels but apply to no member (the role exists with zero members per the Discord install).

3. **Delete the `agent-avila-hermes` Railway service.** Railway dashboard → `agent-avila-hermes` service → Settings → Delete Service → confirm. The service shell is removed; the `DISCORD_BOT_TOKEN` secret variable is deleted with it.

After these 3 steps, Relay is fully DORMANT in the same state as before Stage 5 began (zero members, zero permissions on `System-Writer` role still set per Step 11 — but with zero members; no Railway service; no token anywhere).

**Optional 4th step** (only if operator wants to remove the Relay Discord application entirely): Discord developer portal → Application → Delete App → confirm. This deletes the application identity itself; future Relay installs would need a fresh application registration.

The rollback path is operator-side manual; no automation. Each step requires explicit Victor in-session approval if the operator opens a `COMM-HUB-HERMES-DEACTIVATE` phase per the canonical Relay spec staged-path EOL row.

---

## §8 — Future-phase requirements (NOT authorized by this closeout)

The following work would be required to complete the deferred Steps 14–21 in a future operator-approved phase. **None of the following is authorized by this closeout.**

### 8.1 Relay runtime authoring track

Before Steps 14–21 can resume, a Relay runtime image / process binary must exist. Authoring this runtime is its own substantive implementation track, distinct from the DOCS-ONLY / DESIGN-ONLY phases that produced the Relay spec, install checklist, dry-run design, and preconditions doc. Suggested phase sequence (each requires its own separate operator approval):

- **`COMM-HUB-HERMES-RUNTIME-DESIGN`** (DESIGN-ONLY conversation) — design the Relay process architecture: language / framework choice (Discord client library compatibility), idempotency-store data model, source-of-truth message store schema, halt-on-anomaly state machine, container image base, env variable handling, logging output format, signal-handling for clean exit, single-instance discipline mechanism, etc. Codex design review at end. Operator-directed manual; conversation-only; no commit.
- **`COMM-HUB-HERMES-RUNTIME-DOCS`** (DOCS-ONLY) — codify the runtime design as an on-disk template (e.g., `orchestrator/handoffs/COMM-HUB-HERMES-RUNTIME-DESIGN.md`) plus possibly cross-reference updates. Codex docs-only review. Commit-only + push approvals.
- **`COMM-HUB-HERMES-RUNTIME-IMPLEMENT`** (SAFE / HIGH-RISK IMPLEMENTATION — NOT DOCS-ONLY) — write actual runtime code in a new directory (e.g., `hermes/`) or separate operator-controlled repository. This phase implements code, not docs. Code review (Codex + operator), tests, build pipeline, container image construction. **This phase tier and scope require fresh design and a separate Stage-5-style approval cascade because the canonical Relay spec calls Relay "governance-only" and "never a trading actor" — but a runtime implementation phase still has substantive code that must be reviewed for compliance with the canonical anti-execution boundaries.**
- **`COMM-HUB-HERMES-RUNTIME-IMPLEMENT-CLOSEOUT`** (DOCS-ONLY) — record runtime implementation completion.

### 8.2 Stage 5 install resumption

After a Relay runtime image exists and is operator-approved, Stage 5 install can resume:

- **`COMM-HUB-HERMES-INSTALL-RESUME`** (or named-equivalent; operator-chosen) — opens at a fresh HEAD, requires:
  - Fresh Codex install-readiness review at that HEAD (re-attesting all 15 preconditions including the new "runtime exists and is operator-approved" condition).
  - Fresh Victor in-session Gate-10 approval naming the exact resumption scope (Steps 14–21 only, since Steps 1–13 are already done).
  - Fresh Victor in-session attestation of precondition 15 (account good standing — time-bound).
  - The operator deploys the Relay runtime to the existing `agent-avila-hermes` Railway service shell + configures egress allowlist + smoke-tests connectivity (no publish) + stops the process + captures evidence + opens a Stage 6 closeout for the resumption.

### 8.3 Stage 7 dry-run

After full Stage 5 resumption + Stage 6 finalization closeout, Stage 7 `COMM-HUB-HERMES-DRY-RUN` can open per the canonical staged-path. Stage 7 requires its own per-action operator approval; runs the test fixtures from `orchestrator/handoffs/COMM-HUB-HERMES-DRY-RUN-DESIGN.md` §4; no real Discord post; halt-on-anomaly verification across the 19 distinct halt classes.

### 8.4 Stages 8 / 9 / 10a / 10b

After Stage 7 dry-run completes successfully and is closed, Stages 8 (`COMM-HUB-HERMES-DRAFT-ONLY-MODE`), 9 (`COMM-HUB-HERMES-LIMITED-AUTO-PUBLISH-STATUS`), 10a (`COMM-HUB-HERMES-AUTO-PUBLISH-SUMMARIES`), and 10b (`COMM-HUB-HERMES-AUTO-PUBLISH-SYSTEM-HEALTH`) become available per the canonical staged-path. Each requires its own separately-approved phase + approval discipline (per-message Victor approval through Stage 9; bounded class authorization at Stage 10a / 10b with all 7 documented bounds per Relay spec §"Approval discipline").

---

## §9 — Preserved state (recorded for context)

This closeout preserves:

- **Relay effectively DORMANT** from a posting-capability perspective. The `System-Writer` role has minimum-active permissions per Step 11 (NOT zero permissions as canonical DORMANT — but the role has only `View Channels` + `Send Messages` and no Relay process is running, so no actual posting occurs).
- **CEILING-PAUSE active and not broken.** Operator-directed manual closeout phase does NOT advance autopilot phase-loop counter and does NOT break CEILING-PAUSE per `orchestrator/AUTOPILOT-RULES.md` ARC-8.
- **Autopilot runtime DORMANT.**
- **Migration 008 APPLIED** at HEAD `189eb1be6ef6304d914671bdaedec44d389cf877` (Attempt 6 — 2026-05-04, runner exit 0).
- **N-3 CLOSED.**
- **Approvers exactly `{Victor}`.**
- **Stage 5 Gate-10 install approval CONSUMED** by partial execution; cannot be reused.
- **Stage 7 `COMM-HUB-HERMES-DRY-RUN` separately gated.**
- **Stages 8 / 9 / 10a / 10b separately gated.**
- **Relay runtime authoring NOT authorized.**
- **Discord server `Agent Avila Hub`** unchanged in structure (3 categories, 7 channels, 5 roles); only state change is the new `Agent Avila Relay` bot member with `System-Writer` role + per-channel overrides per Steps 9–13.
- **Discord developer portal** has the `Agent Avila Relay` application registered in Victor's primary account.
- **Railway** has the `agent-avila-hermes` service shell with `DISCORD_BOT_TOKEN` secret variable; no deployment, no other env vars.

### Relay role permission deviation note

The canonical Relay spec defines DORMANT as zero members and zero permissions. Step 11 of the canonical install checklist activates the `System-Writer` role from zero permissions to `View Channels` + `Send Messages`. After Step 11, the role is no longer zero-permission. This is the canonical install-time transition documented in the spec staged-path; Step 11 is the canonical Stage 5 sub-step that activates the role from DORMANT to minimum-active.

In the partial-install state recorded by this closeout:
- `System-Writer` role: minimum-active (`View Channels` + `Send Messages`); 1 member (the bot).
- Relay process: not running.
- Effective posting capability: zero.

This is a different state from "fully DORMANT" (zero permissions, zero members) but is the canonical post-Step-11 state. Any future `COMM-HUB-HERMES-DEACTIVATE` phase would revert the role to zero permissions and zero members.

---

## §10 — Authorization scope (explicit non-authorizations)

This Stage 6 closeout phase **does NOT authorize** any of the following:

- Relay install resumption (Steps 14–21).
- Relay runtime authoring or implementation.
- Relay runtime deployment to the `agent-avila-hermes` Railway service.
- Relay process boot or smoke-test execution.
- Discord post in any channel.
- Webhook creation in `Agent Avila Hub` or any other server.
- Scheduler / MCP trigger / cron job / Ruflo / background-automation install.
- Discord application registration beyond the existing `Agent Avila Relay`.
- Discord bot token rotation, reset, or re-mint.
- Bot invite to any server other than `Agent Avila Hub`.
- Granting any additional Discord permission to any role.
- Granting Relay `Read Message History` (forever forbidden by canonical Relay spec).
- Granting Relay any approval authority (forever forbidden).
- Granting Relay any trading authority (forever forbidden).
- Public Discord invite-link creation.
- Discord-to-Railway / Discord-to-GitHub / Discord-to-Kraken / Discord-to-production-DB connection.
- Trading-alert connection.
- Codex-Writer activation, Trading-Writer activation, Category C activation.
- Production action (Railway, production DB, Kraken, env, `MANUAL_LIVE_ARMED`, runtime edit, deploy, migration application).
- Live trading.
- Autopilot runtime activation.
- Autopilot CEILING-PAUSE break.
- ARC-8-RUN-C.
- Stage 7 / 8 / 9 / 10a / 10b execution.
- Modification of canonical Relay spec, install checklist, dry-run design, preconditions doc, channel layout, or any safety-policy doc.

**Each of the deferred Steps 14–21, the runtime authoring track, and any later Relay activation stage requires its own separately-approved phase with its own design / Codex review / explicit Victor approval cascade.**

---

## What this document is NOT

- **Not authorization to resume Stage 5 install (Steps 14–21).** Resumption is a separately operator-approved phase with a fresh Gate-10 approval and a Relay runtime image that does not yet exist.
- **Not authorization to author or deploy a Relay runtime.** Runtime authoring is a separate substantive implementation track with its own design / docs / implement / closeout phase sequence.
- **Not authorization to start the Relay process.** The `agent-avila-hermes` Railway service exists with a token, but no runtime is deployed; the operator cannot start a non-existent runtime, and the closeout does not authorize starting one even if it did exist.
- **Not authorization to post any Discord message via Relay.** Discord posting via Relay is gated behind Stages 9 / 10a / 10b, each separately approved.
- **Not authorization to break CEILING-PAUSE.** Only an explicit operator direction-confirmation breaks the ceiling.
- **Not authorization for any trading / Railway / production-DB / Kraken / env / `MANUAL_LIVE_ARMED` action.**
- **Not canonical over `orchestrator/COMM-HUB-HERMES-RULES.md`.** If this record diverges from the Relay spec, the spec wins.
- **Not canonical over `orchestrator/handoffs/COMM-HUB-INSTALL-HERMES-CHECKLIST.md`.** If this record diverges from the install checklist's 21-step canonical sequence, the install checklist wins.
- **Not canonical over `orchestrator/handoffs/COMM-HUB-HERMES-DRY-RUN-DESIGN.md`.** If this record diverges from the dry-run design, the dry-run design wins.
- **Not canonical over `orchestrator/handoffs/COMM-HUB-HERMES-STAGE5-PRECONDITIONS.md`.** If this record diverges from the preconditions doc, the preconditions doc wins.
- **Not canonical over `orchestrator/COMM-HUB-RULES.md`.** If this record diverges from the rulebook, the rulebook wins.
- **Not canonical over `orchestrator/handoffs/COMM-HUB-CHANNEL-LAYOUT.md`.** If this record diverges from the channel layout, the channel layout wins.
- **Not canonical over `orchestrator/AUTOMATION-PERMISSIONS.md`.** If this record diverges from the automation-permissions tiers, the tiers win.
- **Not canonical over `orchestrator/APPROVAL-GATES.md`.** If this record diverges from the gate matrix, the gate matrix wins.

**This Stage 6 closeout phase (`COMM-HUB-HERMES-INSTALL-CLOSEOUT`) is DOCS-ONLY and records the partial Stage 5 install. Relay is in a "shelved" state with no posting capability. Stage 5 Gate-10 install approval is CONSUMED. Steps 14–21 require a fresh separately-approved phase with a Relay runtime that does not exist today.**
