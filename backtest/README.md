# Agent Avila — Strategy V2 Offline Backtest

Phase **SV2-1** — data foundation only.

## What this is

Offline backtest framework for Strategy V2 (XRP-only, long-only, 4h trend +
15m sweep + 5m BOS/pullback). Lives entirely under `backtest/**` and is
**physically isolated** from the live bot. Nothing under this directory is
imported by `bot.js`, `dashboard.js`, `db.js`, or any live-side script.

## What this is NOT

- This is not the live bot. It cannot place orders.
- This is not connected to Postgres. It reads only local files.
- This is not connected to Kraken. It makes zero authenticated calls.
- Strategy V2 is **not active** in live or paper trading. The live bot
  continues running V1 in paper mode, untouched.

## Safety contract

1. All code under `backtest/**` MUST NOT import from `bot.js`,
   `dashboard.js`, `db.js`, `lib/`, `migrations/`, or
   `scripts/recovery-*`.
2. Code under `backtest/**` MUST NOT read `KRAKEN_API_KEY`,
   `KRAKEN_API_SECRET`, `LIVE_TRADING_ARMED`, `paperTrading`, or
   `DATABASE_URL`.
3. Code under `backtest/**` MUST NOT make any authenticated network
   calls. The optional ingest script (`scripts/ingest-kraken-ohlc.js`,
   not implemented in SV2-1) makes only public, unauthenticated calls.
4. Code under `backtest/**` MUST NOT mutate `bot_control`,
   `position.json`, or any DB row.
5. Reverse-import ban: nothing outside `backtest/**` imports from here.

## Layout

```
backtest/
├── README.md                          (this file)
├── config/
│   └── strategy_v2.json               locked SV2 numeric params
├── data/
│   └── historical/                    (created by future ingest phase)
├── fixtures/
│   └── tiny-replay-1day.json          24 5m bars for tests
├── src/
│   ├── data-loader.js                 CSV/JSON loader + integrity checks
│   └── resampler.js                   5m → 15m, 5m → 4h (UTC-aligned)
└── tests/
    ├── test-data-loader.js
    └── test-resampler.js
```

## Phase status

| Phase | Status | Description |
|---|---|---|
| SV2-0 | done   | design (no code) |
| SV2-1 | active | data loader + resampler + integrity checks (this phase) |
| SV2-2 | pending | 4h trend filter feature |
| SV2-3 | pending | 15m sweep + 5m BOS + pullback features |
| SV2-4 | pending | signal combiner |
| SV2-5 | pending | position simulator |
| SV2-6 | pending | risk manager + daily caps |
| SV2-7 | pending | metrics + reporter |
| SV2-8 | pending | 30-day backtest end-to-end |
| SV2-9..11 | pending | 90d / 1y / 3y soak ladder |

## Running the SV2-1 tests

From the repository root:

```
node backtest/tests/test-data-loader.js
node backtest/tests/test-resampler.js
```

Both runners are pure: no DB, no Kraken, no network. Exit 0 on all-pass,
exit 1 on any failure.

## Live status (for the record)

Live remains **NO-GO**. The live activation contract is unchanged:
- `paperTrading=true`
- `LIVE_TRADING_ARMED` not set
- D-5.10.6 final activation gate unimplemented
- D-5.10.5.5 mode-cutover Gate 9 still BLOCKs (3 paper orphans)
- LC-1 §10.4 unsigned

This phase did not touch any of those layers.
