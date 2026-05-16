# COMM-HUB-RELAY-RUNTIME-CONFIG-INJECTION-DESIGN

**Status:** Permanent SAFE-class handoff record codified at parent commit `<CONFIG-INJECTION-DESIGN-SPEC commit SHA>` (set at codification seal).
**Phase mode (when authored):** Mode 2 DESIGN-ONLY (conversation-only).
**Phase mode (codification):** Mode 3 DOCS-ONLY (this handoff).
**Sealed grounding:** sealed DEPLOYMENT-RUNBOOK-DESIGN at parent `895643a…` + sealed DEPLOYMENT-PREFLIGHT-DESIGN at parent `a9d1a31…` + sealed DEPLOYMENT-READINESS-DESIGN at parent `02e0796…` + sealed G-DESIGN at `66af7df…` + APPROVAL-GATES + COMM-HUB-RELAY-RULES + sealed Relay `src/index.js` (operatorPhaseId NOT read from `process.env` per RE-9 + Phase F §9) + sealed Relay `src/runtime/boot.js` (Stage 13 rateLimitState fail-closed; line 134 destructure; line 458 call site) + sealed Relay `src/runtime/rate-limit-state.js` (factory throws `RateLimitStateError` with keyword `rate-limit-state-missing-operator-phase-id` if missing/empty) + sealed Relay `src/config.js:72-139` canonical forbidden-env blocklists + sealed Relay `src/config.js:203+` `isForbiddenEnvVar()` runtime detector.
**Pre-codification anchors:** parent HEAD `7be44cef8aa65e85c007291e1cb0211bbeebd705` (DEPLOYMENT-RUNBOOK-DESIGN-SPEC-CLOSEOUT-SYNC) + Relay HEAD `f232c328284e687511a794dc89358bbc0cd275d1` (G-5-RUN-10-REPAIR).
**Codex DESIGN-ONLY review chain:**
- Round 1 fresh: PASS WITH REQUIRED EDITS (3 corrections + §11 item 8 mirror; Codex agent ID `a4369d41462fcb725`).
- Round 2 resumed: FAIL — non-substantive / context-access only; `--resume` thread did not carry inline body forward (Codex agent ID `a48bee6f2f41d0cba`).
- Round 2 fresh: PASS WITH REQUIRED EDITS (1 internal-consistency fix in §9 header line; Codex agent ID `abe354a711f340f28`).
- Round 3 fresh: PASS WITH REQUIRED EDITS (1 literal-string flag in §7 disclaimer; operator chose Option C reword preserving the substantive disclaimer; Codex agent ID `aaae67514ce90b616`).
- Round 4 fresh: PASS — terminal verdict (Codex agent ID `ab5c3efb2d8522961`).

**Approvers exactly `{Victor}`.** Codex review verdicts do NOT constitute operator approval at any boundary.

This handoff is preserved verbatim through every subsequent config-injection subphase and never edited after codification.

---

## §0 Phase header and mode

- Phase: `COMM-HUB-RELAY-RUNTIME-CONFIG-INJECTION-DESIGN`
- Mode: DESIGN-ONLY / Mode 2 — conversation-only design; no files written; no commits; no commands beyond read-only inspection.
- Goal: Design a safe, non-env mechanism for injecting `operatorPhaseId` into the Relay runtime so deploy blocker #3 (`operatorPhaseId` non-env injection missing) can be lifted by a separately gated future implementation phase.
- Authority: Approvers exactly `{Victor}`. Codex review verdicts do NOT constitute operator approval.

---

## §1 Current repo anchors

- Parent HEAD: `7be44cef8aa65e85c007291e1cb0211bbeebd705` (DEPLOYMENT-RUNBOOK-DESIGN-SPEC-CLOSEOUT-SYNC)
- Relay HEAD: `f232c328284e687511a794dc89358bbc0cd275d1` (G-5-RUN-10-REPAIR)
- Relay status: clean
- Deployment-runbook design triad fully sealed through CLOSEOUT-SYNC
- Deployment: NOT authorized; Relay DORMANT; Autopilot DORMANT; Discord activation NO
- Phase G code completion: ACHIEVED at TAP 19/19/0/0
- RUN-10 + RUN-11 evidence: untracked

---

## §2 Problem statement

The Relay runtime requires a non-empty string `operatorPhaseId` at boot Stage 13 to construct `createRateLimitState({ operatorPhaseId, channelRateLimits })` (per `src/runtime/rate-limit-state.js:59`). Per sealed Phase F §9 + RE-9, this identifier MUST NOT be read from `process.env`. Per `src/index.js:10-18`, the current production entry point intentionally does not pass `operatorPhaseId`, so a production boot halts at Stage 13 with `rate-limit-state-missing-operator-phase-id` (halt class 20). The runbook DESIGN names this as deploy blocker #3 with an explicit STOP. To unblock, a sealed non-env injection mechanism is required.

---

## §3 Current `operatorPhaseId` dependency path

Verified by read-only grep across `src/`:

- `src/index.js:10-25` — entry point; explicitly does NOT pass `operatorPhaseId`.
- `src/runtime/boot.js:19` — Stage 13 docstring "rateLimitState (operatorPhaseId required; fail closed if missing)".
- `src/runtime/boot.js:39-40` — parameter docstring.
- `src/runtime/boot.js:62` — anti-feature "No raw process.env reads for ... operatorPhaseId (RE-9)".
- `src/runtime/boot.js:134` — `boot({ ..., operatorPhaseId, ... })` destructure.
- `src/runtime/boot.js:453-458` — Stage 13 call site `createRateLimitState({ operatorPhaseId, channelRateLimits })`.
- `src/runtime/rate-limit-state.js:11-22` — semantics: counter keyed by `(operatorPhaseId, channelName)`; restart preserves counters unless ID changes; reset = operator phase transition.
- `src/runtime/rate-limit-state.js:59-67` — factory throws `RateLimitStateError` with keyword `rate-limit-state-missing-operator-phase-id` if missing/empty.

Semantics: `operatorPhaseId` is an audit-visible, deterministic, non-secret string. Namespace key for in-process rate-limit counters. Changes only when operator declares a new phase.

---

## §4 Why this remains a deploy blocker

1. Sealed runtime invariant. `src/index.js` is sealed at Relay HEAD `f232c328…` and explicitly forbids env-based injection.
2. Canonical forbidden-env policy. Design discipline says non-secret runtime params don't belong in env regardless.
3. Audit-trail requirement. `operatorPhaseId` is operator-attested. Audit trail must live in a git-tracked artifact.

---

## §5 Proposed non-env injection design

Two-file pattern: committed manifest + sealed loader.

### §5.1 New file 1 — `config/operator-phase-id.json` (committed manifest)

Path: `config/operator-phase-id.json` at Relay repo root.
Contents (exact shape):

```json
{
  "operatorPhaseId": "<operator-supplied string>",
  "rotatedAt": "<UTC ISO-8601 timestamp ending in Z>",
  "rotatedFromParentSha": "<40-char lowercase parent commit SHA>",
  "notes": "<optional human-readable rotation rationale>"
}
```

Validation rules (enforced by loader):

- `operatorPhaseId` MUST be string length 1-128 matching `^[a-zA-Z0-9._-]+$` (no spaces, no slashes, no shell metacharacters, no newlines).
- `rotatedAt` MUST be valid ISO-8601 UTC.
- `rotatedFromParentSha` MUST be 40-character lowercase hex SHA.
- `notes` optional; if present, string of length ≤ 256.
- Extra fields rejected with `OperatorPhaseIdLoadError` keyword `operator-phase-id-load-failed`.

### §5.2 New file 2 — `src/runtime/operator-phase-id.js` (sealed loader)

Path: `src/runtime/operator-phase-id.js`.

Exports: `loadOperatorPhaseId({ manifestPath })` — side-effect-contained loader function; no module-load-time side effects; filesystem read occurs only inside this function. Returns `{ operatorPhaseId, rotatedAt, rotatedFromParentSha, notes }` on success; throws `OperatorPhaseIdLoadError` on validation failure.

Default `manifestPath`: path resolution is the caller's responsibility; loader does NOT bake in default path.

fs reads: `fs.readFileSync` inside the function body (allowed inside boot() runtime path; forbidden only at module-load).

Validation: JSON parse + schema check. On any failure, throws `OperatorPhaseIdLoadError` with `{ haltClass: 20, keyword: 'operator-phase-id-load-failed' }`.

Failure modes (each independently throws): manifest absent; not valid JSON; `operatorPhaseId` missing/not-string/empty/regex-violating/length>128; `rotatedAt` missing or malformed; `rotatedFromParentSha` missing or not 40-char hex; extra unknown fields present.

### §5.3 Modified file — `src/index.js`

Minimal modification (≤ 30 lines net): add import + canonical manifest path resolution (via `import.meta.url` + `node:path`) + try/catch + pass to `boot({operatorPhaseId})`. On loader failure: emit Tier-1 fallback structured JSON `{event:'boot-halt', haltClass:20, reason:'<keyword>'}` per RE-B and `process.exit(1)`.

Anti-features preserved: no process.env reads; no platform send-message API; no DB; no order placement; no env mutation; ES module syntax; single top-level invocation.

### §5.4 `boot.js` and `rate-limit-state.js` remain UNTOUCHED

Injection happens entirely through `src/index.js`. `boot.js` line 134 destructure and line 458 call site are unchanged. `rate-limit-state.js:59` factory unchanged.

### §5.5 Rotation procedure (out of scope for THIS implementation)

A future `COMM-HUB-RELAY-RUNTIME-OPERATOR-PHASE-ID-ROTATION` paperwork phase would update the manifest. Not authorized by this design.

---

## §6 Fail-closed behavior

Every failure path emits structured halt and exits non-zero with no Discord activity, no Railway state change, no partial counter state:

- Manifest missing / not JSON / `operatorPhaseId` missing or invalid / `rotatedAt` malformed / extra unknown fields → loader throws → `src/index.js` emits halt class 20 keyword `operator-phase-id-load-failed` → exit 1.
- Unexpected loader exception → `src/index.js` emits halt class 20 keyword `operator-phase-id-load-unexpected-error` → exit 1.
- Valid `operatorPhaseId` but rate-limit factory rejects (internal contradiction) → sealed `createRateLimitState` throws keyword `rate-limit-state-missing-operator-phase-id` (unchanged) → boot.js Stage 13 post-logger halt.

No silent fallback. No default value. No env-derived backup. No counter state leak — rate-limit counters constructed only after `operatorPhaseId` is validated.

---

## §7 Exact future implementation file scope (Relay-side)

| # | Path | Action | Approx. size |
|---|---|---|---|
| 1 | `config/operator-phase-id.json` | NEW (manifest) | ~10 lines |
| 2 | `src/runtime/operator-phase-id.js` | NEW (loader) | ~120 lines |
| 3 | `src/index.js` | MODIFY | +25 / -2 lines |
| 4-8 | `tests/smoke/<n>-operator-phase-id-load-*.test.js` × 5 | NEW | ~70-80 lines each |

Strictly NOT in scope (preserved sealed): `src/runtime/boot.js`, `src/runtime/rate-limit-state.js`, `src/config.js`, `schemas/hermes-message.schema.json`, `package.json`, `package-lock.json`, any sealed handoff, `APPROVAL-GATES.md`, `COMM-HUB-RELAY-RULES.md`.

Parent-repo paperwork (separate from Relay-side): 1 NEW handoff (`orchestrator/handoffs/COMM-HUB-RELAY-RUNTIME-CONFIG-INJECTION-DESIGN.md` — this handoff) + 3 status docs.

Future implementation classification: Mode 5 / HIGH-RISK IMPLEMENTATION, non-activation scope. This is not a low-risk safe-by-construction implementation; it modifies the sealed `src/index.js` entry point. It does not authorize deployment, Discord activation, real network reach, message publish, DB/Kraken/trading access, Autopilot, MANUAL_LIVE_ARMED, or CEILING-PAUSE changes.

---

## §8 Exact future test scope

Five new Node `node:test` smoke tests in `tests/smoke/`, each with strict non-activation guards (per established Phase G pattern):

- `load-success` — valid manifest → loader returns parsed object; boot proceeds past Stage 13 (will still halt downstream at Stage 15 G-3 because `allowlistedDiscordHostnames` is unsatisfied — confirms only Stage 13 passes).
- `load-missing` — manifest absent → halt class 20 + `operator-phase-id-load-failed` via ExitSentinel.
- `load-malformed` — invalid JSON → halt class 20 + `operator-phase-id-load-failed`.
- `load-empty` — `operatorPhaseId` is empty string → halt class 20 + `operator-phase-id-load-failed`.
- `load-invalid-regex` — `operatorPhaseId` contains space → halt class 20 + `operator-phase-id-load-failed`.

All tests use `tests/smoke/helpers/temp-tree.js` + `synthetic-runtime-config.js` + `network-observer.js`; hard-block real network via `observeNoNetwork`; `validateOnly: true` at any downstream Phase G touch point; manifest injected via tempdir (not via repo-tracked manifest); `--test-concurrency=1`.

Smoke test count delta: 19/19/0/0 → 24/24/0/0 (preserved 19 + 5 NEW).

---

## §9 Codex review checklist for the future implementation

A future Codex HIGH-RISK IMPLEMENTATION review over a Mode 5 non-activation phase should verify:

1. New manifest at `config/operator-phase-id.json` exists, contains exactly the 4 required fields plus no extra fields, and `operatorPhaseId` matches the regex.
2. New loader at `src/runtime/operator-phase-id.js` is side-effect-contained with no module-load-time side effects; the only filesystem read occurs inside `loadOperatorPhaseId({ manifestPath })`.
3. Loader's `OperatorPhaseIdLoadError` carries `{ haltClass: 20, keyword: 'operator-phase-id-load-failed' }`.
4. Loader validates: file exists, JSON parses, `operatorPhaseId` is a string matching the regex with length 1-128, `rotatedAt` is ISO-8601, `rotatedFromParentSha` is 40-char lowercase hex, no unknown extra fields.
5. `src/index.js` change is minimal: import + path resolution + try/catch + pass to `boot()`. No other behavior changes.
6. `src/index.js` Tier-1 fallback emits exact JSON shape `{event:'boot-halt', haltClass:20, reason:'<keyword>'}` per RE-B.
7. `src/runtime/boot.js` is untouched (byte-identical to Relay HEAD `f232c328…`).
8. `src/runtime/rate-limit-state.js` is untouched.
9. `src/config.js` is untouched (the loader does NOT extend env validation).
10. `package.json` / `package-lock.json` are untouched (no new dependency; loader uses `node:fs` + `node:path` + `node:url` only).
11. No raw `process.env` reads anywhere in the new code.
12. No top-level fs reads at module load.
13. No network reach, no Discord client construction, no DB client, no Kraken client.
14. No `dotenv` import or any env-loading library.
15. Initial committed `operatorPhaseId` value is operator-attested and recorded in the implementation phase's commit message.
16. The 5 smoke tests pass (TAP 5/5/0/0 added to existing 19/19/0/0 → 24/24/0/0).
17. Phase G non-activation guard (`validateOnly: true`) is preserved at boot.js Stage 15.
18. No ASCII-Unicode violations: no `→` (U+2192), no `§` (U+00A7) in new source comments.
19. No new `[ ]` checklist items in CHECKLIST.md beyond the implementation phase's own.
20. RUN-10 + RUN-11 evidence remains untracked at the implementation phase's seal.

---

## §10 Forbidden actions / non-authorization clauses

This DESIGN does NOT authorize: editing any file (Mode 2 conversation-only); creating any handoff (this codification SPEC creates this handoff; this DESIGN itself does not); committing/pushing; tests / `npm install` / `npm ci`; Relay repo edits; parent repo edits beyond sealed `7be44ce…`; editing `src/index.js`, `boot.js`, `rate-limit-state.js`, `src/config.js`, or any sealed source; adding any new dependency; deploy / Railway / Railway CLI / Railway UI; Discord platform action / bot / token / IDENTIFY / REST / publish; starting Relay; `.login()`; DB / Kraken / `MANUAL_LIVE_ARMED` / trading; Autopilot / CEILING-PAUSE changes; Stage 5 (CONSUMED at `40f3137e…`); Stages 7-10b; opening the implementation phase; opening peer sub-designs (`RELAY-RUNTIME-EGRESS-ALLOWLIST-DESIGN`, `RELAY-RUNTIME-OPERATOR-PHASE-ID-ROTATION-DESIGN`, `RAILWAY-DEPLOY-PLAN`, deploy-execution); authorizing runbook to fire; recursive paperwork beyond this design + codification + optional Rule-1 seal-mirror.

**Approvers exactly `{Victor}`.** Codex verdicts do NOT constitute operator approval.

---

## §11 Success criteria

12 criteria all satisfied by this design:

1. Non-env (zero process.env touch).
2. Git-tracked (committed manifest).
3. Fail-closed (every error path halts class 20 before rate-limit construction).
4. Does NOT widen src/config.js env policy.
5. No new dependencies.
6. Does NOT modify boot.js or rate-limit-state.js.
7. src/index.js change ≤ 30 lines net.
8. Loader has no module-load-time side effects; the only filesystem read occurs inside `loadOperatorPhaseId({ manifestPath })`.
9. Survives Railway restart (manifest part of deployed container).
10. Rotatable via separate future paperwork phase.
11. Does NOT lift the OTHER 3 deploy blockers.
12. Does NOT authorize deployment.

---

## §12 Recommended next phase

If this DESIGN-SPEC seals successfully:

1. **Optional Rule-1 seal-mirror** `COMM-HUB-RELAY-RUNTIME-CONFIG-INJECTION-DESIGN-SPEC-CLOSEOUT-SYNC` (DOCS-ONLY / Mode 3) — 3 parent-repo status-doc updates only.

**Explicitly NOT the next step:**

- `COMM-HUB-RELAY-RUNTIME-CONFIG-INJECTION-IMPLEMENT` (Mode 5 HIGH-RISK IMPLEMENTATION non-activation; separately gated open after DESIGN-SPEC seals).
- Any deploy execution / `RAILWAY-DEPLOY-PLAN` / Stage 5 / Stages 7-10b / Discord activation.
- Peer blocker designs (`RELAY-RUNTIME-EGRESS-ALLOWLIST-DESIGN`, the `scripts.start` / Railway run config phase).
- Any Railway CLI install / rename / config phase by Claude.

---

## §13 Carry-forward state

- Phase G code completion remains ACHIEVED at terminal RUN-11 PASS `19/19/0/0`.
- F-HALT-SMOKE end-state preserved at Phase G terminal `19/19/0/0`.
- RUN-10 evidence + RUN-11 evidence remain untracked and uncommitted at `orchestrator/handoffs/evidence/F-HALT-SMOKE-RUN-10/` + `F-HALT-SMOKE-RUN-11/` respectively (18 files each).
- Relay HEAD preserved at `f232c328284e687511a794dc89358bbc0cd275d1` (G-5-RUN-10-REPAIR seal).
- Relay working tree clean.
- Relay runtime code exists and is sealed, but no Relay container or process is deployed or running; Relay remains DORMANT.
- Autopilot DORMANT (verified at `eff4dd22…`) preserved.
- Discord activation: NO.
- Deployment: NOT authorized.
- Sealed Gate 10 install approval at `40f3137e…` remains CONSUMED and non-reusable.
- Carve-outs preserved untracked: `orchestrator/handoffs/evidence/` + `position.json.snap.20260502T020154Z`.
- Approvers exactly `{Victor}`.

---

## §14 Reference anchors

- Sealed DEPLOYMENT-RUNBOOK-DESIGN: `orchestrator/handoffs/COMM-HUB-RELAY-RUNTIME-DEPLOYMENT-RUNBOOK-DESIGN.md` (494 lines; sealed at parent `895643a…`).
- Sealed DEPLOYMENT-PREFLIGHT-DESIGN: `orchestrator/handoffs/COMM-HUB-RELAY-RUNTIME-DEPLOYMENT-PREFLIGHT-DESIGN.md` (384 lines; sealed at parent `a9d1a31…`).
- Sealed DEPLOYMENT-READINESS-DESIGN: `orchestrator/handoffs/COMM-HUB-RELAY-RUNTIME-DEPLOYMENT-READINESS-DESIGN.md` (416 lines; sealed at parent `02e0796…`).
- Sealed G-DESIGN: `orchestrator/handoffs/COMM-HUB-RELAY-RUNTIME-G-DESIGN.md` (sealed at parent `66af7df…`).
- APPROVAL-GATES: `orchestrator/APPROVAL-GATES.md` (out-of-scope for this design).
- COMM-HUB-RELAY-RULES: `orchestrator/COMM-HUB-RELAY-RULES.md` (out-of-scope for this design).
- Relay sealed source anchors: `package.json#engines.node`, `package.json#main`, `src/index.js` lines 10-18 (operatorPhaseId fail-closed), `src/runtime/boot.js` Stage 13 + Stage 15 default-wiring + `validateOnly: true` guard, `src/runtime/rate-limit-state.js:59` factory, `src/config.js:72-139` blocklists, `src/config.js:203+` `isForbiddenEnvVar()`.

---

**End of permanent SAFE-class handoff.**

This handoff is preserved verbatim through every subsequent config-injection subphase and never edited after codification. Approvers exactly `{Victor}`. Codex review verdicts do NOT constitute operator approval.
