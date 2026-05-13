# COMM-HUB-RELAY-RUNTIME-IMPLEMENT-F-HALT-SMOKE-RUN-DESIGN

**This handoff codifies the accepted conversation-only `COMM-HUB-RELAY-RUNTIME-IMPLEMENT-F-HALT-SMOKE-RUN-DESIGN`. The DESIGN phase itself was Mode 2 / DESIGN-ONLY (conversation-only, no commit). This codification phase is `COMM-HUB-RELAY-RUNTIME-IMPLEMENT-F-HALT-SMOKE-RUN-DESIGN-SPEC` (DOCS-ONLY / Mode 3). The future smoke-run execution phase `COMM-HUB-RELAY-RUNTIME-IMPLEMENT-F-HALT-SMOKE-RUN` is SAFE EXECUTION (Mode 4) — separately gated; not authorized by this codification.**

**Codification provenance:** the operator-directed RUN-DESIGN drafted the smoke-run plan against the Relay-repo seal at `590c1c9b42d96298c625df17ad892e7bf318c8ab` (F-HALT-SMOKE-AMENDMENT) and parent seal at `57911e807c648c7937d7f9cf4abe1021487bddac` (F-HALT-SMOKE-AMENDMENT-CLOSEOUT). Codex round-1 returned PASS WITH REQUIRED EDITS (apply `--test-concurrency=1` to every `node --test` invocation; quote byte-identity commands with explicit working directory, flags, redirection target, and glob form). Operator applied the required edits verbatim. Codex round-2 returned PASS WITH REQUIRED EDITS (add explicit SHA-256 pre/post file-identity capture + `diff -u` compare commands to §4; add §6.1a hard-FAIL gate that fails the phase if TAP passes but byte-identity diff is non-empty). Operator applied the required edits verbatim. A first round-3 Codex review job (`task-mp3lrrj0-c8xygv`) completed its read-only inspection phase in ~90 seconds and verified all anchors, then went silent for ~22 minutes with no further log entries; operator-cancelled the stalled job and dispatched a fresh narrow round-3 with the inspection facts pre-supplied. Fresh round-3 returned **PASS — no required edits**, with one-sentence grounding per review item (planning-only status, `--test-concurrency=1`, SHA-256 byte-identity gate, §6.1a hard-FAIL, Case 12 deferral, non-authorization clauses). This handoff is the on-disk codification of that accepted result. This file does NOT itself constitute an execution authorization. Codex review verdicts are not operator approval.

---

## §0 — Phase classification & current anchors

| Property | Value |
|---|---|
| Phase name (this codification phase) | `COMM-HUB-RELAY-RUNTIME-IMPLEMENT-F-HALT-SMOKE-RUN-DESIGN-SPEC` |
| Phase mode (this codification phase) | Mode 3 / DOCS-ONLY |
| Original phase name (the codified design) | `COMM-HUB-RELAY-RUNTIME-IMPLEMENT-F-HALT-SMOKE-RUN-DESIGN` |
| Original phase mode | Mode 2 / DESIGN-ONLY (conversation-only; no commit) |
| Parent-repo HEAD anchor | `57911e807c648c7937d7f9cf4abe1021487bddac` (F-HALT-SMOKE-AMENDMENT-CLOSEOUT sealed) |
| Relay-repo HEAD anchor | `590c1c9b42d96298c625df17ad892e7bf318c8ab` (F-HALT-SMOKE-AMENDMENT sealed) |
| Pre-smoke-amendment Relay anchor | `abc7a717ef00b2bad198ee2c4db223dcf3ef0e2b` (F-HALT-SMOKE) |
| Pre-smoke Relay anchor | `9fb251efa9279dd662f743c4c60e3712612a7e0c` (F-HALT-AMENDMENT) |
| Phase F SAFE IMPLEMENTATION baseline | `b8ab035034668fd53ea6efe64432f0868dfd2eb9` (historical anchor preserved) |
| F-HALT-SMOKE-DESIGN handoff anchor | parent `cec1710bd84b6d3aac2a45847da21b8f1f20e5da` (sealed; untouched) |
| F-HALT-AMENDMENT-DESIGN handoff anchor | parent `f7d511c31f36b6d39b2b7cfe79cba9c8e31d10ee` (sealed; untouched) |
| Future execution phase (gated, NOT authorized by this codification) | `COMM-HUB-RELAY-RUNTIME-IMPLEMENT-F-HALT-SMOKE-RUN` (SAFE EXECUTION / Mode 4) |
| Parent repo working tree at codification time | clean except `position.json.snap.20260502T020154Z` (untracked carve-out preserved) |
| Relay repo working tree at codification time | clean |
| Relay-runtime status | DORMANT preserved |
| Autopilot status | DORMANT preserved (verified at `eff4dd22b9b9af038c7ae45de301e60b3f45af98`) |
| Active smoke cases at sealed Relay source | 11 (Cases 1–11 contract-aligned) |
| Deferred smoke cases at sealed Relay source | 1 (Case 12 — `test.skip()` + in-file TODO citing `src/verify/limits.js:83` channelCap object-vs-`maxPerWindow` drift) |
| Approvers | exactly `{Victor}` |

---

## §1 — Purpose & scope (firm)

This handoff codifies the smoke-run plan that, when later executed under a separately-gated SAFE EXECUTION (Mode 4) phase with explicit Victor approval, would run the 11 contract-aligned smoke tests against sealed Relay source at `590c1c9b`. The execution would produce three artifacts: (a) a captured TAP stream; (b) a pass/fail/skip tally; (c) sealed-state verification before and after. No commit, no push, no source edit, and no runtime activation is authorized by this codification or by the future execution phase. The future execution phase covers only test invocation + evidence capture; commit decisions about the captured evidence are deferred to a separately-gated DOCS-ONLY closeout phase.

---

## §2 — Applied prior Codex required edits (round-1 and round-2)

**§2.1 — Concurrency flag (round-1 required edit, applied verbatim).** Every `node --test` invocation MUST pass `--test-concurrency=1` to enforce sequential execution. Rationale carried from F-HALT-SMOKE-DESIGN §7 ("Tests run sequentially (not in parallel) to avoid temp-dir collisions") and DPI-F-SMOKE-9 ("Recommend sequential to avoid filesystem race conditions on temp dirs"). Default `node --test` concurrency on multi-core hosts is `os.availableParallelism()`, which would violate the sequential discipline.

**§2.2 — Byte-identity command quoting (round-1 required edit, applied verbatim).** All §3 commands are quoted with explicit working directory, explicit flags, explicit redirection target, and explicit path globs. No shell aliases, no relative paths, no `&&` of inferred `pwd`, no shell-history reuse. Any deviation from the exact quoted byte sequence (whitespace, flag ordering, glob form, output path) invalidates the run.

**§2.3 — SHA-256 byte-identity capture + diff gate (round-2 required edit, applied verbatim).** §3 now includes explicit pre-run and post-run SHA-256 hash captures of the `tests/smoke/` tree, plus a `diff -u` compare command. §5.1a now hard-fails the phase if the diff is non-empty, even if the TAP run reports `# fail 0`.

---

## §3 — Byte-identity commands (codified; execution separately gated)

**Working directory for all commands:** `/Users/victormercado/code/agent-avila-relay`.

**Capture directory** (parent repo; created at run time by the future SAFE EXECUTION phase, never committed by this codification):
`/Users/victormercado/claude-tradingview-mcp-trading/orchestrator/handoffs/evidence/F-HALT-SMOKE-RUN/`.

### §3.1 — Pre-run byte-identity hash capture (`tests/smoke/` tree)

```
cd /Users/victormercado/code/agent-avila-relay && find tests/smoke -type f -print0 | sort -z | xargs -0 shasum -a 256 > /Users/victormercado/claude-tradingview-mcp-trading/orchestrator/handoffs/evidence/F-HALT-SMOKE-RUN/tests-smoke-before.sha256
```

Captures SHA-256 of every file under `tests/smoke/` in null-terminated sorted order. The sorted-null pipeline guarantees deterministic ordering and survives filenames with whitespace.

### §3.2 — Primary smoke run (TAP, sequential, all 11 active cases; Case 12 skip)

```
cd /Users/victormercado/code/agent-avila-relay && node --test --test-concurrency=1 --test-reporter=tap tests/smoke/ > /Users/victormercado/claude-tradingview-mcp-trading/orchestrator/handoffs/evidence/F-HALT-SMOKE-RUN/tap-run-1.txt 2>&1
```

### §3.3 — Post-run byte-identity hash capture (same tree)

```
cd /Users/victormercado/code/agent-avila-relay && find tests/smoke -type f -print0 | sort -z | xargs -0 shasum -a 256 > /Users/victormercado/claude-tradingview-mcp-trading/orchestrator/handoffs/evidence/F-HALT-SMOKE-RUN/tests-smoke-after.sha256
```

### §3.4 — Byte-identity diff compare

```
diff -u /Users/victormercado/claude-tradingview-mcp-trading/orchestrator/handoffs/evidence/F-HALT-SMOKE-RUN/tests-smoke-before.sha256 /Users/victormercado/claude-tradingview-mcp-trading/orchestrator/handoffs/evidence/F-HALT-SMOKE-RUN/tests-smoke-after.sha256
```

**Expected result:** no diff. Exit code 0, zero-byte stdout. Any non-empty diff = automatic FAIL (see §5.1a).

### §3.5 — Per-case re-run (used only if §3.2 reports failure)

Replace `NN-...` with the failing filename:

```
cd /Users/victormercado/code/agent-avila-relay && node --test --test-concurrency=1 --test-reporter=tap tests/smoke/NN-failing-case.test.js
```

### §3.6 — Sealed-anchor verification (pre + post; non-mutating)

```
cd /Users/victormercado/code/agent-avila-relay && git rev-parse HEAD && git status --porcelain
cd /Users/victormercado/claude-tradingview-mcp-trading && git rev-parse HEAD && git status --porcelain
```

Expected: Relay HEAD = `590c1c9b42d96298c625df17ad892e7bf318c8ab`, parent HEAD = `57911e807c648c7937d7f9cf4abe1021487bddac`, both porcelain outputs empty (modulo the durable parent `position.json.snap.20260502T020154Z` carve-out).

**Execution order:** §3.6 (pre) → §3.1 (hash before) → §3.2 (smoke run) → §3.3 (hash after) → §3.4 (diff) → §3.6 (post).

No other commands are authorized by the future execution phase. Out of scope: `npm install`, `npm ci`, `npx`, `node --check`, `astro *`, `node bot.js`, `node dashboard.js`, `node db.js`, `node migrations/*`, any `scripts/*`, and any `playwright` invocation.

---

## §4 — Pre-execution safety checks (run before §3.1/§3.2 in the future execution phase)

1. **Sealed-anchor check** (§3.6 commands): both repos at expected HEADs, working trees clean. ABORT on mismatch.
2. **Relay source untouched:** `git diff --stat 590c1c9b -- src/` returns empty. ABORT otherwise.
3. **Test file roster:** exactly 12 `.test.js` files under `tests/smoke/` (Cases 1–12) + 4 helpers. Case 12 contains `test.skip(`. ABORT on count drift.
4. **`package.json` / `package-lock.json` byte-identity:** unchanged from `590c1c9b`. ABORT otherwise — `node:test` built-in only, no new dependency.
5. **No process side-effects active:** confirm no `agent-avila-relay` Railway-service interaction is queued; confirm no `.env*` file has been created in the Relay repo.
6. **Network discipline pre-flight:** `tests/smoke/helpers/network-observer.js` exists; `git diff 590c1c9b -- tests/smoke/helpers/network-observer.js` is empty. No preflight network probe is performed.
7. **No Antigravity / autopilot wakeup queued:** parent `orchestrator/STATUS.md` Right Now block does not show an in-flight autopilot phase. Relay DORMANT preserved.
8. **Operator confirmation:** Victor's explicit in-session approval to enter SAFE EXECUTION. (Codex review verdicts do NOT constitute operator approval.)

---

## §5 — Post-execution safety checks (run after §3.3/§3.4 complete in the future execution phase)

**§5.1 — Sealed-anchor re-check** (§3.6 commands): both HEADs and working trees unchanged. The smoke run MUST produce ZERO tracked-file modifications. Any drift = FAIL; do not proceed to closeout.

**§5.1a — Byte-identity diff gate (hard FAIL).** §3.4 `diff -u` MUST produce zero-byte output and exit code 0. **A non-empty diff is an automatic FAIL even if the TAP run reports `# fail 0`.** Rationale: a passing TAP outcome alongside a mutated `tests/smoke/` tree means the run mutated its own test scaffolding mid-execution (temp-tree leak landed inside the repo, an after-hook wrote into the source tree, an exit-stub failure caused a stray write), which invalidates the contract even if assertions individually passed. On non-empty diff: archive both `.sha256` files plus the diff under `evidence/F-HALT-SMOKE-RUN/`, capture `git status --porcelain` for forensic context, do NOT proceed to closeout, do NOT re-run, and surface for Victor + Codex investigation.

**§5.2 — TAP outcome tally:** parse `tap-run-1.txt`; expected `# tests 12`, `# pass 11`, `# skip 1` (Case 12), `# fail 0`. Any other shape = FAIL; do not proceed to closeout. (Independent of §5.1a — both gates must PASS.)

**§5.3 — No untracked artifacts in Relay repo:** `git status --porcelain` empty. Tests use `os.tmpdir()`; any stray file under the repo tree indicates a temp-tree leak — investigate before closeout. (Note: redundant with §5.1a for files under `tests/smoke/`, but §5.3 also covers the rest of the Relay tree — `src/`, `schemas/`, `package*.json`, etc. — that §3.1/§3.3 do not hash.)

**§5.4 — Network-observer assertion:** every test that boots asserted zero outbound calls; this is per-case (already encoded in Cases 1–11) and surfaces in TAP. Confirm via TAP scan that no case logged `network-anomaly` / network calls.

**§5.5 — No publish-log / pending tree persists outside `os.tmpdir()`:** confirm Relay repo contains no new `publish-log.jsonl`, no `pending/`, no `processed/` directory. (These belong only to per-test temp trees.)

**§5.6 — Evidence artifacts:** `tap-run-1.txt`, `tests-smoke-before.sha256`, `tests-smoke-after.sha256`, and any §3.4 diff output live under the parent-repo `evidence/F-HALT-SMOKE-RUN/` subdirectory and are NOT committed by the future execution phase. Closeout decisions about whether to commit sanitized excerpts are made by a separately-gated DOCS-ONLY closeout phase.

**PASS criteria for the future execution phase (all four required):** §5.1 sealed-anchor unchanged AND §5.1a byte-identity diff empty AND §5.2 TAP tally `12 / 11 pass / 1 skip / 0 fail` AND §5.3 working tree clean. Failure of any one = phase FAIL.

---

## §6 — Case 12 disposition (carried, not addressed)

Case 12 remains `test.skip()` with the in-file TODO. The `src/verify/limits.js:83` drift (`current >= channelCap` where `channelCap` is the full object, not `channelCap.maxPerWindow`) is **explicitly out of scope** for this codification and for the future smoke-run execution. The smoke run reports Case 12 as skipped; this is the expected and only correct outcome at the sealed Relay source. Remediation (Option B — rewrite Case 12 as a component-level test against the current numeric channelRateLimits shape `limits.js` expects; or Option C — open a separate SAFE IMPLEMENTATION phase to amend Phase E `limits.js:83` to extract `channelCap.maxPerWindow`) is a separately gated future phase.

---

## §7 — Hard non-authorization clauses (firm)

This DOCS-ONLY codification phase, the codified RUN-DESIGN, and the future SAFE EXECUTION phase it describes do NOT authorize and MUST NOT touch:

- Discord (no platform application, bot, token, permission, webhook, channel, post, reaction, or read action)
- Railway (no deploy, no service config, no env-var write/read, no log fetch against `agent-avila-relay` or any other service)
- Database (no Postgres connection, no migration, no SQL execution; Migration 008 APPLIED preserved; Migration 009+ NOT authorized)
- Kraken / any exchange API (no read, no order, no balance query)
- `.env`, `.env.*`, `.envrc`, secrets, `~/.ssh/`, `~/.aws/`, `~/.gcp/`, `~/.azure/`, `~/.config/gh/`, `~/.npmrc`, `~/.netrc`, `~/.claude/`
- `position.json`, `position.json.snap.*`, `MANUAL_LIVE_ARMED` flag, any trading code path
- `bot.js`, `dashboard.js`, `db.js`, `migrations/*`, `scripts/*`, `playwright*`
- Any deploy CLI, any network call from tests or test runtime (network-observer enforces)
- Relay runtime activation (no real `boot()` against a real `MESSAGE_STORE_PATH`; no Phase G hook wired)
- Autopilot activation (DORMANT preserved); CEILING-PAUSE state unchanged (history at `22ba4a76`; counter 0 of 3)
- Phase G design or implementation; Stage 5 install resumption (Steps 14–21); Stages 7 / 8 / 9 / 10a / 10b
- DASH-6 / D-5.12f / D-5.12g / D-5.12h / Migration 009+
- External Hermes Agent (Nous/OpenRouter) — reserved-term distinction only
- Scheduler / cron / webhook / MCP install; any permission widening; any network lookup
- Phase C/D/E/F sealed source in Relay repo (incl. `src/verify/limits.js` — drift documented, NOT fixed here)
- `package.json` / `package-lock.json` byte change in either Relay or parent (root or web/)
- Antigravity workspace config; sealed handoffs; sealed generator at `tools/dashboard-generate.js`; `orchestrator/DASHBOARD.md`
- Any push to any remote in either repo (operator-only when authorized; not this phase)
- Memory files under `~/.claude/`

**Approvers exactly `{Victor}`.** Claude / Codex / Gemini / Relay / autopilot are governance-only and cannot self-approve. Codex review verdicts do not constitute operator approval.

---

## §8 — Preservation invariants (verified at codification time)

- Relay sealed at `590c1c9b42d96298c625df17ad892e7bf318c8ab`; parent at `57911e807c648c7937d7f9cf4abe1021487bddac`
- 11 active smoke tests contract-aligned; Case 12 deferred via `test.skip()` + in-file TODO citing `src/verify/limits.js:83`
- Migration 008 APPLIED at `189eb1be6ef6304d914671bdaedec44d389cf877`; N-3 CLOSED; Stage 5 Gate-10 install approval at `40f3137e842cd60acf1adf17ecc7fe2f0b1b8935` CONSUMED
- Autopilot DORMANT (verified at `eff4dd22b9b9af038c7ae45de301e60b3f45af98`); Relay DORMANT; CEILING-PAUSE broken at `22ba4a7663e22df64b7cc8e3c0324cbffc0e28f6` (counter 0 of 3)
- Live write paths (OPEN_LONG / BUY_MARKET, CLOSE_POSITION, SELL_ALL) DB-first; unaffected by this phase
- `position.json.snap.20260502T020154Z` carve-out preserved untracked in parent repo
- Railway service display name `agent-avila-relay`; `DISCORD_BOT_TOKEN` empty-shell preserved (NOT touched)
- Naming convention preserved: "Relay" = internal messenger; "external Hermes Agent (Nous/OpenRouter)" = reserved-term only
- Phase A–F Relay-repo lettered chain preserved: Phase F baseline `b8ab035034668fd53ea6efe64432f0868dfd2eb9`; F-HALT-AMENDMENT `9fb251efa9279dd662f743c4c60e3712612a7e0c`; F-HALT-SMOKE `abc7a717ef00b2bad198ee2c4db223dcf3ef0e2b`; F-HALT-SMOKE-AMENDMENT `590c1c9b42d96298c625df17ad892e7bf318c8ab`
- F-HALT-AMENDMENT-DESIGN handoff sealed at `f7d511c31f36b6d39b2b7cfe79cba9c8e31d10ee` untouched
- F-HALT-SMOKE-DESIGN handoff sealed at `cec1710bd84b6d3aac2a45847da21b8f1f20e5da` untouched
- F-HALT-AMENDMENT cascade sealed through parent `cf877f443fdfd10b14822ea202ac63166cfc2a08` and Relay `9fb251efa9279dd662f743c4c60e3712612a7e0c`
- F-HALT-SMOKE cascade sealed through parent `e2bc17f7c65af94317eb046cc92ebf9618b22679` and Relay `abc7a717ef00b2bad198ee2c4db223dcf3ef0e2b`
- F-HALT-SMOKE-AMENDMENT cascade sealed through parent `57911e807c648c7937d7f9cf4abe1021487bddac` and Relay `590c1c9b42d96298c625df17ad892e7bf318c8ab`
- Antigravity chain SHAs preserved: ANTIGRAVITY-MIGRATION-DESIGN-SPEC `71af035f9a1f7489bfd663e099a15fda7439d0a7`; ANTIGRAVITY-MIGRATION-A-WORKSPACE-CONFIG-DESIGN-SPEC `d7bb70463beed9c9e3abea84ed9b0682cbaf2255`; ANTIGRAVITY-MIGRATION-A-WORKSPACE-CONFIG-CLOSEOUT `19db3723e5a046db33bb5880fb95e6f38f23e08a`; ANTIGRAVITY-RULES-DESIGN-SPEC `9d47f74d87aeed20a2fa7483a3704b494a21eb96`; ANTIGRAVITY-RULES-DESIGN-SPEC-CLOSEOUT-SYNC `6c41c2c69d7fb4c8d5fda6179829f10e3ffaf9c0`
- Full PROJECT-PROGRESS-DASHBOARD cascade through REFRESH-006-CLOSEOUT-SYNC preserved (sealed through `e026ed312a5899f9b6aa4fa4f132463feb3ad934`)
- AI-GOV-OS-DESIGN handoff sealed at `bd6245fef40067f90ade3ec7fef03f9737c11fd6` untouched; UX-UPGRADE-DESIGN at `570cf9c60485ee1cf4e5df0923fc4613f06eb586` untouched; BUILD-PREVIEW-DESIGN at `34e15df778c1e9230b25a1e309868294795e631a` untouched; WEB-IMPLEMENT-DESIGN at `e6af54a91a94cc4b92291a550db3825a8bb599a5` untouched; WEB-DESIGN at `1b49fc30737ea96ec8d2dbf923c5467eb33b8149` untouched
- Sealed generator `tools/dashboard-generate.js` codified at `f5cc97a…` untouched; refreshed dashboard regenerated at REFRESH-006/`61df34fad5f588c9a83ee55aca9f328e96d22a03` untouched; web/ at `ef63605f833c508e803ef5f9e40ff6129e3cab56` untouched
- Approvers exactly `{Victor}`

---

## §9 — Open Codex questions DPI-F-SMOKE-RUN-1 … DPI-F-SMOKE-RUN-6

| DPI | Question | Recommendation |
|---|---|---|
| DPI-F-SMOKE-RUN-1 | Confirm `--test-concurrency=1` is the correct flag (not `--test-concurrency 1` separate token, not env `NODE_TEST_CONCURRENCY=1`)? | YES (Node 22 supports both forms; the `=` form is byte-stable and matches Node docs for the locked engine `>=22.0.0 <23.0.0`) |
| DPI-F-SMOKE-RUN-2 | Confirm capture location `…/orchestrator/handoffs/evidence/F-HALT-SMOKE-RUN/tap-run-1.txt` is acceptable (parent repo, not committed by this phase)? | YES (alternative `os.tmpdir()` capture would not survive session restart; parent-repo evidence dir survives for closeout review) |
| DPI-F-SMOKE-RUN-3 | Confirm expected TAP tally `12 / 11 pass / 1 skip / 0 fail` (Case 12 the only skip)? | YES per sealed Relay state |
| DPI-F-SMOKE-RUN-4 | Confirm the smoke-run phase produces NO git commit (parent or Relay) — purely an in-session execution + capture? | YES; commit decisions deferred to a separate DOCS-ONLY closeout |
| DPI-F-SMOKE-RUN-5 | Confirm pre-flight check #4 (`package*.json` byte-identity) is the strongest signal that `node:test` built-in remains the runner (no dep drift)? | YES |
| DPI-F-SMOKE-RUN-6 | After the smoke run PASSES: confirm Phase G design remains separately gated and a clean smoke pass does NOT pre-authorize Phase G opening? | YES per F-HALT-SMOKE-DESIGN DPI-F-SMOKE-10 |

---

## §10 — Codex review history

- **Round-1 (against the initial RUN-DESIGN):** PASS WITH REQUIRED EDITS — (a) add `--test-concurrency=1` to every `node --test` invocation; (b) quote byte-identity commands with explicit working directory, flags, redirection target, and glob form. Operator applied both verbatim.
- **Round-2 (post-RE state):** PASS WITH REQUIRED EDITS — add explicit SHA-256 pre/post file-identity capture (§3.1, §3.3) and `diff -u` compare (§3.4); add §5.1a hard-FAIL gate that fails the phase if TAP passes but byte-identity diff is non-empty. Operator applied verbatim.
- **Round-3a (first dispatch via codex:rescue / job `task-mp3lrrj0-c8xygv`):** stalled. Inspection phase completed in ~90 seconds with all anchors verified (HEAD SHAs, smoke tree roster, Case 12 deferral, `limits.js:83` drift, `--test-concurrency` flag existence, `diff -u` semantics, `sort -z | xargs -0 shasum` macOS pipeline). Log went silent for ~22 minutes with no further tool calls. Operator cancelled the job to release resources.
- **Round-3b (fresh dispatch via codex:rescue, narrow terse-format prompt with the inspection facts pre-supplied):** **PASS — no required edits.** One-sentence grounding per review item:
  1. *Planning-only status* — passes because §1 of the design (codified §1 of this handoff) and §11 of the design (codified §3.6 / §4 / §5 / §6 / §7 / §11) state conversation-only design, no execution, no source edit, no commit, no push, and no runtime activation.
  2. *`--test-concurrency=1`* — passes because the pre-verified facts confirm it is a real Node 22 flag and §3.2 / §3.5 require it on `node --test`.
  3. *Byte-identity gate* — passes because §3.1 / §3.3 hash `tests/smoke` files with the pre-verified working macOS pipeline and §3.4 compares those hashes with confirmed `diff` semantics.
  4. *§5.1a hard-FAIL* — passes because §5.1a says any non-empty diff is automatic FAIL even if TAP reports `# fail 0`.
  5. *Case 12* — passes because the pre-verified facts confirm `test.skip()` and TODO at `limits.js:83`, while §6 keeps it skipped and scope-deferred.
  6. *Non-authorization clauses* — passes because §7 explicitly blocks Discord, Railway, DB, Kraken, env, secrets, deploy, runtime activation, and trading actions.

---

## §11 — Phase output of this codification phase

This is a DOCS-ONLY (Mode 3) operator-directed codification phase. Scope: 4 files in the parent repo only — 1 new SAFE-class handoff record (this file) + 3 status-doc updates (`orchestrator/STATUS.md`, `orchestrator/CHECKLIST.md`, `orchestrator/NEXT-ACTION.md`). No Relay-repo touch. No source edit. No test execution. No commit by this codification turn itself; commit decision deferred to operator. No push.

**This phase does NOT and MUST NOT:**
- Run any smoke test; invoke `node --test`, `node --check`, `npm install`, `npm ci`, `npx`, `astro *`, or `playwright`
- Edit any Relay-repo file (sealed at `590c1c9b…`)
- Edit `src/`, `tests/`, `migrations/`, `scripts/`, `bot.js`, `dashboard.js`, `db.js`, `playwright.config.js`
- Edit `package.json` / `package-lock.json` (parent root or web/)
- Touch `.env`, secrets, `~/.claude/`, `~/.ssh/`, `position.json*`, `MANUAL_LIVE_ARMED`, any trading code path
- Open the future `COMM-HUB-RELAY-RUNTIME-IMPLEMENT-F-HALT-SMOKE-RUN` SAFE EXECUTION phase
- Open Phase G design or implementation; resume Stage 5 Steps 14–21 or Stages 7 / 8 / 9 / 10a / 10b
- Open DASH-6 / D-5.12f / D-5.12g / D-5.12h / Migration 009+
- Touch external Hermes Agent (Nous/OpenRouter), Discord, Railway, DB, Kraken, env, secrets, deploy, runtime activation, trading
- Install scheduler / cron / webhook / MCP; widen permissions; perform any network lookup
- Modify any sealed governance doc, handoff record, generator, dashboard snapshot, or `web/` file
- Touch `position.json.snap.20260502T020154Z` (carve-out preserved untracked)
- Advance the autopilot phase-loop counter; modify CEILING-PAUSE state

The next step is operator decision on commit, then optionally Codex DOCS-ONLY review of this codification, then optionally a separately-approved push. A future `COMM-HUB-RELAY-RUNTIME-IMPLEMENT-F-HALT-SMOKE-RUN-DESIGN-SPEC-CLOSEOUT` may record this DESIGN-SPEC as CLOSED at the post-commit parent-repo HEAD (per Rule 1 — one CLOSEOUT and optional one CLOSEOUT-SYNC max; no recursive paperwork beyond that).
