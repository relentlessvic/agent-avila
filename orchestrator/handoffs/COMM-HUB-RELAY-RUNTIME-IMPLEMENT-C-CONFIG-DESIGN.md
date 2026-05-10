# Communication Hub — Relay Runtime Implement Phase C-CONFIG Design (template — COMM-HUB)

> **Author rule:** This file persists the conversation-only DESIGN-ONLY (Mode 2) report produced by the `COMM-HUB-RELAY-RUNTIME-IMPLEMENT-C-CONFIG-DESIGN` phase, with all four Codex round-1 required edits (RE-1, RE-2, RE-3, RE-4) applied verbatim and Codex round-2 final verdict PASS. The design recommends a future SAFE IMPLEMENTATION (Mode 4) phase named `COMM-HUB-RELAY-RUNTIME-IMPLEMENT-C-CONFIG` whose scope is exactly three files (`src/config.js`, `src/log.js`, `schemas/hermes-message.schema.json`) in the separate operator-controlled GitHub repo `relentlessvic/agent-avila-relay`. **This document is NOT authorization to draft Phase C source code, run `npm install` / `npm ci`, clone or push to `relentlessvic/agent-avila-relay`, install Relay further, deploy a Relay runtime, register a Discord application, mint a Discord bot token, invite a bot, grant any Discord permission, install a webhook / scheduler / MCP trigger / cron job / Ruflo / background automation, post to Discord, run a Stage 7 dry-run, take a production action, take a trading action, or break CEILING-PAUSE.** Each future step (Phase C opening, Phase C drafting, operator-manual placement, Codex on-disk review, parent-repo closeout) requires its own separately-approved phase with its own design / Codex review / Victor approval cascade.
>
> **No source code, no Discord client, no publish path, no halt state machine, no message store, no env-var-validation runtime invocation, no executable Relay code, no webhook, no scheduler, no MCP trigger, no cron job, and no background automation is installed by writing this file.**

> **Naming convention.** Active forward-looking wording uses "Relay" per `orchestrator/COMM-HUB-RELAY-RULES.md` "Naming convention" subsection and `CLAUDE.md` "Naming convention — Relay vs. external Hermes Agent" subsection. Historical phase identifiers (e.g., `COMM-HUB-DOCS-G-HERMES-RUNTIME-DESIGN-SPEC`, `COMM-HUB-HERMES-INSTALL`, `COMM-HUB-HERMES-DRY-RUN-DESIGN`, `COMM-HUB-HERMES-STAGE5-PARTIAL-INSTALL-RECORD`) are preserved verbatim because they are immutable historical phase identifiers. The `HERMES_VERSION` env-var literal is preserved per `orchestrator/handoffs/COMM-HUB-RELAY-RUNTIME-DESIGN.md` §8.

Author: Operator-driven manual planning (Claude as orchestrator; future implementation Victor-only)
Last updated: 2026-05-10 (`COMM-HUB-RELAY-RUNTIME-IMPLEMENT-C-CONFIG-DESIGN-SPEC` — DOCS-ONLY / Mode 3)
Source-design HEAD: `5f2fc810c1b4c77607e8aa8ac40fe61fa32ed269` (the parent-repo commit anchoring this design phase; Codex round-1 + round-2 reviewed against canonical files at this HEAD)
Relay-repo Phase B anchor: `relentlessvic/agent-avila-relay` @ `f87faef99600335a7db47ac1bffa92a499e54acb` (Phase B commit; package.json + package-lock.json with ajv 8.20.0 + pino 9.14.0)

Canonical references:
- `orchestrator/handoffs/COMM-HUB-RELAY-RUNTIME-DESIGN.md` — canonical runtime design (§8 9 allowed env vars including conditional `DRY_RUN_LOG_PATH`; §9 forbidden env vars full enumeration; §12 message format / schema; §15 28 halt classes including Layer 3 IDs 20+21; §16 logging discipline)
- `orchestrator/handoffs/COMM-HUB-RELAY-RUNTIME-IMPLEMENT-DESIGN.md` — canonical Phase A through Phase H build-sequence design
- `orchestrator/handoffs/COMM-HUB-RELAY-RUNTIME-IMPLEMENT-B-DEPS-DESIGN.md` — canonical Phase B design (ajv + pino dep-only scope)
- `orchestrator/COMM-HUB-RELAY-RULES.md` — canonical Relay specification (channel allow-list; "Read Message History" forbidden; SAFE-class)
- `orchestrator/handoffs/COMM-HUB-INSTALL-RELAY-CHECKLIST.md` — Stage 5 install checklist
- `orchestrator/COMM-HUB-RULES.md`, `orchestrator/handoffs/COMM-HUB-CHANNEL-LAYOUT.md` — Communication Hub rulebook + channel/role/permission matrix
- `orchestrator/APPROVAL-GATES.md`, `orchestrator/AUTOMATION-PERMISSIONS.md`, `orchestrator/PROTECTED-FILES.md`, `orchestrator/HANDOFF-RULES.md`, `orchestrator/ROLE-HIERARCHY.md`, `orchestrator/PHASE-MODES.md`, `orchestrator/AUTOPILOT-RULES.md`, `orchestrator/NEXT-ACTION-SELECTOR.md`, `CLAUDE.md` — ARC governance docs

If any field below diverges from those canonical files, the canonical files win and this design must be re-aligned in a follow-up DOCS-ONLY phase.

---

## §0 — Phase classification and pre-flight verification

This persisting phase (`COMM-HUB-RELAY-RUNTIME-IMPLEMENT-C-CONFIG-DESIGN-SPEC`) is **DOCS-ONLY (Mode 3)**. Scope: 4 files (this new handoff template + 3 status docs). Does NOT open Phase C, draft Phase C source, run npm, clone or push to the Relay repo, install Relay, register Discord application, mint a token, install automation, post to Discord, take a production action, or break CEILING-PAUSE.

Pre-flight verification at the source-design HEAD `5f2fc810c1b4c77607e8aa8ac40fe61fa32ed269`:

| Check | Expected | Observed | Verdict |
|---|---|---|---|
| `git rev-parse HEAD` | `5f2fc810…` | `5f2fc810c1b4c77607e8aa8ac40fe61fa32ed269` | PASS |
| `git rev-parse origin/main` | `5f2fc810…` | `5f2fc810c1b4c77607e8aa8ac40fe61fa32ed269` | PASS |
| `git ls-remote origin main` | `5f2fc810…` | `5f2fc810…\trefs/heads/main` | PASS |
| Working tree (at design phase) | clean except `position.json.snap.20260502T020154Z` | only that one untracked snapshot | PASS |

Three-way SHA consistency PASS. No file written, no Edit/Write tool invoked, no git mutation, no clone of `relentlessvic/agent-avila-relay`, no `npm`, no Railway action, no Discord action by the design phase. Working tree at this codification phase additionally adds the four files in §0's scope.

---

## §1 — Recommended Phase C name

**`COMM-HUB-RELAY-RUNTIME-IMPLEMENT-C-CONFIG`**

Closeout = `COMM-HUB-RELAY-RUNTIME-IMPLEMENT-C-CONFIG-CLOSEOUT`. Naming consistent with the lettered build sequence A → B → C → D → E → F → G → H per `orchestrator/handoffs/COMM-HUB-RELAY-RUNTIME-IMPLEMENT-DESIGN.md` §3.

## §2 — Recommended phase mode

**SAFE IMPLEMENTATION (Phase Mode 4 per `orchestrator/PHASE-MODES.md`).**

Reasoning:
- Phase C produces three files in the **separate** Relay repo; touches **zero** files in the parent trading repo (other than the eventual closeout-phase status-doc updates).
- **No Discord client; no Discord network reach** — `discord.js` deferred to Phase G.
- **No publish path; no runtime activation** — Phases F + G wire the actual state machine.
- **No halt state machine** — Phase C declares halt class IDs as constants only; Phase F wires the state machine.
- **No env-var consumer at runtime** — `src/config.js` is a pure validator function, called only by Phase F's `src/index.js` boot path.
- **Zero HARD BLOCK files; zero safety-policy doc edits.**

Mode-promotion non-rule: ambiguous-mode → higher mode wins. SAFE chosen; HIGH-RISK reserved for Phase G.

## §3 — Exact proposed Phase C scope

**Files added to `relentlessvic/agent-avila-relay`:**

```
relentlessvic/agent-avila-relay/
├── src/
│   ├── config.js            (NEW — env-var allow-list + deny-list validator;
│   │                         halt classes 20+21 declared; pure function)
│   └── log.js               (NEW — pino logger factory + redaction config +
│                             mandatory safeLog value-pattern wrapper;
│                             pure function; no caller until Phase F)
└── schemas/
    └── hermes-message.schema.json   (NEW — strict JSON Schema for Relay
                                      messages per RUNTIME-DESIGN §12)
```

**Total Phase C artifacts: 3 files; ~150–250 lines of code total** (rough estimate; finalized at draft time).

**Files unchanged in Phase C:**
- `package.json`, `package-lock.json` (Phase B; no dep additions in Phase C — `ajv` and `pino` already in the lockfile).
- `README.md`, `LICENSE`, `.gitignore` (Phase A).

**Parent-repo (`relentlessvic/agent-avila`) impact during Phase C drafting + Relay-repo commit: zero parent-repo file changes.** Only the eventual Phase C closeout updates 3 parent-repo status docs.

---

## §4 — `src/config.js` design (with RE-1 + RE-2 applied verbatim)

### Purpose

Pure-function module exporting:
1. `validateEnv(processEnv)` → returns `{ env: ValidatedEnv }` on success, throws structured `ConfigError` with halt-class ID on failure.
2. `ALLOWED_ENV_VARS`, `FORBIDDEN_ENV_VAR_PATTERNS` — exported constants for testability.
3. `HaltClass` enum — declares halt-class IDs `CONFIG_FORBIDDEN_ENV_VAR_PRESENT` (= 20) and `CONFIG_REQUIRED_ENV_VAR_MISSING` (= 21) per RUNTIME-DESIGN §15. Phase F wires the actual state machine.

### Behavior contract

**Forbidden-env scan (halt class 20):** iterate over `process.env` keys; for each key, test against the canonical forbidden patterns from RUNTIME-DESIGN §9. **The Phase C implementation MUST encode every canonical RUNTIME-DESIGN §9 entry exactly, including the heuristic credential catch-all (`_KEY` / `_SECRET` / `_PASSWORD` / `_TOKEN` other than `DISCORD_BOT_TOKEN`).** No silent omission, no informal paraphrase. Any match → throw `ConfigError({ haltClass: 20, varName, reason: "forbidden" })`. Codex review at the drafted-source step will diff `FORBIDDEN_ENV_VAR_PATTERNS` against RUNTIME-DESIGN §9 byte-by-byte; any mismatch → required edit. (RE-2)

**Canonical RUNTIME-DESIGN §9 entries** (full enumeration that the implementation must encode):
- `DATABASE_URL`
- `DATABASE_PUBLIC_URL`
- `POSTGRES_*` (any var starting with `POSTGRES_`)
- `PGUSER`, `PGPASSWORD`, `PGHOST`, `PGPORT`, `PGDATABASE` (libpq env vars)
- `KRAKEN_API_KEY`
- `KRAKEN_API_SECRET`
- `KRAKEN_*` (any var starting with `KRAKEN_`)
- `MANUAL_LIVE_ARMED`
- `BOT_*` (any var related to trading bot)
- `DASHBOARD_*`
- `GITHUB_TOKEN`
- `RAILWAY_TOKEN` (beyond what Railway service uses for self-management)
- `CI`, `CIRCLE_*`, `TRAVIS_*`, `GITHUB_ACTIONS`, `GITLAB_CI`
- `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GOOGLE_API_KEY`, `GEMINI_API_KEY`
- `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`
- `GCP_*`, `GOOGLE_APPLICATION_CREDENTIALS`
- `AZURE_*`
- `STRIPE_*`, `TWILIO_*`, `SENDGRID_*`
- **Heuristic catch-all:** any var containing `_KEY`, `_SECRET`, `_PASSWORD`, `_TOKEN` other than the allow-listed `DISCORD_BOT_TOKEN`.

**Required-env scan (halt class 21):** required-env scan against the **8 baseline required vars** from RUNTIME-DESIGN §8, with `DRY_RUN_LOG_PATH` required only when `RELAY_MODE=dry_run`. (RE-1)

Baseline (8 always-required):
- `DISCORD_BOT_TOKEN` (secret; non-empty; matches Discord bot token format regex; **never logged in plaintext**)
- `RELAY_MODE` (must be exactly `production` or `dry_run`; halt on any other value)
- `LOG_LEVEL` (must be one of `debug` / `info` / `warn` / `error`; defaults to `info` per RUNTIME-DESIGN §8 if unspecified — operator-decision-pending whether to require explicit setting)
- `LOG_DESTINATION` (must match `stdout` or `file:/<absolute path>`)
- `MESSAGE_STORE_PATH` (absolute path; readable by process user)
- `PUBLISH_LOG_PATH` (absolute path; writable; append-only-enforceable)
- `CEILING_PAUSE_SIGNAL_PATH` (readable; content must be `ACTIVE` or `BROKEN` at runtime)
- `HERMES_VERSION` (non-empty; preserved literal name per RUNTIME-DESIGN §8)

Conditionally required (1 var; required only when `RELAY_MODE=dry_run`):
- `DRY_RUN_LOG_PATH` (absolute path; must differ from `PUBLISH_LOG_PATH`)

Total = 8 baseline + 1 conditional = the canonical 9-var allow-list per RUNTIME-DESIGN §8. Any missing/invalid var meeting its required-condition → throw `ConfigError({ haltClass: 21, varName, reason })`.

### Anti-feature properties (defense-in-depth)

- **No `dotenv` import.** The module reads `process.env` directly. No `.env` file loading. (Aligns with B-DEPS-DESIGN §7 forbidden-deps `dotenv` family.)
- **No fs writes.** Pure validation; no side effects beyond the returned object.
- **No network reach.** No HTTP client, no Discord client, no Kraken client, no DB client.
- **No secret values logged.** Validator may log a *boot-time list of validated var names* (no values) at `info` level via `src/log.js`; secret values never echoed.
- **No top-level execution.** Module-load discipline: no `validateEnv()` call at module top-level; no logger emit at top-level; no global state mutation.
- **Idempotent.** Calling `validateEnv` twice with identical input returns identical results.

### Maps to canonical references

- RUNTIME-DESIGN §8 (allowed env var list verbatim; 8 baseline + 1 conditional).
- RUNTIME-DESIGN §9 (forbidden env var deny-list verbatim; full enumeration must be encoded).
- RUNTIME-DESIGN §15 halt classes 20 + 21.
- B-DEPS-DESIGN §5 + §7 (no `dotenv`).

---

## §5 — `src/log.js` design (with RE-3 applied verbatim)

### Purpose

Pure-function module exporting:
1. `createLogger(options)` → returns a configured `pino` logger instance.
2. `safeLog(level, payload, baseLogger?)` → **mandatory wrapper** that performs a pre-emit value-pattern scan over the payload object (recursive) and substitutes any matching value with `'[REDACTED]'` before pino is called.
3. `REDACT_PATHS` — exported constant array of pino-compatible redact paths.
4. `LOG_DESTINATIONS` — operator-decision map for `stdout` vs `file:/<path>`.

### Configuration

When called by Phase F's `src/index.js` (after `validateEnv` returns successfully):

```
createLogger({
  level: env.LOG_LEVEL,                           // 'debug' | 'info' | 'warn' | 'error'
  destination: parseDestination(env.LOG_DESTINATION),  // returns stream or stdout
  redact: { paths: REDACT_PATHS, censor: '[REDACTED]' },
  base: { hermes_version: env.HERMES_VERSION },   // boot-time identifier
  formatters: { /* structured JSON output */ }
})
```

### `REDACT_PATHS` — comprehensive

Per RUNTIME-DESIGN §16:

| Pattern | Reason |
|---|---|
| `*.token` (any nested) | Discord bot token; OAuth tokens; auth tokens generally |
| `*.tokens.*` | Token arrays/maps |
| `*.password` | Generic password fields |
| `*.secret` | Generic secret fields |
| `*.api_key` / `*.apiKey` | Common API key naming conventions |
| `DISCORD_BOT_TOKEN` (root + nested) | Specific allow-listed env var; never echoed even at boot |
| `req.headers.authorization` | HTTP authorization header (defensive) |
| `req.headers.cookie` | HTTP cookie header (defensive) |
| `*.body` (when `forbidden_content_scan_tripped` flag is set on the log entry) | Per RUNTIME-DESIGN §16 — full message body redacted if forbidden-content scan flagged anything; only the FIRST forbidden token logged |

### Redaction discipline

- **Default censor string:** `'[REDACTED]'`.

- **Censor-by-pattern (mandatory in Phase C):** Phase C ships `safeLog` (or equivalent value-pattern redaction) covering the forbidden-content patterns from `orchestrator/HANDOFF-RULES.md` + `orchestrator/COMM-HUB-RULES.md`; **it is mandatory for all logger calls in later phases** because RUNTIME-DESIGN §16 forbids logging any forbidden-content pattern. The wrapper performs a pre-emit pattern scan over the payload object (recursive) and substitutes any matching value with `'[REDACTED]'` before pino is called. Phases C–H must use `safeLog` (or the equivalent exported wrapper); direct `logger.info` / `logger.error` / etc. calls bypassing `safeLog` are forbidden in non-test code paths. Codex review at drafted-source step verifies that `src/log.js` exports `safeLog` and that no module in later phases bypasses it. (RE-3)

- **Boot-time log emission:** logger writes `boot success: hermes_version=<X>, mode=<Y>, log_level=<Z>` and the **list of validated env-var names** (no values).

- **Halt-time log emission:** when Phase F wires halt classes, the halt event is logged at `error` level with the halt class id, root cause, and redacted context.

### Anti-feature properties

- **No fs write to repo.** Logger writes to `stdout` or to an operator-configured external file path (per `LOG_DESTINATION`); never to any path inside the Relay repo source tree.
- **No network reach.** pino has no HTTP transport in this design; logs go to stdout (Railway captures) or filesystem path. No Sentry, no Datadog, no Loggly.
- **No log rotation logic.** Operator-managed retention per RUNTIME-DESIGN §16; pino just writes.
- **No `process.exit` calls.** Logger is side-effect-bounded; halt-state-machine wiring (which calls exit) is Phase F.
- **No top-level execution.** Module-load discipline: no `createLogger()` call at module top-level; no logger emit at top-level; no global state mutation.

### Maps to canonical references

- RUNTIME-DESIGN §16 (logging discipline; pino + redaction; secret-redaction config).
- B-DEPS-DESIGN §5 (`pino` v9.x as the canonical logger).

---

## §6 — `schemas/hermes-message.schema.json` design (with RE-4 applied verbatim)

### Purpose

Strict JSON Schema (Draft-07) for the Relay message contract per RUNTIME-DESIGN §12. Phase E uses this schema to validate every incoming message via `ajv` at gate 1 of the 11-gate pipeline.

### Structure (per RUNTIME-DESIGN §12)

```
$schema: "http://json-schema.org/draft-07/schema#"
title:   "Relay Message"
type:    object
additionalProperties: false
required:
  - message_id
  - channel_id
  - channel_name
  - body
  - codex_pass_verdict_ref
  - operator_authorization
  - allowed_placeholder_map
  - halt_on_condition_flags
  - dry_run

properties:
  message_id:                  string; pattern ^[A-Z][A-Z0-9-]{4,63}$ (operator-generated globally unique idempotency key)
  channel_id:                  string; pattern ^[0-9]{17,20}$ (Discord snowflake)
  channel_name:                string; enum ["#status", "#summaries", "#system-health"] (forever-allowed write channels)
  body:                        string; minLength 1; maxLength 2000 (Discord message length limit)
  codex_pass_verdict_ref:      object; required {verdict, review_id, reviewed_at}
                               verdict: enum ["PASS"]
                               review_id: string; minLength 1
                               reviewed_at: string; format date-time
  operator_authorization:      object; oneOf:
                                 (a) per-message: {mode: "per-message", approver: "Victor", approved_at: date-time, approval_session_ref: string}
                                 (b) class-authorization (Stage 10a/10b only): {mode: "class-authorization", class_ref: string, bounds: {channel, template_id, allowed_event_types, max_count, expiration, revocation_rule, forbidden_content_constraints}}
  allowed_placeholder_map:     object; patternProperties on placeholder names; values from enum ["UTC_DATE_AT_PUBLISH_TIME", "UTC_TIME_AT_PUBLISH_TIME", "PHASE_ID", "COMMIT_SHA"]
  halt_on_condition_flags:     object; ceiling_pause_must_be_active: const true; additional_halts: array of strings
  dry_run:                     boolean
```

### Strictness properties

- `additionalProperties: false` at the root **and on every nested object** — forbids any unknown field, blocking attacker-introduced or operator-typo fields.
- `enum` constraints on `channel_name`, `codex_pass_verdict_ref.verdict`, `operator_authorization.mode`, `operator_authorization.approver`, `allowed_placeholder_map.*` values — locks down the exact accepted vocabulary.
- `minLength` / `maxLength` / `pattern` on every string — prevents empty / malformed / oversized values.
- `format: date-time` on timestamps — **canonical schema keeps `format: date-time` unless a separate canonical design update approves regex replacement; no Phase C dependency is added.** This means the schema declaration uses `format: date-time` per RUNTIME-DESIGN §12 verbatim. Note that `ajv@8.20.0` (Phase B-locked) does NOT enforce `format` keywords at runtime by default; enforcement requires the `ajv-formats` plug-in, which is NOT in the Phase B lockfile and would re-open Phase B if added. **Phase C does NOT add `ajv-formats`.** Runtime enforcement of date-time is therefore deferred until a separate canonical-approved phase chooses one of: (a) update RUNTIME-DESIGN §5 / B-DEPS §5 to add `ajv-formats` to the Phase B dep list (re-running Phase B's drafting + Codex review + commit + push cycle), or (b) update RUNTIME-DESIGN §12 to permit a regex pattern in lieu of `format: date-time`. Until that future canonical update, ajv at Phase E gate 1 will accept any string in the `reviewed_at` / `approved_at` / `expiration` fields — the schema is declaratively conformant but runtime-permissive on date-time validation. **This is operator-acknowledged behavior under the canonical-update-required path.** (RE-4)
- `const true` on `halt_on_condition_flags.ceiling_pause_must_be_active` — every message must explicitly opt into CEILING-PAUSE halt; cannot silently bypass.

### File location

`schemas/hermes-message.schema.json` — at the Relay-repo root in a dedicated `schemas/` directory. Pure JSON file; no executable content.

### Anti-feature properties

- **No external `$ref` loading.** All schema components are inline. No `$ref` to remote URLs.
- **No code execution.** Pure JSON; no JavaScript / no executable schema.
- **No mutable state.** The schema file is read-only at runtime by Phase E's ajv compilation; never modified.

### Maps to canonical references

- RUNTIME-DESIGN §12 (message format / schema verbatim).
- RUNTIME-DESIGN §13 (Phase E's gate 1 schema validation).
- COMM-HUB-RELAY-RULES "Channel allow-list" (the `channel_name` enum reflects the canonical allow-list).

---

## §7 — Redaction rules (consolidated; RE-3 applied)

| Layer | Mechanism | Where |
|---|---|---|
| 1. Pino path-redact | `redact.paths` array → `'[REDACTED]'` | `src/log.js` `createLogger` |
| 2. **Mandatory** `safeLog` value-pattern-redact | Phase C ships it; all later-phase logger calls go through it | `src/log.js` |
| 3. Boot-time discipline | env-var values never echoed; only var-name list logged | `src/index.js` (Phase F) when calling `validateEnv` |
| 4. Halt-time discipline | halt log records halt class + first forbidden token (not full body) | `src/halt.js` (Phase F) |
| 5. Forbidden-content scan at publish (Phase E) | gate 10 in the 11-gate pipeline | `src/verify/forbidden-content.js` (Phase E) |

Phase C ships layers 1 and 2 (the pino config + mandatory `safeLog` wrapper). Layers 3, 4, 5 are wired by Phases F and E. Phase C must NOT log anything during its own module-load (no logger calls at module top-level).

---

## §8 — What is NOT in Phase C

- Source-of-truth message store reader (Phase D).
- Publish-log writer (Phase D).
- Dry-run log writer (Phase D).
- The 11 verification gates (Phase E).
- The halt-state-machine (`src/halt.js` + `src/index.js` boot wiring; Phase F).
- The Discord gateway client (`src/gateway.js`; Phase G; HIGH-RISK).
- The publish path (`src/publish.js`; Phase G).
- `Dockerfile`, `railway.json`, `.github/workflows/**`, `tests/**` (Phase H).
- Any `npm install` to add new deps.

## §9 — Runtime safety boundaries (canonical; preserved by Phase C)

Phase C introduces three modules but **none of them run at module-load**. The functions are exported and only execute when called by Phase F. Boundaries:

| Boundary | State at Phase C end | Source |
|---|---|---|
| No trading | Vacuous (no Kraken/DB/network code) | RUNTIME-DESIGN R7, R8 |
| No Kraken | Vacuous (forbidden-deps preserved; `KRAKEN_*` in deny-list) | RUNTIME-DESIGN R7, §9 |
| No DB | Vacuous (no DB client; `DATABASE_URL` etc. in deny-list) | RUNTIME-DESIGN R9, §9 |
| No `MANUAL_LIVE_ARMED` | Vacuous + `MANUAL_LIVE_ARMED` in `src/config.js` deny-list (halt class 20) | RUNTIME-DESIGN R11, §9 |
| No Railway / GitHub token | Both in deny-list | RUNTIME-DESIGN §9 |
| No external Hermes Agent (Nous / OpenRouter) | LLM API keys in deny-list | CLAUDE.md naming convention; RUNTIME-DESIGN §9 |
| No Discord read permission | No Discord client at all | RELAY-RULES line 110 |
| No Discord commands | No Discord client | INSTALL-RELAY-CHECKLIST step 8 |
| No auto-posting | No publish path | RELAY-RULES staged path |
| No fs write to trading repo | Relay has no checkout of trading repo (separate-repo discipline) | RUNTIME-DESIGN §6 |
| No production action | Vacuous | RUNTIME-DESIGN §1 |

## §10 — Test plan

**Phase C test plan (light — unit tests deferred to Phase H):**
- **No unit tests in Phase C itself.** Test framework deferred to Phase H per B-DEPS-DESIGN §6.
- **Codex docs-only review of drafted source:**
  - Forbidden-content scan against `orchestrator/HANDOFF-RULES.md` + `orchestrator/COMM-HUB-RULES.md` patterns.
  - Module-load discipline grep: `src/config.js` and `src/log.js` must not have any code that runs at module load.
  - Cross-reference accuracy: `src/config.js` env-var allow-list (8 baseline + 1 conditional) matches RUNTIME-DESIGN §8 verbatim; `src/config.js` deny-list matches RUNTIME-DESIGN §9 byte-by-byte (RE-2 enforcement); `src/log.js` redact-path list matches RUNTIME-DESIGN §16 verbatim; `schemas/hermes-message.schema.json` matches RUNTIME-DESIGN §12 verbatim.
  - JSON Schema validity: `schemas/hermes-message.schema.json` is valid Draft-07.
  - `safeLog` export verification: Codex confirms `src/log.js` exports `safeLog` (RE-3 enforcement) and Phases C–H must use it.
  - `format: date-time` preserved in schema; `ajv-formats` NOT added (RE-4 enforcement).
  - Naming-convention compliance.
  - No `dotenv` import; no fs write in Relay repo source tree; no network reach; no `process.exit`.

- **Operator-side smoke tests (after Phase C placement):**
  - `node -e "import('./src/config.js').then(m => console.log(Object.keys(m)))"` — verify module loads cleanly without side effects.
  - `node -e "import('./src/log.js').then(m => console.log(Object.keys(m)))"` — same; verify `safeLog` is in exports.
  - `node -e "JSON.parse(require('fs').readFileSync('schemas/hermes-message.schema.json','utf8'))"` — verify schema valid JSON.

## §11 — Codex review gates (Phase C)

| Gate | When | Scope |
|---|---|---|
| Codex design-only round-1 | Source design phase (Mode 2) | PASS WITH REQUIRED EDITS — RE-1, RE-2, RE-3, RE-4 |
| Codex design-only round-2 | After RE applied conversation-only | PASS |
| Codex docs-only review of this codification | This persisted phase (Mode 3) | Persisted artifact preserves the design + alignment with canonical |
| Codex docs-only review of drafted source code | After Claude drafts `src/config.js` + `src/log.js` + `schemas/hermes-message.schema.json` content | Module-load discipline + forbidden-content + JSON-Schema validity + cross-reference + safeLog export + format date-time preservation |
| Codex closeout review of orchestrator status docs | After operator commits to Relay repo and reports SHA | Status docs correctly record Phase C closure with Relay-repo SHA |

## §12 — Victor approval gates (Phase C)

| Gate | When | Class |
|---|---|---|
| Open-this-design (consumed) | Source design phase | Implicit |
| Open-this-codification (consumed) | This persisted phase | Implicit |
| Codex round-2 review of this codification | After write | Per existing workflow |
| Commit-only + push approval for codification | Per existing workflow | 4-file scope |
| Open-Phase-C approval | After codification commits | RED tier per AUTOMATION-PERMISSIONS Tier 3 (phase-mode promotion to SAFE IMPLEMENTATION) + opening a substantive implementation track |
| Drafted-content approval | After Codex docs-only review of drafted source | Per existing workflow |
| Operator commits to Relay repo | Operator-manual; Claude has no GitHub authority | Per canonical operator-only pattern |
| Orchestrator-side closeout commit-only + push approvals | After operator reports Relay-repo SHA | Per existing workflow |

The set of approvers is and remains `{Victor}`.

## §13 — Implementation order

1. Operator reads this codification and either approves, requests edits, or rejects.
2. Codex docs-only review of this codification.
3. Operator approves commit-only and push for this codification.
4. Operator explicitly approves opening Phase C in-session.
5. Claude drafts `src/config.js` + `src/log.js` + `schemas/hermes-message.schema.json` content as conversation `<file>`-style blocks.
6. Codex docs-only review of drafted content.
7. Operator commits and pushes manually to `relentlessvic/agent-avila-relay` (Claude has no GitHub authority for that repo).
8. Operator reports back the Relay-repo HEAD SHA.
9. Claude opens closeout phase `…-C-CONFIG-CLOSEOUT` (DOCS-ONLY) in the parent repo.
10. Codex docs-only review of closeout.
11. Operator approves closeout commit-only and push in the parent repo.
12. End of Phase C. Phase D-STORE does not auto-open.

## §14 — Rollback plan

Phase C is fully reversible at every step. Before Step 7 (operator commit to Relay repo): no state change anywhere. After Step 7 but before Step 9: operator reverts the Relay-repo commit. After Step 11 (closeout committed): operator opens a `…-C-CONFIG-ROLLBACK` DOCS-ONLY phase to record reversal.

Out-of-scope for Phase C rollback: Discord application / bot / token / permission state; `agent-avila-relay` Railway service shell; trading-runtime / production state — all unchanged by Phase C.

## §15 — What is NOT authorized

This persisted codification authorizes **nothing downstream**. Specifically NOT authorized:

- Opening `COMM-HUB-RELAY-RUNTIME-IMPLEMENT-C-CONFIG`.
- Drafting Phase C source code.
- Any clone, write, commit, or push to `relentlessvic/agent-avila-relay`.
- Any `npm install`, `npm ci`, or any other npm command (no new deps; `ajv-formats` NOT added).
- Adding any new dependency beyond ajv and pino already in the Phase B lockfile.
- Any source code, Dockerfile, Railway config, CI workflows, tests, Discord client, publish path, halt state machine, message-store / publish-log directory contents.
- Any Railway action; any deploy.
- Any Discord application / bot / token / permission / webhook / post action.
- Stage 5 install resumption (Steps 14–21 remain deferred; Stage 5 Gate-10 install approval at `40f3137e842cd60acf1adf17ecc7fe2f0b1b8935` remains CONSUMED).
- Stage 7 dry-run; Stages 8 / 9 / 10a / 10b auto-publish activation.
- Any DB / Kraken / env / `MANUAL_LIVE_ARMED` / production action.
- DASH-6 smoke run; D-5.12f first-live-exercise; Migration 009+; autopilot Loop B/C/D activation; CEILING-PAUSE break.
- External Hermes Agent (Nous / OpenRouter) installation, integration, or use.
- Memory-file edit; test-suite edit.
- Modification of any safety-policy doc, canonical Relay handoff record, runtime / migration / script / deploy file in the parent repo.
- Any phase-mode promotion. Approvers remain `{Victor}`.
- pino v9 → v10 migration (still requires separate canonical doc update first).
- `ajv-formats` addition (would re-open Phase B).

## §16 — Codex review packet (16 questions; for record)

The 16-goal DESIGN-ONLY review checklist used in Codex round-1 + round-2:

1. Phase mode classification (SAFE IMPLEMENTATION / Mode 4).
2. Phase C file scope (3 files).
3. `src/config.js` env allow-list correctness (8 baseline + 1 conditional per RUNTIME-DESIGN §8).
4. `src/config.js` env deny-list correctness (canonical RUNTIME-DESIGN §9 verbatim).
5. Halt class IDs (20 + 21 per RUNTIME-DESIGN §15 Layer 3).
6. `src/log.js` pino + redaction (REDACT_PATHS per RUNTIME-DESIGN §16; `safeLog` mandatory).
7. No `dotenv` import.
8. No module-load side effects.
9. JSON Schema validity + strictness (`additionalProperties: false`; `const true`; `format: date-time` preserved).
10. Schema matches RUNTIME-DESIGN §12 (9 required properties).
11. Channel allow-list in schema (`#status` / `#summaries` / `#system-health`).
12. No new dependencies in Phase C.
13. No Discord client.
14. Naming-convention compliance.
15. Forbidden-content scan of design report.
16. Working-tree integrity.

Plus 8 special-focus items from the operator submission:
1. SAFE IMPLEMENTATION as correct future Phase C mode.
2. Scope strictly limited to the 3 files.
3. No new npm dep.
4. **Date-time validation: keep `format: date-time` (RE-4).**
5. **`safeLog` mandatory in Phase C (RE-3).**
6. `src/config.js` no top-level validation / side effects.
7. `src/log.js` no top-level logger creation / emission.
8. All non-authorizations preserved.

## §17 — Verdict (source design phase)

**PASS** (round-1 PASS WITH REQUIRED EDITS → round-2 PASS) —
- **PASS** on three-way SHA consistency, working-tree state, conversation-only DESIGN discipline, mode-classification reasoning, scope-minimality reasoning, anti-feature properties, alignment with canonical RUNTIME-DESIGN §8/§9/§12/§15/§16 + RUNTIME-IMPLEMENT-DESIGN §3 + B-DEPS-DESIGN §5/§6/§7.
- **Findings (recorded; not actionable by this design):**
  - **F1.** `LOG_LEVEL` default vs explicit-required is operator-decision-pending at draft time.
  - **F2 (revised per Codex RE-4).** The schema's `format: date-time` declaration is canonical per RUNTIME-DESIGN §12. ajv@8.20.0 (Phase B-locked) does NOT enforce `format` keywords without the `ajv-formats` plug-in. Phase C does NOT add `ajv-formats`. Runtime enforcement of date-time is deferred to a future canonical-approved phase that may either add `ajv-formats` to the dep list (re-opening Phase B) or modify the canonical schema to permit a regex. Until that future canonical update, the schema is declaratively conformant but runtime-permissive on date-time fields.
  - **F3.** `src/log.js` may need to choose between two pino destination patterns (stream object vs filename string). Drafting phase chooses; both operator-acceptable.
  - **F4.** Halt class constants in `src/config.js` should match the canonical numeric IDs from RUNTIME-DESIGN §15 (20 and 21 for Layer 3 — Phase C territory). Drafting phase verifies.
  - **F5.** Module file extension: per Phase B's `"type": "module"`, source files use ES module syntax (`import` / `export`). Drafting phase will use `.js` with ES module syntax.

The source design phase stopped after delivering the verdict (Mode 2 stop discipline). No file written by the design phase. No code generated.

---

## §18 — Codex review history

### Round 1 — PASS WITH REQUIRED EDITS

Codex DESIGN-ONLY review submitted at HEAD `5f2fc810…` against the 16-goal checklist + 8 special-focus items. Verdict: **PASS WITH REQUIRED EDITS**. Four required edits:

- **RE-1 — §4 `src/config.js`:** Replace "required-env scan against the 9 RUNTIME-DESIGN §8 vars" with "required-env scan against the 8 baseline required vars from RUNTIME-DESIGN §8, with `DRY_RUN_LOG_PATH` required only when `RELAY_MODE=dry_run`." (Canonical citation: RUNTIME-DESIGN §8 line 372.)

- **RE-2 — §4 `src/config.js`:** Add explicit commitment that "implementation must encode every canonical RUNTIME-DESIGN §9 forbidden-env entry exactly, including the heuristic credential catch-all." (Canonical citation: RUNTIME-DESIGN §9 lines 391–415.)

- **RE-3 — §5 / §7 `src/log.js`:** Replace "`safeLog` is operator-decision-pending" with "Phase C ships `safeLog` or equivalent value-pattern redaction covering forbidden-content patterns; it is mandatory for all logger calls in later phases." (Canonical citation: RUNTIME-DESIGN §16 lines 827–831.)

- **RE-4 — §6 `schemas/hermes-message.schema.json`:** Replace "regex pattern matches ISO-8601 — recommended" with "Canonical schema keeps `format: date-time` unless a separate canonical design update approves regex replacement; no Phase C dependency is added." (Canonical citation: RUNTIME-DESIGN §12 lines 589–605; B-DEPS-DESIGN §5 lines 122–127.)

All other 12 of 16 goals + 6 of 8 special-focus items: PASS or CONFIRMED.

### Round 2 — PASS

Codex re-review (same thread, `--resume`) verified all four required edits applied verbatim:
- Goal 1 (RE-1 applied): CONFIRMED.
- Goal 2 (RE-2 applied): CONFIRMED.
- Goal 3 (RE-3 applied): CONFIRMED.
- Goal 4 (RE-4 applied): CONFIRMED.
- Goal 5 (no new dep): CONFIRMED.
- Goal 6 (scope unchanged): CONFIRMED.
- Goal 7 (no Discord client / publish path / halt state machine / message store / tests / Docker / Railway / CI in Phase C): CONFIRMED.
- Goal 8 (no file/git mutation during revised DESIGN-ONLY phase): CONFIRMED — HEAD `5f2fc810…` unchanged; `git status --short` shows only `?? position.json.snap.20260502T020154Z`.

**Round-2 overall verdict: PASS.** No required edits. The design is now clear for codification (this current `…-C-CONFIG-DESIGN-SPEC` phase) and downstream Phase C opening.

---

## §19 — Authorization scope (explicit non-authorizations preserved)

This persisted codification phase **does NOT authorize** any of the following:

- Opening Phase C implementation (`COMM-HUB-RELAY-RUNTIME-IMPLEMENT-C-CONFIG`).
- Drafting Phase C source code (`src/config.js`, `src/log.js`, `schemas/hermes-message.schema.json`).
- Running `npm install`, `npm ci`, or any other npm command in any working tree.
- Cloning, writing, committing, or pushing to `relentlessvic/agent-avila-relay`.
- Adding any new dependency beyond `ajv` and `pino` already in the Phase B lockfile (in particular, `ajv-formats` is NOT authorized).
- Any source code, Dockerfile, Railway config, CI workflows, tests, schemas (beyond the canonical Phase C JSON Schema), Discord client, publish path, halt-on-anomaly state machine, message-store / publish-log directory contents in either repo.
- Any Railway action; any deploy; any GitHub-tracked deploy trigger.
- Any Discord application / bot / token / permission / webhook / post action.
- Stage 5 install resumption (Steps 14–21 remain deferred; Stage 5 Gate-10 install approval at `40f3137e842cd60acf1adf17ecc7fe2f0b1b8935` remains CONSUMED).
- Stage 7 dry-run; Stages 8 / 9 / 10a / 10b auto-publish activation.
- Any DB / Kraken / env / `MANUAL_LIVE_ARMED` / production action.
- DASH-6 smoke run; D-5.12f first-live-exercise; Migration 009+; autopilot Loop B/C/D activation; CEILING-PAUSE break.
- External Hermes Agent (Nous / OpenRouter) installation, integration, or use.
- Memory-file edit; test-suite edit.
- Modification of any other safety-policy doc, canonical Relay handoff record, runtime / migration / script / deploy file in the parent repo.
- Any phase-mode promotion. Approvers remain `{Victor}`.
- pino v9 → v10 migration.

**Preservation invariant:** Migration 008 APPLIED at `189eb1be6ef6304d914671bdaedec44d389cf877`; N-3 CLOSED; Stage 5 Gate-10 install approval at `40f3137e842cd60acf1adf17ecc7fe2f0b1b8935` CONSUMED; Phase A `COMM-HUB-RELAY-RUNTIME-IMPLEMENT-A-BOOTSTRAP` CLOSED at Relay-repo first-root commit `fcfec4882ac9fbb7fab1946bd3b9677ea9a211cf`; Phase A closeout CLOSED at parent-repo `1b20628ed280323c6b249c1e5d617ad17ea5a026`; B-DEPS-DESIGN-SPEC CLOSED at parent-repo `2b9144fc2536991a8966526ec28042b2bbe5ac5b`; Phase B `COMM-HUB-RELAY-RUNTIME-IMPLEMENT-B-DEPS` CLOSED at Relay-repo `f87faef99600335a7db47ac1bffa92a499e54acb`; Phase B closeout CLOSED at parent-repo `5f2fc810c1b4c77607e8aa8ac40fe61fa32ed269`; Relay-runtime effectively DORMANT (Phases A + B added only non-executable scaffolding + dependency manifest; no executable code; no Discord client; no posting capability); Autopilot DORMANT (verified at `eff4dd22b9b9af038c7ae45de301e60b3f45af98`); CEILING-PAUSE history (broken via `ARC-8-UNPAUSE` at `22ba4a7663e22df64b7cc8e3c0324cbffc0e28f6`; phase-loop counter 0 of 3); approvers exactly `{Victor}`; no live trading authorized.

---

## What this document is NOT

- **Not authorization to open `COMM-HUB-RELAY-RUNTIME-IMPLEMENT-C-CONFIG`.** Opening the implementation phase is a separate operator-approved RED-tier action.
- **Not authorization to draft `src/config.js`, `src/log.js`, or `schemas/hermes-message.schema.json` content.** Drafting is the first step of Phase C itself.
- **Not authorization to run `npm install` / `npm ci` / any npm command.** All package-manager operations are operator-manual on Victor's local machine.
- **Not authorization to clone, write, commit, or push to `relentlessvic/agent-avila-relay`.** Claude has no GitHub authority for that repo.
- **Not authorization to add `ajv-formats`** (would re-open Phase B).
- **Not authorization to install Relay further, register Discord applications, mint or rotate tokens, invite the bot, grant additional permissions, install webhooks / schedulers / MCP triggers / cron jobs / Ruflo / background automation, post to Discord, run a Stage 7 dry-run, take a production action, take a trading action, or break CEILING-PAUSE.**
- **Not canonical over `orchestrator/handoffs/COMM-HUB-RELAY-RUNTIME-DESIGN.md`** (especially §8/§9/§12/§15/§16); if this record diverges, the runtime design wins.
- **Not canonical over `orchestrator/handoffs/COMM-HUB-RELAY-RUNTIME-IMPLEMENT-DESIGN.md`** (Phase A through Phase H build-sequence).
- **Not canonical over `orchestrator/handoffs/COMM-HUB-RELAY-RUNTIME-IMPLEMENT-B-DEPS-DESIGN.md`**.
- **Not canonical over `orchestrator/COMM-HUB-RELAY-RULES.md`, `orchestrator/COMM-HUB-RULES.md`, `orchestrator/handoffs/COMM-HUB-CHANNEL-LAYOUT.md`, `orchestrator/AUTOMATION-PERMISSIONS.md`, `orchestrator/APPROVAL-GATES.md`, `orchestrator/PHASE-MODES.md`, `orchestrator/PROTECTED-FILES.md`, `orchestrator/HANDOFF-RULES.md`, `orchestrator/ROLE-HIERARCHY.md`, `orchestrator/AUTOPILOT-RULES.md`, or `CLAUDE.md`.** Canonical files win on divergence.

**This codification phase (`COMM-HUB-RELAY-RUNTIME-IMPLEMENT-C-CONFIG-DESIGN-SPEC`) is DOCS-ONLY (Mode 3) and persists the source-design report (with all four Codex round-1 required edits applied verbatim and Codex round-2 final PASS). The implementation phase remains gated behind explicit Victor in-session approval; Phase C scope remains exactly `src/config.js` + `src/log.js` + `schemas/hermes-message.schema.json` in `relentlessvic/agent-avila-relay`; Stage 5 Gate-10 install approval at `40f3137e842cd60acf1adf17ecc7fe2f0b1b8935` remains CONSUMED; Relay shelved; CEILING-PAUSE history preserved; Autopilot DORMANT preserved; Migration 008 APPLIED preserved; N-3 CLOSED preserved; approvers exactly `{Victor}` preserved.**
