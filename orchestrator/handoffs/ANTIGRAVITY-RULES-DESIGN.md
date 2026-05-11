# ANTIGRAVITY-RULES-DESIGN

**Phase identity:** `ANTIGRAVITY-RULES-DESIGN`
**Phase mode (source):** Mode 2 / DESIGN-ONLY (conversation)
**Source-design HEAD anchor:** `19db3723e5a046db33bb5880fb95e6f38f23e08a` (= ANTIGRAVITY-MIGRATION-A-WORKSPACE-CONFIG-CLOSEOUT)
**Codification phase:** `ANTIGRAVITY-RULES-DESIGN-SPEC` (DOCS-ONLY / Mode 3)
**Deferred from:** `ANTIGRAVITY-MIGRATION-A-WORKSPACE-CONFIG-DESIGN-SPEC` DPI-WC-9 (deferred to separate future phase)

This document persists the Codex-PASS `ANTIGRAVITY-RULES-DESIGN` as a SAFE-class handoff record. The design produced the canonical safety-rules file `orchestrator/ANTIGRAVITY-RULES.md` intended to be read by Antigravity-hosted AI agents (and any IDE-side AI agent that loads the workspace). The file grants no new authority and re-states existing rules from the canonical Antigravity migration design + workspace-config design + CLAUDE.md + ARC-* safety-policy docs. All 10 DPI-AR items (DPI-AR-1 through DPI-AR-10) are resolved per operator answers; one Codex round-1 required edit (RE on §2 Git/repo writes block) is applied verbatim; Codex round-2 returned overall PASS. The document is NOT approval to grant Antigravity new capability, NOT approval to add Antigravity-hosted agents to the approvers set, NOT a license to bypass any forbidden-action list.

---

## §0 — Phase classification & DPI resolution summary

| Property | Value |
|---|---|
| Phase name | `ANTIGRAVITY-RULES-DESIGN` |
| Phase mode (source) | Mode 2 / DESIGN-ONLY (conversation-only) |
| Codification phase | `ANTIGRAVITY-RULES-DESIGN-SPEC` (DOCS-ONLY / Mode 3) |
| Source-design HEAD anchor | `19db3723e5a046db33bb5880fb95e6f38f23e08a` |
| Deferred from | `ANTIGRAVITY-MIGRATION-A-WORKSPACE-CONFIG-DESIGN-SPEC` DPI-WC-9 |
| Working tree during codification review | 5 docs-only edits drafted (or 6 if Codex approves CLAUDE.md reference); no commit yet; no push yet; `position.json.snap.20260502T020154Z` remains an untracked carve-out |

**Resolved DPI summary (operator answers):**

| DPI | Operator answer | Design implication |
|---|---|---|
| DPI-AR-1 | File name = `ANTIGRAVITY-RULES.md` | Canonical name confirmed |
| DPI-AR-2 | Location = `/orchestrator/ANTIGRAVITY-RULES.md` (agent-avila) | Alongside ARC-* + CLAUDE.md safety-policy docs |
| DPI-AR-3 | No Relay copy yet | agent-avila canonical only |
| DPI-AR-4 | Reference from CLAUDE.md **conditional** on Codex approval in codification phase | Scope may expand from 5 to 6 files at codification time; explicit Codex gate |
| DPI-AR-5 | Short: 100–150 lines | Tight, imperative, single-page (~120-140 lines actual) |
| DPI-AR-6 | Include transfer-log rule; short template (reference workspace-config §7 for full template) | §5 of file references canonical template |
| DPI-AR-7 | Include "if you see this, do that" self-check | §6 of file: agent decision-point guidance |
| DPI-AR-8 | Include explicit stop conditions | §7 of file: list of mandatory stops |
| DPI-AR-9 | Git history versioning only | No manual `Version:` tag |
| DPI-AR-10 | No parallel Relay file yet | Defer until Phase F+ Relay-side work justifies it |

**Codex review history (source design phase):**
- Round-1 DESIGN-ONLY: PASS WITH REQUIRED EDITS (1 RE issued — §2 Git/repo writes block to enumerate `git add` / `git reset` / `git checkout` / `git restore` on tracked paths + Git index metadata as forbidden write targets).
- Round-2 narrow re-review: overall PASS across all 4 ultra-narrow goals; no new required edits.

---

## §1 — Final file specification

| Property | Value |
|---|---|
| **File name** | `ANTIGRAVITY-RULES.md` |
| **Canonical path** | `/Users/victormercado/claude-tradingview-mcp-trading/orchestrator/ANTIGRAVITY-RULES.md` |
| **Length** | ~120–140 lines (within 100–150 target) |
| **Tone** | Imperative, second-person ("You may..." / "You MUST NOT...") |
| **Audience** | Antigravity-hosted AI agents (primary); humans / Claude / Codex (secondary) |
| **Versioning** | Git history only (no manual `Version:` tag per DPI-AR-9) |
| **Relay-repo placement** | Deferred per DPI-AR-10 |
| **CLAUDE.md reference** | Conditional on Codex approval in this codification phase (per DPI-AR-4) |

---

## §2 — File content sections (canonical structure)

The `orchestrator/ANTIGRAVITY-RULES.md` file contains:

- **§0 (intro)** — Identifies audience as Antigravity-hosted agents; explicit disclaimer "This file grants you NOTHING"
- **§1 What you may do** — Read both repo working trees; draft proposals / code into scratch buffers; read public docs; act as pre-review brain
- **§2 What you MUST NOT do** — 6 categorized sub-blocks: Git/repo writes (incl. `git add` / `git reset` / `git checkout` / `git restore` per Codex round-1 RE); Package/project execution; Infrastructure/services; Secrets/credentials; Dormant systems; Governance
- **§3 Approval rule (FIRM)** — Antigravity is NEVER an approval surface; only Victor approves in canonical Claude Code session; approvers exactly `{Victor}`
- **§4 Draft-return workflow** — Method A copy-paste; Method B `/tmp/` scratch file; Method C branch-based FORBIDDEN per DPI-WC-6
- **§5 Transfer-log rule** — Future handoffs with Antigravity-originated content MUST include `§N — Antigravity transfer log` section; references canonical template at workspace-config DESIGN §7
- **§6 If you see this, do that** — Table of decision-point situations and mandatory agent responses (all STOP / refuse / cite — no permissive escalation per Codex round-1 Goal 10 PASS)
- **§7 Stop conditions** — Six mandatory halt conditions (credential visible; exclude failed; unexpected MCP/extension; about to run forbidden; agent autonomous-run about to commit/push/forbid; repo inconsistency detected)
- **§8 Why these rules (canonical sources)** — Lists CLAUDE.md, parent design at `71af035…`, workspace-config DESIGN-SPEC at `d7bb704…`, workspace-config CLOSEOUT at `19db372…`, ROLE-HIERARCHY.md, APPROVAL-GATES.md, PROTECTED-FILES.md, AUTOMATION-PERMISSIONS.md, PHASE-MODES.md, COMM-HUB-RELAY-RULES.md, AUTOPILOT-RULES.md; explicit "canonical sources win if conflict" disclaimer

---

## §3 — Codification phase scope

**Base scope: 5 files**

1. NEW `orchestrator/ANTIGRAVITY-RULES.md` (the safety-rules file itself; ~120-140 lines)
2. NEW `orchestrator/handoffs/ANTIGRAVITY-RULES-DESIGN.md` (this canonical SAFE-class handoff record)
3. MOD `orchestrator/STATUS.md`
4. MOD `orchestrator/CHECKLIST.md`
5. MOD `orchestrator/NEXT-ACTION.md`

**Conditional 6th file (per DPI-AR-4; Codex-gated in DOCS-ONLY review):**

6. MOD `CLAUDE.md` — adding a one-line reference to the Antigravity rules file. Proposed wording for Codex review:
   ```
   For Antigravity-hosted agents, see `orchestrator/ANTIGRAVITY-RULES.md`.
   ```
   Or operator-preferred equivalent that:
   - Adds no new authority
   - Stays consistent with CLAUDE.md's existing tone and length
   - Does NOT promote Antigravity to an approval surface
   - Properly cross-references rather than duplicating content

Codex DOCS-ONLY review in this codification phase will verdict whether to add the CLAUDE.md edit:
- If Codex PASS on the CLAUDE.md reference goal → codification scope = 6 files (operator approves commit + push of 6 files)
- If Codex FAIL or defer → codification scope = 5 files (CLAUDE.md edit deferred to a separate future operator decision)

---

## §4 — Authority: file grants NOTHING

The file authorizes NOTHING. It is documentation. It re-states existing constraints from the canonical design. It does not:

- Grant Antigravity any new capability
- Grant any agent any new authority
- Change the approver set (stays exactly `{Victor}`)
- Modify ARC-1 through ARC-7
- Modify any canonical handoff record
- Change the workspace configuration (`d7bb704` workspace-config DESIGN-SPEC remains canonical)
- Change the migration design (`71af035` Option B remains canonical)
- Promote Antigravity to an approval surface

The §0 in-file disclaimer ("This file grants you NOTHING. It re-states existing rules so you stay aligned.") is explicit so that any reader (agent or human) cannot misread the file as a permission grant.

---

## §5 — Codex review history

- **Round-1 DESIGN-ONLY:** PASS WITH REQUIRED EDITS (1 RE issued). 12/13 goals PASS; Goal 6 FAIL on §2 Git/repo writes block completeness — staging-command enumeration missing. Required edit (verbatim): replace `- Create branches; write to tracked files` with `- Create branches; stage files (git add / git reset / git checkout / git restore on tracked paths); write to tracked files or Git index metadata`.
- **Round-2 narrow re-review:** overall PASS across all 4 ultra-narrow goals (Goal 1 §2 fix applied; Goal 2 round-1 Goals 1–5 and 7–13 still PASS; Goal 3 scope unchanged + no new issues; Goal 4 literal hygiene preserved). No new required edits.

---

## §6 — Safety boundaries / anti-features

This DOCS-ONLY codification phase MUST:

- NOT install or modify Antigravity (operator-manual install/config remains separate; ANTIGRAVITY-MIGRATION-A-WORKSPACE-CONFIG-CLOSEOUT at `19db372…` records workspace verification COMPLETE)
- NOT modify ARC-1 through ARC-7
- NOT modify any prior canonical handoff record
- NOT add Antigravity-hosted agents to the approvers set (set stays exactly `{Victor}`)
- NOT introduce any new approval surface, scheduler, webhook, MCP server, cron, or background automation
- NOT activate Autopilot Loop B/C/D
- NOT advance the phase-loop counter
- NOT break CEILING-PAUSE
- NOT modify the trading runtime (`bot.js`, `dashboard.js`, `db.js`, `migrations/`, `scripts/`, `position.json`)
- NOT touch Relay or external Hermes Agent
- NOT touch `.env`, secrets, memory, `position.json`, or any forbidden path
- NOT place a parallel file in `agent-avila-relay/` (deferred per DPI-AR-10)

This DOCS-ONLY codification phase produces 5 (or 6 if Codex approves CLAUDE.md edit) parent-repo file changes only. No Relay-repo touch. No Antigravity install or reconfiguration. No commit until operator approval. No push until operator approval.

---

## §7 — Cross-phase chain anchors (preserved)

- ANTIGRAVITY-MIGRATION-A-WORKSPACE-CONFIG-CLOSEOUT CLOSED at parent-repo `19db3723e5a046db33bb5880fb95e6f38f23e08a` preserved (11/11 verification sections PASS)
- ANTIGRAVITY-MIGRATION-A-WORKSPACE-CONFIG-DESIGN-SPEC CLOSED at parent-repo `d7bb70463beed9c9e3abea84ed9b0682cbaf2255` preserved (workspace-config DESIGN; 14 sections §0-§14; DPI-WC-9 deferred this phase)
- ANTIGRAVITY-MIGRATION-DESIGN-SPEC CLOSED at parent-repo `71af035f9a1f7489bfd663e099a15fda7439d0a7` preserved (Option B; 17 sections §0-§17; DPI-A1-A10 resolved)
- F-HALT-DESIGN-SPEC CLOSED at parent-repo `02edc238790c016fb5c36bc7b0fbdd563fa030f7` preserved
- E-VERIFY-CLOSEOUT CLOSED at parent-repo `28b16d0e7b62fcf2e58421e6b6ba1185cc1381ab` preserved
- E-VERIFY-DESIGN-SPEC CLOSED at parent-repo `a7a1f7aaaa1de961b6338af900dc27c5b1c4a2f6` preserved
- Phase E CLOSED at Relay-repo `21896d65132a1dc9d48f2f5563113c06f62d0893` preserved
- §15-EXTENSION-FOR-PHASE-E CLOSED at parent-repo `c3b3fbcc107d00022beae87ff238b43e351d282c` preserved (canonical RUNTIME-DESIGN §15 Layer 4 IDs 29/30/31/32)
- D-STORE-CLOSEOUT CLOSED at parent-repo `0314d2c0df50b67292a1f219a8d8fcc26f693655` preserved
- D-STORE-DESIGN-SPEC CLOSED at parent-repo `1625f13f62df565bb52705e0106769624d061dd0` preserved
- Phase D CLOSED at Relay-repo `0d0210a32d9341d09bb7bed9be93d17c58791fbe` preserved
- C-CONFIG-CLOSEOUT CLOSED at parent-repo `7e0d227d843a58c5f851164485439cb17ae2632b` preserved
- C-CONFIG-DESIGN-SPEC CLOSED at parent-repo `491a24f5c3220be38f7faf51fe27497a4b441ac9` preserved
- Phase C CLOSED at Relay-repo `413a4fbeef65ca0d1fb03454d9993af6360d3ac4` preserved
- Phase B closeout CLOSED at parent-repo `5f2fc810c1b4c77607e8aa8ac40fe61fa32ed269` preserved
- B-DEPS-DESIGN-SPEC CLOSED at parent-repo `2b9144fc2536991a8966526ec28042b2bbe5ac5b` preserved
- Phase B CLOSED at Relay-repo `f87faef99600335a7db47ac1bffa92a499e54acb` preserved
- Phase A closeout CLOSED at parent-repo `1b20628ed280323c6b249c1e5d617ad17ea5a026` preserved
- Phase A CLOSED at Relay-repo `fcfec4882ac9fbb7fab1946bd3b9677ea9a211cf` preserved

---

## §8 — Non-authorization preservation clauses

This DOCS-ONLY codification phase pre-authorizes **nothing** downstream. Specifically does NOT authorize:

- Installing or reinstalling Antigravity (workspace already configured per CLOSEOUT at `19db372…`)
- Configuring any additional Antigravity workspace (current workspace-config persisted)
- Granting Antigravity any credential (firm zero-credential posture per DPI-WC-5)
- Adding Antigravity-hosted agents to the approvers set (set stays exactly `{Victor}`)
- Any Antigravity-side commit / push / deploy / Discord / Railway / DB / Kraken / trading / Relay activation / Autopilot activation / external Hermes Agent integration
- Modification of ARC-1 through ARC-7
- Advancing the phase-loop counter
- Breaking CEILING-PAUSE
- Modifying the trading runtime
- Modifying orchestrator authority
- Posting to Discord
- Stage 5 install resumption (Steps 14–21 remain deferred; Stage 5 Gate-10 install approval at `40f3137e842cd60acf1adf17ecc7fe2f0b1b8935` remains CONSUMED)
- Stage 7 dry-run execution; Stages 8 / 9 / 10a / 10b auto-publish
- DASH-6 / D-5.12f / Migration 009+
- Memory-file edit; test-suite edit
- Modification of any other safety-policy doc / canonical Relay handoff record / runtime / migration / script / deploy file beyond this phase's scope (and beyond CLAUDE.md if Codex approves the conditional 6th-file edit)
- Phase F SAFE IMPLEMENTATION (`COMM-HUB-RELAY-RUNTIME-IMPLEMENT-F-HALT`) or any subsequent Relay-runtime lettered phase
- Placement of a parallel `ANTIGRAVITY-RULES.md` (or pointer) in `agent-avila-relay/` (deferred per DPI-AR-10)

**Codex review verdicts do NOT constitute operator approval.** Per `ROLE-HIERARCHY.md` and `CLAUDE.md`: Codex / Claude / Gemini / ChatGPT / Antigravity-hosted agents cannot self-approve. Only Victor's in-session chat instruction in the canonical Claude Code session grants approval.

**Preservation invariants:**
- Migration 008 APPLIED at `189eb1be6ef6304d914671bdaedec44d389cf877` preserved
- N-3 CLOSED preserved
- Stage 5 Gate-10 install approval at `40f3137e842cd60acf1adf17ecc7fe2f0b1b8935` CONSUMED preserved
- CEILING-PAUSE history (broken via `ARC-8-UNPAUSE` at `22ba4a7663e22df64b7cc8e3c0324cbffc0e28f6`; phase-loop counter 0 of 3) preserved
- Relay-runtime DORMANT preserved
- Autopilot DORMANT (verified at `eff4dd22b9b9af038c7ae45de301e60b3f45af98`) preserved
- Approvers exactly `{Victor}` preserved
- `position.json.snap.20260502T020154Z` carve-out preserved untracked
- Antigravity workspace configured as safe-work cockpit only per Option B; no install change permitted by this codification

This DOCS-ONLY codification phase does NOT advance the autopilot phase-loop counter, does NOT install or modify the Relay runtime, does NOT install or reconfigure Antigravity, does NOT post to Discord, and does NOT execute any production action.

---

## §9 — Next steps (post-DESIGN-SPEC)

1. Operator approves the persisted DESIGN-SPEC (this file + the new `ANTIGRAVITY-RULES.md` + 3 status doc updates, plus conditional CLAUDE.md edit) via operator-manual commit + push of the 5-file or 6-file scope from the canonical Claude Code session.
2. (Optional, per memory's 3-brains rule) Gemini long-context review with ChatGPT fallback (this is a governance design, not UI work — full Gemini review applicable if operator chooses).
3. (Future, separately gated) If Phase F+ Relay-side work justifies it (per DPI-AR-10), open a separate phase to place a parallel `ANTIGRAVITY-RULES.md` (or pointer) in `agent-avila-relay/`.
4. (Ongoing) Antigravity-hosted agents read the file on workspace open; they re-state alignment with the canonical design without any new authority being granted.
5. (Ongoing) Any future edit to `ANTIGRAVITY-RULES.md` itself requires its own DESIGN-ONLY → DESIGN-SPEC → commit + push cascade (the file becomes a SAFE-class document upon landing).

Each step requires its own operator decision. This DOCS-ONLY codification phase authorizes none of them.

---

**End of canonical ANTIGRAVITY-RULES-DESIGN record. Future edits to `orchestrator/ANTIGRAVITY-RULES.md`, Relay-side parallel placement, or any expansion of the rules file remain separately gated and are NOT authorized by this DOCS-ONLY codification phase.**
