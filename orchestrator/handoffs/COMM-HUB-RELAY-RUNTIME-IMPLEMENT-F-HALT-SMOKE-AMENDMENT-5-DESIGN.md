# COMM-HUB-RELAY-RUNTIME-IMPLEMENT-F-HALT-SMOKE-AMENDMENT-5-DESIGN

**This handoff codifies the Codex-approved conversation-only `COMM-HUB-RELAY-RUNTIME-IMPLEMENT-F-HALT-SMOKE-AMENDMENT-5-DESIGN` (Mode 2 / DESIGN-ONLY, no commit). This codification phase is `COMM-HUB-RELAY-RUNTIME-IMPLEMENT-F-HALT-SMOKE-AMENDMENT-5-DESIGN-SPEC` (DOCS-ONLY / Mode 3). The future implementation phase `COMM-HUB-RELAY-RUNTIME-IMPLEMENT-F-HALT-SMOKE-AMENDMENT-5` is SAFE IMPLEMENTATION (Mode 4) — separately gated; not authorized by this codification.**

**Codification provenance:** RUN-5 SAFE EXECUTION (Mode 4) at Relay `e715f5d33d28bdd398c322cbc63e0691a5f2b76f` produced a hard FAIL with 9 boot-path test failures (`13 / 3 / 1 / 9` vs expected `13 / 11 / 1 / 1`). System gates all passed: Relay HEAD unchanged; Relay porcelain clean; byte-identity diff empty; no untracked artifacts; evidence captured at `orchestrator/handoffs/evidence/F-HALT-SMOKE-RUN-5/`. All 8 boot-path tests halted at class 30 (`schema-unverifiable`) at Stage 11 of `src/runtime/boot.js`; the 3 non-boot Path D tests (Case 07 publishLog.append; Case 08 primary moveToProcessed; Case 08 sub-case StoreError haltClass 24) PASSED. A Claude RUN-5-FAILURE-AUDIT (Mode 1 / READ-ONLY AUDIT) read-only inspected `src/verify/schema-validator.js`, `src/runtime/boot.js`, `src/verify/channel-allowlist.js`, `schemas/hermes-message.schema.json`, and `package.json` and identified two layers of failure: **Layer 1 — Ajv strict-mode rejects the canonical schema because it declares `format: "date-time"` at three locations while `ajv-formats` is explicitly forbidden by Phase B lockfile policy; the resulting `compile-failed` throw fires halt class 30 before any later stage can fire its intended halt; the prior SCAFFOLD-REPAIR `schemaPath` fix was a misdiagnosis since the schema file was always findable and the actual failure was at `ajv.compile`. Layer 2 — `allowedChannels` value-type contract mismatch between `src/runtime/boot.js:362` (expects Array; falls back to `[]` if not) and `src/verify/channel-allowlist.js:54` (does `allowedChannels[message.channel_name]` expecting object map); once Layer 1 is fixed, Layer 2 will surface as halt 3 (gate-2 channel not in allow-list) for boot-path tests requiring channel lookup.** A Gemini architecture review endorsed the local `addFormat` polyfill approach with strict mode preserved and explicitly rejected both `ajv-formats` and global `strict: false`, while recommending Layer 1 and Layer 2 be addressed in two separate AMENDMENT phases. A Codex RUN-5-FAILURE-AUDIT review (Mode 1) returned PASS across 12 review questions with all file:line citations CONFIRMED, including Codex's own read-only scan that confirmed only three `format` keywords exist in `schemas/*.json` and all are `date-time`. A Codex AMENDMENT-5-DESIGN review (Mode 2) returned PASS across 12 review questions with file:line grounding, and explicitly recommended (Q11) that this DESIGN-SPEC handoff codification phase precede any Mode 4 implementation edit, in order to pin the implementation scope to `src/verify/schema-validator.js:119-121` as immutable evidence before any source change. This handoff is the on-disk codification of that accepted result. **This file does NOT itself constitute an execution authorization. Codex review verdicts are not operator approval.** Approvers exactly `{Victor}`.

---

## §0 — Phase classification & current anchors

| Property | Value |
|---|---|
| Phase name (this codification phase) | `COMM-HUB-RELAY-RUNTIME-IMPLEMENT-F-HALT-SMOKE-AMENDMENT-5-DESIGN-SPEC` |
| Phase mode (this codification phase) | Mode 3 / DOCS-ONLY |
| Original phase name (the codified design) | `COMM-HUB-RELAY-RUNTIME-IMPLEMENT-F-HALT-SMOKE-AMENDMENT-5-DESIGN` |
| Original phase mode | Mode 2 / DESIGN-ONLY (conversation-only; no commit) |
| Parent-repo HEAD anchor | `c250f0c50d6b4ea22314f1b767003dd6da0cb283` (SCAFFOLD-REPAIR-CLOSEOUT-SYNC sealed; terminal back-fill of SCAFFOLD-REPAIR chain) |
| Relay-repo HEAD anchor | `e715f5d33d28bdd398c322cbc63e0691a5f2b76f` (SCAFFOLD-REPAIR SAFE IMPLEMENTATION sealed) |
| Pre-DESIGN-SPEC parent anchor | `c250f0c50d6b4ea22314f1b767003dd6da0cb283` (SCAFFOLD-REPAIR-CLOSEOUT-SYNC sealed) |
| Sealed F-HALT-SMOKE-RUN-DESIGN handoff | parent `5acac86b521b8e3783b43018d4091194316e7a61` (untouched) |
| Sealed F-HALT-SMOKE-AMENDMENT-2-DESIGN handoff | parent `c642b2b73276580d4c30d0c26337e335f8c24cc2` (untouched) |
| Sealed F-HALT-SMOKE-SCAFFOLD-REPAIR-DESIGN handoff | parent `31ea6f5f0f5e6409c33f4a6a8c62939eb50aee7a` (untouched) |
| Future implementation phase (gated, NOT authorized) | `COMM-HUB-RELAY-RUNTIME-IMPLEMENT-F-HALT-SMOKE-AMENDMENT-5` (SAFE IMPLEMENTATION / Mode 4) |
| Future Layer 2 design phase (gated, NOT authorized) | `COMM-HUB-RELAY-RUNTIME-IMPLEMENT-F-HALT-SMOKE-AMENDMENT-6-DESIGN` (Mode 2 / DESIGN-ONLY) — `allowedChannels` type-contract resolution |
| Future re-execution phase (gated, NOT authorized) | `COMM-HUB-RELAY-RUNTIME-IMPLEMENT-F-HALT-SMOKE-RUN-6` (Mode 4 SAFE EXECUTION; expected post-AMENDMENT-5+AMENDMENT-6 tally `13/11/1/1`) |
| Parent repo working tree at codification time | clean except `position.json.snap.20260502T020154Z` + `orchestrator/handoffs/evidence/F-HALT-SMOKE-RUN/`, `-2/`, `-3/`, `-4/`, `-5/` (6 authorized untracked carve-outs) |
| Relay repo working tree at codification time | clean |
| Relay-runtime status | DORMANT preserved |
| Autopilot status | DORMANT preserved (verified at `eff4dd22…`) |
| Approvers | exactly `{Victor}` |

---

## §1 — Problem framing (Layer 1 root cause)

**RUN-5 outcome:** `13 total / 3 pass / 1 skip / 9 fail` (expected `13 / 11 / 1 / 1` per sealed SCAFFOLD-REPAIR-DESIGN §5).

**Failure pattern:** all 8 boot-path tests (Cases 01-06, 10, 11) halt at class 30 (`schema-unverifiable`) at Stage 11 of `src/runtime/boot.js`. All 3 non-boot Path D tests (Case 07, Case 08 primary, Case 08 sub-case) PASS — these don't invoke `boot()`. Case 09 (separately gated; expected fail). Case 12 (`test.skip()`).

**Verified file:line citations (Codex-confirmed in RUN-5-FAILURE-AUDIT review):**

| Location | Content |
|---|---|
| `src/verify/schema-validator.js:39` | `import Ajv from 'ajv';` (no `ajv-formats` import) |
| `src/verify/schema-validator.js:28` (comment) | "No new dependency (ajv@8.20.0 from Phase B lockfile; ajv-formats forbidden)" |
| `src/verify/schema-validator.js:119` | `const ajv = new Ajv({ allErrors: true });` (default strict mode) |
| `src/verify/schema-validator.js:120-121` | `try { compiledValidate = ajv.compile(schema); }` |
| `src/verify/schema-validator.js:122-128` | catch → throws `ValidatorError({ haltClass: HALT_CLASS.SCHEMA_FILE_UNVERIFIABLE, path: schemaPath, reason: 'compile-failed: ${err.message}' })` |
| `src/verify/schema-validator.js:49` | `SCHEMA_FILE_UNVERIFIABLE: 30` (HALT_CLASS enum) |
| `src/runtime/boot.js:307-340` | Stage 11 — calls `createSchemaValidator({schemaPath, safeLog})` then `await schemaValidator.ensureSchemaLoaded()`; halt class extracted from caught error; reason logged via fallback `'schema-unverifiable'` when `loadErr.keyword` is not a string (ValidatorError uses `.reason` not `.keyword` — observability rough-edge separately gated) |
| `schemas/hermes-message.schema.json:46` | `"format": "date-time"` on `codex_pass_verdict_ref.reviewed_at` |
| `schemas/hermes-message.schema.json:58` | `"format": "date-time"` on `operator_authorization.oneOf[0].approved_at` |
| `schemas/hermes-message.schema.json:92` | `"format": "date-time"` on `operator_authorization.oneOf[1].bounds.expiration` |
| `package.json:13-15` | `"dependencies": { "ajv": "8.20.0", "pino": "9.14.0" }` (no `ajv-formats`) |

**Claude diagnostic ajv.compile invocation (read-only Mode 1) — verbatim result with on-disk Ajv 8.20.0 and on-disk schema:**

```
schema parsed OK; $schema: http://json-schema.org/draft-07/schema#
Ajv version: 8.20.0
--- Try default config (strict: true implicit) ---
compile FAILED: unknown format "date-time" ignored in schema at path "#/properties/codex_pass_verdict_ref/properties/reviewed_at"
--- Try strict: false ---
unknown format "date-time" ignored in schema at path "#/properties/codex_pass_verdict_ref/properties/reviewed_at"
(... 5 more warnings ...)
compile OK with strict:false
```

**Concrete failure path:**

1. Test calls `boot({ ..., runtimeConfig: syntheticRuntimeConfig() })`
2. `boot.js:310-313` reads `runtimeConfig.schemaPath` → uses SCAFFOLD-REPAIR-added absolute path
3. `boot.js:316` calls `createSchemaValidator({schemaPath, safeLog})`
4. `boot.js:329` calls `await schemaValidator.ensureSchemaLoaded()`
5. `schema-validator.js:91-117` reads schema file (succeeds) + JSON.parse (succeeds) + draft-07 check (passes)
6. `schema-validator.js:119` constructs Ajv with default strict mode
7. `schema-validator.js:121` calls `ajv.compile(schema)` → throws `unknown format "date-time" ignored in schema at path …`
8. `schema-validator.js:122-128` wraps in `ValidatorError({ haltClass: 30, reason: 'compile-failed: …' })`
9. `boot.js:335-340` emits halt 30 via safeLog with fallback tag `'schema-unverifiable'` (the `.reason` field is lost in logging due to the separately-gated `loadErr.keyword` vs `.reason` observability rough-edge)

**Prior SCAFFOLD-REPAIR misdiagnosis acknowledgement:** SCAFFOLD-REPAIR added `schemaPath: fileURLToPath(new URL('../../../schemas/hermes-message.schema.json', import.meta.url))` to `tests/smoke/helpers/synthetic-runtime-config.js`. The schema file was always findable from Relay cwd via the boot.js fallback at line 313 (`'schemas/hermes-message.schema.json'`); the actual failure was at `ajv.compile`. The schemaPath addition is harmless but did not address the root cause. The Path D non-boot rewrites of Cases 07/08 do pass — they don't invoke schema validation. AMENDMENT-5 corrects this misdiagnosis by addressing the actual `ajv.compile` failure.

---

## §2 — Recommended fix strategy (Codex-approved, Gemini-endorsed)

**Single-line `ajv.addFormat('date-time', () => true);` polyfill** inserted between Ajv construction (current line 119) and the `try { compiledValidate = ajv.compile(schema); }` block (current line 120-121).

**Design choices:**

1. **Preserve Ajv strict mode.** Strict mode provides multiple safety properties beyond format validation: rejects schemas with unknown keywords (catches typos like `requried`); rejects overlapping keywords; rejects non-standard JSON Schema features; forces explicit `$schema` declaration. Disabling strict mode would silently allow schema bugs to compile.

2. **Reject `strict: false`.** `new Ajv({ allErrors: true, strict: false })` would broaden the change beyond the observed `date-time` format issue: also disables unknown-keyword detection, strict-types, strict-tuples, strict-required defenses. Broader-than-necessary; loses all strict-mode safety.

3. **Reject `ajv-formats` and any new dependency.** `src/verify/schema-validator.js:28` (verbatim): "No new dependency (ajv@8.20.0 from Phase B lockfile; ajv-formats forbidden)". The Phase B lockfile policy is a HARD CONSTRAINT carried forward; violating it would require a separate Phase B amendment, which is out of AMENDMENT-5 scope.

4. **Reject schema edit.** `schemas/hermes-message.schema.json` is sealed canonical at Phase C. The `format: date-time` declarations are correct per the canonical schema's design intent (timestamp string validation in the operator-authorization and codex_pass_verdict_ref data shapes).

5. **Use explanatory comment block.** Per CLAUDE.md "Only add one when the WHY is non-obvious" criterion, the WHY here (Phase B lockfile forbids ajv-formats; strict mode + format=date-time without polyfill = halt 30; future-format invariant) is non-obvious to future readers. The comment provides governance context.

**Coverage:** the single `date-time` polyfill is sufficient for the current sealed schema. Codex's own read-only scan during the RUN-5-FAILURE-AUDIT review confirmed that `schemas/*.json` contains exactly 3 `format` keywords, all `date-time`. No other formats (email, uri, uuid, ipv4, hostname, regex, etc.) are present. The Gemini risk note about "future schema formats" remains forward-looking only — not a current concern. Future schema work that introduces additional formats must be accompanied by its own `addFormat` registration in the same explicit pattern; this is a documented invariant for future contributors.

---

## §3 — Exact proposed file list

| # | Path | Edit kind | Approximate delta |
|---|---|---|---|
| 1 | `src/verify/schema-validator.js` | EDIT — insert `ajv.addFormat('date-time', () => true);` + 6-line explanatory comment block between current line 119 (Ajv construction) and current line 120 (`try {` block) | +7 lines (1 logic + 6 comment) |

**Optional minimal form (operator decision at implementation time):** +1 logic line only (no comment block). **Recommended:** keep comment block — workaround has non-obvious governance context.

**Net effect:** 1 file modified in `src/verify/`; ~+7 line delta. Zero `tests/smoke/` touch. Zero `schemas/*.json` touch. Zero `package.json` / `package-lock.json` touch. Zero `node_modules` byte change. Zero `boot.js` touch. Zero `channel-allowlist.js` touch. Zero parent-repo touch. Zero env / secrets touch. Zero test execution. Zero deploy.

---

## §4 — Exact code-shape (proposed; not yet edited)

**Current state of `src/verify/schema-validator.js:119-128`:**

```javascript
    const ajv = new Ajv({ allErrors: true });
    try {
      compiledValidate = ajv.compile(schema);
    } catch (err) {
      throw new ValidatorError({
        haltClass: HALT_CLASS.SCHEMA_FILE_UNVERIFIABLE,
        path: schemaPath,
        reason: `compile-failed: ${err.message || 'unknown'}`,
      });
    }
```

**Proposed state of `src/verify/schema-validator.js:119-135` (after AMENDMENT-5 implementation):**

```javascript
    const ajv = new Ajv({ allErrors: true });
    // Register `date-time` as a permissive no-op format. Ajv 8.x does not ship
    // format validators (ajv-formats is forbidden per Phase B lockfile policy
    // at line 28 above). Without this registration, strict mode rejects the
    // canonical schema's `format: "date-time"` declarations at compile time
    // with halt class 30 (SCHEMA_FILE_UNVERIFIABLE). Strict mode is preserved
    // for all other validation safety checks (unknown keywords, etc.).
    ajv.addFormat('date-time', () => true);
    try {
      compiledValidate = ajv.compile(schema);
    } catch (err) {
      throw new ValidatorError({
        haltClass: HALT_CLASS.SCHEMA_FILE_UNVERIFIABLE,
        path: schemaPath,
        reason: `compile-failed: ${err.message || 'unknown'}`,
      });
    }
```

**Insertion point:** between current line 119 (Ajv construction) and current line 120 (`try {` block). The new `ajv.addFormat(...)` line + its 6-line comment block goes immediately after line 119. The `try`-block at lines 120-128 is unchanged. Net delta: +7 lines (1 logic + 6 comment).

**Alternate minimal form (operator decision):** drop the comment block; +1 logic line only. Not recommended — loses the non-obvious WHY context for future readers.

---

## §5 — Expected post-implementation smoke-run tally

**AMENDMENT-5 implementation ALONE is NOT expected to produce `13 / 11 / 1 / 1`.**

The Layer 1 fix unblocks Stage 11 (`schemaValidator.ensureSchemaLoaded`) to succeed. Boot can then proceed to Stage 12 (Phase E gate factories). At Stage 12, `src/runtime/boot.js:362` reads `runtimeConfig.allowedChannels` and applies `Array.isArray()` check — but SCAFFOLD-REPAIR set `allowedChannels` to an object map `{ '#status': '123456789012345678' }` (matching `channel-allowlist.js:54` contract). Since `Array.isArray({}) === false`, boot.js falls back to empty array `[]`. The channel-allowlist gate then performs `[]['<channel_name>']` which is `undefined` for every message → gate-2 halt 3 fires for every boot-path test that runs message processing.

**Predicted RUN-6-prematureтальly tally (if AMENDMENT-5 is run before AMENDMENT-6):**

- Cases 01, 02, 03, 10 (tests that halt before reaching gate-2): outcomes depend on test scenarios — some may continue to fail with different halts, some may pass
- Cases 04, 05, 06, 11 (tests requiring channel_name → channel_id resolution): likely halt 3 instead of intended halt class
- Cases 07, 08 (non-boot): continue to PASS
- Case 09: continue to FAIL (separately gated)
- Case 12: continue to SKIP

This prediction is uncertain because boot.js's empty-array fallback affects every gate-2 lookup, but the precise halt-vs-pass distribution depends on which tests reach gate-2 and which halt earlier on operatorPhaseId-missing or schema-mismatch.

**The expected `13 / 11 / 1 / 1` tally is only reachable after BOTH AMENDMENT-5 (Layer 1) AND AMENDMENT-6 (Layer 2) are sealed.** Therefore:

- Future `F-HALT-SMOKE-RUN-6` (Mode 4 SAFE EXECUTION) is **NOT authorized** by AMENDMENT-5 alone.
- The recommended sequence is: AMENDMENT-5 SAFE IMPLEMENTATION → AMENDMENT-5 CLOSEOUT (+ optional CLOSEOUT-SYNC) → AMENDMENT-6-DESIGN → AMENDMENT-6-DESIGN-SPEC (if SCAFFOLD-REPAIR precedent maintained) → AMENDMENT-6 SAFE IMPLEMENTATION → AMENDMENT-6 CLOSEOUT (+ optional CLOSEOUT-SYNC) → THEN F-HALT-SMOKE-RUN-6.

Alternative tally `13 / 12 / 1 / 0` reachable ONLY if a separately-gated Case 09 fix lands before the next smoke-run; bundling NOT authorized.

---

## §6 — Codex review packet (Q1-Q14)

| # | Check | Pass criterion |
|---|---|---|
| Q1 | The fix is single-file `src/verify/schema-validator.js` only. | Modified-files list contains exactly `src/verify/schema-validator.js`; no other path under `src/`, `schemas/`, `tests/`, `package*.json`, `node_modules/`, parent-repo. |
| Q2 | Insertion point is after Ajv construction (`:119`) and before `ajv.compile(schema)` (`:121`), inside the `ensureSchemaLoaded` function body. | Verify the new line is bracketed by the existing `const ajv = new Ajv(...)` declaration and the existing `try { compiledValidate = ajv.compile(schema); }` block. No other location. |
| Q3 | Inserted statement is exactly `ajv.addFormat('date-time', () => true);`. | Verify literal match: single addFormat call; first arg is string literal `'date-time'`; second arg is arrow function returning `true` (no-op pass-through). |
| Q4 | Ajv constructor invocation is unchanged. | Verify line 119 remains `const ajv = new Ajv({ allErrors: true });` — no `strict: false`, no `formats: {...}`, no other config change. |
| Q5 | No `ajv-formats` import added. | Verify the import block at line 38-39 remains `import { readFile } from 'node:fs/promises'; import Ajv from 'ajv';` — no third import. |
| Q6 | No `package.json` / `package-lock.json` byte change. | `git diff` against Relay HEAD shows zero touch of either file. |
| Q7 | No `schemas/*.json` byte change. | Canonical schema preserved verbatim. |
| Q8 | No `boot.js` or `channel-allowlist.js` or other `src/` file touch. | Layer 2 deferred; observability fix deferred. |
| Q9 | No `tests/smoke/*` touch. | Test scaffolding preserved verbatim from SCAFFOLD-REPAIR seal. |
| Q10 | No parent-repo file touch in the SAFE IMPLEMENTATION phase. | Parent-repo CLOSEOUT phase is separate; SAFE IMPLEMENTATION is Relay-only. |
| Q11 | Comment block (if included) accurately states the WHY: Phase B lockfile forbids ajv-formats; strict mode + unknown format = halt 30; strict mode preserved for other defenses. | Code-review the comment for accuracy + completeness. |
| Q12 | Pre-edit discovery scan re-confirms `schemas/*.json` contains exactly 3 `format` keywords, all `date-time`. | Re-run `grep -rn '"format"' /Users/victormercado/code/agent-avila-relay/schemas/` before edit; verify only the 3 known matches. |
| Q13 | No `node --test` / `node --check` / `npm install` / `npm ci` / `npx` invocation by the SAFE IMPLEMENTATION phase. | RUN-6 is separately gated. |
| Q14 | Does NOT activate Relay runtime, Discord, Railway, DB, Kraken, env (real), secrets, deploy, Phase G, or trading. | Verify by inspection — single source file edit only. |

---

## §7 — Hard non-authorization clauses

This DESIGN-ONLY Mode 2 design (now codified by this DOCS-ONLY Mode 3 SPEC), and the future SAFE IMPLEMENTATION Mode 4 phase it describes, do NOT authorize:

- Test execution (no `node --test` / `node --check` / `npm install` / `npm ci` / `npx` / `playwright` / `astro` invocation; running the smoke tests is a separate SAFE EXECUTION phase against the amended source — AND only after AMENDMENT-6 also lands)
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
- Any other `src/` file in Relay (incl. `src/runtime/boot.js`, `src/verify/channel-allowlist.js`, `src/store/source-of-truth.js`, `src/store/publish-log.js`, `src/store/dry-run-log.js`, `src/config.js`, `src/log.js`)
- Any `schemas/*.json` byte change (canonical schema sealed)
- `package.json` / `package-lock.json` byte change in either repo
- `tests/smoke/*` byte change (test scaffolding sealed at SCAFFOLD-REPAIR `e715f5d3…`)
- `ajv-formats` import or any new dependency
- Ajv `strict` mode setting change (preserve default `strict: true`)
- **Layer 2 (`allowedChannels` Array.isArray vs object-map contract mismatch)** — separately gated as AMENDMENT-6-DESIGN
- **Case 09 (safeLog REDACT_PATHS contract drift)** — separately gated audit/fix
- **Case 12 (rate-limit `channelCap.maxPerWindow` drift at `src/verify/limits.js:83`)** — separately gated remediation
- **`src/runtime/boot.js:268`/`:282-285` observability fix** (`loadErr.keyword` vs `.reason` rough-edge) — separately gated
- **`F-HALT-SMOKE-RUN-6` SAFE EXECUTION** — requires both AMENDMENT-5 AND AMENDMENT-6 sealed first
- Antigravity workspace config; any sealed handoff (including F-HALT-SMOKE-RUN-DESIGN at parent `5acac86…`, F-HALT-SMOKE-AMENDMENT-2-DESIGN at parent `c642b2b…`, SCAFFOLD-REPAIR-DESIGN at parent `31ea6f5f…`); sealed generator; `orchestrator/DASHBOARD.md`
- Any push to any remote
- Memory file writes under `~/.claude/`
- The alternative `13/12/1/0` smoke-run tally outcome (reachable only with a separately-gated Case 09 fix)

**Approvers exactly `{Victor}`.** Codex review verdicts do not constitute operator approval.

---

## §8 — Preservation invariants (verified at codification time)

- Relay sealed at `e715f5d33d28bdd398c322cbc63e0691a5f2b76f`; parent at `c250f0c50d6b4ea22314f1b767003dd6da0cb283`
- Sealed F-HALT-SMOKE-RUN-DESIGN handoff at parent `5acac86b521b8e3783b43018d4091194316e7a61` — untouched
- Sealed F-HALT-SMOKE-AMENDMENT-2-DESIGN handoff at parent `c642b2b73276580d4c30d0c26337e335f8c24cc2` — untouched
- Sealed F-HALT-SMOKE-SCAFFOLD-REPAIR-DESIGN handoff at parent `31ea6f5f0f5e6409c33f4a6a8c62939eb50aee7a` — untouched
- All 5 smoke-run evidence dirs preserved untracked: `F-HALT-SMOKE-RUN/` (RUN-1 halt 21), `F-HALT-SMOKE-RUN-2/` (RUN-2 halt 27), `F-HALT-SMOKE-RUN-3/` (RUN-3 halt 25), `F-HALT-SMOKE-RUN-4/` (RUN-4 halt 30), `F-HALT-SMOKE-RUN-5/` (RUN-5 halt 30 × 8 boot-path)
- Phase A-F Relay-repo lettered chain preserved: Phase F baseline `b8ab035…` → F-HALT-AMENDMENT `9fb251e…` → F-HALT-SMOKE `abc7a71…` → F-HALT-SMOKE-AMENDMENT `590c1c9b…` → F-HALT-SMOKE-AMENDMENT-2 `b8de3b63…` → F-HALT-SMOKE-AMENDMENT-3 `cc3be444…` → F-HALT-SMOKE-AMENDMENT-4 `e2c4c247…` → F-HALT-SMOKE-SCAFFOLD-REPAIR `e715f5d3…` (current)
- Migration 008 APPLIED at `189eb1be…`; N-3 CLOSED; Stage 5 Gate-10 install approval at `40f3137e…` CONSUMED
- Autopilot DORMANT (verified at `eff4dd22…`); Relay DORMANT; CEILING-PAUSE broken at `22ba4a76` (counter 0 of 3)
- Live write paths (OPEN_LONG / BUY_MARKET, CLOSE_POSITION, SELL_ALL) DB-first; unaffected by this phase
- `position.json.snap.20260502T020154Z` carve-out preserved untracked
- Railway service display name `agent-avila-relay`; `DISCORD_BOT_TOKEN` empty-shell preserved (NOT touched)
- Phase D DP-5 hardening at `src/store/source-of-truth.js:263-276` preserved (sealed)
- AMENDMENT-3 `await tempTree.sealPending();` calls preserved in 8 boot-path tests
- AMENDMENT-4 publish-log + dry-run-log writeFile calls preserved in `temp-tree.js`
- SCAFFOLD-REPAIR Path D non-boot rewrites of Cases 07/08 preserved
- Path D `tests/smoke/helpers/synthetic-message.js` schema-valid default + 3 variants preserved
- Path D `tests/smoke/helpers/synthetic-runtime-config.js` `schemaPath` via `fileURLToPath(...)` + `allowedChannels` object map preserved (note: object map shape is the Layer 2 issue; not addressed by AMENDMENT-5)

---

## §9 — Review history

### §9.1 — Claude RUN-5-FAILURE-AUDIT (Mode 1 / READ-ONLY AUDIT)

**Verdict:** Layer 1 + Layer 2 identified with file:line citations.

**Layer 1 (immediate cause):** Ajv strict-mode rejects schema because `format: "date-time"` is used but `ajv-formats` is not installed and explicitly forbidden. Verified by read-only diagnostic ajv.compile invocation against on-disk Ajv 8.20.0 + on-disk schema.

**Layer 2 (latent — exposes after Layer 1 fix):** `allowedChannels` value-type contract mismatch between `boot.js:362` (Array.isArray) and `channel-allowlist.js:54` (object-map lookup). After Layer 1 is fixed, Layer 2 will likely surface as halt 3 for boot-path tests.

### §9.2 — Gemini architecture review

**Verdict:** PASS with recommendations.

- Endorsed local `ajv.addFormat('date-time', () => true);` polyfill approach
- Preserve Ajv strict mode
- Reject `ajv-formats` and global `strict: false`
- Strictly split L1 and L2 into separate AMENDMENT phases
- Standardize Layer 2 later on object map (channel_name → channel_id)
- Risk notes: future schema formats (email, uri, uuid, ipv4) could trigger halt 30 again; boot.js silent fallback to `[]` is fragile and should be addressed in AMENDMENT-6

### §9.3 — Codex RUN-5-FAILURE-AUDIT review (Mode 1)

**Verdict:** PASS across 12 review questions.

All file:line citations from Claude audit CONFIRMED. Codex's own read-only scan confirmed only 3 `format` keywords in `schemas/*.json`, all `date-time` at lines 46, 58, 92. The local addFormat polyfill is sufficient and complete for the current sealed schema.

### §9.4 — Codex AMENDMENT-5-DESIGN review (Mode 2)

**Verdict:** PASS across 12 review questions.

Codex Q11 explicit recommendation: *"A DESIGN-SPEC handoff is needed before implementation because this phase is design-only and the implementation scope must be pinned to `src/verify/schema-validator.js:119-121` before any Mode 4 edit."* This codification phase (`AMENDMENT-5-DESIGN-SPEC`) addresses that recommendation by persisting the design as immutable parent-repo evidence before any SAFE IMPLEMENTATION edit.

All 12 questions CONFIRMED with file:line grounding. No required edits. No blockers.

### §9.5 — Outstanding items at codification time

- **§14 record-shape verification:** N/A for AMENDMENT-5 (Layer 1 is Ajv compile-time, not record-shape).
- **Pre-edit discovery scan:** must be re-run at SAFE IMPLEMENTATION time to confirm `schemas/*.json` still has only the 3 `date-time` matches. Single read-only `grep` command.
- **Layer 2 (`AMENDMENT-6`) planning:** separately gated. Recommended design: fix `boot.js:362` to accept either array or object map (match `channel-allowlist.js:54`'s actual contract). May also touch `src/runtime/boot.js` only.
- **Codex SAFE IMPLEMENTATION on-disk source review** of the actual diff is required before commit, per established phase discipline.

---

## §10 — Phase output of this codification phase

This is a DOCS-ONLY (Mode 3) operator-directed codification phase. Scope: 4 files in the parent repo only — 1 new SAFE-class handoff record (this file) + 3 status-doc updates (`orchestrator/STATUS.md`, `orchestrator/CHECKLIST.md`, `orchestrator/NEXT-ACTION.md`). No Relay-repo touch. No source edit. No test execution. No commit by this codification turn itself; commit decision deferred to operator. No push.

**This phase does NOT and MUST NOT:**

- Run any smoke test; invoke `node --test`, `node --check`, `npm install`, `npm ci`, `npx`, `astro *`, or `playwright`
- Edit any Relay-repo file (sealed at `e715f5d33d28bdd398c322cbc63e0691a5f2b76f`)
- Edit `src/`, `tests/`, `migrations/`, `scripts/`, `bot.js`, `dashboard.js`, `db.js`, `playwright.config.js`
- Edit `package.json` / `package-lock.json` (parent root or `web/`)
- Edit `schemas/*.json`
- Touch `.env`, secrets, `~/.claude/`, `~/.ssh/`, `position.json*`, `MANUAL_LIVE_ARMED`, any trading code path
- Open the future `COMM-HUB-RELAY-RUNTIME-IMPLEMENT-F-HALT-SMOKE-AMENDMENT-5` SAFE IMPLEMENTATION phase
- Open the future `COMM-HUB-RELAY-RUNTIME-IMPLEMENT-F-HALT-SMOKE-AMENDMENT-6-DESIGN` (Layer 2) phase
- Open the future `F-HALT-SMOKE-RUN-6` (Mode 4 SAFE EXECUTION) phase
- Open Phase G design or implementation; resume Stage 5 Steps 14–21 or Stages 7 / 8 / 9 / 10a / 10b
- Open DASH-6 / D-5.12f / D-5.12g / D-5.12h / Migration 009+
- Touch external Hermes Agent (Nous/OpenRouter), Discord, Railway, DB, Kraken, env, secrets, deploy, runtime activation, trading
- Install scheduler / cron / webhook / MCP; widen permissions; perform any network lookup
- Modify any sealed governance doc, sealed handoff record (including F-HALT-SMOKE-RUN-DESIGN at `5acac86…`, F-HALT-SMOKE-AMENDMENT-2-DESIGN at `c642b2b…`, SCAFFOLD-REPAIR-DESIGN at `31ea6f5f…`), generator, dashboard snapshot, or `web/` file
- Touch `position.json.snap.20260502T020154Z` (carve-out preserved untracked)
- Touch `orchestrator/handoffs/evidence/F-HALT-SMOKE-RUN/`, `-2/`, `-3/`, `-4/`, `-5/` (5 evidence dirs preserved untracked)
- Advance the autopilot phase-loop counter; modify CEILING-PAUSE state
- Bundle a Case 09 fix; bundle a Case 12 fix; bundle a `boot.js:268`/`:282-285` observability fix
- Bundle a Layer 2 `allowedChannels` contract fix (AMENDMENT-6 territory)

The next step is operator decision on commit, then Codex DOCS-ONLY review of this codification, then a separately-approved push. A future `COMM-HUB-RELAY-RUNTIME-IMPLEMENT-F-HALT-SMOKE-AMENDMENT-5-DESIGN-SPEC-CLOSEOUT` may record this DESIGN-SPEC as CLOSED at the post-commit parent-repo HEAD (per Rule 1 — one CLOSEOUT and optional one CLOSEOUT-SYNC max; no recursive paperwork beyond that). After the codification commits + pushes (separately approved), the operator may open the Mode 4 SAFE IMPLEMENTATION phase to apply the single-file edit per §3 to the Relay repo at `src/verify/schema-validator.js:119-120` insertion point.
