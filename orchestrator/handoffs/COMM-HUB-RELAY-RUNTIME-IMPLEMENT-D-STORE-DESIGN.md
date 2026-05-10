# COMM-HUB-RELAY-RUNTIME-IMPLEMENT-D-STORE-DESIGN

**Phase identity:** `COMM-HUB-RELAY-RUNTIME-IMPLEMENT-D-STORE`
**Phase mode (future):** SAFE IMPLEMENTATION (Mode 4)
**Source-design phase:** `COMM-HUB-RELAY-RUNTIME-IMPLEMENT-D-STORE-DESIGN` (Mode 2 / DESIGN-ONLY conversation)
**Source-design HEAD anchor:** `7e0d227d843a58c5f851164485439cb17ae2632b` (parent repo)
**Relay-repo Phase C anchor:** `413a4fbeef65ca0d1fb03454d9993af6360d3ac4` (`relentlessvic/agent-avila-relay`)
**Codification phase:** `COMM-HUB-RELAY-RUNTIME-IMPLEMENT-D-STORE-DESIGN-SPEC` (DOCS-ONLY / Mode 3)

This document persists the Codex-PASS revised Phase D-STORE design as a SAFE-class handoff record. All seven Codex round-1 required edits (RE-1 through RE-7) are applied verbatim. The document is NOT approval to open Phase D, NOT source code, NOT a network-touch, NOT a deploy.

---

## §0 — Phase classification & pre-flight verification

| Property | Value |
|---|---|
| Phase name | `COMM-HUB-RELAY-RUNTIME-IMPLEMENT-D-STORE` |
| Future phase mode | SAFE IMPLEMENTATION (Mode 4) |
| Predecessor (Relay repo) | Phase C `COMM-HUB-RELAY-RUNTIME-IMPLEMENT-C-CONFIG` at `413a4fbeef65ca0d1fb03454d9993af6360d3ac4` |
| Predecessor (parent repo) | C-CONFIG-CLOSEOUT at `7e0d227d843a58c5f851164485439cb17ae2632b` |
| Successor (lettered phase) | Phase E-VERIFY (per canonical 8-phase A→H sequence) |
| First HIGH-RISK phase | Phase G-GATEWAY (introduces Discord network behavior) |
| Working tree at design time | clean except `position.json.snap.20260502T020154Z` (untracked carve-out) |

**Codex review history (source design phase):**
- Round-1 DESIGN-ONLY review: PASS WITH REQUIRED EDITS (7 required edits issued).
- All 7 required edits applied conversation-only.
- Round-2 narrow re-review: overall PASS across all 8 verification goals; no regressions; working-tree integrity preserved.

---

## §1 — Recommended Phase D name

`COMM-HUB-RELAY-RUNTIME-IMPLEMENT-D-STORE`

Forward-looking name uses "RELAY" per `CLAUDE.md` naming convention. Historical phase identifiers are preserved verbatim wherever they appear (e.g., `HERMES_VERSION` env var literal, `schemas/hermes-message.schema.json` filename).

---

## §2 — Recommended phase mode

**SAFE IMPLEMENTATION (Mode 4).**

Rationale:
- Phase D introduces **local filesystem code only** (`node:fs/promises` + `node:path`). No network surface.
- Phase D **does not introduce executable behavior at module load** — all logic is encapsulated in exported factories and helpers. Phase F (`src/index.js`) invokes the factories at runtime.
- Phase D **does not** construct a Discord client, send any HTTP request, touch any production database, run any trading code, or read any environment variable that has not already been validated by Phase C.
- Mode 5 HIGH-RISK is reserved for Phase G-GATEWAY (the first phase that introduces Discord network behavior via the gateway IDENTIFY + READY + Send Message API call).

---

## §3 — Exact proposed Phase D scope (RE-1 applied)

**Three files only**, in the `relentlessvic/agent-avila-relay` repo, under the canonical `src/store/` subdirectory:

| Path | Approximate LOC | Purpose |
|---|---|---|
| `src/store/source-of-truth.js` | ~150–200 | Pending/processed directory operations; atomic move; filename validation; permission probes |
| `src/store/publish-log.js` | ~120–170 | Publish-log append-only writer; boot-time integrity scan; idempotency index builder + per-publish refresh |
| `src/store/dry-run-log.js` | ~80–120 | Dry-run-log append-only writer; boot-time integrity scan |

**RE-1 application:** the original conversation-only DESIGN proposed a flat 2-file scope (`src/store.js` + `src/publishLog.js`). Codex round-1 challenged this against the canonical IMPLEMENT-DESIGN file-path scheme, which names the canonical D-STORE files under `src/store/`. The corrected 3-file scope under `src/store/` is the canonical layout.

The publish-log and dry-run-log writers are kept as **separate modules** despite sharing JSONL/O_APPEND structure. The canonical layout has authority over the local DRY consideration. Any shared helper (e.g., a private `appendJsonLine(filehandle, obj)` function) lives inside whichever module first needs it; cross-module sharing is a future refactor outside Phase D scope.

**Out of scope (deferred to later lettered phases):**
- Schema validation → Phase E-VERIFY
- Per-message 11-gate pipeline → Phase F-HALT
- Halt-on-anomaly state machine wiring → Phase F-HALT
- CEILING-PAUSE signal-file consumption → Phase F-HALT or G-GATEWAY
- Discord gateway/client construction → Phase G-GATEWAY (FIRST HIGH-RISK)
- Send Message API call + egress allowlist hook → Phase G-GATEWAY
- Boot orchestration / `src/index.js` → Phase F-HALT or G-GATEWAY
- Dockerfile / Railway config / CI / tests → Phase H-DOCKER
- Modification of any Phase C-sealed file (`src/config.js`, `src/log.js`, `schemas/hermes-message.schema.json`) — **no exceptions**

---

## §4 — `src/store/source-of-truth.js` design

### Exports

```
export function createMessageStore({ messageStorePath, safeLog })
  → { listPending, readPending, moveToProcessed, validatePendingFilename, ensureDirectoryLayout }

export const PENDING_FILENAME_PATTERN  // RegExp
export class StoreError extends Error  // { haltClass, path, reason }
```

### Method semantics

- `listPending()` → `Promise<string[]>`: returns lexically-sorted filenames in `pending/` matching `PENDING_FILENAME_PATTERN`. Filenames not matching the pattern are filtered out and logged as warnings via the injected `safeLog` (not halt-triggering — defense against operator-side dotfiles, README, etc.).
- `readPending(filename)` → `Promise<{ raw: string, parsed: object }>`: reads + JSON-parses one pending file. Halts (canonical halt class **24 — Source-of-truth message store unreadable / unmounted**) if unreadable, not JSON, or filename fails `PENDING_FILENAME_PATTERN`.
- `moveToProcessed(filename)` → `Promise<void>`: `fs.rename(pending/<file>, processed/<file>)`. Atomic within same filesystem. Halts (canonical halt class 24) if rename fails (`EXDEV`, permissions, race, etc.).
- `validatePendingFilename(filename)` → `boolean`: pure regex check, no fs call.
- `ensureDirectoryLayout()` → `Promise<void>`: at boot, verifies `pending/` and `processed/` exist + are directories + Relay process has the canonical §11 permission set. Does **NOT** mkdir (operator-managed; halt class 24 if missing). The canonical §11 NO-WRITE-ON-PENDING invariant means this method does NOT write into `pending/` (RE-2 applied; see §7).

### Pending-filename pattern (Phase D hardening — RE-7 applied)

```
^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}-[0-9]{2}-[0-9]{2}Z-[A-Za-z0-9_-]{1,32}\.json$
```

Matches `2026-05-06T10-30-00Z-msg-001.json`. ASCII-only; no path traversal; no shell metacharacters; bounded length. **This regex is a Phase D hardening policy, not canonical §11 text** — canonical §11 illustrates with `2026-05-06T10-30-00Z-msg-001.json` but does not enumerate the exact regex.

---

## §5 — `src/store/publish-log.js` design

### Exports

```
export function createPublishLogWriter({ publishLogPath, hermesVersion, safeLog })
  → { append, buildIdempotencyIndex, ensureLogIntegrity }

export class PublishLogError extends Error  // { haltClass, path, reason }
```

### Method semantics

- `ensureLogIntegrity()` → `Promise<void>`: at boot, reads the entire publish log; streams line-by-line; `JSON.parse` each line; halts (canonical halt class **25 — Publish log unverifiable**) on parse error or I/O error. Halts (canonical halt class 25) if the log file is missing — auto-create is NOT canonical (DP-6 upheld; matches §14 "publish log unverifiable").
- `buildIdempotencyIndex()` → `Promise<Map<message_id, outcome>>`: returns an in-memory index built from the current publish-log contents. **Per canonical §14, this MUST be invoked immediately before each publish attempt** (not only at boot). The boot-time read seeds a cache; Phase F's gate-5 idempotency check refreshes the cache per publish (RE-3 applied; see below). Phase D-STORE exposes `buildIdempotencyIndex` as a callable; Phase F selects the refresh discipline (e.g., re-read if log file size + mtime changed since last refresh; otherwise reuse cached index).
- `append(record)` → `Promise<void>`: writes one JSONL record to the publish log. File opened with `fs.open(publishLogPath, 'a')` (POSIX `O_APPEND`); written via `fileHandle.write(JSON.stringify(record) + '\n')`; closed. Open mode is `'a'` only — never `'r+'`, `'w'`, `'w+'`. Never seek. Never truncate. Halts (canonical halt class 25) on any write error.

### Publish-log entry shape (per canonical §14)

```json
{"message_id": "...", "channel_id": "...", "outcome": "success" | "halt:<halt-class>", "timestamp": "...", "process_pid": ..., "hermes_version": "..."}
```

### Idempotency semantics (RE-3 applied)

- **Per-publish refresh (canonical §14):** Phase F's gate-5 idempotency check MUST refresh the in-memory `Map<message_id, outcome>` immediately before each publish attempt. Boot-only build is a **cache** only.
- **Strict halt on duplicate prior success — never silent dedupe:** if the current message's `message_id` exists in the refreshed index with `outcome=success`, halt (canonical halt class 25; or a §15-aligned class for "idempotency: duplicate publish attempt" if §15 enumerates one separately — Phase D records the requirement; Phase F selects the halt-class binding per its scope).
- **Last-write-wins for duplicate non-success outcomes:** if the same `message_id` appears multiple times with `outcome=halt:<halt-class>` (e.g., a halt was followed by an operator-renamed retry that itself halted), the index records the last-seen outcome. Duplicate `outcome=success` entries should never occur — the refresh-before-publish discipline prevents them.

### What `publish-log.js` does NOT cover

- The dry-run log has no idempotency role and is not consulted by gate-5 (canonical §17 separation).
- The publish log is NOT consulted by `src/store/dry-run-log.js` for any purpose.

---

## §6 — `src/store/dry-run-log.js` design (RE-6 applied)

### Exports

```
export function createDryRunLogWriter({ dryRunLogPath, hermesVersion, safeLog })
  → { append, ensureLogIntegrity }

export class DryRunLogError extends Error  // { haltClass, path, reason }
```

### Method semantics

- `ensureLogIntegrity()` → `Promise<void>`: at boot, reads the entire dry-run log; streams line-by-line; `JSON.parse` each line; halts (canonical halt class 25 — treating dry-run-log integrity as publish-log infrastructure for halt-class purposes; both logs are operator-audit-critical) on parse error or I/O error.
- `append(record)` → `Promise<void>`: writes one JSONL record to the dry-run log. Same `O_APPEND`-only discipline as `publish-log.js`. Halts (canonical halt class 25) on any write error.

### Dry-run-log entry shape (per canonical §17 — RE-6 applied)

```json
{"message_id": "...", "channel_id": "...", "would_have_published_at": "...", "body": "<verbatim-message-body>", "process_pid": ..., "hermes_version": "..."}
```

**Body redaction is NOT applied** — canonical §17 records the full message body for audit purposes (per `dryrun_log.append({ ...message, would_have_published_at: now() })` semantics). The conversation-only DESIGN originally proposed `safeLog`-style value-pattern redaction of the body before stringify; Codex round-1 RE-6 pushed back that redaction would change canonical §17 audit fidelity without a canonical basis. **Default Phase D design records the full body verbatim.**

If a future operator decision determines that body-level value-pattern redaction is necessary, it requires a separate canonical §17 amendment (a DOCS-ONLY phase) opened first; Phase D-STORE-DESIGN-SPEC could then be amended to include redaction in `dry-run-log.js`. The amendment is NOT authorized by the current Phase D-STORE-DESIGN-SPEC.

### Defense-in-depth note

The message body has already been validated by Phase F gate-10 (forbidden-content scan) before reaching `dry-run-log.js`'s `append`. The body is therefore expected to be clean by construction. Phase D's role is durable persistence of the audit record, not additional content filtering.

---

## §7 — Atomic-move discipline (RE-2 applied)

### Canonical §11 invariant

`fs.rename` is POSIX-atomic within the same filesystem. **Canonical RUNTIME-DESIGN §11 gives the Relay process user no write access in `pending/`** — only Read and Move (rename within filesystem). Phase D code MUST honor this invariant.

### What Phase D does NOT do

The conversation-only DESIGN originally proposed a boot-time `EXDEV` probe via a sentinel file written into `pending/`. **Codex round-1 RE-2 rejected this** because the probe would require write access to `pending/`, directly conflicting with §11's NO-WRITE-ON-PENDING rule.

**Phase D performs no write into `pending/` under any circumstance.** There is no boot-time sentinel-write probe. There is no temp-file in `pending/`. `ensureDirectoryLayout()` does NOT mkdir, does NOT touch, and does NOT write probe files.

### Atomicity is enforced by

- **Deployment invariant** — the operator provisions `pending/` and `processed/` as sibling directories under the same `$MESSAGE_STORE_PATH` root on the same filesystem mount. This is a deployment-runbook requirement, not a Phase D code-level check.
- **Halt-on-real-failure** — at first real `moveToProcessed(filename)` call, if `fs.rename` returns `EXDEV` (or any other rename failure: permissions, target already exists, etc.), Relay halts with canonical halt class **24 — Source-of-truth message store unreadable / unmounted**, and the operator must repair the deployment (e.g., remount filesystems, fix permissions) before Relay can resume.

### Phase D's allowed write surfaces

| Path | Phase D access | Mechanism |
|---|---|---|
| `$MESSAGE_STORE_PATH/pending/` | Read + Move out (rename) | `fs.rename` (move target only) — never write into |
| `$MESSAGE_STORE_PATH/processed/` | Move in (rename target) | `fs.rename` (move target) |
| `$PUBLISH_LOG_PATH` | Append-only | `fs.open(path, 'a')` + `fileHandle.write(...)` |
| `$DRY_RUN_LOG_PATH` | Append-only | `fs.open(path, 'a')` + `fileHandle.write(...)` |

No other paths are written by Phase D code.

---

## §8 — Halt-class mapping (RE-4 applied; canonical §15 verbatim)

**Phase D adds zero new halt classes.** All Phase D storage-layer failures map to existing canonical RUNTIME-DESIGN §15 halt-class IDs:

| Canonical ID | Canonical name | Phase D failure conditions mapped here |
|---|---|---|
| 22 | Filesystem isolation violation | n/a — Phase D doesn't write outside its allowed scope (see §7) |
| 23 | Network allowlist hook bypass | n/a — Phase D has no network surface |
| **24** | **Source-of-truth message store unreadable / unmounted** | `pending/` or `processed/` missing / not a directory / wrong perms; `fs.rename` returns `EXDEV` or any other rename failure; pending file unreadable; pending file is not valid JSON |
| **25** | **Publish log unverifiable** | publish log missing at boot; unreadable; non-JSON line; publish-log append fails; dry-run-log append fails (treated as publish-log infrastructure failure for halt-class purposes — both logs are operator-audit-critical) |
| 26 | Schema validation library missing | n/a — Phase E concern |
| **27** | **Process privilege violation** | DP-5 surplus-permissions detection (Phase D hardening; see §10) |

**RE-4 application:** the conversation-only DESIGN originally proposed new halt classes 22 (`STORE_DIRECTORY_INIT_FAILURE`), 23 (`STORE_PENDING_FILE_UNREADABLE`), 24 (`STORE_ATOMIC_MOVE_FAILURE`), 25 (`PUBLISH_LOG_CORRUPT`), 26 (`PUBLISH_LOG_APPEND_FAILURE`), 27 (`DRY_RUN_LOG_APPEND_FAILURE`). Codex round-1 RE-4 rejected these because IDs 22–27 are already canonically reserved in §15 for unrelated meanings (Filesystem isolation violation; Network allowlist hook bypass; Source-of-truth unreadable; Publish log unverifiable; Schema validation library missing; Process privilege violation). The Phase D failure conditions map to canonical 24/25/27 where applicable; **no new halt classes are introduced**.

If a Phase D storage failure is identified that does not naturally map to canonical 24/25/27, Phase D-STORE-DESIGN-SPEC must NOT silently extend §15. A separate canonical-update phase (e.g., `COMM-HUB-RELAY-RUNTIME-DESIGN-§15-EXTENSION`) must be opened first to amend the canonical 28-class list before Phase D references the new ID.

---

## §9 — `safeLog` integration & Phase C sealing (RE-5 applied)

### Phase D consumes the existing `safeLog` export from `src/log.js`

`safeLog` is already exported from Phase C `src/log.js` (Phase C RE-3 made it mandatory for all logger emissions in Phases C–H). Phase D modules:
1. Receive `safeLog` as an injected dependency in their factory function (`createMessageStore({ messageStorePath, safeLog })`, etc.).
2. Use `safeLog(level, payload, logger)` for any log emission inside Phase D code (e.g., warning when `listPending()` filters a non-matching filename).

### `src/log.js` is NOT modified by Phase D

The conversation-only DESIGN originally proposed exporting the (currently non-exported) `redactPayload` helper from `src/log.js` for use by `dry-run-log.js`. **Codex round-1 RE-5 rejected this** because Phase C is sealed — no Phase D-driven modification of any Phase C file is authorized.

The `redactPayload` export recommendation is **withdrawn**. Phase D consumes only the existing `safeLog` export from `src/log.js`.

### What if dry-run body redaction becomes necessary

Per RE-6 (§6), the default Phase D design records the full message body verbatim per canonical §17. If a future operator determines body redaction is necessary, the implementation path is:
1. Open a separate canonical §17 amendment (DOCS-ONLY phase) authorizing redaction.
2. Phase D-STORE-DESIGN-SPEC is amended to include redaction.
3. The redaction is implemented **inline in `src/store/dry-run-log.js`** (accepting the DRY trade-off vs `src/log.js` re-export), preserving Phase C sealing.

This path is NOT authorized by the current Phase D-STORE-DESIGN-SPEC.

---

## §10 — Permission semantics (RE-7 applied — canonical vs. Phase D hardening separated)

### Canonical §11 invariants (verbatim from RUNTIME-DESIGN §11)

| Path | Canonical permission |
|---|---|
| `$MESSAGE_STORE_PATH/pending/` | **Read** access only |
| Move | rename within filesystem from `pending/` to `processed/` |
| `$MESSAGE_STORE_PATH/pending/` | **No write** (Phase D code MUST honor this — see §7 RE-2) |
| `$PUBLISH_LOG_PATH` | **Append-only** (write-only-append; never seek/truncate) |
| `$DRY_RUN_LOG_PATH` | **Append-only** (write-only-append; never seek/truncate) |

### Phase D hardening policies (NOT canonical §11 text — labeled as Phase D additions under the halt-on-anomaly principle)

- **DP-5 — halt-on-surplus-permissions** (Phase D hardening): at boot, `ensureDirectoryLayout()` and `ensureLogIntegrity()` probe via `fs.access`; if Relay process user has *more* permissions than canonical §11 specifies (e.g., write access to `pending/`), Relay halts with canonical halt class **27 — Process privilege violation**. This is a Phase D hardening layer derived from the halt-on-anomaly principle, not a canonical §11 requirement.
- **DP-7 — strict pending-filename regex** (Phase D hardening): the pattern `^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}-[0-9]{2}-[0-9]{2}Z-[A-Za-z0-9_-]{1,32}\.json$` is a Phase D hardening policy. Canonical §11 illustrates with `2026-05-06T10-30-00Z-msg-001.json` but does not enumerate the exact regex; Phase D selects this strict ASCII-bounded pattern as a defense-in-depth layer.

---

## §11 — Anti-features preserved (Phase C precedent)

Phase D modules preserve all Phase C anti-feature properties:

| Property | Phase C (sealed) | Phase D (proposed) |
|---|---|---|
| No top-level execution | ✓ | ✓ — exported factories only; no fs/network at module load |
| No `dotenv` | ✓ | ✓ — paths injected by caller (Phase F) |
| No fs writes at module load | ✓ | ✓ — fs only inside exported methods |
| No network reach | ✓ | ✓ — local fs only |
| ES module syntax | ✓ | ✓ |
| Idempotent | ✓ | ✓ — same inputs + same on-disk state ⇒ same output |
| New dependencies | none | none — `node:fs/promises` + `node:path` only (Node built-ins) |
| Phase B lockfile preserved | ✓ | ✓ — `package.json` + `package-lock.json` unchanged |

---

## §12 — What is NOT in Phase D

Explicitly out of Phase D scope:
- No schema validation (Phase E-VERIFY)
- No per-message 11-gate pipeline (Phase F-HALT)
- No halt-state machine wiring beyond enum constants imported from Phase C `HaltClass` (Phase F-HALT)
- No CEILING-PAUSE signal-file consumption (Phase F-HALT or G-GATEWAY)
- No Discord client construction (Phase G-GATEWAY — FIRST HIGH-RISK)
- No Send Message API call (Phase G-GATEWAY)
- No egress allowlist hook (Phase G-GATEWAY)
- No boot orchestration / `src/index.js` (Phase F-HALT or G-GATEWAY)
- No Dockerfile (Phase H-DOCKER)
- No Railway config (Phase H-DOCKER)
- No CI workflows (Phase H-DOCKER)
- No tests (Phase H-DOCKER)
- No new dependency
- No modification of Phase C-sealed files (`src/config.js`, `src/log.js`, `schemas/hermes-message.schema.json`) — **no exceptions**

---

## §13 — Runtime safety boundaries (canonical; preserved by Phase D)

Phase D preserves all 10 canonical runtime safety boundaries:
1. No trading code touched
2. No Kraken API touched
3. No production database touched
4. No `MANUAL_LIVE_ARMED` touched
5. No Railway token touched
6. No GitHub token touched
7. No external Hermes Agent / Nous / OpenRouter touched
8. No Discord read permission used
9. No Discord commands implemented
10. No auto-posting implemented (Phase D has no publish path)

Each boundary is **vacuously preserved** by Phase D because Phase D introduces no executable trading, Discord-network, Discord-read, or external-agent surface; all 10 boundaries remain the design contract for Phases E–H.

---

## §14 — Codex review gates (Phase D)

| Gate | Reviewer | What is reviewed |
|---|---|---|
| Source-design round-1 | Codex (DESIGN-ONLY) | Conversation-only Phase D-STORE design report |
| Source-design round-2 | Codex (DESIGN-ONLY narrow) | Verifies all required edits applied |
| Codification on-disk round-1 | Codex (DOCS-ONLY) | Working-tree diff of this codification commit |
| Implementation on-disk round-1 | Codex (DOCS-ONLY) | Staged Phase D files in Relay repo |
| Implementation on-disk round-N | Codex (DOCS-ONLY narrow) | If any RE issued, verifies fixes |
| Closeout DOCS-ONLY | Codex (DOCS-ONLY) | Parent-repo working-tree diff for D-STORE-CLOSEOUT |

---

## §15 — Victor approval gates (Phase D)

| Gate | Action approved | Status |
|---|---|---|
| Open D-STORE-DESIGN | DESIGN-ONLY conversation | (consumed) |
| Open D-STORE-DESIGN-SPEC | DOCS-ONLY codification | (consumed at this commit) |
| Open D-STORE | SAFE IMPLEMENTATION drafting | pending |
| Codex on-disk D-STORE PASS | open commit-only approval | pending |
| Commit-only D-STORE | 3-file Relay-repo commit | pending |
| Push D-STORE | push to Relay `origin/main` | pending |
| Open D-STORE-CLOSEOUT | DOCS-ONLY closeout | pending |
| Commit-only D-STORE-CLOSEOUT | parent-repo 3-file commit | pending |
| Push D-STORE-CLOSEOUT | push to parent `origin/main` | pending |

Approvers exactly `{Victor}`. No exception.

---

## §16 — Implementation order (recommended)

1. **`src/store/source-of-truth.js`** first — foundational; no dependency on other Phase D files.
2. **`src/store/publish-log.js`** second — depends on Phase C `safeLog`; sets up the idempotency-index discipline that Phase F's gate-5 will consume.
3. **`src/store/dry-run-log.js`** third — mirrors `publish-log.js` writer discipline.
4. **Optional smoke checks** at draft time:
   - `node -e "import('./src/store/source-of-truth.js').then(m => console.log(Object.keys(m)))"` — verifies module loads + exports parse.
   - Same for the other two files.
   - These smoke checks are operator-manual; Claude does not run `node` against the Relay repo.

---

## §17 — Rollback plan

If Phase D is committed to the Relay repo and a defect is discovered post-merge:
1. Operator-manual `git revert <Phase-D-SHA>` on the Relay repo (`relentlessvic/agent-avila-relay`).
2. Operator-manual `git push origin main` of the revert.
3. Parent-repo `D-STORE-CLOSEOUT-ROLLBACK` (a new DOCS-ONLY phase) records:
   - The original Phase D SHA being reverted.
   - The revert SHA.
   - The defect that triggered the rollback.
   - Three-way SHA consistency PASS post-revert-push.
4. The `D-STORE-CLOSEOUT-ROLLBACK` phase becomes the closeout-of-closeout for `D-STORE-CLOSEOUT`.

Phase D files are pure-function, no-side-effect modules. A revert removes them entirely; subsequent phases (E-VERIFY, F-HALT, etc.) cannot proceed until Phase D is re-implemented under a new lettered phase.

---

## §18 — What is NOT authorized

`COMM-HUB-RELAY-RUNTIME-IMPLEMENT-D-STORE-DESIGN-SPEC` (this codification phase) does NOT authorize:

- Opening `COMM-HUB-RELAY-RUNTIME-IMPLEMENT-D-STORE` (the future SAFE IMPLEMENTATION)
- Drafting Phase D source code (DESIGN-SPEC produces no source code)
- Any `npm install` / `npm ci`
- Any clone / write / commit / push to `relentlessvic/agent-avila-relay`
- Adding any new dependency
- Any source code beyond `src/store/source-of-truth.js` + `src/store/publish-log.js` + `src/store/dry-run-log.js`
- Modifying `src/config.js` / `src/log.js` / `schemas/hermes-message.schema.json` (Phase C-sealed) — **no exceptions**
- Any Dockerfile / Railway config / CI workflows / tests / additional schemas / Discord client / publish path / halt state machine wiring beyond enum constants imported from Phase C
- Any Railway action / deploy
- Any Discord application / bot / token / permission / webhook / post action
- Stage 5 install resumption (Steps 14–21 remain deferred; Stage 5 Gate-10 install approval at `40f3137e842cd60acf1adf17ecc7fe2f0b1b8935` remains CONSUMED)
- Stage 7 dry-run execution
- Stages 8 / 9 / 10a / 10b auto-publish activation
- DB / Kraken / env / `MANUAL_LIVE_ARMED` / production action
- Live trading
- DASH-6 smoke run
- D-5.12f first-live-exercise
- Migration 009+
- Autopilot Loop B/C/D activation
- CEILING-PAUSE break
- External Hermes Agent (Nous / OpenRouter) installation, integration, or use
- Memory-file edit
- Test-suite edit
- Modification of any other safety-policy doc / canonical Relay handoff record / runtime / migration / script / deploy file
- Auto-creation of any missing storage path (operator provisions; Phase D halts if absent)
- Body-level redaction of dry-run-log entries (canonical §17 amendment required first)

---

## §19 — Codex review packet (questions of record)

### Round-1 14-goal DESIGN-ONLY checklist (verbatim, for record)

1. Future mode SAFE IMPLEMENTATION (Mode 4) is correct
2. Scope is limited to storage layer only
3. Proposed files are appropriate
4. No Discord client / publish path / halt-state machine / schema validator / tests / Docker / Railway / CI in Phase D
5. No new npm dependency required
6. Atomic `pending/ → processed/` move design is safe
7. Append-only publish-log + dry-run-log design is safe
8. Boot-time idempotency index design is safe
9. Permission model is safe
10. DP-6 halt-on-missing-publish-log is correct
11. Strict pending-filename pattern is safe
12. DP-3 `redactPayload` export decision
13. Halt class IDs 22-27 alignment
14. Non-authorizations + preservation invariants intact

### Round-2 8-goal narrow DESIGN-ONLY checklist (verbatim, for record)

1. RE-1 applied (3-file scope)
2. RE-2 applied (no `pending/` write)
3. RE-3 applied (per-publish refresh)
4. RE-4 applied (canonical §15 IDs; zero new)
5. RE-5 applied (no `redactPayload` export)
6. RE-6 applied (full dry-run body)
7. RE-7 applied (hardening labels)
8. No working-tree changes

---

## §20 — Verdict (source design phase)

| Round | Verdict | Notes |
|---|---|---|
| Round-1 DESIGN-ONLY | PASS WITH REQUIRED EDITS | 7 RE issued (RE-1 through RE-7) |
| Round-2 narrow DESIGN-ONLY | PASS | 8 of 8 verification goals; no regressions |

**Operator pre-accepted DP-1 through DP-7 defaults at design submission.** Codex challenged 6 of 7 of those defaults adversarially:
- DP-1 (2 files): CHALLENGED → 3 files per RE-1
- DP-2 (dry-run body redaction): CHALLENGED → removed per RE-6
- DP-3 (re-export `redactPayload`): CHALLENGED + REJECTED → withdrawn per RE-5
- DP-4 (IDs 22-27 pending alignment): CHALLENGED → canonical §15 mapping per RE-4
- DP-5 (halt on surplus permissions): UPHELD WITH EDIT → labeled as Phase D policy per RE-7
- DP-6 (halt on missing publish log): UPHELD → confirmed canonical halt class 25
- DP-7 (strict filename regex): UPHELD WITH EDIT → labeled as Phase D policy per RE-7

All 7 required edits applied conversation-only verbatim before round-2.

---

## §21 — Codex review history

### Round-1 verbatim required edits

1. **§3** — Replace 2-file proposal with canonical 3-file scope: `src/store/source-of-truth.js`, `src/store/publish-log.js`, `src/store/dry-run-log.js`.
2. **§6** — Remove EXDEV sentinel-write into `pending/`. Probe must not violate §11's no-write-on-pending rule.
3. **§8** — Revise idempotency to per-publish refresh (canonical §14); duplicate-success must halt, not silently dedupe.
4. **§9** — Discard proposed IDs 22-27. Map to canonical §15: 22 = Filesystem isolation violation; 23 = Network allowlist hook bypass; 24 = Source-of-truth message store unreadable/unmounted; 25 = Publish log unverifiable; 26 = Schema validation library missing; 27 = Process privilege violation.
5. **§10 / §13** — Do not add `redactPayload` export to `src/log.js` (Phase C-sealed). Consume existing `safeLog`; or implement inline in `dry-run-log.js`.
6. **§7** — Canonical §17 records the full message in dry-run log for audit. Redacting `body` changes §17 semantics.
7. **§11** — Label halt-on-surplus-permissions and strict filename regex as Phase D hardening policy.

### Round-2 verbatim PASS verdicts

1. PASS — RE-1's three-file D-STORE scope matches canonical IMPLEMENT-DESIGN.
2. PASS — RE-2 removes the invalid `pending/` sentinel write.
3. PASS — RE-3 aligns with canonical §14 per-publish refresh.
4. PASS — RE-4 correctly maps to canonical §15; zero new halt classes.
5. PASS — RE-5 closes the Phase C scope leak.
6. PASS — RE-6 aligns with canonical §17 full-message dry-run record.
7. PASS — RE-7 correctly labels surplus-permission and strict-filename behavior as Phase D hardening.
8. PASS — Working tree unchanged.

**Overall round-2 verdict: PASS.**

---

## §22 — Authorization scope (explicit non-authorizations preserved)

This document (and the codification phase that creates it) preserves the following preserved-state references unchanged:
- Migration 008 APPLIED at `189eb1be6ef6304d914671bdaedec44d389cf877`
- N-3 CLOSED
- Stage 5 Gate-10 install approval at `40f3137e842cd60acf1adf17ecc7fe2f0b1b8935` CONSUMED
- Phase A `COMM-HUB-RELAY-RUNTIME-IMPLEMENT-A-BOOTSTRAP` CLOSED at Relay-repo first-root commit `fcfec4882ac9fbb7fab1946bd3b9677ea9a211cf`
- Phase A closeout `COMM-HUB-RELAY-RUNTIME-IMPLEMENT-A-BOOTSTRAP-CLOSEOUT` CLOSED at parent-repo `1b20628ed280323c6b249c1e5d617ad17ea5a026`
- Phase B-DEPS-DESIGN-SPEC CLOSED at parent-repo `2b9144fc2536991a8966526ec28042b2bbe5ac5b`
- Phase B `COMM-HUB-RELAY-RUNTIME-IMPLEMENT-B-DEPS` CLOSED at Relay-repo `f87faef99600335a7db47ac1bffa92a499e54acb`
- Phase B closeout `COMM-HUB-RELAY-RUNTIME-IMPLEMENT-B-DEPS-CLOSEOUT` CLOSED at parent-repo `5f2fc810c1b4c77607e8aa8ac40fe61fa32ed269`
- Phase C-CONFIG-DESIGN-SPEC CLOSED at parent-repo `491a24f5c3220be38f7faf51fe27497a4b441ac9`
- Phase C `COMM-HUB-RELAY-RUNTIME-IMPLEMENT-C-CONFIG` CLOSED at Relay-repo `413a4fbeef65ca0d1fb03454d9993af6360d3ac4`
- Phase C closeout `COMM-HUB-RELAY-RUNTIME-IMPLEMENT-C-CONFIG-CLOSEOUT` CLOSED at parent-repo `7e0d227d843a58c5f851164485439cb17ae2632b`
- Relay-runtime effectively DORMANT (Phases A + B + C added non-executable scaffolding + dependency manifest + non-executing pure-function modules + JSON Schema only; no Discord client; no publish path; no halt state machine wiring beyond enum constants; no posting capability; no Discord-side state change)
- Autopilot DORMANT (verified at `eff4dd22b9b9af038c7ae45de301e60b3f45af98`)
- CEILING-PAUSE history (broken via `ARC-8-UNPAUSE` at `22ba4a7663e22df64b7cc8e3c0324cbffc0e28f6`; phase-loop counter 0 of 3)
- Approvers exactly `{Victor}`
- `position.json.snap.20260502T020154Z` carve-out preserved untracked

---

## What this document is NOT

- NOT operator approval to open `COMM-HUB-RELAY-RUNTIME-IMPLEMENT-D-STORE`. That requires explicit Victor in-session chat instruction.
- NOT source code. The actual `src/store/*.js` files are drafted only during the future SAFE IMPLEMENTATION phase, under operator approval.
- NOT a network-touch. No HTTP. No Discord. No Railway. No external API.
- NOT a Discord-touch. No bot login. No channel write. No webhook.
- NOT a deploy. No Railway action. No production action.
- NOT authorization to bypass any canonical safety boundary. All 10 runtime safety boundaries remain in effect.
- NOT authorization to modify Phase C-sealed files. **No exceptions.**
- NOT a `safeLog`-bypass mechanism. All Phase D log emissions route through `safeLog`.
- NOT a Discord-side state change. The Relay bot remains a passive member of `Agent Avila Hub` with no posting capability.
- NOT an Autopilot phase-loop counter advance. The counter remains 0 of 3.

This document records design intent and persists it as a SAFE-class handoff record. Any action that consumes this design requires its own subsequent operator-approval phase.
