# PROJECT-PROGRESS-DASHBOARD-BUILD-PREVIEW-DESIGN

**Phase mode:** DESIGN-ONLY (Mode 2) — codified by `PROJECT-PROGRESS-DASHBOARD-BUILD-PREVIEW-DESIGN-SPEC` (DOCS-ONLY / Mode 3) at parent-repo commit pending operator commit-only approval; codification draft prepared against parent-repo HEAD `dbcb4694554c77515a4375b81deee65420cd7d4a`.

**Status:** Accepted as conversation-only working design. This file is the on-disk codification of that accepted design so a future execution phase can consume it. The codification itself authorizes nothing operational; it merely persists the accepted plan.

**Target future phase:** `PROJECT-PROGRESS-DASHBOARD-WEB-BUILD-PREVIEW` (SAFE IMPLEMENTATION / Mode 4) — separately gated, not opened by this codification.

**Authority chain:** The design recorded here was produced as a DESIGN-ONLY conversation, reviewed by Codex (DESIGN-ONLY full-narrative review, embedded-design dispatch), and accepted by Victor. This file does NOT itself constitute an execution authorization. Codex review verdicts are not operator approval.

---

## Codification provenance

- **DESIGN-ONLY phase:** `PROJECT-PROGRESS-DASHBOARD-BUILD-PREVIEW-DESIGN` (no on-disk artifact; conversation-only).
- **DESIGN-ONLY result:** accepted by Victor with substantive Codex checks PASS on RE-1, RE-2, and full forbidden-literal scan across §1–§12.
- **Codex round-1 (full 24-point design review):** OVERALL FAIL — 21 PASS, 1 PASS WITH REQUIRED EDITS (item 20: audit-advisory verifiability), 2 FAIL (item 17: bare forbidden literals in §3 / §12; item 24: overall driven by 17 and 20).
- **Required edits applied:**
  - **RE-1** — replace all bare forbidden literals in the design narrative with neutral phrasing: "the armed-trading flag", "Kraken credential env vars", "the Railway deploy token", "the GitHub token", "the OpenAI key", "subprocess-spawn APIs". Applied to §3, §11 future-codification note, and §12 #15.
  - **RE-2** — reframe the audit-advisory wording as a SCAFFOLD-phase carried-forward fact, not a freshly re-verified one. Applied to §1.10 + §8 audit-output paragraph. New §12 HALT condition #16 added covering changed severity / version range / affected feature / advisory ID / remediation availability.
- **Codex narrow re-review (RE-1 + RE-2 only):** OVERALL FAIL — items 1/4/5 procedural FAILs because the conversation-only design was not in the working tree at scan time; item 2 (RE-2) PASS; item 3 (scope) PASS.
- **Codex full re-review (post-RE, embedded-design dispatch):** RE-1 PASS, RE-2 PASS, forbidden-literal scan PASS across the full embedded §1–§12 narrative. Item 4 (substantive content preservation vs. pre-RE draft) FAIL on procedural grounds because only the corrected design was embedded, not a side-by-side diff.
- **Operator decision:** items 1–3 of the full re-review (RE-1, RE-2, forbidden-literal scan) are accepted as the substantive safety checks. Item 4 / overall FAIL is treated as a documented procedural non-finding caused by single-version dispatch, not a substantive safety blocker. This codification records that decision.

---

## §1 — Preflight checks (operator-runnable read-only; no edits)

Before any execution phase opens, the operator (or Claude, in a separate phase) must verify:

1. `git rev-parse HEAD` equals the agreed execution-time HEAD; record it in the IN PROGRESS narrative.
2. `git status --short` shows only `?? position.json.snap.20260502T020154Z` (clean tree).
3. `git rev-parse HEAD == origin/main == live remote refs/heads/main` (three-way consistency).
4. `[ -f web/package.json ] && [ -f web/package-lock.json ] && [ -d web/node_modules ]` — all three present.
5. `git diff --stat web/package.json web/package-lock.json` — no diff (lockfile sealed at `cc6819d…`).
6. `git diff --stat tools/dashboard-generate.js` — no diff (generator sealed at `f5cc97a…`).
7. `[ ! -d web/dist ] && [ ! -d web/.astro ]` — no leftover build artifacts.
8. Disk free check: `df -h .` — ensure ≥1 GB free for build output and cache.
9. Confirm `web/node_modules/.package-lock.json` matches `web/package-lock.json` (no drift since SCAFFOLD); otherwise abandon and re-design.
10. Confirm the Astro advisory carried forward from the SCAFFOLD-phase `npm audit` run is still recorded as a documented known advisory (no remediation in scope). The Astro advisory is carried forward as a documented known advisory from the SCAFFOLD-phase `npm audit` run, not as a freshly re-verified fact from the static working tree. Any future re-audit during the execution phase that shows a changed advisory state must HALT the phase and notify the operator before proceeding.

---

## §2 — Exact allowed commands (only in a future, Victor-approved execution phase)

| Step | Command (cwd = `web/`) | Why allowed |
|---|---|---|
| 2.1 | `node --version` | Read-only version check (no state mutation) |
| 2.2 | `npm --version` | Same |
| 2.3 | `npm run build` (= `astro build`) | The deliverable: emits `web/dist/` static output |
| 2.4 (optional) | `npm run preview` (= `astro preview`) | Local-only HTTP server on `localhost:4321`; serves `web/dist/` over loopback only |
| 2.5 | `ls -la web/dist` | Verify build output exists |
| 2.6 | `du -sh web/dist web/.astro` | Sanity check output size |

Notes on §2.4 (preview): `astro preview` binds to `localhost` only by default; the design forbids any `--host` or `--port` flag that would change the binding, since binding to `0.0.0.0` exposes the loopback service to the LAN.

---

## §3 — Exact forbidden commands/actions

- `npm install` — would mutate `web/package-lock.json` if dependencies drift; would also potentially fetch transitive packages over network. Sealed lockfile must remain byte-stable.
- `npm install <pkg>`, `npm uninstall`, `npm update`, `npm dedupe`, `npm prune`, `npm rebuild`
- `npm audit fix` / `npm audit fix --force` — would mutate lockfile and node_modules
- `npx <anything>` — would download arbitrary packages
- `astro dev` — HMR dev server; introduces unneeded file watchers and creates `.astro/` cache; preview is sufficient for verification
- `astro preview --host 0.0.0.0` / `--host <interface>` / `--port <non-4321>` — any non-default binding
- `astro build --watch`
- Anything that touches root `package.json` / `package-lock.json`
- Anything outside `web/`: no edits to `tools/dashboard-generate.js`, no regen of `orchestrator/DASHBOARD.md`, no edits to sealed handoffs, no Relay-repo touch, no `bot.js` / `dashboard.js` / `db.js` / `migrations/` / `scripts/` / `position.json*` / `.env*` touch
- No Railway, no deploy, no DB, no Discord, no Relay activation, no Kraken touch, no env / secret access, no read or write of the armed-trading flag, no manual live-armed action, no trading
- No use of Kraken credential env vars in any form; no read of the Railway deploy token; no read of the GitHub token; no read of the OpenAI key
- No `gh` / GitHub commands; no `curl` / `wget` to the public internet beyond what astro itself requires for the build (which the carried-forward advisory acknowledges is static and unused)
- No invocation of subprocess-spawn APIs from any script in `web/`
- No Antigravity reconfiguration; no autopilot Loop B/C/D activation; no CEILING-PAUSE state change

---

## §4 — npm install vs npm ci decision

**Decision: neither `npm install` nor `npm ci` is needed if §1.4 + §1.5 + §1.9 all pass.**

The SCAFFOLD already ran `npm install` once (operator-approved), producing the sealed `web/package-lock.json` at `cc6819d…` and populating `web/node_modules/`. Subsequent build/preview runs read from the existing tree and do not require dependency resolution.

If §1 preflight detects drift (lockfile differs from `node_modules/.package-lock.json`, or `node_modules` is missing/corrupt), the correct response is to **HALT and re-design**, not to silently re-install. A re-install would be its own SAFE IMPLEMENTATION (Mode 4) phase requiring fresh Victor approval, fresh Codex review, and explicit acknowledgement that it may modify the lockfile.

---

## §5 — Verifying build output without deploying

Verification is fully offline:
1. `ls -la web/dist` — confirms `index.html` plus an `_astro/` assets directory.
2. `du -sh web/dist` — confirms reasonable size (expect ~100–300 KB for a static dashboard of this scope).
3. `head -50 web/dist/index.html` — confirms the rendered HTML contains expected section IDs (active-phase, safety-gates, completed-phases, etc.) and the trading-isolation disclaimer.
4. `grep -l "PROJECT-PROGRESS-DASHBOARD" web/dist/index.html` — confirms parsed phase data is embedded.
5. Static-link integrity check: `grep -oE 'src="[^"]*"|href="[^"]*"' web/dist/index.html | sort -u | head -30` — confirms all asset references are relative paths (no absolute URLs to remote hosts).
6. No execution. No deploy. No upload.

---

## §6 — Local preview safely, if approved later

Only if §5 verification passes AND the operator explicitly authorizes preview in a separate approval message:

1. `cd web && npm run preview` (binds `localhost:4321` only).
2. Operator opens `http://localhost:4321` in browser; visually inspects the dashboard.
3. Operator presses `Ctrl-C` to stop the preview process.
4. Verify no `.astro/` directory was created during preview (it's only created during build, but confirm).
5. Verify `web/package.json` / `web/package-lock.json` are byte-stable: `git diff --stat web/package.json web/package-lock.json`.

Preview is a foreground, terminal-bound process. No background scheduling. No daemonization. No `--host` flag.

---

## §7 — Files that may change during a future build/preview run

Expected new artifacts (all under `web/`, all currently absent):
- `web/dist/` — static build output; entire directory is new
- `web/.astro/` — astro build cache (types, content collections); new

Expected unchanged:
- `web/package.json` (byte-stable)
- `web/package-lock.json` (byte-stable)
- `web/node_modules/` (byte-stable; no install)
- All files under `web/src/`
- `web/astro.config.mjs`, `web/postcss.config.mjs`, `web/tailwind.config.mjs`, `web/tsconfig.json`
- `web/README.md`, `web/public/` (if any)
- Everything outside `web/`

Files that MUST NOT change:
- `orchestrator/DASHBOARD.md` (regenerated only at REFRESH phases via sealed generator)
- `tools/dashboard-generate.js`
- All `orchestrator/handoffs/*` sealed files
- Root `package.json`, `package-lock.json`
- `bot.js`, `dashboard.js`, `db.js`, anything in `migrations/`, `scripts/`, `position.json*`, `.env*`
- Any Relay-repo file (separate repo)

---

## §8 — Handling generated output (`dist/`, `.astro/`, lockfile, audit)

Two options for `web/dist/` and `web/.astro/`, documented for operator decision:

**Option A — Gitignore them, never commit.** Add `web/dist/` and `web/.astro/` to `.gitignore` in a separate, tiny DOCS-ONLY phase BEFORE the build phase runs. This keeps build output local-only and prevents accidental commits. Recommended.

**Option B — Clean after verification.** Skip gitignore changes; rely on the post-build phase explicitly deleting `web/dist/` and `web/.astro/` once verification is complete. Riskier: requires discipline; an interruption could leave dirty state.

**Lockfile drift:** if `web/package-lock.json` changes during build (it shouldn't with `astro build`, but verify), the phase must HALT before commit — the lockfile is sealed and any change is out-of-scope.

**Audit output:** the Astro `define:vars` XSS advisory is carried forward as a documented known advisory from the SCAFFOLD-phase `npm audit` run, not as a freshly re-verified fact from the static working tree. The build phase must NOT run `npm audit fix` or any auto-remediation. If a future REMEDIATION phase is opened, it will require its own design + Codex review + Victor approval. Any re-audit during the future execution phase that reveals changed advisory state triggers HALT and operator notification before proceeding.

---

## §9 — Confirming no runtime/trading surface was touched

Post-execution verification (still inside the future build phase):
1. `git status --short` shows only expected `web/` additions plus `?? position.json.snap.20260502T020154Z`.
2. `git diff --stat` for any file outside `web/` returns nothing.
3. Explicit `git diff --stat` checks: `bot.js`, `dashboard.js`, `db.js`, `migrations/`, `scripts/`, `position.json`, `.env*`, root `package.json`, root `package-lock.json`, `tools/dashboard-generate.js`, all sealed handoffs — all must show no diff.
4. No process running on Kraken WebSocket, no Discord client, no Railway CLI invoked.
5. Working tree confirmed clean of runtime-state files: no new `.bot.lock`, no new `safety-check-log.json`, no new `position.json` content.
6. `position.json.snap.20260502T020154Z` carve-out still untracked, unchanged.

---

## §10 — What Codex must review before any execution phase

Codex DESIGN-ONLY review of this codified design (24-point checklist analogous to prior phases) covering:
- Phase mode classification (SAFE IMPLEMENTATION Mode 4 for the future execution phase; DESIGN-ONLY Mode 2 for the original conversation phase; DOCS-ONLY Mode 3 for this codification phase)
- Scope boundary completeness (`web/` only for the future execution phase)
- Forbidden-command enumeration completeness
- Lockfile / generator / sealed-file invariants preserved
- Trading-isolation boundary preserved
- Relay / Autopilot / CEILING-PAUSE invariants preserved
- Forbidden-literal rule observed in the design narrative itself
- Dependency on prior SCAFFOLD lockfile preserved
- Preview-host restriction documented
- HALT conditions clearly enumerated

Codex SAFE IMPLEMENTATION review of the future execution phase (separate Codex round, before commit) covering the same 24-point spine PLUS post-build artifact inspection.

---

## §11 — Victor's separate approvals required

The cascade requires distinct Victor-only approval gates:

1. **Approval to seal this DOCS-ONLY codification** — commit + push of this `PROJECT-PROGRESS-DASHBOARD-BUILD-PREVIEW-DESIGN-SPEC` phase persisting the design. Codification does NOT authorize execution; it merely creates the on-disk record.
2. **Approval to open `PROJECT-PROGRESS-DASHBOARD-WEB-BUILD-PREVIEW` (SAFE IMPLEMENTATION Mode 4)** — separate from approving the codified design.
3. **Approval to run `npm run build`** — explicitly naming the build script and the working directory `web/`.
4. **Approval to run `npm run preview`** — separate; preview is optional and may be skipped.
5. **Approval to commit the build phase's record** (typically a 3- or 4-file status-doc update; build artifacts under `web/dist/`, `web/.astro/` are NOT committed under Option A).
6. **Approval to push the build phase's commit** — separate from commit.

Codex PASS verdicts NEVER substitute for any of these. Any codification of this design into a future handoff variant must use the same neutral phrasing throughout: "the armed-trading flag", "Kraken credential env vars", "the Railway deploy token", "the GitHub token", "the OpenAI key", "subprocess-spawn APIs" — no bare forbidden literals even inside "No X" enumerations.

---

## §12 — HALT conditions / stop conditions

The future execution phase HALTs without further action if:
1. §1 preflight fails any check.
2. `git status` shows unexpected modifications at preflight or post-build.
3. `web/package.json` or `web/package-lock.json` diff is non-empty post-build.
4. `web/node_modules/.package-lock.json` differs from sealed `web/package-lock.json`.
5. The sealed generator at `tools/dashboard-generate.js` (`f5cc97a…`) has any diff.
6. `astro build` exits non-zero.
7. `web/dist/index.html` lacks expected content markers (active phase, safety gates, disclaimer).
8. Any file outside `web/` is modified.
9. `web/dist/index.html` contains absolute URLs to external hosts (data exfiltration risk).
10. Build process tries to open network connections during build (verifiable via process-monitoring; out of scope for this design phase but documented).
11. Operator interrupts (`Ctrl-C`) before verification completes.
12. Codex SAFE IMPLEMENTATION review returns FAIL or required edits that cannot be applied.
13. CEILING-PAUSE phase-loop counter advances unexpectedly.
14. Any process listed in §3 forbidden-commands is invoked accidentally.
15. The dashboard build output suggests reading from forbidden source files (e.g., `web/dist/index.html` ends up containing trading-runtime state, position content, or env values — would indicate a regression in `load-dashboard.ts` allowlist). The forbidden source-file classes include the armed-trading flag, Kraken credential env vars, the Railway deploy token, the GitHub token, the OpenAI key, the trading runtime files `bot.js` / `dashboard.js` / `db.js`, `position.json*`, and `.env*`; any of these surfacing in build output is a regression and a HALT.
16. Any re-audit during the future execution phase that reveals changed advisory state (new severity, new vulnerable version range, new affected feature, new advisory ID, or remediation now available) triggers HALT and operator notification before proceeding.

On HALT: do not commit, do not push, do not delete artifacts blindly. Open a separate phase to investigate root cause.

---

## Closing — codification scope and non-authorization

This handoff is the on-disk codification of an accepted conversation-only DESIGN-ONLY result. It does not authorize execution of any command listed in §2. It does not open `PROJECT-PROGRESS-DASHBOARD-WEB-BUILD-PREVIEW`. It does not modify `orchestrator/DASHBOARD.md`, the sealed generator, any `web/` file, any root package file, any Relay-repo file, or any runtime / trading file. It does not advance the autopilot phase-loop counter. It does not install or reconfigure Antigravity. It does not touch Railway, the Discord platform, the DB, env / secrets, the armed-trading flag, trading runtime, DASH-6, D-5.12f, Migration 009+, Autopilot Loop B/C/D, CEILING-PAUSE, the external Hermes Agent (Nous/OpenRouter), scheduler / cron / webhook / MCP install, or permission widening.

Migration 008 APPLIED at `189eb1be6ef6304d914671bdaedec44d389cf877`, N-3 CLOSED, Stage 5 Gate-10 install approval at `40f3137e842cd60acf1adf17ecc7fe2f0b1b8935` CONSUMED, Phase A-F Relay-repo lettered chain, Antigravity chain SHAs (`71af035f9a1f7489bfd663e099a15fda7439d0a7` / `d7bb70463beed9c9e3abea84ed9b0682cbaf2255` / `19db3723e5a046db33bb5880fb95e6f38f23e08a` / `9d47f74d87aeed20a2fa7483a3704b494a21eb96` / `6c41c2c69d7fb4c8d5fda6179829f10e3ffaf9c0`), F-HALT cascade, full PROJECT-PROGRESS-DASHBOARD design + implement-design + implement + REFRESH-001/002/003/004/005 cascades sealed through `dbcb4694554c77515a4375b81deee65420cd7d4a`, sealed WEB-DESIGN handoff at `1b49fc30737ea96ec8d2dbf923c5467eb33b8149`, sealed WEB-IMPLEMENT-DESIGN handoff at `e6af54a91a94cc4b92291a550db3825a8bb599a5`, canonical prior PROJECT-PROGRESS-DASHBOARD handoffs at `f6aaa40…` and `c8798ea…`, sealed generator at `tools/dashboard-generate.js` codified at `f5cc97a…`, Relay-runtime DORMANT, Autopilot DORMANT (verified at `eff4dd22b9b9af038c7ae45de301e60b3f45af98`), CEILING-PAUSE history broken via `ARC-8-UNPAUSE` at `22ba4a7663e22df64b7cc8e3c0324cbffc0e28f6` (phase-loop counter 0 of 3), approvers exactly `{Victor}` — all preserved unchanged by this codification.

Parent-repo / Relay-repo evidence boundary per WEB-IMPLEMENT-DESIGN handoff §18: parent-repo git state cannot, by itself, prove a sibling Relay repo was untouched; Relay-repo verification, when required by a future phase, must use explicit Relay-repo git-state evidence.

**This web project is entirely separate from the trading runtime `dashboard.js`. It does not modify, replace, or supplement live trading functionality.**
