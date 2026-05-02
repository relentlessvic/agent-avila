# Orchestrator Status

Last updated: 2026-05-02

## Current phase

**O-4 — Orchestrator Automation Layer (in progress this turn)**

## Recent commits (most recent first)

| Phase | Commit | Description |
|---|---|---|
| Orchestrator docs (initial) | `685a905` | Add Orchestrator blueprint and fix plan |
| Phase A.2 | `959fef7` | Phase A.2: make paper manual trades DB-first |
| Phase A.1 | `5bcda59` | Phase A.1: return status from paper shadow helpers |

## Working tree state (truth)

- `dashboard.js` — **modified, uncommitted.** Contains Phase B.1 implementation (paper close-source cleanup):
  - `shadowRecordManualPaperClose` hardened: `exit_reason` now sourced from `exitEntry.exitReason ?? "MANUAL_CLOSE"`; `no_open_position` race guard prevents orphan trade_events when `closePosition` returns null.
  - Paper `CLOSE_POSITION` rewritten to use `loadOpenPosition("paper")` for DB-canonical exit construction.
  - Paper `SELL_ALL` rewritten to use `loadOpenPosition("paper")`, no longer calls `fetchKrakenBalance()`, records `exit_reason: "MANUAL_SELLALL"`.
  - Live `CLOSE_POSITION` and live `SELL_ALL` byte-equivalent.
  - `shadowRecordManualPaperBuy` untouched. `SET_STOP_LOSS` and `SET_TAKE_PROFIT` untouched.
- `position.json.snap.20260502T020154Z` — pre-existing untracked drift forensics snapshot. Not for commit.
- `orchestrator/STATUS.md`, `orchestrator/CHECKLIST.md`, `orchestrator/APPROVAL-GATES.md`, `orchestrator/NEXT-ACTION.md`, `orchestrator/AUTOPILOT-RULES.md`, `orchestrator/prompts/*` — O-4 docs being created in this phase, untracked until committed.

## Phase status summary

| Phase | Status |
|---|---|
| Phase A.1 | Closed, committed `5bcda59` |
| Phase A.2 | Closed, committed `959fef7` |
| Phase B.1 — design | Codex APPROVE (4 review rounds) |
| Phase B.1 — implementation | **Local / uncommitted, awaiting Codex implementation review** |
| Phase B.2 | Deferred — blocked by db.js + migrations HARD BLOCKs |
| Phase O-4 | In progress (this turn) |

## Current allowed next action

After this turn's O-4 docs are committed (separate commit, `orchestrator/` files only), the next safe action is:

> **Send Phase B.1 dashboard.js diff to Codex for implementation review.**

Do **not** commit `dashboard.js` until Codex returns PASS on the implementation diff.

## Blocked actions (require explicit operator approval)

- Editing `bot.js`
- Editing `db.js`
- Editing `migrations/`
- Adding `manual_sl_update` / `manual_tp_update` event types (requires migration)
- Phase B.2 implementation (SET_STOP_LOSS / SET_TAKE_PROFIT DB-first)
- Touching live trading logic
- Touching Kraken execution
- Touching SL / TP / breakeven / trailing stop / position management logic
- Deploying or pushing to remote
- Force push, `git reset --hard`, interactive rebase, branch deletion, file deletion

## Current risk level

**MEDIUM — uncommitted local code carrying real trading-state behavior.**

`dashboard.js` carries Phase B.1 implementation that has not yet been Codex-implementation-reviewed. If the dashboard process is restarted from this working tree before Codex review, the new code path is what runs. Recommended: complete O-4 commit, then submit B.1 diff to Codex before any dashboard restart.
