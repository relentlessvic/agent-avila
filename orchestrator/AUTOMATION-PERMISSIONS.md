# Automation Permission Rules

Formal automation-permission rules for Agent Avila. Defines what any automation layer — Claude, Codex, ChatGPT, Gemini, Ruflo, Hermes, or any future successor — may do automatically, what must be reviewed, what requires explicit Victor / CEO approval, and what is forbidden under any circumstance.

This file is a safety-policy doc (per `orchestrator/PROTECTED-FILES.md`). Edits require Codex docs-only review **and** explicit operator approval before commit.

Last updated: 2026-05-03 (ARC-6 — docs-only; pending Codex docs-only review and explicit operator approval before commit).

## Critical separation rule — trading runtime vs automation / governance

Automation lives in the **governance / review layer**. It does not live in the **trading runtime**.

| Layer | Members | Purpose |
|---|---|---|
| Trading runtime | `bot.js`, live `dashboard.js` handlers, `db.js`, Strategy V2, Kraken adapter, Postgres, `position.json`, Railway / runtime state, env / secrets | Execute autonomous and manual live trading |
| Automation / governance layer | Claude, Codex, ChatGPT, Gemini, future Ruflo / Hermes / successors, `orchestrator/*` docs, the operator-facing CLI surfaces | Build, review, audit, gate, document, approve |

**Hard rule.** No automation layer — present or future — may become a trading actor. Automation cannot place a live order, modify a live SL / TP, execute SELL_ALL, set/unset `MANUAL_LIVE_ARMED`, write `position.json`, run a reconciliation, apply a migration, or deploy. The trading runtime does not consult automation in its hot path; live order decisions are made by `bot.js` plus the operator plus Kraken (per `orchestrator/ROLE-HIERARCHY.md` "Critical separation rule").

## Three permission tiers

Every action attempted by any automation layer falls into one of three tiers:

| Tier | Color | Meaning |
|---|---|---|
| GREEN | safe automatic | Automation may do this without re-asking, provided the active phase mode allows it |
| YELLOW | requires Codex review | Automation may draft and propose, but a Codex review must PASS before any commit or production-side action |
| RED | requires explicit Victor / CEO approval | Automation may NEVER do this automatically; explicit, in-session, scoped operator instruction is required every time |

A Codex PASS, clean `git status`, green tests, scheduled trigger, signed token, or any LLM-self-approval DOES NOT promote a YELLOW or RED action into GREEN (per `orchestrator/APPROVAL-GATES.md` "What is NOT operator approval" and `orchestrator/PROTECTED-FILES.md` Ruflo / future-automation rule).

### ARC-8 autopilot mapping

The Controlled Autopilot Builder System (per `orchestrator/AUTOPILOT-RULES.md` ARC-8 section) maps cleanly into the three-tier model and adds no new tier:

- **Autopilot Loop A (Sense), Loop B (Decide / phase-candidate proposal), and Loop C drafting steps for SAFE-class files** are GREEN tier — autopilot may execute these autonomously within the active phase mode.
- **Autopilot Loop C drafting steps for any file outside the SAFE class** (RESTRICTED / HARD BLOCK / safety-policy doc / runtime / migration / script / `package.json` / lockfile / `.nvmrc` / `.env*` / `position.json` / deploy config) are bound by the same YELLOW (Codex review) or RED (Codex review + Victor approval) gates that bind a manual draft. Autopilot drafting does NOT lower the gate.
- **Autopilot Loop D execute steps** (any commit, push, deploy, runner invocation, env change, `MANUAL_LIVE_ARMED` change, Kraken-touching action) are RED tier and require explicit, in-session, scoped Victor approval per the existing 16-gate matrix and the blocked-commands list. Autopilot may NEVER execute these autonomously even if Codex has returned PASS on the draft.
- **Autopilot self-modification** (edits to `orchestrator/AUTOPILOT-RULES.md`, edits to its own permission tier in this file, edits to its own phase-candidate ranking logic, edits to any ARC-1 through ARC-8 safety-policy doc) is HARD BLOCK; requires explicit Victor approval through the standard safety-policy-doc commit gate. The HARD BLOCK is structural — autopilot's self-modification is forbidden even with Codex PASS. Indirect self-modification (editing a "non-self" file in a way that effectively widens autopilot authority) is also HARD BLOCK.
- **Autopilot trigger sources** (cron, scheduler, MCP server, webhook, signed token, scheduled-trigger event, CI status, green tests, clean tree, LLM self-approval) DO NOT satisfy any operator-approval gate. Autopilot's "decision" to advance is not an approval. The existing rule applies: a Codex PASS, clean `git status`, green tests, scheduled trigger, signed token, or any LLM-self-approval DOES NOT promote a YELLOW or RED action into GREEN.

ARC-8 adds zero new gates and weakens zero existing gates. It is a scheduler + drafting + comms layer bound by the existing matrix.

### COMM-HUB autopilot mapping

The Communication Hub (per `orchestrator/COMM-HUB-RULES.md`, committed in COMM-HUB-DOCS-A) maps cleanly into the three-tier model and adds no new tier:

- **Drafting Discord messages (`#approvals`, `#status`, `#codex-warnings`, `#summaries`, `#system-health`) and pre-publish Codex sanity-checking those drafts** is GREEN tier — orchestrator may execute these autonomously within the active phase mode.
- **Publishing Discord messages** is RED tier at COMM-HUB-DOCS-A activation — operator-published only. Future Hermes auto-publish for `#status` / `#summaries` / `#system-health` (NOT `#approvals` and NOT `#codex-warnings`) is gated behind a separate Gate-10 install phase. Auto-publish is NEVER authorized for `#approvals` or `#codex-warnings` regardless of any future Hermes install.
- **Discord-bot install, webhook creation, scheduler / cron / MCP install, server creation, role-permission widening, third-party integration install** is RED tier and HARD-BLOCKED at COMM-HUB-DOCS-A. Each requires its own dedicated phase with security review and explicit Victor approval per Gate 10 (automation install / upgrade) and Gate 16 (any command that could widen automation authority).
- **Trading-channel activation** (Category C: `#trading-alerts`, `#trading-summaries`) is HARD-BLOCKED — multi-gated (trading-track activation + Trading-Writer install + per-message Victor approval); not authorized by COMM-HUB-DOCS-A.
- **A Discord reply, emoji, or reaction** is NEVER operator approval. Per the existing rule in this file: a Codex PASS, clean `git status`, green tests, scheduled trigger, signed token, or any LLM-self-approval — and now a Discord reply / reaction / emoji — DOES NOT promote a YELLOW or RED action into GREEN. Only Victor's in-session chat instruction grants approval.

COMM-HUB adds zero new gates and weakens zero existing gates.

## Tier 1 — GREEN: actions automation may do automatically

Provided the active phase mode (per `orchestrator/PHASE-MODES.md`) allows them, these actions do not require fresh approval each time:

- Read-only git inspection: `git status`, `git status --short`, `git diff`, `git diff --cached`, `git diff --name-only`, `git log`, `git log --oneline`, `git show`, `git rev-parse`.
- File reads, including reading `bot.js`, `db.js`, `dashboard.js`, `migrations/*`, `scripts/*`, `position.json` (read only — never write).
- Search and indexing: `grep`, `find`, ripgrep, `ls`, directory listings.
- Drafting documentation in the working tree (orchestrator/* doc edits) **within the active phase mode's allowed-files list**.
- Drafting design reports and audit reports (DESIGN-ONLY phase outputs).
- Preparing Codex review prompts and operator-approval prompts.
- Running read-only validators: `node --check`, lint runs, type-checks.
- Reading test fixtures, test logs, and historical reconciliation reports.
- Drafting plan / checklist / runbook documents for future PRODUCTION ACTION phases — drafting only, **never executing**.

**Rule.** GREEN actions never mutate the trading runtime, never mutate production state, never commit, and never widen automation authority.

## Tier 2 — YELLOW: actions that require Codex review before any commit or production-side step

Automation may perform the drafting / preparation step automatically, but the artifact must pass a Codex review before any commit, application, deploy, or production action.

- Drafting orchestrator/* docs that affect safety policy (`PROTECTED-FILES.md`, `APPROVAL-GATES.md`, `PHASE-MODES.md`, `NEXT-ACTION-SELECTOR.md`, `ROLE-HIERARCHY.md`, `AUTOMATION-PERMISSIONS.md`, `BLUEPRINT.md`, `AUTOPILOT-RULES.md`).
- Drafting implementation diffs for RESTRICTED files (`dashboard.js`, `db.js`, `scripts/**`) within an operator-granted scoped lift.
- Drafting design reports for HIGH-RISK IMPLEMENTATION phases.
- Drafting plans / checklists / runbooks for PRODUCTION ACTION phases (per `orchestrator/PHASE-MODES.md` PRODUCTION ACTION precondition).
- Preparing migration plans, deploy plans, and live-exercise plans.
- Drafting changes to Claude Code permissions, hooks, MCP server configurations, slash commands, or scheduled agents.

**Rule.** YELLOW work pauses at the Codex review step. The Codex verdict (PASS / PASS WITH REQUIRED EDITS / FAIL / REJECT) is binding. Automation may not commit, apply, deploy, or execute on the basis of a draft alone.

## Tier 3 — RED: actions that require explicit Victor / CEO approval and cannot be done automatically

These are the actions where automation **must always stop and surface to the operator**. Codex PASS, clean tree, green tests, scheduled triggers, signed tokens, and LLM self-approval DO NOT satisfy these gates.

- Editing `bot.js` (any kind).
- Editing `db.js` (any kind).
- Editing live `dashboard.js` handlers (any code path executed when `paperTrading === false`).
- Editing `migrations/**` files.
- Applying any migration to production.
- Deploying to Railway or any production target.
- Placing a live Kraken order (BUY, SELL, OPEN_LONG, CLOSE_POSITION, SELL_ALL).
- Modifying live SL / TP / breakeven / trailing-stop on the Kraken account.
- Executing live SELL_ALL.
- Writing or reconciling `position.json` in any way.
- Setting or unsetting `MANUAL_LIVE_ARMED` in production environment.
- Modifying any production environment variable or secret (`.env`, Railway env vars, `KRAKEN_API_KEY`, `KRAKEN_API_SECRET`, `DATABASE_URL`, `MANUAL_LIVE_ARMED`, etc.).
- Real-money behavior changes (sizing, leverage, risk caps).
- Any destructive git operation (see "Blocked commands" below).
- Lifting any HARD BLOCK declared in `orchestrator/PROTECTED-FILES.md`, `orchestrator/APPROVAL-GATES.md`, or this file.
- Promoting a phase from a lower mode to a higher-risk mode (e.g., DESIGN-ONLY → HIGH-RISK IMPLEMENTATION) per `orchestrator/PHASE-MODES.md`.
- Changing the master order in `orchestrator/NEXT-ACTION-SELECTOR.md`.
- Committing any safety-policy doc.
- Installing, upgrading, or expanding any automation layer (Ruflo install, Hermes install, scheduled agent install, MCP server install or upgrade, Claude Code permission widening).
- Any "automation widening" action: lifting HARD BLOCKs in bulk, scheduling new automation, adding new auto-allow patterns to settings, enabling new MCP tools, granting new shell permissions.

**Rule.** RED actions are not auto-approvable by any signal. Each RED action requires its own explicit, in-session operator instruction that names the action, names the files / scope, and (where applicable) names the production side-effect.

## What requires Codex review

Before automation commits or before the operator is asked to approve, Codex must review:

- Any safety-policy doc edit (`PROTECTED-FILES.md`, `APPROVAL-GATES.md`, `AUTOPILOT-RULES.md`, `BLUEPRINT.md`, `PHASE-MODES.md`, `NEXT-ACTION-SELECTOR.md`, `ROLE-HIERARCHY.md`, `AUTOMATION-PERMISSIONS.md`).
- Any RESTRICTED-file diff (`dashboard.js`, `db.js`, `scripts/**`).
- Any HIGH-RISK IMPLEMENTATION design report.
- Any HIGH-RISK IMPLEMENTATION diff (per `orchestrator/PHASE-MODES.md` Mode 5).
- Any PRODUCTION ACTION plan / checklist / runbook before operator approval (per `orchestrator/PHASE-MODES.md` Mode 6 precondition).
- Any approval-gate, phase-mode, next-action-selector, role-hierarchy, or automation-permissions change (per `orchestrator/APPROVAL-GATES.md`).
- Any automation permission change (Claude Code settings, MCP server install/upgrade, hook install, slash-command install).

A Codex PASS on the artifact is necessary but not sufficient: explicit Victor / CEO approval is still required for any RED action.

## What requires Victor / CEO approval

Per `orchestrator/APPROVAL-GATES.md` 16-gate matrix, `orchestrator/NEXT-ACTION-SELECTOR.md` rule 6, and `orchestrator/ROLE-HIERARCHY.md` "What Victor must personally approve":

1. Any `bot.js` change
2. Any `db.js` change
3. Any migration file change
4. Any production migration application (separate from migration-file commit-time approval)
5. Any Railway deployment
6. Any live Kraken action
7. Any live `dashboard.js` handler implementation
8. Any `position.json` write or reconciliation
9. Any real-money behavior change
10. Any Ruflo install or automation upgrade (also Hermes, future automation layers, scheduled agents)
11. Any Claude Code permission change (settings, hooks, MCP, slash commands)
12. Any production-state mutation
13. Any production environment variable or secret change
14. Any `MANUAL_LIVE_ARMED` action
15. Any destructive git operation
16. Any command that could widen automation authority

Plus: any commit of a safety-policy doc, any master-order change in `NEXT-ACTION-SELECTOR.md`, any phase-mode promotion, and any first live exercise of a newly wired live persistence path.

## Blocked commands — must never run without explicit operator approval

These commands are forbidden under any automation context unless the operator has explicitly named the command, the target, and the scope in an in-session approval:

| Command class | Examples |
|---|---|
| Destructive git | `git push`, `git push --force`, `git reset --hard`, `git clean -f`, `git rm`, `git rebase`, `git rebase -i`, `git branch -D`, `git checkout --` (against tracked changes), `git restore .` |
| Production deploy | `railway deploy`, `railway up`, `railway run` against production, any deploy webhook, any CI/CD trigger |
| Migration runner | `node scripts/run-migrations.js`, `psql … -f migrations/*.sql`, any equivalent runner against the production DB |
| Production DB writes | Any `INSERT`, `UPDATE`, `DELETE`, `TRUNCATE`, `DROP`, schema mutation, or write transaction against the production Postgres |
| `position.json` writes | `echo > position.json`, `cp … position.json`, `node -e "fs.writeFileSync('position.json', …)"`, any tool that mutates this file |
| `bot.js` / `db.js` / `migrations/` edits | Any text editor, `Edit`/`Write` tool call, `sed -i`, `awk -i inplace`, `cat > bot.js` against these paths |
| Env / secret writes | `export KRAKEN_API_KEY=…`, Railway env var sets, `.env` writes, secret-manager writes, any command that sets `MANUAL_LIVE_ARMED` |
| Live Kraken triggers | Any HTTP call to the Kraken trading API, any `execKrakenOrder` or equivalent function call, any `/api/trade` POST when `paperTrading === false` and not pre-authorized |
| Automation widening | Installing a new MCP server, modifying `~/.claude/settings.json`, adding a new hook, registering a new slash command, scheduling a new agent, installing Ruflo / Hermes |

A `git push` to a non-production branch (e.g., a feature branch with no auto-deploy) still requires explicit operator instruction; the rule does not depend on which branch is being pushed.

## Blocked files — must never be edited automatically

Per `orchestrator/PROTECTED-FILES.md`:

| Class | Files |
|---|---|
| HARD BLOCK | `bot.js`, `migrations/**`, `position.json`, live Kraken execution paths, deploy config (`railway.json`, deploy scripts, CI/CD config), production env / secrets, risk-management logic, real-money behavior surface |
| RESTRICTED | `dashboard.js`, `db.js`, `scripts/**` (including smoke-test, backtest, recovery, reconciliation), `package.json`, `package-lock.json`, `position.json.snap.*` |

Automation may **read** these files freely (GREEN). Automation may **draft proposed changes** under an operator-granted scoped lift (YELLOW for RESTRICTED + Codex review; RED for HARD BLOCK + explicit operator approval). Automation may **never** stage or commit them without explicit, in-session operator approval.

## Stop conditions — automation must halt immediately

Automation must stop and surface the situation to the operator if any of the following occur:

- A RED action is attempted without explicit operator approval.
- A blocked command (any from the table above) is about to execute without explicit operator instruction naming it.
- A blocked file is unexpectedly modified outside the active scoped lift.
- A Codex review returns FAIL / FAIL-WITH-CONDITIONS / REJECT / PASS-WITH-REQUIRED-EDITS, and a commit or production action is being attempted on the basis of the draft.
- A non-operator signal (Codex PASS, clean tree, green tests, scheduled trigger, signed token, LLM self-approval, MCP-tool result, automation-internal "approval") is being treated as operator approval.
- The active phase mode label is missing, ambiguous, or contradicted by the files being touched (per `orchestrator/PHASE-MODES.md` ambiguous-mode rule).
- A scoped lift appears to be widening beyond the named action / files / phase.
- A live Kraken call would execute outside an explicitly authorized live exercise (`MANUAL_LIVE_ARMED !== "true"` or no operator instruction).
- A deployment trigger appears without operator instruction.
- A migration runner is about to execute against production without a separate, explicit application approval.
- A scheduled / automated trigger fires a YELLOW or RED action without explicit, in-session operator instruction.
- An attempt is made to install, upgrade, or expand automation without explicit operator approval.

On stop: report the unexpected state, do not attempt automatic recovery, and wait for operator instruction.

## Future automation — Ruflo, Hermes, and any successor

Any future automation layer (named "Ruflo", "Hermes", or otherwise) inherits these rules **without exception**.

**What future automation may do (GREEN):**
- Run read-only audits and produce reports.
- Draft documentation, design reports, plans, and checklists in the working tree.
- Prepare Codex review prompts and operator-approval prompts.
- Surface anomalies, drift, gaps, or stale state to the operator.
- Operate within the active phase mode's allowed-files list and allowed-actions list.

**What future automation must never do (RED — requires explicit operator approval each time):**
- Apply a migration to production.
- Deploy to Railway (or any production target).
- Place a live Kraken order, modify live SL / TP / SELL_ALL, or trigger any real-money behavior.
- Set or unset `MANUAL_LIVE_ARMED`.
- Modify production environment variables or secrets.
- Edit `bot.js`, `db.js`, `migrations/**`, `position.json`, or live `dashboard.js` handlers.
- Stage, commit, force-push, hard-reset, or otherwise mutate shared git history.
- Promote a phase mode (e.g., DESIGN-ONLY → HIGH-RISK IMPLEMENTATION).
- Change the master order in `orchestrator/NEXT-ACTION-SELECTOR.md`.
- Install, upgrade, or expand itself or any other automation layer.
- Treat its own internal "approval" model — LLM self-approval, policy stub, signed token, scheduled-trigger event, green CI, clean tree — as operator approval.
- Become a trading actor (per the critical separation rule).

**Specifically:**
- **Ruflo** is bound by these rules. Ruflo cannot self-approve or widen its authority. A Ruflo install or upgrade requires explicit operator approval (per `orchestrator/APPROVAL-GATES.md` gate 10).
- **Hermes** is bound by these rules. Hermes cannot self-approve or widen its authority. A Hermes install or upgrade requires explicit operator approval (per `orchestrator/APPROVAL-GATES.md` gate 10 — automation upgrade class). The canonical Hermes spec is `orchestrator/COMM-HUB-HERMES-RULES.md` (SAFE-class) — full capability matrix, anti-execution boundaries, approval discipline (per-message Victor approval through Stage 9; bounded class only at Stage 10a/10b with 7 documented bounds: channel, template, allowed event types, max count, expiration, revocation rule, forbidden-content constraints), idempotency mechanism (orchestrator-side keys + Hermes-private append-only publish logs; **no Discord-side reads of any kind**), and staged activation path (Stages 1–10b + EOL).
- **Any successor** to Ruflo or Hermes is bound by these rules. The rules apply by class, not by name.

The brief that automation is "smart enough to know what's safe" is not honored. Automation must always escalate to the CEO for any RED action.

## Interaction with the rest of the safety-policy framework

This file is one of seven safety-policy docs. Each doc has a defined responsibility, and they are mutually consistent:

| Doc | Responsibility | This file's relationship |
|---|---|---|
| `orchestrator/PROTECTED-FILES.md` | Per-path classification (SAFE / RESTRICTED / HARD BLOCK) | This file inherits the RESTRICTED / HARD BLOCK lists for the "Blocked files" section |
| `orchestrator/APPROVAL-GATES.md` | 16-gate action-class matrix and "What is NOT operator approval" | This file inherits the 16 gates for the "What requires Victor / CEO approval" section and reuses the non-equivalence rules for the "Stop conditions" section |
| `orchestrator/PHASE-MODES.md` | Six phase modes; phase-labeling rule; automation non-promotion rule | This file enforces the GREEN action set against the active phase mode's allowed-files list |
| `orchestrator/NEXT-ACTION-SELECTOR.md` | Ten ordered selector rules; master order; D-5.12f hard-block | This file's stop conditions overlap with the selector's rules 8–10; the selector decides phase ordering, this file decides per-action permissions inside a phase |
| `orchestrator/ROLE-HIERARCHY.md` | Five named roles + Ruflo governance-only inheritance; trading-runtime separation | This file extends the trading-runtime separation specifically to automation, and elaborates the Ruflo / Hermes / future-automation rules |
| `orchestrator/AUTOPILOT-RULES.md` | Supervised-autopilot rules | This file extends those rules to all automation layers (not just the autopilot loop) |
| `orchestrator/BLUEPRINT.md` | Architectural blueprint and Safety Enforcement Layer | This file's GREEN / YELLOW / RED tiers operationalize the Safety Enforcement Layer for automation |

If this file ever conflicts with one of the other six, the more restrictive rule wins. No safety-policy doc can be reinterpreted to widen automation authority.

## Cross-references

- `orchestrator/PROTECTED-FILES.md` — per-path classification.
- `orchestrator/APPROVAL-GATES.md` — action-class gating; 16-gate matrix; "What is NOT operator approval".
- `orchestrator/PHASE-MODES.md` — six phase modes; automation non-promotion.
- `orchestrator/NEXT-ACTION-SELECTOR.md` — ten selector rules; master order; hard ordering.
- `orchestrator/ROLE-HIERARCHY.md` — five named roles; Ruflo / future-automation rule; trading-runtime separation.
- `orchestrator/AUTOPILOT-RULES.md` — supervised-autopilot rules.
- `orchestrator/BLUEPRINT.md` — architectural blueprint.
- `orchestrator/STATUS.md` — current-phase journal.
- `orchestrator/NEXT-ACTION.md` — single source of truth for the next allowed action.
- `CLAUDE.md` (repo root) — top-level role / safety / change-discipline rules.

## Change history

- **ARC-6 (2026-05-03):** Initial automation permission rules drafted. GREEN / YELLOW / RED three-tier model established. Blocked-commands and blocked-files lists populated. Stop conditions enumerated. Future automation rules (Ruflo, Hermes, successors) made governance-only and explicitly forbidden from becoming trading actors. Cross-references to all six pre-existing safety-policy docs. Pending Codex docs-only review and explicit operator approval before commit.
