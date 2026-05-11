# PROJECT-PROGRESS-DASHBOARD-IMPLEMENT-DESIGN

**Phase identity:** `PROJECT-PROGRESS-DASHBOARD-IMPLEMENT` (future SAFE IMPLEMENTATION; not opened by this codification)
**Phase mode (future implementation):** SAFE IMPLEMENTATION (Mode 4)
**Source-design phase:** `PROJECT-PROGRESS-DASHBOARD-IMPLEMENT-DESIGN` (Mode 2 / DESIGN-ONLY conversation-only v2)
**Source-design HEAD anchor:** `19db4679aa32fe2e341f86acbedd1f79dc703ecd` (parent repo; = PROJECT-PROGRESS-DASHBOARD-DESIGN-SPEC-CLOSEOUT-SYNC commit)
**Relay-repo Phase F sealed anchor (informational; not touched):** `b8ab035034668fd53ea6efe64432f0868dfd2eb9`
**Codification phase:** `PROJECT-PROGRESS-DASHBOARD-IMPLEMENT-DESIGN-SPEC` (DOCS-ONLY / Mode 3)
**Parent design handoff:** `orchestrator/handoffs/PROJECT-PROGRESS-DASHBOARD-DESIGN.md` (codified at `f6aaa409889ec76632f8b80e9954d1cb38b178a9`; sealed; not modified by this codification)

This document persists the Codex-PASS v2 conversation-only implementation design as a SAFE-class handoff record. The implementation design describes how the future SAFE IMPLEMENTATION (Mode 4) phase `PROJECT-PROGRESS-DASHBOARD-IMPLEMENT` will author a read-only Node generator script plus an initial `orchestrator/DASHBOARD.md` consistent with the canonical dashboard DESIGN handoff at `f6aaa40…`. All 4 Codex round-1 required edits are applied verbatim. Codex DESIGN-ONLY round-2 narrow re-review returned overall PASS across all 13 narrow goals with no further required edits. The document is NOT approval to open the future implementation phase, NOT a generator script, NOT a regeneration of `DASHBOARD.md`, NOT a network-touch, NOT a deploy.

---

## §0 — Phase classification & pre-flight verification

| Property | Value |
|---|---|
| Future phase name | `PROJECT-PROGRESS-DASHBOARD-IMPLEMENT` |
| Future phase mode | SAFE IMPLEMENTATION (Mode 4) |
| Predecessor (parent repo) | DASHBOARD-DESIGN-SPEC-CLOSEOUT-SYNC at `19db4679aa32fe2e341f86acbedd1f79dc703ecd` |
| Canonical parent DESIGN handoff | `orchestrator/handoffs/PROJECT-PROGRESS-DASHBOARD-DESIGN.md` at `f6aaa40…` (sealed; not modified) |
| Successor lettered phase | unchanged — Relay lettered phases continue separately gated |
| Relay-repo state | unchanged at `b8ab035…` (Phase F sealed); off-scope for this design at design time |
| Working tree at design time | clean except `position.json.snap.20260502T020154Z` (untracked carve-out) |

**Codex review history (source design phase, conversation-only):**

- **Round-1 (v1 DESIGN-ONLY):** PASS WITH REQUIRED EDITS — 4 required edits across §2 Q1 (script-path qualification), §1 Hard guarantees / §2 Q4 / §6 invariant 3 (zero `process.env` reads), §2 Q15 (test-scope justification correction), §2 Q7 / §5 (canonical §9 section-count authority).
- **Round-2 (v2 narrow re-review):** overall PASS across all 13 narrow goals. All 4 round-1 REs verified applied. No structural design changes. 5-file future implementation scope unchanged. Stdout-only behavior unchanged. Zero-network policy unchanged. No new forbidden literals introduced. Mode 2 design classification preserved. Future Mode 4 implementation classification preserved.

---

## §1 — Implementation architecture

**Single read-only Node script that emits markdown to stdout.** No file writes at runtime. No network calls. Node built-ins only (no new dependencies; `package.json` untouched). Operator pipes stdout to `orchestrator/DASHBOARD.md` during separately-gated regeneration phases.

**Three internal layers (within one file):**

1. **Data layer (read-only sources):** reads canonical orchestrator markdown via `fs.readFileSync` against an explicit path allowlist; reads 4 read-only git commands via `child_process.execFileSync` against an explicit command allowlist
2. **Parse layer:** regex-based section detection for `## <PHASE> — IN PROGRESS` vs `## <PHASE> — Closed at \`<SHA>\``; checklist `[x]` / `[ ]` counting; git output parsing
3. **Render layer:** assembles the 11 dashboard content sections plus header metadata as markdown and emits to stdout

**Hard guarantees enforced by code structure:**

- No `fs.writeFile*`, `fs.appendFile*`, `fs.createWriteStream`, `fs.mkdir*`, `fs.unlink*`, `fs.rename*`, `fs.rm*` — write-side fs API not imported
- No `http`, `https`, `fetch`, `net`, `tls`, `dgram` — network modules not imported
- No `child_process.exec`, `spawn`, or `execFile` with anything other than `git` plus the 4 allowed subcommands
- **No `process.env` reads at all.** The future generator must not read environment variables.

---

## §2 — Recommended generator path

`tools/dashboard-generate.js` — **recommended new path** (new `tools/` dir; separate from RESTRICTED `scripts/`), **subject to Codex implementation review at Mode 4 implementation time.** Final path may shift if Codex review identifies a safer location at implementation time.

`scripts/` is RESTRICTED per `PROTECTED-FILES.md` Level 2 (trading-script-adjacent surface). `tools/` is currently unclassified and does not conflict with any protected surface; using it for the generator preserves clean separation between trading-runtime scripts and orchestrator-side tooling.

---

## §3 — Generator behavior

**Invocation:** `node tools/dashboard-generate.js` (zero args; `--help` optional). **stdout-only.** The script never invokes write-side `fs` APIs. The operator pipes the script's stdout to a file:

```
node tools/dashboard-generate.js > orchestrator/DASHBOARD.md
```

and explicitly stages the resulting file during a separately-gated regeneration phase. Refresh of `DASHBOARD.md` is NOT automatic.

**Sequence:**

1. Define allowlists (path + command) at module top
2. Read parent HEAD via `git rev-parse HEAD`
3. Read remote-tracking SHA via `git rev-parse origin/main`
4. Read working-tree state via `git status --short`
5. Read recent commits via `git log --oneline -N` (N parameterized; defaults to 30)
6. Read `orchestrator/STATUS.md` (parse `## PHASE — …` section headers via regex)
7. Read `orchestrator/CHECKLIST.md` (parse `[x]` / `[ ]` checklist counts)
8. Read `orchestrator/NEXT-ACTION.md` (parse Right Now block for active phase + next safe action)
9. Read selected `orchestrator/handoffs/*.md` if needed for Relay HEAD reference
10. Read selected canonical specs if needed for safety-gate labels
11. Assemble 12 sections (header metadata + 11 content sections)
12. Emit to stdout
13. Exit 0 on success; exit non-zero with stderr structured error on any parse / allowlist / command failure

**Idempotent:** running twice with identical repo state produces byte-identical output (except the metadata "Generated" timestamp; the timestamp itself may be deterministic if derived from the latest commit date).

**Deterministic:** no randomness; no time-of-day-dependent branching outside the metadata timestamp.

---

## §4 — Allowed local read paths (explicit allowlist)

The generator reads ONLY these paths (explicit constant at module top; any other path requested by the parse layer is refused with `DashboardError: path not in allowlist: <path>` and non-zero exit):

- `orchestrator/STATUS.md`
- `orchestrator/CHECKLIST.md`
- `orchestrator/NEXT-ACTION.md`
- `orchestrator/handoffs/*.md` (glob expansion at runtime; all canonical handoffs are SAFE-class documentation records)
- `orchestrator/AUTOPILOT-RULES.md`
- `orchestrator/APPROVAL-GATES.md`
- `orchestrator/PHASE-MODES.md`
- `orchestrator/PROTECTED-FILES.md`
- `orchestrator/COMM-HUB-RULES.md`
- `orchestrator/COMM-HUB-RELAY-RULES.md`
- `orchestrator/COMM-HUB-RELAY-RUNTIME-DESIGN.md`
- `CLAUDE.md`

---

## §5 — Refused / forbidden paths

Anything not in the §4 allowlist is refused at runtime by the enforcement mechanism. Explicitly forbidden (denied via the deny-by-default allowlist):

- `bot.js`, `dashboard.js`, `db.js`
- `migrations/*`, `scripts/*`
- `package.json`, `package-lock.json`
- `position.json`, `position.json.snap.*`
- `.env*`, secrets directories
- `.nvmrc`
- Relay repo (`/Users/victormercado/code/agent-avila-relay/` and all its paths) — separate repo; off-scope at design time and at implementation time
- Memory files outside project scope
- Any test files
- `railway.json`, deploy scripts, CI/CD config — deploy / Railway surface
- Claude settings, hooks, MCP server configuration, slash-command permission files — automation actuation surfaces
- Live Kraken / exchange paths — production trading endpoints
- Production DB clients / queries — DB access strictly off-limits
- Discord bot / token / webhook / scheduler surfaces — platform actuation surfaces
- Railway / DB / external API endpoints — any network calls

**The future generator must not read environment variables.** No `process.env` reads at all.

---

## §6 — Allowed git commands (explicit command allowlist)

The generator runs ONLY these 4 read-only git commands (explicit array literal check; any other command/subcommand combination is refused):

| Command | Purpose |
|---|---|
| `git log --oneline -N` (N parameterized; default 30) | Recent commit chain |
| `git rev-parse HEAD` | Local HEAD SHA |
| `git rev-parse origin/main` | Local remote-tracking SHA (cached; not a network call) |
| `git status --short` | Local working-tree state |

---

## §7 — Forbidden git commands

The generator refuses (does not invoke) all of:

- `git ls-remote` — network call; explicitly excluded by zero-network policy
- `git fetch`, `git pull`, `git push` — network + write
- `git checkout`, `git reset`, `git merge`, `git rebase` — write
- `git commit`, `git add`, `git tag`, `git stash` — write
- Any other git subcommand not in the §6 allowlist

---

## §8 — Parse-failure behavior

**Fail loud.** On any parse failure, allowlist violation, or git command failure: emit a structured error message to stderr (`DashboardError: <reason> at <file>:<line>`) and exit non-zero. **Do not emit a partial dashboard.**

Reasoning: silent partial output risks operator reading stale or incomplete state. A `--partial` flag for fail-safe mode is explicitly out of scope for v1.

---

## §9 — Initial DASHBOARD.md output structure

**Mirrors canonical DESIGN §9 layout (11 content sections + header metadata; canonical DESIGN §4 is a 10-row summary and is not the authoritative section count).** Approximate length 80–120 lines.

**Header metadata (4 fields):**

- Generated ISO-8601 timestamp
- Parent HEAD short SHA + repo name
- Relay HEAD short SHA + repo name + sealed status
- Working-tree state (`clean except <untracked carve-outs>`)

**11 content sections:**

1. Where Are We Now (one sentence)
2. Active Phase (single block with phase / mode / scope / pending decision)
3. Safety Gates (status table — Relay DORMANT, Autopilot DORMANT, Discord posting NOT ACTIVE, live trading NOT AUTHORIZED, approvers `{Victor}`, CEILING-PAUSE state, Migration 008 APPLIED, Stage 5 Gate-10 CONSUMED, N-3 deploy gate CLOSED)
4. Completed Phases (recent first; SHA + phase + mode columns; collapsible / paginated)
5. Paused Phases (items with required-edits pending or operator-pending blockers)
6. Pending / Future Designed Phases (codified designs not yet opened)
7. Backlog / Future Ideas (14 items per canonical DESIGN §5)
8. Phase Timeline / Roadmap (ASCII gantt-style; dates only from committed docs / git history per canonical roadmap dates policy)
9. Repo Anchors (Parent HEAD + Relay HEAD; flag any drift between local and origin/main)
10. Dormant vs Active Systems (with `bot.js` and `dashboard.js` labeled OFF-SCOPE / NOT ASSESSED BY THIS DASHBOARD per canonical RE-1 / RE-2)
11. Next Safe Action (one sentence)

---

## §10 — Parsed vs hard-coded

| Category | Source | Approach |
|---|---|---|
| Phase status list | STATUS.md section headers (regex) | **Parsed** |
| Recent commit chain | `git log --oneline -N` | **Parsed** |
| Parent HEAD SHA | `git rev-parse HEAD` | **Parsed** |
| Working-tree state | `git status --short` | **Parsed** |
| Relay HEAD SHA | Parsed from canonical handoff(s); fallback hard-coded `b8ab035…` | **Mixed** |
| Section structure / layout | Static markdown templates | **Hard-coded** |
| Safety gate labels | Static (sourced from canonical handoffs) | **Hard-coded for v1**; future iteration may parse |
| Backlog (14 items per canonical DESIGN §5) | Static list | **Hard-coded for v1**; future iteration may parse from canonical handoff |
| Dormant-vs-Active table | Static (per canonical RE-1/RE-2 constraints) | **Hard-coded** |
| Next Safe Action | Static for v1 (derived from NEXT-ACTION.md Right Now block as future iteration) | **Hard-coded for v1** |

V1 keeps parsing scope tight to reduce mis-parsing risk. Future iterations may expand parse coverage.

---

## §11 — Future implementation scope (5 files)

| # | File | Action | LOC estimate |
|---|---|---|---|
| 1 | `tools/dashboard-generate.js` | NEW | ~150–250 LOC (Node, ES modules, single file; Node built-ins only) |
| 2 | `orchestrator/DASHBOARD.md` | NEW | ~80–120 lines (initial output from the script) |
| 3 | `orchestrator/STATUS.md` | MODIFIED | ~1 header flip + ~1 new IN PROGRESS section |
| 4 | `orchestrator/CHECKLIST.md` | MODIFIED | ~1 header flip + ~5 back-filled items + new section + ~10 checklist items |
| 5 | `orchestrator/NEXT-ACTION.md` | MODIFIED | ~1 paragraph prepend + ~1 paragraph header flip |

Total: 2 new + 3 modified = 5 files. No `package.json` touch. No Relay repo touch. No protected-file touch.

---

## §12 — 10 Safety invariants (preserved from canonical DESIGN)

1. **READ-ONLY at runtime.** Generator never invokes write-side `fs` APIs.
2. **No network.** Zero network module imports; no `git ls-remote`; no remote lookups.
3. **No env or secret reads.** No `process.env` reads at all in the generator code. The future generator must not read environment variables. Refuses to read `.env*`, `secrets/`, `.nvmrc` (not in allowlist).
4. **No trading-runtime reads.** `bot.js`, `dashboard.js`, `db.js`, `position.json*` not in allowlist.
5. **No Relay-repo touch at design time or implementation time.** Future scope expansion would be a separately-gated phase.
6. **No execution of production actions.** No `child_process` invocation outside the 4 allowed read-only git commands.
7. **No advancement of phase state.** Reading state does not change state; phase transitions require Codex review + Victor approval per established cascade.
8. **No CEILING-PAUSE break.** Reading state does not bump the phase-loop counter.
9. **No autopilot self-modification.** Dashboard code path is entirely separate from autopilot.
10. **Approvers preserved.** Only Victor in `{approvers}`; dashboard is not an approver.

---

## §13 — Test scope

**No new test files in v1 implementation scope.** For the future Mode 4 implementation, existing validators may be run per `CLAUDE.md` §Change discipline and `PHASE-MODES.md` Mode 4; `npm install` / `npm ci` remains out of scope unless separately gated. A separate `PROJECT-PROGRESS-DASHBOARD-TESTS-DESIGN` phase can design new unit tests later if desired.

---

## §14 — Codex Mode 4 implementation review packet

The future SAFE IMPLEMENTATION phase will receive a Codex review packet of approximately 15–20 goals covering:

**Source-side audit (generator script line-by-line):**

- Explicit path allowlist matches §4 of this design
- Explicit git command allowlist matches §6 of this design
- No `http` / `https` / `fetch` / `net` / `tls` / `dgram` / `url` / `vm` imports
- No write-side `fs.*` API calls (no `writeFile*`, `appendFile*`, `createWriteStream`, `mkdir*`, `unlink*`, `rename*`, `rm*`)
- No `child_process` invocation outside the 4 git command allowlist
- No `process.env` reads in code (zero env reads per §12 invariant 3)
- No new dependency (no `import` / `require` outside Node built-ins; verify `package.json` not modified)
- Parse-failure path always exits non-zero with stderr (no silent partial output)
- Deterministic given identical repo state (modulo metadata timestamp)
- No forbidden literal in code or comments

**Output-side audit (initial `DASHBOARD.md`):**

- SHAs match `git rev-parse` snapshot at regeneration time
- Phase chain matches `STATUS.md` `##` section headers
- `bot.js` / `dashboard.js` labeled OFF-SCOPE / NOT ASSESSED BY THIS DASHBOARD per canonical RE-1 / RE-2
- Zero-network policy text present
- Backlog list matches canonical DESIGN §5 (14 items)
- Roadmap dates only from committed docs / git history
- No forbidden literal in generated content
- Approval-language hygiene (no "approved" or "ready" usage that implies authorization)

**Scope confirmation:**

- 5-file scope: confirm `git status --short` shows exactly 2 new + 3 modified
- No Relay-repo touch
- No protected-file touch
- Naming convention: forward-looking PROJECT-PROGRESS-DASHBOARD-* names; RELAY in active wording

---

## §15 — Pre-authorization scope

This DOCS-ONLY codification phase pre-authorizes **nothing** downstream. Specifically does NOT authorize:

- Writing any file (including a future generator script; no `DASHBOARD.md`; no new handoff record beyond this codification)
- Creating the `tools/` directory
- Opening `PROJECT-PROGRESS-DASHBOARD-IMPLEMENT` (Mode 4 SAFE IMPLEMENTATION) — separately gated; requires its own Codex review + Victor approval cascade
- Opening any future dashboard implementation phase (DESIGN-SPEC-CLOSEOUT, IMPLEMENT, IMPLEMENT-CLOSEOUT, IMPLEMENT-CLOSEOUT-SYNC) or any `PROJECT-PROGRESS-DASHBOARD-TESTS-DESIGN` phase
- Reading the Relay repo (separate repo; off-scope until a separately-gated scope expansion)
- Reading any file in the §5 forbidden list
- Touching Railway, DB, Discord, Relay activation, platform posting, trading, manual live-armed flag action, Autopilot, Phase G, DASH-6, D-5.12f, Migration 009+, Antigravity config
- Any network lookup, scheduler, cron, webhook, MCP install, permission widening, Relay Stage 5 resumption, Phase F amendment or smoke execution, or Migration 009+
- `npm install` / `npm ci`
- Test execution
- Refreshing or regenerating `DASHBOARD.md`

**Codex review verdicts do NOT constitute operator approval.** Per ROLE-HIERARCHY.md and CLAUDE.md: Codex / Claude / Gemini / ChatGPT / Antigravity-hosted agents cannot self-approve. Only Victor's in-session chat instruction in the canonical Claude Code session grants approval.

**Preservation invariants:**

- Migration 008 APPLIED at `189eb1be6ef6304d914671bdaedec44d389cf877` preserved
- N-3 CLOSED preserved
- Stage 5 Gate-10 install approval at `40f3137e842cd60acf1adf17ecc7fe2f0b1b8935` CONSUMED preserved
- CEILING-PAUSE history (broken via `ARC-8-UNPAUSE` at `22ba4a7663e22df64b7cc8e3c0324cbffc0e28f6`; phase-loop counter 0 of 3) preserved
- Relay-runtime DORMANT preserved
- Autopilot DORMANT (verified at `eff4dd22b9b9af038c7ae45de301e60b3f45af98`) preserved
- Approvers exactly `{Victor}` preserved
- Phase A → F Relay-repo chain preserved
- Parent-repo chain through DASHBOARD-DESIGN-SPEC-CLOSEOUT-SYNC at `19db4679aa32fe2e341f86acbedd1f79dc703ecd` preserved
- Canonical dashboard DESIGN handoff at `f6aaa40…` sealed; not modified by this codification
- `position.json.snap.20260502T020154Z` carve-out preserved untracked in parent repo

This DOCS-ONLY codification phase does NOT advance the autopilot phase-loop counter, does NOT install or reconfigure Antigravity, does NOT modify any Phase C/D/E/F sealed file in Relay repo, does NOT modify `bot.js` / `dashboard.js` / `db.js` / migrations / scripts / package files, does NOT modify the canonical dashboard DESIGN handoff at `f6aaa40…`, does NOT post anywhere, and does NOT execute any production action.

---

## §16 — Working-tree discipline at codification time

- Parent repo HEAD: `19db4679aa32fe2e341f86acbedd1f79dc703ecd` (DASHBOARD-DESIGN-SPEC-CLOSEOUT-SYNC)
- Relay repo HEAD: `b8ab035034668fd53ea6efe64432f0868dfd2eb9` (Phase F sealed; unchanged; not touched)
- Parent working tree at codification time: 3 modified parent-repo status docs + 1 new handoff file (this codification's scope) + `position.json.snap.20260502T020154Z` untracked carve-out preserved
- Relay working tree: clean (not touched)

---

## §17 — Next steps (each separately gated; each requires explicit Victor instruction)

1. Codex DOCS-ONLY review of this codification phase (this 4-file scope: 1 new SAFE-class handoff + 3 status-doc updates)
2. Operator commit-only approval naming the 4-file scope, then operator-approved Claude-run commit + push to parent `origin/main`
3. Three-way SHA consistency PASS verified post-push
4. Closeout-of-closeout: a future phase records this DESIGN-SPEC as CLOSED at the post-commit HEAD
5. (Future, separately gated) Operator may open `PROJECT-PROGRESS-DASHBOARD-IMPLEMENT` (SAFE IMPLEMENTATION / Mode 4) to author the read-only generator script and the initial `orchestrator/DASHBOARD.md`. The implementation cascade then continues through its own DESIGN-SPEC / CLOSEOUT phases as described in canonical DESIGN §12.
6. (Future, separately gated) Operator may open `PROJECT-PROGRESS-DASHBOARD-TESTS-DESIGN` if test design is desired
7. (Future, separately gated) Operator may pursue any backlog item from canonical DESIGN §5 as its own separately-gated cascade

Each step requires its own operator decision. This DOCS-ONLY codification phase authorizes none of them.

---

**End of canonical PROJECT-PROGRESS-DASHBOARD-IMPLEMENT-DESIGN record. The future implementation SAFE IMPLEMENTATION phase, the generator script, the initial `DASHBOARD.md`, any maintenance regeneration, Relay-repo scope expansion, test design, smoke tests, deploy, posting, and any production action remain separately gated and are NOT authorized by this DOCS-ONLY codification.**
