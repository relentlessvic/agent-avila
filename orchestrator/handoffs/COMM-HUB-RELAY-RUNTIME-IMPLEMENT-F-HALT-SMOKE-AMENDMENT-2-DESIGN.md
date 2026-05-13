# COMM-HUB-RELAY-RUNTIME-IMPLEMENT-F-HALT-SMOKE-AMENDMENT-2-DESIGN

**This handoff codifies the accepted conversation-only `COMM-HUB-RELAY-RUNTIME-IMPLEMENT-F-HALT-SMOKE-AMENDMENT-2-DESIGN`. The DESIGN phase itself was Mode 2 / DESIGN-ONLY (conversation-only, no commit). This codification phase is `COMM-HUB-RELAY-RUNTIME-IMPLEMENT-F-HALT-SMOKE-AMENDMENT-2-DESIGN-SPEC` (DOCS-ONLY / Mode 3). The future implementation phase `COMM-HUB-RELAY-RUNTIME-IMPLEMENT-F-HALT-SMOKE-AMENDMENT-2` is SAFE IMPLEMENTATION (Mode 4) — separately gated; not authorized by this codification.**

**Codification provenance:** the prior `COMM-HUB-RELAY-RUNTIME-IMPLEMENT-F-HALT-SMOKE-RUN` SAFE EXECUTION (Mode 4) run at parent `dc3c224793af16a19dde798eb3dfe136222c4ef5` against sealed Relay source `590c1c9b42d96298c625df17ad892e7bf318c8ab` produced TAP tally `13 total / 0 pass / 12 fail / 1 skip` (Case 12 the only skip; byte-identity gate §5.1a PASSED; sealed anchors PASSED). The operator opened `COMM-HUB-RELAY-RUNTIME-IMPLEMENT-F-HALT-SMOKE-RUN-FAILURE-AUDIT` (Mode 1 READ-ONLY AUDIT, conversation-only) which identified that 11 of 12 failures share a single root cause: the synthetic `DISCORD_BOT_TOKEN` literal `'smoke-test-synthetic-token-DO-NOT-USE'` injected by the F-HALT-SMOKE-AMENDMENT (sealed at Relay `590c1c9b…`) does not match the sealed Phase C `validateBaselineFormat` regex `/^[A-Za-z0-9_.-]{20,}\.[A-Za-z0-9_.-]{4,}\.[A-Za-z0-9_.-]{20,}$/` at `src/config.js:232` (zero dots in the literal vs. 2-dot-separator-required regex). Case 9 (safeLog redaction) was identified as a separate, unrelated failure (different root cause; different code path). Case 12 remains `test.skip()` per the prior F-HALT-SMOKE-AMENDMENT decision. Operator opened `COMM-HUB-RELAY-RUNTIME-IMPLEMENT-F-HALT-SMOKE-AMENDMENT-2-DESIGN` (Mode 2 / DESIGN-ONLY) to design a minimal test-only amendment for the 11-failure cluster. Codex DESIGN-ONLY round-1 returned PASS WITH REQUIRED EDITS with one required edit: §3 first line resolving the A1/A2 ambiguity by explicitly selecting Option A1 (no A1 blocker found). Operator applied the verbatim required edit. Codex narrow round-2 returned PASS with no required edits. This handoff is the on-disk codification of that accepted result. This file does NOT itself constitute an execution authorization. Codex review verdicts are not operator approval.

---

## §0 — Phase classification & current anchors

| Property | Value |
|---|---|
| Phase name (this codification phase) | `COMM-HUB-RELAY-RUNTIME-IMPLEMENT-F-HALT-SMOKE-AMENDMENT-2-DESIGN-SPEC` |
| Phase mode (this codification phase) | Mode 3 / DOCS-ONLY |
| Original phase name (the codified design) | `COMM-HUB-RELAY-RUNTIME-IMPLEMENT-F-HALT-SMOKE-AMENDMENT-2-DESIGN` |
| Original phase mode | Mode 2 / DESIGN-ONLY (conversation-only; no commit) |
| Parent-repo HEAD anchor | `dc3c224793af16a19dde798eb3dfe136222c4ef5` (F-HALT-SMOKE-RUN-DESIGN-SPEC-CLOSEOUT sealed) |
| Relay-repo HEAD anchor | `590c1c9b42d96298c625df17ad892e7bf318c8ab` (F-HALT-SMOKE-AMENDMENT sealed; the test contract drift surfaced by the smoke-run is at THIS sealed source) |
| Smoke-run evidence anchor | `orchestrator/handoffs/evidence/F-HALT-SMOKE-RUN/` (untracked; tap-run-1.txt + tests-smoke-before.sha256 + tests-smoke-after.sha256) |
| Sealed F-HALT-SMOKE-RUN-DESIGN handoff | parent `5acac86…/orchestrator/handoffs/COMM-HUB-RELAY-RUNTIME-IMPLEMENT-F-HALT-SMOKE-RUN-DESIGN.md` (untouched) |
| Failure-audit anchor | `COMM-HUB-RELAY-RUNTIME-IMPLEMENT-F-HALT-SMOKE-RUN-FAILURE-AUDIT` (Mode 1; conversation-only; no commit) |
| Future implementation phase (gated, NOT authorized by this codification) | `COMM-HUB-RELAY-RUNTIME-IMPLEMENT-F-HALT-SMOKE-AMENDMENT-2` (SAFE IMPLEMENTATION / Mode 4) |
| Future re-execution phase (gated, NOT authorized) | re-run of sealed `COMM-HUB-RELAY-RUNTIME-IMPLEMENT-F-HALT-SMOKE-RUN-DESIGN.md` plan against the post-AMENDMENT-2 Relay HEAD |
| Parent repo working tree at codification time | clean except `position.json.snap.20260502T020154Z` (durable carve-out) + `orchestrator/handoffs/evidence/F-HALT-SMOKE-RUN/` (authorized smoke-run evidence dir; preserved untracked) |
| Relay repo working tree at codification time | clean |
| Relay-runtime status | DORMANT preserved |
| Autopilot status | DORMANT preserved (verified at `eff4dd22b9b9af038c7ae45de301e60b3f45af98`) |
| Approvers | exactly `{Victor}` |

---

## §1 — Goal & scope

Land a minimal SAFE IMPLEMENTATION (Mode 4 / future phase) that makes the 11 booting smoke tests pass against the sealed Phase C `validateBaselineFormat` regex at `src/config.js:232`. Specifically: replace the duplicated, regex-invalid synthetic `DISCORD_BOT_TOKEN` literal across all booting smoke tests with a single centralized regex-valid constant exported from `tests/smoke/helpers/synthetic-runtime-config.js`.

**Out of scope (Codex confirmed bundling discipline at round-1):**
- Case 9 safeLog redaction failure — separate root cause; separate future audit
- Case 12 rate-limit contract drift at `src/verify/limits.js:83` — separately deferred since F-HALT-SMOKE-AMENDMENT
- `src/runtime/boot.js:148-151` observability rough-edge (`envErr.keyword` vs. `envErr.reason`) — separately gated optional Phase F edit
- Any `src/` source change — none authorized; the regex IS the correct contract, the test placeholder is the drift
- Any `package.json` / `package-lock.json` / dependency change — none

---

## §2 — Proposed fake-token format

```js
export const SYNTHETIC_DISCORD_BOT_TOKEN =
  'smoke_test_FAKE_TOKEN_segment_a.FAKE.smoke_test_FAKE_TOKEN_segment_b';
```

**Regex compliance check** against `src/config.js:232` `/^[A-Za-z0-9_.-]{20,}\.[A-Za-z0-9_.-]{4,}\.[A-Za-z0-9_.-]{20,}$/`:

| Segment | Value | Length | Char class | Matches |
|---|---|---|---|---|
| 1 | `smoke_test_FAKE_TOKEN_segment_a` | 31 chars | letters + underscores | ✓ |
| separator | `.` | 1 | literal dot | ✓ |
| 2 | `FAKE` | 4 chars | uppercase letters | ✓ (≥4 required) |
| separator | `.` | 1 | literal dot | ✓ |
| 3 | `smoke_test_FAKE_TOKEN_segment_b` | 31 chars | letters + underscores | ✓ |

All segments within `[A-Za-z0-9_.-]`; no dots inside segments; minimum-length constraints satisfied with headroom (31 vs. 20 minimum for outer segments).

**Why this specific value:**
- **Unambiguously synthetic:** `smoke_test`, `FAKE_TOKEN`, `segment_a`/`segment_b`, and middle `FAKE` make it obvious to a human reader, a secret scanner, and any log inspector that this is NOT a real Discord bot token.
- **Cannot collide with a real token:** real Discord tokens use base64url alphabet with high-entropy structure; the presence of underscores combined with all-lowercase descriptive prefixes is atypical of base64url tokens, but still validates the format regex.
- **Stable across all booting tests:** identical literal everywhere — single source of truth in the helper, eliminates per-file drift risk for future contract changes.
- **Length headroom:** segments 1 and 3 are 31 chars vs. 20-char minimum; one-character changes won't break the regex.
- **Preserves prior intent:** the prior literal `'smoke-test-synthetic-token-DO-NOT-USE'` used same "smoke-test ... DO-NOT-USE" naming style; the new literal preserves that spirit while adding the dot-separated structure the regex requires.

**Considered alternatives (rejected):**
- All-`a` minimum (`'aaaaaaaaaaaaaaaaaaaa.aaaa.aaaaaaaaaaaaaaaaaaaa'`): regex-valid but unreadable; zero signal to a future maintainer.
- Random base64url string: regex-valid but indistinguishable from a real token; defeats the "fake" signal.
- Token shaped like a real Discord token: risks resembling a leaked real token to scanners or readers; rejected.

---

## §3 — Files in scope

**Helper file — Option A1 selected:** Add `SYNTHETIC_DISCORD_BOT_TOKEN` export to existing `tests/smoke/helpers/synthetic-runtime-config.js`. (Option A2 deferred; no blocker found for A1.)

The existing helper file currently exports only `syntheticRuntimeConfig`. The amendment adds the named export `SYNTHETIC_DISCORD_BOT_TOKEN` adjacent to it. A small comment clarifies the scope expansion from "runtime config only" to "synthetic test inputs (runtime config + env literals)".

**Booting smoke test files (10 files modified):**

| # | File | Replace literal at line |
|---|---|---|
| 1 | `tests/smoke/01-boot-fail-closed-missing-operator-phase-id.test.js` | `:28` |
| 2 | `tests/smoke/02-boot-fail-closed-missing-phase-g-hook-production.test.js` | (corresponding line; verified-at-impl-time) |
| 3 | `tests/smoke/03-dry-run-stub-boot-success.test.js` | (verified-at-impl-time) |
| 4 | `tests/smoke/04-gate-1-schema-mismatch-halt.test.js` | (verified-at-impl-time) |
| 5 | `tests/smoke/05-gate-2-channel-allowlist-halt.test.js` | (verified-at-impl-time) |
| 6 | `tests/smoke/06-gate-5-idempotency-collision-halt.test.js` | (verified-at-impl-time) |
| 7 | `tests/smoke/07-halt-publish-log-append.test.js` | (verified-at-impl-time) |
| 8 | `tests/smoke/08-pending-move-after-halt.test.js` | (verified-at-impl-time) |
| 9 | `tests/smoke/10-no-network-calls.test.js` | (verified-at-impl-time) |
| 10 | `tests/smoke/11-op-auth-staleness-halt.test.js` | (verified-at-impl-time) |

For each file: add `import { SYNTHETIC_DISCORD_BOT_TOKEN } from './helpers/synthetic-runtime-config.js'` near the existing imports (extending the existing import block from the same helper file, since `syntheticRuntimeConfig` is already imported from this path), and replace `DISCORD_BOT_TOKEN: 'smoke-test-synthetic-token-DO-NOT-USE'` with `DISCORD_BOT_TOKEN: SYNTHETIC_DISCORD_BOT_TOKEN` in the env-injection block.

**Files explicitly NOT modified:**
- `tests/smoke/09-safelog-sensitive-redaction.test.js` — Case 9 separate failure
- `tests/smoke/12-rate-limit-adapter-halt.test.js` — Case 12 skip-only; no literal
- Any file under `src/`
- `package.json`, `package-lock.json`, `node_modules/`
- Any parent-repo file (Relay-repo-only amendment)

**Estimated edit volume:** 11 files modified (1 helper + 10 booting tests). Option A2 (new helper file) explicitly deferred; if a future operator decides A2 is preferred for semantic clarity, that would be a separate scope amendment.

---

## §4 — Why this is test-only and safe

- **Test-only scope.** All modified files live under `tests/smoke/`. No production code path reads `tests/smoke/helpers/synthetic-runtime-config.js`. Phase C `src/config.js` regex contract is unchanged — it IS the correct contract that production Discord bot tokens must satisfy. The amendment aligns the *test placeholder* to the *contract*, not the other way around.
- **No real secret in the diff.** The proposed literal is unambiguously fake by construction. Cannot be confused with a real Discord token by humans, scanners, or downstream tooling. The forbidden-env scan in `src/config.js:204-220` already exempts `DISCORD_BOT_TOKEN` via `ALLOWED_CREDENTIAL_NAME_OVERRIDES`, so the name itself is allow-listed; the value is purely a regex-format placeholder.
- **No Discord network surface activated.** The synthetic token is never used to authenticate with Discord — every smoke test stubs `process.exit` and relies on the `network-observer` helper (`tests/smoke/helpers/network-observer.js`) which is asserted in Case 10 (no network calls during dry-run stub boot). Phase G hook is not activated in tests. Relay runtime activation remains DORMANT.
- **No `boot()` against real `MESSAGE_STORE_PATH`.** Every test creates its own `os.tmpdir()` per-test tree; the `MESSAGE_STORE_PATH` env is set to that temp tree; no production path is touched.
- **`node:test` built-in only.** No new dependency. `package.json` and `package-lock.json` byte-identity preserved (a hard gate that the future SAFE IMPLEMENTATION must verify pre-commit).
- **Sealed Phase C/D/E/F source untouched.** The amendment touches only `tests/smoke/` — none of the lettered-phase sealed source files are in scope.
- **Reversible.** A one-shot diff in `tests/smoke/`. Easy to revert if anything goes wrong.
- **Byte-identity gate still applies.** The future re-run of the smoke-run plan (per the sealed `COMM-HUB-RELAY-RUNTIME-IMPLEMENT-F-HALT-SMOKE-RUN-DESIGN.md` §5.1a hard-FAIL at parent `5acac86…`) would verify that the tests do not mutate themselves during execution. The amendment doesn't change this discipline; it just makes the tests reach their actual assertions.

---

## §5 — What remains separate

| Item | Status | Why not bundled |
|---|---|---|
| **Case 9 — safeLog REDACT_PATHS redaction failure** | Separately gated future Mode 1 audit | Different root cause (Phase C/D `src/log.js` contract vs. test expectation), different code path (doesn't call `boot()`), different remediation domain. Bundling would conflate evidence and obscure which fix landed when. |
| **Case 12 — `src/verify/limits.js:83` channelCap object-vs-`maxPerWindow` drift** | Separately gated (Option B component-level test rewrite, or Option C Phase E source amendment) | Residual deferral from F-HALT-SMOKE-AMENDMENT; not exercised by the failed run (Case 12 is `test.skip()`). Bundling would re-open a closed deferral decision unnecessarily. |
| **`src/runtime/boot.js:148-151` observability rough-edge** | Separately gated optional Phase F edit | Phase F sealed-source change; bundling test-only and source-only changes in one phase violates phase-mode discipline. The rough-edge merely made the audit harder; not a correctness bug. |

The future Mode 4 SAFE IMPLEMENTATION phase Codex review packet must explicitly affirm that none of these three items are touched.

---

## §6 — Codex review packet (round-1 issued; round-2 verified verbatim required-edit application)

Codex DESIGN-ONLY review of this Mode 2 design verified, in this order:

| # | Check | Status |
|---|---|---|
| Q1 | Amendment is test-only (Relay-repo `tests/smoke/` only); no file under `src/`, `migrations/`, `schemas/`, `node_modules/`, package files, or any parent-repo path is in scope. | PASS round-1 |
| Q2 | Proposed token `'smoke_test_FAKE_TOKEN_segment_a.FAKE.smoke_test_FAKE_TOKEN_segment_b'` matches the Phase C regex at `src/config.js:232`. | PASS round-1 |
| Q3 | Proposed token is unambiguously synthetic (cannot be confused with a real Discord bot token). | PASS round-1 |
| Q4 | Amendment does NOT bundle Case 9, Case 12, or `boot.js:148-151` observability. | PASS round-1 |
| Q5 | Modified-files list is exactly: 1 helper (existing) + 10 booting tests; Option A1 explicitly selected over A2. | PASS round-2 after operator applied round-1 verbatim required-edit |
| Q6 | Amendment does NOT activate Relay runtime, Discord, Railway, DB, Kraken, env (real), secrets, deploy, Phase G, or trading. | PASS round-1 |
| Q7 | `package.json` / `package-lock.json` byte-identity preserved. | PASS round-1 |
| Q8 | Scope-coherent: one root cause, one fix, in one Mode 4 SAFE IMPLEMENTATION phase. | PASS round-1 |
| Q9 (REVISED) | After AMENDMENT-2 lands by itself (no other fix bundled), expected next smoke-run TAP tally is **`13 total / 11 pass / 1 skip / 1 fail`**. The 11 booting tests pass (Phase C regex now satisfied); Case 12 remains the only skip; Case 9 remains failing (AMENDMENT-2 does not fix it; out of scope per §5). Alternative tally `13 / 12 / 1 / 0` reachable ONLY if a separately-gated Case 9 fix lands before the next smoke-run; bundling that fix into AMENDMENT-2 explicitly NOT authorized. | PASS round-1 |
| Q10 | Future SAFE IMPLEMENTATION does NOT itself run the smoke tests; test execution is a separate Mode 4 SAFE EXECUTION phase re-running the sealed `F-HALT-SMOKE-RUN-DESIGN.md` plan against the amended source. | PASS round-1 |

**Codex round-1 verdict:** PASS WITH REQUIRED EDITS. Single required edit: §3 first line resolving the A1/A2 ambiguity by explicitly selecting Option A1 (no A1 blocker found). Verbatim required-edit text:

> Helper file — **Option A1 selected**: Add `SYNTHETIC_DISCORD_BOT_TOKEN` export to existing `tests/smoke/helpers/synthetic-runtime-config.js`. (Option A2 deferred; no blocker found for A1.)

**Operator applied the verbatim required edit to §3 first line.**

**Codex round-2 narrow verdict:** PASS — no required edits. Round-2 grounding: "The revised §3 first line matches the round-1 required-edit text exactly, and the provided §3 keeps Option A1, the same 10 booting tests, explicit Case 9/Case 12 exclusions, no `src/` or package changes, and accepts the operator-stated unchanged §2 token."

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
- Phase C/D/E/F sealed source in Relay repo (the regex contract at `src/config.js:232` is the correct contract; this amendment aligns tests to it)
- `package.json` / `package-lock.json` byte change in either repo
- Antigravity workspace config; any sealed handoff (including F-HALT-SMOKE-RUN-DESIGN at parent `5acac86…`); sealed generator; `orchestrator/DASHBOARD.md`
- Any push to any remote
- Memory file writes under `~/.claude/`
- Case 9 safeLog redaction fix
- Case 12 rate-limit contract fix
- `src/runtime/boot.js:148-151` observability fix
- The alternative smoke-run tally `13 / 12 / 1 / 0` (reachable ONLY if a separately-gated Case 9 fix lands before the next smoke-run; this design does NOT authorize bundling such a fix into AMENDMENT-2)

**Approvers exactly `{Victor}`.** Codex review verdicts do not constitute operator approval.

---

## §8 — Preservation invariants (verified at codification time)

- Relay sealed at `590c1c9b42d96298c625df17ad892e7bf318c8ab`; parent at `dc3c224793af16a19dde798eb3dfe136222c4ef5`
- Sealed F-HALT-SMOKE-RUN-DESIGN handoff at parent `5acac86…/orchestrator/handoffs/COMM-HUB-RELAY-RUNTIME-IMPLEMENT-F-HALT-SMOKE-RUN-DESIGN.md` — untouched
- Sealed F-HALT-SMOKE-RUN-DESIGN-SPEC-CLOSEOUT at parent `dc3c224…` — untouched
- Smoke-run evidence at `orchestrator/handoffs/evidence/F-HALT-SMOKE-RUN/` — preserved untracked (tap-run-1.txt + 2 SHA-256 files)
- 11 booting smoke tests currently FAILING with halt class 21 (this design's target); Case 9 separately FAILING (safeLog redaction); Case 12 SKIPPED as designed
- Migration 008 APPLIED at `189eb1be6ef6304d914671bdaedec44d389cf877`; N-3 CLOSED; Stage 5 Gate-10 install approval at `40f3137e842cd60acf1adf17ecc7fe2f0b1b8935` CONSUMED
- Autopilot DORMANT (verified at `eff4dd22b9b9af038c7ae45de301e60b3f45af98`); Relay DORMANT; CEILING-PAUSE broken at `22ba4a76` (counter 0 of 3)
- Live write paths (OPEN_LONG / BUY_MARKET, CLOSE_POSITION, SELL_ALL) DB-first; unaffected by this phase
- `position.json.snap.20260502T020154Z` carve-out preserved untracked
- Railway service display name `agent-avila-relay`; `DISCORD_BOT_TOKEN` empty-shell preserved (NOT touched by this phase)
- Phase A–F Relay-repo lettered chain preserved: F baseline `b8ab035034668fd53ea6efe64432f0868dfd2eb9`; F-HALT-AMENDMENT `9fb251efa9279dd662f743c4c60e3712612a7e0c`; F-HALT-SMOKE `abc7a717ef00b2bad198ee2c4db223dcf3ef0e2b`; F-HALT-SMOKE-AMENDMENT `590c1c9b42d96298c625df17ad892e7bf318c8ab`
- F-HALT-AMENDMENT-DESIGN handoff sealed at `f7d511c31f36b6d39b2b7cfe79cba9c8e31d10ee` untouched
- F-HALT-SMOKE-DESIGN handoff sealed at `cec1710bd84b6d3aac2a45847da21b8f1f20e5da` untouched
- F-HALT-AMENDMENT cascade sealed through parent `cf877f443fdfd10b14822ea202ac63166cfc2a08` and Relay `9fb251efa9279dd662f743c4c60e3712612a7e0c`
- F-HALT-SMOKE cascade sealed through parent `e2bc17f7c65af94317eb046cc92ebf9618b22679` and Relay `abc7a717ef00b2bad198ee2c4db223dcf3ef0e2b`
- F-HALT-SMOKE-AMENDMENT cascade sealed through parent `57911e807c648c7937d7f9cf4abe1021487bddac` and Relay `590c1c9b42d96298c625df17ad892e7bf318c8ab`
- F-HALT-SMOKE-RUN-DESIGN-SPEC cascade sealed through parent `5acac86b521b8e3783b43018d4091194316e7a61` and Relay `590c1c9b42d96298c625df17ad892e7bf318c8ab` (no Relay-side change)
- F-HALT-SMOKE-RUN-DESIGN-SPEC-CLOSEOUT cascade sealed through parent `dc3c224793af16a19dde798eb3dfe136222c4ef5` and Relay `590c1c9b42d96298c625df17ad892e7bf318c8ab` (no Relay-side change)
- Antigravity chain SHAs preserved: ANTIGRAVITY-MIGRATION-DESIGN-SPEC `71af035f9a1f7489bfd663e099a15fda7439d0a7`; ANTIGRAVITY-MIGRATION-A-WORKSPACE-CONFIG-DESIGN-SPEC `d7bb70463beed9c9e3abea84ed9b0682cbaf2255`; ANTIGRAVITY-MIGRATION-A-WORKSPACE-CONFIG-CLOSEOUT `19db3723e5a046db33bb5880fb95e6f38f23e08a`; ANTIGRAVITY-RULES-DESIGN-SPEC `9d47f74d87aeed20a2fa7483a3704b494a21eb96`; ANTIGRAVITY-RULES-DESIGN-SPEC-CLOSEOUT-SYNC `6c41c2c69d7fb4c8d5fda6179829f10e3ffaf9c0`
- Full PROJECT-PROGRESS-DASHBOARD cascade through REFRESH-006-CLOSEOUT-SYNC preserved (sealed through `e026ed312a5899f9b6aa4fa4f132463feb3ad934`)
- Sealed generator `tools/dashboard-generate.js` codified at `f5cc97a…` untouched; refreshed dashboard regenerated at REFRESH-006/`61df34fad5f588c9a83ee55aca9f328e96d22a03` untouched; web/ at `ef63605f833c508e803ef5f9e40ff6129e3cab56` untouched
- Approvers exactly `{Victor}`
- The Phase C `src/config.js` DISCORD_BOT_TOKEN regex at line 232 IS the correct sealed contract; this amendment aligns tests to it, not the other way around

---

## §9 — Phase output of this codification phase + expected post-AMENDMENT-2 tally

This is a DOCS-ONLY (Mode 3) operator-directed codification phase. Scope: 4 files in the parent repo only — 1 new SAFE-class handoff record (this file) + 3 status-doc updates (`orchestrator/STATUS.md`, `orchestrator/CHECKLIST.md`, `orchestrator/NEXT-ACTION.md`). No Relay-repo touch. No source edit. No test execution. No commit by this codification turn itself; commit decision deferred to operator. No push.

**Expected post-AMENDMENT-2 smoke-run TAP tally** (after the future SAFE IMPLEMENTATION lands AMENDMENT-2 alone, with no other bundled fix, then a fresh SAFE EXECUTION re-runs the sealed `F-HALT-SMOKE-RUN-DESIGN` plan against the amended Relay source):

> **`13 total / 11 pass / 1 skip / 1 fail`**
> - 11 booting tests (Cases 1, 2, 3, 4, 5, 6, 7, 8 primary, 8 sub-case, 10, 11) should reach and pass their intended assertions because the synthetic `DISCORD_BOT_TOKEN` now matches the Phase C regex at `src/config.js:232`.
> - Case 12 remains skipped (`test.skip()` + TODO citing `src/verify/limits.js:83` — untouched by AMENDMENT-2).
> - Case 9 remains failing (safeLog REDACT_PATHS contract drift — separately gated audit, NOT fixed by AMENDMENT-2).

**The alternative tally `13 / 12 / 1 / 0` is reachable ONLY if a separate Case 9 audit + fix phase lands before the next smoke-run.** This design does NOT authorize bundling a Case 9 fix into AMENDMENT-2; doing so would violate the scope-coherent / one-root-cause-per-phase discipline asserted in §5 and Q4/Q8 of the Codex review packet.

**This codification phase does NOT and MUST NOT:**
- Run any smoke test; invoke `node --test`, `node --check`, `npm install`, `npm ci`, `npx`, `astro *`, or `playwright`
- Edit any Relay-repo file (sealed at `590c1c9b…`)
- Edit `src/`, `tests/`, `migrations/`, `scripts/`, `bot.js`, `dashboard.js`, `db.js`, `playwright.config.js`
- Edit `package.json` / `package-lock.json` (parent root or web/)
- Touch `.env`, secrets, `~/.claude/`, `~/.ssh/`, `position.json*`, `MANUAL_LIVE_ARMED`, any trading code path
- Open the future `COMM-HUB-RELAY-RUNTIME-IMPLEMENT-F-HALT-SMOKE-AMENDMENT-2` SAFE IMPLEMENTATION phase
- Open Phase G design or implementation; resume Stage 5 Steps 14–21 or Stages 7 / 8 / 9 / 10a / 10b
- Open DASH-6 / D-5.12f / D-5.12g / D-5.12h / Migration 009+
- Touch external Hermes Agent (Nous/OpenRouter), Discord, Railway, DB, Kraken, env, secrets, deploy, runtime activation, trading
- Install scheduler / cron / webhook / MCP; widen permissions; perform any network lookup
- Modify any sealed governance doc, sealed handoff record (including F-HALT-SMOKE-RUN-DESIGN at `5acac86…`), generator, dashboard snapshot, or `web/` file
- Touch `position.json.snap.20260502T020154Z` (carve-out preserved untracked)
- Touch `orchestrator/handoffs/evidence/F-HALT-SMOKE-RUN/` (smoke-run evidence dir preserved untracked)
- Advance the autopilot phase-loop counter; modify CEILING-PAUSE state
- Bundle a Case 9 fix; bundle a Case 12 fix; bundle a `boot.js:148-151` observability fix

The next step is operator decision on commit, then optionally Codex DOCS-ONLY review of this codification, then optionally a separately-approved push. A future `COMM-HUB-RELAY-RUNTIME-IMPLEMENT-F-HALT-SMOKE-AMENDMENT-2-DESIGN-SPEC-CLOSEOUT` may record this DESIGN-SPEC as CLOSED at the post-commit parent-repo HEAD (per Rule 1 — one CLOSEOUT and optional one CLOSEOUT-SYNC max; no recursive paperwork beyond that).

After the future AMENDMENT-2 lands at a new Relay HEAD: a fresh Mode 4 SAFE EXECUTION phase re-runs the sealed `F-HALT-SMOKE-RUN-DESIGN.md` plan against the amended source — same byte-identity commands; expected tally `13 / 11 / 1 / 1` (Case 9 still failing; this is the only correct expectation for AMENDMENT-2 alone). Case 9 remediation, if pursued, is a separately-gated future track (Mode 1 audit → Mode 2 design → Mode 4 implementation → Mode 4 re-run). Only if that track also lands before the next smoke-run does the tally become `13 / 12 / 1 / 0`.
