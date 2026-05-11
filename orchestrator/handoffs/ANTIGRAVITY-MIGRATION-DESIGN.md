# ANTIGRAVITY-MIGRATION-DESIGN

**Phase identity:** `ANTIGRAVITY-MIGRATION-DESIGN`
**Phase mode (source):** Mode 2 / DESIGN-ONLY (conversation)
**Source-design HEAD anchor:** `02edc238790c016fb5c36bc7b0fbdd563fa030f7` (= COMM-HUB-RELAY-RUNTIME-IMPLEMENT-F-HALT-DESIGN-SPEC)
**Codification phase:** `ANTIGRAVITY-MIGRATION-DESIGN-SPEC` (DOCS-ONLY / Mode 3)
**Architectural option chosen:** **Option B** — Antigravity = primary IDE for safe work; Claude Code session = approval / commit / push / RED-tier surface
**Future operator-manual install phase (separately gated):** `ANTIGRAVITY-MIGRATION-A-WORKSPACE-CONFIG` or operator-chosen name (NOT authorized by this DESIGN or its codification)

This document persists the Codex-PASS ANTIGRAVITY-MIGRATION-DESIGN as a SAFE-class handoff record. The design describes how Agent Avila's workflow can move into Google Antigravity IDE **without** moving authority, secrets, commits, pushes, DB access, Railway access, Discord posting, Kraken API access, trading, Relay activation, Autopilot activation, or approvals. All 10 DPI items (DPI-A1 through DPI-A10) are resolved per operator answers; one Codex round-1 required edit (RE-1 to §10) is applied verbatim. The document is NOT approval to install Antigravity, NOT authorization to configure any workspace, NOT a credential grant, NOT a deploy.

---

## §0 — Phase classification & DPI resolution summary

| Property | Value |
|---|---|
| Phase name | `ANTIGRAVITY-MIGRATION-DESIGN` |
| Phase mode (source) | Mode 2 / DESIGN-ONLY (conversation-only) |
| Codification phase | `ANTIGRAVITY-MIGRATION-DESIGN-SPEC` (DOCS-ONLY / Mode 3) |
| Source-design HEAD anchor | `02edc238790c016fb5c36bc7b0fbdd563fa030f7` |
| Architectural option | **Option B** (per DPI-A2) |
| Target IDE | Google Antigravity (per DPI-A1) |
| Working tree at design time | clean except `position.json.snap.20260502T020154Z` (untracked carve-out) |

**Resolved DPI summary (operator answers):**

| DPI | Resolution |
|---|---|
| DPI-A1 | Antigravity = **Google Antigravity IDE** |
| DPI-A2 | **Option B** — Antigravity as primary safe-work IDE; Claude Code session retains authority/secrets/RED-tier |
| DPI-A3 | Antigravity has **read access to `agent-avila`** |
| DPI-A4 | Antigravity has **read access to `agent-avila-relay`** |
| DPI-A5 | **NO memory-file access** for Antigravity |
| DPI-A6 | **Read-only CLI only** — no `npm install`, no `git push`, no production DB connection, no `node bot.js` |
| DPI-A7 | **NO `.env` access** |
| DPI-A8 | **Codex review required** for all Antigravity-generated code before canonical placement |
| DPI-A9 | **No auto-memory sync** |
| DPI-A10 | **No commits or pushes from Antigravity** |

**Codex review history (source design phase):**
- Round-1 DESIGN-ONLY: PASS WITH REQUIRED EDITS (1 RE issued — RE-1 to §10 removing `git fetch` from ALLOWED and adding it to FORBIDDEN with conditional wording).
- Round-2 narrow re-review: overall PASS across all 4 ultra-narrow goals; no new required edits.

---

## §1 — Recommended phase names

- **This phase (source, Mode 2):** `ANTIGRAVITY-MIGRATION-DESIGN`
- **Codification (this codification, Mode 3 DOCS-ONLY):** `ANTIGRAVITY-MIGRATION-DESIGN-SPEC`
- **Future workspace-config phase (separately gated; no install step authorized by this design):** `ANTIGRAVITY-MIGRATION-A-WORKSPACE-CONFIG` (operator-chosen name)

---

## §2 — Architectural option B (FIRM after DPI-A2)

Antigravity becomes the **primary day-to-day safe-work surface** for:
- Reading the `agent-avila` and `agent-avila-relay` working trees
- Drafting design proposals (Mode 2 conversation-only material before it's brought back to Claude Code for canonical handling)
- Drafting code for future Phase F / G / H modules into scratch buffers
- Drafting tests (never executed against production)
- Exploration / search across both repos
- Reading canonical handoff records, ARC docs, CLAUDE.md
- Reading public web documentation via Antigravity's own tools
- Acting as an additional pre-review brain (analogous to ChatGPT fallback per the 3-brains rule in auto-memory)

Claude Code session retains **exclusive control** over:
- All approvals
- All secrets (Anthropic / Discord / Railway / Kraken / DB / GitHub tokens; `.env`)
- All staging / committing / pushing to `agent-avila` and `agent-avila-relay`
- All RED-tier actions (Railway, Discord, DB, Kraken, trading, Relay activation, Autopilot activation, external Hermes Agent integration, Stage 5/6/7, DASH-6, D-5.12f, Migration 009+, manual live-armed flag, position.json, memory-file writes, ARC-1 through ARC-7 edits)
- Codex dispatches (review thread management stays in Claude Code session)

---

## §3 — Authority preservation rules (FIRM)

Mirrors CLAUDE.md Discord-is-not-approval rule, extended to Antigravity:

1. **Victor remains sole approver.** Set of approvers stays exactly `{Victor}`.
2. **Antigravity is NEVER an approval surface.** An Antigravity reply, agent comment, code suggestion, autonomous run completion, IDE-side "approve" affordance, or any tool-side action is NEVER operator approval.
3. **Only Victor's in-session chat instruction in the canonical Claude Code session grants approval.**
4. **Antigravity agents cannot self-approve.** Extended `ROLE-HIERARCHY.md`: Claude / Codex / ChatGPT / Gemini / Ruflo / Relay / successors / Antigravity-hosted agents all cannot self-approve.
5. **No automation-non-promotion bypass.** Antigravity scheduled runs, cron, autonomous loops, or background agents do NOT satisfy any operator-approval gate.

---

## §4 — Secret-handling rules (FIRM after DPI-A7)

1. **No `.env` access** — per DPI-A7. Workspace exclude rules + operator-side block. `.env` never opened, never indexed, never sent to Antigravity backend.
2. **No Railway / Discord / Kraken / DB / GitHub tokens** ever in Antigravity context.
3. **No manual live-armed flag literal exposure** in Antigravity-drafted text.
4. **Git read access via SSH key only.** Antigravity may `git log` / `git diff` / `git status` / `git show` / `git ls-files` (read-only inspection). No `git push` (per DPI-A10). No `git commit` to canonical branches (per DPI-A10). No `git fetch` from Antigravity unless separately approved in a future operator-manual setup phase (per Codex round-1 RE-1; see §10).
5. **No memory-file mirroring** — per DPI-A5. Auto-memory at `~/.claude/projects/.../memory/` stays scoped to Claude Code session; Antigravity workspace exclude rule.
6. **Antigravity's own credentials (Google account, Antigravity API)** are separate from Agent Avila credentials and stay inside the Antigravity environment.

---

## §5 — Trading runtime boundary (FIRM)

`bot.js`, `dashboard.js`, `db.js`, `migrations/*`, `scripts/*`, `position.json*` MUST NOT be:
- Edited from Antigravity
- Executed from Antigravity (per DPI-A6: no `node bot.js`)
- Have their secrets accessed from Antigravity
- Have their production state read from Antigravity (no production DB connection per DPI-A6)

Per CLAUDE.md: "Do not modify live trading logic unless Victor explicitly approves." Antigravity inherits this rule without exception.

- Backtesting stays offline and separate from live trading (per CLAUDE.md).
- Strategy V2 cannot trade live during backtesting work conducted in Antigravity.
- Kraken API calls forbidden from Antigravity.

---

## §6 — Relay / external Hermes Agent boundary (FIRM)

- **Relay stays DORMANT** regardless of Antigravity setup. Antigravity may read `orchestrator/COMM-HUB-RELAY-RULES.md`, `orchestrator/COMM-HUB-RELAY-RUNTIME-DESIGN.md`, and all Relay-related handoff records but cannot activate Relay or advance Stages 1–10b.
- **External Hermes Agent (Nous/OpenRouter) NOT integrated via Antigravity.** Reserved term per `CLAUDE.md`; remains uninstalled.
- **No Discord bot / token / webhook touch from Antigravity.**
- **Future Phase G-GATEWAY drafting in Antigravity** is allowed as scratch-buffer drafting, but commits to the Relay repo follow the operator-manual + Claude-Code-session pattern established in Phases A–E (no exceptions).

---

## §7 — Orchestrator boundary (FIRM)

- `orchestrator/STATUS.md`, `orchestrator/CHECKLIST.md`, `orchestrator/NEXT-ACTION.md`, all `orchestrator/handoffs/*`, all ARC-1 through ARC-7 safety-policy docs remain **authoritatively maintained in the Claude Code session**.
- Antigravity may **read** these for context. It may NOT write them as the source of truth.
- If a draft for any of these is composed in Antigravity, the operator must paste it back into the Claude Code session for review and apply via the canonical orchestrator path.
- All phase opens (Mode 2/3/4/5/6), Codex review dispatches, commits, pushes, closeouts continue to be initiated from the canonical Claude Code session.

---

## §8 — Antigravity-generated code review rule (FIRM after DPI-A8)

Any code drafted in Antigravity that the operator intends to bring into either repo MUST:
1. Be carried back to the Claude Code session by the operator (paste / file copy / branch hand-off).
2. Be staged for **Codex on-disk review** using the same per-phase Codex review cadence as Phases C/D/E (round-1 → apply RE → round-2 → PASS).
3. Optionally also be reviewed by Gemini (long-context UX) per the 3-brains rule in auto-memory; ChatGPT fallback if Gemini quota fails.
4. Only after Codex PASS may the operator approve staging + commit + push from the Claude Code session.

Applies to ALL code: `src/`, `tests/`, `scripts/`, `migrations/`, scaffolding files. **No exception.**

---

## §9 — Memory-sync rule (FIRM after DPI-A9)

- **No automatic memory cross-pollination.** Antigravity does NOT read or write Claude Code auto-memory.
- **No file-system memory bleed.** Workspace exclude rule for `~/.claude/projects/*/memory/` and any other memory paths.
- **Operator-mediated transfer only.** If something Antigravity learns is worth durable memory, the operator manually communicates it in the Claude Code session and Claude Code's auto-memory system saves it per its own rules.

---

## §10 — CLI scope (FIRM; revised per Codex round-1 RE-1)

Antigravity is permitted to invoke:
- **Git read-only inspection:** `git status`, `git log`, `git diff`, `git ls-files`, `git show` — these inspect existing repo state without network or write side effects.
- `cat`, `head`, `tail`, `less` (read-only file inspection)
- `grep`, `rg`, `ag`, `find` (read-only search)
- `node --version`, `npm --version`, `node -e '<small-expr>'` (read-only inspection; no side-effecting scripts)
- Test-suite invocation **only if** the suite is hermetic and does not touch DB, Discord, Railway, Kraken, network, or production state (none of the current test suites in this repo qualify by default — operator must explicitly whitelist any suite for Antigravity execution)

Antigravity is FORBIDDEN from invoking:
- `git push`, `git commit` to canonical branches (per DPI-A10)
- **`git fetch` from Antigravity unless separately approved in a future operator-manual setup phase** (per Codex round-1 RE-1 — `git fetch` mutates local Git metadata by updating `refs/remotes/origin/*`, downloading pack data, and writing to `FETCH_HEAD`, so it is not strictly read-only)
- `npm install`, `npm ci`, `npm publish` (per DPI-A6)
- `node bot.js`, `node dashboard.js`, any execution of trading code (per DPI-A6)
- `psql`, `pg_dump`, any DB client targeting production (per DPI-A6)
- `railway`, `railway login`, `railway up`, `railway deploy` (per CLAUDE.md trading safety + this design's RED-tier exclusion)
- Discord client CLI tools, `curl https://discord.com/...`, webhook POSTs
- Kraken API CLI tools
- Any command reading `.env` or writing to `.env` (per DPI-A7)
- Any command writing to `~/.claude/projects/*/memory/` (per DPI-A5 + DPI-A9)

**Cross-reference impact on §11 (workspace configuration):** The operator-side workspace config should additionally configure Antigravity to NOT auto-`git fetch` on workspace open. If Antigravity needs an up-to-date view of `origin/main`, the operator manually performs `git fetch` in the canonical Claude Code session and Antigravity reads the locally-updated refs (still without network access from Antigravity).

---

## §11 — Antigravity workspace configuration (operator-side; conversation-only recommendations)

The operator-side workspace setup for Antigravity (when ready) should include:

**Workspace exclude / ignore rules:**
- `.env`
- `.env.*`
- `**/node_modules/**` (size + noise; not a security boundary)
- `~/.claude/**` (memory + Claude Code internals)
- `position.json`
- `position.json.snap.*`
- `**/secrets/**`
- `**/credentials/**`
- `*.pem`, `*.key`, `*.p12`, `*.pfx` (any cert/key files)

**Agent configuration:**
- Disable any agent that auto-invokes `git push`, `git fetch`, `npm install`, or any side-effecting CLI command.
- Disable any MCP server / extension that introduces a new approval surface, scheduler, webhook, or background automation.
- Disable any cross-session memory or cloud-sync feature that would mirror Antigravity context to remote services beyond what's required for Antigravity's own operation.
- Disable auto-`git fetch` on workspace open (per Codex round-1 RE-1 cross-reference in §10).

**Repo access:**
- Read-only fetch credentials only (SSH key or HTTPS read-only token).
- No write credentials configured in Antigravity (no GitHub PAT with `repo:write`, no SSH key with push privileges).

**Operator workflow:**
- Open Antigravity for design / drafting / exploration sessions.
- For any code or doc that needs canonical placement: copy back to Claude Code session, dispatch Codex review here, apply RE here, commit here, push here.
- Approvals always typed in Claude Code session chat input.

This entire §11 is a **conversation-only recommendation**; this DESIGN-SPEC records it as a SAFE-class handoff; **no install step is authorized by this DESIGN or its codification.**

---

## §12 — Safety boundaries / anti-features (FIRM)

This ANTIGRAVITY-MIGRATION-DESIGN-SPEC codification phase MUST:

- NOT install or activate Antigravity (operator-manual install only; this design records recommendations).
- NOT migrate authority (per §3).
- NOT migrate secrets (per §4 + DPI-A7).
- NOT modify the trading runtime (per §5).
- NOT touch Relay or external Hermes Agent (per §6).
- NOT change orchestrator authority (per §7).
- NOT modify ARC-1 through ARC-7.
- NOT introduce any new approval surface, scheduler, webhook, MCP server, cron, or background automation.
- NOT activate Autopilot Loop B/C/D.
- NOT advance the phase-loop counter.
- NOT break CEILING-PAUSE.
- NOT modify any safety-policy doc / canonical Relay handoff record / runtime / migration / script / deploy file.
- NOT modify Phase C / Phase D / Phase E sealed files in either repo.

This DOCS-ONLY codification phase produces 4 parent-repo file changes only (1 new SAFE-class handoff record + 3 status doc updates). No Relay-repo touch. No install. No commit until operator approval. No push until operator approval.

---

## §13 — Surface authority matrix (Option B baked in)

| Surface | Read trees | Draft code | Draft docs | Exec read-only CLI | Edit `bot.js` etc. | Stage/commit `main` | Push `origin/main` | Railway/Discord/DB/Kraken | Approve | Auto-memory R/W |
|---|---|---|---|---|---|---|---|---|---|---|
| Victor (operator) | ✓ | ✓ | ✓ | ✓ | ✓ (sole) | ✓ | ✓ | ✓ (sole) | ✓ (sole) | n/a |
| Claude Code (canonical) | ✓ | ✓ (with approval) | ✓ (with approval) | ✓ (with approval) | ✗ (without explicit approval) | ✓ (with approval) | ✓ (with approval) | ✗ (without explicit approval) | ✗ | ✓ |
| **Antigravity** (new) | ✓ | ✓ (scratch / local only) | ✓ (scratch / local only) | ✓ (read-only subset only per §10) | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Codex | ✓ (review only) | ✗ | ✗ | ✓ (read-only) | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Gemini / ChatGPT | ✓ (review only) | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |

Antigravity row is more restrictive than Claude Code for every column except read access + read-only CLI subset.

---

## §14 — Risk register (revised; DPI resolutions + Codex RE-1 applied)

| Risk | Likelihood (with DPI applied) | Severity | Mitigation |
|---|---|---|---|
| Antigravity autonomously runs `git push` | LOW | HIGH | §10 forbids; DPI-A10 firm; no push credential configured in Antigravity |
| Antigravity reads `.env` and exposes secrets | LOW | CRITICAL | DPI-A7 firm; §11 workspace exclude |
| Antigravity installs MCP/extension that introduces new approval surface | LOW-MED | HIGH | §11 agent-config rule; §12 explicit prohibition |
| Code skips Codex review on the way to canonical placement | LOW | MEDIUM | DPI-A8 firm + §8 procedural rule |
| Background agent edits `bot.js` / `dashboard.js` / `migrations/` | LOW | CRITICAL | §5 firm; workspace + agent config blocks |
| Antigravity tries to activate Relay or Autopilot | LOW | CRITICAL | §6 + §12 firm |
| Operator confuses Antigravity UI "approved" affordance with operator approval | MED | HIGH | §3 mirrors CLAUDE.md Discord rule explicitly |
| Memory bleed via shared OS filesystem | LOW | MEDIUM | DPI-A5 + DPI-A9; §11 workspace exclude on `~/.claude/**` |
| Antigravity backend retains snippets of repo code or chat | MED | MEDIUM (depending on data handling) | Operator-side: review Antigravity data retention / training-opt-out settings; never paste secret material into Antigravity context |
| Antigravity-generated test triggers DB or network side effect | LOW (no whitelisted test suite) | HIGH if it happens | §10 forbids test-suite execution unless explicitly whitelisted by operator |
| Antigravity auto-`git fetch` mutates local refs on workspace open | LOW (after §11 disable) | LOW-MED | §10 + §11 disable auto-fetch; operator performs `git fetch` in Claude Code session manually |

---

## §15 — Codex review history (source design phase)

- **Round-1 DESIGN-ONLY:** PASS WITH REQUIRED EDITS. 9/10 goals PASS; Goal 6 FAIL on §10 ALLOWED list including `git fetch` (which is not strictly read-only).
- **RE-1 applied verbatim conversation-only:** removed `git fetch` from §10 ALLOWED list; added `git fetch from Antigravity unless separately approved in a future operator-manual setup phase` to §10 FORBIDDEN list with Codex-supplied rationale preserved.
- **Round-2 narrow re-review:** overall PASS across all 4 ultra-narrow goals (RE-1 application + scope unchanged + no new issues + all round-1 PASS anchors preserved). No new required edits.

---

## §16 — Non-authorization preservation clauses

This DESIGN-SPEC codification phase pre-authorizes **nothing** downstream. Specifically does NOT authorize:

- Installing Google Antigravity IDE (operator-manual install only; separately gated future operator decision)
- Configuring any Antigravity workspace (separately gated future operator decision after install)
- Giving Antigravity any credential (no Anthropic / Discord / Railway / Kraken / DB / GitHub token; no SSH key with push privileges; no GitHub PAT with `repo:write`)
- Any Antigravity-side commit, push, deploy, Discord activity, Railway activity, DB connection, Kraken API call, trading code execution, Relay activation, Autopilot activation, or external Hermes Agent integration
- Modification of ARC-1 through ARC-7
- Advancing the phase-loop counter
- Breaking CEILING-PAUSE
- Modifying the trading runtime
- Modifying orchestrator authority
- Posting to Discord
- Reading `.env` from Antigravity
- Reading auto-memory at `~/.claude/projects/.../memory/` from Antigravity
- Running `git push`, `git fetch`, `npm install`, `node bot.js`, `psql`, or `railway` from Antigravity
- Stage 5 install resumption (Steps 14–21 remain deferred; Stage 5 Gate-10 install approval at `40f3137e842cd60acf1adf17ecc7fe2f0b1b8935` remains CONSUMED)
- Stage 7 dry-run execution; Stages 8 / 9 / 10a / 10b auto-publish
- DASH-6 / D-5.12f / Migration 009+
- Memory-file edit; test-suite edit
- Modification of any other safety-policy doc / canonical Relay handoff record / runtime / migration / script / deploy file
- Phase F SAFE IMPLEMENTATION (`COMM-HUB-RELAY-RUNTIME-IMPLEMENT-F-HALT`) or any subsequent Relay-runtime lettered phase

**Codex round-2 PASS verdict does NOT constitute operator approval.** Per `ROLE-HIERARCHY.md` and `CLAUDE.md`: Codex / Claude / Gemini / ChatGPT / Antigravity-hosted agents cannot self-approve. Only Victor's in-session chat instruction in the canonical Claude Code session grants approval. The set of approvers stays exactly `{Victor}`.

**Preservation invariants:**
- Migration 008 APPLIED at `189eb1be6ef6304d914671bdaedec44d389cf877` preserved
- N-3 CLOSED preserved
- Stage 5 Gate-10 install approval at `40f3137e842cd60acf1adf17ecc7fe2f0b1b8935` CONSUMED preserved
- Phase A CLOSED at Relay-repo `fcfec4882ac9fbb7fab1946bd3b9677ea9a211cf` preserved
- Phase A closeout CLOSED at parent-repo `1b20628ed280323c6b249c1e5d617ad17ea5a026` preserved
- B-DEPS-DESIGN-SPEC CLOSED at parent-repo `2b9144fc2536991a8966526ec28042b2bbe5ac5b` preserved
- Phase B CLOSED at Relay-repo `f87faef99600335a7db47ac1bffa92a499e54acb` preserved
- Phase B closeout CLOSED at parent-repo `5f2fc810c1b4c77607e8aa8ac40fe61fa32ed269` preserved
- C-CONFIG-DESIGN-SPEC CLOSED at parent-repo `491a24f5c3220be38f7faf51fe27497a4b441ac9` preserved
- Phase C CLOSED at Relay-repo `413a4fbeef65ca0d1fb03454d9993af6360d3ac4` preserved
- Phase C closeout CLOSED at parent-repo `7e0d227d843a58c5f851164485439cb17ae2632b` preserved
- D-STORE-DESIGN-SPEC CLOSED at parent-repo `1625f13f62df565bb52705e0106769624d061dd0` preserved
- Phase D CLOSED at Relay-repo `0d0210a32d9341d09bb7bed9be93d17c58791fbe` preserved
- Phase D closeout CLOSED at parent-repo `0314d2c0df50b67292a1f219a8d8fcc26f693655` preserved
- §15-EXTENSION-FOR-PHASE-E CLOSED at parent-repo `c3b3fbcc107d00022beae87ff238b43e351d282c` preserved (canonical RUNTIME-DESIGN §15 Layer 4 IDs 29/30/31/32)
- E-VERIFY-DESIGN-SPEC CLOSED at parent-repo `a7a1f7aaaa1de961b6338af900dc27c5b1c4a2f6` preserved
- Phase E CLOSED at Relay-repo `21896d65132a1dc9d48f2f5563113c06f62d0893` preserved
- E-VERIFY-CLOSEOUT CLOSED at parent-repo `28b16d0e7b62fcf2e58421e6b6ba1185cc1381ab` preserved
- F-HALT-DESIGN-SPEC CLOSED at parent-repo `02edc238790c016fb5c36bc7b0fbdd563fa030f7` preserved
- Relay-runtime DORMANT preserved
- Autopilot DORMANT (verified at `eff4dd22b9b9af038c7ae45de301e60b3f45af98`) preserved
- CEILING-PAUSE history (broken via `ARC-8-UNPAUSE` at `22ba4a7663e22df64b7cc8e3c0324cbffc0e28f6`; phase-loop counter 0 of 3) preserved
- Approvers exactly `{Victor}` preserved
- `position.json.snap.20260502T020154Z` carve-out preserved untracked

This DOCS-ONLY codification phase does NOT advance the autopilot phase-loop counter, does NOT install or modify the Relay runtime, does NOT post to Discord, does NOT install Antigravity, and does NOT execute any production action.

---

## §17 — Next steps (post-DESIGN-SPEC)

1. Operator approves the persisted DESIGN-SPEC (this file) via operator-manual commit + push of the 4-file scope from the canonical Claude Code session.
2. (Optional, per memory's 3-brains rule) Gemini long-context UX review of the codified design; ChatGPT fallback if Gemini quota fails.
3. (Future, separately gated, operator-manual) Operator installs Google Antigravity if they choose; this design records recommendations but does NOT authorize the install.
4. (Future, separately gated) Operator configures the Antigravity workspace following §10 and §11 recommendations. `ANTIGRAVITY-MIGRATION-A-WORKSPACE-CONFIG` (operator-chosen name) records the as-built workspace configuration once operator establishes it.
5. (Ongoing) For any code drafted in Antigravity that operator intends to bring into either repo, follow §8 review rule (Codex on-disk review in Claude Code session before any canonical placement).
6. (Ongoing) All approvals, commits, pushes, RED-tier actions continue to route through the canonical Claude Code session per §3 and §13.

Each step above requires its own operator decision. This DESIGN-SPEC codification phase authorizes none of them.

---

**End of canonical ANTIGRAVITY-MIGRATION-DESIGN record. Future Antigravity install + workspace configuration remain separately gated and are NOT authorized by this DOCS-ONLY codification phase.**
