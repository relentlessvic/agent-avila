# Communication Hub — Relay Install Checklist (template — COMM-HUB)

> **Author rule:** This checklist codifies the click-by-click manual Relay install plan for the Agent Avila Communication Hub. It is a docs-only specification — not a runtime install. **This checklist is NOT authorization to install Relay, register a Discord application or bot, mint a bot token, invite a bot to the server, grant any permission, install a webhook / scheduler / MCP trigger / cron job / Ruflo / background automation, change CEILING-PAUSE, take any production action, take any trading action, or post to Discord.** Actual Relay install requires a separate operator-approved phase (`COMM-HUB-HERMES-INSTALL`, Stage 5 per `orchestrator/COMM-HUB-HERMES-RULES.md`) which is **Gate 10 (automation install / upgrade)** per `orchestrator/APPROVAL-GATES.md` and requires explicit Victor in-session approval at that future time.
>
> **No Relay runtime, Discord bot, webhook, scheduler, MCP trigger, cron job, or background automation is installed by writing this file.**

Author: Operator-driven manual planning (Claude as orchestrator; future installs Victor-only)
Last updated: 2026-05-05 (COMM-HUB-DOCS-D-HERMES-INSTALL-CHECKLIST — DOCS-ONLY)
Canonical references:
- `orchestrator/COMM-HUB-HERMES-RULES.md` — canonical Relay specification (SAFE-class)
- `orchestrator/COMM-HUB-RULES.md` — Communication Hub rulebook (SAFE-class)
- `orchestrator/handoffs/COMM-HUB-CHANNEL-LAYOUT.md` — canonical channel/role/permission layout (lines 136–145 carry `System-Writer (Relay)` DORMANT row)
- `orchestrator/handoffs/COMM-HUB-INSTALL-DISCORD-CHECKLIST.md` — Discord server install checklist (followed by `COMM-HUB-INSTALL-DISCORD`)
- `orchestrator/AUTOPILOT-RULES.md` — ARC-8 phase-loop ceiling rule
- `orchestrator/APPROVAL-GATES.md` — Gate 10 automation install / upgrade
- `orchestrator/AUTOMATION-PERMISSIONS.md` — GREEN / YELLOW / RED tiers; future-automation governance-only inheritance
- `orchestrator/PROTECTED-FILES.md` — SAFE / RESTRICTED / HARD BLOCK matrix
- `orchestrator/HANDOFF-RULES.md` — packet conventions and forbidden-content list
- `orchestrator/ROLE-HIERARCHY.md` — role boundaries; future-automation governance-only inheritance

If any field below diverges from `orchestrator/COMM-HUB-HERMES-RULES.md`, `orchestrator/COMM-HUB-RULES.md`, or `orchestrator/handoffs/COMM-HUB-CHANNEL-LAYOUT.md`, the canonical files win and this checklist must be re-aligned in a follow-up DOCS-ONLY phase. The Relay spec is canonical for capability scope; the rulebook is canonical for the Communication Hub; the channel layout is canonical for per-role permissions.

---

## Phase context

This checklist is the persistent on-disk codification of the Stage 3 Relay install plan, downstream of the Stage 1 design (`COMM-HUB-DESIGN-HERMES`, Codex 8/8 PASS after one revision round; conversation-only) and Stage 2 codification (`COMM-HUB-DOCS-C-HERMES-SPEC`, closed at `96f56a4767cc96ddd8b78bcc3b309e8fd455c8a5`; Relay spec written; cross-references applied).

The downstream operator-driven manual install phase (`COMM-HUB-HERMES-INSTALL`, Stage 5) will follow this checklist verbatim. That phase is **separately operator-approved** and is **operator-directed manual** (no automation; no autopilot involvement) and is gated by a Stage 4 dry-run-design phase (`COMM-HUB-HERMES-DRY-RUN-DESIGN`) and a Stage 5 pre-install Codex install-readiness review.

CEILING-PAUSE remains active and is not broken by writing this checklist or by following it later. Operator-directed manual phases do NOT advance the autopilot phase-loop counter and do NOT break CEILING-PAUSE.

**Relay remains DORMANT (zero members, zero permissions) throughout all stages prior to Stage 5 install completion. After install, Relay remains constrained by its capability allow-list (Send Messages + View Channels for 3 channels) regardless of stage.**

---

## Preconditions before Relay install (must all be true before Stage 5 opens)

These conditions are verified by the operator and Codex during the Stage 5 install-readiness review. Each missing precondition halts the install plan.

1. **Discord server exists.** `Agent Avila Hub` (or operator-chosen equivalent) has been manually created per `orchestrator/handoffs/COMM-HUB-INSTALL-DISCORD-CHECKLIST.md` and `COMM-HUB-INSTALL-DISCORD` is closed.
2. **Server install verified.** Verification checklist in the Discord install checklist passed; channel structure matches the canonical 3-category / 7-channel layout; Future-Trading remains DORMANT; no bot / webhook / scheduler / MCP / cron / Ruflo / Relay / background automation is currently installed.
3. **Relay spec is canonical and unchanged.** `orchestrator/COMM-HUB-HERMES-RULES.md` is the canonical Relay spec; no divergence from `orchestrator/handoffs/COMM-HUB-CHANNEL-LAYOUT.md`.
4. **This checklist is canonical and Codex-PASS.** `orchestrator/handoffs/COMM-HUB-INSTALL-HERMES-CHECKLIST.md` (this file) is committed, pushed, and Codex-reviewed PASS at the install-readiness round.
5. **Stage 4 dry-run design closed.** `COMM-HUB-HERMES-DRY-RUN-DESIGN` is closed (DESIGN-ONLY conversation; no commit) with Codex PASS.
6. **CEILING-PAUSE state.** Active and not broken; or explicit Victor direction-confirmation has reset the counter to 0 and authorized this Relay install track. Operator-directed manual stages do NOT advance the autopilot phase-loop counter and do NOT break CEILING-PAUSE.
7. **N-3 closed.** Migration 008 APPLIED at HEAD `189eb1be6ef6304d914671bdaedec44d389cf877`; no production-DB action open; no migration in-flight.
8. **Approval-fatigue queue.** Position ≤ 1 of 2 (per `orchestrator/AUTOPILOT-RULES.md` ARC-8). Stage 5 install becomes the single pending request.
9. **Three-way SHA consistency PASS.** Local HEAD = origin/main = live remote HEAD (per `orchestrator/COMM-HUB-RULES.md` pre-publish discipline applied here as pre-install discipline).
10. **Working tree clean.** Apart from documented pre-existing untracked artifacts (e.g., `position.json.snap.20260502T020154Z`).
11. **Codex install-readiness PASS at Stage 5 entry.** Fresh Codex review of this checklist + the Stage 4 dry-run design + the proposed install scope returns PASS at the HEAD that will be referenced in the Stage 5 approval.
12. **Operator hosting decision recorded.** The host environment for the Relay process has been chosen by Victor (e.g., a separate Railway service, a separate dedicated container, a self-hosted box; never the `agent-avila-dashboard` service); the choice is documented in the Stage 5 packet. **Relay does NOT share a process, image, or env scope with the trading runtime.**
13. **Operator network-allowlist plan recorded.** The egress allowlist for the Relay host (Discord API only) has been documented in the Stage 5 packet.
14. **Operator token-storage plan recorded.** The Discord bot token storage location (host-specific secret store; never repo; never `.env` committed; never `position.json`; never any orchestrator doc) has been documented in the Stage 5 packet.
15. **Operator account in good standing.** Victor's primary Discord account is the server owner with `CEO` role and Administrator permission; 2FA enabled.

If any precondition is missing or stale, the operator MUST defer Stage 5 and re-open the relevant earlier stage (or open a new scoped operator-approved phase to satisfy the missing precondition).

---

## Required Victor approvals (gate sequence)

Each gate is granted in-session by Victor only. Codex PASS, clean tree, green tests, scheduled triggers, signed tokens, automation-internal state, and any LLM self-approval DO NOT satisfy any gate. Per `orchestrator/APPROVAL-GATES.md` "What is NOT operator approval".

| Gate | When | Class | Required action |
|---|---|---|---|
| Stage 3 commit-only approval | This phase (`COMM-HUB-DOCS-D-HERMES-INSTALL-CHECKLIST`) | Per existing workflow | Operator names the 4-file scope (this checklist + 3 status docs) |
| Stage 3 push approval | This phase | Per existing workflow | Operator names the commit SHA to push |
| Stage 4 design approval | `COMM-HUB-HERMES-DRY-RUN-DESIGN` (DESIGN-ONLY) | Operator-directed manual; no commit | Conversation-only |
| Stage 5 install-readiness approval | Pre-install Codex review of this checklist + dry-run design at the new HEAD | Per existing workflow | Operator confirms Codex PASS |
| **Stage 5 Gate-10 install approval** | `COMM-HUB-HERMES-INSTALL` install execution | **RED-tier per `orchestrator/APPROVAL-GATES.md` Gate 10 (automation install / upgrade)** | Operator names the exact install scope (Discord app/bot creation, host setup, token storage, network allowlist, channel permission grants, dry-run trigger plan) |
| Stage 6 closeout commit-only approval | `COMM-HUB-HERMES-INSTALL-CLOSEOUT` | Per existing workflow | Operator names the 3-file status doc scope |
| Stage 6 closeout push approval | Stage 6 | Per existing workflow | Operator names the commit SHA to push |
| Stage 7 dry-run approval | `COMM-HUB-HERMES-DRY-RUN` | Per-action | Operator authorizes the no-publish dry-run |
| Stage 8 draft-only approval | `COMM-HUB-HERMES-DRAFT-ONLY-MODE` | Per-action | Operator authorizes draft-only mode (no publish) |
| Stage 9 first-auto-publish approval | `COMM-HUB-HERMES-LIMITED-AUTO-PUBLISH-STATUS` first message | RED-tier per-message | Operator authorizes the FIRST auto-publish to `#status` only; per-message Victor approval continues for every message through Stage 9 |
| Stage 10a class-authorization approval | `COMM-HUB-HERMES-AUTO-PUBLISH-SUMMARIES` | Stage-promotion approval + per-message OR class-authorization with all 7 bounds | First Stage at which a bounded class is permitted; class requires Codex review + explicit Victor in-session approval naming all 7 bounds (channel, template, allowed event types, max count, expiration, revocation rule, forbidden-content constraints) |
| Stage 10b class-authorization approval | `COMM-HUB-HERMES-AUTO-PUBLISH-SYSTEM-HEALTH` | Same as 10a | Per-channel scope |
| Halt-resume approval | Any time Relay halts | Per-action | No auto-resume |
| Deactivation approval | `COMM-HUB-HERMES-DEACTIVATE` (always available) | Per-action | Reverts Relay to DORMANT |

The set of approvers is and remains exactly `{Victor}`. Relay never has approval authority.

**Discord replies, emojis, and reactions are NEVER approvals. Only Victor's explicit in-session chat instruction grants approval.**

---

## Discord application / bot creation (future manual checklist for Stage 5 only — not now)

These steps are for the operator at Stage 5 install execution time. **Do not perform them at any earlier stage.** Each step is a click-instruction in the Discord developer portal and the existing `Agent Avila Hub` server.

**Pre-step: confirm preconditions.** All 15 preconditions in the section above are true; Stage 5 Gate-10 install approval has been granted in-session by Victor naming the exact install scope.

1. **Open the Discord developer portal.** Browse to the operator's Discord developer portal (operator-managed; no link recorded here to avoid accidental click). Sign in with Victor's primary Discord account (the same account that owns `Agent Avila Hub`).
2. **Create a new application.** Developer Portal → Applications → New Application → name: `Agent Avila Relay` (or operator-chosen equivalent matching the spec). Confirm 2FA prompt if Discord requests it.
3. **Configure application identity.** Application → General Information → set short description ("DORMANT-by-default one-way Discord publisher for Agent Avila status surfaces; never approval; never trading.") → set application icon (operator preference; optional). Save.
4. **Set Privacy Policy / Terms of Service URLs.** Leave blank at install (no public-facing surface). If Discord requires a placeholder, operator records the placeholder choice in the Stage 5 evidence.
5. **Create the bot user.** Application → Bot → Add Bot → confirm. **Disable** "Public Bot" (others must NOT be able to add this bot). **Disable** "Requires OAuth2 Code Grant".
6. **Disable all Privileged Gateway Intents.** Application → Bot → Privileged Gateway Intents: **Presence Intent OFF**, **Server Members Intent OFF**, **Message Content Intent OFF**. Relay does not need any privileged intent. **No intent is enabled at install.**
7. **Mint the bot token.** Application → Bot → Reset Token → copy the token to the operator-chosen secret store (per the precondition-14 plan). **The token is NEVER pasted into the repo, NEVER pasted into a Discord channel, NEVER pasted into Codex, NEVER pasted into Claude or any LLM, NEVER attached to any handoff packet, NEVER put in `.env*` files committed to git.** The token is stored only in the host's secret store.
8. **Configure OAuth2 install scope (allow-list only).** Application → OAuth2 → URL Generator. Scopes: **`bot` only** (not `applications.commands`, not `webhook.incoming`). Bot Permissions: **`Send Messages` + `View Channels` ONLY**. **Do NOT check** `Read Message History`, `Manage Channels`, `Manage Roles`, `Kick Members`, `Ban Members`, `Manage Webhooks`, `Mention Everyone`, `Use Application Commands`, `Create Invite`, `Send TTS Messages`, `Embed Links`, `Attach Files`, `Add Reactions`, `Use External Emoji`, `Use External Stickers`, or any other permission. Copy the generated install URL.
9. **Invite the bot to `Agent Avila Hub` ONLY.** Open the install URL in a browser logged in as Victor's primary Discord account → select server `Agent Avila Hub` → confirm scope (`bot`) → confirm permissions (`Send Messages` + `View Channels`) → click Authorize → complete CAPTCHA. **Do not invite the bot to any other server. Do not generate a public install link.**
10. **Verify bot landed in the correct role.** Server Settings → Members → confirm the new `Agent Avila Relay` member exists with the `System-Writer` role (the Relay role created during Discord install at DORMANT). If the bot is not in `System-Writer`, manually move it to `System-Writer` (Server Settings → Members → bot → Roles → check `System-Writer`). Confirm bot has no other role.
11. **Activate the System-Writer role with the minimum required permissions.** Server Settings → Roles → `System-Writer` → permissions: **Send Messages** ON, **View Channels** ON. **All other permissions remain OFF.** Specifically confirm OFF: `Read Message History`, `Manage Channels`, `Manage Roles`, `Kick Members`, `Ban Members`, `Manage Webhooks`, `Mention Everyone`, `Use Application Commands`, `Create Invite`, `Send TTS Messages`, `Embed Links`, `Attach Files`, `Add Reactions`, `Use External Emoji`, `Use External Stickers`, `Administrator`. Save.
12. **Apply per-channel permission overrides for the 3 allowed channels.** For each of `#status`, `#summaries`, `#system-health`: Channel → Edit Channel → Permissions → add `System-Writer` → allow `View Channel` and `Send Messages`; **explicitly deny** `Read Message History`, `Add Reactions`, `Embed Links`, `Attach Files`, `Mention @everyone`, `Manage Messages`, `Manage Channel`, `Manage Permissions`, `Use Application Commands`. Save each channel.
13. **Apply per-channel deny overrides for the 4 forbidden channels.** For each of `#approvals`, `#codex-warnings`, `#trading-alerts`, `#trading-summaries`: Channel → Edit Channel → Permissions → add `System-Writer` → **explicitly deny** `View Channel`, `Send Messages`, `Read Message History`, every other permission. Save each channel.
14. **Set up the host process.** On the operator-chosen host (precondition 12), provision the Relay container/image with the Discord token from the secret store. The host MUST: (a) restrict egress to the Discord API only (precondition 13 allowlist), (b) run the Relay process as a non-root, non-privileged user, (c) have no git checkout, (d) have no DB credentials, (e) have no Kraken credentials, (f) have no Railway credentials beyond what the host requires for its own management, (g) have no `MANUAL_LIVE_ARMED` env var, (h) have only the Discord bot token + a logging endpoint env var.
15. **Configure idempotency store.** Provision the Relay-private append-only publish log on the host (file or simple append-only datastore). Verify the log location is operator-readable, append-only, and not shared with any other process.
16. **Configure source-of-truth message store.** Provision the read-only append-only message store the Relay process reads from (per Relay spec §"Message contract / metadata schema"). At install, the store is initially empty; first messages are added in Stage 8 / 9 only.
17. **Configure halt-on-anomaly defaults.** Relay process configuration: halt-on missing/stale Codex PASS metadata, halt-on missing operator authorization, halt-on channel not in allow-list, halt-on character limit exceeded, halt-on rate limit hit, halt-on network anomaly, halt-on idempotency-key mismatch, halt-on CEILING-PAUSE state ACTIVE. **No auto-resume.**
18. **Smoke-test connectivity (no publish).** Operator runs a connection-only check: Relay process boots, authenticates to Discord with the bot token, lists allowed channels via the View Channels permission (read-only listing of channel ids; NOT message content), confirms the 3 allowed channels are reachable and the 4 forbidden channels are NOT in the bot's visible-channel list (because of step 13 deny overrides). **No message is published in this smoke test.** If any anomaly, halt and re-run earlier steps.
19. **Stop the Relay process after smoke-test.** The process remains in DRAFT-ONLY (Stage 8) state by default until the Stage 7 dry-run / Stage 8 draft-only-mode / Stage 9 first-auto-publish approvals each open separately.
20. **Record install evidence.** Operator captures the verification screenshots per the "Evidence checklist" section below and stores them locally; not committed; not posted to any Discord channel; not shared externally.
21. **Operator records install completion** in a separate operator-approved phase (`COMM-HUB-HERMES-INSTALL-CLOSEOUT`, Stage 6) by updating STATUS / CHECKLIST / NEXT-ACTION docs.

**Steps that are NOT in this install:**
- Posting any test message in any channel. Channels remain operator-published only until Stage 9 first-auto-publish lands.
- Generating any public Discord invite link.
- Adding the bot to any other Discord server.
- Granting `System-Writer` write to `#approvals`, `#codex-warnings`, `#trading-alerts`, or `#trading-summaries`.
- Granting `System-Writer` `Read Message History` on any channel.
- Adding any other intent (Presence / Members / Message Content all stay OFF).
- Installing any webhook on the server.
- Installing any other bot.
- Connecting Relay to Railway, Kraken, the production DB, GitHub, or any non-Discord endpoint.

---

## Permission boundaries (full enumeration)

Relay role permissions at install time, mirroring `orchestrator/COMM-HUB-HERMES-RULES.md` Allowed/Forbidden capability matrix.

### Discord token scope (allow-list — full enumeration)

| Permission | State at install | Rationale |
|---|---|---|
| `Send Messages` | ON (only on the 3 allowed channels via channel-level overrides) | Required for one-way publish |
| `View Channels` | ON (only on the 3 allowed channels via channel-level overrides) | Required to address channels by id |
| `Read Message History` | **OFF (forever — explicit non-listener clause)** | No Discord-side reads for any purpose; idempotency uses orchestrator-side keys + Relay-private append-only publish logs |
| `Manage Channels` | OFF | No admin authority |
| `Manage Roles` | OFF | No admin authority |
| `Kick Members` | OFF | No admin authority |
| `Ban Members` | OFF | No admin authority |
| `Manage Webhooks` | OFF | No webhook authority |
| `Mention @everyone, @here, All Roles` | OFF | No mass-ping authority |
| `Use Application Commands` | OFF | No slash-command surface |
| `Create Invite` | OFF | No invite authority |
| `Send TTS Messages` | OFF | No voice surface |
| `Embed Links` | OFF | Verbatim text-only publish |
| `Attach Files` | OFF | Verbatim text-only publish |
| `Add Reactions` | OFF | One-way publish; no reaction surface |
| `Use External Emoji` / `Use External Stickers` | OFF | Verbatim text-only publish |
| `Manage Messages` | OFF | Append-only; no edit / delete authority |
| `Manage Permissions` | OFF | No admin authority |
| `Administrator` | OFF | No admin authority |
| Any other permission | OFF | Default-deny |

### Network / process boundaries

| Boundary | State at install |
|---|---|
| Egress | Discord API only (operator-enforced at firewall / hosting layer) |
| Kraken API access | NONE |
| Railway deploy hooks | NONE |
| Production DB access | NONE |
| GitHub API access | NONE |
| Non-Discord endpoints | NONE |
| Filesystem write to repo | NONE (no git checkout) |
| Env access | Discord bot token + logging endpoint only |
| `DATABASE_URL` access | NONE |
| `KRAKEN_API_KEY` / `KRAKEN_API_SECRET` access | NONE |
| `MANUAL_LIVE_ARMED` access | NONE |
| Railway tokens | NONE |
| GitHub tokens | NONE |
| CI/CD secrets | NONE |
| Append-only message store | READ-ONLY |
| Relay-private append-only publish log | APPEND-ONLY |

### Approval / phase / autopilot boundaries

| Boundary | State |
|---|---|
| Approval authority | NONE forever (Relay is governance-only) |
| Phase open / close authority | NONE |
| Autopilot input / output | NONE (Relay is not an autopilot input or output) |
| Self-modification | NONE (Relay cannot modify its own permissions, the spec, the channel layout, the install checklist, or any orchestrator doc) |
| Auto-resume after halt | NONE |
| CEILING-PAUSE break | NONE (Relay detects state and halts during it) |

---

## Channels Relay may eventually post to (3 of 7)

After full activation through Stage 10b, Relay write authority is restricted to these 3 channels:

| Channel | Relay write authority earliest stage | Per-message Victor approval | Class authorization eligible? |
|---|---|---|---|
| `#status` | Stage 9 (`COMM-HUB-HERMES-LIMITED-AUTO-PUBLISH-STATUS`) | YES (Stage 9 onward; per-message through Stage 9; class authorization possible later only if explicitly added in a future Stage) | NO (Stage 9 is per-message only) |
| `#summaries` | Stage 10a (`COMM-HUB-HERMES-AUTO-PUBLISH-SUMMARIES`) | YES (per-message OR bounded class with all 7 bounds) | YES (Stage 10a onward) |
| `#system-health` | Stage 10b (`COMM-HUB-HERMES-AUTO-PUBLISH-SYSTEM-HEALTH`) | YES (per-message OR bounded class with all 7 bounds) | YES (Stage 10b onward) |

**Relay write authority is NOT granted at Stage 5 install or Stage 6 closeout.** Stage 5 grants only the role + channel-level allow overrides for the 3 channels; Stage 7 dry-run produces no real Discord post; Stage 8 draft-only-mode produces drafts but no publish; Stage 9 is the FIRST stage that authorizes any real auto-post, and only to `#status`, and only with per-message Victor approval for every message.

## Channels Relay must NOT read (full enumeration)

Relay does NOT read any Discord channel for any purpose. The non-listener clause is explicit and mandatory.

| Channel | Relay read authority |
|---|---|
| `#approvals` | **NEVER** |
| `#status` | **NEVER** (Relay posts to `#status` write-only; never reads message history; idempotency uses orchestrator-side keys + Relay-private logs) |
| `#codex-warnings` | **NEVER** |
| `#summaries` | **NEVER** |
| `#system-health` | **NEVER** |
| `#trading-alerts` | **NEVER** |
| `#trading-summaries` | **NEVER** |

The bot's `View Channels` permission is a permission to address channels by id — not a permission to read message content. `Read Message History` is the permission that grants message-content reads, and it is **explicitly OFF at install and forever**, both at the role level and at every channel-level override per step 11 and step 12 of the install plan.

## Explicit "No Read Message History" rule

> **`Read Message History` is NEVER granted to Relay. It is OFF at the role level (step 11), and is **explicitly denied** via per-channel overrides on every channel (steps 12 and 13). Relay does not read Discord channels for idempotency, deduplication, monitoring, replies, reactions, audit, or any input interpretation. Idempotency MUST be enforced using orchestrator-side idempotency keys in the approved message metadata plus Relay-private append-only publish logs. If the idempotency key is missing, reused inconsistently, or unverifiable, Relay halts without posting.**

If a future operator-directed manual phase ever needs to grant `Read Message History` to Relay, it must be a separately-scoped Gate-10 phase with its own design, Codex review, and explicit Victor in-session approval naming the exact channel and exact use case. **No such phase is currently planned.** Until and unless that future phase opens, Relay remains a one-way write-only publisher with no Discord-side reads.

---

## No trading authority

Relay has zero trading authority forever. Specifically:

- No Kraken API access (no order placement, no balance read, no position read, no SL / TP / SELL_ALL action).
- No `MANUAL_LIVE_ARMED` access; no `MANUAL_LIVE_ARMED` change.
- No `position.json` read or write.
- No production DB access (no `INSERT`, `UPDATE`, `DELETE`, `TRUNCATE`, `DROP`, schema mutation, or any read of production DB content).
- No Railway deploy authority (no `railway up`, no `railway run` against production, no GitHub deploy hook).
- No env / secret access beyond the bot token + a logging endpoint env var.
- **Posting to Category C (`#trading-alerts`, `#trading-summaries`) is NEVER authorized for Relay.** Trading-Writer is a different role; multi-gated activation is required for that role; Relay never posts in Category C.

## No approval authority

Relay has zero approval authority forever. Specifically:

- Relay never grants, denies, or interprets approvals.
- Codex PASS, stored metadata alone, scheduled triggers, clean tree, green tests, and automation-internal state are NEVER approval.
- Discord replies, emojis, and reactions are NEVER approvals.
- Only Victor's explicit in-session chat instruction grants approval.
- Relay never opens or closes orchestrator phases.
- Relay never breaks CEILING-PAUSE (it detects state and halts during it).
- Relay is never an autopilot input or output.
- Relay never authorizes its own future activations or expansions.

## No automatic posting until future approved stages

Relay does NOT auto-post at install (Stage 5) or at closeout (Stage 6). The first authorized auto-post lands at Stage 9 only.

| Stage | Relay posting state |
|---|---|
| Stage 5 install | No publish (only smoke-test connection check; no message published) |
| Stage 6 closeout | No publish (docs-only commit recording install complete) |
| Stage 7 dry-run | No real Discord publish (pipeline verified end-to-end without publishing; no message lands in any channel) |
| Stage 8 draft-only-mode | No publish (Relay generates drafts; orchestrator + Codex + operator manual post still required) |
| Stage 9 first-auto-publish | FIRST authorized auto-post — `#status` only — **per-message Victor approval for every message**. Pre-authorized message classes prohibited at this stage. |
| Stage 10a | Expand to `#summaries`. Per-message OR bounded class with all 7 documented bounds. Class requires Codex review + explicit Victor in-session approval. |
| Stage 10b | Expand to `#system-health`. Same as 10a. |

**Pre-authorized message classes are prohibited before Stage 10a.** In Stage 10a and Stage 10b only, a message class may be pre-authorized only after Codex review and explicit Victor in-session approval naming all 7 bounds (channel, template, allowed event types, max count, expiration, revocation rule, forbidden-content constraints).

---

## Idempotency and logging install

Mirrors `orchestrator/COMM-HUB-HERMES-RULES.md` §"Idempotency mechanism".

1. **Each orchestrator-drafted message carries a globally unique idempotency key** in the source-of-truth message store.
2. **Relay-private append-only publish log records every publish attempt** (success or halt) with the idempotency key, channel id, timestamp, and outcome.
3. **Before publishing, Relay verifies** the idempotency key has no prior successful-publish entry in the Relay-private log.
4. **If the key has a prior successful-publish entry, Relay halts** (does not republish).
5. **If the key is missing, ambiguous, reused inconsistently, or unverifiable, Relay halts** (does not publish).
6. **Relay does NOT call Discord's `Get Channel Messages` API or any Discord-side read endpoint for deduplication.**

The Relay-private log location, append-only enforcement, and operator-readability are configured at install step 15. The log is **never** posted to Discord, **never** committed to the repo, **never** shared externally beyond operator review.

Audit logs (publish attempts, halts, verification failures) are append-only and retained per the operator's retention policy. Operator can audit duplicates by reading the log directly.

---

## Rollback / removal steps (DORMANT-revert, always available)

Relay can be reverted to DORMANT at any stage. The operator-directed manual `COMM-HUB-HERMES-DEACTIVATE` phase performs the rollback. The phase is operator-approved per-action and produces no automated cascade.

**Rollback steps:**

1. **Stop the Relay process.** On the host, terminate the Relay process (operator-chosen mechanism per host; does not require Discord-side action).
2. **Revoke the Discord bot token.** Discord developer portal → Application → Bot → Reset Token. The new token is discarded; the bot now has no valid token. **Do NOT save the new token.**
3. **Remove the bot from `Agent Avila Hub`.** Server Settings → Members → `Agent Avila Relay` bot → Kick. The bot is removed from the server immediately.
4. **Optionally delete the application.** Discord developer portal → Application → Delete App. This is irreversible; only do this if the operator wants to retire the application identity entirely.
5. **Revert the `System-Writer` role to DORMANT.** Server Settings → Roles → `System-Writer` → permissions: ALL OFF (zero permissions). Confirm zero members. Save. Confirm zero per-channel allow overrides remain on `#status`, `#summaries`, `#system-health` for `System-Writer` (or remove them all explicitly).
6. **Wipe the host-side secrets.** Remove the Discord bot token from the host's secret store. Remove any Relay-related env var.
7. **Archive the Relay-private publish log.** Copy the log to a local operator-only archive; **do NOT post or commit it.** Optionally delete the live log on the host once archived.
8. **Archive the source-of-truth message store.** Same archive treatment.
9. **Tear down the host process / container / image.** Per the operator's host environment.
10. **Remove the network allowlist.** Per the host's firewall / hosting layer.
11. **Document rollback completion** in a separate operator-approved phase (an explicit `COMM-HUB-HERMES-DEACTIVATE-CLOSEOUT` or equivalent) by updating STATUS / CHECKLIST / NEXT-ACTION docs. Relay returns to canonical DORMANT (zero members, zero permissions) state.

**Rollback explicitly does NOT:**

- Modify the Relay spec (`orchestrator/COMM-HUB-HERMES-RULES.md`).
- Modify this checklist.
- Modify any safety-policy doc.
- Affect Migration 008 / N-3 state.
- Affect CEILING-PAUSE state.
- Affect autopilot runtime DORMANT state.
- Touch Railway, the production DB, Kraken, env, `MANUAL_LIVE_ARMED`, `bot.js`, `dashboard.js`, `db.js`, `migrations/`, `scripts/`, `position.json`, deploy config, or any runtime file.

**Emergency immediate-revoke (any phase):** the operator may revoke the Discord bot token at any time via the developer portal (single click). Token revocation is the fastest single-step DORMANT-revert; the host process halts on next API call (verification failure → halt-on-anomaly) and stays halted until the operator resets state.

---

## Verification checklist (post-install, before COMM-HUB-HERMES-INSTALL-CLOSEOUT)

Operator confirms each item with a direct visual check in the Discord client / developer portal / host shell. Each item is explicitly visible to the operator without requiring `Read Message History` on Relay (since Relay never has that permission).

- [ ] Discord application named `Agent Avila Relay` (or operator-chosen) exists in Victor's developer portal.
- [ ] Application is NOT public (Public Bot OFF).
- [ ] Application does NOT require OAuth2 Code Grant.
- [ ] All 3 Privileged Gateway Intents are OFF (Presence, Server Members, Message Content).
- [ ] Bot user exists.
- [ ] Bot token has been minted and stored in the host's secret store; token is NOT in the repo, NOT in any committed `.env*` file, NOT in any Discord channel, NOT in any handoff packet.
- [ ] Bot was invited to `Agent Avila Hub` only; not to any other server.
- [ ] Bot member shows up in Server Settings → Members with the `System-Writer` role and no other role.
- [ ] `System-Writer` role has only `Send Messages` + `View Channels` ON; all other permissions OFF, including `Read Message History`, `Add Reactions`, `Embed Links`, `Attach Files`, `Manage Messages`, `Manage Channels`, `Manage Roles`, `Manage Webhooks`, `Mention @everyone`, `Use Application Commands`, `Create Invite`, `Administrator`.
- [ ] Per-channel allow overrides exist on `#status`, `#summaries`, `#system-health` for `System-Writer`: allow `View Channel` + `Send Messages`; deny `Read Message History`, `Add Reactions`, `Embed Links`, `Attach Files`, every other permission.
- [ ] Per-channel deny overrides exist on `#approvals`, `#codex-warnings`, `#trading-alerts`, `#trading-summaries` for `System-Writer`: deny `View Channel`, `Send Messages`, `Read Message History`, every other permission.
- [ ] Host process is provisioned with the Discord token and runs as a non-root, non-privileged user.
- [ ] Host has no git checkout.
- [ ] Host has no DB credentials, no Kraken credentials, no Railway credentials beyond what the host requires for self-management, no `MANUAL_LIVE_ARMED` env var, no GitHub tokens, no CI/CD secrets.
- [ ] Host egress is restricted to the Discord API only (operator-verified at firewall / hosting layer).
- [ ] Relay-private append-only publish log location is configured and operator-readable.
- [ ] Source-of-truth append-only message store location is configured; store is initially empty (no test message provisioned).
- [ ] Halt-on-anomaly defaults are configured (missing/stale Codex PASS, missing operator authorization, channel not in allow-list, character limit, rate limit, network anomaly, idempotency-key mismatch, CEILING-PAUSE state ACTIVE).
- [ ] Smoke-test connection check passed (Relay booted, authenticated, listed allowed channels by id without reading message content; the 4 forbidden channels are NOT in the bot's visible-channel list); **no message was published** during smoke-test.
- [ ] Relay process is in stopped state at the end of install (will be re-started only at Stage 7 dry-run / Stage 8 draft-only-mode / Stage 9 first-auto-publish under separate operator approval).
- [ ] `Agent Avila Hub` server still has zero webhooks, zero other bots, zero third-party integrations beyond Relay (Server Settings → Integrations confirms).
- [ ] No public Discord invite link was generated.
- [ ] No message was posted in any channel during install.
- [ ] CEILING-PAUSE state remains active and was not broken by the install (per `orchestrator/AUTOPILOT-RULES.md`).
- [ ] Migration 008 remains APPLIED at HEAD `189eb1be6ef6304d914671bdaedec44d389cf877`.
- [ ] N-3 remains closed.
- [ ] Autopilot runtime remains DORMANT.
- [ ] No Railway / production DB / Kraken / env / `MANUAL_LIVE_ARMED` action occurred during install.

If any item fails, the operator HALTs Stage 5 install, executes the rollback steps, and re-opens an earlier stage to remediate.

---

## Evidence checklist (post-install, operator stores locally; not committed)

Operator captures the following screenshots / logs as install evidence. All evidence is stored locally; **not committed to the repo**, **not posted to any Discord channel**, **not shared externally**.

- [ ] Discord developer portal Application General Information page (showing app name, description, no-public-bot, no-OAuth2-code-grant).
- [ ] Bot page (showing all 3 Privileged Gateway Intents OFF; Public Bot OFF).
- [ ] OAuth2 URL Generator page (showing `bot` scope only and `Send Messages` + `View Channels` permissions only; all other permissions unchecked).
- [ ] Server Settings → Members → bot member with `System-Writer` role.
- [ ] Server Settings → Roles → `System-Writer` permissions page showing only `Send Messages` + `View Channels` ON; everything else OFF.
- [ ] Per-channel permission override pages for `#status`, `#summaries`, `#system-health` showing the System-Writer allow + deny set.
- [ ] Per-channel permission override pages for `#approvals`, `#codex-warnings`, `#trading-alerts`, `#trading-summaries` showing the System-Writer deny set.
- [ ] Server Settings → Integrations (showing Relay is the only bot; zero webhooks; zero third-party integrations).
- [ ] Audit Log entries showing the install sequence (bot invite, role grant, permission overrides).
- [ ] Host shell capture showing process running as non-root, non-privileged user; egress allowlist verified.
- [ ] Host secret store capture showing token is stored (token value REDACTED in any screenshot or log).
- [ ] Relay-private publish log location capture (empty log at install).
- [ ] Smoke-test connection-check log (success; no message published).
- [ ] Operator's host hosting decision document (per precondition 12).
- [ ] Operator's network allowlist plan (per precondition 13).
- [ ] Operator's token-storage plan (per precondition 14).

Each screenshot is annotated locally with timestamp and step-reference. Screenshots are **never** uploaded to any Discord channel, gist, pastebin, or cloud storage that could index them. Tokens are **always** redacted in any screenshot, log, or annotation.

---

## Codex review gate before any future install

Stage 5 install is gated by a fresh Codex install-readiness review at the HEAD that will be referenced in the Stage 5 approval. The review verifies:

1. This checklist (`orchestrator/handoffs/COMM-HUB-INSTALL-HERMES-CHECKLIST.md`) is the canonical install plan and is unchanged from this commit's HEAD or has been re-reviewed if changed.
2. The Relay spec (`orchestrator/COMM-HUB-HERMES-RULES.md`) is unchanged from its canonical HEAD (`96f56a4767cc96ddd8b78bcc3b309e8fd455c8a5`) or has been re-reviewed if changed.
3. The Discord install checklist (`orchestrator/handoffs/COMM-HUB-INSTALL-DISCORD-CHECKLIST.md`) and channel layout (`orchestrator/handoffs/COMM-HUB-CHANNEL-LAYOUT.md`) are unchanged or have been re-reviewed.
4. All 15 preconditions are satisfied at the relevant HEAD.
5. The Stage 4 dry-run-design phase is closed with Codex PASS.
6. The Stage 5 install scope (Discord app/bot creation, host setup, token storage, network allowlist, channel permission grants, dry-run trigger plan) is exactly as documented in this checklist; no scope creep.
7. No forbidden content in the install scope (no secrets, no env values, no Kraken / Railway / production-DB / `MANUAL_LIVE_ARMED` references, no deploy triggers, no install instructions for other bots / webhooks / schedulers).
8. Three-way SHA consistency PASS (local HEAD = origin/main = live remote HEAD).
9. CEILING-PAUSE state ACTIVE-NOT-BROKEN (or explicit Victor direction-confirmation has reset the counter to 0 and authorized this Relay install track).
10. Approval-fatigue queue position ≤ 1 of 2.

**Codex install-readiness verdict is required for Stage 5 install approval to be granted.** A Codex PASS is necessary but not sufficient — Victor's explicit in-session Gate-10 approval naming the exact install scope is the only authority for Stage 5 install execution. Codex PASS by itself is NOT operator approval per `orchestrator/APPROVAL-GATES.md` "What is NOT operator approval".

Per-message Codex pre-publish sanity check is canonical at the Communication Hub level (`orchestrator/COMM-HUB-RULES.md`) and applies to every Relay auto-publish at Stage 9 / 10a / 10b.

---

## Install risks

**P1 (high impact, install-blocking if mishandled):**

- **R1** — Bot token leaked into the repo, a Discord channel, a handoff packet, an LLM context, or `position.json`. Mitigation: step 7 explicitly forbids token paste anywhere outside the host secret store; verification checklist confirms token is not in any committed file; rollback step 2 (token revocation) is a single-click recovery if leakage is suspected.
- **R2** — `Read Message History` accidentally enabled on `System-Writer` at role level or any channel-level override. Mitigation: explicit OFF state at step 11; explicit DENY at every channel-level override (steps 12 and 13); verification checklist confirms; rollback step 5 reverts.
- **R3** — Bot invited to a server other than `Agent Avila Hub`. Mitigation: step 9 explicitly restricts the install URL to `Agent Avila Hub`; step 9 explicitly forbids public install link generation; verification checklist confirms.
- **R4** — Bot granted `Administrator` or `Manage Roles` / `Manage Channels`. Mitigation: step 8 OAuth2 URL Generator allow-list is `Send Messages` + `View Channels` only; step 11 confirms zero admin permissions on the role.
- **R5** — Bot granted permission to post in `#approvals`, `#codex-warnings`, `#trading-alerts`, or `#trading-summaries`. Mitigation: step 13 explicit DENY overrides on all 4 forbidden channels; verification checklist confirms.
- **R6** — Public Discord invite link generated for bot installation. Mitigation: step 9 explicit "Do not generate a public install link"; rollback step 4 deletes the application if compromised.
- **R7** — Privileged Gateway Intent (Presence / Server Members / Message Content) accidentally enabled. Mitigation: step 6 explicit OFF for all 3; verification checklist confirms.
- **R8** — Bot token put in a `.env` file that is then committed. Mitigation: step 7 explicit forbidden-list; verification checklist confirms token is not in any committed file; `.gitignore` should already cover `.env*` (separate verification).
- **R9** — A real message published during smoke-test. Mitigation: step 18 explicit "no message is published in this smoke test"; only channel-listing read-only call.
- **R10** — Relay process granted access to Kraken / Railway / production DB / GitHub / `MANUAL_LIVE_ARMED` env. Mitigation: step 14 host-process boundaries explicitly forbid those env vars; verification checklist confirms.

**P2 (medium impact):**

- **R11** — Operator stores Relay-private publish log in a location that is also a git checkout, leading to accidental commit of Discord activity records. Mitigation: step 15 specifies the log is on the Relay host, not the operator's git working tree.
- **R12** — Operator captures install evidence screenshots that include the bot token in a popup. Mitigation: evidence checklist explicit "tokens are always redacted"; operator verifies before any local archival.
- **R13** — Relay process auto-restarts after halt due to host's default container restart policy. Mitigation: step 17 halt-on-anomaly is explicit; host configuration must disable container auto-restart on Relay process exit (operator records in install evidence).
- **R14** — `System-Writer` role hierarchy moved above `CEO` accidentally. Mitigation: Discord install checklist already establishes role hierarchy `CEO` → `Hub-Read` → `System-Writer` → `Codex-Writer` → `Trading-Writer`; verification confirms ordering preserved post-install.
- **R15** — Idempotency key collision between two orchestrator drafts with the same key. Mitigation: orchestrator-side key generation must be globally unique (e.g., timestamp + phase id + counter); duplicate detection in Relay triggers halt-on-anomaly.
- **R16** — Source-of-truth message store mutated outside append-only discipline (e.g., operator manually edits a message). Mitigation: store is configured append-only at step 16; corrections are new entries with new keys, not in-place edits.
- **R17** — Relay-private publish log truncated or lost. Mitigation: append-only file with operator-managed retention; backup discipline is operator-defined; lost-log halts new publishes (idempotency cannot be verified) until operator restores.
- **R18** — Operator unintentionally posts a draft message in `#status` while Relay is also configured to post the same message (race condition between operator manual post and Relay auto-publish). Mitigation: Stage 9 onward, manual-post-vs-auto-post boundary is documented per-stage; idempotency key + halt-on-anomaly catches duplicate publishes; pre-Stage-9 there is no Relay publish authority so no race exists.

**P3 (low impact, monitoring-only):**

- **R19** — Discord rate-limit on `Send Messages` for `Agent Avila Hub` channels causes burst halts. Mitigation: per-channel rate limits in `orchestrator/handoffs/COMM-HUB-CHANNEL-LAYOUT.md` are below Discord's published rate limits; halt-on-rate-limit is a planned halt class.
- **R20** — Discord developer portal UI changes between this checklist and install execution. Mitigation: this checklist uses setting-name terms, not click-position terms; operator adapts to UI evolution.
- **R21** — Application icon / description visible to other Discord users via the bot's profile. Mitigation: operator chooses non-sensitive description at step 3; the bot is non-public so visibility is limited to `Agent Avila Hub` members (CEO + Hub-Read only).
- **R22** — Future Relay spec change reveals new permission gap. Mitigation: this checklist has a "canonical files win" rule; spec change goes through a successor `COMM-HUB-DOCS-X-HERMES-SPEC` phase; install checklist re-runs against new spec before any change to live Relay.
- **R23** — Network allowlist drift over time (e.g., Discord adds a new API endpoint). Mitigation: operator periodically re-verifies the egress allowlist; broken egress halts publish via halt-on-anomaly until restored.
- **R24** — Token rotation cadence not followed. Mitigation: operator-defined rotation schedule documented at install; rotation does not require code change in Relay; only token change.

**Risks NOT in scope of this checklist (flagged for separate phases):**

- Codex-Writer authentication flow (separate Gate-10 phase).
- Trading-Writer authentication and per-message approval mechanism (multi-gated activation).
- Relay-to-`#approvals` posting (forever forbidden; not a future phase).
- Relay-to-`#codex-warnings` posting (forever forbidden; not a future phase).
- Relay-to-Category-C posting (forever forbidden for Relay; Trading-Writer is a different role).
- Cross-server Relay (Relay is restricted to `Agent Avila Hub` only).
- Anonymous / public install of Relay (forever forbidden).

---

## Hard limits

- No Relay runtime is installed by writing this checklist or by following it.
- No Discord application or bot is registered by writing this checklist.
- No Discord bot token is minted by writing this checklist.
- No webhook is created by writing this checklist or by following it.
- No third-party integration is installed.
- No scheduler / cron / MCP trigger / Ruflo / background automation is installed.
- No Discord post is made by writing this checklist (or by Stage 5 install execution; no test message during install).
- No public Discord invite link is generated.
- No Codex-Writer is activated.
- No Trading-Writer is activated.
- No Category C channel is activated.
- No autopilot runtime activation.
- No CEILING-PAUSE break.
- No production action.
- No deploy, no Railway command, no production DB command, no Kraken action, no env change, no `MANUAL_LIVE_ARMED` change, no live trading action.
- No modification to runtime code (`bot.js`, `dashboard.js`, `db.js`), `scripts/`, `migrations/`, `package.json`, lockfiles, `.nvmrc`, `.env*`, `position.json`, deploy config, autopilot templates, COMM-HUB safety-policy doc, or the closed Migration 008 runbook.
- No widening of Relay' capability matrix beyond `Send Messages` + `View Channels` for the 3 allowed channels.
- No grant of `Read Message History` to Relay.
- No grant of any approval authority to Relay.
- No grant of trading authority to Relay.
- Relay is not connected to Railway, the production DB, Kraken, GitHub, or any non-Discord endpoint.

---

## What this checklist is NOT

- **Not authorization to install Relay.** Relay install is Stage 5 (`COMM-HUB-HERMES-INSTALL`) — Gate 10 RED-tier per `orchestrator/APPROVAL-GATES.md` and requires explicit Victor in-session approval at that future time.
- **Not authorization to register a Discord application or bot.** Application / bot registration is part of the future Stage 5 install phase.
- **Not authorization to mint, store, rotate, or use a Discord bot token.** Token operations are part of Stage 5.
- **Not authorization to grant any Discord permission to any role.** Permission grants are part of Stage 5.
- **Not authorization to invite a bot to the server.** Bot invite is part of Stage 5.
- **Not authorization to install a webhook.** Webhook install is a separately-gated future phase (not currently planned for Relay).
- **Not authorization to install a scheduler / MCP trigger / cron job / Ruflo / background automation.** Each is its own Gate-10 phase.
- **Not authorization to grant Relay any approval authority.** Relay has zero approval authority forever.
- **Not authorization to grant Relay any trading authority.** Relay has zero trading authority forever.
- **Not authorization to post to Discord.** Posting is operator-only manual action until Stage 9 lands; Stage 9 itself is RED-tier per-message.
- **Not authorization to take any production action, trading action, deploy action, env change, or RED-tier action.**
- **Not authorization to break CEILING-PAUSE.** Only an explicit operator direction-confirmation instruction breaks the ceiling.
- **Not authorization to expand Relay beyond the canonical capability matrix.** Capability matrix is canonical in `orchestrator/COMM-HUB-HERMES-RULES.md`.
- **Not authorization to grant `Read Message History` to Relay.** Forever forbidden unless a separately-scoped Gate-10 phase opens with its own design + Codex review + Victor approval; no such phase is currently planned.
- **Not canonical over `orchestrator/COMM-HUB-HERMES-RULES.md`.** If this checklist diverges from the Relay spec, the spec wins.
- **Not canonical over `orchestrator/COMM-HUB-RULES.md`.** If this checklist diverges from the rulebook, the rulebook wins.
- **Not canonical over `orchestrator/handoffs/COMM-HUB-CHANNEL-LAYOUT.md`.** If this checklist diverges from the channel layout, the channel layout wins.
- **Not canonical over `orchestrator/AUTOMATION-PERMISSIONS.md`.** If this checklist diverges from the automation-permissions tiers, the tiers win.
- **Not canonical over `orchestrator/APPROVAL-GATES.md`.** If this checklist diverges from the gate matrix, the gate matrix wins.

**This phase (`COMM-HUB-DOCS-D-HERMES-INSTALL-CHECKLIST`) is DOCS-ONLY and does NOT activate Relay. Relay remains DORMANT (zero members, zero permissions) at the end of this phase. Stage 5 install requires its own separately-approved Gate-10 phase.**
