# COMM-HUB-RELAY-RUNTIME-IMPLEMENT-F-HALT-DESIGN

**Phase identity:** `COMM-HUB-RELAY-RUNTIME-IMPLEMENT-F-HALT`
**Phase mode (future):** SAFE IMPLEMENTATION (Mode 4)
**Source-design phase:** `COMM-HUB-RELAY-RUNTIME-IMPLEMENT-F-HALT-DESIGN` (Mode 2 / DESIGN-ONLY conversation)
**Source-design HEAD anchor:** `28b16d0e7b62fcf2e58421e6b6ba1185cc1381ab` (parent repo; = E-VERIFY-CLOSEOUT commit)
**Relay-repo Phase E anchor:** `21896d65132a1dc9d48f2f5563113c06f62d0893` (`relentlessvic/agent-avila-relay`)
**Codification phase:** `COMM-HUB-RELAY-RUNTIME-IMPLEMENT-F-HALT-DESIGN-SPEC` (DOCS-ONLY / Mode 3)

This document persists the Codex-PASS Phase F-HALT design as a SAFE-class handoff record. Phase F covers the halt-state-machine + boot-orchestration + pipeline-orchestration + per-message state management for the Relay runtime. All 10 round-1 required edits + 3 round-2 required edits are applied verbatim. The document is NOT approval to open Phase F SAFE IMPLEMENTATION, NOT source code, NOT a network-touch, NOT a deploy.

---

## §0 — Phase classification & pre-flight verification

| Property | Value |
|---|---|
| Phase name | `COMM-HUB-RELAY-RUNTIME-IMPLEMENT-F-HALT` |
| Future phase mode | SAFE IMPLEMENTATION (Mode 4) — confirmed by Codex round-1 DPI-F7 |
| Predecessor (Relay repo) | Phase E `COMM-HUB-RELAY-RUNTIME-IMPLEMENT-E-VERIFY` at `21896d65132a1dc9d48f2f5563113c06f62d0893` |
| Predecessor (parent repo) | E-VERIFY-CLOSEOUT at `28b16d0e7b62fcf2e58421e6b6ba1185cc1381ab` |
| Successor (lettered phase) | Phase G-GATEWAY (per canonical 8-phase A→H sequence) |
| First HIGH-RISK phase | Phase G-GATEWAY (introduces Discord network behavior) |
| §15 extension before Phase F | NOT required (per Codex round-1 RE-8) |
| §15 extension before Phase G | MAY be required for production-send-failure halt class |
| Working tree at design time | clean except `position.json.snap.20260502T020154Z` (untracked carve-out) |

**Codex review history (source design phase):**
- Round-1 DESIGN-ONLY: PASS WITH REQUIRED EDITS (10 required edits issued).
- Round-2 narrow re-review: PASS WITH REQUIRED EDITS (3 required edits issued; RE-A lock ordering, RE-B two-tier boot-halt logging, RE-C numeric guards for halt-class extraction).
- Round-3 narrow re-review: overall PASS confirming all 3 round-2 required edits correctly applied; no new required edits.
- Codex round-3 explicit non-approval note: *"This is not approval to implement, commit, push, deploy, touch Discord/Railway/DB/env/production, or perform any runtime action."*

---

## §1 — Recommended Phase F name

`COMM-HUB-RELAY-RUNTIME-IMPLEMENT-F-HALT`

Forward-looking name uses "RELAY" per `CLAUDE.md` naming convention. Historical literals preserved verbatim wherever they appear (`HERMES_VERSION` env var, `schemas/hermes-message.schema.json` filename, Phase C/D/E private `HALT_CLASS` const naming).

---

## §2 — Recommended phase mode

**SAFE IMPLEMENTATION (Mode 4)** — confirmed by Codex round-1 DPI-F7.

Rationale:
- Phase F introduces **executable runtime wiring** — boot sequencer, per-message pipeline loop, halt-state-machine, pipeline-state accumulator — but **no** Discord client, **no** network reach, **no** deploy, **no** production mutation, **no** trading path.
- Phase F instantiates Phase C/D/E modules but does NOT modify them; Phase C/D/E sealed-file discipline preserved.
- Mode 5 HIGH-RISK is reserved for Phase G-GATEWAY (the first phase that introduces Discord network behavior).
- No Mode 5 HARD BLOCK surface present in Phase F per Codex DPI-F7.

---

## §3 — Phase F scope (file-by-file)

Phase F adds executable runtime orchestration under `src/` in `relentlessvic/agent-avila-relay`. Exact file list deferred to operator decision at implementation time; design provides the canonical module breakdown:

- `src/index.js` — entry point; invokes `boot()`; no execution of test-only options
- `src/runtime/boot.js` — boot sequencer per §4
- `src/runtime/run-pipeline.js` — per-message pipeline orchestrator per §6
- `src/runtime/halt.js` — halt-state-machine per §5; halt-class extraction precedence; halt sequence
- `src/runtime/pipeline-state.js` — `pipelineState` accumulator type per §7
- `src/runtime/rate-limit-state.js` — Phase F-owned counter keyed by `(operatorPhaseId, channelName)` per §7
- `src/runtime/class-auth-counter.js` — Phase F-owned counter for gate 4
- `src/runtime/single-instance-lock.js` — atomic filesystem-creation single-instance lock per §4 (RE-10 + RE-A)
- `src/runtime/safe-log-binding.js` — pre-bound 2-arg `safeLog` wrapper around Phase C `safeLogRaw`
- `src/runtime/boot-halt-fallback.js` — pre-logger synchronous stdout JSON fallback per §4/§5 (RE-B)
- `src/runtime/index.js` — optional pure re-export aggregator (DPI-F9 — operator decision)

No new top-level dependency. Node built-ins + Phase B lockfile (`ajv@8.20.0` + `pino@9.14.0`); `ajv-formats` REMAINS FORBIDDEN per Phase C RE-4.

---

## §4 — Boot sequence

```
boot({ phaseGStubMode = 'disabled' } = {})
  // RE-1: phaseGStubMode is a non-env injected option. src/index.js MUST NOT
  // pass it from process.env. The option exists only for local-invocation /
  // test-harness use. Default 'disabled'. Allowed: 'disabled' | 'stub-empty-allowlist'.
  ├─ validateEnv(process.env)                              [Phase C; halt 20/21]
  │   - relayMode          := validatedEnv.RELAY_MODE
  │   - messageStorePath   := validatedEnv.MESSAGE_STORE_PATH  (canonical source for lock path; RE-A)
  │   - publishLogPath     := validatedEnv.PUBLISH_LOG_PATH
  │   - dryRunLogPath      := validatedEnv.DRY_RUN_LOG_PATH
  │   - hermesVersion      := validatedEnv.HERMES_VERSION
  │   - FAILURE → pre-logger boot halt path (RE-B): synchronous stdout JSON fallback
  │     { event: 'boot-halt', haltClass: 20 | 21, reason: <short-string> } only
  ├─ createLogger({level, destination, hermesVersion})     [Phase C]
  │   - FAILURE → pre-logger boot halt path (RE-B): synchronous stdout JSON fallback
  │     { event: 'boot-halt', haltClass: <number>, reason: <short-string> } only
  ├─ safeLog := (level, payload) => safeLogRaw(level, payload, logger)  [Phase F binding]
  │   - From this point forward, all boot halts use safeLog (RE-B)
  ├─ acquire single-instance lock                          [Phase F; halt class 9; RE-10 + RE-A]
  │   - lock path derived ONLY from validatedEnv.MESSAGE_STORE_PATH
  │   - Phase F MUST NOT derive lock path directly from raw process.env
  │   - atomic filesystem creation under the validated Relay message store path
  │     (preferred: `mkdir` lock directory OR `fs.open(..., 'wx')` exclusive-create lock file)
  │   - if acquisition fails AND prior PID is live OR staleness cannot be proven → halt class 9
  │   - lsof is NOT the primary mechanism
  ├─ createMessageStore({messageStorePath, safeLog})       [Phase D]
  ├─ createPublishLogWriter({publishLogPath, hermesVersion, safeLog})  [Phase D]
  ├─ createDryRunLogWriter({dryRunLogPath, hermesVersion, safeLog})    [Phase D; only if relayMode === 'dry_run']
  ├─ store.ensureDirectoryLayout()                         [Phase D; halt 24/27]
  ├─ publishLog.ensureLogIntegrity()                       [Phase D; halt 25]
  ├─ dryRunLog.ensureLogIntegrity()                        [Phase D; halt 25; only if dry-run]
  ├─ createSchemaValidator({schemaPath, safeLog})          [Phase E gate 1]
  ├─ schemaValidator.ensureSchemaLoaded()                  [Phase E; halt 26/30]
  ├─ create remaining 10 Phase E gate factories            [gates 2-11]
  ├─ rateLimitState := createRateLimitState({operatorPhaseId, channelRateLimits})  [Phase F; RE-9]
  │   - operatorPhaseId is provided by the Phase F caller/test harness or future canonical
  │     config source; Phase F MUST NOT read it directly from raw process.env.
  │     If no operatorPhaseId is available, Phase F fails closed before processing messages.
  │   - counter is keyed by (operatorPhaseId, channelName); not process lifetime, not calendar time
  │   - restart does NOT reset counters unless operatorPhaseId changes;
  │     any reset requires explicit operator phase transition
  ├─ classAuthCounter := createClassAuthCounter()           [Phase F state for gate 4]
  ├─ resolve gate-9 refs per §7 firm rule (RE-2 strict order):
  │     - if relayMode === 'production' → REQUIRE real Phase G hook;
  │       if missing → HALT BOOT with halt class 32 (RE-6);
  │       phaseGStubMode is IGNORED entirely (production NEVER accepts stub)
  │     - else if relayMode === 'dry_run' AND phaseGStubMode === 'stub-empty-allowlist'
  │       → install non-env injected stub (only sanctioned stub use)
  │     - else → null refs (gate 9 halts 32 per Phase E)
  ├─ → DO NOT connect to Discord                          [Phase G concern]
  ├─ → DO NOT send messages                               [Phase G concern]
  └─ enter pipeline loop: for each pending message in lex order, call runPipeline(message)
```

### Boot-halt record policy (RE-5 + RE-B)

Boot halts are **stdout-only**: no publish-log records, no sentinel `message_id: 'BOOT'` / `channel_id: null` records. Boot-halt logging splits into two tiers based on whether `safeLog` is bound yet:

**Tier 1 — Pre-logger boot halt (RE-B; before `safeLog` is bound):**
Triggers: `validateEnv` failure, `createLogger` failure, any failure occurring before the `safeLog` binding line.
Mechanism: **minimal synchronous stdout JSON fallback** (e.g., `process.stdout.write(JSON.stringify(...) + '\n')`).
Payload contains **only**: `{ event, haltClass, reason }` where `event` is a short stable string (e.g., `"boot-halt"`), `haltClass` is the numeric canonical halt class, `reason` is a short non-sensitive string describing the failure category.
**MUST NOT include:** raw env values, paths containing secrets, message bodies, error stacks, raw error objects, secrets, tokens, DB URLs, Railway values, Discord values, Kraken values, `.env` content, or any field beyond the three listed above.

**Tier 2 — Post-logger boot halt (RE-B; after `safeLog` is bound):**
Triggers: lock acquisition failure, store-layout failure, publish-log integrity failure, schema-load failure, gate-9-ref resolution failure (production-no-hook → halt 32), etc.
Mechanism: `safeLog('error', { event, haltClass, reason, ...sanitized })` — same sanitization discipline applied by `safeLog` itself (no raw error content; no secrets).

**Why no publish-log writes for boot halts:** canonical §14 message fields (`message_id`, `channel_id`) are unavailable at boot. Until a canonical boot-halt publish-log shape is approved by a future operator-decision DOCS-ONLY phase, boot halts remain stdout-only across both tiers.

---

## §5 — Halt-state machine behavior

### Halt-class extraction precedence (RE-3 + RE-C; strict order)

When Phase F detects a halt (gate returns `{ok: false}` or throws), the halt class is extracted in **strict order**. Every override path requires a `typeof === 'number'` check; missing or non-numeric values fall through to the next step.

1. **Thrown error path (numeric-guarded; RE-C):** if the gate THROWS AND `typeof error.haltClass === 'number'`, use `error.haltClass`. If `error.haltClass` is missing, `undefined`, `null`, a string, an object, or any non-numeric value, **fall through to step 2**.
2. **Top-level override:** else if `typeof result.haltClassOverride === 'number'`, use it. Non-numeric falls through to step 3.
3. **First-error override:** else if `typeof result.errors[0]?.haltClassOverride === 'number'`, use it. Non-numeric falls through to step 4.
4. **Gate-default mapping:** else use the static default halt class for the currently-running gate (gate 1 → 29; gate 2 → 3; gate 3 → 1; gate 4 → 2 (or 10 for class-auth); gate 5 → 7; gate 6 → 8; gate 7 → 31; gate 8 → 4 or 5; gate 9 → 32; gate 10 → 10; gate 11 → 12). If no mapping exists for the current gate, fall through to step 5.
5. **Internal-design-error fallback:** else fail-closed under the nearest canonical infrastructure class (recommend halt class **25** "Publish log unverifiable"); `safeLog` stdout with `event: 'internal-design-error', gateName: <name>` — **no publish-log write for this fallback path**.

### Halt sequence — per-message halts (gates 1–11)

1. Construct halt record per canonical §14 shape:
   `{ message_id, channel_id, outcome: "halt:<class>", timestamp, process_pid, hermes_version }`

2. **Always write to PUBLISH_LOG_PATH, regardless of relayMode (RE-7).** DRY_RUN_LOG_PATH is reserved for `would_have_published` records (only after gate 11 in dry-run mode).

3. Attempt `publishLog.append(haltRecord)`

4a. **IF append SUCCEEDS:**
    - Attempt `store.moveToProcessed(filename)`
    - **IF moveToProcessed SUCCEEDS:** `safeLog('error', { event: 'halt', haltClass, message_id, moved: true })` → `process.exit(haltClassCategorizedCode)` non-zero
    - **IF moveToProcessed FAILS (RE-4):**
      - Do NOT claim `moved: true`
      - `safeLog('error', { event: 'halt', haltClass, message_id, moved: false, secondaryHaltClass: 24 })` — stdout-only
      - Leave pending file in place (operator restart retries)
      - `process.exit(haltClassCategorizedCode)` non-zero

4b. **IF append FAILS:**
    - Do NOT call `store.moveToProcessed` (pending file REMAINS in pending/)
    - `safeLog('error', { event: 'halt-record-append-failed', haltClass, message_id, moved: false })` — stdout-only
    - `process.exit(haltClassCategorizedCode)` non-zero

### Boot halts (RE-5 + RE-B; cross-reference to §4)

Boot halts are **stdout-only** (no publish-log append, no sentinel BOOT records) and split into two tiers per §4 Boot-halt record policy:
- **Pre-logger boot halt (RE-B):** minimal synchronous stdout JSON fallback containing **only** `{event, haltClass, reason}`. **MUST NOT include** raw env values, paths with secrets, message bodies, error stacks, raw error objects, secrets, tokens, DB URLs, Railway values, Discord values, Kraken values, or `.env` content.
- **Post-logger boot halt (RE-B):** `safeLog('error', { event, haltClass, reason, ...sanitized })` with `safeLog`'s standard sanitization discipline.

### Dry-run log on halt (RE-7)

Dry-run log is **NOT written on halt**. Halt outcomes **always go to PUBLISH_LOG_PATH**, regardless of `relayMode`. DRY_RUN_LOG_PATH is reserved exclusively for `would_have_published` records emitted post-gate-11 in dry-run mode.

### Other behaviors

- `safeLog` passes through `{event, errorCount, haltClass}` — never raw error content
- Publish-log halt record contains halt class numeric only — NOT error details
- Fail-fast per canonical §15; other pending messages remain untouched; operator-initiated restart picks up next in lex order

---

## §6 — Pipeline order (per-message)

Gate sequence per canonical RUNTIME-DESIGN §13 (11 gates):

1. Schema validation (gate 1) → halt 29 / 30
2. Channel allow-list (gate 2) → halt 3
3. Codex PASS metadata (gate 3) → halt 1
4. Operator authorization (gate 4) → halt 2 / 10
5. Idempotency (gate 5) → halt 7
6. CEILING-PAUSE (gate 6) → halt 8
7. Placeholders (gate 7) → halt 31; produces `pipelineState.substitutedBody`
8. Limits (gate 8) → halt 4 / 5
9. Network anomaly (gate 9) → halt 6 / 23 / 32
10. Forbidden content (gate 10) → halt 10 with caveat
11. Dry-run consistency (gate 11) → halt 12

**Post-gate-11 routing (revised per RE-7 + RE-8):**
- `dry_run=true` OR `RELAY_MODE=dry_run` → `dryRunLog.append({...would_have_published...})` → `store.moveToProcessed(filename)` → continue to next pending. (Phase F owns this path entirely; no Discord involvement; no Phase G dependency.)
- `dry_run=false` AND `RELAY_MODE=production` → **handed off to Phase G's send-and-record callable** (Phase G owns: Discord `sendMessage`, publish-log success record write, halt-class binding for any production send-failure cases). **Phase F does NOT implement `discord.sendMessage`, does NOT write the success record, does NOT bind a "publish-attempt-failed" halt class** (per RE-8). The §15 extension for any production-send-failure halt class must land BEFORE Phase G implementation — NOT before Phase F.

---

## §7 — pipelineState + Phase G stub rule (FIRM design invariant)

### pipelineState

```
{
  substitutedBody: <string>,    // populated by gate 7; consumed by gates 8 + 10
}
```

### Gate-related state ownership

| Concern | How Phase F handles |
|---|---|
| Gate 7 → 8 / 10 propagation | `runPipeline` merges `gate7Result.transformations.substitutedBody` into pipelineState |
| Rate-limit state for gate 8 (RE-9) | Phase F owns counter keyed by **`(operatorPhaseId, channelName)`**. `operatorPhaseId` is **provided by the Phase F caller/test harness or future canonical config source**; **Phase F MUST NOT read it directly from raw `process.env`**. If no `operatorPhaseId` is available, **Phase F fails closed before processing messages**. Gate 8 receives `getRateLimitState` callable; Phase F increments on successful publish. **Restart does NOT reset counters unless `operatorPhaseId` changes**; **any reset requires explicit operator phase transition**. |
| Class-authorization counter for gate 4 | Phase F owns `classAuthCounter`; gate 4 receives `getClassAuthorizationUseCount` callable |

### Phase G stub rule (FIRM design invariant — RE-1 + RE-2)

**Stub is NOT read from `process.env`.** The injected option `phaseGStubMode` is a `boot()` parameter passed only by local-invocation / test-harness code. `src/index.js` MUST NOT pass `phaseGStubMode` from `process.env`. Default: `'disabled'`. Allowed values: `'disabled'` | `'stub-empty-allowlist'`.

**Resolution order (RE-2) — strict, MUST be applied in this sequence:**

| Step | Behavior |
|---|---|
| 1 | Derive `relayMode` from validated Phase C config (`validatedEnv.RELAY_MODE`) |
| 2 | If `relayMode === 'production'` → **Boot HALTS** at gate-9-ref resolution (per §4); `phaseGStubMode` is IGNORED entirely; **no stub references constructed, imported, or passed under any circumstance** |
| 3 | If `relayMode === 'dry_run'` AND `phaseGStubMode === 'stub-empty-allowlist'` → install opt-in non-env stub: `{allowlistedHostnames: [], invoke: () => {}}` + empty event log. Gate 9 passes. Pipeline runs end-to-end against the dry-run path. (Only sanctioned stub use.) |
| 4 | If `relayMode === 'dry_run'` AND `phaseGStubMode === 'disabled'` (default) → Phase F passes `null` refs to gate 9. Gate 9 halts ID 32. Pipeline does not reach dry-run-log write. |

**Stub is OFF by default. FORBIDDEN in production regardless of `phaseGStubMode` value. Allowed only in dry-run + explicit non-env opt-in via boot parameter.**

---

## §8 — Halt-class numeric bindings consumed

Phase F binds the following canonical RUNTIME-DESIGN §15 halt classes (numeric-only; no new halt classes introduced):

- **9** — Concurrent-instance detection (lock acquisition failure under contested PID-live or unprovable-staleness conditions; RE-10)
- **20 / 21** — Validated-env failures (Phase C boundary)
- **24** — `moveToProcessed` post-append failure (secondary halt class; RE-4)
- **25** — Internal-design-error fallback (Publish log unverifiable; RE-3 fallback)
- **32** — Production-no-hook boot halt (RE-6); also gate-9 hook-missing/integrity-failure binding (Phase E)

All other halt classes (1-8 except 9, 10-19, 22-23, 26-31) are consumed by Phase E gate modules per E-VERIFY-DESIGN. Phase F orchestrates these halt classes via the halt-class extraction precedence in §5 but does not introduce new bindings.

**§15 extension status:**
- NOT required before Phase F (per Codex round-1 RE-8).
- MAY be required before Phase G if a production-send-failure halt class is needed.

---

## §9 — Safety boundaries

Phase F implementation MUST:
- **No Discord client** — never `import discord.js`, never `new Client()`, never `gateway.connect()`, **never call `discord.sendMessage`** (RE-8)
- **No production-send-failure branch** — Phase F does NOT implement or exercise production publish-attempt failure handling (RE-8); that branch is Phase G-owned
- **No raw env reads of test-only options** — `phaseGStubMode` is a `boot()` parameter; NEVER read from `process.env` (RE-1)
- **No raw env read for lock path** — lock path derived ONLY from `validatedEnv.MESSAGE_STORE_PATH` (RE-A)
- **No raw env read for operatorPhaseId** — provided by caller/test harness or future canonical config source; fail closed if missing (RE-9 + cleanup)
- **No network reach** — no `http`, `https`, `fetch`, `axios`, `dgram`, etc.
- **No deploy** — no Railway invocation, no `git push`, no env mutation
- **No env mutation** — only READ via `validateEnv`; never `process.env.X = Y`
- **No DB** — no `pg`, no `sqlite`, no Kraken client
- **No trading** — no `BOT_` / `DASHBOARD_` reads, no position.json, no order placement
- **No live-armed flag touch** — never read or write the manual live-armed flag
- **No Relay activation beyond local module wiring** — Phase F instantiates but does NOT connect to Discord, does NOT post
- **No top-level execution outside `src/index.js`** — single entry; all other modules are factory exports
- **No new dependency** — Node built-ins + existing Phase B lockfile (`ajv@8.20.0` + `pino@9.14.0`); `ajv-formats` REMAINS FORBIDDEN per Phase C RE-4
- **No modification of Phase C/D/E-sealed files** — Phase F imports; never modifies
- **`safeLog` mandatory** — all log emissions through pre-bound 2-arg `safeLog` (post-logger) or minimal synchronous stdout JSON fallback (pre-logger; RE-B)

---

## §10 — Codex round-1 + round-2 + round-3 required-edits index

### Round-1 (10 RE; all applied verbatim)

| RE | Section(s) | Summary |
|---|---|---|
| RE-1 | §4, §7, §9 | Replace raw `PHASE_G_STUB` env usage with non-env injected `boot({ phaseGStubMode })` boot option; `src/index.js` MUST NOT pass it from `process.env`; default `'disabled'`; allowed `'disabled'` / `'stub-empty-allowlist'` |
| RE-2 | §4, §7 | Stub resolution order: derive `relayMode` from validated Phase C config FIRST; production → IGNORE `phaseGStubMode` entirely; only dry-run permits stub option evaluation |
| RE-3 | §5 | Halt-class extraction precedence (5-step strict order); internal-design-error fallback → halt class 25 + stdout-only log |
| RE-4 | §5 | `moveToProcessed` failure handling (post-append): `moved: false`, `secondaryHaltClass: 24`, leave pending in place, exit non-zero |
| RE-5 | §4, §5 | Boot halts are stdout-only; NO publish-log writes for boot halts; no sentinel `message_id: 'BOOT'` records |
| RE-6 | §4, §10 (DPI-F11) | Production-no-hook boot halt bound to canonical halt class **32** |
| RE-7 | §5, §6 | All per-message halts (incl. dry-run mode) write to `PUBLISH_LOG_PATH` only; `DRY_RUN_LOG_PATH` reserved for `would_have_published` records only |
| RE-8 | §6, §9, §14 | Phase F MUST NOT implement `discord.sendMessage` or use unbound `publish-attempt-failed` halt class; production routing is HANDED OFF to Phase G; §15 extension required before Phase G implementation, NOT before Phase F |
| RE-9 | §4, §7, §10 (DPI-F10) | Rate-limit counters keyed by `(operatorPhaseId, channelName)`; restart does NOT reset unless persisted/injected `operatorPhaseId` changes; reset requires explicit operator phase transition |
| RE-10 | §4, §10 (DPI-F12) | Boot acquires single-instance lock via atomic filesystem creation (`mkdir` lock dir or exclusive-create lock file) under `$MESSAGE_STORE_PATH`; halt class 9 on acquisition failure; no `lsof` as primary mechanism |

### Round-2 (3 RE; all applied verbatim)

| RE | Section(s) | Summary |
|---|---|---|
| RE-A | §4 | Reordered boot: `acquire single-instance lock` now runs AFTER `validateEnv` → `createLogger` → `safeLog` binding. Lock path derives ONLY from `validatedEnv.MESSAGE_STORE_PATH`; Phase F MUST NOT read raw `process.env.MESSAGE_STORE_PATH` for lock acquisition. Atomic filesystem creation rule + halt class 9 on contested acquisition preserved verbatim. |
| RE-B | §4 (boot-halt policy), §5 (boot halts section) | Two-tier boot-halt logging: post-logger halts use `safeLog`; pre-logger halts use **minimal synchronous stdout JSON fallback** containing ONLY `{event, haltClass, reason}`. Explicit deny-list: no raw env values, no paths with secrets, no message bodies, no error stacks, no raw error objects, no secrets/tokens/DB URLs/Railway/Discord/Kraken values, no .env content. Existing rules preserved: no publish-log write for boot halts; no sentinel BOOT records. |
| RE-C | §5 | Halt-class extraction step 1 hardened: thrown error path uses `error.haltClass` ONLY IF `typeof error.haltClass === 'number'`; missing/non-numeric falls through to step 2 (top-level override) → step 3 (first-error override) → step 4 (gate default) → step 5 (internal-design-error fallback). Numeric `typeof === 'number'` guard stated explicitly across all override steps for consistency. |

### Round-3

**Overall verdict: PASS** across all 23 narrow checklist goals (A1–A6, B1–B6, C1–C5, X1–X6). No new required edits.

Codex round-3 explicit non-approval note (verbatim): *"This is not approval to implement, commit, push, deploy, touch Discord/Railway/DB/env/production, or perform any runtime action."*

---

## §11 — Open questions (DPI summary at round-3 PASS)

| # | Question | Status |
|---|---|---|
| DPI-F1 | Halt output format | **Resolved per Codex round-1 challenge**: numeric `"halt:<class>"` in publish-log only; readable named label in stdout via safeLog only |
| DPI-F2 | Halt outcomes in publish-log only vs separate halt log | **Resolved per RE-7**: publish-log only for per-message halts; PUBLISH_LOG_PATH regardless of `relayMode`; DRY_RUN_LOG_PATH reserved for `would_have_published` |
| DPI-F3 | Pending message lifecycle on halt | **Resolved per §5** including RE-4 `moveToProcessed` failure handling |
| DPI-F4 | Halt class ID for "publish-attempt-failed" | **Resolved per RE-8**: §15 extension required BEFORE Phase G implementation, NOT before Phase F; Phase F does NOT implement the failure branch |
| DPI-F5 | Phase F dry-run smoke tests | **Resolved**: yes, per §7 firm rule + RE-1 injected stub option (boot parameter, not env var) |
| DPI-F6 | Gate 9 handling before Phase G | **Resolved per §7 firm rule** + RE-1 + RE-2 |
| DPI-F7 | Phase F mode classification | **Resolved per Codex round-1**: **SAFE IMPLEMENTATION / Mode 4** — no Mode 5 HARD BLOCK surface |
| DPI-F8 | Stub mechanism + gating | **Resolved per RE-1 + RE-2** (non-env injection; `relayMode`-first resolution) |
| DPI-F9 | `src/runtime/index.js` aggregator | **Open** — operator decision; pure re-exports only if added |
| DPI-F10 | Rate-limit window semantics | **Resolved per RE-9 + cleanup**: keyed by `(operatorPhaseId, channelName)`; `operatorPhaseId` from caller/test-harness or future canonical config; not from raw `process.env`; fail closed if missing; reset requires explicit operator phase transition |
| DPI-F11 | Production-no-hook boot halt | **Resolved per RE-6**: bound to halt class 32 (unless future §15-EXTENSION-FOR-PHASE-G assigns a more specific class) |
| DPI-F12 | Concurrent-instance detection | **Resolved per RE-10 + RE-A**: atomic filesystem lock under `validatedEnv.MESSAGE_STORE_PATH`; halt class 9; no `lsof` primary; lock acquired AFTER `validateEnv` / `createLogger` / `safeLog` binding |

**Only DPI-F9 (aggregator) remains genuinely open.** All other DPIs resolved by Codex round-1 RE, round-2 RE, or operator-accepted firm rules.

---

## §12 — Phase C/D/E sealed-file discipline (preserved)

Phase F imports from Phase C/D/E but MUST NOT modify any sealed file:

- **Phase C sealed files**: `src/config.js`, `src/log.js`, `schemas/hermes-message.schema.json`
- **Phase D sealed files**: `src/store/source-of-truth.js`, `src/store/publish-log.js`, `src/store/dry-run-log.js`
- **Phase E sealed files**: `src/verify/schema-validator.js`, `channel-allowlist.js`, `codex-pass.js`, `operator-authorization.js`, `idempotency.js`, `ceiling-pause.js`, `placeholders.js`, `limits.js`, `network-anomaly.js`, `forbidden-content.js`, `dry-run-consistency.js`, `index.js`

Two operator-accepted deviations carried forward from Phase C/D/E precedent (Phase F continues):
1. `HaltClass` import from Phase C dropped — Phase F modules declare private `const HALT_CLASS = Object.freeze({ ... })` naming only canonical §15 IDs they consume
2. `safeLog` 2-arg binding convention — Phase F itself performs the pre-binding (`safeLog := (level, payload) => safeLogRaw(level, payload, logger)`)

---

## §13 — Non-authorization preservation clauses

This DESIGN-SPEC codification phase pre-authorizes **nothing** downstream. Specifically does NOT authorize:

No §15 extension is required before Phase F (per Codex round-1 RE-8); §15 extension MAY be required before Phase G if a production-send-failure halt class is needed.

- Opening Phase F SAFE IMPLEMENTATION (`COMM-HUB-RELAY-RUNTIME-IMPLEMENT-F-HALT`)
- Drafting Phase F source code in any repo
- Any `npm install` / `npm ci`
- Any clone / write / commit / push to `relentlessvic/agent-avila-relay`
- Adding any new dependency
- Source code beyond the canonical Phase F module breakdown described in §3
- Modifying Phase C-sealed, Phase D-sealed, or Phase E-sealed files — no exceptions
- Any Dockerfile / Railway config / CI workflows / tests
- Any Discord client / publish path / network reach
- Railway action / deploy
- Discord application/bot/token/permission/webhook/post
- Stage 5 install resumption (Steps 14–21 remain deferred; Stage 5 Gate-10 install approval at `40f3137e842cd60acf1adf17ecc7fe2f0b1b8935` remains CONSUMED)
- Stage 7 dry-run execution; Stages 8 / 9 / 10a / 10b auto-publish
- DB / Kraken / env / manual live-armed flag / production action
- DASH-6 / D-5.12f / Migration 009+
- Autopilot Loop B/C/D activation; CEILING-PAUSE break
- External Hermes Agent (Nous / OpenRouter) installation, integration, or use
- Memory-file edit; test-suite edit
- Modification of any other safety-policy doc / canonical Relay handoff record / runtime / migration / script / deploy file

**Codex round-3 explicit non-approval note (verbatim):** *"This is not approval to implement, commit, push, deploy, touch Discord/Railway/DB/env/production, or perform any runtime action."*

**Preservation invariants:**
- Migration 008 APPLIED at `189eb1be6ef6304d914671bdaedec44d389cf877` preserved
- N-3 CLOSED preserved
- Stage 5 Gate-10 install approval at `40f3137e842cd60acf1adf17ecc7fe2f0b1b8935` CONSUMED preserved
- Phase A CLOSED at Relay-repo `fcfec4882ac9fbb7fab1946bd3b9677ea9a211cf` preserved
- Phase A closeout CLOSED at parent-repo `1b20628ed280323c6b249c1e5d617ad17ea5a026` preserved
- B-DEPS-DESIGN-SPEC CLOSED at parent-repo `2b9144fc2536991a8966526ec28042b2bbe5ac5b` preserved
- Phase B CLOSED at Relay-repo `f87faef99600335a7db47ac1bffa92a499e54acb` preserved
- Phase B closeout CLOSED at parent-repo `5f2fc810c1b4c77607e8aa8ac40fe61fa32ed269` preserved
- C-CONFIG-DESIGN-SPEC CLOSED at parent-repo `491a24f5c3220be38f7faf51fe27497a4b441ac9` preserved
- Phase C CLOSED at Relay-repo `413a4fbeef65ca0d1fb03454d9993af6360d3ac4` preserved
- Phase C closeout CLOSED at parent-repo `7e0d227d843a58c5f851164485439cb17ae2632b` preserved
- D-STORE-DESIGN-SPEC CLOSED at parent-repo `1625f13f62df565bb52705e0106769624d061dd0` preserved
- Phase D CLOSED at Relay-repo `0d0210a32d9341d09bb7bed9be93d17c58791fbe` preserved
- Phase D closeout CLOSED at parent-repo `0314d2c0df50b67292a1f219a8d8fcc26f693655` preserved
- §15-EXTENSION-FOR-PHASE-E CLOSED at parent-repo `c3b3fbcc107d00022beae87ff238b43e351d282c` preserved (canonical §15 Layer 4 IDs 29/30/31/32)
- E-VERIFY-DESIGN-SPEC CLOSED at parent-repo `a7a1f7aaaa1de961b6338af900dc27c5b1c4a2f6` preserved
- Phase E CLOSED at Relay-repo `21896d65132a1dc9d48f2f5563113c06f62d0893` preserved
- E-VERIFY-CLOSEOUT CLOSED at parent-repo `28b16d0e7b62fcf2e58421e6b6ba1185cc1381ab` preserved
- Relay-runtime DORMANT preserved (Phases A + B + C + D + E added scaffolding + dep manifest + non-executing pure-function modules + JSON Schema + storage layer + verification gate modules only; no Discord client; no publish path beyond log-append plumbing; no halt state machine wiring beyond enum constants in private module-scoped objects; no posting capability; no Discord-side state change; modules instantiated only by future Phase F at boot)
- Autopilot DORMANT (verified at `eff4dd22b9b9af038c7ae45de301e60b3f45af98`) preserved
- CEILING-PAUSE history (broken via `ARC-8-UNPAUSE` at `22ba4a7663e22df64b7cc8e3c0324cbffc0e28f6`; phase-loop counter 0 of 3) preserved
- Approvers exactly `{Victor}` preserved
- `position.json.snap.20260502T020154Z` carve-out preserved untracked

This DESIGN-SPEC phase does NOT advance the autopilot phase-loop counter, does NOT install or modify the Relay runtime, does NOT post to Discord, and does NOT execute any production action.

---

## §14 — Next steps (post-DESIGN-SPEC)

1. Operator approves the persisted DESIGN-SPEC (this file) via operator-manual commit + push of the 4-file scope (1 new SAFE-class handoff record + 3 status doc updates).
2. After DESIGN-SPEC lands, operator opens (separately) `COMM-HUB-RELAY-RUNTIME-IMPLEMENT-F-HALT` SAFE IMPLEMENTATION (Mode 4 per Codex DPI-F7).
3. Operator-manual placement of Phase F files in Relay repo.
4. Codex on-disk source review of staged Phase F files.
5. Operator commit + push to Relay repo.
6. Parent-repo `F-HALT-CLOSEOUT` (DOCS-ONLY) records the Relay-repo Phase F SHA.
7. **After Phase F closes:** if Phase G needs a production-send-failure halt class, open `COMM-HUB-RELAY-RUNTIME-DESIGN-§15-EXTENSION-FOR-PHASE-G` BEFORE opening Phase G-GATEWAY DESIGN. **No §15 extension is needed before Phase F per Codex round-1 RE-8.**

Each step above requires its own design + Codex review + Victor approval cascade. This DESIGN-SPEC codification phase authorizes none of them.

---

**End of canonical Phase F-HALT design record. Future Phase F implementation remains separately gated and is NOT authorized by this DOCS-ONLY codification phase.**
