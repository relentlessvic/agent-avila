# PROJECT-PROGRESS-DASHBOARD-AI-GOV-OS-DESIGN

**This design phase is DESIGN-ONLY (Mode 2). The future implementation phase(s) are SAFE IMPLEMENTATION (Mode 4) for the parts that stay within the existing sealed boundaries, and HIGH-RISK IMPLEMENTATION (Mode 5) for any part that introduces a new data feed, network surface, or interactive authority surface. Each requires its own explicit Victor approval before any file edit.**

**Codification phase:** `PROJECT-PROGRESS-DASHBOARD-AI-GOV-OS-DESIGN-SPEC` (DOCS-ONLY / Mode 3) persists the accepted conversation-only `PROJECT-PROGRESS-DASHBOARD-AI-GOV-OS-UPGRADE` (DESIGN-ONLY / Mode 2) so future implementation phases can consume it.

**Target future phases:**
- `PROJECT-PROGRESS-DASHBOARD-AI-GOV-OS-PHASE-ALPHA` (SAFE IMPLEMENTATION / Mode 4) — P1 items: PipelineRibbon, RiskMeters, ApprovalReadiness, CodexBadge, Hero secondary radial.
- `PROJECT-PROGRESS-DASHBOARD-AI-GOV-OS-PHASE-BETA` (SAFE IMPLEMENTATION / Mode 4) — P2 + P3 items: RolesPanel, RolePill, ActivityTimeline, heartbeat strip, sealed-stage shimmer, MissionMap, progress-bar fills.

Each future phase is separately gated and not opened by this codification.

**Authority chain:** The design recorded here was produced as a DESIGN-ONLY conversation, reviewed by Codex (DESIGN-ONLY full-narrative review, embedded-design dispatch), corrected per 3 Codex required edits, narrow-re-reviewed PASS across all 7 items, and accepted by Victor as a conversation-only working design. This file does NOT itself constitute an execution authorization. Codex review verdicts are not operator approval.

---

## Codification provenance

- **DESIGN-ONLY phase:** `PROJECT-PROGRESS-DASHBOARD-AI-GOV-OS-UPGRADE` (no on-disk artifact; conversation-only).
- **Driver:** operator request for a high-level "AI Governance OS" upgrade — evolve the dashboard from a static project-status page into a living governance operating surface with premium UI, visual progress, animation, and explainable safety visualization. Operator emphasized 5 focus areas (Live AI Progress Layer / Animated Phase Workflow / Safety + Risk Visualization / Mission Control UI Upgrade / Future Advanced Features) and explicit safety rules (no trading logic touch, no Victor authority transfer, no automation gains approval power).
- **Codex round-1 (full 24-point design review):** OVERALL PASS WITH REQUIRED EDITS — 21 PASS, 3 PASS WITH REQUIRED EDITS (items 19, 20, 24), 0 FAIL. Forbidden-literal scan: zero matches. Approval-language scan: zero issues.
- **3 Required Edits applied** to the conversation-only design:
  - **RE-1** — §7 header changed to `§7 — Risks and boundaries (15 items)` to reflect the body enumeration count.
  - **RE-2** — Added verbatim clause to §7: "`web/.gitignore` continues to cover `dist/` and `.astro/`; build outputs must not appear in `git status` during future implementation verification."
  - **RE-3** — Added verbatim clause to §8 (Codex review checklist for the future implementation phase(s)): "Future implementation Codex review must verify `npm run build` completes and emits only to `web/dist/`."
- **Codex narrow re-review (RE-1 + RE-2 + RE-3 + scope + forbidden-literal scan + substantive content preservation + overall):** 7 of 7 items PASS, OVERALL PASS.
- **Operator decision:** corrected design accepted as a conversation-only working design. Acceptance does not authorize implementation, codification, commit, or push. Codification to disk is this current separate DOCS-ONLY (Mode 3) phase with its own explicit Victor approval.
- **Working tree state at codification (pre-existing WEB-UX-UPGRADE patch preserved untouched by this codification):** 20 tracked `web/` modifications (the round-1 + round-2 UX-upgrade source-edit set), 7 new untracked `web/src/components/` files (RadialRing, SafetyDial, StatusChip, CollapsibleList, MissionStatus, DecisionsNeeded, SystemBoundaries), and `?? position.json.snap.20260502T020154Z` carve-out preserved untracked. The local preview server background task `bsohdq8a8` running on `http://127.0.0.1:4321/` is operator-approved, and this codification phase does not interact with it.

---

## §0 — Reframing "AI Governance OS" inside this codebase

What "AI Governance OS" can mean here without violating the system's invariants:

- The dashboard is and remains a **build-time snapshot** of orchestrator state, parsed from `orchestrator/DASHBOARD.md` by a sealed pure parser. There is no runtime data feed. There is no live introspection of running agents. There is no message bus.
- "Live" = the snapshot's recency, not a real-time stream. The page can *feel* alive (gentle motion, pulse indicators, animated transitions) while remaining a static, byte-stable render of frozen data.
- "AI thought/activity stream" = a presentation rendering of *historical* cascade activity already captured in `STATUS.md` / `CHECKLIST.md` / sealed handoffs. Not a runtime AI tap.
- "Approval readiness", "Codex safety status", and "blocked decisions" = derivable from the existing `safetyGates` + `backlog` + `pausedPhases` + sealed-handoff cross-references. No new data-layer fields required to begin.
- "Operator command center" / "interactive controls" = OUT OF SCOPE in this design. The dashboard is informational; granting it any operational authority would violate the rule that approvers stay exactly `{Victor}` and that nothing on the page can flip the armed-trading flag, deploy, or migrate.

Calling this an "OS" is the right tone if it means "the visual surface for understanding governance state at a glance." It is the wrong tone if it implies it *runs* anything.

---

## §1 — UI sections to add (mapped to the 5 focus areas)

**A. Live AI Progress Layer**
- **Roles panel** (new): five role cards — Claude (orchestrator), Codex (reviewer), Gemini/ChatGPT fallback (reviewer), Relay (messenger), Victor (final authority). Each card shows: avatar/glyph, role name, current snapshot-time state (idle / reviewing / blocked / approved / warning / done), and a "what they did last" caption derived from `data.completedPhases[0..2]` and `data.activePhase`.
- **Activity timeline** (new): a vertical timeline of the most recent ~10 cascade events, parsed presentation-side from `data.completedPhases` and `data.activePhase`. Each event has a role glyph, a friendly-name title, a short status badge, and a SHA chip.
- Role-state derivation rules (presentation-only):
  - Claude = `in-progress` if `data.activePhase` exists; `idle` otherwise.
  - Codex = `reviewing` if active phase narrative contains "Codex round-N" without "PASS"; `done` if "round-1 overall PASS".
  - Victor = always `final authority` (never auto-derived state).
  - Relay = `dormant`.
  - Gemini/ChatGPT = `idle` (no usage signal in parsed data; show as standby).

**B. Animated Phase Workflow**
- **Pipeline ribbon** (new): a horizontal 6-stage strip — Design → Review → Approval → Implementation → Verification → Closeout. The current phase's stage glows; completed stages render as sealed/locked; blocked stages render with warm-amber and a "Why?" tooltip.
- Stage detection (presentation-only via regex on `data.activePhase.name`):
  - `-DESIGN` (without `-SPEC`) → Design stage
  - `-DESIGN-SPEC` → Codification (Review→Approval bridge)
  - `-IN-PROGRESS` source-edit phases → Implementation
  - `-CLOSEOUT` → Verification
  - `-CLOSEOUT-SYNC` / `-CLOSEOUT-SYNC-CLOSEOUT` → Closeout (sealing)
- Per-stage tooltip surfaces the "Why?" from `data.pausedPhases[i].note` or `data.backlog[i].description` when applicable.

**C. Safety + Risk Visualization**
- **Risk meters** (new): five static meters — Trading, Deploy, Database, Network, Automation. Each is a CSS bar with three tiers (green-emerald / warm-amber / rose-pink). Tier is derived from existing `safetyGates`:
  - Trading: bar at 0% (off) because Live-trading is NOT AUTHORIZED and the armed-trading flag is operator-only.
  - Deploy: bar at 0% because deploy gate is shut.
  - Database: bar at 10% (Migration 008 applied, N-3 closed, nothing further authorized).
  - Network: bar at 0% (no live network anywhere on the page).
  - Automation: bar at 0% (Autopilot dormant, no cron/webhook/MCP installed).
- **Approval readiness widget** (new): summarizes "pending Victor approvals" by counting pending checklist items derivable from active-phase narrative (or set to "0 pending" when nothing requires the operator's attention right now).
- **Codex safety status badge** (new): for the active phase, shows the most recent Codex verdict (PASS / PASS-WITH-REQUIRED-EDITS / FAIL) parsed presentation-side from narrative cues like "Codex round-1 PASS across 24 goals". If no Codex verdict is visible in the active phase narrative, badge reads "no verdict yet".
- **Blocked-decisions indicator** (existing, deepened): the existing `DecisionsNeeded` card adds a "you're the only one who can unblock these" caption.

**D. Mission Control UI Upgrade**
- **Hero re-balance**: Hero radial-ring becomes the *progress* indicator (count vs. round target); a second small radial appears for "today's safety: PASS" / "today's deploy: SHUT".
- **System heartbeat strip** (new): a single, slow, very subtle horizontal pulse line across the top of `<main>` — visual reassurance the page rendered fresh. Pure CSS, gated by `prefers-reduced-motion`.
- **Progress bars on Finished Work groups** (existing, deepened): each `<details>` group summary in `CompletedPhases` shows a thin filled bar reflecting "this group is N% of all closures" — static, derived count-only.
- **Sticky zone navigator** (new, optional): a small left-edge or top-edge mini-map of the 6 zones (Mission Status / Current / Locks / Waiting / Roadmap / History) for jump scrolling — anchor links only, no JS state.

**E. Future advanced features (kept visible as design seeds; see deferral list in §6)**
- Mission replay mode → would need timeline scrubbing UI and per-snapshot history; requires either bundled historical snapshots or a runtime feed.
- Knowledge graph → would need a graph rendering library (new dependency) or a hand-built SVG visualization; potentially in scope without a new dependency, but moderately heavy.
- Predictive next-phase recommendations → would need heuristic logic (rule-based, OK) or ML (out of scope).
- Infrastructure health map → requires a runtime infrastructure feed; OUT.
- Operator command center → requires interactive authority; OUT.
- Live AI activity stream → requires runtime AI tap; OUT.

---

## §2 — Animation ideas (all CSS-only, all gated by `prefers-reduced-motion: no-preference`)

1. Role-card breathing: 4-second subtle scale 1.00→1.01→1.00 + opacity 1.0→0.95 loop on idle cards. Reviewing/in-progress cards get a thin cyan border swell.
2. Pipeline stage transitions: completed-stage gradient sweep (left-to-right shimmer, 6-second loop) for the most-recently-sealed stage only. Current stage gets the existing `glow-swell`.
3. Activity timeline reveal: each timeline item fades in with a 100ms stagger on first paint; no further animation after that.
4. Risk meter fill animation: each bar animates from 0 to its tier on first paint (700ms ease-out). Bars at 0% just render as empty tracks.
5. Heartbeat strip: a 1px horizontal line near the top of main; a small cyan blip travels left-to-right once every 6 seconds. Loops indefinitely. Easy to disable.
6. Sealed-stage shimmer: completed pipeline stages get a slow 12-second highlight sweep simulating "locked".
7. Status-chip pulse (existing): retained for IN-PROGRESS chips.
8. Disclosure chevron rotation (existing): retained.
9. All animations stop entirely under `prefers-reduced-motion: reduce`.

No JavaScript animation. No CSS containment quirks that block accessibility. No autoplay video.

---

## §3 — Component structure (proposed)

**New components (estimated 7–9):**
- `web/src/components/RolePill.astro` — single role card (Claude / Codex / Gemini / Relay / Victor)
- `web/src/components/sections/RolesPanel.astro` — 5-role grid panel
- `web/src/components/sections/ActivityTimeline.astro` — vertical recent-events timeline
- `web/src/components/sections/PipelineRibbon.astro` — 6-stage Design→Review→Approval→Implementation→Verification→Closeout strip
- `web/src/components/RiskMeter.astro` — single bar primitive
- `web/src/components/sections/RiskMeters.astro` — grid of 5 risk meters
- `web/src/components/ApprovalReadiness.astro` — small widget for pending-approval count
- `web/src/components/CodexBadge.astro` — Codex verdict chip primitive
- `web/src/components/sections/MissionMap.astro` (optional) — sticky zone navigator

**Modified components (estimated 4–6):**
- `web/src/components/sections/Hero.astro` — add the secondary safety radial alongside the existing finished-things ring
- `web/src/components/sections/SafetyGates.astro` — embed risk meters or replace with a hybrid dial+meter view
- `web/src/components/sections/MissionStatus.astro` — slightly deepen with secondary captions
- `web/src/layouts/BaseLayout.astro` — add the heartbeat strip element
- `web/src/styles/theme.css` — `role-pill`, `pipeline-ribbon`, `risk-meter`, `heartbeat-strip`, `timeline-rail` primitives
- `web/src/styles/animations.css` — `breathing`, `gradient-sweep`, `meter-fill`, `heartbeat` keyframes
- `web/src/pages/index.astro` — insert the new sections into the existing 6 operator zones

**Friendly-name + Codex-verdict + role-state helpers** = inline regex helpers inside the consuming components (same pattern already used for `friendlyFor`, `friendlyAnchorLabel`, `friendlyName`). No new utility files outside `web/src/components/`.

**No new dependencies. No data-layer change. No external CDN font. No external image. No JavaScript runtime.**

---

## §4 — Priority ranking

**P1 — operator-visible safety and clarity wins, fully presentation-only, no risk to invariants:**
1. PipelineRibbon (6-stage Design→Review→Approval→Implementation→Verification→Closeout)
2. RiskMeters (5 static meters derived from existing safetyGates)
3. ApprovalReadiness + CodexBadge (in active-phase area)
4. Hero secondary safety radial

**P2 — narrative depth, presentation-only:** 5. RolesPanel + RolePill. 6. ActivityTimeline. 7. Heartbeat strip + sealed-stage shimmer.

**P3 — optional polish:** 8. MissionMap. 9. Progress-bar fills on Finished-Work group summaries.

**Defer to future, separately-scoped phases (see §6):** 10. Mission replay mode. 11. Knowledge graph. 12. Predictive next-phase recommendations. 13. Infrastructure health map. 14. Operator command center. 15. Live AI activity stream.

---

## §5 — What can be done safely first

All of P1, P2, and P3 above can be implemented in **two operator-approved SAFE IMPLEMENTATION (Mode 4) phases** (split for review clarity, not safety) on top of the existing UX-upgrade:

**Phase α — Safety & Clarity (P1):** PipelineRibbon, RiskMeters, ApprovalReadiness, CodexBadge, Hero secondary radial. ~8–10 file patch. No data-layer change. No dependencies. No animation that runs without `prefers-reduced-motion: no-preference`. Codex SAFE review needed before commit.

**Phase β — Narrative Depth (P2 + P3):** RolesPanel, RolePill, ActivityTimeline, heartbeat strip, sealed-stage shimmer, MissionMap, progress-bar fills. ~7–9 file patch. Same invariants. Codex SAFE review needed before commit.

Both phases are presentation-only. Both respect:
- Sealed parser (`web/src/lib/*`) untouched.
- `tools/dashboard-generate.js` sealed at `f5cc97a…` untouched.
- `orchestrator/DASHBOARD.md` untouched (regenerated only at REFRESH phases via the sealed generator).
- Sealed handoffs untouched.
- Root and `web/` package files byte-stable.
- Verbatim trading-isolation disclaimer in BaseLayout slot preserved.
- Audit advisory carried forward as SCAFFOLD-phase documented known advisory, not freshly re-verified.
- Approvers exactly `{Victor}`.
- No bare forbidden literals on any visible surface.
- All animation behind `prefers-reduced-motion: no-preference`.

---

## §6 — What should be deferred

1. **Mission replay mode** — requires either bundled historical snapshots (new build-time data assembly) or runtime feed (network surface). Defer for its own DESIGN phase that decides between the two.
2. **Knowledge graph** — would need either a graph library (new dependency, lockfile change, package-file edit, audit re-check) or a substantial hand-built SVG renderer. Defer.
3. **Predictive next-phase recommendations** — rule-based heuristics are doable without ML, but the rules themselves are governance-sensitive. Defer; design needs explicit operator review of the heuristic table.
4. **Infrastructure health map** — requires a runtime infrastructure feed. Defer indefinitely; HIGH-RISK / Mode 5 scope.
5. **Operator command center / interactive controls** — would grant the dashboard authority to *act*. Violates "approvers exactly `{Victor}`" and "nothing on this page can trade, deploy, or override Victor." **Permanently out of scope for the dashboard itself.** If ever needed, it must be a separate, isolated operator-tool with its own approval cascade.
6. **Live AI activity stream** — requires runtime AI introspection (network/IPC). HIGH-RISK / Mode 5 scope. Defer indefinitely; if ever desired, a much narrower DOCS-ONLY first-pass might surface the same insights from on-disk session transcripts at build time.

---

## §7 — Risks and boundaries (15 items)

1. **The dashboard explains the system; it does not extend the system's authority.** No interactive control on the page may approve, deploy, trade, migrate, install, send, post, or flip any flag — most importantly the armed-trading flag, which stays operator-only.
2. **No new data ingestion path.** The sealed parser remains the only source of data. No `fetch()`, no `XMLHttpRequest`, no `WebSocket`, no `import.meta.glob` of forbidden directories, no subprocess-spawn APIs, no dynamic `eval`/`Function`, no new file-system reads outside the sealed allowlist in `load-dashboard.ts`.
3. **No new dependencies.** Lockfile sealed at SCAFFOLD `cc6819d…`. Any new dependency requires its own DESIGN phase, Codex review, lockfile audit-advisory re-check, and operator approval.
4. **No external CDN.** Fonts, scripts, images all bundled locally or system-stack fallback only.
5. **No automation gains approval authority.** Codex verdicts surfaced visually are still advisory only — the page must make it visually obvious that Codex PASS is not the same as Victor approval.
6. **Verbatim trading-isolation disclaimer preserved** at the bottom of the page and (where adopted) near the hero: *"This web project is entirely separate from the trading runtime `dashboard.js`. It does not modify, replace, or supplement live trading functionality."*
7. **Audit advisory carried forward** as a SCAFFOLD-phase documented known advisory, not freshly re-verified from the static working tree. Astro `define:vars` XSS (`<6.1.6`); vulnerable feature unused. Any re-audit that reveals changed advisory state halts the future implementation phase and notifies the operator.
8. **Parent-repo / Relay-repo evidence boundary** preserved (parent-repo git state cannot, by itself, prove a sibling Relay repo was untouched).
9. **Sealed-invariant block preserved**: Migration 008 APPLIED at `189eb1be…`, Stage 5 Gate-10 install approval at `40f3137e…` CONSUMED, Antigravity chain SHAs (`71af035…` / `d7bb704…` / `19db372…` / `9d47f74…` / `6c41c2c…`), CEILING-PAUSE broken via ARC-8-UNPAUSE at `22ba4a7…` with counter 0 of 3, Relay-runtime DORMANT, Autopilot DORMANT verified at `eff4dd2…`, approvers exactly `{Victor}`.
10. **Codifying this design to disk** is a separate phase requiring its own explicit Victor approval. Claude has no authority to write this design to disk in this DESIGN-ONLY phase. (The current `…-AI-GOV-OS-DESIGN-SPEC` DOCS-ONLY phase is the separate codification phase anticipated by this clause; it has its own explicit Victor approval before any edit ran here.)
11. **The explicit `--host 127.0.0.1` preview-server override** remains operator-only and is not adopted as a project default.
12. **Phase A–F Relay-repo lettered chain references and Stage 5 Gate-10 reference** remain preserved / CONSUMED — not actionable or re-openable by anything in this design.
13. **CEILING-PAUSE phase-loop counter does not advance** as a result of any change here.
14. **Accessibility floor**: WCAG AA contrast; skip-link present; `<section aria-labelledby>` + `<h2 id>` pattern preserved; all decorative SVG `aria-hidden="true"`; visual primitives carry `sr-only` text; tap targets ≥ 44px on interactive elements; native `<details>` for disclosures (no JS state); animation gated by `prefers-reduced-motion`.
15. **Mobile parity**: every new section must collapse cleanly on small screens. No fixed-pixel widths on cards. Grid → single-column under 640px.

**`web/.gitignore` continues to cover `dist/` and `.astro/`; build outputs must not appear in `git status` during future implementation verification.**

---

## §8 — Codex review checklist for the future implementation phase(s)

The Codex SAFE IMPLEMENTATION review for Phase α (and analogously β) must verify all 24 items already enumerated in §10 of `PROJECT-PROGRESS-DASHBOARD-UX-UPGRADE-DESIGN.md` (sealed at `570cf9c…`), plus:

- Pipeline-stage classifier is presentation-only (no Date.now/random/network).
- Risk-meter tier derivation comes from existing `safetyGates` and `dormantVsActive`, not invented runtime state.
- Codex verdict badge labeling is parsed from narrative substrings; falls back to "no verdict yet" when ambiguous (no fabrication).
- ApprovalReadiness counter never increments for any reason other than items already in pending state in the parsed data.
- Heartbeat strip is purely decorative; carries `aria-hidden="true"`.
- No new dependency, no font CDN, no JS runtime, no animation that runs under `prefers-reduced-motion: reduce`.
- **Future implementation Codex review must verify `npm run build` completes and emits only to `web/dist/`.**

---

## Closing — codification and execution gating

This handoff is the on-disk codification of an accepted conversation-only DESIGN-ONLY result. It does not authorize execution of any AI-GOV-OS Phase α or Phase β item. It does not open `PROJECT-PROGRESS-DASHBOARD-AI-GOV-OS-PHASE-ALPHA` or `…-PHASE-BETA`. It does not modify `orchestrator/DASHBOARD.md`, the sealed generator, any `web/` file, any root package file, any Relay-repo file, or any runtime / trading file. It does not advance the autopilot phase-loop counter. It does not install or reconfigure Antigravity. It does not touch Railway, the Discord platform, the DB, env / secrets, the armed-trading flag, trading runtime, DASH-6, D-5.12f, Migration 009+, Autopilot Loop B/C/D, CEILING-PAUSE, the external Hermes Agent (Nous/OpenRouter), scheduler / cron / webhook / MCP install, or permission widening.

The pre-existing uncommitted WEB-UX-UPGRADE source-edit patch (20 tracked `web/` modifications + 7 new untracked `web/src/components/` files) remains in the working tree as the operator's prior in-progress work. This codification phase does not touch any of those files. The local preview server background task `bsohdq8a8` running on `http://127.0.0.1:4321/` is operator-approved, and this codification phase does not interact with it.

The future execution phases `PROJECT-PROGRESS-DASHBOARD-AI-GOV-OS-PHASE-ALPHA` and `…-PHASE-BETA` are separately gated, each requires its own explicit Victor approval, and each requires its own separate Codex SAFE IMPLEMENTATION review before commit.

**This web project is entirely separate from the trading runtime `dashboard.js`. It does not modify, replace, or supplement live trading functionality.**
