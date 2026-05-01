// Phase D-5.10.5.8.1 — pure comparator library for DB-vs-venue
// reconciliation. Side-effect free; no DB, no Kraken, no Discord, no
// filesystem, no `bot_control`, no `bot.js` imports. Single export:
// `reconcile(dbPosition, venueSnapshot, options)` returns a verdict
// object. Callers (the shadow CLI in 8.1, the bot preflight loop in
// 8.2) supply both inputs and decide what to do with the verdict.
//
// SAFETY CONTRACT
// ---------------
// 1. No imports from db.js, krakenApi, fs, child_process, or any module
//    that performs I/O.
// 2. Deterministic given the same inputs (`options.now` controls the
//    only clock read; defaults to `new Date()`).
// 3. Cannot mutate `dbPosition` or `venueSnapshot`; the function reads
//    only.
// 4. Cannot HALT, cannot write `bot_control`, cannot post to Discord.
// 5. Returns classification only; the bot's enforcement path lives
//    elsewhere and is wired in D-5.10.5.8.2.

// ─── Severity ranking ───────────────────────────────────────────────────────
export const SEVERITY = Object.freeze({
  OK:            0,
  WARN:          1,
  HALT:          2,
  CATASTROPHIC:  3,
});
const SEVERITY_NAMES = ["OK", "WARN", "HALT", "CATASTROPHIC"];

function severityName(level) {
  return SEVERITY_NAMES[level] ?? "OK";
}

function maxSeverity(fields) {
  let max = SEVERITY.OK;
  for (const f of fields) {
    const lvl = SEVERITY[f.severity] ?? SEVERITY.OK;
    if (lvl > max) max = lvl;
  }
  return severityName(max);
}

// ─── Default tolerances (per parent design D-5.10.5.8 §6) ──────────────────
export const DEFAULT_TOLERANCES = Object.freeze({
  quantityRel:        0.005,    // 0.5% rel
  quantityAbsFloor:   1e-6,     // absolute floor
  entryPriceRel:      0.005,    // 0.5% rel
  slPriceRel:         0.001,    // 0.1% rel
  tpPriceRel:         0.001,    // 0.1% rel
  unrealizedPnlMult:  5.0,      // > 5x expected magnitude triggers WARN
  staleWarnMs:        5  * 60 * 1000,   // > 5min  → WARN
  staleHaltMs:        30 * 60 * 1000,   // > 30min → HALT
});

// ─── Helpers ────────────────────────────────────────────────────────────────
function num(v) {
  if (v == null) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : null;
}

function withinRel(a, b, rel, absFloor = 0) {
  const A = Math.abs(a), B = Math.abs(b);
  const tol = Math.max(rel * Math.max(A, B), absFloor);
  return Math.abs(a - b) <= tol;
}

function relDiff(a, b) {
  const A = Math.abs(a), B = Math.abs(b);
  const denom = Math.max(A, B);
  if (denom === 0) return 0;
  return Math.abs(a - b) / denom;
}

function normalizeSymbol(s) {
  if (s == null) return null;
  return String(s).toUpperCase().replace(/[\/\-_:]/g, "");
}

// Kraken `type` field is `buy` or `sell`. DB `side` is `long` or `short`.
function venueSideToDbSide(venueType) {
  if (venueType === "buy")  return "long";
  if (venueType === "sell") return "short";
  return null;
}

function field(name, severity, dbValue, venueValue, reasonCode, message) {
  return { field: name, severity, dbValue, venueValue, reasonCode, message };
}

// ─── Per-field comparators ──────────────────────────────────────────────────
function compareMode(db, venue) {
  const dbMode    = db?.mode ?? null;
  const venueMode = venue?.mode ?? null;     // top-level snapshot attribute
  if (dbMode === venueMode) {
    return field("mode", "OK", dbMode, venueMode, "match", "mode matches");
  }
  return field("mode", "HALT", dbMode, venueMode, "mismatch",
    `db mode=${dbMode} but venue mode=${venueMode} — refusing live reconciliation across modes`);
}

function compareSymbol(db, venue) {
  const dbSym    = normalizeSymbol(db?.symbol ?? null);
  const venueSym = normalizeSymbol(venue?.position?.pair ?? null);
  if (!venue?.position) {
    return field("symbol", "OK", dbSym, null, "no_venue_position", "no open position at venue — symbol n/a");
  }
  if (dbSym === venueSym) {
    return field("symbol", "OK", db?.symbol ?? null, venue?.position?.pair ?? null, "match", "symbol matches");
  }
  return field("symbol", "CATASTROPHIC", db?.symbol ?? null, venue?.position?.pair ?? null,
    "mismatch", `db symbol=${db?.symbol} but venue symbol=${venue?.position?.pair}`);
}

function compareSide(db, venue) {
  const dbSide      = db?.side ?? null;
  const venueSide   = venueSideToDbSide(venue?.position?.side ?? null);
  if (!venue?.position) {
    return field("side", "OK", dbSide, null, "no_venue_position", "no open position at venue — side n/a");
  }
  if (dbSide === venueSide) {
    return field("side", "OK", dbSide, venue?.position?.side, "match", "side matches");
  }
  return field("side", "CATASTROPHIC", dbSide, venue?.position?.side ?? null,
    "mismatch", `db side=${dbSide} but venue type=${venue?.position?.side} (→ ${venueSide})`);
}

function compareLeverage(db, venue) {
  const dbLev    = num(db?.leverage);
  const venueLev = num(venue?.position?.leverage);
  if (!venue?.position) {
    return field("leverage", "OK", dbLev, null, "no_venue_position", "no open position at venue — leverage n/a");
  }
  if (dbLev == null || venueLev == null) {
    return field("leverage", "WARN", dbLev, venueLev, "missing", "leverage missing on one side — cannot compare");
  }
  if (Math.round(dbLev) === Math.round(venueLev)) {
    return field("leverage", "OK", dbLev, venueLev, "match", "leverage matches");
  }
  return field("leverage", "HALT", dbLev, venueLev, "mismatch",
    `db leverage=${dbLev} but venue leverage=${venueLev}`);
}

function compareQuantity(db, venue, t) {
  const dbQty    = num(db?.quantity);
  const venueVol = num(venue?.position?.volume);
  if (!venue?.position) {
    return field("quantity", "OK", dbQty, null, "no_venue_position", "no open position at venue — qty n/a");
  }
  if (dbQty == null || venueVol == null) {
    return field("quantity", "WARN", dbQty, venueVol, "missing", "quantity missing on one side");
  }
  // Kraken reports remaining = vol - vol_closed. Reconcile against the open size.
  const venueClosed = num(venue?.position?.volumeClosed) ?? 0;
  const venueOpen   = venueVol - venueClosed;
  if (withinRel(dbQty, venueOpen, t.quantityRel, t.quantityAbsFloor)) {
    return field("quantity", "OK", dbQty, venueOpen, "match",
      `quantity within tolerance (rel ${(relDiff(dbQty, venueOpen) * 100).toFixed(4)}%)`);
  }
  return field("quantity", "HALT", dbQty, venueOpen, "drift",
    `quantity drift ${(relDiff(dbQty, venueOpen) * 100).toFixed(4)}% beyond ${t.quantityRel * 100}% tolerance`);
}

function compareOrderIdLinkage(db, venue) {
  const dbOid    = db?.kraken_order_id ?? null;
  const venueTxid = venue?.position?.txid ?? null;
  const venueLinkedTxids = Array.isArray(venue?.position?.linkedOrderTxids)
    ? venue.position.linkedOrderTxids
    : [];
  if (!venue?.position) {
    return field("order_id_linkage", "OK", dbOid, null, "no_venue_position", "no open position at venue — linkage n/a");
  }
  if (!dbOid) {
    return field("order_id_linkage", "WARN", dbOid, venueTxid, "missing_db", "db has no kraken_order_id");
  }
  if (dbOid === venueTxid || venueLinkedTxids.includes(dbOid)) {
    return field("order_id_linkage", "OK", dbOid, venueTxid, "match", "order id linked to venue position");
  }
  return field("order_id_linkage", "HALT", dbOid, venueTxid, "broken",
    `db kraken_order_id=${dbOid} not present in venue position txid or linked txids`);
}

function compareEntryPrice(db, venue, t) {
  const dbEntry    = num(db?.entry_price);
  const venueEntry = num(venue?.position?.entryPrice);
  if (!venue?.position) {
    return field("entry_price", "OK", dbEntry, null, "no_venue_position", "no open position at venue — entry n/a");
  }
  if (dbEntry == null || venueEntry == null) {
    return field("entry_price", "WARN", dbEntry, venueEntry, "missing", "entry price missing on one side");
  }
  if (withinRel(dbEntry, venueEntry, t.entryPriceRel, 0)) {
    return field("entry_price", "OK", dbEntry, venueEntry, "match",
      `entry price within tolerance (rel ${(relDiff(dbEntry, venueEntry) * 100).toFixed(4)}%)`);
  }
  // Single-cycle classification is WARN; escalation to HALT (after 2 cycles)
  // is the caller's responsibility (8.2 wires the streak counter).
  return field("entry_price", "WARN", dbEntry, venueEntry, "drift",
    `entry price drift ${(relDiff(dbEntry, venueEntry) * 100).toFixed(4)}% beyond ${t.entryPriceRel * 100}% tolerance`);
}

function compareStopLoss(db, venue, t) {
  const dbSl     = num(db?.stop_loss);
  const dbSlOid  = db?.kraken_sl_order_id ?? null;   // captured in D-5.10.5.8.3, often null in 8.1
  const venueSl  = venue?.workingOrders?.stopLoss ?? null;

  if (dbSl == null) {
    return [
      field("sl_present", "OK", dbSl, null, "no_db_sl", "db has no stop_loss configured"),
      field("sl_price",   "OK", dbSl, null, "no_db_sl", "db has no stop_loss configured"),
    ];
  }
  if (!venue?.position) {
    return [
      field("sl_present", "OK", dbSl, null, "no_venue_position", "no open position at venue — sl n/a"),
      field("sl_price",   "OK", dbSl, null, "no_venue_position", "no open position at venue — sl n/a"),
    ];
  }
  // 8.1: if dbSlOid is missing (no capture path yet), the SL working-order
  // check is advisory. Treat as WARN, not HALT, until D-5.10.5.8.3 wires
  // the capture in placeKrakenOrder/manageActiveTrade.
  const presenceSeverityCatastrophic = dbSlOid != null;
  if (!venueSl) {
    return [
      field("sl_present",
        presenceSeverityCatastrophic ? "CATASTROPHIC" : "WARN",
        dbSl, null,
        "missing_at_venue",
        presenceSeverityCatastrophic
          ? `db expected SL at $${dbSl} (kraken_sl_order_id=${dbSlOid}) but no working order present at venue`
          : `db expected SL at $${dbSl} but working-order link not captured (D-5.10.5.8.3 deferred); cannot enforce`),
      field("sl_price",   "OK",  dbSl, null, "no_venue_sl", "no venue working SL to compare against"),
    ];
  }
  const venuePrice = num(venueSl.price);
  if (venuePrice == null) {
    return [
      field("sl_present", "OK",   dbSl, venueSl, "present", "venue working SL present"),
      field("sl_price",   "WARN", dbSl, venuePrice, "missing", "venue SL price unparseable"),
    ];
  }
  if (withinRel(dbSl, venuePrice, t.slPriceRel, 0)) {
    return [
      field("sl_present", "OK", dbSl, venueSl, "present", "venue working SL present"),
      field("sl_price",   "OK", dbSl, venuePrice, "match",
        `sl price within tolerance (rel ${(relDiff(dbSl, venuePrice) * 100).toFixed(4)}%)`),
    ];
  }
  return [
    field("sl_present", "OK",   dbSl, venueSl, "present", "venue working SL present"),
    field("sl_price",   "HALT", dbSl, venuePrice, "drift",
      `sl price drift ${(relDiff(dbSl, venuePrice) * 100).toFixed(4)}% beyond ${t.slPriceRel * 100}% tolerance`),
  ];
}

function compareTakeProfit(db, venue, t) {
  const dbTp    = num(db?.take_profit);
  const venueTp = venue?.workingOrders?.takeProfit ?? null;
  if (dbTp == null) {
    return [
      field("tp_present", "OK", dbTp, null, "no_db_tp", "db has no take_profit configured"),
      field("tp_price",   "OK", dbTp, null, "no_db_tp", "db has no take_profit configured"),
    ];
  }
  if (!venue?.position) {
    return [
      field("tp_present", "OK", dbTp, null, "no_venue_position", "no open position at venue — tp n/a"),
      field("tp_price",   "OK", dbTp, null, "no_venue_position", "no open position at venue — tp n/a"),
    ];
  }
  if (!venueTp) {
    return [
      field("tp_present", "WARN", dbTp, null, "missing_at_venue",
        `db expected TP at $${dbTp} but no working order present at venue`),
      field("tp_price",   "OK",  dbTp, null, "no_venue_tp", "no venue working TP to compare against"),
    ];
  }
  const venuePrice = num(venueTp.price);
  if (venuePrice == null) {
    return [
      field("tp_present", "OK",   dbTp, venueTp, "present", "venue working TP present"),
      field("tp_price",   "WARN", dbTp, venuePrice, "missing", "venue TP price unparseable"),
    ];
  }
  if (withinRel(dbTp, venuePrice, t.tpPriceRel, 0)) {
    return [
      field("tp_present", "OK", dbTp, venueTp, "present", "venue working TP present"),
      field("tp_price",   "OK", dbTp, venuePrice, "match",
        `tp price within tolerance (rel ${(relDiff(dbTp, venuePrice) * 100).toFixed(4)}%)`),
    ];
  }
  return [
    field("tp_present", "OK",   dbTp, venueTp, "present", "venue working TP present"),
    field("tp_price",   "WARN", dbTp, venuePrice, "drift",
      `tp price drift ${(relDiff(dbTp, venuePrice) * 100).toFixed(4)}% beyond ${t.tpPriceRel * 100}% tolerance`),
  ];
}

function compareStaleness(db, venue, t, now) {
  const fetchedAt = venue?.fetchedAt ? new Date(venue.fetchedAt).getTime() : null;
  if (!Number.isFinite(fetchedAt)) {
    return field("snapshot_freshness", "WARN", null, venue?.fetchedAt ?? null,
      "missing", "venue snapshot has no fetchedAt timestamp");
  }
  const ageMs = now.getTime() - fetchedAt;
  if (ageMs < 0) {
    return field("snapshot_freshness", "WARN", null, ageMs, "future",
      "venue snapshot fetchedAt is in the future");
  }
  if (ageMs > t.staleHaltMs) {
    return field("snapshot_freshness", "HALT", t.staleHaltMs, ageMs, "stale_halt",
      `snapshot age ${Math.round(ageMs/1000)}s exceeds halt threshold ${Math.round(t.staleHaltMs/1000)}s`);
  }
  if (ageMs > t.staleWarnMs) {
    return field("snapshot_freshness", "WARN", t.staleWarnMs, ageMs, "stale_warn",
      `snapshot age ${Math.round(ageMs/1000)}s exceeds warn threshold ${Math.round(t.staleWarnMs/1000)}s`);
  }
  return field("snapshot_freshness", "OK", null, ageMs, "fresh",
    `snapshot age ${Math.round(ageMs/1000)}s within thresholds`);
}

function compareUnrealizedPnl(db, venue, t) {
  if (!venue?.position) {
    return field("upnl_sanity", "OK", null, null, "no_venue_position", "no open position at venue — upnl n/a");
  }
  const venueNet = num(venue?.position?.net);
  if (venueNet == null) {
    return field("upnl_sanity", "OK", null, null, "no_venue_upnl", "venue did not report net upnl — skipping sanity");
  }
  // We don't compute a local uPnL in 8.1 (no mark price source); just record
  // the venue value for audit. In 8.2 the bot can supply a locally-computed
  // expected via options.expectedUpnl for sanity comparison.
  return field("upnl_sanity", "OK", null, venueNet, "logged", `venue net upnl=${venueNet}`);
}

// ─── Main entry point ──────────────────────────────────────────────────────
export function reconcile(dbPosition, venueSnapshot, options = {}) {
  if (dbPosition == null || typeof dbPosition !== "object") {
    throw new TypeError("reconcile: dbPosition must be an object");
  }
  if (venueSnapshot == null || typeof venueSnapshot !== "object") {
    throw new TypeError("reconcile: venueSnapshot must be an object");
  }

  const tolerances = Object.freeze({
    ...DEFAULT_TOLERANCES,
    ...(options.tolerances || {}),
  });
  const now = options.now ? new Date(options.now) : new Date();

  const fields = [];
  fields.push(compareMode(dbPosition, venueSnapshot));
  fields.push(compareSymbol(dbPosition, venueSnapshot));
  fields.push(compareSide(dbPosition, venueSnapshot));
  fields.push(compareLeverage(dbPosition, venueSnapshot));
  fields.push(compareQuantity(dbPosition, venueSnapshot, tolerances));
  fields.push(compareOrderIdLinkage(dbPosition, venueSnapshot));
  fields.push(compareEntryPrice(dbPosition, venueSnapshot, tolerances));
  fields.push(...compareStopLoss(dbPosition, venueSnapshot, tolerances));
  fields.push(...compareTakeProfit(dbPosition, venueSnapshot, tolerances));
  fields.push(compareStaleness(dbPosition, venueSnapshot, tolerances, now));
  fields.push(compareUnrealizedPnl(dbPosition, venueSnapshot, tolerances));

  return {
    verdict: maxSeverity(fields),
    fields,
    catastrophicCount: fields.filter(f => f.severity === "CATASTROPHIC").length,
    haltCount:         fields.filter(f => f.severity === "HALT").length,
    warnCount:         fields.filter(f => f.severity === "WARN").length,
    okCount:           fields.filter(f => f.severity === "OK").length,
    generatedAt:       now.toISOString(),
    toleranceConfig:   tolerances,
    phase:             "d-5.10.5.8.1",
  };
}
