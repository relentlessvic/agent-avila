# Orchestrator Checklist

End-to-end progression for the Agent Avila dual-truth fix and surrounding orchestrator work.

## Completed phases

- [x] Phase 1 — Repo / Safety Baseline Audit (closed 2026-05-01)
- [x] Phase 1.5 — Deep Audit + Gap Closure
- [x] Phase 2 — Position Truth Audit (read-only) — surfaced P0-1 / P0-2 dual-truth risks
- [x] Phase O-1 — Blueprint (`orchestrator/BLUEPRINT.md`)
- [x] Phase O-2 — Project Attachment Audit (read-only)
- [x] Phase O-3 — 3-Brain CLI Verification (Claude builder, Codex reviewer)
- [x] Phase A.1 — Paper shadow helpers refactored to async + `{ ok, reason }` return contract — commit `5bcda59`
- [x] Phase A.2 — Paper BUY/CLOSE DB-first persistence; LOG_FILE best-effort post-DB; live unchanged — commit `959fef7`
- [x] Orchestrator BLUEPRINT and FIX-PLAN committed — commit `685a905`
- [x] Phase O-4 — Orchestrator automation layer (STATUS, CHECKLIST, APPROVAL-GATES, NEXT-ACTION, AUTOPILOT-RULES, prompts/) — commit `f080b24`
- [x] **Phase B.1 — Paper close-source cleanup — commit `cb7facb`**
  - [x] B.1 design approved by Codex (4 review rounds, final = APPROVE)
  - [x] B.1 implementation written to `dashboard.js` (3 hunks: helper hardening, CLOSE_POSITION rewrite, SELL_ALL rewrite)
  - [x] `node --check dashboard.js` PASS
  - [x] B.1 diff sent to Codex for implementation review (Codex PASS-WITH-NOTES, no required edits)
  - [x] B.1 committed (`cb7facb`)
  - [x] `dashboard.js` was the only file in the commit
  - [x] `bot.js`, `db.js`, `migrations/` untouched
  - [x] `position.json.snap.20260502T020154Z` untracked, excluded

## Active phase

- [~] **Phase B.2 — design-only (deferred, awaiting HARD BLOCK lifts).** No active code work.

## Future phases

- [ ] Phase B.2 — Paper SET_STOP_LOSS / SET_TAKE_PROFIT cleanup
  - Blocked by: `db.js` HARD BLOCK, `migrations/` HARD BLOCK
  - Requires: new migration extending `trade_events.event_type` CHECK constraint to allow `manual_sl_update` and `manual_tp_update`
  - Requires: new helpers `updatePositionStopLoss(client, mode, { orderId, stop_loss })` and `updatePositionTakeProfit(client, mode, { orderId, take_profit })` in `db.js`
  - Requires: Codex design review before implementation
  - Requires: explicit operator authorization to lift HARD BLOCKs
- [ ] Phase D-5.12 — Live persistence gate lift (live mode JSON → DB-authoritative)
  - Required before live `SELL_ALL` / `SET_STOP_LOSS` / `SET_TAKE_PROFIT` can be moved to DB-first
- [ ] Phase O-5 — Bug Audit System
- [ ] Phase O-6 — Security Audit System
- [ ] Phase O-7 — Drift Forensics resumption (Phase 2.5 reactivation)
- [ ] Phase O-8 — Performance & Reliability Upgrades
- [ ] Future reliability item — DB statement timeout via Postgres-side cancellation (`statement_timeout` / `pg_cancel_backend`); not JS-side `Promise.race`
- [ ] Future reliability item — fix latent CLOSE_POSITION live-side stale-source pattern (deferred to D-5.12 since live is JSON-authoritative)

## High-risk approval gates

| Gate | Requires | Status |
|---|---|---|
| `db.js` modifications | Operator approval | Closed |
| `migrations/` modifications | Operator approval | Closed |
| `bot.js` modifications | Operator approval | Closed |
| Live mode write-path changes | Operator approval + Phase D-5.12 | Closed |
| Phase B.2 implementation | `db.js` + `migrations/` HARD BLOCK lifts + Codex design review | Closed |
| Force push / `git reset --hard` / rebase | Explicit operator command | Closed |
| Deployment to Railway | Explicit operator command | Closed |
| Adding new `event_type` values | Migration + operator approval | Closed |
| Touching SL / TP / BE / trailing stop logic | Explicit operator command | Closed |
| Real-money behavior changes | Operator approval + live mode gate | Closed |
