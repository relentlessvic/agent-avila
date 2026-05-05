# Autopilot Loop A — Sense (prompt template)

> **This is a documentation prompt template. It does NOT execute. It describes WHAT autopilot should do during Loop A, not a script that DOES it.**
>
> Per `orchestrator/AUTOPILOT-RULES.md` ARC-8 four-loop architecture, Loop A is GREEN tier — read-only sense-state collection. Loop A does not mutate any file or state.

## When Loop A runs

- At the start of every autopilot cycle.
- After any Loop D execute step completes (to refresh state before returning to Loop A).
- After any halt-and-resume event (autopilot must resync canonical sources before resuming).
- On operator instruction to "show current state" or equivalent.

## What Loop A does

Read-only sense-state collection. Loop A does NOT mutate any file or state. Loop A does NOT propose actions (that is Loop B's role).

### Mandatory reads (in order)

1. `git rev-parse HEAD` — local working-tree HEAD.
2. `git rev-parse origin/main` — local tracking-ref view of remote.
3. `git ls-remote origin HEAD` — authoritative remote-side HEAD.
4. Three-way SHA consistency check: local HEAD == origin/main tracking ref == ls-remote origin HEAD. If not, surface the divergence to the operator and HALT (per supervised-autopilot stop conditions and `AUTOPILOT-RULES.md` ARC-8 stop conditions).
5. `git status --short` — working-tree state (modified, untracked, staged).
6. `git log --oneline -5` — recent commit history.
7. `orchestrator/STATUS.md` — current-phase journal; cite the labeled mode.
8. `orchestrator/CHECKLIST.md` — completed / active / future phases.
9. `orchestrator/NEXT-ACTION.md` — single source of truth for the next allowed action.
10. `orchestrator/NEXT-ACTION-SELECTOR.md` — ten ordered selector rules; master order; D-5.12f hard-block status.
11. `orchestrator/AUTOPILOT-RULES.md` — supervised-autopilot Loop + ARC-8 extension.
12. `orchestrator/APPROVAL-GATES.md` — what is auto-allowed vs operator-approval (16-gate matrix).
13. `orchestrator/handoffs/CODEX-VERDICT.md` — append-only Codex verdicts; latest entry per phase.
14. `orchestrator/handoffs/N-2-MIGRATION-008-PRODUCTION-PLAN.md` §11 (canonical N-3 gate state — closed since N-2aa).

### Optional reads

- `orchestrator/PROTECTED-FILES.md` — per-path SAFE / RESTRICTED / HARD BLOCK matrix.
- `orchestrator/PHASE-MODES.md` — six phase modes; ambiguous-mode rule.
- `orchestrator/ROLE-HIERARCHY.md` — five roles; ARC-8 orchestration binding.
- `orchestrator/AUTOMATION-PERMISSIONS.md` — GREEN/YELLOW/RED tiers; ARC-8 mapping.
- `orchestrator/HANDOFF-RULES.md` — packet rules; autopilot-packet conventions.
- `orchestrator/BLUEPRINT.md` — Safety Enforcement Layer.
- `CLAUDE.md` — top-level role / safety / change-discipline rules.

### Output

A Loop A snapshot, suitable for use by Loop B:

- Three-way SHA consistency: PASS or FAIL.
- HEAD: `<full SHA>`.
- Working-tree state.
- Active phase (per STATUS.md): `<phase-id>` at mode `<mode>`.
- Latest closed phase: `<phase-id at SHA>`.
- Pending Codex verdicts (rounds awaiting next response): `<list>`.
- Pending operator approvals: `<list>`.
- Stop-condition triggers (if any): `<list>`.
- Drift between snapshot and STATUS.md / CHECKLIST.md / NEXT-ACTION.md (if any): `<list>`.

## Constraints (re-stated for Loop A)

- Read-only. No file edit. No staging. No commit. No push. No deploy. No DB query. No Railway command. No Kraken action. No env access.
- Do not invent next actions. Loop A reports state; Loop B decides.
- Do not treat any signal as approval. Per `APPROVAL-GATES.md` "What is NOT operator approval".
- Do not auto-publish to Discord. Per `AUTOPILOT-RULES.md` ARC-8 no-auto-publish rule.
- HALT immediately on any of the supervised-autopilot stop conditions or ARC-8 stop conditions.

## What Loop A is NOT

- Not Loop B (which proposes phase candidates).
- Not Loop C (which drafts).
- Not Loop D (which seeks operator approval and executes).
- Not authorization to advance any phase.
- Not a substitute for `orchestrator/NEXT-ACTION.md` / `orchestrator/NEXT-ACTION-SELECTOR.md`.
