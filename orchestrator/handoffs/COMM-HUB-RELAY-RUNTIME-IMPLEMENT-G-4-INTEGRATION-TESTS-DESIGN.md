# COMM-HUB-RELAY-RUNTIME-IMPLEMENT-G-4-INTEGRATION-TESTS-DESIGN

**Status:** SEALED handoff record at parent codification SHA `<G-4-DESIGN-SPEC commit SHA>` (set at codification seal).
**Phase mode (when authored):** Mode 2 DESIGN-ONLY (conversation-only).
**Phase mode (codification):** Mode 3 DOCS-ONLY (this handoff).
**Future implementation mode:** Mode 5 HIGH-RISK IMPLEMENTATION with non-activation scope (tests-only).
**Sealed grounding:** parent G-DESIGN at `66af7df236745da8a3b3df92463166bc4d8fabf8` + parent G-READINESS-DESIGN at `95da6efc05c0263e1994e6ae5c1ca0b24e499307` + parent G-3 DESIGN at `29ea5a4b8c57d6864ae4f1be3025a06c3615dea8`.
**Pre-codification anchors:** parent HEAD `18ab14b83fc995ec58eef945b09ec42913343fac` (G-3-CLOSEOUT-SYNC seal) + Relay HEAD `05d2d9577c043f4e1dcb45112e7723508cf495f4` (G-3 BOOT-JS-GATE-9-WIRING seal).
**Codex DESIGN-ONLY review chain:** round-1 PASS (no required edits; no round-2 needed). Codex agent ID `a92232f621254d418`.
**Approvers exactly `{Victor}`.** Codex review verdicts do NOT constitute operator approval at any boundary.

This handoff is preserved verbatim through every subsequent G-4 subphase and never edited after codification.

---

## §0 — Background

G-4 INTEGRATION-TESTS is the fifth of six Phase G subphases per sealed G-READINESS-DESIGN-SPEC §2. With G-1 (discord.js install), G-2 (gateway modules), and G-3 (boot Stage 15 wiring) sealed, the next gated boundary is integration-test coverage of the Phase G surfaces that the existing G-2/G-3 mocked smoke tests (`tests/smoke/13-discord-client-side-effect-free.test.js` + `tests/smoke/14-boot-gate-9-wiring.test.js`) exercise only at breadth, not at depth.

Sealed G-READINESS-DESIGN §2 line 103 fixes the G-4 file scope at "NEW test files only — proposed: Send Message wrapper integration test + egress allowlist hook test + egress event log test + gate-9 network-anomaly verifier test (4 NEW test files)" with line 104 prohibiting any `src/*` / `package*.json` / existing-test edit.

This codified handoff persists the conversation-only G-4 DESIGN turn (parent G-3-CLOSEOUT-SYNC `18ab14b8…` + 1 conversation) approved by Codex DESIGN-ONLY round-1 review (PASS; zero required edits) as a permanent SAFE-class record.

---

## §1 — Why DESIGN-ONLY first (no direct-to-implement)

G-3 used the explicit DESIGN -> DESIGN-SPEC -> IMPLEMENT chain because G-3 touched sealed source (`src/runtime/boot.js`). G-4 does NOT touch sealed source -- only adds 4 new test files. However:

- Sealed G-READINESS-DESIGN §2 G-4 line 107 explicitly requires "(a) pre-implementation DESIGN-ONLY plan of each new test's assertions + mock-injection contract + no-real-network guarantee" BEFORE "(b) post-implementation SAFE IMPLEMENTATION review on the NEW test files."
- Cross-cutting invariant #11 (sealed G-READINESS-DESIGN §3): "Codex review chain at every boundary -- DESIGN-ONLY (pre-plan) + SAFE IMPLEMENTATION (post-diff) + DOCS-ONLY (CLOSEOUT). Skipping any review tier is a phase fail."
- Cross-cutting invariant #12: "No bundling -- each subphase is a single commit; combining G-N + G-N+1 in one commit is forbidden."
- The 4 test files include test 18 (gate-9 verifier integration), which exercises a brand-new contract surface (DPI-E10 split-binding between Phase G's hook+log and Phase E's verifier) untested in F-HALT-SMOKE; pre-designing the halt-class branch coverage protects against scope drift mid-implementation.

**Conclusion:** explicit DESIGN-ONLY first, codification via DESIGN-SPEC second, IMPLEMENT third.

---

## §2 — Future G-4 implementation file scope (locked; Codex-confirmed)

Exactly **4 NEW Relay test files**, **0 modified files**:

1. `tests/smoke/15-send-message-wrapper-integration.test.js` (NEW)
2. `tests/smoke/16-egress-allowlist-hook-integration.test.js` (NEW)
3. `tests/smoke/17-egress-event-log-integration.test.js` (NEW)
4. `tests/smoke/18-gate-9-network-anomaly-verifier-integration.test.js` (NEW)

Numbering rationale: tests 01-12 are Phase F sealed cases; test 13 is G-2 (`13-discord-client-side-effect-free.test.js`); test 14 is G-3 (`14-boot-gate-9-wiring.test.js`). Tests 15-18 follow naturally and do not collide with any existing file.

---

## §3 — Files explicitly NOT touched in future G-4 implementation

- All `src/*` files (sealed at G-2 / G-3)
- All `src/gateway/*` files (sealed at G-2 `2765a97…`)
- `src/runtime/boot.js` (sealed at G-3 `05d2d95…`)
- `src/runtime/run-pipeline.js`
- `src/runtime/rate-limit-state.js`
- `src/runtime/halt.js`
- `src/runtime/boot-halt-fallback.js`
- `src/verify/network-anomaly.js` (sealed gate-9 verifier; G-4 test 18 IMPORTS it but does NOT edit it)
- All other `src/verify/*`
- All `src/store/*`
- `package.json` and `package-lock.json` (no new dependency at G-4)
- All existing `tests/smoke/01-*.test.js` through `tests/smoke/14-boot-gate-9-wiring.test.js`
- All `tests/smoke/helpers/*` (`network-observer.js` + `synthetic-message.js` + `synthetic-runtime-config.js` + `temp-tree.js`)
- All `schemas/*`
- All parent-repo files (except this DESIGN-SPEC's authorized 4-file scope)
- All sealed parent-repo handoffs (G-DESIGN at `66af7df…`, G-READINESS-DESIGN at `95da6ef…`, G-3 DESIGN at `29ea5a4…`, RUNTIME-DESIGN, E-VERIFY-DESIGN, F-HALT-DESIGN, C-CONFIG-DESIGN, COMM-HUB-RELAY-RULES, all CASE/AMENDMENT/SCAFFOLD-REPAIR records)

---

## §4 — Per-test assertion plan

### §4.1 Test 15 -- `tests/smoke/15-send-message-wrapper-integration.test.js`

**Purpose:** integration coverage of sealed `src/gateway/send-message.js` factory branches not exercised by the validateOnly happy path in test 13.

**Sealed source-of-truth referenced:** `src/gateway/send-message.js` lines 30-118 (`SendMessageError` class + `createSendMessage` factory + factory-time real-send guard at lines 62-67 + sendMessage closure at lines 70-117).

**Subtests (each wrapped in `observeNoNetwork()` lifecycle):**

1. **`createSendMessage` requires `client`** -- calling with `{}` or `{client: null}` throws `SendMessageError` with `reason: 'client-missing'`.
2. **Factory-time real-send guard** -- `createSendMessage({ client: { /* no _isMockedClient */ }, validateOnly: false })` throws `SendMessageError` with `reason: 'real-send-not-authorized'` at factory invocation (not at send-time).
3. **`_isMockedClient` branch is accepted** -- `createSendMessage({ client: { _isMockedClient: true }, validateOnly: false })` returns a callable.
4. **`_operatorActivationFlag` branch is accepted but unreachable at G-4** -- `createSendMessage({ client: { _operatorActivationFlag: true }, validateOnly: false })` returns a callable; invoking it with valid channelId + payload throws `SendMessageError` with `reason: 'real-send-branch-at-g2'` (defense-in-depth call-time guard since no real client is wired).
5. **`validateOnly: true` returns `dispatchAttempt: 'simulated'`** -- `await sendMessage('CHANNEL-1', { body: 'hi' })` returns `{ ok: true, dispatchAttempt: 'simulated', channelId: 'CHANNEL-1', bodyLength: 2 }`.
6. **Mocked-client returns `dispatchAttempt: 'mocked'`** -- wrapper built with `_isMockedClient: true` + `validateOnly: false`; invoking returns `{ ok: true, dispatchAttempt: 'mocked', channelId, bodyLength }`.
7. **`invalid-channel-id` branch** -- `sendMessage('', {body: 'x'})` returns `{ ok: false, reason: 'invalid-channel-id' }`; `sendMessage(123, {body: 'x'})` returns same.
8. **`payload-not-object` branch** -- `sendMessage('CH', null)` returns `{ ok: false, reason: 'payload-not-object' }`; `sendMessage('CH', 'string')` returns same.
9. **`payload-body-not-string` branch** -- `sendMessage('CH', { body: 123 })` returns `{ ok: false, reason: 'payload-body-not-string' }`; `sendMessage('CH', {})` returns same.
10. **No-network final assertion** -- `observer.log` is empty across all module loads + factory invocations + send invocations.

**Mock injection contract:**
- `client` mock: `{ _isMockedClient: true }` (plain object; no real discord.js Client)
- No real Discord token used anywhere
- No `.login()` call attempted
- No gateway IDENTIFY
- No REST send

### §4.2 Test 16 -- `tests/smoke/16-egress-allowlist-hook-integration.test.js`

**Purpose:** integration coverage of sealed `src/gateway/egress-allowlist-hook.js` constructor validation + invoke branches + frozen-list invariants not exercised by test 13.

**Sealed source-of-truth referenced:** `src/gateway/egress-allowlist-hook.js` lines 40-93 (`createEgressAllowlistHook` factory + Array validation at lines 41-48 + frozen-copy at line 50 + `Object.freeze({allowlistedHostnames, invoke})` at line 51 + invoke branches at lines 66-92).

**Subtests (each wrapped in `observeNoNetwork()` lifecycle):**

1. **Hook shape matches verifier `EXPECTED_HOOK_SHAPE_KEYS`** -- returned object has exactly `allowlistedHostnames` (Array, frozen) + `invoke` (function); `Array.isArray(hook.allowlistedHostnames) === true`; `typeof hook.invoke === 'function'`.
2. **Constructor rejects non-Array `allowlistedHostnames`** -- `createEgressAllowlistHook({allowlistedHostnames: 'not-an-array'})` throws `Error` with message `'egress-allowlist-hook: allowlistedHostnames must be an Array'`.
3. **Constructor rejects non-string hostname entry** -- `createEgressAllowlistHook({allowlistedHostnames: ['discord.com', 42]})` throws with message `'egress-allowlist-hook: each allowlisted hostname must be a non-empty string'`.
4. **Constructor rejects empty-string hostname entry** -- `createEgressAllowlistHook({allowlistedHostnames: ['discord.com', '']})` throws same.
5. **Default empty allowlist is valid** -- `createEgressAllowlistHook()` returns a hook with `allowlistedHostnames.length === 0`.
6. **`invoke({})` (request without hostname)** -- returns `{allowed: false, hostname: '', hookBypassed: false, outcome: 'hook-rejected-missing-hostname'}`.
7. **`invoke(null)`** -- returns `{allowed: false, hostname: '', hookBypassed: false, outcome: 'hook-rejected-missing-request'}`; `invoke('string')` returns same (typeof check fails).
8. **`invoke({hostname: 'discord.com'})` on allowlisted host** -- returns `{allowed: true, hostname: 'discord.com', hookBypassed: false, outcome: 'hook-allowed'}`.
9. **`invoke({hostname: 'evil.example.com'})` on non-allowlisted host** -- returns `{allowed: false, hostname: 'evil.example.com', hookBypassed: false, outcome: 'hook-blocked-non-allowlisted'}`.
10. **Frozen-list immutability** -- `hook.allowlistedHostnames.push('attacker.com')` throws `TypeError` (frozen Array); `Object.isFrozen(hook) === true`; `Object.isFrozen(hook.allowlistedHostnames) === true`.
11. **Original-array isolation** -- mutating the input array post-construction (e.g. `originalList.push('attacker.com')`) does NOT mutate `hook.allowlistedHostnames` (frozen copy was taken at construction via `[...allowlistedHostnames]`).
12. **No-network final assertion** -- `observer.log` empty.

**Mock injection contract:** none required (pure constructor + pure `invoke` function).

### §4.3 Test 17 -- `tests/smoke/17-egress-event-log-integration.test.js`

**Purpose:** integration coverage of sealed `src/gateway/egress-event-log.js` `pushBounded` FIFO + `maxSize` validation + non-Array log rejection not exercised by the single FIFO loop in test 13.

**Sealed source-of-truth referenced:** `src/gateway/egress-event-log.js` lines 30-60 (`DEFAULT_MAX_SIZE = 1000` constant + `createEgressEventLog` factory at lines 37-42 + `pushBounded` helper at lines 48-59).

**Subtests (each wrapped in `observeNoNetwork()` lifecycle):**

1. **`createEgressEventLog()` defaults to empty Array** -- `Array.isArray(log) === true`; `log.length === 0`.
2. **`createEgressEventLog({maxSize: 0})` throws** -- `'egress-event-log: maxSize must be a positive integer'`.
3. **`createEgressEventLog({maxSize: -5})` throws** -- same.
4. **`createEgressEventLog({maxSize: 1.5})` throws** -- `Number.isInteger` rejects.
5. **`createEgressEventLog({maxSize: 'ten'})` throws** -- same.
6. **`DEFAULT_MAX_SIZE === 1000`** -- direct constant import sanity check (no semantic claim beyond the literal).
7. **`pushBounded(log, entry)` defaults to `DEFAULT_MAX_SIZE`** -- push one entry; `log.length === 1`.
8. **`pushBounded` FIFO eviction under heavy load** -- push 2500 entries with `maxSize = 100`; `log.length === 100`; first entry is the 2401st pushed (FIFO discipline); last entry is the 2500th pushed.
9. **`pushBounded` rejects non-Array log** -- `pushBounded({}, entry, 10)` throws `'egress-event-log: log must be an Array'`; `pushBounded(null, entry, 10)` throws same.
10. **`pushBounded` rejects non-positive maxSize at push-time** -- `pushBounded(log, entry, 0)` throws.
11. **`pushBounded` rejects non-integer maxSize at push-time** -- `pushBounded(log, entry, 1.5)` throws.
12. **No-network final assertion** -- `observer.log` empty.

**Mock injection contract:** none required (pure functions + plain Array).

### §4.4 Test 18 -- `tests/smoke/18-gate-9-network-anomaly-verifier-integration.test.js`

**Purpose:** integration coverage of the DPI-E10 split-binding contract between Phase G (owner of allowlist hook + egress event log) and Phase E (verifier). Exercises sealed `src/verify/network-anomaly.js` `createNetworkAnomalyGate` across all halt branches with Phase G-shaped inputs from G-2 modules.

**Sealed source-of-truth referenced:**
- `src/verify/network-anomaly.js` lines 36-211 (`HALT_CLASS` Object.freeze at lines 36-40 + `EXPECTED_HOOK_SHAPE_KEYS` at line 45 + `NetworkAnomalyError` class at lines 47-54 + `createNetworkAnomalyGate` at lines 71-211)
- `src/gateway/egress-allowlist-hook.js` (provides Phase G-shaped hook for verifier consumption)
- `src/gateway/egress-event-log.js` (provides Phase G-shaped log for verifier consumption)

**Halt class IDs verified:**
- `6` = `NETWORK_ANOMALY_EGRESS` (non-allowlisted hostname)
- `23` = `NETWORK_HOOK_BYPASS` (hook bypassed)
- `32` = `NETWORK_HOOK_MISSING_OR_INTEGRITY_FAILURE` (missing/integrity)

**Subtests (each wrapped in `observeNoNetwork()` lifecycle):**

1. **`hook-missing` halt 32 with null ref** -- `createNetworkAnomalyGate({allowlistHookRef: null, egressEventLogRef: [], safeLog})`; `verify(message)` returns `{ok: false, errors: [{keyword: 'network-hook-missing', haltClassOverride: 32}]}`; `safeLogCalls` captures `{event: 'network-anomaly-hook-missing', haltClass: 32}`.
2. **`hook-missing` halt 32 with undefined ref** -- same shape with `allowlistHookRef: undefined`.
3. **`hook-shape-missing-key` halt 32 for `allowlistedHostnames`** -- pass `{invoke: () => {}}`; verify returns `{ok: false, errors: [{keyword: 'network-hook-integrity-failure', params: {missingKey: 'allowlistedHostnames'}, haltClassOverride: 32}]}`.
4. **`hook-shape-missing-key` halt 32 for `invoke`** -- pass `{allowlistedHostnames: []}`; same shape with `missingKey: 'invoke'`.
5. **`hook-shape-type-mismatch` halt 32 for `allowlistedHostnames` not Array** -- pass `{allowlistedHostnames: 'string', invoke: () => {}}`; verify returns `{ok: false, errors: [{keyword: 'network-hook-integrity-failure', haltClassOverride: 32}]}`; `safeLogCalls` captures `{event: 'network-anomaly-hook-shape-type', haltClass: 32}`.
6. **`hook-shape-type-mismatch` halt 32 for `invoke` not function** -- `{allowlistedHostnames: [], invoke: 'not-a-function'}` triggers same path.
7. **`log-missing` halt 32 (null)** -- pass valid hook + `egressEventLogRef: null`; verify returns `{ok: false, errors: [{keyword: 'network-event-log-missing', haltClassOverride: 32}]}`; `safeLogCalls` captures `{event: 'network-anomaly-log-missing', haltClass: 32}`.
8. **`log-missing` halt 32 (non-Array)** -- pass `egressEventLogRef: {}`; same path triggered.
9. **`hook-bypass` halt 23 via `hookBypassed: true`** -- pass valid hook + log `[{hookBypassed: true, hostname: 'discord.com'}]`; verify returns `{ok: false, errors: [{keyword: 'network-hook-bypass', params: {bypassCount: 1}, haltClassOverride: 23}]}`.
10. **`hook-bypass` halt 23 via `outcome: 'hook-bypass'`** -- log entry `{outcome: 'hook-bypass'}` triggers same path; bypassCount = 1.
11. **`hook-bypass` halt 23 with multiple events** -- log with 3 hookBypassed entries; bypassCount = 3.
12. **`non-allowlisted-hostname` halt 6** -- pass hook `{allowlistedHostnames: ['discord.com'], invoke}` + log `[{hostname: 'evil.example.com', hookBypassed: false}]`; verify returns `{ok: false, errors: [{keyword: 'network-anomaly-egress', params: {violationCount: 1}, haltClassOverride: 6}]}`; `safeLogCalls` captures `{event: 'network-anomaly-egress-detected', haltClass: 6}`.
13. **Clean log -> `{ok: true}`** -- pass hook with `['discord.com']` + log `[{hostname: 'discord.com', hookBypassed: false}]`; verify returns `{ok: true}`; `safeLogCalls.length === 0`.
14. **Empty clean log -> `{ok: true}`** -- pass valid hook + empty `[]` log; verify returns `{ok: true}`.
15. **Phase G-shaped hook is contract-compatible (DPI-E10 split-binding)** -- construct real Phase G hook via `createEgressAllowlistHook({allowlistedHostnames: ['discord.com']})` from sealed `src/gateway/egress-allowlist-hook.js`; pass directly to `createNetworkAnomalyGate`; verify against a Phase G-shaped log built via `createEgressEventLog({maxSize: 100})` + `pushBounded` (one `{hostname: 'discord.com', hookBypassed: false, outcome: 'sent'}` entry); verify returns `{ok: true}`. This is the key DPI-E10 split-binding integration assertion.
16. **No-network final assertion** -- `observer.log` empty.

**Mock injection contract:**
- `safeLog`: `const safeLogCalls = []; const safeLog = (level, payload) => safeLogCalls.push({level, payload});`
- `message`: `{message_id: 'M-G4-VERIFIER', channel_id: 'CHANNEL-1'}` synthetic shape (verifier ignores message content; only hook/log refs gate verifier behavior).
- No real Discord token; no `.login()`; no gateway IDENTIFY; no REST send; no message publish.

---

## §5 — Mock / no-network strategy (cross-test)

All 4 G-4 tests follow the sealed AMENDMENT-7 helper pattern + the sealed `tests/smoke/helpers/network-observer.js` lifecycle, identical to tests 13 and 14:

```
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { observeNoNetwork } from './helpers/network-observer.js';

test('Phase G G-4 <subject> integration', async () => {
  const observer = observeNoNetwork();
  try {
    const { <factory> } = await import('../../<subject path>');
    // assertions
    assert.deepEqual(observer.log, [], 'no network calls should have occurred');
  } finally {
    observer.restore();
  }
});
```

**Common discipline across all 4 tests:**
- ES module syntax only
- `import` at top + dynamic `import()` of subject modules INSIDE the `observer = observeNoNetwork()` window
- Final assertion is `assert.deepEqual(observer.log, [], '...')`
- `try { ... } finally { observer.restore(); }` lifecycle (sealed pattern from tests 10, 13, 14)
- ASCII-only WHY comments -- zero Unicode arrow U+2192, zero Unicode section symbol U+00A7 per CASE-09 + CASE-12 sealed precedent
- No real Discord token (no use of `SYNTHETIC_DISCORD_BOT_TOKEN`; G-4 tests do not boot Relay)
- No `.login()`, no gateway IDENTIFY, no REST send, no message publish, no real network reach
- No fs writes outside `node:test`'s own temp-dir hygiene (G-4 tests do not write fixtures)
- No edits to `tests/smoke/helpers/*` (helpers are sealed; G-4 reuses them by import)

---

## §6 — Test execution discipline

Per sealed G-READINESS-DESIGN §2 G-4 line 106: "**Tests:** no `node --test` execution this subphase (deferred to G-5 smoke RUN-10)."

G-4 implementation creates the 4 NEW test files but **does NOT execute them**. Execution remains separately gated under G-5 POST-IMPLEMENTATION-SMOKE-RUN-10 (Mode 4 SAFE EXECUTION) as a single-use smoke-execution approval.

**Why this matters:**
- Running tests at G-4 commit time would require a separate "single-use smoke-execution" operator approval (G-5's special class).
- It would duplicate work already gated under G-5's hardened §4 capture block.
- It would risk byte-identity drift before the G-5 strict diff audit.

---

## §7 — G-5 RUN-10 expected TAP accounting (post-G-4)

Per sealed G-READINESS-DESIGN §2 G-5 line 118: expected `# tests N+13/N+13/0/0` where N = total NEW tests added across G-2 + G-3 + G-4.

After all of Phase G implementation completes:
- G-2 NEW tests: 1 (test 13)
- G-3 NEW tests: 1 (test 14)
- G-4 NEW tests: 4 (tests 15, 16, 17, 18)
- **N = 6**
- **Expected RUN-10 TAP: `# tests 19 / # pass 19 / # fail 0 / # cancelled 0 / # skipped 0 / # todo 0`**

This is asserted at G-5 preflight, not at G-4. G-4 only locks the test-count contribution.

---

## §8 — AMENDMENT preservation requirements

G-4 implementation must preserve verbatim:
- AMENDMENT-3 (sealed precedent)
- AMENDMENT-5 (sealed at `0e9a678e…`)
- AMENDMENT-6 (sealed at `b880be9b…`)
- AMENDMENT-7 (helper-import pattern; sealed at `90d97114…`) -- G-4 tests REUSE the existing sealed helpers without editing them
- CASE-09 (sealed at `23ad7c7…`) -- ASCII-only WHY discipline (no `§`)
- CASE-12 (sealed at `a3a7e35…`) -- ASCII-only WHY discipline (no arrow)
- SCAFFOLD-REPAIR Path D Cases 7+8 (sealed at `31ea6f5f…`)
- Phase D DP-5
- `halt.js` RE-4 invariant
- `rate-limit-state.js` canonical contract
- `boot.js` Stage 12/13/15 wiring invariants

Verification at G-4 implementation time: each invariant re-checked by direct line-range audit before commit.

---

## §9 — Codex G-4 DESIGN review chain record

| Round | Verdict | Required edits | Status |
|---|---|---|---|
| Round 1 -- DESIGN-ONLY review of conversation-only G-4 DESIGN | PASS | none | Cleared on first round |
| Round 2 -- narrow re-review | N/A | none | Not needed; codification gate cleared on round-1 PASS |
| Codification gate | CLEARED | n/a | Proceeded to this DESIGN-SPEC |

Codex agent ID: `a92232f621254d418`. All 24 Codex review goals returned PASS:

1. G-4 is tests-only with no source touch.
2. Future file scope is exactly 4 NEW Relay test files (15-18).
3. No existing test files are modified.
4. No helper files are modified.
5. No source files are modified.
6. No package files are modified.
7. No schema files are modified.
8. Each new test uses observeNoNetwork() lifecycle.
9. Each new test dynamically imports target modules inside the observer window.
10. No test execution authorized at G-4; deferred to G-5 RUN-10.
11. No Discord token, .login(), gateway IDENTIFY, REST send, message publish, or real network reach authorized.
12. No Relay activation authorized.
13. G-5 remains separate and unauthorized.
14. G-4 and G-5 not bundled.
15. Test 15 assertion plan matches sealed src/gateway/send-message.js behavior.
16. Test 16 assertion plan matches sealed src/gateway/egress-allowlist-hook.js behavior.
17. Test 17 assertion plan matches sealed src/gateway/egress-event-log.js behavior.
18. Test 18 assertion plan matches sealed src/verify/network-anomaly.js behavior (all 5 halt branches + 2 ok branches + DPI-E10 split-binding).
19. ASCII-only comment discipline preserved.
20. AMENDMENT-3/5/6/7 + CASE-09/12 + SCAFFOLD-REPAIR Path D + Phase D DP-5 + halt.js RE-4 + rate-limit-state.js + boot.js Stage 12/13/15 invariants preserved.
21. No latent assumption requires modifying sealed source.
22. G-5 expected TAP accounting confirmed: N=6, expected RUN-10 TAP `19/19/0/0` subject to G-5 preflight confirmation.
23. Codex verdicts do not constitute operator approval.
24. No required design edits identified.

---

## §10 — Non-authorization clauses

This G-4-DESIGN-SPEC (Mode 3 DOCS-ONLY codification) does **NOT** authorize:

- Opening `COMM-HUB-RELAY-RUNTIME-IMPLEMENT-G-4-INTEGRATION-TESTS-IMPLEMENT` (Mode 5 HIGH-RISK IMPLEMENTATION with non-activation scope) -- requires separate named operator open
- Opening `COMM-HUB-RELAY-RUNTIME-IMPLEMENT-G-5-POST-IMPLEMENTATION-SMOKE-RUN-10` (Mode 4 SAFE EXECUTION) -- separately gated
- Creating any test file
- Editing any test file
- Editing any source file
- Editing any helper file
- Editing any sealed handoff
- Running `node --test` / `node --check` / `npm install` / `npm ci` / `npx` / `npm test`
- Discord platform action / bot creation / token use / permission grant / webhook creation / channel post / message publish / real gateway IDENTIFY
- Real network reach
- Railway / deploy
- DB / Kraken / env / secrets / armed-trading flag / trading
- Relay activation; bot login
- Stage 5 install resumption (CONSUMED at `40f3137e…` -- separately gated)
- Stages 7-10b (Discord activation cascade)
- Autopilot Loop B/C/D / CEILING-PAUSE change
- External Hermes Agent (Nous/OpenRouter)
- Scheduler / cron / webhook / MCP install
- Permission widening
- Modifying any sealed amendment (AMENDMENT-3 / 5 / 6 / 7 / CASE-09 / CASE-12 / SCAFFOLD-REPAIR Path D / Phase D DP-5 / halt.js RE-4 / `rate-limit-state.js` / `boot.js` Stage 12/13/15)
- Migration 008+ / DASH-6 / D-5.12f-h / Migration 009+ / Phase H
- Introduction of Unicode arrow U+2192 or Unicode section symbol U+00A7 in new source / test comments
- Editing the sealed G-DESIGN handoff at parent `66af7df…`
- Editing the sealed G-READINESS-DESIGN handoff at parent `95da6ef…`
- Editing the sealed G-3 DESIGN handoff at parent `29ea5a4…`
- Editing this G-4 DESIGN handoff after codification seals
- Editing the sealed G-2 `src/gateway/*` files at Relay `2765a97…`
- Editing the sealed G-3 `src/runtime/boot.js` + `tests/smoke/14-boot-gate-9-wiring.test.js` at Relay `05d2d95…`
- Editing any other sealed Relay file (`src/runtime/run-pipeline.js`, `src/runtime/rate-limit-state.js`, `src/runtime/halt.js`, all `src/verify/*`, all `src/store/*`)
- Editing any test helper (`tests/smoke/helpers/*`)
- Editing any existing smoke test (`tests/smoke/01-*.test.js` through `tests/smoke/14-boot-gate-9-wiring.test.js`)
- Bundling G-4 + G-5 in a single commit
- Skipping G-4 to proceed directly to G-5

Codex review verdicts do NOT constitute operator approval. Approvers exactly `{Victor}`.

**This web project is entirely separate from the trading runtime `dashboard.js`. It does not modify, replace, or supplement live trading functionality.**

---

## §11 — Future G-4 implementation gating requirements

To proceed from this G-4 DESIGN-SPEC through implementation, the operator must explicitly open each of the following gated phases in sequence:

1. **`COMM-HUB-RELAY-RUNTIME-IMPLEMENT-G-4-INTEGRATION-TESTS-DESIGN-SPEC-CLOSEOUT-SYNC`** (Mode 3 DOCS-ONLY, optional Rule-1 seal-mirror). Scope: 3 parent status-doc updates only. Codex DOCS-ONLY round-1 PASS required.
2. **`COMM-HUB-RELAY-RUNTIME-IMPLEMENT-G-4-INTEGRATION-TESTS-IMPLEMENT`** (Mode 5 HIGH-RISK IMPLEMENTATION with non-activation scope). Scope: exactly 4 NEW Relay test files (15-18). Codex SAFE IMPLEMENTATION post-edit review required. No test execution at this phase.
3. **`COMM-HUB-RELAY-RUNTIME-IMPLEMENT-G-4-INTEGRATION-TESTS-CLOSEOUT`** (Mode 3 DOCS-ONLY back-fill at parent repo). Scope: 3 parent status-doc updates only. Codex DOCS-ONLY round-1 PASS required.
4. **`COMM-HUB-RELAY-RUNTIME-IMPLEMENT-G-4-INTEGRATION-TESTS-CLOSEOUT-SYNC`** (Mode 3 DOCS-ONLY, optional Rule-1 seal-mirror). Scope: 3 parent status-doc updates only. Codex DOCS-ONLY round-1 PASS required.

Each phase is a single commit + push. Operator approves open + commit-only + push + CLOSEOUT separately for each phase. Codex review verdicts at each layer do not constitute operator approval.

---

## §12 — Risks / unknowns / blockers

- **No source touch required:** G-4 introduces 4 NEW test files only; sealed source / helpers / package / schema / parent-handoff all remain byte-identical. Risk surface is the **lowest** of any G-N implementation subphase to date.
- **Sealed verifier export confirmed:** `createNetworkAnomalyGate` is publicly exported from sealed `src/verify/network-anomaly.js` line 71 -- test 18 can `import { createNetworkAnomalyGate } from '../../src/verify/network-anomaly.js'` cleanly. No blocker.
- **`safeLog` mock pattern is straightforward:** `const safeLogCalls = []; const safeLog = (level, payload) => safeLogCalls.push({level, payload});` matches the verifier's 2-arg `safeLog('error', payload)` contract.
- **Halt-class ID stability:** sealed `HALT_CLASS = Object.freeze({NETWORK_ANOMALY_EGRESS: 6, NETWORK_HOOK_BYPASS: 23, NETWORK_HOOK_MISSING_OR_INTEGRITY_FAILURE: 32})` at network-anomaly.js:36-40 -- test 18 can assert exact `haltClassOverride` values without importing the constants (numeric literals 6, 23, 32 are stable per RUNTIME-DESIGN §15-EXTENSION-FOR-PHASE-E sealed at `c3b3fbcc…`).
- **`observeNoNetwork()` reuse:** sealed RE-3 helper at `tests/smoke/helpers/network-observer.js` lines 1-87 -- patches `node:http/https/net/tls/dgram` request/get/connect/createConnection/Socket.prototype.connect/createSocket; any reach throws `NoNetworkAllowedError` and records to `observer.log`. The 4 G-4 tests' final `assert.deepEqual(observer.log, [])` is the canonical no-network proof.
- **Test 18 DPI-E10 split-binding integration:** the assertion that a Phase G-built hook from `createEgressAllowlistHook` + Phase G-built log from `createEgressEventLog` + Phase E verifier `createNetworkAnomalyGate` compose cleanly is the **highest-value G-4 contribution** because no existing test exercises that interaction. This single subtest 15 (in §4.4) is the integration linchpin.
- **No latent assumption requires sealed-source modification.** All 4 G-4 tests are pure additions.
- **No blockers identified.**

---

## §13 — Carry-forward state

- Parent HEAD at this DESIGN-SPEC codification opening: `18ab14b83fc995ec58eef945b09ec42913343fac` (G-3-CLOSEOUT-SYNC seal).
- Relay HEAD: `05d2d9577c043f4e1dcb45112e7723508cf495f4` (G-3 BOOT-JS-GATE-9-WIRING seal) -- unchanged through G-4 DESIGN-SPEC since Mode 3 is parent-repo only.
- F-HALT-SMOKE maximum-validation terminal end-state `13/13/0/0` baseline preserved; will be re-asserted at G-5 RUN-10 with expected `19/19/0/0` (13 baseline + 1 G-2 + 1 G-3 + 4 G-4).
- Relay-runtime DORMANT preserved.
- Autopilot DORMANT (verified at `eff4dd22…`) preserved.
- AMENDMENT-3 / 5 / 6 / 7 / CASE-09 / CASE-12 / SCAFFOLD-REPAIR Path D / Phase D DP-5 / halt.js RE-4 / rate-limit-state.js / boot.js Stage 12/13/15 invariants preserved.
- Approvers exactly `{Victor}` preserved.
- Authorized untracked carve-outs (`orchestrator/handoffs/evidence/` + `position.json.snap.20260502T020154Z`) preserved untracked.
- discord.js@14.26.4 (sealed at G-1) unchanged; no new dependency at G-4.

---

## §14 — Reference anchors

- Sealed G-DESIGN handoff at parent `66af7df236745da8a3b3df92463166bc4d8fabf8`: `orchestrator/handoffs/COMM-HUB-RELAY-RUNTIME-IMPLEMENT-G-DESIGN.md` (313 lines)
- Sealed G-READINESS-DESIGN handoff at parent `95da6efc05c0263e1994e6ae5c1ca0b24e499307`: `orchestrator/handoffs/COMM-HUB-RELAY-RUNTIME-IMPLEMENT-G-READINESS-DESIGN.md` (282 lines)
- Sealed G-3 DESIGN handoff at parent `29ea5a4b8c57d6864ae4f1be3025a06c3615dea8`: `orchestrator/handoffs/COMM-HUB-RELAY-RUNTIME-IMPLEMENT-G-3-BOOT-JS-GATE-9-WIRING-DESIGN.md` (407 lines)
- Sealed G-2 Relay seal: `2765a9707c99f48d89cf0aa8d85eb72adc50e56e`
- Sealed G-3 Relay seal: `05d2d9577c043f4e1dcb45112e7723508cf495f4`
- Sealed G-3-CLOSEOUT-SYNC parent seal: `18ab14b83fc995ec58eef945b09ec42913343fac`
- Sealed `src/gateway/send-message.js` (118 lines) at Relay `2765a97…`
- Sealed `src/gateway/egress-allowlist-hook.js` (93 lines) at Relay `2765a97…`
- Sealed `src/gateway/egress-event-log.js` (60 lines) at Relay `2765a97…`
- Sealed `src/gateway/phase-g-send-and-record.js` (203 lines) at Relay `2765a97…`
- Sealed `src/gateway/discord-client.js` (53 lines) at Relay `2765a97…`
- Sealed `src/verify/network-anomaly.js` (212 lines) at Relay (pre-G-1)
- Sealed `tests/smoke/helpers/network-observer.js` (87 lines; RE-3 verbatim) at Relay (pre-G-1)
- Sealed `tests/smoke/13-discord-client-side-effect-free.test.js` (145 lines; G-2 reference pattern) at Relay `2765a97…`
- Sealed `tests/smoke/14-boot-gate-9-wiring.test.js` (169 lines; G-3 reference pattern) at Relay `05d2d95…`

---
