# COMM-HUB-RELAY-RUNTIME-IMPLEMENT-F-HALT-SMOKE-CASE-09-DESIGN

**This handoff codifies the Codex-approved (PASS, no required edits) conversation-only `COMM-HUB-RELAY-RUNTIME-IMPLEMENT-F-HALT-SMOKE-CASE-09-DESIGN` (Mode 2 / DESIGN-ONLY, no commit). This codification phase is `COMM-HUB-RELAY-RUNTIME-IMPLEMENT-F-HALT-SMOKE-CASE-09-DESIGN-SPEC` (DOCS-ONLY / Mode 3). The future implementation phase `COMM-HUB-RELAY-RUNTIME-IMPLEMENT-F-HALT-SMOKE-CASE-09` is SAFE IMPLEMENTATION (Mode 4) — separately gated; not authorized by this codification.**

**Codification provenance:** F-HALT-SMOKE-RUN-7 (Mode 4 SAFE EXECUTION) PASSed at TAP tally `13 / 11 / 1 / 1` (Relay HEAD `1b6682da…`; parent CLOSEOUT at `052ef72…`). Case 09 (`safeLog redacts sensitive fields per REDACT_PATHS`) is the sole expected fail — and per sealed SCAFFOLD-REPAIR-DESIGN §5 the expected end-state for the smoke suite is `13 / 12 / 1 / 0` (Case 12 sole skip; zero fails). This design closes the Case 09 gap. The Mode 1 `CASE-09-AUDIT` identified the root cause: `src/log.js` REDACT_PATHS contains nested wildcards (`*.token`, `*.password`, `*.secret`, `*.api_key`, `*.apiKey`) but NO top-level literal entries for the same field names; the failing test sends `{token: 'SECRET_VALUE'}` at the payload root, which neither pino path-redaction (REDACT_PATHS) nor `safeLog` value-pattern redaction (FORBIDDEN_VALUE_PATTERNS) catches. A Codex DESIGN-ONLY review of this CASE-09-DESIGN returned PASS — no required edits; 13 review goals all CONFIRMED; safeLog call-site cross-grep returned NONE FOUND (zero surprise-redaction risk in Relay `src/`). Codex recommended that CASE-09-DESIGN be codified as a parent-repo DESIGN-SPEC handoff (this file) before Mode 4 SAFE IMPLEMENTATION, consistent with AMENDMENT-5/6/7 precedent. **This file does NOT itself constitute an execution authorization. Codex review verdicts are not operator approval.** Approvers exactly `{Victor}`.

---

## §0 — Phase classification & current anchors

| Property | Value |
|---|---|
| Phase name (this codification phase) | `COMM-HUB-RELAY-RUNTIME-IMPLEMENT-F-HALT-SMOKE-CASE-09-DESIGN-SPEC` |
| Phase mode (this codification phase) | Mode 3 / DOCS-ONLY |
| Original phase name (codified design) | `COMM-HUB-RELAY-RUNTIME-IMPLEMENT-F-HALT-SMOKE-CASE-09-DESIGN` |
| Original phase mode | Mode 2 / DESIGN-ONLY (conversation-only; no commit) |
| Parent-repo HEAD anchor | `052ef72c7ccae3c785948502a2db0034ee65fd00` (RUN-7-CLOSEOUT sealed) |
| Relay-repo HEAD anchor | `1b6682da70721cf1d148b68849b29428af1fff1d` (AMENDMENT-7 SAFE IMPLEMENTATION sealed) |
| Future implementation phase (gated; NOT authorized) | `COMM-HUB-RELAY-RUNTIME-IMPLEMENT-F-HALT-SMOKE-CASE-09` (Mode 4 SAFE IMPLEMENTATION) |
| Future re-execution phase (gated; NOT authorized) | `COMM-HUB-RELAY-RUNTIME-IMPLEMENT-F-HALT-SMOKE-RUN-8` (Mode 4 SAFE EXECUTION; expected TAP `13 / 12 / 1 / 0`) |
| Parent repo working tree at codification time | the 4 CASE-09-DESIGN-SPEC docs are present as uncommitted on-disk changes alongside the two authorized untracked carve-outs (`position.json.snap.20260502T020154Z` + `orchestrator/handoffs/evidence/`); no other tracked file modified |
| Relay repo working tree at codification time | clean |
| Relay-runtime status | DORMANT preserved |
| Autopilot status | DORMANT preserved (verified at `eff4dd22…`) |
| Approvers | exactly `{Victor}` |

---

## §1 — Canonical contract (highest authority first)

### §1.1 — RUNTIME-DESIGN §16 (highest authority)

Sealed at `orchestrator/handoffs/COMM-HUB-RELAY-RUNTIME-DESIGN.md` lines 819-857. Line 821: "Structured JSON logs via `pino`. Token redaction at every output point. No secrets ever in logs." Line 837: "Pino has a `redact` config for `DISCORD_BOT_TOKEN` and pattern `**/*token*` and `**/*secret*`. Even if a code path tries to log the token, pino redacts it before output." The canonical `**/*token*` is a deep-glob meaning "any depth, any key whose name contains `token`". Top-level `token` matches.

### §1.2 — C-CONFIG-DESIGN §5/§7 (Phase C implementation guidance)

Sealed at `orchestrator/handoffs/COMM-HUB-RELAY-RUNTIME-IMPLEMENT-C-CONFIG-DESIGN.md` lines 160-216, §7 lines 292+. §5 line 195 explicitly says `DISCORD_BOT_TOKEN (root + nested)` — establishing the "root + nested" canonical intent for credential field names. §5 lines 190-194 list only the nested wildcard forms (`*.token`, `*.tokens.*`, `*.password`, `*.secret`, `*.api_key` / `*.apiKey`) for generic field names. §7 line 294 separates path-redaction (Layer 1) from value-pattern redaction (Layer 2).

### §1.3 — Current implementation (Layer 3)

Sealed Relay-repo `src/log.js:26-36` REDACT_PATHS contains:
- `'*.token'`, `'*.tokens.*'`, `'*.password'`, `'*.secret'`, `'*.api_key'`, `'*.apiKey'` (one-level nested wildcards)
- `'DISCORD_BOT_TOKEN'` (root only)
- `'req.headers.authorization'`, `'req.headers.cookie'` (specific paths)

Sealed Relay-repo `src/log.js:68-85` FORBIDDEN_VALUE_PATTERNS contains regex shapes for Discord bot tokens, Postgres URIs, `MANUAL_LIVE_ARMED`, AWS keys, GitHub token prefixes, OpenAI/Anthropic key prefixes. None match the literal string `SECRET_VALUE`.

### §1.4 — Layered drift summary

| Layer | Coverage of top-level `token` field |
|---|---|
| Layer 1 (RUNTIME-DESIGN §16 `**/*token*`) | YES (any depth including root) |
| Layer 2 (C-CONFIG-DESIGN §5 table) | AMBIGUOUS — nested only for generic names; "root + nested" explicit only for DISCORD_BOT_TOKEN |
| Layer 3 (`src/log.js:26-36`) | NO — top-level literal entries absent |

The implementation under-fulfills the Layer 1 canonical spec. The failing Case 09 test asserts the Layer 1 expected behavior.

---

## §2 — Root cause

The failing Case 09 test at `tests/smoke/09-safelog-sensitive-redaction.test.js` sends:

```javascript
safeLog('debug', {
  event: 'test-redaction',
  token: 'SECRET_VALUE',
  body: 'visible body',
}, logger);  // lines 28-32
```

and asserts:

```javascript
assert.equal(combined.includes('SECRET_VALUE'), false, 'sensitive token must be redacted');  // line 40
```

The captured RUN-7 log line at `orchestrator/handoffs/evidence/F-HALT-SMOKE-RUN-7/tap-run-1.txt:51` shows `"token":"SECRET_VALUE"` — unredacted at output.

Both redaction layers in `src/log.js` miss this case:
- Pino path-redaction (`'*.token'`) requires at least one parent key; doesn't match top-level `token`.
- Value-pattern redaction (`FORBIDDEN_VALUE_PATTERNS`) only matches Discord/AWS/GitHub/OpenAI/Anthropic credential shapes; doesn't match arbitrary literal `SECRET_VALUE`.

Case 09 fails because `src/log.js` has nested wildcard paths like `*.token` but no root `token`, while the test logs root `token: 'SECRET_VALUE'`.

---

## §3 — Recommended fix (Option A)

Add exactly 5 top-level REDACT_PATHS literal entries to `src/log.js:26-36` alongside the existing nested wildcards:

| Entry | Reason |
|---|---|
| `'token'` | Top-level credential-bearing field name; maps to existing `'*.token'` wildcard at depth 1 |
| `'password'` | Top-level credential-bearing field name; maps to existing `'*.password'` wildcard at depth 1 |
| `'secret'` | Top-level credential-bearing field name; maps to existing `'*.secret'` wildcard at depth 1 |
| `'api_key'` | Top-level credential-bearing field name; maps to existing `'*.api_key'` wildcard at depth 1 |
| `'apiKey'` | Top-level credential-bearing field name; maps to existing `'*.apiKey'` wildcard at depth 1 |

The 5 entries map exactly to the 5 existing nested wildcards. Existing wildcards remain unchanged. Specific literal paths (`'DISCORD_BOT_TOKEN'`, `'req.headers.authorization'`, `'req.headers.cookie'`) remain unchanged.

A 4-6 line WHY comment block precedes the 5 new entries citing RUNTIME-DESIGN §16 (Layer 1 canonical) and C-CONFIG-DESIGN §5 line 195 ("root + nested" intent for DISCORD_BOT_TOKEN extended to the 5 generic field names). ASCII `->` only; no Unicode `→` (U+2192).

This is the minimum safe change aligned with canonical RUNTIME-DESIGN §16 at the Layer 3 implementation level. It closes the root-level redaction gap that caused Case 09 to fail in RUN-7.

---

## §4 — Rejected alternatives

### §4.1 — Option B (FORBIDDEN_VALUE_PATTERNS extension) — REJECTED

Extending FORBIDDEN_VALUE_PATTERNS to match generic literal patterns like `SECRET_VALUE` produces false-positive value redaction in production. C-CONFIG-DESIGN §7 line 294 explicitly separates path-redaction (key-path mechanism) from value-pattern redaction (credential-shape regex mechanism). Generic key-name matching is the canonical role of REDACT_PATHS, not FORBIDDEN_VALUE_PATTERNS.

### §4.2 — Option C (recursive censor function refactor) — REJECTED AS PRIMARY

Replacing pino's `redact: { paths, censor }` with a custom censor function and an enhanced recursive matcher would expand surface area, touch the pino configuration, and require careful performance review. Codex DESIGN-ONLY review confirmed that `src/log.js:139` already has recursive value scanning via `redactPayload` + `redactString`; the observed gap is path configuration at lines 26-36, not the engine. Option C may be considered as a follow-on enhancement in a future phase but is NOT recommended for Case 09.

### §4.3 — Option D (change test fixture to nested token) — REJECTED

Amending `tests/smoke/09-safelog-sensitive-redaction.test.js:28-32` to send `{ event, user: { token: 'SECRET_VALUE' }, body }` so the existing `'*.token'` wildcard matches. Rejected because:
- It hides the production-risk gap rather than fixing it.
- It contradicts the test's own comment at lines 38-39 ("REDACT_PATHS or FORBIDDEN_VALUE_PATTERNS redaction").
- A future caller emitting `safeLog('error', { token: realDiscordBotToken })` would leak the token to stdout undetected.
- It weakens defense-in-depth.

### §4.4 — Additional field names — DEFERRED

Codex DESIGN-ONLY review explicitly recommended deferring these out of scope:
- `'apikey'` (lowercase, no underscore)
- `'bearer'`
- `'credentials'`
- `'*.DISCORD_BOT_TOKEN'` (root + nested intent per C-CONFIG-DESIGN §5 line 195)

Reason: none of these are present in the existing wildcard set; adding them is scope creep. Each may be considered in a separate follow-on phase if operational evidence justifies.

---

## §5 — Future SAFE IMPLEMENTATION scope (1 Relay file only)

Exactly 1 file in `/Users/victormercado/code/agent-avila-relay`:

1. `src/log.js` — 5 new array entries + WHY comment block in `REDACT_PATHS` (lines 26-36). Approximately +11 lines (5 entries + 6-line comment + 0 deletions). Zero refactor.

No other Relay-repo touch. No `tests/`. No `schemas/`. No `package*.json`. No `tests/smoke/helpers/*`. No sealed handoff. No parent-repo touch during SAFE IMPLEMENTATION (parent-repo CLOSEOUT is separate).

`tests/smoke/09-safelog-sensitive-redaction.test.js` remains unchanged. The test correctly asserts the Layer 1 canonical-intent behavior; the implementation side drifted and must catch up.

ASCII `->` only in any new comment. No Unicode `→` (U+2192).

---

## §6 — Preservation invariants

The following MUST remain byte-identical and behaviorally untouched by CASE-09:

- AMENDMENT-3 `tempTree.sealPending()` calls in boot-path Cases 1, 2, 3, 10.
- AMENDMENT-5 polyfill at `src/verify/schema-validator.js:119-128`.
- AMENDMENT-6 object-map guard at `src/runtime/boot.js:360-371`.
- AMENDMENT-7 non-boot direct gate-verifier rewrites in `tests/smoke/04/05/06/11-*.test.js`.
- SCAFFOLD-REPAIR Path D non-boot tests in `tests/smoke/07-halt-publish-log-append.test.js` and `tests/smoke/08-pending-move-after-halt.test.js`.
- Phase D DP-5 hardening at `src/store/source-of-truth.js:263-276`.
- halt.js RE-4 contract at `src/runtime/halt.js:24-28, :182-190, :198-211`.
- All sealed parent-repo handoffs (RUNTIME-DESIGN, C-CONFIG-DESIGN, AMENDMENT-2/5/6/7-DESIGN, SCAFFOLD-REPAIR-DESIGN, F-HALT-SMOKE-RUN-DESIGN, all others).
- `tests/smoke/09-safelog-sensitive-redaction.test.js` (the failing test; remains unchanged).
- `tests/smoke/helpers/*` (sealed helpers).
- `src/verify/*` (all verifier modules).
- `src/runtime/halt.js`, `src/runtime/boot.js` (sealed runtime).
- `src/store/source-of-truth.js`, `src/store/publish-log.js` (sealed store).
- `schemas/hermes-message.schema.json` (sealed schema).
- `package.json` + `package-lock.json` byte-identical (no new dependency, no `npm install`/`ci`).

---

## §7 — Expected post-CASE-09 RUN-8 outcome

If/when `F-HALT-SMOKE-RUN-8` (Mode 4 SAFE EXECUTION) is separately approved after CASE-09 implementation seals, the expected TAP tally is:

**`13 total / 12 pass / 1 skip / 0 fail`**

Per sealed SCAFFOLD-REPAIR-DESIGN §5 final-state expected outcome:
- 12 pass: Cases 1, 2, 3, 4, 5, 6, 7, 8 primary, 8 sub-case, 9 (now passing after CASE-09 fix), 10, 11.
- 1 skip: Case 12 (`channelCap` object vs `channelCap.maxPerWindow` drift — sealed `test.skip()` + in-file TODO citing `src/verify/limits.js:83`; out of scope for CASE-09).
- 0 fail.

This achieves the canonical end-state for the F-HALT-SMOKE suite per the sealed SCAFFOLD-REPAIR-DESIGN expected outcome.

---

## §8 — safeLog call-site cross-grep result (Codex DESIGN-ONLY review finding)

Codex DESIGN-ONLY review performed a proactive cross-grep of `safeLog(` call sites in Relay-repo `/Users/victormercado/code/agent-avila-relay/src/`. Result: **NONE FOUND** — no existing `safeLog(` emission uses a top-level `token`, `password`, `secret`, `api_key`, or `apiKey` field name. The proposed change will cause **zero surprise redaction** of legitimate non-sensitive content in current code paths.

---

## §9 — Non-authorization

This DESIGN-SPEC codification phase does NOT authorize, and the future SAFE IMPLEMENTATION it describes does NOT authorize:

- Editing anything outside the 1 listed Relay file (no other Relay-repo touch).
- Editing parent-repo (CLOSEOUT phase is separate).
- Editing `tests/smoke/09-safelog-sensitive-redaction.test.js` (the failing test must remain unchanged).
- Editing `src/log.js` outside the REDACT_PATHS array (no change to `createLogger`, `safeLog`, `FORBIDDEN_VALUE_PATTERNS`, `LOG_DESTINATIONS`, `redactPayload`, `redactString`).
- Editing `tests/`, `schemas/`, `package*.json`, `tests/smoke/helpers/*`, or any other Relay file.
- Editing any sealed handoff.
- Opening `F-HALT-SMOKE-RUN-8` (Mode 4 SAFE EXECUTION; separately gated).
- Opening Case 12 remediation (the sole remaining skip; separately gated).
- Opening `src/runtime/boot.js:268`/`:282-285` observability fix.
- Modifying AMENDMENT-3 `sealPending()`, AMENDMENT-5 polyfill, AMENDMENT-6 object-map guard, AMENDMENT-7 direct verifier rewrites, SCAFFOLD-REPAIR Path D Cases 7+8, Phase D DP-5 hardening, halt.js RE-4 contract.
- `node --test` / `node --check` / `npm install` / `npm ci` / `npx` / any test execution.
- Phase G design or implementation.
- Relay activation, Stage 5 install resumption, Stages 7-10b.
- Discord platform application/bot/token/permission/webhook/post action.
- Railway / deploy.
- DB; Kraken; env / secrets; the armed-trading flag; trading.
- DASH-6 / D-5.12f / D-5.12g / D-5.12h / Migration 009+.
- Autopilot Loop B/C/D.
- CEILING-PAUSE state change.
- external Hermes Agent (Nous/OpenRouter).
- scheduler / cron / webhook / MCP install.
- Permission widening.
- Any network lookup.
- `ajv-formats` import or any new dependency.
- Ajv `strict` mode setting change.
- Introduction of any Unicode arrow `→` (U+2192) glyph in source comments.

Codex review verdicts do NOT constitute operator approval. Approvers exactly `{Victor}`.

---

## §10 — Codex DESIGN-ONLY verdict record

Codex DESIGN-ONLY review of CASE-09-DESIGN returned **PASS** — no required edits. All 13 review goals CONFIRMED:

1. Option A aligns with RUNTIME-DESIGN §16 + C-CONFIG-DESIGN §5/§7 + `src/log.js:11-18`.
2. Implementation side is correct (not test fixture).
3. 1-file scope (`src/log.js`).
4. Test unchanged.
5. 5 field names map exactly to existing nested wildcards.
6. Defer `apikey`/`bearer`/`credentials`/`*.DISCORD_BOT_TOKEN` (scope creep avoidance).
7. Option B rejected (false-positive value-pattern risk).
8. Option C rejected as primary (recursive scan already exists; gap is path config).
9. Option D rejected (hides production-risk gap).
10. RUN-8 expected `13 / 12 / 1 / 0`.
11. Preserved invariants list correct.
12. No live-risk action.
13. Proceed to CASE-09-DESIGN-SPEC codification.

Codex cross-grep audit: NONE FOUND (zero surprise-redaction risk).

---

## §11 — Next phase gate

The next phase in this cascade is `COMM-HUB-RELAY-RUNTIME-IMPLEMENT-F-HALT-SMOKE-CASE-09` (Mode 4 SAFE IMPLEMENTATION). It requires:

1. Operator approval to open SAFE IMPLEMENTATION (per ARC-2 Gate matrix; SAFE-class scope but subject to Codex SAFE IMPLEMENTATION on-disk source review).
2. Codex SAFE IMPLEMENTATION pre-edit plan review.
3. Codex SAFE IMPLEMENTATION post-edit on-disk source review of the proposed 1-file diff.
4. Operator commit-only approval naming the exact 1-file Relay-repo scope.
5. Operator push approval; three-way SHA consistency PASS verified post-push.
6. Subsequent `F-HALT-SMOKE-RUN-8` (Mode 4 SAFE EXECUTION) is separately gated and NOT authorized by CASE-09 SAFE IMPLEMENTATION.

This DESIGN-SPEC codification pre-authorizes none of the above.
