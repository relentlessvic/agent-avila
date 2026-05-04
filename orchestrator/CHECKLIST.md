# Orchestrator Checklist

End-to-end progression for the Agent Avila dual-truth fix and surrounding orchestrator work.

## N-2x Migration 008 Runbook Track

All N-2x phases through N-2q are CLOSED. The canonical detailed change history lives in `orchestrator/handoffs/N-2-MIGRATION-008-PRODUCTION-PLAN.md` §14; commit truth lives in `git log`.

| Item | Status |
|---|---|
| N-2 design review | PASS WITH REQUIRED EDITS |
| N-2b runbook creation | CLOSED at `e6c9189` |
| N-2c HEAD-preflight correction | CLOSED at `9ae139d` |
| N-2d Railway-internal connectivity update | CLOSED at `3732721` |
| N-2e N-3 preflight tightening | CLOSED at `afe94d1` |
| N-2f follow-up tightening | CLOSED at `3af1e44` |
| N-2g follow-up tightening | CLOSED at `926eb7f` |
| N-2h follow-up tightening | CLOSED at `ea7774d` |
| N-2i stale-reference cleanup precedent | CLOSED at `5ee1dcb` |
| N-2j follow-up tightening | CLOSED at `548383b` |
| N-2k follow-up tightening | CLOSED at `b2d187d` |
| N-2l second approval/runbook gate update | CLOSED at `3138e7f` |
| N-2m follow-up tightening | CLOSED at `6b9be1d` |
| N-2n Railway execution-surface correction | CLOSED at `8fc53b9` |
| N-2o deployed-runtime shell hardening | CLOSED at `f925ac5` |
| N-2p status/runbook cleanup | CLOSED at `ddca950` |
| N-2q status-doc stale-proof refactor | CLOSED at `29ac7d7` |

## N-3 State

- [x] N-3 attempt 1 at `9ae139d` halted before SQL execution.
- [x] N-3 attempt 2 at `3138e7f` halted before SQL execution.
- [x] Victor approval naming `9ae139d` is CONSUMED and cannot be reused.
- [x] Victor approval naming `3138e7f` is CONSUMED and cannot be reused.
- [x] Migration 008 remains NOT applied to production.
- [x] N-3 remains halted/blocked behind the runbook §11 gate.
- [x] Next N-3 review must be a fresh Codex N-3 preflight on the runbook at the latest committed HEAD, using `git rev-parse HEAD` to identify that HEAD and `git log` for commit truth.

## Carry-Forward Execution Checks

- [ ] **Approval-gate separation confirmed:** N-2s commit-time approval authorizes only committing `.nvmrc` + three status docs; does NOT authorize deploy (gate 5, separately approved); does NOT authorize N-3.
- [x] **Check D — repo-side pin in place via Option A.** Repo-root `.nvmrc` containing exact normalized value `24.10.0` is committed; satisfies runbook §4(x)(b) source priority 1. Pin matches the deployed runtime as captured at fact-finding time (in-container `node --version` returned `v24.10.0` from a `railway ssh` session into the production `agent-avila-dashboard` container). `package.json` `engines.node` remains the non-exact range `">=18.0.0"`, unchanged.
- [ ] **Deployed-runtime verification (post-commit deploy-and-verify cycle, per N-2r design):** after the new HEAD is deployed to `agent-avila-dashboard` (auto-deploy or separately scoped deploy approval — gate 5 per `orchestrator/APPROVAL-GATES.md`, NOT authorized by any N-2x docs commit), operator verifies via `railway ssh` after the redeploy reaches RUNNING: deployed commit SHA equals the new approved HEAD byte-for-byte; in-container `node --version` matches `.nvmrc` byte-for-byte after parsing-hygiene normalization; deployed service healthy. HALT and re-pin in a separately scoped phase if any check fails.
- [ ] **N-2r-preflight freshness:** runtime-version capture used to set `.nvmrc` remains valid only if no intervening deploy, builder change, service/environment scope switch, inability to identify running deployment SHA, or Nixpacks Node-provider patch update has occurred since capture. If freshness is broken, operator re-runs in-container `node --version` capture and updates `.nvmrc` in a separately scoped phase before any N-3 attempt.
- [ ] Fresh Codex N-3 preflight PASS on the latest committed HEAD (after deploy-and-verify cycle complete).
- [ ] Fresh Victor in-session production-action approval naming the exact full latest committed HEAD from `git rev-parse HEAD`.
- [ ] All eleven runbook §4 pre-flight checks (i) through (xi) PASS at execution time, performed in the same `railway ssh` session as the runner invocation per the N-2m same-session rule.
- [ ] Target Railway service and production database confirmation completed without exposing secrets.
- [ ] Migration 008 applied only after the runbook §11 gate is fully satisfied.

## Docs-Only Closeout Verification

- [x] Status docs mark all N-2x phases through N-2q as CLOSED at commit `29ac7d7`.
- [x] Active stale wording about N-2q open-work state or incomplete closeout items is absent.
- [x] Next-action language is stale-proof: it points to a fresh Codex N-3 preflight on the latest committed HEAD, canonical runbook §11, `git log`, and `git rev-parse HEAD`.
- [x] No new open-phase or unlanded-closeout tail is introduced.
- [x] The runbook `orchestrator/handoffs/N-2-MIGRATION-008-PRODUCTION-PLAN.md` is not part of this Check D resolution; runbook §4(x)(b) already covers `.nvmrc` source rule and HALT-on-disagreement at execution time.

## P2 Informational (post-N-2q findings)

- **`package.json:8` declares `"start": "node bot.js"` but Railway/Nixpacks runs `node dashboard.js`.** Service-side override (Railway custom start command, or Nixpacks-detected entry) reconciles the difference. Not material to Check D or §11 N-3 gate; tracked for future audit.
- **`railway shell` is NOT the approved deployed-runtime-shell surface.** `railway shell` opens a local subshell with Railway env vars injected (in-shell `node --version` returns operator's local Node, not the deployed runtime). Same REJECTED category as `railway run`, per runbook §3 N-2n rejection of local-injection surfaces. The approved primary N-3 execution surface is `railway ssh` into the deployed `agent-avila-dashboard` container; N-2o GAP-A four conditions empirically PASS for that surface. (A separately scoped runbook-tightening phase could add an explicit "rejects `railway shell`" line to runbook §3 alongside the existing `railway run` rejection; deferred.)
- **Active builder confirmed: Nixpacks v1.41.0** (Railway build log header). Nixpacks documents Node major-version control only; the deployed exact patch is determined by Nixpacks's current Node 24 selection at deploy time and is observable from in-container `node --version`. The N-2r-preflight freshness rule applies — patch may shift on future Nixpacks updates.

## Blocked Actions

- [ ] Do not apply Migration 008 without separate explicit production-action approval.
- [ ] Do not deploy.
- [ ] Do not run Railway commands.
- [ ] Do not query the production database.
- [ ] Do not read or write env or secrets.
- [ ] Do not change runtime code, migrations, scripts, package files, lockfiles, Node version files, deployment config, `position.json`, `MANUAL_LIVE_ARMED`, live Kraken paths, or safety-policy docs as part of this sync.
