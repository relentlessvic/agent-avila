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

## Communication Hub

Communication Hub rules are at `orchestrator/COMM-HUB-RULES.md` (Discord-centered control-room spec). The hub is operator-private, read-from-the-system-side / write-from-the-operator-side. Discord is a delivery channel for status and a draft surface for approval requests — never the approval channel itself. A Discord reply, emoji, or reaction is NEVER an approval. Only Victor's in-session chat instruction grants approval. No Discord bot, webhook, scheduler, or background automation is installed at COMM-HUB-DOCS-A; future installs require their own Gate-10 phases.

## Hermes (future Discord auto-publisher; DORMANT)

Hermes rules are at `orchestrator/COMM-HUB-HERMES-RULES.md` (canonical SAFE-class spec). Hermes is the planned future auto-publisher for `#status` / `#summaries` / `#system-health` only — never `#approvals`, never `#codex-warnings`, never Category C. Hermes is currently DORMANT (zero members, zero permissions). Hermes is a one-way publisher with no Discord read scope (no `Read Message History`); idempotency uses orchestrator-side keys plus Hermes-private append-only publish logs. Hermes has zero approval authority — only Victor's in-session chat instruction grants approval; per-message Victor approval is required through Stage 9, and bounded class authorization is allowed only at Stage 10a/10b with 7 documented bounds. Hermes activation follows a staged path (Stages 1–10b) with each stage gated by Codex review + explicit Victor approval; Stage 5 install is Gate 10 RED-tier per `orchestrator/APPROVAL-GATES.md`.
