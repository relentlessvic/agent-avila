# Autopilot Loop D — Approve → Execute → Report (prompt template)

> **This is a documentation prompt template. It does NOT execute. It describes WHAT autopilot should do during Loop D, not a script that DOES it.**
>
> Per `orchestrator/AUTOPILOT-RULES.md` ARC-8 four-loop architecture, Loop D is the gated execution loop. Autopilot HALTS and waits for operator approval at the entry to Loop D. Autopilot CANNOT execute any commit / push / deploy / runner invocation / production action without explicit, in-session, scoped Victor approval that names the action and the scope. **A Codex PASS is a precondition, not an authorization.**

## When Loop D runs

- After Loop C terminates with Codex PASS on the draft.
- After the operator's in-session chat reply grants approval naming the phase-id and scope.
- Loop D never runs on autopilot's own internal "decision" — only on operator-explicit approval.

## What Loop D does

Loop D has three steps: **Approve**, **Execute**, **Report**. Each step has its own gates.

### Step 1 — Approve (drafted, then halted-and-awaiting)

Autopilot DRAFTS an `OPERATOR-APPROVAL-PACKET.md` request (with the autopilot-fillable section populated). Optionally drafts a Channel 1 Discord summary from `AUTOPILOT-DISCORD-APPROVAL.md` (NOT auto-published). Surfaces the request to the operator in-session in chat.

**Halt and wait.** Loop D execution does not proceed until the operator's in-session chat reply grants approval. A Discord acknowledgment / reaction / emoji DOES NOT constitute operator approval (per `orchestrator/APPROVAL-GATES.md` "What is NOT operator approval" and `orchestrator/AUTOPILOT-RULES.md` ARC-8 trigger-source non-equivalence rule).

#### Hard limits restated per cycle (mandatory in every approval request)

Per `orchestrator/AUTOPILOT-RULES.md` ARC-8 approval-fatigue mitigation:

- No push without separate approval.
- No deploy without separate approval.
- No production action without separate approval.
- No staging of files outside the named scope.
- No `git add -A`. No `git add .`.
- No autopilot runtime widening (autopilot remains DORMANT post-this-approval unless operator explicitly says otherwise).
- No scheduler / webhook / MCP / cron / Discord-bot installation.
- No safety-policy doc commit unless explicitly named in the approval scope.
- No HARD BLOCK or RESTRICTED file edit unless explicitly named in a scoped lift.

#### Approval-fatigue queue

Maximum N=2 pending approval requests at a time. If the queue is full, autopilot HALTs new requests and surfaces the situation to the operator (per `AUTOPILOT-RULES.md` ARC-8 approval-fatigue mitigation).

#### Phase-loop ceiling

Maximum 3 sequential autopilot-driven phases without operator-initiated direction change. After 3 phases, autopilot pauses at Loop D Step 1 and asks the operator to confirm direction.

### Step 2 — Execute (only after operator approval)

Once the operator's in-session approval is received, autopilot executes EXACTLY the approved action — nothing more, nothing less.

- **Stage by name.** Use `git add <path1> <path2> ...` listing exactly the approved files. NEVER `git add -A`. NEVER `git add .`. The approved file list MUST match the operator approval message verbatim.
- **Commit.** Use the operator-approved commit message verbatim. Do NOT add `--no-verify`, `--no-gpg-sign`, or any other automation-widening flag.
- **Push (only if separately approved).** Push approval is a separate gate (per `APPROVAL-GATES.md` Gate 5 / Gate 15). Autopilot does NOT push unless the operator explicitly authorizes the push naming the commit SHA.
- **Production-class actions (deploy, migration apply, Railway runner, Kraken action, env / `MANUAL_LIVE_ARMED` / position.json change):** these are NEVER executed by autopilot's Loop D. Per `AUTOPILOT-RULES.md` ARC-8 blocked actions and `AUTOMATION-PERMISSIONS.md` Tier 3 (RED), each such action requires explicit, in-session, scoped Victor approval per the existing 16-gate matrix. Autopilot drafts the runbook / preflight packet (in Loop C); the operator executes the production action manually under the existing supervised-autopilot rules.

#### Verification after Execute

After every commit:

- `git status --short`
- `git log --oneline -5`
- `git show --stat --name-only HEAD`

After every push:

- Three-way SHA consistency: `git rev-parse HEAD` == `git rev-parse origin/main` == `git ls-remote origin HEAD`.
- HALT and surface if three-way is FAIL.

### Step 3 — Report

Update `orchestrator/STATUS.md`, `orchestrator/CHECKLIST.md`, `orchestrator/NEXT-ACTION.md` within the phase scope (per `orchestrator/handoffs/CLOSEOUT-PACKET.md` autopilot-fillable section).

Optionally draft a Channel 2 Discord status summary from `AUTOPILOT-DISCORD-STATUS.md` for each event (PHASE_CLOSED, COMMIT_LANDED, PUSH_COMPLETED). NOT auto-published.

Loop D terminates and autopilot returns to Loop A.

## Halt conditions specific to Loop D

In addition to all supervised-autopilot stop conditions and ARC-8 stop conditions, Loop D HALTS on:

- Operator approval was NOT received in-session in chat (Discord acknowledgment alone is insufficient).
- The approved file list does not match the working-tree diff.
- A non-operator signal (Codex PASS, scheduled trigger, signed token, MCP-tool result, automation-internal "approval", LLM consensus, Discord reply) is being treated as approval.
- The execute step would touch a file outside the named scope.
- The execute step would invoke a production-class action (deploy, migration apply, Railway runner, Kraken action, env / `MANUAL_LIVE_ARMED` / position.json change) without explicit, in-session, scoped Victor approval naming that exact action.
- Push is being attempted without separate push approval.
- Three-way SHA consistency is FAIL after a push.
- Phase-loop ceiling reached (3 sequential autopilot-driven phases).
- Approval-fatigue queue exceeded (N=2 pending requests).

On HALT: surface via `AUTOPILOT-HALT.md`. Do NOT auto-recover.

## Constraints (re-stated for Loop D)

- Halt-and-wait at the entry. Operator approval is the only authority that advances Loop D Step 2.
- Stage by name. Never `git add -A`. Never `git add .`.
- Push is a separate gate. Autopilot does NOT push without explicit push approval naming the commit SHA.
- Production-class actions are NEVER executed by autopilot. Drafted in Loop C; operator executes manually.
- Do not mark any operator-approval field. Per `HANDOFF-RULES.md` and `AUTOPILOT-RULES.md` ARC-8.
- Do not auto-publish to Discord. Per `AUTOPILOT-RULES.md` ARC-8 no-auto-publish rule.
- HALT immediately on any of the supervised-autopilot stop conditions or ARC-8 stop conditions.

## What Loop D is NOT

- Not Loop A (which senses state).
- Not Loop B (which proposes candidates).
- Not Loop C (which drafts).
- Not authorization to widen autopilot authority through any execute step.
- Not authorization to install schedulers / webhooks / MCP / cron / Discord-bots; all such would require Gate-10-class operator approval per `AUTOMATION-PERMISSIONS.md`.
- Not authorization to advance into the next phase without a fresh Loop A/B/C/D cycle.
- Not a substitute for any of the safety-policy docs.
