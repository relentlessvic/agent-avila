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

## What this packet is NOT

- Not an approval.
- Not Codex's verdict (Codex's verdict goes into `CODEX-VERDICT.md`, append-only).
- Not authorization to commit, apply, deploy, or execute any RED action.
