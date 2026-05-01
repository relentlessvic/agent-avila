# Agent Avila — Live Readiness Checklist

**Phase**: LC-1
**Owner**: operator
**Final status (top-of-doc summary)**: **NO-GO**

This checklist is the manual sign-off gate before Agent Avila is permitted
to flip from paper trading to live trading on Kraken. **Every required item
below must reach `PASS` (or `MANUAL` with operator confirmation) before the
final approval section can be signed.**

The current overall status is **NO-GO**. At least the following blockers
prevent live activation today:

- D-5.10.5.3 active-management dual-write has not yet been verified by a
  real BREAKEVEN/TRAIL trigger in production (cron `a053e287` still
  polling).
- D-5.10.6 final live activation gate is **not implemented** — there is no
  positive "live cycle is allowed to place orders" code path.
- 3 historical paper orphan rows persist in `positions` (D-5.7.3 import
  artifacts).
- 1 paper position currently open (`#36`); D-5.10.5.5 mode-cutover gate
  would correctly refuse a live activation while it remains open.

This document is **not** a code change. It does not modify trading logic,
stop-loss handling, position management, Kraken execution, or any other
runtime behavior. It only defines what the operator must verify before
manually approving live trading.

---

## How to read this document

Each item has six fields:

- **Checkbox** — `[ ]` while pending; `[X]` once the operator has verified
  and signed off in their own copy.
- **Status** — one of `PASS`, `FAIL`, `WAITING`, `BLOCKED`, `MANUAL`.
- **Why it matters** — one-line statement of what could go wrong if this
  item is skipped.
- **How to verify** — exact command, query, or inspection step.
- **Pass condition** — concrete criterion for marking the item PASS.
- **Blocker message if not complete** — what the operator should do if
  this item cannot reach PASS.

Status meanings:

| Status | Meaning |
|---|---|
| `PASS` | Verified green; safe to proceed past this item |
| `FAIL` | Verified red; live activation is blocked until resolved |
| `WAITING` | Cannot be checked yet (depends on something else); recheck later |
| `BLOCKED` | Known blocker that must be resolved before live mode is even worth considering |
| `MANUAL` | Requires operator judgment; cannot be automated |

Any single `FAIL` or `BLOCKED` item makes the overall status NO-GO. `WAITING`
and `MANUAL` items must be resolved before sign-off.

---

## 1. Current Mode Safety

These checks confirm the bot is currently in paper mode and that no
configuration is partway through a cutover.

### 1.1 `bot_control.paper_trading` is `true`

- [ ] **Status**: `MANUAL`
- **Why it matters**: a stale `paper_trading=false` in the database would
  enable live mode the moment all gates pass. This must remain `true` until
  the operator is ready to flip.
- **How to verify**:
  ```
  PGURL=$(railway variables --service Postgres --json | python3 -c \
    "import json,sys;print(json.load(sys.stdin)['DATABASE_PUBLIC_URL'])")
  DATABASE_URL="$PGURL" node -e "import('./db.js').then(async (db) => {
    const r = await db.query('SELECT paper_trading, killed, paused FROM bot_control WHERE id=1');
    console.log(r.rows[0]);
    await db.close();
  });"
  ```
- **Pass condition**: `paper_trading: true`, `killed: false`, `paused: false`.
- **Blocker message**: if `paper_trading=false`, do **not** proceed. The
  bot is already in live mode. Manually flip back to paper, investigate why,
  and restart this checklist.

### 1.2 `LIVE_TRADING_ARMED` env var is unset in production

- [ ] **Status**: `MANUAL`
- **Why it matters**: this umbrella flag is the explicit operator opt-in
  for live cycles. It must remain unset until the operator is ready.
- **How to verify**: Railway dashboard → service → Variables → confirm
  `LIVE_TRADING_ARMED` is **not** present, or is set to a value other than
  `"1"` / `"true"`.
- **Pass condition**: env var unset OR set to anything that is not `"1"` /
  `"true"` (case-insensitive).
- **Blocker message**: if the variable is `"1"` and `paper_trading` flips,
  the next live cycle will execute. Unset the variable before continuing.

### 1.3 No ambiguous paper/live state

- [ ] **Status**: `MANUAL`
- **Why it matters**: catches scenarios like `paper_trading=true` but
  `bot.lastRun` shows live-mode log lines, indicating something is half
  configured.
- **How to verify**: scan recent Railway logs for `Mode: LIVE TRADING`.
  Should never appear while paper-trading is on.
- **Pass condition**: cycle log shows `Mode: PAPER TRADING` consistently.
- **Blocker message**: if any cycle in the last hour shows live mode,
  pause the bot and investigate before proceeding.

---

## 2. D-5.10.5.3 Active-Management Verification

The trailing-stop / breakeven dual-write to Postgres has not yet been
exercised by a real production trigger. This must complete before live
activation.

### 2.1 BREAKEVEN or TRAIL has fired in production at least once

- [ ] **Status**: `WAITING`
- **Why it matters**: the active-management dual-write code path
  (`updatePositionRiskLevels`) has only been verified via the D-5.10.5.7
  smoke test using synthetic rows. A real BREAKEVEN or TRAIL on a real
  paper position must confirm the production code path works on
  in-flight position state.
- **How to verify**: Cron `a053e287` polls every 15 min. When a trigger
  fires it produces a full PASS/FAIL report and auto-stops itself.
- **Pass condition**: cron has emitted `[cron D-5.10.5.3] verification
  complete — auto-stopping.` AND the verification report shows DB
  `stop_loss` matched JSON `stopLoss` after the trigger AND `updated_at`
  advanced AND zero `[d-5.10.5.3 dual-write]` warnings.
- **Blocker message**: live trading must remain NO-GO until this
  verification completes. Position #36's P&L hasn't yet crossed the +1.0%
  breakeven threshold (current price below entry $1.39674). Wait for
  market action to trigger naturally.

### 2.2 No `[d-5.10.5.3 dual-write]` warnings in production logs

- [ ] **Status**: `MANUAL`
- **Why it matters**: warnings would indicate the DB write portion of the
  dual-write fails while JSON succeeds, leading to JSON↔DB drift.
- **How to verify**:
  ```
  railway logs --service agent-avila-dashboard --json | grep '[d-5.10.5.3 dual-write]'
  ```
- **Pass condition**: zero matches over the past 24 hours.
- **Blocker message**: any match indicates a real bug. Capture the warn
  message detail and resolve before live activation.

### 2.3 Container restart does not lose trailed SL state

- [ ] **Status**: `MANUAL`
- **Why it matters**: the whole point of D-5.10.5.3 is that a deploy or
  restart preserves the trailed stop. If the bot reads back a stale SL
  after restart, real money is at risk under live mode.
- **How to verify**: after item 2.1 fires, manually trigger a Railway
  redeploy (`npm run deploy` of the same commit). Confirm the post-deploy
  cycle reads the trailed SL from DB and rehydrates `position.json` to
  match.
- **Pass condition**: `[d-5.10.2 rehydrate]` line shows the trailed SL
  (not the original entry-time SL).
- **Blocker message**: if the bot reverts to the original SL after
  restart, D-5.10.5.3 is broken at the read layer. Halt and investigate
  before live activation.

---

## 3. Paper State Cleanliness

D-5.10.5.5 mode-cutover protection enforces these as gates, but the
operator should also verify them manually before approval.

### 3.1 Zero open paper positions

- [ ] **Status**: `BLOCKED`
- **Why it matters**: switching to live while paper has an open position
  would silently abandon it (paper SL/TP/trailing stops never fire). The
  D-5.10.5.5 gate would refuse live cycles until this is cleared.
- **How to verify**:
  ```sql
  SELECT count(*) FROM positions WHERE mode='paper' AND status='open';
  ```
- **Pass condition**: `count = 0`.
- **Current state**: count = 1 (position #36 open).
- **Blocker message**: close position #36 manually (via dashboard's
  manual close, or wait for SL/TP). Do not attempt live activation while
  any paper position is open.

### 3.2 Zero paper orphan rows

- [ ] **Status**: `BLOCKED`
- **Why it matters**: orphans are unresolved state by definition. Adding
  live exposure on top of a dirty paper-side audit trail is unsafe.
  D-5.10.5.5 Gate 9 enforces this.
- **How to verify**:
  ```sql
  SELECT count(*) FROM positions WHERE mode='paper' AND status='orphaned';
  ```
- **Pass condition**: `count = 0`.
- **Current state**: count = 3 (historical D-5.7.3 import artifacts).
- **Blocker message**: investigate each orphan and either reconcile (via
  manual SQL with a justification recorded in `metadata`) or accept the
  loss in `realized_pnl_usd` and mark `status='closed'`. Do not
  bulk-delete without per-row review.

### 3.3 `position.json` matches DB for the currently-open paper position

- [ ] **Status**: `WAITING`
- **Why it matters**: D-5.10.2 rehydration writes JSON from DB on each
  cycle. A persistent mismatch indicates a write-path bug.
- **How to verify**: compare `/api/health.persistence.files["position.json"].bytes`
  to expected size from `_dbPosToLegacy(...)` of the open paper row.
- **Pass condition**: byte-equal match (e.g. 358 or 366 bytes for
  position #36 depending on whether trailing has fired).
- **Blocker message**: if mismatch persists across several cycles,
  investigate `_legacyPositionsEqual` and `_rehydratePositionJson` in
  bot.js.

---

## 4. Database Readiness

### 4.1 `schemaVersion >= 5`

- [ ] **Status**: `PASS` (verified at D-5.10.5.4 deploy)
- **Why it matters**: live preflight Gate 4 requires `schema >= 5` so the
  bot_control halt-tracking columns (D-5.10.5.2) and Kraken permission
  cache columns (D-5.10.5.4) exist. Older schemas would halt every live
  cycle.
- **How to verify**: `curl /api/health | jq '.database.schemaVersion'`
- **Pass condition**: `>= 5`.
- **Blocker message**: run `npm run migrate` against the production
  Postgres until schemaVersion catches up.

### 4.2 All four core tables present and queryable

- [ ] **Status**: `PASS` (verified at D-5.10.5.7 smoke test)
- **Why it matters**: the live shadow-write paths depend on
  `bot_control`, `trade_events`, `positions`, and `strategy_signals` all
  being healthy.
- **How to verify**: `curl /api/health | jq '.database.tables'`
- **Pass condition**: all four tables listed with non-error row counts.
- **Blocker message**: any table missing or returning an error indicates
  a schema or permission problem. Investigate before live activation.

### 4.3 Postgres latency reasonable

- [ ] **Status**: `MANUAL`
- **Why it matters**: high DB latency could cause shadow writes to lag
  behind JSON, widening the JSON↔DB drift window.
- **How to verify**: `curl /api/health | jq '.database.latencyMs'` over
  several samples.
- **Pass condition**: latency < 200 ms typical, < 500 ms p99.
- **Blocker message**: if latency spikes are routine, investigate
  Railway's DB tier or network path before live activation.

### 4.4 `bot_control` row #1 exists and is healthy

- [ ] **Status**: `PASS` (verified by smoke test + production cycles)
- **Why it matters**: the single-row table holds halt-tracking,
  permission-cache, and risk-rule state. A missing row would break
  multiple gates.
- **How to verify**: `SELECT count(*) FROM bot_control` returns 1.
- **Pass condition**: exactly one row, `id = 1`.
- **Blocker message**: re-run migration 001 if the row is missing
  (migration is idempotent and re-seeds via `INSERT … ON CONFLICT DO
  NOTHING`).

---

## 5. Kraken Readiness

### 5.1 Kraken account funded with margin balance

- [ ] **Status**: `MANUAL`
- **Why it matters**: live trades require margin. An unfunded account
  fails at order placement, leaving the bot in a half-completed state.
- **How to verify**: log into Kraken UI → Account → Funding → confirm
  USD balance present and margin enabled.
- **Pass condition**: balance >= 5× intended position size (cushion for
  SL slack and partial fills).
- **Blocker message**: fund the account before activation. Recommended
  initial balance: $50-100 for the first staged rollout step.

### 5.2 Kraken API key has correct permissions

- [ ] **Status**: `MANUAL`
- **Why it matters**: read-only keys pass D-5.10.3 / D-5.10.4 / D-5.10.5
  but fail at first AddOrder. D-5.10.5.4's cached probe catches this,
  but the operator should verify directly in Kraken UI to avoid a
  guaranteed first-cycle halt.
- **How to verify**: Kraken UI → Account → API → key permissions tab.
- **Required permissions**:
  - `Query Funds`
  - `Query Open Orders & Trades`
  - `Query Closed Orders & Trades`
  - `Modify Orders`
  - `Cancel/Close Orders & Positions`
- **Forbidden permissions**:
  - `Withdraw Funds` — must be off
  - `Transfer Funds Between Accounts` — must be off
- **Pass condition**: all five required boxes checked, both forbidden
  boxes unchecked.
- **Blocker message**: update the key in Kraken UI before activation. A
  bot running with `Withdraw Funds` permission is a critical risk.

### 5.3 2FA enabled on Kraken account

- [ ] **Status**: `MANUAL`
- **Why it matters**: protects the account itself, not the bot — but a
  bot trading on a non-2FA account is a security failure.
- **How to verify**: Kraken UI → Security → Two-Factor Authentication.
- **Pass condition**: 2FA enabled (TOTP or hardware key).
- **Blocker message**: enable 2FA before activation. Non-negotiable.

### 5.4 Withdrawal whitelist enabled and tested

- [ ] **Status**: `MANUAL`
- **Why it matters**: even though the bot's API key shouldn't have
  withdraw permission, account-level withdrawal whitelisting prevents
  funds from being moved if the master account is compromised.
- **How to verify**: Kraken UI → Funding → Withdrawal Limits / Address
  Book → confirm whitelist is on, with only known operator-controlled
  addresses listed.
- **Pass condition**: whitelist active; only operator addresses present.
- **Blocker message**: configure whitelist in Kraken before activation.

### 5.5 Kraken account is currently flat

- [ ] **Status**: `MANUAL`
- **Why it matters**: live activation should start from a known
  zero-position state. Existing positions on the account would be
  orphans from the bot's perspective and would trigger D-5.10.5
  reconciliation halts.
- **How to verify**: Kraken UI → Trade → Positions → confirm "No open
  positions for any pair."
- **Pass condition**: zero open positions across all pairs.
- **Blocker message**: close all positions on Kraken before activation,
  or accept they will trigger D-5.10.5 reconciliation halts.

### 5.6 D-5.10.5.4 permission probe cache shows ok=true (after first armed cycle)

- [ ] **Status**: `WAITING`
- **Why it matters**: the cached probe needs to have run at least once
  successfully so subsequent cycles skip the AddOrder validate=true call.
- **How to verify**:
  ```sql
  SELECT kraken_perm_check_at, kraken_perm_check_ok, kraken_perm_check_reason
  FROM bot_control WHERE id=1;
  ```
- **Pass condition**: `kraken_perm_check_ok = true` AND
  `kraken_perm_check_at` is recent.
- **Current state**: all NULL (probe has never run because production is
  paper).
- **Blocker message**: this can only be verified after first armed live
  cycle. Document as expected pre-activation state.

---

## 6. DB vs Kraken Reconciliation

### 6.1 D-5.10.5 reconciliation differ unit-tested

- [ ] **Status**: `PASS` (12/12 matrix cases passed at D-5.10.5 implement)
- **Why it matters**: the pure-function differ has 11 mismatch cases. A
  bug here would either falsely halt or, worse, falsely pass.
- **How to verify**: D-5.10.5 commit message records the 12-row test
  matrix.
- **Pass condition**: all matrix cases passed at implementation.
- **Blocker message**: re-run the synthetic matrix if any helper changed
  since.

### 6.2 D-5.10.5.7 live shadow-write smoke test passed

- [ ] **Status**: `PASS` (38/38 assertions, exit 0, clean cleanup at
  D-5.10.5.7 run)
- **Why it matters**: confirms the `mode='live'` write paths
  (upsertPositionOpen, insertTradeEvent, closePosition,
  updatePositionRiskLevels, insertStrategySignal) work end-to-end against
  real Postgres.
- **How to verify**:
  ```
  PGURL=$(railway variables --service Postgres --json | python3 -c \
    "import json,sys;print(json.load(sys.stdin)['DATABASE_PUBLIC_URL'])")
  DATABASE_URL="$PGURL" node scripts/smoke-test-live-writes.js
  ```
- **Pass condition**: exit 0, all assertions PASS, post-cleanup live row
  counts equal pre-test snapshot.
- **Blocker message**: any assertion failure indicates a real bug in the
  live write path. Fix before activation.

### 6.3 No live rows in production DB pre-activation

- [ ] **Status**: `PASS`
- **Why it matters**: live row counts must start at 0 so the first armed
  cycle's reconciliation has a clean baseline.
- **How to verify**:
  ```sql
  SELECT count(*) FROM trade_events    WHERE mode='live';
  SELECT count(*) FROM positions       WHERE mode='live';
  SELECT count(*) FROM strategy_signals WHERE mode='live';
  ```
- **Pass condition**: all three return 0.
- **Blocker message**: if any non-zero, identify the source (D-5.10.5.7
  cleanup gap, manual insert, etc.) and DELETE before activation.

### 6.4 D-5.10.6 final activation gate implemented

- [ ] **Status**: `BLOCKED`
- **Why it matters**: the actual live-trading authorization gate that
  permits the trade-decision branch to fire `placeKrakenOrder` does not
  yet exist. D-5.10.3 / D-5.10.4 / D-5.10.5 / D-5.10.5.x are halt
  layers; D-5.10.6 is the affirmative "you may now trade" layer.
- **How to verify**: search bot.js for `D-5.10.6` references.
- **Pass condition**: D-5.10.6 implemented and verified.
- **Blocker message**: live activation is impossible without D-5.10.6.
  This is the headline blocker.

---

## 7. Dashboard Readiness

### 7.1 `/api/health` endpoint reachable and well-formed

- [ ] **Status**: `PASS` (verified continuously since D-5.4)
- **Why it matters**: external monitoring and the operator's primary
  visibility tool depend on `/api/health` being live.
- **How to verify**: `curl /api/health | jq '.success'`
- **Pass condition**: returns `true`; full schema present.
- **Blocker message**: dashboard service down. Investigate Railway logs.

### 7.2 `/api/health.bot = "running"` and `lastRunAge < 6 minutes`

- [ ] **Status**: `MANUAL`
- **Why it matters**: confirms the bot's cron is firing on schedule.
- **How to verify**: `curl /api/health | jq '{bot, lastRunAge}'`
- **Pass condition**: `bot: "running"` AND `lastRunAge < 360`.
- **Blocker message**: stuck cron — check Railway service status.

### 7.3 `/api/health.kraken = "online"` with reasonable latency

- [ ] **Status**: `MANUAL`
- **Why it matters**: Kraken connectivity must be healthy at activation
  time. A degraded link would cause D-5.10.4/D-5.10.5 halts.
- **How to verify**: `curl /api/health | jq '{kraken, krakenLatency}'`
- **Pass condition**: `kraken: "online"`, `krakenLatency < 500`.
- **Blocker message**: investigate Kraken's status page or the network
  path before activation.

### 7.4 Dashboard pages render

- [ ] **Status**: `MANUAL`
- **Why it matters**: operator needs the dashboard for live monitoring.
- **How to verify**: visit `/`, `/paper`, `/live`, `/dashboard-v2` while
  authenticated. Each should render without errors.
- **Pass condition**: all four pages render.
- **Blocker message**: dashboard regression. Investigate before
  activation.

### 7.5 V2 strategy is in shadow mode (not live)

- [ ] **Status**: `MANUAL`
- **Why it matters**: V2 is a separate strategy that should NOT be
  active in live mode without its own readiness review.
- **How to verify**: cycle log lines should show `[V2-shadow]` prefix
  on V2 evaluations, never `[V2-live]`.
- **Pass condition**: every V2 log line in the past hour begins with
  `[V2-shadow]`.
- **Blocker message**: V2 live activation is a separate phase; do not
  proceed with this checklist if V2 is somehow live.

---

## 8. Discord / Alert Readiness

### 8.1 `DISCORD_WEBHOOK` env var set in production

- [ ] **Status**: `MANUAL`
- **Why it matters**: live halts emit Discord alerts. Without a
  configured webhook the operator gets no real-time notification.
- **How to verify**: Railway dashboard → service → Variables → confirm
  `DISCORD_WEBHOOK` is present and non-empty.
- **Pass condition**: variable present, value is a valid Discord webhook
  URL.
- **Blocker message**: configure webhook before activation.

### 8.2 Discord webhook delivery test passes

- [ ] **Status**: `MANUAL`
- **Why it matters**: a stale or revoked webhook URL silently fails.
  Operator must confirm a real test message lands.
- **How to verify**:
  ```
  curl -X POST "$DISCORD_WEBHOOK" \
    -H "Content-Type: application/json" \
    -d '{"content":"Agent Avila live readiness webhook test — please ignore."}'
  ```
- **Pass condition**: HTTP 204 response; message visible in Discord
  channel.
- **Blocker message**: webhook broken. Generate a new one in Discord
  channel settings.

### 8.3 D-5.10.5.2 plain-English templates loaded

- [ ] **Status**: `PASS` (verified at D-5.10.5.2 deploy)
- **Why it matters**: operators need clear, actionable alerts — not
  technical jargon — to respond effectively.
- **How to verify**: D-5.10.5.2 commit (`b6c4c64`) ships 20 templates
  for known halt reasons + 1 fallback.
- **Pass condition**: templates present; grep `bot.js` for
  `HALT_TEMPLATES`.
- **Blocker message**: unlikely; would require code regression.

### 8.4 Operator subscribed to Discord channel with push notifications

- [ ] **Status**: `MANUAL`
- **Why it matters**: alerts fire at any hour. Operator must be
  reachable.
- **How to verify**: operator confirms personal device has the channel
  in a notifications-enabled state.
- **Pass condition**: operator self-attests.
- **Blocker message**: do not activate without operator notification
  readiness.

### 8.5 D-5.10.5.2 dedup verified end-to-end

- [ ] **Status**: `WAITING`
- **Why it matters**: without dedup, a persistent halt would emit one
  Discord alert every 5 minutes (~288/day) and operators would mute the
  channel.
- **How to verify**: synthetic test of one halt-then-clear cycle in
  sandbox, observing exactly one halt alert + one all-clear alert.
- **Pass condition**: dedup observed working in a real (or sandbox)
  halt scenario.
- **Blocker message**: production has not yet exercised any live halt
  (paper mode dormant for D-5.10.x). Verify in sandbox or wait for
  first armed cycle.

---

## 9. Risk Protection

### 9.1 `bot_control.risk_pct <= 1.0`

- [ ] **Status**: `MANUAL`
- **Why it matters**: caps per-trade risk relative to account balance.
  1% is the design conservative default; higher is generally unsafe for
  first activation.
- **How to verify**:
  ```sql
  SELECT risk_pct FROM bot_control WHERE id=1;
  ```
- **Pass condition**: `risk_pct <= 1.0`.
- **Blocker message**: lower via dashboard or SQL before activation.

### 9.2 `bot_control.max_daily_loss_pct <= 3.0`

- [ ] **Status**: `MANUAL`
- **Why it matters**: daily kill-switch. Caps total loss per day across
  all trades.
- **How to verify**: `SELECT max_daily_loss_pct FROM bot_control WHERE id=1;`
- **Pass condition**: `<= 3.0`.
- **Blocker message**: lower before activation.

### 9.3 `bot_control.kill_switch_enabled = true` and `kill_switch_drawdown_pct <= 5.0`

- [ ] **Status**: `MANUAL`
- **Why it matters**: drawdown circuit breaker. Halts trading entirely
  on cumulative drawdown threshold.
- **How to verify**:
  ```sql
  SELECT kill_switch_enabled, kill_switch_drawdown_pct
  FROM bot_control WHERE id=1;
  ```
- **Pass condition**: `kill_switch_enabled = true` AND
  `kill_switch_drawdown_pct <= 5.0`.
- **Blocker message**: enable kill switch and set conservative threshold
  before activation.

### 9.4 `bot_control.leverage <= 2` for first activation

- [ ] **Status**: `MANUAL`
- **Why it matters**: 3x leverage is too aggressive for a live debut.
  First activation should use 2x or 1x.
- **How to verify**: `SELECT leverage FROM bot_control WHERE id=1;`
- **Pass condition**: `<= 2`.
- **Blocker message**: lower leverage before activation.

### 9.5 D-5.10.5.5 mode-cutover gates active

- [ ] **Status**: `PASS` (verified at D-5.10.5.5 deploy)
- **Why it matters**: refuses live activation while paper has open
  positions or orphans. Prevents accidental cutover.
- **How to verify**: D-5.10.5.5 commit (`3ab4f02`) added Gates 8 and 9
  to `_liveDbPreflight()`.
- **Pass condition**: gates present; bot.js `_liveDbPreflight` returns
  `paper-still-open` or `paper-orphans-blocking` reasons when applicable.
- **Blocker message**: unlikely; would require code regression.

### 9.6 Recovery runbook rehearsed

- [ ] **Status**: `MANUAL`
- **Why it matters**: when something goes wrong at 3 a.m., operator
  needs muscle memory, not improvisation. The runbook covers Levels 1-6
  (soft halt, hard halt, service stop, code revert, Kraken-side close,
  API key revocation).
- **How to verify**: operator has rehearsed each level at least once in
  a sandbox.
- **Pass condition**: operator self-attests; written runbook exists.
- **Blocker message**: do not activate without runbook practice.

---

## 10. Final Operator Approval

### 10.1 All preceding sections complete

- [ ] **Status**: `MANUAL`
- **Why it matters**: this is the gate that blocks live activation.
- **How to verify**: every checkbox above is `[X]` and every status
  field is `PASS` or `MANUAL` (with operator confirmation).
- **Pass condition**: zero `FAIL` / `WAITING` / `BLOCKED` items.
- **Blocker message**: complete the outstanding items first.

### 10.2 Staged rollout plan agreed

- [ ] **Status**: `MANUAL`
- **Why it matters**: full-size live activation on day one is too risky.
  Staged rollout limits downside while validating real-world behavior.
- **How to verify**: operator has documented sequence:
  1. **$5 test position** — first armed cycle, monitor 24 hours.
  2. **$50 position** — monitor 1 week.
  3. **$500 position** — monitor 2 weeks.
  4. **Full intended size** — only after the previous three steps run
     clean.
- **Pass condition**: operator commits to the staged rollout in writing
  (commit message, runbook entry, or this checklist's audit trail).
- **Blocker message**: do not jump to full size on activation. Start small.

### 10.3 On-call schedule for first 24 hours

- [ ] **Status**: `MANUAL`
- **Why it matters**: first 24 hours of live trading need active
  monitoring. Backup operator should be briefed if primary becomes
  unreachable.
- **How to verify**: operator schedule documented; backup briefed.
- **Pass condition**: schedule exists with named primary and backup.
- **Blocker message**: arrange coverage before activation.

### 10.4 Final go/no-go signed by operator

- [ ] **Status**: `MANUAL`
- **Why it matters**: the explicit human sign-off prevents accidental
  activation from automation, drift, or misunderstanding.
- **How to verify**: operator signs the line below with date and
  full name.
- **Pass condition**:
  ```
  Operator name: ________________________
  Date:          ________________________
  Signature:     ________________________

  I have reviewed every item in this checklist and I authorize Agent
  Avila to begin live trading at the staged rollout's first step.
  ```
- **Blocker message**: without explicit sign-off, live trading must
  remain disabled.

---

## Final Status Summary (top-of-doc)

> **NO-GO** — multiple blockers (D-5.10.6 unimplemented, D-5.10.5.3
> not yet verified by real trigger, paper position #36 open, 3 paper
> orphans). All required items above must reach PASS before this
> document is signed.

When the operator reaches sign-off, update the top-of-doc summary to:

> **GO** — all checklist items verified PASS; operator signed off on
> [date]. Staged rollout begins at [date] with $5 test position.

---

## Document maintenance

- Update this file whenever new safety phases land (e.g. D-5.10.5.6,
  D-5.10.6) so the checklist reflects the current state of the code.
- Re-verify all `MANUAL` items before each new live-mode activation
  attempt (e.g. after a deploy, after a Kraken account change).
- Archive a copy of each signed checklist alongside the activation
  date, so post-mortem analysis has the verified baseline.

---

**End of Phase LC-1 Live Readiness Checklist**
