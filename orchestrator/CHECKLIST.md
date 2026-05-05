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
- [x] ARC-GO-LIVE: N-phase production work was confirmed blocked behind existing gates at activation; as of 2026-05-04, N-3 has advanced through the proper §11 gate via Attempt 6 SUCCESS at HEAD `189eb1be6ef6304d914671bdaedec44d389cf877`, and Migration 008 is APPLIED to production. ARC-GO-LIVE did not bypass the N-3 gate; the gate was satisfied through the proper N-3 sequence.
- [x] ARC-GO-LIVE: all six prior Victor production-action approvals (`9ae139d`, `3138e7f`, `e7bce59…` Attempt 3, `e7bce59…` Attempt 4, `726b2e3…` Attempt 5, `189eb1b…` Attempt 6 — succeeded) are CONSUMED and cannot be reused. Migration 009+ would require a separate in-session approval naming the exact full HEAD from `git rev-parse HEAD` at that future time, after a separate post-commit deploy-and-verify cycle.
- [x] ARC-GO-LIVE: future work must obey ARC-1 through ARC-7 without exception (phase modes, protected files, approval gates, next-action selector, role hierarchy, automation permissions, handoff rules); next work returns to the N-track only via the normal ARC-4 selector and ARC-2 gates.
- [x] ARC-GO-LIVE: activation committed and pushed at `de91d325b8160fb8183cc26172e50f3f35831796`.

## ARC-8 Activation (ARC-8-DOCS-B) — In Progress

ARC-8-DOCS-A closed at `c8dc4f4547ce34531cde44dbe61315cae7aa5661` (Controlled Autopilot Builder System spec — `orchestrator/AUTOPILOT-RULES.md` ARC-8 extension + 10 cross-reference updates; autopilot runtime NOT activated). ARC-8-DOCS-B (this phase) writes the autopilot template set the autopilot system needs to operate uniformly. ARC-8-DOCS-B does NOT authorize autopilot runtime activation, scheduler installation, MCP/webhook installation, Discord-bot installation, or any RED-tier action.

- [ ] ARC-8-DOCS-B: 5 new handoff packet templates written under `orchestrator/handoffs/`: `AUTOPILOT-DISCORD-STATUS.md` (Channel 2 status format), `AUTOPILOT-DISCORD-APPROVAL.md` (Channel 1 approval format), `AUTOPILOT-PHASE-CANDIDATE.md` (Loop B output format), `AUTOPILOT-DRY-RUN-REPORT.md` (ARC-8-RUN-A output format), `AUTOPILOT-HALT.md` (stop-condition surface).
- [ ] ARC-8-DOCS-B: 3 existing handoff packet templates extended with autopilot-fillable sections: `CODEX-REVIEW-PACKET.md`, `OPERATOR-APPROVAL-PACKET.md`, `CLOSEOUT-PACKET.md` (existing structure preserved verbatim; autopilot-fillable section appended).
- [ ] ARC-8-DOCS-B: 4 new prompt templates written under `orchestrator/prompts/`: `AUTOPILOT-LOOP-A-SENSE.md`, `AUTOPILOT-LOOP-B-DECIDE.md`, `AUTOPILOT-LOOP-C-DRAFT.md`, `AUTOPILOT-LOOP-D-APPROVE-EXECUTE-REPORT.md` (each is a documentation prompt template — describes WHAT autopilot should do, not a script that DOES it).
- [ ] ARC-8-DOCS-B: STATUS.md updated with ARC-8-DOCS-B in-progress entry, phase-table close ARC-8-DOCS-A / open ARC-8-DOCS-B, Closeout Note rewrite.
- [ ] ARC-8-DOCS-B: CHECKLIST.md updated with ARC-8-DOCS-B checklist (this section), phase-table close ARC-8-DOCS-A / open ARC-8-DOCS-B.
- [ ] ARC-8-DOCS-B: NEXT-ACTION.md updated with ARC-8-DOCS-B current-phase summary and phase chain extension.
- [ ] ARC-8-DOCS-B: ARC-8 autopilot runtime remains DORMANT after ARC-8-DOCS-B commits and pushes; no scheduler / webhook / MCP / cron / Discord-bot installed; no autopilot execution authority granted; no autopilot-driven phase active.
- [ ] ARC-8-DOCS-B: scope confirmed exactly the 15 files (5 new + 3 extended handoff packet templates + 4 new prompt templates + 3 status doc updates); no runtime / migration / script / package.json / lockfile / .nvmrc / .env* / position.json / deploy-config / safety-policy file is modified by this phase beyond the three status docs and the named handoff/prompt templates.
- [ ] ARC-8-DOCS-B: ARC-8-DOCS-A safety-policy docs (AUTOPILOT-RULES.md, AUTOMATION-PERMISSIONS.md, NEXT-ACTION-SELECTOR.md, HANDOFF-RULES.md, ROLE-HIERARCHY.md, PHASE-MODES.md, PROTECTED-FILES.md, CLAUDE.md) NOT modified by this phase (per ARC-8 self-modification HARD BLOCK).
- [ ] ARC-8-DOCS-B: Migration 008 runbook (`orchestrator/handoffs/N-2-MIGRATION-008-PRODUCTION-PLAN.md`) NOT modified; N-3 is closed.
- [ ] ARC-8-DOCS-B: ARC-8-RUN-A (first autopilot dry-run on a low-risk read-only phase) remains DEFERRED to a separate future operator approval; ARC-8-DOCS-B does NOT authorize ARC-8-RUN-A.
- [ ] ARC-8-DOCS-B: pending Codex docs-only review (mandatory per `orchestrator/PROTECTED-FILES.md` SAFE-class governance doc rule and `orchestrator/HANDOFF-RULES.md` packet rules); pending operator approval to commit; pending separate operator approval to push.

## N-2x Migration 008 Runbook Track

All N-2x phases through ARC-8-DOCS-A are CLOSED (or, for N-2r, design-only PASS); ARC-8-DOCS-B is IN PROGRESS (DOCS-ONLY autopilot-template phase). **Migration 008 is APPLIED to production at HEAD `189eb1be6ef6304d914671bdaedec44d389cf877` (Attempt 6 — 2026-05-04, runner exit 0). N-3 is closed. Autopilot runtime remains DORMANT.** The canonical detailed change history lives in `orchestrator/handoffs/N-2-MIGRATION-008-PRODUCTION-PLAN.md` §14; commit truth lives in `git log`. ARC-8 (Controlled Autopilot Builder System) extension is canonical in `orchestrator/AUTOPILOT-RULES.md` ARC-8 section; the autopilot template set is canonical in `orchestrator/handoffs/AUTOPILOT-*.md` and `orchestrator/prompts/AUTOPILOT-LOOP-*.md`.

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
| N-2x operator-side preflight checker module-resolution rule + host/container command-boundary rule + N-3 attempt history back-fill (Attempts 3, 4) + §14 back-fill (N-2v, N-2w) | CLOSED at `726b2e33988b4ea4f31f94a3361144d3ce8e8fac` |
| N-2y operator-side preflight checker module-format rule (ESM/CommonJS) + N-3 attempt history back-fill (Attempt 5) + §14 back-fill (N-2y) | CLOSED at `74d940b6d1b4252363fba00bf22e402bd7c09263` |
| N-2z runbook clarification: §4(x)(a)/(b) Evidence-record form codification per Codex Pattern B | CLOSED at `189eb1be6ef6304d914671bdaedec44d389cf877` |
| N-2aa Attempt 6 SUCCESS closeout + §6(a) SIX-A verifier-expectation correction per Codex closeout review | CLOSED at `be120749ca6ebb88fb7400eca0ec1692cfc828e0` (pushed to origin/main) |
| ARC-8-DOCS-A Controlled Autopilot Builder System spec (orchestrator/AUTOPILOT-RULES.md ARC-8 extension + 10 cross-reference updates) | CLOSED at `c8dc4f4547ce34531cde44dbe61315cae7aa5661` (pushed to origin/main) |
| ARC-8-DOCS-B Autopilot template set (5 new + 3 extended handoff packet templates + 4 new prompt templates + 3 status doc updates = 15 files) | IN PROGRESS — DOCS-ONLY |

## N-3 State

- [x] N-3 attempt 1 at `9ae139d` halted before SQL execution.
- [x] N-3 attempt 2 at `3138e7f` halted before SQL execution.
- [x] Victor approval naming `9ae139d` is CONSUMED and cannot be reused.
- [x] Victor approval naming `3138e7f` is CONSUMED and cannot be reused.
- [x] All six prior Victor production-action approvals (`9ae139d`, `3138e7f`, `e7bce599df678222ab0a58f0a4f3cc9f562f509a` Attempt 3, `e7bce599df678222ab0a58f0a4f3cc9f562f509a` Attempt 4, `726b2e33988b4ea4f31f94a3361144d3ce8e8fac` Attempt 5, `189eb1be6ef6304d914671bdaedec44d389cf877` Attempt 6 — succeeded) are CONSUMED and cannot be reused.
- [x] **Migration 008 is APPLIED to production at HEAD `189eb1be6ef6304d914671bdaedec44d389cf877` per Attempt 6 SUCCESS on 2026-05-04.**
- [x] **N-3 is closed.** Attempt 6 succeeded.
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
- [x] Post-N-2x Check D re-verification at HEAD `726b2e33988b4ea4f31f94a3361144d3ce8e8fac` = PASS via `railway ssh` (in-container `node --version` = `v24.10.0` byte-for-byte = `.nvmrc`); container `root@9a7e48743905:/app`.
- [x] Post-N-2x fresh Codex N-3 preflight at HEAD `726b2e33988b4ea4f31f94a3361144d3ce8e8fac` = clean PASS. Victor approval naming HEAD `726b2e33988b4ea4f31f94a3361144d3ce8e8fac` granted for Attempt 5.
- [x] **Attempt 5 HALTED before SQL.** Halt class: pre-SQL operator-side preflight tooling failure on a NEW failure mode (ESM/CommonJS mismatch: Claude-supplied `/app/check_vii_abc.js` used CommonJS `require(...)` while `/app/package.json` declares `"type": "module"`); N-2x §4(vii) /app + host/container rule was correctly applied; the rule did not anticipate the ESM/CommonJS dimension. Runner never invoked; no DB write; approval at HEAD `726b2e3...` CONSUMED.
- [x] Post-attempt-5 fresh Codex N-3 preflight at HEAD `726b2e33988b4ea4f31f94a3361144d3ce8e8fac` = PASS WITH REQUIRED EDITS — Path B selected — N-2y runbook tightening required to codify the ESM/CommonJS rule and back-fill Attempt 5.
- [x] Post-N-2z: operator ran Check D re-verification at the post-N-2z deployed HEAD `189eb1be6ef6304d914671bdaedec44d389cf877` via `railway ssh` = PASS (in-container `node --version` = `v24.10.0`, normalized `24.10.0`, byte-for-byte equal to `.nvmrc`; container `root@3b55e9309793:/app`; `pwd` = `/app`; `.nvmrc` present in `/app` (`-rw-rw-r-- 1 root root 8 May 4 23:25 .nvmrc`)); attested in the Codex N-3 preflight packet per the N-2z-codified §4(x) Evidence-record form rule (operator-attested evidence in the preflight packet is canonical; HEAD-specific on-disk status records are not required for preflight PASS).
- [x] Fresh Codex N-3 preflight at HEAD `189eb1be6ef6304d914671bdaedec44d389cf877` = clean PASS (all Q1–Q12 PASS, no required edits).
- [x] Victor in-session production-action approval naming exact HEAD `189eb1be6ef6304d914671bdaedec44d389cf877` granted for Attempt 6.
- [x] **Attempt 6 SUCCEEDED** at HEAD `189eb1be6ef6304d914671bdaedec44d389cf877`. Runner exit 0; Migration 008 applied to production in a single transaction; `emergency_audit_log` table created with all 13 columns, 6 indexes, PK on `id`, UNIQUE on `event_id`, CHECK on `mode IN ('paper','live')`, two partial indexes (unresolved, kraken_order_id), and zero rows; `schema_migrations.version = 8` row inserted (`name = 'emergency_audit_log'` per runner `parseFile` semantics — numeric prefix stripped; non-null SHA-256 `checksum`). All 10 structural §6 verifications PASS; the lone `SIX-A-VERSION-8-ROW:FAIL` label was a benign verifier-script expectation mismatch corrected by N-2aa. Approval at HEAD `189eb1b…` CONSUMED.
- [x] Codex closeout review = **SUCCESS WITH NARROW DOCS-ONLY CORRECTION REQUIRED** — §6(a) wording correction prescribed and applied by N-2aa.
- [x] **Migration 008 is APPLIED to production at HEAD `189eb1be6ef6304d914671bdaedec44d389cf877`.**
- [x] **N-3 is closed.** No further migration application authorized; Migration 009+ requires a separate runbook + Codex review + fresh Victor approval at that future HEAD.

## Carry-Forward Execution Checks

- [ ] **Approval-gate separation confirmed:** N-2s commit-time approval authorized only committing `.nvmrc` + three status docs; it did NOT authorize deploy (gate 5, separately approved); it did NOT authorize N-3. N-2t commit-time approval authorizes only committing the runbook + three status docs; it does NOT authorize deploy; it does NOT authorize N-3.
- [ ] **N-2t deploy-method source-identity gating:** the currently-running deploy of `agent-avila-dashboard` was triggered by `railway up` and exposes no commit SHA on any non-secret Railway surface. Per runbook §3 (N-2t) and §4(x)(a) GAP-D Case 2 (tightened in N-2t), `railway up` deploys without a verifiable full 40-character commit SHA are REJECTED as a valid §4(x)(a) source-identity surface for N-3. Image digest, deployment ID, timestamp, and operator-attested mapping are NOT commit SHAs. **The next N-3 attempt requires a GitHub-push-tracked deploy** (or any equivalent that produces a Railway-recorded commit SHA on a non-secret surface).
- [ ] **Path Z block at HEAD `6c3a1e5`:** Path Z (N-3 against currently-deployed HEAD via Option E) is structurally blocked by the N-2t deploy-method rejection until a GitHub-tracked deploy produces a commit-SHA-recording deployment.
- [x] **Check D — repo-side pin in place via Option A.** Repo-root `.nvmrc` containing exact normalized value `24.10.0` is committed at HEAD `6c3a1e5` (local-only; not yet pushed); satisfies runbook §4(x)(b) source priority 1. Pin matches the deployed runtime as captured at fact-finding time (in-container `node --version` returned `v24.10.0` from a `railway ssh` session into the production `agent-avila-dashboard` container). `package.json` `engines.node` remains the non-exact range `">=18.0.0"`, unchanged. **Verified PASS at deployed HEAD `49650f077509d83dcbf3e9771dc9ca30f351e55b` on 2026-05-04** via Web UI deploy-identity capture (GitHub-push-tracked) plus `railway ssh` in-container `node --version` = `v24.10.0` byte-for-byte match against `.nvmrc`. Freshness invalidation rule (per N-2u) remains in force.
- [x] **Deployed-runtime verification (post-commit deploy-and-verify cycle, per N-2r design):** completed for Attempt 6 at deployed HEAD `189eb1be6ef6304d914671bdaedec44d389cf877` — Railway-recorded commit SHA matched approved HEAD byte-for-byte (GitHub-push-tracked deploy method per N-2t); in-container `node --version` = `v24.10.0` matched `.nvmrc` byte-for-byte after parsing-hygiene normalization; deployed service healthy.
- [x] **N-2r-preflight freshness:** satisfied for Attempt 6 — no intervening deploy, builder change, service/environment scope switch, or Nixpacks Node-provider patch update between Check D capture at HEAD `189eb1b…` and Attempt 6 runner invocation in the same `railway ssh` session.
- [x] Fresh Codex N-3 preflight PASS on HEAD `189eb1be6ef6304d914671bdaedec44d389cf877` (after deploy-and-verify cycle complete).
- [x] Fresh Victor in-session production-action approval naming exact HEAD `189eb1be6ef6304d914671bdaedec44d389cf877` granted for Attempt 6 (now CONSUMED).
- [x] All eleven runbook §4 pre-flight checks (i) through (xi) PASSed at execution time for Attempt 6, performed in the same `railway ssh` session as the runner invocation per the N-2m same-session rule.
- [x] Target Railway service and production database confirmation completed without exposing secrets (Attempt 6).
- [x] Migration 008 applied per the runbook §11 gate satisfaction (Attempt 6 SUCCESS).

## Docs-Only Closeout Verification

- [x] Status docs reference the latest committed HEAD via `git rev-parse HEAD` rather than embedding stale "current HEAD" claims (per N-2q stale-proof pattern).
- [x] Active stale wording about open-work state or incomplete closeout items is absent.
- [x] Next-action language is stale-proof: it points to a fresh Codex N-3 preflight on the latest committed HEAD, canonical runbook §11, `git log`, and `git rev-parse HEAD`.
- [x] No new open-phase or unlanded-closeout tail is introduced for N-2z.
- [x] The runbook `orchestrator/handoffs/N-2-MIGRATION-008-PRODUCTION-PLAN.md` IS part of this N-2z commit (Codex Pattern B §4(x) Evidence-record form addition appended after the existing §4(x) paragraph and before §4(xi); §14 N-2z history entry; §1 / §9 / §11 phase-label updates). The runbook's §4(vii) connectivity-preflight base content, the N-2x §4(vii) /app module-resolution + host/container command-boundary rule, the N-2y §4(vii) ESM/CommonJS module-format rule, the §4(x) source-revision identity / Node-runtime identity / dependency identity rules, the §4(x)(b) `.nvmrc` source-priority list / canonical-source rule / parsing-hygiene rule / freshness-invalidation rule (codified in N-2u), and HALT-on-disagreement rules remain unchanged; §4(x) is extended (not weakened) by the N-2z Evidence-record form paragraph.

## P2 Informational (post-N-2q findings)

- **`package.json:8` declares `"start": "node bot.js"` but Railway/Nixpacks runs `node dashboard.js`.** Service-side override (Railway custom start command, or Nixpacks-detected entry) reconciles the difference. Not material to Check D or §11 N-3 gate; tracked for future audit.
- **`railway shell` is NOT the approved deployed-runtime-shell surface.** `railway shell` opens a local subshell with Railway env vars injected (in-shell `node --version` returns operator's local Node, not the deployed runtime). Same REJECTED category as `railway run`, per runbook §3 N-2n rejection of local-injection surfaces. The approved primary N-3 execution surface is `railway ssh` into the deployed `agent-avila-dashboard` container; N-2o GAP-A four conditions empirically PASS for that surface. (A separately scoped runbook-tightening phase could add an explicit "rejects `railway shell`" line to runbook §3 alongside the existing `railway run` rejection; deferred.)
- **Active builder confirmed: Nixpacks v1.41.0** (Railway build log header). Nixpacks documents Node major-version control only; the deployed exact patch is determined by Nixpacks's current Node 24 selection at deploy time and is observable from in-container `node --version`. The N-2r-preflight freshness rule applies — patch may shift on future Nixpacks updates.

## P2 Informational (N-2t findings)

- **`railway up` deploys do NOT record a commit SHA on Railway's non-secret surfaces.** The currently-running production deploy of `agent-avila-dashboard` was triggered by `railway up` (per the project's documented deploy command at `package.json:14`). The Railway dashboard exposes deployment ID, image digest, build provenance, timestamp, and start command — but no commit SHA. Both Cases of §4(x)(a) GAP-D fail for the current deploy: Case 1 (in-container `git rev-parse HEAD`) returned `fatal: not a git repository` because the deployed NIXPACKS container lacks `.git/` metadata (binary `/bin/git` exists; metadata does not); Case 2 (Railway deploy-metadata fallback) returned no commit SHA.
- **N-2t codifies the rule:** deploys lacking a verifiable full 40-character commit SHA on a non-secret Railway deploy-metadata surface are REJECTED as a valid §4(x)(a) source-identity surface for N-3 (mirrors N-2n / N-2o rejection patterns for local-injection surfaces). Approved N-3 deploy path is GitHub-push-tracked deploys (or equivalent commit-SHA-recording deploys).
- **Post-N-2z + Attempt 6 sequence (historical record):** Codex re-review PASS on the N-2z four-file docs diff → operator approved N-2z commit at HEAD `189eb1be6ef6304d914671bdaedec44d389cf877` → pushed to GitHub `origin/main` (GitHub-push-tracked deploy method per N-2t) → Railway auto-deploy of `agent-avila-dashboard` succeeded with the post-N-2z commit SHA recorded on Railway's non-secret deploy-metadata surface → operator ran Check D re-verification at the deployed HEAD via `railway ssh` (in-container `node --version` = `v24.10.0` byte-for-byte against `.nvmrc`, per the N-2u-codified §4(x)(b) freshness rule) → operator included operator-attested Check D PASS + Railway deploy-identity evidence in the Codex N-3 preflight packet (per the N-2z-codified §4(x) Evidence-record form rule) → fresh Codex N-3 preflight at HEAD `189eb1b…` returned clean PASS → Victor granted fresh production-action approval naming HEAD `189eb1be6ef6304d914671bdaedec44d389cf877` → **Attempt 6 SUCCEEDED** from a fresh `railway ssh` session per the N-2m same-session rule, with corrected operator-side preflight tooling discipline per the N-2x §4(vii) rule (checker scripts under `/app`, not `/tmp`; host-side commands not pasted into the railway ssh container shell) AND the N-2y §4(vii) rule (CommonJS `require(...)` scripts using `.cjs` extension or ESM `import`); runner exit 0; Migration 008 applied; `emergency_audit_log` created. Codex closeout = SUCCESS WITH NARROW DOCS-ONLY CORRECTION REQUIRED → N-2aa applies the §6(a) wording correction. **The sequence is complete; N-3 is closed; Migration 008 is APPLIED.**

## Blocked Actions

- [ ] Do not apply Migration 009 or later without a separate runbook + Codex review + fresh Victor in-session production-action approval at that future HEAD.
- [ ] Do not deploy.
- [ ] Do not run Railway commands.
- [ ] Do not query the production database.
- [ ] Do not read or write env or secrets.
- [ ] Do not change runtime code, migrations, scripts, package files, lockfiles, Node version files, deployment config, `position.json`, `MANUAL_LIVE_ARMED`, live Kraken paths, or safety-policy docs as part of this sync.
