# Next Allowed Action

Single source of truth for what Claude should do next. Read this before doing anything.

## Right Now

**N-3 remains halted/blocked. Migration 008 remains NOT applied to production.**

All N-2x phases through N-2p are CLOSED, including **N-2p CLOSED at `ddca950`**:

`N-2b e6c9189` -> `N-2c 9ae139d` -> `N-2d 3732721` -> `N-2e afe94d1` -> `N-2f 3af1e44` -> `N-2g 926eb7f` -> `N-2h ea7774d` -> `N-2i 5ee1dcb` -> `N-2j 548383b` -> `N-2k b2d187d` -> `N-2l 3138e7f` -> `N-2m 6b9be1d` -> `N-2n 8fc53b9` -> `N-2o f925ac5` -> `N-2p ddca950`.

The next allowed action is a **fresh Codex N-3 preflight review of the runbook at the latest committed HEAD**. Use the runbook at the latest committed HEAD (per `git rev-parse HEAD`), the canonical gate in `orchestrator/handoffs/N-2-MIGRATION-008-PRODUCTION-PLAN.md` §11, and `git log` for commit truth.

## Required Gate State

Before any N-3 production-action attempt:

- Fresh Codex N-3 preflight must PASS on the latest committed HEAD.
- Fresh Victor in-session production-action approval must name the exact full latest committed HEAD from `git rev-parse HEAD`.
- Both prior Victor approvals, naming `9ae139d` and `3138e7f`, remain CONSUMED and cannot be reused.
- All eleven runbook §4 pre-flight checks (i) through (xi) must PASS at execution time.
- Check D must be resolved before execution.
- Target Railway service and production database confirmation must be completed without exposing secrets.

## Check D

**Check D remains UNRESOLVED.** `package.json` `engines.node` is the non-exact range `">=18.0.0"`, and no `.nvmrc`, `.node-version`, or Volta config is present. The runbook §4(x)(b) exact Node version requirement must be satisfied by the operator before execution, either through a separately scoped repo change or through a separately approved non-secret exact-version label allowed by §4(x)(b).

## Do Not Do

Do not apply migrations, deploy, run Railway commands, query the production database, read or write env/secrets, change `MANUAL_LIVE_ARMED`, touch live Kraken paths, edit runtime code, edit migrations/scripts, edit package or lock files, add Node version files, edit deployment config, edit `position.json`, or edit safety-policy docs unless separately authorized.

The Migration 008 runbook `orchestrator/handoffs/N-2-MIGRATION-008-PRODUCTION-PLAN.md` is not part of this docs-only status sync and remains the canonical runbook for N-3.

## Stale-Proofing Note

This file intentionally avoids active open-phase and unlanded-closeout language. Future execution state is resolved through the latest committed HEAD from `git rev-parse HEAD`, commit history from `git log`, and the canonical N-3 gate in runbook §11.
