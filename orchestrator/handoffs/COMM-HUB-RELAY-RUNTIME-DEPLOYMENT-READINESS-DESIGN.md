# COMM-HUB-RELAY-RUNTIME-DEPLOYMENT-READINESS-DESIGN

**Status:** Permanent SAFE-class handoff record codified at parent commit `<DEPLOYMENT-READINESS-DESIGN-SPEC commit SHA>` (set at codification seal).
**Phase mode (when authored):** Mode 2 DESIGN-ONLY (conversation-only).
**Phase mode (codification):** Mode 3 DOCS-ONLY (this handoff).
**Sealed grounding:** parent G-DESIGN at `66af7df236745da8a3b3df92463166bc4d8fabf8` + G-READINESS-DESIGN at `95da6efc05c0263e1994e6ae5c1ca0b24e499307` + G-3 DESIGN at `29ea5a4b8c57d6864ae4f1be3025a06c3615dea8` + G-4 DESIGN at `705416e30a0b16554a65411df672f45e500dd315` + STAGE5-PRECONDITIONS + INSTALL-RELAY-CHECKLIST + HERMES-STAGE5-PARTIAL-INSTALL-RECORD + RAILWAY-SERVICE-RENAME-HERMES-TO-RELAY-DESIGN + APPROVAL-GATES + COMM-HUB-RELAY-RULES.
**Pre-codification anchors:** parent HEAD `c5b833e3bdf8beacb0555c17b38a663c40f7131b` (G-5-RUN-11-CLOSEOUT-SYNC, terminal Phase G paperwork seal) + Relay HEAD `f232c328284e687511a794dc89358bbc0cd275d1` (G-5-RUN-10-REPAIR, latest sealed Relay state).
**Codex DESIGN-ONLY review chain:** round-1 FAIL (scope/access — design body inaccessible to Codex) + round-2 PASS WITH REQUIRED EDITS (3 corrections applied conversation-only — phase count, Relay runtime wording, Gate-5/Gate-10 deploy-separation clarification) + round-3 narrow PASS (all 3 corrections SATISFIED).
**Approvers exactly `{Victor}`.** Codex review verdicts do NOT constitute operator approval at any boundary.

This handoff is preserved verbatim through every subsequent deployment-readiness subphase and never edited after codification.

---

## §0 — Background

Phase G code completion was achieved at G-5 RUN-11 PASS TAP `19/19/0/0` (terminal at parent `6e29697867ec09781e1ab21ead2e3f4ee786888f` + CLOSEOUT-SYNC at parent `c5b833e3bdf8beacb0555c17b38a663c40f7131b`). Per sealed G-DESIGN Edit 4 deployment-separation invariant codified at parent `66af7df236745da8a3b3df92463166bc4d8fabf8`:

> "Gate 9 code completion in Phase G does not authorize Relay deployment and does not by itself satisfy the canonical deployment prerequisite; Railway/deploy remains forbidden until a separate authorized deployment phase and later Stage 5+/activation gates."

This DESIGN-ONLY phase maps the gap between code-complete and deployment-ready, identifies what remains blocked, codifies the deployment-readiness gate checklist, and proposes a safe future-phase sequence. **It does not authorize deployment or activation.**

---

## §1 — Repo baseline (read-only verified)

- Parent HEAD: `c5b833e3bdf8beacb0555c17b38a663c40f7131b` (G-5-RUN-11-CLOSEOUT-SYNC)
- Parent status: clean except 2 authorized untracked carve-outs (`orchestrator/handoffs/evidence/` + `position.json.snap.20260502T020154Z`)
- Relay HEAD: `f232c328284e687511a794dc89358bbc0cd275d1` (G-5-RUN-10-REPAIR)
- Relay status: clean
- Relay-runtime: DORMANT
- Autopilot: DORMANT
- Discord activation: NO

Relay package metadata (read-only inspection):
- `name`: `agent-avila-relay`
- `version`: `0.1.0`
- `type`: `module`
- `main`: `src/index.js` (52 lines)
- `engines.node`: `>=22 <23` (current local Node v20.20.2 — pre-existing engines mismatch flagged at G-1 as non-blocking for tests; would be blocking for production deployment if not addressed)

Critical sealed grounding identified:
- `orchestrator/handoffs/COMM-HUB-RELAY-STAGE5-PRECONDITIONS.md` (337 lines) — codifies preconditions 12-15 (hosting, network allowlist, token storage, good-standing attestation)
- `orchestrator/handoffs/COMM-HUB-INSTALL-RELAY-CHECKLIST.md` (498 lines) — canonical install checklist with permission boundaries, network/process boundaries, channel rules
- `orchestrator/handoffs/COMM-HUB-HERMES-STAGE5-PARTIAL-INSTALL-RECORD.md` — records that Stage 5 Gate-10 install approval at `40f3137e842cd60acf1adf17ecc7fe2f0b1b8935` is CONSUMED; Steps 1-13 completed under the original "Hermes" name; Steps 14-21 deferred and require a fresh Gate-10 approval at a future HEAD
- `orchestrator/handoffs/RAILWAY-SERVICE-RENAME-HERMES-TO-RELAY-DESIGN.md` — codifies the Railway service rename history (`agent-avila-hermes` → `agent-avila-relay` manually renamed by Victor on 2026-05-08; no commit; cleanup deferred to Phase 4)
- `orchestrator/APPROVAL-GATES.md` — Gate 5 (Railway deployment): "Explicit operator approval, per-deploy; Deploy plan / checklist / runbook requires Codex docs-only or design review before operator approval"; Gate 10 (automation install/upgrade) RED-tier; Gate 12 (production-state mutation) per-command; Gate 13 (env/secret change)
- `orchestrator/COMM-HUB-RELAY-RULES.md` — Relay rules (one-way publisher, never approver/autopilot/trader/deployer; channels: `#status` from Stage 9, `#summaries` from Stage 10a, `#system-health` from Stage 10b)

`src/index.js` fail-closed behavior verified:

Per RE-9 + Phase F design §9 firm rule, `src/index.js` does NOT read `operatorPhaseId` from `process.env`. The default `phaseGStubMode: 'disabled'` applies, and `createRateLimitState` at boot Stage 13 throws `RateLimitStateError` because `operatorPhaseId` is `undefined`, so boot post-logger halts with reason `'rate-limit-state-missing-operator-phase-id'`. **This means even if Relay is deployed today via `node src/index.js`, it will fail-closed at boot Stage 13.** A canonical non-env config source for `operatorPhaseId` is required before any production boot.

---

## §2 — Current completed state

Sealed Phase G cascade (the Phase G cascade is sealed across the listed parent and Relay repo milestones):

- G-DESIGN parent `66af7df…`
- G-READINESS-DESIGN parent `95da6ef…`
- G-READINESS-DESIGN-SPEC-CLOSEOUT-SYNC parent `098f00b…`
- G-1 DISCORD-JS-INSTALL Relay `8151d36…` + parent closeout `2ca3266…` + closeout-sync `d60c989…`
- G-2 GATEWAY-MODULES-IMPLEMENT Relay `2765a97…` + parent closeout `30ae676…` + closeout-sync `d342c12…`
- G-3 BOOT-JS-GATE-9-WIRING-DESIGN parent `29ea5a4…` + DESIGN-SPEC-CLOSEOUT-SYNC `6764de9…` + Relay `05d2d957…` + parent closeout `8e0a9076…` + closeout-sync `18ab14b8…`
- G-4 INTEGRATION-TESTS-DESIGN-SPEC parent `705416e3…` + DESIGN-SPEC-CLOSEOUT-SYNC `b3001039…` + Relay `07494a50…` + parent closeout `bb671ff4…` + closeout-sync `2edfc747…`
- G-5 RUN-10 failed Mode 4
- G-5-RUN-10-REPAIR Relay `f232c328…` + parent closeout `211a3d8b…`
- G-5 RUN-11 PASS Mode 4 + parent closeout `6e296978…` + closeout-sync `c5b833e3…`

Smoke validation: `19/19/0/0` (terminal Phase G goal achieved per sealed G-READINESS-DESIGN-SPEC §2 G-5 line 127).

F-HALT-SMOKE end-state evolution: baseline `13/13/0/0` → Phase G terminal `19/19/0/0` (N=6 NEW tests: G-2 test 13 + G-3 test 14 + G-4 tests 15-18).

Code surfaces complete:
- discord.js@14.26.4 installed (Relay package.json + package-lock.json sealed at G-1)
- 5 gateway modules: `src/gateway/discord-client.js`, `send-message.js`, `egress-allowlist-hook.js`, `egress-event-log.js`, `phase-g-send-and-record.js`
- boot Stage 15 default-wiring with `validateOnly: true` non-activation guard
- 18 smoke tests passing
- DPI-E10 split-binding verified (Phase G hook + log compose with Phase E verifier)

Stage 5 partial state (recorded separately):
- Steps 1-13 completed under original "Hermes" name at HEAD `40f3137e842cd60acf1adf17ecc7fe2f0b1b8935` (sealed at `COMM-HUB-HERMES-STAGE5-PARTIAL-INSTALL-RECORD.md`)
- Steps 14-21 deferred
- Gate-10 install approval at `40f3137e…` CONSUMED and non-reusable
- Railway service display name: `agent-avila-relay` (manually renamed 2026-05-08 by Victor)
- **Relay runtime code exists and is sealed, but no Relay container or process is deployed or running; Relay remains DORMANT.**

---

## §3 — Remaining blocked surfaces

The following all remain separately gated and forbidden until their respective future authorized phases:

**Deployment & runtime:**
- Railway deploy (Gate 5 RED-tier; requires per-deploy operator approval + Codex docs/design review of deploy plan)
- Any `railway up` / `railway run` / GitHub deploy hook
- Relay container start
- `node src/index.js` execution in production
- Bot login / `client.login()` invocation
- Gateway IDENTIFY
- Real REST send to Discord API
- Real message publish (any channel)
- Real network reach to Discord (or any non-loopback host) from Relay process

**Stage 5+ install resumption:**
- Stage 5 Steps 14-21 (requires fresh Gate-10 RED-tier approval at a future HEAD; the `40f3137e…` approval is CONSUMED)
- Discord application creation / registration
- Discord bot token minting / rotation
- Bot invitation to server / role grants
- Permission scope expansion
- Webhook / scheduler / cron / MCP / Ruflo / background automation install

**Stage 7+ activation cascade:**
- Stage 7 dry-run (`COMM-HUB-HERMES-DRY-RUN`)
- Stage 8 (per-message approval pre-flight)
- Stage 9 (per-message live posting to `#status`)
- Stage 10a (class-authorized posting to `#summaries`)
- Stage 10b (class-authorized posting to `#system-health`)
- Posting to any Discord channel (per-message Victor approval required through Stage 9)

**Env / secrets:**
- `.env` reads or writes
- `DISCORD_BOT_TOKEN` use / verification / rotation
- `RELAY_MODE=production` env injection
- `operatorPhaseId` env or non-env injection
- `runtimeConfig.allowlistedDiscordHostnames` population
- Any Railway env var change (Gate 13)
- Any `KRAKEN_API_KEY` / `KRAKEN_API_SECRET` / `DATABASE_URL` / `MANUAL_LIVE_ARMED` change

**Production state:**
- DB writes / migrations / schema changes
- Kraken API calls / orders / position changes
- Trading (any kind)
- Autopilot Loop B/C/D activation or change
- CEILING-PAUSE state change

**Source/test/handoff:**
- Edits to any sealed source/test/handoff
- Modification of any AMENDMENT / CASE / SCAFFOLD-REPAIR record
- Editing sealed G-DESIGN / G-READINESS-DESIGN / G-3 DESIGN / G-4 DESIGN handoffs

---

## §4 — Definition of "deployment readiness"

For this DESIGN phase, **"deployment readiness" is a documented gate checklist, NOT a deployment plan.** Deployment readiness means:

1. All preconditions are individually attested and codified (hosting, network allowlist, token storage, good-standing).
2. All canonical references are sealed and unmodified (G-DESIGN, G-READINESS-DESIGN, G-3 DESIGN, G-4 DESIGN, Stage 5 preconditions, install checklist, Relay rules, approval gates).
3. A fresh Gate-10 RED-tier approval is in scope for Stage 5 Steps 14-21 (the prior `40f3137e…` approval is CONSUMED).
4. A deployment runbook exists (operator-readable; per-step; with rollback steps; with verification commands) — NOT YET AUTHORED.
5. A Codex docs-only review has cleared the runbook + readiness packet — NOT YET PERFORMED.
6. Operator has explicitly approved the deploy plan, naming target service, target commit SHA, env var list (without values), rollback procedure, and post-deploy verification commands — NOT YET GRANTED.

Deployment readiness does NOT include:
- Executing any deploy
- Reading or printing any secret
- Calling `client.login()`
- Sending any Discord message
- Running any test against production
- Changing any env var
- Touching Railway UI or CLI

Deployment readiness is a PAPERWORK STATE, not a runtime state. The runtime stays DORMANT throughout readiness work.

---

## §5 — Proposed deployment-readiness gate checklist (design-only enumeration)

The gates below are organized into 6 layers. Each layer must be cleared before the next is opened. None of these gates is being cleared in this DESIGN phase.

### Layer 1 — Code & test readiness (ALREADY COMPLETE)
- [x] Phase G code completion (RUN-11 PASS `19/19/0/0`)
- [x] Sealed handoff chain across both repos
- [x] Byte-identity audits PASS (package/source/tests unchanged during RUN-11)
- [x] Approvers exactly `{Victor}`

### Layer 2 — Pre-deployment paperwork (NOT STARTED)
- [ ] Fresh `COMM-HUB-RELAY-RUNTIME-DEPLOYMENT-READINESS-DESIGN-SPEC` (Mode 3 DOCS-ONLY) — persists THIS conversation as a permanent SAFE-class handoff
- [ ] Fresh `COMM-HUB-RELAY-RUNTIME-DEPLOYMENT-PREFLIGHT-DESIGN` (Mode 2) — codifies which SHAs / branch / service / env-var inventory / runbook must be verified before any deploy
- [ ] Fresh `COMM-HUB-RELAY-RUNTIME-DEPLOYMENT-RUNBOOK-SPEC` (Mode 3 DOCS-ONLY) — codifies the per-step deploy + post-deploy verification + rollback procedure
- [ ] Fresh `COMM-HUB-RELAY-RUNTIME-ENV-SECRETS-READINESS-DESIGN` (Mode 2) — codifies env-var inventory (without values); confirms `DISCORD_BOT_TOKEN` is the ONLY Relay-readable secret; confirms NO `KRAKEN_API_KEY` / `KRAKEN_API_SECRET` / `DATABASE_URL` / `MANUAL_LIVE_ARMED` access from Relay process
- [ ] Fresh `COMM-HUB-RELAY-RUNTIME-RUNTIME-CONFIG-READINESS-DESIGN` (Mode 2) — codifies how `runtimeConfig.allowlistedDiscordHostnames` is populated, how `operatorPhaseId` is injected (non-env), how `RELAY_MODE` is set, and how `engines.node >=22` is satisfied on the deploy target

### Layer 3 — Stage 5 install readiness (NOT STARTED; fresh Gate-10 required)
- [ ] Stage 5 preconditions 12-15 each re-attested at current HEAD `c5b833e3…` (operator-attestation forms per `COMM-HUB-RELAY-STAGE5-PRECONDITIONS.md`)
- [ ] Codex install-readiness review (per `COMM-HUB-INSTALL-RELAY-CHECKLIST.md` §"Codex review gate before any future install")
- [ ] Fresh Gate-10 RED-tier operator approval for Stage 5 Steps 14-21 at a future HEAD (the `40f3137e…` approval is CONSUMED and non-reusable)
- [ ] Stage 5 Steps 14-21 executed (per the canonical install checklist)
- [ ] `COMM-HUB-HERMES-INSTALL-CLOSEOUT` recorded

### Layer 4 — Railway deployment (NOT STARTED; Gate 5 RED-tier)
- [ ] Target service confirmed: `agent-avila-relay` (per the renamed Railway service)
- [ ] Target commit SHA confirmed (must equal current Relay HEAD or a future sealed seal)
- [ ] Deploy plan reviewed by Codex (docs-only or design)
- [ ] Per-deploy operator approval naming: service, commit SHA, env var list (without values), rollback procedure, post-deploy verification commands
- [ ] Railway env var inventory verified (only `DISCORD_BOT_TOKEN` + logging endpoint + any non-secret config; NO Kraken / DB / Railway-token / GitHub-token secrets)
- [ ] Non-root runtime user verified (if hosting platform supports it)
- [ ] Egress allowlist enforced at firewall / hosting layer (Discord-only)
- [ ] Read-only filesystem to repo (no git checkout in Relay container)
- [ ] Per-deploy Codex review of deploy log + Railway status

### Layer 5 — Stage 7 dry-run (NOT STARTED)
- [ ] `COMM-HUB-HERMES-DRY-RUN` opened with operator approval
- [ ] Codex dry-run review (per `COMM-HUB-INSTALL-RELAY-CHECKLIST.md`)
- [ ] No real REST send; no real message publish
- [ ] Dry-run evidence preserved untracked

### Layer 6 — Stages 8/9/10a/10b activation cascade (NOT STARTED; each separately gated)
- [ ] Stage 8 (preflight; Codex stage-promotion review)
- [ ] Stage 9 (per-message live posting to `#status`; per-message Victor approval required)
- [ ] Stage 10a (class-authorized posting to `#summaries`; bounded class with 7 documented bounds)
- [ ] Stage 10b (class-authorized posting to `#system-health`; bounded class with 7 documented bounds)

**Gate-5 / Gate-10 deploy-separation clarification.** Any container provisioning or Railway deploy action remains Gate 5-gated (RED-tier per-deploy operator approval). Stage 5 Steps 14-21 (Gate 10 RED-tier install) do NOT implicitly authorize deployment, container start, or Railway deploy. Gate 10 install approval is necessary but NOT sufficient for any deploy action. A deploy authorization requires its own separate Gate 5 RED-tier per-deploy approval naming target service, commit SHA, env var list (without values), rollback procedure, and post-deploy verification commands, after a Codex docs/design review of the deploy plan.

---

## §6 — Proposed future phase sequence (RECOMMENDED ONLY; none opened)

The safest sequence after this DESIGN phase, in strict ordering:

1. **`COMM-HUB-RELAY-RUNTIME-DEPLOYMENT-READINESS-DESIGN-SPEC`** (Mode 3 DOCS-ONLY) — codify THIS design as a permanent SAFE-class handoff at `orchestrator/handoffs/COMM-HUB-RELAY-RUNTIME-DEPLOYMENT-READINESS-DESIGN.md`. Scope: 1 NEW handoff + 3 status-doc updates.
2. **Optional `…-DESIGN-SPEC-CLOSEOUT-SYNC`** (Mode 3) — Rule-1 seal-mirror.
3. **`COMM-HUB-RELAY-RUNTIME-DEPLOYMENT-PREFLIGHT-DESIGN`** (Mode 2) — codify deploy preflight gates (SHA verification, service identity, env inventory, runbook references) conversation-only.
4. **`COMM-HUB-RELAY-RUNTIME-DEPLOYMENT-PREFLIGHT-DESIGN-SPEC`** (Mode 3) — codify as permanent handoff.
5. **`COMM-HUB-RELAY-RUNTIME-DEPLOYMENT-RUNBOOK-SPEC`** (Mode 3) — codify the per-step deploy + verification + rollback runbook as permanent handoff.
6. **`COMM-HUB-RELAY-RUNTIME-ENV-SECRETS-READINESS-DESIGN`** (Mode 2 + Mode 3 SPEC) — codify env-var inventory + token-storage plan re-attestation.
7. **`COMM-HUB-RELAY-RUNTIME-RUNTIME-CONFIG-READINESS-DESIGN`** (Mode 2 + Mode 3 SPEC) — codify `operatorPhaseId` injection, `runtimeConfig.allowlistedDiscordHostnames` population, `engines.node` resolution.
8. **`COMM-HUB-RELAY-STAGE5-RESUMPTION-DESIGN`** (Mode 2) — codify fresh Gate-10 RED-tier approval packet for Steps 14-21.
9. **`COMM-HUB-HERMES-INSTALL` resumption (Stage 5 Steps 14-21)** (Mode 5 with Gate-10 RED-tier) — separately approved; CONSUMES new Gate-10 approval at that future HEAD.
10. **`COMM-HUB-RELAY-RUNTIME-RAILWAY-DEPLOY-PLAN`** (Mode 2 + Mode 3 SPEC + Mode 4 or 5 EXECUTION) — codify per-deploy plan; then execute first deploy under Gate 5 RED-tier per-deploy approval.
11. **Stage 7 `COMM-HUB-HERMES-DRY-RUN`** (separately gated).
12. **Stage 8 → Stage 9 → Stage 10a → Stage 10b** (each separately gated; each requires its own operator approvals + Codex stage-promotion review).

This is at minimum a 12-phase sequence before Relay reaches Stage 10b full activation. Each phase requires separate operator approval. Codex review verdicts at every boundary do NOT constitute operator approval.

**Gate-5 / Gate-10 deploy-separation clarification (repeated for emphasis).** Any container provisioning or Railway deploy action remains Gate 5-gated (RED-tier per-deploy operator approval). Stage 5 Steps 14-21 (Gate 10 RED-tier install) do NOT implicitly authorize deployment, container start, or Railway deploy. Gate 10 install approval is necessary but NOT sufficient for any deploy action.

---

## §7 — Approval matrix

| Action | Required approver | Required prior-state |
|---|---|---|
| Open `…DEPLOYMENT-READINESS-DESIGN-SPEC` (Mode 3) | Victor in-session | Codex DESIGN-ONLY round-1/2/3 PASS on THIS design |
| Commit/push parent docs | Victor (per-commit + per-push) | Codex DOCS-ONLY PASS |
| Open `…DEPLOYMENT-PREFLIGHT-DESIGN` (Mode 2) | Victor | DEPLOYMENT-READINESS-DESIGN-SPEC sealed |
| Open `…DEPLOYMENT-RUNBOOK-SPEC` (Mode 3) | Victor | PREFLIGHT-DESIGN cleared by Codex |
| Open `…ENV-SECRETS-READINESS-DESIGN` (Mode 2) | Victor | runbook + preflight cleared |
| Open `…STAGE5-RESUMPTION-DESIGN` (Mode 2) | Victor | env/secrets + runtime-config cleared |
| Open Stage 5 resumption (Mode 5 Gate-10 RED-tier) | Victor in-session naming: package + version + exact install command + Gate-10 acknowledgment + at current HEAD | Stage 5 preconditions 12-15 re-attested; install-readiness Codex review PASS |
| Open `…RAILWAY-DEPLOY-PLAN` (Mode 2 + Mode 3 SPEC) | Victor | runbook sealed; Stage 5 closeout sealed |
| Execute Railway deploy (Gate 5 RED-tier) | Victor in-session per-deploy naming: service, commit SHA, env list (no values), rollback, verification | Deploy plan sealed; Codex docs/design review PASS |
| Each Railway env var change (Gate 13) | Victor per-var | Docs-only Codex review when change affects safety policy |
| Stage 7 dry-run | Victor per-action | Stage 5 closeout sealed; deploy successful; Relay container running but DORMANT |
| Stage 9 per-message live post | Victor per-message | Stage 8 closeout sealed |
| Stage 10a class authorization | Victor in-session naming all 7 bounds | Stage 9 closeout sealed |
| Stage 10b class authorization | Victor in-session naming all 7 bounds | Stage 10a closeout sealed |

Codex review verdicts do NOT constitute operator approval at any boundary. Codex provides advisory verdicts; only Victor's in-session chat instruction grants approval.

---

## §8 — Runtime safety conditions (must remain true through all readiness phases)

These invariants MUST be preserved continuously from now through Stage 10b. Any violation halts all readiness work:

1. `validateOnly: true` non-activation guard at boot.js Stage 15 G-3 default-wiring remains in place until a separately gated activation phase removes it.
2. No `client.login()` invocation from any Relay code path until Stage 9 (per-message Victor approval per post).
3. No real REST send until Stage 9 (per-message Victor approval per post).
4. No real message publish until Stage 9 (per-message Victor approval per post).
5. Relay is a one-way publisher only (publish to `#status` / `#summaries` / `#system-health` only; no read scope; no `Read Message History` permission; no `#approvals` / `#codex-warnings` / Category C access).
6. Relay has zero approval authority (Discord reply / emoji / reaction is NEVER an approval; only Victor's in-session chat grants approval).
7. Relay has zero trading authority (no Kraken API access; no `MANUAL_LIVE_ARMED` toggle; no order placement; no position change; no trading state read).
8. Relay has zero deployer authority (Relay never runs Railway / CI/CD / GitHub deploy hooks).
9. Relay has zero filesystem-to-repo access (no git checkout in Relay container; read-only access to source-of-truth message store).
10. Approvers exactly `{Victor}` (no expansion at any layer).
11. Autopilot DORMANT preserved (verified at `eff4dd22…`); Autopilot has zero approval authority.
12. CEILING-PAUSE state preserved (Relay does not change CEILING-PAUSE).
13. No env / secret reads or printing during any readiness phase (only documented inventory listing field NAMES without values).
14. `engines.node >=22 <23` must be satisfied on the deploy target; current local Node v20.20.2 is pre-existing mismatch — would block production boot.
15. `operatorPhaseId` must be injected via a non-env canonical config source (per RE-9; `src/index.js` does NOT read from `process.env`; current production boot fails-closed at Stage 13 without it).

---

## §9 — Risks and mitigations

| Risk | Mitigation |
|---|---|
| Accidental Discord activation (`.login()` invoked) | Preserve `validateOnly: true` boot.js Stage 15 default-wiring + factory-time real-send guard at `send-message.js:62-67`; do not authorize any phase that removes either until Stage 9 |
| `DISCORD_BOT_TOKEN` exposure | Token stored only in Railway env vars (per Stage 5 preconditions §7); NEVER read or printed during readiness phases; never logged; rotate per Stage 5 token-rotation policy |
| Railway deploys wrong commit or wrong service | Per-deploy operator approval must explicitly name commit SHA + service name (`agent-avila-relay`); Codex docs/design review of deploy plan before approval; post-deploy SHA-on-Railway verification against target SHA |
| Stale env / wrong service URL | Pre-deploy preflight verifies service URL matches the renamed `agent-avila-relay` (not historical `agent-avila-hermes`); env var inventory verified against env-secrets readiness design |
| Permissions drift in Discord application | Permission boundaries codified at `COMM-HUB-INSTALL-RELAY-CHECKLIST.md` (allow-list enumeration); least-privilege scope; no `Read Message History`; periodic operator re-verification |
| Test evidence mistaken as deploy evidence | RUN-10 + RUN-11 evidence directories preserved untracked under parent carve-out; clearly labeled as smoke-test evidence; no field in evidence implies deploy authorization; deploy plan is its own permanent SAFE-class handoff |
| Phase G code completion mistaken as deployment approval | Sealed G-DESIGN Edit 4 deployment-separation invariant codified at parent `66af7df…`; STATUS.md preamble explicitly records "Deployment NOT authorized"; every CLOSEOUT records this invariant |
| Autopilot / Relay authority confusion | Sealed COMM-HUB-RELAY-RULES.md: "Relay never has approval authority; Autopilot DORMANT; approvers exactly `{Victor}`"; codified at AUTOPILOT-RULES.md ARC-8 |
| Stage 5 `40f3137e…` approval re-use | Sealed COMM-HUB-HERMES-STAGE5-PARTIAL-INSTALL-RECORD.md records approval CONSUMED + non-reusable; resumption requires fresh Gate-10 approval at future HEAD |
| `operatorPhaseId` injected via env by mistake | `src/index.js:7-15` records the RE-1 + RE-9 firm rule; future Stage 5 / runtime-config design must specify non-env injection mechanism; Codex review must verify no `process.env.operatorPhaseId` read added |
| `engines.node` mismatch breaks Railway deploy | Railway target must run Node 22.x; preflight verifies Node version at deploy target before deploy approval |
| Network allowlist drift (Relay reaches non-Discord host) | Egress allowlist enforced at firewall / hosting layer (sealed Stage 5 Precondition 13); gate-9 verifier runtime-checks allowlist hook + egress event log |
| Token rotation introduces stale credentials | Stage 5 Precondition 14 §"Token rotation" defines rotation procedure; operator-only manual rotation; old token revoked before new token issued |

---

## §10 — Non-authorization clauses

This DESIGN-SPEC (Mode 3 DOCS-ONLY codification) does **NOT** authorize:

- Opening `…DEPLOYMENT-PREFLIGHT-DESIGN` or any downstream phase
- Creating any new handoff record beyond this one
- Editing any other file in parent or Relay repo
- Committing or pushing beyond the operator-approved 4-file scope
- Running `node --test`, `npm install`, `npm ci`, `npx`, `npm test`
- Touching `package.json` / `package-lock.json` / `.nvmrc` / `.env*`
- Reading or printing any secret value (`DISCORD_BOT_TOKEN`, `KRAKEN_API_*`, `DATABASE_URL`, `MANUAL_LIVE_ARMED`, Railway tokens, GitHub tokens, CI/CD secrets)
- Touching the Railway service (`agent-avila-relay` or any other)
- Running `railway up` / `railway run` / `railway logs` / Railway UI actions
- Triggering any GitHub deploy hook
- Discord application creation / bot creation / token minting / token rotation
- Bot invitation to server / role grant / permission scope change
- `client.login()` / gateway IDENTIFY / real REST send / real message publish
- Posting to any Discord channel (including `#status`, `#summaries`, `#system-health`, `#approvals`, `#codex-warnings`)
- Real network reach from Relay to any host
- DB / Kraken / env / secrets / armed-trading flag / trading
- Autopilot Loop B/C/D / CEILING-PAUSE change
- External Hermes Agent (Nous/OpenRouter) invocation
- Scheduler / cron / webhook / MCP / Ruflo install
- Stage 5 install resumption (Gate-10 at `40f3137e…` CONSUMED)
- Stage 7 dry-run / Stages 8/9/10a/10b activation
- Modifying any sealed amendment (AMENDMENT-3 / 5 / 6 / 7 / CASE-09 / CASE-12 / SCAFFOLD-REPAIR Path D / Phase D DP-5 / halt.js RE-4 / `rate-limit-state.js` / `boot.js` Stage 12/13/15)
- Editing any sealed handoff (G-DESIGN at `66af7df…`, G-READINESS-DESIGN at `95da6ef…`, G-3 DESIGN at `29ea5a4…`, G-4 DESIGN at `705416e3…`, F-HALT-DESIGN, E-VERIFY-DESIGN, C-CONFIG-DESIGN, RUNTIME-DESIGN, COMM-HUB-RELAY-RULES, STAGE5-PRECONDITIONS, INSTALL-RELAY-CHECKLIST, HERMES-STAGE5-PARTIAL-INSTALL-RECORD, RAILWAY-SERVICE-RENAME-HERMES-TO-RELAY-DESIGN)
- Editing sealed Relay G-2/G-3/G-4/G-5 source/test files
- Editing this DEPLOYMENT-READINESS-DESIGN handoff after codification seals
- Migration 008+ / DASH-6 / D-5.12f-h / Migration 009+ / Phase H
- Introduction of Unicode arrow `→` (U+2192) or Unicode `§` (U+00A7) in new source comments

Approvers exactly `{Victor}`. Codex review verdicts do NOT constitute operator approval.

**This web project is entirely separate from the trading runtime `dashboard.js`. It does not modify, replace, or supplement live trading functionality.**

---

## §11 — Codex DESIGN-ONLY review chain record

| Round | Verdict | Required edits | Status |
|---|---|---|---|
| Round 1 — DESIGN-ONLY review of conversation-only design | FAIL | scope/access — design body inaccessible to Codex as a file | Resolved by re-dispatching with inline design body |
| Round 2 — DESIGN-ONLY re-review with inline body | PASS WITH REQUIRED EDITS | 3 corrections (phase count, Relay runtime wording, Gate-5/Gate-10 deploy-separation clarification) | Applied conversation-only |
| Round 3 — narrow re-review of 3 corrections | PASS | none | Resolved on first round |
| Codification gate | CLEARED | n/a | Proceeded to this DESIGN-SPEC |

Codex agent IDs across rounds: round-1 `a6fbf410f3186ff39`; round-2 `a272c1ca6f7fa5e88`; round-3 `a9a97f27576ead1ea`.

Corrections applied (verbatim record):

1. **§2 phase count correction.** "Sealed Phase G cascade (all 27 named operator-gated phases sealed across parent + Relay repos):" → "Sealed Phase G cascade (the Phase G cascade is sealed across the listed parent and Relay repo milestones):"
2. **§2 Relay runtime wording correction.** "Relay runtime does NOT currently exist (DORMANT; no container running)" → "Relay runtime code exists and is sealed, but no Relay container or process is deployed or running; Relay remains DORMANT."
3. **§5 / §6 deploy-gate clarification clause added.** New clause clarifying container provisioning + Railway deploy remain Gate 5-gated (RED-tier per-deploy operator approval); Stage 5 Steps 14-21 (Gate 10 RED-tier install) do NOT implicitly authorize deployment, container start, or Railway deploy; Gate 10 install approval is necessary but NOT sufficient for any deploy action.

---

## §12 — Future deployment-readiness phase gating requirements

To proceed from this DESIGN-SPEC through deployment readiness, the operator must explicitly open each of the following gated phases in sequence (none authorized by this codification):

1. **`COMM-HUB-RELAY-RUNTIME-DEPLOYMENT-READINESS-DESIGN-SPEC-CLOSEOUT-SYNC`** (Mode 3 DOCS-ONLY, optional Rule-1 seal-mirror). Scope: 3 parent status-doc updates only.
2. **`COMM-HUB-RELAY-RUNTIME-DEPLOYMENT-PREFLIGHT-DESIGN`** (Mode 2 DESIGN-ONLY) — conversation-only deploy preflight design.
3. **`COMM-HUB-RELAY-RUNTIME-DEPLOYMENT-PREFLIGHT-DESIGN-SPEC`** (Mode 3 DOCS-ONLY).
4. **`COMM-HUB-RELAY-RUNTIME-DEPLOYMENT-RUNBOOK-SPEC`** (Mode 3 DOCS-ONLY).
5. **`COMM-HUB-RELAY-RUNTIME-ENV-SECRETS-READINESS-DESIGN`** (Mode 2 + Mode 3 SPEC).
6. **`COMM-HUB-RELAY-RUNTIME-RUNTIME-CONFIG-READINESS-DESIGN`** (Mode 2 + Mode 3 SPEC).
7. **`COMM-HUB-RELAY-STAGE5-RESUMPTION-DESIGN`** (Mode 2).
8. **`COMM-HUB-HERMES-INSTALL` resumption** (Mode 5 Gate-10 RED-tier) — separately approved at future HEAD.
9. **`COMM-HUB-RELAY-RUNTIME-RAILWAY-DEPLOY-PLAN`** (Mode 2 + Mode 3 SPEC + Mode 4 or 5 EXECUTION) — Gate 5 RED-tier per-deploy.
10. **Stage 7 dry-run** through **Stages 8/9/10a/10b activation cascade** (each separately gated).

Each phase requires separate operator approval. Codex review verdicts at every boundary do NOT constitute operator approval. **Gate-5 / Gate-10 deploy-separation invariant applies throughout: Gate 10 install approval is necessary but NOT sufficient for any deploy action; deploy authorization requires its own separate Gate 5 RED-tier per-deploy approval.**

---

## §13 — Carry-forward state

- Parent HEAD at this DESIGN-SPEC codification opening: `c5b833e3bdf8beacb0555c17b38a663c40f7131b` (G-5-RUN-11-CLOSEOUT-SYNC, terminal Phase G paperwork seal).
- Relay HEAD: `f232c328284e687511a794dc89358bbc0cd275d1` (G-5-RUN-10-REPAIR) — unchanged through DEPLOYMENT-READINESS-DESIGN-SPEC since Mode 3 is parent-repo only.
- F-HALT-SMOKE maximum-validation terminal end-state `19/19/0/0` preserved (Phase G terminal).
- Relay-runtime DORMANT preserved.
- Autopilot DORMANT (verified at `eff4dd22…`) preserved.
- Discord activation: NO.
- Deployment: NOT authorized.
- AMENDMENT-3 / 5 / 6 / 7 / CASE-09 / CASE-12 / SCAFFOLD-REPAIR Path D / Phase D DP-5 / halt.js RE-4 / rate-limit-state.js / boot.js Stage 12/13/15 invariants preserved.
- Approvers exactly `{Victor}` preserved.
- Authorized untracked carve-outs (`orchestrator/handoffs/evidence/` containing RUN-1 through RUN-11 + G-1 evidence dirs + `position.json.snap.20260502T020154Z`) preserved untracked.
- discord.js@14.26.4 (sealed at G-1) unchanged; no new dependency.

---

## §14 — Reference anchors

- Sealed G-DESIGN at parent `66af7df236745da8a3b3df92463166bc4d8fabf8`: `orchestrator/handoffs/COMM-HUB-RELAY-RUNTIME-IMPLEMENT-G-DESIGN.md` (313 lines; deployment-separation invariant at Edit 4)
- Sealed G-READINESS-DESIGN at parent `95da6efc05c0263e1994e6ae5c1ca0b24e499307`: `orchestrator/handoffs/COMM-HUB-RELAY-RUNTIME-IMPLEMENT-G-READINESS-DESIGN.md` (282 lines)
- Sealed G-3 DESIGN at parent `29ea5a4b8c57d6864ae4f1be3025a06c3615dea8`: `orchestrator/handoffs/COMM-HUB-RELAY-RUNTIME-IMPLEMENT-G-3-BOOT-JS-GATE-9-WIRING-DESIGN.md` (407 lines)
- Sealed G-4 DESIGN at parent `705416e30a0b16554a65411df672f45e500dd315`: `orchestrator/handoffs/COMM-HUB-RELAY-RUNTIME-IMPLEMENT-G-4-INTEGRATION-TESTS-DESIGN.md` (407 lines)
- Sealed `COMM-HUB-RELAY-STAGE5-PRECONDITIONS.md` (337 lines; preconditions 12-15)
- Sealed `COMM-HUB-INSTALL-RELAY-CHECKLIST.md` (498 lines; canonical install checklist)
- Sealed `COMM-HUB-HERMES-STAGE5-PARTIAL-INSTALL-RECORD.md` (records `40f3137e…` Gate-10 CONSUMED + Steps 14-21 deferred)
- Sealed `RAILWAY-SERVICE-RENAME-HERMES-TO-RELAY-DESIGN.md` (Railway service rename history)
- Sealed `orchestrator/APPROVAL-GATES.md` (Gates 5, 10, 12, 13)
- Sealed `orchestrator/COMM-HUB-RELAY-RULES.md` (Relay rules; one-way publisher; never approver/autopilot/trader/deployer)
- Relay HEAD `f232c328284e687511a794dc89358bbc0cd275d1`: `src/index.js` (52 lines; operatorPhaseId fail-closed) + `src/runtime/boot.js` (762 lines; Stage 15 default-wiring with validateOnly:true) + `src/gateway/*` (5 files sealed at G-2 `2765a97…`)
- Pre-codification parent anchor: G-5-RUN-11-CLOSEOUT-SYNC `c5b833e3bdf8beacb0555c17b38a663c40f7131b`
- F-HALT-SMOKE terminal: `19/19/0/0` (Phase G)

---
