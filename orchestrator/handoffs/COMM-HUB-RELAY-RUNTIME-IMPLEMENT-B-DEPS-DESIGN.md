# Communication Hub — Relay Runtime Implement Phase B-DEPS Design (template — COMM-HUB)

> **Author rule:** This file persists the conversation-only DESIGN-ONLY (Mode 2) report produced by the `COMM-HUB-RELAY-RUNTIME-IMPLEMENT-B-DEPS-DESIGN` phase, with the Codex round-1 required edit on §5 (Node version policy) applied verbatim and Codex round-2 final verdict PASS. The design recommends a future SAFE IMPLEMENTATION (Mode 4) phase named `COMM-HUB-RELAY-RUNTIME-IMPLEMENT-B-DEPS` whose scope is exactly two files (`package.json`, `package-lock.json`) in the separate operator-controlled GitHub repo `relentlessvic/agent-avila-relay`. **This document is NOT authorization to draft Phase B file content, run `npm install` / `npm ci`, clone or push to `relentlessvic/agent-avila-relay`, install Relay further, deploy a Relay runtime, register a Discord application, mint a Discord bot token, invite a bot, grant any Discord permission, install a webhook / scheduler / MCP trigger / cron job / Ruflo / background automation, post to Discord, run a Stage 7 dry-run, take a production action, take a trading action, or break CEILING-PAUSE.** Each future step (Phase B opening, Phase B drafting, operator-manual `npm install`, Codex review of resolved lockfile, operator-manual commit + push to the Relay repo, parent-repo closeout) requires its own separately-approved phase with its own design / Codex review / Victor approval cascade.
>
> **No package files, no source code, no Relay-repo content, no Discord bot capability change, no webhook, no scheduler, no MCP trigger, no cron job, and no background automation is installed by writing this file.**

> **Naming convention.** Active forward-looking wording in this file uses "Relay" per `orchestrator/COMM-HUB-RELAY-RULES.md` "Naming convention" subsection and `CLAUDE.md` "Naming convention — Relay vs. external Hermes Agent" subsection. Historical phase identifiers committed to git history (e.g., `COMM-HUB-DOCS-G-HERMES-RUNTIME-DESIGN-SPEC`, `COMM-HUB-HERMES-INSTALL`, `COMM-HUB-HERMES-DRY-RUN-DESIGN`, `COMM-HUB-HERMES-STAGE5-PARTIAL-INSTALL-RECORD`) are preserved verbatim because they are immutable historical phase identifiers. The `HERMES_VERSION` env-var literal is preserved per `orchestrator/handoffs/COMM-HUB-RELAY-RUNTIME-DESIGN.md` §8.

Author: Operator-driven manual planning (Claude as orchestrator; future implementation Victor-only)
Last updated: 2026-05-10 (`COMM-HUB-RELAY-RUNTIME-IMPLEMENT-B-DEPS-DESIGN-SPEC` — DOCS-ONLY / Mode 3)
Source-design HEAD: `1b20628ed280323c6b249c1e5d617ad17ea5a026` (the parent-repo commit anchoring this design phase; Codex round-1 + round-2 reviewed against canonical files at this HEAD)
Relay-repo Phase A anchor: `relentlessvic/agent-avila-relay` @ `fcfec4882ac9fbb7fab1946bd3b9677ea9a211cf` (operator-manual first-root commit; Phase A README.md + LICENSE + .gitignore)

Canonical references:
- `orchestrator/handoffs/COMM-HUB-RELAY-RUNTIME-IMPLEMENT-DESIGN.md` — canonical Phase A through Phase H build-sequence design (committed at parent-repo HEAD `29decb19fb982700a5f51d584e81f7b396d2893b`)
- `orchestrator/handoffs/COMM-HUB-RELAY-RUNTIME-DESIGN.md` — canonical runtime design (§5 language/framework + forbidden-deps; §6 separate repo; §7 Dockerfile; §8 9 allowed env vars; §9 forbidden env vars; §11 file-based message store; §13 11-gate pipeline; §14 idempotency; §15 28 halt classes; §16 logging; §17 dry-run; §18 isolation proofs)
- `orchestrator/COMM-HUB-RELAY-RULES.md` — canonical Relay specification (SAFE-class)
- `orchestrator/handoffs/COMM-HUB-INSTALL-RELAY-CHECKLIST.md` — Stage 5 install checklist
- `orchestrator/handoffs/COMM-HUB-RELAY-STAGE5-PRECONDITIONS.md`, `orchestrator/handoffs/COMM-HUB-HERMES-STAGE5-PARTIAL-INSTALL-RECORD.md`, `orchestrator/handoffs/COMM-HUB-HERMES-DRY-RUN-DESIGN.md` — Stage 5 + Stage 4 records (latter two filenames preserved as historical artifacts)
- `orchestrator/COMM-HUB-RULES.md`, `orchestrator/handoffs/COMM-HUB-CHANNEL-LAYOUT.md` — Communication Hub rulebook + channel/role/permission matrix
- `orchestrator/APPROVAL-GATES.md`, `orchestrator/AUTOMATION-PERMISSIONS.md`, `orchestrator/PROTECTED-FILES.md`, `orchestrator/HANDOFF-RULES.md`, `orchestrator/ROLE-HIERARCHY.md`, `orchestrator/PHASE-MODES.md`, `orchestrator/NEXT-ACTION-SELECTOR.md`, `orchestrator/AUTOPILOT-RULES.md`, `CLAUDE.md` — ARC governance docs

If any field below diverges from those canonical files, the canonical files win and this design must be re-aligned in a follow-up DOCS-ONLY phase.

---

## §0 — Phase classification and pre-flight verification

The persisted artifact below is the verbatim DESIGN-ONLY report (with the Codex round-1 §5 required edit applied). The persisting phase (`COMM-HUB-RELAY-RUNTIME-IMPLEMENT-B-DEPS-DESIGN-SPEC`) is **DOCS-ONLY (Mode 3)**. Its scope is exactly four files: this new handoff template plus `orchestrator/STATUS.md`, `orchestrator/CHECKLIST.md`, and `orchestrator/NEXT-ACTION.md`. The persisting phase does NOT open Phase B implementation, draft Phase B file content, run `npm install` / `npm ci`, clone or push to `relentlessvic/agent-avila-relay`, install Relay further, register a Discord application, mint a token, invite a bot, grant a permission, install any automation, post to Discord, take a production action, take a trading action, or break CEILING-PAUSE.

Pre-flight verification at the source-design HEAD `1b20628ed280323c6b249c1e5d617ad17ea5a026`:

| Check | Expected | Observed | Verdict |
|---|---|---|---|
| `git rev-parse HEAD` | `1b20628…` | `1b20628ed280323c6b249c1e5d617ad17ea5a026` | PASS |
| `git rev-parse origin/main` | `1b20628…` | `1b20628ed280323c6b249c1e5d617ad17ea5a026` | PASS |
| `git ls-remote origin main` | `1b20628…` | `1b20628…\trefs/heads/main` | PASS |
| Working tree (at design phase) | clean except `position.json.snap.20260502T020154Z` | only that one untracked snapshot | PASS |

Three-way SHA consistency PASS. No file written, no Edit/Write tool invoked, no git mutation, no clone of `relentlessvic/agent-avila-relay`, no `npm install`, no `npm ci`, no Railway action, no Discord action by the design phase. Working tree at this codification phase additionally adds the four files in §0's scope.

---

## §1 — Recommended Phase B name

**`COMM-HUB-RELAY-RUNTIME-IMPLEMENT-B-DEPS`**

The closeout (when Phase B completes via operator-manual placement) would be **`COMM-HUB-RELAY-RUNTIME-IMPLEMENT-B-DEPS-CLOSEOUT`** in the parent repo, mirroring Phase A's pattern.

Naming is consistent with the lettered build sequence A → B → C → D → E → F → G → H established in `orchestrator/handoffs/COMM-HUB-RELAY-RUNTIME-IMPLEMENT-DESIGN.md` §3. Forward-looking phase names use "RELAY" not "HERMES" per `CLAUDE.md` naming convention; historical phase identifiers preserved verbatim.

---

## §2 — Recommended phase mode

**SAFE IMPLEMENTATION (Phase Mode 4 per `orchestrator/PHASE-MODES.md`).**

Reasoning:
- Phase B produces `package.json` and `package-lock.json` in the **separate** `relentlessvic/agent-avila-relay` repo; touches **zero** files in `relentlessvic/agent-avila` working tree (other than the eventual closeout-phase status-doc updates).
- The artifacts contain **no executable Relay code**. `package.json` is a manifest; `package-lock.json` is a lock for an empty dependency graph (until `npm install` runs locally and pins versions). Even after `npm install`, the dependency tree is `pino` + `ajv` plus their transitive deps — none of which have any side effect at install time when `npm ci --ignore-scripts` is the canonical install command.
- No Discord network reach (Phase G introduces `discord.js`); no env-var consumer (Phase C-CONFIG); no publish path (Phase G); no halt state machine (Phase F).
- Touches zero HARD BLOCK files anywhere; touches no orchestrator safety-policy doc.

Mode-promotion non-rule: per `orchestrator/PHASE-MODES.md` ambiguous-mode rule, when in doubt the higher mode wins. SAFE IMPLEMENTATION is intentionally chosen over DOCS-ONLY because `package.json` is the canonical manifest of a code-bearing repo, even when the source tree is still empty.

---

## §3 — Exact proposed Phase B scope

**Files added to `relentlessvic/agent-avila-relay`:**

```
relentlessvic/agent-avila-relay/
├── package.json          (NEW — minimal manifest; no scripts; only "type": "module" + minimal deps)
└── package-lock.json     (NEW — generated by operator running `npm install --ignore-scripts` once locally)
```

**Total Phase B artifacts: 2 files.** `package-lock.json` is operator-generated by `npm install --ignore-scripts` on the operator's local machine; both files are then committed and pushed.

**Files NOT added in Phase B:**
- Any `src/**` source code (deferred to Phases C–F).
- `Dockerfile`, `railway.json`, `.github/workflows/**` (deferred to Phase H).
- `tests/**` (deferred to Phase H).
- `schemas/**` (deferred to Phase C).
- `docs/ARCHITECTURE.md` (deferred to Phase H or later).

**Files unchanged in Phase B:**
- `README.md`, `LICENSE`, `.gitignore` (Phase A artifacts; remain canonical).

**Parent-repo (`relentlessvic/agent-avila`) impact during Phase B drafting + Relay-repo commit: zero parent-repo file changes.** Only the eventual Phase B closeout (`COMM-HUB-RELAY-RUNTIME-IMPLEMENT-B-DEPS-CLOSEOUT`) updates 3 parent-repo status docs.

---

## §4 — Proposed `package.json` fields

| Field | Value | Rationale |
|---|---|---|
| `"name"` | `"agent-avila-relay"` | Matches the Relay-repo name. Non-public per private repo. |
| `"version"` | `"0.1.0"` | Pre-release; pre-G; no Discord network behavior yet. Bump pattern: `0.X.0` per lettered phase milestone (B = 0.1.0, C = 0.2.0, …, G = 0.7.0); `1.0.0` after Stage 9 first-auto-publish lands. |
| `"description"` | `"DORMANT-by-default one-way Discord publisher for Agent Avila status surfaces; never approval; never trading. See README.md."` | Matches the Discord application description used at Stage 5 install (per `orchestrator/handoffs/COMM-HUB-INSTALL-RELAY-CHECKLIST.md` Step 3). |
| `"private"` | `true` | Forbids accidental `npm publish`; enforced by npm itself. |
| `"license"` | `"UNLICENSED"` | Matches Phase A `LICENSE` (proprietary; no third-party license grant). |
| `"author"` | `"Victor Mercado"` | Matches Phase A `LICENSE` copyright holder. |
| `"type"` | `"module"` | ES modules. Phase C onward uses `import` syntax; aligns with current Node.js default. |
| `"engines"` | (see §5 below — exact policy deferred to Phase B draft phase per Codex round-1 required edit) | See §5. |
| `"main"` | `"src/index.js"` | Forward-looking pointer to the Phase F entry point. The file does not exist yet; npm does not require `main` to point at an existing file. |
| `"scripts"` | (none — see §9) | Deferred until Phase F (start) and Phase H (test, build, lint). Phase B has no executable code to script. |
| `"dependencies"` | `{ "ajv": "<exact pinned version>", "pino": "<exact pinned version>" }` | See §5 runtime deps. Exact patch versions (no `^` / `~`). |
| `"devDependencies"` | (none) | See §6. Deferred to Phase H. |
| `"keywords"` | (none — optional; non-public repo) | Skip for a private proprietary repo. |
| `"repository"` | `{ "type": "git", "url": "<operator-chosen URL form at draft time>" }` | Optional; aids tooling. SSH (`git+ssh://git@github.com/relentlessvic/agent-avila-relay.git`) or HTTPS (`https://github.com/relentlessvic/agent-avila-relay.git`) — operator preference at draft time. |
| `"bugs"` / `"homepage"` | (none — private repo) | Skip; no public surface. |

The exact pinned versions of `ajv` and `pino` are deliberately left as `<exact pinned version>` placeholders. The Phase B drafting phase will fill them in by querying npm for the latest stable v8.x (ajv) and v9.x (pino) at the time of drafting and recording the exact versions in conversation; operator's `npm install --ignore-scripts` writes the lockfile.

---

## §5 — Proposed runtime dependencies and Node version policy

### Runtime dependencies

**Phase B includes exactly two runtime dependencies. No others.**

| Package | Approx. version family | Purpose | Phase that consumes it |
|---|---|---|---|
| `ajv` | v8.x (latest stable) | JSON Schema validation against `schemas/hermes-message.schema.json` per `RUNTIME-DESIGN §13` gate 1 | Phase E-VERIFY (gate 1 schema validation) |
| `pino` | v9.x (latest stable) | Structured JSON logging with secret redaction per `RUNTIME-DESIGN §16` | Phase C-CONFIG (boot-time logging), all later phases |

Both packages are well-known, stable, audit-friendly, and have minimal transitive dependency trees. Codex review at Phase B drafting time should confirm the resolved transitive set (visible in `package-lock.json`) introduces no forbidden patterns.

Deferred to later phases:
- `discord.js` v14 → Phase G (introduces Discord network behavior; gates the SAFE → HIGH-RISK boundary).
- `better-sqlite3` → NOT added at all. `RUNTIME-DESIGN §11` selected Option A (file-based JSON directory store), explicitly rejecting Option B (SQLite). The runtime needs no SQLite.

### Node version policy (Codex round-1 required edit applied verbatim)

`engines.node`: exact policy to be re-checked at Phase B draft time against RUNTIME-DESIGN §5; canonical design currently specifies Node 20 LTS or Node 22 LTS for Relay, and explicitly separates Relay from the trading runtime Node 24 policy. Do not allow Node 24 unless a separate canonical design update first changes RUNTIME-DESIGN §5.

The Phase B drafting phase will choose the exact `engines.node` semver range that:
- **Allows** Node 20 LTS and/or Node 22 LTS (whichever remain LTS at draft time per the canonical text).
- **Forever excludes** Node 24 (canonical-forbidden because the trading runtime uses it; Relay must run on a different Node major).
- **Excludes** Node 23, Node 25, Node 26+ unless RUNTIME-DESIGN §5 is first updated by a separate operator-approved DOCS-ONLY phase.

If RUNTIME-DESIGN §5 is later updated to permit Node 24 (or a different exclusion rule), Phase B's `engines.node` range can be updated in a later phase under that new canonical authority. Until then, Node 24 is forbidden.

Concrete candidate ranges the Phase B draft phase may select from (drafting-time decision; not authorized now):
- `">=22.0.0 <23.0.0"` — Node 22 only (current Maintenance LTS as of 2026-05-10).
- `">=20.0.0 <23.0.0"` — Node 20 OR Node 22 (broader; verify Node 20 LTS support status at draft time).
- Other narrower ranges as RUNTIME-DESIGN §5 evolves.

---

## §6 — Proposed dev dependencies

**None.**

`devDependencies` is **empty** in Phase B. Phase B does not introduce a test framework, linter, type-checker, build tool, or any other dev tooling.

Deferred:
- Test framework (Vitest / Jest / Node's built-in `node:test`) → Phase H.
- Linter (ESLint / Biome) → Phase H or later (operator preference).
- Type-checker (TypeScript / JSDoc) → Phase H or later (operator preference).
- Build tool (esbuild / Rollup) → not currently planned; the runtime is a Node-native ES-module daemon with no build step (per RUNTIME-DESIGN §7 Dockerfile uses Node Alpine and runs `node src/index.js` directly; no `npm run build`).

The empty `devDependencies` keeps `package.json` minimal and the supply-chain attack surface as small as possible until Phase H.

---

## §7 — Explicit forbidden dependencies (full enumeration)

Phase B-DEPS MUST NOT introduce any of the following packages — directly or transitively (Codex grep verifies after `npm install` runs locally and the lockfile is generated). This list is the canonical superset of `RUNTIME-DESIGN §5` forbidden-deps plus additional items Phase B's review checklist enumerates explicitly.

| Forbidden category | Examples (non-exhaustive) | Reason |
|---|---|---|
| Exchange / trading clients | `kraken-api`, `node-kraken-api`, `ccxt`, `coinbase`, `coinbase-pro`, `binance`, `binance-api-node`, any other exchange or trading API client | R7, R8 — Relay has zero trading authority |
| Database libraries | `pg`, `pg-pool`, `pg-promise`, `mysql`, `mysql2`, `mongoose`, `mongodb`, `sequelize`, `prisma`, `@prisma/client`, `knex`, `typeorm`, `drizzle-orm` | R9 — Relay has zero DB access |
| Cloud-provider SDKs | `aws-sdk` (v2 monolith), `@aws-sdk/*` (v3 modular), `@google-cloud/*`, `google-auth-library`, `@azure/*`, plus any cloud-provider CLI wrapped as an npm package | No cloud-provider authority for Relay |
| Source-control / CI/CD / deploy SDKs | `@octokit/rest`, `@octokit/core`, `@octokit/*`, GitHub Actions client packages, `@railway/cli`, any Railway client SDK, CircleCI / Travis / GitLab client packages | R20, R21 — no GitHub / CI / Railway authority |
| Env loading from disk | `dotenv`, `dotenv-expand`, `dotenv-cli`, `dotenvx` | Relay reads env from Railway secret store at boot, not from `.env` files |
| Browser automation | `puppeteer`, `playwright`, `playwright-core`, `selenium-webdriver`, `webdriverio` | No use case; halt-on-anomaly target |
| Outbound non-Discord communication | `nodemailer`, `twilio`, `@sendgrid/mail`, `@sendgrid/*`, `mailgun.js`, `firebase`, `firebase-admin` | R7, R10 — egress restricted to Discord API only |
| LLM provider SDKs | `openai`, `@anthropic-ai/sdk`, `@google/generative-ai`, `@google-ai/generativelanguage`, `cohere-ai`, `replicate`, plus any **Nous / OpenRouter** SDK or REST client | R12 + CLAUDE.md naming convention — Relay is not the external Hermes Agent and never connects to LLM providers |
| Webhook / HTTP server frameworks | `express`, `fastify`, `koa`, `hapi`, `restify`, `next` (HTTP server side), `nest`, `nestjs`, `polka`, `tinyhttp` | Relay does not expose any HTTP server (per RUNTIME-DESIGN §7 Dockerfile `EXPOSE` no ports) |
| Schedulers / cron / queue | `node-cron`, `cron`, `agenda`, `bull`, `bullmq`, `bree`, `node-schedule`, `quirrel`, `inngest` | Relay is single-instance long-running daemon; no cron / queue surface |
| Discord library beyond `discord.js` | `eris`, `oceanic.js`, `@discordjs/voice`, `@discordjs/rest` (optional), `discord-interactions` | Defense-in-depth; only `discord.js` v14 is the canonical client per RUNTIME-DESIGN §5 |
| Heuristic catch-all (Phase B addition) | Any package whose name contains `kraken`, `binance`, `coinbase`, `dex`, `wallet`, `web3`, `ethers`, `solana`, `bitcoin`, `dogecoin`, or any other crypto/DeFi token | Hard rule: Relay does not transact, query, or reference any crypto/DeFi state |

**Enforcement at Phase B:**
1. Phase B drafting selects `ajv` and `pino` only.
2. Operator runs `npm install --ignore-scripts` locally; npm resolves the full transitive tree without running lifecycle scripts.
3. Codex docs-only review of the resolved `package-lock.json` runs grep against the forbidden list.
4. Any forbidden match → operator does NOT commit; abandon `package-lock.json` and investigate.

**Enforcement after Phase B:**
- Phase H Dockerfile uses `npm ci --production --ignore-scripts` (no devDependencies installed; no postinstall hooks executed; deterministic install from lockfile only).
- Phase H may add a CI grep check that fails the build if any forbidden package name appears in `package.json` or `package-lock.json`.

---

## §8 — `discord.js` timing

**Defer `discord.js` to Phase G-GATEWAY.**

Reasons to defer:
1. **Mode boundary alignment.** Phase G is where SAFE IMPLEMENTATION → HIGH-RISK IMPLEMENTATION; Phase G's mode escalation is what makes "introduces Discord network behavior" tractable. Adding `discord.js` to the dependency manifest is the FIRST observable signal that Discord network behavior is imminent. Tying that signal to Phase G (where the consumer code also lands) keeps the gating boundary clean.
2. **Reversibility.** If the project pauses indefinitely after Phase B, no Discord SDK is in the dependency tree. The Relay repo could remain Phase B for arbitrary duration without ever pulling Discord client code.
3. **Smaller blast radius for Phase B Codex review.** Phase B's `package-lock.json` will be ~10–30 transitive deps (ajv + pino + their tree). Adding `discord.js` would inflate that to ~50–100 transitive deps. Smaller is easier to review and lock down.
4. **Phases C–F do not need `discord.js`.** None of the gates in C-CONFIG, D-STORE, E-VERIFY, or F-HALT exercise the Discord client. They can be unit-tested in Phase H (or earlier in conversation-only Codex review) without `discord.js`.

---

## §9 — npm scripts

**Defer all npm scripts.** Phase B's `package.json` has **no `scripts` field** (or an empty `scripts` object — operator preference; npm tolerates either).

There's no executable code to run yet. `start` would target `src/index.js` which doesn't exist until Phase F. `test` would target `tests/**` which doesn't exist until Phase H. `build` is not in scope (no build step planned per RUNTIME-DESIGN §7). `lint` is not in scope until Phase H or later.

Future script plan (deferred; sketch only; not authorized):

| Script | Adds in phase | Command |
|---|---|---|
| `start` | F-HALT (entry point lands) | `node src/index.js` |
| `start:dry-run` | G-GATEWAY (dry-run mode) | `RELAY_MODE=dry_run node src/index.js` |
| `test` | H-DOCKER (test framework lands) | `node --test tests/` (Node built-in) or `vitest` (operator preference) |
| `lint` | H-DOCKER (optional) | depends on linter chosen |

None of these are added in Phase B.

---

## §10 — Lockfile strategy

**Commit `package-lock.json`. Pin exact versions.**

| Rule | State at Phase B |
|---|---|
| `package-lock.json` committed | YES (always; required for `npm ci` reproducibility) |
| Lockfile version | npm v10+ generates `lockfileVersion: 3` by default |
| Pinned exact patch versions in `package.json` | YES — no `^` / `~` semver ranges. Use `"ajv": "8.x.y"` (specific patch) not `"^8.x"` |
| Dependencies-of-dependencies (transitive) pinned | Implicit via `package-lock.json`; no override needed |
| `.npmrc` | Not added in Phase B (no registry overrides, no auth tokens, no caching directives) |
| `npm-shrinkwrap.json` | Not used (lockfile suffices for a private package) |
| `yarn.lock` / `pnpm-lock.yaml` | Not used (npm is the canonical package manager) |

The canonical install command in Phase H Dockerfile is `npm ci --production --ignore-scripts` (per RUNTIME-DESIGN §7), which requires `package-lock.json` and refuses to install unless the lockfile and `package.json` agree. Exact-version pinning eliminates supply-chain drift between operator's local install and Phase H's container build.

---

## §11 — `npm install` / `npm ci` strategy

**Operator-manual; Claude does not execute either.**

| Step | When | Command | Where | Who |
|---|---|---|---|---|
| 1 | Phase B drafting → operator-manual placement | (none — Claude drafts `package.json` content only) | conversation | Claude |
| 2 | Operator-manual placement | (creates `package.json` from drafted content) | local clone of `relentlessvic/agent-avila-relay` | Victor |
| 3 | Operator-manual placement | `npm install --ignore-scripts` (one-time; resolves the dep tree and writes `package-lock.json`) | local clone | Victor |
| 4 | Codex review of resolved lockfile | Codex docs-only review reads `package-lock.json` content via Codex tooling, greps for forbidden deps | conversation | Codex |
| 5 | Operator-manual placement | `git add package.json package-lock.json` (by name) + `git commit` + `git push` | local clone → `relentlessvic/agent-avila-relay` `origin/main` | Victor |
| 6 | Phase H container build (future, not now) | `npm ci --production --ignore-scripts` (deterministic; reads lockfile only; no devDeps; no postinstall hooks) | Phase H Dockerfile | Build pipeline |
| 7 | Local development checks (optional, future) | `npm ci --ignore-scripts` (with devDeps if `devDependencies` is non-empty) | local clone | Victor |

**Critical flags:**
- `--ignore-scripts` ALWAYS used at install time. Blocks `preinstall`, `install`, `postinstall`, and lifecycle scripts in transitive dependencies — a common supply-chain attack vector.
- `--production` used in Phase H Dockerfile (excludes devDependencies).
- `--audit-level=high` recommended (not canonical-gated) on operator local install to surface high-severity advisories at lockfile generation time.

**Claude does NOT execute `npm install` or `npm ci`** during this design, this codification, the future Phase B drafting phase, or any future phase. Claude has no Relay-repo working directory and no `npm` shell access to that repo. All install operations are operator-manual on Victor's local machine.

---

## §12 — What is NOT authorized

This persisted codification authorizes **nothing downstream**. Specifically NOT authorized:

- **Opening `COMM-HUB-RELAY-RUNTIME-IMPLEMENT-B-DEPS`.** The implementation phase requires its own separate operator approval.
- **Drafting Phase B file content** (the `package.json` / `package-lock.json` blocks). Drafting is the next phase's first step.
- **Any `npm install`, `npm ci`, or any other package-manager action** in any working tree.
- **Any clone, write, commit, or push to `relentlessvic/agent-avila-relay`.**
- **Adding `discord.js`** to the dependency tree in Phase B. Defer to Phase G.
- **Any source code, Dockerfile, Railway config, CI workflows, tests, schemas, Discord client, publish path, halt state machine, env-var validation code, or message-store / publish-log directory contents** in the Relay repo or this parent repo.
- **Any Railway action; any deploy.**
- **Any Discord application / bot / token / permission / webhook / post action.**
- **Stage 5 install resumption (Steps 14–21 remain deferred; Stage 5 Gate-10 install approval at `40f3137e842cd60acf1adf17ecc7fe2f0b1b8935` remains CONSUMED).**
- **Stage 7 dry-run; Stages 8 / 9 / 10a / 10b auto-publish activation.**
- **Any DB / Kraken / env / `MANUAL_LIVE_ARMED` / production action.**
- **DASH-6 smoke run; D-5.12f first-live-exercise; Migration 009+; autopilot Loop B/C/D activation; CEILING-PAUSE break.**
- **External Hermes Agent (Nous / OpenRouter) installation, integration, or use.** No Nous / OpenRouter SDK in any phase.
- **Memory-file edit; test-suite edit.**
- **Modification of any safety-policy doc, canonical Relay handoff record, runtime / migration / script / deploy file in the parent repo.**
- **Any phase-mode promotion.** Approvers remain `{Victor}`.

---

## §13 — Codex review packet (16 questions; for record)

The 16-question DOCS-ONLY review checklist used in Codex round-1 + round-2:

1. SAFE IMPLEMENTATION (Mode 4) is the right future mode for Phase B-DEPS.
2. Phase B file scope strictly limited to `package.json` and `package-lock.json`.
3. Phase B does not include source code, `src/**`, `schemas/**`, `tests/**`, Dockerfile, `railway.json`, `.github/workflows/**`, Discord client, publish path, halt state machine, env-var validation code, or message-store / publish-log directory contents.
4. Proposed `package.json` fields are correct and minimal (`name`, `version: 0.1.0`, `private: true`, `license: UNLICENSED`, `author: Victor Mercado`, `type: module`, `engines.node` per §5, `main: src/index.js`, no scripts, no devDependencies).
5. Node version policy is safe (post-correction wording).
6. Runtime dependencies minimal: `ajv` only and `pino` only.
7. `discord.js` deferred to Phase G-GATEWAY.
8. `devDependencies` empty in Phase B.
9. npm scripts deferred.
10. Lockfile strategy: commit `package-lock.json`; exact pinned versions; no caret/tilde ranges.
11. `npm install` / `npm ci` strategy: operator-manual; Claude does not run npm; `--ignore-scripts` always; `--production` in Phase H Dockerfile; `--audit-level=high` recommended.
12. Forbidden dependency list complete (Kraken, exchange, DB, Railway, GitHub, cloud, dotenv, browser-automation, non-Discord outbound, LLM SDK incl. Nous/OpenRouter, webhook framework, scheduler, crypto/DeFi heuristic).
13. Non-authorization section complete.
14. Naming convention correct (Relay forward; historical Hermes literals preserved appropriately).
15. No forbidden content in the design report.
16. Working-tree integrity (no files written by Claude during the design phase).

---

## §14 — Verdict (source design phase)

**PASS WITH FINDINGS** (round-1 → round-2 PASS) —
- Round-1 returned PASS WITH REQUIRED EDITS (single edit on §5 Node version policy applied verbatim).
- Round-2 returned overall PASS after the §5 correction landed; no new defects introduced; all other goals remain PASS or PASS-WITH-NOTE.
- Findings (recorded; not actionable by this design): (F1) `engines.node` exact range to be re-checked at Phase B draft time against current Node LTS landscape; (F2) exact pinned versions of `ajv` and `pino` filled in at draft time; (F3) `repository.url` SSH vs HTTPS = operator preference at draft time; (F4) no `.npmrc` (deferred); (F5) no install-time hooks (intentional with `--ignore-scripts`).

The source design phase stopped after delivering the verdict (Mode 2 stop discipline). No file written by the design phase. No code generated.

---

## §15 — Codex review history

### Round 1 — PASS WITH REQUIRED EDITS

Codex DESIGN-ONLY review submitted at HEAD `1b20628…` against the 16-goal checklist. Verdict: **PASS WITH REQUIRED EDITS**. One required edit, on §5 (Node version policy):

- **Original wording flagged:** the proposed range `engines.node: ">=22.0.0 <25.0.0"` and supporting prose silently allowed Node 24, which the canonical `orchestrator/handoffs/COMM-HUB-RELAY-RUNTIME-DESIGN.md` §5 explicitly excludes for Relay (because the trading runtime uses Node 24; Relay must run a different Node major).
- **Required replacement (verbatim):** "engines.node: exact policy to be re-checked at Phase B draft time against RUNTIME-DESIGN §5; canonical design currently specifies Node 20 LTS or Node 22 LTS for Relay, and explicitly separates Relay from the trading runtime Node 24 policy. Do not allow Node 24 unless a separate canonical design update first changes RUNTIME-DESIGN §5."
- All other 15 goals: PASS or PASS-WITH-NOTE (no other required edits).

### Round 2 — PASS

Codex re-review (same thread, `--resume`) verified the §5 wording matched the verbatim required replacement, confirmed the Node 24 prohibition clause was present without silent loophole, confirmed the re-check directive at Phase B draft time, confirmed no regression on the other 15 goals, and confirmed working-tree integrity (HEAD `1b20628…` unchanged; only `?? position.json.snap.20260502T020154Z` untracked).

**Round-2 overall verdict: PASS.** No required edits. The design is now clear for codification (this current `…-DESIGN-SPEC` phase) and downstream Phase B opening.

---

## §16 — Authorization scope (explicit non-authorizations preserved)

This persisted codification phase **does NOT authorize** any of the following, regardless of any future Codex review verdict:

- Opening Phase B implementation (`COMM-HUB-RELAY-RUNTIME-IMPLEMENT-B-DEPS`).
- Drafting Phase B file content (`package.json`, `package-lock.json` blocks).
- Running `npm install`, `npm ci`, or any other npm command in any working tree.
- Cloning, writing, committing, or pushing to `relentlessvic/agent-avila-relay`.
- Adding `discord.js` to the dependency tree in Phase B.
- Any source code, Dockerfile, Railway config, CI workflows, tests, schemas, Discord client, publish path, halt-on-anomaly state machine, env-var validation code, or message-store / publish-log directory contents in either repo.
- Any Railway action; any deploy; any GitHub-tracked deploy trigger.
- Any Discord application / bot / token / permission / webhook / post action.
- Stage 5 install resumption (Steps 14–21 remain deferred; Stage 5 Gate-10 install approval at `40f3137e842cd60acf1adf17ecc7fe2f0b1b8935` remains CONSUMED).
- Stage 7 dry-run; Stages 8 / 9 / 10a / 10b auto-publish activation.
- Any DB / Kraken / env / `MANUAL_LIVE_ARMED` / production action.
- DASH-6 smoke run; D-5.12f first-live-exercise; Migration 009+; autopilot Loop B/C/D activation; CEILING-PAUSE break.
- External Hermes Agent (Nous / OpenRouter) installation, integration, or use.
- Memory-file edit; test-suite edit.
- Modification of any other safety-policy doc, canonical Relay handoff record, runtime / migration / script / deploy file in the parent repo.
- Any phase-mode promotion. Approvers remain `{Victor}`.

**Preservation invariant:** Migration 008 APPLIED at `189eb1be6ef6304d914671bdaedec44d389cf877`; N-3 CLOSED; Stage 5 Gate-10 install approval at `40f3137e842cd60acf1adf17ecc7fe2f0b1b8935` CONSUMED; Phase A `COMM-HUB-RELAY-RUNTIME-IMPLEMENT-A-BOOTSTRAP` CLOSED at Relay-repo first-root commit `fcfec4882ac9fbb7fab1946bd3b9677ea9a211cf`; Relay-runtime effectively DORMANT (Phase A added only non-executable scaffolding to the Relay repo; no posting capability); Autopilot DORMANT (verified at `eff4dd22b9b9af038c7ae45de301e60b3f45af98`); CEILING-PAUSE history (broken via `ARC-8-UNPAUSE` at `22ba4a7663e22df64b7cc8e3c0324cbffc0e28f6`; phase-loop counter 0 of 3) preserved; approvers exactly `{Victor}`; no live trading authorized.

---

## What this document is NOT

- **Not authorization to open `COMM-HUB-RELAY-RUNTIME-IMPLEMENT-B-DEPS`.** Opening the implementation phase is a separate operator-approved RED-tier action (per AUTOMATION-PERMISSIONS Tier 3 phase-mode promotion + APPROVAL-GATES Gate 10 / Gate 16).
- **Not authorization to draft `package.json` or `package-lock.json` content.** Drafting is the first step of Phase B itself.
- **Not authorization to run `npm install` / `npm ci` / any npm command.** All package-manager operations are operator-manual on Victor's local machine.
- **Not authorization to clone, write, commit, or push to `relentlessvic/agent-avila-relay`.** Claude has no GitHub authority for that repo.
- **Not authorization to install Relay further, register Discord applications, mint or rotate tokens, invite the bot to additional servers, grant additional permissions, install webhooks / schedulers / MCP triggers / cron jobs / Ruflo / background automation, post to Discord, run a Stage 7 dry-run, take a production action, take a trading action, or break CEILING-PAUSE.**
- **Not canonical over `orchestrator/handoffs/COMM-HUB-RELAY-RUNTIME-DESIGN.md`** (especially §5 Node version policy); if this record diverges, the runtime design wins and this document must be re-aligned in a follow-up DOCS-ONLY phase.
- **Not canonical over `orchestrator/handoffs/COMM-HUB-RELAY-RUNTIME-IMPLEMENT-DESIGN.md`** (Phase A through Phase H build-sequence); if this record diverges, that design wins.
- **Not canonical over `orchestrator/COMM-HUB-RELAY-RULES.md`, `orchestrator/COMM-HUB-RULES.md`, `orchestrator/handoffs/COMM-HUB-CHANNEL-LAYOUT.md`, `orchestrator/AUTOMATION-PERMISSIONS.md`, `orchestrator/APPROVAL-GATES.md`, `orchestrator/PHASE-MODES.md`, `orchestrator/PROTECTED-FILES.md`, `orchestrator/HANDOFF-RULES.md`, `orchestrator/ROLE-HIERARCHY.md`, `orchestrator/AUTOPILOT-RULES.md`, or `CLAUDE.md`.** Canonical files win on divergence.

**This codification phase (`COMM-HUB-RELAY-RUNTIME-IMPLEMENT-B-DEPS-DESIGN-SPEC`) is DOCS-ONLY (Mode 3) and persists the source-design report (with Codex round-1 §5 required edit applied verbatim and Codex round-2 final PASS). The implementation phase remains gated behind explicit Victor in-session approval; Phase B scope remains exactly `package.json` + `package-lock.json` in `relentlessvic/agent-avila-relay`; Stage 5 Gate-10 install approval at `40f3137e842cd60acf1adf17ecc7fe2f0b1b8935` remains CONSUMED; Relay shelved; CEILING-PAUSE history preserved; Autopilot DORMANT preserved; Migration 008 APPLIED preserved; N-3 CLOSED preserved; approvers exactly `{Victor}` preserved.**
