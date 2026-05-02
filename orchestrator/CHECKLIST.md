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
- [x] Phase B.1 — Paper close-source cleanup — commit `cb7facb` (closeout `63bbac4`)
  - [x] B.1 design approved by Codex (4 review rounds, final = APPROVE)
  - [x] B.1 implementation written to `dashboard.js` (3 hunks: helper hardening, CLOSE_POSITION rewrite, SELL_ALL rewrite)
  - [x] B.1 Codex implementation review = PASS-WITH-NOTES
  - [x] B.1 committed (`cb7facb`)
  - [x] B.1 closeout docs committed (`63bbac4`)
- [x] **Phase B.2a — Infrastructure: transactional helper + event_type CHECK extension — commit `a324290`**
  - [x] B.2a design audit found existing `updatePositionRiskLevels` already does similar work; chose Option β (additive transactional variant)
  - [x] B.2a design Codex-approved (3 review rounds: initial → Option β → final)
  - [x] B.2a pre-flight: live constraint name verified (`trade_events_event_type_check`) via safe non-secret-printing query
  - [x] B.2a implementation: new `updatePositionRiskLevelsTx(client, mode, orderId, fields)` in db.js (existing `updatePositionRiskLevels` untouched)
  - [x] B.2a implementation: new migration `007_event_type_sl_tp_updates.sql` (idempotent ALTER CHECK extending allowed event types from 8 to 10)
  - [x] `node --check db.js` PASS
  - [x] B.2a Codex implementation review = PASS-WITH-NOTES (no required edits)
  - [x] B.2a committed (`a324290`)
  - [x] B.2a migration 007 applied to production via `scripts/run-migrations.js`; verified via post-migration `pg_constraint` query
  - [x] **Side effect documented:** migration 006 also applied (runner applies all unapplied; 006 was on disk but unapplied). 006 is runtime-inert; no automatic behavior change. Do not revert without explicit safety review.
  - [x] HARD BLOCK on `db.js` and `migrations/` reinstated after B.2a commit (the lift was scoped to B.2a only)

## Active phase

- [~] **Phase B.2b — design-only review (deferred, awaiting design decisions resolution).** No active code work.

## Future phases

- [ ] Phase B.2b — Paper SET_STOP_LOSS / SET_TAKE_PROFIT caller integration in `dashboard.js`
  - Blocked by: B.2b design review with Codex
  - **Required design decisions** (B.2b cannot proceed until each is resolved):
    - Conflict-resolution policy between manual dashboard SL/TP writes and bot.js trailing-stop writes (last-writer-wins / manual-overrides-bot / mutual exclusion)
    - Idempotency strategy: timestamp-in-seed for `buildEventId(\`${orderId}-${Date.now()}\`, "manual_sl_update")` to avoid PK collision on repeated updates
    - Whether to append a best-effort LOG_FILE history entry on paper SL/TP update (mirror of B.1 close pattern, or skip)
    - Caller throw wording for `db_unavailable` / `db_error` / `validation_failed` / `no_open_position` cases
    - Comment block update for the existing Phase D-5.7.1 / A.2 block in `dashboard.js`
  - Required: `dashboard.js` HARD BLOCK lift for B.2b (precedent: B.1 already did this for paper close paths)
  - Required: explicit operator authorization
- [ ] Phase D-5.12 — Live persistence gate lift (live mode JSON → DB-authoritative)
  - Required before live `SELL_ALL` / `SET_STOP_LOSS` / `SET_TAKE_PROFIT` can be moved to DB-first
- [ ] Phase O-5 — Bug Audit System
- [ ] Phase O-6 — Security Audit System
- [ ] Phase O-7 — Drift Forensics resumption (Phase 2.5 reactivation; reconciliation persist now schema-unblocked after migration 006 applied)
- [ ] Phase O-8 — Performance & Reliability Upgrades
- [ ] Future reliability item — DB statement timeout via Postgres-side cancellation (`statement_timeout` / `pg_cancel_backend`); not JS-side `Promise.race`
- [ ] Future reliability item — fix latent CLOSE_POSITION live-side stale-source pattern (deferred to D-5.12 since live is JSON-authoritative)

## High-risk approval gates

| Gate | Requires | Status |
|---|---|---|
| `db.js` modifications | Operator approval | Closed (post-B.2a; lift was scoped) |
| `migrations/` modifications | Operator approval | Closed (post-B.2a; lift was scoped) |
| `bot.js` modifications | Operator approval | Closed |
| Live mode write-path changes | Operator approval + Phase D-5.12 | Closed |
| Phase B.2b implementation | `dashboard.js` scoped lift + Codex design review + operator authorization | Closed |
| Force push / `git reset --hard` / rebase | Explicit operator command | Closed |
| Deployment to Railway | Explicit operator command | Closed |
| Adding new `event_type` values beyond the current 10 | Migration + operator approval | Closed |
| Touching SL / TP / BE / trailing stop logic in bot.js | Explicit operator command | Closed |
| Real-money behavior changes | Operator approval + live mode gate | Closed |
| Reverting migration 006 (drop columns) | Explicit safety review (destructive) | Closed |
