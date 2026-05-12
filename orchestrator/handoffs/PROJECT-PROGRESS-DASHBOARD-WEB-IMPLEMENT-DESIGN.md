# PROJECT-PROGRESS-DASHBOARD-WEB-IMPLEMENT-DESIGN

**Phase classification:** SAFE-class handoff (this codification phase is DOCS-ONLY / Mode 3; the codified content is the Mode 2 / DESIGN-ONLY conversation-only v4 implementation design).

**Source-design phase:** PROJECT-PROGRESS-DASHBOARD-WEB-IMPLEMENT-DESIGN (Mode 2 / DESIGN-ONLY; conversation-only; v4 Codex-clean).

**Source-design root reference:** `orchestrator/handoffs/PROJECT-PROGRESS-DASHBOARD-WEB-DESIGN.md` sealed at parent-repo `1b49fc30737ea96ec8d2dbf923c5467eb33b8149`.

**Parent-repo HEAD at codification time:** `abb48531da8e1c073494f73190b4188ec6285bfe`.

**Relay-repo HEAD:** `b8ab035034668fd53ea6efe64432f0868dfd2eb9` (off-scope; unchanged).

**Codification scope:** 4 parent-repo files (this new SAFE-class handoff + 3 status-doc updates `orchestrator/STATUS.md`, `orchestrator/CHECKLIST.md`, `orchestrator/NEXT-ACTION.md`).

---

## Codex DESIGN-ONLY review history (source design phase, conversation-only v1 → v4)

- **Round 1:** PASS WITH REQUIRED EDITS — 13 REs across v1 (verifiability framing; SCAFFOLD constraints; npm sequencing replacement; isolation-layer enumeration + parser purity + no `child_process`; Antigravity verbatim rule; first-scaffold + CONTENT goal additions; vendored fonts deferred; Tailwind adapter gate; neutralized credential literals; build-time SHA injection removed; CONTENT sub-scope table; verification-evidence rules; verifiability tags). All 13 REs applied verbatim in v2.
- **Round 2 (re-dispatched with full v2 embedded inline after initial mis-targeting against the sealed WEB-DESIGN handoff):** PASS WITH REQUIRED EDITS — 1 residual RE (RE-2 internal inconsistency between §11 hero paraphrase and §13 SCAFFOLD Goal 18 requiring verbatim canonical disclaimer in both footer AND hero). 12 of 13 REs landed cleanly; the residual fixed in v3.
- **Round 3:** PASS WITH REQUIRED EDITS — 2 procedural/evidentiary REs (RE-3a: hoist explicit `system-ui` / `ui-monospace` font-stack statement into §11 opening for scan visibility; RE-3b: §18 cannot prove "no Relay touch" from parent-repo git state alone — drop the parent-repo-only Relay claim from auditable evidence; non-authorization clause in §17 retained). Both REs applied verbatim in v4.
- **Round 4:** **PASS** — all 15 narrow goals; no required edits. v4 Codex-clean.

---

## §0 — Verifiability framing

**The file counts, LOC counts, dependency pins, checklist item counts, and scope totals in this design are design *targets* — not yet verified facts.**

- They are commitments that **future Codex SCAFFOLD and CONTENT reviews must confirm against actual file state** at each respective Mode 4 phase.
- Every numeric claim is a target; future Codex reviews diff against git state (`git status --short` / `find web -type f -not -path 'web/node_modules/*'` / `cat web/package-lock.json` / similar) per §18 evidence rules.
- This v4 design is **not** the lock; the future SCAFFOLD/CONTENT phases are.
- Codex review verdicts at this DESIGN-SPEC codification stage do NOT constitute operator approval. Only Victor's in-session chat instruction grants approval.

---

## §1 — Phase classification

- **Future implementation-design source phase:** PROJECT-PROGRESS-DASHBOARD-WEB-IMPLEMENT-DESIGN
- **Mode of the source design:** DESIGN-ONLY / Mode 2 (conversation-only; v4 Codex-clean)
- **Mode of this codification phase (PROJECT-PROGRESS-DASHBOARD-WEB-IMPLEMENT-DESIGN-SPEC):** DOCS-ONLY / Mode 3
- **Authority bounded by:** WEB-DESIGN spec §1-§14 (sealed at `1b49fc30737ea96ec8d2dbf923c5467eb33b8149`)
- **Pre-authorizes nothing.** No file creation, no install, no scaffolding action.

---

## §2 — Future WEB-SCAFFOLD file scope (Mode 4 SAFE IMPLEMENTATION; separately gated)

> **Verifiability tag:** the 14-file count, ~250 LOC target, and per-file purpose claims below are design targets for SCAFFOLD. The future Codex SCAFFOLD review must confirm actual counts from git state (`git status --short`, `find web -type f -not -path 'web/node_modules/*' -not -path 'web/dist/*'`) at the SCAFFOLD post-edit / pre-commit moment.

WEB-SCAFFOLD is the first Mode 4 phase. Its scope is the bare minimum to make `npm run dev` (operator-run only) render an empty futuristic-theme shell.

**Explicit SCAFFOLD constraints (first-screen + visual contract):**

- **No real data.** Zero values read from `orchestrator/DASHBOARD.md` at SCAFFOLD.
- **No parser.** The DASHBOARD.md parser does not exist yet at SCAFFOLD.
- **No runtime controls.** No buttons, no forms, no inputs.
- **No DASHBOARD.md content.** No phase names, no SHAs, no safety-gate values displayed.
- **No fake phase data.** No skeleton placeholders styled to look like real phases or SHAs. No `Lorem ipsum`. No "Example Phase 1 / 2 / 3" labels.
- **First-screen disclaimer copy must be present.** Canonical disclaimer verbatim in BaseLayout footer per §13 Goal 18; hero may contain the shorter paraphrase-style callout per §11.
- **Hero copy is explicit "scaffold ready" framing.** Heading "Project Progress Dashboard"; subheading "v1 — scaffold; content pending future phase."

**Proposed SCAFFOLD file list (~14 files inside `web/`; design target):**

| Path | Purpose | Class |
|---|---|---|
| `web/.gitignore` | Ignore `node_modules/`, `dist/`, `.astro/` cache | SCAFFOLD |
| `web/package.json` | Isolated manifest; ≤ 5 deps; `"private": true`; no workspaces; exact pins | SCAFFOLD |
| `web/package-lock.json` | Created by operator-run first install; `"lockfileVersion": 3`; integrity hashes | SCAFFOLD |
| `web/astro.config.mjs` | `output: 'static'`; no SSR adapter; no API routes; no middleware | SCAFFOLD |
| `web/tailwind.config.mjs` | Theme tokens; font families = `system-ui` + `ui-monospace`; safelist for dynamic-class names | SCAFFOLD |
| `web/postcss.config.mjs` | Tailwind + autoprefixer | SCAFFOLD |
| `web/tsconfig.json` | `extends: 'astro/tsconfigs/strict'` | SCAFFOLD |
| `web/src/styles/global.css` | `@tailwind` directives; CSS custom-prop tokens; `prefers-reduced-motion` + `prefers-color-scheme` rules | SCAFFOLD |
| `web/src/styles/theme.css` | Glass-morphism + neon-glow utility classes (extracted; not inline) | SCAFFOLD |
| `web/src/layouts/BaseLayout.astro` | Semantic landmarks; skip-link; footer disclaimer (canonical verbatim); no analytics; no external scripts | SCAFFOLD |
| `web/src/pages/index.astro` | Empty futuristic shell — header + hero placeholder + footer disclaimer; no sections wired; no parser invocation | SCAFFOLD |
| `web/public/favicon.svg` | Inline vector glyph; vendored only; no external URL | SCAFFOLD |
| `web/public/.gitkeep` | Reserve public dir; no font files vendored at v1 | SCAFFOLD |
| `web/README.md` | Local-only build instructions; "not the trading dashboard" disclaimer; system-ui/ui-monospace note; canonical separation sentence | SCAFFOLD |

**Approximate SCAFFOLD line count:** ~250 LOC across all files (excludes lockfile + `node_modules`). Design target only — see §0 + §18.

---

## §3 — Future WEB-CONTENT file scope (Mode 4 SAFE IMPLEMENTATION; separately gated)

> **Verifiability tag:** the 28-file count and ~1,200-1,800 LOC range are design targets. Future Codex CONTENT review must confirm actual counts from `git status --short` and `find web/src -type f` post-edit / pre-commit.

**CONTENT sub-scope table:**

| Group | Files (target) | Purpose | Notes |
|---|---|---|---|
| Parser / data layer | 5 | Pure functions; types; single allowlisted fs read | §8 purity rules apply |
| Section components | 12 | One Astro component per WEB-DESIGN §5 section | Mirror canonical section list |
| Shared UI primitives | 6 | `Card`, `Pill`, `SHAChip`, `Section`, `Disclaimer`, `Icon` | Visual-only; no data side effects |
| CSS / theme files | 2 | Animation rules + theme extensions | Animations gated behind `prefers-reduced-motion: no-preference` |
| **Subtotal v1 CONTENT** | **~25** | | |
| Vendored fonts | 0 | **Deferred to a future phase** | v1 uses `system-ui` / `ui-monospace` |
| Optional animations beyond pulse-glow + fade-in | 0 | **Deferred** | Only two core animations land in v1 |
| Tests / fixtures | 0 | **Deferred to a future `PROJECT-PROGRESS-DASHBOARD-WEB-TESTS-DESIGN`** | Not in v1 |
| Build-time SHA injection | 0 | **REMOVED (not deferred — explicitly forbidden under current design contract)** | DASHBOARD.md is the data source; no `child_process` in any web code |
| **Total v1 CONTENT files** | **~25-28** | (range reflects parser-helper file granularity at SCAFFOLD/CONTENT review judgment) | |

**Explicit removals from earlier drafts (preserved in v4):**

- Vendored font files (e.g., `JetBrainsMono-Regular.woff2`, `Inter-Regular.woff2`) are deferred to a separately justified future phase.
- `web/src/lib/build-info.ts` + `git rev-parse HEAD` pre-build script are forbidden at v1 (no `child_process` in any web code).

---

## §4 — Astro/Tailwind dependency plan (SCAFFOLD only)

**Tailwind adapter review gate:**

> *The Astro Tailwind adapter (`@astrojs/tailwind`) must be justified at SCAFFOLD Codex review. If a plain Tailwind + PostCSS setup achieves the same result with fewer dependencies, the adapter is dropped.*

**Minimum dep set if adapter retained (proposed; ≤ 5 deps; pending SCAFFOLD justification):**

```json
{
  "name": "agent-avila-web",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "astro build",
    "preview": "astro preview"
  },
  "dependencies": {
    "astro": "X.Y.Z (exact pin; resolved at SCAFFOLD)",
    "@astrojs/tailwind": "X.Y.Z (exact pin; subject to adapter justification)",
    "tailwindcss": "X.Y.Z (exact pin)",
    "autoprefixer": "X.Y.Z (exact pin)",
    "postcss": "X.Y.Z (exact pin)"
  }
}
```

**Minimum dep set if adapter dropped (plain Tailwind + PostCSS):**

```json
{
  "dependencies": {
    "astro": "X.Y.Z",
    "tailwindcss": "X.Y.Z",
    "autoprefixer": "X.Y.Z",
    "postcss": "X.Y.Z"
  }
}
```

(`@astrojs/tailwind` removed; Tailwind invoked via `postcss.config.mjs` instead.)

**Excluded from v1:** no `@astrojs/node` / `@astrojs/vercel` / `@astrojs/cloudflare` / `@astrojs/netlify`; no `@astrojs/markdown-remark` (we parse DASHBOARD.md ourselves); no React/Vue/Svelte integration; no `astro-icon`; no `astro-seo`; no analytics; no service-worker; no `workbox-*`; no `vitest`/`playwright`/`@testing-library/*` at v1; no `dotenv`; no `fs-extra`; no `glob`; no `node-fetch`/`axios`; no `simple-git`.

**Exact patch-level versions deferred to operator-run version-resolution at SCAFFOLD.**

---

## §5 — Version pinning + lockfile integrity

**Sequencing language (verbatim):**

> *SCAFFOLD may create the isolated `web/` manifest and lockfile only after explicit phase authorization. The first install creates the lockfile. All subsequent builds in SCAFFOLD and beyond use `npm ci` only. Root package files and workspace fields remain untouched. Lockfile integrity is reviewed before any build proceeds.*

**Pinning + integrity rules:**

1. Every `web/package.json` `dependencies` entry uses exact pin — no `^`/`~`/range.
2. `web/package-lock.json` is committed to git with `"lockfileVersion": 3` and integrity hashes for every transitive node.
3. First operator-run install at SCAFFOLD creates the lockfile (the only time `npm install` is permitted in the web cascade); thereafter every build is `npm ci` only.
4. Each future dependency change is its own Mode 4 phase with its own Codex review.
5. No `.npmrc` disabling integrity (`package-lock=false`, `legacy-peer-deps=true`, `--no-package-lock`, etc.) anywhere in the tree.
6. No Renovate / Dependabot / Snyk-bot / any dep-update bot installed.
7. No `npm audit fix --force`.
8. Lockfile integrity is reviewed by Codex before any build proceeds — at SCAFFOLD post-edit / pre-commit, and at every subsequent dep-change phase.

**Workspace boundary (canonical):** root `package.json` does NOT add `"workspaces": ["web"]`. Codex SCAFFOLD review verifies `git diff -- package.json package-lock.json` returns empty at every relevant moment.

---

## §6 — Antigravity policy

**Antigravity rule (verbatim):**

> *Antigravity may not assist SCAFFOLD at all. For CONTENT, Antigravity is permitted only for visual polish in component files. Antigravity must never edit parser, data-layer, config, or package files, and must never commit or push.*

**Allowed Antigravity surface (CONTENT only, visual polish only):**

- `web/src/components/*.astro` (visual structure)
- `web/src/styles/*.css` (Tailwind utility iteration; animation tuning)
- `web/src/layouts/BaseLayout.astro` — visual polish only; never the disclaimer text
- `web/public/favicon.svg` (visual only)

**Forbidden Antigravity surface (always):**

- `web/src/lib/*.ts` (parser / loader / types — correctness-critical)
- `web/astro.config.mjs`, `web/tailwind.config.mjs`, `web/postcss.config.mjs`, `web/tsconfig.json` (config surface)
- `web/package.json`, `web/package-lock.json` (dependency surface)
- `web/README.md` (disclaimer canonical)
- Any file outside `web/`

**Antigravity invocation rules:** operator-initiated only; every edit batch reviewed as Mode 4; Antigravity has no commit/push authority; workspace bounded to `web/` only; Antigravity may never edit at SCAFFOLD.

See §15 for the Antigravity safety prompt template.

---

## §7 — web/ isolation mechanisms (8 layers)

1. **Directory boundary.** `web/` is a sibling of `bot.js`, `dashboard.js`, `tools/`, `orchestrator/`. Its own `package.json`, own `package-lock.json`, own `node_modules/`, own build output (`dist/`).
2. **Distinct `node_modules` trees.** Root `node_modules/` and `web/node_modules/` never share installs.
3. **No workspace declaration.** Root `package.json` MUST NOT contain `"workspaces": ["web"]` (or any workspaces entry). Codex SCAFFOLD/CONTENT reviews verify by `git diff -- package.json`.
4. **No symlinks.** `web/` contains no symlinks pointing into root files. No symlinked `node_modules`. No `file:` references to root packages.
5. **Distinct lockfiles.** `package-lock.json` (root) and `web/package-lock.json` are independent.
6. **gitignore isolation.** `web/.gitignore` ignores `web/node_modules/`, `web/dist/`, `web/.astro/`. Root `.gitignore` is untouched.
7. **Code-import boundary.** `web/src/**` imports only from `web/src/**`, `web/node_modules/**`, and (in CONTENT) the single allowlisted fs read of `orchestrator/DASHBOARD.md`. No `import` from `bot.js`, `dashboard.js`, `db.js`, `tools/*`, `migrations/*`, `scripts/*`, Relay-repo paths, memory files, or sealed-file paths.
8. **No process/env/network coupling.** No `process.env.*` reads in `web/src/**`; no `child_process` / `spawn` / `exec*` calls anywhere in `web/`; no `fetch` / `http.get` / external URL fetch at build or runtime; no DNS resolution at build.

---

## §8 — DASHBOARD.md build-time read model

**Build-time only. No runtime fs. Flow:**

```
operator runs `npm ci && npm run build` inside web/   →
  astro invokes index.astro frontmatter                →
    load-dashboard.ts calls fs.readFileSync('../orchestrator/DASHBOARD.md')
                                                      →
      dashboard-parser.ts parses string → typed DashboardData
                                                      →
        Astro static-renders 12 sections into web/dist/index.html
                                                      →
          static html shipped to disk; no runtime fs, no runtime network.
```

**Safety constraints on the read:**

1. Single allowlisted source path (hardcoded constant in `load-dashboard.ts`); no env-var override; no CLI flag; no relative path from user input; no glob.
2. Synchronous, fail-loud (`fs.readFileSync` only; missing file → typed `DashboardLoadError` thrown; build fails; never silent-defaults).
3. No `fs.readdirSync`, no `fs.stat`, no `fs.access`, no `fs.watch`.
4. No HTTP/DNS/TLS/WebSocket. No `fetch`/`node-fetch`/`axios`/`got`. No `https.get`. Astro static build never opens a socket.
5. No shell. No `child_process.execSync`; no `spawn`; no `git rev-parse HEAD` at build. Parser is pure JS string processing.
6. **Parser purity:** no `fs.*` calls in any parser function; no `child_process` / shell calls in any parser function; no network calls in any parser function; **no `Date.now()`, no `new Date()`, no system-time reads** — build is deterministic; **no `Math.random()`, no `crypto.randomUUID()`, no other randomness.**
7. Schema validation: parser validates the markdown structure; missing section → typed `DashboardParseError` with location; build fails (fail-loud).
8. Single source of `fs`: `load-dashboard.ts` is the only file in `web/src/**` that may call `fs.*`.
9. Never reads anything else from `orchestrator/` (specifically NOT `STATUS.md`, NOT `CHECKLIST.md`, NOT `NEXT-ACTION.md`, NOT any `handoffs/*.md`, NOT any sealed-file content).
10. The DASHBOARD.md format is the contract. Schema changes go through their own phase with Codex review.

---

## §9 — Forbidden-file protection enforcement (8 layers)

1. **Code-import boundary (Codex enforcement).** Every `web/src/**` import statement reviewed.
2. **fs path allowlist.** `load-dashboard.ts` is the only file with `fs.readFileSync`. Path hardcoded.
3. **No `process.env` reads in `web/src/**`.** Codex grep at every web phase.
4. **No `child_process` in any web code.** No `execSync` / `spawn` / `exec` / `execFile` / `fork` anywhere in `web/src/**`, `web/scripts/**` (the latter directory must not exist at v1), or `web/*.mjs` config files.
5. **No build-time shell SHA injection.** No `git rev-parse HEAD` at build. No pre-build script that shells out. If a build SHA is wanted in the UI, it is read from a build-time literal manually pasted by the operator at SCAFFOLD/CONTENT review.
6. **No glob across repo.** Parser does not list directories; no recursive scan.
7. **Astro static output.** `output: 'static'` in `astro.config.mjs`. No SSR adapter. No `web/src/pages/api/`. No `web/src/middleware.ts`.
8. **No client-side network.** No `<script src="https://...">`, no CDN, no external font load (`@import url('https://...')` forbidden), no analytics, no telemetry beacon, no `navigator.sendBeacon`, no `WebSocket`, no `EventSource`. All assets vendored under `web/public/`.

**Forbidden-literal scan (prose neutral; exact patterns reserved for Codex prompt criteria):** Codex review at every WEB phase scans `+`-lines for: the live-arming flag literal; the Discord platform token env var literal; the exchange API credential prefix env vars (e.g., the canonical Kraken family); the platform token env vars (the GitHub token, the Railway token); the model-provider credential env vars (the OpenAI / Anthropic / Google / Gemini credential families). None of these literals should appear in any `web/` source file. The descriptors here are the prose form; exact patterns live only in narrowly scoped forbidden-scan criteria lists inside the Codex review prompt.

---

## §10 — Enforce no backend / no SSR / no deploy / no network

**Static-only enforcement at five layers:**

1. `astro.config.mjs`: `output: 'static'` — never `'server'`, never `'hybrid'`.
2. No SSR adapter (`@astrojs/node`/`vercel`/`cloudflare`/`netlify` absent from `web/package.json`).
3. No API routes (`web/src/pages/api/` must not exist).
4. No middleware (`web/src/middleware.ts` must not exist).
5. No deploy config (no `vercel.json`, no `netlify.toml`, no `wrangler.toml`, no `Dockerfile`, no `.github/workflows/*.yml` for deploy, no `docker-compose.yml`).

**No network calls (build-time):** no `fetch()` in any `.astro` frontmatter; no `import 'node-fetch'`, `import 'axios'`, etc.; no DNS at build.

**No network calls (client-side / runtime in browser):** no `<script src="https://...">`; no `<link href="https://fonts.googleapis.com/...">`; no service worker (`web/public/sw.js` forbidden); no `Workbox`, no PWA manifest with background sync; no analytics — no Google Analytics, no Plausible, no Fathom, no Mixpanel; no telemetry beacons.

**Build-output verification:** Codex SCAFFOLD/CONTENT review spot-checks `web/dist/` and greps for `https://` — only allowed `https://` reference would be inside the trading-isolation disclaimer (not a fetched resource); ideally none.

**Deploy posture.** Operator-run `npm run build` produces `web/dist/` on the operator's machine. No `npm run deploy`. No deploy script at v1. If/when operator wants to deploy, that's a separately gated Mode 5 HIGH-RISK IMPLEMENTATION phase.

---

## §11 — First scaffold visual design

**v1 uses `system-ui` and `ui-monospace` font stacks; vendored fonts are deferred to a separately justified future phase.**

**Visual surface at SCAFFOLD landing:**

- **Page:** Full-viewport dark canvas; single hero panel; no scroll yet
- **Background:** Subtle radial gradient; optional faint hex-grid CSS overlay; no image asset; no external URL
- **Header:**
  - Top-left: "AGENT AVILA / PROGRESS CONSOLE" in `ui-monospace`
  - Top-right: pill "STATUS: SCAFFOLD READY" with cyan glow — explicitly NOT "STATUS: ACTIVE" or "STATUS: HEALTHY"; the literal text "SCAFFOLD READY" prevents any read as live system telemetry
  - Thin neon divider line below header (1px, cyan-to-violet gradient)
- **Hero panel:**
  - Centered glass-morphism card
  - Heading in `system-ui`: "Project Progress Dashboard"
  - Subheading in `ui-monospace`: "v1 — scaffold; content pending future phase"
  - One muted disclaimer paragraph (paraphrase-style callout — NOT the canonical disclaimer; the canonical version lives verbatim in the footer per §13 Goal 18):
    > "This dashboard summarizes orchestrator state at build time. It is entirely separate from the trading runtime. Do not infer trading state from this UI."
  - No fake data. No skeleton placeholders styled to look like real phases. No `Lorem ipsum`. No "Example Phase 1 / 2 / 3" labels.
  - No runtime controls. Zero buttons, zero forms, zero inputs.
- **Footer:**
  - Pinned to bottom; thin divider above
  - Two small muted lines:
    1. "Generated locally · no network · no deploy · no trading"
    2. **Canonical verbatim:** "This web project is entirely separate from the trading runtime `dashboard.js`. It does not modify, replace, or supplement live trading functionality."
- **Motion:** Only one pulse on the status pill (1.2s cubic-bezier, infinite); gated behind `@media (prefers-reduced-motion: no-preference)`
- **Fonts:**
  - `system-ui, -apple-system, "Segoe UI", Roboto, sans-serif` for body
  - `ui-monospace, "SF Mono", Menlo, Consolas, monospace` for code-like text
  - No vendored font files at v1.
- **Accessibility:**
  - Skip-link "Skip to main content" hidden until focused
  - All colour combinations WCAG AA contrast verified
  - `:focus-visible` rings on interactive elements (the only interactive element at SCAFFOLD is the skip-link)
  - `html[lang="en"]`, `<meta name="viewport">`, semantic landmarks (`<header>`, `<main>`, `<footer>`)

**What SCAFFOLD does NOT show:** no phase list, no SHA, no safety gates, no phase timeline, no backlog filter, no DASHBOARD.md content, no parser invocation, no runtime control, no fake data.

---

## §12 — Future cascade (each separately gated)

From WEB-DESIGN §11 sealed at `1b49fc3…`:

1. PROJECT-PROGRESS-DASHBOARD-WEB-IMPLEMENT-DESIGN (Mode 2; conversation-only v4 source)
2. **PROJECT-PROGRESS-DASHBOARD-WEB-IMPLEMENT-DESIGN-SPEC** ← current (Mode 3; this codification)
3. PROJECT-PROGRESS-DASHBOARD-WEB-IMPLEMENT-DESIGN-SPEC-CLOSEOUT (Mode 3)
4. PROJECT-PROGRESS-DASHBOARD-WEB-IMPLEMENT-DESIGN-SPEC-CLOSEOUT-SYNC (Mode 3)
5. PROJECT-PROGRESS-DASHBOARD-WEB-SCAFFOLD (Mode 4 SAFE IMPLEMENTATION)
6. PROJECT-PROGRESS-DASHBOARD-WEB-SCAFFOLD-CLOSEOUT (Mode 3)
7. PROJECT-PROGRESS-DASHBOARD-WEB-SCAFFOLD-CLOSEOUT-SYNC (Mode 3)
8. PROJECT-PROGRESS-DASHBOARD-WEB-CONTENT (Mode 4 SAFE IMPLEMENTATION)
9. PROJECT-PROGRESS-DASHBOARD-WEB-CONTENT-CLOSEOUT (Mode 3)
10. PROJECT-PROGRESS-DASHBOARD-WEB-CONTENT-CLOSEOUT-SYNC (Mode 3)

Each step requires its own Codex review + explicit Victor approval. This DESIGN-SPEC codification phase authorizes none of them.

---

## §13 — Codex review checklist for future WEB-SCAFFOLD (Mode 4 SAFE IMPLEMENTATION)

> **Verifiability tag:** the goal count below (~25 goals) is a design target. The future SCAFFOLD Codex review prompt may add or refine goals. Counts are confirmed at SCAFFOLD review against git-state / package-lock / web-dir evidence (§18).

1. Phase classification (Mode 4 SAFE IMPLEMENTATION) — correct against PHASE-MODES.md.
2. Scope = exactly the SCAFFOLD file list in §2 (~14 files); confirmed by `git status --short` and `find web -type f -not -path 'web/node_modules/*' -not -path 'web/dist/*'`; no extra files.
3. `web/package.json` contains only ≤ 5 allowed deps (astro, optional `@astrojs/tailwind`, tailwindcss, autoprefixer, postcss); no React/Vue/Svelte; no adapter; no analytics; no test deps; Tailwind adapter justified or dropped per §4 review gate.
4. All deps use exact version pins (no `^`/`~`/ranges); `web/package-lock.json` present with `"lockfileVersion": 3` and integrity hashes (§5 sequencing — first install creates lockfile; all subsequent builds use `npm ci`).
5. Lockfile integrity reviewed before any build proceeds (§5).
6. No `.npmrc` disabling integrity (`package-lock=false`, `legacy-peer-deps=true`, etc.).
7. `web/astro.config.mjs` has `output: 'static'`; no SSR adapter; no API routes; no middleware.
8. No `web/src/pages/api/` directory; no `web/src/middleware.ts`.
9. No deploy config (`vercel.json`, `netlify.toml`, `wrangler.toml`, `Dockerfile`, `.github/workflows/*.yml`, `docker-compose.yml`).
10. No service worker (`web/public/sw.js` absent).
11. No external URL in any source file (no CDN, no Google Fonts, no analytics, no telemetry, no `<script src=>` external).
12. No `process.env.*` reads in any `web/src/**` file.
13. No `child_process` / `spawn` / `exec*` calls in any `web/src/**` or `web/*.mjs` config file.
14. No `fs.*` calls in any `web/src/**` file at SCAFFOLD (parser/loader land in CONTENT, not SCAFFOLD).
15. No build-time shell SHA injection — no pre-build script invoking `git`.
16. No imports across boundary into root tree (`bot.js`, `dashboard.js`, `db.js`, `tools/*`, etc.).
17. No real data, no parser, no runtime controls, no DASHBOARD.md content, no fake phase data displayed.
18. **Canonical trading-isolation disclaimer is present verbatim in the BaseLayout footer. The hero panel may contain the shorter paraphrase-style callout from §11, but must not claim to be the canonical disclaimer and must not imply trading status, trading control, runtime health, or live system telemetry.**
19. Fonts: `system-ui` + `ui-monospace` stacks only; no vendored font files at v1.
20. Forbidden-literal scan on `+`-lines (prose neutral, scan exact): no live-arming flag literal; no platform token env var literal; no exchange API credential prefix env vars; no model-provider credential env vars; no GitHub/Railway token env vars.
21. `web/README.md` contains explicit local-only-no-deploy-no-network framing and the canonical trading-isolation disclaimer.
22. Root `package.json` and root `package-lock.json` working-tree diff is empty (RESTRICTED untouched; `git diff -- package.json package-lock.json` returns empty).
23. No `workspaces` declaration in root `package.json` (§7 layer 3).
24. `tools/dashboard-generate.js` and `orchestrator/DASHBOARD.md` working-tree diff is empty (sealed untouched).
25. Three-way SHA consistency post-push (local HEAD = origin/main = live remote main).

---

## §14 — Codex review checklist for future WEB-CONTENT (Mode 4 SAFE IMPLEMENTATION)

> **Verifiability tag:** the goal count below (~28 goals) is a design target.

1. Phase classification (Mode 4 SAFE IMPLEMENTATION).
2. Scope = exactly the CONTENT file list in §3 sub-scope table (~25-28 new files); confirmed by `git status --short`.
3. No new npm dependencies introduced (deps identical to SCAFFOLD-landed `web/package.json`).
4. **Parser purity:** `dashboard-parser.ts` has no `fs.*`, no `child_process`, no network, no `Date.now()` / `new Date()`, no `Math.random()` / `crypto.randomUUID()`.
5. `load-dashboard.ts` is the only file with `fs.readFileSync`; reads exactly one hardcoded path; no env-var-driven path, no glob, no `readdirSync`, no `stat`, no `watch`.
6. **Fail-loud parsing:** parser throws `DashboardLoadError` / `DashboardParseError` on missing file or malformed structure; build fails; never silent-defaults.
7. **No runtime `fs`:** all `fs` calls are build-time only; client bundle contains zero `fs` references — Codex greps build output.
8. **No runtime network:** client bundle contains zero `fetch` / `XMLHttpRequest` / `WebSocket` / `EventSource` / `navigator.sendBeacon` references.
9. **No fake data:** every rendered value traces back to DASHBOARD.md via parser; no hardcoded placeholder phase/SHA/gate text.
10. **Bundle / static-output scanning:** `web/dist/` contents grepped for `https://` (only inside disclaimer); for forbidden-literal patterns; for any `fs.` / `child_process` / `process.env` token in the bundled JS.
11. Section components mirror WEB-DESIGN §5 (12 sections; correct identifiers; correct ordering).
12. Trading-runtime disclaimer present verbatim on every page footer.
13. `bot.js` and `dashboard.js` correctly labelled "OFF-SCOPE / NOT ASSESSED BY THIS DASHBOARD" in the Dormant-vs-Active section.
14. No client-side `fetch` in any island component.
15. No `<script>` tag pointing at any external URL.
16. No external font load (`@import url('https://...')` absent); fonts remain `system-ui` / `ui-monospace` (vendored fonts still deferred).
17. No analytics scripts; no Sentry/Datadog/etc.
18. Forbidden-literal scan on `+`-lines (prose neutral, scan exact).
19. No imports across boundary into root tree.
20. No `process.env.*` reads in `web/src/**`.
21. No `child_process` calls anywhere in `web/` — Codex greps `web/**` for the token.
22. No build-time shell SHA injection — no `git rev-parse`, no pre-build shell script.
23. `prefers-reduced-motion` respected on all animations (pulse-glow + fade-in).
24. WCAG AA contrast verified on the cyan/violet/emerald/amber/coral palette.
25. Keyboard navigation works (skip-link, focus-visible rings, tab order through 12 sections).
26. `astro.config.mjs` still `output: 'static'`; no adapter introduced.
27. Root `package.json` + `package-lock.json` working-tree diff is empty.
28. Three-way SHA consistency post-push.

---

## §15 — Antigravity safety prompt template

To be codified into a future Antigravity-rules update phase if/when Antigravity is enlisted for CONTENT visual polish:

```
You are editing visual styling and Astro component structure inside web/ only.
This is a CONTENT-phase visual-polish task.

ABSOLUTE RULE (verbatim):
  "Antigravity may not assist SCAFFOLD at all. For CONTENT, Antigravity is
   permitted only for visual polish in component files. Antigravity must
   never edit parser, data-layer, config, or package files, and must never
   commit or push."

ABSOLUTE BOUNDARIES — never cross:
- Edit ONLY files inside:
    web/src/components/*.astro
    web/src/styles/*.css
    web/src/layouts/BaseLayout.astro  (visual polish only — NEVER the disclaimer text)
    web/public/favicon.svg            (visual only)
- NEVER edit:
    web/src/lib/*.ts                  (parser / loader / types)
    web/astro.config.mjs
    web/tailwind.config.mjs
    web/postcss.config.mjs
    web/tsconfig.json
    web/package.json
    web/package-lock.json
    web/README.md
- NEVER touch anything outside web/  (root tree, orchestrator/, tools/,
    runtime files, env, secrets, Relay repo, memory files, test files,
    sealed handoffs, canonical specs, position.json*, root package files,
    Antigravity config itself).
- NEVER introduce external URLs (no CDN, no Google Fonts, no analytics, no telemetry).
- NEVER introduce process.env reads.
- NEVER introduce fs / child_process / network calls.
- NEVER introduce service workers, PWA manifests, or background sync.
- NEVER remove or modify the canonical trading-isolation disclaimer.

WHAT YOU MAY DO:
- Iterate Tailwind class combinations on existing components.
- Tune animation timing inside web/src/styles/animations.css
  (animations remain gated behind @media (prefers-reduced-motion: no-preference)).
- Adjust glass-morphism opacity, border colours, blur radius in web/src/styles/theme.css.
- Refine spacing, typography scale, responsive breakpoints.
- Improve focus-visible ring styling.

WHAT YOU MUST PRESERVE:
- WCAG AA contrast on every colour combination.
- Reduced-motion compliance.
- Keyboard accessibility.
- Section ordering and section ids (defined in web/src/lib/constants.ts — read-only to you).
- Canonical trading-isolation disclaimer text.
- Output: every change still builds to static HTML via `astro build`.
- No new dependencies in package.json.

AFTER EDITING:
- Stop. Do NOT stage, commit, or push.
- Report a single diff to the operator for Codex review.
- Antigravity has no commit or push authority.
```

Codifying this prompt into `orchestrator/ANTIGRAVITY-RULES.md` (or a sibling) is its own future phase, separately gated.

---

## §16 — Deferred beyond v1

Out of scope for v1 SCAFFOLD + CONTENT; each requires its own future cascade:

1. Live update / hot reload from disk (future `PROJECT-PROGRESS-DASHBOARD-WEB-WATCH-DESIGN`)
2. JSON export (future `PROJECT-PROGRESS-DASHBOARD-JSON-EXPORT`)
3. Multi-page site (phase-detail pages, handoff browser, SHA-anchored permalinks)
4. Search
5. Dark/light toggle (`prefers-color-scheme` is honoured automatically; no user toggle)
6. i18n (English only)
7. Tests (future `PROJECT-PROGRESS-DASHBOARD-WEB-TESTS-DESIGN`)
8. Visual regression (Chromatic / Percy)
9. CI for the web build (operator-run only at v1)
10. Deploy (separately gated Mode 5 HIGH-RISK IMPLEMENTATION phase)
11. Auth (N/A — local-only)
12. Service worker / PWA (forbidden at v1)
13. Web analytics (forbidden at v1 and likely forever)
14. Sentry / error reporting (forbidden at v1)
15. WebSocket / SSE (N/A — no backend)
16. Discord embed (forbidden)
17. Trading-data embed (forbidden forever — canonical separation invariant)
18. External Hermes Agent integration (N/A; out of scope)
19. Antigravity for parser / data / config / package files (forbidden per §6)
20. Workspaces declaration in root `package.json` (forbidden forever per §7 layer 3)
21. Vendored font files (deferred to separately justified future phase)
22. Build-time shell SHA injection (EXPLICITLY FORBIDDEN — not merely deferred — under current design contract)

---

## §17 — Non-authorization preservation

This DOCS-ONLY codification phase pre-authorizes nothing. Does NOT authorize:

- Opening `PROJECT-PROGRESS-DASHBOARD-WEB-IMPLEMENT-DESIGN-SPEC-CLOSEOUT`
- Opening `PROJECT-PROGRESS-DASHBOARD-WEB-SCAFFOLD` or any subsequent WEB phase (SCAFFOLD-CLOSEOUT, CONTENT, etc.)
- Creating `web/` directory
- Installing npm packages (`npm install` / `npm ci` / `npx`)
- Running `astro dev` / `astro preview` / `astro build`
- Building, deploying anywhere
- Modifying root `package.json` or `package-lock.json`
- Modifying the WEB-DESIGN handoff sealed at `1b49fc3…`
- Modifying the canonical PROJECT-PROGRESS-DASHBOARD handoffs at `f6aaa40…` or `c8798ea…`
- Regenerating `orchestrator/DASHBOARD.md` or modifying `tools/dashboard-generate.js`
- Reading or modifying `bot.js`, `dashboard.js`, `db.js`, `position.json*`, `.env*`, secrets, Relay repo, Phase C/D/E/F sealed files, memory files, test-suite files, Antigravity config / rules, sealed files, package files, inherited forbidden-content literals
- Opening `PROJECT-PROGRESS-DASHBOARD-REFRESH-002`, `PROJECT-PROGRESS-DASHBOARD-TESTS-DESIGN`, `PROJECT-PROGRESS-DASHBOARD-JSON-EXPORT`, `COMM-HUB-RELAY-RUNTIME-IMPLEMENT-F-HALT-AMENDMENT`, Phase G, Relay activation, Stage 5 install resumption, Stage 7 dry-run, Stages 8/9/10a/10b
- Touching Railway / deploy / DB / Discord platform / Kraken / env / secrets / the live-arming flag / trading / Autopilot Loop B/C/D / CEILING-PAUSE / external Hermes Agent (Nous/OpenRouter) / scheduler / cron / webhook / MCP install / permission widening / any network lookup

**Relay repo touch is not authorized by this phase.**

**Preservation invariants:** Migration 008 APPLIED at `189eb1be6ef6304d914671bdaedec44d389cf877` preserved; N-3 CLOSED preserved; Stage 5 Gate-10 install approval at `40f3137e842cd60acf1adf17ecc7fe2f0b1b8935` CONSUMED preserved; Phase A-F Relay-repo lettered chain preserved; Antigravity chain SHAs preserved (ANTIGRAVITY-MIGRATION-DESIGN-SPEC at `71af035f9a1f7489bfd663e099a15fda7439d0a7`; ANTIGRAVITY-MIGRATION-A-WORKSPACE-CONFIG-DESIGN-SPEC at `d7bb70463beed9c9e3abea84ed9b0682cbaf2255`; ANTIGRAVITY-MIGRATION-A-WORKSPACE-CONFIG-CLOSEOUT at `19db3723e5a046db33bb5880fb95e6f38f23e08a`; ANTIGRAVITY-RULES-DESIGN-SPEC at `9d47f74d87aeed20a2fa7483a3704b494a21eb96`; ANTIGRAVITY-RULES-DESIGN-SPEC-CLOSEOUT-SYNC at `6c41c2c69d7fb4c8d5fda6179829f10e3ffaf9c0`); F-HALT cascade preserved; full PROJECT-PROGRESS-DASHBOARD design + implement-design + implement + refresh-001 + WEB-DESIGN-SPEC cascades preserved (sealed through `abb48531da8e1c073494f73190b4188ec6285bfe`); WEB-DESIGN handoff sealed at `1b49fc3…` untouched; canonical handoffs at `f6aaa40…` and `c8798ea…` sealed and untouched; sealed generator + DASHBOARD.md untouched; root `package.json` + `package-lock.json` RESTRICTED + untouched; Relay-runtime DORMANT preserved; Autopilot DORMANT preserved; CEILING-PAUSE history preserved; approvers exactly `{Victor}` preserved. `position.json.snap.20260502T020154Z` untracked carve-out preserved.

**Codex review verdicts do NOT constitute operator approval.** Per ROLE-HIERARCHY / CLAUDE.md: only Victor's in-session chat instruction grants approval.

**This web project is entirely separate from the trading runtime `dashboard.js`. It does not modify, replace, or supplement live trading functionality.**

---

## §18 — Working-tree state + verification-evidence rules

**Verification evidence rules:**

- Codex review claims about parent-repo state ("no edits" / "no install" / "no build" / "no `web/` exists") must be backed by parent-repo git-state, package-lock, and `web/` directory evidence — not by shell-history certainty (Codex cannot verify a missing shell history).
- Allowed verification commands: `git status --short`, `git diff --name-only`, `git diff -- <path>`, `git log -1`, `git ls-remote origin refs/heads/main`, `ls web/`, `test -d web`, `test -f path`, `find web -type f` (when `web/` exists), grep across `web/src/**` or `web/dist/**` post-build.
- Not used as evidence: bash history, `lsof`, process listings, network sniffers.

**Parent-repo / Relay-repo evidence boundary:** Parent-repo git state can verify that this phase did not modify parent-repo files. It cannot, by itself, prove a sibling Relay repo was untouched. Therefore this DESIGN-SPEC review does not make an auditable "no Relay repo touch" claim from parent-repo git state alone. Relay-repo verification, when required by a future phase, must use explicit Relay-repo git-state evidence (e.g., `git -C ../agent-avila-relay rev-parse HEAD`). The broader non-authorization boundary in §17 — Relay repo touch is not authorized by this phase — remains intact.

---

## §19 — Next steps (each separately gated; each requires explicit Victor instruction)

1. Codex DOCS-ONLY review of this codification phase (4-file scope).
2. Operator commit-only approval naming the 4-file scope, then operator-approved Claude-run commit + push to parent `origin/main`.
3. Three-way SHA consistency PASS verified post-push.
4. Closeout-of-closeout: a future phase records this DESIGN-SPEC as CLOSED at the post-commit HEAD.
5. (Future, separately gated) Operator may open `PROJECT-PROGRESS-DASHBOARD-WEB-SCAFFOLD` (Mode 4 SAFE IMPLEMENTATION) — first phase that creates `web/` + runs the one allowed `npm install`.
6. (Future, separately gated) Operator may open `PROJECT-PROGRESS-DASHBOARD-WEB-CONTENT` (Mode 4 SAFE IMPLEMENTATION).

This DOCS-ONLY codification phase authorizes none of them.

---

**End of canonical PROJECT-PROGRESS-DASHBOARD-WEB-IMPLEMENT-DESIGN record. The future WEB-IMPLEMENT-DESIGN-SPEC-CLOSEOUT, WEB-IMPLEMENT-DESIGN-SPEC-CLOSEOUT-SYNC, WEB-SCAFFOLD, WEB-CONTENT, any maintenance regeneration, Relay-repo scope expansion, test design, smoke tests, deploy, posting, and any production action remain separately gated and are NOT authorized by this DOCS-ONLY codification. This web project is entirely separate from the trading runtime `dashboard.js`. It does not modify, replace, or supplement live trading functionality.**
