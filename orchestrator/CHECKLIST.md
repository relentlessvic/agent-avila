# Orchestrator Checklist

End-to-end progression for the Agent Avila dual-truth fix and surrounding orchestrator work.

## ARC Governance Activation (ARC-GO-LIVE)

ARC-GO-LIVE is a DOCS-ONLY governance activation step. It activates ARC-1 through ARC-7 as the active control layer for Agent Avila. It does NOT authorize live trading, production mutation, migration application, deploy, runtime edits, or commit. It is a draft pending Codex docs-only review and explicit Victor / CEO approval.

- [ ] ARC-GO-LIVE: confirm ARC-1 (`orchestrator/PROTECTED-FILES.md`) is active as the per-path SAFE / RESTRICTED / HARD BLOCK classification matrix.
- [ ] ARC-GO-LIVE: confirm ARC-2 (`orchestrator/APPROVAL-GATES.md`) is active as the 16-gate action-class matrix and "what is NOT operator approval" non-equivalence list.
- [ ] ARC-GO-LIVE: confirm ARC-3 (`orchestrator/PHASE-MODES.md`) is active as the six-mode phase-labeling system (READ-ONLY AUDIT / DESIGN-ONLY / DOCS-ONLY / SAFE IMPLEMENTATION / HIGH-RISK IMPLEMENTATION / PRODUCTION ACTION).
- [ ] ARC-GO-LIVE: confirm ARC-4 (`orchestrator/NEXT-ACTION-SELECTOR.md`) is active as the ten-rule next-action selector and master-order discipline.
- [ ] ARC-GO-LIVE: confirm ARC-5 (`orchestrator/ROLE-HIERARCHY.md`) is active as the role hierarchy (Victor / ChatGPT / Gemini / Claude / Codex + future-automation governance-only inheritance) and prompt-template source.
- [ ] ARC-GO-LIVE: confirm ARC-6 (`orchestrator/AUTOMATION-PERMISSIONS.md`) is active as the GREEN / YELLOW / RED three-tier automation-permission system covering Claude, Codex, ChatGPT, Gemini, Ruflo, Hermes, and any successor.
- [ ] ARC-GO-LIVE: confirm ARC-7 (`orchestrator/HANDOFF-RULES.md` + `orchestrator/handoffs/`) is active as the handoff packet rules and templates; packets cannot approve, cannot transport, and cannot trade.
- [ ] ARC-GO-LIVE: confirm ARC governance is not live trading and is not production mutation. Trading-runtime separation per `ROLE-HIERARCHY.md` and `AUTOMATION-PERMISSIONS.md` remains in force; the brains govern changes, they do not run the runtime.
- [ ] ARC-GO-LIVE: confirm Victor / CEO remains the sole final authority. No AI role (Claude, Codex, ChatGPT, Gemini, Ruflo, Hermes, successors) can self-approve. Codex PASS, clean `git status`, green tests, scheduled triggers, signed tokens, CI status, and LLM self-approval DO NOT satisfy any operator-approval gate.
- [ ] ARC-GO-LIVE: confirm N-phase production work remains blocked behind existing gates. N-3 remains halted/blocked behind runbook §11; Migration 008 remains NOT applied to production.
- [ ] ARC-GO-LIVE: confirm prior Victor production-action approvals naming `9ae139d` and `3138e7f` remain CONSUMED and cannot be reused. A fresh in-session approval naming the exact full latest committed HEAD from `git rev-parse HEAD` is required for any future N-3 attempt, after the post-commit deploy-and-verify cycle is complete.
- [ ] ARC-GO-LIVE: confirm future work must obey ARC-1 through ARC-7 without exception (phase modes, protected files, approval gates, next-action selector, role hierarchy, automation permissions, handoff rules).
- [ ] ARC-GO-LIVE: Codex docs-only review on the activation status-doc updates (STATUS.md / CHECKLIST.md / NEXT-ACTION.md).
- [ ] ARC-GO-LIVE: explicit Victor / CEO approval before any commit of the activation status-doc updates.

## N-2x Migration 008 Runbook Track

All N-2x phases through N-2s are CLOSED (or, for N-2r, design-only PASS). The canonical detailed change history lives in `orchestrator/handoffs/N-2-MIGRATION-008-PRODUCTION-PLAN.md` §14; commit truth lives in `git log`.

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
| N-2r Check D Node exact-pin gap (design-only) | PASS at second design review (no commit) |
| N-2s Check D Option A `.nvmrc=24.10.0` | CLOSED at `6c3a1e5` (local-only; not yet pushed) |

## N-3 State

- [x] N-3 attempt 1 at `9ae139d` halted before SQL execution.
- [x] N-3 attempt 2 at `3138e7f` halted before SQL execution.
- [x] Victor approval naming `9ae139d` is CONSUMED and cannot be reused.
- [x] Victor approval naming `3138e7f` is CONSUMED and cannot be reused.
- [x] Migration 008 remains NOT applied to production.
- [x] N-3 remains halted/blocked behind the runbook §11 gate.
- [x] Next N-3 review must be a fresh Codex N-3 preflight on the runbook at the latest committed HEAD, using `git rev-parse HEAD` to identify that HEAD and `git log` for commit truth.

## Carry-Forward Execution Checks

- [ ] **Approval-gate separation confirmed:** N-2s commit-time approval authorized only committing `.nvmrc` + three status docs; it did NOT authorize deploy (gate 5, separately approved); it did NOT authorize N-3. N-2t commit-time approval authorizes only committing the runbook + three status docs; it does NOT authorize deploy; it does NOT authorize N-3.
- [ ] **N-2t deploy-method source-identity gating:** the currently-running deploy of `agent-avila-dashboard` was triggered by `railway up` and exposes no commit SHA on any non-secret Railway surface. Per runbook §3 (N-2t) and §4(x)(a) GAP-D Case 2 (tightened in N-2t), `railway up` deploys without a verifiable full 40-character commit SHA are REJECTED as a valid §4(x)(a) source-identity surface for N-3. Image digest, deployment ID, timestamp, and operator-attested mapping are NOT commit SHAs. **The next N-3 attempt requires a GitHub-push-tracked deploy** (or any equivalent that produces a Railway-recorded commit SHA on a non-secret surface).
- [ ] **Path Z block at HEAD `6c3a1e5`:** Path Z (N-3 against currently-deployed HEAD via Option E) is structurally blocked by the N-2t deploy-method rejection until a GitHub-tracked deploy produces a commit-SHA-recording deployment.
- [x] **Check D — repo-side pin in place via Option A.** Repo-root `.nvmrc` containing exact normalized value `24.10.0` is committed at HEAD `6c3a1e5` (local-only; not yet pushed); satisfies runbook §4(x)(b) source priority 1. Pin matches the deployed runtime as captured at fact-finding time (in-container `node --version` returned `v24.10.0` from a `railway ssh` session into the production `agent-avila-dashboard` container). `package.json` `engines.node` remains the non-exact range `">=18.0.0"`, unchanged.
- [ ] **Deployed-runtime verification (post-commit deploy-and-verify cycle, per N-2r design):** after the new HEAD is deployed to `agent-avila-dashboard` (auto-deploy or separately scoped deploy approval — gate 5 per `orchestrator/APPROVAL-GATES.md`, NOT authorized by any N-2x docs commit), operator verifies via `railway ssh` after the redeploy reaches RUNNING: deployed commit SHA equals the new approved HEAD byte-for-byte; in-container `node --version` matches `.nvmrc` byte-for-byte after parsing-hygiene normalization; deployed service healthy. HALT and re-pin in a separately scoped phase if any check fails.
- [ ] **N-2r-preflight freshness:** runtime-version capture used to set `.nvmrc` remains valid only if no intervening deploy, builder change, service/environment scope switch, inability to identify running deployment SHA, or Nixpacks Node-provider patch update has occurred since capture. If freshness is broken, operator re-runs in-container `node --version` capture and updates `.nvmrc` in a separately scoped phase before any N-3 attempt.
- [ ] Fresh Codex N-3 preflight PASS on the latest committed HEAD (after deploy-and-verify cycle complete).
- [ ] Fresh Victor in-session production-action approval naming the exact full latest committed HEAD from `git rev-parse HEAD`.
- [ ] All eleven runbook §4 pre-flight checks (i) through (xi) PASS at execution time, performed in the same `railway ssh` session as the runner invocation per the N-2m same-session rule.
- [ ] Target Railway service and production database confirmation completed without exposing secrets.
- [ ] Migration 008 applied only after the runbook §11 gate is fully satisfied.

## Docs-Only Closeout Verification

- [x] Status docs reference the latest committed HEAD via `git rev-parse HEAD` rather than embedding stale "current HEAD" claims (per N-2q stale-proof pattern).
- [x] Active stale wording about open-work state or incomplete closeout items is absent.
- [x] Next-action language is stale-proof: it points to a fresh Codex N-3 preflight on the latest committed HEAD, canonical runbook §11, `git log`, and `git rev-parse HEAD`.
- [x] No new open-phase or unlanded-closeout tail is introduced for N-2t.
- [x] The runbook `orchestrator/handoffs/N-2-MIGRATION-008-PRODUCTION-PLAN.md` IS part of this N-2t commit (deploy-method gating in §3, §4(x)(a) Case 2 tightening, §1 / §9 / §11 / §14 phase-discipline updates). The runbook's §4(x)(b) `.nvmrc` source rule and HALT-on-disagreement remain unchanged.

## P2 Informational (post-N-2q findings)

- **`package.json:8` declares `"start": "node bot.js"` but Railway/Nixpacks runs `node dashboard.js`.** Service-side override (Railway custom start command, or Nixpacks-detected entry) reconciles the difference. Not material to Check D or §11 N-3 gate; tracked for future audit.
- **`railway shell` is NOT the approved deployed-runtime-shell surface.** `railway shell` opens a local subshell with Railway env vars injected (in-shell `node --version` returns operator's local Node, not the deployed runtime). Same REJECTED category as `railway run`, per runbook §3 N-2n rejection of local-injection surfaces. The approved primary N-3 execution surface is `railway ssh` into the deployed `agent-avila-dashboard` container; N-2o GAP-A four conditions empirically PASS for that surface. (A separately scoped runbook-tightening phase could add an explicit "rejects `railway shell`" line to runbook §3 alongside the existing `railway run` rejection; deferred.)
- **Active builder confirmed: Nixpacks v1.41.0** (Railway build log header). Nixpacks documents Node major-version control only; the deployed exact patch is determined by Nixpacks's current Node 24 selection at deploy time and is observable from in-container `node --version`. The N-2r-preflight freshness rule applies — patch may shift on future Nixpacks updates.

## P2 Informational (N-2t findings)

- **`railway up` deploys do NOT record a commit SHA on Railway's non-secret surfaces.** The currently-running production deploy of `agent-avila-dashboard` was triggered by `railway up` (per the project's documented deploy command at `package.json:14`). The Railway dashboard exposes deployment ID, image digest, build provenance, timestamp, and start command — but no commit SHA. Both Cases of §4(x)(a) GAP-D fail for the current deploy: Case 1 (in-container `git rev-parse HEAD`) returned `fatal: not a git repository` because the deployed NIXPACKS container lacks `.git/` metadata (binary `/bin/git` exists; metadata does not); Case 2 (Railway deploy-metadata fallback) returned no commit SHA.
- **N-2t codifies the rule:** deploys lacking a verifiable full 40-character commit SHA on a non-secret Railway deploy-metadata surface are REJECTED as a valid §4(x)(a) source-identity surface for N-3 (mirrors N-2n / N-2o rejection patterns for local-injection surfaces). Approved N-3 deploy path is GitHub-push-tracked deploys (or equivalent commit-SHA-recording deploys).
- **Approved next-step sequence (Path X resumption after N-2t commit):** restore local DNS connectivity → push N-2s (`6c3a1e5`) to GitHub → allow Railway auto-deploy (or scoped manual deploy approval) for the GitHub-tracked deploy → verify deployed commit SHA + in-container `node --version` matches `.nvmrc` + service health → fresh Codex N-3 preflight at the new HEAD → fresh Victor in-session production-action approval naming the new HEAD → N-3 attempt from a fresh `railway ssh` session per the N-2m same-session rule.

## Blocked Actions

- [ ] Do not apply Migration 008 without separate explicit production-action approval.
- [ ] Do not deploy.
- [ ] Do not run Railway commands.
- [ ] Do not query the production database.
- [ ] Do not read or write env or secrets.
- [ ] Do not change runtime code, migrations, scripts, package files, lockfiles, Node version files, deployment config, `position.json`, `MANUAL_LIVE_ARMED`, live Kraken paths, or safety-policy docs as part of this sync.
