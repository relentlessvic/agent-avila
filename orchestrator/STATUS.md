# Orchestrator Status

Last updated: 2026-05-02

## Current phase

**Phase B.1 — closed (committed `cb7facb`).** Paper close-source cleanup shipped. No active code phase right now. Phase B.2 is the next planned phase but remains deferred behind HARD BLOCKs.

## Recent commits (most recent first)

| Phase | Commit | Description |
|---|---|---|
| Phase B.1 | `cb7facb` | Phase B.1: paper close-source cleanup (CLOSE_POSITION + SELL_ALL DB-canonical) |
| Phase O-4 | `f080b24` | Phase O-4: add orchestrator automation layer |
| Phase A.2 | `959fef7` | Phase A.2: make paper manual trades DB-first |
| Orchestrator docs (initial) | `685a905` | Add Orchestrator blueprint and fix plan |
| Phase A.1 | `5bcda59` | Phase A.1: return status from paper shadow helpers |

## Working tree state (truth)

- `dashboard.js` — **clean (committed in `cb7facb`).**
- `position.json.snap.20260502T020154Z` — pre-existing untracked drift forensics snapshot. Not for commit. Excluded.
- No tracked files modified.

## Phase status summary

| Phase | Status |
|---|---|
| Phase A.1 | Closed, committed `5bcda59` |
| Phase A.2 | Closed, committed `959fef7` |
| Phase O-4 | Closed, committed `f080b24` |
| Phase B.1 — design | Codex APPROVE (4 review rounds) |
| Phase B.1 — implementation | **Closed, committed `cb7facb` (Codex PASS-WITH-NOTES, no required edits)** |
| Phase B.2 | Deferred — blocked by `db.js` + `migrations/` HARD BLOCKs |

## Current allowed next action

> **Phase B.2 design-only planning/review. No code.**

B.2 implementation cannot proceed until all prerequisites listed in `NEXT-ACTION.md` are satisfied (HARD BLOCK lifts, migration design, helper design, Codex design review, operator authorization). Until then, B.2 design discussion is the only B.2-scoped work allowed.

The operator may also choose to advance an alternative phase (O-5 / O-6 / O-7 / O-8) instead.

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

**LOW.** No uncommitted code. All paper open/close paths are DB-canonical. Live behavior unchanged.

The known remaining dual-truth surface is Phase B.2 territory: paper `SET_STOP_LOSS` / `SET_TAKE_PROFIT` still write `position.json` directly without a DB update. Dashboard SL/TP edits in paper mode will be reverted on bot.js's next rehydrate cycle (≤5 min). This is design-known, deferred behind HARD BLOCKs, and tracked in `CHECKLIST.md` as Phase B.2.
