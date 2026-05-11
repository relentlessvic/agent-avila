# COMM-HUB-RELAY-RUNTIME-IMPLEMENT-F-HALT-AMENDMENT-DESIGN

**Phase identity:** `COMM-HUB-RELAY-RUNTIME-IMPLEMENT-F-HALT-AMENDMENT`
**Phase mode (future):** SAFE IMPLEMENTATION (Mode 4)
**Source-design phase:** `COMM-HUB-RELAY-RUNTIME-IMPLEMENT-F-HALT-AMENDMENT-DESIGN` (Mode 2 / DESIGN-ONLY conversation-only)
**Source-design HEAD anchor:** `4a0e5518638dd8afeb2adf8fc0245130f4e1e384` (parent repo; = F-HALT-CLOSEOUT commit)
**Relay-repo Phase F sealed anchor:** `b8ab035034668fd53ea6efe64432f0868dfd2eb9` (`relentlessvic/agent-avila-relay`)
**Codification phase:** `COMM-HUB-RELAY-RUNTIME-IMPLEMENT-F-HALT-AMENDMENT-DESIGN-SPEC` (DOCS-ONLY / Mode 3)

This document persists the Codex-PASS v5 conversation-only amendment design as a SAFE-class handoff record. The amendment corrects four confirmed interface-contract drifts between the Phase F boot orchestrator (`src/runtime/boot.js`) and the sealed Phase C/D/E factories it consumes. All required edits across Codex rounds 3, 4, and 5 are applied verbatim. The document is NOT approval to open the future amendment SAFE IMPLEMENTATION, NOT source code, NOT a network-touch, NOT a deploy.

---

## §0 — Phase classification & pre-flight verification

| Property | Value |
|---|---|
| Future phase name | `COMM-HUB-RELAY-RUNTIME-IMPLEMENT-F-HALT-AMENDMENT` |
| Future phase mode | SAFE IMPLEMENTATION (Mode 4) |
| Predecessor (Relay repo) | Phase F `COMM-HUB-RELAY-RUNTIME-IMPLEMENT-F-HALT` at `b8ab035034668fd53ea6efe64432f0868dfd2eb9` |
| Predecessor (parent repo) | F-HALT-CLOSEOUT at `4a0e5518638dd8afeb2adf8fc0245130f4e1e384` |
| Successor (lettered phase) | unchanged — Phase G-GATEWAY (first HIGH-RISK / Mode 5) |
| §15 extension before amendment | NOT required (no new halt class introduced) |
| Working tree at design time | clean except `position.json.snap.20260502T020154Z` (untracked carve-out) |

**Codex review history (source design phase, conversation-only):**

- **Round-3 (v3 narrow re-review):** PASS WITH REQUIRED EDITS. Goal 17 surfaced a fourth interface-contract drift on `createLimitsGate` / `channelRateLimits` and `getRateLimitState` shape mismatch; Goal 19 flagged the parent-HEAD anchor mismatch.
- **READ-ONLY AUDIT (post-round-3):** confirmed Bug 4 (`getRateLimitState` callable-shape drift). Parent HEAD reconciled: `51662f3…` was an ancestor 18 commits behind the current `4a0e5518…` HEAD; no commits lost; session-start `gitStatus` snapshot was stale.
- **Round-4 (v4 narrow re-review):** PASS WITH REQUIRED EDITS. 16 of 18 goals PASS. Goal 11 required two documentation corrections to §12 + §14 halt-class numbering.
- **READ-ONLY AUDIT (post-round-4):** verified Codex's halt-class numbering corrections by reading per-module `HALT_CLASS = Object.freeze({...})` constants in `src/verify/limits.js:25-28`, `src/verify/operator-authorization.js:38-41`, `src/runtime/boot.js:105-116`, `src/config.js:28-31`, and `src/runtime/rate-limit-state.js:38-40`.
- **Round-5 (v5 first dispatch):** mixed — all source-anchored substantive goals PASS (halt-class numbers verified against sealed source); procedural goals FAIL because v5 was intentionally conversation-only with no persisted file at the time of review.
- **Round-5 clarification (resume):** overall PASS. Procedural FAIL withdrawn after recognizing conversation-only mode. Changes A–E confirmed structurally sound and unchanged from v4 round-4 PASS. Parent HEAD discrepancy confirmed reconciled.

---

## §1 — Recommended phase name

`COMM-HUB-RELAY-RUNTIME-IMPLEMENT-F-HALT-AMENDMENT`

Forward-looking RELAY name per `CLAUDE.md` naming convention. Historical literals (sealed factory names, canonical `HALT_CLASS` constants, Phase F module file names) preserved verbatim.

---

## §2 — Recommended phase mode

**SAFE IMPLEMENTATION (Mode 4)** — same classification as Phase F itself.

Rationale:
- Amendment touches exactly 1 Relay file (`src/runtime/boot.js`) with ~30 lines across 5 hunks
- No new executable behavior beyond fixing latent interface-contract drifts
- No platform send-message API client, no network reach, no deploy, no production mutation, no trading path
- No sealed Phase C/D/E source modification — amendment lives entirely in Phase F's consumer wiring layer
- The Change-E adapter is in-process closure logic with no fs/network/env reads
- No new dependency
- No new env var, no new module export
- No Mode 5 HARD BLOCK surface present

---

## §3 — Confirmed Phase F interface-contract drifts (4)

| # | Bug | Sealed canonical source | Phase F call site | Runtime impact |
|---|---|---|---|---|
| 1 | `validateEnv` return-shape | `src/config.js:142, 189-196` returns `{ env }` | `src/runtime/boot.js:139-142` destructures `{ parsed }` | Hard crash TypeError pre-Stage 2 (fail-loud) |
| 2 | `createOperatorAuthorizationGate` parameter mismatch | `src/verify/operator-authorization.js:72-76` requires `stalenessThresholdMs` | `boot.js:374-381` (Stage 12) + `boot.js:481-488` (Stage 14) pass ignored `classAuthorizations` | Silent per-message staleness bypass; class-auth path unaffected (fail-silent security weakening) |
| 3 | `createLimitsGate` `channelRateLimits` omission | `src/verify/limits.js:56-61` requires `channelRateLimits`; dereferenced at `limits.js:79` | `boot.js:401-408` (Stage 12) + `boot.js:489-496` (Stage 14) omit it entirely | Fail-loud TypeError on per-message `verify()`; rate-limit safeguard bypassed via throw-before-check |
| 4 | `getRateLimitState` callable-shape | `limits.js:47-50, 81-82` documents/consumes `() → { channelName: count }` map; `rate-limit-state.js:5, 116-157` implements `({ channelName }) → status object` | `boot.js:494` direct pass-through; no adapter | Silent rate-limit bypass — `state[channel]` indexes into status object → undefined → 0 → `0 >= channelCap` always false; halt class 5 `RATE_LIMIT_HIT` never fires (fail-silent security weakening) |

All four bugs are wired-but-not-activated in production because Phase F is not yet exercised live (no `operatorPhaseId`, no Phase G hook; production path fails closed by design). The amendment fixes them at the wiring layer without modifying any sealed Phase C/D/E factory.

---

## §4 — Amendment scope

- **Files touched (future implementation):** exactly 1 — `src/runtime/boot.js` (Relay repo)
- **Hunks:** 5
- **Lines changed:** ~30
- **No other files.** No Phase C/D/E source edits (sealed). No tests added. No `package.json` or `package-lock.json`. No `npm install` / `npm ci`. No Phase G hook. No Antigravity touch. No new exports. No new env keys. No new dependency.

---

## §5 — Out of scope (canonical safety boundaries preserved)

No Relay activation. No platform posting. No Discord client touch. No Discord network surface. No `RELAY_MODE` change. No tests. No `npm install`. No DB. No Kraken. No Railway. No env mutation. No secrets. No trading. No manual live-armed flag literal. No deploy. No Autopilot Loop B/C/D. No Phase G. No DASH-6. No D-5.12f. No Migration 009+. No autopilot self-modification. No memory-file edits. No test-suite edits. No external Hermes Agent (Nous / OpenRouter). No Antigravity config. No `position.json` touch. No `bot.js` / `dashboard.js` reference.

---

## §6 — Change A — Stage 1: `validateEnv` return-shape fix

**Location:** `src/runtime/boot.js:139-142`

**Before:**

```javascript
let validatedParsed;
try {
  const { parsed } = validateEnv(process.env);
  validatedParsed = parsed;
```

**After:**

```javascript
let validatedParsed;
try {
  const { env } = validateEnv(process.env);
  validatedParsed = env;
```

**Rationale:** Phase C `config.js:142` documents and `config.js:189-196` returns `{ env }`. Minimal-diff: preserve the `validatedParsed` local name (no rename cascade in the surrounding function body).

**Lines:** 2.

---

## §7 — Change B — Stage 12: `createOperatorAuthorizationGate` parameter fix

**Location:** `src/runtime/boot.js:374-381`

**Before:**

```javascript
operatorAuthorization = createOperatorAuthorizationGate({
  classAuthorizations:
    runtimeConfig && runtimeConfig.classAuthorizations
      ? runtimeConfig.classAuthorizations
      : {},
  getClassAuthorizationUseCount: undefined, // wired below
  safeLog,
});
```

**After:**

```javascript
operatorAuthorization = createOperatorAuthorizationGate({
  stalenessThresholdMs:
    runtimeConfig && Number.isInteger(runtimeConfig.operatorAuthorizationStalenessThresholdMs)
      ? runtimeConfig.operatorAuthorizationStalenessThresholdMs
      : 24 * 60 * 60 * 1000, // 24h default
  getClassAuthorizationUseCount: undefined, // wired below
  safeLog,
});
```

**Rationale:** Phase E `operator-authorization.js:72-76` destructures `{ stalenessThresholdMs, getClassAuthorizationUseCount, safeLog }`. With v3's `classAuthorizations` extra key the factory silently ignores it; the per-message staleness branch at `operator-authorization.js:132` evaluates `now - approvedAt > undefined` → `false`, silently bypassing the staleness window (security weakening). 24h is the canonical default; no alternative is specified in `COMM-HUB-RELAY-RUNTIME-DESIGN.md` or in the gate source.

**Lines:** ~5.

---

## §8 — Change C — Stage 14: `createOperatorAuthorizationGate` re-bind fix

**Location:** `src/runtime/boot.js:481-488`

**Before:**

```javascript
operatorAuthorization = createOperatorAuthorizationGate({
  classAuthorizations:
    runtimeConfig && runtimeConfig.classAuthorizations
      ? runtimeConfig.classAuthorizations
      : {},
  getClassAuthorizationUseCount: classAuthCounter.getClassAuthorizationUseCount,
  safeLog,
});
```

**After:**

```javascript
operatorAuthorization = createOperatorAuthorizationGate({
  stalenessThresholdMs:
    runtimeConfig && Number.isInteger(runtimeConfig.operatorAuthorizationStalenessThresholdMs)
      ? runtimeConfig.operatorAuthorizationStalenessThresholdMs
      : 24 * 60 * 60 * 1000, // 24h default
  getClassAuthorizationUseCount: classAuthCounter.getClassAuthorizationUseCount,
  safeLog,
});
```

**Rationale:** Stage 14 re-bind path mirror of Change B with the real `classAuthCounter.getClassAuthorizationUseCount` wired (canonical Phase F Stage 14 pattern for op-auth re-bind).

**Lines:** ~5.

---

## §9 — Change D — Stage 12: `createLimitsGate` `channelRateLimits` addition

**Location:** `src/runtime/boot.js:401-408`

**Before:**

```javascript
limits = createLimitsGate({
  maxBodyLength:
    runtimeConfig && Number.isInteger(runtimeConfig.maxBodyLength)
      ? runtimeConfig.maxBodyLength
      : 2000, // platform canonical character ceiling
  getRateLimitState: undefined, // wired below after rateLimitState exists
  safeLog,
});
```

**After:**

```javascript
limits = createLimitsGate({
  maxBodyLength:
    runtimeConfig && Number.isInteger(runtimeConfig.maxBodyLength)
      ? runtimeConfig.maxBodyLength
      : 2000, // platform canonical character ceiling
  channelRateLimits:
    runtimeConfig && runtimeConfig.channelRateLimits
      ? runtimeConfig.channelRateLimits
      : {},
  getRateLimitState: undefined, // wired below after rateLimitState exists
  safeLog,
});
```

**Rationale:** Phase E `limits.js:56-61` destructures `{ maxBodyLength, channelRateLimits, getRateLimitState, safeLog }`. Stage 12 instance is replaced at Stage 14, but the factory still destructures `channelRateLimits` at instantiation; including it preserves contract symmetry. The `runtimeConfig.channelRateLimits` key is already extracted at `boot.js:446-448` for `createRateLimitState` — same key reused, not introduced. Default `{}` is safe: `limits.js:79` returns `undefined` from `{}` lookup, and the guard at `limits.js:80` skips the cap-check branch (no-op when no caps configured).

**Lines:** ~4.

---

## §10 — Change E — Stage 14: `createLimitsGate` re-bind with `channelRateLimits` + `getRateLimitState` adapter

**Location:** `src/runtime/boot.js:489-496`

**Before:**

```javascript
limits = createLimitsGate({
  maxBodyLength:
    runtimeConfig && Number.isInteger(runtimeConfig.maxBodyLength)
      ? runtimeConfig.maxBodyLength
      : 2000,
  getRateLimitState: rateLimitState.getRateLimitState,
  safeLog,
});
```

**After:**

```javascript
limits = createLimitsGate({
  maxBodyLength:
    runtimeConfig && Number.isInteger(runtimeConfig.maxBodyLength)
      ? runtimeConfig.maxBodyLength
      : 2000,
  channelRateLimits:
    runtimeConfig && runtimeConfig.channelRateLimits
      ? runtimeConfig.channelRateLimits
      : {},
  getRateLimitState: () => {
    const map = {};
    const channels = Object.keys(
      runtimeConfig && runtimeConfig.channelRateLimits
        ? runtimeConfig.channelRateLimits
        : {}
    );

    for (const channelName of channels) {
      const state = rateLimitState.getRateLimitState({ channelName });
      map[channelName] = state.count;
    }

    return map;
  },
  safeLog,
});
```

**Rationale:** Phase D `rate-limit-state.js:5,116` documents and implements `getRateLimitState({ channelName }) → { withinLimit, count, limit, windowMs, operatorPhaseId }` (single-channel status object). Phase E `limits.js:47-50, 81-82` documents and consumes a no-arg callable returning `{ channelName: count }` (channel→count map). The two sealed files describe two different interfaces for the same callable name. Phase F is responsible for adapting the producer's interface into the consumer's expected shape, per the consumer's explicit doc note at `limits.js:49-50`: *"Phase F is responsible for managing the counter lifecycle."*

Adapter properties:
- Signature `() → { channelName: count }` matches the consumer call at `limits.js:81-82`
- Iterates `Object.keys(runtimeConfig.channelRateLimits || {})` for configured channels
- For each, calls producer's `getRateLimitState({ channelName })` and extracts the `.count` field (`rate-limit-state.js:120-126, 131-137, 143-149, 151-157` — `.count` is present on every return path)
- Returns the channel→count map per the consumer doc-comment example at `limits.js:48`
- Sync (no awaits); consumer's `await` at `limits.js:81` is harmless for a sync return
- Closure captures `runtimeConfig` and `rateLimitState` from the surrounding Stage 14 scope (`runtimeConfig` declared at `boot.js:127-133`; `rateLimitState` declared at `boot.js:442-450`)
- No fs / network / env reads inside the adapter
- No new dependency
- Per-call cost: O(N) where N = number of configured channels (typically ≤ 5 per RUNTIME-DESIGN §10)

**Lines:** ~14.

---

## §11 — Total diff footprint

| Hunk | Stage | Function | Lines |
|---|---|---|---|
| A | Stage 1 | `validateEnv` destructure | 2 |
| B | Stage 12 | `createOperatorAuthorizationGate` | ~5 |
| C | Stage 14 | `createOperatorAuthorizationGate` re-bind | ~5 |
| D | Stage 12 | `createLimitsGate` add `channelRateLimits` | ~4 |
| E | Stage 14 | `createLimitsGate` re-bind + `getRateLimitState` adapter | ~14 |
| **Total** | — | — | **~30** |

Files: 1 (`src/runtime/boot.js`). 5 hunks. No imports added. No exports changed. No sealed Phase C/D/E edits.

---

## §12 — Sequencing note (Bug 3 / Bug 4 ordering)

Bugs 3 and 4 are both on the per-message `limits.verify()` path. Bug 3 crashes at `limits.js:79` (TypeError reading `channelRateLimits[message.channel_name]` when `channelRateLimits === undefined`) before Bug 4 path at `limits.js:81-82` is reachable. So Bug 4 is observable only after Bug 3 is fixed. The amendment fixes both in the same commit so neither manifests in production after landing.

This sequencing also explains why neither bug was caught in Phase F-HALT-CLOSEOUT Codex on-disk source review or in the paused F-HALT-SMOKE-DESIGN round-1: Phase F is wired-but-not-activated, and the SMOKE-DESIGN's 10 cases would have hit Bug 3's crash before exercising Bug 4's shape.

---

## §13 — Halt-class wiring (unchanged; source-anchored)

No halt classes added, removed, or modified. The amendment restores correct behavior for already-defined halt classes 2, 4, 5, 10, 20, and 21 as reached by the affected boot wiring:

- **halt class 2** — `OPERATOR_AUTHORIZATION_MISSING_OR_INVALID` (`operator-authorization.js:39`; Bug 2 restoration — per-message staleness branch becomes functional)
- **halt class 4** — `CHARACTER_LIMIT_EXCEEDED` (`limits.js:26`; Bug 3 restoration — limits gate reaches the character-cap branch only after `channelRateLimits` is wired)
- **halt class 5** — `RATE_LIMIT_HIT` (`limits.js:27`; Bug 3 + Bug 4 restoration — rate-limit branch becomes reachable AND functional)
- **halt class 10** — `CLASS_AUTHORIZATION_BOUNDS_VIOLATION` (`operator-authorization.js:40`; class-auth path unaffected by amendment but reached by the op-auth gate)
- **halt class 20** — `CONFIG_FORBIDDEN_ENV_VAR_PRESENT` (`config.js:29`) / `ENV_INVALID` (`boot.js:108`) / `CONFIG_INVALID` (`rate-limit-state.js:39`) — three local aliases for canonical §15 ID 20 (Bug 1 indirectly — validateEnv's ConfigError path remains the canonical source for class 20 emissions reached by Stage 1)
- **halt class 21** — `CONFIG_REQUIRED_ENV_VAR_MISSING` (`config.js:30`) / `ENV_MISSING_REQUIRED` (`boot.js:109`) — two local aliases for canonical §15 ID 21 (Bug 1 indirectly — same Stage 1 wiring)

Per-module `HALT_CLASS = Object.freeze({...})` pattern preserved: each affected module declares only the canonical §15 IDs it consumes (no `HaltClass` import from Phase C); confirmed in source comments at `rate-limit-state.js:35-37` and `boot.js:105`.

---

## §14 — Working tree at design time

- Parent repo HEAD: `4a0e5518638dd8afeb2adf8fc0245130f4e1e384` (F-HALT-CLOSEOUT commit)
- Relay repo HEAD: `b8ab035034668fd53ea6efe64432f0868dfd2eb9` (Phase F sealed)
- Parent working tree: clean except `position.json.snap.20260502T020154Z` (untracked carve-out preserved)
- Relay working tree: clean

The parent HEAD anchor was previously the subject of a session-start `gitStatus` snapshot listing `51662f3…` as most recent. READ-ONLY AUDIT during the amendment-design cascade confirmed that `51662f3…` is an ancestor 18 commits behind `4a0e551…` on `main` — no commits lost; session-start snapshot was stale. `4a0e5518638dd8afeb2adf8fc0245130f4e1e384` is the canonical parent-repo HEAD anchor for this codification.

---

## §15 — Non-authorization preservation clauses

This DESIGN-SPEC (codification) phase pre-authorizes **nothing** downstream. Specifically does NOT authorize:

- Applying any code change to Relay `src/runtime/boot.js`
- Opening `COMM-HUB-RELAY-RUNTIME-IMPLEMENT-F-HALT-AMENDMENT` (SAFE IMPLEMENTATION / Mode 4) — separate gated phase with its own Codex review + Victor approval cascade
- Opening Phase G (`COMM-HUB-RELAY-RUNTIME-IMPLEMENT-G-GATEWAY-DESIGN`) — first HIGH-RISK / Mode 5 phase
- Activating Relay (stays DORMANT)
- Running smoke tests against Phase F (including the future amendment's smoke tests; the paused F-HALT-SMOKE-DESIGN remains separately gated)
- Stage 5 install resumption; Stage 7 dry-run; Stages 8 / 9 / 10a / 10b auto-publish activation
- Deploying any Relay runtime to Railway or any other target
- Building a container image of Relay
- Any platform-side application/bot/token/permission/webhook/post action
- Any deploy-command invocation (`railway`, `aws`, `gcloud`, `az`, `kubectl`, `docker`)
- Any database-client invocation
- Any exchange API call or order-placement code path
- Any env-variable or secret change
- Manual live-armed flag action
- DASH-6 / D-5.12f / Migration 009+
- Autopilot Loop B/C/D activation (Autopilot stays DORMANT)
- CEILING-PAUSE break
- External Hermes Agent (Nous / OpenRouter) installation, integration, or use
- Memory-file edit; test-suite edit
- Modification of any safety-policy doc / canonical Relay handoff record / runtime / migration / script / deploy file
- `npm install` / `npm ci`
- Modification of Phase C/D/E sealed files in Relay repo
- Modification of `package.json` / `package-lock.json` in Relay repo
- Antigravity install change / workspace reconfiguration / `orchestrator/ANTIGRAVITY-RULES.md` content edit / Relay-side parallel `ANTIGRAVITY-RULES.md` placement

**Codex review verdicts do NOT constitute operator approval.** Per `ROLE-HIERARCHY.md` and `CLAUDE.md`: Codex / Claude / Gemini / ChatGPT / Antigravity-hosted agents cannot self-approve. Only Victor's in-session chat instruction in the canonical Claude Code session grants approval.

**Preservation invariants:**
- Migration 008 APPLIED at `189eb1be6ef6304d914671bdaedec44d389cf877` preserved
- N-3 CLOSED preserved
- Stage 5 Gate-10 install approval at `40f3137e842cd60acf1adf17ecc7fe2f0b1b8935` CONSUMED preserved
- CEILING-PAUSE history (broken via `ARC-8-UNPAUSE` at `22ba4a7663e22df64b7cc8e3c0324cbffc0e28f6`; phase-loop counter 0 of 3) preserved
- Relay-runtime DORMANT preserved
- Autopilot DORMANT (verified at `eff4dd22b9b9af038c7ae45de301e60b3f45af98`) preserved
- Approvers exactly `{Victor}` preserved
- Phase A CLOSED at Relay-repo `fcfec4882ac9fbb7fab1946bd3b9677ea9a211cf` preserved
- Phase A closeout CLOSED at parent-repo `1b20628ed280323c6b249c1e5d617ad17ea5a026` preserved
- B-DEPS-DESIGN-SPEC CLOSED at parent-repo `2b9144fc2536991a8966526ec28042b2bbe5ac5b` preserved
- Phase B CLOSED at Relay-repo `f87faef99600335a7db47ac1bffa92a499e54acb` preserved
- Phase B closeout CLOSED at parent-repo `5f2fc810c1b4c77607e8aa8ac40fe61fa32ed269` preserved
- C-CONFIG-DESIGN-SPEC CLOSED at parent-repo `491a24f5c3220be38f7faf51fe27497a4b441ac9` preserved
- Phase C CLOSED at Relay-repo `413a4fbeef65ca0d1fb03454d9993af6360d3ac4` preserved
- C-CONFIG-CLOSEOUT CLOSED at parent-repo `7e0d227d843a58c5f851164485439cb17ae2632b` preserved
- D-STORE-DESIGN-SPEC CLOSED at parent-repo `1625f13f62df565bb52705e0106769624d061dd0` preserved
- Phase D CLOSED at Relay-repo `0d0210a32d9341d09bb7bed9be93d17c58791fbe` preserved
- D-STORE-CLOSEOUT CLOSED at parent-repo `0314d2c0df50b67292a1f219a8d8fcc26f693655` preserved
- §15-EXTENSION-FOR-PHASE-E CLOSED at parent-repo `c3b3fbcc107d00022beae87ff238b43e351d282c` preserved
- E-VERIFY-DESIGN-SPEC CLOSED at parent-repo `a7a1f7aaaa1de961b6338af900dc27c5b1c4a2f6` preserved
- Phase E CLOSED at Relay-repo `21896d65132a1dc9d48f2f5563113c06f62d0893` preserved
- E-VERIFY-CLOSEOUT CLOSED at parent-repo `28b16d0e7b62fcf2e58421e6b6ba1185cc1381ab` preserved
- F-HALT-DESIGN-SPEC CLOSED at parent-repo `02edc238790c016fb5c36bc7b0fbdd563fa030f7` preserved
- ANTIGRAVITY-MIGRATION-DESIGN-SPEC CLOSED at parent-repo `71af035f9a1f7489bfd663e099a15fda7439d0a7` preserved
- ANTIGRAVITY-MIGRATION-A-WORKSPACE-CONFIG-DESIGN-SPEC CLOSED at parent-repo `d7bb70463beed9c9e3abea84ed9b0682cbaf2255` preserved
- ANTIGRAVITY-MIGRATION-A-WORKSPACE-CONFIG-CLOSEOUT CLOSED at parent-repo `19db3723e5a046db33bb5880fb95e6f38f23e08a` preserved
- ANTIGRAVITY-RULES-DESIGN-SPEC CLOSED at parent-repo `9d47f74d87aeed20a2fa7483a3704b494a21eb96` preserved
- ANTIGRAVITY-RULES-DESIGN-SPEC-CLOSEOUT-SYNC CLOSED at parent-repo `6c41c2c69d7fb4c8d5fda6179829f10e3ffaf9c0` preserved
- Phase F CLOSED at Relay-repo `b8ab035034668fd53ea6efe64432f0868dfd2eb9` preserved
- F-HALT-CLOSEOUT CLOSED at parent-repo `4a0e5518638dd8afeb2adf8fc0245130f4e1e384` (this AMENDMENT-DESIGN-SPEC records)
- `position.json.snap.20260502T020154Z` carve-out preserved untracked in parent repo

This DOCS-ONLY codification phase does NOT advance the autopilot phase-loop counter, does NOT install or reconfigure Antigravity, does NOT modify any Phase C/D/E sealed file, does NOT post anywhere, and does NOT execute any production action.

---

## §16 — Next steps

1. Codex DOCS-ONLY review of this DESIGN-SPEC (codification) phase: this 4-file scope (this new SAFE-class handoff + 3 status-doc updates).
2. Operator commit-only approval naming the 4-file scope, then operator-approved Claude-run commit + push to parent `origin/main`.
3. Three-way SHA consistency PASS verified post-push.
4. Closeout-of-closeout: a future phase records this DESIGN-SPEC as CLOSED at the post-commit HEAD.
5. (Future, separately gated) Operator may open `COMM-HUB-RELAY-RUNTIME-IMPLEMENT-F-HALT-AMENDMENT` (SAFE IMPLEMENTATION / Mode 4) to apply Changes A–E to Relay `src/runtime/boot.js` per this design. Each step (Codex on-disk source review, operator commit-only approval, push approval) is separately gated.
6. (Future, separately gated) Operator may open `COMM-HUB-RELAY-RUNTIME-IMPLEMENT-F-HALT-AMENDMENT-CLOSEOUT` after the amendment lands.
7. (Future, separately gated) Operator may resume the paused `COMM-HUB-RELAY-RUNTIME-IMPLEMENT-F-HALT-SMOKE-DESIGN` (round-1 with 4 REs pending) once the amendment cascade completes; smoke cases may need expansion to exercise the per-message rate-limit and op-auth-staleness branches end-to-end so Bug 2 and Bug 4 regression coverage exists.

Each step requires its own operator decision. This DOCS-ONLY codification phase authorizes none of them.

---

**End of canonical COMM-HUB-RELAY-RUNTIME-IMPLEMENT-F-HALT-AMENDMENT-DESIGN record. The future amendment SAFE IMPLEMENTATION phase, code changes to Relay `src/runtime/boot.js`, smoke tests, Relay activation, Phase G, deploy, posting, and any production action remain separately gated and are NOT authorized by this DOCS-ONLY codification.**
