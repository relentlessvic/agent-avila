# COMM-HUB-RELAY-RUNTIME-IMPLEMENT-G-DESIGN

**This handoff codifies the Codex-approved (PASS WITH REQUIRED EDITS; 4 required edits applied verbatim; Codex Goal 11 flagged test-recommendation incorporated; parent-repo citations re-verified as VERIFIED) conversation-only `COMM-HUB-RELAY-RUNTIME-IMPLEMENT-G-DESIGN` (Mode 2 / DESIGN-ONLY, no commit). This codification phase is `COMM-HUB-RELAY-RUNTIME-IMPLEMENT-G-DESIGN-SPEC` (DOCS-ONLY / Mode 3). The future implementation phase `COMM-HUB-RELAY-RUNTIME-IMPLEMENT-G` is HIGH-RISK IMPLEMENTATION (Mode 5) — separately gated; the FIRST HIGH-RISK phase in the Relay chain; not authorized by this codification.**

**Codification provenance:** F-HALT-SMOKE-RUN-9 (Mode 4 SAFE EXECUTION) PASSed at TAP tally `13 / 13 / 0 / 0` (maximum-validation terminal end-state; Relay HEAD `f5c5cdb…`; parent CLOSEOUT at `2306463…`). With the F-HALT-SMOKE suite at canonical end-state, the project is structurally ready to design Phase G — the gateway/network-anomaly verification layer that completes the runtime structurally but does NOT activate Relay. Phase G is the FIRST HIGH-RISK phase in the project per sealed E-VERIFY-DESIGN line 50; future Phase G implementation is Mode 5 HIGH-RISK IMPLEMENTATION, NOT Mode 4 SAFE IMPLEMENTATION. A Codex DESIGN-ONLY review of this Phase G design returned PASS WITH REQUIRED EDITS — 15 review goals 11 PASS + 4 PASS WITH FLAG; 4 required edits applied verbatim in this codification (Stage 7 wording correction; dependency Gate-10 RED-tier approval sentence; RUN-10 package-files-diff strict rule; deployment-separation sentence); Codex Goal 11 flagged recommendation incorporated (side-effect-free Discord client construction test); 4 parent-repo citations re-verified as VERIFIED at parent HEAD `23064636573d43b429a70cf001656fcf8b0578a1`. Codex recommended that this design be codified as a parent-repo DESIGN-SPEC handoff (this file) before future Mode 5 HIGH-RISK IMPLEMENTATION, consistent with AMENDMENT-5 / AMENDMENT-6 / AMENDMENT-7 / CASE-09 / CASE-12 precedent. **This file does NOT itself constitute an execution authorization. Codex review verdicts are not operator approval.** Approvers exactly `{Victor}`.

---

## §0 — Phase classification & current anchors

| Property | Value |
|---|---|
| Phase name (this codification phase) | `COMM-HUB-RELAY-RUNTIME-IMPLEMENT-G-DESIGN-SPEC` |
| Phase mode (this codification phase) | Mode 3 / DOCS-ONLY |
| Original phase name (codified design) | `COMM-HUB-RELAY-RUNTIME-IMPLEMENT-G-DESIGN` |
| Original phase mode | Mode 2 / DESIGN-ONLY (conversation-only; no commit) |
| Future implementation phase (gated; NOT authorized) | `COMM-HUB-RELAY-RUNTIME-IMPLEMENT-G` — **Mode 5 HIGH-RISK IMPLEMENTATION** (FIRST HIGH-RISK phase per E-VERIFY-DESIGN line 50) |
| Future re-execution phase (gated; NOT authorized) | `COMM-HUB-RELAY-RUNTIME-IMPLEMENT-F-HALT-SMOKE-RUN-10` (Mode 4 SAFE EXECUTION) |
| Parent-repo HEAD anchor | `23064636573d43b429a70cf001656fcf8b0578a1` (RUN-9-CLOSEOUT sealed) |
| Relay-repo HEAD anchor | `f5c5cdbd7f3e6412428049af18539e299c0376b1` (CASE-12 SAFE IMPLEMENTATION sealed; F-HALT-SMOKE `13/13/0/0` end-state) |
| Parent repo working tree at codification time | the 4 G-DESIGN-SPEC docs are present as uncommitted on-disk changes alongside the two authorized untracked carve-outs (`position.json.snap.20260502T020154Z` + `orchestrator/handoffs/evidence/`); no other tracked file modified |
| Relay repo working tree at codification time | clean |
| Relay-runtime status | DORMANT preserved |
| Autopilot status | DORMANT preserved |
| Approvers | exactly `{Victor}` |

---

## §1 — What Phase G adds (gate-9-functional code paths; runtime structurally complete but still DORMANT)

Per sealed RUNTIME-DESIGN line 1055 + E-VERIFY-DESIGN §8 (lines 253-268), Phase G ("GATEWAY") owns 5 layers:

| Layer | Adds |
|---|---|
| Discord client construction | `discord.js` library instantiation; gateway IDENTIFY + READY handshake code path (no real token use at implementation time) |
| Send Message API wrapper | Send-Message API call wrapper; called only by Phase F's publish pipeline at activation time |
| Egress allowlist hook installation | Layer 2 of canonical RUNTIME-DESIGN §10 (line 453); HTTP outbound interceptor that enforces hostname allowlist BEFORE any network reach. Phase F injects the resulting `allowlistHookRef` into `createNetworkAnomalyGate` (gate 9) |
| Egress event log | in-memory ring buffer of egress observations. Phase F injects `egressEventLogRef` into gate 9 |
| Gate 9 functionality | once Phase G lands, the network-anomaly gate (currently stub-safe per E-VERIFY-DESIGN §5 gate 9) becomes functional and halts on hook-missing (class 32), egress anomaly (class 6), or hook bypass (class 23) |

After Phase G lands and gate 9 is functional, the Relay runtime is **structurally complete** but still **DORMANT** — Phase G adds the code path, not the activation.

**Deployment-separation sentence (Codex Edit 4 verbatim):**

Gate 9 code completion in Phase G does not authorize Relay deployment and does not by itself satisfy the canonical deployment prerequisite; Railway/deploy remains forbidden until a separate authorized deployment phase and later Stage 5+/activation gates.

---

## §2 — Future Relay-repo files (illustrative; not authorized)

**NEW files (Phase G HIGH-RISK IMPLEMENTATION; separately gated):**
- `src/gateway/discord-client.js` — discord.js client factory; module-load-safe; no auto-login
- `src/gateway/egress-allowlist-hook.js` — HTTP outbound interceptor installer + hostname-allowlist enforcement
- `src/gateway/egress-event-log.js` — in-memory ring buffer (bounded size; FIFO; tamper-evident if possible)
- `src/gateway/publish.js` — Send-Message API wrapper invoked by Phase F publish pipeline
- `tests/smoke/13-gate-9-network-anomaly-halt.test.js` (or similar; non-boot direct verifier per AMENDMENT-7 precedent)
- `tests/integration/phase-g-allowlist-hook.test.js`
- `tests/integration/phase-g-egress-event-log.test.js`
- `tests/integration/phase-g-discord-client-side-effect-free.test.js` (Codex Goal 11 flagged recommendation; see §5)

**MODIFIED files (Phase G HIGH-RISK IMPLEMENTATION; separately gated):**
- `src/runtime/boot.js` Stage 9-10 — wire `allowlistHookRef` + `egressEventLogRef` into `createNetworkAnomalyGate(...)` (re-bind gate 9 after Phase G factories exist; similar pattern to Stage 15 limits-gate re-binding)
- `package.json` + `package-lock.json` — add `discord.js` dependency

**Dependency Gate-10 RED-tier approval sentence (Codex Edit 2 verbatim):**

Phase G HIGH-RISK IMPLEMENTATION does not implicitly authorize dependency or lockfile edits. The discord.js package.json/package-lock.json change requires a named Gate-10 RED-tier operator approval before the package files are edited.

**Sealed and PRESERVED VERBATIM (must not be touched):**
- All `src/verify/*` (Phase E sealed; gate 1-11 verifier modules)
- `src/store/*` (Phase D sealed; DP-5 hardening at `source-of-truth.js:263-276`)
- `src/log.js` (CASE-09 sealed; REDACT_PATHS extended)
- `src/config.js` (Phase C sealed)
- `src/runtime/halt.js` (RE-4 contract sealed)
- `src/runtime/rate-limit-state.js` (canonical contract sealed)
- All `tests/smoke/*` Cases 1-12 (sealed through CASE-09 + CASE-12)
- All `tests/smoke/helpers/*`
- All sealed parent-repo handoffs (RUNTIME-DESIGN, E-VERIFY-DESIGN, C-CONFIG-DESIGN, COMM-HUB-RELAY-RULES, and all others)

ASCII discipline: no Unicode `→` (U+2192) or `§` (U+00A7) in any new source comment (CASE-09 + CASE-12 ASCII-only precedent).

---

## §3 — Forbidden actions

Phase G HIGH-RISK IMPLEMENTATION (when separately approved) does NOT authorize and MUST NOT perform:

- **Discord platform actions:** application creation, bot creation, bot invite, permission grant, channel post, role change, webhook creation, gateway IDENTIFY with a real token — all separately gated through Stages 7-10b of the COMM-HUB-RELAY-RULES activation cascade
- **Real Discord token use:** no `DISCORD_BOT_TOKEN` consumption; tests mock the client; module load is side-effect-free
- **Network reach during tests:** smoke + integration must mock `discord.js`; CASE-10 (`Case 10 — no network calls during dry-run stub boot`) regression must continue passing
- **Railway / deploy:** Phase H concern; not authorized
- **`MANUAL_LIVE_ARMED` flag flip:** Stages 7-10b concern; trading-runtime-adjacent
- **DB / Kraken / exchange API:** Phase H + trading concern
- **env / secrets / `.env*` file edits**
- **CEILING-PAUSE state change**
- **Autopilot Loop B/C/D activation**
- **External Hermes Agent (Nous/OpenRouter)**
- **Migration 008+ / DASH-6 / D-5.12f-h / Migration 009+**
- **Phase H (Dockerfile / Railway config / CI workflows / tests outside Phase E/G scope)**
- **Modifying ANY sealed Phase C/D/E/F surface** — Phase G is purely additive in `src/gateway/*`, plus a minimal `boot.js` wiring update + `package*.json` dependency addition (per Codex Edit 2 dependency-approval sentence)
- **AMENDMENT-3 / 5 / 6 / 7 / CASE-09 / CASE-12 / SCAFFOLD-REPAIR Path D / Phase D DP-5 / halt.js RE-4 modification**
- **Antigravity install change / workspace reconfiguration**
- **Scheduler / cron / webhook / MCP install / permission widening**
- **Any network lookup at design or implementation time**
- **`ajv-formats` import or any other new dependency beyond `discord.js`** — Phase B lockfile policy
- **Ajv `strict` mode setting change**
- **Introduction of Unicode `→` (U+2192) or `§` (U+00A7) glyphs in new source comments**

---

## §4 — Codex review chain (multi-stage; separately gated)

1. **DESIGN-ONLY review** of this Phase G design — COMPLETED at this codification phase: PASS WITH REQUIRED EDITS; 4 required edits applied verbatim; Goal 11 flagged recommendation incorporated; parent-repo citations re-verified as VERIFIED.
2. **DOCS-ONLY review** of this CASE-G-DESIGN-SPEC codification — pending (this phase's review goal).
3. **HIGH-RISK IMPLEMENTATION pre-edit review** (Mode 5; stricter than SAFE IMPLEMENTATION pre-edit) — MANDATORY before any source edit. Specifically scrutinize:
   - **Allowlist hook integrity:** no bypass paths; Layer 1 (canonical `net` module imports) + Layer 2 (hook itself per RUNTIME-DESIGN §10 line 453) combine to make egress un-bypassable
   - **Egress event log ring-buffer correctness:** bounded size; FIFO; no overflow leak; no unbounded memory growth
   - **discord.js client construction:** no auto-login at module load; no auto-IDENTIFY; explicit operator-gated entry point; tests use mock
   - **`package.json` / `package-lock.json` Gate-10 scope:** `discord.js` added with pinned version + integrity hash; no transitive surprise dependencies; Phase B lockfile policy respected; Codex Edit 2 dependency-approval sentence honored
   - **No `process.env` reads at module load** in Phase G modules
   - **No `dotenv` import** anywhere
   - **No fs writes at module load**
   - **Hard guarantee:** Phase G modules importable without triggering Discord network traffic (Case 10 regression check)
   - **Tests use mocked discord.js client**, not real one
   - **Gate 9 halt classes 6 / 23 / 32 correctly bound** at boot wiring
   - **F-HALT-SMOKE compliance maintained** — RUN-10 (or equivalent) after Phase G lands must still achieve maximum-validation
   - **ASCII-only WHY comments**; no `§` or `→`
4. **HIGH-RISK IMPLEMENTATION post-edit on-disk source review** (Mode 5) — MANDATORY.
5. **Codex review of gate-9 smoke + integration test additions** — verify mocked-client coverage, ring-buffer bound, hook coverage, and the Goal-11 side-effect-free Discord client construction test (§5).
6. **Codex review of Stage 5 install resumption** (separately gated; NOT part of Phase G).
7. **Codex review of each Stage 7-10b activation step** (separately gated).

---

## §5 — Tests and smoke checks required (4 categories)

**Category 1 — Gate-9 halt classes (non-boot direct gate-verifier per AMENDMENT-7 precedent):**
- Allowlist hook present + intact: gate-9 PASS
- Allowlist hook missing → halt 32 (hook-missing / integrity-failure)
- Egress anomaly (non-allow-listed hostname attempted) → halt 6
- Hook bypass attempt (direct HTTP without going through hook) → halt 23

**Category 2 — Allowlist hook integration (mocked discord.js):**
- All HTTP attempts intercepted (no bypass paths)
- Hostname allowlist enforced before request issuance
- Layer 1 (`net` import) + Layer 2 (hook) defense-in-depth verified

**Category 3 — Egress event log ring buffer:**
- Bounded size respected
- FIFO ordering
- No overflow leak
- Tamper-evident behavior (if implemented)

**Category 4 — Discord client construction side-effect-free + no network reach (Codex Goal 11 flagged recommendation):**

An integration test that imports `src/gateway/discord-client.js` under a network observer (e.g. existing `tests/smoke/helpers/network-observer.js`) + a mocked discord.js stub; assert that module import alone (and even factory invocation in DORMANT mode without IDENTIFY) does NOT trigger any HTTP / DNS / socket reach. Mirrors the Case 10 (`no network calls during dry-run stub boot`) pattern at module-load time and factory-construction time.

**RUN-10 (post-Phase-G smoke re-run; Mode 4 SAFE EXECUTION) expected outcomes:**
- F-HALT-SMOKE compliance maintained
- Expected tally: `13 / 13 / 0 / 0` if gate-9 tests live outside `tests/smoke/`, OR `14 / 14 / 0 / 0` if Case 13+ added to smoke suite (TBD in subsequent design refinement; final TBD before CASE-G HIGH-RISK IMPLEMENTATION opens)
- New `src/gateway/*` files included in `src-touched-before/after/diff` SHA-256 byte-identity guard (extending the CASE-09 + CASE-12 pattern from RUN-9)

**RUN-10 package-files-diff strict rule (Codex Edit 3 verbatim):**

package-files-diff.txt may be non-empty only for the pre-approved discord.js dependency diff and its expected transitive dependencies; any unapproved package addition, removal, version drift, script change, lockfile metadata drift, or non-Discord dependency is RUN FAIL.

---

## §6 — Stage 5 install resumption (separate from Phase G)

Stage 5 install resumption REMAINS SEPARATE from Phase G.

Stage 5 was previously consumed at trading-runtime commit `40f3137e842cd60acf1adf17ecc7fe2f0b1b8935` (Gate-10 RED-tier install approval). That approval is CONSUMED and cannot be reused per the ARC-2 Gate matrix.

Phase G HIGH-RISK IMPLEMENTATION adds the code path for Discord integration; it does NOT install or activate the Discord bot. Stage 5 install resumption (separately gated, RED-tier) handles:
- Discord Developer Portal application creation
- Bot user creation
- Initial scope/permission selection
- Discord application registration
- Tokenization (only the path; not the consumption)

Stage 5 install resumption is a separate phase with its own operator approval, Codex review, and execution. NOT authorized by Phase G DESIGN-ONLY or CASE-G-DESIGN-SPEC codification.

---

## §7 — Discord permissions / token usage (separately gated through Stages 7-10b)

Phase G HIGH-RISK IMPLEMENTATION:
- Adds the discord.js client factory (CODE PATH)
- Adds the gateway IDENTIFY handshake (CODE PATH)
- Adds the Send Message wrapper (CODE PATH)
- Adds the egress allowlist hook (Layer 2; CODE PATH)

Phase G does NOT:
- Use a real `DISCORD_BOT_TOKEN`
- Grant any Discord permission
- Invite the bot to any server
- Connect to the Discord gateway
- Send any real message

The actual use of Discord token + permissions is split across Stages 5+:

- **Stage 5 install resumption** — bot creation; first-time token generation
- **Stage 7** (Codex Edit 1 verbatim wording) — Stage 7 (gateway IDENTIFY code path tested only under separately approved mock/no-network conditions; no real token, no real Discord gateway connection, no real network reach; runtime remains FULLY DORMANT)
- **Stage 8** — first real message publish to `#status` under Victor-approved per-message authorization
- **Stage 9** — class-authorization-7 bounded auto-publish (Codex sanity-check workflow)
- **Stage 10a/10b** — broader class-authorization scope expansion under operator-bounded gating

Each Stage 7-10b step is separately gated with its own operator approval, Codex review, and HIGH-RISK action discipline per ARC-2 Gate matrix. NOT authorized by Phase G DESIGN-ONLY or by Phase G HIGH-RISK IMPLEMENTATION.

---

## §8 — Non-authorization clauses

This DESIGN-SPEC codification phase does NOT authorize:

- Opening `COMM-HUB-RELAY-RUNTIME-IMPLEMENT-G` HIGH-RISK IMPLEMENTATION (Mode 5) — separately gated
- Opening `F-HALT-SMOKE-RUN-10` (post-Phase-G smoke re-run; Mode 4 SAFE EXECUTION) — separately gated
- Stage 5 install resumption (RED-tier; Gate-10) — separately gated
- Stages 7 / 8 / 9 / 10a / 10b (Discord activation cascade; HIGH-RISK) — each separately gated
- Discord platform application / bot creation / token use / permission grant / webhook creation / channel post / message publish
- Real gateway IDENTIFY with a real token
- Railway / deploy / `agent-avila-relay` service start/restart / env var change
- Database / Kraken / exchange API / external network call
- env / secrets / `.env*` file edits
- `MANUAL_LIVE_ARMED` flip; any trading action
- Relay activation; bot login
- Autopilot Loop B/C/D execution; CEILING-PAUSE state change
- `npm install discord.js` or any other dependency change (Phase B lockfile + Codex Edit 2 dependency-approval sentence)
- `node --check` / source-edit / schema edit / `package.json` byte change in this DESIGN-SPEC phase
- Any source file modification in this phase
- Migration 008+ / DASH-6 / D-5.12f-h / Migration 009+ / Phase H
- External Hermes Agent (Nous/OpenRouter)
- Scheduler / cron / webhook / MCP install
- Permission widening
- Any network lookup
- Modifying AMENDMENT-3 / 5 / 6 / 7 / CASE-09 / CASE-12 / SCAFFOLD-REPAIR Path D / Phase D DP-5 / halt.js RE-4 / `rate-limit-state.js` / `boot.js` (any portion outside the Phase G additive wiring proposed in §2)
- Introduction of Unicode `→` (U+2192) or `§` (U+00A7) glyphs in new source comments

Codex DESIGN-ONLY review verdict does NOT constitute operator approval. Approvers exactly `{Victor}`.

---

## §9 — Recommended phase cascade

1. **CASE-G-DESIGN** (Mode 2 DESIGN-ONLY, conversation-only) — COMPLETED; Codex DESIGN-ONLY PASS WITH REQUIRED EDITS; 4 required edits applied; Goal 11 flagged recommendation incorporated; citations verified.
2. **CASE-G-DESIGN-SPEC** (Mode 3 DOCS-ONLY, this codification phase) — IN PROGRESS.
3. Codex DOCS-ONLY review of CASE-G-DESIGN-SPEC.
4. CASE-G-DESIGN-SPEC commit + push + (optional CLOSEOUT-SYNC).
5. **CASE-G HIGH-RISK IMPLEMENTATION** (Mode 5; FIRST HIGH-RISK in project) — Relay-repo 4-7 new files + minimal boot.js wiring + package*.json dep addition; HIGH-RISK gates apply; separately gated.
6. Codex HIGH-RISK IMPLEMENTATION pre-edit review.
7. Codex HIGH-RISK IMPLEMENTATION post-edit on-disk source review.
8. CASE-G commit + push + CLOSEOUT.
9. **F-HALT-SMOKE-RUN-10** (Mode 4 SAFE EXECUTION) — post-Phase-G smoke; expected `13/13/0/0` or `14/14/0/0`; `package-files-diff.txt` may be non-empty only per Codex Edit 3 strict rule.
10. RUN-10-CLOSEOUT.
11. (Future) Stage 5 install resumption — separately gated.
12. (Future) Stages 7-10b — each separately gated.

Each step separately gated. None authorized by this CASE-G-DESIGN-SPEC codification.

---

## §10 — Verified parent-repo citations

The following 4 citations were re-verified from sealed parent-repo handoffs at parent HEAD `23064636573d43b429a70cf001656fcf8b0578a1` and carry as VERIFIED into this DESIGN-SPEC:

1. **RUNTIME-DESIGN line 1055** — `"Only after gate 9 may the Relay runtime be deployed to Railway."` (sealed at `orchestrator/handoffs/COMM-HUB-RELAY-RUNTIME-DESIGN.md:1055`)
2. **E-VERIFY-DESIGN line 50** — `"Mode 5 HIGH-RISK is reserved for Phase G-GATEWAY (the first phase that introduces Discord network behavior)."` (sealed at `orchestrator/handoffs/COMM-HUB-RELAY-RUNTIME-IMPLEMENT-E-VERIFY-DESIGN.md:50`)
3. **E-VERIFY-DESIGN section 8 lines 253-268** — Phase G boundary block confirming FIRST HIGH-RISK phase + 5-layer scope (discord.js client construction; gateway IDENTIFY + READY; Send Message API; egress allowlist hook installation; egress event log structure)
4. **RUNTIME-DESIGN section 10 line 453** — `"Layer 2 — Runtime-side HTTP client allowlist hooks. Relay wraps its HTTP client (the one discord.js uses internally) with an allowlist hook…"` — canonical Layer 2 allowlist hook reference

All 4 citations confirmed accurate. No "unverified" marker required.

---

## §11 — Codex DESIGN-ONLY verdict record

Codex DESIGN-ONLY review of CASE-G-DESIGN returned **PASS WITH REQUIRED EDITS** across 15 review goals (11 PASS + 4 PASS WITH FLAG: Goals 3, 11, 12, 15).

**4 required edits applied verbatim in this codification:**

- **Edit 1 — Stage 7 wording** (embedded verbatim in §7 above): "Stage 7 (gateway IDENTIFY code path tested only under separately approved mock/no-network conditions; no real token, no real Discord gateway connection, no real network reach; runtime remains FULLY DORMANT)"
- **Edit 2 — Dependency Gate-10 RED-tier approval sentence** (embedded verbatim in §2): "Phase G HIGH-RISK IMPLEMENTATION does not implicitly authorize dependency or lockfile edits. The discord.js package.json/package-lock.json change requires a named Gate-10 RED-tier operator approval before the package files are edited."
- **Edit 3 — RUN-10 package-files-diff strict rule** (embedded verbatim in §5): "package-files-diff.txt may be non-empty only for the pre-approved discord.js dependency diff and its expected transitive dependencies; any unapproved package addition, removal, version drift, script change, lockfile metadata drift, or non-Discord dependency is RUN FAIL."
- **Edit 4 — Deployment-separation sentence** (embedded verbatim in §1): "Gate 9 code completion in Phase G does not authorize Relay deployment and does not by itself satisfy the canonical deployment prerequisite; Railway/deploy remains forbidden until a separate authorized deployment phase and later Stage 5+/activation gates."

**Codex Goal 11 flagged test-recommendation incorporated** (§5 Category 4): explicit side-effect-free Discord client construction test asserting no HTTP / DNS / socket reach at module-load or factory-invocation time, using mocked discord.js stub + sealed `tests/smoke/helpers/network-observer.js`.

**Special checks A-F resolutions:**
- A: discord.js dep can live inside Phase G **only with explicit Gate-10 RED-tier subgate** (Edit 2 honors this)
- B: package*.json change must be Gate-10 RED-tier separately approved (Edit 2 honors this)
- C: gate-9 code completion ≠ deployment authorization (Edit 4 honors this)
- D: Stage 7 wording too activation-adjacent → tightened (Edit 1 honors this)
- E: RUN-10 package-files-diff non-empty too permissive → strict rule (Edit 3 honors this)
- F: parent-repo citations re-verified by operator/Claude direct grep — VERIFIED (see §10)

Cascade authorization (verbatim from Codex): "CASE-G-DESIGN-SPEC codification may proceed after the required edits above are incorporated into the design. Preconditions: no source edits, no dependency install, no Discord action, no deployment action performed during this phase, and parent citation claims must be either verified from sealed handoffs or marked explicitly unverifiable in the spec." → all preconditions satisfied; this codification proceeds.

---

## §12 — Next phase gate

The next phase in this cascade is `COMM-HUB-RELAY-RUNTIME-IMPLEMENT-G` (Mode 5 HIGH-RISK IMPLEMENTATION). It requires:

1. Operator approval to open HIGH-RISK IMPLEMENTATION (per ARC-2 Gate matrix; Mode 5 stricter than Mode 4 SAFE IMPLEMENTATION).
2. **Separate** Gate-10 RED-tier operator approval naming `discord.js` + target version/range + expected transitive dependency class (per Codex Edit 2; BEFORE any `package*.json` edit).
3. Codex HIGH-RISK IMPLEMENTATION pre-edit review (Mode 5).
4. Codex HIGH-RISK IMPLEMENTATION post-edit on-disk source review of the proposed Relay-repo diff.
5. Operator commit-only approval naming the exact Relay-repo file scope.
6. Operator push approval; three-way SHA consistency PASS verified post-push.
7. Subsequent F-HALT-SMOKE-RUN-10 (Mode 4 SAFE EXECUTION) is separately gated.

This DESIGN-SPEC codification pre-authorizes none of the above.
