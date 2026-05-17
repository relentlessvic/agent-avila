# COMM-HUB-RELAY-RUNTIME-DEPLOYMENT-RUNBOOK-SPEC

**Status:** Permanent SAFE-class handoff record codified at parent commit `<DEPLOYMENT-RUNBOOK-SPEC commit SHA>` (set at codification seal).
**Phase mode (when authored):** Mode 3 DOCS-ONLY (this handoff).
**Sealed grounding (post-deploy-blocker baseline):** all 4 deploy-blocker implementations sealed (START-SCRIPT-IMPLEMENT Relay `8913f084…` / parent `d37448f25…`; CONFIG-INJECTION-IMPLEMENT Relay `acdafe87…` / parent `0a5e258b1cef8354dedff74ca4d15f9e677d3fb6`; EGRESS-ALLOWLIST-IMPLEMENT Relay `f32be3a1a55c31b8587df745edc50cd3cf71b0ea` / parent `175dd0dc4…`; RAILWAY-RUN-CONFIG-IMPLEMENT parent `cd411941ac2d793691cf75cb9192d1a41201028a` Option A paperwork-attestation; zero Relay-side commits) + RAILWAY-RUN-CONFIG-IMPLEMENT-CLOSEOUT-SYNC sealed at parent `9f5aeeb9e35cbb9465ed0a73aa832a4b4cf63788` + sealed RUNBOOK-DESIGN (`orchestrator/handoffs/COMM-HUB-RELAY-RUNTIME-DEPLOYMENT-RUNBOOK-DESIGN.md`; 494 lines / 36195 bytes; §0–§18) + sealed DEPLOYMENT-PREFLIGHT-DESIGN + sealed DEPLOYMENT-READINESS-DESIGN + STAGE5-PRECONDITIONS + INSTALL-RELAY-CHECKLIST + HERMES-STAGE5-PARTIAL-INSTALL-RECORD + RAILWAY-SERVICE-RENAME-HERMES-TO-RELAY-DESIGN + APPROVAL-GATES + COMM-HUB-RELAY-RULES + sealed Relay `package.json` (engines.node `>=22 <23`, main `src/index.js`, `start` script per START-SCRIPT-IMPLEMENT) + sealed Relay `src/index.js` + sealed Relay `src/runtime/boot.js` + sealed Relay `src/config.js`.
**Pre-codification anchors:** parent HEAD `9f5aeeb9e35cbb9465ed0a73aa832a4b4cf63788` + Relay HEAD `f32be3a1a55c31b8587df745edc50cd3cf71b0ea`.
**Codex DOCS-ONLY review chain:** pending dispatch (to be filled at review-seal time).
**Approvers exactly `{Victor}`.** Codex review verdicts do NOT constitute operator approval at any boundary.

---

## §0 Phase header and mode

Phase: `COMM-HUB-RELAY-RUNTIME-DEPLOYMENT-RUNBOOK-SPEC`.
Mode: Mode 3 DOCS-ONLY.
Scope: codify the sealed `COMM-HUB-RELAY-RUNTIME-DEPLOYMENT-RUNBOOK-DESIGN.md` as a SPEC handoff at the post-deploy-blocker sealed baseline. Add a post-deploy-blocker delta (§6) that captures the now-concrete sealed-state anchors that the original DESIGN could not anchor because deploy-blocker implementations had not yet been sealed when the DESIGN was authored.

No source code edits. No Relay-repo touch. No deploy. No npm. No node. No tests. No Discord. No Railway. No DB. No Kraken. No env/secrets. No trading. No `MANUAL_LIVE_ARMED`. No Autopilot. No CEILING-PAUSE. No Stage 5. No Stages 7-10b.

## §1 Sealed grounding

This SPEC is grounded on the following sealed records (all permanent SAFE-class):

1. **Sealed RUNBOOK-DESIGN:** `orchestrator/handoffs/COMM-HUB-RELAY-RUNTIME-DEPLOYMENT-RUNBOOK-DESIGN.md` (494 lines / 36195 bytes; §0–§18 covering Background, Repo baseline, Runbook objective, Pre-deploy required state, Target service identity, Target commit/SHA requirements, Node/runtime requirements, Env/secrets inventory, Runtime config prerequisites, Future deployment procedure, Future post-deploy verification, Future rollback procedure, Evidence capture, STOP conditions, Non-authorization, Codex review record, Recommended next step, Carry-forward, Reference anchors). The DESIGN's `<DEPLOYMENT-RUNBOOK-DESIGN-SPEC commit SHA>` Status-line placeholder remains unfilled at this codification — this SPEC does NOT edit the DESIGN file.
2. **Sealed DEPLOYMENT-PREFLIGHT-DESIGN:** `orchestrator/handoffs/COMM-HUB-RELAY-RUNTIME-DEPLOYMENT-PREFLIGHT-DESIGN.md` (384 lines / 23696 bytes).
3. **Sealed DEPLOYMENT-READINESS-DESIGN:** `orchestrator/handoffs/COMM-HUB-RELAY-RUNTIME-DEPLOYMENT-READINESS-DESIGN.md` (416 lines / 34248 bytes).
4. **Sealed deploy-blocker implementations (all 4):**
   - `START-SCRIPT-IMPLEMENT`: Relay `8913f084…` / parent `d37448f25…`
   - `CONFIG-INJECTION-IMPLEMENT`: Relay `acdafe87…` / parent `0a5e258b1cef8354dedff74ca4d15f9e677d3fb6`
   - `EGRESS-ALLOWLIST-IMPLEMENT`: Relay `f32be3a1a55c31b8587df745edc50cd3cf71b0ea` / parent `175dd0dc4…`
   - `RAILWAY-RUN-CONFIG-IMPLEMENT`: parent `cd411941ac2d793691cf75cb9192d1a41201028a` (Option A paperwork-attestation; zero Relay-side commits)
5. **Sealed CLOSEOUT-SYNC:** `RAILWAY-RUN-CONFIG-IMPLEMENT-CLOSEOUT-SYNC` at parent `9f5aeeb9e35cbb9465ed0a73aa832a4b4cf63788`.
6. **Sealed Relay source modules** (byte-identical at Relay HEAD `f32be3a1a55c31b8587df745edc50cd3cf71b0ea`): `package.json`, `src/index.js`, `src/runtime/boot.js`, `src/config.js`, plus the EGRESS-ALLOWLIST artifacts (`config/allowlisted-discord-hostnames.json` manifest, `src/runtime/allowlist-loader.js` loader with sealed `APPROVED_HOSTNAMES` set, 6 smoke tests).
7. **Sealed policy records:** `STAGE5-PRECONDITIONS`, `INSTALL-RELAY-CHECKLIST`, `HERMES-STAGE5-PARTIAL-INSTALL-RECORD`, `RAILWAY-SERVICE-RENAME-HERMES-TO-RELAY-DESIGN` (service `agent-avila-hermes` -> `agent-avila-relay`), `APPROVAL-GATES.md`, `COMM-HUB-RELAY-RULES.md`, `COMM-HUB-RULES.md`, `AUTOPILOT-RULES.md`.

This SPEC inherits all sealed grounding above. No grounding is changed by this SPEC.

## §2 Pre-codification anchors

| Anchor | Value |
|---|---|
| Parent local HEAD | `9f5aeeb9e35cbb9465ed0a73aa832a4b4cf63788` |
| Parent origin/main | `9f5aeeb9e35cbb9465ed0a73aa832a4b4cf63788` |
| Parent live remote `refs/heads/main` | `9f5aeeb9e35cbb9465ed0a73aa832a4b4cf63788` |
| Parent three-way SHA consistency | PASS at local HEAD = origin/main = live remote |
| Relay local HEAD | `f32be3a1a55c31b8587df745edc50cd3cf71b0ea` |
| Relay origin/main | `f32be3a1a55c31b8587df745edc50cd3cf71b0ea` |
| Relay live remote `refs/heads/main` | `f32be3a1a55c31b8587df745edc50cd3cf71b0ea` |
| Parent working tree | only authorized untracked carve-outs (`orchestrator/handoffs/evidence/`, `position.json.snap.20260502T020154Z`) |
| Relay working tree | clean |
| Parent ahead/behind origin/main | 0 / 0 |
| Relay ahead/behind origin/main | 0 / 0 |

## §3 Codification objective

Codify the sealed RUNBOOK-DESIGN as a SPEC handoff anchored to the post-deploy-blocker sealed baseline at parent `9f5aeeb9e35cbb9465ed0a73aa832a4b4cf63788`. Specifically:

1. Provide a single immutable post-deploy-blocker SPEC anchor that downstream phases (e.g., `RAILWAY-DEPLOY-PLAN-DESIGN`, Stage 5 re-open, Stage 7 dry-run) can reference as the operative runbook specification.
2. Inherit the full runbook content from sealed `RUNBOOK-DESIGN.md` §0–§18 by reference (no content duplication).
3. Add a post-deploy-blocker delta (§6 below) that captures concrete anchors the DESIGN could not include because the deploy-blocker implementations had not yet been sealed at DESIGN-authoring time.
4. Preserve the original RUNBOOK-DESIGN file untouched. Its `<DEPLOYMENT-RUNBOOK-DESIGN-SPEC commit SHA>` Status-line placeholder is intentionally NOT filled in by this SPEC.

This SPEC does NOT change any sealed runbook content. It only adds the post-seal anchors that compose with the sealed DESIGN.

## §4 Sealed deploy-blocker manifest

The 4 deploy-blocker implementations were sealed in the following order:

| # | Phase | Relay commit | Parent commit | Notes |
|---|---|---|---|---|
| 1 | `START-SCRIPT-IMPLEMENT` | `8913f084…` | `d37448f25…` | NEW `scripts.start` in Relay `package.json`. First of 4. |
| 2 | `CONFIG-INJECTION-IMPLEMENT` | `acdafe87…` | `0a5e258b1cef8354dedff74ca4d15f9e677d3fb6` | NEW `operatorPhaseId` + Phase G 3-tuple injection wired through `src/runtime/boot.js`. Second of 4. |
| 3 | `EGRESS-ALLOWLIST-IMPLEMENT` | `f32be3a1a55c31b8587df745edc50cd3cf71b0ea` | `175dd0dc4…` | NEW `config/allowlisted-discord-hostnames.json` + NEW `src/runtime/allowlist-loader.js` + 6 NEW smoke tests + wiring in `src/index.js`. Two-layer fail-closed: manifest schema + source-side `APPROVED_HOSTNAMES` enum. Third of 4. |
| 4 | `RAILWAY-RUN-CONFIG-IMPLEMENT` | (none; zero Relay commits) | `cd411941ac2d793691cf75cb9192d1a41201028a` | Option A paperwork-attestation. Railway Run Config is a Railway-UI-side toggle; implementation seals an attestation-only paperwork record. Fourth of 4. |

Post-deploy-blocker CLOSEOUT-SYNC sealed at parent `9f5aeeb9e35cbb9465ed0a73aa832a4b4cf63788`.

**MILESTONE: all 4 deploy-blocker implementations are sealed.** Resolving the 4 deploy-blocker implementations does NOT activate Relay, does NOT authorize deployment, and does NOT consume any new approval. The sealed Gate 10 install approval at `40f3137e…` remains CONSUMED and non-reusable.

## §5 Pointer to RUNBOOK-DESIGN sections §0–§18

This SPEC inherits the full runbook content from sealed `orchestrator/handoffs/COMM-HUB-RELAY-RUNTIME-DEPLOYMENT-RUNBOOK-DESIGN.md`. No content is duplicated here. The inherited sections are:

- §0 Background — context of the Relay deploy track and prior Hermes -> Relay service rename
- §1 Repo baseline (inspection time)
- §2 Runbook objective
- §3 Pre-deploy required state
- §4 Target service identity
- §5 Target commit / SHA requirements
- §6 Node/runtime requirements
- §7 Env/secrets inventory requirements
  - §7.1 Baseline always-required (8 names, per sealed PREFLIGHT-DESIGN §8.1)
  - §7.2 Conditional (1 name)
  - §7.3 Forbidden inventory (canonical 3-layer)
  - §7.4 Inventory composition rule
  - §7.5 Verification rule
  - §7.6 STOP conditions
- §8 Runtime config prerequisites
- §9 Future deployment procedure design
  - §9.1 Command sequence (composed; not executed)
  - §9.2 Execution boundary
- §10 Future post-deploy verification design
- §11 Future rollback procedure design
  - §11.1 Rollback triggers
  - §11.2 Rollback procedure (composed-and-stopped; Victor executes)
  - §11.3 Special case — first-ever Relay deploy fails
  - §11.4 Post-rollback state
- §12 Evidence capture design
  - §12.1 Files captured per deploy attempt
  - §12.2 Evidence discipline
- §13 STOP conditions
- §14 Non-authorization clauses
- §15 Codex DESIGN-ONLY review record
- §16 Recommended next step
- §17 Carry-forward state
- §18 Reference anchors

This SPEC is the operative reference for any downstream phase that needs to ground itself on the runbook design at the post-deploy-blocker sealed baseline.

## §6 Post-deploy-blocker delta

These anchors are now concrete (the original DESIGN could not include them because deploy-blockers had not yet been sealed when the DESIGN was authored):

### §6.1 START-SCRIPT presence assertion (concrete)

Per sealed `START-SCRIPT-IMPLEMENT` (Relay `8913f084…`): Relay `package.json` at HEAD `f32be3a1a55c31b8587df745edc50cd3cf71b0ea` contains a concrete `scripts.start` entry. The RUNBOOK-DESIGN §6 / §9.1 anchor "Relay must have a `start` script" is now satisfied. Verification rule remains: byte-identity check of `package.json` against Relay HEAD `f32be3a1…` before any future Railway deploy attempt.

### §6.2 CONFIG-INJECTION env-var inventory (concrete)

Per sealed `CONFIG-INJECTION-IMPLEMENT` (Relay `acdafe87…` / parent `0a5e258b1cef8354dedff74ca4d15f9e677d3fb6`): the Phase G 3-tuple injection is wired through `src/runtime/boot.js` Stage 15. The RUNBOOK-DESIGN §8 / §7.1 anchor "Phase G refs (3-tuple) must be injected at boot" is now satisfied. Verification rule remains: byte-identity check of `boot.js` against Relay HEAD `f32be3a1…` (the EGRESS-ALLOWLIST seal preserved CONFIG-INJECTION wiring byte-identical).

### §6.3 EGRESS-ALLOWLIST manifest (concrete)

Per sealed `EGRESS-ALLOWLIST-IMPLEMENT` (Relay `f32be3a1a55c31b8587df745edc50cd3cf71b0ea` / parent `175dd0dc4…`): the operator-attested `allowlistedHostnames` inventory is concrete:
- `discord.com`
- `gateway.discord.gg`

These two hostnames are sealed in `config/allowlisted-discord-hostnames.json` (`rotatedFromParentSha = 0a5e258b1cef8354dedff74ca4d15f9e677d3fb6`) AND in source-side `APPROVED_HOSTNAMES` enum in `src/runtime/allowlist-loader.js`. Two-layer fail-closed enforcement. Verification rule remains: manifest + source byte-identity at Relay HEAD `f32be3a1…`.

### §6.4 RAILWAY-RUN-CONFIG paperwork attestation (concrete)

Per sealed `RAILWAY-RUN-CONFIG-IMPLEMENT` Option A (parent `cd411941ac2d793691cf75cb9192d1a41201028a`; zero Relay-side commits): the Railway Run Config attestation is paperwork-only — no source artifact in the Relay repo. The RUNBOOK-DESIGN §4 anchor "Target service identity = `agent-avila-relay`" composes with this attestation. Future Railway-UI-side runtime parameters (start command, watch path, build command, deploy region, etc.) remain unverifiable from the Relay repo and require operator visual attestation at deploy time.

### §6.5 Composed pre-deploy verification (concrete)

A future Railway-deploy-plan phase MUST verify all four concrete anchors above before authorizing deploy:
1. `package.json` byte-identity at Relay HEAD `f32be3a1a55c31b8587df745edc50cd3cf71b0ea` (start script preserved)
2. `src/runtime/boot.js` byte-identity at Relay HEAD `f32be3a1a55c31b8587df745edc50cd3cf71b0ea` (CONFIG-INJECTION preserved)
3. `config/allowlisted-discord-hostnames.json` + `src/runtime/allowlist-loader.js` byte-identity at Relay HEAD `f32be3a1a55c31b8587df745edc50cd3cf71b0ea` (EGRESS-ALLOWLIST preserved)
4. Operator Railway-UI attestation that Railway Run Config matches the RAILWAY-RUN-CONFIG-IMPLEMENT paperwork seal

No deploy occurs without all four passing.

### §6.6 No changes to DESIGN-stated STOP / rollback / evidence

The DESIGN's §10 (post-deploy verification), §11 (rollback), §12 (evidence), §13 (STOP conditions) sections remain in force as authored. No deltas to those sections — they were forward-looking to the post-deploy-blocker state and remain valid as-is.

## §7 Operator-authorization matrix

| Action | Status |
|---|---|
| Deploy (Railway deploy command, Railway service activation, fresh release) | NOT authorized |
| Stage 5 install resumption | NOT authorized |
| Stage 7 dry-run | NOT authorized |
| Stages 8 / 9 / 10a / 10b activation cascade | NOT authorized |
| Railway CLI, Railway UI, Railway service config modification | NOT authorized |
| Discord activation (gateway login, channel message send) | NOT authorized |
| DB writes | NOT authorized |
| Kraken API actions | NOT authorized |
| env / secrets touch | NOT authorized |
| Trading actions (paper or live) | NOT authorized |
| `MANUAL_LIVE_ARMED` toggle | NOT authorized |
| Autopilot activation | NOT authorized |
| `CEILING-PAUSE` change | NOT authorized |
| Relay repo source edits | NOT authorized |
| npm / node / test execution | NOT authorized |
| Fresh approvals | NONE consumed by this SPEC |

Sealed Gate 10 install approval at `40f3137e…` remains CONSUMED and non-reusable. Any next deployment / Stage 5 re-open / Stages 7-10b / `RAILWAY-DEPLOY-PLAN` action remains separately gated and unauthorized. Implementation, deployment, Railway, Discord activation, Relay activation, Stage 5, Stages 7-10b, DB, Kraken, env/secrets, trading, `MANUAL_LIVE_ARMED`, Autopilot, CEILING-PAUSE all remain NOT authorized. **Relay runtime DORMANT.** Autopilot DORMANT. Deployment NOT authorized.

Approvers exactly `{Victor}`. Codex review verdicts do NOT constitute operator approval at any boundary.

## §8 Codex review placeholder

A separate Codex DOCS-ONLY review will be dispatched after this SPEC file is authored and the 3 parent status-doc updates are prepared in the working tree, before commit. The review will verify:

1. The SPEC inherits sealed RUNBOOK-DESIGN content by reference without duplication or contradiction.
2. The post-deploy-blocker delta (§6) accurately reflects the 4 sealed implementations.
3. No deploy-authorization language appears anywhere in the SPEC.
4. Non-authorization clauses are complete and consistent with the session-canonical consolidated form.
5. Approvers list is exactly `{Victor}`.
6. No Relay-repo touch is implied.

Round-1 verdict + Codex companion ID will be recorded here at codification seal. Operator override remains available for grep-pattern false positives per session precedent.

(Placeholder — to be filled by post-review codification update.)

## §9 Carry-forward state

After this SPEC seals:

- Parent HEAD advances from `9f5aeeb9e35cbb9465ed0a73aa832a4b4cf63788` to the SPEC codification commit (placeholder).
- Relay HEAD remains at `f32be3a1a55c31b8587df745edc50cd3cf71b0ea` (no Relay-repo touch).
- All 4 deploy-blocker implementations remain sealed.
- All sealed grounding records remain unchanged.
- Authorized untracked carve-outs remain: `orchestrator/handoffs/evidence/`, `position.json.snap.20260502T020154Z`.
- Relay runtime DORMANT.
- Autopilot DORMANT.
- Deployment NOT authorized.
- Stage 5 install state: unchanged (Gate 10 CONSUMED; resumption requires fresh Gate 10).
- Stages 7-10b: unchanged (NOT STARTED, separately gated).
- Sealed Gate 10 install approval at `40f3137e…` remains CONSUMED and non-reusable.
- Approvers exactly `{Victor}`.

Next recommended phase (NOT opened, NOT authorized by this SPEC): `RAILWAY-DEPLOY-PLAN-DESIGN` — a DESIGN-ONLY (Mode 2) phase that composes the post-deploy-blocker SPEC inheritance plus the sealed READINESS / PREFLIGHT / RUNBOOK anchors into a per-deploy plan, still without deploying.

## §10 Reference anchors

| Reference | Anchor |
|---|---|
| This SPEC commit | `<DEPLOYMENT-RUNBOOK-SPEC commit SHA>` (set at codification seal) |
| Parent baseline before SPEC | `9f5aeeb9e35cbb9465ed0a73aa832a4b4cf63788` (`RAILWAY-RUN-CONFIG-IMPLEMENT-CLOSEOUT-SYNC`) |
| Relay baseline | `f32be3a1a55c31b8587df745edc50cd3cf71b0ea` (`EGRESS-ALLOWLIST-IMPLEMENT`) |
| Sealed RUNBOOK-DESIGN | `orchestrator/handoffs/COMM-HUB-RELAY-RUNTIME-DEPLOYMENT-RUNBOOK-DESIGN.md` |
| Sealed DEPLOYMENT-PREFLIGHT-DESIGN | `orchestrator/handoffs/COMM-HUB-RELAY-RUNTIME-DEPLOYMENT-PREFLIGHT-DESIGN.md` |
| Sealed DEPLOYMENT-READINESS-DESIGN | `orchestrator/handoffs/COMM-HUB-RELAY-RUNTIME-DEPLOYMENT-READINESS-DESIGN.md` |
| Sealed START-SCRIPT-IMPLEMENT | Relay `8913f084…` / parent `d37448f25…` |
| Sealed CONFIG-INJECTION-IMPLEMENT | Relay `acdafe87…` / parent `0a5e258b1cef8354dedff74ca4d15f9e677d3fb6` |
| Sealed EGRESS-ALLOWLIST-IMPLEMENT | Relay `f32be3a1a55c31b8587df745edc50cd3cf71b0ea` / parent `175dd0dc4…` |
| Sealed RAILWAY-RUN-CONFIG-IMPLEMENT | parent `cd411941ac2d793691cf75cb9192d1a41201028a` (Option A paperwork-attestation; zero Relay-side commits) |
| Sealed CLOSEOUT-SYNC | parent `9f5aeeb9e35cbb9465ed0a73aa832a4b4cf63788` |
| Sealed Gate 10 install approval (CONSUMED) | `40f3137e…` |
| Approvers | exactly `{Victor}` |
