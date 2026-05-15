# COMM-HUB-RELAY-RUNTIME-DEPLOYMENT-PREFLIGHT-DESIGN

**Status:** Permanent SAFE-class handoff record codified at parent commit `<DEPLOYMENT-PREFLIGHT-DESIGN-SPEC commit SHA>` (set at codification seal).
**Phase mode (when authored):** Mode 2 DESIGN-ONLY (conversation-only).
**Phase mode (codification):** Mode 3 DOCS-ONLY (this handoff).
**Sealed grounding:** parent G-DESIGN at `66af7df…` + DEPLOYMENT-READINESS-DESIGN at `02e0796…` + STAGE5-PRECONDITIONS + INSTALL-RELAY-CHECKLIST + HERMES-STAGE5-PARTIAL-INSTALL-RECORD + RAILWAY-SERVICE-RENAME-HERMES-TO-RELAY-DESIGN + APPROVAL-GATES + COMM-HUB-RELAY-RULES + sealed Relay `src/config.js:72-139` (canonical forbidden-env blocklists) + `src/config.js:203+` (`isForbiddenEnvVar()` runtime detector) + `src/index.js` (operatorPhaseId fail-closed) + `src/runtime/boot.js` (Stage 15 default-wiring + validateOnly:true non-activation guard).
**Pre-codification anchors:** parent HEAD `3c5a93f9207c108c0112dea366b27a98df07e469` (DEPLOYMENT-READINESS-DESIGN-SPEC-CLOSEOUT-SYNC) + Relay HEAD `f232c328284e687511a794dc89358bbc0cd275d1` (G-5-RUN-10-REPAIR).
**Codex DESIGN-ONLY review chain:** round-1 resumed FAIL (scope/access only; `--resume` thread did not carry inline body forward) + round-1 fresh PASS WITH REQUIRED EDITS (3 corrections: env split, forbidden env policy, STOP 15; Codex agent ID `a88cabb31ce4b1674`) + round-2 PASS WITH REQUIRED EDITS (env split SATISFIED; forbidden env policy NOT SATISFIED — only 4 of 22 exact names listed; STOP 15 SATISFIED; Codex agent ID `a2b118191207d1989`) + round-3 PASS WITH REQUIRED EDITS (22 names + 11 prefixes + 4 markers + override enumeration SATISFIED; STOP 14 SATISFIED; citation-precision NEW edit — `isForbiddenEnvVar()` is defined outside lines 72-139; Codex agent ID `a9b340cd3545f0be7`) + round-4 narrow PASS (citation precision SATISFIED — `isForbiddenEnvVar()` confirmed at `src/config.js:203`; Codex agent ID `a485b248a97cb59d6`).
**Approvers exactly `{Victor}`.** Codex review verdicts do NOT constitute operator approval at any boundary.

This handoff is preserved verbatim through every subsequent deployment-readiness subphase and never edited after codification.

---

## §0 — Background

The deployment-readiness DESIGN is sealed as a permanent SAFE-class handoff at parent `02e0796757df8576f46192742f3237d1c8d439a5`, with the optional Rule-1 seal-mirror sealed at parent `3c5a93f9207c108c0112dea366b27a98df07e469`. The next paperwork layer per the sealed 12+ phase sequence is the deployment **preflight** design: a conversation-only specification of the checks that must pass before any deployment plan, Railway action, Stage 5 resumption, or Discord activation can be considered.

This DESIGN is **paperwork only**. It does not execute any preflight, does not deploy, does not change any state. It maps the surface area of what a future preflight implementation must verify.

Per sealed G-DESIGN Edit 4 deployment-separation invariant + codified Gate-5/Gate-10 deploy-separation clarification: **deployment readiness does NOT imply deploy authorization.** Each preflight check below is a gate; clearing all gates does NOT grant any deploy authority. Deploy authority requires a separate Gate 5 RED-tier per-deploy operator approval naming target service + commit SHA + env var inventory + rollback + verification.

---

## §1 — Repo baseline (read-only verified)

- Parent HEAD = origin/main = `3c5a93f9207c108c0112dea366b27a98df07e469` (DEPLOYMENT-READINESS-DESIGN-SPEC-CLOSEOUT-SYNC)
- Parent status: clean except 2 authorized untracked carve-outs (`orchestrator/handoffs/evidence/` + `position.json.snap.20260502T020154Z`)
- Relay HEAD = origin/main = `f232c328284e687511a794dc89358bbc0cd275d1` (G-5-RUN-10-REPAIR)
- Relay status: clean
- Relay branch: `main`; Relay remote: `git@github.com:relentlessvic/agent-avila-relay.git`
- Relay-runtime: code exists and sealed; no container or process deployed or running; DORMANT
- Autopilot: DORMANT
- Discord activation: NO

Relay `package.json`: `name: agent-avila-relay`, `type: module`, `main: src/index.js`, `engines.node: >=22 <23`.
Local Node version (build host): `v20.20.2`. **Pre-existing engines mismatch.** Tests passed; production deploy target must run Node 22.x.

---

## §2 — Preflight objective

The preflight gate is a **paperwork-and-attestation gate** that must clear before ANY of:
- Opening Stage 5 resumption
- Opening Railway deploy plan phase
- Executing any Railway action
- Issuing any Discord platform action
- Changing any Railway env var
- Touching the Relay container

**Preflight is a STATE check, not an EXECUTION.** **Preflight is REPEATABLE at every future deploy-related phase open.**

---

## §3 — Required SHA checks

### §3.1 Parent SHA verification
- Parent HEAD = latest deployment-readiness paperwork seal (currently `3c5a93f9207c108c0112dea366b27a98df07e469`; advances with each new sealed deployment-readiness paperwork phase)
- **Three-way SHA consistency PASS:** parent local HEAD = parent origin/main = parent live remote `refs/heads/main`

### §3.2 Relay SHA verification
- Relay HEAD = latest sealed Relay seal (currently `f232c328284e687511a794dc89358bbc0cd275d1`)
- **Three-way SHA consistency PASS** for Relay

### §3.3 Sealed-handoff SHA verification
All sealed handoffs byte-identical at preflight time:
- G-DESIGN `66af7df…`, G-READINESS-DESIGN `95da6ef…`, G-3 DESIGN `29ea5a4…`, G-4 DESIGN `705416e3…`
- DEPLOYMENT-READINESS-DESIGN `02e0796…`
- STAGE5-PRECONDITIONS, INSTALL-RELAY-CHECKLIST, HERMES-STAGE5-PARTIAL-INSTALL-RECORD, RAILWAY-SERVICE-RENAME-HERMES-TO-RELAY-DESIGN
- APPROVAL-GATES, COMM-HUB-RELAY-RULES, RUNTIME-DESIGN, E-VERIFY-DESIGN, F-HALT-DESIGN, C-CONFIG-DESIGN

### §3.4 Phase G commit-chain reachability
- G-1 `8151d36…`, G-2 `2765a97…`, G-3 `05d2d957…`, G-4 `07494a50…`, G-5-RUN-10-REPAIR `f232c328…` reachable on Relay HEAD via `git merge-base --is-ancestor`

### §3.5 Consumed-approval SHA verification
- Stage 5 Gate-10 approval at `40f3137e842cd60acf1adf17ecc7fe2f0b1b8935` recorded CONSUMED; no Stage 5 install action since `40f3137e…`

---

## §4 — Required branch / remote checks

- Parent branch = `main`; Parent remote = `git@github.com:relentlessvic/agent-avila.git` (or HTTPS equivalent)
- Relay branch = `main`; Relay remote = `git@github.com:relentlessvic/agent-avila-relay.git`
- No detached HEAD
- No outstanding rebase / merge / cherry-pick / bisect state
- Local main NOT ahead of origin/main; local main NOT behind origin/main
- Fast-forward parity discipline

---

## §5 — Required working-tree cleanliness checks

- Parent `git status --short` shows ONLY: `?? orchestrator/handoffs/evidence/` + `?? position.json.snap.20260502T020154Z`
- No tracked-file modifications, no staged changes, no new untracked files outside the 2 carve-outs
- No `.rej` / `.orig` / `.swp` artifacts
- Relay `git status --short` empty
- No `node_modules` drift; `package*.json` byte-identical to G-1 seal

---

## §6 — Railway service identity checks

- Railway service display name MUST be `agent-avila-relay` (renamed 2026-05-08; sealed at `RAILWAY-SERVICE-RENAME-HERMES-TO-RELAY-DESIGN.md`)
- Historical `agent-avila-hermes` name must NOT be the deploy target
- Railway project must be operator's project (operator-verified; not Codex-verifiable)
- Deploy target service ID matches prior operator-attested ID
- Codex / Claude cannot directly verify Railway state without Railway CLI access (forbidden); preflight relies on operator-attestation at deploy plan time

---

## §7 — Node / runtime checks

### §7.1 engines.node satisfaction
- Relay `package.json` declares `"engines": { "node": ">=22 <23" }`
- Local build host runs Node `v20.20.2` (pre-existing mismatch)
- **Deploy target MUST run Node 22.x**

### §7.2 Module type & entry point
- `"type": "module"`; `"main": "src/index.js"`; entry point file exists
- No top-level execution outside `boot()` factory at module load

### §7.3 Dependencies
- `discord.js@14.26.4` exact-pinned (G-1 sealed)
- `package-lock.json` lockfileVersion: 3
- No new direct dependency
- `npm audit` must pass on deploy target

### §7.4 No top-level side effects across sealed `src/*` modules (verified at Phase G)

---

## §8 — Env / secrets inventory checks (without exposing values)

### §8.1 Required Relay env vars (names only)

**Baseline always-required (8 env vars):**
- `DISCORD_BOT_TOKEN`
- `RELAY_MODE`
- `HERMES_VERSION`
- `LOG_LEVEL`
- `LOG_DESTINATION`
- `MESSAGE_STORE_PATH`
- `PUBLISH_LOG_PATH`
- `CEILING_PAUSE_SIGNAL_PATH`

**Conditional (1 env var):**
- `DRY_RUN_LOG_PATH` — required ONLY when `RELAY_MODE=dry_run`

### §8.2 Forbidden env vars on Relay deploy target (canonical 3-layer policy)

**Blocklists and override are defined at `src/config.js:72-139`; `isForbiddenEnvVar()` at `src/config.js:203+` is the sealed runtime detector.**

**Layer 1 — `FORBIDDEN_ENV_VAR_NAMES` exact-name blocklist (22 names):**

*Database (7):* `DATABASE_URL`, `DATABASE_PUBLIC_URL`, `PGUSER`, `PGPASSWORD`, `PGHOST`, `PGPORT`, `PGDATABASE`

*Trading (3):* `KRAKEN_API_KEY`, `KRAKEN_API_SECRET`, `MANUAL_LIVE_ARMED`

*Source-control / CI (5):* `GITHUB_TOKEN`, `RAILWAY_TOKEN`, `CI`, `GITHUB_ACTIONS`, `GITLAB_CI`

*LLM providers (4):* `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GOOGLE_API_KEY`, `GEMINI_API_KEY`

*Cloud providers (3):* `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `GOOGLE_APPLICATION_CREDENTIALS`

**Layer 2 — `FORBIDDEN_ENV_VAR_PREFIXES` prefix blocklist (11 prefixes):**
`POSTGRES_`, `KRAKEN_`, `BOT_`, `DASHBOARD_`, `CIRCLE_`, `TRAVIS_`, `GCP_`, `AZURE_`, `STRIPE_`, `TWILIO_`, `SENDGRID_`

**Layer 3 — `FORBIDDEN_CREDENTIAL_MARKERS` suffix catch-all (4 markers):**
`_KEY`, `_SECRET`, `_PASSWORD`, `_TOKEN`

**Allowed credential-name override (exactly 1):** `DISCORD_BOT_TOKEN` is the only allowed credential-name override for Relay.

**Preflight assertion:** the deploy-target env inventory contains all baseline required Relay env vars from §8.1; `DRY_RUN_LOG_PATH` only when `RELAY_MODE=dry_run`; zero env vars rejected by `isForbiddenEnvVar()`, except the allowed `DISCORD_BOT_TOKEN` override. This must be verified by operator-attestation at deploy plan time using env var NAMES ONLY, without reading or printing values.

### §8.3 Token storage policy (sealed at STAGE5-PRECONDITIONS §7)
- `DISCORD_BOT_TOKEN` stored ONLY in Railway env vars
- NEVER read or printed during readiness phases
- NEVER logged in plain text
- Rotation: operator-only manual

### §8.4 No raw env reads from runtime
- `src/index.js` does NOT read `operatorPhaseId` from `process.env` (RE-9)
- `src/index.js` does NOT read `phaseGStubMode` from `process.env` (RE-1)
- `src/runtime/boot.js` reads env only via Phase C `validateEnv()` (sealed)

---

## §9 — Runtime config checks

### §9.1 `operatorPhaseId` injection
- `src/index.js` calls `boot()` with NO arguments
- `boot()` default: `operatorPhaseId = undefined`
- `createRateLimitState` at boot Stage 13 throws `RateLimitStateError`; boot post-logger halts class 20 reason `'rate-limit-state-missing-operator-phase-id'`
- **Production boot currently fails-closed at Stage 13**; non-env config source must be designed in a future phase

### §9.2 `runtimeConfig.allowlistedDiscordHostnames`
- G-3 `boot.js` Stage 15 default-wiring reads `runtimeConfig.allowlistedDiscordHostnames`
- Default fallback: `[]` (empty allowlist)
- Empty allowlist means gate-9 halts on real egress
- Production must populate this array (e.g., `['discord.com', 'gateway.discord.gg']`)

### §9.3 `RELAY_MODE` injection
- Must be set to `'production'` or `'dry_run'`

### §9.4 Phase G refs (3-tuple injection)
- `phaseGSendAndRecord`, `phaseGAllowlistHook`, `phaseGEgressEventLog`
- Auto-wired by G-3 Stage 15 in production when missing

---

## §10 — Stage 5 / Gate 10 checks

### §10.1 Stage 5 install state
- Steps 1-13 COMPLETED under "Hermes" name at HEAD `40f3137e842cd60acf1adf17ecc7fe2f0b1b8935`
- Steps 14-21 DEFERRED
- Gate-10 install approval at `40f3137e…` CONSUMED and non-reusable

### §10.2 Stage 5 resumption preconditions (preflight gates for future Stage 5 resumption phase)
- Preconditions 12-15 (per `COMM-HUB-RELAY-STAGE5-PRECONDITIONS.md`) re-attested at current HEAD

### §10.3 Fresh Gate-10 approval requirement
- Future Stage 5 Steps 14-21 require FRESH Gate-10 RED-tier operator approval at future HEAD
- Approval must name: package + pinned version + exact install command + Gate-10 acknowledgment + at current HEAD
- The `40f3137e…` consumed approval cannot be reused

### §10.4 Gate 10 ≠ Gate 5
**Critical:** Gate 10 (install) approval does NOT authorize Gate 5 (deploy). Container provisioning and Railway deploy are separately Gate 5-gated. Gate 10 install approval is necessary but NOT sufficient for any deploy action.

---

## §11 — Gate 5 deploy approval requirements

### §11.1 Operator per-deploy approval naming
- Target service: `agent-avila-relay`
- Target commit SHA: explicitly named
- Env var inventory: full list of names WITHOUT VALUES, attested only allowed names + zero forbidden names
- Rollback procedure: explicit per-step rollback
- Post-deploy verification commands: explicit command list

### §11.2 Codex docs / design review of deploy plan
- Before per-deploy approval: Codex docs-only or design review of deploy plan
- Codex confirms target SHA + service + env inventory (without values) + rollback + verification
- Codex verdict advisory; does NOT constitute operator approval

### §11.3 Per-env-var-change separate approval (Gate 13)
- Each Railway env var change is its own Gate 13 approval
- Docs-only Codex review required when change affects safety policy

---

## §12 — Evidence preservation checks

- All prior RUN evidence directories (RUN-1 through RUN-11 + G-1 evidence) MUST remain untracked
- No staging or committing of evidence at any preflight or deploy phase
- New deployment-related evidence written to new untracked carve-out path (e.g., `orchestrator/handoffs/evidence/DEPLOY-PREFLIGHT-RUN-N/` or `orchestrator/handoffs/evidence/RAILWAY-DEPLOY-N/`)
- Evidence inventory pattern: timestamp, target-SHA-pre/post, target-env-listing (names only), Railway-status-pre/post, deploy-log capture, rollback-readiness check
- Byte-identity audits on package/source/tests remain 0 bytes drift across any deploy operation

---

## §13 — STOP conditions (any one halts preflight)

Preflight HALTS immediately if any of the following are true:

1. Parent local HEAD ≠ Parent origin/main ≠ Parent live remote
2. Relay local HEAD ≠ Relay origin/main ≠ Relay live remote
3. Parent status shows tracked-file modifications beyond the 2 authorized carve-outs
4. Relay status shows ANY modifications (Relay has no carve-outs)
5. Any sealed handoff SHA-256 differs from sealed-time value
6. Any G-N commit no longer reachable on Relay HEAD
7. Relay `package.json` or `package-lock.json` differs from G-1 seal
8. Stage 5 Gate-10 approval at `40f3137e…` recorded as used by NEW Stage 5 phase without fresh Gate-10 approval
9. Deploy target Railway service display name is anything other than `agent-avila-relay`
10. Deploy target Node version is anything other than 22.x
11. Stage 5 preconditions 12-15 not re-attested at current HEAD
12. Codex docs / design review of deploy plan returns FAIL or PASS WITH REQUIRED EDITS
13. Operator per-deploy approval omits any of: service / commit SHA / env list / rollback / verification
14. **Any deploy-target env var is rejected by the canonical blocklists and override at `src/config.js:72-139`, as enforced by `isForbiddenEnvVar()` at `src/config.js:203+`: Layer 1 exact-name blocklist OR Layer 2 forbidden-prefix match OR Layer 3 credential-marker suffix catch-all, except the permitted `DISCORD_BOT_TOKEN` override.**
15. **Any baseline required Relay env var is missing, OR `DRY_RUN_LOG_PATH` is missing when `RELAY_MODE=dry_run`.**
16. `operatorPhaseId` non-env injection mechanism not designed by separately gated phase
17. `runtimeConfig.allowlistedDiscordHostnames` not populated by separately gated phase
18. Relay activation invariants violated (Relay-runtime not DORMANT, Autopilot not DORMANT, Discord activation attempted)
19. Any AMENDMENT / CASE / SCAFFOLD-REPAIR / Phase D DP-5 / halt.js RE-4 / `rate-limit-state.js` / `boot.js` Stage 12/13/15 invariant violated
20. Test evidence drift (sealed `package-files-diff` / `src-touched-diff` / `tests-smoke-diff` ≠ 0 bytes)

**STOP at any one of these means: do not proceed to deploy plan, do not open Stage 5 resumption, do not open RAILWAY-DEPLOY-PLAN, do not authorize any deploy action.** Investigation phase required.

---

## §14 — Non-authorization clauses

This DESIGN-SPEC (Mode 3 DOCS-ONLY codification) does **NOT** authorize:

- Executing preflight (preflight execution requires its own gated phase)
- Opening `COMM-HUB-RELAY-RUNTIME-DEPLOYMENT-PREFLIGHT-DESIGN-SPEC-CLOSEOUT-SYNC` (Mode 3 optional Rule-1 seal-mirror) — requires separate operator open
- Opening `COMM-HUB-RELAY-RUNTIME-DEPLOYMENT-RUNBOOK-SPEC` or any downstream phase
- Editing any other file (except the 4 in-scope files for this DESIGN-SPEC)
- Committing or pushing beyond the operator-approved 4-file scope
- Running tests / `node --test` / `node --check` / `npm install` / `npm ci` / `npx` / `npm test`
- Reading or printing any secret value
- Touching the Railway service; running `railway up` / `railway run` / `railway logs` / `railway env` / Railway UI actions
- Triggering any GitHub deploy hook
- Discord application creation / bot creation / token minting / token rotation
- `client.login()` / gateway IDENTIFY / real REST send / real message publish
- Real network reach
- DB / Kraken / env / secrets / armed-trading flag / trading
- Autopilot Loop B/C/D / CEILING-PAUSE change
- External Hermes Agent (Nous/OpenRouter)
- Scheduler / cron / webhook / MCP / Ruflo install
- Stage 5 install resumption (Gate-10 at `40f3137e…` CONSUMED)
- Stage 7 dry-run / Stages 8/9/10a/10b activation
- Modifying any sealed amendment or handoff
- Staging or committing RUN-10 / RUN-11 / any future RUN evidence
- Migration 008+ / DASH-6 / Phase H
- Introduction of Unicode arrow `→` (U+2192) or Unicode `§` (U+00A7) in new source comments
- Editing this DEPLOYMENT-PREFLIGHT-DESIGN handoff after codification seals
- Editing `APPROVAL-GATES.md` or `COMM-HUB-RELAY-RULES.md` (both sealed and out-of-scope for this DESIGN-SPEC)

Approvers exactly `{Victor}`. Codex review verdicts do NOT constitute operator approval.

**This web project is entirely separate from the trading runtime `dashboard.js`. It does not modify, replace, or supplement live trading functionality.**

---

## §15 — Codex DESIGN-ONLY review chain record

| Round | Verdict | Required edits | Status | Agent ID |
|---|---|---|---|---|
| Round-1 (resumed) | FAIL | scope/access — inline body not surfaced via `--resume` | Resolved by `--fresh` re-dispatch | n/a |
| Round-1 (fresh) | PASS WITH REQUIRED EDITS | 3 corrections: §8.1 env split, §8.2 forbidden env policy, §13 STOP 15 | Applied conversation-only | `a88cabb31ce4b1674` |
| Round-2 | PASS WITH REQUIRED EDITS | §8.2 only listed 4 of 22 exact forbidden names; STOP 14 depended on §8.2 | Applied conversation-only | `a2b118191207d1989` |
| Round-3 | PASS WITH REQUIRED EDITS | Citation precision — `isForbiddenEnvVar()` defined outside lines 72-139 | Applied conversation-only | `a9b340cd3545f0be7` |
| Round-4 (narrow) | PASS | none — `isForbiddenEnvVar()` confirmed at `src/config.js:203` | Codification cleared | `a485b248a97cb59d6` |

All Codex DESIGN-ONLY review verdicts cleared. No remaining required edits.

---

## §16 — Future deployment-preflight phase gating requirements

To proceed from this DESIGN-SPEC, the operator must explicitly open each of the following gated phases in sequence (none authorized by this codification):

1. **`COMM-HUB-RELAY-RUNTIME-DEPLOYMENT-PREFLIGHT-DESIGN-SPEC-CLOSEOUT-SYNC`** (Mode 3 DOCS-ONLY, optional Rule-1 seal-mirror) — scope: 3 parent status-doc updates only.
2. **`COMM-HUB-RELAY-RUNTIME-DEPLOYMENT-RUNBOOK-SPEC`** (Mode 3 DOCS-ONLY) — codify the per-step deploy + post-deploy verification + rollback runbook as permanent handoff.
3. **`COMM-HUB-RELAY-RUNTIME-ENV-SECRETS-READINESS-DESIGN`** (Mode 2 + Mode 3 SPEC) — codify env-var inventory + token-storage plan re-attestation.
4. **`COMM-HUB-RELAY-RUNTIME-RUNTIME-CONFIG-READINESS-DESIGN`** (Mode 2 + Mode 3 SPEC) — codify `operatorPhaseId` injection, `runtimeConfig.allowlistedDiscordHostnames` population, `engines.node` resolution.
5. **`COMM-HUB-RELAY-STAGE5-RESUMPTION-DESIGN`** (Mode 2) — codify fresh Gate-10 RED-tier approval packet for Steps 14-21.
6. **`COMM-HUB-HERMES-INSTALL` resumption** (Mode 5 Gate-10 RED-tier) — separately approved at future HEAD.
7. **`COMM-HUB-RELAY-RUNTIME-RAILWAY-DEPLOY-PLAN`** (Mode 2 + Mode 3 SPEC + Mode 4 or 5 EXECUTION) — Gate 5 RED-tier per-deploy.
8. **Stage 7 dry-run** through **Stages 8/9/10a/10b activation cascade** (each separately gated).

Each phase requires separate operator approval. Codex review verdicts at every boundary do NOT constitute operator approval. **Gate-5 / Gate-10 deploy-separation invariant applies throughout.**

---

## §17 — Carry-forward state

- Parent HEAD at this DESIGN-SPEC codification opening: `3c5a93f9207c108c0112dea366b27a98df07e469` (DEPLOYMENT-READINESS-DESIGN-SPEC-CLOSEOUT-SYNC seal).
- Relay HEAD: `f232c328284e687511a794dc89358bbc0cd275d1` (G-5-RUN-10-REPAIR) — unchanged through DEPLOYMENT-PREFLIGHT-DESIGN-SPEC since Mode 3 is parent-repo only.
- F-HALT-SMOKE maximum-validation terminal end-state `19/19/0/0` preserved (Phase G terminal).
- Relay-runtime DORMANT preserved (code exists and is sealed; no container or process deployed or running).
- Autopilot DORMANT (verified at `eff4dd22…`) preserved.
- Discord activation: NO.
- **Deployment: NOT authorized.**
- AMENDMENT-3 / 5 / 6 / 7 / CASE-09 / CASE-12 / SCAFFOLD-REPAIR Path D / Phase D DP-5 / halt.js RE-4 / `rate-limit-state.js` / `boot.js` Stage 12/13/15 invariants preserved.
- Approvers exactly `{Victor}` preserved.
- Authorized untracked carve-outs (`orchestrator/handoffs/evidence/` containing RUN-1 through RUN-11 + G-1 evidence dirs + `position.json.snap.20260502T020154Z`) preserved untracked.
- discord.js@14.26.4 (sealed at G-1) unchanged.

---

## §18 — Reference anchors

- Sealed G-DESIGN at parent `66af7df236745da8a3b3df92463166bc4d8fabf8`
- Sealed DEPLOYMENT-READINESS-DESIGN at parent `02e0796757df8576f46192742f3237d1c8d439a5`
- Sealed STAGE5-PRECONDITIONS, INSTALL-RELAY-CHECKLIST, HERMES-STAGE5-PARTIAL-INSTALL-RECORD, RAILWAY-SERVICE-RENAME-HERMES-TO-RELAY-DESIGN
- Sealed APPROVAL-GATES.md (Gates 5, 10, 12, 13)
- Sealed COMM-HUB-RELAY-RULES.md (Relay rules; one-way publisher; never approver/autopilot/trader/deployer)
- Relay HEAD `f232c328284e687511a794dc89358bbc0cd275d1`: `src/config.js:72-139` (canonical forbidden-env blocklists + `ALLOWED_CREDENTIAL_NAME_OVERRIDES`) + `src/config.js:203+` (`isForbiddenEnvVar()` sealed runtime detector) + `src/index.js` (52 lines; operatorPhaseId fail-closed) + `src/runtime/boot.js` (762 lines; Stage 15 default-wiring with `validateOnly: true` non-activation guard)
- Pre-codification parent anchor: DEPLOYMENT-READINESS-DESIGN-SPEC-CLOSEOUT-SYNC `3c5a93f9207c108c0112dea366b27a98df07e469`
- F-HALT-SMOKE terminal: `19/19/0/0` (Phase G)
- Codex DESIGN-ONLY review chain agent IDs: `a88cabb31ce4b1674` (round-1 fresh), `a2b118191207d1989` (round-2), `a9b340cd3545f0be7` (round-3), `a485b248a97cb59d6` (round-4 narrow PASS)

---
