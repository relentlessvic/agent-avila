# Communication Hub — Relay Stage 5 Preconditions (template — COMM-HUB)

> **Author rule:** This file documents preconditions 12–15 in the canonical install checklist (`orchestrator/handoffs/COMM-HUB-INSTALL-HERMES-CHECKLIST.md` §"Preconditions before Relay install") so they are version-controlled before any Stage 5 install approval. **This document is NOT authorization to install Relay, register a Discord application, mint a Discord bot token, invite a bot to the server, grant any permission, install a webhook / scheduler / MCP trigger / cron job / Ruflo / Relay runtime / background automation, post to Discord, take a production action, take a trading action, or break CEILING-PAUSE.** Stage 5 install (`COMM-HUB-HERMES-INSTALL`) remains RED-tier Gate-10 per `orchestrator/APPROVAL-GATES.md` and requires Codex install-readiness PASS plus explicit Victor in-session Gate-10 approval at that future time.
>
> **No Relay runtime, Discord bot, webhook, scheduler, MCP trigger, cron job, or background automation is installed by writing this file.**

Author: Operator-driven manual planning (Claude as orchestrator; future installs Victor-only)
Last updated: 2026-05-05 (COMM-HUB-DOCS-F-HERMES-STAGE5-PRECONDITIONS — DOCS-ONLY)
Canonical references:
- `orchestrator/COMM-HUB-HERMES-RULES.md` — canonical Relay specification (SAFE-class)
- `orchestrator/handoffs/COMM-HUB-INSTALL-HERMES-CHECKLIST.md` — Relay Stage 5 install checklist (15 preconditions; this document codifies preconditions 12–15)
- `orchestrator/handoffs/COMM-HUB-HERMES-DRY-RUN-DESIGN.md` — Stage 4 dry-run design
- `orchestrator/COMM-HUB-RULES.md` — Communication Hub rulebook (SAFE-class)
- `orchestrator/handoffs/COMM-HUB-CHANNEL-LAYOUT.md` — canonical channel/role/permission layout
- `orchestrator/AUTOPILOT-RULES.md` — ARC-8 phase-loop ceiling rule
- `orchestrator/APPROVAL-GATES.md` — Gate 10 automation install / upgrade
- `orchestrator/AUTOMATION-PERMISSIONS.md` — GREEN / YELLOW / RED tiers
- `orchestrator/PROTECTED-FILES.md` — SAFE / RESTRICTED / HARD BLOCK matrix
- `orchestrator/HANDOFF-RULES.md` — packet conventions and forbidden-content list

If any field below diverges from the canonical files above, the canonical files win and this document must be re-aligned in a follow-up DOCS-ONLY phase.

---

## §1 — Phase classification and scope

This Stage 4-related codification phase (`COMM-HUB-DOCS-F-HERMES-STAGE5-PRECONDITIONS`) is **DOCS-ONLY**. It does NOT install Relay, register a Discord application, mint a Discord bot token, invite a bot, grant any permission, install a webhook / scheduler / MCP trigger / cron job / Ruflo / Relay runtime / background automation, post to Discord, take a production action, take a trading action, or break CEILING-PAUSE.

The phase produces:
- This new template file (`orchestrator/handoffs/COMM-HUB-HERMES-STAGE5-PRECONDITIONS.md`).
- Updates to 3 status docs (`orchestrator/STATUS.md`, `orchestrator/CHECKLIST.md`, `orchestrator/NEXT-ACTION.md`).

Total scope = 4 files.

---

## §2 — Current HEAD reference

**HEAD at start of this phase:** `a63d59d3535e774087923c07e3607391507c7c75`

This HEAD is the post-`COMM-HUB-DOCS-E-HERMES-DRY-RUN-DESIGN-SPEC-CLOSEOUT-SYNC` state. The Codex install-readiness review (precondition 11) at this HEAD has not yet been dispatched; this preconditions document closes preconditions 12–15 in advance so the Stage 5 install approval packet can name a single HEAD with all five operator-side preconditions documented.

The Codex install-readiness review and the Stage 5 Gate-10 install approval should reference whichever HEAD is current at that time per `git rev-parse HEAD`. If commits land between this preconditions doc and the Stage 5 approval, the operator must re-attest preconditions at the new HEAD.

---

## §3 — Stage 1–4 closure (recorded for context)

| Stage | Phase | Status |
|---|---|---|
| 1 | `COMM-HUB-DESIGN-HERMES` | CLOSED — Design-only PASS (Codex 8 of 8 PASS after one revision round; conversation-only; no commit) |
| 2 | `COMM-HUB-DOCS-C-HERMES-SPEC` | CLOSED at `96f56a4767cc96ddd8b78bcc3b309e8fd455c8a5` (12-file commit; pushed; three-way SHA PASS) |
| 2-sync | `COMM-HUB-DOCS-C-HERMES-SPEC-CLOSEOUT-SYNC` | CLOSED at `fd4b0404ba60d8313479cabd0630e4d8aa8e983b` |
| 2-sync-closeout | `COMM-HUB-DOCS-C-HERMES-SPEC-CLOSEOUT-SYNC-CLOSEOUT` | CLOSED at `f473df51ad7f80d574d14902ab6ab10434f6c1cb` |
| 3 | `COMM-HUB-DOCS-D-HERMES-INSTALL-CHECKLIST` | CLOSED at `e18f2207eae4ab734beb6f29626de1a5e4cd5757` (4-file commit; install checklist canonical) |
| 3-sync | `COMM-HUB-DOCS-D-HERMES-INSTALL-CHECKLIST-CLOSEOUT-SYNC` | CLOSED at `688358441f0f9b0b3d0486c673453294a9b608a8` |
| 4 | `COMM-HUB-HERMES-DRY-RUN-DESIGN` | CLOSED — Design-only PASS (4 Codex review passes; final overall verdict PASS on all 20 questions; conversation-only; no commit) |
| 4-codification | `COMM-HUB-DOCS-E-HERMES-DRY-RUN-DESIGN-SPEC` | CLOSED at `f58451a87de99731b86714cbcc8d42d4c2dff3fa` (4-file commit; dry-run design canonical) |
| 4-codification-sync | `COMM-HUB-DOCS-E-HERMES-DRY-RUN-DESIGN-SPEC-CLOSEOUT-SYNC` | CLOSED at `a63d59d3535e774087923c07e3607391507c7c75` (current HEAD) |

All Stage 1 through Stage 4 phases (and intervening sync / codification phases) are CLOSED.

---

## §4 — Install-readiness review summary

The `COMM-HUB-HERMES-INSTALL-READINESS-REVIEW` phase (READ-ONLY AUDIT / DESIGN-ONLY) returned the following verdict:

**READY FOR CODEX INSTALL-READINESS REVIEW** with documented operator-side blockers before Stage 5 install execution.

Open blockers identified before Stage 5 install execution (must clear in this order):

1. **Codex install-readiness PASS** at the relevant HEAD (precondition 11). Packet prepared in the readiness review; not yet dispatched.
2. **Operator hosting decision documented** (precondition 12) — codified in §5 below.
3. **Operator network-allowlist plan documented** (precondition 13) — codified in §6 below.
4. **Operator token-storage plan documented** (precondition 14) — codified in §7 below.
5. **Operator account in good standing attested** (precondition 15) — operator-attestation requirement codified in §8 below; final attestation will appear in the Stage 5 Gate-10 approval packet.
6. **Stage 5 Gate-10 install approval** — RED-tier; explicit Victor in-session naming the exact install scope at the relevant HEAD.

This preconditions document closes 12, 13, 14, and 15's documentation requirements. Precondition 11 (Codex install-readiness PASS) and the Stage 5 Gate-10 install approval remain open.

---

## §5 — Precondition 12: hosting decision

### Safe-default policy

Relay must run in a **separate isolated host / service / container** from the trading runtime. The Relay process MUST NOT share any of the following with the trading runtime (`bot.js`, `dashboard.js`, the production DB, the production Railway service `agent-avila-dashboard`, or any other live trading-path component):

- Process / PID namespace.
- Container image.
- Filesystem / volume mounts.
- Environment-variable scope.
- Railway service id.
- Database access (`DATABASE_URL`, any DB connection string, any DB credential).
- Kraken access (`KRAKEN_API_KEY`, `KRAKEN_API_SECRET`, any Kraken endpoint connectivity, any order / balance / position read or write).
- `MANUAL_LIVE_ARMED` env access.
- GitHub deploy hook connectivity beyond what the host requires for self-management.
- CI/CD secrets.

### Forbidden host options

The following are explicitly forbidden as the Relay host:

- The `agent-avila-dashboard` Railway service (production trading-runtime service).
- Any Railway service that imports / references the production DB.
- Any container that has a writable `.git` checkout of `relentlessvic/agent-avila` or any successor repo.
- Any container that has Kraken / production-DB / Railway / GitHub / `MANUAL_LIVE_ARMED` env vars beyond what is strictly required for the host's own management.
- Any local developer workstation that has live Kraken credentials or production-DB credentials (would couple operator-side work to Relay runtime).
- Any shared multi-tenant container.

### Acceptable host classes (operator-selected)

The operator may select any one of the following classes (Stage 5 approval packet must name the exact host):

| Class | Examples | Notes |
|---|---|---|
| Separate Railway service | A new Railway service (separate from `agent-avila-dashboard`) provisioned exclusively for Relay | Must enforce no-shared-env; Railway-side firewall / egress allowlist required |
| Separate dedicated container on a different host | A separate Docker container on a different VPS / cloud provider | Must enforce no-shared-env at host level; egress allowlist enforced at firewall layer |
| Self-hosted operator-controlled box | A dedicated machine the operator controls | Must enforce egress allowlist; no shared trading-runtime state on the same machine |
| Serverless function (e.g., Cloudflare Worker / AWS Lambda) bound to Relay scope only | Limited; depends on Discord API client compatibility | Must enforce egress allowlist; no shared env beyond bot token |

### Operator-attestation form (for Stage 5 approval packet)

In the Stage 5 Gate-10 approval packet, the operator must record:

- **Chosen host class:** ___ (one of the above)
- **Host identifier:** ___ (Railway service id / container name / hostname / etc., redacted of secrets if necessary)
- **No-shared-env confirmation:** "Relay host does not share process / image / volume / env scope / Railway service id / DB / Kraken / `MANUAL_LIVE_ARMED` / GitHub deploy hook / CI/CD secret access with the trading runtime."
- **No-shared-DB confirmation:** "Relay host has no `DATABASE_URL` env var or any DB connection string."
- **No-shared-Kraken confirmation:** "Relay host has no `KRAKEN_API_KEY` / `KRAKEN_API_SECRET` env var or any Kraken endpoint reachable from its egress."
- **No-trading-runtime-import confirmation:** "Relay host does not import / reference any trading-runtime file (`bot.js`, `dashboard.js`, `db.js`, `migrations/`, `scripts/`, `position.json`)."

---

## §6 — Precondition 13: network allowlist plan

### Safe-default policy

Relay egress (outbound network) is restricted to **Discord API endpoints only**, plus required DNS / TLS resolution if necessary for those endpoints to function.

### Allowed egress endpoints (full enumeration)

| Endpoint class | Purpose | Notes |
|---|---|---|
| Discord API gateway endpoint(s) | Relay gateway authentication (`IDENTIFY` / `READY`) | Required for Send Messages + View Channels |
| Discord REST API endpoint(s) | Relay `Send Message` calls (only when in non-dry-run mode); `View Channels` (read-only channel-list inspection) | Required for the bot's allow-listed scopes |
| DNS resolver | Resolve Discord API hostnames | Required for the above to function |
| TLS / certificate authority validation | TLS handshake to Discord endpoints | Required for the above to function |

The exact Discord endpoint hostnames are documented in Discord's official developer docs at install time; the operator records the resolved hostname(s) in the Stage 5 approval packet.

### Forbidden egress (full enumeration)

The following endpoints / endpoint classes MUST NOT be reachable from the Relay host:

- Kraken API (any endpoint at any subdomain / path; any subscription gateway).
- Railway deploy hooks; Railway-internal control plane endpoints; any Railway-side surface that allows redeploys / env-var read / log read of other services.
- Production database host (`agent_avila` DB at the live host) on any port (including pooler / replica / backup endpoints).
- GitHub API endpoints (`api.github.com`); GitHub deploy webhooks; GitHub Actions API.
- CI/CD provider endpoints.
- Other LLM provider endpoints (OpenAI, Anthropic, Google, etc.) beyond what is strictly required for Relay operation (Relay does NOT require LLM API access).
- Other Discord servers' webhook URLs.
- Any other arbitrary internet endpoint.

### Enforcement

Egress allowlist must be enforced at the firewall / hosting layer (per the canonical install checklist §"Anti-execution boundaries" item 1 + step 14). At runtime, Relay halts on any egress to a non-allow-listed endpoint (per the canonical halt-on-anomaly mechanism: §"Anti-execution boundaries" item 7 line 148 — "network anomaly").

### Operator-attestation form (for Stage 5 approval packet)

In the Stage 5 Gate-10 approval packet, the operator must record:

- **Allowed-egress hostnames / IP ranges:** ___ (list of resolved Discord endpoints + DNS resolver if applicable; redacted of any operator-internal IP ranges if sensitive)
- **Enforcement layer:** ___ (firewall / hosting-provider security group / cloud-provider VPC egress rule / etc.)
- **Forbidden-egress confirmation:** "Relay host egress is restricted to Discord API endpoints only. Kraken, Railway, production DB, GitHub, CI/CD, other LLM providers, and arbitrary internet egress are blocked."
- **Halt-on-anomaly confirmation:** "Relay process is configured to halt-on-anomaly (per the canonical halt-on-anomaly mechanism) on any egress attempt to a non-allow-listed endpoint."

---

## §7 — Precondition 14: token-storage plan

### Safe-default policy

The Discord bot token MUST live **only in the selected host's secret store**. The token is the credential that authorizes Relay to authenticate to Discord; leakage of the token would allow any party to impersonate Relay. Strict storage discipline is required.

### Storage rules

| Rule | State |
|---|---|
| Token lives in the chosen host's secret store | Required (e.g., Railway secret variable, cloud KMS, host-side credential file with restricted permissions, hardware security module, etc.) |
| Token committed to the repo | **NEVER** |
| Token committed to any `.env*` file in the repo | **NEVER** |
| Token pasted into a Discord channel (any server, any channel) | **NEVER** |
| Token pasted into a Codex / Claude / ChatGPT / LLM context | **NEVER** |
| Token attached to a handoff packet (HANDOFF-RULES.md surfaces) | **NEVER** |
| Token written to `position.json` or any orchestrator doc | **NEVER** |
| Token visible in any operator-captured screenshot | **REDACT in every screenshot** |
| Token logged in any operator-readable log | Tokens redacted in every log; the Relay-private append-only publish log records the bot's actions but NOT the token value itself |
| Token shared verbally / over phone / over email / over Slack / over any non-host-internal channel | **NEVER** |

### Token rotation

- Operator-defined rotation cadence documented at install time.
- Rotation is performed via the Discord developer portal (Application → Bot → Reset Token) and the new token is stored in the host secret store immediately, replacing the prior token.
- The operator may revoke the token at any time (single click in the developer portal); revocation is the fastest single-step DORMANT-revert per the canonical install checklist §"Rollback / removal steps".

### Operator-attestation form (for Stage 5 approval packet)

In the Stage 5 Gate-10 approval packet, the operator must record:

- **Chosen secret store:** ___ (Railway secret variable / cloud KMS / host-side credential file / hardware security module / etc.)
- **Storage-discipline confirmation:** "The Discord bot token will be stored only in the chosen secret store. It will NEVER be committed to the repo, pasted into a Discord channel, pasted into Codex / Claude / ChatGPT / any LLM context, attached to a handoff packet, written to `position.json` or any orchestrator doc, or shared via any non-host-internal channel."
- **Redaction-discipline confirmation:** "Tokens will be redacted in every operator-captured screenshot, log entry, and annotation."
- **Rotation cadence:** ___ (operator-defined; e.g., "rotated immediately if leak suspected; otherwise rotated quarterly")
- **Emergency-revoke confirmation:** "Operator can revoke the token at any time via the Discord developer portal; this is the fastest single-step DORMANT-revert."

---

## §8 — Precondition 15: Victor account good-standing attestation

### Safe-default policy

Before Stage 5 install execution, Victor's primary Discord account must satisfy the following good-standing requirements (consistent with the canonical install checklist precondition 15 + Discord install checklist §"Manual click-by-click install checklist for Victor" pre-install requirements):

| Requirement | State |
|---|---|
| Server owner of `Agent Avila Hub` | Required (Victor's primary Discord account is the server owner per Discord install) |
| `CEO` role assigned (Administrator permission) | Required (per Discord install checklist) |
| 2FA enabled on Victor's primary Discord account | Required (Discord requires 2FA for moderation actions on the server) |
| Discord developer portal access | Required (Victor will register the Relay application via the developer portal at Stage 5) |
| Account in good standing (not under any Discord moderation action) | Required |

### No alternate-account substitution

Victor's primary Discord account (the same one that owns `Agent Avila Hub`) MUST be the account that:
- Registers the Relay application in the Discord developer portal.
- Authorizes the Relay bot's invitation to `Agent Avila Hub`.
- Performs all Stage 5 install steps.

The Hub-Read alt account (if assigned during Discord install) MUST NOT perform any Stage 5 install action — Hub-Read is read-only on the server.

### Operator-attestation form (for Stage 5 approval packet)

At Stage 5 Gate-10 approval time, Victor must attest in-session:

- **"My primary Discord account is the server owner of `Agent Avila Hub` and has the `CEO` role with Administrator permission."**
- **"My primary Discord account has 2FA enabled."**
- **"My primary Discord account has Discord developer portal access."**
- **"My primary Discord account is in good standing (not under any Discord moderation action)."**
- **"I will register the Relay application using my primary Discord account; the Hub-Read alt account (if assigned) will NOT perform any Stage 5 install action."**

This attestation is recorded in the Stage 5 Gate-10 approval packet itself; it is not pre-attestable in this preconditions document because the attestation is time-bound (account state could change between this document's commit and the Stage 5 approval).

---

## §9 — Preserved state (recorded for context)

This preconditions document preserves the following state:

- **Relay DORMANT** (zero members, zero permissions; canonical Relay spec and install checklist roles unchanged).
- **Stage 5 `COMM-HUB-HERMES-INSTALL` RED-tier Gate-10** per `orchestrator/APPROVAL-GATES.md` line 56.
- **Stage 7 `COMM-HUB-HERMES-DRY-RUN` separately gated** (per the canonical Relay spec staged-path table; not authorized by Stage 5 install approval).
- **CEILING-PAUSE active and not broken** (operator-directed manual phase does NOT advance autopilot phase-loop counter and does NOT break CEILING-PAUSE per `orchestrator/AUTOPILOT-RULES.md` ARC-8).
- **Autopilot runtime DORMANT.**
- **Migration 008 APPLIED** at HEAD `189eb1be6ef6304d914671bdaedec44d389cf877` (Attempt 6 — 2026-05-04, runner exit 0).
- **N-3 CLOSED.**
- **Approvers exactly `{Victor}`.**
- **Discord server `Agent Avila Hub`** unchanged (channel structure, role hierarchy, permissions, audit log, integrations panel showing zero apps and zero webhooks).
- **No Relay runtime, Discord application, Discord bot, Discord bot token, bot invite, webhook, scheduler, MCP trigger, cron job, Ruflo, or background automation** installed or authorized.
- **No Discord post**, no Railway action, no production DB action, no Kraken action, no env change, no `MANUAL_LIVE_ARMED` change, no runtime edit, no deploy, no migration, no live trading action.

---

## §10 — Authorization scope (explicit)

This preconditions document **does NOT authorize Stage 5 install**. Specifically, this document does NOT authorize:

- Relay install (Stage 5 — `COMM-HUB-HERMES-INSTALL`).
- Relay runtime activation.
- Discord application registration.
- Discord bot creation.
- Discord bot token minting.
- Bot invite to `Agent Avila Hub` or any other server.
- Granting any Discord permission to any role.
- Changing any role's DORMANT classification.
- Webhook creation.
- Scheduler / MCP trigger / cron job / Ruflo / background-automation install.
- Discord post (drafts, tests, seeds, or any post in any channel).
- Public Discord invite-link creation.
- Discord-to-Railway / Discord-to-GitHub / Discord-to-Kraken / Discord-to-production-DB connection.
- Trading-alert connection.
- Codex-Writer activation.
- Trading-Writer activation.
- Category C activation.
- Production action (Railway, production DB, Kraken, env, `MANUAL_LIVE_ARMED`, runtime edit, deploy, migration application).
- Live trading.
- Autopilot runtime activation.
- Autopilot CEILING-PAUSE break.
- ARC-8-RUN-C.
- Stage 5 / 6 / 7 / 8 / 9 / 10a / 10b execution.
- Modification of the canonical Relay spec, install checklist, dry-run design, channel layout, or any safety-policy doc.

**Stage 5 still requires (in this order):**

1. **Codex install-readiness PASS** at the relevant HEAD (precondition 11; 14-question packet recommended in the install-readiness review report).
2. **Stage 5 Gate-10 install approval** — RED-tier per `orchestrator/APPROVAL-GATES.md`. Operator names the exact install scope (Discord app/bot creation steps 1–13, host setup step 14 referencing the host class chosen per §5 of this document, token storage referencing §7, network allowlist referencing §6, channel permission grants per install checklist steps 11–13, smoke-test step 18) at the relevant HEAD. Operator attests preconditions 15 (account good standing per §8) in the approval packet itself.

After Stage 5 install completes and Stage 6 closeout commits-and-pushes, Stage 7 dry-run requires its own separate per-action operator approval (per the canonical install checklist §"Required Victor approvals" + dry-run design §10 "What Victor must approve before moving to Stage 5 install").

---

## What this document is NOT

- **Not authorization to install Relay.** Relay install is Stage 5 — Gate-10 RED-tier per `orchestrator/APPROVAL-GATES.md` and requires explicit Victor in-session approval at that future time, after Codex install-readiness PASS.
- **Not authorization to execute the chosen host setup.** Host provisioning, network-allowlist enforcement, secret-store provisioning, and bot-token minting all happen at Stage 5 install execution time — under separate operator-approved scope.
- **Not a substitute for Codex install-readiness review.** Precondition 11 (Codex install-readiness PASS) remains open after this document commits and pushes; the review must still be dispatched and pass before Stage 5 Gate-10 install approval can be granted.
- **Not a substitute for Victor's in-session attestation of preconditions 15 (account good standing) at Stage 5 approval time.** That attestation is time-bound to the Stage 5 approval packet itself.
- **Not authorization to register a Discord application or bot.** Application / bot registration is part of the future Stage 5 install phase.
- **Not authorization to mint, store, rotate, or use a Discord bot token.** Token operations are part of Stage 5.
- **Not authorization to grant any Discord permission to any role.** Permission grants are part of Stage 5.
- **Not authorization to invite a bot to the server.** Bot invite is part of Stage 5.
- **Not authorization to install a webhook / scheduler / MCP trigger / cron job / Ruflo / background automation.** Each is its own Gate-10 phase.
- **Not authorization to grant Relay any approval authority.** Relay has zero approval authority forever.
- **Not authorization to grant Relay any trading authority.** Relay has zero trading authority forever.
- **Not authorization to post to Discord.** Posting is operator-only manual action until Stage 9 lands; Stage 9 itself is RED-tier per-message.
- **Not authorization to take any production action, trading action, deploy action, env change, or RED-tier action.**
- **Not authorization to break CEILING-PAUSE.** Only an explicit operator direction-confirmation instruction breaks the ceiling.
- **Not canonical over `orchestrator/COMM-HUB-HERMES-RULES.md`.** If this document diverges from the Relay spec, the spec wins.
- **Not canonical over `orchestrator/handoffs/COMM-HUB-INSTALL-HERMES-CHECKLIST.md`.** If this document diverges from the install checklist, the install checklist wins.
- **Not canonical over `orchestrator/handoffs/COMM-HUB-HERMES-DRY-RUN-DESIGN.md`.** If this document diverges from the dry-run design, the dry-run design wins.
- **Not canonical over `orchestrator/COMM-HUB-RULES.md`.** If this document diverges from the rulebook, the rulebook wins.
- **Not canonical over `orchestrator/handoffs/COMM-HUB-CHANNEL-LAYOUT.md`.** If this document diverges from the channel layout, the channel layout wins.
- **Not canonical over `orchestrator/AUTOMATION-PERMISSIONS.md`.** If this document diverges from the automation-permissions tiers, the tiers win.
- **Not canonical over `orchestrator/APPROVAL-GATES.md`.** If this document diverges from the gate matrix, the gate matrix wins.

**This codification phase (`COMM-HUB-DOCS-F-HERMES-STAGE5-PRECONDITIONS`) is DOCS-ONLY and does NOT activate Relay. Relay remains DORMANT (zero members, zero permissions) at the end of this phase. Stage 5 install requires Codex install-readiness PASS + Stage 5 Gate-10 install approval. Stage 7 dry-run requires its own separately-approved per-action phase after Stage 6 closeout.**
