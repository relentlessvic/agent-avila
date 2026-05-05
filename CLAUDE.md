# CLAUDE.md

Project instructions for AI assistants working in this repository.

## Roles

- **Claude** is the orchestrator.
- **Codex** is used for review, bug checks, and adversarial review.
- **Gemini** is used for long-context review only when quota is available.

## Trading safety

- Do not modify live trading logic unless Victor explicitly approves.
- Do not modify `bot.js` or `dashboard.js` without explaining the plan first.
- Keep backtesting offline and separate from live trading.
- Do not allow Strategy V2 to trade live during backtesting work.

## Change discipline

- Make small, reversible changes.
- Check `git status` before and after edits.
- Run tests after edits when possible.
- Summarize exactly what changed.

## Autopilot

Autopilot rules are at `orchestrator/AUTOPILOT-RULES.md` (ARC-8 — Controlled Autopilot Builder System extends the existing supervised-autopilot Loop). Autopilot may sense, propose phase candidates, draft work, route Codex reviews, and prepare operator-approval packets — but it never approves anything. Victor is the sole approver. The set of approvers is exactly {Victor}.
