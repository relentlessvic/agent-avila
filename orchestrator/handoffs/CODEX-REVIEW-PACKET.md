# Codex Review Packet (template)

Author: Claude (request only — not an action; not an approval)
Phase: `<name>` — Mode: `<mode>`
Generated: `<UTC timestamp>`

## Artifact under review

- Files: `<paths>`
- Diff stat: `<n files changed, +x / -y>`
- New (untracked) files: `<paths, if any>`

## Expected unchanged

- `<paths that should NOT appear in the diff>`

## Required review questions

1. `<question>`
2. `<question>`
3. `<…>`

## Output contract Codex must follow

Return exactly one verdict on its own line:
```
PASS
or
PASS WITH REQUIRED EDITS
or
FAIL
```

Plus per-question evidence with file:line citations. If PASS WITH REQUIRED EDITS or FAIL, provide exact wording changes only — quoted "before" / "after" snippets keyed to file path. Do NOT propose runtime code changes. Do NOT propose commits, applies, or deploys.

## Constraints reminded to Codex

- Read-only review.
- Do not edit any file.
- Do not run any command that mutates state.
- Do not commit, push, apply migrations, or deploy.
- Do not run live Kraken actions.
- Do not propose any change that would itself widen automation authority.
- **Codex PASS is necessary but never sufficient for production actions.**

## Autopilot-fillable fields (ARC-8)

When the autopilot system (per `orchestrator/AUTOPILOT-RULES.md` ARC-8) auto-triggers a Codex review, it populates this packet with the following autopilot-specific fields. Operator-driven (manual) Codex reviews may omit these fields.

- **Autopilot loop:** `<C — Draft round-trip | other>` (per `AUTOPILOT-RULES.md` ARC-8 four-loop architecture)
- **Auto-trigger criterion fired:** `<safety-policy doc edit | RESTRICTED/HARD BLOCK file change | HIGH-RISK IMPLEMENTATION or PRODUCTION ACTION draft | OPERATOR-APPROVAL-PACKET preparation | phase closeout draft | idle-window expiry | Discord draft pre-publish>`
- **Phase ID (autopilot-current):** `<phase-id>`
- **Candidate phase rule-fired (Loop B):** `<rule N from NEXT-ACTION-SELECTOR.md rules 1-10>` (if review is part of an autopilot-driven phase candidate)
- **Prior verdict refs (round number, file:line):** `<list of prior CODEX-VERDICT.md entries for this phase>`
- **Expected Q&A count:** `<n>`
- **Stop conditions to verify Codex didn't introduce:** Codex's prescribed required edits MUST NOT (a) widen autopilot authority, (b) lower any tier, (c) remove any HARD BLOCK, (d) bypass any of NEXT-ACTION-SELECTOR.md rules 1-10, (e) introduce literal Railway runner commands, DATABASE_URL values, or production secrets, (f) propose modifying any ARC-1 through ARC-8 safety-policy doc as part of an autopilot-driven phase without explicit operator approval. If Codex's response would violate any of these, autopilot HALTs and surfaces via `AUTOPILOT-HALT.md` rather than applying the edits.
- **Autopilot-applied edit scope rule:** Autopilot applies Codex's prescribed required edits VERBATIM and only to files within the candidate phase scope. Edits proposed for files outside the scope HALT autopilot per `AUTOPILOT-RULES.md` ARC-8 stop conditions.

## What this packet is NOT

- Not an approval.
- Not Codex's verdict (Codex's verdict goes into `CODEX-VERDICT.md`, append-only).
- Not authorization to commit, apply, deploy, or execute any RED action.
- Not authorization to auto-apply Codex's required edits beyond the candidate phase scope.
- Not authorization for autopilot to advance through Loop D without operator approval on the resulting `OPERATOR-APPROVAL-PACKET.md`.
