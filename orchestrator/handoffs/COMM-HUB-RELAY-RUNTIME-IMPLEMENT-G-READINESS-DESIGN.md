# COMM-HUB-RELAY-RUNTIME-IMPLEMENT-G-READINESS-DESIGN

**SAFE-class handoff. DOCS-ONLY (Mode 3) codification of the Mode 2 DESIGN-ONLY conversation-approved G-READINESS-DESIGN.**

**Phase:** COMM-HUB-RELAY-RUNTIME-IMPLEMENT-G-READINESS-DESIGN
**Mode of underlying design:** 2 (DESIGN-ONLY; conversation-only)
**Mode of this codification:** 3 (DOCS-ONLY)
**Mode classification of the underlying Phase G implementation work that this readiness plan governs:** 5 (HIGH-RISK IMPLEMENTATION; FIRST HIGH-RISK phase in the Relay project per sealed E-VERIFY-DESIGN line 50)
**Parent-repo HEAD at codification time:** `39d4f4dfe74dcdc03d213cfe541844230179f77d`
**Relay-repo HEAD at codification time:** `f5c5cdbd7f3e6412428049af18539e299c0376b1`
**F-HALT-SMOKE state carried forward:** `13/13/0/0` (achieved at parent `2306463…`; preserved at parent `66af7df…` and `39d4f4d…`)
**Approvers exactly:** `{Victor}`
**Codex review verdicts do NOT constitute operator approval.**

---

## §0 — Background

The sealed `COMM-HUB-RELAY-RUNTIME-IMPLEMENT-G-DESIGN.md` at parent `66af7df236745da8a3b3df92463166bc4d8fabf8` codifies the Phase G design with 5 code-path layers (Discord client construction via discord.js; Send Message API wrapper; egress allowlist hook installation per RUNTIME-DESIGN section 10 line 453 Layer 2; egress event log ring buffer; gate-9 network-anomaly functionality), 4 Codex DESIGN-ONLY required edits (Stage 7 mock/no-network wording; Gate-10 RED-tier dependency approval; RUN-10 package-files-diff strict rule; deployment-separation), and a single Mode 5 HIGH-RISK implementation envelope.

This G-READINESS-DESIGN refines that envelope into a 6-subphase implementation sequence (G-0 → G-5) to reduce blast radius and create per-stage Codex review + named operator approval gates. The 6-subphase plan was reviewed by Codex in two rounds (round-1 PASS WITH REQUIRED EDITS; round-2 narrow re-review PASS after 8 corrections A–H applied), with codification gate explicitly CLEARED.

This handoff is the permanent SAFE-class record of that conversation-approved plan.

---

## §1 — Executive recommendation

**Phase G implementation MUST be split into 6 sequential subphases G-0 → G-5, each with its own commit, push, three-way SHA consistency seal, Codex review chain, and named operator approval.**

Rationale: Phase G is the FIRST HIGH-RISK (Mode 5) phase in the Relay project per sealed E-VERIFY-DESIGN line 50. A monolithic Mode-5 implementation would touch dependency files + 5 new src files + sealed `boot.js` wiring + 5-6 new test files + one smoke run in a single commit — a single review failure or regression would require reverting the entire bundle. Splitting creates 6 small atomic seal points with individual rollback granularity. The Mode 5 classification (and the discord.js Gate-10 RED-tier requirement embedded in the sealed G-DESIGN as Edit 2) survives the split: G-1 is Mode 5 + Gate-10 RED-tier; G-2 / G-3 / G-4 are **Mode 5 HIGH-RISK IMPLEMENTATION with non-activation scope** (correction A applied; distinguished from Mode 4 SAFE EXECUTION); G-5 is Mode 4 SAFE EXECUTION (post-implementation smoke). G-0 (the readiness design) is Mode 2 DESIGN-ONLY; this DESIGN-SPEC is Mode 3 DOCS-ONLY codification of G-0.

---

## §2 — Per-subphase plan

### G-0 — READINESS-DESIGN (Mode 2 DESIGN-ONLY)

- **Status:** complete; conversation-approved + Codex round-1 PASS WITH REQUIRED EDITS + Codex round-2 narrow re-review PASS; codified by this DESIGN-SPEC.
- **Files touched by G-0 itself:** none.
- **Files touched by this codification:** 4 parent-repo files (1 NEW handoff + 3 status docs).
- **Authorizes:** nothing downstream. G-1 requires its own named operator open.

### G-1 — DISCORD-JS-INSTALL (Mode 5 HIGH-RISK IMPLEMENTATION + Gate-10 RED-tier)

- **Mode:** 5 (HIGH-RISK IMPLEMENTATION) + Gate-10 RED-tier dependency-install gate per sealed G-DESIGN Edit 2.
- **Repo touch:** Relay repo only (`/Users/victormercado/code/agent-avila-relay`).
- **Files touched:** `package.json` + `package-lock.json` — only.
- **Source files touched:** none.
- **Test files touched:** none.
- **Network reach:** npm registry only, during the named one-time install command.
- **Codex review chain:** (a) pre-install DESIGN-ONLY plan review citing exact discord.js version + transitive-dep audit; (b) post-install SAFE IMPLEMENTATION review of the actual `package*.json` diff vs. the pre-approved version; (c) DOCS-ONLY review of CLOSEOUT.
- **Post-install audit:** byte-identity SHA-256 of all `src/*` and `tests/smoke/*` files (must be unchanged); diff of `package-files-diff.txt` must contain only the pre-approved discord.js entry + its expected transitives.
- **Tests:** none executed in this subphase (`node --test` NOT authorized; `npm test` NOT authorized).
- **Operator approvals required (G-1):**
  - Open-phase approval (named).
  - **Named Gate-10 RED-tier dependency-install approval** that explicitly cites ALL of:
    - package: `discord.js`
    - pinned version (named at G-1 open time; e.g., `discord.js@14.x.y` exact-pinned)
    - exact install command (e.g., `npm install --save-exact discord.js@<version>` from Relay repo root)
    - **one-time npm registry network reach exception, named and single-use, time-limited to the install operation only**
    - prohibition on any other package addition / removal / version drift / script change / lockfile metadata drift / non-Discord dependency
  - Commit-only approval (naming the 2-file Relay-repo scope).
  - Push approval (naming `relentlessvic/agent-avila-relay` `main`).
  - CLOSEOUT approval; optional CLOSEOUT-SYNC per Rule 1.
- **Authorizes:** nothing downstream (G-2 requires its own named operator open).
- **Forbidden:** source edit; test edit; boot.js touch; test execution; deploy; real token use; Discord platform action; Relay activation; any network reach beyond the named one-time npm registry exception.

### G-2 — GATEWAY-MODULES-IMPLEMENT (Mode 5 HIGH-RISK IMPLEMENTATION with non-activation scope)

- **Mode:** 5 (HIGH-RISK IMPLEMENTATION with non-activation scope per correction A).
- **Repo touch:** Relay repo only.
- **Files touched:** NEW files only (no edit of sealed src). Per correction C (`src/gateway/*` naming, NOT `src/discord/*`):
  - `src/gateway/discord-client.js` (factory; side-effect-free Discord client construction)
  - `src/gateway/send-message.js` (per correction D: **wrapper construction only**; no real token, no gateway connect, no outbound send in tests; accepts a passed-in mocked-at-test client + payload; validates shape and returns construct-and-call result; never invoked against a real Discord client at G-2)
  - `src/gateway/egress-allowlist-hook.js` (Layer 2 runtime-side HTTP-client hook installation entry per RUNTIME-DESIGN section 10 line 453)
  - `src/gateway/egress-event-log.js` (Layer 4 egress event log ring buffer)
  - Gate-9 network-anomaly module (Layer 5): **final placement (`src/gateway/gate-9-network-anomaly.js` vs. `src/verify/gate-9-network-anomaly.js`) to be finalized at G-2 open against existing file structure per correction C**.
- **Files NOT touched:** `src/runtime/boot.js` (deferred to G-3); all sealed src files; `package*.json`; `tests/smoke/*` (except the 1 NEW construction test below).
- **Tests:** 1 NEW test file (number to be locked at G-2 pre-open): mocked side-effect-free Discord client construction test per Codex Goal 11 §5 Category 4 in sealed G-DESIGN — uses mocked `discord.js` stub + sealed `tests/smoke/helpers/network-observer.js`; asserts no HTTP/DNS/socket reach at module-load or factory invocation. No `node --test` execution this subphase.
- **Codex review chain:** (a) pre-implementation DESIGN-ONLY plan review of each new file's contract + side-effect-free assertion + ASCII-only comment plan; (b) post-implementation SAFE IMPLEMENTATION review citing each new file's exact line ranges + ASCII-only WHY comments + module-load no-network proof + no Unicode `→` (U+2192) / `§` (U+00A7); (c) DOCS-ONLY review of CLOSEOUT.
- **Operator approvals required (G-2):** open-phase + commit-only + push + CLOSEOUT + optional CLOSEOUT-SYNC.
- **Authorizes:** nothing downstream.
- **Forbidden:** boot.js edit; `package*.json` edit; sealed src edit; test execution; real network reach; real token use; real Discord gateway connect; real outbound message send; deploy.

### G-3 — BOOT-JS-GATE-9-WIRING (Mode 5 HIGH-RISK IMPLEMENTATION with non-activation scope)

- **Mode:** 5 (HIGH-RISK IMPLEMENTATION with non-activation scope per correction A). **Highest-risk subphase** — touches sealed `boot.js` Stage 12/13/15 wiring + AMENDMENT-3/5/6/7 invariants.
- **Repo touch:** Relay repo only.
- **Files touched (per correction E):** `src/runtime/boot.js` plus one new mocked boot wiring test only — exactly these two files.
- **Files NOT touched:** all NEW G-2 modules (sealed); all other src files; `package*.json`; all other `tests/smoke/*` files.
- **Sealed-wiring invariants preserved verbatim:** AMENDMENT-3 `sealPending()` 0o555; AMENDMENT-5 polyfill at `src/verify/schema-validator.js:119-128`; AMENDMENT-6 object-map guard at `src/runtime/boot.js:360-371`; AMENDMENT-7 non-boot rewrite patterns in 4 files; CASE-09 5 top-level REDACT_PATHS literals at `src/log.js:34-38` + ASCII-only WHY comment at `:27-33`; CASE-12 `current >= channelCap.maxPerWindow` at `src/verify/limits.js:84` + ASCII-only WHY comment at `:44-46`; Phase D DP-5 `MESSAGE_STORE_PATH` validation; halt.js RE-4; `rate-limit-state.js` canonical contract; `boot.js` Stage 12/13/15 sequence.
- **Tests:** 1 NEW test file (number to be locked at G-3 pre-open): mocked-boot test asserting gate-9 wiring activates only under explicit gate-9 entry path; no real Discord client construction; no real network; AMENDMENT-7 helper pattern. No `node --test` execution this subphase.
- **Codex review chain:** (a) pre-implementation DESIGN-ONLY plan review citing exact line insertions in `boot.js` + preservation of every named AMENDMENT invariant by line range + ASCII-only comments + no Unicode `→` / `§`; (b) post-implementation SAFE IMPLEMENTATION review verifying byte-identity of pre-existing wiring regions via line-by-line audit + no regression in the existing 11+ active smoke tests at module-load; (c) DOCS-ONLY review of CLOSEOUT.
- **Operator approvals required (G-3):** open-phase + commit-only + push + CLOSEOUT + optional CLOSEOUT-SYNC.
- **Authorizes:** nothing downstream.
- **Forbidden:** any non-`boot.js` src edit this subphase; `package*.json` edit; any test file other than the 1 mocked boot wiring test; test execution; real token use; real Discord gateway connect; real network reach; deploy; Discord platform action.

### G-4 — INTEGRATION-TESTS (Mode 5 HIGH-RISK IMPLEMENTATION with non-activation scope)

- **Mode:** 5 (HIGH-RISK IMPLEMENTATION with non-activation scope; tests-only, no source touch).
- **Repo touch:** Relay repo only.
- **Files touched:** NEW test files only — proposed: Send Message wrapper integration test + egress allowlist hook test + egress event log test + gate-9 network-anomaly verifier test (4 NEW test files; exact numbering locked at G-4 pre-open and gate-aligned). All NEW tests under sealed AMENDMENT-7 helper pattern + mocked `tests/smoke/helpers/network-observer.js`.
- **Files NOT touched:** all src files (sealed at G-3); `package*.json`; existing `tests/smoke/*` files; the G-2 and G-3 mocked tests are also preserved verbatim.
- **Helper reuse:** sealed `tests/smoke/helpers/network-observer.js` + `tests/smoke/helpers/synthetic-message.js` (no edits).
- **Tests:** no `node --test` execution this subphase (deferred to G-5 smoke RUN-10).
- **Codex review chain:** (a) pre-implementation DESIGN-ONLY plan of each new test's assertions + mock-injection contract + no-real-network guarantee; (b) post-implementation SAFE IMPLEMENTATION review on the NEW test files; (c) DOCS-ONLY review of CLOSEOUT.
- **Operator approvals required (G-4):** open-phase + commit-only + push + CLOSEOUT + optional CLOSEOUT-SYNC.
- **Authorizes:** nothing downstream.
- **Forbidden:** source edit; existing test edit; `package*.json` edit; test execution; real network reach; real token; real outbound send; Discord platform action; deploy.

### G-5 — POST-IMPLEMENTATION-SMOKE-RUN-10 (Mode 4 SAFE EXECUTION)

- **Mode:** 4 (SAFE EXECUTION; single approved smoke-test run; not Mode 5 because no source/test edits in this subphase).
- **Repo touch:** none directly; runs `node --test --test-concurrency=1` from Relay repo against sealed source/tests; produces evidence under parent-repo untracked carve-out `orchestrator/handoffs/evidence/F-HALT-SMOKE-RUN-10/`.
- **Files touched:** none in Relay tracked tree; only parent-repo untracked carve-out populated with TAP + SHA-256 + diff artifacts.
- **Smoke command:** verbatim per RUN-8/RUN-9 hardened §4 capture block — `set -o pipefail; node --test --test-concurrency=1 tests/smoke/*.test.js | tee tap-run-1.txt; PIPELINE_STATUS=$?; printf '%d\n' "$PIPELINE_STATUS" > tap-run-1.exit-code.txt; test -s tap-run-1.txt`.
- **Expected TAP:** `# tests 13+N / # pass 13+N / # fail 0 / # cancelled 0 / # skipped 0 / # todo 0` where N = total new tests added across G-2 + G-3 + G-4. Exact N declared in pre-execution preflight.
- **Preflight:** adapted RUN-9 P1-P19 plus new gates: P20 = AMENDMENT-3/5/6/7 invariants re-verified; P21 = G-1/G-2/G-3/G-4 commit SHAs all reachable on Relay HEAD; P22 = `package-files-diff` strict-rule pre-check (correction F enforcement); P23 = sealed-handoff guard (G-DESIGN at parent `66af7df…` byte-identical; G-READINESS-DESIGN at this DESIGN-SPEC's commit SHA byte-identical).
- **Byte-identity audits post-run (correction F applied verbatim):**
  - **`package-files-diff.txt` may be non-empty ONLY for the pre-approved discord.js pinned-version dependency diff from G-1 and its expected transitive dependencies.** Any unapproved package addition, removal, version drift, script change, lockfile metadata drift, or non-Discord dependency is **RUN FAIL**.
  - `tests-smoke-diff.txt` must be 0 bytes (no test mutation during RUN-10).
  - `src-touched-diff.txt` must be 0 bytes (no source mutation during RUN-10).
  - Relay HEAD pre = post; Relay `git status --short` pre = post = empty.
- **Codex review chain:** (a) pre-execution DESIGN-ONLY plan review of RUN-10 preflight + capture block + expected TAP; (b) DOCS-ONLY review of RUN-10-CLOSEOUT diff (no SAFE IMPLEMENTATION review needed — no source/test edits); (c) DOCS-ONLY review of optional CLOSEOUT-SYNC.
- **Operator approvals required (G-5):** open-phase (RUN-10 SAFE EXECUTION) + **single-use smoke-execution approval** authorizing exactly one `node --test --test-concurrency=1` run + commit-only (RUN-10-CLOSEOUT 3-file status-doc scope) + push + optional CLOSEOUT-SYNC.
- **Authorizes:** nothing downstream. Phase G code completion is the terminal goal of RUN-10. Deployment/activation remain separately gated per sealed G-DESIGN Edit 4 (deployment-separation): "Gate 9 code completion in Phase G does not authorize Relay deployment and does not by itself satisfy the canonical deployment prerequisite; Railway/deploy remains forbidden until a separate authorized deployment phase and later Stage 5+/activation gates."
- **Forbidden:** source edit during RUN-10; test edit during RUN-10; `package*.json` edit; deploy; Relay activation; Stages 7-10b opening; Railway / DB / Kraken / env / secrets / trading.

---

## §3 — Cross-cutting invariants (all Phase G subphases)

1. Approvers exactly `{Victor}` — Codex review verdicts do NOT constitute operator approval at any boundary.
2. Three-way SHA consistency PASS required post-push at every commit boundary (parent local HEAD = parent origin/main = parent live remote `refs/heads/main` for parent commits; Relay local HEAD = Relay origin/main = Relay live remote `refs/heads/main` for Relay commits).
3. ASCII-only WHY comments — no Unicode arrow `→` (U+2192) or Unicode `§` (U+00A7) in new source comments (CASE-09 + CASE-12 precedent).
4. Sealed handoff preservation — `COMM-HUB-RELAY-RUNTIME-IMPLEMENT-G-DESIGN.md` at parent `66af7df…` is preserved verbatim through every subphase; never edited. This G-READINESS-DESIGN handoff (sealed by this DESIGN-SPEC) is also preserved verbatim through every subphase.
5. Sealed AMENDMENT / CASE / Phase invariant preservation — AMENDMENT-3 / 5 / 6 / 7 / CASE-09 / CASE-12 / SCAFFOLD-REPAIR Path D / Phase D DP-5 / halt.js RE-4 / `rate-limit-state.js` / `boot.js` Stage 12/13/15 invariants preserved verbatim; verified at each subphase boundary by direct line-range audit.
6. F-HALT-SMOKE `13/13/0/0` baseline carried forward; RUN-10 raises to `13+N/13+N/0/0` with N new tests added across G-2 + G-3 + G-4; no regression of any existing Case 1-13.
7. Untracked carve-outs preserved — `orchestrator/handoffs/evidence/` + `position.json.snap.20260502T020154Z` remain untracked at every commit.
8. Per Rule 1 — one canonical CLOSEOUT plus at most one optional CLOSEOUT-SYNC per subphase; no recursive paperwork.
9. Relay activation status: DORMANT preserved across all 6 subphases. Activation precondition count is not re-stated; downstream activation remains separately gated.
10. Autopilot DORMANT preserved across all 6 subphases.
11. Codex review chain at every boundary — DESIGN-ONLY (pre-plan) + SAFE IMPLEMENTATION (post-diff) + DOCS-ONLY (CLOSEOUT). Skipping any review tier is a phase fail.
12. No bundling — each subphase is a single commit; combining G-N + G-N+1 in one commit is forbidden.
13. No skipping — subphase order is strict G-0 → G-1 → G-2 → G-3 → G-4 → G-5; jumping ahead requires opening a separate named operator phase to re-justify the skip.
14. Strict `package-files-diff` rule per sealed G-DESIGN Edit 3 + correction F — any unapproved package addition / removal / version drift / script change / lockfile metadata drift / non-Discord dependency in RUN-10 is RUN FAIL.
15. Each subphase requires separate operator open + Codex review (advisory) + commit-only approval + push approval + CLOSEOUT, plus any subphase-specific special approvals (G-1 Gate-10 RED-tier; G-5 single-use smoke). Codex review verdicts do NOT constitute operator approval. *(Per correction G: numeric approval-count estimates are intentionally omitted from this codified doc.)*

---

## §4 — Codex review chain record

| Round | Verdict | Required edits | Status |
|---|---|---|---|
| Round 1 — DESIGN-ONLY review of conversation-only G-READINESS-DESIGN | PASS WITH REQUIRED EDITS | 8 corrections (A–H) | Applied verbatim |
| Round 2 — DESIGN-ONLY narrow re-review of revised design | PASS | none | Resolved |
| Codification gate | CLEARED | n/a | Proceeded to this DESIGN-SPEC |

### Round-1 corrections applied verbatim in this codification

- **A (Mode 5 wording):** All `"Mode 5 SAFE IMPLEMENTATION"` wording in §0 / §1 / §2 / §3 replaced with `"Mode 5 HIGH-RISK IMPLEMENTATION with non-activation scope"` to eliminate Mode 4 / Mode 5 confusion.
- **B (G-1 npm registry network exception):** G-1 Gate-10 RED-tier approval requirement now explicitly names package + pinned version + exact install command + one-time npm registry network reach exception + prohibition on unrelated package drift.
- **C (G-2 file naming):** All new gateway module file paths use `src/gateway/*` naming. `src/discord/*` is explicitly rejected. Gate-9 network-anomaly module placement is deferred to G-2 open against existing file structure.
- **D (send-message wrapper):** G-2 `src/gateway/send-message.js` is wrapper construction only — no real token, no gateway connect, no outbound send in tests; never invoked against a real Discord client at G-2.
- **E (G-3 scope wording):** G-3 scope is corrected to `"src/runtime/boot.js plus one new mocked boot wiring test only"` — eliminating the prior `"boot.js only"` ambiguity.
- **F (RUN-10 strict diff):** G-5 RUN-10 `package-files-diff.txt` may be non-empty only for the pre-approved discord.js pinned-version dependency diff and expected transitives from G-1; all other drift is RUN FAIL.
- **G (approval-count omission):** Numeric approval-count estimates removed from §1; structural rule retained (each subphase requires separate operator open + Codex review + commit-only + push + CLOSEOUT + special approvals where applicable).
- **H (parent citation framing):** Parent-repo claims carry as "verified from parent repo by direct operator/Claude grep at parent HEAD `66af7df…`; not independently verified by Codex due to sandbox scope" — see §7 below for the verified citation list.

---

## §5 — Open questions deferred to subphase opens (not blockers for this codification)

1. **Pinned `discord.js` version** — to be named in the G-1 open + Gate-10 RED-tier approval. Recommended pattern: an exact stable release (e.g., `discord.js@14.x.y` exact-pinned via `--save-exact`), not a floating `^14.0.0` range, to keep the `package-files-diff` audit deterministic.
2. **Gate-9 network-anomaly module placement** — `src/gateway/gate-9-network-anomaly.js` vs. `src/verify/gate-9-network-anomaly.js`. To be finalized at G-2 open against the existing Relay file structure (Codex round-1 inspection noted an existing `network-anomaly.js` in Relay).
3. **G-2 / G-3 / G-4 new test file numbering** — tentative numbers shift based on what other smoke tests exist between G-5 and a future RUN. Pre-RUN-10 preflight will lock numbers.
4. **RUN-10 evidence file count** — RUN-9 had 18 evidence files; RUN-10 should add `relay-handoff-guard.sha256` and `g-readiness-handoff-guard.sha256` (sealed handoff preservation proofs). Proposed 20 files; operator confirms at G-5 open.
5. **Whether to require an additional Codex DESIGN-ONLY review at each subsequent subphase pre-open beyond the chain already prescribed** — open question to be resolved at each subphase open.

---

## §6 — Non-authorization clauses

This G-READINESS-DESIGN-SPEC does **NOT** authorize:

- Opening `COMM-HUB-RELAY-RUNTIME-IMPLEMENT-G-1` (DISCORD-JS-INSTALL) — requires separate named operator open + named Gate-10 RED-tier approval
- Opening any of G-2 / G-3 / G-4 / G-5 — each requires its own separate named operator open
- discord.js install of any version
- Any `package.json` / `package-lock.json` edit
- Any source edit in either repo (parent or Relay)
- Any test edit in either repo
- Any test execution (`node --test`, `node --check`, `npm install`, `npm ci`, `npx`, `npm test`)
- Discord platform action; bot creation; token use; permission grant; webhook creation; channel post; message publish; gateway IDENTIFY
- Real network reach (beyond the named one-time npm registry exception in G-1, which is itself NOT pre-authorized by this DESIGN-SPEC)
- Relay activation; bot login
- Stage 5 install resumption (CONSUMED at `40f3137e…` — separately gated)
- Stages 7-10b (Discord activation cascade)
- Railway / deploy (per sealed G-DESIGN Edit 4)
- DB / Kraken / env / secrets / armed-trading flag / trading
- Autopilot Loop B/C/D / CEILING-PAUSE change
- External Hermes Agent (Nous/OpenRouter)
- Scheduler / cron / webhook / MCP install
- Permission widening
- Modifying any sealed amendment (AMENDMENT-3 / 5 / 6 / 7 / CASE-09 / CASE-12 / SCAFFOLD-REPAIR Path D / Phase D DP-5 / halt.js RE-4 / `rate-limit-state.js` / `boot.js` Stage 12/13/15)
- Migration 008+ / DASH-6 / D-5.12f-h / Migration 009+ / Phase H
- Introduction of Unicode arrow `→` (U+2192) or Unicode `§` (U+00A7) in new source comments
- Editing the sealed `orchestrator/handoffs/COMM-HUB-RELAY-RUNTIME-IMPLEMENT-G-DESIGN.md` at parent `66af7df…`
- Editing this G-READINESS-DESIGN handoff after it seals at parent `<DESIGN-SPEC commit SHA>`
- Any commit / push / deploy from any G-N subphase outside the named scope of that subphase
- Bundling subphases
- Skipping a subphase

**This web project is entirely separate from the trading runtime `dashboard.js`. It does not modify, replace, or supplement live trading functionality.**

---

## §7 — Parent-repo citations (verified from parent repo by direct operator/Claude grep; not independently verified by Codex due to sandbox scope)

Verified at parent HEAD `66af7df236745da8a3b3df92463166bc4d8fabf8` via `git show 66af7df:<path>` + `sed -n '<line>p'` + `grep -c` against the sealed parent-repo content:

| Citation | Verification method | Result |
|---|---|---|
| `orchestrator/handoffs/COMM-HUB-RELAY-RUNTIME-IMPLEMENT-G-DESIGN.md` exists at parent `66af7df…` | `git show 66af7df:...` returned 313 lines | ✓ PRESENT |
| Sealed G-DESIGN Codex Edit 1 (Stage 7 mock/no-network wording) embedded | grep for `"no real token, no real Discord gateway connection, no real network reach"` returned count 2 | ✓ EMBEDDED |
| Sealed G-DESIGN Codex Edit 2 (Gate-10 RED-tier package approval) embedded | grep for `"discord.js package.json/package-lock.json change requires a named Gate-10 RED-tier operator approval"` returned count 2 | ✓ EMBEDDED |
| Sealed G-DESIGN Codex Edit 3 (RUN-10 package-files-diff strict rule) embedded | grep for `"package-files-diff.txt may be non-empty only for the pre-approved discord.js dependency diff"` returned count 2 | ✓ EMBEDDED |
| Sealed G-DESIGN Codex Edit 4 (deployment-separation) embedded | grep for `"Gate 9 code completion in Phase G does not authorize Relay deployment"` returned count 2 | ✓ EMBEDDED |
| RUNTIME-DESIGN line 1055 — `"Only after gate 9 may the Relay runtime be deployed to Railway."` | `git show 66af7df:orchestrator/handoffs/COMM-HUB-RELAY-RUNTIME-DESIGN.md \| sed -n '1055p'` matched verbatim | ✓ VERIFIED |
| E-VERIFY-DESIGN line 50 — `"Mode 5 HIGH-RISK is reserved for Phase G-GATEWAY (the first phase that introduces Discord network behavior)."` | `git show 66af7df:orchestrator/handoffs/COMM-HUB-RELAY-RUNTIME-IMPLEMENT-E-VERIFY-DESIGN.md \| sed -n '50p'` matched verbatim | ✓ VERIFIED |
| RUNTIME-DESIGN section 10 line 453 — `"**Layer 2 — Runtime-side HTTP client allowlist hooks.** Relay wraps its HTTP client (the one discord.js uses internally) with an allowlist hook…"` | `git show 66af7df:orchestrator/handoffs/COMM-HUB-RELAY-RUNTIME-DESIGN.md \| sed -n '453p'` matched verbatim | ✓ VERIFIED |

**Verification framing:** "Verified from parent repo by direct operator/Claude grep at parent HEAD `66af7df236745da8a3b3df92463166bc4d8fabf8`; not independently verified by Codex due to sandbox scope. Codex DESIGN-ONLY round-2 narrow re-review confirmed this framing is sufficient for codification (Confirmation 8 of 10)."

---

## §8 — Carry-forward state

- **Parent HEAD at this codification time:** `39d4f4dfe74dcdc03d213cfe541844230179f77d` (G-DESIGN-SPEC-CLOSEOUT-SYNC SEALED; pre-G-READINESS-DESIGN-SPEC anchor)
- **Relay HEAD:** `f5c5cdbd7f3e6412428049af18539e299c0376b1` (sealed since F-HALT-SMOKE-CASE-12; untouched through entire G-DESIGN-SPEC + G-DESIGN-SPEC-CLOSEOUT-SYNC + this G-READINESS-DESIGN-SPEC)
- **F-HALT-SMOKE terminal end-state:** `13/13/0/0` (achieved at parent `2306463…`; preserved at parent `66af7df…` and `39d4f4d…`)
- **Relay-runtime:** DORMANT preserved
- **Autopilot:** DORMANT preserved (verified at `eff4dd22…`)
- **Approvers:** exactly `{Victor}`
- **Migration 008:** APPLIED at `189eb1be…` preserved; N-3 CLOSED preserved
- **Stage 5 Gate-10 install approval:** CONSUMED at `40f3137e…` preserved (separately gated from G-1)
- **Sealed `orchestrator/handoffs/COMM-HUB-RELAY-RUNTIME-IMPLEMENT-G-DESIGN.md`:** preserved verbatim at parent `66af7df…`
- **Parent cascade:** `c642b2b…`, `49d6f07…`, `e9984fa…`, `fdbcce2…`, `757a86d…`, `31ea6f5…`, `5e5456a…`, `23ebfc35…`, `c250f0c5…`, `0e9a678e…`, `41fa779a…`, `45d91d23…`, `b880be9b…`, `c7f92a78…`, `90d97114…`, `df667ed…`, `e3e21cd…`, `052ef72…`, `23ad7c7…`, `2572899…`, `9adc11d…`, `a3a7e35…`, `9104980…`, `2306463…`, `66af7df…`, `39d4f4d…` preserved
- **Relay-repo lettered chain:** preserved through F-HALT-SMOKE-CASE-12 at Relay `f5c5cdb…`
- **Antigravity chain SHAs:** preserved
- **PROJECT-PROGRESS-DASHBOARD cascade:** preserved
- **CEILING-PAUSE history:** preserved (broken via `ARC-8-UNPAUSE` at `22ba4a76…`; phase-loop counter 0 of 3)
- **Untracked carve-outs:** `position.json.snap.20260502T020154Z` + `orchestrator/handoffs/evidence/` (RUN-1 through RUN-9) preserved untracked

---

## §9 — Next-phase gate

This G-READINESS-DESIGN-SPEC pre-authorizes **nothing downstream**. The next phase in the Phase G sequence — `COMM-HUB-RELAY-RUNTIME-IMPLEMENT-G-1` (DISCORD-JS-INSTALL; Mode 5 HIGH-RISK IMPLEMENTATION + Gate-10 RED-tier) — requires a separate named operator open including the discord.js pinned version, exact install command, and Gate-10 RED-tier approval per §2 G-1 above.

Per Rule 1: this DESIGN-SPEC is the codification of G-READINESS-DESIGN; one optional `COMM-HUB-RELAY-RUNTIME-IMPLEMENT-G-READINESS-DESIGN-SPEC-CLOSEOUT-SYNC` may follow after this seals; no recursive paperwork beyond.

---

## §10 — ASCII discipline (codified doc + future subphase source comments)

This codified handoff uses ASCII-friendly punctuation throughout. The em-dash characters `—` and en-dash characters `–` appearing in this handoff are within a Markdown narrative document and do not constitute source-code comments; the prohibition on Unicode arrow `→` (U+2192) and Unicode `§` (U+00A7) glyphs applies to **new source-code comments** authored in future Phase G subphases (G-2 / G-3 / G-4), per CASE-09 + CASE-12 sealed precedent. Markdown headers using the section symbol convention here use `§` in the markdown body for cross-reference clarity; per CASE-09 + CASE-12 source-code precedent, source comments must substitute ASCII `section` for the Unicode `§` glyph.

---

## §11 — Reference anchors

| Anchor | Value |
|---|---|
| This DESIGN-SPEC's authoring source | conversation-approved G-READINESS-DESIGN Mode 2 design (this Claude session) |
| Codex review chain | round-1 PASS WITH REQUIRED EDITS + round-2 PASS |
| Codex required edits | 8 (A through H) — all applied verbatim |
| Sealed precedent design | `orchestrator/handoffs/COMM-HUB-RELAY-RUNTIME-IMPLEMENT-G-DESIGN.md` at parent `66af7df…` |
| Sealed precedent CLOSEOUT-SYNC | `COMM-HUB-RELAY-RUNTIME-IMPLEMENT-G-DESIGN-SPEC-CLOSEOUT-SYNC` at parent `39d4f4d…` |
| Future Phase G subphase order | G-0 (this codification) → G-1 → G-2 → G-3 → G-4 → G-5 |
| Future subphase mode classification | G-1: Mode 5 + Gate-10 RED-tier; G-2/G-3/G-4: Mode 5 HIGH-RISK IMPLEMENTATION with non-activation scope; G-5: Mode 4 SAFE EXECUTION |
| Phase G implementation terminal goal | RUN-10 TAP `13+N/13+N/0/0`; Relay-runtime activation remains separately gated; deployment remains separately gated per sealed G-DESIGN Edit 4 |
