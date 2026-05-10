# COMM-HUB-RELAY-RUNTIME-IMPLEMENT-E-VERIFY-DESIGN

**Phase identity:** `COMM-HUB-RELAY-RUNTIME-IMPLEMENT-E-VERIFY`
**Phase mode (future):** SAFE IMPLEMENTATION (Mode 4)
**Source-design phase:** `COMM-HUB-RELAY-RUNTIME-IMPLEMENT-E-VERIFY-DESIGN` (Mode 2 / DESIGN-ONLY conversation)
**Source-design HEAD anchor:** `c3b3fbcc107d00022beae87ff238b43e351d282c` (parent repo; = §15-EXTENSION-FOR-PHASE-E commit)
**Relay-repo Phase D anchor:** `0d0210a32d9341d09bb7bed9be93d17c58791fbe` (`relentlessvic/agent-avila-relay`)
**Codification phase:** `COMM-HUB-RELAY-RUNTIME-IMPLEMENT-E-VERIFY-DESIGN-SPEC` (DOCS-ONLY / Mode 3)

This document persists the Codex-PASS Phase E-VERIFY design as a SAFE-class handoff record. Phase E covers the **full canonical E-VERIFY layer** under `src/verify/*.js` (all 11 gate modules + optional aggregator), per Codex round-1 RE-1 (Option B expansion). All 7 round-1 required edits + 3 round-2 required edits are applied verbatim. The document is NOT approval to open Phase E SAFE IMPLEMENTATION, NOT source code, NOT a network-touch, NOT a deploy.

---

## §0 — Phase classification & pre-flight verification

| Property | Value |
|---|---|
| Phase name | `COMM-HUB-RELAY-RUNTIME-IMPLEMENT-E-VERIFY` |
| Future phase mode | SAFE IMPLEMENTATION (Mode 4) |
| Predecessor (Relay repo) | Phase D `COMM-HUB-RELAY-RUNTIME-IMPLEMENT-D-STORE` at `0d0210a32d9341d09bb7bed9be93d17c58791fbe` |
| Predecessor (parent repo) | §15-EXTENSION-FOR-PHASE-E at `c3b3fbcc107d00022beae87ff238b43e351d282c` |
| Successor (lettered phase) | Phase F-HALT (per canonical 8-phase A→H sequence) |
| First HIGH-RISK phase | Phase G-GATEWAY (introduces Discord network behavior) |
| Working tree at design time | clean except `position.json.snap.20260502T020154Z` (untracked carve-out) |

**Codex review history (source design phase):**
- Round-1 DESIGN-ONLY: PASS WITH REQUIRED EDITS (7 required edits issued).
- Round-2 narrow re-review: PASS WITH REQUIRED EDITS (3 required edits issued; gate-9 split binding, gate-7 §15 extension flag, DPI-E10 wording correction).
- Round-3 narrow re-review: overall PASS confirming all 3 round-2 required edits correctly applied.
- Canonical §15 extension landed at parent SHA `c3b3fbcc107d00022beae87ff238b43e351d282c` adding new IDs 29/30/31/32 in Layer 4 to bind the previously-unbound Phase E failure modes.

---

## §1 — Recommended Phase E name

`COMM-HUB-RELAY-RUNTIME-IMPLEMENT-E-VERIFY`

Forward-looking name uses "RELAY" per `CLAUDE.md` naming convention. Historical literals preserved verbatim wherever they appear (`HERMES_VERSION` env var, `schemas/hermes-message.schema.json` filename).

---

## §2 — Recommended phase mode

**SAFE IMPLEMENTATION (Mode 4).**

Rationale:
- Phase E introduces **pure-function verification modules only** (no executable behavior at module load; no fs/network at import).
- Phase E **does not** construct a Discord client, send any HTTP request, touch any production database, run any trading code, or modify any environment.
- All 11 gate modules are factory-pattern exports that Phase F (future) invokes at boot + per-message in the gate pipeline.
- Mode 5 HIGH-RISK is reserved for Phase G-GATEWAY (the first phase that introduces Discord network behavior).

---

## §3 — Exact proposed Phase E scope (RE-1 + RE-4 applied: full canonical E-VERIFY layer)

**Twelve files** (11 gate modules + 1 optional aggregator), in `relentlessvic/agent-avila-relay`, under the canonical `src/verify/` subdirectory:

| Path | Gate | Approx LOC | Primary check |
|---|---|---|---|
| `src/verify/schema-validator.js` | 1 | ~120–160 | ajv message-shape validation against `schemas/hermes-message.schema.json` |
| `src/verify/channel-allowlist.js` | 2 | ~60–90 | `channel_id` resolves to one of 3 allowed snowflakes; `channel_name` matches |
| `src/verify/codex-pass.js` | 3 | ~80–120 | `codex_pass_verdict_ref.verdict==="PASS"`; `review_id` non-empty; `reviewed_at` not stale |
| `src/verify/operator-authorization.js` | 4 | ~120–180 | `mode==="per-message"` Victor-approver branch OR `mode==="class-authorization"` 7-bounds branch |
| `src/verify/idempotency.js` | 5 | ~80–120 | Calls injected `buildIdempotencyIndex()` (Phase D `publish-log.js`); halts on `outcome=success` collision |
| `src/verify/ceiling-pause.js` | 6 | ~80–120 | Reads `$CEILING_PAUSE_SIGNAL_PATH`; verifies signal + `halt_on_condition_flags.ceiling_pause_must_be_active===true` |
| `src/verify/placeholders.js` | 7 | ~120–170 | Validates `<PLACEHOLDER>` tokens are in `allowed_placeholder_map`; substitutes from injected sources; returns `substitutedBody` |
| `src/verify/limits.js` | 8 | ~100–140 | Char limit (post-substitution body ≤ 2000); per-channel rate limit |
| `src/verify/network-anomaly.js` | 9 | ~80–120 | Verifies Phase G's egress allowlist hook is registered + intact; inspects egress event log |
| `src/verify/forbidden-content.js` | 10 | ~120–180 | Scans (post-substitution) body for forbidden patterns from canonical HANDOFF-RULES + COMM-HUB-RULES |
| `src/verify/dry-run-consistency.js` | 11 | ~50–80 | If `RELAY_MODE=dry_run`, message MUST have `dry_run===true`; otherwise dual-path |
| `src/verify/index.js` (optional) | n/a | ~20–40 | Pure re-export aggregator (no factory invocation; no executable behavior; no fs/network at module load) |

**Total:** 12 files; ~1010–1500 LOC across all modules.

**Out of Phase E scope (deferred to later lettered phases):**
- Phase F orchestration / pipeline ordering / halt routing
- Phase G Discord client / network surface / egress hook installation
- Phase H Dockerfile / Railway / CI / tests
- Phase D-sealed storage modules (storage is consumed by gate 5 as injected dep, not re-implemented)
- Boot orchestration (`src/index.js` is Phase F territory)
- Validators for Phase D-internal log records (publish-log, dry-run-log) — DPI-E4 unchanged
- Modification of any Phase C-sealed file (`src/config.js`, `src/log.js`, `schemas/hermes-message.schema.json`) — RE-5 enforced
- Modification of any Phase D-sealed file (`src/store/*.js`) — Phase D sealed precedent

---

## §4 — Module shape (anti-features preserved verbatim from Phase C/D)

Every Phase E module MUST preserve:

| Property | Constraint |
|---|---|
| No top-level execution | All work inside exported factories; no fs/network/env reads at module load |
| No `dotenv` | Validated config + paths injected by caller (Phase F) |
| No new dependency | `ajv@8.20.0` from Phase B lockfile suffices for gate 1; **`ajv-formats` REMAINS FORBIDDEN** per Phase C RE-4; all other gates use Node built-ins (`node:fs/promises`, `node:path`) and pure JS |
| ES module syntax | `type: "module"` from Phase B `package.json` |
| Idempotent | Same input + same dependency state ⇒ same output |
| `safeLog` consumption | All log emissions through pre-bound `safeLog` (2-arg convention; matches Phase D pattern) |
| `HALT_CLASS` constant per module | Each module declares a private `const HALT_CLASS = Object.freeze({ ... })` naming only the canonical §15 IDs it consumes (matches Phase D operator-accepted deviation) |
| Phase C/D files sealed | No modification of `src/config.js`, `src/log.js`, `schemas/hermes-message.schema.json`, `src/store/*.js` |

---

## §5 — Per-gate design

### Gate 1 — `src/verify/schema-validator.js`

**Exports:**
- `createSchemaValidator({ schemaPath, safeLog }) → { validate, ensureSchemaLoaded }`
- `ValidatorError` class (`{ haltClass, path, reason }`)

**Behavior:** ajv-compiled validator with `allErrors: true` (DPI-E7); boot compile via `ensureSchemaLoaded` (DPI-E6); per-message `validate(message)` returns `{ ok, errors }` with ajv `data` field stripped from each error (DPI-E5). Hybrid throw-on-boot / return-on-per-message (DPI-E3).

### Gate 2 — `src/verify/channel-allowlist.js`

**Exports:** `createChannelAllowlistGate({ allowedChannels, safeLog }) → { verify }`

`allowedChannels` = `{ "#status": "<id>", "#summaries": "<id>", "#system-health": "<id>" }` (operator-provisioned at boot; not hardcoded). `verify(message)`: `channel_id` MUST be one of the snowflake values; `channel_name` MUST be the matching key.

### Gate 3 — `src/verify/codex-pass.js`

**Exports:** `createCodexPassGate({ stalenessThresholdMs, safeLog }) → { verify }`

`stalenessThresholdMs` = canonical 30 days default (configurable). `verify(message)` checks `codex_pass_verdict_ref.verdict === "PASS"`; `review_id` non-empty; `reviewed_at` valid date-time + not stale.

### Gate 4 — `src/verify/operator-authorization.js`

**Exports:** `createOperatorAuthorizationGate({ stalenessThresholdMs, safeLog }) → { verify }`

`verify(message)` dispatches on `operator_authorization.mode`:
- `"per-message"`: `approver === "Victor"`; `approved_at` valid + non-stale; `approval_session_ref` non-empty
- `"class-authorization"`: `class_ref` non-empty; `bounds` object with all 7 mandatory fields (`channel`, `template_id`, `allowed_event_types`, `max_count`, `expiration`, `revocation_rule`, `forbidden_content_constraints`); `expiration` not yet passed; `max_count` enforced via injected counter

### Gate 5 — `src/verify/idempotency.js`

**Exports:** `createIdempotencyGate({ buildIdempotencyIndex, safeLog }) → { verify }`

`buildIdempotencyIndex` is the Phase D callable from `src/store/publish-log.js`. `verify(message)`:
- `await buildIdempotencyIndex()` for fresh index (per-publish refresh per canonical §14)
- Look up `message.message_id`
- If found with `outcome === "success"` → halt
- If found with `outcome` starting with `halt:` → allow re-attempt (DPI-E11)
- Otherwise → ok

### Gate 6 — `src/verify/ceiling-pause.js`

**Exports:** `createCeilingPauseGate({ ceilingPauseSignalPath, expectedSignalContent, safeLog }) → { verify }`

`expectedSignalContent` = canonical `"ACTIVE"`. `verify(message)`:
- Read `$CEILING_PAUSE_SIGNAL_PATH`
- Verify content matches expected
- Verify `message.halt_on_condition_flags.ceiling_pause_must_be_active === true` (defense-in-depth)
- Halt on either mismatch

### Gate 7 — `src/verify/placeholders.js`

**Exports:** `createPlaceholdersGate({ substitutionSources, safeLog }) → { verify }`

`substitutionSources` = `{ UTC_DATE_AT_PUBLISH_TIME, UTC_TIME_AT_PUBLISH_TIME, PHASE_ID, COMMIT_SHA }` (Phase F injects at gate-time per DPI-E9). `verify(message, pipelineState)`:
- Iterate `body` for `<UPPERCASE>` patterns
- Each found pattern MUST be in `message.allowed_placeholder_map`
- Substitute per the map's value (4-element enum)
- Return `{ ok, errors, transformations: { substitutedBody } }` — `substitutedBody` propagated via `pipelineState` accumulator (DPI-E12) to gates 8 + 10

### Gate 8 — `src/verify/limits.js`

**Exports:** `createLimitsGate({ maxBodyLength, channelRateLimits, getRateLimitState, safeLog }) → { verify }`

`maxBodyLength` = 2000 (Discord limit). `channelRateLimits` = canonical per-channel caps. `getRateLimitState()` = injected callable returning current rate-limit counter (Phase F manages state). `verify(message, pipelineState)`:
- `pipelineState.substitutedBody.length ≤ maxBodyLength` → halt on overflow
- Rate-limit check via `getRateLimitState`

### Gate 9 — `src/verify/network-anomaly.js`

**Exports:** `createNetworkAnomalyGate({ allowlistHookRef, egressEventLogRef, safeLog }) → { verify }`

`allowlistHookRef` and `egressEventLogRef` are references to Phase G's runtime structures. **Phase G installs and Phase F injects refs; Phase E verifies only, with halt-class mapping split between ID 6 for egress anomaly and ID 23 for hook bypass** (DPI-E10 per Codex round-2 RE-3). Until Phase G lands, gate-9 is non-functional but its module exists with stub-safe behavior (e.g., halt loudly if refs are null at gate-time, treated as hook-missing/integrity-failure → §15 ID 32).

### Gate 10 — `src/verify/forbidden-content.js`

**Exports:** `createForbiddenContentGate({ forbiddenPatterns, safeLog }) → { verify }`

`forbiddenPatterns` = canonical pattern array from HANDOFF-RULES.md + COMM-HUB-RULES.md. `verify(message, pipelineState)`:
- Scan `pipelineState.substitutedBody` for any forbidden pattern
- Halt with canonical §13 "forbidden-content scan trip" → §15 ID 10 with caveat (per round-2 finding: §15 expresses this as bounds-violation including forbidden-content scan trip via bound 7 of class-authorization bounds list)

### Gate 11 — `src/verify/dry-run-consistency.js`

**Exports:** `createDryRunConsistencyGate({ relayMode, safeLog }) → { verify }`

`relayMode` = validated env from Phase C (`"production"` or `"dry_run"`). `verify(message)`:
- If `relayMode === "dry_run"` AND `message.dry_run !== true` → halt
- If `relayMode === "production"`: any `dry_run` value accepted but routes differently downstream

### Optional `src/verify/index.js` (DPI-E8)

```
export { createSchemaValidator, ValidatorError } from './schema-validator.js';
export { createChannelAllowlistGate } from './channel-allowlist.js';
// ... 9 more re-exports
```

Pure re-exports only. No factory invocations. No state. Safe per anti-features.

---

## §6 — Halt-class mapping (post-§15-extension; Codex round-2 + round-3 verified; landed at parent SHA `c3b3fbcc107d00022beae87ff238b43e351d282c`)

| Failure mode | Canonical §15 numeric ID | Canonical name | Status |
|---|---|---|---|
| ajv/library-load failure (boot) | **26** | "Schema validation library missing" | ✓ canonical-bound; library-only |
| Schema-file unverifiable at boot | **30** | "Schema file unverifiable at boot" (Layer 4 added by §15-EXTENSION-FOR-PHASE-E) | ✓ canonical-bound |
| Gate 1 — per-message schema mismatch | **29** | "Per-message schema mismatch (Phase E gate 1)" (Layer 4 added by §15-EXTENSION-FOR-PHASE-E) | ✓ canonical-bound |
| Gate 2 — channel allow-list violation | **3** | "Channel not in allow-list" | ✓ canonical-bound (Codex round-2) |
| Gate 3 — Codex PASS metadata missing/stale | **1** | "Missing or stale Codex PASS metadata" | ✓ canonical-bound (Codex round-2) |
| Gate 4 — operator authorization missing/expired/exhausted/out-of-scope | **2**; class-authorization bounds violation also uses **10** | "Missing/expired/exhausted/out-of-scope operator authorization metadata" | ✓ canonical-bound (Codex round-2; dual-ID for per-message vs class-authorization paths) |
| Gate 5 — idempotency duplicate/mismatch/collision | **7** | "Idempotency-key mismatch / collision / reuse / unverifiable" | ✓ canonical-bound (Codex round-2) |
| Gate 6 — CEILING-PAUSE state | **8** | "CEILING-PAUSE state ACTIVE" | ✓ canonical-bound (Codex round-2) |
| Gate 7 — allow-listed-placeholder violation | **31** | "Allow-listed-placeholder violation (Phase E gate 7)" (Layer 4 added by §15-EXTENSION-FOR-PHASE-E) | ✓ canonical-bound |
| Gate 8 — character-limit exceeded | **4** | "character-limit exceeded" | ✓ canonical-bound (Codex round-2) |
| Gate 8 — rate-limit hit | **5** | "rate-limit hit" | ✓ canonical-bound (Codex round-2) |
| **Gate 9 — non-allow-listed egress anomaly** | **6** | "Network anomaly (egress to non-allow-listed endpoint)" | ✓ canonical-bound (Codex round-2; split-binding part 1) |
| **Gate 9 — network allowlist hook bypass** | **23** | "Network allowlist hook bypass" | ✓ canonical-bound (Codex round-2; split-binding part 2) |
| **Gate 9 — hook-missing / integrity-failure** | **32** | "Network allowlist hook missing or integrity-failure (Phase E gate 9)" (Layer 4 added by §15-EXTENSION-FOR-PHASE-E) | ✓ canonical-bound (split-binding part 3) |
| Gate 10 — forbidden-content scan trip | **10** with caveat | (§15 expresses this as bounds-violation including forbidden-content scan trip via bound 7) | ✓ canonical-bound with documented caveat |
| Gate 11 — dry-run flag mismatch | **12** | "Test message lacks `dry_run: true` flag while in dry-run mode" | ✓ canonical-bound (Codex round-2) |

**Phase E adds zero new halt classes.** All 11 gates' halt-class numeric bindings exist in canonical §15 (Layer 1: 1-10, Layer 2: 11-19, Layer 3: 20-28, Layer 4: 29-32). The §15-EXTENSION-FOR-PHASE-E phase landed at parent SHA `c3b3fbcc107d00022beae87ff238b43e351d282c` adding the 4 new IDs (29, 30, 31, 32) to enable Phase E to bind every failure mode to a canonical numeric ID.

---

## §7 — Phase F orchestration boundary

**Phase F (HALT) owns:**
- The 11-gate pipeline ORDER (per canonical §13)
- Halt routing — converting `{ok: false, errors}` from any gate into halt-state-machine actions (move pending → processed/halt; append outcome to publish-log; exit per canonical §15 halt behavior)
- Boot orchestration (`src/index.js`)
- Dependency injection — wiring Phase D + Phase E + (future) Phase G modules together
- Rate-limit state management (gate 8)
- `pipelineState` accumulator passed forward through gates 7→8→10
- Substitution-source injection (gate 7 per DPI-E9)
- Egress allowlist-hook + event-log ref injection (gate 9 per DPI-E10)

**Phase E (VERIFY) owns:**
- The 11 individual gate verification modules
- Each module's halt-class binding via private `HALT_CLASS` const (consuming canonical §15 IDs)
- Pure verification logic only; no orchestration, no halt routing, no pipeline ordering

The boundary: Phase E modules return `{ ok, errors }`. Phase F decides what to do with `ok: false`.

---

## §8 — Phase G boundary

**Phase G (GATEWAY) owns (FIRST HIGH-RISK phase):**
- Discord client construction (discord.js)
- Discord gateway IDENTIFY + READY
- Send Message API call
- Egress allowlist hook **installation** (the hook itself; Layer 2 of canonical §10)
- Egress event log structure (in-memory ring buffer)

**Phase E does NOT own:**
- Any Discord client code
- Any HTTP request
- Hook installation
- Event log creation

Phase E gate-9 only **verifies** that Phase G's hook + log are intact at gate-time. No Phase G work bleeds into Phase E.

---

## §9 — Phase H boundary

**Phase H (DOCKER) owns:**
- Dockerfile
- Railway config (`railway.json`)
- CI workflows (`.github/workflows/**`)
- Tests (`__tests__/**`, `*.test.js`)

**Phase E does NOT own** any of these. Phase E modules MUST be testable but Phase E itself does NOT add tests.

---

## §10 — Phase E does NOT activate Relay

**Phase E adds zero executable Relay behavior:**

| Concern | Phase E (proposed) | Activation level |
|---|---|---|
| Module load | Pure exports only; no `process.env`, no fs, no network at import | DORMANT |
| Factory invocation | Phase F (future) calls factories at boot; Phase E itself never invokes its own factories | DORMANT (phase-internal) |
| `verify()` invocation | Phase F gate pipeline calls each module's `verify()` per pending message | DORMANT until Phase F lands |
| Discord side-effect | None — gates 1-11 are pure verification + fs reads (gate 6) + Phase D delegations (gate 5) + Phase G observations (gate 9) | DORMANT |
| Network side-effect | None — gate 9 reads runtime structures; never makes HTTP calls | DORMANT |
| Publish side-effect | None — gates produce verdicts; Phase F decides whether to write to logs / move files | DORMANT |
| live-armed-flag touch | None | DORMANT |
| Discord posting | None — Phase G concern | DORMANT |
| Railway / deploy | None — Phase H concern | DORMANT |

**Verdict:** Phase E is a pure verification library. The Relay runtime remains DORMANT (nothing posts, nothing connects, nothing triggers) until Phase F + Phase G + Phase H land in subsequent operator-approved phases. Phase E by itself cannot post a Discord message, cannot deploy, cannot mutate any production surface.

---

## §11 — Anti-features preserved

| Property | Phase C | Phase D | Phase E (proposed) |
|---|---|---|---|
| No top-level execution | ✓ | ✓ | ✓ — exported factories only |
| No `dotenv` | ✓ | ✓ | ✓ — paths/values injected by caller |
| No fs writes at module load | ✓ | ✓ | ✓ — fs only inside method bodies (gate 6 reads signal at gate-time) |
| No network reach | ✓ | ✓ | ✓ — gate 9 inspects in-memory state, never makes HTTP |
| ES module syntax | ✓ | ✓ | ✓ |
| Idempotent | ✓ | ✓ | ✓ |
| New dependencies | none | none | none — `ajv@8.20.0` from Phase B suffices; **`ajv-formats` REMAINS FORBIDDEN** per Phase C RE-4 |
| `safeLog` mandatory | ✓ (RE-3) | ✓ | ✓ — all log emissions through injected `safeLog` |
| Phase C-sealed files unchanged | n/a | ✓ | ✓ — no modification of `src/config.js`, `src/log.js`, `schemas/hermes-message.schema.json` |
| Phase D-sealed files unchanged | n/a | n/a | ✓ — no modification of `src/store/*.js` |

---

## §12 — Decision points (final state after rounds 1-3)

| # | Decision | Final recommendation | Codex status |
|---|---|---|---|
| **DPI-E1** | Halt-class binding for per-message schema mismatch + schema-file failures | **Resolved by §15-EXTENSION-FOR-PHASE-E** at parent SHA `c3b3fbcc…` adding IDs 29 (schema mismatch), 30 (schema-file unverifiable). ID 26 reserved ONLY for ajv/library load failure. | ✓ canonical-bound post-extension |
| **DPI-E2** | File layout | **Full canonical 11+1 layout under `src/verify/`** (11 gate modules + optional index aggregator) per Codex round-1 RE-4/RE-7. | ✓ Codex-approved |
| **DPI-E3** | Throw vs return | **Hybrid:** boot-time `ensureXxx` throws; per-message `verify` returns `{ok, errors}`. Phase F converts `ok: false` to canonical halt path. | ✓ Codex-approved |
| **DPI-E4** | Validate publish-log/dry-run-log records? | **No** — Phase D writes them internally; YAGNI. | ✓ Codex-approved |
| **DPI-E5** | Strip `data` field from returned errors | **Yes** — defense-in-depth; bound errors; never log raw body. | ✓ Codex-approved |
| **DPI-E6** | Schema compile timing | **Boot via `ensureSchemaLoaded()`**, distinguishing 3 failure modes: ajv missing → ID 26; schema-file missing/unreadable/not-JSON/fails-compile → ID 30; per-message schema mismatch at gate-1 → ID 29. | ✓ Codex-approved post-§15-extension |
| **DPI-E7** | ajv `allErrors` mode | **`allErrors: true`** — multi-error mode; bounded + redacted. | ✓ Codex-approved |
| **DPI-E8** | Include `src/verify/index.js` aggregator? | **Yes** — pure re-exports only; no factory invocation; no executable behavior; cleaner Phase F imports. | ✓ Codex-approved |
| **DPI-E9** | Where do gate-7 substitution sources come from? | **Phase F injects them** at gate-time — Phase F binds the 4-element enum to runtime values. | ✓ Codex-approved |
| **DPI-E10** | Where do gate-9 egress-event-log + allowlist-hook come from? | **Phase G installs and Phase F injects refs; Phase E verifies only, with halt-class mapping split between ID 6 for egress anomaly and ID 23 for hook bypass** (Codex round-2 RE-3). Hook-missing/integrity-failure binds to §15 ID 32 (added by §15-EXTENSION-FOR-PHASE-E). | ✓ Codex-approved post-§15-extension |
| **DPI-E11** | Gate 5 behavior on prior `outcome=halt:<class>` for same `message_id` | **Allow re-attempt** (operator may have fixed and re-staged); halt only on `outcome=success` collision. | ✓ Codex-approved |
| **DPI-E12** | Gate 7 substituted-body propagation to gates 8 + 10 | **`pipelineState` accumulator** passed forward through Phase F's pipeline. | ✓ Codex-approved |

---

## §13 — Codex review history (rounds 1, 2, 3)

### Round-1 verbatim required edits (7 RE)

1. **§1 correction** — Phase E is full canonical E-VERIFY (not gate-1-only); IMPLEMENT-DESIGN defines E-VERIFY as `src/verify/*.js` for all 11 gate modules.
2. **§10 correction** — Ajv/library load failure maps to canonical halt class 26; schema-file missing/unreadable/invalid + per-message schema mismatch had no §15 numeric binding (canonical §15 update required first — RESOLVED by §15-EXTENSION-FOR-PHASE-E).
3. **§10 correction** — Per-message schema mismatch must NOT reuse ID 26.
4. **§11 correction** — Enumerate 11 gate modules under `src/verify/`, not 1.
5. **§12 correction** — Surface extends beyond `validator.validate(parsed)` — each gate module is a separate surface; Phase F orchestrates.
6. **§15 DPI-E1 correction** — Halt-class binding for per-message schema mismatch requires canonical §15 amendment.
7. **§15 DPI-E2 correction** — File layout follows canonical `src/verify/*.js`.

All 7 round-1 RE applied conversation-only verbatim before round-2.

### Round-2 verbatim required edits (3 RE)

1. **§7 halt-class binding strategy** — Gate 9 has split binding: non-allow-listed egress anomaly → §15 ID 6; network allowlist hook bypass → §15 ID 23; hook-missing/integrity-failure → requires explicit §15 clarification (RESOLVED by ID 32 in §15-EXTENSION).
2. **§7 halt-class binding strategy** — Gate 7 allow-listed-placeholder violation has NO numeric §15 ID and must be included in `COMM-HUB-RELAY-RUNTIME-DESIGN-§15-EXTENSION-FOR-PHASE-E` before SAFE IMPLEMENTATION (RESOLVED by ID 31 in §15-EXTENSION).
3. **DPI-E10** — Phase G installs and Phase F injects refs; Phase E verifies only, with halt-class mapping split between ID 6 for egress anomaly and ID 23 for hook bypass.

All 3 round-2 RE applied conversation-only verbatim before round-3.

### Round-3 verbatim PASS verdicts

1. PASS — Round-2 RE-1 applied: gate 9 split into ID 6 + ID 23 + explicit §15 clarification for hook-missing/integrity-failure.
2. PASS — Round-2 RE-2 applied: gate 7 placeholder violation marked NONE + included in §15 extension list.
3. PASS — Round-2 RE-3 applied: DPI-E10 uses split ownership/mapping wording.

**Overall round-3 verdict: PASS.**

### §15-EXTENSION-FOR-PHASE-E phase (canonical §15 update)

Following round-3 PASS, the operator opened `COMM-HUB-RELAY-RUNTIME-DESIGN-§15-EXTENSION-FOR-PHASE-E` (DOCS-ONLY canonical-update phase) to amend §15 with numeric IDs for the 4 unbound items. Codex DOCS-ONLY review of the extension diff returned PASS WITH REQUIRED EDITS (3 wording-only edits to remove the live-armed-flag literal from new section text); narrow re-review returned overall PASS. The §15 extension landed at parent SHA `c3b3fbcc107d00022beae87ff238b43e351d282c`, adding IDs 29-32 to a new Layer 4. All 11 Phase E gates now have canonical §15 numeric bindings.

---

## §14 — Codex review gates (Phase E)

| Gate | Reviewer | What is reviewed |
|---|---|---|
| Source-design round-1 | Codex (DESIGN-ONLY) | Conversation-only Phase E-VERIFY design report |
| Source-design round-2 | Codex (DESIGN-ONLY narrow) | Verifies all 7 round-1 RE applied |
| Source-design round-3 | Codex (DESIGN-ONLY narrow) | Verifies all 3 round-2 RE applied |
| §15-extension on-disk | Codex (DOCS-ONLY) | §15 extension diff with halt-class IDs 29-32 |
| §15-extension narrow re-review | Codex (DOCS-ONLY narrow) | Verifies wording-only edits applied |
| Codification on-disk round-1 | Codex (DOCS-ONLY) | Working-tree diff of this codification commit |
| Implementation on-disk round-1 | Codex (DOCS-ONLY) | Staged Phase E files in Relay repo |
| Implementation on-disk round-N | Codex (DOCS-ONLY narrow) | If any RE issued, verifies fixes |
| Closeout DOCS-ONLY | Codex (DOCS-ONLY) | Parent-repo working-tree diff for E-VERIFY-CLOSEOUT |

---

## §15 — Victor approval gates (Phase E)

| Gate | Action approved | Status |
|---|---|---|
| Open E-VERIFY-DESIGN | DESIGN-ONLY conversation | (consumed) |
| Open §15-EXTENSION-FOR-PHASE-E | DOCS-ONLY canonical-update | (consumed at `c3b3fbcc…`) |
| Open E-VERIFY-DESIGN-SPEC | DOCS-ONLY codification | (consumed at this commit) |
| Open E-VERIFY | SAFE IMPLEMENTATION drafting | pending |
| Codex on-disk E-VERIFY PASS | open commit-only approval | pending |
| Commit-only E-VERIFY | 12-file Relay-repo commit | pending |
| Push E-VERIFY | push to Relay `origin/main` | pending |
| Open E-VERIFY-CLOSEOUT | DOCS-ONLY closeout | pending |
| Commit-only E-VERIFY-CLOSEOUT | parent-repo 3-file commit | pending |
| Push E-VERIFY-CLOSEOUT | push to parent `origin/main` | pending |

Approvers exactly `{Victor}`. No exception.

---

## §16 — Implementation order (recommended for future SAFE IMPLEMENTATION)

1. **`src/verify/schema-validator.js`** first — foundational ajv compilation; consumes Phase C `schemas/hermes-message.schema.json` (read-only).
2. **`src/verify/channel-allowlist.js`**, **`src/verify/codex-pass.js`**, **`src/verify/operator-authorization.js`** — pure metadata checks; no fs, no network, no Phase D/G dependencies.
3. **`src/verify/idempotency.js`** — depends on Phase D `publish-log.js` `buildIdempotencyIndex` callable (injected).
4. **`src/verify/ceiling-pause.js`** — fs reads; depends on Phase C-validated `$CEILING_PAUSE_SIGNAL_PATH`.
5. **`src/verify/placeholders.js`** — pure transformation; substitution sources injected by Phase F.
6. **`src/verify/limits.js`** — depends on rate-limit state (Phase F-managed).
7. **`src/verify/network-anomaly.js`** — depends on Phase G runtime structures (stub-safe behavior until Phase G lands).
8. **`src/verify/forbidden-content.js`** — pure scan; pattern set injected by Phase F.
9. **`src/verify/dry-run-consistency.js`** — pure check; depends on Phase C-validated `RELAY_MODE`.
10. **`src/verify/index.js`** (optional) — pure re-exports; last to add.
11. **Optional smoke checks** at draft time:
    - `node -e "import('./src/verify/schema-validator.js').then(m => console.log(Object.keys(m)))"` per file
    - Operator-manual; Claude does not run `node`

---

## §17 — Rollback plan

If Phase E is committed to the Relay repo and a defect is discovered post-merge:
1. Operator-manual `git revert <Phase-E-SHA>` on the Relay repo.
2. Operator-manual `git push origin main` of the revert.
3. Parent-repo `E-VERIFY-CLOSEOUT-ROLLBACK` (a new DOCS-ONLY phase) records the original Phase E SHA, the revert SHA, the defect, and three-way SHA consistency PASS post-revert-push.

Phase E modules are pure-function, no-side-effect modules. A revert removes them entirely; subsequent phases (F-HALT, G-GATEWAY, etc.) cannot proceed until Phase E is re-implemented.

---

## §18 — What is NOT authorized

`COMM-HUB-RELAY-RUNTIME-IMPLEMENT-E-VERIFY-DESIGN-SPEC` (this codification phase) does NOT authorize:

- Opening `COMM-HUB-RELAY-RUNTIME-IMPLEMENT-E-VERIFY` (the future SAFE IMPLEMENTATION) — separate operator approval required
- Drafting Phase E source code (DESIGN-SPEC produces no source code)
- Any `npm install` / `npm ci`
- Any clone / write / commit / push to `relentlessvic/agent-avila-relay`
- Adding any new dependency (`ajv@8.20.0` from Phase B suffices; `ajv-formats` REMAINS FORBIDDEN)
- Any source code beyond the 11+1 Phase E files under `src/verify/`
- Modifying `src/config.js` / `src/log.js` / `schemas/hermes-message.schema.json` (Phase C-sealed) — **no exceptions**
- Modifying `src/store/*.js` (Phase D-sealed) — **no exceptions**
- Any Dockerfile / Railway config / CI workflows / tests / additional schemas / Discord client / publish path / halt state machine wiring beyond enum constants imported from Phase C / private module-scoped halt-class objects
- Any Railway action / deploy
- Any Discord application / bot / token / permission / webhook / post action
- Stage 5 install resumption (Steps 14–21 remain deferred; Stage 5 Gate-10 install approval at `40f3137e842cd60acf1adf17ecc7fe2f0b1b8935` remains CONSUMED)
- Stage 7 dry-run execution
- Stages 8 / 9 / 10a / 10b auto-publish activation
- DB / Kraken / env / live-armed flag / production action
- Live trading
- DASH-6 smoke run
- D-5.12f first-live-exercise
- Migration 009+
- Autopilot Loop B/C/D activation
- CEILING-PAUSE break
- External Hermes Agent (Nous / OpenRouter) installation, integration, or use
- Memory-file edit
- Test-suite edit
- Modification of any other safety-policy doc / canonical Relay handoff record / runtime / migration / script / deploy file (the `§15-EXTENSION-FOR-PHASE-E` phase already amended `RUNTIME-DESIGN.md` §15 in a prior commit)

---

## §19 — Authorization scope (explicit non-authorizations preserved)

This document (and the codification phase that creates it) preserves the following preserved-state references unchanged:
- Migration 008 APPLIED at `189eb1be6ef6304d914671bdaedec44d389cf877`
- N-3 CLOSED
- Stage 5 Gate-10 install approval at `40f3137e842cd60acf1adf17ecc7fe2f0b1b8935` CONSUMED
- Phase A `COMM-HUB-RELAY-RUNTIME-IMPLEMENT-A-BOOTSTRAP` CLOSED at Relay-repo first-root commit `fcfec4882ac9fbb7fab1946bd3b9677ea9a211cf`
- Phase A closeout `COMM-HUB-RELAY-RUNTIME-IMPLEMENT-A-BOOTSTRAP-CLOSEOUT` CLOSED at parent-repo `1b20628ed280323c6b249c1e5d617ad17ea5a026`
- Phase B-DEPS-DESIGN-SPEC CLOSED at parent-repo `2b9144fc2536991a8966526ec28042b2bbe5ac5b`
- Phase B `COMM-HUB-RELAY-RUNTIME-IMPLEMENT-B-DEPS` CLOSED at Relay-repo `f87faef99600335a7db47ac1bffa92a499e54acb`
- Phase B closeout `COMM-HUB-RELAY-RUNTIME-IMPLEMENT-B-DEPS-CLOSEOUT` CLOSED at parent-repo `5f2fc810c1b4c77607e8aa8ac40fe61fa32ed269`
- Phase C-CONFIG-DESIGN-SPEC CLOSED at parent-repo `491a24f5c3220be38f7faf51fe27497a4b441ac9`
- Phase C `COMM-HUB-RELAY-RUNTIME-IMPLEMENT-C-CONFIG` CLOSED at Relay-repo `413a4fbeef65ca0d1fb03454d9993af6360d3ac4`
- Phase C closeout `COMM-HUB-RELAY-RUNTIME-IMPLEMENT-C-CONFIG-CLOSEOUT` CLOSED at parent-repo `7e0d227d843a58c5f851164485439cb17ae2632b`
- Phase D-STORE-DESIGN-SPEC CLOSED at parent-repo `1625f13f62df565bb52705e0106769624d061dd0`
- Phase D `COMM-HUB-RELAY-RUNTIME-IMPLEMENT-D-STORE` CLOSED at Relay-repo `0d0210a32d9341d09bb7bed9be93d17c58791fbe`
- Phase D closeout `COMM-HUB-RELAY-RUNTIME-IMPLEMENT-D-STORE-CLOSEOUT` CLOSED at parent-repo `0314d2c0df50b67292a1f219a8d8fcc26f693655`
- §15-EXTENSION-FOR-PHASE-E CLOSED at parent-repo `c3b3fbcc107d00022beae87ff238b43e351d282c` (new IDs 29/30/31/32 in Layer 4)
- Relay-runtime DORMANT (Phases A + B + C + D added non-executable scaffolding + dependency manifest + non-executing pure-function modules + JSON Schema + storage layer pure-function modules only; no Discord client; no publish path beyond log-append plumbing; no halt state machine wiring beyond enum constants; no posting capability; no Discord-side state change)
- Autopilot DORMANT (verified at `eff4dd22b9b9af038c7ae45de301e60b3f45af98`)
- CEILING-PAUSE history (broken via `ARC-8-UNPAUSE` at `22ba4a7663e22df64b7cc8e3c0324cbffc0e28f6`; phase-loop counter 0 of 3)
- Approvers exactly `{Victor}`
- `position.json.snap.20260502T020154Z` carve-out preserved untracked

---

## What this document is NOT

- NOT operator approval to open `COMM-HUB-RELAY-RUNTIME-IMPLEMENT-E-VERIFY`. That requires explicit Victor in-session chat instruction.
- NOT source code. The actual `src/verify/*.js` files are drafted only during the future SAFE IMPLEMENTATION phase, under operator approval.
- NOT a network-touch. No HTTP. No Discord. No Railway. No external API.
- NOT a Discord-touch. No bot login. No channel write. No webhook.
- NOT a deploy. No Railway action. No production action.
- NOT authorization to bypass any canonical safety boundary. All 10 runtime safety boundaries remain in effect.
- NOT authorization to modify Phase C-sealed or Phase D-sealed files. **No exceptions.**
- NOT a `safeLog`-bypass mechanism. All Phase E log emissions route through `safeLog`.
- NOT a Discord-side state change. The Relay bot remains a passive member of `Agent Avila Hub` with no posting capability.
- NOT an Autopilot phase-loop counter advance. The counter remains 0 of 3.
- NOT a §15 amendment. §15 was already amended by `§15-EXTENSION-FOR-PHASE-E` in a prior commit (`c3b3fbcc…`); this codification phase does NOT touch §15.

This document records design intent and persists it as a SAFE-class handoff record. Any action that consumes this design requires its own subsequent operator-approval phase.
