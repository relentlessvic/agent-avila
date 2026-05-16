# COMM-HUB-RELAY-RUNTIME-EGRESS-ALLOWLIST-DESIGN

**Status:** Permanent SAFE-class handoff record codified at parent commit `<EGRESS-ALLOWLIST-DESIGN-SPEC commit SHA>` (set at codification seal).
**Phase mode (when authored):** Mode 2 DESIGN-ONLY (conversation-only).
**Phase mode (codification):** Mode 3 DOCS-ONLY (this handoff).
**Sealed grounding:** sealed CONFIG-INJECTION-DESIGN at parent `7aa0ef9d…` + sealed DEPLOYMENT-RUNBOOK-DESIGN at parent `895643a…` + sealed DEPLOYMENT-PREFLIGHT-DESIGN at parent `a9d1a31…` + sealed DEPLOYMENT-READINESS-DESIGN at parent `02e0796…` + sealed G-DESIGN at `66af7df…` + APPROVAL-GATES + COMM-HUB-RELAY-RULES + sealed Relay `src/index.js` (no `runtimeConfig` passed) + sealed Relay `src/runtime/boot.js` (Stage 15 default-wiring at lines 540-610; reads `runtimeConfig.allowlistedDiscordHostnames`; falls back to `[]` if absent) + sealed Relay `src/gateway/egress-allowlist-hook.js` (factory at lines 40-95; validates non-empty-string elements; returns frozen `{ allowlistedHostnames, invoke }`) + sealed Relay `src/gateway/phase-g-send-and-record.js` (enforces hook shape at lines 85-91) + sealed Relay `src/verify/network-anomaly.js` (gate 9 verifier consuming `allowlistHookRef`).
**Pre-codification anchors:** parent HEAD `683115f14b544fdaaf182ef43fd6236d46379834` (CONFIG-INJECTION-DESIGN-SPEC-CLOSEOUT-SYNC) + Relay HEAD `f232c328284e687511a794dc89358bbc0cd275d1` (G-5-RUN-10-REPAIR).
**Codex DESIGN-ONLY review:** Round-1 fresh compact packet PASS (24/24 review goals; no required edits; Codex companion subagent ID `af9ff0ffdae06dbb7`; Codex internal agent ID not exposed by Codex in this interface). Operator applied 3 conversation-only corrections to the original draft prior to dispatch: (1) suffix-auto-allow replaced with explicit-hostname enumerated allowlist via sealed `APPROVED_HOSTNAMES`; (2) manifest example shape clarified — required fields `allowlistedHostnames` + `rotatedAt` + `rotatedFromParentSha`, `notes` optional ≤256 chars; (3) `load-success` test wording must inject valid `operatorPhaseId` if exercising full boot traversal past Stage 15. Round-1 compact was dispatched after an over-length original prompt was operator-cancelled (no Codex review ran on the original prompt).

**Approvers exactly `{Victor}`.** Codex review verdicts do NOT constitute operator approval at any boundary.

This handoff is preserved verbatim through every subsequent egress-allowlist subphase and never edited after codification.

---

## §0 Phase header and mode

- Phase: `COMM-HUB-RELAY-RUNTIME-EGRESS-ALLOWLIST-DESIGN`
- Mode: DESIGN-ONLY / Mode 2 — conversation-only design; no files written; no commits; no commands beyond read-only inspection.
- Goal: Design a safe, git-tracked, audit-visible source for `runtimeConfig.allowlistedDiscordHostnames` so deploy blocker #4 can be lifted by a separately gated future implementation phase.
- Authority: Approvers exactly `{Victor}`. Codex review verdicts do NOT constitute operator approval.

---

## §1 Current repo anchors

- Parent HEAD: `683115f14b544fdaaf182ef43fd6236d46379834` (CONFIG-INJECTION-DESIGN-SPEC-CLOSEOUT-SYNC)
- Relay HEAD: `f232c328284e687511a794dc89358bbc0cd275d1` (G-5-RUN-10-REPAIR)
- CONFIG-INJECTION-DESIGN-SPEC sealed at parent `7aa0ef9d…`; CLOSEOUT-SYNC at `683115f1…`
- Deployment NOT authorized; Relay DORMANT; Autopilot DORMANT; Discord activation NO
- Phase G code completion: ACHIEVED at TAP 19/19/0/0
- Authorized untracked carve-outs: `orchestrator/handoffs/evidence/` (whole directory) + `position.json.snap.20260502T020154Z`

---

## §2 Problem statement

Per sealed Phase F §9 + Phase G Layer 3 + G-3 default-wiring (sealed at `src/runtime/boot.js:540-610`), Relay's outbound HTTP egress is gated by `createEgressAllowlistHook({ allowlistedHostnames })` constructed from `runtimeConfig.allowlistedDiscordHostnames`. The current production entry point (`src/index.js`) does NOT pass `runtimeConfig`, so the default-wiring receives `runtimeConfig=undefined` and falls back to an empty array `[]`. An empty allowlist does NOT halt boot (the factory accepts `[]` without throwing), but it makes the hook's `invoke()` return `allowed: false` for every outbound request. A deployed Relay with empty allowlist could boot but could not reach Discord. The runbook DESIGN names this as deploy blocker #4. A sealed non-env, git-tracked source for the allowlist plus a sealed loader is required, with strict validation.

---

## §3 Current `allowlistedDiscordHostnames` dependency path

Verified by read-only grep + read of sealed source:

| Path | Role |
|---|---|
| `src/runtime/boot.js:45` | Stage 15 docstring lists `allowlistedDiscordHostnames` as part of `runtimeConfig` |
| `src/runtime/boot.js:106` | `import { createEgressAllowlistHook } from '../gateway/egress-allowlist-hook.js';` |
| `src/runtime/boot.js:564-588` | Stage 15 default-wiring branch: `runtimeConfig && Array.isArray(runtimeConfig.allowlistedDiscordHostnames) ? ... : []` |
| `src/runtime/boot.js:585-589` | `createEgressAllowlistHook({ allowlistedHostnames: ... })` call site |
| `src/runtime/boot.js:600` | `phaseGAllowlistHook = allowlistHook;` reassignment |
| `src/runtime/boot.js:651` | `allowlistHookRef: resolvedAllowlistHook` passed downstream |
| `src/gateway/egress-allowlist-hook.js:40-95` | factory validates Array of non-empty strings; throws on Array.isArray failure or empty-string element; returns frozen `{ allowlistedHostnames, invoke }` |
| `src/gateway/phase-g-send-and-record.js:85-91` | enforces `allowlistHook` exposes `{ allowlistedHostnames, invoke }` shape |
| `src/verify/network-anomaly.js:82-186` | gate 9 verifier consumes `allowlistHookRef`; uses `new Set(allowlistHookRef.allowlistedHostnames)` to validate egress events |
| `src/index.js:10-25` | entry point; does NOT pass `runtimeConfig`; no allowlist populated |

Behavior: production entry → `boot()` called with no args → `runtimeConfig=undefined` → Stage 15 falls back to `[]` → factory constructs valid hook with empty list → `invoke()` returns `allowed: false` for every request → all outbound traffic blocked.

---

## §4 Why this remains a deploy blocker

1. Operational dead-end. A deployed Relay with empty allowlist would boot but refuse every outbound request.
2. Sealed runtime invariant. `src/index.js` is sealed and does not pass `runtimeConfig`. The fix must be at the entry-point level (non-env).
3. Audit-trail requirement. Allowlisted hostnames are operator-attested and must live in a git-tracked artifact.
4. Strict explicit-hostname enforcement requirement. Without it the allowlist becomes a security risk.

---

## §5 Proposed allowlist design

Two-file pattern: committed manifest + sealed loader. Same shape as CONFIG-INJECTION-DESIGN.

### §5.1 New file 1 — `config/allowlisted-discord-hostnames.json` (committed manifest)

Path: `config/allowlisted-discord-hostnames.json` at Relay repo root.

Contents (exact required shape):

```json
{
  "allowlistedHostnames": [
    "discord.com",
    "gateway.discord.gg"
  ],
  "rotatedAt": "<UTC ISO-8601 timestamp ending in Z>",
  "rotatedFromParentSha": "<40-char lowercase parent commit SHA>"
}
```

`notes` is optional; if present, it must be a string of length ≤ 256. Unknown extra fields remain rejected with `AllowlistLoadError` keyword `allowlist-load-failed`.

### §5.2 New file 2 — `src/runtime/allowlist-loader.js` (sealed loader)

Path: `src/runtime/allowlist-loader.js`.

Exports: `loadAllowlistedDiscordHostnames({ manifestPath })` — side-effect-contained loader function; no module-load-time side effects; filesystem read occurs only inside this function. Returns `{ allowlistedHostnames, rotatedAt, rotatedFromParentSha, notes }` on success (`notes` may be `undefined` if omitted); throws `AllowlistLoadError` with `{ haltClass: 20, keyword: 'allowlist-load-failed' }` on validation failure.

Validation rules (enforced by loader, all fail-closed):

- File exists and is readable.
- File is valid JSON.
- Top-level is an object.
- `allowlistedHostnames` is present and is an Array.
- Array length is between 1 and 16 inclusive (empty array rejected; >16 unjustified).
- Each element is a string of length 1-253 (RFC 1035 DNS limit).
- Each element matches the strict pattern: `^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*$` (RFC-compatible, lowercase only, no leading/trailing dot, no embedded whitespace).
- **Each element MUST appear in the sealed `APPROVED_HOSTNAMES` enumerated set inside the loader source itself. No suffix-based auto-allow. No wildcards. No arbitrary subdomain allowance.**
- **Initial sealed `APPROVED_HOSTNAMES` constant (exhaustive):**
  ```javascript
  const APPROVED_HOSTNAMES = Object.freeze(new Set([
    'discord.com',
    'gateway.discord.gg',
  ]));
  ```
- Adding a new hostname requires editing the sealed `APPROVED_HOSTNAMES` set in the loader source (via separately gated `ALLOWLIST-ROTATION-IMPLEMENT`) AND adding to the manifest. Manifest hostname not in `APPROVED_HOSTNAMES` → halt 20.
- No element contains `://`, `:` (port), `/` (path), `?` (query), `#` (fragment), `@` (auth), or IP-literal characters (defense-in-depth check redundant with regex).
- No duplicates.
- `rotatedAt` MUST be valid ISO-8601 UTC ending in `Z`.
- `rotatedFromParentSha` MUST be 40-character lowercase hex SHA.
- `notes` optional; if present, string of length ≤ 256.
- No unknown extra fields at top level → halt 20 + `allowlist-load-failed`.

**Defense rationale:** suffix-based allow (originally-proposed) was a soft-permissive policy. Corrected policy requires both: (1) hostname operator-attested in manifest (git-tracked artifact, reviewable per-commit); (2) hostname enumerated in sealed `APPROVED_HOSTNAMES` constant in loader source. Two-layer fail-closed: manifest typo or unauthorized addition fails to validate; source-side widening is itself a sealed change requiring its own design + Codex review + commit + push + three-way-SHA.

The 4 Discord-owned suffixes (`.discord.com`, `.discord.gg`, `.discordapp.com`, `.discordapp.net`) remain in this handoff as an **informational guardrail** documenting which suffix families future additions are expected to come from. The loader does NOT auto-allow them.

### §5.3 Modified file — `src/index.js`

Minimal modification (~+15 lines net beyond the CONFIG-INJECTION change; total `src/index.js` net change combined: ~+40 lines): add import + canonical manifest path resolution (via `import.meta.url` + `node:path`) + try/catch + pass `allowlistedDiscordHostnames` to `boot({ runtimeConfig })`. On loader failure: emit Tier-1 fallback structured JSON `{event:'boot-halt', haltClass:20, reason:'<keyword>'}` per RE-B and `process.exit(1)`.

Anti-features preserved: no process.env reads; no platform send-message API; no network reach; no DB; no env mutation; no Discord client construction at module load; ES module syntax; single top-level invocation.

### §5.4 `boot.js`, `egress-allowlist-hook.js`, `phase-g-send-and-record.js`, `network-anomaly.js` remain UNTOUCHED

Injection happens entirely through `src/index.js`. The Stage 15 default-wiring's existing check `runtimeConfig && Array.isArray(runtimeConfig.allowlistedDiscordHostnames)` now succeeds with the populated array. The factory's per-element validation passes. The hook's `invoke()` returns `allowed: true` for `APPROVED_HOSTNAMES`.

### §5.5 Rotation procedure (out of scope for THIS implementation)

A future `COMM-HUB-RELAY-RUNTIME-ALLOWLIST-ROTATION` paperwork phase would handle additions/removals to both the manifest and the sealed `APPROVED_HOSTNAMES` source constant. Not authorized by this design.

---

## §6 Exact hostname policy

The minimum and exhaustive initial manifest:

```json
{
  "allowlistedHostnames": [
    "discord.com",
    "gateway.discord.gg"
  ]
}
```

| Hostname | Why needed | Source |
|---|---|---|
| `discord.com` | Discord REST API base for `channels/messages` POST | discord.js v14 internal HTTP client default |
| `gateway.discord.gg` | Discord gateway WebSocket endpoint for bot identify/heartbeat | discord.js v14 gateway connection |

**Explicitly NOT in the allowlist** (forbidden until separately justified AND added to both manifest AND sealed loader source):

- `cdn.discordapp.com` — CDN for media/avatars (Relay is text-only; no CDN need)
- `media.discordapp.net` — media proxy
- `images-ext-1.discordapp.net` — embed image proxy
- Any non-Discord domain
- Any other `.discord.com` / `.discord.gg` / `.discordapp.com` / `.discordapp.net` subdomain

**Informational guardrail (not a runtime rule):** future operator-attested additions are EXPECTED to come from one of these 4 Discord-owned suffix families: `.discord.com`, `.discord.gg`, `.discordapp.com`, `.discordapp.net`. This guardrail informs which additions are reasonable to propose. It does NOT authorize automatic acceptance of any subdomain. Every addition requires:

1. A separately gated `COMM-HUB-RELAY-RUNTIME-ALLOWLIST-ROTATION-DESIGN` paperwork phase.
2. A subsequent `…ROTATION-IMPLEMENT` phase that edits both `config/allowlisted-discord-hostnames.json` AND the sealed `APPROVED_HOSTNAMES` constant in `src/runtime/allowlist-loader.js`.
3. Codex review of both the manifest delta AND the source-side `APPROVED_HOSTNAMES` delta.
4. Operator commit + push.

---

## §7 Fail-closed behavior

Every failure path emits structured halt and exits non-zero before any HTTP client construction or Discord client construction:

| Scenario | Source | Halt class | Keyword | Where caught |
|---|---|---|---|---|
| Manifest file missing | loader | 20 | `allowlist-load-failed` | `src/index.js` Tier-1 fallback |
| Manifest not valid JSON | loader | 20 | `allowlist-load-failed` | `src/index.js` Tier-1 fallback |
| Top-level not object | loader | 20 | `allowlist-load-failed` | `src/index.js` Tier-1 fallback |
| `allowlistedHostnames` missing or not Array | loader | 20 | `allowlist-load-failed` | `src/index.js` Tier-1 fallback |
| Array empty | loader | 20 | `allowlist-load-failed` | `src/index.js` Tier-1 fallback |
| Array length > 16 | loader | 20 | `allowlist-load-failed` | `src/index.js` Tier-1 fallback |
| Any element not a non-empty string | loader | 20 | `allowlist-load-failed` | `src/index.js` Tier-1 fallback |
| Any element fails DNS regex / contains whitespace, `://`, `/`, `?`, `#`, `@`, `:` (port), IP-literal chars | loader | 20 | `allowlist-load-failed` | `src/index.js` Tier-1 fallback |
| Any element NOT in sealed `APPROVED_HOSTNAMES` | loader | 20 | `allowlist-load-failed` | `src/index.js` Tier-1 fallback |
| Duplicate elements | loader | 20 | `allowlist-load-failed` | `src/index.js` Tier-1 fallback |
| `rotatedAt` missing or malformed | loader | 20 | `allowlist-load-failed` | `src/index.js` Tier-1 fallback |
| `rotatedFromParentSha` missing or not 40-char lowercase hex | loader | 20 | `allowlist-load-failed` | `src/index.js` Tier-1 fallback |
| `notes` present but not a string or > 256 chars | loader | 20 | `allowlist-load-failed` | `src/index.js` Tier-1 fallback |
| Extra unknown fields at top level | loader | 20 | `allowlist-load-failed` | `src/index.js` Tier-1 fallback |
| Unexpected loader exception | `src/index.js` | 20 | `allowlist-load-unexpected-error` | `src/index.js` Tier-1 fallback |

**No silent fallback.** No default hostname list. No env-derived backup. If the manifest is absent or invalid, the container exits before any hook is constructed.

**No partial hook construction.** Stage 15 default-wiring is never reached if the loader fails at `src/index.js` boot time.

---

## §8 Exact future implementation file scope (Relay-side)

| # | Path | Action | Approx. size |
|---|---|---|---|
| 1 | `config/allowlisted-discord-hostnames.json` | NEW (manifest) | ~10 lines |
| 2 | `src/runtime/allowlist-loader.js` | NEW (loader; includes sealed `APPROVED_HOSTNAMES`) | ~150 lines |
| 3 | `src/index.js` | MODIFY | +15 / -0 beyond CONFIG-INJECTION change |
| 4-9 | `tests/smoke/<n>-allowlist-load-*.test.js` × 6 | NEW | ~70-80 lines each |

**Strictly NOT in scope (preserved sealed):** `src/runtime/boot.js`, `src/gateway/egress-allowlist-hook.js`, `src/gateway/phase-g-send-and-record.js`, `src/verify/network-anomaly.js`, `src/runtime/rate-limit-state.js`, `src/config.js`, `schemas/hermes-message.schema.json`, `package.json`, `package-lock.json`, any sealed handoff, `APPROVAL-GATES.md`, `COMM-HUB-RELAY-RULES.md`.

**Future implementation classification:** Mode 5 / HIGH-RISK IMPLEMENTATION, non-activation scope. This is not a low-risk safe-by-construction implementation; it modifies the sealed `src/index.js` entry point. It does not authorize deployment, Discord activation, real network reach, message publish, DB/Kraken/trading access, Autopilot, `MANUAL_LIVE_ARMED`, or CEILING-PAUSE changes.

**Parent-repo paperwork (separate from Relay-side):** 1 NEW handoff (this handoff) + 3 status docs via this DESIGN-SPEC codification phase.

---

## §9 Exact future test/smoke scope

Six new Node `node:test` smoke tests in `tests/smoke/`, each with strict non-activation guards (per established Phase G smoke pattern):

| Test | Verifies |
|---|---|
| `load-success` | The loader returns the validated `{ allowlistedHostnames, rotatedAt, rotatedFromParentSha, notes? }` object for a valid 2-hostname manifest, AND `boot()` receives `runtimeConfig.allowlistedDiscordHostnames` populated with that array. **If the test exercises full boot traversal past Stage 15, it must also inject a valid `operatorPhaseId` (via either the synthetic-runtime-config test helper or via a synthetic operator-phase-id manifest tempdir) so that Stage 13 does not block Stage 15.** The test remains strictly non-activating: no real network reach (hard-blocked via `observeNoNetwork`), no Discord client `.login()`, no gateway IDENTIFY, no REST send. Sealed Stage 15 default-wiring with `validateOnly: true` preserved. |
| `load-missing` | Manifest absent → halt class 20 + `allowlist-load-failed` via ExitSentinel. |
| `load-malformed` | Invalid JSON → halt 20 + `allowlist-load-failed`. |
| `load-empty-array` | `"allowlistedHostnames": []` → halt 20 + `allowlist-load-failed`. |
| `load-not-in-approved-set` | Manifest hostname passes DNS regex but is NOT in sealed `APPROVED_HOSTNAMES` — e.g. `"unauthorized.discord.com"` or `"evil.com"` → halt 20 + `allowlist-load-failed`. |
| `load-with-scheme` | `"allowlistedHostnames": ["https://discord.com"]` → halt 20 + `allowlist-load-failed`. |

**Non-activation guards (all 6 tests):**
- Use `tests/smoke/helpers/temp-tree.js` + `synthetic-runtime-config.js` + `network-observer.js`.
- Hard-block real network via `observeNoNetwork()`.
- `validateOnly: true` at any downstream Phase G touch point.
- Manifest injected via tempdir (not via repo-tracked manifest).
- `--test-concurrency=1` per Phase G smoke discipline.

**Smoke count delta:** depends on phase ordering relative to CONFIG-INJECTION-IMPLEMENT.
- If CONFIG-INJECTION-IMPLEMENT lands first (24/24): allowlist adds 6 → terminal 30/30/0/0.
- If allowlist lands first (19+6=25): CONFIG-INJECTION then adds 5 → terminal 30/30/0/0.
- Either order: terminal state 30/30/0/0.

---

## §10 Codex review checklist for the future implementation

A future Codex HIGH-RISK IMPLEMENTATION review over a Mode 5 non-activation phase should verify:

1. New manifest at `config/allowlisted-discord-hostnames.json` exists, contains exactly 3 required top-level fields (`allowlistedHostnames`, `rotatedAt`, `rotatedFromParentSha`) and may contain optional `notes` field; no unknown extra fields.
2. Each hostname in the manifest's `allowlistedHostnames` array (a) matches the strict DNS regex, (b) contains no scheme/port/path/query/fragment/auth/IP characters, AND (c) is enumerated in the sealed `APPROVED_HOSTNAMES` constant inside `src/runtime/allowlist-loader.js`. The initial sealed `APPROVED_HOSTNAMES` is exactly `new Set(['discord.com', 'gateway.discord.gg'])`. Manifest entries not in `APPROVED_HOSTNAMES` → halt 20 + `allowlist-load-failed`.
3. Initial committed `allowlistedHostnames` is exactly `["discord.com", "gateway.discord.gg"]`. Any future widening requires both a manifest change AND a sealed source change to `APPROVED_HOSTNAMES`, each gated by its own paperwork phase.
4. New loader at `src/runtime/allowlist-loader.js` is side-effect-contained with no module-load-time side effects; the only filesystem read occurs inside `loadAllowlistedDiscordHostnames({ manifestPath })`.
5. Loader's `AllowlistLoadError` carries `{ haltClass: 20, keyword: 'allowlist-load-failed' }`.
6. Loader validates every failure mode listed in §7 fail-closed table.
7. `src/index.js` change is minimal: import + path resolution + try/catch + pass `allowlistedDiscordHostnames` to `boot({ runtimeConfig })`. No other behavior changes.
8. `src/index.js` Tier-1 fallback emits exact JSON shape `{event:'boot-halt', haltClass:20, reason:'<keyword>'}` per RE-B.
9. `src/runtime/boot.js` is untouched (byte-identical to Relay HEAD `f232c328…`).
10. `src/gateway/egress-allowlist-hook.js` is untouched.
11. `src/gateway/phase-g-send-and-record.js` is untouched.
12. `src/verify/network-anomaly.js` is untouched.
13. `src/runtime/rate-limit-state.js` is untouched.
14. `src/config.js` is untouched (loader does NOT extend env validation).
15. `package.json` / `package-lock.json` are untouched (no new dependency; loader uses `node:fs` + `node:path` + `node:url` only).
16. No raw `process.env` reads anywhere in the new code.
17. No top-level fs reads at module load.
18. No network reach, no Discord client construction, no DB client, no Kraken client.
19. No `dotenv` import or any env-loading library.
20. The 6 smoke tests pass (TAP 6/6/0/0 added to existing).
21. Phase G non-activation guard (`validateOnly: true`) is preserved at boot.js Stage 15.
22. No ASCII-Unicode violations: no `→` (U+2192), no `§` (U+00A7) in new source comments.
23. No new `[ ]` checklist items in CHECKLIST.md beyond the implementation phase's own.
24. RUN-10 + RUN-11 evidence remains untracked at the implementation phase's seal.

---

## §11 Forbidden actions / non-authorization clauses

This DESIGN does NOT authorize: editing any file (Mode 2 conversation-only); creating any handoff (this codification SPEC creates this handoff; this DESIGN itself does not); committing/pushing; tests / `npm install` / `npm ci`; Relay repo edits; parent repo edits beyond sealed `683115f1…`; editing `src/index.js`, `boot.js`, `egress-allowlist-hook.js`, `phase-g-send-and-record.js`, `network-anomaly.js`, `rate-limit-state.js`, `src/config.js`, or any sealed source; adding any new dependency; deploy / Railway / Railway CLI / Railway UI; Discord platform action / bot / token / IDENTIFY / REST / publish; starting Relay; `.login()`; DB / Kraken / `MANUAL_LIVE_ARMED` / trading; Autopilot / CEILING-PAUSE changes; Stage 5 (CONSUMED at `40f3137e…`); Stages 7-10b; opening the implementation phase; opening peer sub-designs (`RELAY-RUNTIME-ALLOWLIST-ROTATION-DESIGN`, `RAILWAY-DEPLOY-PLAN`, deploy-execution); opening the peer blocker `COMM-HUB-RELAY-RUNTIME-CONFIG-INJECTION-IMPLEMENT`; real network reach; calling Discord REST or gateway; publishing messages; recursive paperwork beyond this design + codification + optional Rule-1 seal-mirror.

**Approvers exactly `{Victor}`.** Codex verdicts do NOT constitute operator approval.

---

## §12 Success criteria

13 criteria all satisfied by this design:

1. Non-env (zero process.env touch for the allowlist).
2. Git-tracked (committed manifest).
3. Fail-closed on every absent/malformed/empty/oversized/wrong-suffix/wrong-format case.
4. Does NOT widen src/config.js env policy.
5. No new dependencies.
6. Does NOT modify boot.js, egress-allowlist-hook.js, phase-g-send-and-record.js, or network-anomaly.js.
7. src/index.js change is minimal and combines cleanly with CONFIG-INJECTION-DESIGN change.
8. Loader has no module-load-time side effects; the only filesystem read occurs inside `loadAllowlistedDiscordHostnames({ manifestPath })`.
9. Survives Railway restart.
10. Rotatable via separate future paperwork phase (touching both manifest AND sealed source constant).
11. Strict explicit-hostname allowlisting; no suffix-based auto-allow; no wildcards; no arbitrary subdomain.
12. Does NOT lift the OTHER 3 deploy blockers.
13. Does NOT authorize deployment.

---

## §13 Recommended next phase

If this DESIGN-SPEC seals successfully:

1. **Optional Rule-1 seal-mirror** `COMM-HUB-RELAY-RUNTIME-EGRESS-ALLOWLIST-DESIGN-SPEC-CLOSEOUT-SYNC` (DOCS-ONLY / Mode 3) — 3 parent-repo status-doc updates only.

**Explicitly NOT the next step:**

- `COMM-HUB-RELAY-RUNTIME-EGRESS-ALLOWLIST-IMPLEMENT` (Mode 5 HIGH-RISK IMPLEMENTATION non-activation; separately gated open after DESIGN-SPEC seals).
- `COMM-HUB-RELAY-RUNTIME-CONFIG-INJECTION-IMPLEMENT` (peer blocker phase; independently gated).
- Any deploy execution / `RAILWAY-DEPLOY-PLAN` / Stage 5 / Stages 7-10b / Discord activation.
- The remaining 2 deploy blockers (`scripts.start`, Railway run config — those are independent operator-led future phases).
- Any Railway CLI install / rename / config phase by Claude.

---

## §14 Carry-forward state

- Phase G code completion remains ACHIEVED at terminal RUN-11 PASS `19/19/0/0`.
- F-HALT-SMOKE end-state preserved at Phase G terminal `19/19/0/0`.
- RUN-10 evidence + RUN-11 evidence remain untracked and uncommitted (18 files each).
- Relay HEAD preserved at `f232c328284e687511a794dc89358bbc0cd275d1` (G-5-RUN-10-REPAIR seal); Relay working tree clean.
- Relay runtime code exists and is sealed, but no Relay container or process is deployed or running; Relay remains DORMANT.
- Autopilot DORMANT (verified at `eff4dd22…`) preserved.
- Discord activation: NO.
- Deployment: NOT authorized.
- Sealed Gate 10 install approval at `40f3137e…` remains CONSUMED and non-reusable.
- Carve-outs preserved untracked: `orchestrator/handoffs/evidence/` + `position.json.snap.20260502T020154Z`.
- Approvers exactly `{Victor}`.

---

## §15 Reference anchors

- Sealed CONFIG-INJECTION-DESIGN: `orchestrator/handoffs/COMM-HUB-RELAY-RUNTIME-CONFIG-INJECTION-DESIGN.md` (sealed at parent `7aa0ef9d…`).
- Sealed DEPLOYMENT-RUNBOOK-DESIGN: `orchestrator/handoffs/COMM-HUB-RELAY-RUNTIME-DEPLOYMENT-RUNBOOK-DESIGN.md` (sealed at parent `895643a…`).
- Sealed DEPLOYMENT-PREFLIGHT-DESIGN: `orchestrator/handoffs/COMM-HUB-RELAY-RUNTIME-DEPLOYMENT-PREFLIGHT-DESIGN.md` (sealed at parent `a9d1a31…`).
- Sealed DEPLOYMENT-READINESS-DESIGN: `orchestrator/handoffs/COMM-HUB-RELAY-RUNTIME-DEPLOYMENT-READINESS-DESIGN.md` (sealed at parent `02e0796…`).
- Sealed G-DESIGN: `orchestrator/handoffs/COMM-HUB-RELAY-RUNTIME-G-DESIGN.md` (sealed at parent `66af7df…`).
- APPROVAL-GATES: `orchestrator/APPROVAL-GATES.md` (out-of-scope for this design).
- COMM-HUB-RELAY-RULES: `orchestrator/COMM-HUB-RELAY-RULES.md` (out-of-scope for this design).
- Relay sealed source anchors: `src/index.js` lines 10-25 (no runtimeConfig pass), `src/runtime/boot.js:540-610` (Stage 15 default-wiring), `src/gateway/egress-allowlist-hook.js:40-95` (factory), `src/gateway/phase-g-send-and-record.js:85-91` (hook-shape enforcement), `src/verify/network-anomaly.js:82-186` (gate 9 verifier).

---

**End of permanent SAFE-class handoff.**

This handoff is preserved verbatim through every subsequent egress-allowlist subphase and never edited after codification. Approvers exactly `{Victor}`. Codex review verdicts do NOT constitute operator approval.
