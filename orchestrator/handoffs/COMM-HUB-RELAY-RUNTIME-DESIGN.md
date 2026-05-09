# Communication Hub — Relay Runtime Design (template — COMM-HUB)

> **Author rule:** This file codifies the Codex-PASS-verified runtime design for Relay (the planned future Discord auto-publisher), produced as a conversation-only design packet during the `COMM-HUB-HERMES-RUNTIME-DESIGN` phase and Codex-PASS-verified after the EDIT-1 through EDIT-5 correction round on §5, §8, §13, and §18.8. **This document is NOT authorization to write Relay runtime code, create the `relentlessvic/agent-avila-hermes` repository, install Relay further, deploy a Relay runtime, register a Discord application, mint a Discord bot token, invite a bot to the server, grant any Discord permission, install a webhook / scheduler / MCP trigger / cron job / Ruflo / background automation, post to Discord, run a Stage 7 dry-run, take a production action, take a trading action, or break CEILING-PAUSE.** Stage 5 install Steps 14–21 resumption (`COMM-HUB-HERMES-INSTALL` resume) remains RED-tier Gate-10 per `orchestrator/APPROVAL-GATES.md` and requires a fresh Codex install-readiness review plus explicit Victor in-session Gate-10 approval at the then-current HEAD. Future codification of any subsequent design revisions, runtime authoring (`COMM-HUB-HERMES-RUNTIME-IMPLEMENT`), and runtime deployment are each their own separately-approved phases.
>
> **No Relay runtime, Relay repo, Discord bot capability change, webhook, scheduler, MCP trigger, cron job, or background automation is installed by writing this file.**

Author: Operator-driven manual planning (Claude as orchestrator; future implementation Victor-only)
Last updated: 2026-05-06 (COMM-HUB-DOCS-G-HERMES-RUNTIME-DESIGN-SPEC — DOCS-ONLY)
Source-design HEAD: `01a449020cb97e817667557fadb2c80fc682479d` (the conversation-only design packet was Codex-PASS-verified at this HEAD after EDIT-1 through EDIT-5 corrections)
Canonical references:
- `orchestrator/COMM-HUB-RELAY-RULES.md` — canonical Relay specification (SAFE-class)
- `orchestrator/handoffs/COMM-HUB-INSTALL-RELAY-CHECKLIST.md` — Relay Stage 5 install checklist (21-step manual sequence; Steps 1–13 complete; Steps 14–21 deferred)
- `orchestrator/handoffs/COMM-HUB-HERMES-DRY-RUN-DESIGN.md` — Stage 4 dry-run design (19 halt classes; 13 test fixtures)
- `orchestrator/handoffs/COMM-HUB-RELAY-STAGE5-PRECONDITIONS.md` — Stage 5 preconditions 12–15
- `orchestrator/handoffs/COMM-HUB-HERMES-STAGE5-PARTIAL-INSTALL-RECORD.md` — Stage 5 partial-install record (Steps 1–13 done; Steps 14–21 deferred; 3-step rollback path canonical in §7)
- `orchestrator/COMM-HUB-RULES.md` — Communication Hub rulebook
- `orchestrator/handoffs/COMM-HUB-CHANNEL-LAYOUT.md` — channel/role/permission canonical matrix
- `orchestrator/APPROVAL-GATES.md`, `orchestrator/AUTOMATION-PERMISSIONS.md`, `orchestrator/PROTECTED-FILES.md`, `orchestrator/HANDOFF-RULES.md`, `orchestrator/ROLE-HIERARCHY.md`, `orchestrator/PHASE-MODES.md`, `orchestrator/NEXT-ACTION-SELECTOR.md` — ARC governance docs

---

## §1 — Phase context and constraints

**Phase name:** `COMM-HUB-HERMES-RUNTIME-DESIGN`. **Mode:** DESIGN-ONLY conversation; operator-directed manual; not autopilot-driven; does NOT advance autopilot phase-loop counter; does NOT break CEILING-PAUSE.

**Output type:** conversation-only design packet (this document is its codification). No commit by the design phase itself. No file written by the design phase. No Discord / Railway / env / production / trading action by the design phase. Codification of the design (this current `COMM-HUB-DOCS-G-HERMES-RUNTIME-DESIGN-SPEC` phase) writes the design to disk as a docs-only commit; codification does NOT authorize implementation or deployment.

**Stage in canonical Relay activation path:** between Stage 6 closeout (already done at `69b3790…` recording the partial Stage 5 install) and any future Stage 5 resumption. The canonical Relay spec staged-path (per `orchestrator/COMM-HUB-RELAY-RULES.md` §"Staged activation path" lines 274–289) does NOT include a runtime-design step explicitly because the spec assumed a runtime would already exist. This phase fills that gap retroactively as its own design track, separate from but compatible with the canonical staged path.

**Codex review at end of draft:** Codex docs-only review with ~25 questions covering design content + safety properties. PASS gate before any future codification phase opens. Established review pattern (similar to COMM-HUB-DESIGN-DISCORD-INSTALL 15-Q, COMM-HUB-DESIGN-HERMES 8-Q, COMM-HUB-HERMES-DRY-RUN-DESIGN 20-Q).

**Future codification (this current phase performs codification):** the codification commits this design to disk as `orchestrator/handoffs/COMM-HUB-RELAY-RUNTIME-DESIGN.md`. Any subsequent design revisions would require their own separately-approved DOCS-ONLY phase.

**Future implementation (not authorized by this codification phase):** runtime authoring (writing actual Relay process code — Node.js modules, Discord client integration, halt-on-anomaly state machine, idempotency store, etc.) is a separate substantive implementation phase. Implementation is NOT a DOCS-ONLY phase; it would be SAFE IMPLEMENTATION or HIGH-RISK IMPLEMENTATION tier per `orchestrator/PHASE-MODES.md`. Implementation requires its own design + Codex code review + Victor approval cascade with fresh approvals.

**Future deployment (not authorized by this codification phase):** deploying the Relay runtime to the existing `agent-avila-hermes` Railway service is yet another separately-approved phase, equivalent to Stage 5 resumption (Steps 14–21). Requires fresh Gate-10 approval at the then-current HEAD.

**Hard limits this design preserves:**

- Relay is governance-only and never a trading actor (per `orchestrator/AUTOMATION-PERMISSIONS.md` line 224 + `orchestrator/COMM-HUB-RELAY-RULES.md` line 37).
- Relay has zero approval authority forever (per `COMM-HUB-RELAY-RULES.md` §"Approval discipline" line 160).
- Relay never reads Discord channels (per `COMM-HUB-RELAY-RULES.md` §"Forbidden — explicit non-listener clause" line 106).
- Relay never has `Read Message History` (per `COMM-HUB-RELAY-RULES.md` lines 88, 106).
- Relay never posts to `#approvals`, `#codex-warnings`, or Category C (per `COMM-HUB-RELAY-RULES.md` §"Channel allow-list" line 222 + `COMM-HUB-CHANNEL-LAYOUT.md`).
- Relay never auto-resumes after halt (per `COMM-HUB-RELAY-RULES.md` §"Anti-execution boundaries" item 7 line 148).
- CEILING-PAUSE remains active and not broken throughout this phase.
- Migration 008 APPLIED at `189eb1be6ef6304d914671bdaedec44d389cf877`; N-3 CLOSED. Approvers exactly `{Victor}`.

---

## §2 — Design requirements (operator's 22 verbatim)

The operator's phase-open instruction listed 22 numbered design requirements. They are recorded here verbatim as the canonical design spec for this phase:

1. Relay must be one-way publisher only.
2. Relay must never read Discord messages.
3. Relay must never use Read Message History.
4. Relay must never listen to Discord events.
5. Relay must never treat Discord replies, emojis, reactions, messages, or activity as approval.
6. Relay must never approve anything.
7. Relay must never trade.
8. Relay must have no Kraken credentials.
9. Relay must have no production DB credentials.
10. Relay must have no dashboard credentials.
11. Relay must have no `MANUAL_LIVE_ARMED` variable.
12. Relay must have no access to `bot.js`, `dashboard.js`, `db.js`, `migrations/`, `scripts/`, `position.json`, `.env*`, trading runtime, or production execution surfaces.
13. Relay must publish only to approved channels: `#status`, `#summaries`, `#system-health`.
14. Relay must NOT publish to: `#approvals`, `#codex-warnings`, `#trading-alerts`, `#trading-summaries`.
15. Relay must halt on anomaly.
16. Relay must support idempotency so duplicate messages are not posted.
17. Relay must have clear message-source rules.
18. Relay must have dry-run / no-publish test mode.
19. Relay must have audit logs that do not contain secrets.
20. Relay must be deployable separately from `agent-avila-dashboard`.
21. Relay runtime design must preserve trading-system isolation.
22. Runtime implementation and deployment are NOT authorized by this design phase.

Every section §4–§18 below maps back to one or more of these requirements. The numbered references below cite both the requirement number (e.g., R12 = requirement 12) and the canonical safety-policy doc location (e.g., spec line 145).

---

## §3 — Canonical references

This design is derivative of the existing canonical Relay safety-policy + handoff docs. The canonical files win on any divergence; the design must be re-aligned in a follow-up DOCS-ONLY phase if any divergence is later detected.

| Canonical file | Last commit | Role for this design |
|---|---|---|
| `orchestrator/COMM-HUB-RELAY-RULES.md` | `96f56a4…` | SAFE-class Relay spec; 13 anti-execution boundaries; capability allow-list; staged activation path |
| `orchestrator/handoffs/COMM-HUB-INSTALL-RELAY-CHECKLIST.md` | `e18f220…` | 21-step install checklist; partial-completed at Steps 1–13; Steps 14–21 deferred |
| `orchestrator/handoffs/COMM-HUB-HERMES-DRY-RUN-DESIGN.md` | `f58451a…` | Stage 4 dry-run design; 19 halt classes; sample test fixtures |
| `orchestrator/handoffs/COMM-HUB-RELAY-STAGE5-PRECONDITIONS.md` | `40f3137…` | Stage 5 preconditions 12–15 (host class A — Separate Railway service `agent-avila-hermes`; Discord API egress only; token-storage discipline; account good-standing) |
| `orchestrator/handoffs/COMM-HUB-HERMES-STAGE5-PARTIAL-INSTALL-RECORD.md` | `69b3790…` | Stage 5 partial-install record; Steps 1–13 done; Steps 14–21 deferred; CONSUMED Gate-10 approval |
| `orchestrator/COMM-HUB-RULES.md` | `728f979…` | Communication Hub rulebook; per-message Codex pre-publish discipline |
| `orchestrator/handoffs/COMM-HUB-CHANNEL-LAYOUT.md` | `728f979…` | Channel/role/permission canonical matrix |
| `orchestrator/APPROVAL-GATES.md` | (per ARC-2) | Gate 10 (automation install / upgrade) RED-tier |
| `orchestrator/AUTOMATION-PERMISSIONS.md` | (per ARC-6) | GREEN/YELLOW/RED tiers; future-automation governance-only inheritance |
| `orchestrator/PROTECTED-FILES.md` | (per ARC-1) | SAFE / RESTRICTED / HARD BLOCK matrix |
| `orchestrator/HANDOFF-RULES.md` | (per ARC-7) | Forbidden-content list |
| `orchestrator/ROLE-HIERARCHY.md` | (per ARC-5) | Role boundaries; future-automation governance-only inheritance |

**Divergence rule:** if any §4–§18 design choice diverges from the above, the canonical files win and this design must be re-aligned. The design uses canonical wording verbatim wherever possible.

---

## §4 — Runtime architecture

**Process model:** single-instance, long-running daemon process. Runs as a single OS process in a single container; a single concurrent instance only (per Relay spec §"Anti-execution boundaries" item 13 line 154 — concurrent instances = halt class).

**Justification:** alternatives considered:

- **Serverless function (Lambda / Cloudflare Worker / Vercel):** rejected. Discord gateway requires a long-lived WebSocket connection (gateway `IDENTIFY` + `READY` per dry-run design §1 step 1); serverless cold-start + execution-time-limit model conflicts with maintaining the gateway connection for halt-on-anomaly responsiveness.
- **Scheduled task (cron-style):** rejected. Halt-on-anomaly requires immediate state machine response; cron's discrete-firing model can leave halted state ambiguous between fires; idempotency log races become harder.
- **Single-instance long-running daemon:** **selected**. Long-lived gateway connection; deterministic state machine; clean halt → log → exit lifecycle; matches Relay spec single-instance discipline (line 154); maps cleanly to a Railway service.

**State machine (high-level):**

```
                  ┌─────────────────┐
                  │      BOOT       │
                  └────────┬────────┘
                           │ (verify env, no forbidden vars,
                           │  load token, gateway IDENTIFY)
                           ▼
                  ┌─────────────────┐
                  │   READY (idle)  │◄────────────┐
                  └────────┬────────┘             │
                           │ (poll source-of-     │
                           │  truth message       │
                           │  store)              │
                           ▼                       │
                  ┌─────────────────┐             │
                  │ MESSAGE-PULLED  │             │
                  └────────┬────────┘             │
                           │ (run 11-gate         │
                           │  verification        │
                           │  pipeline)           │
                           ▼                       │
                ┌──────────┴──────────┐            │
                │                     │            │
                ▼                     ▼            │
       ┌────────────────┐    ┌────────────────┐   │
       │ ANY GATE FAILS │    │  ALL GATES OK  │   │
       └────────┬───────┘    └────────┬───────┘   │
                │                     │            │
                ▼                     ▼            │
       ┌────────────────┐    ┌────────────────┐   │
       │   HALT (log    │    │ HERMES_MODE    │   │
       │  anomaly id +  │    │   check:       │   │
       │  context;      │    │   dry_run vs   │   │
       │  exit; no auto │    │   production?  │   │
       │  resume)       │    └────────┬───────┘   │
       └────────┬───────┘             │            │
                │                     │            │
                ▼              ┌──────┴──────┐    │
       ┌────────────────┐      │             │     │
       │ EXIT 1         │      ▼             ▼     │
       │ (operator      │  ┌────────┐  ┌─────────┐│
       │  must restart) │  │ DRY    │  │ REAL    ││
       └────────────────┘  │ RUN    │  │ PUBLISH ││
                           │ (write │  │ (Discord││
                           │ would_ │  │ Send    ││
                           │ have_  │  │ Message ││
                           │ pub-   │  │ API)    ││
                           │ lished │  └────┬────┘│
                           │ log)   │       │     │
                           └────┬───┘       │     │
                                │           │     │
                                └─────┬─────┘     │
                                      ▼           │
                              ┌──────────────┐    │
                              │ APPEND TO    │    │
                              │ HERMES-      │    │
                              │ PRIVATE      │    │
                              │ PUBLISH LOG  │    │
                              └──────┬───────┘    │
                                     │            │
                                     └────────────┘
```

**Single-instance discipline:** boot-time check uses a host-side lock file (e.g., `/var/lock/hermes.pid`) or Railway-side single-replica config (single deployment slot). Concurrent boot detection → halt class "concurrent instance".

**Maps to requirements:** R1 (one-way), R15 (halt-on-anomaly), R20 (deployable separately).

---

## §5 — Language / framework choice

**Recommendation: Node.js + `discord.js` v14 (selected)** because discord.js v14 is the mature first-class Discord client for the operator's existing JavaScript/Node stack, keeps v1 implementation review in the same language family as the current project, and fits a small Node Alpine container with minimal dependencies. Rejected for v1: serverless, Python, Go, Rust.

### Comparison of alternatives

| Language | Discord library | Pros | Cons | Verdict |
|---|---|---|---|---|
| **Node.js** | `discord.js` (v14+) | Mature first-class Discord client; container ecosystem fit (Node Alpine ~50–80 MB image); operator's existing JS expertise (the trading runtime is `bot.js` / `dashboard.js`, so reviewer cycle stays in one language family); ecosystem packages for JSON Schema validation (Ajv), structured logging (pino), idempotency stores (better-sqlite3); async/await pattern maps cleanly to gate-pipeline + halt-on-anomaly state machine; minimal supply-chain surface area achievable with `npm ci --production --ignore-scripts` + locked dep set | npm dependency tree adds review burden (mitigated by minimal dep set + lock-file pinning + forbidden-deps enforcement) | **Selected** |
| Python | `discord.py` (v2.x) | Mature alternative; clean syntax; strong stdlib for hashing/JSON; comparable container size | Smaller ecosystem for Discord-specific features; operator's primary expertise is JS not Python (longer review cycle); async model less consistent than JS | Strong second |
| Go | `discordgo` | Single static binary; smallest container size (~10 MB); strongest type safety; minimal dep tree | Library less mature than `discord.js`; slower iteration for design changes; less operator familiarity | Rejected for v1; viable for future hardening |
| Rust | `serenity` | Maximum type safety; zero-cost abstractions; smallest runtime memory footprint | Highest implementation complexity; library maturity gap; longest implementation timeline | Rejected for v1 |
| Other (Elixir / Bun / Deno) | Various | Various | Less common Discord ecosystem; harder Codex code review | Rejected for v1 |

### Specific runtime version + library version recommendation

- **Node.js:** version 20 LTS or 22 LTS (whichever is current LTS at implementation time). NOT the same Node version as `agent-avila-dashboard` (which runs Node 24 per `.nvmrc`) — Relay runs separately and has independent version policy.
- **discord.js:** version 14.x (current major as of design time). Pin to exact patch version in `package-lock.json` of the Relay repo; never use `^` or `~` semver ranges in production.
- **Other dependencies (minimum set):**
  - `ajv` (JSON Schema validation) — pinned exact version
  - `pino` (structured JSON logging) — pinned exact version
  - `better-sqlite3` (idempotency store; alternative: file-based JSONL) — pinned exact version
  - No other dependencies. No HTTP frameworks (Express/Fastify) — Relay does not expose any HTTP server. No additional Discord libraries. No LLM SDKs. No `dotenv` (env vars come from Railway, not from `.env` files).

### Forbidden dependencies (defense-in-depth)

The Relay runtime MUST NOT depend on any of the following packages, even transitively:

- **Exchange / trading clients (R7, R8):** `kraken-api`, `node-kraken-api`, `ccxt`, `coinbase*`, `binance*`, any other exchange or trading API client.
- **Database libraries (R9):** `pg`, `mysql`, `mongoose`, `sequelize`, `prisma`, `knex`, any other DB ORM/driver.
- **Cloud-provider SDK families:** `aws-sdk` (v2 monolith), `@aws-sdk/*` (v3 modular), `@google-cloud/*`, `google-auth-library`, `@azure/*`, plus any cloud-provider CLI wrapped as an npm package.
- **Source-control / CI/CD / deploy SDKs:** `@octokit/*`, GitHub Actions client packages, Railway client SDKs or CLIs, CircleCI / Travis / GitLab client packages.
- **Env loading from disk:** `dotenv`, `dotenv-expand`, `dotenv-cli` — Relay does NOT load `.env` files; env vars come from Railway secret store directly.
- **Browser automation:** `puppeteer`, `playwright` (no use case; halt-on-anomaly target).
- **Outbound non-Discord communication:** `nodemailer`, `twilio`, `@sendgrid/*`, etc. (R7, R10).
- **LLM SDKs:** `openai`, `@anthropic-ai/sdk`, `@google/generative-ai`, any other LLM provider SDK (R12).

**Enforcement:** the Relay repo's `package.json` is reviewed by Codex at every implementation phase commit; an automated pre-commit / CI check can grep `package.json` and `package-lock.json` for forbidden package names and reject the commit if any appear.

**Maps to requirements:** R7, R8, R9, R10, R11, R12, R20, R21.

---

## §6 — Code location

**Recommendation: separate operator-controlled GitHub repository `relentlessvic/agent-avila-hermes` (or operator-chosen equivalent name).**

### Comparison of alternatives

| Location | Pros | Cons | Verdict |
|---|---|---|---|
| **Separate repo `relentlessvic/agent-avila-hermes`** | Relay container has no git checkout of trading-runtime files (per Relay spec line 145 — "Relay does not have a git checkout"); strongest code-level isolation; independent deploy pipeline; independent commit history; independent review cadence; trivially auditable that Relay never imports trading-runtime code | Operator manages a second repo; second `.gitignore`, second README, second package.json | **Selected** |
| `hermes/` directory in `relentlessvic/agent-avila` | Single repo; convenient; one PR for any cross-cutting docs change | **REJECTED**: Relay container deployed from `relentlessvic/agent-avila` would have a git checkout of `bot.js`, `dashboard.js`, `db.js`, `migrations/`, `scripts/`, `position.json`, `.env*` (R12). Even if Railway build skips them, the source repo connection violates "no git checkout of trading runtime files." | Rejected |
| Monorepo with explicit `.gitignore` filters | Theoretically possible | Discord application + Railway deploy still ties `agent-avila-hermes` Railway service back to the `agent-avila` repo; auditability gets harder; one `git pull` exposes trading code to the Relay host | Rejected |
| Subtree split | Possible but adds tooling complexity; doesn't solve the core "Relay container has trading-runtime files in its image build context" problem | Rejected |

**Selected: separate repo `relentlessvic/agent-avila-hermes`.** This is the strongest physical isolation. The Relay container's git checkout (if any) is the Relay repo only; trading-runtime files are simply not present in any code path Relay can reach.

### Repository structure (proposed for the future implementation phase)

```
relentlessvic/agent-avila-hermes/
├── README.md                       (canonical Relay runtime README; non-secret)
├── LICENSE                         (operator preference)
├── .gitignore                      (excludes node_modules, *.log, *.local, .env*, /tmp)
├── package.json                    (minimal deps; NO trading deps; NO LLM SDKs)
├── package-lock.json               (committed; exact pinned versions)
├── tsconfig.json                   (if TypeScript chosen for type safety)
├── src/
│   ├── index.js                    (entry point; boot → state machine)
│   ├── config.js                   (env-var validation; forbidden-var detection at boot)
│   ├── gateway.js                  (Discord gateway client wrapper; IDENTIFY+READY only)
│   ├── publish.js                  (publish path; dry-run branch; Send Message API call)
│   ├── verify/                     (11-gate verification pipeline)
│   │   ├── schema.js
│   │   ├── channel-allowlist.js
│   │   ├── codex-pass.js
│   │   ├── operator-auth.js
│   │   ├── idempotency.js
│   │   ├── ceiling-pause.js
│   │   ├── placeholder.js
│   │   ├── char-limit.js
│   │   ├── network-anomaly.js
│   │   ├── forbidden-content.js
│   │   └── dry-run-flag.js
│   ├── halt.js                     (halt-on-anomaly state machine; log + exit; no auto-resume)
│   ├── store/
│   │   ├── source-of-truth.js      (read-only message-store reader)
│   │   ├── publish-log.js          (Relay-private append-only publish log)
│   │   └── dry-run-log.js          (would_have_published log writer)
│   └── log.js                      (structured JSON logger; pino; secret redaction)
├── schemas/
│   └── hermes-message.schema.json  (JSON Schema for incoming messages)
├── tests/
│   ├── verify.test.js              (unit tests for each gate)
│   ├── halt.test.js                (halt-on-anomaly tests; injected anomalies)
│   └── dry-run.test.js             (dry-run mode tests; no real Send Message)
├── Dockerfile                      (Node 20/22 LTS Alpine; non-root user; minimal layers)
├── railway.json                    (Railway service config; no shared env with agent-avila-dashboard)
└── docs/
    └── ARCHITECTURE.md             (architecture overview; cross-references back to canonical Relay spec)
```

**Forbidden in this repo (forever):**

- Any trading-runtime file (`bot.js`, `dashboard.js`, `db.js`, `migrations/`, `scripts/`, `package.json` of the trading runtime, lockfiles of the trading runtime, `.nvmrc` of the trading runtime, `.env*` containing trading secrets, `position.json`).
- Any orchestrator safety-policy doc (`COMM-HUB-RELAY-RULES.md`, `COMM-HUB-RULES.md`, etc. — those stay canonical in `relentlessvic/agent-avila`).
- Any secret value (`.env*` committed; bot tokens; API keys; etc.).
- Any LLM-SDK dependency.

### Repo creation NOT authorized by this design phase

**Important:** creating the new GitHub repo `relentlessvic/agent-avila-hermes` is itself an operator-side action that requires its own scope discussion. The future implementation phase would propose repo creation as part of its scope; this design phase only **recommends** the repo location and structure.

**Maps to requirements:** R12, R20, R21.

---

## §7 — Deployability

**Relay deploys from `relentlessvic/agent-avila-hermes` to the existing `agent-avila-hermes` Railway service** (provisioned in Stage 5 Step 7.1; populated with `DISCORD_BOT_TOKEN` in Step 7.2).

### Build process

1. Operator commits to `relentlessvic/agent-avila-hermes` repo `main` branch.
2. Railway-side GitHub-tracked deploy picks up the commit (operator-configurable; can also be manual `railway up`).
3. Railway builds the Docker image per `Dockerfile`:
   - Base: `node:20-alpine` (or `node:22-alpine` per Node LTS) — Alpine for minimal attack surface.
   - Add a non-root non-privileged user (`USER node`).
   - `COPY package.json package-lock.json ./` then `RUN npm ci --production --ignore-scripts` (no devDependencies; no postinstall hooks).
   - `COPY src/ ./src/` and `COPY schemas/ ./schemas/`.
   - `EXPOSE` no ports (Relay is one-way publisher; no HTTP server).
   - `CMD ["node", "src/index.js"]`.
4. Railway deploys the image to the `agent-avila-hermes` service.
5. Service boots Relay process; reads `DISCORD_BOT_TOKEN` env var; performs gateway IDENTIFY + READY; enters READY state.

### Independent deploy pipeline (separation from `agent-avila-dashboard`)

| Surface | `agent-avila-dashboard` (trading runtime) | `agent-avila-hermes` (Relay) |
|---|---|---|
| GitHub repo | `relentlessvic/agent-avila` | `relentlessvic/agent-avila-hermes` |
| Railway service id | `agent-avila-dashboard` (or operator-chosen equivalent) | `agent-avila-hermes` |
| Railway env scope | trading env (`DATABASE_URL`, `KRAKEN_API_KEY`, `KRAKEN_API_SECRET`, `MANUAL_LIVE_ARMED`, etc.) | Relay env (`DISCORD_BOT_TOKEN`, plus any logging/store-path env from §8) |
| Build trigger | trading repo push | Relay repo push |
| Build pipeline | Nixpacks v1.41.0 + Node 24 (per current Migration 008 deployment context) | Docker (custom Dockerfile in Relay repo) + Node 20/22 LTS |
| Deploy commit SHA | trading repo HEAD | Relay repo HEAD |
| Deploy concurrency | independent — can deploy trading runtime without redeploying Relay and vice versa | independent |

**Cross-deploy isolation guarantee:** the two Railway services share Railway's project-level account but no env vars, no code, no deploy pipeline, no source repo. A push to `relentlessvic/agent-avila` does NOT trigger Relay redeploy; a push to `relentlessvic/agent-avila-hermes` does NOT trigger trading-runtime redeploy.

### Deployment trigger (operator-controlled)

The Relay Railway service's GitHub-tracked deploy can be configured (operator preference):

- **Auto-deploy on push to `main`:** convenient but means every Relay commit deploys. Recommended only after the runtime is stable (post-Stage-7 dry-run + post-Stage-8 draft-only-mode passes).
- **Manual deploy via `railway up`:** safer; each deploy is an explicit operator action. Recommended for the first ~3–5 deployment cycles.
- **GitHub-tracked deploy with manual approval gate:** middle ground; commit lands on `main` but Railway pauses until operator approves the deploy in dashboard. Recommended pattern for the implementation phase.

**Each deploy of the Relay runtime is a separately operator-approved action** per `orchestrator/APPROVAL-GATES.md` Gate 5 (deploy gate) + Gate 10 (automation install/upgrade if Relay capability changes between deploys). Not authorized by this design phase.

**Maps to requirements:** R20, R21.

---

## §8 — Allowed environment variables (full enumeration)

Relay runtime reads exactly these env vars — and no others — from the Railway service's secret/env store. Any boot-time presence of an env var not in this allow-list (or absence of a required one) → halt class "forbidden env var present" or "required env var missing".

| Env var | Type | Source | Purpose | Validation rules |
|---|---|---|---|---|
| `DISCORD_BOT_TOKEN` | secret | Railway secret variable (already populated in Stage 5 Step 7.2) | Authenticate Relay to Discord gateway | Must be non-empty; must match Discord bot token format (regex check); never logged in plain text |
| `HERMES_MODE` | non-secret | Railway env variable (operator-set) | `production` \| `dry_run` | Must be exactly one of the two values; halt on any other value |
| `LOG_LEVEL` | non-secret | Railway env variable (operator-set) | `debug` \| `info` \| `warn` \| `error` | Must be one of four; defaults to `info` |
| `LOG_DESTINATION` | non-secret | Railway env variable (operator-set) | `stdout` \| `file:/path/to/log` (host-side path) | Must match one of two formats; halt on invalid |
| `MESSAGE_STORE_PATH` | non-secret | Railway env variable (operator-set) | Path to the source-of-truth append-only message store (read-only by Relay) | Must be an absolute filesystem path; must exist; must be readable by the Relay process user; halt on missing/unreadable |
| `PUBLISH_LOG_PATH` | non-secret | Railway env variable (operator-set) | Path to the Relay-private append-only publish log (write-only-append by Relay) | Must be an absolute filesystem path; must be writable; must be append-only (Relay never seeks/truncates); halt on missing/unwritable |
| `DRY_RUN_LOG_PATH` | non-secret | Railway env variable (operator-set; required when `HERMES_MODE=dry_run`) | Path to the dry-run `would_have_published` log; SEPARATE from `PUBLISH_LOG_PATH` | Must be an absolute filesystem path; must be different from `PUBLISH_LOG_PATH`; halt on collision |
| `CEILING_PAUSE_SIGNAL_PATH` | non-secret | Railway env variable (operator-set) | Path to a controlled signal file that indicates CEILING-PAUSE state (`ACTIVE` / `BROKEN`) | Must be readable; must contain exactly `ACTIVE` or `BROKEN`; halt on `ACTIVE` per Relay spec line 149 |
| `HERMES_VERSION` | non-secret | Railway env variable (set by build/CI; non-secret) | The Relay runtime version identifier (e.g., `1.0.0` or git commit SHA short form) | Logged at boot; not validated beyond "non-empty" |

**Total: 9 allowed env vars.** Seven are non-secret. One is the bot token (secret). One is build-time identifier (non-secret).

### Boot-time env var validation

At process boot, Relay runs an explicit env-var validation step (in `src/config.js`):

1. Verify all 8 baseline required env vars are present (or 9 if `HERMES_MODE=dry_run` requires `DRY_RUN_LOG_PATH`).
2. Validate each var's format per the rules above.
3. Verify NO forbidden env var is present (see §9).
4. Halt-on-anomaly if any check fails.

### What allowed env vars do NOT include

- `DATABASE_URL` (R9) — forbidden.
- `KRAKEN_API_KEY` / `KRAKEN_API_SECRET` (R8) — forbidden.
- `MANUAL_LIVE_ARMED` (R11) — forbidden.
- Any dashboard credential (R10) — forbidden.
- Any GitHub token, Railway API token (beyond what Railway provides for service self-management), CI/CD secret — forbidden.
- Any LLM API key — forbidden.
- Any third-party service credential.

**Maps to requirements:** R8, R9, R10, R11, R12, R19, R21.

---

## §9 — Forbidden environment variables (full enumeration)

Relay MUST NOT have any of the following env vars present at runtime. Their presence at boot triggers halt-on-anomaly class "forbidden env var present at boot".

| Forbidden env var | Reason |
|---|---|
| `DATABASE_URL` | Production DB credential (R9); Relay has zero DB access |
| `DATABASE_PUBLIC_URL` | Same as above |
| `POSTGRES_*` (any var starting with `POSTGRES_`) | DB credential variants |
| `PGUSER`, `PGPASSWORD`, `PGHOST`, `PGPORT`, `PGDATABASE` | libpq env vars |
| `KRAKEN_API_KEY` | Trading API credential (R8) |
| `KRAKEN_API_SECRET` | Trading API credential (R8) |
| `KRAKEN_*` (any var starting with `KRAKEN_`) | Trading API variants |
| `MANUAL_LIVE_ARMED` | Live-trading arm flag (R11); Relay has zero trading authority |
| `BOT_*` (any var related to trading bot) | Dashboard/trading runtime credential (R10) |
| `DASHBOARD_*` | Dashboard runtime credential (R10) |
| `GITHUB_TOKEN` | GitHub API credential beyond what Railway needs |
| `RAILWAY_TOKEN` (beyond what Railway service uses for self-management) | Railway control-plane credential |
| `CI`, `CIRCLE_*`, `TRAVIS_*`, `GITHUB_ACTIONS`, `GITLAB_CI` | CI/CD context (Relay runs in production, not CI) |
| `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GOOGLE_API_KEY`, `GEMINI_API_KEY` | LLM API credentials |
| `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` | Cloud provider credentials |
| `GCP_*`, `GOOGLE_APPLICATION_CREDENTIALS` | Google Cloud credentials |
| `AZURE_*` | Azure credentials |
| `STRIPE_*`, `TWILIO_*`, `SENDGRID_*` | Other-service credentials |
| Any var containing `_KEY`, `_SECRET`, `_PASSWORD`, `_TOKEN` (other than the allow-listed `DISCORD_BOT_TOKEN`) | Heuristic catch-all for credential-like patterns |

### Enforcement

1. **Railway-side env scope:** the `agent-avila-hermes` Railway service has its own env scope. None of the trading-runtime env vars are inherited by default (per Railway's per-service env model). Operator verifies at install time (Stage 5 Step 14) that no trading vars leak into the Relay service.
2. **Boot-time runtime check:** Relay startup code (in `src/config.js`) iterates over `process.env` and flags any var matching the forbidden list. Halt-on-anomaly if any forbidden var is present.
3. **Codex review at implementation phase:** Codex code review verifies that the runtime never reads from any forbidden env var path even if one were accidentally set.

**Maps to requirements:** R7, R8, R9, R10, R11, R12, R21.

---

## §10 — Network allowlist enforcement

**Allowed egress (full enumeration):**

| Endpoint class | Specific hostname(s) | Purpose |
|---|---|---|
| Discord gateway | `gateway.discord.gg` (and any Discord-published gateway endpoint at deploy time; resolved via Discord's `Get Gateway Bot` REST endpoint at boot) | Relay gateway IDENTIFY + READY (one-way; receives no message events) |
| Discord REST API | `discord.com` (specifically `discord.com/api/v10/...` REST paths) | Relay `Send Message` calls when `HERMES_MODE=production`; `View Channels` channel-list inspection (read-only metadata, NOT message content) |
| DNS resolver | Operator-configured (Railway-provided default) | Resolve Discord hostnames |
| TLS / certificate-authority validation | Operator-configured CA bundle | Verify Discord TLS certificates |

**Forbidden egress (full enumeration; halt-on-anomaly target):**

- Kraken API (any subdomain, any port).
- Production DB host (`agent-avila-dashboard`'s DB or any other Postgres/MySQL/etc. host).
- Railway control-plane endpoints (`railway.app`, `backboard.railway.app`, etc.) beyond what Railway needs for its own service self-management.
- GitHub API (`api.github.com`, `github.com`).
- CI/CD provider endpoints.
- Other LLM provider endpoints (OpenAI, Anthropic, Google, etc.).
- Other Discord servers' webhook URLs (the literal pattern of webhook URLs is operator-known; the runtime never constructs or calls webhook URLs).
- Any other arbitrary internet endpoint.

### Enforcement layers (defense-in-depth, three layers)

**Layer 1 — Railway-side firewall / network policy.** Per Stage 5 preconditions §6 and the operator's Stage 5 approval (`ENFORCEMENT_LAYER = Railway-side firewall / network policy`), Railway's network-policy / private-networking config restricts the `agent-avila-hermes` service's egress to Discord API endpoints only. Any non-allow-listed egress attempt is dropped at the Railway/network layer.

**Layer 2 — Runtime-side HTTP client allowlist hooks.** Relay wraps its HTTP client (the one `discord.js` uses internally) with an allowlist hook. Before any outbound HTTP request, the runtime checks the destination hostname against the allowed list:

```
allowedHostnames = ['gateway.discord.gg', 'discord.com', /* any Discord-published variants */]
```

Any request to a non-allowed hostname → halt-on-anomaly class "non-allow-listed egress attempt" → log + exit. The runtime intercept is BEFORE `discord.js` makes the actual HTTP call; it cannot leak even if an upstream library bug somehow tried to call a different endpoint.

**Layer 3 (defense in depth, optional) — outbound-DNS observation.** Relay can be configured to log every DNS lookup (via `dns.lookup` instrumentation). Any lookup for a non-allow-listed hostname → halt. This catches subtle code paths that bypass Layer 2.

### Verification at deployment time (future Stage 5 resumption work)

- Operator verifies the Railway-side firewall config is in place.
- Operator runs a smoke-test (Stage 5 Step 18) that includes attempting to reach a forbidden endpoint (e.g., `agent-avila-dashboard`'s public URL or Kraken's public API) and verifies Relay halts cleanly.
- Operator inspects the runtime config's `allowedHostnames` list to confirm it's hard-coded and matches the canonical Discord endpoints.

**Maps to requirements:** R8, R9, R10, R11, R12, R15, R21.

---

## §11 — Message ingress (how Relay receives messages without reading Discord)

**Recommendation: file-based append-only source-of-truth message store on the Relay host.**

### How Relay gets messages to publish (without reading Discord)

The operator (Victor) drafts a message via the orchestrator (Claude). The drafted message gets:
1. Codex pre-publish sanity-check PASS (per `COMM-HUB-RULES.md` per-message gate).
2. Operator in-session per-message authorization (Stage 9) or class authorization (Stage 10a/10b with 7 documented bounds).
3. Persisted into the Relay source-of-truth message store as a JSON file with all metadata.

Relay polls or watches the source-of-truth message store and pulls newly-added messages. **Relay never reads Discord** to know what to publish. The source-of-truth is the canonical list of "what Relay should publish next"; Relay only consumes from there.

### Source-of-truth message store — implementation options

| Option | Pros | Cons | Verdict |
|---|---|---|---|
| **A. Append-only directory of JSON files (one file per message)** | Simplest; trivially auditable (each file is a complete record); easy to operator-edit (write a JSON file, save); easy to back up; matches "append-only" discipline (operator never edits a file in place; new messages = new files); idempotency via filename = `message_id` | Polling overhead; race conditions if operator writes while Relay reads (mitigated by atomic-write pattern: write to `.tmp` then rename) | **Selected** |
| B. SQLite database with append-only table | Strong typing; transactions; easy queries | More implementation complexity; SQLite file is binary (less auditable than JSON files); tooling overhead | Rejected |
| C. JSONL append-only file (one line per message) | Single file; easy to tail | Concurrent-write races require file locking; harder to operator-edit one message; harder to track which messages have been processed | Rejected |
| D. Git-tracked file in Relay repo | Built-in audit trail (git log) | Relay container would need git access; ties Relay to GitHub deploy cycle for every new message; halt-on-anomaly during git fetch; operationally awkward | Rejected |
| E. External message queue (RabbitMQ / Redis / etc.) | Built for ingress | Adds another hosted service; increases attack surface; halt-on-anomaly across two services is more complex; overkill for current scale | Rejected for v1 |
| F. Discord-side store (forbidden) | n/a | **VIOLATES R2, R3** — Relay would have to read Discord, which is forbidden | **REJECTED — forbidden by design requirements** |

**Selected: Option A — directory of JSON files.**

### Source-of-truth directory layout (proposed for the future implementation phase)

```
$MESSAGE_STORE_PATH/
├── pending/                                  (messages Relay hasn't yet processed)
│   ├── 2026-05-06T10-30-00Z-msg-001.json
│   ├── 2026-05-06T10-31-00Z-msg-002.json
│   └── ...
├── processed/                                (messages Relay has processed; Relay moves files here after publish or halt)
│   ├── 2026-05-06T10-25-00Z-msg-000.json
│   └── ...
└── README.md                                 (describes the schema; non-secret)
```

Relay process flow:
1. Periodically poll `$MESSAGE_STORE_PATH/pending/` for new files.
2. For each new file: read the JSON, run the 11-gate verification, publish (or dry-run-log) or halt.
3. After processing: atomically move the file to `$MESSAGE_STORE_PATH/processed/`.
4. Append a record to `$PUBLISH_LOG_PATH` (or `$DRY_RUN_LOG_PATH` if dry-run) with the outcome.

### Operator's path to add a message

Operator writes a JSON file matching the schema (§12) to the `pending/` directory. The file's name encodes the timestamp + a short id for human readability. The file's content is the canonical message record. The file is read-only after creation (operator never edits in place).

If the operator decides not to publish a pending message, the operator removes it from `pending/` (e.g., moves it to a separate `cancelled/` directory). The operator does NOT edit the file in place.

### Relay' read access

Relay' filesystem permissions on `$MESSAGE_STORE_PATH`:
- **Read** access on `$MESSAGE_STORE_PATH/pending/`.
- **Move** access (rename within filesystem) from `$MESSAGE_STORE_PATH/pending/` to `$MESSAGE_STORE_PATH/processed/`.
- **No** write access in `$MESSAGE_STORE_PATH/pending/` (cannot create new files there — only the operator adds messages).
- **Append** access to `$PUBLISH_LOG_PATH` and `$DRY_RUN_LOG_PATH` (write-only-append; never seek/truncate).

This filesystem permission set means: Relay cannot inject its own messages, cannot tamper with pending messages, cannot delete processed messages without leaving a trace. The source-of-truth is operator-controlled.

**Maps to requirements:** R1, R2, R3, R4, R17.

---

## §12 — Message format / schema

**Strict JSON Schema enforced at message-ingest and pre-publish time.** Relay rejects (halts) on any schema mismatch.

### Schema (informal description; the formal schema lives in `schemas/hermes-message.schema.json` in the implementation phase)

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "Relay Message",
  "type": "object",
  "additionalProperties": false,
  "required": [
    "message_id",
    "channel_id",
    "channel_name",
    "body",
    "codex_pass_verdict_ref",
    "operator_authorization",
    "allowed_placeholder_map",
    "halt_on_condition_flags",
    "dry_run"
  ],
  "properties": {
    "message_id": {
      "type": "string",
      "pattern": "^[A-Z][A-Z0-9-]{4,63}$",
      "description": "Globally unique idempotency key. Operator-generated. Pattern: PHASE-<short>-<counter>."
    },
    "channel_id": {
      "type": "string",
      "pattern": "^[0-9]{17,20}$",
      "description": "Discord channel snowflake id. MUST be one of the 3 allowed channels."
    },
    "channel_name": {
      "type": "string",
      "enum": ["#status", "#summaries", "#system-health"],
      "description": "Human-readable channel name. MUST match the resolved channel_id."
    },
    "body": {
      "type": "string",
      "minLength": 1,
      "maxLength": 2000,
      "description": "Message body text. Plain-text only. Subject to allow-listed-placeholder substitution."
    },
    "codex_pass_verdict_ref": {
      "type": "object",
      "additionalProperties": false,
      "required": ["verdict", "review_id", "reviewed_at"],
      "properties": {
        "verdict": { "type": "string", "enum": ["PASS"] },
        "review_id": { "type": "string", "minLength": 1 },
        "reviewed_at": { "type": "string", "format": "date-time" }
      }
    },
    "operator_authorization": {
      "type": "object",
      "additionalProperties": false,
      "oneOf": [
        {
          "title": "Per-message authorization (Stage 9 and earlier)",
          "required": ["mode", "approver", "approved_at", "approval_session_ref"],
          "properties": {
            "mode": { "type": "string", "enum": ["per-message"] },
            "approver": { "type": "string", "enum": ["Victor"] },
            "approved_at": { "type": "string", "format": "date-time" },
            "approval_session_ref": { "type": "string", "minLength": 1 }
          }
        },
        {
          "title": "Class authorization (Stage 10a/10b only)",
          "required": ["mode", "class_ref", "bounds"],
          "properties": {
            "mode": { "type": "string", "enum": ["class-authorization"] },
            "class_ref": { "type": "string", "minLength": 1 },
            "bounds": {
              "type": "object",
              "additionalProperties": false,
              "required": ["channel", "template_id", "allowed_event_types", "max_count", "expiration", "revocation_rule", "forbidden_content_constraints"],
              "properties": { "...": "..." }
            }
          }
        }
      ]
    },
    "allowed_placeholder_map": {
      "type": "object",
      "additionalProperties": false,
      "patternProperties": {
        "^<[A-Z][A-Z0-9_ ]*>$": {
          "type": "string",
          "enum": ["UTC_DATE_AT_PUBLISH_TIME", "UTC_TIME_AT_PUBLISH_TIME", "PHASE_ID", "COMMIT_SHA"]
        }
      },
      "description": "Map of allowed-placeholder names (in body) to substitution sources. Relay rejects bodies with placeholders not in this map."
    },
    "halt_on_condition_flags": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "ceiling_pause_must_be_active": { "type": "boolean", "const": true },
        "additional_halts": { "type": "array", "items": { "type": "string" } }
      }
    },
    "dry_run": {
      "type": "boolean",
      "description": "If true, Relay routes through the dry-run path even if HERMES_MODE=production. If HERMES_MODE=dry_run and dry_run=false, halt class 'dry_run flag mismatch'."
    }
  }
}
```

### Schema enforcement points

1. **At message ingest** (when Relay reads a file from `$MESSAGE_STORE_PATH/pending/`): validate against the schema. Halt class "schema mismatch" if invalid.
2. **At publish time** (re-validate immediately before the publish branch): verify nothing has changed since ingest. Halt if validation fails.

**Maps to requirements:** R5, R6, R12, R13, R14, R17, R19.

---

## §13 — Per-message validation (full pre-publish gate sequence)

Before any publish (real or dry-run), Relay runs **11 verification gates** in order. Any single gate failure → halt-on-anomaly → no publish, no `would_have_published` log entry, exit process.

| # | Gate | What is verified | Halt class on failure |
|---|---|---|---|
| 1 | Schema validity | Message matches the JSON Schema in §12 byte-for-byte | "schema mismatch" |
| 2 | Channel allow-list | `channel_id` resolves to one of `#status`, `#summaries`, `#system-health`; `channel_name` matches `channel_id` | "channel not in allow-list" |
| 3 | Codex PASS metadata | `codex_pass_verdict_ref.verdict` = `"PASS"`; `review_id` non-empty; `reviewed_at` not stale beyond a configurable threshold (e.g., 30 days) | "missing or stale Codex PASS metadata" |
| 4 | Operator authorization | `operator_authorization.approver` = `"Victor"`; `approved_at` not stale; `approval_session_ref` non-empty; OR (Stage 10a/10b only) `class_ref` valid + `bounds` complete with all 7 documented bounds | "missing, expired, exhausted, or out-of-scope operator authorization" |
| 5 | Idempotency | `message_id` not already in `$PUBLISH_LOG_PATH` with `outcome=success`; `message_id` not currently being processed (in-process lock) | "idempotency-key mismatch / collision / reuse / unverifiable" |
| 6 | CEILING-PAUSE | Read `$CEILING_PAUSE_SIGNAL_PATH`; content must be `ACTIVE` (not `BROKEN`); `halt_on_condition_flags.ceiling_pause_must_be_active === true` | "CEILING-PAUSE state ACTIVE detected" (per Relay spec line 149 — "halts during it") |
| 7 | Allow-listed-placeholder substitution | Every placeholder pattern (e.g., `<UTC_DATE>`) in `body` is present in `allowed_placeholder_map`; substitute using the substitution sources (current UTC date/time, etc.); reject any placeholder NOT in the map | "allow-listed-placeholder violation" |
| 8 | Character / rate limit | Post-substitution `body` ≤ 2000 chars (Discord limit); also ≤ per-channel rate cap (5 messages per phase for `#status`, etc.) | "character-limit exceeded" or "rate-limit hit" |
| 9 | Network allow-list / egress-anomaly verification | Verify the runtime-side allowlist hook is active and intact (Layer 2 of §10); confirm the most recent egress event log shows only Discord-API hostnames; if any non-allow-listed egress is recorded since last check or if the hook itself is missing, fail. | "network anomaly (egress to non-allow-listed endpoint)" (per Relay spec line 148 canonical halt class 6) |
| 10 | Forbidden-content scan | Body does not contain any pattern from `orchestrator/HANDOFF-RULES.md` + `orchestrator/COMM-HUB-RULES.md` forbidden lists (no secrets, no env values, no Kraken/DB/Railway data, no `MANUAL_LIVE_ARMED`, no `position.json` fragments, no approval-like language not from Victor, etc.) | "forbidden-content scan trip" |
| 11 | `dry_run` flag consistency | If `HERMES_MODE=dry_run`, the message MUST have `dry_run=true`; if `HERMES_MODE=production`, message MAY have either value but `dry_run=true` routes through the dry-run path | "dry_run flag mismatch" |

### Gate-9 (network anomaly) rationale

The canonical Relay spec lists "network anomaly (egress to non-allow-listed endpoint)" as halt class 6 at line 148. Layer 2 enforcement (runtime-side HTTP client allowlist hook) is described in §10, but a per-message verification gate makes the check explicit at every publish attempt — defense-in-depth. The gate inspects the runtime-side egress event log (a small in-memory ring buffer of recent outbound HTTP destinations); any non-allow-listed entry since the last successful publish triggers halt class 6 before the current message can be published.

### Order rationale

Gates run in the order above because:
- Gate 1 (schema) is cheapest and must come first to ensure subsequent gates can read the message safely.
- Gate 2 (channel allow-list) is next because it's the simplest semantic check; failing fast.
- Gates 3, 4 (Codex + operator auth) are the cryptographic-integrity-style gates; they prove the message is approved.
- Gate 5 (idempotency) is the global-state check.
- Gate 6 (CEILING-PAUSE) is the runtime-state check.
- Gates 7, 8 (placeholder, char-limit) are body-content checks that depend on substitution.
- Gate 9 (network anomaly) verifies the egress isolation surface is intact BEFORE we attempt any outbound HTTP — the Send Message API call would itself be an outbound HTTP, so this gate confirms the allowlist is healthy first.
- Gate 10 (forbidden-content) runs on the substituted body.
- Gate 11 (dry_run flag) is the final routing decision before the publish branch.

### After all 11 gates PASS

Relay routes:
- If `HERMES_MODE=production` AND `dry_run=false`: real `Send Message` API call. On success: append `outcome=success` to `$PUBLISH_LOG_PATH` with `message_id` + `channel_id` + timestamp; move file to `$MESSAGE_STORE_PATH/processed/`. On failure (network anomaly, Discord rate limit, etc.): halt class "publish-attempt-failed".
- If `HERMES_MODE=dry_run` OR `dry_run=true`: write `would_have_published` entry to `$DRY_RUN_LOG_PATH` with the full message. Move file to `$MESSAGE_STORE_PATH/processed/`. Do NOT write to `$PUBLISH_LOG_PATH` (that's reserved for real publishes only).

**Maps to requirements:** R5, R6, R12, R13, R14, R15, R16, R17, R19.

---

## §14 — Idempotency mechanism

**Relay-private append-only publish log + orchestrator-side `message_id` keys. NO Discord-side reads for deduplication.**

### Mechanism

1. Each message has a globally unique `message_id` (operator-generated; uniqueness operator-enforced).
2. `$PUBLISH_LOG_PATH` is an append-only file; format JSONL (one line per record); each record:
   ```
   {
     "message_id": "...",
     "channel_id": "...",
     "outcome": "success" | "halt:<halt-class>",
     "timestamp": "...",
     "process_pid": ...,
     "hermes_version": "..."
   }
   ```
3. Before each publish, Relay reads the entire publish log and builds an in-memory index of `message_id` → outcome.
4. If the current message's `message_id` exists in the index with `outcome=success` → halt class "idempotency: duplicate publish attempt".
5. After successful publish, append the new record.

### Why this beats alternatives

- **No Discord-side reads.** Relay never calls `Get Channel Messages` or any Discord-side read endpoint. The Relay-private log is the sole source of truth for "have we already published this?". This satisfies R2, R3, R4.
- **Operator-auditable.** The publish log is plain JSONL on the host filesystem; the operator can `cat` it to see every publish attempt.
- **No concurrent-write races.** Relay is single-instance; only one process appends at a time. If a future change introduces concurrency, append-with-O_APPEND atomic semantics hold for line-sized writes.
- **Halt-on-anomaly compatible.** If the publish-log file is missing, unreadable, or corrupted at boot, halt class "publish log unverifiable" fires; operator must restore before Relay can resume.

### What if `message_id` collisions occur

Two cases:
- **Operator-generated collision (operator error):** if the operator generates a duplicate `message_id` for two different messages, Relay halts on the second one. The operator must rename the second message and re-add it.
- **Process-restart with same `message_id` mid-publish:** if Relay crashed during a publish (between Send Message API call and log append), a restart sees the prior `message_id` not in the log and tries to re-publish. **Mitigation:** Relay uses Discord's idempotency hint via the `nonce` field on the Send Message API call. If Discord recognizes the same `nonce` within a short window, it dedupes server-side.

### Verification at runtime

- `$PUBLISH_LOG_PATH` write permissions: append-only (Relay process user has `O_APPEND` only; not `O_TRUNC` or `O_RDWR`).
- File integrity check at boot: read the entire log; verify each line is valid JSON; halt on corruption.
- `message_id` uniqueness check: at message-ingest time (when operator drops a file into `$MESSAGE_STORE_PATH/pending/`), Relay verifies the `message_id` is not already in the publish log AND not already in another pending file.

**Maps to requirements:** R1, R2, R3, R16.

---

## §15 — Halt-on-anomaly state machine

**Total halt classes: 28.** Composed of three layers:

### Layer 1: 10 canonical halt classes (from `COMM-HUB-RELAY-RULES.md`)

Per the corrected halt model in `orchestrator/handoffs/COMM-HUB-HERMES-DRY-RUN-DESIGN.md` §7 (multi-section sourced from `COMM-HUB-RELAY-RULES.md` lines 148, 149, 154, 178):

1. Missing or stale Codex PASS metadata
2. Missing/expired/exhausted/out-of-scope operator authorization metadata
3. Channel not in allow-list
4. Character-limit exceeded
5. Rate-limit hit
6. Network anomaly (egress to non-allow-listed endpoint)
7. Idempotency-key mismatch / collision / reuse / unverifiable
8. CEILING-PAUSE state ACTIVE
9. Concurrent-Relay-instance detected
10. Class-authorization bounds violation (Stage 10a/10b — incl. forbidden-content scan trip via bound 7)

### Layer 2: 9 dry-run-specific halt classes (from `COMM-HUB-HERMES-DRY-RUN-DESIGN.md`)

11. `HERMES_MODE` missing or not `dry_run` while expected
12. Test message lacks `dry_run: true` flag while in dry-run mode
13. Dry-run branch bypassed (publish path reached real Send Message) — IMMEDIATE HALT + ABORT
14. Dry-run log write failure
15. Attempt to write to real publish log during dry-run
16. Attempt to call Discord-side read-content endpoint
17. Attempt to modify source-of-truth message store
18. Attempt to add reactions, edit messages, or delete messages in any channel
19. Attempt to access non-Discord endpoint

### Layer 3: 9 runtime-design-specific halt classes (new in this design)

20. **Forbidden env var present at boot.** Any env var matching the §9 forbidden-list pattern is detected at boot. Halt + log + exit.
21. **Required env var missing at boot.** Any of the 8 baseline required env vars from §8 is absent or invalid format (or 9 if `HERMES_MODE=dry_run` requires `DRY_RUN_LOG_PATH`). Halt + log + exit.
22. **Filesystem isolation violation.** Relay filesystem unexpectedly contains `bot.js`, `dashboard.js`, `db.js`, `migrations/`, `scripts/`, `package.json` of trading runtime, `.env*`, `position.json`, or any file from `relentlessvic/agent-avila` (R12). Detected via boot-time `find` + halt.
23. **Network allowlist hook bypass.** An outbound HTTP request reaches the allowlist hook to a hostname not in the allow-list. Halt + log + exit + immediate token-revocation recommendation.
24. **Source-of-truth message store unreadable / unmounted.** `$MESSAGE_STORE_PATH` does not exist or is not readable. Halt at boot.
25. **Publish log unverifiable.** `$PUBLISH_LOG_PATH` corrupt JSON, unreadable, or partially written. Halt at boot.
26. **Schema validation library missing.** Required dependencies (Ajv) failed to load. Halt at boot.
27. **Process privilege violation.** Relay detected running as root or with elevated capabilities. Halt at boot per non-root requirement (Stage 5 install checklist Step 14).
28. **`git rev-parse HEAD` returns non-error inside the Relay container** (would indicate a git checkout exists, violating Relay spec line 145). Halt at boot.

### Halt behavior (uniform across all classes)

1. Log the halt to `$PUBLISH_LOG_PATH` (or `$DRY_RUN_LOG_PATH` if dry-run) with `outcome=halt:<halt-class-id>` + timestamp + minimal context (no token; redacted message body if forbidden-content was the cause).
2. Log a structured halt record to stdout (for Railway logs).
3. Process exits with non-zero exit code corresponding to halt class category (e.g., 1 = config; 2 = verification; 3 = runtime; 4 = severe).
4. Container does NOT auto-restart. Railway deployment policy is configured at deploy time to NOT restart the Relay service on non-zero exit.
5. Operator must manually restart the process (after diagnosing the halt cause). Restart resets the state machine to BOOT.

### Auto-resume forbidden (per Relay spec line 51, 149)

Relay never auto-resumes after a halt. Even if the underlying anomaly resolves, Relay does not detect the resolution; the process is exited and stays exited until operator action.

**Maps to requirements:** R15, R21.

---

## §16 — Logging discipline

**Structured JSON logs via `pino`. Token redaction at every output point. No secrets ever in logs.**

### What gets logged

| Event | Log level | Content |
|---|---|---|
| Boot | `info` | hermes_version, HERMES_MODE, MESSAGE_STORE_PATH, gateway IDENTIFY success, READY event received |
| Message ingest | `debug` | `message_id`, `channel_name`, file path |
| Gate verification | `debug` | gate name, pass/fail, brief reason on fail (no body content) |
| Publish (real) | `info` | `message_id`, `channel_id`, timestamp, `outcome=success` |
| Publish (dry-run) | `info` | `message_id`, `channel_id`, timestamp, `outcome=would_have_published` |
| Halt | `error` | halt class, anomaly_id, root_cause, redacted-context |
| Shutdown | `info` | exit code, reason |

### What does NOT get logged

- **Discord bot token (`DISCORD_BOT_TOKEN`):** never. Pino has a `redact` config for `DISCORD_BOT_TOKEN` and pattern `**/*token*` and `**/*secret*`. Even if a code path tries to log the token, pino redacts it before output.
- **Full message body if forbidden-content scan flagged anything.** If gate 10 trips, the halt log records the halt class + the FIRST forbidden token detected, NOT the full body (which might contain more forbidden content).
- **Authentication metadata for the source-of-truth store.** No store creds in logs.
- **Operator authentication tokens.** Never.
- **Any value matching the forbidden-content patterns** from `HANDOFF-RULES.md` + `COMM-HUB-RULES.md`.

### Log destinations

Per `$LOG_DESTINATION` env var:
- **`stdout`:** Railway captures stdout into Railway logs (Railway dashboard view). Default for production.
- **`file:/path/to/log`:** structured JSON file on host filesystem. For audit retention.

Both destinations apply pino redaction filters identically.

### Log rotation policy

Operator-defined. For file destinations: log rotation at 100 MB or 7 days, whichever first. Rotated files are gzipped and kept for 90 days; after 90 days they are operator-archived and removed from the host. The publish log (separate from operational logs) is never rotated; it is the canonical idempotency record and grows indefinitely (or operator archives + truncates with an explicit phase).

### Operator audit access

Operator can `cat` / `tail` / `grep` log files directly. The redaction rules ensure even direct file inspection never exposes the bot token or other secrets. The publish log is plain JSONL and is operator-readable in any text editor.

### Log entries the operator should monitor

- Boot success: confirms Relay running.
- Halt events: confirms halt-on-anomaly fires correctly; investigate root cause.
- Publish events: confirms messages are landing as expected.
- Network egress events (if Layer 3 logging enabled): confirms allowlist holds.

**Maps to requirements:** R7, R19.

---

## §17 — Dry-run / no-publish test mode

**`HERMES_MODE=dry_run` env var gates the publish path.** Real `Send Message` API call is replaced with `would_have_published` log write. The 11 verification gates run normally. Test fixtures from `COMM-HUB-HERMES-DRY-RUN-DESIGN.md` §4 are reused (10 anomaly-injection cases + 3 sample-channel messages).

### Dry-run mode definition

When `HERMES_MODE=dry_run`:

1. All 11 verification gates run (§13).
2. At gate 11, the `dry_run` flag check is enforced: every message MUST have `dry_run: true` (defense-in-depth; halt class 12 if absent).
3. Replace the publish branch:
   - **Production branch:** `discord.send_message(channel_id, body)` → halt class 13 if reached during dry-run.
   - **Dry-run branch:** `dryrun_log.append({ ...message, would_have_published_at: now() })` → success.
4. Move the message file from `$MESSAGE_STORE_PATH/pending/` to `$MESSAGE_STORE_PATH/processed/` (same as production).
5. Append outcome to `$DRY_RUN_LOG_PATH` (separate file from `$PUBLISH_LOG_PATH`).
6. Real Discord channels see no message land.

### Test fixtures (reused from canonical dry-run design)

- 3 sample messages for `#status`, `#summaries`, `#system-health` per `COMM-HUB-HERMES-DRY-RUN-DESIGN.md` §4.
- 10 anomaly-injection cases: ANOMALY-001 through ANOMALY-010 per dry-run design §4.
- All 13 message fixtures already exist in the canonical dry-run design and are reused here verbatim.

### Smoke-test sequence (Stage 5 Step 18 + Stage 7 dry-run execution)

This was canonically defined in the dry-run design §1. Reproduced for the runtime design:

1. Boot Relay process with `HERMES_MODE=dry_run`.
2. Verify env-var validation passes.
3. Discord gateway IDENTIFY + READY (read-only authentication; no message events listened to).
4. Channel-list inspection: list 3 allowed channels by id; verify 4 forbidden channels are NOT in the bot's visible-channel list.
5. Operator drops the 13 test fixtures into `$MESSAGE_STORE_PATH/pending/`.
6. Relay processes each:
   - 3 sample messages → would_have_published entries.
   - 10 anomaly-injection cases → halt entries (one per case).
7. After all 13 processed (or first halt), Relay exits.
8. Operator captures Stage 7 evidence per dry-run design §6 (no real Discord post; dry-run log content; halt log content; etc.).

### Mode flag safety

`HERMES_MODE` MUST be set to `production` for real publishes and `dry_run` for tests. Halt classes prevent ambiguity:
- Halt 11: `HERMES_MODE` missing or not `dry_run` while operator expected dry-run (e.g., environment misconfiguration).
- Halt 12: `dry_run: true` flag missing on a message when `HERMES_MODE=dry_run`.
- Halt 13: dry-run branch bypassed and publish path reached real Send Message → IMMEDIATE HALT + ABORT + recommendation to revoke the bot token.

**Maps to requirements:** R18.

---

## §18 — Isolation proofs + file scope + approval gates + rollback

This final section is the safety binding for the entire design. Each subsection answers a specific operator deliverable question.

### 18.1 — Isolation proof: Relay cannot read Discord

Three layers of proof:

**Layer A — Discord-side permission proof.**
- `Read Message History` is OFF at the role level (per Stage 5 Step 11; current operator-attested state).
- `Read Message History` is explicitly DENIED on every channel where the bot has any override (per Stage 5 Steps 12 and 13).
- The bot's OAuth2 scopes are `bot` only (NOT `messages.read` or `applications.commands`).
- The bot's Privileged Gateway Intents are all OFF (per Stage 5 Step 6: Presence OFF, Server Members OFF, Message Content OFF).

**Layer B — Code-level proof.**
- Relay runtime never imports any `discord.js` method that calls `Get Channel Messages`, `Get Reactions`, or any read-content endpoint.
- Codex code review (at implementation phase) verifies the runtime contains zero references to: `MessageManager.fetch`, `ChannelManager.fetch().messages`, `Reaction*`, `MessageContextMenu*`, `ThreadManager.fetchActive`, etc.
- Static analysis: a CI check greps the Relay repo source for the literal strings `messages.fetch`, `getChannelMessages`, `READ_MESSAGE_HISTORY` and rejects the commit if any appear.

**Layer C — Runtime-level halt.**
- If Relay runtime ever calls a Discord-side read-content endpoint (despite Layers A and B), Discord returns a permission error (because Read Message History is denied at every layer). The runtime treats this as halt class 16 ("attempt to call Discord-side read-content endpoint"). The halt log captures the call site for debugging.

### 18.2 — Isolation proof: Relay cannot touch trading systems

Three layers of proof:

**Layer A — Filesystem-level proof.**
- Relay container has no git checkout of the `relentlessvic/agent-avila` trading repo (per §6 — separate repo).
- Relay container has no `bot.js`, `dashboard.js`, `db.js`, `migrations/`, `scripts/`, `package.json` of trading runtime, `.env*`, `position.json`, or any trading file in its filesystem.
- Boot-time check (halt class 22): `find /` for trading-runtime filenames and abort if any are found.

**Layer B — Env-var-level proof.**
- Relay container has no `DATABASE_URL`, `KRAKEN_API_KEY`, `KRAKEN_API_SECRET`, `MANUAL_LIVE_ARMED`, or any forbidden env (per §9).
- Boot-time check (halt class 20): iterate `process.env` and abort if any forbidden var pattern matches.

**Layer C — Network-level proof.**
- Relay egress is restricted to Discord API only (per §10).
- Layer 1: Railway-side firewall blocks non-Discord egress at the network layer.
- Layer 2: Runtime-side allowlist hook blocks at the HTTP-client layer.
- Layer 3 (optional): DNS observation logs for additional defense.
- Halt class 23 if any layer detects a non-allow-listed egress attempt.

**Combined proof:** even if Relay somehow acquired a Kraken API URL, it has no credentials (Layer B fails); even if it had credentials, the network can't reach (Layer C fails); even if both were broken, no trading-runtime files exist on its filesystem (Layer A fails). Three independent isolation surfaces, all enforced at boot time and runtime.

### 18.3 — Files a future implementation phase would create or modify

**Future `COMM-HUB-HERMES-RUNTIME-IMPLEMENT` phase scope:**

- **CREATE: new repository `relentlessvic/agent-avila-hermes`** with the structure proposed in §6. Approximate file count: 25–35 source files (one entry point + 11 verification gate modules + halt + log + 3 store modules + 1 schema + tests + Docker + Railway config + README/LICENSE/etc.).
- **MODIFY: nothing in `relentlessvic/agent-avila`** — the trading runtime repo is NOT touched by the implementation phase.
- **MODIFY: 3 status docs** (`STATUS.md`, `CHECKLIST.md`, `NEXT-ACTION.md`) in `relentlessvic/agent-avila` — closeout commit only after implementation phase completes; not modified during implementation work itself.

**Future `COMM-HUB-HERMES-RUNTIME-DEPLOY` (or named-equivalent Stage 5 resumption) phase scope:**

- **MODIFY: Railway-side `agent-avila-hermes` service config** — add image deployment, set env vars per §8, configure firewall per §10, configure non-restart-on-exit policy.
- **MODIFY: 3 status docs** — closeout commit recording the deployment.
- **NO modification to `relentlessvic/agent-avila` repo files beyond status docs.**
- **NO modification to `agent-avila-dashboard` Railway service.**
- **NO modification to production DB.**
- **NO modification to Kraken endpoints.**
- **NO modification to any trading file or `position.json`.**

### 18.4 — Forbidden files (forever)

These files are forbidden for Relay to access, modify, or even contain in its filesystem at any point:

- `bot.js`, `dashboard.js`, `db.js` (trading runtime)
- `migrations/` (trading-runtime migrations)
- `scripts/` (trading-runtime scripts)
- `package.json` of `relentlessvic/agent-avila` (trading-runtime package config)
- `package-lock.json` of `relentlessvic/agent-avila`
- `.nvmrc` of `relentlessvic/agent-avila`
- `.env*` files containing trading secrets
- `position.json`
- `position.json.snap.*` files
- Deploy config of `agent-avila-dashboard`
- The closed Migration 008 runbook (`orchestrator/handoffs/N-2-MIGRATION-008-PRODUCTION-PLAN.md`)
- Any safety-policy doc in `relentlessvic/agent-avila` (Relay does not modify the rules that govern it)

### 18.5 — Codex review questions (suggested ~25 for runtime-design review)

The Codex docs-only review at the end of this design phase should answer these questions:

1. Does the runtime architecture (single-instance long-running daemon) align with Relay spec single-instance discipline (line 154)?
2. Is Node.js + `discord.js` justified vs Python or other alternatives?
3. Does the code location (separate repo `relentlessvic/agent-avila-hermes`) preserve trading-runtime isolation per Relay spec line 145?
4. Are the 9 allowed env vars sufficient for runtime operation? Any missing required var?
5. Are the forbidden env vars complete? Any common credential pattern missing from §9?
6. Is the Railway-side firewall + runtime-side allowlist hook a complete enforcement of the Discord-API-only egress requirement?
7. Does the file-based source-of-truth message store satisfy R2/R3/R4 (no Discord-side reads)?
8. Is the message JSON Schema strict enough to reject malformed messages?
9. Are the 11 verification gates ordered correctly and complete?
10. Is the idempotency mechanism (Relay-private append-only publish log + orchestrator-side keys) sufficient to guarantee no duplicate publishes?
11. Are the 28 halt classes (10 canonical + 9 dry-run + 9 runtime-design-specific) complete? Any missing halt condition?
12. Does the logging discipline (pino + redaction) guarantee no secrets in logs?
13. Is the dry-run mode (`HERMES_MODE=dry_run` + `dry_run: true` flag) bulletproof against accidental real publishes?
14. Does the 3-layer Discord-read isolation proof (permission + code + halt) provide defense in depth?
15. Does the 3-layer trading-touch isolation proof (filesystem + env + network) provide defense in depth?
16. Are forbidden dependencies (kraken-api, pg, dotenv, openai SDK, modern cloud SDK families, etc.) explicitly excluded?
17. Does the Relay runtime preserve trading-system isolation R21?
18. Does the design preserve the canonical Relay spec staged-path (Stages 5–10b) without short-circuiting any approval gate?
19. Does the design correctly state that runtime authoring requires its own separate phase + Codex review + Victor approval?
20. Does the design correctly state that runtime deployment requires fresh Gate-10 approval at the then-current HEAD?
21. Are all explicit non-authorizations consistent across the design (matches Relay spec, install checklist, dry-run design, preconditions doc, partial-install record)?
22. Is the rollback path (pre-step kill-runtime + 3-step DORMANT revert + optional 4th Discord application delete; repo archival out-of-canonical) complete and reversible?
23. Are the file-scope rules (forbidden files; allowed implementation-phase files) consistent with R12?
24. Does the design explicitly forbid Relay from auto-restarting after halt?
25. Forbidden-content scan: does this design packet itself contain any forbidden content (no real bot tokens, no env values, no Kraken credentials, no `position.json` content, no production deploy commands, no approval-like language not from Victor)?

### 18.6 — Approval gates required before coding

Before any Relay runtime code is written:

1. **Codex docs-only review** of the design packet (completed; PASS verdict on all 25 questions after EDIT-1 through EDIT-5 corrections to §5, §8, §13, §18.8).
2. **Victor explicit in-session approval** to open the codification phase (this `COMM-HUB-DOCS-G-HERMES-RUNTIME-DESIGN-SPEC` phase).
3. **Codex docs-only review** of the codification phase's commit.
4. **Victor commit-only approval** for the codification commit.
5. **Victor push approval** for the codification commit.
6. **Victor explicit in-session approval** to open the implementation phase (`COMM-HUB-HERMES-RUNTIME-IMPLEMENT` or named-equivalent). This phase is NOT DOCS-ONLY; it's a substantive implementation phase requiring tier escalation per `orchestrator/PHASE-MODES.md`.

Only after gate 6 may any runtime code be written.

### 18.7 — Approval gates required before deployment

Before any Relay runtime is deployed to the `agent-avila-hermes` Railway service:

1. **Implementation phase complete** (per 18.6 gate 6+).
2. **Implementation phase Codex code review PASS** on the new runtime code.
3. **Victor commit-only approval** for the implementation phase.
4. **Victor push approval** for the implementation phase.
5. **Implementation phase closeout** committed (separate phase).
6. **Stage 5 resumption phase opens** (`COMM-HUB-HERMES-INSTALL-RESUME` or named-equivalent). This is RED-tier Gate-10 per `orchestrator/APPROVAL-GATES.md` Gate 10.
7. **Fresh Codex install-readiness review** at the resumption HEAD (re-attests preconditions including "runtime exists and is operator-approved").
8. **Victor in-session Gate-10 approval** naming the exact resumption scope (Steps 14–21) at the resumption HEAD.
9. **Victor in-session attestation of precondition 15** (account good standing — time-bound to resumption).

Only after gate 9 may the Relay runtime be deployed to Railway.

### 18.8 — Rollback / deactivation path

**Pre-step (always-available kill-runtime):** stop / kill any Relay runtime currently running. Operator stops the `agent-avila-hermes` Railway service via Railway dashboard; the Relay process exits; no further publishes possible. The bot's Discord-side membership remains intact at this stage; no DORMANT-revert has happened yet.

**Three-step DORMANT revert** (mirrors `orchestrator/handoffs/COMM-HUB-HERMES-STAGE5-PARTIAL-INSTALL-RECORD.md` §7 verbatim):

1. **Reset the Discord bot token.** Discord developer portal → Application "Agent Avila Relay" → Bot tab → Reset Token → confirm. The new token is discarded (operator does NOT save it). The previously-minted token (currently in Railway secret variable) becomes invalid; any future authentication attempt with it fails. This is the fastest single-step DORMANT-revert per the canonical install-checklist "Rollback / removal steps".

2. **Remove the Agent Avila Relay bot from `Agent Avila Hub`.** Server Settings → Members → `Agent Avila Relay` (bot row) → Kick Member → confirm. The bot is removed from the server immediately. The `System-Writer` role's allow / deny overrides remain on the 7 channels but apply to no member.

3. **Delete the `agent-avila-hermes` Railway service.** Railway dashboard → `agent-avila-hermes` service → Settings → Delete Service → confirm. The service shell is removed; the `DISCORD_BOT_TOKEN` secret variable is deleted with it.

After the three steps above, Relay is fully DORMANT in the same state as before Stage 5 began (zero members on `System-Writer`; no Railway service; no token anywhere).

**Optional 4th step:** delete the Discord application from the developer portal (Application → Delete App → confirm). This deletes the application identity itself; future Relay installs would need a fresh application registration. This step is irreversible and is operator preference.

**Out of canonical Stage 5 rollback path:** any `relentlessvic/agent-avila-hermes` repository archival or deletion is separate from the canonical 3-step DORMANT revert and is operator preference. Repo archival/deletion is its own action, not part of the rollback path documented in `COMM-HUB-HERMES-STAGE5-PARTIAL-INSTALL-RECORD.md` §7.

The rollback path is operator-side manual; no automation. Each step requires explicit Victor in-session approval if the operator opens a `COMM-HUB-HERMES-DEACTIVATE` phase per the canonical Relay spec staged-path EOL row.

**Maps to requirements:** R1 through R22 (rollback preserves all design requirements by reverting to DORMANT state).

---

## End of design template

This concludes §1–§18. The codified template:
- Maps every operator-requirement (R1–R22) to specific design decisions.
- Anchors every decision to the canonical Relay safety-policy + handoff docs.
- Preserves CEILING-PAUSE, autopilot DORMANT, Migration 008 APPLIED at `189eb1be6ef6304d914671bdaedec44d389cf877`, N-3 CLOSED, Relay shelved, approvers `{Victor}`.
- Authorizes nothing beyond writing this docs-only template to disk.
- Explicitly requires fresh Codex review + Victor approvals at every future codification, implementation, and deployment gate.

**Writing this template does NOT install Relay, register a Discord application, mint or rotate a Discord bot token, invite a bot to the server, grant any Discord permission, install a webhook / scheduler / MCP trigger / cron job / Ruflo / background automation, post to Discord, run a Stage 7 dry-run, take a production action, take a trading action, or break CEILING-PAUSE.** Relay remains shelved (passive bot member of `Agent Avila Hub` with `System-Writer` role + canonical channel overrides; no runtime running; no posting capability). Stage 5 Gate-10 install approval at `40f3137e842cd60acf1adf17ecc7fe2f0b1b8935` was CONSUMED by the partial-install execution at HEAD `69b3790…` and remains CONSUMED — it cannot be reused for any future Stage 5 resumption. Stages 7 / 8 / 9 / 10a / 10b are separately gated. Relay runtime authoring + repo creation + deployment are NOT authorized by this codification phase.
