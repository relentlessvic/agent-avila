# D-5.12f — Live SELL_ALL DB-First Persistence Design

> **DOCS-ONLY ARTIFACT.** This document is a design record. It does NOT authorize any code phase, deploy, Kraken action, `MANUAL_LIVE_ARMED` toggle, migration application, or production state mutation. Per `orchestrator/HANDOFF-RULES.md` and `orchestrator/APPROVAL-GATES.md` gate 9 (live SL / TP / SELL_ALL semantics), the D-5.12f code-implementation phase is a separate, separately-approved phase that requires its own design pass acceptance, scoped HARD BLOCK lift on `dashboard.js`, Codex implementation review, and explicit per-change Victor / CEO operator approval.
>
> **Canonical authority:** `orchestrator/NEXT-ACTION.md` and `orchestrator/NEXT-ACTION-SELECTOR.md` (per `HANDOFF-RULES.md`). If this document ever conflicts with either canonical source, the canonical source wins and this document is treated as stale.
>
> **No packet substitutes for in-session operator approval** (per `orchestrator/APPROVAL-GATES.md` "What is NOT operator approval"). This document records the shape of an approval; the actual approval is Victor's in-session instruction.

**Phase name:** `D-5.12f-LIVE-SELLALL-DESIGN-SPEC`
**Phase mode:** DOCS-ONLY (Mode 3 per `orchestrator/PHASE-MODES.md`)
**Author:** Claude (Lead Engineer / Builder)
**Date:** 2026-05-06
**Status:** DRAFT — pending Codex docs-only review and explicit operator approval before commit. Conversation-only Codex round-1 (2026-05-06) returned PASS WITH REQUIRED EDITS on M2; Codex round-2 (2026-05-06) returned clean PASS, no required edits.

## §1 — Phase scope and intent

D-5.12f-LIVE-SELLALL-DESIGN-SPEC codifies the Codex-PASS-verified design for live `SELL_ALL` DB-first persistence as a permanent, version-controlled SAFE-class design record. The design itself is conversation-only and Codex-cleared; this document is the persisted form.

**In scope (this DOCS-ONLY phase):**
- Authoring this design record at `orchestrator/handoffs/D-5-12F-LIVE-SELLALL-DESIGN.md`.
- Status doc updates at `orchestrator/STATUS.md`, `orchestrator/CHECKLIST.md`, `orchestrator/NEXT-ACTION.md` recording the phase in progress.

**Out of scope:**
- Any edit to `dashboard.js`, `bot.js`, `db.js`, `migrations/`, `scripts/`, `package.json`, `package-lock.json`, `.env`, `.env.example`, `position.json`, `position.json.snap.20260502T020154Z`.
- Any edit to safety-policy docs (`PROTECTED-FILES.md`, `APPROVAL-GATES.md`, `PHASE-MODES.md`, `NEXT-ACTION-SELECTOR.md`, `ROLE-HIERARCHY.md`, `AUTOMATION-PERMISSIONS.md`, `HANDOFF-RULES.md`, `BLUEPRINT.md`, `CLAUDE.md`).
- Any deploy, migration application, Kraken action, or `MANUAL_LIVE_ARMED` toggle.
- The D-5.12f code-implementation phase. Separately gated. NOT authorized by this DOCS-ONLY record.
- The D-5.12e.1 emergency payload shape cleanup of the existing D-5.12e mutation at `dashboard.js:2138-2139`. Acknowledged as a deferred future phase (§10). NOT authorized by this DOCS-ONLY record.

## §2 — Today's live SELL_ALL handler (baseline)

Verbatim quote of `dashboard.js:2247-2255`:

```js
// Live path: byte-identical to today (Kraken balance gate + Kraken sell + JSON write).
const bal = await fetchKrakenBalance();
const xrp = bal.balances?.find(b => b.asset === "XRP");
if (!xrp || xrp.amount < 0.001) throw new Error("No XRP balance to sell");
const order = await execKrakenOrder("sell", krakenPair, xrp.amount.toFixed(8), 1);
const orderId = order.orderId;
writeFileSync(POSITION_FILE, JSON.stringify({ open: false }, null, 2));
balanceCache = null;
return { ok: true, message: `Live SELL ALL — ${xrp.amount.toFixed(4)} XRP at $${price.toFixed(4)}`, price, orderId, quantity: xrp.amount };
```

**Properties of the baseline:**
- Quantity source: Kraken wallet (`xrp.amount`), NOT DB.
- No DB persistence. `position.json` is set to `{open:false}` directly. No `closePosition` call. No `insertTradeEvent` row.
- No emergency-audit ladder (no DB call to fail).
- Pre-Kraken balance call doubles as a guard (`amount < 0.001`) and as a wallet-truth read.
- `balanceCache = null` only on the success path; no failure-path invalidation exists.
- No P&L computation (the row is wallet-flush, not position-close).
- Goes through the same `MANUAL_LIVE_COMMANDS` allowlist (`dashboard.js:94-101`), the same `MANUAL_LIVE_ARMED` Layer 1 / Layer 2 gates (`dashboard.js:1841-1843`), and the same dashboard typed-CONFIRM flow (`dashboard.js:5680-5697`, plus the `confirmTrade` typed-CONFIRM modal at `dashboard.js:5722-5734`).

## §3 — D-5.12e CLOSE_POSITION as template

The D-5.12e block at `dashboard.js:2070-2218` is the immediate template. Key contract anchors carried forward into D-5.12f:

- **Pre-Kraken canonical source:** `loadOpenPosition("live")` — throws `"No open live position to close"` BEFORE Kraken executes if null (`dashboard.js:2087-2088`).
- **Sell volume:** `parseFloat(dbPos.quantity).toFixed(8)` (`dashboard.js:2089`).
- **Helper:** `shadowRecordManualLiveClose(exitEntry)` — caller-driven failure ladder, returns `{ ok, reason, error?, errorClass?, emergency_context? }`, never invokes `_emergencyAuditWrite` itself.
- **Helper-internal `_redactAttemptedPayload` field shape (9 fields):** `{symbol, exit_price, exit_time, exit_reason, quantity, trade_size_usd, realized_pnl_usd, realized_pnl_pct, kraken_exit_order_id}` (`dashboard.js:813-823`). Helper-internal `metadata: { source: "manual_live_close" }` is hardcoded (`dashboard.js:806`).
- **On helper success:** `position.json {open:false}` write → best-effort LOG_FILE append → `balanceCache = null` → return.
- **On helper failure:** classify (`r.reason === "no_open_position"` → `kraken_post_success_db_no_open_position`; else → `kraken_post_success_db_other_error`); helper-provided `r.emergency_context.attempted_payload` preferred, call-site fallback recomputes via `_redactAttemptedPayload({...})` with the byte-stable 9-field shape using `exitEntry.symbol` (NOT `dbPos.symbol`, per the D-5.12e round-1 fix carried forward).
- **`failureContext` shape:** `{mode:"live", source:"manual_live_close", kraken_order_id, failure_class, error_message, attempted_payload}`.
- **Layer 2:** `_emergencyAuditWrite(failureContext)` → returns `{ok, event_id?}`.
- **Layer 3:** `_loglineFallback(JSON.stringify({event_id, mode, source, kraken_order_id, failure_class, error_message, attempted_payload, attempted_payload_hash, prior_failures, ts}))`.
- **Layer 4:** internal stderr triple-fault inside `_loglineFallback`.
- **Per Codex v2 ruling option (b):** `balanceCache = null` runs on EVERY post-Kraken outcome, placed AFTER audit/log work and BEFORE the conditional throws (OUTSIDE the `auditResult.ok` if/else logging branch).
- **Operator-visible error:** pointer-only — does NOT include `attempted_payload`. Pointer is `emergency audit row ${event_id}` (audit success) or `emergency audit DEGRADED — see LOG_FILE` (audit failure).
- **No `position.json` write on DB failure. No LOG_FILE success-row append on DB failure. No Kraken cancellation. No auto-retry.**

## §4 — Operator-set design defaults (binding)

The 18 binding defaults sent to and accepted by Codex round 2:

1. DB-driven sell volume via `loadOpenPosition("live")`; sell volume = `parseFloat(dbPos.quantity).toFixed(8)`. NOT Kraken-wallet-driven.
2. Pre-Kraken DB gate required: `loadOpenPosition("live")` null → throw `"No open live position to sell"` BEFORE any `execKrakenOrder` call.
3. Wallet deficit (wallet_xrp < db_quantity − 1e-8) → hard throw pre-Kraken.
4. Wallet excess (wallet_xrp > db_quantity + 1e-8) → structured `log.warn` line and proceed selling DB-tracked quantity only.
5. `fetchKrakenBalance()` retained pre-Kraken solely for the drift check; if it returns `{error}` → hard throw pre-Kraken (`"Live SELL_ALL: cannot read Kraken balance for drift check (${bal.error}). Aborting."`).
6. Helper reuse: `shadowRecordManualLiveClose` reused as-is. Helper-internal `metadata: { source: "manual_live_close" }` stays unchanged.
7. Call-site distinguishers carry the SELL_ALL semantics: `exitEntry.exitReason = "MANUAL_SELLALL"` and `failureContext.source = "manual_live_sellall"`.
8. `balanceCache = null` on EVERY post-Kraken outcome (success AND every DB-failure class), placed AFTER audit/log work and BEFORE throws, OUTSIDE the `auditResult.ok` if/else branch (Codex v2 ruling option (b) carried forward from D-5.12e).
9. `position.json` written ONLY on `r.ok === true`. No JSON fallback on DB failure.
10. Failure ladder: caller-driven, helper never invokes `_emergencyAuditWrite` itself. Layer 2 `_emergencyAuditWrite` → Layer 3 `_loglineFallback` → Layer 4 stderr triple-fault.
11. `failure_class` mapping: `r.reason === "no_open_position"` → `"kraken_post_success_db_no_open_position"`; else → `"kraken_post_success_db_other_error"`.
12. **`attempted_payload` byte-stable 9-field shape: `{symbol, exit_price, exit_time, exit_reason, quantity, trade_size_usd, realized_pnl_usd, realized_pnl_pct, kraken_exit_order_id}`. `symbol` MUST be `exitEntry.symbol`, NOT `dbPos.symbol` (D-5.12e round-1 fix carried forward). Per Codex round-1 M2 required edit (round-2 PASS): `attempted_payload` remains the pure 9-field redacted object — call-site MUST NOT mutate it by appending `attempted_payload_hash` as a 10th key. `attempted_payload_hash` is carried as a separate top-level variable only and surfaced into the Layer 3 reconstruction line as a top-level key only.**
13. `failureContext` shape: `{mode: "live", source: "manual_live_sellall", kraken_order_id: orderId, failure_class, error_message: r.error?.message ?? r.reason ?? null, attempted_payload}`.
14. Operator-visible thrown errors: pointer-only. Pointer = `emergency audit row ${event_id}` (audit success) or `emergency audit DEGRADED — see LOG_FILE` (audit failure). Errors do NOT include `attempted_payload`.
15. No auto-retry. No Kraken cancellation.
16. `MANUAL_LIVE_ARMED` Layer 1 / Layer 2 gates unchanged; typed-CONFIRM UI gate (`dashboard.js:5680-5697`, `confirmTrade` at `dashboard.js:5722-5734`) unchanged.
17. Migration 008 treated as APPLIED (per N-3 closure at HEAD `189eb1be6ef6304d914671bdaedec44d389cf877`, Attempt 6 — 2026-05-04, runner exit 0). `_emergencyAuditWrite` reaches a real `emergency_audit_log` table.
18. Future code-phase touch perimeter: `dashboard.js` SELL_ALL block ONLY (estimated ~140-155 ins / ~10 del). NO `bot.js`, NO `db.js`, NO `migrations/`, NO `scripts/`, NO `package*` files, NO `position.json`, NO orchestrator/* changes (other than separate DOCS-ONLY closeout). Helper changes zero. DB schema changes zero. Migration changes zero. Return shape on success additively includes `pnlPct` and `pnlUSD` (verified non-breaking by Codex round-2 against `dashboard.js:5705-5710` and trades.csv / SSE consumers).

## §5 — Three-scenario drift table

The SELL_ALL-specific drift handling, codified:

| Scenario | Wallet vs DB | Pre-Kraken behavior |
|---|---|---|
| **Clean** | `\|wallet − db.quantity\| ≤ 1e-8` | Proceed: sell `dbPos.quantity` |
| **Wallet excess** | wallet > db.quantity + 1e-8 (e.g., operator bought XRP outside the bot) | Proceed: sell `dbPos.quantity` only. Residue stays on wallet. Surface as structured WARN log: `log.warn("d-5.12f live-sellall", "wallet_excess_residue: wallet=${...} db=${...} residue=${...}")`. Closing the bot-tracked position cleanly is the higher-priority outcome; flushing residue is an out-of-band operator action. |
| **Wallet deficit** | wallet < db.quantity − 1e-8 (e.g., operator manually sold some on Kraken UI) | Hard throw pre-Kraken: `"Live SELL_ALL: wallet XRP (${wallet}) < DB-tracked quantity (${db}). Reconcile DB / Kraken before sell."` Reason: selling `dbPos.quantity` will fail at Kraken with insufficient-balance, and selling `wallet.amount` would silently shrink the realized close. Halt and surface. |

**Tolerance ε = 1e-8** (matches `toFixed(8)` precision; anything smaller is rounding noise).

**`fetchKrakenBalance()` failure pre-Kraken:** if `bal?.error` is set (no `balances` array), the drift comparison cannot run. Hard throw pre-Kraken (`"Live SELL_ALL: cannot read Kraken balance for drift check (${bal.error}). Aborting."`). Pre-Kraken throws are SAFE — no real money has moved.

## §6 — Failure-ladder restatement

**Pre-Kraken phase** (no money moved — pre-Kraken throws are SAFE):
1. `loadOpenPosition("live")` → if null, throw `"No open live position to sell"`.
2. `fetchKrakenBalance()` → if `{error}`, throw with operator message.
3. Drift check: deficit → throw; excess → `log.warn` and proceed.
4. Compute `sellVol = parseFloat(dbPos.quantity).toFixed(8)`.

**Kraken phase:**
5. `const order = await execKrakenOrder("sell", krakenPair, sellVol, 1); const orderId = order.orderId;` — past this line, real money has moved.

**Post-Kraken success:**
6. Build `exitEntry` with `exitReason: "MANUAL_SELLALL"`, `pct`, `pnlUSD` derived from `dbPos.entry_price` / `dbPos.quantity` / `dbPos.trade_size_usd`.
7. `await shadowRecordManualLiveClose(exitEntry)`.
8. On `r.ok`:
   - `writeFileSync(POSITION_FILE, JSON.stringify({ open: false }, null, 2));`
   - Best-effort LOG_FILE append in try/catch with `log.warn("d-5.12f live-sellall", ...)` on failure.
   - `balanceCache = null;`
   - `return { ok: true, message: \`Live SELL ALL — ${quantity.toFixed(4)} XRP at $${price.toFixed(4)} | P&L ${pnlPct}% ($${pnlUSD})\`, price, orderId, quantity, pnlPct, pnlUSD };`

**Post-Kraken helper failure (real money moved; DB persist failed):**
9. Classify: `failure_class = r.reason === "no_open_position" ? "kraken_post_success_db_no_open_position" : "kraken_post_success_db_other_error"`.
10. Resolve `attempted_payload` / `attempted_payload_hash`:
    - If `r.emergency_context?.attempted_payload` present (helper-driven path): use it; `attempted_payload_hash = r.emergency_context.attempted_payload_hash ?? sha256HexCanonical(attempted_payload)`.
    - Else (early-return path: `no_open_position` / `db_unavailable` / `validation_failed`): call-site computes locally via `_redactAttemptedPayload({...9 fields with exitEntry.symbol...})`; `attempted_payload_hash = sha256HexCanonical(attempted_payload)`. **Per Codex round-1 M2 required edit (round-2 PASS): NO mutation appending the hash to the object.** `attempted_payload` remains the pure 9-field redacted object.
11. Build `failureContext = { mode: "live", source: "manual_live_sellall", kraken_order_id: orderId, failure_class, error_message: r.error?.message ?? r.reason ?? null, attempted_payload }`.
12. Layer 2: `const auditResult = await _emergencyAuditWrite(failureContext);`
13. On `auditResult.ok`: structured `log.error("d-5.12f live-sellall", ...)` with the failure-class-specific message (parallel to D-5.12e at `dashboard.js:2151-2165`).
14. On `!auditResult.ok`: build Layer 3 line `JSON.stringify({event_id: auditResult.event_id ?? null, mode: "live", source: "manual_live_sellall", kraken_order_id: orderId, failure_class, error_message: ..., attempted_payload, attempted_payload_hash, prior_failures: ["db_persistence_failed", "audit_insert_failed"], ts: new Date().toISOString()})`; `_loglineFallback(line)`; `log.error("d-5.12f live-sellall", "...")`.
15. **`balanceCache = null;`** — placed AFTER Layer 2/3 work, BEFORE the throws, OUTSIDE the `auditResult.ok` if/else (Codex v2 option (b)).
16. Pointer-only throw:
    - `kraken_post_success_db_no_open_position` → `"Live SELL_ALL: Kraken sold (orderId=${orderId}) but no open live position exists in the database (race or pre-existing drift). Manual operator reconciliation required. ${auditPointer}."`
    - `kraken_post_success_db_other_error` → `"Live SELL_ALL: Kraken sold (orderId=${orderId}) but DB persistence failed (${r.errorClass ?? r.reason ?? "db_error"}). ${auditPointer}. Position close is NOT recorded in DB or position.json. Reconstruct manually."`

## §7 — M2 round-2 correction (Codex-required)

Codex round 1 (2026-05-06) returned PASS WITH REQUIRED EDITS with a single blocking issue on M2 byte-stability:

> "In the call-site fallback path, do not mutate `attempted_payload` by appending `attempted_payload_hash` as a key inside the object before passing to `_emergencyAuditWrite`. The helper-internal redaction at `dashboard.js:813-823` emits only the 9 reconstruction fields; inserting `attempted_payload_hash` into `attempted_payload` in the fallback path creates a 10-field object whose canonical hash will not match. Keep `attempted_payload` as the pure 9-field shape; carry `attempted_payload_hash` as the separate top-level variable only."

The round-1 design pseudocode mirrored the shipped D-5.12e pattern at `dashboard.js:2138-2139` which contains the mutation:
```js
attempted_payload_hash = sha256HexCanonical(attempted_payload);
attempted_payload.attempted_payload_hash = attempted_payload_hash;   // ← mutation
```

The round-2 D-5.12f revision drops the mutation line. The call-site fallback for D-5.12f now reads:
```js
attempted_payload = _redactAttemptedPayload({ /* 9 fields */ });
attempted_payload_hash = sha256HexCanonical(attempted_payload);
// no mutation; pass the pure 9-field object to _emergencyAuditWrite
```

Codex round 2 (2026-05-06) returned clean PASS, no required edits, on all 13 items. M2 verbatim verdict: "the round-2 9-field fallback is byte-stable with the helper path: helper redaction builds exactly the nine close fields at dashboard.js:813-823, `_redactAttemptedPayload` is recursive and only strips keys matching the secret/key/token/etc. pattern at dashboard.js:606-622, and `_emergencyAuditWrite` re-redacts, hashes, builds event id, then injects the hash at dashboard.js:665-676. For 9-field helper and 9-field call-site fallback inputs with matching values, canonical bytes match through line 666 and the allowlisted event-id payload matches through line 675; the shipped 10-field D-5.12e input at dashboard.js:2138-2139 remains asymmetric but is out of scope as instructed."

## §8 — Proposed post-D-5.12f live SELL_ALL block (design pseudocode — NOT yet in working tree)

Marked design-only. NOT authorized. Implementation phase is separate.

```js
if (command === "SELL_ALL") {
  if (isPaper) {
    // [unchanged paper B.1 SELL_ALL — dashboard.js:2222-2245]
  }
  // Phase D-5.12f — DB-first live SELL_ALL persistence with fail-loud
  // caller-driven failure ladder. Mirror of D-5.12e CLOSE_POSITION
  // adapted for SELL_ALL semantics. Round-2 revision per Codex M2:
  // call-site fallback does not mutate attempted_payload.
  const dbPos = await loadOpenPosition("live");
  if (!dbPos) throw new Error("No open live position to sell");

  const bal = await fetchKrakenBalance();
  if (bal?.error) {
    throw new Error(`Live SELL_ALL: cannot read Kraken balance for drift check (${bal.error}). Aborting.`);
  }
  const xrp = bal.balances?.find(b => b.asset === "XRP");
  const walletAmount = xrp ? parseFloat(xrp.amount) : 0;
  const dbQuantity = parseFloat(dbPos.quantity);
  if (walletAmount < dbQuantity - 1e-8) {
    throw new Error(
      `Live SELL_ALL: wallet XRP (${walletAmount.toFixed(8)}) < DB-tracked quantity ` +
      `(${dbQuantity.toFixed(8)}). Reconcile DB / Kraken before sell.`
    );
  }
  if (walletAmount > dbQuantity + 1e-8) {
    log.warn(
      "d-5.12f live-sellall",
      `wallet_excess_residue: wallet=${walletAmount.toFixed(8)} db=${dbQuantity.toFixed(8)} ` +
      `residue=${(walletAmount - dbQuantity).toFixed(8)}`
    );
  }
  const sellVol = dbQuantity.toFixed(8);

  const order   = await execKrakenOrder("sell", krakenPair, sellVol, 1);
  const orderId = order.orderId;
  const entryPrice = parseFloat(dbPos.entry_price);
  const quantity   = dbQuantity;
  const tradeSize  = parseFloat(dbPos.trade_size_usd);
  const pnlPct = ((price - entryPrice) / entryPrice * 100).toFixed(2);
  const pnlUSD = ((price - entryPrice) / entryPrice * tradeSize).toFixed(2);
  const exitEntry = {
    type: "EXIT", timestamp: new Date().toISOString(),
    symbol, price, quantity, tradeSize, entryPrice,
    exitReason: "MANUAL_SELLALL",
    pct: pnlPct, pnlUSD,
    paperTrading: false, orderId,
    conditions: [], allPass: false, orderPlaced: true,
  };
  const r = await shadowRecordManualLiveClose(exitEntry);
  if (r.ok) {
    writeFileSync(POSITION_FILE, JSON.stringify({ open: false }, null, 2));
    try {
      tradeLog.trades.push(exitEntry);
      writeFileSync(LOG_FILE, JSON.stringify(tradeLog, null, 2));
    } catch (e) {
      log.warn("d-5.12f live-sellall", `LOG_FILE write failed (DB+JSON committed): ${e.message}`);
    }
    balanceCache = null;
    return {
      ok: true,
      message: `Live SELL ALL — ${quantity.toFixed(4)} XRP at $${price.toFixed(4)} | P&L ${pnlPct}% ($${pnlUSD})`,
      price, orderId, quantity, pnlPct, pnlUSD,
    };
  }
  const failure_class =
    r.reason === "no_open_position"
      ? "kraken_post_success_db_no_open_position"
      : "kraken_post_success_db_other_error";
  let attempted_payload, attempted_payload_hash;
  if (r.emergency_context && r.emergency_context.attempted_payload) {
    attempted_payload = r.emergency_context.attempted_payload;
    attempted_payload_hash = r.emergency_context.attempted_payload_hash ?? sha256HexCanonical(attempted_payload);
  } else {
    // Round-2 revision per Codex M2: attempted_payload remains pure 9-field
    // redacted object. NO mutation appending attempted_payload_hash.
    // Hash carried only as separate top-level variable.
    attempted_payload = _redactAttemptedPayload({
      symbol: exitEntry.symbol,
      exit_price: price,
      exit_time: exitEntry.timestamp,
      exit_reason: "MANUAL_SELLALL",
      quantity,
      trade_size_usd: tradeSize,
      realized_pnl_usd: parseFloat(pnlUSD),
      realized_pnl_pct: parseFloat(pnlPct),
      kraken_exit_order_id: orderId,
    });
    attempted_payload_hash = sha256HexCanonical(attempted_payload);
    // (intentional divergence from shipped D-5.12e dashboard.js:2138-2139;
    // see §10 D-5.12e.1 deferred cleanup note)
  }
  const failureContext = {
    mode: "live",
    source: "manual_live_sellall",
    kraken_order_id: orderId,
    failure_class,
    error_message: r.error?.message ?? r.reason ?? null,
    attempted_payload,
  };
  const auditResult = await _emergencyAuditWrite(failureContext);
  if (auditResult.ok) {
    if (failure_class === "kraken_post_success_db_no_open_position") {
      log.error("d-5.12f live-sellall",
        `Kraken sold (orderId=${orderId}) but no open live position exists in DB ` +
        `(race or pre-existing drift). Emergency audit row recorded ` +
        `(event_id=${auditResult.event_id}). Operator: reconcile DB / Kraken state.`);
    } else {
      log.error("d-5.12f live-sellall",
        `Kraken sold (orderId=${orderId}) but DB persist FAILED (${r.errorClass ?? r.reason ?? "db_error"}). ` +
        `Emergency audit row recorded (event_id=${auditResult.event_id}). ` +
        `Operator: reconstruct close from emergency_audit_log.`);
    }
  } else {
    const line = JSON.stringify({
      event_id: auditResult.event_id ?? null,
      mode: "live",
      source: "manual_live_sellall",
      kraken_order_id: orderId,
      failure_class,
      error_message: r.error?.message ?? r.reason ?? null,
      attempted_payload,
      attempted_payload_hash,
      prior_failures: ["db_persistence_failed", "audit_insert_failed"],
      ts: new Date().toISOString(),
    });
    _loglineFallback(line);
    log.error("d-5.12f live-sellall",
      `Kraken sold (orderId=${orderId}) but DB persist + emergency audit BOTH failed. ` +
      `Reconstruction line written to LOG_FILE (or stderr triple-fault).`);
  }
  balanceCache = null;
  const auditPointer = auditResult.ok
    ? `emergency audit row ${auditResult.event_id}`
    : `emergency audit DEGRADED — see LOG_FILE`;
  if (failure_class === "kraken_post_success_db_no_open_position") {
    throw new Error(
      `Live SELL_ALL: Kraken sold (orderId=${orderId}) but no open live position ` +
      `exists in the database (race or pre-existing drift). Manual operator ` +
      `reconciliation required. ${auditPointer}.`
    );
  } else {
    throw new Error(
      `Live SELL_ALL: Kraken sold (orderId=${orderId}) but DB persistence failed ` +
      `(${r.errorClass ?? r.reason ?? "db_error"}). ${auditPointer}. Position ` +
      `close is NOT recorded in DB or position.json. Reconstruct manually.`
    );
  }
}
```

## §9 — Durable safety invariants preserved

- No JSON fallback on DB failure. `position.json` is written only on `r.ok === true`.
- No auto-retry. Failure-ladder is single-pass; operator reconstructs manually.
- No Kraken cancellation. Once Kraken executes, the order stands.
- Pointer-only operator-visible errors. `attempted_payload` never enters thrown messages.
- Caller-driven emergency-audit ladder. Helper never invokes `_emergencyAuditWrite` itself.
- Byte-stable redaction field shape between helper-internal redaction and call-site fallback (9 fields, `exitEntry.symbol` not `dbPos.symbol`). Round-2 revision: NO mutation of `attempted_payload`.
- `balanceCache = null` on EVERY post-Kraken outcome (success AND every DB-failure class), placed after audit/log work and before throws, outside the `auditResult.ok` branch.
- LOG_FILE / stderr are local audit reconstruction surfaces, NOT authoritative state.
- `MANUAL_LIVE_ARMED` Layer 1 / Layer 2 gates intact.
- Typed-CONFIRM UI gate intact.
- DB-first contract for live mutations: `position.json` is a write-after-DB compatibility cache.
- One-position-per-mode unique constraint enforced at the DB level (race-detection via `closePosition` returning null `positionId` → `r.reason: "no_open_position"`).
- Migration 008 application status preserved (APPLIED at HEAD `189eb1be6ef6304d914671bdaedec44d389cf877`).

## §10 — D-5.12e.1 deferred cleanup note

Codex round-1 review of D-5.12f (2026-05-06) identified that shipped D-5.12e at `dashboard.js:2138-2139` carries the same mutation pattern that round-1 ruled blocking for D-5.12f:

```js
attempted_payload_hash = sha256HexCanonical(attempted_payload);
attempted_payload.attempted_payload_hash = attempted_payload_hash;   // ← inherited mutation in shipped D-5.12e
```

This produces a byte-stability divergence between helper-internal redaction (9 fields, `dashboard.js:813-823`) and the D-5.12e call-site fallback (10 fields), which propagates a different `attempted_payload_hash` and therefore a different `event_id` into `emergency_audit_log` depending on which path fires for the same incident class.

**D-5.12f is built without that mutation, per Codex M2 required edit (round-2 PASS).**

The shipped D-5.12e mutation is NOT fixed inside D-5.12f. It is recorded here as a separate, deferred future cleanup phase named **D-5.12e.1 — emergency payload shape cleanup**.

**D-5.12e.1 scope (when opened, separately authorized):**
- Review whether to remove the mutation line at `dashboard.js:2138-2139`.
- Phase mode: DESIGN-ONLY first (Codex docs/design review PASS), then HIGH-RISK IMPLEMENTATION (scoped HARD BLOCK lift on `dashboard.js`, Codex implementation review, explicit operator authorization).
- Touch perimeter: the single `dashboard.js:2138-2139` line (and any byte-equivalent companion if review surfaces one).
- Out of scope for D-5.12e.1: any change to D-5.12d (BUY) emergency context — separate phase if needed.

**Until D-5.12e.1 lands, the live close surface has a known shape asymmetry:**
- Live CLOSE_POSITION (D-5.12e — call-site fallback path): 10-field `attempted_payload` (hash key embedded inside).
- Live SELL_ALL (D-5.12f — call-site fallback path): 9-field `attempted_payload` (hash key only at row top level).

The asymmetry is forensically visible but does not affect idempotency (per-incident `event_id` is still unique per allowlist payload) and does not affect operator pointer-only error messages. Helper-internal paths (the hot path; `db_error`) for both close surfaces remain 9-field — those are byte-stable with each other.

D-5.12e.1 is OUT OF SCOPE for D-5.12f-LIVE-SELLALL-DESIGN-SPEC and is NOT authorized by this DOCS-ONLY phase.

## §11 — Codex review history

**Round 1 (2026-05-06, conversation-only):**
- Verdict: **PASS WITH REQUIRED EDITS** (overall).
- Single blocking required edit on **M2** (byte-stability of `attempted_payload` between helper and call-site fallback paths).
- All other 12 items (Q1, Q2, Q3, Q3 sub, Q4, Q5, Q5 sub, Q6, Q9, Q10, M1, M3) returned clean PASS.
- Required edit applied to D-5.12f design pseudocode (not to D-5.12e shipped code; see §10).

**Round 2 (2026-05-06, conversation-only, fresh thread):**
- Verdict: **PASS** (overall). **REQUIRED EDITS: None.**
- All 13 items returned PASS.
- M2 explicitly re-ruled PASS with full byte-stability analysis through `dashboard.js:606-622, 665-676, 813-823`.
- D-5.12e.1 deferred cleanup acknowledged as out of scope.

## §12 — Future code-phase touch perimeter

When the D-5.12f code-implementation phase is opened (separate phase, separate authorization):

**Touched:**
- `dashboard.js` SELL_ALL block at lines 2247-2255. Estimated diff shape: ~140-155 ins / ~10 del.

**NOT touched:**
- `bot.js`, `db.js`, `migrations/`, `scripts/`, `package.json`, `package-lock.json`, `.nvmrc`, `.env`, `.env.example`.
- `position.json`, `position.json.snap.20260502T020154Z`, `trades.csv`.
- All safety-policy docs.
- All other COMM-HUB / Hermes / autopilot docs.
- Discord, Hermes, Railway, env vars, secrets.
- Helpers (`shadowRecordManualLiveClose`, `_emergencyAuditWrite`, `_loglineFallback`, `_redactAttemptedPayload`, `sha256HexCanonical`, `buildEmergencyEventId`, `closePosition`, `insertTradeEvent`, `loadOpenPosition`).
- Any other `dashboard.js` block (BUY / OPEN_LONG, CLOSE_POSITION, SET_STOP_LOSS, SET_TAKE_PROFIT, balance / SSE / auth / dashboard render).

**DB schema:** zero changes.
**Migration:** zero new migration files; Migration 008 already applied.

## §13 — Phase-gating chain (still required before any D-5.12f code)

The D-5.12f code-implementation phase remains separately gated. Each of the following is an independent gate:

1. **This DOCS-ONLY phase** (`D-5.12f-LIVE-SELLALL-DESIGN-SPEC`) closed: Codex docs-only review PASS + explicit operator approval + commit + push.
2. **Master-order acknowledgment** per `orchestrator/NEXT-ACTION-SELECTOR.md` "Hard ordering rule": D-5.12f code work cannot precede ARC-4 → ARC-7 closure (currently active orchestrator surface). Operator may explicitly change the master order at any time.
3. **D-5.12f code-implementation phase open** (HIGH-RISK IMPLEMENTATION): scoped HARD BLOCK lift on `dashboard.js` (SELL_ALL block only), explicit operator authorization per ARC-2 gate 9 (live SELL_ALL semantics, real-money behavior change, per-change explicit operator approval required).
4. **Codex implementation review** of the actual `dashboard.js` diff: PASS required.
5. **Production deploy authorization** (Railway): per ARC-2 gate 10 (Railway / production target deployment).
6. **First production live SELL_ALL exercise:** separate `MANUAL_LIVE_ARMED` toggle authorization per ARC-2 gate 14.

A Codex PASS, clean working tree, green tests, scheduled trigger, signed token, autopilot best-candidate determination, and LLM self-approval do NOT clear any of these gates (selector rule 10).

## §14 — Cross-references

**Safety-policy framework:**
- `orchestrator/PROTECTED-FILES.md` — per-path SAFE / RESTRICTED / HARD BLOCK matrix.
- `orchestrator/APPROVAL-GATES.md` — 16-gate action-class matrix; gate 9 covers live SELL_ALL semantics.
- `orchestrator/PHASE-MODES.md` — six phase modes; this doc generated under DOCS-ONLY (Mode 3).
- `orchestrator/NEXT-ACTION-SELECTOR.md` — ten ordered selector rules; Hard ordering rule for D-5.12f.
- `orchestrator/ROLE-HIERARCHY.md` — five roles; Victor is sole approver.
- `orchestrator/AUTOMATION-PERMISSIONS.md` — GREEN / YELLOW / RED tiers; Codex PASS is governance-only.
- `orchestrator/HANDOFF-RULES.md` — packet rules; this doc is a SAFE-class design record (precedent: `COMM-HUB-HERMES-RUNTIME-DESIGN.md`, `N-2-MIGRATION-008-PRODUCTION-PLAN.md`).
- `orchestrator/BLUEPRINT.md` — architectural blueprint.
- `CLAUDE.md` (repo root) — top-level role / safety / change-discipline rules.

**Code anchors (`dashboard.js`):**
- `2247-2255` — today's live SELL_ALL handler (baseline).
- `2070-2218` — D-5.12e live CLOSE_POSITION (template).
- `1841-1843` — Layer 2 `MANUAL_LIVE_ARMED` gate.
- `94-101` — `MANUAL_LIVE_COMMANDS` allowlist.
- `5680-5734` — typed-CONFIRM UI gate (`tradeCmd` + `confirmTrade`).
- `2222-2245` — paper SELL_ALL B.1 reference.
- `585-700` — `_redactAttemptedPayload` / `_loglineFallback` / `_emergencyAuditWrite`.
- `606-622` — `_redactAttemptedPayload` recursive redaction.
- `665-676` — `_emergencyAuditWrite` defensive re-redaction + re-hash + event-id build + `attemptedPayloadForRow` injection.
- `704-838` — live shadow helpers (`shadowRecordManualLiveBuy`, `shadowRecordManualLiveClose`, `shadowRecordManualLiveSLUpdate`, `shadowRecordManualLiveTPUpdate`).
- `813-823` — helper-internal 9-field redaction shape (byte-stability anchor).
- `2138-2139` — shipped D-5.12e mutation line (deferred D-5.12e.1 cleanup).

**Orchestrator state at draft time:**
- HEAD: `fea7fb6f35d9e0be5b4499fc0f5004e2267bcc9e`.
- Migration 008 APPLIED at HEAD `189eb1be6ef6304d914671bdaedec44d389cf877`, Attempt 6, 2026-05-04.
- Working tree clean except untracked `position.json.snap.20260502T020154Z` (pre-existing forensics snapshot, durable across all tracks).

## §15 — Change history

- **2026-05-06 (DRAFT):** initial design record drafted post-Codex round-2 PASS. Author: Claude. Pending Codex docs-only review on this persisted form and explicit operator approval before commit.
