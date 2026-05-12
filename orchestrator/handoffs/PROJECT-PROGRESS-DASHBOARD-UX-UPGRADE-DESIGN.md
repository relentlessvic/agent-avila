# PROJECT-PROGRESS-DASHBOARD-UX-UPGRADE-DESIGN

**This phase is DESIGN-ONLY (Mode 2). The future implementation phase is SAFE IMPLEMENTATION (Mode 4) and requires its own explicit Victor approval before any file edit.**

**Codification phase:** `PROJECT-PROGRESS-DASHBOARD-UX-UPGRADE-DESIGN-SPEC` (DOCS-ONLY / Mode 3). This file persists the accepted conversation-only `PROJECT-PROGRESS-DASHBOARD-UX-UPGRADE-DESIGN` (DESIGN-ONLY / Mode 2) so a future execution phase can consume it.

**Target future phase:** `PROJECT-PROGRESS-DASHBOARD-WEB-UX-UPGRADE` (SAFE IMPLEMENTATION / Mode 4) — separately gated, not opened by this codification.

**Authority chain:** The design recorded here was produced as a DESIGN-ONLY conversation, reviewed by Codex (DESIGN-ONLY full-narrative review, embedded-design dispatch), corrected per Codex required edits, and accepted by Victor. This file does NOT itself constitute an execution authorization. Codex review verdicts are not operator approval.

---

## Codification provenance

- **DESIGN-ONLY phase:** `PROJECT-PROGRESS-DASHBOARD-UX-UPGRADE-DESIGN` (no on-disk artifact; conversation-only).
- **Driver:** operator feedback from the local preview (`http://127.0.0.1:4321/`) — site works and looks nice; wording too technical; tone too corporate; theme too basic; desired direction is an AI command center with glassmorphism, 3D data-visualization feel, immersive layered panels.
- **Preview server status:** The local preview server background task `b35ub2tpy` running on `http://127.0.0.1:4321/` is operator-approved, and this codification phase does not interact with it.
- **Codex round-1 (full 24-point design review):** OVERALL PASS WITH REQUIRED EDITS — 14 PASS, 2 PASS WITH REQUIRED EDITS, 6 FAIL, all addressable.
- **9 Required Edits applied** to the conversation-only design:
  - **RE-1** — Added preamble: "This phase is DESIGN-ONLY (Mode 2). The future implementation phase is SAFE IMPLEMENTATION (Mode 4) and requires its own explicit Victor approval before any file edit."
  - **RE-2** — Changed "Approvers shown as exactly Victor (singular)" to "Approvers shown as exactly `{Victor}`" (set-notation).
  - **RE-3** — Replaced bare "operator-approved" example in §1 R9 with "operator-authorized".
  - **RE-4** — Rewrote §10 as the full 24-item Codex review checklist explicitly enumerated.
  - **RE-5** — Added parser-purity invariant to §6.
  - **RE-6** — Added full sealed-invariants block to §9 (Migration 008 + Stage 5 Gate-10 + Antigravity SHAs + CEILING-PAUSE + Relay-runtime DORMANT + Autopilot DORMANT + `{Victor}`).
  - **RE-7** — Added preview-host override clause to §9.
  - **RE-8** — Added codification-governance clause to §9.
  - **RE-9** — Added parent/Relay evidence-boundary clause to §9.
- **Codex narrow re-review (RE-1 through RE-9):** OVERALL PASS — all 13 items PASS (RE-1 through RE-9 individually, plus scope, forbidden-literal scan, substantive content preservation, overall).
- **Operator decision:** corrected design accepted as conversation-only working design.

---

## §1 — Plain-English copywriting rules

R1. **Speak in first person** ("I'm working on…", "What's next for me") — this is Victor's personal cockpit, not a status report.

R2. **One idea per sentence.** No nested clauses. No semicolon chains. Prefer 8–14 word sentences.

R3. **Use everyday verbs.** "Done", "in progress", "paused", "planned" — not "CLOSED", "CONSUMED", "DORMANT".

R4. **Drop the artifact names from the surface.** A reader shouldn't see `STATUS.md`, `CHECKLIST.md`, `orchestrator/`, `parent-repo`, `SHA`, `commit hash`, or `fast-forward` in any visible heading or sentence. Those live in hover-tooltips / "show details" disclosures.

R5. **Replace gate/lock jargon with plain protection words.** "Safety locks", "guardrails", "off switches" — not "Safety Gates", "Stage 5 Gate-10 CONSUMED".

R6. **Numbers speak first; labels follow.** A big "53" with "things finished" below it beats "53 phases CLOSED in STATUS.md".

R7. **Acronyms must earn their place.** `URL`, `AI`, `UI` are fine. `SCAFFOLD`, `REFRESH`, `BUILD-PREVIEW-DESIGN-SPEC-CLOSEOUT-SYNC` are NOT visible labels — they may appear inside a collapsed "technical name" tooltip only.

R8. **Tone: confident and warm.** "Here's where I am" beats "Active phase recorded as…".

R9. **No technical-sounding qualifiers in the visible surface.** Avoid "operator-authorized", "Codex-PASSed", "three-way SHA consistency" in headings or summary lines. Move those to a "build provenance" detail panel.

R10. **Preserve safety language verbatim where it appears in safety panels** — see §6.

---

## §2 — Specific simplifications (mapping table)

| Current label | Simplified replacement | Where shown |
|---|---|---|
| Where Are We Now | Right Now | Hero card title |
| Active phase | I'm working on | Hero subtitle |
| phases CLOSED in STATUS.md | things finished | Hero big-number caption |
| Safety Gates | Safety locks | Section heading |
| Dormant vs Active Systems | What's on, what's resting | Section heading |
| Repo Anchors | Code checkpoints | Section heading |
| Paused Phases | On pause | Section heading |
| Designed not Opened | Planned, not started | Section heading |
| Completed Phases | Finished work | Section heading |
| Backlog | Ideas for later | Section heading |
| Phase Timeline | Recent timeline | Section heading |
| Next Safe Action | What's next for me | Section heading |
| Status: Scaffold Ready | All systems steady | Header pill |
| Migration 008 APPLIED | Database update: done | Safety-locks row |
| Stage 5 Gate-10 install CONSUMED | Helper install: used up (single-use) | Safety-locks row |
| Relay runtime DORMANT | Messenger: resting | Safety-locks row |
| Autopilot DORMANT | Auto-mode: off | Safety-locks row |
| Manual live-armed flag OPERATOR-ONLY | "The armed-trading flag: I'm the only one who can flip it" | Safety-locks row |
| CEILING-PAUSE broken via ARC-8-UNPAUSE | Soft ceiling: lifted (counter at 0 of 3) | Safety-locks row |
| N-3 deploy gate CLOSED | Deploy gate: shut | Safety-locks row |

Each simplified line keeps the original technical fact in a "show full name" disclosure on hover or tap.

---

## §3 — New tone: personal command center

The dashboard reads like Victor's pilot view inside his own AI cockpit. Voice:
- First-person headings: "What I'm working on", "What's next for me", "How I'm protecting things".
- A small recurring identity element: "Agent Avila / Mission Console" in the top bar, calm and confident.
- Time-aware framing where appropriate ("As of today…", "Updated a few hours ago…") — derived from the existing snapshot timestamp; **no `Date.now()` inside `load-dashboard.ts`; parser remains pure.**
- No corporate-report scaffolding (no "Executive Summary", no "Quarterly Status").
- Emoji used sparingly and only if Victor wants it; current proposal: none, since the neon palette already carries the personality.

---

## §4 — Visual style direction (immersive AI command center)

**Layered depth:**
- Background = three stacked layers: (1) deep navy radial gradient (current `--bg-deep` → `--bg-base`), (2) slow-drifting blurred gradient orbs (cyan + violet + a new warm amber `#ffb96b` at low alpha), (3) faint scan-line CSS pattern at 4–6% opacity.
- Foreground = glass-cards at two depth tiers: "primary" cards (hero + safety locks + what's next) sit closer; "secondary" cards (timeline + checkpoints) sit deeper with smaller blur radius and lower border opacity.

**Glassmorphism upgrade:**
- Increase `backdrop-filter: blur(12px) → blur(20px)` on primary cards.
- Add a thin inner highlight stroke (top edge `rgba(255,255,255,0.05)` to fake light catch).
- Add a subtle outer "neon edge" on focus / hover: a 1px gradient border that animates from cyan to violet.
- Card corner radius increases from `0.75rem → 1.25rem`.

**3D data-visualization feel** (CSS-only; no WebGL, no canvas requiring runtime data):
- Hero "things finished" count rendered as a radial progress ring (SVG, static — count vs the next round number, e.g., 53/60).
- "Safety locks" rendered as a row of small circular indicator dials with concentric stroke arcs and a glowing center dot for "good", a dim center dot for "off", and a warm-amber for "in-use".
- "Recent timeline" gets a horizontal scrubbable strip of dots connected by a glowing line (CSS gradient on a `<div>` with absolutely-positioned dots).
- "What's on, what's resting" gets a two-column layout with the "resting" side rendered in a desaturated, slightly-blurred glass to communicate it's sleeping.

**Motion:**
- All animation gated behind `prefers-reduced-motion: no-preference` (preserved from current `animations.css`).
- Add a 6–10s drift loop on background orbs (translate + opacity).
- Card hover: tilt is OFF by default (avoid motion sickness). Instead, hover gives a soft glow swell.
- Status pill keeps the existing 1.2s pulse-glow.

**Typography:**
- Hero number font-size up to `text-7xl` with `font-display` (a new custom display stack, e.g., `Space Grotesk` or system-ui fallback — **NO web-font fetch from external CDNs; either bundle or rely on the system stack**).
- Section headings reduce in size from `text-xs uppercase tracking` jargon style to `text-sm` mixed-case body to feel more human ("Right Now" not "WHERE ARE WE NOW").
- Body copy keeps current Inter/system-ui stack.

**New palette additions:**
- Existing: cyber-cyan `#00e6ff`, cyber-violet `#8b5cf6`, cyber-emerald (used for OK counts).
- Add: `--accent-warm: #ffb96b` (used for "in use", "consumed once", attention-needed without alarm).
- Add: `--accent-rose: #ff6b9b` (used VERY sparingly for "stop" or "halt" indicators).
- Existing emerald keeps the "good / done" role.

---

## §5 — Which sections to redesign first

Priority order (first three are the biggest UX wins):

1. **Hero / "Right Now"** — replace the simple count card with the radial-ring + big display number + first-person sentence. Highest visual impact; every visitor sees this first.
2. **Safety locks** — convert the table to the row-of-dials layout. Most "technical-feeling" section in the current build; biggest tone improvement.
3. **What's next for me** — currently small text; promote to a prominent action-card with clear next-step language.
4. **What's on, what's resting** — convert table to the two-column "active vs resting" cards.
5. **Recent timeline** — convert checklist to the scrubbable dot-strip.
6. **Code checkpoints (Repo Anchors)** — keep technical but move SHAs into hover-tooltips; the visible row shows repo + a friendlier "anchor: <short label>" instead of raw hashes.
7. **Finished work / Paused / Planned-not-started / Ideas for later / Recent timeline** — straightforward heading/copy swaps + glass-card tier reduction (secondary depth).

---

## §6 — Safety-focused content that must remain unchanged

These items keep their exact factual content (only the visible PHRASING changes; the underlying parsed data does not):

- The trading-isolation disclaimer must remain present and visible at the bottom of the page (and ideally also in a small badge near the hero): **"This web project is entirely separate from the trading runtime `dashboard.js`. It does not modify, replace, or supplement live trading functionality."**
- The carried-forward Astro `define:vars` XSS advisory (SCAFFOLD-phase documented known advisory; affected `<6.1.6`; vulnerable feature unused; remediation deferred per design §5 rule 7) — if surfaced on the page at all, must use the SCAFFOLD-carried-forward wording, not a "freshly verified" claim.
- The safety-lock factual states (deploy gate shut, database update done, helper install used up, messenger resting, auto-mode off, the armed-trading flag operator-only, soft ceiling lifted with counter 0 of 3) come straight from the sealed parser and must NOT be invented or paraphrased away from the underlying data.
- No bare forbidden literals on the surface: where the page references protected env-var-shaped concepts, the visible wording uses "the armed-trading flag", "Kraken credential env vars", "the Railway deploy token", "the GitHub token", "the OpenAI key", "subprocess-spawn APIs" — never the raw symbol names.
- Approvers shown as exactly `{Victor}`, never inferred or expanded.
- **Parser purity remains locked: no `Date.now()`, `Math.random()`, `fetch()`, `XMLHttpRequest`, `WebSocket`, forbidden `import.meta.glob`, subprocess-spawn APIs, dynamic eval/Function, or new file-system reads outside the sealed allowlist.**

---

## §7 — Accessibility requirements

- Keep WCAG AA contrast on all text. The current `#94a3b8` muted on the dark gradient is close to the edge; new design must keep main body text at >= 4.5:1 against the local background under each card.
- Keep the existing `<a href="#main" class="skip-link">` skip-link.
- Section structure must keep `<section id={..} aria-labelledby={..-heading}>` + `<h2 id="...-heading">` pattern (already implemented; do not regress).
- `prefers-reduced-motion: reduce` must disable ALL drift orbs, scan-lines that move, hover swell, status pulse, and any new animations.
- Focus-visible outline must remain (currently `2px solid var(--accent-cyan)`); new design may switch to a 2px gradient outline only if contrast remains AA.
- Radial ring + dial visuals must each include a screen-reader-only text equivalent (e.g., `<span class="sr-only">53 of 60 things finished</span>`).
- All decorative SVG elements get `aria-hidden="true"`.
- New display font must keep a system-stack fallback so the page still renders if the custom font is blocked or unavailable.
- Tap targets stay ≥ 44px tall on mobile.
- No autoplay video, no audio.

---

## §8 — Files that would be touched in a future implementation phase

Expected modifications under `web/`:
- `web/src/styles/global.css` — extend the `:root` palette with `--accent-warm`, `--accent-rose`, `--bg-orb-cyan`, `--bg-orb-violet`, `--bg-orb-amber`. Add the background-orb / scan-line CSS layers.
- `web/src/styles/theme.css` — extend `.glass-card` (deeper blur, larger radius, top-edge inner highlight), add new `.glass-card--primary` and `.glass-card--secondary` variants, add `.neon-ring` for the hero radial, add `.safety-dial` for the lock dials, add `.timeline-strip`.
- `web/src/styles/animations.css` — add `orb-drift`, `glow-swell` animations, all gated behind `prefers-reduced-motion: no-preference`.
- `web/src/components/Card.astro` — accept a `tier="primary"|"secondary"` prop and apply the right glass variant.
- `web/src/components/Section.astro` — update section heading typography (replace `text-xs uppercase tracking-wider` with a friendlier `text-sm font-medium` while keeping the `id`+`aria-labelledby` accessibility plumbing).
- `web/src/components/sections/Hero.astro` — replace card body with the radial-ring + display-number layout.
- `web/src/components/sections/SafetyGates.astro` — replace table with the dial-row layout. **Rename file? NO** — file paths stay; only template and visible copy change.
- `web/src/components/sections/PhaseTimeline.astro` — convert checklist into dot-strip.
- `web/src/components/sections/DormantVsActive.astro` — convert table to two-column glass cards.
- `web/src/components/sections/RepoAnchors.astro` — keep data but tuck the SHA into a hover/tap tooltip; surface a friendlier anchor label.
- `web/src/components/sections/NextSafeAction.astro` — promote visual prominence.
- `web/src/components/sections/Header.astro` — update top-bar identity copy + status-pill label.
- `web/src/components/sections/Hero.astro` content captions, `Backlog.astro`, `CompletedPhases.astro`, `PausedPhases.astro`, `DesignedNotOpened.astro` — visible-heading and caption copy swaps per §2.
- `web/src/components/Disclaimer.astro` — keep verbatim, do not soften the trading-isolation language.
- (Optional, but recommended) `web/src/components/SafetyDial.astro` (new), `web/src/components/RadialRing.astro` (new), `web/src/components/TimelineStrip.astro` (new) — small dedicated visual primitives so the existing section components stay thin.
- `web/tailwind.config.mjs` — extend `theme.extend.colors` with the new accents; extend `theme.extend.fontFamily.display` with the new display stack.
- `web/src/layouts/BaseLayout.astro` — add background-orb / scan-line ambient layers.

No new dependencies. No new fonts fetched from a network at runtime. No JavaScript runtime (the page stays static; all animation is CSS).

---

## §9 — Files that must remain untouched and additional governance clauses

**Files that must remain untouched:**

- `tools/dashboard-generate.js` (sealed at `f5cc97a…`).
- `orchestrator/DASHBOARD.md` (regenerated only at REFRESH phases via the sealed generator).
- `orchestrator/handoffs/PROJECT-PROGRESS-DASHBOARD-BUILD-PREVIEW-DESIGN.md` (sealed at `34e15df…`).
- `orchestrator/handoffs/PROJECT-PROGRESS-DASHBOARD-WEB-IMPLEMENT-DESIGN.md` (sealed at `e6af54a…`).
- `orchestrator/handoffs/PROJECT-PROGRESS-DASHBOARD-WEB-DESIGN.md` (sealed at `1b49fc3…`).
- The two canonical prior PROJECT-PROGRESS-DASHBOARD handoffs at `f6aaa40…` and `c8798ea…`.
- Root `package.json`, root `package-lock.json` (RESTRICTED).
- `web/package.json`, `web/package-lock.json` (sealed at SCAFFOLD `cc6819d…`; no new dependencies needed for this upgrade).
- `web/src/lib/load-dashboard.ts`, `web/src/lib/dashboard-parser.ts`, `web/src/lib/types.ts`, `web/src/lib/format.ts`, `web/src/lib/constants.ts` (DATA layer; the upgrade is presentation-only).
- `bot.js`, `dashboard.js`, `db.js`, anything in `migrations/`, `scripts/`, `position.json*`, `.env*`, and the `position.json.snap.20260502T020154Z` carve-out (always untracked).
- Any Relay-repo file (separate repo).
- `web/src/components/Disclaimer.astro` content (style may evolve; the trading-isolation sentence text is verbatim-locked).

**Sealed invariants preserved (RE-6):**

> Preserve Migration 008 APPLIED at `189eb1be…`, Stage 5 Gate-10 install approval at `40f3137e…` CONSUMED, Antigravity chain SHAs `71af035…` / `d7bb704…` / `19db372…` / `9d47f74…` / `6c41c2c…`, CEILING-PAUSE broken via ARC-8-UNPAUSE at `22ba4a7…` with counter 0 of 3, Relay-runtime DORMANT, Autopilot DORMANT verified at `eff4dd2…`, and approvers exactly `{Victor}`.

**Preview-host override (RE-7):**

> The explicit `--host 127.0.0.1` preview-server override remains operator-only and is not adopted as a project default.

**Codification governance (RE-8):**

> Codifying this conversation-only design into a future handoff is a separate phase requiring its own explicit Victor approval. Claude has no authority to write this design to disk in this phase.

(Operator note: that "this phase" referred to the original DESIGN-ONLY phase. The current DOCS-ONLY codification phase is the separate phase the clause anticipates; it has its own explicit Victor approval before any edit ran here.)

**Parent-repo / Relay-repo evidence boundary (RE-9):**

> Parent-repo git state can verify parent-repo files only. It cannot prove a sibling Relay repo was untouched; Relay-repo verification requires explicit Relay-repo git-state evidence.

---

## §10 — Codex review checklist for the future implementation phase (24 items)

When `PROJECT-PROGRESS-DASHBOARD-WEB-UX-UPGRADE` (SAFE IMPLEMENTATION / Mode 4) opens, Codex must verify each of these 24 items and emit PASS / PASS WITH REQUIRED EDITS / FAIL per item plus an overall verdict:

1. **Phase mode** classification correct: SAFE IMPLEMENTATION (Mode 4) — not HIGH-RISK (Mode 5), not DOCS-ONLY (Mode 3). Rationale defensible: no new dependency, no new runtime path, no new network surface.
2. **Scope** strictly under `web/` (plus `web/tailwind.config.mjs`); no edit outside `web/`; no edit to root `package.json` / `package-lock.json`.
3. **`web/package.json` / `web/package-lock.json` byte-stable** (sealed at SCAFFOLD `cc6819d…`; no `npm install`, no new dependency).
4. **`tools/dashboard-generate.js` byte-stable** (sealed at `f5cc97a…`).
5. **`orchestrator/DASHBOARD.md` byte-stable** (regenerated only at REFRESH phases).
6. **Sealed handoffs byte-stable**: BUILD-PREVIEW-DESIGN at `34e15df…`, WEB-IMPLEMENT-DESIGN at `e6af54a…`, WEB-DESIGN at `1b49fc3…`, prior PROJECT-PROGRESS-DASHBOARD handoffs at `f6aaa40…` and `c8798ea…`.
7. **Data layer untouched**: `web/src/lib/load-dashboard.ts`, `dashboard-parser.ts`, `types.ts`, `format.ts`, `constants.ts` — the upgrade is presentation-only.
8. **Parser purity preserved**: no `Date.now()`, `Math.random()`, `fetch()`, `XMLHttpRequest`, `WebSocket`, forbidden `import.meta.glob`, subprocess-spawn APIs, dynamic `eval`/`Function`, or new file-system reads outside the sealed allowlist in `load-dashboard.ts`.
9. **No external CDN font fetch**; new display font ships locally or relies on the system stack.
10. **Trading-isolation disclaimer text verbatim preserved** in `web/src/components/Disclaimer.astro`: "This web project is entirely separate from the trading runtime `dashboard.js`. It does not modify, replace, or supplement live trading functionality."
11. **Astro `define:vars` XSS advisory** wording, if surfaced anywhere on the page, uses the SCAFFOLD-phase carried-forward framing — not "freshly re-verified".
12. **Safety-lock data** still comes from the sealed parser; no UI-side fabrication of safety states.
13. **No bare forbidden literals** on any visible surface, in any source file, in any commit message, or in any handoff edit. Visible wording uses "the armed-trading flag", "Kraken credential env vars", "the Railway deploy token", "the GitHub token", "the OpenAI key", "subprocess-spawn APIs".
14. **Accessibility regression checks**: skip-link present; `<section aria-labelledby>` + `<h2 id>` pattern preserved; `prefers-reduced-motion: reduce` disables all new animations; focus-visible outline retained (or upgraded with documented contrast); radial / dial / timeline visuals each carry a `sr-only` text equivalent; all decorative SVG marked `aria-hidden="true"`.
15. **WCAG AA contrast** ≥ 4.5:1 on body copy and chip text against the new layered backgrounds.
16. **Tap-target ≥ 44px** on the new dial and timeline-dot components.
17. **No new file-system or network call paths** introduced.
18. **Approvers exactly `{Victor}`** preserved in any documentation cross-references.
19. **Build still completes** via `npm run build` and emits to `web/dist/` only.
20. **`web/.gitignore`** continues to cover `dist/` and `.astro/` (Option A retained); build outputs do not appear in `git status`.
21. **Preview-host restriction unchanged** in any related docs: loopback only; the explicit `--host 127.0.0.1` operator override remains operator-only, not adopted as a project default.
22. **Phase A-F Relay-repo lettered chain references and Stage 5 Gate-10 reference** recorded as preserved / CONSUMED — not actionable or re-openable.
23. **CEILING-PAUSE phase-loop counter does not advance** (stays at 0 of 3; ARC-8-UNPAUSE history at `22ba4a7…` preserved); **Antigravity chain SHAs** (`71af035…` / `d7bb704…` / `19db372…` / `9d47f74…` / `6c41c2c…`) byte-stable; **Migration 008 APPLIED at `189eb1be…`** preserved; **Autopilot DORMANT verified at `eff4dd2…`** preserved; **Relay-runtime DORMANT** preserved.
24. **Overall verdict**: PASS / PASS WITH REQUIRED EDITS / FAIL. If PASS WITH REQUIRED EDITS, list each required edit explicitly with the file path, the section reference, and the verbatim correction.

---

## Closing — codification scope and non-authorization

This handoff is the on-disk codification of an accepted conversation-only DESIGN-ONLY result. It does not authorize execution of any command listed in §2 of the BUILD-PREVIEW-DESIGN handoff. It does not open `PROJECT-PROGRESS-DASHBOARD-WEB-UX-UPGRADE`. It does not modify `orchestrator/DASHBOARD.md`, the sealed generator, any `web/` file, any root package file, any Relay-repo file, or any runtime / trading file. It does not advance the autopilot phase-loop counter. It does not install or reconfigure Antigravity. It does not touch Railway, the Discord platform, the DB, env / secrets, the armed-trading flag, trading runtime, DASH-6, D-5.12f, Migration 009+, Autopilot Loop B/C/D, CEILING-PAUSE, the external Hermes Agent (Nous/OpenRouter), scheduler / cron / webhook / MCP install, or permission widening.

The future execution phase `PROJECT-PROGRESS-DASHBOARD-WEB-UX-UPGRADE` is separately gated, requires its own Victor approval, and requires its own separate Codex SAFE IMPLEMENTATION review before commit.

**This web project is entirely separate from the trading runtime `dashboard.js`. It does not modify, replace, or supplement live trading functionality.**
