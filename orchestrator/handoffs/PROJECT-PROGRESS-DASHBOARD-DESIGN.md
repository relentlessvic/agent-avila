# PROJECT-PROGRESS-DASHBOARD-DESIGN

**Phase identity:** `PROJECT-PROGRESS-DASHBOARD-IMPLEMENT` (future SAFE IMPLEMENTATION; not opened by this codification)
**Phase mode (future implementation):** SAFE IMPLEMENTATION (Mode 4)
**Source-design phase:** `PROJECT-PROGRESS-DASHBOARD-DESIGN` (Mode 2 / DESIGN-ONLY conversation-only v2)
**Source-design HEAD anchor:** `74acd6ec107947539413481afd0318dbf8954a05` (parent repo; = AMENDMENT-DESIGN-SPEC-CLOSEOUT commit)
**Relay-repo Phase F sealed anchor (informational; not touched):** `b8ab035034668fd53ea6efe64432f0868dfd2eb9`
**Codification phase:** `PROJECT-PROGRESS-DASHBOARD-DESIGN-SPEC` (DOCS-ONLY / Mode 3)

This document persists the Codex-PASS v2 conversation-only design for a read-only Project Progress Dashboard as a SAFE-class handoff record. The dashboard is a visibility / governance tool to help the operator track project state at a glance without reading multiple multi-thousand-line markdown files. All 12 Codex DESIGN-ONLY round-1 required edits are applied verbatim. Codex DESIGN-ONLY round-2 narrow re-review returned overall PASS across all 18 narrow goals with no further required edits. The document is NOT approval to open the future implementation phase, NOT a generator script, NOT a regeneration of `DASHBOARD.md`, NOT a network-touch, NOT a deploy.

---

## §0 — Phase classification & pre-flight verification

| Property | Value |
|---|---|
| Future phase name | `PROJECT-PROGRESS-DASHBOARD-IMPLEMENT` |
| Future phase mode | SAFE IMPLEMENTATION (Mode 4) |
| Predecessor (parent repo) | F-HALT-AMENDMENT-DESIGN-SPEC-CLOSEOUT at `74acd6ec107947539413481afd0318dbf8954a05` |
| Successor lettered phase | unchanged — Relay lettered phases continue separately gated |
| Relay-repo state | unchanged at `b8ab035034668fd53ea6efe64432f0868dfd2eb9` (Phase F sealed); off-scope for this dashboard at design time |
| Working tree at design time | clean except `position.json.snap.20260502T020154Z` (untracked carve-out) |

**Codex review history (source design phase, conversation-only):**

- **Round-1 (v1 DESIGN-ONLY):** PASS WITH REQUIRED EDITS — 12 required edits across §1, §3, §4, §5, §6, §7, §9, §11, §13. RE coverage: relabel off-scope runtime paths; remove network lookups (zero-network policy); expand forbidden resources list (deploy/CI/.env*/MCP/exchange/DB/Discord scheduler surfaces); separate phase-status from path-protection class; neutralize forbidden-literal references throughout; add roadmap dates policy; add non-automatic-cascade clause; expand backlog with Migration 009+ / Relay Stage 5 resumption / Phase F amendment-and-smoke follow-ons / Railway-deploy actions / env-secret-permission widening / scheduler-cron-webhook-MCP automation install; expand non-authorization scope.
- **Round-2 (v2 narrow re-review):** overall PASS across all 18 narrow goals. All 12 round-1 REs verified applied. No new forbidden literals introduced in v2. No mode escalation. Architecture unchanged (still Option A static markdown regeneration). Anchors unchanged.

---

## §1 — Purpose & Non-Goals

**Purpose:** A read-only visibility tool that lets the operator see project state at a glance — active phase, completed phases, paused phases, blocked phases, backlog, repo anchors, safety gates, dormant-vs-active systems, next safe action — without needing to read the multi-thousand-line orchestrator markdown files. Consolidates state from `orchestrator/STATUS.md`, `orchestrator/CHECKLIST.md`, `orchestrator/NEXT-ACTION.md`, and `orchestrator/handoffs/*.md` into a single concise view.

**Hard non-goals (the dashboard CANNOT do any of these):**

- Cannot approve anything (only Victor's in-session chat instruction grants approval per CLAUDE.md)
- Cannot trade, deploy, migrate, post to Discord, activate Relay, touch Railway, touch DB, edit env or secrets, or run manual live-armed flag actions
- Cannot modify any file at runtime (the dashboard is purely a viewer; regeneration is a separately-gated phase)
- Cannot make network calls of any kind
- Cannot read live trading state (`position.json`, `position.json.snap.*`) or production runtime code (`bot.js`, `dashboard.js`, `db.js`)
- Cannot self-update or self-advance phase state
- Cannot install or configure schedulers, cron, webhooks, MCP servers, or any background automation

---

## §2 — Recommended phase name (future implementation)

`PROJECT-PROGRESS-DASHBOARD-IMPLEMENT` (Mode 4 SAFE IMPLEMENTATION).

Forward-looking naming follows CLAUDE.md convention. No HERMES literals used.

---

## §3 — Recommended phase mode (future implementation)

**SAFE IMPLEMENTATION (Mode 4)** — implementation phase will write a read-only generator script plus an initial `orchestrator/DASHBOARD.md`. No platform send-message API client. No network reach. No deploy. No production mutation. No trading path. No new dependency. No Phase C/D/E/F sealed-file modification. No bot.js / dashboard.js / db.js / migration / script / package-file touch.

Mode 5 HIGH-RISK is reserved for future phases that introduce network or production behavior (e.g., Relay Phase G). The dashboard does not introduce such behavior.

---

## §4 — Dashboard sections (10)

| # | Section | Purpose |
|---|---|---|
| 1 | Where Are We Now | One-sentence current state with last-commit reference |
| 2 | Active Phase | Phase name, mode, scope, pending decision (single block) |
| 3 | Safety Gates | Critical-status table (Relay dormant, Autopilot dormant, Discord posting not active, live trading not authorized, approvers `{Victor}`, CEILING-PAUSE state, Migration 008 APPLIED, Stage 5 Gate-10 CONSUMED) |
| 4 | Completed Phases | Recent first; collapsible / paginated full chain back to project start; each row shows SHA + phase name + mode |
| 5 | Paused Phases | Items at a known-pause-point with required-edits pending or operator-pending blockers (e.g., paused F-HALT-SMOKE-DESIGN round-1 with 4 REs pending) |
| 6 | Pending / Future Designed Phases | Designed but not yet opened (e.g., future F-HALT-AMENDMENT Mode 4, F-HALT-AMENDMENT-CLOSEOUT, closeout-of-closeout for current CLOSEOUT) |
| 7 | Backlog / Future Ideas | Idea-stage items not yet designed (see §5) |
| 8 | Phase Timeline / Roadmap | ASCII gantt-style mapping of recent + upcoming phases; date policy per §11 |
| 9 | Repo Anchors | Parent HEAD + Relay HEAD + remote-tracking refs; flag any drift between local HEAD and `origin/main` |
| 10 | Next Safe Action | Single sentence — the most natural next operator-decision point |

---

## §5 — Backlog items to track (14 items)

| Item | Status | Notes |
|---|---|---|
| Project Progress Dashboard | DESIGN-ONLY (this phase) | This design |
| Agentic OS / Dreaming Engine | BACKLOG-IDEA | No design yet |
| New Agent Avila Command Center | BACKLOG-IDEA | Richer UI layer over this dashboard; deferred |
| Relay Phase G | BACKLOG-DESIGNED | First HIGH-RISK / Mode 5 phase; introduces platform-network behavior |
| Discord posting | BLOCKED-DEPENDENCY | Cascade through Phase G/H |
| DASH-6 | BLOCKED-DECISION | Separately gated per CLAUDE.md trading-safety rules |
| Live SELL_ALL implementation (D-5.12f) | BLOCKED-DECISION | High-risk trading action; separately gated |
| Inherited forbidden-content cleanup | BACKLOG | Inherited platform-credential env-var name literal in NEXT-ACTION.md plus similar Tier-3 historical literals across status docs; would require its own DESIGN → DESIGN-SPEC → commit cascade |
| Migration 009+ | BLOCKED-DECISION | Per Migration 008 APPLIED + N-3 CLOSED preservation |
| Relay Stage 5 Steps 14-21 / install resumption | BLOCKED-DECISION | Stage 5 Gate-10 install approval at `40f3137e842cd60acf1adf17ecc7fe2f0b1b8935` CONSUMED; Steps 14-21 deferred |
| Phase F amendment / smoke follow-ons | BLOCKED-DEPENDENCY | Future F-HALT-AMENDMENT (Mode 4) + future F-HALT-AMENDMENT-CLOSEOUT + paused F-HALT-SMOKE-DESIGN (round-1 with 4 REs pending) |
| Railway / deploy actions | BLOCKED-DECISION | No deploy authorization in scope; separately gated |
| Env / secret / permission widening | BLOCKED-DECISION | Approvers exactly `{Victor}` preserved |
| Scheduler / cron / webhook / MCP automation install | BLOCKED-DECISION | No background automation; COMM-HUB-RULES.md Hard limits |

---

## §6 — Data sources (read-only; local only)

**ALLOWED (read-only; local file + local git only):**

- `orchestrator/STATUS.md`
- `orchestrator/CHECKLIST.md`
- `orchestrator/NEXT-ACTION.md`
- `orchestrator/handoffs/*.md`
- `orchestrator/AUTOPILOT-RULES.md`
- `orchestrator/APPROVAL-GATES.md`
- `orchestrator/PHASE-MODES.md`
- `orchestrator/PROTECTED-FILES.md`
- `orchestrator/COMM-HUB-RULES.md`
- `orchestrator/COMM-HUB-RELAY-RULES.md`
- `orchestrator/COMM-HUB-RELAY-RUNTIME-DESIGN.md`
- `CLAUDE.md`
- `git log --oneline -N` (read-only)
- `git rev-parse HEAD` (read-only)
- `git rev-parse origin/main` (read-only)
- `git status --short` (read-only)

**Network policy: excluded entirely; no remote lookups, including `git ls-remote`.** Three-way SHA consistency verification (when needed) is performed via operator-side verification during an explicitly-gated push phase — never by this dashboard.

---

## §7 — Files / Resources NEVER read or modified

**Never read at runtime, never modified at runtime:**

- `bot.js`, `dashboard.js`, `db.js` (per CLAUDE.md trading-safety rules + PROTECTED-FILES.md)
- `migrations/`, `scripts/`, `package.json`, `package-lock.json`
- `position.json`, `position.json.snap.20260502T020154Z`
- `.env*`, secrets, env vars
- `.nvmrc`
- Relay repo (`relentlessvic/agent-avila-relay` and its working copy at `/Users/victormercado/code/agent-avila-relay/`) — separate repo; off-scope at design time
- Memory files outside project scope
- Any test files
- `railway.json`, deploy scripts, CI/CD config — deploy / Railway surface
- Claude settings, hooks, MCP server configuration, slash-command permission files — automation actuation surfaces under APPROVAL-GATES.md Gates 11/12/13/16
- Live Kraken / exchange paths — production trading endpoints
- Production DB clients / queries — DB access strictly off-limits
- Discord bot / token / webhook / scheduler surfaces — platform actuation surfaces
- Railway / DB / external API endpoints — any network calls

The dashboard never writes to ANY file at runtime. Refresh of `DASHBOARD.md` requires an explicit operator-approved gated phase (separate from runtime viewing).

---

## §8 — Phase / Status model + Protection class

Two independent dimensions to display per tracked phase or file path. **Phase status describes lifecycle. Protection class describes path governance.** They are not conflated; the dashboard displays them as separate columns.

**Phase status values (lifecycle):**

- `CLOSED` — committed + pushed; SHA recorded
- `ACTIVE` — currently in flight in a Claude session
- `PAUSED` — round-N review-pending; waiting on operator decision
- `DESIGNED-NOT-OPENED` — codified design exists; phase not yet opened
- `BACKLOG-DESIGNED` — canonical design doc exists but indefinitely gated
- `BACKLOG-IDEA` — concept only; no design yet
- `BLOCKED-DEPENDENCY` — waiting on a prior phase
- `BLOCKED-DECISION` — waiting on operator decision unrelated to a phase cascade
- `DORMANT` — built but not running

**Protection class (path governance per PROTECTED-FILES.md; separate column):**

- `SAFE`
- `RESTRICTED`
- `HARD BLOCK`

Protection class describes how files are governed (which paths require which approval cascades to modify). It is NOT a phase lifecycle state.

---

## §9 — UI layout (Markdown-first)

Single page; sections in this order (each rendered as a markdown heading):

```
# Project Progress Dashboard — Agent Avila

Generated: <ISO-8601 metadata timestamp>
Parent HEAD: <short SHA>  (relentlessvic/agent-avila)
Relay HEAD:  <short SHA>  (relentlessvic/agent-avila-relay; sealed)
Working tree: clean except <untracked carve-outs>

──────────────────────────────────────────────────
⚪ WHERE ARE WE NOW
──────────────────────────────────────────────────
<one sentence>

──────────────────────────────────────────────────
⚡ ACTIVE PHASE
──────────────────────────────────────────────────
Phase:     <name>
Mode:      <Mode 1-6>
Scope:     <N files>
Pending:   <single next decision>

──────────────────────────────────────────────────
🚦 SAFETY GATES
──────────────────────────────────────────────────
| Gate                            | Status            |
| Relay runtime                   | DORMANT           |
| Autopilot                       | DORMANT           |
| Discord posting                 | NOT ACTIVE        |
| Live trading authorization      | NOT AUTHORIZED    |
| Manual live-armed flag          | OPERATOR-ONLY     |
| Approvers                       | {Victor}          |
| CEILING-PAUSE                   | broken via ARC-8-UNPAUSE; counter 0 of 3 |
| Migration 008                   | APPLIED           |
| Stage 5 Gate-10 install         | CONSUMED          |
| N-3 deploy gate                 | CLOSED            |

──────────────────────────────────────────────────
✅ COMPLETED PHASES (recent first; collapsible / paginated)
──────────────────────────────────────────────────
SHA       | Phase                                             | Mode
<short>   | <phase>                                           | <mode>
...

──────────────────────────────────────────────────
⏸️ PAUSED PHASES
──────────────────────────────────────────────────
- <phase> — <round-state + REs pending>

──────────────────────────────────────────────────
🚧 DESIGNED / NOT-OPENED
──────────────────────────────────────────────────
- <phase> — <mode + brief>

──────────────────────────────────────────────────
💡 BACKLOG / FUTURE IDEAS
──────────────────────────────────────────────────
- <item> — <status + brief>

──────────────────────────────────────────────────
📅 TIMELINE / ROADMAP (ASCII)
──────────────────────────────────────────────────
<ASCII gantt-style; dates only when sourced from committed docs or git history>

──────────────────────────────────────────────────
🔗 REPO ANCHORS
──────────────────────────────────────────────────
Parent: relentlessvic/agent-avila          @ <short SHA> (main; sync state)
Relay:  relentlessvic/agent-avila-relay    @ <short SHA> (main; sealed)

──────────────────────────────────────────────────
🛡️ DORMANT vs ACTIVE SYSTEMS
──────────────────────────────────────────────────
| System              | State                                              | Notes                                  |
| Relay runtime       | DORMANT                                            | wired; not activated; fails closed     |
| Autopilot           | DORMANT                                            | phase-loop counter 0 of 3              |
| Trading bot (bot.js)| OFF-SCOPE / NOT ASSESSED BY THIS DASHBOARD         | path is HARD BLOCK per PROTECTED-FILES.md |
| dashboard.js        | OFF-SCOPE / NOT ASSESSED BY THIS DASHBOARD         | path is RESTRICTED per PROTECTED-FILES.md |
| Antigravity         | INSTALLED                                          | workspace config landed; not running   |

──────────────────────────────────────────────────
👉 NEXT SAFE ACTION
──────────────────────────────────────────────────
<one sentence>
```

---

## §10 — Roadmap dates policy

Roadmap dates may appear only when sourced from committed docs or git history; otherwise use phase order without dates. The "Generated" timestamp at the top of the dashboard is allowed only as metadata. No speculative future dates. No dates inferred from external calendar data.

---

## §11 — Safety invariants (10)

1. **READ-ONLY at runtime.** The viewer never writes a file. Regeneration of `DASHBOARD.md` is a separately-gated DOCS-ONLY phase.
2. **No network.** Zero network calls; no `fetch`, `curl`, `gh api`, `git ls-remote`, no remote lookups.
3. **No env or secret reads.** Refuse to read `.env*`, secrets directories, or any file with credential or token patterns in its name.
4. **No trading-runtime reads.** Refuse to read `bot.js`, `dashboard.js`, `db.js`, `position.json*`.
5. **No Relay-repo touch at design time.** Read-only access only after operator approval to broaden scope in a separate phase.
6. **No execution of production actions.** No deploy, no Railway, no DB queries, no Discord posts, no order placement.
7. **No advancement of phase state.** Reading state does not change state. Phase transitions still require Codex review + Victor approval.
8. **No CEILING-PAUSE break.** Reading current state cannot bump the phase-loop counter or unpause.
9. **No autopilot self-modification.** Dashboard code path is entirely separate from autopilot.
10. **Approvers preserved.** Only Victor is in the approvers set; dashboard is not an approver.

---

## §12 — Future implementation cascade (5 phases)

Five separately-gated phases to bring this design to a working dashboard:

| # | Phase | Mode | Scope |
|---|---|---|---|
| 1 | `PROJECT-PROGRESS-DASHBOARD-DESIGN` | Mode 2 / DESIGN-ONLY | The conversation-only v2 report (already PASSed) |
| 2 | `PROJECT-PROGRESS-DASHBOARD-DESIGN-SPEC` | Mode 3 / DOCS-ONLY | This codification (new SAFE-class handoff + 3 status-doc updates) |
| 3 | `PROJECT-PROGRESS-DASHBOARD-IMPLEMENT` | Mode 4 / SAFE IMPLEMENTATION | Write read-only generator script (path TBD per Codex review) + initial `orchestrator/DASHBOARD.md` |
| 4 | `PROJECT-PROGRESS-DASHBOARD-IMPLEMENT-CLOSEOUT` | Mode 3 / DOCS-ONLY | Record implementation as CLOSED at the post-commit SHA |
| 5 | `PROJECT-PROGRESS-DASHBOARD-IMPLEMENT-CLOSEOUT-SYNC` | Mode 3 / DOCS-ONLY | Closeout-of-closeout for phase 4 |

**This is not an automatic cascade; each phase requires explicit Victor instruction to open, the mode-appropriate Codex review, and any required Victor approval before commit or action.**

Subsequent maintenance: each refresh of `DASHBOARD.md` is its own separately-gated DOCS-ONLY regeneration phase (operator-approved Codex review of the generated content + commit + push).

---

## §13 — Recommended implementation: Option A — static markdown regeneration

**Option A (RECOMMENDED).** A read-only Node script (e.g., `tools/dashboard-generate.js` — exact path subject to Codex review at implementation time) that:

- Reads the canonical orchestrator markdown docs and `orchestrator/handoffs/*.md`
- Reads local read-only git ops (`git log --oneline -N`, `git rev-parse HEAD`, `git rev-parse origin/main`, `git status --short`) only
- Makes zero network calls (no `git ls-remote`, no `fetch`, no `curl`, no `gh api`)
- Reads no forbidden file (per §7) — refuses by explicit path-pattern allowlist
- Emits `orchestrator/DASHBOARD.md` to stdout; the operator pipes the output to a file via `>` and explicitly stages the result
- Never writes any file itself; never executes shell commands beyond the read-only git ops listed

**Why safest:** Pure read + transform; no file system writes by the script; no network; output is version-controlled markdown; refresh requires explicit operator action (separately-gated phase); easy to Codex-audit (DOCS-ONLY review of generator content + DOCS-ONLY review of generated output).

**Alternatives considered (deferred):**

- **Option B (CLI tool that prints to terminal, no file output)** — also safe; simpler; no version-controlled snapshot
- **Option C (static HTML with richer formatting)** — deferred to a later "new Agent Avila Command Center" backlog item; HTML rendering layer could be added later over Option A's data sources

---

## §14 — Working-tree state at design / codification time

- Parent repo HEAD: `74acd6ec107947539413481afd0318dbf8954a05` (F-HALT-AMENDMENT-DESIGN-SPEC-CLOSEOUT)
- Relay repo HEAD: `b8ab035034668fd53ea6efe64432f0868dfd2eb9` (Phase F sealed; unchanged; not touched)
- Parent working tree at codification time: 3 modified parent-repo status docs + 1 new handoff file (this codification's scope) + `position.json.snap.20260502T020154Z` untracked carve-out preserved
- Relay working tree: clean (not touched)

---

## §15 — Non-authorization preservation clauses

This DOCS-ONLY codification phase pre-authorizes nothing downstream. Specifically does NOT authorize:

- Writing any file (including a future `DASHBOARD.md`, generator script, or new handoff record beyond this codification)
- Opening `PROJECT-PROGRESS-DASHBOARD-IMPLEMENT` (Mode 4 SAFE IMPLEMENTATION) — separately gated; requires its own Codex review + Victor approval cascade
- Opening the future closeout phases for the dashboard
- Reading the Relay repo (separate repo; off-scope until a separately-gated scope expansion)
- Reading any file in the forbidden list (§7)
- Touching Railway, DB, Discord, Relay activation, platform posting, trading, manual live-armed flag action, Autopilot, Phase G, DASH-6, D-5.12f, Migration 009+, Antigravity config
- Any network lookup, scheduler, cron, webhook, MCP install, permission widening, Relay Stage 5 resumption, Phase F amendment or smoke execution, or Migration 009+
- Refreshing or regenerating `DASHBOARD.md` (a future regeneration is its own separately-gated DOCS-ONLY phase)

**Codex review verdicts do NOT constitute operator approval.** Per ROLE-HIERARCHY.md and CLAUDE.md: Codex / Claude / Gemini / ChatGPT / Antigravity-hosted agents cannot self-approve. Only Victor's in-session chat instruction in the canonical Claude Code session grants approval.

**Preservation invariants:**

- Migration 008 APPLIED at `189eb1be6ef6304d914671bdaedec44d389cf877` preserved
- N-3 CLOSED preserved
- Stage 5 Gate-10 install approval at `40f3137e842cd60acf1adf17ecc7fe2f0b1b8935` CONSUMED preserved
- CEILING-PAUSE history (broken via `ARC-8-UNPAUSE` at `22ba4a7663e22df64b7cc8e3c0324cbffc0e28f6`; phase-loop counter 0 of 3) preserved
- Relay-runtime DORMANT preserved
- Autopilot DORMANT (verified at `eff4dd22b9b9af038c7ae45de301e60b3f45af98`) preserved
- Approvers exactly `{Victor}` preserved
- Phase A → F Relay-repo chain preserved (Relay A `fcfec4882…` → B `f87faef99…` → C `413a4fb…` → D `0d0210a3…` → E `21896d65…` → F `b8ab035…`)
- Parent-repo chain through F-HALT-AMENDMENT-DESIGN-SPEC-CLOSEOUT at `74acd6ec107947539413481afd0318dbf8954a05` preserved
- `position.json.snap.20260502T020154Z` carve-out preserved untracked in parent repo

This DOCS-ONLY codification phase does NOT advance the autopilot phase-loop counter, does NOT install or reconfigure Antigravity, does NOT modify any Phase C/D/E/F sealed file, does NOT modify `bot.js` / `dashboard.js` / `db.js` / migrations / scripts / package files, does NOT modify the Relay repo, does NOT post anywhere, and does NOT execute any production action.

---

## §16 — Next steps (each separately gated; each requires explicit Victor instruction)

1. Codex DOCS-ONLY round-1 review of this codification phase (this 4-file scope: 1 new SAFE-class handoff + 3 status-doc updates).
2. Operator commit-only approval naming the 4-file scope, then operator-approved Claude-run commit + push to parent `origin/main`.
3. Three-way SHA consistency PASS verified post-push.
4. Closeout-of-closeout: a future phase records this DESIGN-SPEC as CLOSED at the post-commit HEAD.
5. (Future, separately gated) Operator may open `PROJECT-PROGRESS-DASHBOARD-IMPLEMENT` (SAFE IMPLEMENTATION / Mode 4) to author the read-only generator script and the initial `orchestrator/DASHBOARD.md`. The implementation cascade then continues through its own DESIGN-SPEC / CLOSEOUT phases.
6. (Future, separately gated) Operator may pursue any backlog item from §5 as its own separately-gated cascade.

Each step requires its own operator decision. This DOCS-ONLY codification phase authorizes none of them.

---

**End of canonical PROJECT-PROGRESS-DASHBOARD-DESIGN record. The future implementation SAFE IMPLEMENTATION phase, the generator script, the initial `DASHBOARD.md`, any maintenance regeneration, Relay-repo scope expansion, smoke tests, deploy, posting, and any production action remain separately gated and are NOT authorized by this DOCS-ONLY codification.**
