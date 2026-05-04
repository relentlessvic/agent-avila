# Orchestrator Checklist

End-to-end progression for the Agent Avila dual-truth fix and surrounding orchestrator work.

## ARC Governance Activation (ARC-GO-LIVE) — Active

ARC-GO-LIVE is a DOCS-ONLY governance activation step. It is committed and pushed at `de91d325b8160fb8183cc26172e50f3f35831796` and activates ARC-1 through ARC-7 as the active control layer for Agent Avila. It does NOT authorize live trading, production mutation, migration application, deploy, runtime edits, or any RED-tier action; subsequent RED-tier actions still require their own per-action explicit Victor / CEO approval.

- [x] ARC-GO-LIVE: ARC-1 (`orchestrator/PROTECTED-FILES.md`) is active as the per-path SAFE / RESTRICTED / HARD BLOCK classification matrix.
- [x] ARC-GO-LIVE: ARC-2 (`orchestrator/APPROVAL-GATES.md`) is active as the 16-gate action-class matrix and "what is NOT operator approval" non-equivalence list.
- [x] ARC-GO-LIVE: ARC-3 (`orchestrator/PHASE-MODES.md`) is active as the six-mode phase-labeling system (READ-ONLY AUDIT / DESIGN-ONLY / DOCS-ONLY / SAFE IMPLEMENTATION / HIGH-RISK IMPLEMENTATION / PRODUCTION ACTION).
- [x] ARC-GO-LIVE: ARC-4 (`orchestrator/NEXT-ACTION-SELECTOR.md`) is active as the ten-rule next-action selector and master-order discipline.
- [x] ARC-GO-LIVE: ARC-5 (`orchestrator/ROLE-HIERARCHY.md`) is active as the role hierarchy (Victor / ChatGPT / Gemini / Claude / Codex + future-automation governance-only inheritance) and prompt-template source.
- [x] ARC-GO-LIVE: ARC-6 (`orchestrator/AUTOMATION-PERMISSIONS.md`) is active as the GREEN / YELLOW / RED three-tier automation-permission system covering Claude, Codex, ChatGPT, Gemini, Ruflo, Hermes, and any successor.
- [x] ARC-GO-LIVE: ARC-7 (`orchestrator/HANDOFF-RULES.md` + `orchestrator/handoffs/`) is active as the handoff packet rules and templates; packets cannot approve, cannot transport, and cannot trade.
- [x] ARC-GO-LIVE: ARC governance is not live trading and is not production mutation. Trading-runtime separation per `ROLE-HIERARCHY.md` and `AUTOMATION-PERMISSIONS.md` remains in force; the brains govern changes, they do not run the runtime.
- [x] ARC-GO-LIVE: Victor / CEO remains the sole final authority. No AI role (Claude, Codex, ChatGPT, Gemini, Ruflo, Hermes, successors) can self-approve. Codex PASS, clean `git status`, green tests, scheduled triggers, signed tokens, CI status, and LLM self-approval DO NOT satisfy any operator-approval gate.
- [x] ARC-GO-LIVE: N-phase production work remains blocked behind existing gates. N-3 remains halted/blocked behind runbook §11; Migration 008 remains NOT applied to production.
- [x] ARC-GO-LIVE: prior Victor production-action approvals naming `9ae139d` and `3138e7f` remain CONSUMED and cannot be reused. A fresh in-session approval naming the exact full latest committed HEAD from `git rev-parse HEAD` is required for any future N-3 attempt, after the post-commit deploy-and-verify cycle is complete.
- [x] ARC-GO-LIVE: future work must obey ARC-1 through ARC-7 without exception (phase modes, protected files, approval gates, next-action selector, role hierarchy, automation permissions, handoff rules); next work returns to the N-track only via the normal ARC-4 selector and ARC-2 gates.
- [x] ARC-GO-LIVE: activation committed and pushed at `de91d325b8160fb8183cc26172e50f3f35831796`.

## N-2x Migration 008 Runbook Track

All N-2x phases through N-2w are CLOSED (or, for N-2r, design-only PASS); N-2x is IN PROGRESS (DOCS-ONLY). The canonical detailed change history lives in `orchestrator/handoffs/N-2-MIGRATION-008-PRODUCTION-PLAN.md` §14; commit truth lives in `git log`.

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
| N-2s Check D Option A `.nvmrc=24.10.0` | CLOSED at `6c3a1e5` (now superseded by GitHub-tracked deploy at `49650f0…`) |
| N-2t deploy-method source-identity gating | CLOSED at `49650f077509d83dcbf3e9771dc9ca30f351e55b` |
| N-2u Codex Q10 freshness-invalidation runbook fix | CLOSED at `0a6974884849dd1eb6bdf4f88cb5d41085044612` |
| N-2v post-N-2u stale-tail repair + Check D re-verification record | CLOSED at `3c4777224dafd6c09c47004631c7c8ba538a2b3b` |
| N-2w single-line stale-tail repair on NEXT-ACTION.md:34 | CLOSED at `e7bce599df678222ab0a58f0a4f3cc9f562f509a` |
| N-2x operator-side preflight checker module-resolution rule + host/container command-boundary rule + N-3 attempt history back-fill (Attempts 3, 4) + §14 back-fill (N-2v, N-2w) | IN PROGRESS — DOCS-ONLY |

## N-3 State

- [x] N-3 attempt 1 at `9ae139d` halted before SQL execution.
- [x] N-3 attempt 2 at `3138e7f` halted before SQL execution.
- [x] Victor approval naming `9ae139d` is CONSUMED and cannot be reused.
- [x] Victor approval naming `3138e7f` is CONSUMED and cannot be reused.
- [x] All four prior Victor production-action approvals (`9ae139d`, `3138e7f`, `e7bce599df678222ab0a58f0a4f3cc9f562f509a` Attempt 3, `e7bce599df678222ab0a58f0a4f3cc9f562f509a` Attempt 4) remain CONSUMED and cannot be reused for N-3.
- [x] Migration 008 remains NOT applied to production.
- [x] N-3 remains halted/blocked behind the runbook §11 gate.
- [x] Next N-3 review must be a fresh Codex N-3 preflight on the runbook at the latest committed HEAD, using `git rev-parse HEAD` to identify that HEAD and `git log` for commit truth.
- [x] Fresh Codex N-3 preflight at HEAD `49650f077509d83dcbf3e9771dc9ca30f351e55b` completed on 2026-05-04 = **FAIL (Q10 freshness-invalidation gap)**. N-2u applies Codex's exact required wording to runbook §4(x)(b); N-3 remains blocked until Codex re-review PASS on the N-2u runbook plus deploy-and-verify cycle at the new post-N-2u HEAD plus a fresh Victor in-session production-action approval naming that new HEAD.
- [x] N-2u runbook re-review = **PASS** at HEAD `0a6974884849dd1eb6bdf4f88cb5d41085044612` (after three Codex-required corrections: apostrophe fix in §4(x)(b), §1 stale-clause repair, three CHECKLIST.md stale-tail repairs). N-2u committed and pushed to `origin/main`; GitHub-push-tracked Railway redeploy successful at deployment ID `3355d5ee`, status Active.
- [x] Fresh Codex N-3 preflight at HEAD `0a6974884849dd1eb6bdf4f88cb5d41085044612` completed on 2026-05-04 = **FAIL on Q3 (post-deploy state not yet recorded in status docs) and Q12 (Check D re-verification at that HEAD an open operator action per the freshness rule)**. N-2v applies the two Codex-required docs-only edits to STATUS.md and NEXT-ACTION.md, updates the phase tables, and records the operator's Check D re-verification.
- [x] **Operator Check D re-verification at HEAD `0a6974884849dd1eb6bdf4f88cb5d41085044612` = PASS** via `railway ssh` in-container `node --version` = `v24.10.0` (normalized `24.10.0`, byte-for-byte equal to `.nvmrc`). Container `root@ee8605893ce8:/app`; `pwd` = `/app`; `.nvmrc` present in `/app` (`-rw-r--r-- 1 root root 8 May 3 23:26 .nvmrc`). Per the §4(x)(b) freshness rule, this re-verification will be invalidated by the next intervening deploy.
- [x] Post-N-2v Check D re-verification at HEAD `3c4777224dafd6c09c47004631c7c8ba538a2b3b` = PASS via `railway ssh` (in-container `node --version` = `v24.10.0` byte-for-byte = `.nvmrc`).
- [x] Post-N-2v fresh Codex N-3 preflight at HEAD `3c47772...` = PASS WITH REQUIRED EDITS (NEXT-ACTION.md:34 stale line); N-2w fixed it.
- [x] Post-N-2w fresh Codex N-3 preflight at HEAD `e7bce59...` = clean PASS. Victor approval naming HEAD `e7bce59...` granted for Attempt 3.
- [x] **Attempt 3 HALTED before SQL.** Halt class: pre-SQL operator-side preflight tooling failure (Claude-supplied checker at `/tmp` could not resolve `/app/node_modules/pg`). Runner never invoked; no DB write; approval CONSUMED.
- [x] Post-attempt-3 fresh Codex N-3 preflight at HEAD `e7bce59...` = PASS Path A (operator-side discipline sufficient); Victor approval naming HEAD `e7bce59...` granted for Attempt 4.
- [x] **Attempt 4 HALTED before SQL.** Halt class: pre-SQL operator-side preflight tooling failure RECURRENCE (same `/tmp` module-resolution issue) + host-vs-container command confusion. Runner never invoked; no DB write; approval CONSUMED.
- [x] Post-attempt-4 fresh Codex N-3 preflight at HEAD `e7bce59...` = PASS WITH REQUIRED EDITS — Path B selected — N-2x runbook tightening required to codify the `/app` module-resolution rule and host/container command-boundary distinction as runbook substance.
- [ ] Post-N-2x: a fresh Check D re-verification at the post-N-2x deployed HEAD (per `git rev-parse HEAD` after commit and push), a fresh Codex N-3 preflight at that same HEAD, and a fresh Victor in-session production-action approval naming that exact full HEAD are all required before Attempt 5.

## Carry-Forward Execution Checks

- [ ] **Approval-gate separation confirmed:** N-2s commit-time approval authorized only committing `.nvmrc` + three status docs; it did NOT authorize deploy (gate 5, separately approved); it did NOT authorize N-3. N-2t commit-time approval authorizes only committing the runbook + three status docs; it does NOT authorize deploy; it does NOT authorize N-3.
- [ ] **N-2t deploy-method source-identity gating:** the currently-running deploy of `agent-avila-dashboard` was triggered by `railway up` and exposes no commit SHA on any non-secret Railway surface. Per runbook §3 (N-2t) and §4(x)(a) GAP-D Case 2 (tightened in N-2t), `railway up` deploys without a verifiable full 40-character commit SHA are REJECTED as a valid §4(x)(a) source-identity surface for N-3. Image digest, deployment ID, timestamp, and operator-attested mapping are NOT commit SHAs. **The next N-3 attempt requires a GitHub-push-tracked deploy** (or any equivalent that produces a Railway-recorded commit SHA on a non-secret surface).
- [ ] **Path Z block at HEAD `6c3a1e5`:** Path Z (N-3 against currently-deployed HEAD via Option E) is structurally blocked by the N-2t deploy-method rejection until a GitHub-tracked deploy produces a commit-SHA-recording deployment.
- [x] **Check D — repo-side pin in place via Option A.** Repo-root `.nvmrc` containing exact normalized value `24.10.0` is committed at HEAD `6c3a1e5` (local-only; not yet pushed); satisfies runbook §4(x)(b) source priority 1. Pin matches the deployed runtime as captured at fact-finding time (in-container `node --version` returned `v24.10.0` from a `railway ssh` session into the production `agent-avila-dashboard` container). `package.json` `engines.node` remains the non-exact range `">=18.0.0"`, unchanged. **Verified PASS at deployed HEAD `49650f077509d83dcbf3e9771dc9ca30f351e55b` on 2026-05-04** via Web UI deploy-identity capture (GitHub-push-tracked) plus `railway ssh` in-container `node --version` = `v24.10.0` byte-for-byte match against `.nvmrc`. Freshness invalidation rule (per N-2u) remains in force.
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
- [x] No new open-phase or unlanded-closeout tail is introduced for N-2x.
- [x] The runbook `orchestrator/handoffs/N-2-MIGRATION-008-PRODUCTION-PLAN.md` IS part of this N-2x commit (Codex Q12 Path B operator-side preflight checker module-resolution rule + host/container command-boundary rule appended in §4(vii); §1.1 N-3 attempt history back-fill for Attempts 3 and 4; §14 history back-fill for N-2v / N-2w / N-2x; §1 / §9 / §11 phase-label updates). The runbook's §4(vii) connectivity-preflight base content, §4(x)(b) `.nvmrc` source-priority list / canonical-source rule / parsing-hygiene rule / freshness-invalidation rule (codified in N-2u), and HALT-on-disagreement rules remain unchanged; §4(vii) is extended (not weakened) by the N-2x preflight-checker-script rule.

## P2 Informational (post-N-2q findings)

- **`package.json:8` declares `"start": "node bot.js"` but Railway/Nixpacks runs `node dashboard.js`.** Service-side override (Railway custom start command, or Nixpacks-detected entry) reconciles the difference. Not material to Check D or §11 N-3 gate; tracked for future audit.
- **`railway shell` is NOT the approved deployed-runtime-shell surface.** `railway shell` opens a local subshell with Railway env vars injected (in-shell `node --version` returns operator's local Node, not the deployed runtime). Same REJECTED category as `railway run`, per runbook §3 N-2n rejection of local-injection surfaces. The approved primary N-3 execution surface is `railway ssh` into the deployed `agent-avila-dashboard` container; N-2o GAP-A four conditions empirically PASS for that surface. (A separately scoped runbook-tightening phase could add an explicit "rejects `railway shell`" line to runbook §3 alongside the existing `railway run` rejection; deferred.)
- **Active builder confirmed: Nixpacks v1.41.0** (Railway build log header). Nixpacks documents Node major-version control only; the deployed exact patch is determined by Nixpacks's current Node 24 selection at deploy time and is observable from in-container `node --version`. The N-2r-preflight freshness rule applies — patch may shift on future Nixpacks updates.

## P2 Informational (N-2t findings)

- **`railway up` deploys do NOT record a commit SHA on Railway's non-secret surfaces.** The currently-running production deploy of `agent-avila-dashboard` was triggered by `railway up` (per the project's documented deploy command at `package.json:14`). The Railway dashboard exposes deployment ID, image digest, build provenance, timestamp, and start command — but no commit SHA. Both Cases of §4(x)(a) GAP-D fail for the current deploy: Case 1 (in-container `git rev-parse HEAD`) returned `fatal: not a git repository` because the deployed NIXPACKS container lacks `.git/` metadata (binary `/bin/git` exists; metadata does not); Case 2 (Railway deploy-metadata fallback) returned no commit SHA.
- **N-2t codifies the rule:** deploys lacking a verifiable full 40-character commit SHA on a non-secret Railway deploy-metadata surface are REJECTED as a valid §4(x)(a) source-identity surface for N-3 (mirrors N-2n / N-2o rejection patterns for local-injection surfaces). Approved N-3 deploy path is GitHub-push-tracked deploys (or equivalent commit-SHA-recording deploys).
- **Approved next-step sequence (after N-2x commit):** Codex re-review PASS on the N-2x four-file docs diff → operator approves N-2x commit → commit lands at a new HEAD → push to GitHub `origin/main` (GitHub-push-tracked deploy method per N-2t) → allow Railway auto-deploy (or scoped manual deploy approval) for the GitHub-tracked deploy → verify deployed commit SHA + in-container `node --version` matches `.nvmrc` + service health (per the N-2u-codified §4(x)(b) freshness rule) → fresh Codex N-3 preflight at the new HEAD → fresh Victor in-session production-action approval naming the new HEAD → Attempt 5 from a fresh `railway ssh` session per the N-2m same-session rule, with corrected operator-side preflight tooling discipline per the N-2x §4(vii) rule (checker scripts under `/app`, not `/tmp`; host-side commands not pasted into the railway ssh container shell).

## Blocked Actions

- [ ] Do not apply Migration 008 without separate explicit production-action approval.
- [ ] Do not deploy.
- [ ] Do not run Railway commands.
- [ ] Do not query the production database.
- [ ] Do not read or write env or secrets.
- [ ] Do not change runtime code, migrations, scripts, package files, lockfiles, Node version files, deployment config, `position.json`, `MANUAL_LIVE_ARMED`, live Kraken paths, or safety-policy docs as part of this sync.
