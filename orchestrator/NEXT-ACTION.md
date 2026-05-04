# Next Allowed Action

Single source of truth for what Claude should do next. Read this before doing anything.

## Right Now — ARC Governance Activation (ARC-GO-LIVE)

**Mode:** DOCS-ONLY. Pending Codex docs-only review and explicit Victor / CEO approval before any commit.

The current step is **ARC-GO-LIVE — orchestrator governance activation.** It officially activates ARC-1 through ARC-7 as the active control layer for Agent Avila. The activation is recorded as a docs-only update to `orchestrator/STATUS.md`, `orchestrator/CHECKLIST.md`, and this file. **ARC-GO-LIVE is not live trading, not production mutation, not migration application, not a deploy, and not authorization for any RED-tier action.**

The activation confirms — and depends on, without modifying — the seven safety-policy docs already in the working tree:

- ARC-1: `orchestrator/PROTECTED-FILES.md` (per-path SAFE / RESTRICTED / HARD BLOCK matrix; Ruflo / future-automation rule).
- ARC-2: `orchestrator/APPROVAL-GATES.md` (16-gate action-class matrix; "what is NOT operator approval").
- ARC-3: `orchestrator/PHASE-MODES.md` (six phase modes; phase-labeling rule; automation non-promotion rule).
- ARC-4: `orchestrator/NEXT-ACTION-SELECTOR.md` (ten ordered selector rules; master-order discipline).
- ARC-5: `orchestrator/ROLE-HIERARCHY.md` (CEO is sole approver; Claude / Codex / ChatGPT / Gemini cannot approve; Ruflo / Hermes / successors inherit governance role only).
- ARC-6: `orchestrator/AUTOMATION-PERMISSIONS.md` (GREEN / YELLOW / RED tiers; Claude / Codex / ChatGPT / Gemini / Ruflo / Hermes / successors all governance-only).
- ARC-7: `orchestrator/HANDOFF-RULES.md` + `orchestrator/handoffs/` (packets are not approval channels, not transports, not trading interfaces).

ARC-GO-LIVE next-action sequence:

1. Operator inspects the drafted ARC-GO-LIVE updates to STATUS.md / CHECKLIST.md / NEXT-ACTION.md (`git diff` only — no commit).
2. Codex docs-only review of the three drafted updates against the seven safety-policy docs (no widening, no scope creep, no implication of authorization for any RED-tier action).
3. On Codex PASS, explicit Victor / CEO approval of the activation commit (per `APPROVAL-GATES.md` — ordinary status-doc commit-time approval).
4. Operator stages by name (`git add orchestrator/STATUS.md orchestrator/CHECKLIST.md orchestrator/NEXT-ACTION.md`) and commits.
5. Closeout: re-read STATUS.md / CHECKLIST.md / NEXT-ACTION.md and confirm next-action language correctly returns to the prior N-track state (Path X resumption — see "Right Now — N-track" below).

After ARC-GO-LIVE commits, the next-action selector returns to the prior N-track state below; ARC-GO-LIVE does not consume any N-2t / N-3 approval, does not advance N-3, does not authorize a deploy, and does not authorize Migration 008 application.

**Confirmations carried by ARC-GO-LIVE (none of these is altered by the activation; the activation states them on the record):**

- N-3 remains halted/blocked behind runbook §11. Migration 008 remains NOT applied to production.
- Prior Victor production-action approvals naming `9ae139d` and `3138e7f` remain CONSUMED and cannot be reused.
- Victor / CEO is the sole final authority for every RED-tier action and every commit of a safety-policy doc.
- Claude / Codex / ChatGPT / Gemini / Ruflo / Hermes / successors cannot self-approve. Codex PASS, clean tree, green tests, scheduled triggers, signed tokens, and LLM self-approval DO NOT satisfy any operator-approval gate.
- The trading runtime is not consulted by the brains in its hot path; live order decisions are made by `bot.js` + the operator + Kraken.
- Future work must obey ARC-1 through ARC-7 without exception.

## Right Now — N-track (resumes after ARC-GO-LIVE commits)

**N-3 remains halted/blocked. Migration 008 remains NOT applied to production.**

All N-2x phases through N-2s are CLOSED (or, for N-2r, design-only PASS):

`N-2b e6c9189` -> `N-2c 9ae139d` -> `N-2d 3732721` -> `N-2e afe94d1` -> `N-2f 3af1e44` -> `N-2g 926eb7f` -> `N-2h ea7774d` -> `N-2i 5ee1dcb` -> `N-2j 548383b` -> `N-2k b2d187d` -> `N-2l 3138e7f` -> `N-2m 6b9be1d` -> `N-2n 8fc53b9` -> `N-2o f925ac5` -> `N-2p ddca950` -> `N-2q 29ac7d7` -> `N-2r (design-only PASS, no commit)` -> `N-2s 6c3a1e5 (local-only; not yet pushed)`.

**N-2t (this commit) codifies that `railway up` deploys without a verifiable full 40-character commit SHA are REJECTED as a valid §4(x)(a) source-identity surface for N-3** (per runbook §3 N-2t deploy-method gating + §4(x)(a) GAP-D Case 2 tightening). The approved N-3 deploy path is **GitHub-push-tracked deploys** (or any equivalent producing a Railway-recorded commit SHA on a non-secret surface).

The next allowed action sequence (Path X resumption after N-2t commits): (1) restore local DNS connectivity that's currently blocking `git push` (resolves `Could not resolve host: github.com`); (2) push the latest committed HEAD to GitHub `origin/main`; (3) allow Railway auto-deploy to redeploy via the GitHub-tracked deploy method (or scoped manual deploy approval); (4) verify post-deploy via `railway ssh` (deployed commit SHA = approved HEAD; in-container `node --version` matches `.nvmrc` byte-for-byte; service healthy); (5) fresh Codex N-3 preflight at the new HEAD (per `git rev-parse HEAD`); (6) fresh Victor in-session production-action approval naming the new HEAD; (7) N-3 attempt from a fresh `railway ssh` session per the N-2m same-session rule.

## Required Gate State

**N-2s commit-time approval authorized only committing `.nvmrc`, `orchestrator/STATUS.md`, `orchestrator/CHECKLIST.md`, and `orchestrator/NEXT-ACTION.md`; it did NOT authorize a deploy (deploy is gate 5 per `APPROVAL-GATES.md`, separately approved), and it did NOT authorize N-3.** Likewise, **N-2t commit-time approval authorizes only committing the runbook + three status docs; it does NOT authorize a deploy and does NOT authorize N-3.**

Before any N-3 production-action attempt:

- **The deploy method must produce a verifiable full 40-character commit SHA on a non-secret Railway deploy-metadata surface** (per runbook §3 N-2t deploy-method gating + §4(x)(a) GAP-D Case 2). `railway up` deploys do NOT meet this requirement; GitHub-push-tracked deploys do. If the currently-running deploy was triggered by `railway up` (or any other commit-SHA-untracked method), the operator must trigger a fresh GitHub-push-tracked deploy of the approved HEAD before any N-3 attempt.
- The latest committed HEAD must be deployed to `agent-avila-dashboard` and verified healthy. The post-commit deploy-and-verify cycle (per N-2r design) requires: deployed commit SHA = approved HEAD byte-for-byte (read from a non-secret Railway surface that exposes a verifiable full 40-character commit SHA per N-2t); in-container `node --version` matches `.nvmrc` byte-for-byte after parsing-hygiene normalization; deployed service running cleanly. HALT and re-pin in a separately scoped phase if any verification fails.
- Fresh Codex N-3 preflight must PASS on the latest committed HEAD (after the deploy-and-verify cycle is complete).
- Fresh Victor in-session production-action approval must name the exact full latest committed HEAD from `git rev-parse HEAD`.
- Both prior Victor approvals, naming `9ae139d` and `3138e7f`, remain CONSUMED and cannot be reused.
- All eleven runbook §4 pre-flight checks (i) through (xi) must PASS at execution time, performed in the same `railway ssh` session as the runner invocation per the N-2m same-session rule.
- Target Railway service and production database confirmation must be completed without exposing secrets.

## Check D

**Check D — repo-side pin in place via Option A.** Repo-root `.nvmrc` containing exact normalized value `24.10.0` is committed; satisfies runbook §4(x)(b) source priority 1. Pin matches the deployed runtime as captured at fact-finding time (in-container `node --version` returned `v24.10.0` from `railway ssh` into production `agent-avila-dashboard`; normalized to `24.10.0` per parsing-hygiene rule). `package.json` `engines.node` remains the non-exact range `">=18.0.0"` and is intentionally unchanged in this resolution; the canonical-source rule selects `.nvmrc` (priority 1) with HALT-on-disagreement against any other source.

**Deployed-runtime verification still required before any N-3 attempt.** See "Required Gate State" above for the post-commit deploy-and-verify cycle. The N-2r-preflight freshness rule applies: runtime-version capture is invalidated by intervening deploys, builder changes, service/environment scope switches, inability to identify running deployment SHA, or Nixpacks Node-provider patch updates — re-run capture and update `.nvmrc` in a separately scoped phase if freshness is broken.

**Active builder confirmed: Nixpacks v1.41.0.** Nixpacks documents Node major-version control only; deployed exact patch is observable from in-container `node --version` and may shift on future Nixpacks updates. **Approved primary N-3 execution surface confirmed: `railway ssh` into the deployed `agent-avila-dashboard` production container.** **`railway shell` is NOT the approved surface** (local subshell with env-var injection only; same REJECTED category as `railway run` per runbook §3 N-2n local-injection-surface rejection).

## Do Not Do

Do not apply migrations, deploy, run Railway commands, query the production database, read or write env/secrets, change `MANUAL_LIVE_ARMED`, touch live Kraken paths, edit runtime code, edit migrations/scripts, edit package or lock files, add additional Node version files (`.node-version`, Volta config, etc. — `.nvmrc` resolution is committed), edit deployment config, edit `position.json`, or edit safety-policy docs unless separately authorized.

The Migration 008 runbook `orchestrator/handoffs/N-2-MIGRATION-008-PRODUCTION-PLAN.md` is part of the N-2t docs-only commit scope and remains the canonical runbook for N-3.

## Stale-Proofing Note

This file intentionally avoids active open-phase and unlanded-closeout language. Future execution state is resolved through the latest committed HEAD from `git rev-parse HEAD`, commit history from `git log`, and the canonical N-3 gate in runbook §11.
