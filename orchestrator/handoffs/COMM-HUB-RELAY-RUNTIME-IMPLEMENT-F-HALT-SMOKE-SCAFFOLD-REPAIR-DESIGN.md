# COMM-HUB-RELAY-RUNTIME-IMPLEMENT-F-HALT-SMOKE-SCAFFOLD-REPAIR-DESIGN

**This handoff codifies the accepted conversation-only `COMM-HUB-RELAY-RUNTIME-IMPLEMENT-F-HALT-SMOKE-SCAFFOLD-REPAIR-DESIGN` (Path D per Codex recommendation; round-2 PASS no required edits). The DESIGN phase itself was Mode 2 / DESIGN-ONLY (conversation-only, no commit). This codification phase is `COMM-HUB-RELAY-RUNTIME-IMPLEMENT-F-HALT-SMOKE-SCAFFOLD-REPAIR-DESIGN-SPEC` (DOCS-ONLY / Mode 3). The future implementation phase `COMM-HUB-RELAY-RUNTIME-IMPLEMENT-F-HALT-SMOKE-SCAFFOLD-REPAIR` is SAFE IMPLEMENTATION (Mode 4) — separately gated; not authorized by this codification.**

**Codification provenance:** the four-amendment cycle (`AMENDMENT-2` token format / `AMENDMENT-3` pending-permission seal / `AMENDMENT-4` log-file creation / `AMENDMENT-3`+`AMENDMENT-4` chain to address halt classes 21 → 27 → 25 → 30 across RUN-1, RUN-2, RUN-3, RUN-4 respectively) revealed that each amendment peeled one boot-stage layer and surfaced the next. RUN-4 failed at halt class 30 (`schema-unverifiable`); the operator chose Path γ-lite (broader audit) over Path α (narrow AMENDMENT-5) at that stop point. A comprehensive `F-HALT-SMOKE-RUN-4-BOOT-PATH-AUDIT` (Mode 1, conversation-only) was performed enumerating all 16 boot stages and their test-scaffolding dependencies. The audit identified four concurrent test-scaffolding gaps plus one structural conflict (AMENDMENT-3 pending-seal vs. Phase D moveToProcessed). The operator opened `COMM-HUB-RELAY-RUNTIME-IMPLEMENT-F-HALT-SMOKE-SCAFFOLD-REPAIR-DESIGN` (Mode 2 / DESIGN-ONLY) to design a coherent test-scaffolding repair. A separate narrow Codex review on §1 structural-conflict claim returned PASS — recommended Path D (rewrite Cases 7 + 8 as non-boot tests) over operator's prior Paths A (broad skip), B (revert AMENDMENT-3), C (sealed-source bypass). Operator chose Path D. Codex DESIGN-ONLY full round-1 review against §6 Q1-Q15 returned PASS WITH REQUIRED EDITS — single required edit on §3 File 2 schemaPath line using `fileURLToPath(new URL(..., import.meta.url))` instead of `.pathname` (Windows / percent-encoding portability). Operator applied the verbatim required edit. Codex DESIGN-ONLY round-2 narrow review (inline-only) returned PASS — no required edits; verbatim correction confirmed. This handoff is the on-disk codification of that accepted result. This file does NOT itself constitute an execution authorization. Codex review verdicts are not operator approval.

---

## §0 — Phase classification & current anchors

| Property | Value |
|---|---|
| Phase name (this codification phase) | `COMM-HUB-RELAY-RUNTIME-IMPLEMENT-F-HALT-SMOKE-SCAFFOLD-REPAIR-DESIGN-SPEC` |
| Phase mode (this codification phase) | Mode 3 / DOCS-ONLY |
| Original phase name (the codified design) | `COMM-HUB-RELAY-RUNTIME-IMPLEMENT-F-HALT-SMOKE-SCAFFOLD-REPAIR-DESIGN` |
| Original phase mode | Mode 2 / DESIGN-ONLY (conversation-only; no commit) |
| Parent-repo HEAD anchor | `757a86d876edf2bdc3b33f12a1518734d2b2c1fc` (F-HALT-SMOKE-AMENDMENT-4-CLOSEOUT sealed) |
| Relay-repo HEAD anchor | `e2c4c2470096c6dec53d0fe466c2298b5e2c6c47` (F-HALT-SMOKE-AMENDMENT-4 sealed) |
| Pre-AMENDMENT-4 Relay anchor | `cc3be444126cd72137d9b9669fe92c92226cb61d` (F-HALT-SMOKE-AMENDMENT-3) |
| Pre-AMENDMENT-3 Relay anchor | `b8de3b639ff014b47c4e10e2036d471e90ae7535` (F-HALT-SMOKE-AMENDMENT-2) |
| Pre-AMENDMENT-2 Relay anchor | `590c1c9b42d96298c625df17ad892e7bf318c8ab` (F-HALT-SMOKE-AMENDMENT) |
| Sealed F-HALT-SMOKE-RUN-DESIGN handoff | parent `5acac86b521b8e3783b43018d4091194316e7a61` (untouched) |
| Sealed F-HALT-SMOKE-AMENDMENT-2-DESIGN handoff | parent `c642b2b73276580d4c30d0c26337e335f8c24cc2` (untouched) |
| Future implementation phase (gated, NOT authorized) | `COMM-HUB-RELAY-RUNTIME-IMPLEMENT-F-HALT-SMOKE-SCAFFOLD-REPAIR` (SAFE IMPLEMENTATION / Mode 4) |
| Future re-execution phase (gated, NOT authorized) | `COMM-HUB-RELAY-RUNTIME-IMPLEMENT-F-HALT-SMOKE-RUN-5` (Mode 4 SAFE EXECUTION against the sealed `F-HALT-SMOKE-RUN-DESIGN` plan) |
| Parent repo working tree at codification time | clean except `position.json.snap.20260502T020154Z` + `orchestrator/handoffs/evidence/F-HALT-SMOKE-RUN/`, `-2/`, `-3/`, `-4/` (5 authorized untracked carve-outs) |
| Relay repo working tree at codification time | clean |
| Relay-runtime status | DORMANT preserved |
| Autopilot status | DORMANT preserved (verified at `eff4dd22…`) |
| Approvers | exactly `{Victor}` |

---

## §1 — Path D framing (Codex-confirmed structural conflict)

**Codex-confirmed structural conflict (verbatim PASS from §1 narrow review):** the same single-process smoke runner cannot satisfy both:
- Phase D Stage 8 `ensureDirectoryLayout` (requires `fs.access(pending, W_OK)` to fail; DP-5 hardening at `src/store/source-of-truth.js:263-276`)
- Phase D `moveToProcessed` (requires W_OK on `pending/` to perform POSIX `rename` at `src/store/source-of-truth.js:166-200`)

**Path D resolution (operator-selected after Codex recommendation):**

1. **Preserve AMENDMENT-3's pending-seal for the 8 boot-path tests** (Cases 1, 2, 3, 4, 5, 6, 10, 11). These tests halt at gates 1/2/4/5 or Stage 13/15 — *before* `moveToProcessed` runs — so the seal causes no harm.
2. **Rewrite Case 7 + Case 8 (primary + sub-case) as non-boot tests** that exercise `publishLog.append` and `store.moveToProcessed` in isolation against a writable temp tree. These tests do NOT call `boot()`; they directly invoke the Phase D factory output, bypassing the boot-path's DP-5 check on `pending/`.

**Trade-offs:**
- The new Case 7 + Case 8 tests lose the integration-style "boot → pipeline → halt → write/move" coverage. They become unit-level (or shallow-integration-level) tests of the underlying store/publish-log primitives.
- The boot-path tests still validate the DP-5 check + the gate-halt-classes that the booting tests are designed to verify.
- **DP-5 is NOT weakened** in the sealed source.
- **No `src/` change** is required.
- The structural conflict is documented in-line so any future test author understands why Cases 7 and 8 are non-boot.

**Paths explicitly NOT chosen** (preserved for audit history):
- Path A (broad `test.skip()` of Cases 7 + 8) — too coarse; loses intent
- Path B (revert AMENDMENT-3 + update test assertions to expect halt 27) — weakens DP-5 coverage semantic
- Path C (Mode 5 / HIGH-RISK source bypass of Phase D DP-5 check) — sealed-source change; production-design impact

---

## §2 — Recommended repair strategy (Path D)

Bundle four discrete fixes in one coherent helper-and-test repair:

1. **schemaPath resolution** — add absolute `schemaPath` to `syntheticRuntimeConfig` so Phase E Stage 11 schema validator can read the file regardless of `process.cwd()`. Fixes RUN-4 halt 30. **Uses `fileURLToPath(new URL(..., import.meta.url))` per Codex required edit (Windows / percent-encoding portability).**
2. **ceiling-pause-signal fixture** — extend `createTempTree()` to create the signal file with content `"ACTIVE"` (matches `runtimeConfig.expectedCeilingPauseContent` default). Prevents the predicted next halt at Phase E gate 6.
3. **Synthetic-message schema compatibility** — rewrite `buildSyntheticMessage` (and variants) to produce schema-valid default messages per the sealed `schemas/hermes-message.schema.json` required fields (`message_id`, `channel_id`, `channel_name`, `body`, `codex_pass_verdict_ref`, `operator_authorization`, `allowed_placeholder_map`, `halt_on_condition_flags`, `dry_run`). Variants each apply ONE targeted invalidity to trigger the intended gate halt.
4. **Case 7 + Case 8 non-boot rewrite (Path D core)** — rewrite as direct-store / direct-publish-log tests that don't call `boot()`; preserves intent (verify §14 record append + rename semantics) while sidestepping the AMENDMENT-3 / DP-5 conflict.

**No `src/` change.** **No `package.json` change.** **AMENDMENT-3 preserved for boot-path tests.**

---

## §3 — Exact proposed file list (revised for Path D)

| # | Path | Edit kind | Approximate delta |
|---|---|---|---|
| 1 | `tests/smoke/helpers/temp-tree.js` | EDIT — append `await fs.writeFile(ceilingPauseSignal, 'ACTIVE');` after AMENDMENT-4's two writeFile calls | +1 line |
| 2 | `tests/smoke/helpers/synthetic-runtime-config.js` | EDIT — add `import { fileURLToPath } from 'node:url';` import; add `schemaPath: fileURLToPath(new URL('../../../schemas/hermes-message.schema.json', import.meta.url))` to the `base` object (Codex round-1 required edit applied) | +3-5 lines |
| 3 | `tests/smoke/helpers/synthetic-message.js` | EDIT (substantive) — rewrite `buildSyntheticMessage` default to satisfy schema's full required-field set; update three variants (`buildSchemaInvalidMessage`, `buildChannelDisallowedMessage`, `buildStaleApprovalMessage`) to apply ONE targeted invalidity each | ~30-50 lines |
| 4 | `tests/smoke/07-halt-publish-log-append.test.js` | **REWRITE** — non-boot publish-log writer test: directly invokes `createPublishLogWriter({...}).ensureLogIntegrity()` + `.append(haltRecord)` with a synthesized canonical §14 halt record; reads `publish-log.jsonl` and asserts §14 shape. No `boot()`. | ~60 lines (whole-file rewrite) |
| 5 | `tests/smoke/08-pending-move-after-halt.test.js` | **REWRITE** — non-boot store tests: **Case 8 primary** directly invokes `createMessageStore({...}).moveToProcessed(filename)` with writable pending + pre-populated synthetic message; asserts file moved to processed/. **Case 8 sub-case** directly invokes `moveToProcessed` against writable pending + chmod'd `processed/` (0o500); asserts thrown `StoreError(haltClass: 24)`. Both bypass `boot()`. | ~80 lines (whole-file rewrite) |

**Optional File 6 (operator decision at impl time):** `tests/smoke/helpers/non-boot-store-fixture.js` — new helper providing `createWritablePendingTempTree()` (mirrors `createTempTree()` but without `sealPending`) and a `freshStoreFactory()` wrapper. Pros: keeps Cases 7/8 readable; clear separation between boot-path and store-unit tests. Cons: +1 file. Recommended at implementation time.

**Net effect:** 5 (or 6) files modified; ~100-180 line delta. Concentrated in test infrastructure; zero `src/` touch.

---

## §4 — How Case 7 and Case 8 will be rewritten

### Case 7 — was boot-based halt-publish-log-append; now non-boot publish-log writer test

**Original intent:** verify that when a halt fires during pipeline, a canonical §14 record is appended to `publish-log.jsonl`.

**Non-boot rewrite (proposed shape; exact form decided at impl time):**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createTempTree, cleanupTempTree } from './helpers/temp-tree.js';
import { createPublishLogWriter } from '../../src/store/publish-log.js';

test('Case 7 — publish-log append produces canonical §14 record (non-boot unit test)', async () => {
  const tempTree = await createTempTree();
  try {
    const writer = createPublishLogWriter({
      publishLogPath: tempTree.publishLog,
      hermesVersion: 'smoke-test-7',
      safeLog: () => {},
    });
    await writer.ensureLogIntegrity();
    const haltRecord = {
      schema_version: '1.0.0',
      message_id: 'smoke-7-test',
      channel_id: '#smoke-test-allowed',
      outcome: 'halt:29',
      halt_class: 29,
      timestamp: new Date().toISOString(),
      process_pid: process.pid,
      hermes_version: 'smoke-test-7',
    };
    await writer.append(haltRecord);

    const raw = await fs.readFile(tempTree.publishLog, 'utf8');
    const lines = raw.split('\n').filter(l => l.length > 0);
    assert.equal(lines.length, 1, 'one record appended');
    const parsed = JSON.parse(lines[0]);
    assert.equal(parsed.outcome, 'halt:29', 'canonical §14 outcome field present');
    assert.equal(parsed.message_id, 'smoke-7-test');
    assert.equal(parsed.halt_class, 29);
  } finally {
    await cleanupTempTree(tempTree);
  }
});
```

Key shape: doesn't import `boot.js`, doesn't seal pending, directly tests the `publishLog.append` writer + verifies §14 record shape.

### Case 8 — two non-boot store tests

**Case 8 primary:**
```js
test('Case 8 primary — moveToProcessed renames pending file to processed (non-boot unit test)', async () => {
  const tempTree = await createTempTree();
  try {
    const store = createMessageStore({
      messageStorePath: tempTree.root,
      safeLog: () => {},
    });
    const msg = buildSyntheticMessage();
    const filename = buildPendingFilename(msg.message_id);
    const pendingFile = path.join(tempTree.pending, filename);
    await fs.writeFile(pendingFile, JSON.stringify(msg));

    await store.moveToProcessed(filename);

    const pendingFiles = await fs.readdir(tempTree.pending);
    const processedFiles = await fs.readdir(tempTree.processed);
    assert.equal(pendingFiles.length, 0, 'pending must be empty after move');
    assert.equal(processedFiles.length, 1, 'processed must contain moved file');
  } finally {
    await cleanupTempTree(tempTree);
  }
});
```

**Case 8 sub-case:**
```js
test('Case 8 sub-case — moveToProcessed failure throws StoreError(haltClass: 24) (non-boot unit test)', async () => {
  const tempTree = await createTempTree();
  try {
    const store = createMessageStore({
      messageStorePath: tempTree.root,
      safeLog: () => {},
    });
    const msg = buildSyntheticMessage();
    const filename = buildPendingFilename(msg.message_id);
    const pendingFile = path.join(tempTree.pending, filename);
    await fs.writeFile(pendingFile, JSON.stringify(msg));
    await fs.chmod(tempTree.processed, 0o500); // force rename failure

    let caught;
    try {
      await store.moveToProcessed(filename);
    } catch (err) {
      caught = err;
    }
    assert.ok(caught, 'moveToProcessed must throw');
    assert.equal(caught.name, 'StoreError');
    assert.equal(caught.haltClass, 24);
    assert.match(caught.reason, /^rename-failed/);
  } finally {
    try { await fs.chmod(tempTree.processed, 0o700); } catch {}
    await cleanupTempTree(tempTree);
  }
});
```

**Coverage trade-off:** the non-boot rewrites move the assertions from the safeLog-stdout-capture layer (pipeline-side) to the StoreError-thrown layer (store-side). Same underlying contract, different layer.

---

## §5 — Expected post-repair smoke-run TAP tally

After Path D scaffold-repair lands by itself (no Case 9 fix bundled), and a fresh SAFE EXECUTION re-runs the sealed `F-HALT-SMOKE-RUN-DESIGN.md` plan (likely `F-HALT-SMOKE-RUN-5`):

> **`13 total / 11 pass / 1 skip / 1 fail`**
> - **11 booting/non-boot tests pass:**
>   - 8 boot-path tests: Cases 1 (halt 20 intended), 2 (halt 32 intended), 3 (dry-run clean), 4 (gate 1 halt 29), 5 (gate 2 halt 3), 6 (gate 5 halt 7), 10 (no network), 11 (gate 4 halt 2)
>   - 3 non-boot tests: Case 7 (publish-log append §14), Case 8 primary (moveToProcessed rename), Case 8 sub-case (moveToProcessed failure throws StoreError haltClass 24)
> - **1 skip:** Case 12 (`test.skip()` + TODO citing `src/verify/limits.js:83` — untouched)
> - **1 fail:** Case 9 (safeLog REDACT_PATHS contract drift — separately gated audit; NOT addressed by this repair)

**Alternative tally `13 / 12 / 1 / 0`** reachable ONLY if a separately-gated Case 9 fix lands before the next smoke-run; bundling NOT authorized by this design.

---

## §6 — Codex review packet (Q1-Q15)

| # | Check | Pass criterion |
|---|---|---|
| Q1 | The scaffold-repair is test-only (Relay-repo `tests/smoke/` only). | Modified-files list contains only paths under `tests/smoke/`; no `src/`, `package*.json`, `schemas/`, `migrations/`, `node_modules/`, parent-repo path. |
| Q2 (corrected per Codex round-1 required edit) | schemaPath fix uses an absolute path computed via `fileURLToPath(new URL(..., import.meta.url))` (resilient to `process.cwd()` and platform-portable per Node ESM convention; NOT `.pathname` which has Windows / percent-encoding edge cases). | Verify `syntheticRuntimeConfig` imports `fileURLToPath` from `'node:url'`; returns a `schemaPath` value that begins with `/` on POSIX (or correctly-decoded `C:\...` on Windows); resolves to the existing `schemas/hermes-message.schema.json` regardless of `process.cwd()`. |
| Q3 | The ceiling-pause-signal file is created with content `"ACTIVE"`. | Verify `createTempTree` writes the signal file before returning the tree object; content matches the sealed `expectedCeilingPauseContent` default. |
| Q4 | `buildSyntheticMessage` default produces a schema-valid message per `schemas/hermes-message.schema.json` required fields. | Trace each required field in the schema and verify the new default contains it with type-valid content. |
| Q5 | The variant builders apply ONE targeted invalidity each. | Code-review each variant; confirm only ONE field is invalidated per builder; no inadvertent secondary invalidities. |
| Q6 | Case 7 is rewritten as a non-boot test of `createPublishLogWriter().append()` / `ensureLogIntegrity()` only. | Verify the test does NOT `await import('../../src/runtime/boot.js')`, does NOT call `boot()`, does NOT call `tempTree.sealPending()`; directly invokes the publish-log writer factory. |
| Q7 | Case 8 primary is rewritten as a non-boot test of `createMessageStore().moveToProcessed()` happy path. | Verify the test does NOT call `boot()`; directly creates the store factory + calls `moveToProcessed`; asserts pending becomes empty + processed contains the file. |
| Q8 | Case 8 sub-case is rewritten as a non-boot test of `moveToProcessed` failure path via chmod'd processed. | Verify the test does NOT call `boot()`; directly creates the store + chmods processed + calls `moveToProcessed`; asserts the thrown StoreError shape. |
| Q9 | AMENDMENT-3's pending-seal is preserved for the 8 boot-path tests (Cases 1, 2, 3, 4, 5, 6, 10, 11). | Verify these 8 test files still contain `await tempTree.sealPending();` after the boot import line. |
| Q10 | No bundling of Case 9, Case 12, `boot.js:268/:282-285` observability, or any `src/` change. | Files `tests/smoke/09-safelog-sensitive-redaction.test.js`, `tests/smoke/12-rate-limit-adapter-halt.test.js`, `src/runtime/boot.js`, `src/store/source-of-truth.js`, `src/store/publish-log.js`, `src/store/dry-run-log.js`, `src/verify/*`, `src/config.js`, `src/log.js` are NOT in the modified-files list. |
| Q11 | `package.json` / `package-lock.json` byte-identity preserved. | No `npm install` / new dependency / lockfile change. |
| Q12 | The scaffold-repair does NOT activate Relay runtime, Discord, Railway, DB, Kraken, env (real), secrets, deploy, Phase G, or trading. | Verify by inspection — helper-edits + test-file rewrites only. |
| Q13 | After scaffold-repair lands by itself, expected next smoke-run TAP tally is **`13 total / 11 pass / 1 skip / 1 fail`**. | Codex confirms tally + non-bundling. |
| Q14 | The Path D rewrite of Cases 7 + 8 does NOT broadly skip them; both are converted to passing non-boot tests, not `test.skip()`. | Verify both files contain `test(...)` (not `test.skip(...)`); both bodies execute assertions. |
| Q15 | Future SAFE IMPLEMENTATION does NOT run smoke tests; test execution is separate Mode 4 SAFE EXECUTION phase. | Per established discipline. |

---

## §7 — Hard non-authorization clauses

This DESIGN-ONLY Mode 2 design (now codified by this DOCS-ONLY Mode 3 SPEC), and the future SAFE IMPLEMENTATION Mode 4 phase it describes, do NOT authorize:

- Test execution (no `node --test` / `node --check` / `npm install` / `npm ci` / `npx` / `playwright` / `astro` invocation; running the smoke tests is a separate SAFE EXECUTION phase against the amended source)
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
- Phase C/D/E/F sealed source in Relay repo (incl. `src/store/source-of-truth.js` DP-5 contract at `:263-276`, `src/store/publish-log.js`, `src/store/dry-run-log.js`, `src/runtime/boot.js`, `src/config.js`, `src/verify/*`, `src/log.js`)
- **Phase D DP-5 hardening contract modification** (Path C — explicitly rejected)
- **Reverting AMENDMENT-3's pending-seal** (Path B — explicitly rejected; AMENDMENT-3 preserved for boot-path tests per Path D)
- **Broadly skipping Cases 7 + 8 via `test.skip()`** (Path A — explicitly rejected; Cases 7 + 8 are rewritten as passing non-boot tests per Path D)
- `package.json` / `package-lock.json` byte change in either repo
- Antigravity workspace config; any sealed handoff (including F-HALT-SMOKE-RUN-DESIGN at parent `5acac86…`, F-HALT-SMOKE-AMENDMENT-2-DESIGN at parent `c642b2b…`); sealed generator; `orchestrator/DASHBOARD.md`
- Any push to any remote
- Memory file writes under `~/.claude/`
- Case 9 safeLog redaction fix
- Case 12 rate-limit contract fix
- `src/runtime/boot.js:268`/`:282-285` observability fix
- The alternative `13/12/1/0` smoke-run tally outcome (reachable only with a separately-gated Case 9 fix)

**Approvers exactly `{Victor}`.** Codex review verdicts do not constitute operator approval.

---

## §8 — Preservation invariants (verified at codification time)

- Relay sealed at `e2c4c2470096c6dec53d0fe466c2298b5e2c6c47`; parent at `757a86d876edf2bdc3b33f12a1518734d2b2c1fc`
- Sealed F-HALT-SMOKE-RUN-DESIGN handoff at parent `5acac86…` — untouched
- Sealed F-HALT-SMOKE-AMENDMENT-2-DESIGN handoff at parent `c642b2b…` — untouched
- All 4 smoke-run evidence dirs preserved untracked: `F-HALT-SMOKE-RUN/` (RUN-1 halt 21), `F-HALT-SMOKE-RUN-2/` (RUN-2 halt 27), `F-HALT-SMOKE-RUN-3/` (RUN-3 halt 25), `F-HALT-SMOKE-RUN-4/` (RUN-4 halt 30)
- Phase A-F Relay-repo lettered chain: Phase F baseline `b8ab035…` → F-HALT-AMENDMENT `9fb251e…` → F-HALT-SMOKE `abc7a71…` → F-HALT-SMOKE-AMENDMENT `590c1c9b…` → F-HALT-SMOKE-AMENDMENT-2 `b8de3b63…` → F-HALT-SMOKE-AMENDMENT-3 `cc3be444…` → F-HALT-SMOKE-AMENDMENT-4 `e2c4c247…` (current)
- Migration 008 APPLIED at `189eb1be…`; N-3 CLOSED; Stage 5 Gate-10 install approval at `40f3137e…` CONSUMED
- Autopilot DORMANT (verified at `eff4dd22…`); Relay DORMANT; CEILING-PAUSE broken at `22ba4a76` (counter 0 of 3)
- Live write paths (OPEN_LONG / BUY_MARKET, CLOSE_POSITION, SELL_ALL) DB-first; unaffected by this phase
- `position.json.snap.20260502T020154Z` carve-out preserved untracked
- Railway service display name `agent-avila-relay`; `DISCORD_BOT_TOKEN` empty-shell preserved (NOT touched)
- The Phase D `src/store/source-of-truth.js:263-276` DP-5 contract IS the correct sealed contract; Path D preserves it while rewriting Cases 7 + 8 as non-boot tests that bypass DP-5

---

## §9 — Codex review history

### §9.1 — Pre-design narrow review on §1 structural-conflict claim (separate Codex thread)

**Verdict:** PASS. **Recommendation:** Path D.

Codex (verbatim grounding):
- "Yes: `source-of-truth.js:263` calls `fsp.access(pendingDir, fsConstants.W_OK)` and `source-of-truth.js:270` throws halt class 27 if that succeeds."
- "Yes: `source-of-truth.js:181` builds `src` under `pendingDir`, `source-of-truth.js:182` builds `dst` under `processedDir`, and `source-of-truth.js:184` calls `fsp.rename(src, dst)`."
- "Yes: POSIX/macOS `rename(2)` requires write/search permission on the source parent directory to remove the old directory entry, with UID 0/root as the relevant caveat..."
- "No: `temp-tree.js:29` sets `pending/` to `0o555`, satisfying `source-of-truth.js:263`, but that same non-writable source parent prevents the later POSIX rename at `source-of-truth.js:184` in a non-root single process."
- "Path D is safest: it preserves the DP-5 check observed at `source-of-truth.js:270`, avoids a production/test bypass, and avoids relying on the incompatible sealed rename path..."

Conclusion: AMENDMENT-3 / moveToProcessed structural conflict is real; Path D (rewrite Cases 7 + 8 as non-boot tests) is safer than A (broad skip), B (revert AMENDMENT-3), or C (sealed-source bypass).

### §9.2 — Full Path D design round-1 (against §6 Q1-Q15)

**Verdict:** PASS WITH REQUIRED EDITS. **Required edit:** single — §3 File 2 schemaPath line must use `fileURLToPath(new URL(..., import.meta.url))` instead of `.pathname`; add `import { fileURLToPath } from 'node:url';`. Reason: `.pathname` is less robust than `fileURLToPath(...)` for ESM file paths (Windows / percent-encoding portability).

Codex Q1-Q15 grounding: Q1, Q2 (verbatim required edit), Q3, Q4, Q5, Q6, Q7 (required edit), Q8 path-resolution, Q9 ceiling-pause-signal content, Q10 schema-required fields enumeration, Q11 variant invalidity, Q12 tally derivation, Q13 no remaining mismatch (except §14 record-shape unverifiable from design alone), Q14 pending filename construction, Q15 robust faithful implementation.

**Noted-uncertainty (Q3 + Q13):** the canonical §14 record-shape contract for `publish-log.jsonl` records is NOT defined in the design's pre-verified facts. Codex could NOT fully verify Case 7's halt-record shape against the §14 source-of-truth. **Not a blocker** — flagged for verification at SAFE IMPLEMENTATION time by reading `src/store/publish-log.js` and the canonical `orchestrator/handoffs/COMM-HUB-RELAY-RUNTIME-DESIGN.md` §14 reference.

### §9.3 — Round-2 narrow review (inline-only)

**Verdict:** PASS. **No required edits.**

Codex (verbatim grounding):
- "§3 File 2 includes `fileURLToPath(new URL(..., import.meta.url))` and does not use `.pathname`."
- "§3 File 2 and §6 Q2 are the only edited sections per the operator statement."
- "Prior round-1 PASS items stand because unchanged sections remain out of scope for round-2."
- "§14 record-shape uncertainty remains non-blocking and should be verified during SAFE IMPLEMENTATION against the actual publish-log source / canonical §14 contract."

Operator-applied edit verbatim: `import { fileURLToPath } from 'node:url';` + `schemaPath: fileURLToPath(new URL('../../../schemas/hermes-message.schema.json', import.meta.url))` in `tests/smoke/helpers/synthetic-runtime-config.js`.

### §9.4 — Outstanding items at codification time

- **§14 record-shape verification:** must be performed at SAFE IMPLEMENTATION time by the implementing agent. Read `src/store/publish-log.js` for the actual append-record schema; cross-reference `orchestrator/handoffs/COMM-HUB-RELAY-RUNTIME-DESIGN.md` §14 for the canonical record shape; ensure Case 7's halt record in §4 of this design matches both sources. Adjust the test's record fields if the canonical §14 requires different / additional / fewer fields.
- **Optional File 6 (`non-boot-store-fixture.js`):** operator decision at implementation time. Recommended for code cleanliness.
- **Codex SAFE IMPLEMENTATION on-disk source review** of the actual diff is required before commit, per established phase discipline.

---

## §10 — Phase output of this codification phase

This is a DOCS-ONLY (Mode 3) operator-directed codification phase. Scope: 4 files in the parent repo only — 1 new SAFE-class handoff record (this file) + 3 status-doc updates (`orchestrator/STATUS.md`, `orchestrator/CHECKLIST.md`, `orchestrator/NEXT-ACTION.md`). No Relay-repo touch. No source edit. No test execution. No commit by this codification turn itself; commit decision deferred to operator. No push.

**This phase does NOT and MUST NOT:**
- Run any smoke test; invoke `node --test`, `node --check`, `npm install`, `npm ci`, `npx`, `astro *`, or `playwright`
- Edit any Relay-repo file (sealed at `e2c4c247…`)
- Edit `src/`, `tests/`, `migrations/`, `scripts/`, `bot.js`, `dashboard.js`, `db.js`, `playwright.config.js`
- Edit `package.json` / `package-lock.json` (parent root or web/)
- Touch `.env`, secrets, `~/.claude/`, `~/.ssh/`, `position.json*`, `MANUAL_LIVE_ARMED`, any trading code path
- Open the future `COMM-HUB-RELAY-RUNTIME-IMPLEMENT-F-HALT-SMOKE-SCAFFOLD-REPAIR` SAFE IMPLEMENTATION phase
- Open Phase G design or implementation; resume Stage 5 Steps 14–21 or Stages 7 / 8 / 9 / 10a / 10b
- Open DASH-6 / D-5.12f / D-5.12g / D-5.12h / Migration 009+
- Touch external Hermes Agent (Nous/OpenRouter), Discord, Railway, DB, Kraken, env, secrets, deploy, runtime activation, trading
- Install scheduler / cron / webhook / MCP; widen permissions; perform any network lookup
- Modify any sealed governance doc, sealed handoff record (including F-HALT-SMOKE-RUN-DESIGN at `5acac86…` and F-HALT-SMOKE-AMENDMENT-2-DESIGN at `c642b2b…`), generator, dashboard snapshot, or `web/` file
- Touch `position.json.snap.20260502T020154Z` (carve-out preserved untracked)
- Touch `orchestrator/handoffs/evidence/F-HALT-SMOKE-RUN/`, `-2/`, `-3/`, `-4/` (4 evidence dirs preserved untracked)
- Advance the autopilot phase-loop counter; modify CEILING-PAUSE state
- Bundle a Case 9 fix; bundle a Case 12 fix; bundle a `boot.js:268`/`:282-285` observability fix
- Apply Path B (revert AMENDMENT-3) or Path C (sealed-source DP-5 bypass)

The next step is operator decision on commit, then optionally Codex DOCS-ONLY review of this codification, then optionally a separately-approved push. A future `COMM-HUB-RELAY-RUNTIME-IMPLEMENT-F-HALT-SMOKE-SCAFFOLD-REPAIR-DESIGN-SPEC-CLOSEOUT` may record this DESIGN-SPEC as CLOSED at the post-commit parent-repo HEAD (per Rule 1 — one CLOSEOUT and optional one CLOSEOUT-SYNC max; no recursive paperwork beyond that). After the codification commits + pushes (separately approved), the operator may open the Mode 4 SAFE IMPLEMENTATION phase to apply the 5 (or 6) file changes per §3 to the Relay repo.
