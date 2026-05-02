# Codex Review (template)

Reusable prompt structure when delegating to Codex via the `codex:codex-rescue` agent. Fill in the `{{placeholders}}`.

---

# Phase {{phase}} {{review-type}} review for {{file path(s)}}

{{Brief context: what was decided in design, what Codex previously approved or required, what's HARD BLOCK, what scope is in/out.}}

Constraints (operator-set):
- bot.js, db.js, migrations/ HARD BLOCK (no edits — but read-only inspection allowed where it helps verify contracts).
- {{phase-specific scope statement, e.g. "B.1 dashboard.js only"}}
- Live behavior must remain unchanged until Phase D-5.12 unless this review is for D-5.12 itself.
- No JSON fallback in paper failure (Railway is ephemeral; per dashboard.js D-5.8 policy at lines ~423–435).
- {{any phase-specific constraints, e.g. "No DB timeout this phase", "SELL_ALL out of scope"}}

## Evidence

### `git status --short`
```
{{paste output}}
```

### `node --check {{file}}`
```
{{paste output, e.g. "node --check: PASS"}}
```

### Wide-context diff — `git diff -U80 -- {{file}}`
```
{{paste full diff or trimmed diff with all changed hunks; keep enough context that the reviewer can trace what's changed and what's unchanged}}
```

### Numbered file view (post-edit)

Helper region:
```
{{nl -ba {{file}} | sed -n 'A,Bp'}}
```

Handler region:
```
{{nl -ba {{file}} | sed -n 'C,Dp'}}
```

### Independent verification (when relevant)

```
{{any greps, file reads, or sub-file inspections that confirm scope, e.g. grep for HARD BLOCK file names, grep for `\blog\b` references, grep for `writeFileSync` call sites}}
```

## Verification checklist

Please answer each PASS / FAIL with severity tag if FAIL:

1. {{specific check tied to phase scope}}
2. {{specific check tied to phase scope}}
3. {{HARD BLOCK file untouched check}}
4. {{live behavior preservation check}}
5. {{out-of-scope items unchanged check}}
6. {{race / concurrency / idempotency check, if relevant}}
7. {{response shape / API consumer check, if relevant}}
8. {{comment / doc accuracy check}}
...

N. **Final verdict:** PASS / FAIL / FAIL-WITH-CONDITIONS. List required edits if FAIL-WITH-CONDITIONS, with severity tags (CRITICAL / HIGH / MEDIUM / LOW).

## Notes for the reviewer

- The operator has final commit authority. Codex PASS authorizes only the diff shown.
- Phase scope is fixed by `NEXT-ACTION.md`. Don't suggest scope expansion unless it's strictly necessary for safety.
- If the diff appears empty or contradicts the working-tree state, flag the discrepancy rather than rating it.

Report format: PASS / FAIL / FAIL-WITH-CONDITIONS, one short line per checklist item, final verdict at the end. Keep under {{N}} words (typical: 500–700).
