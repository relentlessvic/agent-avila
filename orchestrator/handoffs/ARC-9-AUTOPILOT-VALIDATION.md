# ARC-9 Autopilot Validation Record (canonical SAFE-class)

> **DOCS-ONLY ARTIFACT.** This document is the canonical SAFE-class record of the ARC-9-AUTOPILOT-VALIDATION-CYCLE Phase 1 READ-ONLY AUDIT (Mode 1). It is persisted by the ARC-9 Phase 2 ARC-9-AUTOPILOT-VALIDATION-SPEC phase (DOCS-ONLY, Mode 3). It does NOT authorize Autopilot activation, Relay activation, external Hermes Agent (Nous/OpenRouter) setup, schedulers, cron, webhooks, MCP installs, Discord bot activation, background automation, DASH-6-LIVE-BOUNDARY-SMOKE-IMPL, test execution, deploy, Railway, production DB, migration, env changes, `MANUAL_LIVE_ARMED` changes, live trading, or memory-file edits.
>
> **Canonical authority:** `orchestrator/NEXT-ACTION.md` and `orchestrator/NEXT-ACTION-SELECTOR.md` (per `HANDOFF-RULES.md`). If this document ever conflicts with either canonical source, the canonical source wins.
>
> **No packet substitutes for in-session operator approval** (per `orchestrator/APPROVAL-GATES.md`).

**Codification phase:** `ARC-9-AUTOPILOT-VALIDATION-SPEC` (Phase 2 of ARC-9-AUTOPILOT-VALIDATION-CYCLE; DOCS-ONLY Mode 3)
**Source audit phase:** `ARC-9-AUTOPILOT-VALIDATION-AUDIT` (Phase 1; READ-ONLY AUDIT Mode 1; conversation-only; no commit)
**Cycle name:** ARC-9-AUTOPILOT-VALIDATION-CYCLE
**Cycle goal:** Validate the dormant Autopilot framework before any activation, scheduler, webhook, MCP, cron, runtime loop, or autonomous execution is allowed
**Author:** Claude (Lead Engineer / Builder)
**Date:** 2026-05-09
**HEAD baseline at audit time:** `4602745703fd697d5cd6014e6b21654468ac9c46`
**Status:** DRAFT — pending Codex DOCS-ONLY review of this codification commit and explicit operator approval before commit.

## §1 — Phase scope and intent

ARC-9-AUTOPILOT-VALIDATION-CYCLE was opened to confirm that Autopilot remains governance-only, dormant, non-executing, and incapable of bypassing Victor approval, Codex review, phase gates, protected-file rules, or `NEXT-ACTION-SELECTOR.md` rules. This Phase 2 SPEC persists the conversation-only Phase 1 audit as a permanent SAFE-class handoff record so future cycles can cite Autopilot's verified-DORMANT framework state without scanning chat transcripts. Mirrors the `RUN-D-DESIGN-SPEC` and `CYCLE-2-CLOSEOUT-SPEC` patterns (codify a conversation-only audit as durable record).

**Operator decisions confirmed at SPEC time:**
- D1: Audit verdict accepted — PASS.
- D2: Option A selected — pure validation only.
- D3: Phase 2 SPEC opened.
- D4: Future stronger-validation cycle (Option B test harness; Option C manual checklist) deferred and separately gated.

**In scope (this DOCS-ONLY codification phase):**
- Authoring this record at `orchestrator/handoffs/ARC-9-AUTOPILOT-VALIDATION.md`
- Status doc updates at `orchestrator/STATUS.md`, `orchestrator/CHECKLIST.md`, `orchestrator/NEXT-ACTION.md`
- 4-file commit (1 new SAFE-class record + 3 status doc updates)

**Out of scope (this phase does NOT authorize):**
- Autopilot activation
- Relay activation
- External Hermes Agent (Nous/OpenRouter) setup
- Schedulers / cron / webhooks / MCP installs / Discord bot activation / background automation
- DASH-6-LIVE-BOUNDARY-SMOKE-IMPL
- Test execution
- Deploy / Railway / production DB / migration / env changes
- `MANUAL_LIVE_ARMED` changes
- Live trading
- Memory-file edits
- Edits to any safety-policy doc (`AUTOPILOT-RULES.md`, `AUTOMATION-PERMISSIONS.md`, `NEXT-ACTION-SELECTOR.md`, `PHASE-MODES.md`, `APPROVAL-GATES.md`, `PROTECTED-FILES.md`, `ROLE-HIERARCHY.md`, `HANDOFF-RULES.md`) — Autopilot self-modification HARD BLOCK preserved
- Any future stronger-validation work (Option B / Option C remain separately gated)

## §2 — Phase 1 audit findings

### State at audit time

| Check | Result |
|---|---|
| HEAD = `4602745703fd697d5cd6014e6b21654468ac9c46` | ✅ |
| origin/main matches | ✅ |
| ls-remote matches (three-way SHA consistency) | ✅ |
| Working tree clean except `position.json.snap.20260502T020154Z` | ✅ (carve-out preserved untracked) |
| Cycle 2 (CYCLE-2-CLEANUP-AND-LIVE-SAFETY-DESIGN) complete and persisted | ✅ |
| PROJECT-MEMORY-STALE-DOC-CLEANUP-B closed at `4602745703fd697d5cd6014e6b21654468ac9c46` | ✅ |
| No active operational phase before opening ARC-9 | ✅ |
| Relay runtime DORMANT | ✅ |
| Autopilot runtime DORMANT | ✅ |

### Canonical source inventory (read-only inspected at audit time)

- `orchestrator/AUTOPILOT-RULES.md` (273 lines) — supervised-autopilot loop + ARC-8 four-loop architecture
- `orchestrator/AUTOMATION-PERMISSIONS.md` (260 lines) — GREEN/YELLOW/RED tiers; ARC-8 mapping subsection
- `orchestrator/PHASE-MODES.md` (238 lines) — 6 phase modes; automation non-promotion rule (line 220-222)
- `orchestrator/NEXT-ACTION-SELECTOR.md` (120 lines) — 10 strict-order rules; ARC-8 phase-candidate proposal subsection
- `orchestrator/APPROVAL-GATES.md` (192 lines) — 16-gate matrix; "What is NOT operator approval"
- `orchestrator/PROTECTED-FILES.md` (166 lines) — SAFE / RESTRICTED / HARD BLOCK matrix
- `orchestrator/ROLE-HIERARCHY.md` (360 lines) — 5 roles + ARC-8 orchestration binding
- `orchestrator/HANDOFF-RULES.md` (165 lines) — packet rules; forbidden-content list

### Most recent prior framework certification

`orchestrator/handoffs/ARC-8-RUN-D-AUTOPILOT-BUILD-LOOP-RECORD.md` §4 (Phase 11 of post-CEILING-PAUSE 11-phase master order; commit `aaf169e783415a160daf774db761d34aa705867c`; 2026-05-08): all 8 framework integrity checks PASS — self-modification HARD BLOCK preserved; phase-loop counter integrity preserved (0 of 3); CEILING-PAUSE break preserved via ARC-8-UNPAUSE; approvers exactly `{Victor}` preserved; Migration 008 APPLIED preserved; Relay shelved preserved; Autopilot runtime DORMANT preserved; `MANUAL_LIVE_ARMED` unchanged.

ARC-9 Phase 1 carries that certification forward and re-verifies the 16 specific forbidden-action checks below.

## §3 — Current Autopilot authority map

### GREEN tier — autopilot may execute alone (within active phase mode's allowed-files list)

- **Loop A — Sense:** read repo state, `git rev-parse HEAD`, open phases, pending Codex verdicts, pending operator approvals, status docs (read-only; no mutations).
- **Loop B — Decide:** evaluate `NEXT-ACTION-SELECTOR.md` rules 1-10 in strict order; generate up to N=3 candidate phases (proposal-only; cannot self-select).
- **Loop C draft for SAFE-class files** within the active phase mode's allowed list.
- **Auto-trigger Codex review** per criteria (safety-policy doc edits, RESTRICTED/HARD BLOCK file edits, HIGH-RISK / PRODUCTION ACTION phases, `OPERATOR-APPROVAL-PACKET.md` drafts, phase closeout drafts, idle-window timeout, Discord drafts).
- **Apply Codex's required edits verbatim** and re-delegate (Codex round-trip).
- **Draft `OPERATOR-APPROVAL-PACKET.md`** requests for the operator (Loop D draft).
- **Draft Channel 1 / Channel 2 Discord summaries** — drafts only; no auto-publish.

**Rule:** GREEN actions never mutate the trading runtime, never mutate production state, never commit, never push, and never widen automation authority. ARC-8 adds zero new GREEN actions beyond the existing `AUTOMATION-PERMISSIONS.md` Tier 1 list.

### YELLOW tier — requires Codex review before commit

- Loop C drafting for any file outside the SAFE class — RESTRICTED, HARD BLOCK, safety-policy docs, runtime, migration, script, package config, lockfile, `.nvmrc`, `.env*`, `position.json`, deploy config.

### RED tier — requires explicit, in-session, scoped Victor approval per APPROVAL-GATES.md 16-gate matrix

- Loop D execute steps: any commit, push, deploy, runner invocation, env change, `MANUAL_LIVE_ARMED` change, Kraken-touching action.

**Cross-reference:** `AUTOMATION-PERMISSIONS.md` ARC-8 mapping subsection (lines 32-42 area).

## §4 — 16 forbidden-action PASS checks

Each check is grounded in a specific rule citation in the canonical sources.

| # | Action | Verdict | Citation |
|---|---|:---:|---|
| 1 | Approve phases | ✅ PASS — cannot self-approve; cannot mark approval field | `AUTOPILOT-RULES.md:115-117, 155, 219-230`; `APPROVAL-GATES.md` "What is NOT operator approval" |
| 2 | Upgrade phase modes | ✅ PASS — `PHASE-MODES.md:220` "Promoting a phase from a lower-risk mode to a higher-risk mode requires explicit, in-session operator instruction"; autopilot cannot promote | `PHASE-MODES.md:220-222`; `AUTOPILOT-RULES.md:213` |
| 3 | Commit | ✅ PASS — RED tier; "Loop D execute steps... require explicit, in-session, scoped Victor approval" | `AUTOMATION-PERMISSIONS.md:38`; `AUTOPILOT-RULES.md:100` |
| 4 | Push | ✅ PASS — RED tier; "never push without separate approval" | `AUTOPILOT-RULES.md:80, 100` |
| 5 | Deploy | ✅ PASS — RED tier; "never deploy without separate approval" | `AUTOPILOT-RULES.md:80, 101` |
| 6 | Run Railway | ✅ PASS — RED tier | `AUTOPILOT-RULES.md:103`; `AUTOMATION-PERMISSIONS.md:38` |
| 7 | Query or mutate production DB | ✅ PASS — RED tier | `AUTOPILOT-RULES.md:102` |
| 8 | Run migrations | ✅ PASS — RED tier | `AUTOPILOT-RULES.md:104` |
| 9 | Touch env files | ✅ PASS — RED tier | `AUTOPILOT-RULES.md:105, 109` |
| 10 | Touch `MANUAL_LIVE_ARMED` | ✅ PASS — RED tier | `AUTOPILOT-RULES.md:106`; `APPROVAL-GATES.md` Gate 14 |
| 11 | Place or manage trades | ✅ PASS — explicit forbidden | `AUTOPILOT-RULES.md:107, 118` |
| 12 | Edit protected/restricted/hard-blocked files without approval | ✅ PASS — RED tier | `AUTOPILOT-RULES.md:105`; `PROTECTED-FILES.md` matrix |
| 13 | Activate Relay | ✅ PASS — Stage 5 Gate-10 RED-tier; canonical Relay spec | `COMM-HUB-RELAY-RULES.md` §"Approval discipline"; `APPROVAL-GATES.md` Gate 10 |
| 14 | Activate itself | ✅ PASS — self-modification HARD BLOCK; autopilot cannot edit `AUTOPILOT-RULES.md` | `AUTOPILOT-RULES.md:124, 219-230`; `PROTECTED-FILES.md` |
| 15 | Call external Hermes Agent setup | ✅ PASS — reserved-term distinction; no operational contract; would be Gate-10 install | `CYCLE-2-CLOSEOUT.md` §10 deferred items; canonical Relay spec naming-convention subsection |
| 16 | Execute DASH-6-LIVE-BOUNDARY-SMOKE-IMPL | ✅ PASS — Mode 5 by structural rule; HIGH-RISK Codex IMPL review + Gate 7 + first-run authorization required | `DASH-6-LIVE-BOUNDARY-SMOKE-DESIGN.md` §7 |

**Audit verdict: 16/16 PASS.** Autopilot framework remains governance-only and incapable of bypassing Victor approval, Codex review, phase gates, protected-file rules, or `NEXT-ACTION-SELECTOR.md` rules.

## §5 — Stale or conflicting Autopilot wording — sweep results

Comprehensive sweep across orchestrator/ docs returned:

| Pattern | Hits | Status |
|---|---|---|
| "Autopilot active" | 0 | clean |
| "autopilot runtime activation authorized" | 0 | clean |
| "autopilot may self-execute" / "autopilot can self-execute" | 0 | clean |

**No stale or conflicting Autopilot wording detected.** The canonical `AUTOPILOT-RULES.md` is internally consistent and consistent with all 7 cross-referenced safety-policy docs.

### Pre-existing references intentionally preserved (not stale)

- `AUTOPILOT-RULES.md:273` Change history entry references "Ruflo/Hermes/future-automation routing" — this is the historical change-history entry from ARC-8 (2026-05-04) describing what ARC-8 added at that time. Operator's prior `PROJECT-MEMORY-STALE-DOC-CLEANUP-A` decision preserved this as historical content. Not stale.
- `AUTOMATION-PERMISSIONS.md:260` Change history similarly preserves historical "Hermes" enumeration. Same status. Not stale.
- 4 handoff records (DASH-1, DASH-3, DASH-4, DASH-5 design records) reference "autopilot DORMANT" verbatim per pre-Cycle-2 wording. They were not updated to "Autopilot DORMANT" capitalization. **Cosmetic, not behavioral. Non-blocking. Not part of this phase.**

## §6 — Option A / Option B / Option C decision

The Phase 1 audit surfaced three structural options for ARC-9 sub-phase scope:

- **Option A — Pure validation only.** Conversation-only audit + persist as SAFE-class handoff record. 2-phase chain (audit + SPEC). Mirrors RUN-D / CYCLE-2-CLOSEOUT pattern. Minimum scope; no new validation procedure introduced.
- **Option B — Validation + design-spec for a future test harness.** Same as A, plus a new design-only sub-phase that specifies a future ARC-9 test harness that would mechanically verify autopilot's 16 forbidden actions cannot be executed. Test harness IMPL would be a separate gated phase.
- **Option C — Validation + future test checklist (no harness design).** Same as A, plus a checklist-only artifact listing the 16 forbidden actions with manual-verification procedure for each.

**Operator selected Option A — pure validation only.**

### Why Options B and C were deferred

- The Phase 1 audit found all 16 forbidden actions PASS based on documented rules.
- Option B (test harness) would itself need a full design-spec-impl cycle.
- Option C (manual checklist) is potentially redundant with `AUTOPILOT-RULES.md` and `AUTOMATION-PERMISSIONS.md` content.
- A future stronger-validation cycle remains separately gated; if operator later chooses B or C, it will be a new operator-directed cycle.

## §7 — File-system delta

### This Phase 2 SPEC commit (this codification phase)

- `orchestrator/handoffs/ARC-9-AUTOPILOT-VALIDATION.md` (NEW SAFE-class record — this file)
- `orchestrator/STATUS.md`
- `orchestrator/CHECKLIST.md`
- `orchestrator/NEXT-ACTION.md`

**Total: 4-file commit (1 new SAFE-class record + 3 status doc updates).** Mirrors RUN-D-DESIGN-SPEC / CYCLE-2-CLOSEOUT-SPEC pattern.

### Future ARC-9 work (each separately gated; not authorized by this SPEC)

- ARC-9-AUTOPILOT-VALIDATION-CYCLE-CLOSEOUT-SYNC (optional; not strictly needed since Phase 2 closes the cycle administratively)
- Option B — ARC-9 test-harness design-spec (deferred)
- Option C — ARC-9 manual-checklist artifact (deferred)
- Any future autopilot activation cycle (separately gated; would itself be a new top-level cycle requiring its own design + Codex review + per-action operator approval)

## §8 — Phase chain forward (each separately gated)

| Phase | Status | Mode |
|---|---|---|
| ARC-9 Phase 1 — ARC-9-AUTOPILOT-VALIDATION-AUDIT | CLOSED conversation-only — PASS (16/16) | READ-ONLY AUDIT (Mode 1) |
| **ARC-9 Phase 2 — ARC-9-AUTOPILOT-VALIDATION-SPEC** | **IN PROGRESS — this codification phase** | DOCS-ONLY (Mode 3) |
| ARC-9 future stronger-validation cycle (Option B / Option C) | Separately gated — not authorized | TBD |
| Future autopilot activation cycle | Separately gated — not authorized | TBD; would be a new top-level cycle |

**ARC-9 substantive completion:** after this Phase 2 commit lands and is pushed, ARC-9 is substantively complete and persisted. Autopilot remains DORMANT.

## §9 — Out of scope (explicit non-authorizations)

This SPEC does **NOT** authorize:

- **Autopilot activation** (runtime activation; cron/scheduler/webhook/MCP/background automation install)
- **Relay activation** (Discord bot run; runtime image authoring; Stage 5 Steps 14-21 install resumption; runtime deployment)
- **External Hermes Agent setup** (Nous/OpenRouter integration; reserved-term distinction only)
- **Schedulers / cron / webhooks / MCP installs / Discord bot activation / background automation**
- **DASH-6-LIVE-BOUNDARY-SMOKE-IMPL** (Mode 5 by structural rule; separately gated)
- **Test execution** (any spec or runner)
- **Deploy / Railway / production DB / migration / env changes**
- **`MANUAL_LIVE_ARMED` changes**
- **Live trading**
- **Memory-file edits** (separate operator-side action)
- **Edits to any safety-policy doc** (`AUTOPILOT-RULES.md`, `AUTOMATION-PERMISSIONS.md`, `NEXT-ACTION-SELECTOR.md`, `PHASE-MODES.md`, `APPROVAL-GATES.md`, `PROTECTED-FILES.md`, `ROLE-HIERARCHY.md`, `HANDOFF-RULES.md`)
- **Future stronger-validation work** (Option B test harness; Option C manual checklist) — both deferred and separately gated

## §10 — Preservation invariants

Migration 008 applied; N-3 closed; Relay dormant; Autopilot dormant; approvers exactly {Victor}; no live trading authorized.

Plus carry-forward of all framework integrity checks from `ARC-8-RUN-D-AUTOPILOT-BUILD-LOOP-RECORD.md` §4: self-modification HARD BLOCK preserved; phase-loop counter integrity preserved (0 of 3); CEILING-PAUSE remains broken via ARC-8-UNPAUSE at `22ba4a7663e22df64b7cc8e3c0324cbffc0e28f6`; Stage 5 Gate-10 install approval at `40f3137e842cd60acf1adf17ecc7fe2f0b1b8935` CONSUMED preserved.

## §11 — References (SHA ledger)

- ARC-9 Phase 1 — conversation-only READ-ONLY AUDIT; no commit
- ARC-9 Phase 2 — this codification phase; SHA assigned at commit time
- PROJECT-MEMORY-STALE-DOC-CLEANUP-B — `4602745703fd697d5cd6014e6b21654468ac9c46` (HEAD baseline at audit time)
- CYCLE-2-CLOSEOUT-SPEC — `fe474d2d6b6d97a89b454d1dea1f9fd02ca20814`
- DASH-6-LIVE-BOUNDARY-SMOKE-DESIGN-SPEC — `5e6f65cd80d71e1f8eca05a4df1e1da098d3a42b`
- COMM-HUB-RENAME-RELAY-FILES — `82310b52452cd799eb26ea43e64f936bd3baa974`
- COMM-HUB-RENAME-RELAY-FILES-CLOSEOUT-SYNC — `c9c44e8fb09b572073d84770a72e2b564c586262`
- COMM-HUB-RENAME-RELAY-CONTENT Phase A — `5541fb6f92d84028ac762b1c54ff32808868d2a9`
- RUN-D-DESIGN-SPEC — `aaf169e783415a160daf774db761d34aa705867c` (most recent prior framework certification at §4)
- ARC-8-UNPAUSE — `22ba4a7663e22df64b7cc8e3c0324cbffc0e28f6` (CEILING-PAUSE break)
- Migration 008 APPLIED — `189eb1be6ef6304d914671bdaedec44d389cf877`
- Stage 5 Gate-10 install approval CONSUMED — `40f3137e842cd60acf1adf17ecc7fe2f0b1b8935`

## §12 — Change history

- ARC-9-AUTOPILOT-VALIDATION-SPEC (2026-05-09): Initial SAFE-class record drafted as the codification of the conversation-only ARC-9 Phase 1 ARC-9-AUTOPILOT-VALIDATION-AUDIT (READ-ONLY AUDIT Mode 1; 16/16 PASS) at HEAD `4602745703fd697d5cd6014e6b21654468ac9c46`. Operator selected Option A (pure validation only); Options B and C deferred and separately gated. Autopilot framework remains DORMANT and certified READY for any future supervised cycle the operator chooses to authorize.
