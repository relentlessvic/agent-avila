# Autopilot Loop C — Draft + Codex Round-Trip (prompt template)

> **This is a documentation prompt template. It does NOT execute. It describes WHAT autopilot should do during Loop C, not a script that DOES it.**
>
> Per `orchestrator/AUTOPILOT-RULES.md` ARC-8 four-loop architecture, Loop C runs in the appropriate phase mode (READ-ONLY AUDIT / DESIGN-ONLY / DOCS-ONLY / SAFE IMPLEMENTATION / HIGH-RISK IMPLEMENTATION / PRODUCTION ACTION drafting). Loop C drafts; it does not commit, push, deploy, or execute production actions. Operator approval (Loop D) is required before any commit / push / deploy / execute step.

## When Loop C runs

- After the operator confirms a phase candidate from Loop B (per `AUTOPILOT-PHASE-CANDIDATE.md`).
- After Codex returns PASS WITH REQUIRED EDITS in a prior Loop C round (autopilot applies the required edits verbatim and re-delegates).
- On operator instruction to "draft <phase>" or equivalent.

## What Loop C does

Draft the work in the appropriate phase mode for the operator-confirmed candidate. Auto-trigger Codex review per criteria below. Apply Codex's required edits verbatim. Re-delegate. Loop C terminates when Codex returns PASS (or when a halt fires).

### Phase-mode-bound drafting

Per `orchestrator/PHASE-MODES.md`, Loop C drafts within the candidate phase's labeled mode. The labeled mode determines what files autopilot may touch:

- **READ-ONLY AUDIT (Mode 1):** No file edits. Loop C produces an audit report in conversation only.
- **DESIGN-ONLY (Mode 2):** Drafts a design report as a Markdown file in the working tree (a SAFE doc). No runtime / source / migration / script / package / lockfile / env / position / deploy-config touched.
- **DOCS-ONLY (Mode 3):** Edits approved `orchestrator/*` files. Stage by name; never `git add -A`; never `git add .`. Safety-policy doc edits require operator approval (a Loop D gate).
- **SAFE IMPLEMENTATION (Mode 4):** Edits the named scoped file(s) under an active operator-granted scoped lift. Runs existing test suites. No live trading paths.
- **HIGH-RISK IMPLEMENTATION (Mode 5):** Edits HARD BLOCK file(s) under an active operator-granted scoped lift. Codex design + implementation reviews both required.
- **PRODUCTION ACTION (Mode 6):** Drafts the runbook / preflight packet only. Does NOT invoke a runner, deploy, or execute. The production action is a separate Loop D execute step under separate operator approval.

### Codex auto-trigger criteria (per `AUTOPILOT-RULES.md` ARC-8)

Loop C automatically triggers a Codex review when:

- a draft modifies any safety-policy doc;
- a draft modifies any RESTRICTED or HARD BLOCK file;
- a draft is part of a HIGH-RISK IMPLEMENTATION or PRODUCTION ACTION phase;
- an `OPERATOR-APPROVAL-PACKET.md` is being prepared for Victor (Loop D entry);
- a phase closeout doc is being drafted;
- a phase has been open for more than the operator-defined idle window;
- a Discord draft is being prepared (lightweight pre-publish forbidden-content sanity check).

Loop C does NOT auto-trigger Codex on pure READ-ONLY AUDIT outputs or on phase-candidate proposals (Loop B output).

### Codex review packet

Use `orchestrator/handoffs/CODEX-REVIEW-PACKET.md` as the request format (with the autopilot-fillable section populated). Use `orchestrator/prompts/CODEX-REVIEW.md` as the prompt template.

### Apply Codex's required edits

If Codex returns PASS, Loop C terminates and Loop D begins (operator approval request).

If Codex returns PASS WITH REQUIRED EDITS, autopilot applies the prescribed edits verbatim and re-delegates. Edits MUST NOT (per `CODEX-REVIEW-PACKET.md` autopilot-fillable section "Stop conditions to verify"):

- widen autopilot authority;
- lower any tier;
- remove any HARD BLOCK;
- bypass any of `NEXT-ACTION-SELECTOR.md` rules 1–10;
- introduce literal Railway runner commands, `DATABASE_URL` values, or production secrets;
- propose modifying any ARC-1 through ARC-8 safety-policy doc as part of an autopilot-driven phase without explicit operator approval.

If any of these would be violated, Loop C HALTs and surfaces via `AUTOPILOT-HALT.md`.

If Codex returns FAIL / FAIL-WITH-CONDITIONS / REJECT, Loop C HALTs and surfaces via `AUTOPILOT-HALT.md`.

### Output

A working-tree diff (drafts only — not staged, not committed). Codex final-round verdict (PASS or HALT). Loop C terminates.

## Constraints (re-stated for Loop C)

- Drafts only. No staging. No commit. No push. No deploy. No DB query. No Railway command. No Kraken action. No env access.
- Stage-by-name pattern is enforced at Loop D (the staging step), not Loop C. Loop C does not stage.
- Apply Codex's required edits verbatim and only within the candidate phase scope. Edits proposed for files outside the scope HALT autopilot.
- Do not auto-publish to Discord. Per `AUTOPILOT-RULES.md` ARC-8 no-auto-publish rule.
- HALT immediately on any of the supervised-autopilot stop conditions or ARC-8 stop conditions.

## What Loop C is NOT

- Not Loop A (which senses state).
- Not Loop B (which proposes candidates).
- Not Loop D (which seeks operator approval and executes).
- Not authorization to commit, push, deploy, or execute any production action.
- Not authorization to apply Codex's required edits to files outside the candidate phase scope.
- Not authorization to advance through Loop D without operator approval on the resulting `OPERATOR-APPROVAL-PACKET.md`.
