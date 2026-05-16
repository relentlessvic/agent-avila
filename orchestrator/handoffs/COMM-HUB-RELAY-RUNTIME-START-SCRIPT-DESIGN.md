# COMM-HUB-RELAY-RUNTIME-START-SCRIPT-DESIGN

**Status:** Permanent SAFE-class handoff record codified at parent commit `<START-SCRIPT-DESIGN-SPEC commit SHA>` (set at codification seal).
**Phase mode (when authored):** Mode 2 DESIGN-ONLY (conversation-only).
**Phase mode (codification):** Mode 3 DOCS-ONLY (this handoff).
**Sealed grounding:** sealed EGRESS-ALLOWLIST-DESIGN at parent `5d0f030…` + sealed CONFIG-INJECTION-DESIGN at parent `7aa0ef9d…` + sealed DEPLOYMENT-RUNBOOK-DESIGN at parent `895643a…` + sealed DEPLOYMENT-PREFLIGHT-DESIGN at parent `a9d1a31…` + sealed DEPLOYMENT-READINESS-DESIGN at parent `02e0796…` + sealed G-DESIGN at `66af7df…` + APPROVAL-GATES + COMM-HUB-RELAY-RULES + sealed Relay `package.json` (no `scripts` section at Relay HEAD `f232c328…`; `main: "src/index.js"`; `type: "module"`; `engines.node: ">=22.0.0 <23.0.0"`; `dependencies: { "ajv": "8.20.0", "discord.js": "14.26.4", "pino": "9.14.0" }`; `private: true`) + sealed Relay `src/index.js` (entry point invoking `boot()` with no args) + sealed Relay `src/runtime/boot.js` + sealed Relay `tests/smoke/helpers/network-observer.js` (`observeNoNetwork()` defense-in-depth helper).
**Pre-codification anchors:** parent HEAD `da69413ba20129ae8756343b9cb0ab8c1691edca` (EGRESS-ALLOWLIST-DESIGN-SPEC-CLOSEOUT-SYNC) + Relay HEAD `f232c328284e687511a794dc89358bbc0cd275d1` (G-5-RUN-10-REPAIR).
**Codex DESIGN-ONLY review:** Round-1 fresh compact-packet PASS (20/20 review goals; no required edits; Codex companion subagent ID `a27dcde33347a0850`; Codex internal agent ID not exposed in this interface, reported as "Codex"). Operator applied 3 conversation-only corrections to the original draft prior to dispatch: (1) softened §4 Railway-fallback wording to "run command is not sealed or operator-attested"; (2) replaced "no runtime behavior impact" / "does NOT change runtime behavior" with "Does NOT change Relay application logic; it declares the existing entrypoint as the canonical start command"; (3) clarified §7.1 smoke test as static-only (reads package.json; asserts contract; must not invoke `npm start`, `node src/index.js`, `boot()`, Discord clients, or network code). Final Carry-forward note cleanup operator-applied.

**Approvers exactly `{Victor}`.** Codex review verdicts do NOT constitute operator approval at any boundary.

This handoff is preserved verbatim through every subsequent start-script subphase and never edited after codification.

---

## §0 Phase header and mode

- Phase: `COMM-HUB-RELAY-RUNTIME-START-SCRIPT-DESIGN`
- Mode: DESIGN-ONLY / Mode 2 — conversation-only design; no files written; no commits; no commands beyond read-only inspection.
- Goal: Design the safest minimal `scripts.start` addition to Relay `package.json` so deploy blocker #1 (missing `scripts.start`) can be lifted by a separately gated future implementation phase.
- Authority: Approvers exactly `{Victor}`. Codex review verdicts do NOT constitute operator approval.

---

## §1 Current repo anchors

- Parent HEAD: `da69413ba20129ae8756343b9cb0ab8c1691edca` (EGRESS-ALLOWLIST-DESIGN-SPEC-CLOSEOUT-SYNC)
- Relay HEAD: `f232c328284e687511a794dc89358bbc0cd275d1` (G-5-RUN-10-REPAIR; sealed and clean)
- CONFIG-INJECTION + EGRESS-ALLOWLIST designs codified
- Deployment NOT authorized; Relay DORMANT; Autopilot DORMANT; Discord activation NO
- Phase G code completion: ACHIEVED at TAP 19/19/0/0
- Authorized untracked carve-outs: `orchestrator/handoffs/evidence/` (whole directory) + `position.json.snap.20260502T020154Z`

---

## §2 Problem statement

Per sealed `COMM-HUB-RELAY-RUNTIME-DEPLOYMENT-RUNBOOK-DESIGN.md` §3 item 5: Relay's `package.json` has no `scripts` section. Without `scripts.start` or an equivalent declared run command via `railway.toml` / `nixpacks.toml` / `Dockerfile` / `Procfile`, no canonical sealed start invocation exists for this Relay service. The runbook codifies this as deploy blocker #1 with a STOP. To unblock, Relay `package.json` must declare a canonical `start` script that invokes the existing entry point with no env reads, no extra flags, no additional behavior.

---

## §3 Current package.json / entrypoint inspection

Verified read-only at Relay HEAD `f232c328…`:

**`package.json` (full content):**

```json
{
  "name": "agent-avila-relay",
  "version": "0.1.0",
  "description": "DORMANT-by-default one-way Discord publisher for Agent Avila status surfaces; never approval; never trading. See README.md.",
  "private": true,
  "license": "UNLICENSED",
  "author": "Victor Mercado",
  "type": "module",
  "engines": {
    "node": ">=22.0.0 <23.0.0"
  },
  "main": "src/index.js",
  "dependencies": {
    "ajv": "8.20.0",
    "discord.js": "14.26.4",
    "pino": "9.14.0"
  },
  "repository": {
    "type": "git",
    "url": "git+ssh://git@github.com/relentlessvic/agent-avila-relay.git"
  }
}
```

- `scripts` field: **absent**.
- `main: "src/index.js"` already declares the entry point.
- `type: "module"` → ESM.
- `engines.node: ">=22.0.0 <23.0.0"` → Node 22.x deploy-target.
- `private: true` → not publishable to npm (Relay is private).

**`src/index.js`:** Entry point that imports `boot` from `./runtime/boot.js` and invokes `boot()` with no arguments. Anti-features: no raw `process.env` reads; no platform send-message API; no network reach; no DB; no env mutation; ES module syntax; single top-level invocation.

**Relay repo root:** `LICENSE`, `node_modules`, `package-lock.json`, `package.json`, `README.md`, `schemas`, `src`, `tests`. **No** `railway.toml` / `railway.json` / `nixpacks.toml` / `Dockerfile` / `Procfile`.

---

## §4 Why missing `scripts.start` remains a deploy blocker

1. **Run command is not sealed or operator-attested.** Without `scripts.start` or an explicit Railway/Nixpacks/Docker/Procfile run command, the deploy run command is not sealed or operator-attested for this Relay service. This remains a blocker regardless of any platform inference behavior — even if Railway or another platform attempts to infer a run command, the deploy paperwork chain requires the canonical start invocation to be declared in a sealed, git-tracked manifest the operator has reviewed.
2. **No alternative declared run command.** No `railway.toml`, `nixpacks.toml`, `Dockerfile`, or `Procfile` declares a custom run command. Adding one of those would be a different design (peer blocker, not this one).
3. **Sealed runtime invariant.** `src/index.js` is the canonical entry per `package.json#main`. The start script must invoke it without adding new flags that affect runtime behavior.
4. **Operator-led config rather than runtime fix.** This blocker is fixable purely via a `package.json` manifest addition — no source code change, no new dependency, no env touch.

---

## §5 Proposed start script design

**Single-line `scripts.start` addition to `package.json`:**

```json
{
  "scripts": {
    "start": "node src/index.js"
  }
}
```

### §5.1 Rationale for `node src/index.js` (vs alternatives)

| Option | Command | Tradeoff |
|---|---|---|
| **A: Selected** | `node src/index.js` | Simplest. Matches `main` field. No extra flags. Declares the existing entry point as the canonical sealed start invocation. Identical to running locally without npm. |
| B (rejected) | `node --enable-source-maps src/index.js` | Adds source-map support. Operator can opt in via separate paperwork phase. |
| C (rejected) | `node --trace-warnings src/index.js` | Verbose Node warnings. Operator-decided later. |
| D (rejected) | Dispatcher script (`bin/start.js` etc.) | Adds new file and indirection. Not justified for one-line invocation. |
| E (rejected) | `npm start` wrapper alias | Recursive/redundant. |
| F (rejected) | Experimental Node flags | Not needed for current Relay code. |
| G (rejected) | `node --inspect ...` (debug) | Production must not expose debug ports. |
| H (rejected) | `NODE_ENV=production node src/index.js` (env prefix) | Sets env var, violating no-env-reads discipline. Relay's runtime does not branch on `NODE_ENV`. Railway sets env via its config UI, not via the start script. |

**Selected: Option A.** Minimal, canonical, declares the existing entrypoint as the canonical start command.

### §5.2 What this does NOT do

- Does NOT change Relay application logic (the same `boot()` call path runs).
- Does NOT add `NODE_ENV` or any other env var to the start command.
- Does NOT add a `--watch`, `--inspect`, `--require`, or `--loader` flag.
- Does NOT install any new dependency.
- Does NOT modify `src/index.js` or any source file.
- Does NOT modify `engines.node`.
- Does NOT add a `prestart` or `poststart` hook.
- Does NOT add a `test` script (operator-decided separately).
- Does NOT add a `build` step (Relay is ESM; no build needed).
- Does NOT add `npm-shrinkwrap.json`, `.npmrc`, `.nvmrc`, or any new manifest file.

### §5.3 Optional future additions (NOT in this scope)

These are explicitly OUT of scope for this DESIGN. Each would require its own separately gated paperwork phase if ever pursued:

- `scripts.test` — a canonical test command
- `scripts.prestart` — a pre-flight check
- `scripts.lint` — code linting
- `engines.npm` — npm version pin

This DESIGN narrowly addresses `scripts.start` only.

### §5.4 `package-lock.json` impact

Adding `scripts.start` to `package.json` does NOT require regenerating `package-lock.json` because:

- Lockfile tracks dependency tree + integrity hashes, not scripts.
- `npm install` won't regenerate lockfile if dependencies + lockfileVersion are unchanged.

The implementation phase must verify `package-lock.json` is byte-identical pre- and post-edit. If npm `install` runs (which it should NOT during the implementation phase per Mode 5 non-activation discipline), lockfile drift must be reverted.

---

## §6 Exact future implementation file scope (Relay-side)

| # | Path | Action | Approx. size |
|---|---|---|---|
| 1 | `package.json` | MODIFY (add `scripts` field with single `start` key) | +3 / -0 lines |
| 2 | `tests/smoke/<n>-package-json-start-script.test.js` | NEW (static-only smoke test) | ~40-50 lines |

**Strictly NOT in scope (preserved sealed):**

- `src/runtime/boot.js`
- `src/runtime/rate-limit-state.js`
- `src/gateway/egress-allowlist-hook.js`
- `src/gateway/phase-g-send-and-record.js`
- `src/verify/network-anomaly.js`
- `src/index.js`
- `src/config.js`
- `schemas/hermes-message.schema.json`
- `package-lock.json` (must remain byte-identical pre/post)
- Any sealed handoff
- `APPROVAL-GATES.md` / `COMM-HUB-RELAY-RULES.md`
- All other `src/` files

**Future implementation classification:** Mode 5 / HIGH-RISK IMPLEMENTATION, non-activation scope. Modifying the sealed Relay `package.json` falls under the established Mode 5 discipline for any sealed-source touch. The change does NOT change Relay application logic; it declares the existing entrypoint as the canonical start command. It is not a low-risk safe-by-construction implementation in the policy sense; it modifies a sealed Relay manifest file. It does NOT authorize deployment, Discord activation, real network reach, message publish, DB/Kraken/trading access, Autopilot, `MANUAL_LIVE_ARMED`, or CEILING-PAUSE changes.

**Parent-repo paperwork (separate from Relay-side):** 1 NEW handoff (this handoff) + 3 status docs via this DESIGN-SPEC codification phase.

---

## §7 Exact future verification scope

### §7.1 Smoke test (static-only)

The `package-json-start-script` smoke test is **static-only**. It reads `package.json` via `fs.readFileSync` at test time, parses the JSON, and asserts the start-script contract via deep-equality and exact-string comparisons:

- `package.scripts.start === "node src/index.js"` (exact string match).
- `package.scripts` has exactly 1 key (`start`); no `test`, no `prestart`, no `poststart`, no `build`, no other.
- `package.main === "src/index.js"` is unchanged.
- `package.type === "module"` is unchanged.
- `package.engines.node === ">=22.0.0 <23.0.0"` is unchanged.
- `package.dependencies` is byte-identical to a pre-edit snapshot (deep equality).
- No new top-level keys beyond the pre-existing set + the new `scripts` key.

**The test must NOT invoke `npm start`, `node src/index.js`, `boot()`, any Discord client, `createDiscordClient`, `.login()`, gateway IDENTIFY, REST send, or any network code.** It is a pure file-read + JSON-parse + assertion test. The test uses `tests/smoke/helpers/network-observer.js` `observeNoNetwork()` for defense-in-depth-block of any inadvertent network reach via the Node fs/JSON/test code path.

**Non-activation guards:** `observeNoNetwork()`; no `.login()`; no gateway IDENTIFY; no REST send; `--test-concurrency=1` per Phase G smoke discipline.

### §7.2 Static verification at implementation seal

The implementation phase's Codex review additionally verifies (without running anything):

- `package.json#scripts.start` exact string match: `"node src/index.js"`.
- `package.json#scripts` has exactly 1 key: `start`.
- `package-lock.json` byte-identical to Relay HEAD `f232c328…` baseline.
- `src/index.js` byte-identical to Relay HEAD `f232c328…` baseline.
- All other sealed source files byte-identical.
- No new dependency in `dependencies` or `devDependencies`.
- No `engines.node` change.
- No top-level field additions beyond `scripts`.

### §7.3 Verification phase explicitly does NOT include

- Running `npm start` (would invoke `boot()`).
- Running `npm install` (no dep change so unnecessary).
- Running `node --check src/index.js`.
- Any Railway test, real Discord test, or container build test.

---

## §8 Codex review checklist for the future implementation

A future Codex HIGH-RISK IMPLEMENTATION review over a Mode 5 non-activation phase should verify:

1. `package.json#scripts.start` exact string equals `"node src/index.js"`.
2. `package.json#scripts` has exactly 1 key (`start`); no other scripts added.
3. `package.json` has no other field additions, removals, or reorderings beyond the new `scripts` block.
4. `package.json#main` unchanged (`"src/index.js"`).
5. `package.json#type` unchanged (`"module"`).
6. `package.json#engines.node` unchanged (`">=22.0.0 <23.0.0"`).
7. `package.json#dependencies` byte-identical to Relay HEAD `f232c328…` (no new dep, no version change).
8. No `devDependencies` field added.
9. `package-lock.json` byte-identical to Relay HEAD `f232c328…` (no lockfile regeneration).
10. `src/index.js` byte-identical to Relay HEAD `f232c328…` (no source change).
11. All other `src/` files byte-identical.
12. `schemas/hermes-message.schema.json` byte-identical.
13. No `prestart`, `poststart`, `pretest`, `posttest` hooks added.
14. No `NODE_ENV` or any env var prefix on the start command.
15. No `--enable-source-maps`, `--trace-warnings`, `--inspect`, `--watch`, `--require`, `--loader`, or any other Node flag.
16. No new top-level manifest file added (`.nvmrc`, `.npmrc`, `nixpacks.toml`, `Procfile`, `Dockerfile`, `railway.toml`, `railway.json`).
17. The 1 new smoke test passes (TAP 1/1/0/0 added).
18. Phase G non-activation guard (`validateOnly: true`) is preserved at boot.js Stage 15 (cross-checked).
19. No ASCII-Unicode violations: no `→` (U+2192), no `§` (U+00A7) in new source comments. (Smoke test comments must be ASCII-safe.)
20. No new `[ ]` checklist items in CHECKLIST.md beyond the implementation phase's own.
21. RUN-10 + RUN-11 evidence remains untracked at the implementation phase's seal.
22. No `npm install`, `npm ci`, `node --check`, or `npm start` execution during the implementation phase.

---

## §9 Forbidden actions / non-authorization clauses

This DESIGN does NOT authorize: editing any file (Mode 2 conversation-only); creating any handoff (this codification SPEC creates this handoff; this DESIGN itself does not); committing/pushing; tests / `npm install` / `npm ci` / `node --check` / `node` / `npm start`; Relay repo edits (write mode); parent repo edits beyond sealed `da69413…`; editing `src/index.js`, `boot.js`, `rate-limit-state.js`, `egress-allowlist-hook.js`, `phase-g-send-and-record.js`, `network-anomaly.js`, `src/config.js`, or any sealed source; adding any new dependency; adding `devDependencies`; regenerating `package-lock.json`; adding new manifest files (`.nvmrc`, `.npmrc`, `nixpacks.toml`, `Procfile`, `Dockerfile`, `railway.toml`, `railway.json`); deploy / Railway / Railway CLI / Railway UI; Discord platform action / bot / token / IDENTIFY / REST / publish; starting Relay; `.login()`; DB / Kraken / `MANUAL_LIVE_ARMED` / trading; Autopilot / CEILING-PAUSE changes; Stage 5 (CONSUMED at `40f3137e…`); Stages 7-10b; opening the implementation phase; opening peer sub-designs (`RELAY-RUNTIME-RAILWAY-RUN-CONFIG-DESIGN`, `RAILWAY-DEPLOY-PLAN`, deploy-execution); opening peer implementation phases (`CONFIG-INJECTION-IMPLEMENT`, `EGRESS-ALLOWLIST-IMPLEMENT`); real network reach; recursive paperwork beyond this design + codification + optional Rule-1 seal-mirror.

**Approvers exactly `{Victor}`.** Codex verdicts do NOT constitute operator approval.

---

## §10 Success criteria

12 criteria all satisfied by this design:

1. The proposed start command is exactly `node src/index.js` (matches `main`; no flags).
2. No env var is set or read via the start command.
3. No new dependency added.
4. No source file modified.
5. No new manifest file added.
6. `package-lock.json` preserved byte-identical.
7. Single new smoke test enforces all the above static checks.
8. Test is strictly non-activating (no network, no `.login()`, no `boot()` invocation).
9. Implementation classification is Mode 5 / HIGH-RISK IMPLEMENTATION non-activation scope (consistent with prior CONFIG-INJECTION + EGRESS-ALLOWLIST classifications).
10. Does NOT lift the OTHER 3 deploy blockers (`operatorPhaseId` non-env injection, `allowlistedDiscordHostnames` not populated, no Railway run config) — each remains separately gated.
11. Does NOT authorize deployment.
12. Does NOT change Relay application logic. It declares the existing entrypoint as the canonical start command. `npm start` invokes the same `boot()` call path that any existing direct invocation of `node src/index.js` would; the start script does not introduce or alter any code path in Relay's source.

---

## §11 Recommended next phase after design

If this DESIGN-SPEC seals successfully:

1. **Optional Rule-1 seal-mirror** `COMM-HUB-RELAY-RUNTIME-START-SCRIPT-DESIGN-SPEC-CLOSEOUT-SYNC` (DOCS-ONLY / Mode 3) — 3 parent-repo status-doc updates only.

**Explicitly NOT the next step:**

- `COMM-HUB-RELAY-RUNTIME-START-SCRIPT-IMPLEMENT` (Mode 5 HIGH-RISK IMPLEMENTATION non-activation; separately gated open after DESIGN-SPEC seals).
- `COMM-HUB-RELAY-RUNTIME-CONFIG-INJECTION-IMPLEMENT` or `COMM-HUB-RELAY-RUNTIME-EGRESS-ALLOWLIST-IMPLEMENT` (peer blocker implementation phases; independently gated).
- The remaining 1 deploy blocker (Railway run config: `railway.toml` / `nixpacks.toml` / `Dockerfile` / `Procfile` — independent operator-led future phase).
- Any deploy execution / `RAILWAY-DEPLOY-PLAN` / Stage 5 / Stages 7-10b / Discord activation.
- Any Railway CLI install / rename / config phase by Claude.

---

## §12 Carry-forward state

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

## §13 Reference anchors

- Sealed EGRESS-ALLOWLIST-DESIGN: `orchestrator/handoffs/COMM-HUB-RELAY-RUNTIME-EGRESS-ALLOWLIST-DESIGN.md` (sealed at parent `5d0f030…`).
- Sealed CONFIG-INJECTION-DESIGN: `orchestrator/handoffs/COMM-HUB-RELAY-RUNTIME-CONFIG-INJECTION-DESIGN.md` (sealed at parent `7aa0ef9d…`).
- Sealed DEPLOYMENT-RUNBOOK-DESIGN: `orchestrator/handoffs/COMM-HUB-RELAY-RUNTIME-DEPLOYMENT-RUNBOOK-DESIGN.md` (sealed at parent `895643a…`).
- Sealed DEPLOYMENT-PREFLIGHT-DESIGN: `orchestrator/handoffs/COMM-HUB-RELAY-RUNTIME-DEPLOYMENT-PREFLIGHT-DESIGN.md` (sealed at parent `a9d1a31…`).
- Sealed DEPLOYMENT-READINESS-DESIGN: `orchestrator/handoffs/COMM-HUB-RELAY-RUNTIME-DEPLOYMENT-READINESS-DESIGN.md` (sealed at parent `02e0796…`).
- Sealed G-DESIGN: `orchestrator/handoffs/COMM-HUB-RELAY-RUNTIME-G-DESIGN.md` (sealed at parent `66af7df…`).
- APPROVAL-GATES: `orchestrator/APPROVAL-GATES.md` (out-of-scope for this design).
- COMM-HUB-RELAY-RULES: `orchestrator/COMM-HUB-RELAY-RULES.md` (out-of-scope for this design).
- Relay sealed source anchors: `package.json` (no `scripts` field at Relay HEAD `f232c328…`), `src/index.js` (entry point), `tests/smoke/helpers/network-observer.js` (`observeNoNetwork()`).

---

**End of permanent SAFE-class handoff.**

This handoff is preserved verbatim through every subsequent start-script subphase and never edited after codification. Approvers exactly `{Victor}`. Codex review verdicts do NOT constitute operator approval.
