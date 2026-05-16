# COMM-HUB-RELAY-RUNTIME-RAILWAY-RUN-CONFIG-DESIGN

**Status:** Permanent SAFE-class handoff record codified at parent commit `<RAILWAY-RUN-CONFIG-DESIGN-SPEC commit SHA>` (set at codification seal).
**Phase mode (when authored):** Mode 2 DESIGN-ONLY (conversation-only).
**Phase mode (codification):** Mode 3 DOCS-ONLY (this handoff).
**Sealed grounding:** sealed START-SCRIPT-DESIGN at parent `acdd98c…` + sealed EGRESS-ALLOWLIST-DESIGN at parent `5d0f030…` + sealed CONFIG-INJECTION-DESIGN at parent `7aa0ef9d…` + sealed DEPLOYMENT-RUNBOOK-DESIGN at parent `895643a…` (§3 item 5 OR-clause) + sealed DEPLOYMENT-PREFLIGHT-DESIGN at parent `a9d1a31…` + sealed DEPLOYMENT-READINESS-DESIGN at parent `02e0796…` + sealed G-DESIGN at `66af7df…` + APPROVAL-GATES + COMM-HUB-RELAY-RULES + sealed Relay `package.json` (no `scripts` field at Relay HEAD `f232c328…`; `main: "src/index.js"`; `type: "module"`; `engines.node: ">=22.0.0 <23.0.0"`; `dependencies: { "ajv": "8.20.0", "discord.js": "14.26.4", "pino": "9.14.0" }`) + sealed Relay `src/index.js` (entry point invoking `boot()`).
**Pre-codification anchors:** parent HEAD `b6169eec45bdbb5a7c54169b19ee6e0d1da5006b` (START-SCRIPT-DESIGN-SPEC-CLOSEOUT-SYNC) + Relay HEAD `f232c328284e687511a794dc89358bbc0cd275d1` (G-5-RUN-10-REPAIR).
**Codex DESIGN-ONLY review chain:**
- Round 1 over-length: DENIED at tool-permission layer (no review performed).
- Round 2 fresh compact: PASS WITH REQUIRED EDITS (2 wording-completeness gaps in compact packet — Goal 8 Mode 5 / HIGH-RISK classification, Goal 12 next-phase naming). Both findings were compact-packet omissions, not design-body defects.
- Round 3 fresh compact: **PASS (12/12)** after adding the 2 required bullets (Codex companion subagent ID `a0a4ec283ede3c5cf`; Codex thread = Codex/GPT-5 session; internal agent ID not exposed).

Operator applied 3 conversation-only corrections to the original draft prior to dispatch:
1. Builder-neutral Railway wording — replaced Nixpacks-authoritative claims with: "Railway/Railpack may infer a start command from `package.json`, with `package.json#scripts.start` as the preferred explicit project-level declaration. This design does not rely on platform inference as authority."
2. "Final remaining deploy blocker" framing — replaced "deploy blocker #4" numbering.
3. Option A wording: "No additional Railway/Nixpacks/Docker/Procfile file is required if `package.json#scripts.start` is implemented and sealed. The sealed `scripts.start` field is the operator-attested run command. Any Railway/Railpack inference is treated as secondary behavior, not the governance source of truth."

**Approvers exactly `{Victor}`.** Codex review verdicts do NOT constitute operator approval at any boundary.

This handoff is preserved verbatim through every subsequent Railway-run-config subphase and never edited after codification.

---

## §0 Phase header and mode

- Phase: `COMM-HUB-RELAY-RUNTIME-RAILWAY-RUN-CONFIG-DESIGN`
- Mode: DESIGN-ONLY / Mode 2 — conversation-only design; no files written; no commits; no commands beyond read-only inspection.
- Goal: Design the safest Railway run-configuration strategy so the final remaining deploy blocker (Railway run config / sealed run-command attestation) can be resolved by a separately gated future implementation phase.
- Authority: Approvers exactly `{Victor}`. Codex review verdicts do NOT constitute operator approval.

---

## §1 Current repo anchors

- Parent HEAD: `b6169eec45bdbb5a7c54169b19ee6e0d1da5006b` (START-SCRIPT-DESIGN-SPEC-CLOSEOUT-SYNC)
- Relay HEAD: `f232c328284e687511a794dc89358bbc0cd275d1` (G-5-RUN-10-REPAIR; sealed and clean)
- CONFIG-INJECTION-DESIGN-SPEC + CLOSEOUT-SYNC sealed (parent `683115f1…`)
- EGRESS-ALLOWLIST-DESIGN-SPEC + CLOSEOUT-SYNC sealed (parent `da69413…`)
- START-SCRIPT-DESIGN-SPEC + CLOSEOUT-SYNC sealed (parent `b6169ee…`)
- Deployment NOT authorized; Relay DORMANT; Autopilot DORMANT; Discord activation NO
- Phase G code completion: ACHIEVED at TAP 19/19/0/0
- Authorized untracked carve-outs: `orchestrator/handoffs/evidence/` (whole directory) + `position.json.snap.20260502T020154Z`

---

## §2 Problem statement

Per sealed `COMM-HUB-RELAY-RUNTIME-DEPLOYMENT-RUNBOOK-DESIGN.md` §3 item 5: the runbook's pre-deploy state check requires either:

> "scripts.start exists in Relay package.json OR an equivalent declared run command exists in a sealed railway.toml / nixpacks.toml / Procfile at Relay HEAD."

Neither side of the OR-clause is currently satisfied at Relay HEAD `f232c328…`. The first half (`scripts.start`) will be satisfied by the future `COMM-HUB-RELAY-RUNTIME-START-SCRIPT-IMPLEMENT` phase (codified in DESIGN-SPEC at parent `acdd98c…` + CLOSEOUT-SYNC at `b6169ee…`). The second half (Railway/Nixpacks/Docker/Procfile config) is the subject of this design.

**Question:** is a sealed Railway run config required *in addition to* `scripts.start`, or does `scripts.start` alone satisfy the runbook §3 item 5 OR-clause?

---

## §3 Current Relay root / package inspection

Verified read-only at Relay HEAD `f232c328…`:

**Relay root contents:**
- `.gitignore`, `LICENSE`, `node_modules`, `package-lock.json`, `package.json`, `README.md`, `schemas/`, `src/`, `tests/`

**Railway / Nixpacks / Docker / Procfile presence check:**

| File | Present? |
|---|---|
| `railway.toml` | **NO** |
| `railway.json` | **NO** |
| `nixpacks.toml` | **NO** |
| `Dockerfile` | **NO** |
| `Procfile` | **NO** |
| `.dockerignore` | **NO** |
| `.railwayignore` | **NO** |

**`package.json` (full):**
- `name: "agent-avila-relay"`, `version: "0.1.0"`, `private: true`, `license: "UNLICENSED"`
- `type: "module"` → ESM
- `engines.node: ">=22.0.0 <23.0.0"` → Node 22.x deploy-target
- `main: "src/index.js"` → entry point
- `dependencies: { "ajv": "8.20.0", "discord.js": "14.26.4", "pino": "9.14.0" }`
- `scripts` field: **absent** (will be populated by future START-SCRIPT-IMPLEMENT phase)

---

## §4 Why missing Railway run config remains a deploy blocker

1. **Runbook §3 item 5 OR-clause.** Neither side of the OR-clause is satisfied at the current Relay HEAD.
2. **Sealed, operator-attested run command requirement.** Per the START-SCRIPT-DESIGN handoff §4 wording: "the deploy run command is not sealed or operator-attested for this Relay service" without either `scripts.start` or an explicit Railway/Nixpacks/Docker/Procfile config.
3. **Audit-trail requirement.** Whichever option is chosen, the canonical run invocation must be operator-attested and git-tracked.
4. **Operator decision-point.** Whether to add Railway-side config or rely on `scripts.start` alone is a deliberate design decision documented for audit trail.

---

## §5 Config strategy comparison

| Option | Action | Tradeoff |
|---|---|---|
| **A: Recommended** | **No additional Railway/Nixpacks/Docker/Procfile file is required if `package.json#scripts.start` is implemented and sealed.** | Single source of truth: `package.json#scripts.start` is the **sealed, operator-attested run command** delivered by START-SCRIPT-IMPLEMENT. Railway/Railpack may infer a start command from `package.json`, with `package.json#scripts.start` as the preferred explicit project-level declaration. This design does NOT rely on platform inference as authority; it treats `package.json#scripts.start` as the sealed, operator-attested run command. Any Railway/Railpack inference is treated as secondary behavior, not the governance source of truth. **Satisfies the runbook §3 item 5 OR-clause via the first half.** |
| B (rejected) | Add `nixpacks.toml` declaring `[start] cmd = "node src/index.js"` | Adds a second source of truth that must be kept in sync with `package.json#scripts.start`. Rotation requires editing two files. |
| C (rejected) | Add `railway.toml` declaring `[deploy] startCommand` | Railway-platform-specific config. Couples manifest to Railway (vs portable Node convention). |
| D (rejected) | Add `Procfile` (`web: node src/index.js`) | Heroku-style; duplicates `scripts.start`. |
| E (rejected) | Add `Dockerfile` | Maximum control, maximum surface area. Overkill for Node ESM with no native deps. |

### §5.1 Why Option A is recommended

1. **Single source of truth.** `package.json#scripts.start` is the canonical npm-convention way to declare a start command. The sealed `scripts.start` field is the operator-attested run command. Railway/Railpack may infer a start command from `package.json`, with `package.json#scripts.start` as the preferred explicit project-level declaration. This design does not rely on platform inference as authority. No second file needed.
2. **Minimal surface area.** Zero additional manifest files. Zero additional rotation surfaces.
3. **Sealed AND operator-attested.** The future START-SCRIPT-IMPLEMENT phase adds `scripts.start` to a sealed `package.json` via operator-approved commit. This IS the sealed, operator-attested run command.
4. **Portable.** No vendor lock-in to Railway's config format. If the operator ever migrates to a different platform, `scripts.start` works everywhere.
5. **`package.json#scripts.start` is the stable, portable Node/npm convention; Railway's current builder documentation recognizes start scripts as the primary Node start-command signal. The design relies on the sealed `scripts.start` declaration, not on undocumented platform fallback behavior.** Any Railway/Railpack inference is treated as secondary behavior, not the governance source of truth.
6. **Runbook §3 item 5 OR-clause is satisfied** by the first half once START-SCRIPT-IMPLEMENT lands. No additional Railway config is logically required.

### §5.2 When Option B-E might be considered (NOT in this design's scope)

- **Option B (`nixpacks.toml`)** would only be justified if (a) Railway/Nixpacks' default Node detection ever became unreliable, (b) the build command needs custom flags, or (c) the operator explicitly prefers an explicit declarative Railway-side config alongside `scripts.start`.
- **Option C (`railway.toml`)** would be justified only if Railway-platform-specific deploy settings (healthchecks, restart policies, region selection) are required. Relay has none currently.
- **Option D (`Procfile`)** is not justified; canonical Railway path does not require Heroku-style format.
- **Option E (`Dockerfile`)** would be justified only if Nixpacks' default Node image is insufficient. Relay has no native deps.

---

## §6 Recommended Railway run config design

**Selected: Option A — no additional Railway/Nixpacks/Docker/Procfile config.**

The runbook §3 item 5 OR-clause is satisfied by the START-SCRIPT-IMPLEMENT phase's addition of `scripts.start`. No separate Railway-side config file is required.

### §6.1 What this design says

- **No additional Railway/Nixpacks/Docker/Procfile file is required if `package.json#scripts.start` is implemented and sealed.** No file changes are required at Relay root for this blocker beyond the START-SCRIPT-IMPLEMENT change already covered by its own DESIGN-SPEC.
- **The sealed `scripts.start` field is the operator-attested run command.** `scripts.start === "node src/index.js"` (delivered by START-SCRIPT-IMPLEMENT) is the canonical sealed, operator-attested run command for this Relay service.
- **Railway/Railpack may infer a start command from `package.json`**, with `package.json#scripts.start` as the preferred explicit project-level declaration. This design does NOT rely on platform inference as authority; it treats `package.json#scripts.start` as the sealed, operator-attested run command. **Any Railway/Railpack inference is treated as secondary behavior, not the governance source of truth.**
- No Railway-platform-specific config (`railway.toml`, `railway.json`, `nixpacks.toml`, `Dockerfile`, `Procfile`) is committed to the Relay repo at this time.

### §6.2 Interaction with START-SCRIPT blocker

This design **logically depends on** START-SCRIPT-IMPLEMENT having landed (or being landed concurrently). The dependency chain:

1. `START-SCRIPT-IMPLEMENT` — adds `scripts.start: "node src/index.js"` to `package.json`.
2. `RAILWAY-RUN-CONFIG-IMPLEMENT` (this design's implementation phase) — **NO-OP at the Relay-side file level**. It is a paperwork-attestation phase that:
   - Verifies `scripts.start` is present at the named Relay SHA.
   - Verifies no `railway.toml` / `railway.json` / `nixpacks.toml` / `Dockerfile` / `Procfile` was added (preserving Option A).
   - Attests the design's Option A conclusion is consistent with the actual repo state.

**The RAILWAY-RUN-CONFIG-IMPLEMENT phase has no Relay-side commits.** It is parent-paperwork-only.

### §6.3 Operator override path (if Option A is rejected)

If during operator review the operator decides Option A is insufficient (e.g. wants belt-and-suspenders Railway-side config), the override path is:

1. Codex re-review with operator's chosen alternative (Option B is the next-safest).
2. RAILWAY-RUN-CONFIG-IMPLEMENT phase scope expands to: NEW `nixpacks.toml` (or chosen alternative) + 1 NEW smoke test verifying the file contents + the Codex review checklist.
3. The implementation classification stays Mode 5 / HIGH-RISK IMPLEMENTATION, non-activation scope.

---

## §7 Exact future implementation file scope (Relay-side)

### §7.1 Recommended (Option A)

**Zero Relay-side files modified or created.** The implementation phase is parent-paperwork-only.

The future `RAILWAY-RUN-CONFIG-IMPLEMENT` phase would have ZERO Relay-side commits. It is purely an attestation:
- Verify `scripts.start === "node src/index.js"` at the named Relay SHA (post-START-SCRIPT-IMPLEMENT).
- Verify no `railway.toml`, `railway.json`, `nixpacks.toml`, `Dockerfile`, `Procfile`, `.dockerignore`, `.railwayignore` exists at Relay root.
- Attest the Option A conclusion via parent-repo paperwork (CLOSEOUT-style).

**Parent-repo paperwork for the future IMPLEMENT phase:** 1 NEW handoff (`orchestrator/handoffs/COMM-HUB-RELAY-RUNTIME-RAILWAY-RUN-CONFIG-IMPLEMENT.md`) + 3 status-doc updates — 4-file parent-repo scope, no Relay-side touch.

**Future RAILWAY-RUN-CONFIG-IMPLEMENT remains Mode 5 / HIGH-RISK non-activation: paperwork-attestation only, with no Relay-side files modified, no Relay-side commits, no deployment, no Relay activation, and no Railway, Discord, npm, node, test, DB, Kraken, env/secrets, trading, Autopilot, CEILING-PAUSE, Stage 5, or Stages 7-10b action authorized.**

### §7.2 Alternative (Option B — if operator overrides)

If operator chooses Option B (`nixpacks.toml`):

| # | Path | Action | Approx. size |
|---|---|---|---|
| 1 | `nixpacks.toml` | NEW | ~10 lines |
| 2 | `tests/smoke/<n>-nixpacks-toml.test.js` | NEW (static-only) | ~50-60 lines |

Contents of `nixpacks.toml` (illustrative):

```toml
[phases.setup]
nixPkgs = ["nodejs_22"]

[phases.install]
cmds = ["npm ci --omit=dev"]

[start]
cmd = "node src/index.js"
```

**Strictly NOT in scope (preserved sealed) — both options:** all of `src/`, `schemas/`, `package.json` (already modified by START-SCRIPT-IMPLEMENT but byte-identical from this phase's perspective), `package-lock.json`, any sealed handoff, `APPROVAL-GATES.md`, `COMM-HUB-RELAY-RULES.md`.

---

## §8 Exact future verification scope

### §8.1 Option A — paperwork attestation only

The future `RAILWAY-RUN-CONFIG-IMPLEMENT` phase's Codex review verifies (static-only, read-only):

1. `package.json#scripts.start === "node src/index.js"` (after START-SCRIPT-IMPLEMENT).
2. No `railway.toml`, `railway.json`, `nixpacks.toml`, `Dockerfile`, `Procfile`, `.dockerignore`, or `.railwayignore` exists at Relay repo root.
3. `package-lock.json` byte-identical to its post-START-SCRIPT-IMPLEMENT baseline.
4. `src/index.js` byte-identical to Relay HEAD baseline.
5. No new dependency.
6. No env vars / secrets touched.
7. Runbook §3 item 5 OR-clause first half satisfied; second half intentionally NOT pursued per Option A.
8. Relay HEAD remains at post-START-SCRIPT-IMPLEMENT seal.
9. No tests / installs / npm / node / Railway / Discord / deploy actions during IMPLEMENT.

### §8.2 Option B — Nixpacks config smoke test (if operator overrides)

Additionally verify:
- `nixpacks.toml` exists at Relay root with exact required content.
- `nixpacks.toml#start.cmd === "node src/index.js"`.
- New smoke test passes (TAP 1/1/0/0 added; static-only: no `npm start`, no `node src/index.js`, no `boot()`, no Discord clients, no network).

### §8.3 Both options: explicitly NOT in scope

- Running `railway up`, `railway logs`, `railway status`, or any Railway CLI command.
- Touching Railway dashboard / UI.
- Running `npm install`, `npm start`, `node --check`, `node src/index.js`, or `boot()`.
- Any deploy attempt.
- Real Discord network reach.

---

## §9 Codex review checklist for the future implementation

A future Codex HIGH-RISK IMPLEMENTATION review over a Mode 5 non-activation phase should verify:

1. `package.json#scripts.start` exact string equals `"node src/index.js"` at the named post-START-SCRIPT-IMPLEMENT Relay SHA.
2. No `railway.toml` at Relay root.
3. No `railway.json` at Relay root.
4. No `nixpacks.toml` at Relay root (Option A) OR exact required content (Option B).
5. No `Dockerfile` at Relay root.
6. No `Procfile` at Relay root.
7. No `.dockerignore` at Relay root.
8. No `.railwayignore` at Relay root.
9. `package.json` byte-identical to its post-START-SCRIPT-IMPLEMENT baseline.
10. `package-lock.json` byte-identical.
11. `src/index.js` byte-identical to Relay HEAD baseline.
12. All other Relay source byte-identical.
13. No new dependency in `dependencies` or `devDependencies`.
14. Runbook §3 item 5 OR-clause first half is recorded as satisfied; second half is recorded as intentionally NOT pursued per Option A.
15. No tests / installs / npm / node / Railway / Discord / deploy actions during IMPLEMENT.
16. Parent-repo paperwork scope is exactly 4 files (1 NEW handoff + 3 status-doc updates).
17. No Relay-side commits in the IMPLEMENT phase (Option A).
18. Phase G non-activation guard (`validateOnly: true`) is preserved at boot.js Stage 15.
19. RUN-10 + RUN-11 evidence remains untracked.
20. Codex review verdicts do NOT constitute operator approval; approvers exactly `{Victor}`.
21. (Option B only) New smoke test is static-only; no network; passes 1/1/0/0.
22. (Option B only) `nixpacks.toml#start.cmd` exact string equals `"node src/index.js"`.

---

## §10 Forbidden actions / non-authorization clauses

This DESIGN does NOT authorize: editing any file (Mode 2 conversation-only); creating any handoff (this codification SPEC creates this handoff; this DESIGN itself does not); committing/pushing; tests / `npm install` / `npm ci` / `node --check` / `node` / `npm start`; Relay repo edits (write mode); parent repo edits beyond sealed `b6169ee…`; editing `src/index.js`, `boot.js`, or any sealed source; modifying `package.json` or `package-lock.json`; adding any new dependency; adding any new manifest file (`railway.toml`, `railway.json`, `nixpacks.toml`, `Dockerfile`, `Procfile`, `.dockerignore`, `.railwayignore`, `.nvmrc`, `.npmrc`) under Option A; deploy / Railway / Railway CLI / Railway UI / Railway service config modification; Discord platform action / bot / token / IDENTIFY / REST / publish; starting Relay; `.login()`; DB / Kraken / `MANUAL_LIVE_ARMED` / trading; Autopilot / CEILING-PAUSE changes; Stage 5 (CONSUMED at `40f3137e…`); Stages 7-10b; opening the implementation phase; opening peer IMPLEMENT phases; opening `RAILWAY-DEPLOY-PLAN`; real network reach; recursive paperwork beyond this design + codification + optional Rule-1 seal-mirror.

**Approvers exactly `{Victor}`.** Codex verdicts do NOT constitute operator approval.

---

## §11 Success criteria

12 criteria all satisfied by this design:

1. The recommendation (Option A: no extra Railway config) is clearly stated with rationale.
2. The five alternative options (B-E) are documented as rejected with explicit tradeoffs.
3. The dependency on START-SCRIPT-IMPLEMENT (which delivers `scripts.start`) is clearly stated.
4. The future IMPLEMENT phase is correctly scoped as paperwork-attestation-only (Option A) with zero Relay-side commits, OR as a 1-2 file Relay-side addition (Option B) if operator overrides.
5. No source file modified.
6. No new manifest file added at Relay root (under Option A).
7. The runbook §3 item 5 OR-clause is correctly identified as the gating condition; the first half (`scripts.start`) suffices.
8. Future RAILWAY-RUN-CONFIG-IMPLEMENT remains Mode 5 / HIGH-RISK non-activation scope.
9. Does NOT lift any of the 3 already-designed deploy blockers (`operatorPhaseId` non-env injection, `allowlistedDiscordHostnames` not populated, `scripts.start` missing).
10. Does NOT authorize deployment.
11. Does NOT change Relay application logic.
12. Operator-override path is documented for transparency.

---

## §12 Recommended next phase after design

If this DESIGN-SPEC seals successfully:

1. **Optional Rule-1 seal-mirror** `COMM-HUB-RELAY-RUNTIME-RAILWAY-RUN-CONFIG-DESIGN-SPEC-CLOSEOUT-SYNC` (DOCS-ONLY / Mode 3) — 3 parent-repo status-doc updates only.

**Explicitly NOT the next step:**

- `COMM-HUB-RELAY-RUNTIME-RAILWAY-RUN-CONFIG-IMPLEMENT` (paperwork-attestation Mode 5 phase OR file-adding Mode 5 phase depending on Option A vs B; separately gated open after DESIGN-SPEC seals).
- Any peer blocker IMPLEMENT phase (`CONFIG-INJECTION-IMPLEMENT`, `EGRESS-ALLOWLIST-IMPLEMENT`, `START-SCRIPT-IMPLEMENT`).
- Any deploy execution / `RAILWAY-DEPLOY-PLAN` / Stage 5 / Stages 7-10b / Discord activation.
- Any Railway CLI install / rename / config phase by Claude.

**Recommended next phase is only `COMM-HUB-RELAY-RUNTIME-RAILWAY-RUN-CONFIG-DESIGN-SPEC`, and only after separate operator approval.**

---

## §13 Carry-forward state

- Phase G code completion remains ACHIEVED at terminal RUN-11 PASS `19/19/0/0`.
- F-HALT-SMOKE end-state preserved at Phase G terminal `19/19/0/0`.
- RUN-10 evidence + RUN-11 evidence remain untracked and uncommitted (18 files each).
- Relay HEAD preserved at `f232c328284e687511a794dc89358bbc0cd275d1` (G-5-RUN-10-REPAIR seal); Relay working tree clean.
- Relay runtime code exists and is sealed, but no Relay container or process is deployed or running; Relay remains DORMANT.
- Autopilot DORMANT (verified at `eff4dd22…`) preserved.
- Discord activation: NO.
- Deployment: NOT authorized.
- Sealed Gate 10 install approval at `40f3137e…` remains CONSUMED and non-reusable.
- Carve-outs preserved untracked: `orchestrator/handoffs/evidence/` + `position.json.snap.20260502T020154Z`.
- Approvers exactly `{Victor}`.

---

## §14 Reference anchors

- Sealed START-SCRIPT-DESIGN: `orchestrator/handoffs/COMM-HUB-RELAY-RUNTIME-START-SCRIPT-DESIGN.md` (sealed at parent `acdd98c…`).
- Sealed EGRESS-ALLOWLIST-DESIGN: `orchestrator/handoffs/COMM-HUB-RELAY-RUNTIME-EGRESS-ALLOWLIST-DESIGN.md` (sealed at parent `5d0f030…`).
- Sealed CONFIG-INJECTION-DESIGN: `orchestrator/handoffs/COMM-HUB-RELAY-RUNTIME-CONFIG-INJECTION-DESIGN.md` (sealed at parent `7aa0ef9d…`).
- Sealed DEPLOYMENT-RUNBOOK-DESIGN: `orchestrator/handoffs/COMM-HUB-RELAY-RUNTIME-DEPLOYMENT-RUNBOOK-DESIGN.md` (sealed at parent `895643a…`; §3 item 5 OR-clause is the gating condition for this blocker).
- Sealed DEPLOYMENT-PREFLIGHT-DESIGN: `orchestrator/handoffs/COMM-HUB-RELAY-RUNTIME-DEPLOYMENT-PREFLIGHT-DESIGN.md` (sealed at parent `a9d1a31…`).
- Sealed DEPLOYMENT-READINESS-DESIGN: `orchestrator/handoffs/COMM-HUB-RELAY-RUNTIME-DEPLOYMENT-READINESS-DESIGN.md` (sealed at parent `02e0796…`).
- APPROVAL-GATES: `orchestrator/APPROVAL-GATES.md` (out-of-scope for this design).
- COMM-HUB-RELAY-RULES: `orchestrator/COMM-HUB-RELAY-RULES.md` (out-of-scope for this design).
- Relay sealed source anchors: `package.json` (no `scripts` field at Relay HEAD `f232c328…`), `src/index.js` (entry point), Relay root directory state (no Railway/Nixpacks/Docker/Procfile files at HEAD).

---

**End of permanent SAFE-class handoff.**

This handoff is preserved verbatim through every subsequent Railway-run-config subphase and never edited after codification. Approvers exactly `{Victor}`. Codex review verdicts do NOT constitute operator approval.
