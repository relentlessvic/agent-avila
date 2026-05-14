# COMM-HUB-RELAY-RUNTIME-IMPLEMENT-F-HALT-SMOKE-CASE-12-DESIGN

**This handoff codifies the Codex-approved (PASS WITH REQUIRED EDITS; comment-wording correction applied verbatim with ASCII-only discipline per CASE-09 precedent) conversation-only `COMM-HUB-RELAY-RUNTIME-IMPLEMENT-F-HALT-SMOKE-CASE-12-DESIGN` (Mode 2 / DESIGN-ONLY, no commit). This codification phase is `COMM-HUB-RELAY-RUNTIME-IMPLEMENT-F-HALT-SMOKE-CASE-12-DESIGN-SPEC` (DOCS-ONLY / Mode 3). The future implementation phase `COMM-HUB-RELAY-RUNTIME-IMPLEMENT-F-HALT-SMOKE-CASE-12` is SAFE IMPLEMENTATION (Mode 4) — separately gated; not authorized by this codification.**

**Codification provenance:** F-HALT-SMOKE-RUN-8 (Mode 4 SAFE EXECUTION) PASSed at TAP tally `13 / 12 / 1 / 0` (Relay HEAD `32d80bd…`; parent CLOSEOUT at `9adc11d…`). Case 12 (`rate-limit halt fires with class 5 via adapter`) is the sole remaining skip — per sealed SCAFFOLD-REPAIR-DESIGN §5 the canonical end-state was `13 / 12 / 1 / 0`, but the F-HALT-SMOKE suite design admits a more ambitious "zero skip" terminal state once Case 12's underlying contract drift is resolved. This design closes that gap. The Mode 1 `CASE-12-AUDIT` identified the root cause: `src/verify/limits.js` was authored against an older scalar `channelRateLimits` shape, but the canonical contract evolved to `{ maxPerWindow, windowMs }` objects as validated by `src/runtime/rate-limit-state.js`. The verifier's `current >= channelCap` comparison at `src/verify/limits.js:83` therefore compares a number against an object — coerced to NaN comparison — and the rate-limit halt never fires. A Codex DESIGN-ONLY review of this CASE-12-DESIGN returned PASS WITH REQUIRED EDITS — 15 review goals all CONFIRMED; required edits limited to (1) a comment-wording compaction and (2) test-construction string-quoting confirmation. The wording correction was applied in substance with ASCII-only discipline preserved per the CASE-09 SAFE IMPLEMENTATION precedent (the `§` Unicode character is forbidden in new source comments; `section` ASCII equivalent is used instead). Codex's downstream cross-grep confirmed NONE FOUND for `params.channelCap` consumers anywhere in Relay `src/` — zero risk that the numeric-value change breaks downstream readers. Codex recommended proceeding to CASE-12-DESIGN-SPEC codification (this phase), consistent with AMENDMENT-5 / AMENDMENT-6 / AMENDMENT-7 / CASE-09 precedent. **This file does NOT itself constitute an execution authorization. Codex review verdicts are not operator approval.** Approvers exactly `{Victor}`.

---

## §0 — Phase classification & current anchors

| Property | Value |
|---|---|
| Phase name (this codification phase) | `COMM-HUB-RELAY-RUNTIME-IMPLEMENT-F-HALT-SMOKE-CASE-12-DESIGN-SPEC` |
| Phase mode (this codification phase) | Mode 3 / DOCS-ONLY |
| Original phase name (codified design) | `COMM-HUB-RELAY-RUNTIME-IMPLEMENT-F-HALT-SMOKE-CASE-12-DESIGN` |
| Original phase mode | Mode 2 / DESIGN-ONLY (conversation-only; no commit) |
| Parent-repo HEAD anchor | `9adc11d94fc993f36c8ca8dc404778a9fd0adb8d` (RUN-8-CLOSEOUT sealed) |
| Relay-repo HEAD anchor | `32d80bdbe0cb3c78ecd5d37285055c10c01beb89` (CASE-09 SAFE IMPLEMENTATION sealed) |
| Future implementation phase (gated; NOT authorized) | `COMM-HUB-RELAY-RUNTIME-IMPLEMENT-F-HALT-SMOKE-CASE-12` (Mode 4 SAFE IMPLEMENTATION) |
| Future re-execution phase (gated; NOT authorized) | `COMM-HUB-RELAY-RUNTIME-IMPLEMENT-F-HALT-SMOKE-RUN-9` (Mode 4 SAFE EXECUTION; expected TAP `13 / 13 / 0 / 0`) |
| Parent repo working tree at codification time | the 4 CASE-12-DESIGN-SPEC docs are present as uncommitted on-disk changes alongside the two authorized untracked carve-outs (`position.json.snap.20260502T020154Z` + `orchestrator/handoffs/evidence/`); no other tracked file modified |
| Relay repo working tree at codification time | clean |
| Relay-runtime status | DORMANT preserved |
| Autopilot status | DORMANT preserved |
| Approvers | exactly `{Victor}` |

---

## §1 — Canonical contract (highest authority first)

### §1.1 — RUNTIME-DESIGN section 13 gate 8 (highest authority)

Sealed at `orchestrator/handoffs/COMM-HUB-RELAY-RUNTIME-DESIGN.md:660+`. Line 673 specifies gate 8 as "Character / rate limit" with halt class "rate-limit hit" mapped to halt class **5** per section 15 ID 5.

### §1.2 — E-VERIFY-DESIGN section 5 gate 8 (Phase E implementation guidance)

Sealed at `orchestrator/handoffs/COMM-HUB-RELAY-RUNTIME-IMPLEMENT-E-VERIFY-DESIGN.md:165-171`:
- Exports `createLimitsGate({ maxBodyLength, channelRateLimits, getRateLimitState, safeLog }) -> { verify }`
- `channelRateLimits` = "canonical per-channel caps" (shape under-specified at the E-VERIFY layer)
- `getRateLimitState()` = injected callable returning current rate-limit counter (Phase F manages state)
- Halt class 5 confirmed at line 221 ("Gate 8 — rate-limit hit | **5** | 'rate-limit hit' | canonical-bound (Codex round-2)")

### §1.3 — Phase F canonical object-shape contract (sealed Layer 1)

Sealed at `src/runtime/rate-limit-state.js:56-110`:
- `channelRateLimits` is `{ channelName: { maxPerWindow, windowMs } }` per the canonical object-shape contract
- Lines 87-110 validate at boot and throw `RateLimitStateError(haltClass: CONFIG_INVALID)` if not the canonical object form (both `maxPerWindow` and `windowMs` must be positive integers)

### §1.4 — Layered drift table (Layer 2 + Layer 3 deviate)

| Layer | Source | Coverage |
|---|---|---|
| Layer 1 (Phase F runtime) | `src/runtime/rate-limit-state.js:56-110` | YES — validates + consumes canonical `{ maxPerWindow, windowMs }` object shape |
| Layer 2 (Phase E verifier — gate 8) | `src/verify/limits.js:79-89` | NO — treats `channelCap` as scalar; `current >= channelCap` (number vs object) coerces to NaN -> always `false` |
| Layer 3 (stale comment) | `src/verify/limits.js:44` | NO — comment says "max-count-per-window" (scalar) |
| Layer 4 (boot wiring) | `src/runtime/boot.js:498-520` | YES — Stage 15 correctly bridges by passing object map to `channelRateLimits` AND returning `{ channel: count }` numeric map from `getRateLimitState` callable |
| Layer 5 (test fixture) | `tests/smoke/12-rate-limit-adapter-halt.test.js:23` | DEFERRED — `test.skip()` placeholder with in-file TODO documenting Options B and C |

The drift is squarely in Phase E (Layer 2 + Layer 3). Phase F runtime, boot wiring, and the canonical contract are all aligned on the object shape.

---

## §2 — Root cause

The failing-path mechanics:

1. Test (or production caller) sends a message with `channel_name: '#status'`.
2. `boot.js:498-520` re-binds `limits` gate with `channelRateLimits: { '#status': { maxPerWindow: 1, windowMs: 60000 } }` (canonical object map) and `getRateLimitState: () => ({ '#status': currentCount })` (numeric `{channel: count}` map per Phase F adapter).
3. `src/verify/limits.js:79`: `const channelCap = channelRateLimits[message.channel_name];` — assigns the OBJECT `{ maxPerWindow: 1, windowMs: 60000 }` to `channelCap`.
4. `src/verify/limits.js:81`: `const current = (state && state[message.channel_name]) || 0;` — assigns the NUMERIC count to `current` (correct).
5. `src/verify/limits.js:83`: `if (current >= channelCap)` — JavaScript `number >= object` coerces the object to primitive via `valueOf()`/`toString()`, yielding `NaN`. `current >= NaN` is always `false`.
6. The rate-limit halt never fires. Gate 8 returns `{ ok: true }` even when the counter is exceeded.

The skipped test at `tests/smoke/12-rate-limit-adapter-halt.test.js:23` is a `test.skip(...)` placeholder. The in-file TODO at lines 6-21 documents the drift verbatim and lists two remediation options (Option B and Option C). This DESIGN-SPEC selects Option C.

---

## §3 — Recommended fix: Option C (implementation + test reactivation)

### §3.1 — `src/verify/limits.js` edit (3 narrow changes; ASCII-only)

**Change 1: stale comment at line 44** — replace with this verbatim ASCII-only wording (Codex required-edit Edit 1 substance, with `section` instead of Unicode `§` per CASE-09 precedent):

```javascript
// `channelRateLimits` is a map from channel_name -> { maxPerWindow, windowMs }.
// Canonical per RUNTIME-DESIGN section 13 gate 8 and src/runtime/rate-limit-state.js:
// e.g. { "#status": { maxPerWindow: 5, windowMs: 60000 } }.
```

The Unicode `§` (U+00A7) is forbidden in new source comments per CASE-09 SAFE IMPLEMENTATION precedent at Relay `32d80bd…`. ASCII `section` is the canonical substitute.

**Change 2: comparison at line 83** — extract `channelCap.maxPerWindow`:

Current:
```javascript
if (current >= channelCap) {
```

Proposed:
```javascript
if (current >= channelCap.maxPerWindow) {
```

**Change 3: error params at line 88** — emit the scalar cap (not the whole object):

Current:
```javascript
params: { channelCap, currentCount: current },
```

Proposed:
```javascript
params: { channelCap: channelCap.maxPerWindow, currentCount: current },
```

**Preserved verbatim:**
- `HALT_CLASS.RATE_LIMIT_HIT: 5` constant (line 27)
- `haltClassOverride: HALT_CLASS.RATE_LIMIT_HIT` in the error (line 89)
- `keyword: 'rate-limit'` (line 86)
- `errors.push(...)` envelope, `safeLog` invocation, return shape
- Async signature, `pipelineState.substitutedBody` propagation (DPI-E12)
- `Object.freeze()` wrapper
- File header / imports / exports
- `LimitsError` class
- Anti-features (no top-level execution, no network, etc.)
- Character-limit branch at lines 70-77 (gate 8 halt class 4; orthogonal to rate-limit fix)
- ASCII `->` only; no Unicode `→` (U+2192); no Unicode `§` (U+00A7) in new comments

### §3.2 — `tests/smoke/12-rate-limit-adapter-halt.test.js` rewrite (Codex Edit 2 confirmed verbatim)

Whole-file rewrite from `test.skip()` placeholder to non-boot direct gate-verifier test per AMENDMENT-7 precedent (Cases 4, 5, 6, 11). Bypasses `boot()`, bypasses `halt.js` cleanup, bypasses `moveToProcessed()`, bypasses pending/processed file-movement assertions.

**Key advantage over AMENDMENT-7 Cases 4/5/6/11:** `limits.js` errors already include `haltClassOverride: 5` on the returned error object (per line 89). Case 12 can assert the halt class **directly** via `errors[0].haltClassOverride === 5` — no keyword-mapping indirection needed. This is **cleaner** than AMENDMENT-7's keyword-based pattern.

Illustrative shape (not authorized to write):

```javascript
// Case 12 -- gate-8 rate-limit hit direct verifier test (non-boot).
//
// Per sealed COMM-HUB-RELAY-RUNTIME-IMPLEMENT-F-HALT-SMOKE-CASE-12-DESIGN,
// this test bypasses boot(), bypasses halt.js cleanup, bypasses
// moveToProcessed(), and bypasses pending/processed file-movement
// assertions. The limits gate returns { ok: false, errors: [...] } per
// src/verify/limits.js section 66-101 and the error envelope includes a
// `haltClassOverride` field at line 89, so this test asserts halt class 5
// directly without keyword indirection (cleaner than the AMENDMENT-7
// keyword-based pattern for Cases 4, 5, 6, 11).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLimitsGate } from '../../src/verify/limits.js';
import { buildSyntheticMessage } from './helpers/synthetic-message.js';

test('Case 12 -- gate-8 rate-limit hit -> halt class 5 (non-boot direct verifier)', async () => {
  const gate = createLimitsGate({
    maxBodyLength: 2000,
    channelRateLimits: { '#status': { maxPerWindow: 1, windowMs: 60000 } },
    getRateLimitState: async () => ({ '#status': 5 }),
    safeLog: () => {},
  });
  const message = buildSyntheticMessage({ channel_name: '#status' });
  const result = await gate.verify(message, { substitutedBody: message.body });

  assert.equal(result.ok, false, 'limits gate must fail when current >= maxPerWindow');
  assert.ok(Array.isArray(result.errors) && result.errors.length > 0, 'errors array required');
  assert.equal(result.errors[0].keyword, 'rate-limit', "errors[0].keyword must be 'rate-limit'");
  assert.equal(result.errors[0].haltClassOverride, 5, 'haltClassOverride must be 5 (RATE_LIMIT_HIT)');
  assert.equal(result.errors[0].params.channelCap, 1, 'params.channelCap must be the numeric maxPerWindow');
  assert.equal(result.errors[0].params.currentCount, 5, 'params.currentCount must be the observed counter');
});
```

ASCII `->` only in any new comment. No Unicode `→` (U+2192). No Unicode `§` (U+00A7).

`pipelineState.substitutedBody` is passed explicitly because `limits.js:68-69` reads it for the character-limit branch (defensive — the test does not exercise gate-8 character-limit, only rate-limit, but the gate still reads `substitutedBody`).

---

## §4 — Rejected alternatives (per Codex DESIGN-ONLY review)

### §4.1 — Option A (implementation-only; leave Case 12 skipped) — REJECTED

Fixes the production-risk gap but leaves regression coverage permanently disabled. Future drifts could reintroduce the bug undetected. The F-HALT-SMOKE suite would remain at `13/12/1/0` indefinitely instead of reaching the maximum-validation `13/13/0/0` end-state.

### §4.2 — Option B (test-only; rewrite Case 12 to use scalar shape) — REJECTED

Aligns the test with the BUG instead of with the canonical contract. `src/runtime/rate-limit-state.js:97-110` rejects a scalar-shape `channelRateLimits` at boot with `RateLimitStateError(haltClass: CONFIG_INVALID)`, so a production runtime would never reach `limits.js` with the scalar shape Case 12 would assume. The test would pass in isolation but the production runtime gate would still be broken.

### §4.3 — Option D (contract rollback to scalar shape) — REJECTED

Would require editing `src/runtime/rate-limit-state.js`, RUNTIME-DESIGN section 13, E-VERIFY-DESIGN section 5, plus all callers. The object shape carries `windowMs` which is needed for window-rollover logic at `rate-limit-state.js:141-148`. Reverting to scalar would lose `windowMs` and break rate-limit window semantics. Larger surface area and contradicts months of sealed canonical design.

---

## §5 — Future SAFE IMPLEMENTATION scope (2 Relay-repo files only)

Exactly 2 files in `/Users/victormercado/code/agent-avila-relay`:

1. `src/verify/limits.js` — 3 narrow changes per §3.1 (comment update + 2 value-edits). Approximately +6 lines (comment expansion) / -2 lines (old scalar comment) / 2 narrow code edits. Net change: ~6-line comment block + 2 narrow code edits.
2. `tests/smoke/12-rate-limit-adapter-halt.test.js` — whole-file rewrite per §3.2 (replace `test.skip()` placeholder with non-boot direct gate-verifier test).

No other Relay-repo touch. No `src/` outside `verify/limits.js`. No `tests/smoke/*` outside `12-rate-limit-adapter-halt.test.js`. No `schemas/`. No `package*.json`. No `tests/smoke/helpers/*`. No sealed handoff. No parent-repo touch during SAFE IMPLEMENTATION (parent-repo CLOSEOUT is separate).

ASCII `->` only in any new comment. No Unicode `→` (U+2192). No Unicode `§` (U+00A7) in new source comments.

---

## §6 — Preservation invariants

The future SAFE IMPLEMENTATION must leave the following byte-identical and behaviorally untouched:

- AMENDMENT-3 `tempTree.sealPending()` at `tests/smoke/helpers/temp-tree.js:30-31`
- AMENDMENT-5 polyfill at `src/verify/schema-validator.js:119-128`
- AMENDMENT-6 object-map guard at `src/runtime/boot.js:360-371`
- AMENDMENT-7 non-boot direct gate-verifier rewrites at `tests/smoke/04/05/06/11-*.test.js`
- CASE-09 5 top-level REDACT_PATHS literals at `src/log.js:34-38` + WHY comment at `:27-33`
- SCAFFOLD-REPAIR Path D non-boot tests at `tests/smoke/07-halt-publish-log-append.test.js` + `tests/smoke/08-pending-move-after-halt.test.js`
- Phase D DP-5 hardening at `src/store/source-of-truth.js:263-276`
- halt.js RE-4 contract at `src/runtime/halt.js:24-28, :182-190, :198-211`
- `src/runtime/rate-limit-state.js` canonical contract (not touched; gate-8 verifier is the side that must align)
- `src/runtime/boot.js` Stage 12 / 13 / 15 wiring (not touched; already correctly bridges shapes)
- `src/verify/limits.js` everything outside the 3 narrow changes in §3.1 (file header / imports / exports lines 1-43, 45-78; character-limit branch at lines 70-77; error envelope at lines 84-99; return shapes; `HALT_CLASS` constant; `LimitsError` class; anti-features header)
- All sealed parent-repo handoffs (RUNTIME-DESIGN, E-VERIFY-DESIGN, all AMENDMENT-N-DESIGN, SCAFFOLD-REPAIR-DESIGN, CASE-09-DESIGN, and all others)
- `tests/smoke/helpers/*` (sealed helpers including `synthetic-message.js`, `synthetic-runtime-config.js`, `temp-tree.js`)
- All other `tests/smoke/*` test files (Cases 1-11, 13)
- `schemas/`, `package.json`, `package-lock.json` byte-identical (no new dependency)
- ASCII `->` only in new comments
- No Unicode `→` (U+2192) anywhere in source code
- No Unicode `§` (U+00A7) introduced in new source comments

---

## §7 — Expected post-CASE-12 RUN-9 outcome

**`13 total / 13 pass / 0 skip / 0 fail`**

- 13 pass: Cases 1, 2, 3, 4, 5, 6, 7, 8 primary, 8 sub-case, 9, 10, 11, 12 (newly reactivated)
- 0 skip
- 0 fail
- **Fully clean F-HALT-SMOKE suite.** The terminal post-suite-design state — all 12 documented Cases asserting; zero skips; zero fails.

This achieves the maximum-validation end-state of the F-HALT-SMOKE design.

---

## §8 — Codex `params.channelCap` downstream cross-grep result

Codex DESIGN-ONLY review performed a proactive cross-grep of `params.channelCap` consumers in Relay-repo `/Users/victormercado/code/agent-avila-relay/src/`. Result: **NONE FOUND** — only `limits.js:79-88` references `channelCap` anywhere. No downstream consumer (Phase F adapter, halt-handler, log emitter, etc.) reads `params.channelCap` from the limits gate's error envelope. The proposed numeric-value change is **safe** — zero downstream breakage risk.

---

## §9 — Non-authorization

This DESIGN-SPEC codification phase does NOT authorize, and the future SAFE IMPLEMENTATION it describes does NOT authorize:

- Editing anything outside the 2 listed Relay files (no other Relay-repo touch).
- Editing parent-repo (CLOSEOUT phase is separate).
- Editing `src/verify/limits.js` outside the 3 narrow changes in §3.1 (no change to character-limit branch, `createLimitsGate` API, `LimitsError` class, `HALT_CLASS` constant, `safeLog` invocation, return shape, async signature, or `pipelineState.substitutedBody` handling).
- Editing `src/runtime/rate-limit-state.js` (canonical contract; preserved verbatim).
- Editing `src/runtime/boot.js` Stage 12 / 13 / 15 wiring (correctly bridges shapes; preserved verbatim).
- Editing any other `src/` file (no `src/verify/*` outside limits.js; no `src/runtime/*`; no `src/store/*`; no `src/log.js`).
- Editing `tests/`, `tests/smoke/helpers/*`, `schemas/`, `package*.json`, or any other Relay file.
- Editing any sealed handoff.
- Opening `F-HALT-SMOKE-RUN-9` (Mode 4 SAFE EXECUTION; separately gated; expected `13 / 13 / 0 / 0`).
- Opening `src/runtime/boot.js:268`/`:282-285` observability fix.
- Modifying AMENDMENT-3 `sealPending()`, AMENDMENT-5 polyfill, AMENDMENT-6 object-map guard, AMENDMENT-7 direct verifier rewrites, CASE-09 5 top-level REDACT_PATHS literals, SCAFFOLD-REPAIR Path D Cases 7+8, Phase D DP-5 hardening, halt.js RE-4 contract.
- Adding additional REDACT_PATHS entries (`apikey`/`bearer`/`credentials`/`*.DISCORD_BOT_TOKEN` remain deferred from CASE-09).
- Opening recursive censor function refactor (CASE-09 Option C deferred).
- Expanding FORBIDDEN_VALUE_PATTERNS (CASE-09 Option B deferred).
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
- Introduction of any Unicode `§` (U+00A7) glyph in new source comments (preserved CASE-09 ASCII-only discipline).

Codex review verdicts do NOT constitute operator approval. Approvers exactly `{Victor}`.

---

## §10 — Codex DESIGN-ONLY verdict record

Codex DESIGN-ONLY review of CASE-12-DESIGN returned **PASS WITH REQUIRED EDITS**. All 15 review goals CONFIRMED:

1. Option C is the safest minimal fix.
2. Option A (implementation-only) is insufficient.
3. Option B (test-only) is wrong because it would align with the bug.
4. Option D (contract rollback) is rejected because canonical object shape carries needed `windowMs`.
5. `src/verify/limits.js` should consume `channelCap.maxPerWindow`.
6. `params.channelCap` should become numeric `maxPerWindow`.
7. `haltClassOverride: 5` should remain preserved and directly asserted.
8. Non-boot direct verifier shape is correct.
9. `getRateLimitState: async () => ({ '#status': 5 })` matches `boot.js:506-516` Phase F contract.
10. `pipelineState.substitutedBody` correctly passed in test.
11. Character-limit branch (`limits.js:70-77`) remains untouched.
12. `params.channelCap` downstream cross-grep returned NONE FOUND in Relay `src/` — change is safe.
13. RUN-9 `13/13/0/0` is reasonable.
14. Preservation invariants list correct.
15. Non-authorization clauses intact.

**Required edits (applied in this codification with ASCII-only discipline preserved):**

- **Edit 1** — Comment-wording compaction at proposed `src/verify/limits.js:44` replacement; Codex's wording incorporated **in substance** with the Unicode `§13` replaced by ASCII `section 13` per CASE-09 SAFE IMPLEMENTATION precedent. Final ASCII-only wording specified in §3.1 above.
- **Edit 2** — Case 12 test construction string-quoting confirmation; matches the design's existing proposal. Codified verbatim in §3.2 above (`channelRateLimits: { '#status': { maxPerWindow: 1, windowMs: 60000 } }` + `getRateLimitState: async () => ({ '#status': 5 })`).

Codex's downstream cross-grep audit: **NONE FOUND** — no Relay `src/` consumer reads `params.channelCap`; the numeric-value change is safe.

**CASE-12-DESIGN-SPEC codification may proceed.** (This handoff is that codification.)

---

## §11 — Next phase gate

The next phase in this cascade is `COMM-HUB-RELAY-RUNTIME-IMPLEMENT-F-HALT-SMOKE-CASE-12` (Mode 4 SAFE IMPLEMENTATION). It requires:

1. Operator approval to open SAFE IMPLEMENTATION (per ARC-2 Gate matrix; SAFE-class scope but subject to Codex SAFE IMPLEMENTATION on-disk source review).
2. Codex SAFE IMPLEMENTATION pre-edit plan review.
3. Codex SAFE IMPLEMENTATION post-edit on-disk source review of the proposed 2-file diff.
4. Operator commit-only approval naming the exact 2-file Relay-repo scope.
5. Operator push approval; three-way SHA consistency PASS verified post-push.
6. Subsequent `F-HALT-SMOKE-RUN-9` (Mode 4 SAFE EXECUTION) is separately gated and NOT authorized by CASE-12 SAFE IMPLEMENTATION.

This DESIGN-SPEC codification pre-authorizes none of the above.
