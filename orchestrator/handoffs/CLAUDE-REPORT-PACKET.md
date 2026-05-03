# Claude Report Packet (template)

Author: Claude (Lead Engineer / Builder)
Phase: `<name>` — Mode: `<mode>`
Generated: `<UTC timestamp>`

## Files changed

```
<git diff --name-only output, or "none — DESIGN-ONLY / READ-ONLY AUDIT">
```

## Summary of work

`<what Claude did, scope-bounded>`

## Files NOT touched

`<explicit confirmation that out-of-scope files (bot.js / dashboard.js / db.js / migrations/ / scripts/ / position.json / safety-policy docs not in scope) are unchanged>`

## Codex review status

- Required: `<yes/no, with reason>`
- Round number (if applicable): `<n>`
- Latest verdict (from `CODEX-VERDICT.md`): `<PASS | PASS WITH REQUIRED EDITS | FAIL | not yet reviewed>`

## Stop conditions encountered

`<none, or list with explanation>`

## Pending operator approval

- `<exact action the operator must approve to advance, or "none">`

## Self-attestation

- I have not self-approved any RED action.
- I have not promoted phase mode.
- I have not run any migration / deploy / live Kraken action / production-DB query / env-secret write.
- I have not modified any safety-policy doc outside the active phase scope.
- I have not used a packet, Codex PASS, clean tree, green tests, or any non-operator signal as approval.

## What this packet is NOT

- Not an approval.
- Not a commit.
- Not authorization to advance to the next phase.
