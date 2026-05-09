# DASH-6 Live-Boundary Smoke Design (canonical SAFE-class design record)

> **DOCS-ONLY ARTIFACT.** This document is the canonical SAFE-class record of the Cycle 2 Phase 3 DASH-6-LIVE-BOUNDARY-SMOKE-DESIGN (DESIGN-ONLY conversation-only) and is persisted by the Cycle 2 Phase 4 DASH-6-LIVE-BOUNDARY-SMOKE-DESIGN-SPEC phase (DOCS-ONLY, Mode 3). It does NOT authorize any code phase, deploy, Kraken action, `MANUAL_LIVE_ARMED` toggle, migration application, production state mutation, autopilot runtime activation, Relay runtime activation, external Hermes Agent (Nous/OpenRouter) setup, test execution, or DASH-6-LIVE-BOUNDARY-SMOKE-IMPL. Future IMPL is Mode 5 by structural rule and is separately gated; future test execution is separately gated; future commit and push are each separately gated.
>
> **Canonical authority:** `orchestrator/NEXT-ACTION.md` and `orchestrator/NEXT-ACTION-SELECTOR.md` (per `HANDOFF-RULES.md`). If this document ever conflicts with either canonical source, the canonical source wins.
>
> **No packet substitutes for in-session operator approval** (per `orchestrator/APPROVAL-GATES.md`).

**Codification phase:** `DASH-6-LIVE-BOUNDARY-SMOKE-DESIGN-SPEC` (Cycle 2 Phase 4 of CYCLE-2-CLEANUP-AND-LIVE-SAFETY-DESIGN; DOCS-ONLY Mode 3)
**Source design phase:** `DASH-6-LIVE-BOUNDARY-SMOKE-DESIGN` (Cycle 2 Phase 3; DESIGN-ONLY Mode 0/1; conversation-only; no commit by the design phase itself)
**Author:** Claude (Lead Engineer / Builder)
**Date:** 2026-05-09
**HEAD baseline at design time:** `c9c44e8fb09b572073d84770a72e2b564c586262`
**Codex DESIGN-ONLY review:** Round-1 PASS WITH REQUIRED EDITS on Gate 10 (preservation invariants explicit) → Round-2 clean PASS on all 10 gates after verbatim §12 invariants block addition.
**Status:** DRAFT — pending Codex DOCS-ONLY review of this codification commit and explicit operator approval before commit.

## §1 — Phase scope and intent

DASH-6-LIVE-BOUNDARY-SMOKE-DESIGN specifies the test plan for DASH-6.D / DASH-6.E / DASH-6.F live-boundary smoke without implementing it. The design closes the deferred coverage gap from DASH-6's original 7-test plan while structurally addressing the Codex DASH-6 round-2 PATH-B-VIOLATION concern (Mode 5 by structural rule per `orchestrator/PHASE-MODES.md:117` — "any `dashboard.js` code path executed when `paperTrading === false`").

**In scope (the source DESIGN-ONLY phase produced):**
- Test-scaffolding architecture (Kraken interception layers; DB redirection; `position.json` mocking; `MANUAL_LIVE_ARMED` mocking)
- Per-sub-phase test assertion plan (D = SET_STOP_LOSS; E = SET_TAKE_PROFIT; F = SELL_ALL)
- Safety boundaries and forbidden live paths
- Approval gate matrix for the future IMPL phase
- Allowed files for this Phase 4 SPEC record
- Codex review packet (used at end of source DESIGN-ONLY phase)

**In scope (this DOCS-ONLY codification phase):**
- Authoring this record at `orchestrator/handoffs/DASH-6-LIVE-BOUNDARY-SMOKE-DESIGN.md`
- Status doc updates at `orchestrator/STATUS.md`, `orchestrator/CHECKLIST.md`, `orchestrator/NEXT-ACTION.md`
- 4-file commit (1 new SAFE-class record + 3 status doc updates); mirrors the DASH-1 / DASH-3 / DASH-4 / DASH-5 design-spec codification pattern

**Out of scope:**
- Any edit to `dashboard.js`, `bot.js`, `db.js`, `migrations/`, `scripts/`, `tests/`, `package.json`, `package-lock.json`, `.env`, `.env.example`, `.nvmrc`, `position.json`, `position.json.snap.20260502T020154Z`, `playwright.config.js`, deploy/Railway config
- Any edit to safety-policy docs (`PROTECTED-FILES.md`, `APPROVAL-GATES.md`, `AUTOPILOT-RULES.md`, `BLUEPRINT.md`, `PHASE-MODES.md`, `NEXT-ACTION-SELECTOR.md`, `ROLE-HIERARCHY.md`, `AUTOMATION-PERMISSIONS.md`, `HANDOFF-RULES.md`, `COMM-HUB-RULES.md`, `COMM-HUB-RELAY-RULES.md`)
- Any deploy, migration application, Kraken action, `MANUAL_LIVE_ARMED` toggle, env / secret read or write, production DB query or mutation, Railway command
- Any DASH-6-LIVE-BOUNDARY-SMOKE-IMPL work (Mode 5 by structural rule; separately gated)
- Any test execution
- Any external Hermes Agent (Nous/OpenRouter) setup
- Any Relay runtime activation
- Any autopilot runtime activation
- Any next supervised cycle's master order definition
- Any memory-file edits
- Any additional file renames

## §2 — PATH-B-VIOLATION resolution

The original concern (Codex DASH-6 round-2): test code that exercises `dashboard.js` paths conditional on `paperTrading === false` triggers Mode 5 by structural rule per `PHASE-MODES.md:117`. Since DASH-6.A / .B / .C / .G were SAFE IMPLEMENTATION (Mode 4) test additions, including D/E/F in the same cycle would either downgrade Mode 5 work or require a separate Mode 5 cycle.

**This design's resolution: Path 1 — explicitly accept Mode 5 for IMPL.** This DESIGN phase produced a Mode 0/1 conversation-only design plan; this Phase 4 SPEC phase persists that plan as a SAFE-class record. The future IMPL phase will be Mode 5 by structural rule (test scaffolding flips `paperTrading === false` on a test dashboard subprocess). The Mode 5 classification is acknowledged up front; the IMPL phase will require fresh operator authorization at the then-current HEAD plus Codex HIGH-RISK IMPL review.

**Mode 5 IMPL means:** Codex implementation review covers the full scaffolding diff with HIGH-RISK criteria. **No `dashboard.js` runtime code is added or modified by IMPL** — only new test scaffolding under `tests/`. The Mode 5 trigger is the test-scaffolding indirectly executing `dashboard.js` paths conditional on `paperTrading === false` via subprocess control.

**Why not Path 2 — gate-only assertion via paper-mode harness?** The Layer 1 (`/api/trade` POST fail-closed) and Layer 2 (`handleTradeCommand` fail-closed when `MANUAL_LIVE_ARMED` unset) gates are themselves inside `dashboard.js` paths conditional on `paperTrading === false`. Testing the gates requires a `paperTrading === false` dashboard subprocess. There is no clean way to test the live boundary without crossing into Mode 5 territory.

## §3 — Three sub-phase scope

| Sub-phase | Target handler | Live failure path tested |
|---|---|---|
| **DASH-6.D** | live `SET_STOP_LOSS` (`dashboard.js` live SL helper at `5683a5a76c5094827be8a3bae8c04c599a85bf36`) | Layer 1 + Layer 2 + helper-invocation boundary; `_redactAttemptedPayload` shape; `emergency_audit_log` persistence |
| **DASH-6.E** | live `SET_TAKE_PROFIT` (`dashboard.js` live TP helper at `9eb21f8f9ac73a452ff5822fdeb05029bf642da8`) | Same structure as D |
| **DASH-6.F** | live `SELL_ALL` (`dashboard.js` live SELL_ALL DB-first at `5bfb475c7d75e30508908871031cf7134e281384`) | Same structure as D + E + the M2 byte-stability assertions already smoke-tested via DASH-6.G `scripts/smoke-test-live-writes.js` |

**Operator decision at design time:** Default Option A — one combined sub-phase covering all 3 boundary tests in a single `tests/dash-6-live-boundary.spec.js` file. Rationale: shared test scaffolding (Kraken mock, DB redirect, `position.json` mock, `MANUAL_LIVE_ARMED` mock); D/E/F differ only by command and per-handler assertions. Splitting into 3 sub-phases triples the Codex review burden without proportional risk reduction.

**Operator-confirmed at design time:** Option A (combined). Codex round-2 PASS gate 8 endorses this default unless future Codex / operator review identifies a safety reason to split.

## §4 — Test-scaffolding architecture (5-layer mocking)

The smoke test exercises a test-instance `dashboard.js` subprocess running in **live mode (`paperTrading === false`)** with **airtight mocking layers** preventing any real production interaction. **No `dashboard.js` code change.** Test scaffolding only.

### Layer 1 — Test environment isolation

- **`DATABASE_URL`** must be a non-prod test database. Mirror the DASH-6.G two-source guard pattern: hard-abort the test if either `process.env.DATABASE_URL` OR `.env DATABASE_URL` resolves to a non-local host. Allow-list: `localhost`, `127.0.0.1`, `[::1]` only. Verbatim adoption of the DASH-6.G dedup + allow-list logic at `scripts/smoke-test-live-writes.js`.
- **`MANUAL_LIVE_ARMED`** in test env: tested in BOTH states (unset → assert Layer 1 + Layer 2 fail-closed; mocked-armed → assert handler reaches helper invocation, BUT the helper itself is mocked to never call Kraken). Test mocks the env var per-test via test-scaffolding control; **never modifies the operator's actual env**.
- **`KRAKEN_API_KEY` / `KRAKEN_API_SECRET`** in test env: explicitly empty or fake-test values. Tests assert that no real Kraken HTTP call occurs.
- **`position.json`** in test env: redirected to a temp file under `os.tmpdir()` or a per-test directory. Real `position.json` MUST NOT be touched. The carve-out `position.json.snap.20260502T020154Z` MUST NOT be touched.

### Layer 2 — Server-side Kraken interception

The live handlers invoke a Kraken adapter. Mock the adapter at module level so the live handler reaches it but the adapter never makes a real HTTP request.

**Approach options considered:**
- **(a) Module-level mock injection** via test setup that overrides the adapter before subprocess starts. Would require a small `dashboard.js` dependency-injection seam — but operator's directive is "Do not edit `dashboard.js`" so this approach is **OUT**.
- **(b) Outbound HTTP interception** via a per-test HTTP proxy or using `nock` / `MSW` server-mode that intercepts all outbound `api.kraken.com` requests. Returns mocked responses to the dashboard subprocess. **Test scaffolding only — no runtime change.**

**Recommended: Option (b)** — outbound HTTP interception. No `dashboard.js` change. Mocks at process boundary.

### Layer 3 — Browser-context Kraken interception (defense-in-depth)

Mirror the DASH-6.A / .B / .C pattern: `page.context().route('**/api.kraken.com/**', ...)` interception with empty-list assertion. Browser-context route interception ensures that even if the dashboard tries to make a Kraken call from the browser side, it's blocked. (For live handlers, browser → server → Kraken; this layer catches the browser side.)

### Layer 4 — Database redirection + assertion

Use a non-prod test `DATABASE_URL`. After each test:
- Assert `emergency_audit_log` rows were written (or NOT written, depending on assertion) per the test's expected boundary behavior
- Cleanup: `DELETE FROM emergency_audit_log WHERE event_id LIKE 'SMOKE-LIVE-BOUNDARY-%'` (mirror DASH-6.G cleanup pattern)
- Snapshot/restore around each test

### Layer 5 — `position.json` redirection

Test setup creates a per-test temp directory and points the dashboard subprocess at it via env var (if dashboard supports it) OR via running the test from a working directory whose CWD-relative `position.json` is the test temp file.

**Constraint check:** if `dashboard.js` reads `position.json` via a hardcoded path like `path.join(__dirname, 'position.json')`, redirection requires either an env-var override OR a test-fixture working-directory pattern. **Operator-decision flag at IMPL time** if the redirection mechanic is non-trivial.

## §5 — Test assertion plan per sub-phase

### Common pre-test setup (all 3)

- `DATABASE_URL` non-prod hard-abort guard (Layer 1)
- Kraken HTTP interception (outbound — Layer 2; browser-context — Layer 3)
- `position.json` redirection (Layer 5)
- `MANUAL_LIVE_ARMED` env var explicitly controlled per test (Layer 1)
- Dashboard subprocess started in `paperTrading === false` mode
- Setup creates a single live position in the test DB to test against

### DASH-6.D — live `SET_STOP_LOSS`

**State A assertions (`MANUAL_LIVE_ARMED` unset):**
- POST `/api/trade` with `{ command: 'SET_STOP_LOSS', stopPrice: <test value> }` returns 4xx with structured error envelope
- No Kraken HTTP call observed (assert empty mock-call list at both Layer 2 + Layer 3)
- No `position.json` write observed (assert temp file unchanged)
- No `emergency_audit_log` row written (Layer 1 fail-closed before any DB action)

**State B assertions (`MANUAL_LIVE_ARMED` mocked-armed):**
- POST `/api/trade` with same command reaches `handleTradeCommand`
- Kraken adapter's mock receives the SL update request (assert mocked-call shape: order ID, stop-loss price, side, quantity)
- DB-first contract: position update occurs in DB BEFORE any `position.json` write
- `emergency_audit_log` row written when Kraken mock returns success — assert M2 byte-stability (helper return value bytes-equal to call-site `attempted_payload`)
- `_redactAttemptedPayload` removes secrets per regex rule (`/secret|key|token|cookie|auth|signature|password|credential|nonce/i`)

### DASH-6.E — live `SET_TAKE_PROFIT`

Symmetric to D: same assertions but for `SET_TAKE_PROFIT` command and TP helper.

### DASH-6.F — live `SELL_ALL`

Same structure plus extension:
- DASH-6.F asserts that the SELL_ALL handler calls the helper and that the helper writes the 9-field `attempted_payload` plus separate top-level `attempted_payload_hash` (no mutation in either branch — confirmed M2-clean via the D-5.12e.1 fix at `dashboard.js:2145`)
- Cross-validates the M2 byte-stability assertions already smoke-tested via DASH-6.G `scripts/smoke-test-live-writes.js`

## §6 — Safety boundaries and forbidden live paths

**Forbidden live paths (must NOT be reached during test execution):**

| Path | Forbidden because | How prevented |
|---|---|---|
| Real Kraken HTTP request | Real-money side effect | Outbound HTTP interception (Layer 2) + browser-context route interception (Layer 3) + `KRAKEN_API_KEY` empty in test env |
| Real production DB query/mutation | Production state corruption | Two-source `DATABASE_URL` hard-abort guard (mirrors DASH-6.G); cleanup window per test |
| Real `position.json` write | Live position cache corruption | per-test temp file + env-var or CWD redirection (Layer 5) |
| Real `MANUAL_LIVE_ARMED` env mutation | Live trading authorization side effect | env var set explicitly per test in test-scaffolding control; never `process.env.MANUAL_LIVE_ARMED = ...` against the operator's actual env |
| Real Railway / deploy / migration | Production action | none of these are touched; tests run only against local test subprocess |

**Carve-out preservation:** `position.json.snap.20260502T020154Z` MUST NOT be touched, staged, or modified in any IMPL run.

**Mode 5 boundary:** the IMPL phase's Mode 5 classification is structural — `dashboard.js` paths execute when `paperTrading === false` during test runs. **No `dashboard.js` code change** is part of the IMPL phase; only test scaffolding under `tests/`.

## §7 — Approval gates required (for future IMPL phase)

| Gate | Required at IMPL? | Why |
|---|---|---|
| **Gate 7** (live dashboard handler) | **YES** | Mode 5 by structural rule; live SL / TP / SELL_ALL handlers are the test target |
| **Gate 9** (real-money behavior change) | **NO** | Test-only addition; no `dashboard.js` runtime change; no real Kraken call; no real DB write; no real `position.json` write |
| **Gate 10** (automation install / upgrade) | **NO** | No new automation layer; no Discord bot; no scheduler |
| **Gate 14** (`MANUAL_LIVE_ARMED`) | **NO** | Test mocks the env var per test; never modifies the operator's actual env; never invokes any real live trading action |
| **Codex IMPL review** | **YES** | HIGH-RISK criteria — verify mocking is airtight; verify no `dashboard.js` change; verify forbidden paths blocked at every layer |
| **Operator commit + push approval** | **YES** | Per established pattern |
| **Operator authorization to run the test (first run)** | **YES** | First test execution requires explicit operator approval (similar to DASH-6.G `scripts/smoke-test-live-writes.js` first-run approval pattern) |

## §8 — File-system delta

### This Phase 4 SPEC commit (this codification phase)

- `orchestrator/handoffs/DASH-6-LIVE-BOUNDARY-SMOKE-DESIGN.md` (NEW SAFE-class design record — this file)
- `orchestrator/STATUS.md`
- `orchestrator/CHECKLIST.md`
- `orchestrator/NEXT-ACTION.md`

**Total: 4-file commit (1 new SAFE-class record + 3 status doc updates).** Mirrors DASH-1 / DASH-3 / DASH-4 / DASH-5 design-spec codification pattern.

### Future IMPL phase (DASH-6-LIVE-BOUNDARY-SMOKE-IMPL — Mode 5 by structural rule; separately gated)

- `tests/dash-6-live-boundary.spec.js` (NEW, ~400-600 lines estimated; Option A combined)
- `tests/fixtures/` (potentially new mock-Kraken response fixtures and test position seed data)
- `playwright.config.js` (potentially modified — **NOT pre-authorized by this SPEC**; operator-decision flag at IMPL packet draft time)
- `orchestrator/STATUS.md`
- `orchestrator/CHECKLIST.md`
- `orchestrator/NEXT-ACTION.md`

**Important: NO `dashboard.js` change** by either this Phase 4 SPEC or the future IMPL.

## §9 — Codex review history

| Round | Verdict | Required edits |
|---|---|---|
| Round-1 (DESIGN-ONLY) | PASS WITH REQUIRED EDITS on Gate 10 | Add explicit preservation-invariant line |
| Round-2 (DESIGN-ONLY) | **PASS — safe to request operator approval to advance to Phase 4 SPEC** | None |

**Codex round-1 verdict (verbatim summary):** Gates 1-9 PASS; Gate 10 FAIL because the design did not explicitly state Migration 008 applied / N-3 closed / approvers exactly `{Victor}`. Codex round-1 required edit text was applied verbatim as the new §12 Invariants block.

**Codex round-2 verdict:** "PASS — safe to request operator approval to advance to Phase 4 SPEC." All 10 gates PASS.

## §10 — Out of scope (explicit non-authorizations)

- No file edits beyond the 4 listed in §8 (this Phase 4 SPEC commit) by this phase
- No `dashboard.js` runtime code change anywhere in this initiative
- No `tests/dash-6-live-boundary.spec.js` creation (future IMPL phase only)
- No `playwright.config.js` edit (future IMPL or later; **not pre-authorized**)
- No `tests/fixtures/` creation (future IMPL phase only)
- No real Kraken / DB / Railway / migration / env / `MANUAL_LIVE_ARMED` action ever
- No external Hermes Agent (Nous/OpenRouter) setup
- No Relay runtime activation
- No autopilot activation
- No memory-file edits
- No additional file renames
- No test execution
- No future IMPL authorization

## §11 — Phase chain forward (each separately gated)

| Phase | Status | Mode |
|---|---|---|
| Cycle 2 Phase 3 (DASH-6-LIVE-BOUNDARY-SMOKE-DESIGN) | CLOSED — Codex round-2 PASS | DESIGN-ONLY (Mode 0/1) |
| **Cycle 2 Phase 4 (DASH-6-LIVE-BOUNDARY-SMOKE-DESIGN-SPEC)** | **IN PROGRESS — this codification phase** | DOCS-ONLY (Mode 3) |
| Cycle 2 Phase 5 (CYCLE-2-CLOSEOUT-AUDIT) | Separately gated — not authorized | READ-ONLY AUDIT (Mode 1) |
| Cycle 2 Phase 6 (CYCLE-2-CLOSEOUT-SPEC) | Separately gated — not authorized | DOCS-ONLY (Mode 3) |
| Future DASH-6-LIVE-BOUNDARY-SMOKE-IMPL | Separately gated — not authorized; **Mode 5 by structural rule**; HIGH-RISK Codex IMPL review required | Mode 5 |
| Future first test execution | Separately gated — not authorized; operator first-run approval required | per-action |

**DASH-6-LIVE-BOUNDARY-SMOKE-IMPL is NOT included in Cycle 2** and remains separately gated. This Phase 4 SPEC codification does NOT authorize implementation, test execution, commit, push, deploy, Railway, production DB, migrations, env changes, `MANUAL_LIVE_ARMED`, live trading, Relay activation, autopilot activation, or external Hermes Agent setup.

## §12 — Preservation invariants

Migration 008 applied; N-3 closed; Relay dormant; Autopilot dormant; approvers exactly {Victor}; no live trading authorized.

## §13 — Risk notes

1. **Mode 5 IMPL approval burden.** Mode 5 by structural rule means IMPL needs explicit Gate 7 + HIGH-RISK Codex IMPL review + first-run operator authorization. Mitigation: this SPEC documents all required mocks airtight at IMPL review time; operator authorizes IMPL only when satisfied.
2. **Mocking complexity.** Five layers of mocking is more than DASH-6.A / .B / .C / .G's 1-2 layers. Mitigation: this SPEC enumerates each layer with verbatim verification criteria; future Codex IMPL review checks each layer.
3. **Dashboard subprocess in live-mode for tests.** First time the test harness runs `dashboard.js` with `paperTrading === false`. Risk: if mocking is incomplete, a single test run could hit production. Mitigation: hard-abort guard if `DATABASE_URL` is non-local; `KRAKEN_API_KEY` empty assertion before subprocess starts; `position.json` redirection assertion before subprocess starts; outbound HTTP interception established before any test runs.
4. **`playwright.config.js` modification potentially needed.** If a new test project for live-mode subprocess is needed, this is a test-config edit. **NOT pre-authorized by this SPEC.** Operator-decision at IMPL packet draft time. Alternative: embed live-mode subprocess control entirely inside the new spec file.
5. **`tests/dash-6-live-boundary.spec.js` lift.** `tests/` is not RESTRICTED per `PROTECTED-FILES.md` (per the DASH-6.A / .B / .C pattern). New test files don't need scoped lift. Confirmed.
6. **DB cleanup discipline.** Any test DB write must be cleaned up; orphaned rows are a state-leak. Mitigation: `LIKE 'SMOKE-LIVE-BOUNDARY-%'` cleanup per DASH-6.G pattern; per-test snapshot/restore.
7. **Combined vs split sub-phase decision.** Operator-confirmed Option A (combined) at design time. Future Codex IMPL review can flag a safety reason to split if discovered.

## §14 — References

- `DASH-6-LIVE-BOUNDARY-SMOKE-DESIGN` — Cycle 2 Phase 3 source design phase (conversation-only; this record's source phase)
- `COMM-HUB-RENAME-RELAY-FILES-CLOSEOUT-SYNC` — Cycle 2 Phase 2 — `c9c44e8fb09b572073d84770a72e2b564c586262` (HEAD baseline at design time)
- `COMM-HUB-RENAME-RELAY-FILES` — Cycle 2 Phase 1 — `82310b52452cd799eb26ea43e64f936bd3baa974`
- `COMM-HUB-RENAME-RELAY-CONTENT` Phase A — `5541fb6f92d84028ac762b1c54ff32808868d2a9`
- `RUN-D-DESIGN-SPEC` — `aaf169e783415a160daf774db761d34aa705867c`
- `DASH-6.G` — `244ab41222608ca14b7361c019a60427a9564850` (M2 byte-stability smoke; pattern reference for two-source DATABASE_URL guard + cleanup discipline)
- `DASH-6.A / .B / .C` — `f1f317f93d1343c167a9c6a4219ded490ba0aa5e` / `f260c5b8c04f0a84760e412de837a4b1000bf787` / `0e93f5678d262679cf66ea8361a3bcc8b41d95a7` (pattern reference for `page.context().route` browser-context Kraken interception)
- `D-5.12f-LIVE-SELLALL-IMPLEMENTATION` — `5bfb475c7d75e30508908871031cf7134e281384` (live SELL_ALL DB-first; DASH-6.F target handler)
- `D-5.12e.1-EMERGENCY-PAYLOAD-CLEANUP` — `5273005a3df155b8fd58ddef49d9b30a8107a7f0` (M2 byte-stability fix at `dashboard.js:2145`; DASH-6.F cross-validates)
- `DASH-5.A` (live SL helper) — `5683a5a76c5094827be8a3bae8c04c599a85bf36` (DASH-6.D target handler)
- `DASH-5.B` (live TP helper) — `9eb21f8f9ac73a452ff5822fdeb05029bf642da8` (DASH-6.E target handler)
- `Migration 008` APPLIED — `189eb1be6ef6304d914671bdaedec44d389cf877`
- `ARC-8-UNPAUSE` — `22ba4a7663e22df64b7cc8e3c0324cbffc0e28f6` (CEILING-PAUSE break)

## §15 — Change history

- DASH-6-LIVE-BOUNDARY-SMOKE-DESIGN-SPEC (2026-05-09): Initial SAFE-class record drafted as the codification of the Cycle 2 Phase 3 DASH-6-LIVE-BOUNDARY-SMOKE-DESIGN conversation-only design plan that received Codex DESIGN-ONLY round-2 clean PASS at HEAD `c9c44e8fb09b572073d84770a72e2b564c586262`.
