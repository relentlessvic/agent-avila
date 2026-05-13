# COMM-HUB-RELAY-RUNTIME-IMPLEMENT-F-HALT-SMOKE-DESIGN

**This handoff codifies the accepted conversation-only F-HALT-SMOKE-DESIGN post-amendment update. This codification phase is DOCS-ONLY (Mode 3). The future implementation phase `COMM-HUB-RELAY-RUNTIME-IMPLEMENT-F-HALT-SMOKE` is SAFE IMPLEMENTATION (Mode 4) — separately gated; not authorized by this codification.**

**Codification provenance:** the conversation-only `COMM-HUB-RELAY-RUNTIME-IMPLEMENT-F-HALT-SMOKE-DESIGN` was originally drafted in a prior session segment (line 4995 of the active session JSONL). Codex DESIGN-ONLY round-1 returned PASS WITH REQUIRED EDITS with 4 REs (RE-1 through RE-4). Operator-approved RE application produced the post-RE state with Codex narrow round-2 PASS. After F-HALT-AMENDMENT landed at Relay `9fb251efa9279dd662f743c4c60e3712612a7e0c` (parent `cf877f443fdfd10b14822ea202ac63166cfc2a08`), the operator opened `COMM-HUB-RELAY-RUNTIME-IMPLEMENT-F-HALT-SMOKE-DESIGN-POST-AMENDMENT-UPDATE` (DESIGN-ONLY Mode 2). Codex DESIGN-ONLY narrow round-1 returned procedural FAIL (artifact-not-found because the design was conversation-only). Codex DESIGN-ONLY narrow round-2 with the full updated design embedded inline returned PASS WITH REQUIRED EDITS — 4 REs: RE-A (Case 11 halt class TBD → halt:2 resolved by sealed Phase E source verification), RE-B (Case 11 note updated to preserve halt:2 during codification), RE-C and RE-D (alleged SHA-typo claims flagged as Codex hallucination — re-read of source text confirmed the alleged typo `f443c4c60` does not exist and every Relay SHA reference used the correct `f743c4c60` substring within `9fb251efa9279dd662f743c4c60e3712612a7e0c`; rejected as spurious by operator). RE-A and RE-B applied. Operator accepted the corrected design as a conversation-only working reference. This handoff is the on-disk codification of that accepted result. This file does NOT itself constitute an execution authorization. Codex review verdicts are not operator approval.

---

## §0 — Phase classification & current anchors

| Property | Value |
|---|---|
| Phase name | `COMM-HUB-RELAY-RUNTIME-IMPLEMENT-F-HALT-SMOKE-DESIGN` |
| Phase mode | Mode 2 / DESIGN-ONLY (this file codifies the accepted conversation-only design; codification phase itself is Mode 3 / DOCS-ONLY) |
| Parent-repo HEAD anchor (post-amendment) | `cf877f443fdfd10b14822ea202ac63166cfc2a08` (F-HALT-AMENDMENT-CLOSEOUT-SYNC sealed) |
| Relay-repo HEAD anchor (post-amendment) | `9fb251efa9279dd662f743c4c60e3712612a7e0c` (F-HALT-AMENDMENT sealed) |
| Phase F SAFE IMPLEMENTATION baseline | `b8ab035034668fd53ea6efe64432f0868dfd2eb9` (historical anchor preserved) |
| F-HALT-AMENDMENT seal | Relay `9fb251efa9279dd662f743c4c60e3712612a7e0c` (source-only; Bugs 1–4 fixed via Hunks A–E) |
| Successor codification phase (gated) | (this phase) `COMM-HUB-RELAY-RUNTIME-IMPLEMENT-F-HALT-SMOKE-DESIGN-SPEC` (DOCS-ONLY / Mode 3) |
| Future implementation phase (gated) | `COMM-HUB-RELAY-RUNTIME-IMPLEMENT-F-HALT-SMOKE` (SAFE IMPLEMENTATION / Mode 4) — adds 4 helpers + 12 test files to Relay repo |
| Parent repo working tree at codification time | clean except `position.json.snap.20260502T020154Z` (untracked carve-out preserved) |
| Relay repo working tree at codification time | clean |
| Relay-runtime status | DORMANT preserved (amendment is source-only; no `boot()` execution, no Discord network surface, no `MESSAGE_STORE_PATH` real path touched, no Phase G hook activated) |

---

## §1 — Purpose & smoke-test goals

Verify Phase F (halt-state machine + boot orchestration) behaves correctly **in isolation** using **disposable temp fixtures** with **no production state, no network, no platform-side posting, no real secrets**. Goals expanded post-amendment to cover Bug 2 + Bug 4 regression coverage per F-HALT-AMENDMENT-DESIGN §419:

1. Confirm boot fail-closed paths (Cases 1–2)
2. Confirm dry-run stub path works end-to-end (Case 3)
3. Confirm gate halts produce canonical §14 publish-log records (Cases 4–7)
4. Confirm post-halt pending-file disposition (Case 8)
5. Confirm safeLog sanitization (Case 9)
6. Confirm no network reach (Case 10)
7. Confirm op-auth staleness gate fires correctly (Case 11 — new, Bug 2 regression coverage; halt class 2 resolved)
8. Confirm per-channel rate-limit halt fires correctly via the new `getRateLimitState` adapter (Case 12 — new, Bug 4 regression coverage; halt class 5 RATE_LIMIT_HIT resolved)

**Case count: 12 (up from 10).**

The smoke tests are an **isolated, fail-fast, single-process** check. They are **NOT** an end-to-end integration test against production infrastructure.

---

## §2 — Strict scope boundaries

**RE-1 active (preserved from post-RE-application state):** Boot smoke tests MUST replace `process.env` with a minimal synthetic allow-listed object whose filesystem values all point inside that test's `mkdtemp` tree, and MUST restore the original `process.env` in finally/after teardown. Tests MUST NOT inherit operator shell env values for Relay runtime paths.

**Smoke tests MUST:**
- Use only `os.tmpdir()` + `fs.mkdtemp()` for all filesystem paths
- Use synthetic `operatorPhaseId` (e.g., `'smoke-test-' + crypto.randomUUID()`)
- Use synthetic `runtimeConfig` with hardcoded, safe values
- Use the sanctioned non-env stub via `phaseGStubMode='stub-empty-allowlist'`
- Clean up temp directories after each test (cleanup hook)
- Run only from the canonical Claude Code session (operator-invoked) — NOT from Antigravity (per workspace-config DPI-WC-3 empty whitelist)
- Halt cleanly on any unexpected production-path reach (defense in depth)

**Smoke tests MUST NOT:**
- Read or write `.env`, `.env.*`, `.envrc`, any cert/key, `~/.ssh/`, `~/.aws/`, `~/.gcp/`, `~/.azure/`, `~/.config/gh/`, `~/.npmrc`, `~/.netrc`, `~/.claude/`
- Read or write `position.json` or `position.json.snap.*`
- Touch the armed-trading flag
- Make any network call (HTTP, DNS resolution beyond OS-level, anything via `http`, `https`, `fetch`, `axios`, `net`, `tls`, `dgram`)
- Post to any platform-side service (no Discord, no Slack, no webhook)
- Connect to any DB (production, staging, or otherwise — no `pg`, `sqlite3`, `mongo`, `redis`)
- Invoke `railway`, `aws`, `gcloud`, `az`, `kubectl`, `docker`, or any deploy CLI
- Invoke any exchange API (Kraken, etc.) or trading code path
- Run `bot.js`, `dashboard.js`, `db.js`, any `migrations/`, any `scripts/`
- Install any new dependency (no `npm install`; use `node:test` built-in only)
- Activate Relay (no real `boot()` against real `MESSAGE_STORE_PATH`; no real Phase G hook)
- Activate Autopilot
- Touch any production state in either repo

**Smoke-test temp-dir layout (per test case):**
```
$(mktemp -d)/
├── pending/        (Phase D writes pending messages here; tests pre-populate)
├── processed/      (Phase D moves messages here after success / halt)
├── publish-log.jsonl
├── dry-run-log.jsonl
└── ceiling-pause-signal  (test-controlled signal file for gate 6)
```

Each test creates its own temp tree, runs `boot()` against it (or invokes specific Phase F factories in isolation), asserts behavior, and removes the temp tree.

---

## §3 — Test-runner choice

**`node:test` (Node built-in since 18).** No new dependency; Relay-repo `package.json` and `package-lock.json` sealed at SCAFFOLD `cc6819d…` and unchanged by F-HALT-AMENDMENT (verified — amendment scope was `src/runtime/boot.js` only). Built-in `node --test tests/smoke/*.test.js`. Supports `describe`/`it`/`before`/`after`. TAP output. Async/await. Subtest isolation.

Rejected alternatives: Jest / Mocha / Vitest (would require `npm install` — FORBIDDEN); custom standalone script (loses ergonomics).

---

## §4 — Test fixture layout

```
/Users/victormercado/code/agent-avila-relay/
└── tests/                                              (NEW; Phase F smoke tests live here — future SAFE IMPLEMENTATION scope)
    └── smoke/
        ├── helpers/
        │   ├── temp-tree.js                            (mkdtemp + cleanup; programmatic store/log paths)
        │   ├── synthetic-message.js                    (builds canonical §14 message objects for fixtures)
        │   ├── synthetic-runtime-config.js             (hardcoded allowedChannels/forbiddenPatterns/etc.)
        │   └── network-observer.js                     (asserts zero outbound network calls during a test)
        ├── 01-boot-fail-closed-missing-operator-phase-id.test.js
        ├── 02-boot-fail-closed-missing-phase-g-hook-production.test.js
        ├── 03-dry-run-stub-boot-success.test.js
        ├── 04-gate-1-schema-mismatch-halt.test.js
        ├── 05-gate-2-channel-allowlist-halt.test.js
        ├── 06-gate-5-idempotency-collision-halt.test.js
        ├── 07-halt-publish-log-append.test.js
        ├── 08-pending-move-after-halt.test.js
        ├── 09-safelog-sensitive-redaction.test.js
        ├── 10-no-network-calls.test.js
        ├── 11-op-auth-staleness-halt.test.js           (Bug 2 regression coverage)
        └── 12-rate-limit-adapter-halt.test.js          (Bug 4 regression coverage)
```

File-count summary: 4 helpers + 12 test cases (up from 10).

Per-test invocation pattern (no test files created in this codification phase; this is forecast structure only):

```javascript
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { boot } from '../../src/runtime/boot.js';
import { createTempTree, cleanupTempTree } from './helpers/temp-tree.js';
import { syntheticRuntimeConfig } from './helpers/synthetic-runtime-config.js';
import { observeNoNetwork, releaseObserver } from './helpers/network-observer.js';

test('<case description>', async (t) => {
  const tempTree = await createTempTree();
  const observer = observeNoNetwork();
  try {
    // setup: place synthetic pending message; configure runtimeConfig
    // act: invoke boot() with controlled inputs (test harness mode)
    // assert: expected halt path / publish-log record / pending disposition
  } finally {
    releaseObserver(observer);
    await cleanupTempTree(tempTree);
  }
});
```

---

## §5 — 12 smoke-test cases

### Cross-cutting rules

**Historical RE-2 (pre-amendment, now retired as an active rule):** Originally surfaced as an active precondition for Cases 1–3 while the `validateEnv` return-shape contract drift (Bug 1) was present in Relay source. **Bug 1 was fixed by F-HALT-AMENDMENT Hunk A at Relay `9fb251efa9279dd662f743c4c60e3712612a7e0c` (parent-repo `cf877f443fdfd10b14822ea202ac63166cfc2a08`). RE-2's conditional premise ("If `src/config.js` returns `{ env }` while `src/runtime/boot.js` reads `{ parsed }`") no longer holds post-amendment.** Smoke tests written against the post-amendment source state no longer need this precondition. RE-2 retained as historical context only, for cascade traceability; not an active test-helper rule.

**RE-4 active (preserved) — cross-cutting helper rule for halt-path cases (Cases 4–8, 11, 12 plus any halt-path sub-case):** Tests that exercise halt paths MUST stub `process.exit` to throw a local `ExitSentinel` carrying the requested exit code, and MUST restore the original `process.exit` in finally/after teardown.

### Case 1: Boot fails closed when `operatorPhaseId` is missing
- **Setup:** Build temp tree; runtimeConfig present; **`operatorPhaseId` undefined**
- **Act:** Call `boot({phaseGStubMode: 'stub-empty-allowlist', runtimeConfig, /* no operatorPhaseId */})`
- **Assert:** `boot()` throws or terminates with halt class 20 (config invalid; `rate-limit-state-missing-operator-phase-id`)
- **Reason:** verifies Phase F design §4 Stage 13 + RE-9 fail-closed rule

### Case 2: Boot fails closed when Phase G refs are missing (production mode)
- **Setup:** Build temp tree; `RELAY_MODE=production`; runtimeConfig + operatorPhaseId present; **`phaseGAllowlistHook` / `phaseGEgressEventLog` / `phaseGSendAndRecord` all missing**
- **Act:** Call `boot({phaseGStubMode: 'disabled', operatorPhaseId, runtimeConfig, /* no Phase G refs */})` with synthetic env where `RELAY_MODE=production`
- **Assert:** boot halts with class 32 (`production-no-phase-g-hook`)
- **Reason:** verifies Phase F design §4 Stage 15 + RE-6 production fail-closed rule

### Case 3: Dry-run stub path can instantiate with `phaseGStubMode='stub-empty-allowlist'`
- **Setup:** Build temp tree; `RELAY_MODE=dry_run`; runtimeConfig + operatorPhaseId present; empty pending dir (no messages)
- **Act:** Call `boot({phaseGStubMode: 'stub-empty-allowlist', operatorPhaseId, runtimeConfig})` with synthetic env where `RELAY_MODE=dry_run`
- **Assert:** boot completes Stages 1–15 without halt; reaches Stage 16 pipeline loop; loop terminates cleanly with `pipeline-loop-complete` event (`processed: 0`)
- **Reason:** verifies the sanctioned stub path works end-to-end

### Case 4: Gate pipeline halts on schema mismatch (gate 1 → halt 29)
- **Setup:** Build temp tree; place a pending message that fails Phase C schema validation (missing required field); dry-run mode
- **Act:** Invoke `boot()` (which will pick up the pending message and run the pipeline)
- **Assert:**
  - publish-log contains a halt record with `outcome: 'halt:29'`
  - pending file is moved to `processed/`
  - process exits with code 29 (clamped to 1–254)
- **Reason:** verifies gate 1 → halt 29 binding + halt sequence

### Case 5: Gate pipeline halts on channel allow-list mismatch (gate 2 → halt 3)
- **Setup:** Build temp tree; place a schema-valid pending message with `channel_id` NOT in `runtimeConfig.allowedChannels`; dry-run mode
- **Act:** Invoke `boot()`
- **Assert:**
  - publish-log halt record `outcome: 'halt:3'`
  - pending moved to processed
- **Reason:** verifies gate 2 binding

### Case 6: Gate pipeline halts on idempotency success collision (gate 5 → halt 7)
- **Setup:** Build temp tree; pre-populate publish-log with a success record for `message_id: 'msg-X'`; then place a pending message with the same `message_id: 'msg-X'`
- **Act:** Invoke `boot()`
- **Assert:**
  - publish-log appends a halt record `outcome: 'halt:7'`
  - pending moved to processed
- **Reason:** verifies gate 5 binding + Phase D publish-log idempotency index integration

### Case 7: Halt outcome appends to publish log
- **Setup:** Use Case 4 fixture
- **Act:** Invoke `boot()`
- **Assert:**
  - publish-log file is JSONL
  - last line parses to canonical §14 record shape: `{message_id, channel_id, outcome: 'halt:<class>', timestamp, process_pid, hermes_version}`
  - file is append-only (O_APPEND verified via Phase D `ensureLogIntegrity`)
- **Reason:** verifies halt-record-shape correctness + Phase D append integrity

### Case 8: Pending message moves safely after halt
- **Setup:** Use Case 4 fixture
- **Act:** Invoke `boot()`
- **Assert:**
  - After halt, `pending/` is empty
  - `processed/` contains the original filename
  - File contents are unchanged (no data corruption during move)
- **Reason:** verifies RE-4 happy-path (append succeeds → moveToProcessed succeeds → moved:true)
- **Additional sub-case:** force `store.moveToProcessed` to fail (e.g., make `processed/` read-only); assert:
  - publish-log halt record still appended
  - pending file remains in `pending/` (RE-4 leave-in-place)
  - safeLog event includes `moved: false, secondaryHaltClass: 24`

### Case 9: safeLog redacts sensitive values
- **Setup:** Build temp tree; instantiate logger with `level: 'debug'`; pre-bind safeLog via `createSafeLog(logger)`
- **Act:** Call `safeLog('debug', { event: 'test', token: 'SECRET_VALUE', body: '...' })`
- **Assert:**
  - log output redacts `token` field per Phase C `REDACT_PATHS`
  - log output preserves non-sensitive fields (`event`, `body`)
- **Reason:** verifies Phase F 2-arg binding preserves Phase C redaction

### Case 10: No network calls occur
- **Setup:** **RE-3 active (preserved):** Network observer patches and restores `node:http` request/get, `node:https` request/get, `node:net` connect/createConnection plus `Socket.prototype.connect`, `node:tls` connect, and `node:dgram` createSocket with wrapped socket send/connect methods; each attempted call records module, method, args summary, and caller, then throws a sentinel `NoNetworkAllowedError`.
- **Act:** Run a full dry-run success boot (Case 3 fixture)
- **Assert:** observer reports zero outbound network attempts
- **Reason:** defense-in-depth verification that Phase F is truly network-free

### Case 11 (NEW) — Op-auth staleness halt fires correctly (Bug 2 regression)
- **Setup:** Build temp tree; configure synthetic `runtimeConfig` with `operatorAuthorizationStalenessThresholdMs` left at default (post-amendment 24h default per Hunk B/C); construct a synthetic operator approval whose `approvedAt` timestamp is older than the staleness threshold (e.g., 25h ago); enqueue a pending message whose channel-action requires that approval to pass through Phase E op-auth gate.
- **Act:** Invoke `boot()` (Stages 1–16 should reach the per-message verify path at gate-4 / op-auth check).
- **Assert:**
  - publish-log halt record `outcome: 'halt:2'` (OPERATOR_AUTHORIZATION_MISSING_OR_INVALID — per `src/verify/operator-authorization.js` per-message staleness violation and `src/runtime/halt.js` gate-4 default halt class 2)
  - pending file moved to `processed/`
  - safeLog event includes the staleness diagnostic
  - `process.exit` was stubbed and restored per RE-4
- **Reason:** Verifies Bug 2 fix (Hunks B + C) — that `stalenessThresholdMs` is now correctly destructured by `createOperatorAuthorizationGate` (Phase E `operator-authorization.js:72-76`) and the per-message branch at `operator-authorization.js:132` evaluates `now - approvedAt > stalenessThresholdMs` correctly (no longer fail-silent against `undefined`).
- **Note for future implementation Codex review:** the halt-class number for op-auth staleness is resolved as **2** (OPERATOR_AUTHORIZATION_MISSING_OR_INVALID) from the sealed Phase E module `src/verify/operator-authorization.js` and the Phase F halt extraction mapping in `src/runtime/halt.js` at Relay `9fb251efa9279dd662f743c4c60e3712612a7e0c` (sourced and verified by Codex DESIGN-ONLY narrow round-2 review). DESIGN-SPEC codification preserves `halt:2`; future SAFE IMPLEMENTATION Codex review must re-verify the gate-4 mapping at the implementation SHA.

### Case 12 (NEW) — Rate-limit halt fires correctly via the new adapter (Bug 4 regression)
- **Setup:** Build temp tree; configure synthetic `runtimeConfig.channelRateLimits` with a specific channel (e.g., `'#test-channel'`) set to `{limit: 1, windowMs: 60000}`; pre-populate that channel's rate-limit state via Phase D `rateLimitState` to count = 1 (already at limit); enqueue a new pending message for `'#test-channel'`. (The setup MUST configure `channelRateLimits` or the adapter closure returns an empty map and the regression is masked.)
- **Act:** Invoke `boot()` (Stages 1–16 should reach gate-N / limits-gate per-message verify).
- **Assert:**
  - publish-log halt record `outcome: 'halt:5'` (RATE_LIMIT_HIT — halt class 5 per existing halt-class enumeration; verified by Codex DESIGN-ONLY narrow round-2 against post-amendment sealed `src/runtime/halt.js` at Relay `9fb251efa9279dd662f743c4c60e3712612a7e0c`)
  - pending file moved to `processed/`
  - the adapter closure was exercised: the channel name lookup produced the expected count (verifiable indirectly via the halt firing as designed)
  - `process.exit` was stubbed and restored per RE-4
- **Reason:** Verifies Bug 4 fix (Hunk E adapter closure) — that the adapter correctly maps producer `getRateLimitState({channelName}) → {withinLimit, count, limit, windowMs, operatorPhaseId}` to consumer-expected `() → {channelName: count}` map shape (Phase D `rate-limit-state.js:5,116-157` producer ↔ Phase E `limits.js:47-50,81-82` consumer contract bridge).

---

## §6 — Operator workflow for executing smoke tests (when SAFE IMPLEMENTATION phase opens)

1. Operator opens `COMM-HUB-RELAY-RUNTIME-IMPLEMENT-F-HALT-SMOKE` (Mode 4 SAFE IMPLEMENTATION) — adds the 4 helpers + 12 test files to Relay repo
2. Codex on-disk source review of the test files (same per-phase cadence as Phases C/D/E/F and the F-HALT-AMENDMENT review)
3. Operator commit + push to Relay repo (operator-explicit approval)
4. Operator-manual smoke test execution from Claude Code session: `cd ~/code/agent-avila-relay && node --test tests/smoke/` (12 tests)
5. Test output captured; pass/fail recorded
6. Parent-repo `COMM-HUB-RELAY-RUNTIME-IMPLEMENT-F-HALT-SMOKE-CLOSEOUT` (DOCS-ONLY) records the Relay-repo smoke-test SHA + execution results
7. Optional one CLOSEOUT-SYNC

**Important:** smoke tests run from the canonical Claude Code session, NOT from Antigravity (per workspace-config DPI-WC-3 empty test whitelist + DPI-WC-8 `node --check` only). Even though Antigravity could `node --check` the test files, executing them is forbidden.

---

## §7 — Safety boundaries (firm)

The future SAFE IMPLEMENTATION phase MUST NOT:
- Modify Phase C/D/E/F sealed files (Phase F's 11 modules are now SAFE-class going forward per the F-HALT-CLOSEOUT at `4a0e551…`, plus the F-HALT-AMENDMENT at Relay `9fb251e…`)
- Modify `package.json` / `package-lock.json` (use `node:test` built-in only)
- Touch `.env`, `.env.*`, `.envrc`, any cert / key file, `~/.ssh/`, `~/.aws/`, `~/.gcp/`, `~/.azure/`, `~/.config/gh/`, `~/.npmrc`, `~/.netrc`, `~/.claude/`
- Touch `position.json`, `position.json.snap.*`
- Touch the armed-trading flag
- Make any network call from tests OR test runtime
- Post to any platform-side service
- Connect to any DB
- Invoke any deploy CLI / exchange API / trading code path
- Run `bot.js`, `dashboard.js`, `db.js`, migrations, scripts
- Install any new dependency
- Activate Relay (no real `boot()` against real `MESSAGE_STORE_PATH`)
- Activate Autopilot
- Authorize Phase G opening / smoke-test re-runs in production / Stage 5+ advance / DASH-6 / D-5.12f / Migration 009+

**Test discipline (firm):**
- Each test uses its own temp tree under `os.tmpdir()`
- Each test cleans up its temp tree (finally / after hook)
- Each test installs the network-observer and releases it on exit (RE-3 verbatim)
- Each test uses a fresh `operatorPhaseId` (no cross-test contamination)
- Tests run sequentially (not in parallel) to avoid temp-dir collisions OR use random suffix collision protection
- Boot-level tests apply RE-1 (synthetic process.env + restore)
- Halt-path tests apply RE-4 (process.exit stub via ExitSentinel + restore)

---

## §8 — Proposed command names (DO NOT RUN — codification phase only)

For reference only — these commands would be run by the operator (or operator-approved Claude Code run) in a future SAFE IMPLEMENTATION + execution phase:

```bash
# Run all smoke tests
cd ~/code/agent-avila-relay && node --test tests/smoke/

# Run a single smoke test
cd ~/code/agent-avila-relay && node --test tests/smoke/11-op-auth-staleness-halt.test.js

# Run with verbose output (TAP)
cd ~/code/agent-avila-relay && node --test --test-reporter=tap tests/smoke/

# Syntax-check only (Antigravity-allowed per DPI-WC-8)
node --check tests/smoke/12-rate-limit-adapter-halt.test.js
```

**This DOCS-ONLY codification phase does NOT run any of these commands.** They are proposed for the future SAFE IMPLEMENTATION + execution phase.

---

## §9 — Open Codex questions (DPI-F-SMOKE-1 through DPI-F-SMOKE-10)

| DPI | Question |
|---|---|
| DPI-F-SMOKE-1 | Confirm `node:test` as the chosen runner (no new dep)? Recommend YES. |
| DPI-F-SMOKE-2 | Confirm `tests/smoke/` as the location in Relay repo? Recommend YES. |
| DPI-F-SMOKE-3 | Confirm 4-helpers + 12-test-cases split? Recommend YES (10 prior + 2 new for Bug 2 + Bug 4 regression coverage per §419 of F-HALT-AMENDMENT-DESIGN). |
| DPI-F-SMOKE-4 | Confirm each test isolates its own temp tree? Recommend YES (avoids cross-test contamination). |
| DPI-F-SMOKE-5 | Confirm smoke tests are NOT auto-runnable from Antigravity per DPI-WC-3 empty whitelist? Recommend YES. |
| DPI-F-SMOKE-6 | Synthetic message fixtures — inline JSON in test files OR separate `tests/smoke/fixtures/` dir? Recommend inline for simplicity; fixtures dir if any single fixture exceeds 30 lines. |
| DPI-F-SMOKE-7 | Network-call observer mechanism — direct monkey-patch via prototype shimming per RE-3? Confirmed YES via RE-3 verbatim wording. |
| DPI-F-SMOKE-8 | Number of test cases — exactly the 12 listed, or expand further? Recommend the 12 listed; future smoke-test expansion is a separate phase. |
| DPI-F-SMOKE-9 | Test execution mode — sequential or parallel? Recommend sequential to avoid filesystem race conditions on temp dirs. |
| DPI-F-SMOKE-10 | After smoke tests pass: what's the recommended next gate — Phase G design opening? Recommend a separate Phase G design phase remains gated; smoke pass does NOT pre-authorize Phase G. |

---

## §10 — Non-authorization preservation clauses

This DOCS-ONLY (Mode 3) codification phase pre-authorizes **nothing**:
- Does NOT create any test files
- Does NOT modify Phase C/D/E/F sealed files (including post-amendment `src/runtime/boot.js`)
- Does NOT modify `package.json` / `package-lock.json` (root or web/)
- Does NOT install any new dependency
- Does NOT touch `.env`, secrets, memory, `position.json`, or any forbidden path
- Does NOT run any smoke test
- Does NOT modify the trading runtime
- Does NOT activate Relay
- Does NOT activate Autopilot
- Does NOT authorize opening `COMM-HUB-RELAY-RUNTIME-IMPLEMENT-F-HALT-SMOKE` SAFE IMPLEMENTATION
- Does NOT authorize Phase G design or implementation opening
- Does NOT authorize Stage 5 install resumption / Stage 7 dry-run / Stages 8/9/10a/10b
- Does NOT authorize Discord platform action
- Does NOT authorize Railway / DB / Kraken / env / secrets touch
- Does NOT advance the autopilot phase-loop counter or CEILING-PAUSE state
- Does NOT touch Antigravity workspace configuration
- Does NOT authorize DASH-6 / D-5.12f / Migration 009+
- Does NOT authorize external Hermes Agent (Nous/OpenRouter)
- Does NOT authorize scheduler / cron / webhook / MCP install
- Does NOT authorize permission widening
- Does NOT authorize any network lookup

**Preservation invariants (verified at codification time):**
- Approvers exactly `{Victor}`
- Migration 008 APPLIED at `189eb1be6ef6304d914671bdaedec44d389cf877`
- N-3 CLOSED
- Stage 5 Gate-10 install approval at `40f3137e842cd60acf1adf17ecc7fe2f0b1b8935` CONSUMED
- CEILING-PAUSE history preserved; phase-loop counter 0 of 3; broken via `ARC-8-UNPAUSE` at `22ba4a7663e22df64b7cc8e3c0324cbffc0e28f6`
- Relay-runtime DORMANT
- Autopilot DORMANT verified at `eff4dd22b9b9af038c7ae45de301e60b3f45af98`
- Phase F SAFE IMPLEMENTATION baseline at Relay `b8ab035034668fd53ea6efe64432f0868dfd2eb9`
- **F-HALT-AMENDMENT sealed at Relay `9fb251efa9279dd662f743c4c60e3712612a7e0c`; parent-repo AMENDMENT-CLOSEOUT-SYNC sealed at `cf877f443fdfd10b14822ea202ac63166cfc2a08`**
- F-HALT-CLOSEOUT CLOSED at parent-repo `4a0e5518638dd8afeb2adf8fc0245130f4e1e384`
- F-HALT-AMENDMENT-DESIGN handoff at `orchestrator/handoffs/COMM-HUB-RELAY-RUNTIME-IMPLEMENT-F-HALT-AMENDMENT-DESIGN.md` sealed at `f7d511c31f36b6d39b2b7cfe79cba9c8e31d10ee` and untouched
- Antigravity chain SHAs preserved (ANTIGRAVITY-MIGRATION-DESIGN-SPEC at `71af035f9a1f7489bfd663e099a15fda7439d0a7`; ANTIGRAVITY-MIGRATION-A-WORKSPACE-CONFIG-DESIGN-SPEC at `d7bb70463beed9c9e3abea84ed9b0682cbaf2255`; ANTIGRAVITY-MIGRATION-A-WORKSPACE-CONFIG-CLOSEOUT at `19db3723e5a046db33bb5880fb95e6f38f23e08a`; ANTIGRAVITY-RULES-DESIGN-SPEC at `9d47f74d87aeed20a2fa7483a3704b494a21eb96`; ANTIGRAVITY-RULES-DESIGN-SPEC-CLOSEOUT-SYNC at `6c41c2c69d7fb4c8d5fda6179829f10e3ffaf9c0`)
- All other sealed handoffs untouched (AI-GOV-OS-DESIGN at `bd6245fef40067f90ade3ec7fef03f9737c11fd6`; UX-UPGRADE-DESIGN at `570cf9c60485ee1cf4e5df0923fc4613f06eb586`; BUILD-PREVIEW-DESIGN at `34e15df778c1e9230b25a1e309868294795e631a`; WEB-IMPLEMENT-DESIGN at `e6af54a91a94cc4b92291a550db3825a8bb599a5`; WEB-DESIGN at `1b49fc30737ea96ec8d2dbf923c5467eb33b8149`; canonical prior PROJECT-PROGRESS-DASHBOARD handoffs at `f6aaa40…` and `c8798ea…`)
- Full PROJECT-PROGRESS-DASHBOARD cascade through REFRESH-006-CLOSEOUT-SYNC at `e026ed312a5899f9b6aa4fa4f132463feb3ad934` preserved
- Sealed generator `tools/dashboard-generate.js` codified at `f5cc97a…` untouched
- Refreshed dashboard at REFRESH-006/`61df34fad5f588c9a83ee55aca9f328e96d22a03` untouched
- web/ at `ef63605f833c508e803ef5f9e40ff6129e3cab56` untouched
- Root `package.json` + `package-lock.json` RESTRICTED and untouched
- web/`package.json` + `package-lock.json` sealed at SCAFFOLD `cc6819d…` and untouched
- `position.json.snap.20260502T020154Z` carve-out preserved untracked in parent repo
- Parent-repo / Relay-repo evidence boundary per WEB-IMPLEMENT-DESIGN handoff §18: parent-repo state alone cannot prove Relay-repo state; Relay-repo verification grounded by three-way SHA PASS at Relay `9fb251efa9279dd662f743c4c60e3712612a7e0c`
- Audit advisory carried forward as SCAFFOLD-phase documented known advisory (not freshly re-verified from the static working tree)
- `web/.gitignore` continues to cover `dist/` and `.astro/`; build outputs do not appear in `git status`

**Verbatim trading-isolation disclaimer:** **This web project is entirely separate from the trading runtime `dashboard.js`. It does not modify, replace, or supplement live trading functionality.**

---

## Closing — codification and execution gating

This handoff is the on-disk codification of the accepted conversation-only F-HALT-SMOKE-DESIGN post-amendment update. It does not authorize execution of any smoke-test implementation. It does not open `COMM-HUB-RELAY-RUNTIME-IMPLEMENT-F-HALT-SMOKE` (SAFE IMPLEMENTATION). It does not modify `orchestrator/DASHBOARD.md`, the sealed generator, any `web/` file, any root package file, any Relay-repo file, or any runtime / trading file. It does not advance the autopilot phase-loop counter. It does not install or reconfigure Antigravity. It does not touch Railway, the Discord platform, the DB, env / secrets, the armed-trading flag, trading runtime, DASH-6, D-5.12f, Migration 009+, Autopilot Loop B/C/D, CEILING-PAUSE, the external Hermes Agent (Nous/OpenRouter), scheduler / cron / webhook / MCP install, or permission widening.

The future execution phase `COMM-HUB-RELAY-RUNTIME-IMPLEMENT-F-HALT-SMOKE` is separately gated; requires its own explicit Victor approval; and requires its own separate Codex SAFE IMPLEMENTATION review before commit.

**This web project is entirely separate from the trading runtime `dashboard.js`. It does not modify, replace, or supplement live trading functionality.**
