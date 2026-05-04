# Orchestrator Status

Last updated: 2026-05-04 (N-2v in progress — DOCS-ONLY post-N-2u stale-tail repair + Check D re-verification record at HEAD `0a6974884849dd1eb6bdf4f88cb5d41085044612`). ARC-GO-LIVE governance activation remains committed and pushed at `de91d325b8160fb8183cc26172e50f3f35831796` and is the active orchestrator governance control layer (DOCS-ONLY; governance only).

## ARC Governance Activation (ARC-GO-LIVE)

**Mode:** DOCS-ONLY. Committed and pushed at `de91d325b8160fb8183cc26172e50f3f35831796`; ARC-1 through ARC-7 are the active orchestrator governance control layer.

ARC-GO-LIVE is the orchestrator-governance activation checkpoint. It officially activates ARC-1 through ARC-7 as the active control layer for Agent Avila and confirms the governance framework binds all subsequent work. **ARC-GO-LIVE does not equal live trading. It does not authorize any production mutation, migration application, deploy, Railway command, live Kraken action, env / secret read or write, `MANUAL_LIVE_ARMED` change, package / lockfile edit, runtime edit, or `position.json` change.**

Active governance controls:

| ARC | Doc | Function |
|---|---|---|
| ARC-1 | `orchestrator/PROTECTED-FILES.md` | Per-path SAFE / RESTRICTED / HARD BLOCK matrix; Ruflo / future-automation rule |
| ARC-2 | `orchestrator/APPROVAL-GATES.md` | 16-gate action-class matrix; "what is NOT operator approval" non-equivalence list |
| ARC-3 | `orchestrator/PHASE-MODES.md` | Six phase modes (READ-ONLY AUDIT / DESIGN-ONLY / DOCS-ONLY / SAFE IMPLEMENTATION / HIGH-RISK IMPLEMENTATION / PRODUCTION ACTION) |
| ARC-4 | `orchestrator/NEXT-ACTION-SELECTOR.md` | Ten ordered selector rules; master-order discipline |
| ARC-5 | `orchestrator/ROLE-HIERARCHY.md` | Five named roles (Victor / ChatGPT / Gemini / Claude / Codex) + future-automation governance-only inheritance |
| ARC-6 | `orchestrator/AUTOMATION-PERMISSIONS.md` | GREEN / YELLOW / RED three-tier permission model; Claude / Codex / ChatGPT / Gemini / Ruflo / Hermes / successors all governance-only |
| ARC-7 | `orchestrator/HANDOFF-RULES.md` + `orchestrator/handoffs/` | Packet rules and templates; packets cannot approve, cannot transport, cannot trade |

**Confirmed at activation:**

1. **ARC governance is not live trading and is not production mutation.** ARC-GO-LIVE is a docs-only governance step. The trading-runtime separation rule from `orchestrator/ROLE-HIERARCHY.md` "Critical separation rule" and `orchestrator/AUTOMATION-PERMISSIONS.md` "Critical separation rule" remains in force: the brains govern changes; they do not run the runtime.
2. **Victor / CEO remains the sole final authority.** All RED-tier actions (per `AUTOMATION-PERMISSIONS.md`), all 16 numbered approval gates (per `APPROVAL-GATES.md`), all phase-mode promotions (per `PHASE-MODES.md`), all master-order changes (per `NEXT-ACTION-SELECTOR.md`), all scoped lifts on RESTRICTED / HARD BLOCK files (per `PROTECTED-FILES.md`), and all commits of safety-policy docs require explicit, in-session, per-action approval from Victor.
3. **No AI role can self-approve.** Claude (Lead Engineer / Builder), Codex (Chief Risk & Safety Officer), Gemini (Director of Architecture / UX), ChatGPT (VP of Strategy & Orchestration), and any future automation layer (Ruflo, Hermes, successors) are governance-only and cannot grant themselves authority. Codex PASS, clean `git status`, green tests, scheduled triggers, signed tokens, CI status, and any LLM self-approval DO NOT satisfy any operator-approval gate (per `APPROVAL-GATES.md` "What is NOT operator approval" and `AUTOMATION-PERMISSIONS.md` Tier 3 — RED rule).
4. **The 3-brains workflow does not enter the trading runtime hot path.** Live order decisions are made by `bot.js` + the operator + Kraken — not by Claude / Codex / ChatGPT / Gemini / Ruflo / Hermes. Automation may freely operate within GREEN-tier read-only verification, draft proposed changes for higher tiers, and surface mode-promotion requests to Victor — but cannot apply, commit, deploy, or execute outside an explicit operator instruction.
5. **N-phase production work remains blocked behind its existing gates.** N-3 remains halted/blocked behind runbook §11. Migration 008 remains NOT applied to production. The next allowed action toward N-3 remains a fresh Codex N-3 preflight on the runbook at the latest committed HEAD per `git rev-parse HEAD`, with the canonical N-3 gate at `orchestrator/handoffs/N-2-MIGRATION-008-PRODUCTION-PLAN.md` §11. ARC-GO-LIVE does not advance, bypass, or alter that gate.
6. **Prior production-action approvals remain CONSUMED and cannot be reused.** The approval naming `9ae139d` (consumed by N-3 attempt 1, halted before SQL execution) and the approval naming `3138e7f` (consumed by N-3 attempt 2, halted before SQL execution) cannot be applied to any future N-3 attempt. A fresh Victor in-session production-action approval naming the exact full latest committed HEAD from `git rev-parse HEAD` is required for any future N-3 attempt, after the post-commit deploy-and-verify cycle is complete.
7. **Future work obeys ARC-1 through ARC-7 without exception.** Every subsequent phase must (a) be labeled with exactly one mode per `PHASE-MODES.md` before any state-mutating tool call, (b) respect the per-path matrix in `PROTECTED-FILES.md` (SAFE / RESTRICTED / HARD BLOCK), (c) clear the relevant gates in the `APPROVAL-GATES.md` 16-gate matrix, (d) follow the strict ordering in `NEXT-ACTION-SELECTOR.md`'s ten selector rules, (e) respect the role hierarchy in `ROLE-HIERARCHY.md` (CEO is sole approver; brains recommend / review / block but do not approve), (f) operate within the GREEN / YELLOW / RED tiers in `AUTOMATION-PERMISSIONS.md`, and (g) honor the packet rules in `HANDOFF-RULES.md` (packets are not approval channels, not transports, not trading interfaces, and never override the canonical sources).

**ARC-GO-LIVE explicitly does not authorize:** deploying, running migrations, running Railway commands, modifying runtime files (`bot.js`, `dashboard.js`, `db.js`, `migrations/**`, `scripts/**`, `position.json`, `package.json`, lockfiles, `.env` files, deploy config), reading or writing env / secrets, changing `MANUAL_LIVE_ARMED`, touching live Kraken paths, executing the N-3 migration application, deploying the latest committed HEAD, or any other RED-tier action. The activation is committed and pushed at `de91d325b8160fb8183cc26172e50f3f35831796`; subsequent RED-tier actions still require their own per-action explicit Victor / CEO approval per `APPROVAL-GATES.md` and `AUTOMATION-PERMISSIONS.md`.

## Current Phase State

**N-3 remains halted/blocked. Migration 008 remains NOT applied to production.**

All N-2x phases through N-2u are CLOSED (or, for N-2r, design-only PASS); N-2v is IN PROGRESS (DOCS-ONLY):

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
| N-2r | Design-only; PASS at second design review (no commit) |
| N-2s | CLOSED at `6c3a1e5` (now superseded by GitHub-tracked deploy at `49650f0…`; see runbook §14) |
| N-2t | CLOSED at `49650f077509d83dcbf3e9771dc9ca30f351e55b` (deploy-method source-identity gating — GitHub-push-tracked deploy with verified commit SHA on Railway non-secret surface) |
| N-2u | CLOSED at `0a6974884849dd1eb6bdf4f88cb5d41085044612` (Codex Q10 freshness-invalidation runbook fix — §4(x)(b) extended with HALT-on-invalidator paragraph; pushed to `origin/main`; GitHub-push-tracked Railway redeploy successful at deployment ID `3355d5ee`, status Active) |
| N-2v | IN PROGRESS — DOCS-ONLY post-N-2u stale-tail repair + Check D re-verification record at HEAD `0a6974884849dd1eb6bdf4f88cb5d41085044612` |

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

**Check D — repo-side pin in place via Option A.** A repo-root `.nvmrc` containing the exact normalized value `24.10.0` is committed, satisfying runbook §4(x)(b) source priority 1 (highest). The pin matches the deployed runtime as captured at fact-finding time: in-container `node --version` from a `railway ssh` session into the production `agent-avila-dashboard` container returned `v24.10.0`, normalized per the §4(x)(b) parsing-hygiene rule (strip leading `v`, strip trailing whitespace / newlines) to `24.10.0`. `package.json` `engines.node` remains the non-exact range `">=18.0.0"` and is unchanged in this phase; per the canonical-source rule the highest-priority present source (`.nvmrc`) is canonical, with HALT-on-disagreement against any other present source. **Check D verified PASS at deployed HEAD `49650f077509d83dcbf3e9771dc9ca30f351e55b` on 2026-05-04** via Web UI deploy-identity capture (GitHub-push-tracked, full 40-char SHA on Railway non-secret surface) plus `railway ssh` in-container `node --version` = `v24.10.0` (normalized `24.10.0`) byte-for-byte equal to `.nvmrc`. **N-2r-preflight freshness rule remains in force** and is now codified in runbook §4(x)(b) by N-2u (Codex Q10 required edit). **Check D re-verification at HEAD `0a6974884849dd1eb6bdf4f88cb5d41085044612` (post-N-2u GitHub-tracked Railway redeploy; deployment ID `3355d5ee`, status Active) = PASS** via `railway ssh` in-container `node --version` = `v24.10.0` (normalized `24.10.0`, byte-for-byte equal to `.nvmrc`). Container `root@ee8605893ce8:/app`; `pwd` = `/app`; `.nvmrc` present in `/app` (`-rw-r--r-- 1 root root 8 May 3 23:26 .nvmrc`). Per the §4(x)(b) freshness rule, this re-verification will be invalidated by the next intervening deploy; a fresh Check D re-verification at the post-N-2v deployed HEAD per `git rev-parse HEAD` is required before any N-3 attempt.

**Deployed-runtime verification is still required before any N-3 attempt.** Post-commit deploy-and-verify cycle (per N-2r design):

**N-2s commit-time approval authorized only the four-file commit (`.nvmrc` + three status docs); it did NOT authorize a deploy (deploy is gate 5 per `orchestrator/APPROVAL-GATES.md`, separately approved), and it did NOT authorize N-3. N-2t commit-time approval authorizes only committing the runbook + three status docs; it does NOT authorize a deploy; it does NOT authorize N-3.**

- After the new HEAD is deployed to `agent-avila-dashboard` (auto-deploy or separately scoped deploy approval — gate 5 per `orchestrator/APPROVAL-GATES.md`, not authorized by any N-2x docs commit), the operator MUST verify, via `railway ssh` into the deployed container after the redeploy reaches RUNNING:
  - The deployed commit SHA equals the new approved HEAD byte-for-byte (in-container `git rev-parse HEAD` if available — Case 1 per N-2o GAP-D — OR Railway dashboard "Deployed Commit" full 40-character SHA if `git` unavailable in container — Case 2).
  - In-container `node --version` matches `.nvmrc` byte-for-byte after parsing-hygiene normalization.
  - Deployed service is healthy (no crash loops, no rolling-deploy state).
- HALT if any of the above is false. Re-run an N-2r-preflight freshness check and update `.nvmrc` in a separately scoped phase before any N-3 attempt.

**N-2r-preflight freshness rule (per N-2r design).** The runtime-version capture used to set `.nvmrc` is invalidated by: an intervening deploy of `agent-avila-dashboard` between capture and the next N-3 attempt; a builder change (Nixpacks → Railpack or vice versa); a service / environment scope switch (non-production capture); inability to identify the running deployment SHA at capture time; or any Nixpacks Node provider version update that ships a new Node 24 patch. If freshness is broken, the operator MUST re-run in-container `node --version` capture in a fresh `railway ssh` session and update `.nvmrc` before any N-3 attempt. Stale `.nvmrc` values that disagree with the deployed runtime would HALT N-3 at §4(x)(b); freshness violation is a maintenance issue, not a safety issue, but maintenance must precede the next N-3 attempt window.

**Active builder confirmed: Nixpacks v1.41.0** (Railway build log header). Nixpacks documents Node major-version control only; the deployed exact patch is determined at deploy time and is observable from in-container `node --version` (per the N-2r-preflight finding above).

**Approved primary N-3 execution surface confirmed: `railway ssh` into the deployed `agent-avila-dashboard` production container.** N-2o GAP-A four conditions empirically PASS (surface available; running container; key setup OK; usable shell binary). **`railway shell` is NOT the approved surface** — `railway shell` opens a local subshell with Railway env vars injected (in-shell `node --version` returns the operator's local Node, not the deployed runtime), placing it in the same REJECTED category as `railway run` (per runbook §3 N-2n rejection of local-injection surfaces).

**P2 informational item:** `package.json:8` declares `"start": "node bot.js"` but the deployed `agent-avila-dashboard` service is observed running `node dashboard.js` (per Railway build log). A service-side override (Railway custom start command, or Nixpacks-detected entry) reconciles the difference. Not material to Check D or the §11 N-3 gate; tracked here for future audit.

**Deploy-method source-identity gating (N-2t).** Operator-side fact-finding during a Path Z evaluation (N-3 against the currently-deployed HEAD via Option E without pushing N-2s) discovered that the currently-running production deploy of `agent-avila-dashboard` was triggered by `railway up` (the project's documented deploy command per `package.json` `scripts.deploy`) and exposes only deployment ID, image digest, build provenance (Nixpacks v1.41.0, `nodejs_24` setup), timestamp, and start command — but **no commit SHA on any non-secret Railway dashboard / build-log / deploy-metadata surface**. Both Cases of §4(x)(a) GAP-D failed for the currently-running deploy: Case 1 (in-container `git rev-parse HEAD`) returned `fatal: not a git repository` because the deployed NIXPACKS container has the `git` binary at `/bin/git` but no `.git/` metadata; Case 2 (Railway deploy-metadata fallback) returned no commit SHA because `railway up` deploys don't record one. **N-2t codifies the rule: deploys lacking a verifiable full 40-character commit SHA on a non-secret Railway deploy-metadata surface (e.g., `railway up` deploys) are REJECTED as a valid §4(x)(a) source-identity surface for N-3** — runbook §3 extended with deploy-method gating that mirrors the N-2n / N-2o rejection pattern; §4(x)(a) GAP-D Case 2 tightened to clarify image digest / deployment ID / timestamp / operator-attested mapping are NOT commit SHAs and do NOT satisfy the check. **The approved N-3 deploy path is GitHub-push-tracked deploys** (or any equivalent that produces a Railway-recorded commit SHA on a non-secret surface).

**Path Z block at HEAD `6c3a1e5` (informational record).** Operator chose Path Z (N-3 against currently-deployed HEAD via Option E) on 2026-05-04 to bypass the local DNS issue blocking the N-2s push. Path Z is currently STRUCTURALLY BLOCKED by the N-2t deploy-method rejection: the currently-running `railway up`-deployed instance does not satisfy §4(x)(a) GAP-D Case 2. To unblock, the operator must either (a) restore local DNS connectivity, push N-2s (`6c3a1e5`) to GitHub, allow Railway auto-deploy (or scoped manual deploy approval) to redeploy the new HEAD via GitHub-tracked deploy method (which records a commit SHA), and proceed with the post-commit deploy-and-verify cycle (Path X resumption); OR (b) use any equivalent deploy method that produces a Railway-recorded full 40-character commit SHA on a non-secret surface. **Path Z attempts via `railway up` are NOT a valid N-3 path under N-2t.**

**Migration 008 remains NOT applied to production.** No migration application, production DB query, deploy, Railway command, live Kraken action, env/secret read or write, `MANUAL_LIVE_ARMED` change, package/lockfile edit, runtime edit, or `position.json` change is authorized by this status.

**Codex N-3 preflight history.** Preflight at HEAD `49650f077509d83dcbf3e9771dc9ca30f351e55b` returned FAIL (Q10 freshness-invalidation gap); N-2u applied Codex's exact required wording to runbook §4(x)(b) and committed at HEAD `0a6974884849dd1eb6bdf4f88cb5d41085044612`. The GitHub-push-tracked Railway deploy for that HEAD records the full 40-character commit SHA on a non-secret Railway deploy-metadata surface (deployment ID `3355d5ee`, status Active). Fresh Codex N-3 preflight at HEAD `0a6974884849dd1eb6bdf4f88cb5d41085044612` returned FAIL on Q3 (post-deploy state not yet recorded in status docs) and Q12 (Check D re-verification at that HEAD an open operator action per the freshness rule). N-2v applies the two Codex-required docs-only edits to STATUS.md and NEXT-ACTION.md, updates the phase tables, and records the operator's Check D re-verification at HEAD `0a6974884849dd1eb6bdf4f88cb5d41085044612` = PASS (in-container `node --version` = `v24.10.0`, normalized `24.10.0`, byte-for-byte equal to `.nvmrc`). **N-3 remains BLOCKED at runbook §11.** Per the §4(x)(b) freshness rule, N-2v itself produces a new HEAD on commit, and the subsequent push triggers a GitHub-push-tracked Railway redeploy at that new HEAD; a fresh Check D re-verification at the post-N-2v deployed HEAD (per `git rev-parse HEAD` after commit), a fresh Codex N-3 preflight at that same HEAD, and a fresh Victor in-session production-action approval naming that exact full HEAD are all required before any N-3 attempt. Both prior approvals (`9ae139d`, `3138e7f`) remain CONSUMED.

## Closeout Note

This status file is intentionally stale-proof for post-commit closeout use: it does not name an active N-2x work item or describe an unlanded closeout. Future N-3 work resolves through `git rev-parse HEAD`, `git log`, and runbook §11 as the canonical sources after any later commit.
