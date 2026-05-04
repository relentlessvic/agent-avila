# Orchestrator Status

Last updated: 2026-05-03

## Current Phase State

**N-3 remains halted/blocked. Migration 008 remains NOT applied to production.**

All N-2x phases through N-2q are CLOSED at the following commits:

| Phase | Status |
|---|---|
| N-2 | Design review PASS WITH REQUIRED EDITS |
| N-2b | CLOSED at `e6c9189` |
| N-2c | CLOSED at `9ae139d` |
| N-2d | CLOSED at `3732721` |
| N-2e | CLOSED at `afe94d1` |
| N-2f | CLOSED at `3af1e44` |
| N-2g | CLOSED at `926eb7f` |
| N-2h | CLOSED at `ea7774d` |
| N-2i | CLOSED at `5ee1dcb` |
| N-2j | CLOSED at `548383b` |
| N-2k | CLOSED at `b2d187d` |
| N-2l | CLOSED at `3138e7f` |
| N-2m | CLOSED at `6b9be1d` |
| N-2n | CLOSED at `8fc53b9` |
| N-2o | CLOSED at `f925ac5` |
| N-2p | CLOSED at `ddca950` |
| N-2q | CLOSED at `29ac7d7` |

Per-phase N-2x change history is canonical in `orchestrator/handoffs/N-2-MIGRATION-008-PRODUCTION-PLAN.md` §14. Commit identity is canonical in `git log` and the latest committed HEAD is determined by `git rev-parse HEAD`.

## N-3 Gate

The next allowed action is a **fresh Codex N-3 preflight review of the runbook at the latest committed HEAD**, using the runbook at the latest committed HEAD (per `git rev-parse HEAD`) and the canonical runbook gate in `orchestrator/handoffs/N-2-MIGRATION-008-PRODUCTION-PLAN.md` §11.

Before any N-3 production-action attempt, all §11 gate conditions must be satisfied at the same committed HEAD:

- Codex PASS on the latest committed runbook update.
- Fresh Codex N-3 preflight PASS on that same latest committed HEAD.
- Fresh Victor in-session production-action approval naming the exact full HEAD from `git rev-parse HEAD`.
- All eleven §4 pre-flight checks (i) through (xi) PASS at execution time.
- Target Railway service and production database confirmation without exposing secrets.

Both prior Victor production-action approvals are **CONSUMED** and cannot be reused:

- Approval naming `9ae139d` was consumed by N-3 attempt 1, which halted before SQL execution.
- Approval naming `3138e7f` was consumed by N-3 attempt 2, which halted before SQL execution.

## Required Carry-Forward Gaps

**Check D — repo-side pin in place via Option A.** A repo-root `.nvmrc` containing the exact normalized value `24.10.0` is committed, satisfying runbook §4(x)(b) source priority 1 (highest). The pin matches the deployed runtime as captured at fact-finding time: in-container `node --version` from a `railway ssh` session into the production `agent-avila-dashboard` container returned `v24.10.0`, normalized per the §4(x)(b) parsing-hygiene rule (strip leading `v`, strip trailing whitespace / newlines) to `24.10.0`. `package.json` `engines.node` remains the non-exact range `">=18.0.0"` and is unchanged in this phase; per the canonical-source rule the highest-priority present source (`.nvmrc`) is canonical, with HALT-on-disagreement against any other present source.

**Deployed-runtime verification is still required before any N-3 attempt.** Post-commit deploy-and-verify cycle (per N-2r design):

**N-2s commit-time approval authorizes only the four-file commit (`.nvmrc` + three status docs); it does NOT authorize a deploy (deploy is gate 5 per `orchestrator/APPROVAL-GATES.md`, separately approved), and it does NOT authorize N-3.**

- After the new HEAD is deployed to `agent-avila-dashboard` (auto-deploy or separately scoped deploy approval — gate 5 per `orchestrator/APPROVAL-GATES.md`, not authorized by any N-2x docs commit), the operator MUST verify, via `railway ssh` into the deployed container after the redeploy reaches RUNNING:
  - The deployed commit SHA equals the new approved HEAD byte-for-byte (in-container `git rev-parse HEAD` if available — Case 1 per N-2o GAP-D — OR Railway dashboard "Deployed Commit" full 40-character SHA if `git` unavailable in container — Case 2).
  - In-container `node --version` matches `.nvmrc` byte-for-byte after parsing-hygiene normalization.
  - Deployed service is healthy (no crash loops, no rolling-deploy state).
- HALT if any of the above is false. Re-run an N-2r-preflight freshness check and update `.nvmrc` in a separately scoped phase before any N-3 attempt.

**N-2r-preflight freshness rule (per N-2r design).** The runtime-version capture used to set `.nvmrc` is invalidated by: an intervening deploy of `agent-avila-dashboard` between capture and the next N-3 attempt; a builder change (Nixpacks → Railpack or vice versa); a service / environment scope switch (non-production capture); inability to identify the running deployment SHA at capture time; or any Nixpacks Node provider version update that ships a new Node 24 patch. If freshness is broken, the operator MUST re-run in-container `node --version` capture in a fresh `railway ssh` session and update `.nvmrc` before any N-3 attempt. Stale `.nvmrc` values that disagree with the deployed runtime would HALT N-3 at §4(x)(b); freshness violation is a maintenance issue, not a safety issue, but maintenance must precede the next N-3 attempt window.

**Active builder confirmed: Nixpacks v1.41.0** (Railway build log header). Nixpacks documents Node major-version control only; the deployed exact patch is determined at deploy time and is observable from in-container `node --version` (per the N-2r-preflight finding above).

**Approved primary N-3 execution surface confirmed: `railway ssh` into the deployed `agent-avila-dashboard` production container.** N-2o GAP-A four conditions empirically PASS (surface available; running container; key setup OK; usable shell binary). **`railway shell` is NOT the approved surface** — `railway shell` opens a local subshell with Railway env vars injected (in-shell `node --version` returns the operator's local Node, not the deployed runtime), placing it in the same REJECTED category as `railway run` (per runbook §3 N-2n rejection of local-injection surfaces).

**P2 informational item:** `package.json:8` declares `"start": "node bot.js"` but the deployed `agent-avila-dashboard` service is observed running `node dashboard.js` (per Railway build log). A service-side override (Railway custom start command, or Nixpacks-detected entry) reconciles the difference. Not material to Check D or the §11 N-3 gate; tracked here for future audit.

**Migration 008 remains NOT applied to production.** No migration application, production DB query, deploy, Railway command, live Kraken action, env/secret read or write, `MANUAL_LIVE_ARMED` change, package/lockfile edit, runtime edit, or `position.json` change is authorized by this status.

## Closeout Note

This status file is intentionally stale-proof for post-commit closeout use: it does not name an active N-2x work item or describe an unlanded closeout. Future N-3 work resolves through `git rev-parse HEAD`, `git log`, and runbook §11 as the canonical sources after any later commit.
