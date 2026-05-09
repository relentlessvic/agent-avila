# Communication Hub — Relay Rules (canonical Relay spec)

> **Author rule:** This file is the canonical Relay specification for the Agent Avila Communication Hub. Relay is the planned future auto-publisher for `#status`, `#summaries`, and `#system-health` — currently DORMANT. **This spec is NOT authorization to install Relay, install a Discord bot, install a webhook, install a scheduler/MCP/cron/Ruflo/background automation, post to Discord, take a production action, take a trading action, or break CEILING-PAUSE.** Each future Relay activation step requires its own scoped operator-approved phase.
>
> **No Relay runtime, Discord bot, webhook, scheduler, MCP trigger, cron job, or background automation is installed by writing this file.**
>
> **Filename note:** This file's filename retains the historical `COMM-HUB-HERMES-RULES.md` literal pending the `COMM-HUB-RENAME-RELAY-FILES` Phase B. Cross-references throughout the repo continue to cite this filename verbatim during Phase A. After Phase B lands, filepaths will be updated atomically in a separate operator-authorized commit.

Author: Operator-driven manual planning (Claude as orchestrator; future installs Victor-only)
Last updated: 2026-05-08 (COMM-HUB-RENAME-RELAY-CONTENT — Mode 3 DOCS-ONLY; Batch 2 rename internal messenger Hermes → Relay; filename retained for COMM-HUB-RENAME-RELAY-FILES Phase B). Original spec authored 2026-05-05 by COMM-HUB-DOCS-C-HERMES-SPEC.
Classification: SAFE-class safety-policy doc per `orchestrator/PROTECTED-FILES.md` (modifications require Codex docs-only review + Victor commit + Victor push)

Canonical references:
- `orchestrator/COMM-HUB-RULES.md` — Communication Hub rulebook (parent)
- `orchestrator/handoffs/COMM-HUB-CHANNEL-LAYOUT.md` — canonical channel/role/permission layout (line 41 carries the canonical approval-boundary rule; lines 136–145 carry the canonical per-role permission matrix that names `System-Writer (Relay)` as DORMANT)
- `orchestrator/AUTOPILOT-RULES.md` — ARC-8 phase-loop ceiling rule
- `orchestrator/APPROVAL-GATES.md` — Gate 10 (automation install / upgrade)
- `orchestrator/AUTOMATION-PERMISSIONS.md` — GREEN / YELLOW / RED tiers; future-automation governance-only inheritance
- `orchestrator/PROTECTED-FILES.md` — SAFE / RESTRICTED / HARD BLOCK matrix
- `orchestrator/HANDOFF-RULES.md` — handoff conventions and forbidden-content list
- `orchestrator/ROLE-HIERARCHY.md` — role boundaries; future-automation governance-only inheritance

If this file diverges from `orchestrator/COMM-HUB-RULES.md` or `orchestrator/handoffs/COMM-HUB-CHANNEL-LAYOUT.md`, the canonical files win and this spec must be re-aligned in a follow-up DOCS-ONLY phase.

---

## Phase / role context

Relay is the role currently named `System-Writer` in `orchestrator/handoffs/COMM-HUB-CHANNEL-LAYOUT.md` lines 136–145. Its permission posture at the canonical install state is:

- **Active at COMM-HUB-DOCS-A?** No — DORMANT.
- **Members at install:** zero.
- **Permissions at install:** zero.
- **Read access:** none (Discord-side reads are NEVER granted to Relay for any purpose — see "Anti-execution boundaries" item 2 below).
- **Write access (after future Gate-10 install):** `#status`, `#summaries`, `#system-health` only — NEVER `#approvals`, NEVER `#codex-warnings`, NEVER Category C.

Activation is a multi-stage path; see "Staged activation path" below. The earliest stage that produces a Relay runtime is Stage 5 (`COMM-HUB-HERMES-INSTALL`), which is a Gate-10 (automation install / upgrade) per `orchestrator/APPROVAL-GATES.md` and requires explicit Victor in-session approval at that future time.

The set of approvers is and remains exactly `{Victor}`. Relay is governance-only and never an approver, never an autopilot, never a trader, and never a deployer.

---

## Naming convention — Relay vs. external Hermes Agent

To avoid confusion with the external Nous Hermes Agent (an unrelated Nous/OpenRouter-hosted model/tool), Agent Avila uses these names from this phase forward:

- **Relay** — internal Agent Avila Discord/project-update messenger described by this spec. Currently DORMANT. All active forward-looking wording in this repo uses "Relay".
- **external Hermes Agent (Nous/OpenRouter)** — the external Nous-hosted agent/tool. Reserved term; not currently referenced anywhere in this repo. Future references must qualify it as "(Nous/OpenRouter)" to disambiguate.

### What is preserved as "Hermes" (historical / factual)

- **Phase names committed to git history.** `COMM-HUB-DOCS-G-HERMES-RUNTIME-DESIGN-SPEC` and its CLOSEOUT-SYNC variants; `COMM-HUB-HERMES-DRY-RUN-DESIGN-SPEC`; `COMM-HUB-INSTALL-HERMES-CHECKLIST-SPEC`; `COMM-HUB-HERMES-STAGE5-PARTIAL-INSTALL`; the original `COMM-HUB-DOCS-C-HERMES-SPEC` (this file's spec-creation phase); and the staged-activation phase identifiers below in the "Staged activation path" table (Stages 1 through EOL) are preserved verbatim. They are immutable once-or-historically used phase identifiers.
- **Filenames retained pending Phase B.** This file (`orchestrator/COMM-HUB-HERMES-RULES.md`); `orchestrator/handoffs/COMM-HUB-HERMES-RUNTIME-DESIGN.md`; `orchestrator/handoffs/COMM-HUB-HERMES-STAGE5-PRECONDITIONS.md`; `orchestrator/handoffs/COMM-HUB-INSTALL-HERMES-CHECKLIST.md`.
- **Filenames preserved permanently as historical artifacts.** `orchestrator/handoffs/COMM-HUB-HERMES-DRY-RUN-DESIGN.md` (records past dry-run); `orchestrator/handoffs/COMM-HUB-HERMES-STAGE5-PARTIAL-INSTALL-RECORD.md` (records Steps 1-13 install).
- **Railway service name `agent-avila-hermes`** — preserved as factual current state. Renaming the Railway service is an operator-led infrastructure phase outside the docs-only scope.
- **SHA-anchored historical statements** — preserved verbatim because they record past state at named commits (e.g., "Hermes shelved at `17103c27…`"; "Hermes Stage 5 Gate-10 install approval at `40f3137e842cd60acf1adf17ecc7fe2f0b1b8935` CONSUMED"; "Hermes Stage 5 Steps 1-13 completed at `40f3137e…`").
- **Verbatim quotes from prior commit messages** — preserved exactly.

### Phase B handoff (file renames, pending separate authorization)

The `COMM-HUB-RENAME-RELAY-FILES` Phase B will atomically rename the four forward-looking filenames listed above and update all cross-references in a single commit. `orchestrator/PROTECTED-FILES.md` will require updating in the same commit to reflect the new spec path. Until then, no filename changes occur.

---

## What Relay is

Relay is a **one-way Discord publisher**. When fully activated at a future stage, Relay:

1. Reads orchestrator-drafted messages plus authorization metadata from a controlled source (repo-internal or a separately-approved Relay-private store).
2. Verifies that the message has Codex pre-publish sanity-check PASS metadata (re-verifies at publish time; halts on missing or stale verdict).
3. Verifies that the message has explicit Victor in-session approval metadata (per-message OR, only at Stage 10a / 10b, a bounded class authorization with all 7 documented bounds — see "Approval discipline" below).
4. Verifies that the target channel is in the hard-coded allow-list (`#status`, `#summaries`, `#system-health`).
5. Posts the message verbatim (no editing of content; no template substitution beyond allow-listed placeholders such as timestamps).
6. Logs the post action to a Relay-private append-only publish log (operator-readable).
7. Halts on any error or verification failure (no retry without operator action; no auto-resume).

## What Relay is NOT

Relay is NOT:
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
| Read orchestrator-drafted message + metadata from a controlled source | Source is repo-internal or a separately-approved Relay-private store; **no Discord-side reading** |
| Verify Codex pre-publish PASS metadata at publish time | Halt on missing or stale verdict |
| Verify operator authorization metadata at publish time | Halt on missing |
| Verify channel allow-list before publish | Hard-coded: `#status`, `#summaries`, `#system-health` only |
| Post text-only message verbatim from approved draft | No editing; no template substitution beyond allow-listed placeholders |
| Append-only posting | No edits to prior messages; corrections via new message |
| Rate-limit per channel per canonical caps | Per `orchestrator/handoffs/COMM-HUB-CHANNEL-LAYOUT.md` rate limits |
| Log every post action to Relay-private append-only publish log | Operator-readable audit trail |
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

> Read Message History is NOT granted to Relay. Relay does not read Discord channels for idempotency, deduplication, monitoring, replies, reactions, audit, or any input interpretation. Idempotency MUST be enforced using orchestrator-side idempotency keys in the approved message metadata plus Relay-private append-only publish logs. If the idempotency key is missing, reused inconsistently, or unverifiable, Relay halts without posting.

### Forbidden — full list (always; including after install; including after expansion)

- Posting to `#approvals` (operator-only forever per `orchestrator/handoffs/COMM-HUB-CHANNEL-LAYOUT.md` line 34 — "Future Relay auto-publish for `#approvals` is NOT authorized — approval requests stay operator-published forever")
- Posting to `#codex-warnings` (operator-only forever per `orchestrator/handoffs/COMM-HUB-CHANNEL-LAYOUT.md` line 65)
- Posting to Category C (`#trading-alerts`, `#trading-summaries` — DORMANT; Trading-Writer role only after a separate multi-gated trading-track activation; never Relay)
- Reading Discord channels (one-way publisher; Discord is output-only for Relay)
- Reacting to Discord (replies, emojis, reactions)
- Interpreting Discord activity as input
- Drafting its own messages (Relay publishes pre-approved drafts only)
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
- Modifying `bot.js`, `dashboard.js`, `db.js`, `migrations/`, `scripts/`, `package.json`, lockfiles, `.nvmrc`, `.env*`, `position.json`, deploy config, autopilot templates, any safety-policy doc, any COMM-HUB template, this Relay spec, the Discord install checklist, the closed Migration 008 runbook, or any other repo file
- Auto-resume after halt (halt is permanent until operator intervention)
- Operating during CEILING-PAUSE
- Granting any approval (Relay has zero approval authority)
- Opening or closing any orchestrator phase
- Self-modifying or changing its own permissions
- Posting any content not in the pre-approved draft
- Inferring intent or requirements from Discord, Slack, GitHub, or any other channel

---

## Anti-execution boundaries

These are HARD CONSTRAINTS encoded both in design and in the future install:

1. **Network allowlist.** Relay process can reach the Discord API only. No Kraken API endpoints, no Railway deploy hooks, no production DB host, no GitHub API, no other endpoint. Enforced at firewall / hosting layer if available.
2. **Token scope.** Discord bot token has only `Send Messages` + `View Channels` (for the 3 allowed channels). NO `Read Message History`. NO `Manage Channels`, `Manage Roles`, `Kick Members`, `Ban Members`, `Manage Webhooks`, `Mention Everyone`, `Use Application Commands`. Per-channel permission overrides via the Relay role enforce the allow-list.
3. **No env / secret access beyond own token.** Relay process has env access only to its own Discord bot token + a logging endpoint. NO `DATABASE_URL`, NO `KRAKEN_API_KEY`, NO `KRAKEN_API_SECRET`, NO `MANUAL_LIVE_ARMED`, NO Railway tokens, NO GitHub tokens, NO CI/CD secrets.
4. **No filesystem write to repo.** Relay does not have a git checkout. It cannot modify `bot.js`, `dashboard.js`, `db.js`, `migrations/`, `scripts/`, `package.json`, lockfiles, `.env*`, deploy config, `position.json`, or any orchestrator doc. Relay runs from a containerized image with read-only access to its source-of-truth message store.
5. **Append-only message store read + Relay-private append-only publish log.** Relay reads its source-of-truth (orchestrator-drafted messages + idempotency keys + authorization metadata) from an append-only data store. Relay-private append-only publish log records every publish attempt. Relay cannot modify drafts, mark them as approved, invent new ones, or read Discord-side history.
6. **Verbatim publication.** Relay publishes the draft text byte-for-byte. No template injection, no variable substitution beyond allow-listed placeholders (e.g., timestamps). The set of allow-listed placeholders is documented in the source-of-truth schema and verified at publish time.
7. **Halt-on-anomaly.** Any verification mismatch (Codex PASS missing or stale, operator authorization missing or expired or exhausted or out-of-scope, channel not in allowlist, character limit exceeded, rate limit hit, network anomaly, idempotency-key mismatch) triggers an immediate permanent halt. Restart requires operator action.
8. **CEILING-PAUSE awareness.** Relay detects CEILING-PAUSE state from a controlled signal and halts during it. Relay does not auto-resume when CEILING-PAUSE clears; resumption requires operator action.
9. **No direct API to autopilot.** Relay cannot read or modify `orchestrator/AUTOPILOT-RULES.md` state, the phase-loop counter, ARC-8 stop-condition state, or any autopilot trigger. Relay is not an autopilot input or output channel.
10. **No admin / privileged actions.** Relay has zero permissions for server-admin actions, role changes, channel changes, member changes, invite generation, webhook creation, or Discord configuration changes.
11. **Audit logging.** Every Relay action (publish attempt, halt, verification failure) is logged to an operator-readable log. Logs are retained for review per the operator's retention policy. Audit logs are append-only.
12. **Rotation discipline.** Relay Discord bot token rotation cadence is documented at install time. Operator can revoke the token at any time via Discord's developer portal. Rotation does not require code change in Relay; only token change.
13. **Single-instance discipline.** Only one Relay instance runs at a time. Concurrent instances are a halt condition.

---

## Approval discipline

> Approval discipline: Relay has zero approval authority. Only Victor's explicit in-session chat instruction grants approval. Relay never treats Discord activity, Codex PASS, stored metadata alone, scheduled triggers, clean tree, green tests, or automation-internal state as approval.

> Per-message Victor approval is required for every Relay auto-publish through Stage 9, including all `#status` messages.

> Pre-authorized message classes are prohibited before Stage 10a. In Stage 10a and Stage 10b only, a message class may be pre-authorized only after Codex review and explicit Victor in-session approval naming: channel, template, allowed event types, maximum message count, expiration date, revocation rule, and forbidden-content constraints.

> Relay halts on missing, expired, exhausted, stale, ambiguous, or out-of-scope class authorization.

The 7 required bounds for any Stage 10a / 10b pre-authorized message class are:

1. **Channel** — exactly one of `#status`, `#summaries`, `#system-health`. Multi-channel classes are not allowed.
2. **Template** — the message-template-id (a reference to a documented orchestrator-drafted template); Relay only publishes messages that match the template byte-for-byte after allow-listed placeholder substitution.
3. **Allowed event types** — the documented event types that may trigger a publish under this class (e.g., `PHASE_OPENED`, `PHASE_CLOSED`, `COMMIT_LANDED`, `PUSH_COMPLETED`, `HALTED`).
4. **Maximum message count** — a hard cap on the number of publishes under this class. Reached count halts the class.
5. **Expiration date** — an explicit calendar date after which the class authorization is invalid. Past expiration halts the class.
6. **Revocation rule** — the operator action that immediately revokes the class authorization (typically a sentinel file, sentinel field in the source-of-truth, or operator chat instruction with documented effect).
7. **Forbidden-content constraints** — the explicit forbidden-content list per `orchestrator/HANDOFF-RULES.md` and `orchestrator/COMM-HUB-RULES.md` that the message under this class must not contain. Verified at publish time against the message body.

Class authorization is documented in the source-of-truth message store and verified at publish time. Missing or violating any of the 7 bounds is a hard halt.

---

## Message contract / metadata schema

Each orchestrator-drafted message Relay consumes carries the following metadata (canonical at install time; finalized in a future Stage 3 install-checklist phase):

- **Message id** — globally unique idempotency key.
- **Channel id** — must be in the Relay channel allow-list.
- **Message body** — verbatim Discord message text; subject to allow-listed placeholder substitution only.
- **Codex pre-publish PASS verdict reference** — pointer to the Codex review verdict; verified at publish time.
- **Operator authorization metadata** — either:
  - Per-message Victor authorization (Stage 9 and earlier; required through Stage 9), OR
  - Class authorization reference (Stage 10a / 10b only; references a documented bounded class with all 7 bounds).
- **Idempotency key** — orchestrator-side; verified against Relay-private append-only publish log before any publish attempt.
- **Allowed-placeholder map** — explicit list of placeholders Relay may substitute (e.g., `<UTC date>` → current UTC date at publish time).
- **Halt-on-condition flags** — explicit flags Relay verifies (e.g., CEILING-PAUSE state must be ACTIVE-NOT-BROKEN; if state is unclear, halt).

The schema is canonical; deviations halt the publish attempt.

---

## Idempotency mechanism

Relay idempotency uses orchestrator-side keys plus Relay-private append-only publish logs. **No Discord-side reads for deduplication.**

Mechanism:

1. Each orchestrator-drafted message carries a globally unique idempotency key in the source-of-truth message store.
2. Relay-private append-only publish log records every publish attempt (success or halt) with the idempotency key, channel id, timestamp, and outcome.
3. Before publishing, Relay verifies the idempotency key has no prior successful-publish entry in the Relay-private log.
4. If the key has a prior successful-publish entry, Relay halts (does not republish).
5. If the key is missing, ambiguous, reused inconsistently, or unverifiable, Relay halts (does not publish).
6. Relay does NOT call Discord's `Get Channel Messages` API or any Discord-side read endpoint for deduplication.

The Relay-private log is operator-readable and append-only. Operator can audit duplicates by reading the log directly.

---

## Channel allow-list (full enumeration)

| Channel | Relay write at full activation? | Codex pre-publish required? | Per-message Victor approval? | Class authorization eligible? |
|---|---|---|---|---|
| `#approvals` | **NEVER** | n/a | n/a | n/a |
| `#status` | YES (after Stage 9) | YES (every message) | YES (Stage 9 onward; per-message through Stage 9) | NO (Stage 9 is per-message only); class authorization possible later only if explicitly added in a future Stage |
| `#codex-warnings` | **NEVER** | n/a | n/a | n/a |
| `#summaries` | YES (after Stage 10a) | YES (every message) | YES (per-message OR bounded class with all 7 bounds) | YES (Stage 10a onward) |
| `#system-health` | YES (after Stage 10b) | YES (every message) | YES (per-message OR bounded class with all 7 bounds) | YES (Stage 10b onward) |
| `#trading-alerts` | **NEVER** | n/a | n/a | n/a |
| `#trading-summaries` | **NEVER** | n/a | n/a | n/a |

**3 of 7 channels eligible for Relay auto-post; 4 of 7 forever-blocked from Relay.**

---

## Required Codex review gates

Every Relay phase requires its own Codex docs-only review with sanitized prompt protocol.

| Gate | When | Scope |
|---|---|---|
| Codex design review | End of Stage 1 (`COMM-HUB-DESIGN-HERMES`) | Conversation-only design verification |
| Codex SAFE-class spec review | End of Stage 2 (`COMM-HUB-DOCS-C-HERMES-SPEC` — wrote `COMM-HUB-HERMES-RULES.md`) | New SAFE-class doc + cross-references |
| Codex install-checklist review | End of Stage 3 (`COMM-HUB-DOCS-D-HERMES-INSTALL-CHECKLIST`) | New install checklist template |
| Codex dry-run design review | End of Stage 4 (`COMM-HUB-HERMES-DRY-RUN-DESIGN`) | Conversation-only dry-run plan |
| Codex install-readiness review | End of Stage 5 (pre-install Gate-10 audit; before bot creation) | Final go/no-go for live install |
| Codex install-closeout review | End of Stage 6 (`COMM-HUB-HERMES-INSTALL-CLOSEOUT`) | Status-doc closeout |
| Codex dry-run review | End of Stage 7 (`COMM-HUB-HERMES-DRY-RUN`) | Dry-run results |
| Codex per-message pre-publish review | EVERY message Relay auto-publishes | Per-message sanity check; same canonical rule as `orchestrator/COMM-HUB-RULES.md` |
| Codex stage-promotion review | Each promotion (Stage 9 → 10a → 10b) | Verify previous stage clean |

Pre-publish Codex sanity check is the per-message gate that exists at the canonical Communication Hub level. Relay does not bypass it; Relay verifies it as metadata at publish time.

---

## Required Victor approval gates

| Gate | When | Authority class |
|---|---|---|
| Operator commit-only approval | Every doc-write phase (Stages 2, 3, 6, etc.) | Per existing workflow |
| Operator push approval | Every doc-write phase | Per existing workflow |
| Gate-10 install approval | Stage 5 (`COMM-HUB-HERMES-INSTALL`) | RED-tier per `orchestrator/APPROVAL-GATES.md` Gate 10 (automation install / upgrade) |
| Operator dry-run approval | Stage 7 | Per-action |
| Operator stage-promotion approval | Each promotion (Stage 9 → 10a → 10b) | Each promotion is its own RED-tier action |
| Operator per-message approval | Every Relay auto-publish through Stage 9 | Per-message |
| Operator class-authorization approval (Stage 10a / 10b only) | Each pre-authorized message class | Explicit Victor in-session approval naming all 7 bounds |
| Operator halt-resume approval | Any time Relay halts | No auto-resume |
| Operator deactivation approval | Any time | Operator can DORMANT-revert at any point |

The set of approvers remains exactly `{Victor}` throughout. Relay never has approval authority; Relay has narrow publish authority delegated by Victor for narrow message classes only at Stage 10a / 10b, after Stage 9 per-message approval has run cleanly.

---

## Staged activation path

> The phase identifiers in this table are preserved verbatim from the original spec because they are immutable historical or already-cited future phase identifiers. Per the naming convention above, only forward-looking active wording in this spec uses "Relay"; phase identifiers retain their original `HERMES` literal until a separate operator-authorized renaming phase.

| Stage | Phase identifier | Mode | Output | Approval class |
|---|---|---|---|---|
| 1 | `COMM-HUB-DESIGN-HERMES` | DESIGN-ONLY conversation | Design report (closed; Codex 8/8 PASS after one revision round) | Operator-directed manual; no commit |
| 2 | `COMM-HUB-DOCS-C-HERMES-SPEC` | DOCS-ONLY | This file (`orchestrator/COMM-HUB-HERMES-RULES.md`) + cross-reference updates + 3 status docs | Commit-only + push |
| 3 | `COMM-HUB-DOCS-D-HERMES-INSTALL-CHECKLIST` | DOCS-ONLY | New `orchestrator/handoffs/COMM-HUB-INSTALL-HERMES-CHECKLIST.md` + 3 status docs | Commit-only + push |
| 4 | `COMM-HUB-HERMES-DRY-RUN-DESIGN` | DESIGN-ONLY conversation | Dry-run plan (no install) | Operator-directed manual; no commit |
| 5 | `COMM-HUB-HERMES-INSTALL` | OPERATOR-DIRECTED MANUAL INSTALL | Live install — Discord bot creation, hosting setup, network allowlist, token rotation | **Gate 10 (automation install / upgrade)** per `orchestrator/APPROVAL-GATES.md` |
| 6 | `COMM-HUB-HERMES-INSTALL-CLOSEOUT` | DOCS-ONLY closeout | 3 status docs | Commit-only + push |
| 7 | `COMM-HUB-HERMES-DRY-RUN` | OPERATOR-DIRECTED MANUAL | Dry-run with no real Discord posts (verifies pipeline end-to-end without publishing) | Per-action |
| 8 | `COMM-HUB-HERMES-DRAFT-ONLY-MODE` | OPERATOR-DIRECTED MANUAL | Relay runs but only generates drafts; orchestrator + Codex + operator manual post still required | Per-action |
| 9 | `COMM-HUB-HERMES-LIMITED-AUTO-PUBLISH-STATUS` | OPERATOR-DIRECTED MANUAL | First authorized auto-post — `#status` only — **per-message Victor approval only**. Pre-authorized message classes prohibited at this stage. | RED-tier per-message |
| 10a | `COMM-HUB-HERMES-AUTO-PUBLISH-SUMMARIES` | OPERATOR-DIRECTED MANUAL | Expand to `#summaries`. Per-message OR bounded class with all 7 documented bounds. Class requires Codex review + explicit Victor in-session approval. | Stage-promotion approval + per-message or class-authorization |
| 10b | `COMM-HUB-HERMES-AUTO-PUBLISH-SYSTEM-HEALTH` | OPERATOR-DIRECTED MANUAL | Expand to `#system-health`. Same as 10a. | Stage-promotion approval + per-message or class-authorization |
| EOL | `COMM-HUB-HERMES-DEACTIVATE` (always available) | OPERATOR-DIRECTED MANUAL | Revert to DORMANT at any time | Per-action |

**Stop criteria at any stage:** if any stage's Codex review FAILs, the operator's preflight check fails, the dry-run reveals an unexpected behavior, or the operator simply wants to pause — the chain halts indefinitely. Relay never auto-progresses through stages.

---

## Hard limits

- **No Relay runtime is installed by writing this file.** This file is a docs-only specification.
- **No Discord bot is installed by writing this file.**
- **No webhook, scheduler, MCP trigger, cron job, Ruflo, or background automation is installed by writing this file.**
- **Relay remains DORMANT.** Activation requires the staged path above with explicit Victor approval at each gate.
- **Relay has zero approval authority.** Codex PASS, stored metadata alone, scheduled triggers, clean tree, green tests, and automation-internal state are NEVER approval.
- **Discord replies, emojis, and reactions are NEVER approvals.** Only Victor's explicit in-session chat instruction grants approval.
- **Discord is output-only for Relay.** No Discord-side reads for any purpose.
- **CEILING-PAUSE is never broken by Relay.** Relay detects CEILING-PAUSE state and halts during it.
- **Autopilot is never activated by Relay.** Relay is not an autopilot.
- **No production action.** No deploy, no Railway, no production DB, no Kraken, no env, no `MANUAL_LIVE_ARMED`, no live trading.
- **No runtime-file modification.** No `bot.js`, `dashboard.js`, `db.js`, `migrations/`, `scripts/`, `package.json`, lockfiles, `.nvmrc`, `.env*`, `position.json`, deploy config.
- **No safety-policy doc modification by Relay.** Relay does not have a git checkout.
- **No public Discord invite link generated by Relay.**
- **No Discord webhook created by Relay.**
- **No Discord-to-Railway / Discord-to-GitHub / Discord-to-Kraken / Discord-to-production-DB connection.**
- **No trading-alert connection from Relay.**
- **No Category C posting from Relay** (Trading-Writer is a different role; multi-gated activation required for that role; Relay never).
- **No `#approvals` posting from Relay** (forever — operator-only per `orchestrator/handoffs/COMM-HUB-CHANNEL-LAYOUT.md` line 34).
- **No `#codex-warnings` posting from Relay** (forever — operator-only per `orchestrator/handoffs/COMM-HUB-CHANNEL-LAYOUT.md` line 65).

---

## What this spec is NOT

- **Not authorization to install Relay.** Relay install is Stage 5 — Gate-10 RED-tier per `orchestrator/APPROVAL-GATES.md` and requires explicit Victor in-session approval at that future time.
- **Not authorization to install a Discord bot.** Discord bot install is part of the future Stage 5 install phase.
- **Not authorization to install a webhook.** Webhook install is a separately-gated future phase.
- **Not authorization to install a scheduler / MCP trigger / cron job / Ruflo / background automation.** Each is its own Gate-10 phase.
- **Not authorization to grant Relay any approval authority.** Relay has zero approval authority forever.
- **Not authorization to post to Discord.** Posting is operator-only manual action until Stage 9 lands.
- **Not authorization to take any production action, trading action, deploy action, env change, or RED-tier action.**
- **Not authorization to break CEILING-PAUSE.** Only an explicit operator direction-confirmation instruction breaks the ceiling.
- **Not canonical over `orchestrator/COMM-HUB-RULES.md`.** If this file diverges from the rulebook, the rulebook wins.
- **Not canonical over `orchestrator/handoffs/COMM-HUB-CHANNEL-LAYOUT.md`.** If this file diverges from the channel layout, the channel layout wins.
- **Not canonical over `orchestrator/AUTOMATION-PERMISSIONS.md`.** If this file diverges from the automation-permissions tiers, the tiers win.
- **Not canonical over `orchestrator/APPROVAL-GATES.md`.** If this file diverges from the gate matrix, the gate matrix wins.
