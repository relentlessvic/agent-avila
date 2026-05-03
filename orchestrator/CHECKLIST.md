# Orchestrator Checklist

End-to-end progression for the Agent Avila dual-truth fix and surrounding orchestrator work.

## N-2x Migration 008 Runbook Track

All N-2x phases through N-2p are CLOSED. The canonical detailed change history lives in `orchestrator/handoffs/N-2-MIGRATION-008-PRODUCTION-PLAN.md` §14; commit truth lives in `git log`.

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

## N-3 State

- [x] N-3 attempt 1 at `9ae139d` halted before SQL execution.
- [x] N-3 attempt 2 at `3138e7f` halted before SQL execution.
- [x] Victor approval naming `9ae139d` is CONSUMED and cannot be reused.
- [x] Victor approval naming `3138e7f` is CONSUMED and cannot be reused.
- [x] Migration 008 remains NOT applied to production.
- [x] N-3 remains halted/blocked behind the runbook §11 gate.
- [x] Next N-3 review must be a fresh Codex N-3 preflight on the runbook at the latest committed HEAD, using `git rev-parse HEAD` to identify that HEAD and `git log` for commit truth.

## Carry-Forward Execution Checks

- [ ] **Check D Node-pin gap remains UNRESOLVED.** `package.json` uses the non-exact `engines.node` range `">=18.0.0"`; no `.nvmrc`, `.node-version`, or Volta config is present. The operator must resolve this before execution under runbook §4(x)(b).
- [ ] Fresh Codex N-3 preflight PASS on the latest committed HEAD.
- [ ] Fresh Victor in-session production-action approval naming the exact full latest committed HEAD from `git rev-parse HEAD`.
- [ ] All eleven runbook §4 pre-flight checks (i) through (xi) PASS at execution time.
- [ ] Target Railway service and production database confirmation completed without exposing secrets.
- [ ] Migration 008 applied only after the runbook §11 gate is fully satisfied.

## Docs-Only Closeout Verification

- [x] Status docs mark all N-2x phases through N-2p as CLOSED at commit `ddca950`.
- [x] Active stale wording about N-2p open-work state or incomplete closeout items is absent.
- [x] Next-action language is stale-proof: it points to a fresh Codex N-3 preflight on the latest committed HEAD, canonical runbook §11, `git log`, and `git rev-parse HEAD`.
- [x] No new open-phase or unlanded-closeout tail is introduced.
- [x] The runbook `orchestrator/handoffs/N-2-MIGRATION-008-PRODUCTION-PLAN.md` is not part of this docs-only sync.

## Blocked Actions

- [ ] Do not apply Migration 008 without separate explicit production-action approval.
- [ ] Do not deploy.
- [ ] Do not run Railway commands.
- [ ] Do not query the production database.
- [ ] Do not read or write env or secrets.
- [ ] Do not change runtime code, migrations, scripts, package files, lockfiles, Node version files, deployment config, `position.json`, `MANUAL_LIVE_ARMED`, live Kraken paths, or safety-policy docs as part of this sync.
