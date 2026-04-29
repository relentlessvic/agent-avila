# Agent Avila

An adaptive, rule-based XRP trading system. Runs a deterministic 4-condition entry signal on 5-minute candles, executes against Kraken (paper or live), and ships with a web dashboard, 2FA-protected auth, Discord alerts, and an embedded health watchdog.

> **Not AI for trading decisions.** A statistical adaptive execution engine: parameters (entry threshold, risk multiplier, leverage cap) shift based on measurable performance metrics — win rate, drawdown, market regime, volatility. The strategy itself is fixed in `rules.json`.

---

## What it actually does

| Layer | Behavior |
|---|---|
| **Strategy** | EMA(8) + RSI(3) + VWAP + overextension check on XRPUSDT 5m candles. 4-condition signal scored 0–100; trade fires at ≥ 75 (threshold adapts to recent performance). |
| **Risk** | Stop loss + take profit (volatility-aware), breakeven move, trailing stop, daily trade cap, cooldown after each trade, kill switch on drawdown, auto-pause after consecutive losses. |
| **Execution** | Kraken spot via HMAC-SHA512 signed REST. PID lock prevents concurrent bot processes (cron + embedded runner can both fire — never overlap). |
| **Dashboard** | Single-page web UI: live price + position + P&L + status bar with regime/score/bot pills. TradingView widget chart. Bot controls (pause/stop/kill, leverage, SL/TP, daily loss cap). |
| **Auth** | Email + password + TOTP 2FA, with backup phrase recovery. File-backed sessions survive Railway restarts. 30-day "remember me" cookie. |
| **Alerts** | Discord webhook: BUY signal, SELL signal (with reason + P&L), RISK alerts (auto-pause / kill switch / failed live order), and a daily summary at first cycle past midnight UTC. |
| **Watchdog** | Embedded health monitor runs every 5 min on Railway. Detects stale bot, dead PID lock, high memory, kill-switch trips → posts to Discord with 1h per-issue throttle. |
| **Tests** | 9 Playwright tests covering modal recursion, drawer navigation, scroll-into-view, viewport landing. |

---

## Architecture

Three production processes:

1. **`bot.js`** — single-shot trading engine. Each invocation: acquires PID lock → fetches OHLC from Kraken → calculates indicators → checks safety guards → scores signal → enters/exits if conditions align → writes state files + tax CSV → releases lock and exits.
2. **`dashboard.js`** — long-running HTTP server. Serves the auth'd web UI, exposes `/api/health`, `/api/me`, `/api/system-status`, `/api/run-bot`, etc. On Railway, also runs an embedded copy of the bot every 5 minutes plus the health watchdog.
3. **`system-guardian.js`** — pure ESM module. Reads file-based state and reports system status; called by both the dashboard's status endpoint and the watchdog loop.

State is **file-based**, not in-memory, because `bot.js` and `dashboard.js` are separate processes on Railway and can't share JS-level memory.

---

## File structure

```
agent-avila/
├── bot.js                    # Trading engine (entry point for cron + manual)
├── dashboard.js              # HTTP server + embedded HTML/CSS/JS UI + auth
├── system-guardian.js        # Health/status logic (ESM module)
├── rules.json                # Strategy definition (entry rules, thresholds)
├── run-bot.sh                # Bash wrapper for local cron
├── railway.json              # Nixpacks build config (minimal)
├── package.json              # Scripts: start / dashboard / test / deploy
├── playwright.config.js      # Test runner config
├── tests/
│   ├── modal.spec.js         # Confirm-modal recursion / pointer-events
│   └── nav.spec.js           # Menu drawer + tab switching
├── docs/
│   └── exchanges/*.md        # API setup notes per exchange
├── prompts/                  # Strategy-extraction prompt templates
├── .env.example              # Placeholder env vars (commit-safe)
└── .gitignore                # Excludes .env, runtime state, lock files
```

**Runtime state files** (all gitignored, written by the bot/dashboard at runtime):

| File | Owner | Purpose |
|---|---|---|
| `safety-check-log.json` | bot.js | Decision log — every cycle's signal, reasoning, outcome |
| `position.json` | bot.js | Currently open trade (entry, SL/TP, leverage) |
| `bot-control.json` | dashboard + bot | Pause / stop / kill / risk knobs (UI-controllable) |
| `performance-state.json` | bot.js | Adaptive metrics — win rate, drawdown, threshold |
| `portfolio-state.json` | bot.js | Portfolio health score |
| `capital-state.json` | bot.js | XRP role + active/reserve split |
| `sessions-store.json` | dashboard.js | Active + pending 2FA sessions |
| `.bot.lock` | bot.js | PID lock; auto-released on exit |
| `.bot-log-state.json` | bot.js | Per-issue log dedup timestamps |
| `trades.csv` | bot.js | Tax-ready trade record |

---

## Setup

### Prerequisites
- Node.js 18+
- A Kraken API key with **View + Trade** permissions only — **withdrawals OFF**

### Local install

```bash
git clone <repo-url>
cd agent-avila
npm install
cp .env.example .env
# fill in .env (see Environment variables below)
```

### Run locally

| Command | What it does |
|---|---|
| `node bot.js` | Run one trading cycle (acquires lock, evaluates, exits) |
| `node dashboard.js` | Start the dashboard at `http://localhost:3000` |
| `npm test` | Run the Playwright suite (auto-starts dashboard on :3050) |
| `npm run deploy` | Push current working directory to Railway |

The dashboard requires the same `.env` to be present — it reads `DASHBOARD_EMAIL` / `DASHBOARD_PASSWORD` / `DASHBOARD_TOTP_SECRET` for login.

### First-time TOTP setup

`DASHBOARD_TOTP_SECRET` is a base32-encoded secret. To enroll an authenticator app (Authy, Google Authenticator, 1Password, etc.):

1. Set `DASHBOARD_TOTP_SECRET` to any base32 string of your choosing (or leave it empty and let the dashboard generate one on first boot — check the server log for the value).
2. Add it to your authenticator app as a manual entry, label `Agent Avila`.
3. The 6-digit code rotates every 30 seconds.
4. `DASHBOARD_BACKUP_PHRASE` is a fallback — entering it on the 2FA screen acts as a one-shot recovery if you lose your TOTP device.

---

## Railway deployment

The project is hosted on Railway as **two services in one project**:

| Service | Role |
|---|---|
| `agent-avila-dashboard` | Long-running HTTP server (the dashboard URL). Also spawns `bot.js` every 5 min. |
| `claude-trading-bot` | Cron service that fires `bot.js` on a schedule (redundancy + ensures the bot still runs if the dashboard service is restarting). |

The PID lock in `bot.js` prevents the two runners from colliding — whichever process acquires `.bot.lock` first runs; the other exits cleanly.

### Deploying

```bash
npm run deploy
```

This runs `railway up --detach --service agent-avila-dashboard`, which uploads the working directory directly. A direct deploy is used because the GitHub-Railway webhook integration on the linked repo is currently set up manually — auto-deploy is optional, not required.

### Setting Railway env vars

For each service in the Railway UI → Variables tab, set the same values as `.env`. The `DISCORD_WEBHOOK_URL` should be set on **both** services (dashboard and cron) since both can spawn `bot.js`.

---

## Environment variables

All values in `.env.example` are placeholders. Real values go in your local `.env` (gitignored) and in Railway → Variables (per service).

| Var | Required | Purpose |
|---|---|---|
| `KRAKEN_API_KEY` | yes | Kraken REST API key — **View + Trade only**, withdrawals disabled |
| `KRAKEN_SECRET_KEY` | yes | Kraken API secret (base64) |
| `DASHBOARD_EMAIL` | yes | Login email for the web dashboard |
| `DASHBOARD_PASSWORD` | yes | Login password |
| `DASHBOARD_TOTP_SECRET` | yes | Base32 secret for TOTP 2FA |
| `DASHBOARD_BACKUP_PHRASE` | yes | One-shot recovery phrase if TOTP is lost |
| `SYMBOL` | yes | Symbol in Binance format (e.g. `XRPUSDT`) — bot maps to Kraken pair internally |
| `TIMEFRAME` | yes | `5m`, `15m`, `1h`, `4h`, `1d` |
| `PAPER_TRADING` | yes | `true` to log decisions without placing orders, `false` to go live |
| `PAPER_STARTING_BALANCE` | yes | Virtual USD balance for paper mode |
| `PORTFOLIO_VALUE_USD` | yes | Used to size positions |
| `MAX_TRADE_SIZE_USD` | yes | Per-trade cap |
| `MAX_TRADES_PER_DAY` | yes | Daily entry cap |
| `LEVERAGE` | yes | Default leverage (1–3) |
| `STOP_LOSS_PCT` | yes | SL distance from entry |
| `TAKE_PROFIT_PCT` | yes | TP distance from entry |
| `TRADE_MODE` | yes | `spot` (Kraken perps not supported here) |
| `DISCORD_WEBHOOK_URL` | optional | Channel webhook for entry/exit/risk alerts |
| `ANTHROPIC_API_KEY` | optional | Enables the in-dashboard chat assistant |

---

## Security

- **Withdrawals must be OFF on your Kraken API key.** This is the single most important guardrail. Without it, a leaked key can drain the account.
- **TOTP 2FA is required** on the dashboard. If `DASHBOARD_TOTP_SECRET` is missing, login is impossible — there is no bypass.
- **Sessions are HttpOnly + SameSite=Strict cookies.** No JWT tokens exposed to JavaScript.
- **`/api/run-bot` requires a valid session.** Anonymous bot triggers are not possible.
- **Rate limit:** 8 failed logins per IP per 5 minutes returns 429.
- **No browser secrets.** The TradingView API key, Kraken keys, and Discord webhook live only on the server; the browser sees none of them.
- **`.env` is gitignored.** Verify with `git check-ignore .env`.

If a secret is ever leaked (pasted in a transcript, committed by mistake, etc.), **rotate immediately**:
- Kraken: kraken.com → Security → API → revoke + reissue
- Discord webhook: channel settings → Integrations → Webhooks → delete + recreate
- TOTP secret: change `DASHBOARD_TOTP_SECRET` and re-enroll the authenticator
- Backup phrase: change `DASHBOARD_BACKUP_PHRASE`

---

## Risk disclaimer

**This is not financial advice and there is no guarantee of profit.** Crypto markets are volatile; you can lose your entire balance. Strategy parameters that worked yesterday may fail today. Backtest results do not predict live performance.

The bot enforces hard limits (kill switch, daily cap, trade size cap, cooldown), but no software guarantee replaces capital you can afford to lose. Read the strategy in `rules.json` and the safety code in `bot.js` before risking real money.

---

## Paper trading first — non-negotiable

**Before flipping `PAPER_TRADING=false`:**

1. Run in paper mode for at least one full week of market activity.
2. Verify every trade in `safety-check-log.json` matches your expectations — entries, exits, P&L, the conditions that fired.
3. Confirm Discord alerts are firing on entry, exit, pause, and kill switch.
4. Confirm the kill switch and auto-pause mechanics by inducing them (force a paper drawdown).
5. Confirm `position.json` and `safety-check-log.json` are being written and the dashboard reflects them.
6. Watch at least one paper entry → exit lifecycle from your phone — make sure Discord alerts and dashboard pills update as expected.

Only after all six pass should you set `PAPER_TRADING=false`. Even then, **the first live order should be observed end-to-end**. Set a small `MAX_TRADE_SIZE_USD` for the first few cycles.

---

## Resources

- [Kraken API docs](https://docs.kraken.com/rest/)
- [Discord webhook docs](https://discord.com/developers/docs/resources/webhook)
- [Railway docs](https://docs.railway.app/)
- TOTP reference: [RFC 6238](https://datatracker.ietf.org/doc/html/rfc6238)
