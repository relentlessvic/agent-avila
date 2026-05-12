# PROJECT-PROGRESS-DASHBOARD-WEB-DESIGN

**Phase identity (future implementation cascade):** `PROJECT-PROGRESS-DASHBOARD-WEB-*` lettered phases (SCAFFOLD, CONTENT, etc.; not opened by this codification)
**Future phase modes:** SAFE IMPLEMENTATION (Mode 4) for SCAFFOLD + CONTENT phases; DOCS-ONLY (Mode 3) for closeouts/syncs
**Source-design phase:** `PROJECT-PROGRESS-DASHBOARD-WEB-DESIGN` (Mode 2 / DESIGN-ONLY conversation-only v2)
**Source-design HEAD anchor:** `85ab274c316fdbb98b850aa7288f574a5302b05a` (parent repo; = PROJECT-PROGRESS-DASHBOARD-REFRESH-001-CLOSEOUT-SYNC commit)
**Relay-repo Phase F sealed anchor (informational; off-scope for web):** `b8ab035034668fd53ea6efe64432f0868dfd2eb9`
**Codification phase:** `PROJECT-PROGRESS-DASHBOARD-WEB-DESIGN-SPEC` (DOCS-ONLY / Mode 3)
**Parent canonical handoffs (both sealed, both untouched by this codification):**
- `orchestrator/handoffs/PROJECT-PROGRESS-DASHBOARD-DESIGN.md` (codified at `f6aaa40…`)
- `orchestrator/handoffs/PROJECT-PROGRESS-DASHBOARD-IMPLEMENT-DESIGN.md` (codified at `c8798ea…`)
- Sealed generator: `tools/dashboard-generate.js` codified at `f5cc97a…`
- Refreshed dashboard snapshot: `orchestrator/DASHBOARD.md` codified at `eb0634f…`

This document persists the Codex-PASS v2 conversation-only WEB-DESIGN as a SAFE-class handoff record. The design covers a future local-only static futuristic website (Astro + Tailwind) that renders the existing `orchestrator/DASHBOARD.md` as a richer visual layer — entirely separate from the trading runtime `dashboard.js` and the trading dashboard surface. All required edits across Codex DESIGN-ONLY rounds 1 and 2 are applied verbatim. The document is NOT approval to open any future WEB phase, NOT a generator/website implementation, NOT a build, NOT a deploy, NOT a network-touch.

---

## §0 — Phase classification & pre-flight verification

| Property | Value |
|---|---|
| Future implementation cascade root | `PROJECT-PROGRESS-DASHBOARD-WEB-*` (11-phase cascade per §12 below) |
| Future phase modes | Mode 2 (DESIGN-ONLY) + Mode 3 (DOCS-ONLY) + Mode 4 (SAFE IMPLEMENTATION for SCAFFOLD + CONTENT) |
| Predecessor (parent repo) | REFRESH-001-CLOSEOUT-SYNC at `85ab274c316fdbb98b850aa7288f574a5302b05a` |
| Successor lettered phase | unchanged — Relay lettered phases continue separately gated |
| Relay-repo state | unchanged at `b8ab035…` (Phase F sealed); off-scope for the web project entirely |
| Working tree at design time | clean except `position.json.snap.20260502T020154Z` (untracked carve-out preserved) |

**Codex review history (source design phase, conversation-only):**

- **Round-1 (v1 DESIGN-ONLY):** PASS WITH REQUIRED EDITS — single factual correction at Goal 8 (§12 incorrectly claimed "No root-level package.json exists"; verified false — both root `package.json` and `package-lock.json` exist and are RESTRICTED per `PROTECTED-FILES.md`).
- **Round-2 (v2 narrow re-review):** overall PASS across all 12 narrow goals. RE-1 applied verbatim. All 19 prior round-1 PASS goals preserved. No new forbidden literals introduced. Mode 2 DESIGN-ONLY preserved. No `web/` directory created. No npm install. Root `package.json` + `package-lock.json` untouched. Future web dependencies isolated to `web/package.json` + `web/package-lock.json` only.

---

## §1 — Recommended platform: Astro + Tailwind (with caveats + fallback)

**Primary recommendation:** **Astro + Tailwind**.

Why Astro:
- Static-output by default (no SSR; no Node runtime in production)
- Markdown content collections natively (can ingest `orchestrator/DASHBOARD.md` directly at build time)
- Component model + hydration islands (most page is static HTML; tiny JS for optional interactivity)
- TypeScript-friendly; modern; small build output
- Tailwind integration first-class

Why Tailwind:
- Utility-first; no custom CSS sprawl
- Vendored at build time; no runtime CSS fetching
- Themeable via tokens; supports dark/light variants

**Tradeoffs vs alternatives (already evaluated; all rejected for v1):**

| Option | Why not chosen for v1 |
|---|---|
| Vanilla HTML/CSS/JS | Smallest dependency surface (zero npm); but no component reuse; harder to evolve; more manual data wiring |
| 11ty (Eleventy) | Smaller dep tree than Astro; pure JS; weaker component story; reserved as fallback if Astro dep footprint judged unacceptable at DESIGN-SPEC review or SCAFFOLD review |
| Vite + Lit / Svelte / SolidJS | Comparable to Astro; Astro's static-first + content collections are a better fit |
| Next.js / Nuxt | Overkill; SSR-first; needs Node runtime at hosting time |
| Plain markdown viewer | Already have that (markdown rendering on GitHub or in editor); this design's goal is a richer visual layer |

**Caveat (preserved from v2 review):** Astro pulls a non-trivial npm dependency tree (hundreds of transitive packages at build time). The Mode 4 SCAFFOLD phase will be the first project surface that touches `package.json` / `package-lock.json` **inside `web/` only** (root files remain RESTRICTED + untouched). Codex review at SCAFFOLD time must:

- Pin exact versions (no `^` / `~` / `*`)
- Verify lockfile contents
- Disable postinstall scripts
- Refuse any analytics / telemetry deps
- Refuse any deps that make network calls at runtime
- Verify no dep imports trading-runtime files

**Fallback:** If Astro's dep footprint is judged unacceptable at DESIGN-SPEC review or SCAFFOLD review, fall back to Option B (vanilla HTML/CSS/JS) or Option C (11ty).

---

## §2 — Local-only static architecture

- **Build target:** `web/dist/*` — pure static HTML/CSS/JS files
- **Runtime:** open `dist/index.html` directly in a browser, OR serve via `astro preview` (local Node serve), OR any local static server
- **No backend.** No API endpoints. No SSR. No serverless. No edge functions.
- **No network calls at runtime.** All data baked into the build artifacts at build time.
- **No service worker** doing background sync. (Optional cache-only service worker for offline static viewing may be considered later; never with background sync.)
- **No telemetry / analytics / external CDN.** Fonts vendored locally.
- **Build is operator-run only**, never auto-triggered. Each rebuild is a separately-gated phase analogous to the existing `PROJECT-PROGRESS-DASHBOARD-REFRESH-NNN` pattern.
- **No deploy in scope of the IMPLEMENT phases.** Deployment is a future separately-gated phase.

---

## §3 — Data source: `orchestrator/DASHBOARD.md` at build time (v1)

**v1 data path:** Astro reads `orchestrator/DASHBOARD.md` at build time. Section headers, tables, and metadata are parsed via Astro content collections + remark plugins.

**Pros (DASHBOARD.md path):**
- No modification to `tools/dashboard-generate.js` (sealed at `f5cc97a…`)
- Single source of truth (DASHBOARD.md is already the authoritative snapshot)
- No risk of data drift between two output formats

**Cons:**
- Brittle if DASHBOARD.md format changes
- Parsing is more complex than reading JSON

**Future improvement deferred:** A separately-gated `PROJECT-PROGRESS-DASHBOARD-JSON-EXPORT` phase could add a `--json` flag to `tools/dashboard-generate.js` to emit structured JSON. The web project could then switch to that as a cleaner data source. This requires:
- Modifying the sealed generator (separately gated cascade)
- An additional file (`orchestrator/DASHBOARD.json` or similar)

v1: read DASHBOARD.md. Future: optional JSON migration.

---

## §4 — Futuristic visual theme

**Aesthetic:** cyberpunk control room / clean sci-fi instrumentation. Function over noise.

**Theme tokens:**

| Token | Value |
|---|---|
| Background base | `#0a0e1a` (deep navy-black) |
| Surface | `#0f1525` (slightly raised cards) |
| Surface elevated | `#161d33` (modals, popovers) |
| Primary accent | `#22d3ee` (cyan) — active phases, anchors |
| Secondary accent | `#a78bfa` (violet) — designed / not-opened |
| Success | `#10b981` (emerald) — gates OK |
| Warning | `#fbbf24` (amber) — paused, blocked |
| Danger | `#f87171` (coral) — off-scope, forbidden |
| Muted | `#64748b` (slate) — secondary text, untracked |
| Text primary | `#e2e8f0` |
| Text muted | `#94a3b8` |

**Typography:**
- Headers: `JetBrains Mono` or `Space Grotesk` (monospace energy)
- Body: `Inter` (clean sans)
- SHAs: monospace, slightly muted, with `Copy` affordance on hover

**Visual elements:**
- Glass-morphism cards: backdrop-blur; semi-transparent panels
- Subtle grid background (dot-grid or thin lines)
- Status pills with optional pulse glow for `ACTIVE` / `IN PROGRESS`
- Phase timeline: vertical with SHA nodes; click to copy SHA
- Safety gates: traffic-light 10-cell grid
- Subtle animations; respect `prefers-reduced-motion`
- Icons: heroicons or lucide (small dep, vector, themeable)

**Accessibility:**
- WCAG AA color contrast minimum
- Keyboard navigation
- `prefers-color-scheme` honored (dark default; optional light variant)
- Screen-reader labels on all status pills

---

## §5 — Website sections

Mirror the canonical `orchestrator/DASHBOARD.md` but with richer presentation:

1. **Header bar** — Generated timestamp; Parent HEAD short SHA + drift indicator; Relay HEAD + sealed badge; working-tree pill
2. **Hero / Where Are We Now** — one-sentence current state; large active-phase callout
3. **Active Phase card** — phase name, mode, scope, pending decision
4. **Safety Gates panel** — 10-cell traffic-light grid
5. **Completed Phases timeline** — vertical timeline (recent first); SHA + phase + mode; click to copy SHA; collapsible after N items
6. **Paused Phases** — card list with pause-reason inline
7. **Designed / Not-Opened** — card list with mode badge
8. **Backlog gallery** — 14-item grid; filterable by status (`BACKLOG-IDEA` / `BACKLOG-DESIGNED` / `BLOCKED-DECISION` / `BLOCKED-DEPENDENCY`)
9. **Phase Timeline / Roadmap** — visual gantt (simplified) OR styled ASCII fallback; committed-anchored only
10. **Repo Anchors** — two-card mini-section (Parent + Relay); GitHub-style link styling (but no live link / no network)
11. **Dormant vs Active Systems** — table with status pills; `bot.js` and `dashboard.js` clearly marked OFF-SCOPE / NOT ASSESSED BY THIS DASHBOARD with explicit "trading-runtime separation" badge
12. **Next Safe Action** — highlighted callout at bottom

**Optional interactive features (light, all client-side):**
- Filter phases by status
- Expand/collapse sections (persist in localStorage; UI preferences only — no secrets ever in localStorage)
- Copy-SHA-to-clipboard button
- Keyboard shortcuts (`/` to filter, `?` to show help)
- Toggle light/dark theme
- Staleness warning if DASHBOARD.md is N commits behind current parent HEAD (read from baked-in metadata field)

**Footer disclaimer (always present):** "This is a static read-only view of orchestrator state. It is not the trading dashboard (`dashboard.js`). It does not modify, replace, or supplement live trading functionality."

---

## §6 — Future file scope (for the SCAFFOLD + CONTENT cascade; not this DESIGN-SPEC phase)

**Estimated new files (~30–50 new files in `web/`):**

| Category | Files (approximate) |
|---|---|
| Root config | `web/.gitignore`, `web/.npmrc`, `web/README.md`, `web/package.json`, `web/package-lock.json`, `web/astro.config.mjs`, `web/tailwind.config.mjs`, `web/tsconfig.json` |
| Source | `web/src/pages/index.astro`, `web/src/layouts/Base.astro` |
| Components | `web/src/components/Header.astro`, `Hero.astro`, `ActivePhase.astro`, `SafetyGates.astro`, `CompletedPhases.astro`, `PausedPhases.astro`, `DesignedNotOpened.astro`, `Backlog.astro`, `Timeline.astro`, `RepoAnchors.astro`, `DormantVsActive.astro`, `NextSafeAction.astro`, `Footer.astro`, `StatusPill.astro`, `ShaChip.astro` |
| Data | `web/src/data/dashboard.ts` (parses DASHBOARD.md at build), `web/src/data/types.ts` |
| Styles | `web/src/styles/global.css`, `web/src/styles/theme.css` |
| Public | `web/public/favicon.svg`, `web/public/fonts/` (vendored locally) |
| Build output (gitignored) | `web/dist/`, `web/node_modules/` (NOT committed) |

**Modified files (parent repo):**
- `orchestrator/STATUS.md`, `CHECKLIST.md`, `NEXT-ACTION.md` (status doc transitions per phase)

**NOT modified (immovable):**
- **Root `package.json` and `package-lock.json`** — these exist, are RESTRICTED per `PROTECTED-FILES.md`, are unrelated to the web project, and must remain untouched; web dependencies, if ever authorized, live only under `web/package.json` and `web/package-lock.json`.
- `tools/dashboard-generate.js` (sealed at `f5cc97a…`)
- `orchestrator/DASHBOARD.md` (canonical snapshot; only refreshed via separately gated REFRESH-NNN)
- Both canonical PROJECT-PROGRESS-DASHBOARD handoffs (`f6aaa40…` + `c8798ea…`)
- All trading-runtime / Relay / Phase C-F sealed files

**Tooling:** `web/` lives at parent-repo root as a sibling to `orchestrator/`, `tools/`, `src/`, etc. It contains its own `package.json` so the root project is unaffected. Codex review verifies isolation at SCAFFOLD time.

---

## §7 — Forbidden files and safety boundaries

**Web project NEVER reads at build time or runtime:**
- `bot.js`, `dashboard.js`, `db.js`
- `position.json`, `position.json.snap.*`
- `.env*`, secrets directories
- `.nvmrc` (root)
- `migrations/*`, `scripts/*` (trading scripts)
- `package.json`, `package-lock.json` (root level — these are RESTRICTED and unrelated to web)
- `railway.json`, deploy scripts, CI/CD config
- Live Kraken / exchange paths
- Production DB clients / queries
- Discord bot / token / webhook / scheduler surfaces
- Relay repo paths (`/Users/victormercado/code/agent-avila-relay/`)
- Memory files
- Test files

**Allowed reads (build time only):**
- `orchestrator/DASHBOARD.md` — primary data source
- `orchestrator/handoffs/*.md` — optional, for cross-link rendering
- Files inside `web/src/` and `web/public/` — own source

**Web project NEVER does at any time:**
- Network calls (no `fetch` / `XMLHttpRequest` / `WebSocket` / `EventSource` / `WebRTC` to any URL)
- Service workers with background sync
- Background polling
- Telemetry / analytics
- LocalStorage of credentials or secrets
- Auto-refresh
- Read or write to git history at runtime (build-time read of DASHBOARD.md is allowed via fs)
- Touch any port held by `dashboard.js`
- Replace or substitute `dashboard.js` functionality
- Display anything that could be confused with live trading state

---

## §8 — 10 Safety invariants

1. **Build-time read of `orchestrator/DASHBOARD.md` only.** No runtime data fetching.
2. **Zero-network at runtime and build time.** No CDN-loaded fonts/icons; vendor everything.
3. **No service worker** (or only an optional cache-only service worker for offline static viewing; no background sync).
4. **No localStorage / cookies for sensitive data.** Only UI preferences (theme, collapsed sections).
5. **No analytics, telemetry, or 3rd-party scripts.**
6. **Trading-runtime isolation.** Never read `bot.js`, `dashboard.js`, `db.js`, `position.json*`.
7. **No Relay-repo reads** at build or runtime.
8. **Isolated dependencies.** `web/` has its own `package.json` + lockfile; root project untouched (root `package.json` and `package-lock.json` are RESTRICTED).
9. **No deploy** in scope of the WEB-IMPLEMENT phases. Deployment is a future separately-gated phase.
10. **Operator approval cascade preserved.** Every WEB phase is its own Codex-reviewed + Victor-approved phase.

---

## §9 — 10 Trading-dashboard separation invariants (permanent)

1. **Naming disambiguation.** Internal: `web/`. UI copy: something like `Project Progress Console` or `Orchestrator Status Web` — never `dashboard` alone, never `dashboard.js`, never positioned as a replacement for `dashboard.js`.
2. **File-path isolation.**
   - `dashboard.js` (root) = trading dashboard runtime (RESTRICTED per `PROTECTED-FILES.md`)
   - `orchestrator/DASHBOARD.md` = orchestrator markdown snapshot
   - `web/` (new) = static website rendering `orchestrator/DASHBOARD.md`
   Three distinct names sharing the root word "dashboard"; **never refer to the same thing**.
3. **Trading-data forbidden surface.** Web project never reads `bot.js`, `dashboard.js`, `db.js`, `position.json*` at build or runtime. Allowlist enforcement in build-time data loader.
4. **No port-sharing.** Astro defaults to port `4321`; trading dashboard uses a different port. Web dev/preview server never collides with `dashboard.js`.
5. **No CLI confusion.** Build commands (`npm run build`, `npm run dev`) invoked via `cd web && npm run …` — never aliased to root-level scripts.
6. **No code import boundary crossing.** Web project never `import`s from anything outside `web/src/` and `orchestrator/*.md` content. Trading runtime never imports from `web/`.
7. **No shared `node_modules`.** `web/node_modules/` is isolated; root project has its own `node_modules/` (if any) entirely separate.
8. **Canonical handoff statement.** Every WEB phase handoff record will include the verbatim clause: *"This web project is entirely separate from the trading runtime `dashboard.js`. It does not modify, replace, or supplement live trading functionality."*
9. **Footer disclaimer on every page.** The rendered website includes a footer line explicitly stating it is a project-progress view, not a trading dashboard.
10. **Codex review pattern.** Every Mode 4 WEB phase Codex review must include the explicit goal: *"Verify the web project does not read `bot.js`, `dashboard.js`, `db.js`, `position.json*` at build time or runtime, and does not import from the trading runtime."*

---

## §10 — Deferred / out of scope

- **Public deployment** to Vercel / Netlify / GitHub Pages / any host — separately gated future phase
- **Custom domain / DNS / HTTPS certificates** — defer
- **Authentication / multi-user features** — never needed (single-operator local view)
- **Real-time data** (WebSocket, SSE, polling) — never
- **Auto-rebuild on git commits** — never (each rebuild is a gated phase)
- **Service worker / PWA / offline install** — defer; if added later, must be cache-only with no background sync
- **Astro SSR mode** — defer; static-only forever (or until separately gated)
- **Markdown editor / interactive editing** — never (read-only display)
- **Search functionality** (full-text across phases) — defer
- **Cross-repo dashboard** (showing Relay-repo data) — never until separately gated scope expansion phase (Relay-repo reads are off-scope by canonical safety)
- **Trading data integration** — **NEVER** (always off-scope by canonical safety; this is the immovable invariant)
- **Analytics / usage tracking** — never
- **AI / LLM integration in the web** — defer
- **Webhook listeners / API endpoints** — never (no backend)
- **Notification / alert system** — defer
- **Cron / scheduler** — never (per canonical safety boundaries)
- **MCP / automation install in the web** — never
- **Read of `position.json*`, `bot.js`, `dashboard.js`, `db.js`** — **never** (canonical trading-safety boundary)
- **Modification of root `package.json` / `package-lock.json`** — never (RESTRICTED; unrelated to web)

---

## §11 — 11-phase future cascade

Proposed phases (each separately gated; each requires explicit Victor instruction + Codex review):

| # | Phase | Mode | Scope |
|---|---|---|---|
| 1 | `PROJECT-PROGRESS-DASHBOARD-WEB-DESIGN` | Mode 2 / DESIGN-ONLY | The conversation-only v2 report (already round-2 PASS) |
| 2 | `PROJECT-PROGRESS-DASHBOARD-WEB-DESIGN-SPEC` | Mode 3 / DOCS-ONLY | This codification (new SAFE-class handoff + 3 status-doc updates) |
| 3 | `PROJECT-PROGRESS-DASHBOARD-WEB-DESIGN-SPEC-CLOSEOUT` | Mode 3 / DOCS-ONLY | Record DESIGN-SPEC closed |
| 4 | `PROJECT-PROGRESS-DASHBOARD-WEB-DESIGN-SPEC-CLOSEOUT-SYNC` | Mode 3 / DOCS-ONLY | Closeout-of-closeout |
| 5 | `PROJECT-PROGRESS-DASHBOARD-WEB-IMPLEMENT-DESIGN` | Mode 2 / DESIGN-ONLY | Detailed implementation plan: file-by-file, dep list, build steps |
| 6 | `PROJECT-PROGRESS-DASHBOARD-WEB-IMPLEMENT-DESIGN-SPEC` | Mode 3 / DOCS-ONLY | Codify implementation design |
| 7 | `PROJECT-PROGRESS-DASHBOARD-WEB-IMPLEMENT-DESIGN-SPEC-CLOSEOUT` | Mode 3 / DOCS-ONLY | Record IMPLEMENT-DESIGN-SPEC closed |
| 8 | `PROJECT-PROGRESS-DASHBOARD-WEB-IMPLEMENT-DESIGN-SPEC-CLOSEOUT-SYNC` | Mode 3 / DOCS-ONLY | Closeout-of-closeout |
| 9 | `PROJECT-PROGRESS-DASHBOARD-WEB-SCAFFOLD` | Mode 4 / SAFE IMPLEMENTATION | First Mode 4 phase: create `web/`, install Astro+Tailwind deps, scaffold minimum config; **first npm install ever in this project**; Codex must inspect lockfile contents |
| 10 | `PROJECT-PROGRESS-DASHBOARD-WEB-SCAFFOLD-CLOSEOUT` + `-SYNC` | Mode 3 / DOCS-ONLY (×2) | Record SCAFFOLD closed |
| 11 | `PROJECT-PROGRESS-DASHBOARD-WEB-CONTENT` | Mode 4 / SAFE IMPLEMENTATION | Add components, parse DASHBOARD.md, render full dashboard; second Mode 4 phase |
| (+) | `PROJECT-PROGRESS-DASHBOARD-WEB-CONTENT-CLOSEOUT` + `-SYNC` | Mode 3 / DOCS-ONLY (×2) | Final closeouts |

**This is not an automatic cascade.** Each phase requires explicit Victor instruction. Each Mode 4 phase requires the strictest Codex source-audit (allowlists, no network in built bundle, no telemetry, no postinstall scripts, no analytics).

**SCAFFOLD-vs-CONTENT split rationale:** keeps the first Mode 4 commit reviewable. SCAFFOLD lands just the empty Astro+Tailwind skeleton + a "Hello world" page. CONTENT adds the real dashboard rendering. This separates the npm-dep review (SCAFFOLD) from the markdown-parse logic review (CONTENT).

---

## §12 — Working-tree discipline at codification time

- Parent repo HEAD: `85ab274c316fdbb98b850aa7288f574a5302b05a`
- Relay repo HEAD: `b8ab035034668fd53ea6efe64432f0868dfd2eb9` (unchanged; off-scope)
- Parent working tree at codification time: 3 modified parent-repo status docs + 1 new handoff file (this codification's scope) + `position.json.snap.20260502T020154Z` untracked carve-out preserved
- Relay working tree: clean (off-scope)
- No `web/` directory exists yet
- **Root-level `package.json` and `package-lock.json` exist, are RESTRICTED per `PROTECTED-FILES.md`, are unrelated to the future web project, and must remain untouched; web dependencies, if ever authorized, live only under `web/package.json` and `web/package-lock.json`.**
- `tools/dashboard-generate.js` sealed at `f5cc97a…` (untouched)
- `orchestrator/DASHBOARD.md` codified at `eb0634f…` (untouched; still reflects parent HEAD `2aef470…` at refresh-run time)
- Both canonical PROJECT-PROGRESS-DASHBOARD handoffs sealed at `f6aaa40…` + `c8798ea…` (untouched)

---

## §13 — Non-authorization preservation clauses

This DOCS-ONLY codification phase pre-authorizes **nothing** downstream. Specifically does NOT authorize:

- Writing any file (including `web/`, any future `web/package.json`, any Astro/Tailwind config)
- Creating `web/` directory
- Installing npm packages
- Running `npm install` / `npm ci` / `npx create-astro` / any other npm command
- Building (`npm run build` / `astro build`)
- Running `astro dev` / `astro preview`
- Deploying anywhere
- Modifying root `package.json` or `package-lock.json` (RESTRICTED)
- Opening any future WEB phase (DESIGN-SPEC-CLOSEOUT, IMPLEMENT-DESIGN, IMPLEMENT-DESIGN-SPEC, SCAFFOLD, CONTENT, etc.)
- Opening `PROJECT-PROGRESS-DASHBOARD-REFRESH-002`, `PROJECT-PROGRESS-DASHBOARD-TESTS-DESIGN`, `PROJECT-PROGRESS-DASHBOARD-JSON-EXPORT`, `COMM-HUB-RELAY-RUNTIME-IMPLEMENT-F-HALT-AMENDMENT`, Phase G, Relay activation, Stage 5 install resumption, Stage 7 dry-run, Stages 8/9/10a/10b, or any Relay runtime deployment
- Regenerating `orchestrator/DASHBOARD.md` or modifying `tools/dashboard-generate.js`
- Reading or modifying `bot.js`, `dashboard.js`, `db.js`, `position.json*`, `.env*`, secrets, Relay repo, Phase C/D/E/F sealed files, memory files, test-suite files, Antigravity config/rules, sealed files, package files, or inherited forbidden-content literals
- Touching Railway/deploy, DB, Discord platform/application/bot/token/permission/webhook/post surfaces, Kraken, env/secrets, manual live-armed flag, trading, DASH-6, D-5.12f, Migration 009+, Autopilot Loop B/C/D, CEILING-PAUSE, external Hermes Agent (Nous/OpenRouter), scheduler, cron, webhook, MCP install, permission widening, or any network lookup

**Codex review verdicts do NOT constitute operator approval.** Per ROLE-HIERARCHY.md and CLAUDE.md: only Victor's in-session chat instruction grants approval.

**Preservation invariants:**
- Migration 008 APPLIED at `189eb1be6ef6304d914671bdaedec44d389cf877` preserved
- N-3 CLOSED preserved
- Stage 5 Gate-10 install approval at `40f3137e842cd60acf1adf17ecc7fe2f0b1b8935` CONSUMED preserved
- CEILING-PAUSE history (broken via `ARC-8-UNPAUSE` at `22ba4a7663e22df64b7cc8e3c0324cbffc0e28f6`; phase-loop counter 0 of 3) preserved
- Relay-runtime DORMANT preserved
- Autopilot DORMANT (verified at `eff4dd22b9b9af038c7ae45de301e60b3f45af98`) preserved
- Approvers exactly `{Victor}` preserved
- Phase A → F Relay-repo chain preserved
- Parent-repo chain through REFRESH-001-CLOSEOUT-SYNC at `85ab274c316fdbb98b850aa7288f574a5302b05a` preserved
- Antigravity chain SHAs preserved: ANTIGRAVITY-MIGRATION-DESIGN-SPEC at `71af035f9a1f7489bfd663e099a15fda7439d0a7`; ANTIGRAVITY-MIGRATION-A-WORKSPACE-CONFIG-DESIGN-SPEC at `d7bb70463beed9c9e3abea84ed9b0682cbaf2255`; ANTIGRAVITY-MIGRATION-A-WORKSPACE-CONFIG-CLOSEOUT at `19db3723e5a046db33bb5880fb95e6f38f23e08a`; ANTIGRAVITY-RULES-DESIGN-SPEC at `9d47f74d87aeed20a2fa7483a3704b494a21eb96`; ANTIGRAVITY-RULES-DESIGN-SPEC-CLOSEOUT-SYNC at `6c41c2c69d7fb4c8d5fda6179829f10e3ffaf9c0` preserved.
- Canonical PROJECT-PROGRESS-DASHBOARD-DESIGN handoff sealed at `f6aaa40…` preserved
- Canonical PROJECT-PROGRESS-DASHBOARD-IMPLEMENT-DESIGN handoff sealed at `c8798ea…` preserved
- Sealed generator `tools/dashboard-generate.js` at `f5cc97a…` preserved
- Refreshed dashboard `orchestrator/DASHBOARD.md` at `eb0634f…` preserved
- Root `package.json` and `package-lock.json` RESTRICTED and untouched preserved
- `position.json.snap.20260502T020154Z` carve-out preserved untracked in parent repo

This DOCS-ONLY codification phase does NOT advance the autopilot phase-loop counter, does NOT install or reconfigure Antigravity, does NOT modify any Phase C/D/E/F sealed file in Relay repo, does NOT modify `bot.js` / `dashboard.js` / `db.js` / migrations / scripts / package files (root or otherwise), does NOT modify the canonical PROJECT-PROGRESS-DASHBOARD handoff records, does NOT modify the sealed generator, does NOT regenerate the dashboard snapshot, does NOT touch the Relay repo, does NOT post anywhere, and does NOT execute any production action. **This web project is entirely separate from the trading runtime `dashboard.js`. It does not modify, replace, or supplement live trading functionality.**

---

## §14 — Next steps (each separately gated; each requires explicit Victor instruction)

1. Codex DOCS-ONLY review of this codification phase (this 4-file scope: 1 new SAFE-class handoff + 3 status-doc updates).
2. Operator commit-only approval naming the 4-file scope, then operator-approved Claude-run commit + push to parent `origin/main`.
3. Three-way SHA consistency PASS verified post-push.
4. Closeout-of-closeout: a future phase records this DESIGN-SPEC as CLOSED at the post-commit HEAD.
5. (Future, separately gated) Operator may open `PROJECT-PROGRESS-DASHBOARD-WEB-IMPLEMENT-DESIGN` (Mode 2 / DESIGN-ONLY) to plan the implementation file-by-file. The implementation cascade then continues through its own DESIGN-SPEC / SCAFFOLD / CONTENT / CLOSEOUT phases per §11.
6. (Future, separately gated) Operator may pursue any item from §10 deferred list as its own separately-gated cascade — or never (some items are NEVER per canonical safety).

Each step requires its own operator decision. This DOCS-ONLY codification phase authorizes none of them.

---

**End of canonical PROJECT-PROGRESS-DASHBOARD-WEB-DESIGN record. The future WEB-DESIGN-SPEC-CLOSEOUT, WEB-IMPLEMENT-DESIGN, WEB-SCAFFOLD, WEB-CONTENT, any maintenance regeneration, Relay-repo scope expansion, test design, smoke tests, deploy, posting, and any production action remain separately gated and are NOT authorized by this DOCS-ONLY codification. This web project is entirely separate from the trading runtime `dashboard.js`. It does not modify, replace, or supplement live trading functionality.**
