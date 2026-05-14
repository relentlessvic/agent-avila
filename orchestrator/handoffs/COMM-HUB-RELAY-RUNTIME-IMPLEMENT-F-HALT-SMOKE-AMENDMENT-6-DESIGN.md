# COMM-HUB-RELAY-RUNTIME-IMPLEMENT-F-HALT-SMOKE-AMENDMENT-6-DESIGN

**This handoff codifies the Codex-approved (PASS WITH REQUIRED EDITS; one cosmetic ASCII-arrow correction applied verbatim here) conversation-only `COMM-HUB-RELAY-RUNTIME-IMPLEMENT-F-HALT-SMOKE-AMENDMENT-6-DESIGN` (Mode 2 / DESIGN-ONLY, no commit). This codification phase is `COMM-HUB-RELAY-RUNTIME-IMPLEMENT-F-HALT-SMOKE-AMENDMENT-6-DESIGN-SPEC` (DOCS-ONLY / Mode 3). The future implementation phase `COMM-HUB-RELAY-RUNTIME-IMPLEMENT-F-HALT-SMOKE-AMENDMENT-6` is SAFE IMPLEMENTATION (Mode 4) — separately gated; not authorized by this codification.**

**Codification provenance:** RUN-5 (Mode 4 SAFE EXECUTION) at Relay `e715f5d3…` produced halt 30 across all 8 boot-path tests; the Mode 1 `RUN-5-FAILURE-AUDIT` identified two layers of failure: Layer 1 (Ajv strict mode + `format: "date-time"` without `ajv-formats`) and Layer 2 (`allowedChannels` type-contract mismatch between `src/runtime/boot.js:362` Array.isArray check and `src/verify/channel-allowlist.js:54` object-map lookup). AMENDMENT-5 (sealed at Relay `776a1f0d…` per parent CLOSEOUT at `45d91d23…`) addressed Layer 1 via `ajv.addFormat('date-time', () => true);` polyfill. AMENDMENT-6 (this design) addresses Layer 2 via a single-file edit to `src/runtime/boot.js:360-369` restoring the canonical object-map contract at the gate-2 factory call site. A Codex DESIGN-ONLY review of this AMENDMENT-6 design returned PASS WITH REQUIRED EDITS — substantive design approved; single cosmetic correction (replace Unicode arrow U+2192 with ASCII `->` in the proposed WHY comment) applied verbatim in this codification. Codex also recommended that AMENDMENT-6-DESIGN be codified as a parent-repo DESIGN-SPEC handoff (this file) before Mode 4 SAFE IMPLEMENTATION, consistent with AMENDMENT-5 + SCAFFOLD-REPAIR precedent. **This file does NOT itself constitute an execution authorization. Codex review verdicts are not operator approval.** Approvers exactly `{Victor}`.

---

## §0 — Phase classification & current anchors

| Property | Value |
|---|---|
| Phase name (this codification phase) | `COMM-HUB-RELAY-RUNTIME-IMPLEMENT-F-HALT-SMOKE-AMENDMENT-6-DESIGN-SPEC` |
| Phase mode (this codification phase) | Mode 3 / DOCS-ONLY |
| Original phase name (codified design) | `COMM-HUB-RELAY-RUNTIME-IMPLEMENT-F-HALT-SMOKE-AMENDMENT-6-DESIGN` |
| Original phase mode | Mode 2 / DESIGN-ONLY (conversation-only; no commit) |
| Parent-repo HEAD anchor | `45d91d23d4fb276734ad270de9be2c4792b1d131` (AMENDMENT-5-CLOSEOUT sealed) |
| Relay-repo HEAD anchor | `776a1f0dfdb60ba6ad70827bcdf891099c975854` (AMENDMENT-5 SAFE IMPLEMENTATION sealed; ajv `date-time` polyfill applied) |
| Pre-DESIGN-SPEC parent anchor | `45d91d23d4fb276734ad270de9be2c4792b1d131` (AMENDMENT-5-CLOSEOUT) |
| Sealed AMENDMENT-5-DESIGN handoff | parent `0e9a678e9bd215826953cd8f9444eec9dbbbdd27` (untouched) |
| Sealed SCAFFOLD-REPAIR-DESIGN handoff | parent `31ea6f5f0f5e6409c33f4a6a8c62939eb50aee7a` (untouched) |
| Sealed F-HALT-SMOKE-RUN-DESIGN handoff | parent `5acac86b521b8e3783b43018d4091194316e7a61` (untouched) |
| Sealed F-HALT-SMOKE-AMENDMENT-2-DESIGN handoff | parent `c642b2b73276580d4c30d0c26337e335f8c24cc2` (untouched) |
| Future implementation phase (gated; NOT authorized) | `COMM-HUB-RELAY-RUNTIME-IMPLEMENT-F-HALT-SMOKE-AMENDMENT-6` (Mode 4 SAFE IMPLEMENTATION) |
| Future re-execution phase (gated; NOT authorized) | `COMM-HUB-RELAY-RUNTIME-IMPLEMENT-F-HALT-SMOKE-RUN-6` (Mode 4 SAFE EXECUTION; requires both AMENDMENT-5 AND AMENDMENT-6 sealed) |
| Parent repo working tree at codification time | clean except `position.json.snap.20260502T020154Z` + `orchestrator/handoffs/evidence/F-HALT-SMOKE-RUN/`, `-2/`, `-3/`, `-4/`, `-5/` (6 authorized untracked carve-outs) |
| Relay repo working tree at codification time | clean |
| Relay-runtime status | DORMANT preserved |
| Autopilot status | DORMANT preserved (verified at `eff4dd22…`) |
| Approvers | exactly `{Victor}` |

---

## §1 — Problem framing (Layer 2 root cause)

After AMENDMENT-5 unblocks Stage 11 (schema-validator compile no longer halts at class 30), boot can progress to Stage 12 (Phase E gate factories). At Stage 12 the boot.js factory call site at lines 360-365 validates `runtimeConfig.allowedChannels` via `Array.isArray()` and falls back to an empty array `[]`. The `channel-allowlist.js` factory then consumes that value as an object-map lookup (`allowedChannels[message.channel_name]`), which yields `undefined` for every string key when fed an array.

**Codex-verified file:line citations:**

| Location | Content |
|---|---|
| `src/runtime/boot.js:360-365` | `channelAllowlist = createChannelAllowlistGate({ allowedChannels: runtimeConfig && Array.isArray(runtimeConfig.allowedChannels) ? runtimeConfig.allowedChannels : [], safeLog });` |
| `src/verify/channel-allowlist.js:39-40` (comment) | `'\`allowedChannels\` is an object mapping channel_name -> channel_id, e.g.: { "#status": "<snowflake>", "#summaries": "<snowflake>", "#system-health": "<snowflake>" }'` |
| `src/verify/channel-allowlist.js:52-55` | `function verify(message) { const errors = []; const expectedId = allowedChannels[message.channel_name]; if (expectedId === undefined) { ... }` |
| `src/verify/channel-allowlist.js:60` | `params: { allowedNames: Object.keys(allowedChannels) }` |
| `src/verify/channel-allowlist.js:62` | `else if (message.channel_id !== expectedId) { errors.push({ ... 'allow-list-mismatch' ... }) }` |
| `tests/smoke/helpers/synthetic-runtime-config.js:13-17` (post-SCAFFOLD-REPAIR; sealed at Relay `776a1f0d…`) | `allowedChannels: { '#status': '123456789012345678' }` (object-map form) |
| `schemas/hermes-message.schema.json:24-30` | `channel_id` snowflake pattern `^[0-9]{17,20}$`; `channel_name` enum `["#status", "#summaries", "#system-health"]` |
| `package.json:13-15` | `"dependencies": { "ajv": "8.20.0", "pino": "9.14.0" }` (no `ajv-formats`; AMENDMENT-5 polyfill is the only Ajv format extension) |

**Failure mode after AMENDMENT-5 (verified by code-trace; not yet executed):**

1. Test calls `boot({ runtimeConfig: syntheticRuntimeConfig() })` with `allowedChannels: { '#status': '123456789012345678' }` (object-map).
2. `boot.js:362` evaluates `Array.isArray({ '#status': '...' })` -> `false`.
3. Boot falls back to `[]` (empty array).
4. `createChannelAllowlistGate` receives `[]`.
5. For every message processed at gate-2: `[]['#status']` -> `undefined` -> `verify()` returns `{ ok: false, errors: [{ keyword: 'allow-list', message: 'channel_name not in operator-provisioned allow-list', ... }] }`.
6. Phase F maps gate-2 violation to `HALT_CLASS.CHANNEL_NOT_IN_ALLOW_LIST` (= 3 per `channel-allowlist.js:23-25`).
7. Boot-path tests that expected later halt classes (20, 32, 29, 7, 2, etc.) instead halt at 3 — failure pattern shifted from Layer 1 (halt 30) to Layer 2 (halt 3).

**The bug is in `boot.js:362`, not in `channel-allowlist.js`** (which documents the canonical contract at `:39-40` correctly) and not in `synthetic-runtime-config.js` (which already provides the canonical object-map form per SCAFFOLD-REPAIR sealed at Relay `e715f5d3…`).

---

## §2 — Recommended fix strategy

Single-file edit to `src/runtime/boot.js:360-369` replacing the `Array.isArray()` check + `[]` fallback with an object-map check + `{}` fallback that matches the canonical contract documented at `channel-allowlist.js:39-40`.

**Design choices:**

1. **Restore object-map canonical contract.** `channel-allowlist.js` is authoritative; its `:39-40` comment is the contract documentation. boot.js was the divergent side; correcting boot.js (not channel-allowlist.js) preserves the channel-allowlist source AND its documented invariant.

2. **Explicit array rejection via `!Array.isArray()`.** Without this guard, an accidental array shape (e.g., `['#status']`) would pass the `typeof === 'object'` check (arrays are objects in JS) and then degrade silently to "no channels allowed" at lookup time. Explicit rejection makes the contract clear and falls back to canonical empty object-map immediately.

3. **Fallback to `{}` (canonical empty allowlist).** `Object.keys({}) === []` and `{}[anything] === undefined` — both match the empty-allowlist semantics that `channel-allowlist.js` already handles cleanly via the `expectedId === undefined` branch at `:55`.

4. **Preserve all other runtime-config field validators.** Only the `allowedChannels` lookup line changes; the surrounding factory calls (codexPass, operatorAuthorization, idempotency, ceilingPause, placeholders, limits, networkAnomaly, forbiddenContent, dryRunConsistency) are unchanged.

5. **No new dependency.** `package.json:13-15` deps (`ajv@8.20.0`, `pino@9.14.0`) unchanged; no `npm install` invoked.

6. **No schema, test, or AMENDMENT-5 polyfill touch.** Canonical schema sealed at Phase C; tests sealed at SCAFFOLD-REPAIR `e715f5d3…`; AMENDMENT-5 polyfill at `schema-validator.js:119-128` sealed at Relay `776a1f0d…`.

7. **ASCII arrow style.** Per Codex required edit, the proposed WHY comment uses ASCII `->` (not Unicode arrow U+2192) to match existing `channel-allowlist.js:39` style and avoid encoding edge cases.

---

## §3 — Exact proposed file list

| # | Path | Edit kind | Approximate delta |
|---|---|---|---|
| 1 | `src/runtime/boot.js` | EDIT — replace `Array.isArray()` check + `[]` fallback at lines 360-364 with object-map check + `{}` fallback; add 4-line WHY comment using ASCII arrow `->` | +6-7 lines / -2 lines (net +4-5) |

**Optional minimal form (operator decision at implementation time):** drop the 4-line comment block; logic-only change. **Not recommended** per CLAUDE.md "WHY is non-obvious" criterion — the WHY (canonical contract documented at `channel-allowlist.js:39-40`/`:54`; array rejection rationale; AMENDMENT-5 + AMENDMENT-6 chain context) is non-obvious to future readers.

**Net effect:** 1 file modified in Relay `src/runtime/`; ~+5 line delta. Zero `tests/smoke/` touch. Zero `schemas/*.json` touch. Zero `package.json` / `package-lock.json` touch. Zero `node_modules` byte change. Zero `channel-allowlist.js` touch. Zero `synthetic-runtime-config.js` touch. Zero `schema-validator.js` touch (AMENDMENT-5 polyfill preserved verbatim). Zero parent-repo touch. Zero env / secrets touch. Zero test execution. Zero deploy.

---

## §4 — Exact code-shape (proposed; ASCII arrow per Codex required edit)

**Current state of `src/runtime/boot.js:360-366`:**

```javascript
    channelAllowlist = createChannelAllowlistGate({
      allowedChannels:
        runtimeConfig && Array.isArray(runtimeConfig.allowedChannels)
          ? runtimeConfig.allowedChannels
          : [],
      safeLog,
    });
```

**Proposed state of `src/runtime/boot.js:360-371` (after AMENDMENT-6 implementation):**

```javascript
    channelAllowlist = createChannelAllowlistGate({
      // `allowedChannels` is an object-map (channel_name -> channel_id snowflake)
      // per `src/verify/channel-allowlist.js:39-40` + `:54` canonical contract.
      // Reject arrays explicitly so an accidental array shape falls back to
      // the canonical empty object-map rather than silently passing through.
      allowedChannels:
        runtimeConfig && runtimeConfig.allowedChannels && typeof runtimeConfig.allowedChannels === 'object' && !Array.isArray(runtimeConfig.allowedChannels)
          ? runtimeConfig.allowedChannels
          : {},
      safeLog,
    });
```

**Insertion site:** between line 360 (`channelAllowlist = createChannelAllowlistGate({`) and line 365 (`safeLog,`). The 4-line WHY comment goes inside the factory-arg object, immediately before the `allowedChannels:` property line.

**Net delta:** +6-7 lines (1 logic-shape change replacing 1 prior conditional + 4-line WHY comment + minor formatting). 0 deletions (the prior `Array.isArray()` line is REPLACED by the new conditional; not deleted in isolation — git diff will show it as deletion + addition lines, but the net intent is a single-line replacement).

**ASCII arrow correction applied:** The WHY comment uses `channel_name -> channel_id snowflake` (ASCII `->`) per Codex required edit, matching `channel-allowlist.js:39` style. No Unicode arrow U+2192 anywhere in the proposed code.

---

## §5 — Expected post-AMENDMENT-5 + AMENDMENT-6 smoke-run tally

**`13 total / 11 pass / 1 skip / 1 fail`** — per sealed SCAFFOLD-REPAIR-DESIGN §5 prediction.

Per-case change matrix:

| Case | Pre-AMENDMENT-6 (RUN-5 actual) | Post-AMENDMENT-5+6 (expected RUN-6) | Notes |
|---|---|---|---|
| 01 (boot operatorPhaseId missing) | FAIL halt 30 | **PASS** halt 20 at Stage 13 | Stage 11 now succeeds (Layer 1); Stage 13 rate-limit-state fires expected halt 20 |
| 02 (boot Phase G refs missing prod) | FAIL halt 30 | **PASS** halt 32 | Stage 11 now succeeds; production-no-phase-g-hook halt fires |
| 03 (dry-run stub clean) | FAIL halt 30 | **PASS** clean | Boot completes cleanly in dry-run stub mode |
| 04 (gate-1 schema halt 29) | FAIL halt 30 | **PASS** halt 29 | Boot reaches gate-1; `buildSchemaInvalidMessage` (missing body) triggers schema-mismatch halt |
| 05 (gate-2 channel halt 3) | FAIL halt 30 | **PASS** halt 3 | Boot reaches gate-2; `buildChannelDisallowedMessage` (`channel_name: '#summaries'`) NOT in allowlist map `{ '#status': '...' }` -> halt 3 fires correctly |
| 06 (gate-5 idempotency halt 7) | FAIL halt 30 | **PASS** halt 7 | Boot reaches gate-5; pre-populated publish-log success record triggers idempotency-collision halt |
| 07 (publish-log §14, non-boot) | PASS (unaffected) | **PASS** unchanged | Path D non-boot; no boot.js involvement |
| 08 primary (moveToProcessed, non-boot) | PASS (unaffected) | **PASS** unchanged | Path D non-boot |
| 08 sub-case (StoreError haltClass:24, non-boot) | PASS (unaffected) | **PASS** unchanged | Path D non-boot |
| 09 (safeLog REDACT_PATHS) | FAIL (separately gated) | **FAIL** unchanged | Separately gated; NOT addressed by AMENDMENT-6 |
| 10 (no network) | FAIL halt 30 | **PASS** no network | Boot completes in dry-run stub; network observer asserts zero calls |
| 11 (gate-4 staleness halt 2) | FAIL halt 30 | **PASS** halt 2 | Boot reaches gate-4; `buildStaleApprovalMessage` (25h-old `approved_at`) triggers staleness halt |
| 12 (rate-limit) | SKIP | **SKIP** unchanged | `test.skip()` + TODO at `src/verify/limits.js:83` |

**Cases that don't reach gate-2:** Cases 01, 02, 03, 10 halt earlier in the pipeline (env config / pre-message stages); they pass at their intended early stages regardless of `allowedChannels` shape. AMENDMENT-6 unblocks them because Stage 12 (gate factory construction) no longer silently coerces the allowlist to an empty array — but importantly, Stage 12 already runs before message processing, so even Cases 01-03 benefit from Stage 12 succeeding cleanly.

**Cases 04, 05, 06, 11:** require channel resolution at message-processing time. After AMENDMENT-6, `allowedChannels` is the canonical object-map `{ '#status': '123456789012345678' }`. The `buildSyntheticMessage` default sets `channel_name: '#status'` + `channel_id: '123456789012345678'` matching the allowlist; gate-2 passes for those cases, allowing them to reach gates 4, 5, etc. Case 05's `buildChannelDisallowedMessage` overrides `channel_name: '#summaries'` (not in allowlist -> halt 3 as intended).

**Alternative `13 / 12 / 1 / 0` tally** reachable ONLY if a separately-gated Case 09 fix lands before RUN-6; bundling NOT authorized.

---

## §6 — Codex review packet (Q1-Q14)

| # | Check | Pass criterion |
|---|---|---|
| Q1 | Single-file scope: only `src/runtime/boot.js` modified. | Modified-files list contains exactly `src/runtime/boot.js`; no other path. |
| Q2 | Insertion site is between current line 360 (`channelAllowlist = createChannelAllowlistGate({`) and current line 365 (`safeLog,`). | Verify the new lines bracket the existing factory call shape. |
| Q3 | Logic check is `runtimeConfig && runtimeConfig.allowedChannels && typeof runtimeConfig.allowedChannels === 'object' && !Array.isArray(runtimeConfig.allowedChannels)`. | Verify each conjunct: existence guard, property guard, type-object check, explicit array rejection. |
| Q4 | Fallback is `{}` (empty object-map). | Verify literal match. |
| Q5 | ASCII arrow `->` used in WHY comment (not Unicode arrow U+2192). | Verify byte-identity: search for any Unicode arrow in the new diff; expect zero. |
| Q6 | WHY comment block (if included) is exactly 4 lines and references `channel-allowlist.js:39-40` + `:54` canonical contract. | Code-review the comment for accuracy + completeness. |
| Q7 | Ajv constructor at `schema-validator.js:119` and AMENDMENT-5 polyfill at `:127` (`ajv.addFormat('date-time', () => true);`) preserved verbatim. | `git diff` against Relay HEAD shows zero touch of `src/verify/schema-validator.js`. |
| Q8 | No `src/verify/channel-allowlist.js` touch. | Canonical contract documentation authoritative; no edit. |
| Q9 | No `tests/smoke/*` touch. | SCAFFOLD-REPAIR + AMENDMENT-3/4 test scaffolding preserved verbatim. |
| Q10 | No `schemas/*.json` touch. | Canonical schema sealed at Phase C. |
| Q11 | No `package.json` / `package-lock.json` byte change. | No `npm install` / new dependency. |
| Q12 | Does NOT activate Relay runtime, Discord, Railway, DB, Kraken, env (real), secrets, deploy, Phase G, or trading. | Verify by inspection — single Relay source file edit only. |
| Q13 | Expected post-AMENDMENT-5+6 smoke-run TAP tally is **`13 total / 11 pass / 1 skip / 1 fail`**. | Per SCAFFOLD-REPAIR-DESIGN §5. |
| Q14 | The fix preserves AMENDMENT-5 (`schema-validator.js:119-128`); preserves SCAFFOLD-REPAIR test scaffolding sealed at Relay `e715f5d3…`; preserves Phase D DP-5 hardening at `src/store/source-of-truth.js:263-276`. | Read-only inspection of those files post-edit. |

---

## §7 — Hard non-authorization clauses

This DESIGN-ONLY Mode 2 design (now codified by this DOCS-ONLY Mode 3 SPEC), and the future SAFE IMPLEMENTATION Mode 4 phase it describes, do NOT authorize:

- Test execution (no `node --test` / `node --check` / `npm install` / `npm ci` / `npx` / `playwright` / `astro` invocation)
- Relay runtime activation; Phase G design or implementation; Stage 5 install resumption (Steps 14–21); Stages 7 / 8 / 9 / 10a / 10b
- Discord platform action (no application, bot, token mint, permission, webhook, channel, post, reaction, read)
- Railway / deploy / service config / env-var write or read against `agent-avila-relay`
- Database / Postgres / migration / SQL (Migration 008 APPLIED preserved; Migration 009+ NOT authorized)
- Kraken / any exchange API
- `.env`, `.env.*`, `.envrc`, secrets, `~/.ssh/`, `~/.aws/`, `~/.gcp/`, `~/.azure/`, `~/.config/gh/`, `~/.npmrc`, `~/.netrc`, `~/.claude/`
- `position.json`, `position.json.snap.*`, `MANUAL_LIVE_ARMED` flag, any trading code path
- `bot.js`, `dashboard.js`, `db.js`, `migrations/*`, `scripts/*`, `playwright*`
- Any network call from tests or runtime
- Autopilot activation; CEILING-PAUSE state change (history at `22ba4a76`; counter 0 of 3)
- DASH-6 / D-5.12f / D-5.12g / D-5.12h / Migration 009+
- External Hermes Agent (Nous/OpenRouter)
- Scheduler / cron / webhook / MCP install; permission widening
- Any other `src/` file in Relay (incl. `src/verify/channel-allowlist.js`, `src/verify/schema-validator.js`, `src/store/source-of-truth.js`, `src/store/publish-log.js`, `src/store/dry-run-log.js`, `src/config.js`, `src/log.js`, `src/verify/*` other gates)
- Any `schemas/*.json` byte change
- `package.json` / `package-lock.json` byte change in either repo
- `tests/smoke/*` byte change (sealed at SCAFFOLD-REPAIR `e715f5d3…` + AMENDMENT-3/4)
- `ajv-formats` import or any new dependency
- Ajv `strict` mode setting change (AMENDMENT-5 preserved strict mode; AMENDMENT-6 must too)
- **Modify AMENDMENT-5 polyfill** at `src/verify/schema-validator.js:119-128`
- **Modify Phase D DP-5 hardening** at `src/store/source-of-truth.js:263-276`
- **Case 09** (safeLog REDACT_PATHS contract drift) — separately gated audit/fix
- **Case 12** (rate-limit `channelCap.maxPerWindow` drift at `src/verify/limits.js:83`) — separately gated remediation
- **`src/runtime/boot.js:268`/`:282-285` observability fix** (`loadErr.keyword` vs `.reason` rough-edge) — separately gated
- **`F-HALT-SMOKE-RUN-6` SAFE EXECUTION** — requires both AMENDMENT-5 AND AMENDMENT-6 sealed
- Antigravity workspace config; any sealed handoff (including AMENDMENT-5-DESIGN at parent `0e9a678e…`, SCAFFOLD-REPAIR-DESIGN at parent `31ea6f5f…`, F-HALT-SMOKE-RUN-DESIGN at parent `5acac86…`, F-HALT-SMOKE-AMENDMENT-2-DESIGN at parent `c642b2b…`); sealed generator; `orchestrator/DASHBOARD.md`
- Any push to any remote
- Memory file writes under `~/.claude/`

**Approvers exactly `{Victor}`.** Codex review verdicts do not constitute operator approval.

---

## §8 — Preservation invariants (verified at codification time)

- Relay sealed at `776a1f0dfdb60ba6ad70827bcdf891099c975854`; parent at `45d91d23d4fb276734ad270de9be2c4792b1d131`
- **AMENDMENT-5 polyfill preserved verbatim** at `src/verify/schema-validator.js:119-128` (`new Ajv({ allErrors: true });` + 6-line WHY comment + `ajv.addFormat('date-time', () => true);` + `try { compiledValidate = ajv.compile(schema); } catch ...`); strict mode preserved
- Sealed AMENDMENT-5-DESIGN handoff at parent `0e9a678e9bd215826953cd8f9444eec9dbbbdd27` — untouched
- Sealed SCAFFOLD-REPAIR-DESIGN handoff at parent `31ea6f5f0f5e6409c33f4a6a8c62939eb50aee7a` — untouched
- Sealed F-HALT-SMOKE-RUN-DESIGN handoff at parent `5acac86b521b8e3783b43018d4091194316e7a61` — untouched
- Sealed F-HALT-SMOKE-AMENDMENT-2-DESIGN handoff at parent `c642b2b73276580d4c30d0c26337e335f8c24cc2` — untouched
- All 5 smoke-run evidence dirs preserved untracked (`F-HALT-SMOKE-RUN/`, `-2/`, `-3/`, `-4/`, `-5/`)
- Phase A-F Relay-repo lettered chain preserved: F baseline `b8ab035…` -> F-HALT-AMENDMENT `9fb251e…` -> F-HALT-SMOKE `abc7a71…` -> F-HALT-SMOKE-AMENDMENT `590c1c9b…` -> F-HALT-SMOKE-AMENDMENT-2 `b8de3b63…` -> F-HALT-SMOKE-AMENDMENT-3 `cc3be444…` -> F-HALT-SMOKE-AMENDMENT-4 `e2c4c247…` -> F-HALT-SMOKE-SCAFFOLD-REPAIR `e715f5d3…` -> F-HALT-SMOKE-AMENDMENT-5 `776a1f0d…` (current)
- Migration 008 APPLIED at `189eb1be…`; N-3 CLOSED; Stage 5 Gate-10 install approval at `40f3137e…` CONSUMED
- Autopilot DORMANT (verified at `eff4dd22…`); Relay DORMANT; CEILING-PAUSE broken at `22ba4a76` (counter 0 of 3)
- Phase D DP-5 hardening at `src/store/source-of-truth.js:263-276` preserved (sealed); AMENDMENT-3 `await tempTree.sealPending();` calls preserved in 8 boot-path tests; AMENDMENT-4 publish-log + dry-run-log writeFile calls preserved; SCAFFOLD-REPAIR Path D non-boot rewrites of Cases 07/08 preserved; SCAFFOLD-REPAIR `tests/smoke/helpers/synthetic-message.js` schema-valid default preserved; SCAFFOLD-REPAIR `tests/smoke/helpers/synthetic-runtime-config.js` `schemaPath` via `fileURLToPath(...)` + `allowedChannels` object-map preserved
- `package.json` (`ajv@8.20.0`, `pino@9.14.0`) + `package-lock.json` byte-identical from Phase B
- Live write paths (OPEN_LONG / BUY_MARKET, CLOSE_POSITION, SELL_ALL) DB-first; unaffected by this phase
- `position.json.snap.20260502T020154Z` carve-out preserved untracked
- Railway service display name `agent-avila-relay`; `DISCORD_BOT_TOKEN` empty-shell preserved (NOT touched)

---

## §9 — Review history

### §9.1 — Claude RUN-5-FAILURE-AUDIT (Mode 1 / READ-ONLY AUDIT)

**Verdict:** Layer 1 + Layer 2 identified with file:line citations.

- Layer 1: Ajv strict-mode rejects `format: "date-time"` (3 occurrences in schema) because `ajv-formats` is forbidden per Phase B lockfile policy at `schema-validator.js:28`. Resolved by AMENDMENT-5 (sealed at Relay `776a1f0d…`).
- Layer 2: `allowedChannels` value-type contract mismatch between `boot.js:362` (Array.isArray) and `channel-allowlist.js:54` (object-map lookup). Addressed by AMENDMENT-6 (this design).

### §9.2 — Gemini architecture review

**Verdict:** endorsed split Layer 1 / Layer 2 approach. Recommended local addFormat polyfill for L1 (applied via AMENDMENT-5) and object-map standardization for L2 (applied via this AMENDMENT-6). Risk note: `boot.js` silent fallback to `[]` is fragile and should be addressed in AMENDMENT-6 (the present design).

### §9.3 — Codex RUN-5-FAILURE-AUDIT review (Mode 1)

**Verdict:** PASS across 12 review questions with all file:line citations CONFIRMED.

### §9.4 — Codex AMENDMENT-5-DESIGN review (Mode 2) — Layer 1

**Verdict:** PASS across 12 questions; recommended DESIGN-SPEC codification before Mode 4 implementation.

### §9.5 — Codex AMENDMENT-5 SAFE IMPLEMENTATION review (Mode 4)

**Verdict:** PASS across 16 questions; AMENDMENT-5 implementation verified verbatim against design; sealed at Relay `776a1f0d…`.

### §9.6 — Codex AMENDMENT-6-DESIGN review (Mode 2) — Layer 2

**Verdict:** PASS WITH REQUIRED EDITS — substantive Layer 2 design approved across 14 questions; one cosmetic correction required:

> "In the proposed WHY comment for `/Users/victormercado/code/agent-avila-relay/src/runtime/boot.js:360-366`: replace `channel_name <U+2192> channel_id snowflake` (Unicode arrow glyph) with `channel_name -> channel_id snowflake` (ASCII arrow)."

Codex grounded the ASCII-arrow preference at `channel-allowlist.js:39` (existing file style uses ASCII `->`). **This required edit is applied verbatim in §4 above**: the WHY comment uses `channel_name -> channel_id snowflake` (ASCII `->`).

Codex also recommended DESIGN-SPEC codification before SAFE IMPLEMENTATION, consistent with AMENDMENT-5 + SCAFFOLD-REPAIR precedent: this DOCS-ONLY (Mode 3) phase fulfills that recommendation.

### §9.7 — Outstanding items at codification time

- **Pre-edit ASCII-arrow re-check at SAFE IMPLEMENTATION time:** before applying the Mode 4 edit, re-confirm that the WHY comment in this DESIGN-SPEC handoff contains only ASCII `->` (no Unicode arrow U+2192). Single read-only `grep -P '[\\x{2190}-\\x{2192}]' src/runtime/boot.js` style check at implementation time (against the DESIGN-SPEC handoff before transcribing into source). Abort and escalate if any Unicode arrow is present.
- **Codex SAFE IMPLEMENTATION on-disk source review** of the actual diff is required before commit, per established phase discipline.

---

## §10 — Phase output of this codification phase

This is a DOCS-ONLY (Mode 3) operator-directed codification phase. Scope: 4 files in the parent repo only — 1 new SAFE-class handoff record (this file) + 3 status-doc updates (`orchestrator/STATUS.md`, `orchestrator/CHECKLIST.md`, `orchestrator/NEXT-ACTION.md`). No Relay-repo touch. No source edit. No test execution. No commit by this codification turn itself; commit decision deferred to operator. No push.

**This phase does NOT and MUST NOT:**

- Run any smoke test; invoke `node --test`, `node --check`, `npm install`, `npm ci`, `npx`, `astro *`, or `playwright`
- Edit any Relay-repo file (sealed at `776a1f0dfdb60ba6ad70827bcdf891099c975854`)
- Edit `src/`, `tests/`, `migrations/`, `scripts/`, `bot.js`, `dashboard.js`, `db.js`, `playwright.config.js`
- Edit `package.json` / `package-lock.json` (parent root or `web/`)
- Edit `schemas/*.json`
- Touch `.env`, secrets, `~/.claude/`, `~/.ssh/`, `position.json*`, `MANUAL_LIVE_ARMED`, any trading code path
- Open the future `COMM-HUB-RELAY-RUNTIME-IMPLEMENT-F-HALT-SMOKE-AMENDMENT-6` SAFE IMPLEMENTATION phase
- Open the future `F-HALT-SMOKE-RUN-6` SAFE EXECUTION phase
- Open Phase G design or implementation; resume Stage 5 Steps 14–21 or Stages 7 / 8 / 9 / 10a / 10b
- Open DASH-6 / D-5.12f / D-5.12g / D-5.12h / Migration 009+
- Touch external Hermes Agent (Nous/OpenRouter), Discord, Railway, DB, Kraken, env, secrets, deploy, runtime activation, trading
- Install scheduler / cron / webhook / MCP; widen permissions; perform any network lookup
- Modify any sealed governance doc, sealed handoff record, generator, dashboard snapshot, or `web/` file
- Touch `position.json.snap.20260502T020154Z` (carve-out preserved untracked)
- Touch `orchestrator/handoffs/evidence/F-HALT-SMOKE-RUN/`, `-2/`, `-3/`, `-4/`, `-5/` (5 evidence dirs preserved untracked)
- Advance the autopilot phase-loop counter; modify CEILING-PAUSE state
- Bundle a Case 09 fix; bundle a Case 12 fix; bundle a `boot.js:268`/`:282-285` observability fix
- Modify AMENDMENT-5 polyfill at `src/verify/schema-validator.js:119-128`

The next step is operator decision on commit, then Codex DOCS-ONLY review of this codification, then a separately-approved push. A future `COMM-HUB-RELAY-RUNTIME-IMPLEMENT-F-HALT-SMOKE-AMENDMENT-6-DESIGN-SPEC-CLOSEOUT-SYNC` may record this DESIGN-SPEC as CLOSED at the post-commit parent-repo HEAD (per Rule 1 — one CLOSEOUT and optional one CLOSEOUT-SYNC max; no recursive paperwork beyond that). After the codification commits + pushes (separately approved), the operator may open the Mode 4 SAFE IMPLEMENTATION phase to apply the single-file edit per §3 to the Relay repo at `src/runtime/boot.js:360-369`.
