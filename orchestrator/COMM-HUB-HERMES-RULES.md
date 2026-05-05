# Communication Hub — Hermes Rules (canonical Hermes spec)

> **Author rule:** This file is the canonical Hermes specification for the Agent Avila Communication Hub. Hermes is the planned future auto-publisher for `#status`, `#summaries`, and `#system-health` — currently DORMANT. **This spec is NOT authorization to install Hermes, install a Discord bot, install a webhook, install a scheduler/MCP/cron/Ruflo/background automation, post to Discord, take a production action, take a trading action, or break CEILING-PAUSE.** Each future Hermes activation step requires its own scoped operator-approved phase.
>
> **No Hermes runtime, Discord bot, webhook, scheduler, MCP trigger, cron job, or background automation is installed by writing this file.**

Author: Operator-driven manual planning (Claude as orchestrator; future installs Victor-only)
Last updated: 2026-05-05 (COMM-HUB-DOCS-C-HERMES-SPEC — DOCS-ONLY)
Classification: SAFE-class safety-policy doc per `orchestrator/PROTECTED-FILES.md` (modifications require Codex docs-only review + Victor commit + Victor push)

Canonical references:
- `orchestrator/COMM-HUB-RULES.md` — Communication Hub rulebook (parent)
- `orchestrator/handoffs/COMM-HUB-CHANNEL-LAYOUT.md` — canonical channel/role/permission layout (line 41 carries the canonical approval-boundary rule; lines 136–145 carry the canonical per-role permission matrix that names `System-Writer (Hermes)` as DORMANT)
- `orchestrator/AUTOPILOT-RULES.md` — ARC-8 phase-loop ceiling rule
- `orchestrator/APPROVAL-GATES.md` — Gate 10 (automation install / upgrade)
- `orchestrator/AUTOMATION-PERMISSIONS.md` — GREEN / YELLOW / RED tiers; future-automation governance-only inheritance
- `orchestrator/PROTECTED-FILES.md` — SAFE / RESTRICTED / HARD BLOCK matrix
- `orchestrator/HANDOFF-RULES.md` — handoff conventions and forbidden-content list
- `orchestrator/ROLE-HIERARCHY.md` — role boundaries; future-automation governance-only inheritance

If this file diverges from `orchestrator/COMM-HUB-RULES.md` or `orchestrator/handoffs/COMM-HUB-CHANNEL-LAYOUT.md`, the canonical files win and this spec must be re-aligned in a follow-up DOCS-ONLY phase.

---

## Phase / role context

Hermes is the role currently named `System-Writer` in `orchestrator/handoffs/COMM-HUB-CHANNEL-LAYOUT.md` lines 136–145. Its permission posture at the canonical install state is:

- **Active at COMM-HUB-DOCS-A?** No — DORMANT.
- **Members at install:** zero.
- **Permissions at install:** zero.
- **Read access:** none (Discord-side reads are NEVER granted to Hermes for any purpose — see "Anti-execution boundaries" item 2 below).
- **Write access (after future Gate-10 install):** `#status`, `#summaries`, `#system-health` only — NEVER `#approvals`, NEVER `#codex-warnings`, NEVER Category C.

Activation is a multi-stage path; see "Staged activation path" below. The earliest stage that produces a Hermes runtime is Stage 5 (`COMM-HUB-HERMES-INSTALL`), which is a Gate-10 (automation install / upgrade) per `orchestrator/APPROVAL-GATES.md` and requires explicit Victor in-session approval at that future time.

The set of approvers is and remains exactly `{Victor}`. Hermes is governance-only and never an approver, never an autopilot, never a trader, and never a deployer.

---

## What Hermes is

Hermes is a **one-way Discord publisher**. When fully activated at a future stage, Hermes:

1. Reads orchestrator-drafted messages plus authorization metadata from a controlled source (repo-internal or a separately-approved Hermes-private store).
2. Verifies that the message has Codex pre-publish sanity-check PASS metadata (re-verifies at publish time; halts on missing or stale verdict).
3. Verifies that the message has explicit Victor in-session approval metadata (per-message OR, only at Stage 10a / 10b, a bounded class authorization with all 7 documented bounds — see "Approval discipline" below).
4. Verifies that the target channel is in the hard-coded allow-list (`#status`, `#summaries`, `#system-health`).
5. Posts the message verbatim (no editing of content; no template substitution beyond allow-listed placeholders such as timestamps).
6. Logs the post action to a Hermes-private append-only publish log (operator-readable).
7. Halts on any error or verification failure (no retry without operator action; no auto-resume).

## What Hermes is NOT

Hermes is NOT:
- A decision-maker. It does not choose what to post; it publishes pre-approved drafts.
- A listener. It does not read Discord channels for any purpose. See "Anti-execution boundaries" item 2.
- An approval source. It posts ABOUT approval requests; it never grants, denies, or interprets approvals.
- A trading interface. It has zero Kraken / production DB / Railway / runtime access.
- An autopilot. It does not propose new phases, draft its own messages, or interpret CEILING-PAUSE state changes; it detects CEILING-PAUSE state from a controlled signal and halts during it.
- Omnichannel. It is restricted to `#status`, `#summaries`, `#system-health` forever; never `#approvals` or `#codex-warnings`; never Category C until a separate multi-gated Trading-Writer activation (which is a different role).
- An autonomous agent. It never auto-progresses through stages.

---

## Allowed / forbidden capability matrix

### Allowed (only when fully installed and activated; not now)

| Capability | Constraint |
|---|---|
| Read orchestrator-drafted message + metadata from a controlled source | Source is repo-internal or a separately-approved Hermes-private store; **no Discord-side reading** |
| Verify Codex pre-publish PASS metadata at publish time | Halt on missing or stale verdict |
| Verify operator authorization metadata at publish time | Halt on missing |
| Verify channel allow-list before publish | Hard-coded: `#status`, `#summaries`, `#system-health` only |
| Post text-only message verbatim from approved draft | No editing; no template substitution beyond allow-listed placeholders |
| Append-only posting | No edits to prior messages; corrections via new message |
| Rate-limit per channel per canonical caps | Per `orchestrator/handoffs/COMM-HUB-CHANNEL-LAYOUT.md` rate limits |
| Log every post action to Hermes-private append-only publish log | Operator-readable audit trail |
| Halt on any error or verification failure | No retry without operator action |
| Detect CEILING-PAUSE state and halt during it | No auto-resume |

**Discord token scope (allow-list, full enumeration):**
- `Send Messages` (for the 3 allowed channels)
- `View Channels` (for the 3 allowed channels)

**Discord token scope must NOT include:**
- `Read Message History` — explicit and mandatory exclusion (see Anti-execution boundary 2).
- `Manage Channels`
- `Manage Roles`
- `Kick Members`
- `Ban Members`
- `Manage Webhooks`
- `Mention Everyone`
- `Use Application Commands`
- `Create Invite`
- `Send TTS Messages`
- `Embed Links`
- `Attach Files`
- `Add Reactions`
- `Use External Emoji` / `Use External Stickers`
- Any other permission not in the explicit allow-list above

### Forbidden — explicit non-listener clause

> Read Message History is NOT granted to Hermes. Hermes does not read Discord channels for idempotency, deduplication, monitoring, replies, reactions, audit, or any input interpretation. Idempotency MUST be enforced using orchestrator-side idempotency keys in the approved message metadata plus Hermes-private append-only publish logs. If the idempotency key is missing, reused inconsistently, or unverifiable, Hermes halts without posting.

### Forbidden — full list (always; including after install; including after expansion)

- Posting to `#approvals` (operator-only forever per `orchestrator/handoffs/COMM-HUB-CHANNEL-LAYOUT.md` line 34 — "Future Hermes auto-publish for `#approvals` is NOT authorized — approval requests stay operator-published forever")
- Posting to `#codex-warnings` (operator-only forever per `orchestrator/handoffs/COMM-HUB-CHANNEL-LAYOUT.md` line 65)
- Posting to Category C (`#trading-alerts`, `#trading-summaries` — DORMANT; Trading-Writer role only after a separate multi-gated trading-track activation; never Hermes)
- Reading Discord channels (one-way publisher; Discord is output-only for Hermes)
- Reacting to Discord (replies, emojis, reactions)
- Interpreting Discord activity as input
- Drafting its own messages (Hermes publishes pre-approved drafts only)
- Modifying draft content (verbatim publication)
- Generating or posting a Discord invite link
- Adding members to the server
- Creating, modifying, or deleting channels, roles, or permissions
- Posting `@everyone` or `@here` mentions
- Running any deploy command (no Railway, no CI/CD, no `railway up`, no `railway run` against production, no GitHub deploy hook)
- Running any production DB command (no `INSERT`, `UPDATE`, `DELETE`, `TRUNCATE`, `DROP`, schema mutation, or any read of production DB content)
- Touching Kraken (no trading API access; no order placement; no balance read; no position read; no SL / TP / SELL_ALL action)
- Reading or writing env / secrets beyond its own scoped Discord token (no `DATABASE_URL`, no `KRAKEN_API_KEY`, no `KRAKEN_API_SECRET`, no `MANUAL_LIVE_ARMED`)
- Modifying `MANUAL_LIVE_ARMED`
- Modifying `bot.js`, `dashboard.js`, `db.js`, `migrations/`, `scripts/`, `package.json`, lockfiles, `.nvmrc`, `.env*`, `position.json`, deploy config, autopilot templates, any safety-policy doc, any COMM-HUB template, this Hermes spec, the Discord install checklist, the closed Migration 008 runbook, or any other repo file
- Auto-resume after halt (halt is permanent until operator intervention)
- Operating during CEILING-PAUSE
- Granting any approval (Hermes has zero approval authority)
- Opening or closing any orchestrator phase
- Self-modifying or changing its own permissions
- Posting any content not in the pre-approved draft
- Inferring intent or requirements from Discord, Slack, GitHub, or any other channel

---

## Anti-execution boundaries

These are HARD CONSTRAINTS encoded both in design and in the future install:

1. **Network allowlist.** Hermes process can reach the Discord API only. No Kraken API endpoints, no Railway deploy hooks, no production DB host, no GitHub API, no other endpoint. Enforced at firewall / hosting layer if available.
2. **Token scope.** Discord bot token has only `Send Messages` + `View Channels` (for the 3 allowed channels). NO `Read Message History`. NO `Manage Channels`, `Manage Roles`, `Kick Members`, `Ban Members`, `Manage Webhooks`, `Mention Everyone`, `Use Application Commands`. Per-channel permission overrides via the Hermes role enforce the allow-list.
3. **No env / secret access beyond own token.** Hermes process has env access only to its own Discord bot token + a logging endpoint. NO `DATABASE_URL`, NO `KRAKEN_API_KEY`, NO `KRAKEN_API_SECRET`, NO `MANUAL_LIVE_ARMED`, NO Railway tokens, NO GitHub tokens, NO CI/CD secrets.
4. **No filesystem write to repo.** Hermes does not have a git checkout. It cannot modify `bot.js`, `dashboard.js`, `db.js`, `migrations/`, `scripts/`, `package.json`, lockfiles, `.env*`, deploy config, `position.json`, or any orchestrator doc. Hermes runs from a containerized image with read-only access to its source-of-truth message store.
5. **Append-only message store read + Hermes-private append-only publish log.** Hermes reads its source-of-truth (orchestrator-drafted messages + idempotency keys + authorization metadata) from an append-only data store. Hermes-private append-only publish log records every publish attempt. Hermes cannot modify drafts, mark them as approved, invent new ones, or read Discord-side history.
6. **Verbatim publication.** Hermes publishes the draft text byte-for-byte. No template injection, no variable substitution beyond allow-listed placeholders (e.g., timestamps). The set of allow-listed placeholders is documented in the source-of-truth schema and verified at publish time.
7. **Halt-on-anomaly.** Any verification mismatch (Codex PASS missing or stale, operator authorization missing or expired or exhausted or out-of-scope, channel not in allowlist, character limit exceeded, rate limit hit, network anomaly, idempotency-key mismatch) triggers an immediate permanent halt. Restart requires operator action.
8. **CEILING-PAUSE awareness.** Hermes detects CEILING-PAUSE state from a controlled signal and halts during it. Hermes does not auto-resume when CEILING-PAUSE clears; resumption requires operator action.
9. **No direct API to autopilot.** Hermes cannot read or modify `orchestrator/AUTOPILOT-RULES.md` state, the phase-loop counter, ARC-8 stop-condition state, or any autopilot trigger. Hermes is not an autopilot input or output channel.
10. **No admin / privileged actions.** Hermes has zero permissions for server-admin actions, role changes, channel changes, member changes, invite generation, webhook creation, or Discord configuration changes.
11. **Audit logging.** Every Hermes action (publish attempt, halt, verification failure) is logged to an operator-readable log. Logs are retained for review per the operator's retention policy. Audit logs are append-only.
12. **Rotation discipline.** Hermes Discord bot token rotation cadence is documented at install time. Operator can revoke the token at any time via Discord's developer portal. Rotation does not require code change in Hermes; only token change.
13. **Single-instance discipline.** Only one Hermes instance runs at a time. Concurrent instances are a halt condition.

---

## Approval discipline

> Approval discipline: Hermes has zero approval authority. Only Victor's explicit in-session chat instruction grants approval. Hermes never treats Discord activity, Codex PASS, stored metadata alone, scheduled triggers, clean tree, green tests, or automation-internal state as approval.

> Per-message Victor approval is required for every Hermes auto-publish through Stage 9, including all `#status` messages.

> Pre-authorized message classes are prohibited before Stage 10a. In Stage 10a and Stage 10b only, a message class may be pre-authorized only after Codex review and explicit Victor in-session approval naming: channel, template, allowed event types, maximum message count, expiration date, revocation rule, and forbidden-content constraints.

> Hermes halts on missing, expired, exhausted, stale, ambiguous, or out-of-scope class authorization.

The 7 required bounds for any Stage 10a / 10b pre-authorized message class are:

1. **Channel** — exactly one of `#status`, `#summaries`, `#system-health`. Multi-channel classes are not allowed.
2. **Template** — the message-template-id (a reference to a documented orchestrator-drafted template); Hermes only publishes messages that match the template byte-for-byte after allow-listed placeholder substitution.
3. **Allowed event types** — the documented event types that may trigger a publish under this class (e.g., `PHASE_OPENED`, `PHASE_CLOSED`, `COMMIT_LANDED`, `PUSH_COMPLETED`, `HALTED`).
4. **Maximum message count** — a hard cap on the number of publishes under this class. Reached count halts the class.
5. **Expiration date** — an explicit calendar date after which the class authorization is invalid. Past expiration halts the class.
6. **Revocation rule** — the operator action that immediately revokes the class authorization (typically a sentinel file, sentinel field in the source-of-truth, or operator chat instruction with documented effect).
7. **Forbidden-content constraints** — the explicit forbidden-content list per `orchestrator/HANDOFF-RULES.md` and `orchestrator/COMM-HUB-RULES.md` that the message under this class must not contain. Verified at publish time against the message body.

Class authorization is documented in the source-of-truth message store and verified at publish time. Missing or violating any of the 7 bounds is a hard halt.

---

## Message contract / metadata schema

Each orchestrator-drafted message Hermes consumes carries the following metadata (canonical at install time; finalized in a future Stage 3 install-checklist phase):

- **Message id** — globally unique idempotency key.
- **Channel id** — must be in the Hermes channel allow-list.
- **Message body** — verbatim Discord message text; subject to allow-listed placeholder substitution only.
- **Codex pre-publish PASS verdict reference** — pointer to the Codex review verdict; verified at publish time.
- **Operator authorization metadata** — either:
  - Per-message Victor authorization (Stage 9 and earlier; required through Stage 9), OR
  - Class authorization reference (Stage 10a / 10b only; references a documented bounded class with all 7 bounds).
- **Idempotency key** — orchestrator-side; verified against Hermes-private append-only publish log before any publish attempt.
- **Allowed-placeholder map** — explicit list of placeholders Hermes may substitute (e.g., `<UTC date>` → current UTC date at publish time).
- **Halt-on-condition flags** — explicit flags Hermes verifies (e.g., CEILING-PAUSE state must be ACTIVE-NOT-BROKEN; if state is unclear, halt).

The schema is canonical; deviations halt the publish attempt.

---

## Idempotency mechanism

Hermes idempotency uses orchestrator-side keys plus Hermes-private append-only publish logs. **No Discord-side reads for deduplication.**

Mechanism:

1. Each orchestrator-drafted message carries a globally unique idempotency key in the source-of-truth message store.
2. Hermes-private append-only publish log records every publish attempt (success or halt) with the idempotency key, channel id, timestamp, and outcome.
3. Before publishing, Hermes verifies the idempotency key has no prior successful-publish entry in the Hermes-private log.
4. If the key has a prior successful-publish entry, Hermes halts (does not republish).
5. If the key is missing, ambiguous, reused inconsistently, or unverifiable, Hermes halts (does not publish).
6. Hermes does NOT call Discord's `Get Channel Messages` API or any Discord-side read endpoint for deduplication.

The Hermes-private log is operator-readable and append-only. Operator can audit duplicates by reading the log directly.

---

## Channel allow-list (full enumeration)

| Channel | Hermes write at full activation? | Codex pre-publish required? | Per-message Victor approval? | Class authorization eligible? |
|---|---|---|---|---|
| `#approvals` | **NEVER** | n/a | n/a | n/a |
| `#status` | YES (after Stage 9) | YES (every message) | YES (Stage 9 onward; per-message through Stage 9) | NO (Stage 9 is per-message only); class authorization possible later only if explicitly added in a future Stage |
| `#codex-warnings` | **NEVER** | n/a | n/a | n/a |
| `#summaries` | YES (after Stage 10a) | YES (every message) | YES (per-message OR bounded class with all 7 bounds) | YES (Stage 10a onward) |
| `#system-health` | YES (after Stage 10b) | YES (every message) | YES (per-message OR bounded class with all 7 bounds) | YES (Stage 10b onward) |
| `#trading-alerts` | **NEVER** | n/a | n/a | n/a |
| `#trading-summaries` | **NEVER** | n/a | n/a | n/a |

**3 of 7 channels eligible for Hermes auto-post; 4 of 7 forever-blocked from Hermes.**

---

## Required Codex review gates

Every Hermes phase requires its own Codex docs-only review with sanitized prompt protocol.

| Gate | When | Scope |
|---|---|---|
| Codex design review | End of Stage 1 (`COMM-HUB-DESIGN-HERMES`) | Conversation-only design verification |
| Codex SAFE-class spec review | End of Stage 2 (this phase — write `COMM-HUB-HERMES-RULES.md`) | New SAFE-class doc + cross-references |
| Codex install-checklist review | End of Stage 3 (`COMM-HUB-DOCS-D-HERMES-INSTALL-CHECKLIST`) | New install checklist template |
| Codex dry-run design review | End of Stage 4 (`COMM-HUB-HERMES-DRY-RUN-DESIGN`) | Conversation-only dry-run plan |
| Codex install-readiness review | End of Stage 5 (pre-install Gate-10 audit; before bot creation) | Final go/no-go for live install |
| Codex install-closeout review | End of Stage 6 (`COMM-HUB-HERMES-INSTALL-CLOSEOUT`) | Status-doc closeout |
| Codex dry-run review | End of Stage 7 (`COMM-HUB-HERMES-DRY-RUN`) | Dry-run results |
| Codex per-message pre-publish review | EVERY message Hermes auto-publishes | Per-message sanity check; same canonical rule as `orchestrator/COMM-HUB-RULES.md` |
| Codex stage-promotion review | Each promotion (Stage 9 → 10a → 10b) | Verify previous stage clean |

Pre-publish Codex sanity check is the per-message gate that exists at the canonical Communication Hub level. Hermes does not bypass it; Hermes verifies it as metadata at publish time.

---

## Required Victor approval gates

| Gate | When | Authority class |
|---|---|---|
| Operator commit-only approval | Every doc-write phase (Stages 2, 3, 6, etc.) | Per existing workflow |
| Operator push approval | Every doc-write phase | Per existing workflow |
| Gate-10 install approval | Stage 5 (`COMM-HUB-HERMES-INSTALL`) | RED-tier per `orchestrator/APPROVAL-GATES.md` Gate 10 (automation install / upgrade) |
| Operator dry-run approval | Stage 7 | Per-action |
| Operator stage-promotion approval | Each promotion (Stage 9 → 10a → 10b) | Each promotion is its own RED-tier action |
| Operator per-message approval | Every Hermes auto-publish through Stage 9 | Per-message |
| Operator class-authorization approval (Stage 10a / 10b only) | Each pre-authorized message class | Explicit Victor in-session approval naming all 7 bounds |
| Operator halt-resume approval | Any time Hermes halts | No auto-resume |
| Operator deactivation approval | Any time | Operator can DORMANT-revert at any point |

The set of approvers remains exactly `{Victor}` throughout. Hermes never has approval authority; Hermes has narrow publish authority delegated by Victor for narrow message classes only at Stage 10a / 10b, after Stage 9 per-message approval has run cleanly.

---

## Staged activation path

| Stage | Phase identifier | Mode | Output | Approval class |
|---|---|---|---|---|
| 1 | `COMM-HUB-DESIGN-HERMES` | DESIGN-ONLY conversation | Design report (closed; Codex 8/8 PASS after one revision round) | Operator-directed manual; no commit |
| 2 | `COMM-HUB-DOCS-C-HERMES-SPEC` (this phase) | DOCS-ONLY | This file (`orchestrator/COMM-HUB-HERMES-RULES.md`) + cross-reference updates + 3 status docs | Commit-only + push |
| 3 | `COMM-HUB-DOCS-D-HERMES-INSTALL-CHECKLIST` | DOCS-ONLY | New `orchestrator/handoffs/COMM-HUB-INSTALL-HERMES-CHECKLIST.md` + 3 status docs | Commit-only + push |
| 4 | `COMM-HUB-HERMES-DRY-RUN-DESIGN` | DESIGN-ONLY conversation | Dry-run plan (no install) | Operator-directed manual; no commit |
| 5 | `COMM-HUB-HERMES-INSTALL` | OPERATOR-DIRECTED MANUAL INSTALL | Live install — Discord bot creation, hosting setup, network allowlist, token rotation | **Gate 10 (automation install / upgrade)** per `orchestrator/APPROVAL-GATES.md` |
| 6 | `COMM-HUB-HERMES-INSTALL-CLOSEOUT` | DOCS-ONLY closeout | 3 status docs | Commit-only + push |
| 7 | `COMM-HUB-HERMES-DRY-RUN` | OPERATOR-DIRECTED MANUAL | Dry-run with no real Discord posts (verifies pipeline end-to-end without publishing) | Per-action |
| 8 | `COMM-HUB-HERMES-DRAFT-ONLY-MODE` | OPERATOR-DIRECTED MANUAL | Hermes runs but only generates drafts; orchestrator + Codex + operator manual post still required | Per-action |
| 9 | `COMM-HUB-HERMES-LIMITED-AUTO-PUBLISH-STATUS` | OPERATOR-DIRECTED MANUAL | First authorized auto-post — `#status` only — **per-message Victor approval only**. Pre-authorized message classes prohibited at this stage. | RED-tier per-message |
| 10a | `COMM-HUB-HERMES-AUTO-PUBLISH-SUMMARIES` | OPERATOR-DIRECTED MANUAL | Expand to `#summaries`. Per-message OR bounded class with all 7 documented bounds. Class requires Codex review + explicit Victor in-session approval. | Stage-promotion approval + per-message or class-authorization |
| 10b | `COMM-HUB-HERMES-AUTO-PUBLISH-SYSTEM-HEALTH` | OPERATOR-DIRECTED MANUAL | Expand to `#system-health`. Same as 10a. | Stage-promotion approval + per-message or class-authorization |
| EOL | `COMM-HUB-HERMES-DEACTIVATE` (always available) | OPERATOR-DIRECTED MANUAL | Revert to DORMANT at any time | Per-action |

**Stop criteria at any stage:** if any stage's Codex review FAILs, the operator's preflight check fails, the dry-run reveals an unexpected behavior, or the operator simply wants to pause — the chain halts indefinitely. Hermes never auto-progresses through stages.

---

## Hard limits

- **No Hermes runtime is installed by writing this file.** This file is a docs-only specification.
- **No Discord bot is installed by writing this file.**
- **No webhook, scheduler, MCP trigger, cron job, Ruflo, or background automation is installed by writing this file.**
- **Hermes remains DORMANT.** Activation requires the staged path above with explicit Victor approval at each gate.
- **Hermes has zero approval authority.** Codex PASS, stored metadata alone, scheduled triggers, clean tree, green tests, and automation-internal state are NEVER approval.
- **Discord replies, emojis, and reactions are NEVER approvals.** Only Victor's explicit in-session chat instruction grants approval.
- **Discord is output-only for Hermes.** No Discord-side reads for any purpose.
- **CEILING-PAUSE is never broken by Hermes.** Hermes detects CEILING-PAUSE state and halts during it.
- **Autopilot is never activated by Hermes.** Hermes is not an autopilot.
- **No production action.** No deploy, no Railway, no production DB, no Kraken, no env, no `MANUAL_LIVE_ARMED`, no live trading.
- **No runtime-file modification.** No `bot.js`, `dashboard.js`, `db.js`, `migrations/`, `scripts/`, `package.json`, lockfiles, `.nvmrc`, `.env*`, `position.json`, deploy config.
- **No safety-policy doc modification by Hermes.** Hermes does not have a git checkout.
- **No public Discord invite link generated by Hermes.**
- **No Discord webhook created by Hermes.**
- **No Discord-to-Railway / Discord-to-GitHub / Discord-to-Kraken / Discord-to-production-DB connection.**
- **No trading-alert connection from Hermes.**
- **No Category C posting from Hermes** (Trading-Writer is a different role; multi-gated activation required for that role; Hermes never).
- **No `#approvals` posting from Hermes** (forever — operator-only per `orchestrator/handoffs/COMM-HUB-CHANNEL-LAYOUT.md` line 34).
- **No `#codex-warnings` posting from Hermes** (forever — operator-only per `orchestrator/handoffs/COMM-HUB-CHANNEL-LAYOUT.md` line 65).

---

## What this spec is NOT

- **Not authorization to install Hermes.** Hermes install is Stage 5 — Gate-10 RED-tier per `orchestrator/APPROVAL-GATES.md` and requires explicit Victor in-session approval at that future time.
- **Not authorization to install a Discord bot.** Discord bot install is part of the future Stage 5 install phase.
- **Not authorization to install a webhook.** Webhook install is a separately-gated future phase.
- **Not authorization to install a scheduler / MCP trigger / cron job / Ruflo / background automation.** Each is its own Gate-10 phase.
- **Not authorization to grant Hermes any approval authority.** Hermes has zero approval authority forever.
- **Not authorization to post to Discord.** Posting is operator-only manual action until Stage 9 lands.
- **Not authorization to take any production action, trading action, deploy action, env change, or RED-tier action.**
- **Not authorization to break CEILING-PAUSE.** Only an explicit operator direction-confirmation instruction breaks the ceiling.
- **Not canonical over `orchestrator/COMM-HUB-RULES.md`.** If this file diverges from the rulebook, the rulebook wins.
- **Not canonical over `orchestrator/handoffs/COMM-HUB-CHANNEL-LAYOUT.md`.** If this file diverges from the channel layout, the channel layout wins.
- **Not canonical over `orchestrator/AUTOMATION-PERMISSIONS.md`.** If this file diverges from the automation-permissions tiers, the tiers win.
- **Not canonical over `orchestrator/APPROVAL-GATES.md`.** If this file diverges from the gate matrix, the gate matrix wins.
