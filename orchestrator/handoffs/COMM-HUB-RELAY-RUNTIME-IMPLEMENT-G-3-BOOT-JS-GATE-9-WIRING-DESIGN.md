# COMM-HUB-RELAY-RUNTIME-IMPLEMENT-G-3-BOOT-JS-GATE-9-WIRING-DESIGN

**SAFE-class handoff. DOCS-ONLY (Mode 3) codification of the Mode 2 DESIGN-ONLY conversation-approved G-3 BOOT-JS-GATE-9-WIRING design.**

**Phase:** COMM-HUB-RELAY-RUNTIME-IMPLEMENT-G-3-BOOT-JS-GATE-9-WIRING-DESIGN
**Mode of underlying design:** 2 (DESIGN-ONLY; conversation-only)
**Mode of this codification:** 3 (DOCS-ONLY)
**Mode classification of the future G-3 implementation:** 5 (HIGH-RISK IMPLEMENTATION with non-activation scope; highest-risk Phase G subphase because it touches sealed `src/runtime/boot.js` Stage 12/13/15 wiring + AMENDMENT-3/5/6/7 invariants)
**Parent-repo HEAD at codification time:** `d342c12cd4ce4f86fcaf22475339db66fb6b63cc`
**Relay-repo HEAD at codification time:** `2765a9707c99f48d89cf0aa8d85eb72adc50e56e`
**F-HALT-SMOKE terminal end-state carried forward:** `13/13/0/0`
**Relay-runtime status:** DORMANT
**Approvers exactly:** `{Victor}` (Codex review verdicts do NOT constitute operator approval)

---

## §0 — Background

This G-3 design specifies how the G-2 sealed gateway modules at Relay `2765a9707c99f48d89cf0aa8d85eb72adc50e56e` (`src/gateway/discord-client.js`, `src/gateway/send-message.js`, `src/gateway/egress-allowlist-hook.js`, `src/gateway/egress-event-log.js`, `src/gateway/phase-g-send-and-record.js`) wire into the sealed `src/runtime/boot.js` Stage 15 gate-9 ref injection point and the sealed `src/runtime/run-pipeline.js` production callable contract.

G-3 is the third Phase G subphase per the sealed G-READINESS-DESIGN at parent `95da6efc05c0263e1994e6ae5c1ca0b24e499307`. G-3 was identified at G-READINESS-DESIGN authoring time as the highest-risk Phase G subphase because it touches sealed `boot.js` Stage 12/13/15 wiring + AMENDMENT-3/5/6/7 invariants.

This handoff is the permanent SAFE-class record of the conversation-approved G-3 plan after Codex pre-implementation review (round-1 PASS WITH REQUIRED EDITS — 3 corrections; round-2 narrow re-review PASS — 13/13 goals; no remaining required edits).

---

## §1 — Path A selected (Path B not viable)

**Decision:** Path A — edit `src/runtime/boot.js` additively so Stage 15 internally constructs Phase G refs from sealed G-2 gateway modules when caller-provided refs are missing.

**Why Path B is not viable:** Codex pre-implementation read-only inspection confirmed:
- `rateLimitState` is constructed INSIDE `boot.js` at Stage 13 (`src/runtime/boot.js:450-458`) via `createRateLimitState({ operatorPhaseId, channelRateLimits })`.
- `createPhaseGSendAndRecord()` (sealed at Relay `2765a97…`) requires `rateLimitState` as a closure-captured factory dependency per Codex Correction 2 from the G-2 pre-implementation review.
- `runPipeline()` (sealed) passes only the resulting `phaseGSendAndRecord` callable; it does NOT pass `rateLimitState` separately.
- External (pre-boot) caller construction of `phaseGSendAndRecord` would either require duplicating `rateLimitState` construction outside `boot.js` (violates sealed Stage 13 contract) or refactoring `boot.js` to expose `rateLimitState` pre-Stage 15 (still an edit to `boot.js`, defeating the "no boot.js edit" goal).

Therefore Path A — additive Stage 15 extension inside `boot.js` — is the only viable path.

---

## §2 — G-3 purpose + non-activation guarantees

G-3 SAFE IMPLEMENTATION (Mode 5 HIGH-RISK with non-activation scope) accomplishes:
- Wires G-2's 5 non-activating gateway modules into `boot.js` Stage 15.
- Populates the sealed gate-9 verifier's expected hookRef + logRef so `boot.js` Stage 15 production validation passes when invoked without externally-supplied Phase G refs.
- Provides the `phaseGSendAndRecord` callable to `runPipeline()` via the existing sealed parameter contract.
- Adds 1 new mocked side-effect-free boot wiring test.

G-3 preserves:
- Relay runtime DORMANT
- No Discord activation
- No real Discord token read
- No `.login()` call
- No gateway IDENTIFY initiation
- No real Discord REST request
- No real message publish
- No real network reach (gateway construction does not initiate connections; `createSendMessage` is `validateOnly: true`; egress allowlist hook is INERT until activation per sealed G-2 contract)
- No test execution at G-3 (deferred to G-5 RUN-10)

---

## §3 — Stage 15 additive wiring (no replacement of existing logic)

**Constraint:** The existing Stage 15 production validation block at `src/runtime/boot.js:544-562` and the existing gate-9 rebind block at `src/runtime/boot.js:580-599` MUST remain byte-identical.

**Implementation pattern:** Add a NEW default-wiring block immediately BEFORE the existing production validation block. The new default-wiring block constructs Phase G refs locally when the caller did not provide them, then assigns them back into the variables the existing validation reads.

**Stages 1-14 byte-identical.** **Stage 16 byte-identical.**

**Stage 15 new structure (top-down):**

1. Existing `let resolvedAllowlistHook`, `let resolvedEgressEventLog`, `let resolvedPhaseGSendAndRecord = phaseGSendAndRecord` declarations (lines 540-542) — byte-identical.
2. **NEW default-wiring block** (described in §4 below) — runs only when production AND any Phase G ref is missing.
3. Existing `if (relayMode === 'production') { … }` validation block (lines 544-562) — byte-identical; now reads the populated resolved refs.
4. Existing dry-run + `phaseGStubMode='stub-empty-allowlist'` branch (lines 563-571) — byte-identical.
5. Existing dry-run + `phaseGStubMode='disabled'` branch (lines 572-578) — byte-identical.
6. Existing gate-9 rebind block (lines 580-599) — byte-identical.

---

## §4 — Reassignment-back / resolved-ref invariant (Codex Correction 1)

**Requirement:** The default-wiring block must assign constructed refs back into the variables read by the existing production validation **before that validation runs**.

**Implementation pattern:** The 3 destructured parameters in the `boot()` function signature — `phaseGSendAndRecord`, `phaseGAllowlistHook`, `phaseGEgressEventLog` — must be made rebindable at boot-scope. This means switching their declaration style from `const`-equivalent destructuring (default in current source) to `let`-equivalent rebindable destructuring. The only viable mechanism in JavaScript without changing the function signature is to introduce 3 `let local*` intermediaries that the existing validation explicitly reads from, OR to copy the parameter values into 3 `let` variables at the top of Stage 15.

**Required resolved refs (all 3 must reach the existing validation as populated values, not the original missing parameter values):**

- `phaseGSendAndRecord`
- `phaseGAllowlistHook`
- `phaseGEgressEventLog`

**Bug-prevention requirement:** The G-3 design explicitly prevents the failure mode where default-wiring constructs refs into local-only variables while the byte-identical validation still checks the original missing parameter values. The reassignment back is a **load-bearing invariant** of the G-3 design.

**Recommended implementation pattern (for boot.js edit at G-3 implementation time):**

The boot() function signature line 127-134 is:
```js
export async function boot({
  phaseGStubMode = 'disabled',
  operatorPhaseId,
  runtimeConfig,
  phaseGSendAndRecord,
  phaseGAllowlistHook,
  phaseGEgressEventLog,
} = {}) { ... }
```

Three viable G-3 implementation patterns to make the 3 Phase G params rebindable at boot-scope, all of which satisfy the Codex correction:
1. **Switch destructured parameter style:** ES2015 destructured parameters in a function signature are `let`-rebindable by default in JavaScript (they are simple bindings, not `const`). No source-level annotation change is needed; the existing destructured form is already rebindable. The G-3 default-wiring block can directly assign `phaseGSendAndRecord = phaseGSendAndRecordLocal;` etc.
2. **Introduce `let` intermediaries:** Add `let resolvedPhaseG3SendAndRecord = phaseGSendAndRecord; let resolvedPhaseG3AllowlistHook = phaseGAllowlistHook; let resolvedPhaseG3EgressEventLog = phaseGEgressEventLog;` at the top of Stage 15, then update the existing validation to reference these intermediaries — but this would change the existing validation's byte-identity. **REJECTED** because Codex required the existing validation to remain byte-identical.
3. **Direct rebinding of the destructured parameters:** Use pattern (1) — directly reassign the 3 parameter names within Stage 15 before validation runs.

**G-3 implementation uses Pattern 1** (direct rebinding of destructured parameters; existing validation byte-identical).

---

## §5 — Atomic three-ref construction (Codex Correction 2)

**Requirement:** Default-wiring is atomic. If production default wiring fires because **any** of the 3 required Phase G refs is missing, `boot.js` MUST construct and install **all three** refs together within a single `try` block.

**Required refs (constructed together or none):**
- `phaseGSendAndRecord`
- `phaseGAllowlistHook`
- `phaseGEgressEventLog`

**Partial wiring forbidden:** It is forbidden for `boot.js` to enter a state where only 1 or 2 of the 3 refs are freshly-constructed while caller-provided refs remain in place. Mixing caller-provided and freshly-constructed refs could violate the closure-capture contract of `phase-g-send-and-record.js` (which captures `allowlistHook` and `egressEventLog` at factory invocation time).

**Shared-instance requirement:** The constructed `phaseGSendAndRecord` callable, the constructed `phaseGAllowlistHook` reference passed to `createNetworkAnomalyGate` at Stage 15 (via the gate-9 rebind block lines 580-599), and the constructed `phaseGEgressEventLog` reference passed to `createNetworkAnomalyGate` at Stage 15 **must share the same `allowlistHook` and `egressEventLog` instances**. This guarantees gate-9 verification and `phase-g-send-and-record` orchestration observe a single coherent egress event log and a single canonical allowlist hook.

**Atomic failure handling:** If construction of any one of the 5 sub-factory invocations (`createDiscordClient`, `createSendMessage`, `createEgressAllowlistHook`, `createEgressEventLog`, `createPhaseGSendAndRecord`) throws, NONE of the 3 Phase G refs are treated as installed. The entire default-wiring block fails closed through the `try`/`catch` and `postLoggerBootHalt(NETWORK_HOOK_MISSING_OR_INTEGRITY, 'phase-g-wiring-failed')` path.

**Trigger condition:** Default-wiring fires only when `relayMode === 'production' && (typeof phaseGSendAndRecord !== 'function' || !phaseGAllowlistHook || !phaseGEgressEventLog)`. If ALL three caller-provided refs are valid functions/objects, default-wiring does NOT fire and the existing validation operates on the caller-provided refs as before.

---

## §6 — Option A allowlist source (Codex Correction 3)

**Operator decision:** **Option A** — extend `runtimeConfig` contract with `allowlistedDiscordHostnames: string[]`.

**Implementation requirement:** G-3 boot.js default-wiring reads:

```js
allowlistedHostnames: runtimeConfig?.allowlistedDiscordHostnames ?? []
```

**Explicitly forbidden:** G-3 does **NOT** define a boot-local canonical `DISCORD_ALLOWLISTED_HOSTNAMES` constant.

**Module-header documentation update:** The G-3 edit adds **1 line** to `boot.js`'s module-header `runtimeConfig` keys documentation listing the new optional field `allowlistedDiscordHostnames: string[]`. All other module-header lines remain byte-identical.

**Fail-closed semantics:** When `runtimeConfig?.allowlistedDiscordHostnames` is absent (`undefined`) or empty (`[]`), the constructed `phaseGAllowlistHook.allowlistedHostnames` resolves to `[]`. Gate-9 verifier (`src/verify/network-anomaly.js`) then has an empty allowlist set:
- Any real outbound egress would produce a `hookBypassed` or `non-allowlisted` event → gate 9 halt class 6 ("Network anomaly egress").
- However, G-3 wires `createSendMessage({ validateOnly: true })` so no real egress occurs at G-3; the wrapper returns `{ ok: true, dispatchAttempt: 'simulated' }` without invoking discord.js REST.
- The egress event log remains empty in G-3 unless a future activation phase removes `validateOnly: true`.

**Rationale:** Option A is consistent with sealed Phase F design §7 firm rule "no raw process.env reads." The canonical Discord allowlist is supplied by `runtimeConfig` from a future canonical config source (test harness, operator-supplied at `boot()` invocation, or a separately-gated future canonical config phase). G-3 itself does NOT define the canonical Discord allowlist hostnames; that's a future-subphase concern when activation is approved.

---

## §7 — Production-only default-wiring trigger

**Default-wiring fires only for `relayMode === 'production'` when Phase G refs are missing.**

**Dry-run preservation:**
- `relayMode === 'dry_run' && phaseGStubMode === 'stub-empty-allowlist'` (current `boot.js:563-571`) — byte-identical; G-3 does NOT alter this branch.
- `relayMode === 'dry_run' && phaseGStubMode === 'disabled'` (current `boot.js:572-578`) — byte-identical; G-3 does NOT alter this branch. The dry-run-disabled posture keeps the existing null-ref gate-9 halt class 32 behavior.

This preserves the sealed dry-run contract and confines G-3's behavioral change to the production-no-refs case only.

---

## §8 — G-3 construction set (5 factory invocations)

Inside the default-wiring `try` block (in this order):

```js
const client = createDiscordClient();
const sendMessage = createSendMessage({ client, validateOnly: true });
const allowlistHook = createEgressAllowlistHook({
  allowlistedHostnames: runtimeConfig?.allowlistedDiscordHostnames ?? [],
});
const egressEventLog = createEgressEventLog({ maxSize: 1000 });
const phaseGSendAndRecordLocal = createPhaseGSendAndRecord({
  sendMessage,
  egressEventLog,        // closure-captured per Codex Correction 2
  rateLimitState,        // closure-captured from Stage 13 local var
  allowlistHook,         // closure-captured per Codex Correction 2
});
// Atomic three-ref reassignment back (Codex Correction 1):
phaseGSendAndRecord = phaseGSendAndRecordLocal;
phaseGAllowlistHook = allowlistHook;
phaseGEgressEventLog = egressEventLog;
```

**Factory signatures (verified at Relay `2765a97…`):**

| Factory | Signature | Side-effect-free guarantees |
|---|---|---|
| `createDiscordClient` | `({ intents, ...rest } = {}) → Client` | No `.login()`; no `.ws.connect()`; no network at module load OR factory invocation |
| `createSendMessage` | `({ client, validateOnly = true } = {}) → async (channelId, payload) => Result` | `validateOnly: true` returns simulated success; no real Discord REST request |
| `createEgressAllowlistHook` | `({ allowlistedHostnames = [] } = {}) → { allowlistedHostnames, invoke }` | Inert; no global node:http/https/net/tls/dgram patching at module load or factory invocation |
| `createEgressEventLog` | `({ maxSize = 1000 } = {}) → Array` | Returns plain Array; `Array.isArray(log) === true`; bounded FIFO via `pushBounded` helper |
| `createPhaseGSendAndRecord` | `({ sendMessage, egressEventLog, rateLimitState, allowlistHook }) → async closure` | Closure-captures all 4 deps; per-invocation closure returns result without real send |

---

## §9 — Rate-limit handling

**`rateLimitState` is captured from the Stage 13 local variable inside `boot.js`.**

- Stage 13 (lines 448-475) constructs `rateLimitState` via `createRateLimitState({ operatorPhaseId, channelRateLimits })`.
- The Stage 15 default-wiring block closes over the same `rateLimitState` local variable.
- **No duplicate `rateLimitState` creation.** G-3 does NOT call `createRateLimitState` a second time.
- The constructed `phaseGSendAndRecord` callable closes over `rateLimitState`; per-invocation calls invoke `rateLimitState.incrementOnPublish({ channelName })` per `phase-g-send-and-record.js` Step 4.

**`src/runtime/run-pipeline.js` remains BYTE-IDENTICAL.** The production path at `run-pipeline.js:277-285` invokes only `phaseGSendAndRecord({ message, pipelineState, publishLog, store, filename, safeLog, hermesVersion })`; it does NOT pass `rateLimitState` separately. The closure-captured `rateLimitState` reaches the callable via the factory closure, not via a parameter.

---

## §10 — Files explicitly NOT touched in future G-3 implementation

| File | Reason |
|---|---|
| `src/runtime/run-pipeline.js` | Sealed; receives only `phaseGSendAndRecord` callable; no changes needed |
| `src/verify/network-anomaly.js` | Sealed Phase E gate-9 verifier; G-3 supplies refs it consumes; no changes |
| `src/runtime/rate-limit-state.js` | Sealed; G-3 captures the boot.js Stage 13 instance; no changes |
| `src/gateway/discord-client.js` | Sealed at G-2 `2765a97…`; imported by G-3 boot.js; no changes |
| `src/gateway/send-message.js` | Sealed at G-2; imported by G-3 boot.js; no changes |
| `src/gateway/egress-allowlist-hook.js` | Sealed at G-2; imported by G-3 boot.js; no changes |
| `src/gateway/egress-event-log.js` | Sealed at G-2; imported by G-3 boot.js; no changes |
| `src/gateway/phase-g-send-and-record.js` | Sealed at G-2; imported by G-3 boot.js; no changes |
| `src/store/*` | Sealed Phase D; no changes |
| `src/config.js`, `src/index.js`, `src/log.js` | Sealed; no changes (per sealed Phase F design §7 firm rule, `src/index.js` MUST NOT pass Phase G refs) |
| `package.json`, `package-lock.json` | Sealed at G-1 `8151d36…`; no new dependency in G-3 |
| Existing `tests/smoke/*.test.js` (1-12 + new G-2 test 13) | Sealed; no changes |
| `tests/smoke/helpers/*` | Sealed; G-3 test reuses `network-observer.js` without modification |
| `schemas/*` | Sealed; no changes |
| Parent repo files | Untouched by G-3 SAFE IMPLEMENTATION; later G-3-CLOSEOUT phase updates 3 status docs |
| Sealed parent handoffs (G-DESIGN, G-READINESS-DESIGN, all other sealed handoffs) | Preserved verbatim |

---

## §11 — AMENDMENT preservation requirements

G-3 implementation MUST preserve the following sealed invariants verbatim (by line-range audit):

| Invariant | Location | Preservation |
|---|---|---|
| AMENDMENT-3 `sealPending()` 0o555 | `tests/smoke/helpers/temp-tree.js:23-31` | Untouched at G-3 |
| AMENDMENT-5 polyfill `ajv.addFormat` | `src/verify/schema-validator.js:119-126` | Untouched at G-3 |
| AMENDMENT-6 object-map guard | `src/runtime/boot.js:360-371` (Stage 12) | Byte-identical at G-3 |
| AMENDMENT-7 non-boot rewrite patterns | `tests/smoke/04-08-11.test.js` (4 sealed test files) | Untouched at G-3 |
| CASE-09 top-level REDACT_PATHS literals | `src/log.js:26-38` | Untouched at G-3 |
| CASE-12 rate-limit canonical-shape check | `src/verify/limits.js:80-84` | Untouched at G-3 |
| SCAFFOLD-REPAIR Path D Cases 7+8 | `tests/smoke/07-pending-move-after-halt.test.js` + Case 8 | Untouched at G-3 |
| Phase D DP-5 `MESSAGE_STORE_PATH` validation | `src/config.js` | Untouched at G-3 |
| halt.js RE-4 | `src/runtime/halt.js` | Untouched at G-3 |
| `rate-limit-state.js` canonical contract | `src/runtime/rate-limit-state.js` | Untouched at G-3 |
| `boot.js` Stage 12 wiring | `src/runtime/boot.js:308-371` | Byte-identical at G-3 |
| `boot.js` Stage 13 `createRateLimitState` | `src/runtime/boot.js:448-475` | Byte-identical at G-3 |
| `boot.js` Stage 15 existing production validation | `src/runtime/boot.js:544-562` | Byte-identical at G-3; reads populated resolved refs |
| `boot.js` Stage 15 gate-9 rebind | `src/runtime/boot.js:580-599` | Byte-identical at G-3 |
| `boot.js` Stage 16 pipeline loop + runPipeline call | `src/runtime/boot.js:601-694` | Byte-identical at G-3 |

---

## §12 — Future G-3 implementation file scope (Codex-approved)

Exactly 2 Relay-repo files (per Codex Q2 confirmation + sealed G-READINESS-DESIGN-SPEC G-3 Correction E):

| # | File | Action | Estimated lines |
|---|---|---|---|
| 1 | `src/runtime/boot.js` | EDIT — additive Stage 15 extension only; new gateway imports at top of file; new default-wiring block in Stage 15; 1-line module-header `runtimeConfig` field documentation update | +35-55 added lines; 0 deletions |
| 2 | `tests/smoke/14-boot-gate-9-wiring.test.js` | NEW — mocked side-effect-free boot wiring test | ~150-200 lines |

**No more, no less.** Forbidden file paths (Codex Round-3 G-2 rejection list applies to G-3 scope by reference):
- Any other `src/runtime/*` file
- Any `src/verify/*` file
- Any `src/gateway/*` file (G-2 sealed)
- Any `src/store/*` file
- `src/config.js`, `src/index.js`, `src/log.js`
- `package.json`, `package-lock.json`
- Existing `tests/smoke/*.test.js` files
- `tests/smoke/helpers/*`
- `schemas/*`
- Parent repo files
- Sealed parent handoffs

---

## §13 — Codex G-3 review chain record

| Review | Verdict | Required edits | Status |
|---|---|---|---|
| G-3 design round-1 (fresh after stale-task bypass) | PASS WITH REQUIRED EDITS | 3 corrections (reassignment-back / atomic three-ref / allowlist source resolution) | Applied conversation-only |
| G-3 design round-2 narrow re-review | PASS (13/13 goals) | none | Resolved |
| Codification gate | CLEARED | n/a | Proceeded to this DESIGN-SPEC |

### Round-1 corrections applied verbatim in this codification

- **Correction 1 (reassignment-back / resolved-ref specification):** §4 above. Default-wiring assigns constructed refs back into the 3 Phase G parameter variables before the existing production validation runs. Existing validation reads populated resolved refs, not stale missing parameter values.
- **Correction 2 (atomic three-ref construction):** §5 above. All 3 refs constructed together inside a single `try` block; partial wiring forbidden; shared `allowlistHook` + `egressEventLog` instances; on throw, none of the 3 refs treated as installed and boot fails closed.
- **Correction 3 (Option A allowlist source):** §6 above. `runtimeConfig.allowlistedDiscordHostnames: string[]` extension; 1-line module-header documentation update; `runtimeConfig?.allowlistedDiscordHostnames ?? []` source expression; no boot-local canonical constant; fail-closed semantics preserved.

---

## §14 — Non-authorization clauses

This G-3 DESIGN-SPEC does **NOT** authorize:

- Opening `COMM-HUB-RELAY-RUNTIME-IMPLEMENT-G-3-BOOT-JS-GATE-9-WIRING` (Mode 5 HIGH-RISK IMPLEMENTATION with non-activation scope) — requires separate named operator open
- Editing any Relay file (`src/runtime/boot.js`, `tests/smoke/14-boot-gate-9-wiring.test.js` are scoped for future implementation, not this DESIGN-SPEC turn)
- Editing any sealed file (sealed Phase E/F/G modules; sealed amendments; sealed parent handoffs)
- `.login()` call; gateway IDENTIFY; real REST send; real message publish; real Discord token use
- Real network reach
- Relay activation; bot login
- Stage 5 install resumption (CONSUMED at `40f3137e…`)
- Stages 7-10b (Discord activation cascade)
- Railway / deploy
- DB / Kraken / env / secrets / armed-trading flag / trading
- Autopilot Loop B/C/D / CEILING-PAUSE change
- External Hermes Agent (Nous/OpenRouter)
- Scheduler / cron / webhook / MCP install
- Permission widening
- `npm install` / `npm ci` / `npx` / `npm test` / `node --test` execution
- Opening G-4 / G-5
- Modifying any sealed amendment (AMENDMENT-3 / 5 / 6 / 7 / CASE-09 / CASE-12 / SCAFFOLD-REPAIR Path D / Phase D DP-5 / halt.js RE-4 / `rate-limit-state.js` / `boot.js` Stage 12/13/15 invariants)
- Migration 008+ / DASH-6 / D-5.12f-h / Migration 009+ / Phase H
- Introduction of Unicode arrow `→` (U+2192) or Unicode `§` (U+00A7) in new source comments
- Editing the sealed G-DESIGN handoff at parent `66af7df…`
- Editing the sealed G-READINESS-DESIGN handoff at parent `95da6ef…`
- Editing the sealed G-2 `src/gateway/*` files at Relay `2765a97…`
- Editing this G-3 DESIGN handoff after it seals
- Bundling G-3 with G-4 or G-5
- Skipping the Codex post-implementation HIGH-RISK review before commit

**This web project is entirely separate from the trading runtime `dashboard.js`. It does not modify, replace, or supplement live trading functionality.**

---

## §15 — Future G-3 implementation gating requirements

Before G-3 SAFE IMPLEMENTATION may proceed:

1. **Separate named operator open** of `COMM-HUB-RELAY-RUNTIME-IMPLEMENT-G-3-BOOT-JS-GATE-9-WIRING` (Mode 5 HIGH-RISK IMPLEMENTATION with non-activation scope).
2. **Codex pre-implementation HIGH-RISK review** of the implementation plan (round-1; round-2 if required edits surface).
3. After implementation completes: **Codex HIGH-RISK post-edit review** of the actual `boot.js` diff + new test file. Post-edit review must confirm:
   - File scope exactly 2 files: `src/runtime/boot.js` + `tests/smoke/14-boot-gate-9-wiring.test.js`
   - `src/runtime/boot.js` edit is ADDITIVE only (Stages 1-14, Stage 16, existing Stage 15 validation byte-identical)
   - AMENDMENT-3/5/6/7 / CASE-09 / CASE-12 invariants preserved
   - All 5 G-2 factory invocations match sealed signatures
   - `rateLimitState` closure-captured from Stage 13 local
   - Atomic three-ref construction enforced
   - Reassignment-back enforced
   - `runtimeConfig.allowlistedDiscordHostnames` source used; no boot-local constant
   - `validateOnly: true` enforced on `createSendMessage`
   - No `.login()` / no gateway IDENTIFY / no real network reach
   - ASCII-only WHY comments (no Unicode `→` or `§`)
   - `package.json` + `package-lock.json` byte-identical to G-1 seal
   - `src/verify/network-anomaly.js` byte-identical
   - G-2 gateway files byte-identical
   - No existing test edits
4. **Separate operator commit-only approval** naming the exact 2-file Relay-repo scope.
5. **Separate operator push approval** naming destination `relentlessvic/agent-avila-relay` `main`.
6. **Three-way SHA consistency PASS** post-push (Relay local HEAD = Relay origin/main = Relay live remote `refs/heads/main`).
7. **G-3-CLOSEOUT** opens in parent repo per `*-N-CLOSEOUT` pattern (DOCS-ONLY; 3 status doc updates only; no new handoff).

No test execution at G-3 unless separately approved (`node --test` deferred to G-5 RUN-10 per sealed G-READINESS-DESIGN-SPEC).

---

## §16 — Carry-forward state

- **Parent HEAD at this codification time:** `d342c12cd4ce4f86fcaf22475339db66fb6b63cc` (G-2-CLOSEOUT-SYNC SEALED; pre-G-3-DESIGN-SPEC anchor)
- **Relay HEAD:** `2765a9707c99f48d89cf0aa8d85eb72adc50e56e` (G-2 SEAL preserved; untouched through G-3 DESIGN + this DESIGN-SPEC codification)
- **F-HALT-SMOKE terminal end-state:** `13/13/0/0` carried forward at parent `2306463…` → `66af7df…` → `39d4f4d…` → `95da6ef…` → `098f00b…` → `2ca3266…` → `d60c989…` → `30ae676…` → `d342c12…`; will be re-asserted at G-5 RUN-10 with expected `13+N/13+N/0/0`
- **Relay-runtime:** DORMANT preserved
- **Autopilot:** DORMANT preserved (verified at `eff4dd22…`)
- **Approvers:** exactly `{Victor}`
- **Migration 008:** APPLIED at `189eb1be…` preserved; N-3 CLOSED preserved
- **Stage 5 Gate-10 install approval:** CONSUMED at `40f3137e…` preserved (separately gated from G-1)
- **G-1 Gate-10 RED-tier dependency-install approval:** CONSUMED at G-1 seal `8151d36…` preserved
- **Sealed handoffs preserved verbatim:** G-DESIGN at `66af7df…`; G-READINESS-DESIGN at `95da6ef…`; RUNTIME-DESIGN; E-VERIFY-DESIGN; F-HALT-DESIGN; C-CONFIG-DESIGN; COMM-HUB-RELAY-RULES; CASE-12-DESIGN at `a3a7e35…`; CASE-09-DESIGN at `23ad7c7…`; AMENDMENT-7-DESIGN at `90d97114…`; AMENDMENT-6-DESIGN at `b880be9b…`; AMENDMENT-5-DESIGN at `0e9a678e…`; SCAFFOLD-REPAIR-DESIGN at `31ea6f5f…`
- **Relay-repo lettered chain:** F-HALT-SMOKE-CASE-12 `f5c5cdb…` → G-1-DISCORD-JS-INSTALL `8151d36…` → G-2-GATEWAY-MODULES-IMPLEMENT `2765a97…`; G-3 SEAL will append after future implementation
- **Antigravity chain SHAs:** preserved
- **PROJECT-PROGRESS-DASHBOARD cascade:** preserved
- **Untracked carve-outs:** `position.json.snap.20260502T020154Z` + `orchestrator/handoffs/evidence/` (RUN-1 through RUN-9 + G-1-DISCORD-JS-INSTALL/ + G-1-DISCORD-JS-INSTALL-METADATA/) preserved untracked

---

## §17 — Reference anchors

| Anchor | Value |
|---|---|
| This DESIGN-SPEC's authoring source | conversation-approved G-3 BOOT-JS-GATE-9-WIRING-DESIGN Mode 2 (this Claude session) |
| Codex G-3 review chain | round-1 PASS WITH REQUIRED EDITS (3 corrections) + round-2 narrow re-review PASS (13/13 goals; no required edits) |
| Sealed precedent design | `orchestrator/handoffs/COMM-HUB-RELAY-RUNTIME-IMPLEMENT-G-DESIGN.md` at parent `66af7df…` (Phase G monolithic envelope) |
| Sealed precedent readiness plan | `orchestrator/handoffs/COMM-HUB-RELAY-RUNTIME-IMPLEMENT-G-READINESS-DESIGN.md` at parent `95da6ef…` (G-0 → G-5 6-subphase split) |
| G-3 future implementation scope | `src/runtime/boot.js` EDIT + `tests/smoke/14-boot-gate-9-wiring.test.js` NEW |
| G-3 future implementation mode | Mode 5 HIGH-RISK IMPLEMENTATION with non-activation scope (highest-risk Phase G subphase) |
| Path A vs Path B | Path A selected; Path B not viable (rateLimitState created inside Stage 13) |
| Allowlist source | Option A: `runtimeConfig.allowlistedDiscordHostnames` |
| Default-wiring trigger | `relayMode === 'production'` + any of 3 Phase G refs missing |
| Atomic three-ref invariant | All 3 refs constructed together in single `try` block; partial wiring forbidden |
| Reassignment-back invariant | Constructed refs assigned back into parameter variables before existing validation runs |
| ASCII discipline | No Unicode `→` (U+2192) or `§` (U+00A7) in new source comments per CASE-09 + CASE-12 sealed precedent |
| Phase G implementation terminal goal | RUN-10 TAP `13+N/13+N/0/0`; Relay-runtime activation remains separately gated; deployment remains separately gated per sealed G-DESIGN Edit 4 |
