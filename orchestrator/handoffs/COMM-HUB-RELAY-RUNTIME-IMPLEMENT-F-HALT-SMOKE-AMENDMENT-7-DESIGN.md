# COMM-HUB-RELAY-RUNTIME-IMPLEMENT-F-HALT-SMOKE-AMENDMENT-7-DESIGN

**This handoff codifies the Codex-approved (PASS WITH REQUIRED EDITS; RE1 evidence framing + RE2 halt-class assertion mechanism resolved verbatim below) conversation-only `COMM-HUB-RELAY-RUNTIME-IMPLEMENT-F-HALT-SMOKE-AMENDMENT-7-DESIGN` (Mode 2 / DESIGN-ONLY, no commit). This codification phase is `COMM-HUB-RELAY-RUNTIME-IMPLEMENT-F-HALT-SMOKE-AMENDMENT-7-DESIGN-SPEC` (DOCS-ONLY / Mode 3). The future implementation phase `COMM-HUB-RELAY-RUNTIME-IMPLEMENT-F-HALT-SMOKE-AMENDMENT-7` is SAFE IMPLEMENTATION (Mode 4) — separately gated; not authorized by this codification.**

**Codification provenance:** `F-HALT-SMOKE-RUN-6` (Mode 4 SAFE EXECUTION) at Relay `a62142a4…` produced a TAP tally of `13 total / 7 pass / 1 skip / 5 fail` against the sealed SCAFFOLD-REPAIR-DESIGN §5 expected `13 / 11 / 1 / 1`. The Mode 1 `RUN-6-FAILURE-AUDIT` (Codex Round 1 PASS WITH REQUIRED EDITS, tight 11-file allowlist re-dispatch) identified Layer 3 — a structural conflict between AMENDMENT-3 sealed-pending test fixture (`tests/smoke/helpers/temp-tree.js:30-31` chmods `pending/` to `0o555`) and the halt.js RE-4 post-halt cleanup contract (`src/runtime/halt.js:182-190` calls `store.moveToProcessed(filename)` after gate-pipeline halts; failure emits `moved:false, secondaryHaltClass:24` at `src/runtime/halt.js:198-211`). Cases 4, 5, 6, 11 fire their correct halt classes (29, 3, 7, 2) but then fail the cleanup rename because the test fixture sealed the directory before the boot pipeline observed the message — the same pattern that SCAFFOLD-REPAIR Path D already resolved for Cases 7 + 8 via non-boot direct gate-verifier tests. SCAFFOLD-REPAIR §1 analysis did not extend the non-boot rewrite to Cases 4, 5, 6, 11. This AMENDMENT-7 design closes that scope gap. A Codex DESIGN-ONLY review of this AMENDMENT-7-DESIGN returned PASS WITH REQUIRED EDITS — substantive design approved across 14 questions; two required edits applied verbatim in this codification: RE1 (evidence framing — separate Relay-repo on-disk source citations from operator-provided parent-repo RUN-6 evidence preserved under the untracked evidence carve-out) and RE2 (halt-class assertion mechanism — direct verifier APIs return `{ ok: false, errors: [...] }` and tests assert halt class via `errors[0].haltClass` or the exact equivalent verifier error field). Codex also recommended that AMENDMENT-7-DESIGN be codified as a parent-repo DESIGN-SPEC handoff (this file) before Mode 4 SAFE IMPLEMENTATION, consistent with AMENDMENT-5 + AMENDMENT-6 + SCAFFOLD-REPAIR precedent; Codex DESIGN-ONLY verdict Q13 explicitly stated that an external Gemini architecture review is NOT required for this narrow test-scaffolding rewrite. **This file does NOT itself constitute an execution authorization. Codex review verdicts are not operator approval.** Approvers exactly `{Victor}`.

---

## §0 — Phase classification & current anchors

| Property | Value |
|---|---|
| Phase name (this codification phase) | `COMM-HUB-RELAY-RUNTIME-IMPLEMENT-F-HALT-SMOKE-AMENDMENT-7-DESIGN-SPEC` |
| Phase mode (this codification phase) | Mode 3 / DOCS-ONLY |
| Original phase name (codified design) | `COMM-HUB-RELAY-RUNTIME-IMPLEMENT-F-HALT-SMOKE-AMENDMENT-7-DESIGN` |
| Original phase mode | Mode 2 / DESIGN-ONLY (conversation-only; no commit) |
| Parent-repo HEAD anchor | `c7f92a78a1627a611dc4293a86407868ec0586fd` (AMENDMENT-6-CLOSEOUT sealed) |
| Relay-repo HEAD anchor | `a62142a46576189c1aaa7a6dc14fb8ec3beaa170` (AMENDMENT-6 SAFE IMPLEMENTATION sealed; Layer 2 object-map guard applied) |
| Pre-AMENDMENT-7-DESIGN Relay anchor | `a62142a46576189c1aaa7a6dc14fb8ec3beaa170` (AMENDMENT-6) |
| Sealed AMENDMENT-6-DESIGN handoff | parent `b880be9bb8cc088bd3d66deb04dfa2a5338ece12` (untouched) |
| Sealed AMENDMENT-5-DESIGN handoff | parent `0e9a678e9bd215826953cd8f9444eec9dbbbdd27` (untouched) |
| Sealed SCAFFOLD-REPAIR-DESIGN handoff | parent `31ea6f5f0f5e6409c33f4a6a8c62939eb50aee7a` (untouched) |
| Sealed F-HALT-SMOKE-RUN-DESIGN handoff | parent `5acac86b521b8e3783b43018d4091194316e7a61` (untouched) |
| Sealed F-HALT-SMOKE-AMENDMENT-2-DESIGN handoff | parent `c642b2b73276580d4c30d0c26337e335f8c24cc2` (untouched) |
| Future implementation phase (gated; NOT authorized) | `COMM-HUB-RELAY-RUNTIME-IMPLEMENT-F-HALT-SMOKE-AMENDMENT-7` (Mode 4 SAFE IMPLEMENTATION) |
| Future re-execution phase (gated; NOT authorized) | `COMM-HUB-RELAY-RUNTIME-IMPLEMENT-F-HALT-SMOKE-RUN-7` (Mode 4 SAFE EXECUTION; requires AMENDMENT-7 sealed) |
| Parent repo working tree at codification time | the 4 AMENDMENT-7-DESIGN-SPEC docs are present as uncommitted on-disk changes alongside the two authorized untracked carve-outs (`position.json.snap.20260502T020154Z` + `orchestrator/handoffs/evidence/`); no other tracked file modified |
| Relay repo working tree at codification time | clean |
| Relay-runtime status | DORMANT preserved |
| Autopilot status | DORMANT preserved (verified at `eff4dd22…`) |
| Approvers | exactly `{Victor}` |

---

## §1 — Evidence sources (RE1 resolution)

This handoff cites two evidence categories. They are deliberately segregated because Codex round-1 DESIGN-ONLY review flagged the original framing for conflating on-disk Relay source citations with operator-provided parent-repo run evidence.

### §1.1 — Relay-repo on-disk source citations (audit-confirmed; file:line grounded)

These citations refer to source/test/helper files on disk in `/Users/victormercado/code/agent-avila-relay` at Relay HEAD `a62142a46576189c1aaa7a6dc14fb8ec3beaa170`.

| Location | Content |
|---|---|
| `tests/smoke/helpers/temp-tree.js:30-31` | `sealPending()` chmods the pending directory to `0o555` (read+execute, no write) — sealed AMENDMENT-3 fixture for DP-5 hardening compliance. |
| `tests/smoke/04-gate-1-schema-mismatch-halt.test.js:45-49` | `await tempTree.sealPending();` callsite. |
| `tests/smoke/04-gate-1-schema-mismatch-halt.test.js:62-65` | `assert.equal(pendingFiles.length, 0);` and `assert.equal(processedFiles.length, 1);` post-halt assertions. |
| `tests/smoke/05-gate-2-channel-allowlist-halt.test.js:44-48` | `await tempTree.sealPending();` callsite. |
| `tests/smoke/05-gate-2-channel-allowlist-halt.test.js:60-61` | post-halt `pendingFiles.length === 0` assertion. |
| `tests/smoke/06-gate-5-idempotency-collision-halt.test.js:55-59` | `await tempTree.sealPending();` callsite. |
| `tests/smoke/06-gate-5-idempotency-collision-halt.test.js:71-72` | post-halt `pendingFiles.length === 0` assertion. |
| `tests/smoke/11-op-auth-staleness-halt.test.js:47-51` | `await tempTree.sealPending();` callsite. |
| `tests/smoke/11-op-auth-staleness-halt.test.js:63-64` | post-halt `pendingFiles.length === 0` assertion. |
| `src/runtime/halt.js:24-28` | RE-4 documented contract: "After a gate-pipeline halt fires, `store.moveToProcessed` MUST be invoked so the pending file is moved to `processed/` even though the halt path short-circuits normal completion." |
| `src/runtime/halt.js:182-190` | `await store.moveToProcessed(filename);` invocation after halt classification. |
| `src/runtime/halt.js:198-211` | failure branch emits `moved:false, secondaryHaltClass:24` when the rename throws. |
| `src/store/source-of-truth.js:181-184` | `await fsp.rename(pendingPath, processedPath);` (the rename that fails when `pending/` is sealed at `0o555`). |
| `src/store/source-of-truth.js:185-190` | rename failure wrapped as `StoreError(haltClass: 24, reason: \`rename-failed: ${error.code}\`)`. |
| `src/store/source-of-truth.js:263-276` | Phase D DP-5 hardening — fails boot if `W_OK` on `pending/` succeeds (preserved verbatim; not modified by AMENDMENT-7). |
| `src/verify/schema-validator.js:119-128` | AMENDMENT-5 `ajv.addFormat('date-time', () => true);` polyfill (preserved verbatim). |
| `src/verify/schema-validator.js:147-173` | `validate(message)` returns `{ ok: false, errors }` shape used by AMENDMENT-7 non-boot tests. |
| `src/verify/channel-allowlist.js:39-40` | canonical object-map contract documentation. |
| `src/verify/channel-allowlist.js:52-77` | `verify(message)` returns `{ ok: false, errors }` shape used by AMENDMENT-7 non-boot tests. |
| `src/verify/idempotency.js:61-91` | `verify(message)` returns `{ ok: false, errors }` shape used by AMENDMENT-7 non-boot tests. |
| `src/verify/operator-authorization.js:106-148` | `verify(message)` returns `{ ok: false, errors }` shape used by AMENDMENT-7 non-boot tests. |
| `src/runtime/boot.js:360-371` | AMENDMENT-6 object-map guard (preserved verbatim). |
| `tests/smoke/07-halt-publish-log-append.test.js` | sealed SCAFFOLD-REPAIR Path D non-boot precedent — shape model for AMENDMENT-7 rewrites. |
| `tests/smoke/08-pending-move-after-halt.test.js` | sealed SCAFFOLD-REPAIR Path D non-boot precedent — shape model for AMENDMENT-7 rewrites. |
| `tests/smoke/helpers/synthetic-message.js` | sealed builder factories (`buildSchemaInvalidMessage`, `buildChannelDisallowedMessage`, `buildStaleApprovalMessage`, etc.). |
| `tests/smoke/helpers/synthetic-runtime-config.js` | sealed `schemaPath` + object-map `allowedChannels` (preserved verbatim). |

### §1.2 — Operator-provided parent-repo RUN-6 evidence (untracked evidence carve-out)

These citations refer to the RUN-6 TAP output file preserved at `/Users/victormercado/claude-tradingview-mcp-trading/orchestrator/handoffs/evidence/F-HALT-SMOKE-RUN-6/tap-run-1.txt`. This file is **operator-provided parent-repo RUN-6 evidence preserved under the untracked evidence carve-out — NOT Relay-repo on-disk evidence.** It is part of the 2 authorized untracked carve-outs in the parent repo (alongside `position.json.snap.20260502T020154Z`).

| Operator-provided parent-repo RUN-6 evidence (untracked carve-out) | Content |
|---|---|
| `evidence/F-HALT-SMOKE-RUN-6/tap-run-1.txt:23` | Case 4 halt-class-29 fire line. |
| `evidence/F-HALT-SMOKE-RUN-6/tap-run-1.txt:24-25` | Case 4 cleanup failure (`moved:false, secondaryHaltClass:24`) and TAP fail marker. |
| `evidence/F-HALT-SMOKE-RUN-6/tap-run-1.txt:47` | Case 5 halt-class-3 fire line. |
| `evidence/F-HALT-SMOKE-RUN-6/tap-run-1.txt:48-49` | Case 5 cleanup failure + TAP fail marker. |
| `evidence/F-HALT-SMOKE-RUN-6/tap-run-1.txt:71` | Case 6 halt-class-7 fire line. |
| `evidence/F-HALT-SMOKE-RUN-6/tap-run-1.txt:72-73` | Case 6 cleanup failure + TAP fail marker. |
| `evidence/F-HALT-SMOKE-RUN-6/tap-run-1.txt:139` | Case 11 halt-class-2 fire line. |
| `evidence/F-HALT-SMOKE-RUN-6/tap-run-1.txt:140-141` | Case 11 cleanup failure + TAP fail marker. |
| `evidence/F-HALT-SMOKE-RUN-6/tap-run-1.txt:166-172` | RUN-6 final TAP tally `13 / 7 / 1 / 5`. |

These TAP citations are NOT on-disk evidence within the Relay repo. They are external operator-provided artifacts stored in the parent-repo untracked carve-out. AMENDMENT-7 design conclusions about Cases 4, 5, 6, 11 cleanup failure are corroborated by §1.1 on-disk source mechanics (sealPending + RE-4 contract + `fsp.rename` failure wrap = halt class 24).

---

## §2 — Layer 3 root cause

Cases 4, 5, 6, 11 are boot-path smoke tests: each writes a synthetic message into `pending/`, calls `tempTree.sealPending()` to chmod `pending/` to `0o555`, then invokes `boot()` which advances through gate verification, fires the expected halt class, and per RE-4 contract calls `store.moveToProcessed(filename)` for post-halt cleanup. The cleanup rename fails because the directory is sealed read-only, `fsp.rename` throws `EACCES`, `source-of-truth.js:185-190` wraps the failure as `StoreError(haltClass: 24, reason: rename-failed: EACCES)`, and `halt.js:198-211` emits the secondary halt observation `moved:false, secondaryHaltClass:24`. The TAP framework then records the test as failed because both the primary halt-class assertion AND the post-halt cleanup must succeed for the test to pass.

The conflict is structural: the AMENDMENT-3 sealed-pending fixture exists to verify the DP-5 boot-time hardening (`src/store/source-of-truth.js:263-276` fails boot if `W_OK` succeeds on `pending/`), but the RE-4 post-halt cleanup contract requires write access to the same directory to perform the rename. Both are sealed canonical contracts (RE-4 documented at `halt.js:24-28`; AMENDMENT-3 sealed for DP-5 compliance). The conflict cannot be resolved by relaxing either contract without breaking sealed runtime safety. The resolution must come from the test layer.

SCAFFOLD-REPAIR Path D already solved this for Cases 7 + 8 by rewriting those tests as non-boot direct gate-verifier invocations that bypass `boot()` and bypass `halt.js` cleanup entirely. The SCAFFOLD-REPAIR §1 analysis did not identify Cases 4, 5, 6, 11 as also requiring this approach because the failure mode only surfaces after AMENDMENT-5 (Layer 1) and AMENDMENT-6 (Layer 2) unblock the boot pipeline far enough to reach the halt.js cleanup step. AMENDMENT-7 extends the Path D pattern to Cases 4, 5, 6, 11.

---

## §3 — Recommended option D1 (preferred)

Rewrite Cases 4, 5, 6, 11 as non-boot direct gate-verifier tests that bypass `boot()`, bypass `halt.js` cleanup, bypass `moveToProcessed()`, and bypass all pending/processed file-movement assertions. Each rewritten test directly invokes the relevant gate-verifier factory, calls `verify(builtMessage)` with a sealed synthetic-message builder, and asserts the `{ ok: false, errors }` shape including halt class.

Pattern model: sealed SCAFFOLD-REPAIR Path D non-boot tests `tests/smoke/07-halt-publish-log-append.test.js` and `tests/smoke/08-pending-move-after-halt.test.js`.

This is the smallest safe change: 4 test files only; no `src/` touch; no `schemas/` touch; no `package*.json` touch; no helper-file touch; no sealed-handoff touch; no new dependency; ASCII `->` only in new comments. AMENDMENT-3, AMENDMENT-5, AMENDMENT-6 preserved verbatim. RE-4 sealed contract preserved verbatim. DP-5 hardening preserved verbatim.

---

## §4 — Non-preferred options (rejected with rationale)

### D2 — Relax test assertions

Modify Cases 4, 5, 6, 11 to skip the `pendingFiles.length === 0` and `processedFiles.length === 1` post-halt assertions, accepting `moved:false, secondaryHaltClass:24` as passing.

**Rejected.** Contradicts sealed SCAFFOLD-REPAIR-DESIGN §5 expected outcome `13 / 11 / 1 / 1` which requires the post-halt cleanup to succeed. Relaxing assertions hides the structural conflict instead of resolving it and removes the only test-side observability for halt.js RE-4 cleanup behavior.

### D3 — Modify halt.js sealed source

Modify `src/runtime/halt.js:182-190` to make `moveToProcessed` a no-op when the test fixture has sealed the pending directory, or modify `src/store/source-of-truth.js:181-190` to swallow `EACCES` on rename.

**Rejected.** Touches sealed runtime source and weakens the RE-4 cleanup contract for ALL halts (not just test-fixture halts), introducing live-trading risk. Halt class 24 would no longer fire when a real production rename fails.

### D4 — OS-specific fixture pattern

Replace `sealPending()` chmod with an OS-specific facility (e.g. macOS `chflags uchg`, Linux `chattr +i`, mount-namespace overlay) that blocks writes via DP-5 hardening probe while still allowing privileged `rename` via the test process.

**Rejected.** OS-dependent; adds platform-specific test infrastructure; non-portable across the CI matrix; substantially more complex than D1; introduces a second sealed-pending mechanism to maintain.

---

## §5 — RE2 halt-class assertion mechanism (operator-mandated verbatim)

The direct gate-verifier APIs identified in §1.1 return `{ ok: false, errors: [...] }`, not halt-class integers. AMENDMENT-7 non-boot tests therefore assert halt class by inspecting the verifier error object directly, for example `errors[0].haltClass` or the exact equivalent field already returned by each verifier.

Verifier API confirmations (file:line grounded against §1.1):
- `src/verify/schema-validator.js:147-173` — `validate(message)` returns `{ ok: false, errors }` for invalid schema.
- `src/verify/channel-allowlist.js:52-77` — `createChannelAllowlistGate(...).verify(message)` returns `{ ok: false, errors }` for disallowed channel.
- `src/verify/idempotency.js:61-91` — idempotency gate `verify(message)` returns `{ ok: false, errors }` for collision.
- `src/verify/operator-authorization.js:106-148` — operator-authorization gate `verify(message)` returns `{ ok: false, errors }` for stale approval.

**Each rewritten AMENDMENT-7 test MUST:**
- NOT call `boot()` (no boot pipeline routing).
- NOT route through `halt.js` cleanup (no halt-handler invocation).
- NOT call `moveToProcessed()` (no `source-of-truth.js` rename invocation).
- NOT assert on `pending/` or `processed/` file movement (no filesystem-state assertion).
- Assert `ok === false`.
- Assert `errors[0].haltClass` (or the exact equivalent verifier error field) maps to the expected halt class for that gate.

### §5.1 — Case 4 rewrite (Gate 1 schema-mismatch halt 29)

Direct schema-validator invocation:
1. Construct a runtime config via `synthetic-runtime-config.js`.
2. Call `createSchemaValidator(runtimeConfig)` and `ensureSchemaLoaded()`.
3. Build a schema-invalid synthetic message via `buildSchemaInvalidMessage()`.
4. Call `validate(message)`.
5. Assert `result.ok === false`.
6. Assert the returned error object maps to halt class 29 (e.g. `result.errors[0].haltClass === 29` or the exact equivalent field).

### §5.2 — Case 5 rewrite (Gate 2 channel-allowlist halt 3)

Direct channel-allowlist gate invocation:
1. Construct `createChannelAllowlistGate({ allowedChannels: { '#status': '<snowflake>' }, safeLog })`.
2. Build a channel-disallowed synthetic message via `buildChannelDisallowedMessage()`.
3. Call `gate.verify(message)`.
4. Assert `result.ok === false`.
5. Assert `result.errors[0].haltClass` (or the exact equivalent verifier error field) maps to halt class 3.

### §5.3 — Case 6 rewrite (Gate 5 idempotency-collision halt 7)

Direct idempotency gate invocation:
1. Pre-populate a publish-log fixture with a prior successful record for the same idempotency key.
2. Construct the idempotency gate against that publish-log.
3. Build a collision synthetic message that targets the pre-populated key.
4. Call `gate.verify(message)`.
5. Assert `result.ok === false`.
6. Assert `result.errors[0].haltClass` (or the exact equivalent verifier error field) maps to halt class 7.

### §5.4 — Case 11 rewrite (operator-authorization staleness halt 2)

Direct operator-authorization gate invocation:
1. Construct `createOperatorAuthorizationGate(...)`.
2. Build a stale-approval synthetic message via `buildStaleApprovalMessage()`.
3. Call `gate.verify(message)`.
4. Assert `result.ok === false`.
5. Assert `result.errors[0].haltClass` (or the exact equivalent verifier error field) maps to halt class 2.

---

## §6 — Future SAFE IMPLEMENTATION scope (4 Relay-repo test files only)

Exactly these 4 files in `/Users/victormercado/code/agent-avila-relay`:

1. `tests/smoke/04-gate-1-schema-mismatch-halt.test.js`
2. `tests/smoke/05-gate-2-channel-allowlist-halt.test.js`
3. `tests/smoke/06-gate-5-idempotency-collision-halt.test.js`
4. `tests/smoke/11-op-auth-staleness-halt.test.js`

No other Relay-repo touch. No `src/`. No `schemas/`. No `package*.json`. No `tests/smoke/helpers/*`. No sealed handoff. No parent-repo touch during SAFE IMPLEMENTATION (parent-repo CLOSEOUT is separate).

---

## §7 — Preservation invariants

The following MUST remain byte-identical and behaviorally untouched by AMENDMENT-7:

- AMENDMENT-3 `tempTree.sealPending()` calls in the 4 remaining boot-path tests Cases 1, 2, 3, 10 (which halt before the gate pipeline observes the message, so `halt.js` RE-4 cleanup `moveToProcessed` is never invoked and the conflict does not arise).
- AMENDMENT-5 polyfill at `src/verify/schema-validator.js:119-128` (`ajv.addFormat('date-time', () => true);`).
- AMENDMENT-6 object-map guard at `src/runtime/boot.js:360-371`.
- SCAFFOLD-REPAIR Path D non-boot rewrites of Cases 7 + 8.
- Phase D DP-5 hardening at `src/store/source-of-truth.js:263-276`.
- `halt.js` RE-4 contract at `src/runtime/halt.js:24-28`, `:182-190`, `:198-211`.
- Canonical sealed `moveToProcessed` contract at `src/store/source-of-truth.js:173-190`.
- Sealed builder factories in `tests/smoke/helpers/synthetic-message.js`.
- Sealed `schemaPath` + object-map `allowedChannels` in `tests/smoke/helpers/synthetic-runtime-config.js`.
- All sealed parent-repo handoffs (AMENDMENT-6-DESIGN at `b880be9b…`, AMENDMENT-5-DESIGN at `0e9a678e…`, SCAFFOLD-REPAIR-DESIGN at `31ea6f5f…`, F-HALT-SMOKE-RUN-DESIGN at `5acac86…`, F-HALT-SMOKE-AMENDMENT-2-DESIGN at `c642b2b…`, and all others).
- `package.json` + `package-lock.json` byte-identical (no new dependency, no `npm install`/`ci`).
- ASCII `->` only in any new source comment (per AMENDMENT-6 precedent); no Unicode `→` (U+2192).

---

## §8 — Expected post-AMENDMENT-7 outcome

If/when `F-HALT-SMOKE-RUN-7` (Mode 4 SAFE EXECUTION) is separately approved, the expected TAP tally is:

**`13 total / 11 pass / 1 skip / 1 fail`**

Per sealed SCAFFOLD-REPAIR-DESIGN §5 expected outcome:
- 11 pass: Cases 1, 2, 3, 4 (after AMENDMENT-7), 5 (after AMENDMENT-7), 6 (after AMENDMENT-7), 7, 8, 10, 11 (after AMENDMENT-7), 13.
- 1 skip: Case 12 (`channelCap` object vs `channelCap.maxPerWindow` drift — sealed `test.skip()` + in-file TODO citing `src/verify/limits.js:83`).
- 1 fail: Case 09 (separately gated; not addressed by AMENDMENT-7).

---

## §9 — Non-authorization

This DESIGN-SPEC codification phase does NOT authorize, and the future SAFE IMPLEMENTATION it describes does NOT authorize:

- Editing anything outside the 4 listed test files (no other Relay-repo touch).
- Editing parent-repo (CLOSEOUT phase is separate).
- Editing `src/`, `schemas/`, `package*.json`, `tests/smoke/helpers/*`, sealed handoffs.
- Modifying AMENDMENT-3 `sealPending()`, AMENDMENT-5 polyfill, AMENDMENT-6 object-map guard, SCAFFOLD-REPAIR test scaffolding, Phase D DP-5 hardening, or halt.js RE-4 contract.
- Opening `F-HALT-SMOKE-RUN-7` (Mode 4 SAFE EXECUTION; separately gated).
- Opening Case 09 audit / fix, Case 12 remediation, or `src/runtime/boot.js:268`/`:282-285` observability fix.
- `node --test` / `node --check` / `npm install` / `npm ci` / `npx` / any test execution.
- Phase G design or implementation.
- Relay activation, Stage 5 install resumption, Stages 7-10b.
- Discord platform application/bot/token/permission/webhook/post action.
- Railway / deploy.
- DB; Kraken; env / secrets; the armed-trading flag; trading.
- DASH-6 / D-5.12f / D-5.12g / D-5.12h / Migration 009+.
- Autopilot Loop B/C/D.
- CEILING-PAUSE state change.
- external Hermes Agent (Nous/OpenRouter).
- scheduler / cron / webhook / MCP install.
- Permission widening.
- Any network lookup.
- `ajv-formats` import or any new dependency.
- Ajv `strict` mode setting change.
- Introduction of any Unicode arrow `→` (U+2192) glyph in source comments.

Codex review verdicts do NOT constitute operator approval. Approvers exactly `{Victor}`.

---

## §10 — Codex DESIGN-ONLY verdict record

Codex DESIGN-ONLY review of AMENDMENT-7-DESIGN returned **PASS WITH REQUIRED EDITS** across the 14-question packet. Substantive design approved. Two required edits:

- **RE1 — Evidence framing correction:** the original framing treated parent-repo `F-HALT-SMOKE-RUN-6/tap-run-1.txt` TAP citations as Relay-repo on-disk audit evidence. Codex required relabeling them as operator-provided parent-repo RUN-6 evidence preserved under the untracked evidence carve-out, segregated from Relay-repo source citations. Resolved in §1 of this handoff.
- **RE2 — Halt-class assertion mechanism:** the original D1 description left implicit how non-boot tests would assert halt class given that verifier APIs return `{ ok: false, errors }` rather than halt-class integers. Codex required explicit specification: tests assert via `errors[0].haltClass` (or the exact equivalent verifier error field), without `boot()`/`halt.js`/`moveToProcessed()`/file-movement routing. Resolved in §5 of this handoff.

Codex recommendations:
- **Codify as parent-repo DESIGN-SPEC handoff before Mode 4 SAFE IMPLEMENTATION.** (This handoff is that codification.)
- **External Gemini architecture review NOT required.** Codex Q13 explicitly stated this is a narrow test-scaffolding rewrite grounded in existing factory APIs already inspected on disk.

---

## §11 — Next phase gate

The next phase in this cascade is `COMM-HUB-RELAY-RUNTIME-IMPLEMENT-F-HALT-SMOKE-AMENDMENT-7` (Mode 4 SAFE IMPLEMENTATION). It requires:

1. Operator approval to open SAFE IMPLEMENTATION (per ARC-2 Gate matrix; SAFE-class scope but subject to Codex SAFE IMPLEMENTATION on-disk source review).
2. Codex SAFE IMPLEMENTATION on-disk source review of the proposed 4-file diff.
3. Operator commit-only approval naming the exact 4-file Relay-repo scope.
4. Operator push approval; three-way SHA consistency PASS verified post-push.
5. Subsequent `F-HALT-SMOKE-RUN-7` (Mode 4 SAFE EXECUTION) is separately gated and NOT authorized by AMENDMENT-7 SAFE IMPLEMENTATION.

This DESIGN-SPEC codification pre-authorizes none of the above.
