# Communication Hub — Relay Runtime Implementation Design (template — COMM-HUB)

> **Author rule:** This file persists the conversation-only DESIGN-ONLY report produced by the `COMM-HUB-RELAY-RUNTIME-IMPLEMENT-DESIGN` phase (Mode 2). The design recommends a small first SAFE IMPLEMENTATION (Mode 4) phase named `COMM-HUB-RELAY-RUNTIME-IMPLEMENT-A-BOOTSTRAP` whose scope is exactly three non-executable files (`README.md`, `LICENSE`, `.gitignore`) in the separate operator-controlled GitHub repository `relentlessvic/agent-avila-relay`. **This document is NOT authorization to write Relay runtime code, clone or push to `relentlessvic/agent-avila-relay`, install Relay further, deploy a Relay runtime, register a Discord application, mint a Discord bot token, invite a bot to the server, grant any Discord permission, install a webhook / scheduler / MCP trigger / cron job / Ruflo / background automation, post to Discord, run a Stage 7 dry-run, take a production action, take a trading action, or break CEILING-PAUSE.** Each future phase (this codification, the implementation phase, every lettered sub-phase, and any deployment) requires its own separately-approved phase with its own design / Codex review / Victor approval cascade.
>
> **No Relay runtime, Relay-repo content, Discord bot capability change, webhook, scheduler, MCP trigger, cron job, or background automation is installed by writing this file.**

> **Naming convention.** Active forward-looking wording in this file uses "Relay" per `orchestrator/COMM-HUB-RELAY-RULES.md` "Naming convention" subsection and `CLAUDE.md` "Naming convention — Relay vs. external Hermes Agent" subsection. Historical phase identifiers committed to git history (e.g., `COMM-HUB-DOCS-G-HERMES-RUNTIME-DESIGN-SPEC`, `COMM-HUB-HERMES-INSTALL`, `COMM-HUB-HERMES-DRY-RUN-DESIGN`, `COMM-HUB-HERMES-STAGE5-PARTIAL-INSTALL-RECORD`) are preserved verbatim because they are immutable historical phase identifiers.

Author: Operator-driven manual planning (Claude as orchestrator; future implementation Victor-only)
Last updated: 2026-05-09 (`COMM-HUB-RELAY-RUNTIME-IMPLEMENT-DESIGN-SPEC` — DOCS-ONLY / Mode 3)
Source-design HEAD: `51662f3d1458c07b552ad0fafe0e5632182054e5` (the conversation-only design report produced under `COMM-HUB-RELAY-RUNTIME-IMPLEMENT-DESIGN` Mode 2 at this HEAD; transcribed verbatim into §0–§20 below)

Canonical references:
- `orchestrator/COMM-HUB-RELAY-RULES.md` — canonical Relay specification (SAFE-class)
- `orchestrator/handoffs/COMM-HUB-RELAY-RUNTIME-DESIGN.md` — 1080-line canonical runtime design (§5 language/framework, §6 separate-repo, §8 9 allowed env vars, §9 forbidden env vars, §10 3-layer egress allowlist, §11 file-based message store, §13 11-gate pipeline, §14 idempotency, §15 28 halt classes, §17 dry-run, §18.1/18.2 isolation proofs, §18.6 6-gate authoring sequence)
- `orchestrator/handoffs/COMM-HUB-INSTALL-RELAY-CHECKLIST.md` — Relay Stage 5 install checklist (21-step canonical sequence; Steps 1–13 complete; Steps 14–21 deferred)
- `orchestrator/handoffs/COMM-HUB-RELAY-STAGE5-PRECONDITIONS.md` — Stage 5 preconditions 12–15
- `orchestrator/handoffs/COMM-HUB-HERMES-STAGE5-PARTIAL-INSTALL-RECORD.md` — Stage 5 partial-install record (Steps 1–13 done; Steps 14–21 deferred; CONSUMED Gate-10 install approval at `40f3137e842cd60acf1adf17ecc7fe2f0b1b8935`; 3-step DORMANT-revert)
- `orchestrator/handoffs/COMM-HUB-HERMES-DRY-RUN-DESIGN.md` — Stage 4 dry-run design (19 halt classes; 13 test fixtures)
- `orchestrator/COMM-HUB-RULES.md` — Communication Hub rulebook (parent SAFE-class)
- `orchestrator/handoffs/COMM-HUB-CHANNEL-LAYOUT.md` — channel/role/permission canonical matrix
- `orchestrator/APPROVAL-GATES.md`, `orchestrator/AUTOMATION-PERMISSIONS.md`, `orchestrator/PROTECTED-FILES.md`, `orchestrator/HANDOFF-RULES.md`, `orchestrator/ROLE-HIERARCHY.md`, `orchestrator/PHASE-MODES.md`, `orchestrator/NEXT-ACTION-SELECTOR.md`, `orchestrator/AUTOPILOT-RULES.md`, `CLAUDE.md` — ARC governance docs

If any field below diverges from those canonical files, the canonical files win and this design must be re-aligned in a follow-up DOCS-ONLY phase.

---

## §0 — Phase classification and pre-flight verification

The persisted artifact below is the verbatim DESIGN-ONLY report. The persisted phase (`COMM-HUB-RELAY-RUNTIME-IMPLEMENT-DESIGN-SPEC`) is **DOCS-ONLY (Mode 3)**. Its scope is exactly four files: this new handoff template plus `orchestrator/STATUS.md`, `orchestrator/CHECKLIST.md`, and `orchestrator/NEXT-ACTION.md`. The persisting phase does NOT install Relay, register a Discord application, mint a token, invite a bot, grant a permission, install any automation, post to Discord, take a production action, take a trading action, break CEILING-PAUSE, or open the implementation phase. The implementation phase remains gated behind explicit Victor in-session approval.

Pre-flight verification at the source-design HEAD `51662f3d1458c07b552ad0fafe0e5632182054e5`:

| Check | Expected | Observed | Verdict |
|---|---|---|---|
| `git rev-parse HEAD` | `51662f3d…` | `51662f3d1458c07b552ad0fafe0e5632182054e5` | PASS |
| `git rev-parse origin/main` | `51662f3d…` | `51662f3d1458c07b552ad0fafe0e5632182054e5` | PASS |
| `git ls-remote origin main` | `51662f3d…` | `51662f3d…\trefs/heads/main` | PASS |
| Working tree (at design phase) | clean except `position.json.snap.20260502T020154Z` | only that one untracked snapshot | PASS |

Three-way SHA consistency PASS at design time. Working tree at this codification phase additionally adds the four files in §0's scope.

---

## §1 — Recommended implementation phase name

**`COMM-HUB-RELAY-RUNTIME-IMPLEMENT-A-BOOTSTRAP`**

The trailing `-A-BOOTSTRAP` flags this as the first of an expected lettered sequence (A → B → C …) of small SAFE IMPLEMENTATION phases that together build the full runtime documented in `orchestrator/handoffs/COMM-HUB-RELAY-RUNTIME-DESIGN.md`. Each lettered phase has its own design-only spec, Codex review, and Victor approval cascade. Naming is consistent with the existing DASH-5.A / DASH-5.B / DASH-6.A / DASH-6.B / DASH-6.C / DASH-6.G letter-suffix pattern in this repo.

The active forward-looking phase name uses "RELAY" not "HERMES" per `CLAUDE.md` naming convention. Historical phase identifiers (e.g., `COMM-HUB-DOCS-G-HERMES-RUNTIME-DESIGN-SPEC`, `COMM-HUB-HERMES-INSTALL`) are preserved verbatim because they are immutable.

---

## §2 — Recommended phase mode

**SAFE IMPLEMENTATION (Mode 4 per `orchestrator/PHASE-MODES.md`).**

**Why SAFE, not HIGH-RISK:**
- Phase A produces only **non-executable scaffolding** (`README.md`, `LICENSE`, `.gitignore`) in the **separate** `relentlessvic/agent-avila-relay` repo. No `package.json`, no source code, no Dockerfile, no Railway config, no env vars, no Discord client, no publish path.
- Touches **zero** files in this `relentlessvic/agent-avila` working tree (no `bot.js`, `dashboard.js`, `db.js`, `migrations/**`, `scripts/**`, `position.json`, deploy config, env, secrets, lockfiles, `.nvmrc`).
- Touches **zero** HARD BLOCK files anywhere. The new repo has no HARD BLOCK files defined — the trading-runtime HARD BLOCK list per `orchestrator/PROTECTED-FILES.md` applies to the trading repo, not to a new isolated repo.
- Does not deploy, does not run Railway, does not register a Discord application, does not mint a token, does not invite a bot, does not post to Discord.
- Cannot reach trading systems (no Kraken / DB / `MANUAL_LIVE_ARMED` access, no network egress, no env vars, no executable code).

**Why not lower (DOCS-ONLY):** the phase produces tracked artifacts in a separate code-bearing repository, not orchestrator docs. Mode 3 only covers documentation files in approved orchestrator-doc paths; this phase is functionally an implementation phase even though the artifacts are non-executable today.

**Mode-promotion non-rule:** per `orchestrator/PHASE-MODES.md` ambiguous-mode rule, when in doubt the higher mode wins. SAFE IMPLEMENTATION is intentionally chosen over DOCS-ONLY because subsequent lettered phases (B, C, …) will introduce executable code; keeping the mode label consistent across the lettered sequence simplifies governance.

---

## §3 — Proposed new repo file tree for `relentlessvic/agent-avila-relay`

**Scope of Phase A — 3 files only:**

```
relentlessvic/agent-avila-relay/
├── README.md       (canonical runtime README; cross-references the orchestrator runtime-design spec; non-secret)
├── LICENSE         (operator preference; UNLICENSED / proprietary / MIT — operator decides at draft time)
└── .gitignore      (excludes node_modules/, *.log, *.local, .env, .env.*, /tmp/, /dist/, /coverage/, .DS_Store)
```

**Total Phase A artifacts: 3 files; 0 lines of executable code.**

**Out of Phase A; for later lettered phases (B, C, … — proposed sketch only; not authorized):**

| Phase | Adds | Mode |
|---|---|---|
| B-DEPS | `package.json`, `package-lock.json` (locked minimal deps; forbidden-deps documented; `npm ci --ignore-scripts`-compatible) | SAFE IMPLEMENTATION |
| C-CONFIG | `src/config.js` (env-var validation only; no Discord), `src/log.js` (pino + redaction), `schemas/hermes-message.schema.json` | SAFE IMPLEMENTATION |
| D-STORE | `src/store/source-of-truth.js`, `src/store/publish-log.js`, `src/store/dry-run-log.js` | SAFE IMPLEMENTATION |
| E-VERIFY | `src/verify/*.js` (the 11 gate modules) | SAFE IMPLEMENTATION |
| F-HALT | `src/halt.js`, `src/index.js` (boot path + state machine wiring; no Discord client yet) | SAFE IMPLEMENTATION |
| G-GATEWAY | `src/gateway.js`, `src/publish.js` (Discord client + publish path; dry-run-only initially) | HIGH-RISK IMPLEMENTATION (introduces external network behavior) |
| H-DOCKER | `Dockerfile`, `railway.json`, `tests/`, CI checks | SAFE IMPLEMENTATION |

**Phase G is the first phase that becomes HIGH-RISK** because it introduces Discord network behavior. Phases A–F and H are SAFE because they contain no Discord-reaching code path.

---

## §4 — Minimal first implementation scope (Phase A only)

| Artifact | Content (drafted by Claude in conversation; operator commits manually) |
|---|---|
| `README.md` | One-pager describing what `relentlessvic/agent-avila-relay` is (the future Relay runtime), naming convention (Relay vs external Hermes Agent), DORMANT status, cross-reference to canonical specs in `relentlessvic/agent-avila` (`orchestrator/COMM-HUB-RELAY-RULES.md`, `orchestrator/handoffs/COMM-HUB-RELAY-RUNTIME-DESIGN.md`, `orchestrator/handoffs/COMM-HUB-INSTALL-RELAY-CHECKLIST.md`), explicit "no production action / no deploy / no Discord post / no trading" framing, link to anti-execution boundaries. **Forbidden-content scrub:** no tokens, no env values, no Kraken/DB references, no `MANUAL_LIVE_ARMED`, no `position.json` content, no approval-like language. |
| `LICENSE` | Operator's choice. Recommended default: a private/proprietary license file matching the repo's private visibility (e.g., `UNLICENSED` or operator-drafted proprietary text). Non-blocking. |
| `.gitignore` | Standard Node ignore: `node_modules/`, `npm-debug.log*`, `yarn-debug.log*`, `*.log`, `.env`, `.env.*`, `/tmp/`, `/dist/`, `/coverage/`, `.DS_Store`, `Thumbs.db`. **Critical entries:** `.env`, `.env.*`, `*.local` to forever-block accidental token commits. |

**Method of execution (canonical for this lettered series):**

1. Claude drafts each file's content in conversation as a `<file>` block.
2. Codex runs a docs-only review on the drafted content (forbidden-content scan + cross-reference check + canonical-rule alignment).
3. Victor commits and pushes to `relentlessvic/agent-avila-relay` **manually** (Claude has no GitHub authority for that repo).
4. Victor reports back the resulting Relay-repo HEAD SHA.
5. Claude opens a closeout phase in `relentlessvic/agent-avila` to record the Phase A completion in the orchestrator status docs (closeout is a separate DOCS-ONLY phase with its own Codex review + Victor commit + Victor push approval).

---

## §5 — Explicitly excluded scope (NOT in Phase A)

- **No `package.json`** — deferred to Phase B.
- **No `package-lock.json`** — deferred to Phase B.
- **No source code** of any kind (`src/**`) — deferred to Phases C–F.
- **No `schemas/`** — deferred to Phase C.
- **No `tests/`** — deferred to Phase H.
- **No `Dockerfile`** — deferred to Phase H.
- **No `railway.json`** — deferred to Phase H.
- **No CI configuration** (`.github/workflows/**`, etc.) — deferred to Phase H.
- **No `npm install`** — there's no `package.json` yet.
- **No clone of `relentlessvic/agent-avila-relay` by Claude.** Claude has no GitHub authority there.
- **No Railway service touch.** The `agent-avila-relay` Railway service shell (created during the partial Stage 5 install at `40f3137e842cd60acf1adf17ecc7fe2f0b1b8935`) is not modified.
- **No Discord application / bot / token / permission / webhook / post action.**
- **No deploy of any kind.**
- **No Stage 5 install resumption** (Steps 14–21 still deferred; Stage 5 Gate-10 still CONSUMED).
- **No Stage 7 dry-run.**
- **No env var or secret action.**
- **No `MANUAL_LIVE_ARMED` action.**
- **No `position.json` action.**
- **No DASH-6, no D-5.12f first-live-exercise, no Migration 009+, no autopilot Loop B/C/D activation.**
- **No memory-file edit, no test-suite edit.**

---

## §6 — Runtime safety boundaries (canonical; preserved by Phase A)

Phase A's artifacts contain **zero executable logic**, so these boundaries are vacuously satisfied. They are the design contract that Phases C–H must continue to honor.

| Boundary | State at Phase A end | Source |
|---|---|---|
| No trading | Vacuous (no code) | RUNTIME-DESIGN R7, R8, §18.2 |
| No Kraken | Vacuous (no code, no creds, no network) | RELAY-RULES line 146; RUNTIME-DESIGN §9 |
| No DB | Vacuous (no code, no creds, no network) | RELAY-RULES line 145; RUNTIME-DESIGN §9 |
| No `MANUAL_LIVE_ARMED` | Vacuous (no env access) | RELAY-RULES line 148; RUNTIME-DESIGN §9 |
| No Railway token | Vacuous (no Railway interaction) | RUNTIME-DESIGN §9 |
| No GitHub token | Vacuous (no GitHub interaction) | RUNTIME-DESIGN §9 |
| No external Hermes Agent / Nous / OpenRouter | Vacuous (no LLM SDKs in any future phase; forbidden-deps list in Phase B) | CLAUDE.md naming convention; RUNTIME-DESIGN §5 forbidden-deps |
| No Discord read permission | Vacuous (no Discord client) | RELAY-RULES line 110; RUNTIME-DESIGN §18.1 |
| No Discord commands | Vacuous (no slash commands; OAuth scope `bot` only at install) | INSTALL-RELAY-CHECKLIST step 8 |
| No auto-posting | Vacuous (no publish path) | RELAY-RULES staged path; RUNTIME-DESIGN §17 |

---

## §7 — Environment variable allow-list (canonical for the full runtime; not exercised in Phase A)

Phase A introduces **no env-var dependency**. The canonical 9-var allow-list (per RUNTIME-DESIGN §8) is reproduced here for Phase B/C reference:

| # | Var | Type | Notes |
|---|---|---|---|
| 1 | `DISCORD_BOT_TOKEN` | secret | Already populated in the `agent-avila-relay` Railway service shell from Stage 5 Step 7 |
| 2 | `RELAY_MODE` | non-secret | `production` \| `dry_run`; default at first deploy = `dry_run` |
| 3 | `LOG_LEVEL` | non-secret | `debug` \| `info` \| `warn` \| `error` |
| 4 | `LOG_DESTINATION` | non-secret | `stdout` \| `file:/path` |
| 5 | `MESSAGE_STORE_PATH` | non-secret | absolute path; read-only by Relay |
| 6 | `PUBLISH_LOG_PATH` | non-secret | absolute path; append-only by Relay |
| 7 | `DRY_RUN_LOG_PATH` | non-secret | required when `RELAY_MODE=dry_run`; must differ from `PUBLISH_LOG_PATH` |
| 8 | `CEILING_PAUSE_SIGNAL_PATH` | non-secret | controlled signal file containing `ACTIVE` or `BROKEN` |
| 9 | `HERMES_VERSION` | non-secret | build-time identifier (preserved as canonical literal name in RUNTIME-DESIGN §8; if a future phase chooses to rename, that is its own DOCS-ONLY scope) |

---

## §8 — Environment variable deny-list (canonical; not exercised in Phase A)

Per RUNTIME-DESIGN §9; reproduced for Phase B/C reference. Boot-time Relay process must halt class 20 if any pattern matches. All forbidden:

`DATABASE_URL`, `DATABASE_PUBLIC_URL`, `POSTGRES_*`, `PGUSER`, `PGPASSWORD`, `PGHOST`, `PGPORT`, `PGDATABASE`, `KRAKEN_API_KEY`, `KRAKEN_API_SECRET`, `KRAKEN_*`, `MANUAL_LIVE_ARMED`, `BOT_*`, `DASHBOARD_*`, `GITHUB_TOKEN`, `RAILWAY_TOKEN` (beyond Railway's own self-management vars), `CI`, `CIRCLE_*`, `TRAVIS_*`, `GITHUB_ACTIONS`, `GITLAB_CI`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GOOGLE_API_KEY`, `GEMINI_API_KEY`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `GCP_*`, `GOOGLE_APPLICATION_CREDENTIALS`, `AZURE_*`, `STRIPE_*`, `TWILIO_*`, `SENDGRID_*`, and the heuristic catch-all "any var containing `_KEY`, `_SECRET`, `_PASSWORD`, `_TOKEN` other than `DISCORD_BOT_TOKEN`."

---

## §9 — Network allow-list (canonical; not exercised in Phase A)

Phase A introduces no network surface. The canonical 3-layer Discord-API-only egress per RUNTIME-DESIGN §10 is reproduced for Phase G reference:

- **Allowed:** `gateway.discord.gg`, `discord.com` (REST), DNS resolver, TLS / CA bundle.
- **Forbidden:** Kraken (any subdomain/port), production DB host, Railway control-plane endpoints (beyond service self-management), `api.github.com`/`github.com`, CI/CD endpoints, all other LLM provider endpoints, other Discord servers' webhook URLs, all other internet endpoints.
- **Enforcement layers:** (1) Railway-side firewall / network policy; (2) runtime-side HTTP-client allowlist hook; (3) optional DNS-lookup observation.

---

## §10 — Message-store design (canonical; not exercised in Phase A)

Per RUNTIME-DESIGN §11, file-based append-only directory:

```
$MESSAGE_STORE_PATH/
├── pending/      (operator-written; Relay read-and-move only)
├── processed/    (Relay-moved; Relay never deletes)
└── README.md     (schema description; non-secret)
```

Operator drops JSON-Schema-conformant message files into `pending/`; Relay moves to `processed/` after publish or halt. Filesystem permissions: Relay has read on `pending/`, move-only between `pending/` and `processed/`, no write in `pending/`. Phase D implements; Phase A does not.

---

## §11 — Publish-log design (canonical; not exercised in Phase A)

Per RUNTIME-DESIGN §14:

- `$PUBLISH_LOG_PATH`: append-only JSONL; one record per publish attempt; fields = `message_id`, `channel_id`, `outcome` (`success` | `halt:<class>`), `timestamp`, `process_pid`, `hermes_version`.
- `$DRY_RUN_LOG_PATH`: separate append-only JSONL for `would_have_published` records; never collides with `$PUBLISH_LOG_PATH`.
- `O_APPEND` only (never `O_TRUNC`/`O_RDWR`); append-only at filesystem-permission level.
- Idempotency check: at each pre-publish gate 5, Relay reads the publish log and rejects duplicate `message_id` with prior `outcome=success`. **No Discord-side reads** for deduplication.
- `nonce` field on Send Message API call as Discord-side dedup hint for crash-mid-publish edge case.

Phase D implements; Phase A does not.

---

## §12 — Dry-run behavior (canonical; not exercised in Phase A)

Per RUNTIME-DESIGN §17:

- `RELAY_MODE=dry_run` env var routes the publish branch to `$DRY_RUN_LOG_PATH` instead of Discord Send Message.
- Each message must additionally carry `dry_run: true` flag (defense-in-depth; halt class 12 if absent in dry-run mode).
- All 11 verification gates run identically.
- Halt class 13 fires if dry-run branch is bypassed and the real Send Message path is reached.
- 13 canonical test fixtures (3 sample messages + 10 anomaly-injection cases) are reused from `orchestrator/handoffs/COMM-HUB-HERMES-DRY-RUN-DESIGN.md` §4 for Phase G smoke test and Stage 7 dry-run execution.

Phase G implements; Phase A does not.

---

## §13 — Halt behavior (canonical; not exercised in Phase A)

Per RUNTIME-DESIGN §15: **28 halt classes** in three layers (10 canonical from RELAY-RULES + 9 dry-run-specific + 9 runtime-design-specific). Uniform halt protocol: log to publish-log (or dry-run log) + log to stdout + non-zero exit + Railway no-auto-restart policy + operator-only manual restart. **No auto-resume forever** per RELAY-RULES line 51 + line 149.

Phase F implements the state machine; Phase A does not.

---

## §14 — Test plan

**Phase A test plan (minimal):**
- **No unit tests** — Phase A has no executable code.
- **Codex docs-only review** of drafted `README.md`, `LICENSE`, `.gitignore` content:
  - Forbidden-content scan against `orchestrator/HANDOFF-RULES.md` + `orchestrator/COMM-HUB-RULES.md` patterns (no tokens, no env values, no Kraken/DB references, no `MANUAL_LIVE_ARMED`, no `position.json` content, no approval-like language not from Victor).
  - Cross-reference accuracy (`README.md` correctly cites `orchestrator/COMM-HUB-RELAY-RULES.md`, `orchestrator/handoffs/COMM-HUB-RELAY-RUNTIME-DESIGN.md`, `orchestrator/handoffs/COMM-HUB-INSTALL-RELAY-CHECKLIST.md`).
  - `.gitignore` completeness for the forbidden-deps + secrets patterns.
  - Naming convention compliance (Relay vs external Hermes Agent disambiguation per `CLAUDE.md`).

**Test plan for the full lettered sequence (for context only; not Phase A scope):**

| Phase | Test type |
|---|---|
| B-DEPS | `npm ci --ignore-scripts` succeeds; Codex grep verifies forbidden-deps list per RUNTIME-DESIGN §5 |
| C-CONFIG | Unit tests for env-var validation; injected anomalies verify halt classes 20 & 21 |
| D-STORE | Unit tests for filesystem permissions; injected anomalies verify halt classes 22, 24, 25 |
| E-VERIFY | Unit tests per gate; 13 canonical fixtures replayed |
| F-HALT | State-machine unit tests; halt-class enumeration completeness check |
| G-GATEWAY | Local mock-Discord smoke test (no real Send Message); halt class 13 fixture verifies dry-run path |
| H-DOCKER | Docker build green; Railway build green; CI grep for forbidden-deps holds |

---

## §15 — Codex review gates (Phase A)

Per `orchestrator/PHASE-MODES.md` Mode 4 required-reviews:

| Gate | When | Scope |
|---|---|---|
| Codex design-only review | The `COMM-HUB-RELAY-RUNTIME-IMPLEMENT-DESIGN` phase (Mode 2) — note: Codex round-1 returned procedural FAIL; see §21 below | Verify mode classification, scope minimality, safety-boundary preservation, lettered-sequence soundness; ~12–15 questions |
| Codex docs-only review of this codification (`COMM-HUB-RELAY-RUNTIME-IMPLEMENT-DESIGN-SPEC`) | This persisted phase (Mode 3) | Verify the persisted artifact preserves the design content, names the same Phase A scope, preserves all non-authorizations, and applies the Relay-vs-Hermes naming convention |
| Codex docs-only review of drafted Phase A content | Before Victor commits to the Relay repo | Forbidden-content scan + cross-reference accuracy + naming-convention compliance + completeness; ~8–10 questions |
| Codex closeout review of orchestrator status docs | After Victor commits to Relay repo and reports SHA | Verify orchestrator/STATUS.md / CHECKLIST.md / NEXT-ACTION.md correctly record Phase A closure with Relay-repo SHA; ~5 questions |

---

## §16 — Victor approval gates (Phase A)

Per `orchestrator/APPROVAL-GATES.md` + `orchestrator/PHASE-MODES.md` Mode 4 + RUNTIME-DESIGN §18.6:

| Gate | When | Class |
|---|---|---|
| Open-this-design approval | Source design phase (Mode 2; consumed) | Implicit by operator's `Open COMM-HUB-RELAY-RUNTIME-IMPLEMENT-DESIGN.` instruction |
| Open-this-codification approval | This persisted phase (Mode 3) | Implicit by operator's `Open COMM-HUB-RELAY-RUNTIME-IMPLEMENT-DESIGN-SPEC.` instruction |
| Codex round-2 review of this codification | After this file is written | Per existing workflow |
| Commit-only approval for this codification | After Codex round-2 PASS | Per existing workflow; names the 4-file scope (this template + 3 status docs) |
| Push approval for this codification | After commit | Per existing workflow |
| Open-Phase-A approval | After this codification commits | **RED tier per AUTOMATION-PERMISSIONS Tier 3 (phase-mode promotion to SAFE IMPLEMENTATION) + opening a substantive implementation track**. Operator names mode = SAFE IMPLEMENTATION, scope = drafted README/LICENSE/.gitignore content for the Relay repo |
| Drafted-content approval | After Codex docs-only review of drafted Phase A content | Per existing workflow; operator approves the drafted text (drafted in conversation) |
| Operator commits to Relay repo | Operator-manual; after drafted-content approval | Claude has no GitHub authority; this is operator-only |
| Orchestrator-side closeout commit-only approval | After operator reports Relay-repo SHA | Per existing workflow; names the 3 status-doc scope (`orchestrator/STATUS.md`, `orchestrator/CHECKLIST.md`, `orchestrator/NEXT-ACTION.md`) |
| Orchestrator-side closeout push approval | After closeout commit | Per existing workflow |

The set of approvers is and remains `{Victor}`. No Codex PASS, no clean tree, no scheduled trigger, no automation-internal state grants any of these gates.

---

## §17 — Exact implementation order (Phase A)

1. **Operator reads this codification** and either approves, requests edits, or rejects.
2. **Codex docs-only review** of the codification (~12–15 questions; round-2 PASS required before commit).
3. **Operator approves commit-only and push** for this codification.
4. **Operator explicitly approves opening `COMM-HUB-RELAY-RUNTIME-IMPLEMENT-A-BOOTSTRAP`** in-session, naming SAFE IMPLEMENTATION mode and the 3-file Relay-repo scope.
5. **Claude drafts** `README.md`, `LICENSE`, `.gitignore` content as conversation `<file>`-style blocks (no file written to either working tree).
6. **Codex docs-only review** of the drafted content (~8–10 questions; PASS required before any commit).
7. **Operator commits and pushes** the 3 files to `relentlessvic/agent-avila-relay` **manually** (Claude has no GitHub authority for that repo).
8. **Operator reports back** the resulting Relay-repo HEAD SHA.
9. **Claude opens a closeout phase** `COMM-HUB-RELAY-RUNTIME-IMPLEMENT-A-BOOTSTRAP-CLOSEOUT` (DOCS-ONLY) in this `relentlessvic/agent-avila` working tree to record Phase A as CLOSED at the Relay-repo SHA.
10. **Codex docs-only review** of the closeout commit (~5 questions).
11. **Operator approves the closeout commit-only and push** in the trading repo.
12. End of Phase A. Phase B-DEPS does not auto-open; it requires its own scoped operator instruction.

---

## §18 — Rollback plan (Phase A)

Phase A is fully reversible at every step:

- **Before Step 7 (operator commit to Relay repo):** no state change anywhere; abandon the phase by simply not committing.
- **After Step 7 but before Step 9:** operator reverts the Relay-repo commit (`git revert <sha>` in the Relay repo) or deletes the Relay repo entirely (operator-side). The trading repo is unchanged.
- **After Step 11 (closeout committed):** operator opens a `COMM-HUB-RELAY-RUNTIME-IMPLEMENT-A-BOOTSTRAP-ROLLBACK` DOCS-ONLY phase to record reversal in orchestrator status docs; operator separately reverts the Relay repo.

**Out-of-scope for Phase A rollback:**
- Discord application / bot / token / permission state — unchanged by Phase A; not in scope of this rollback.
- `agent-avila-relay` Railway service shell — unchanged by Phase A; not in scope.
- Any trading-runtime / production state — unchanged by Phase A; not in scope.

The canonical 3-step DORMANT-revert for the entire Relay track (token reset → kick bot → delete Railway service; per `orchestrator/handoffs/COMM-HUB-HERMES-STAGE5-PARTIAL-INSTALL-RECORD.md` §7) is **not** part of Phase A's rollback because Phase A doesn't touch the bot or Railway service. Those steps remain available as a separate `COMM-HUB-RELAY-DEACTIVATE` phase.

---

## §19 — What is NOT authorized

Neither the source design phase nor this codification authorizes anything downstream. Specifically NOT authorized:

- Opening `COMM-HUB-RELAY-RUNTIME-IMPLEMENT-A-BOOTSTRAP` or any subsequent lettered phase.
- Drafting Phase A file content (drafting is the next phase's first step, not this codification's).
- Any clone, write, push, or commit to `relentlessvic/agent-avila-relay`.
- Any modification to this `relentlessvic/agent-avila` working tree beyond the 4-file codification scope.
- `npm install` / `npm ci` / any Node toolchain action.
- Any Railway action; any deploy.
- Stage 5 install resumption (Steps 14–21); Stage 5 Gate-10 remains CONSUMED at `40f3137e842cd60acf1adf17ecc7fe2f0b1b8935`.
- Stage 7 dry-run; any later stage (Stages 8 / 9 / 10a / 10b).
- Any Discord application / bot / token / permission / webhook / post action.
- Any DB / Kraken / env / `MANUAL_LIVE_ARMED` / production action.
- DASH-6 smoke run; D-5.12f first-live-exercise; Migration 009+; autopilot Loop B/C/D activation.
- Memory-file edit; test-suite edit.
- External Hermes Agent (Nous / OpenRouter) setup.
- Any phase-mode promotion. Approvers remain `{Victor}`.
- Modification of canonical Relay spec, install checklist, dry-run design, preconditions doc, partial-install record, runtime design, channel layout, or any safety-policy doc.

---

## §20 — Verdict (source design phase)

**PASS WITH FINDINGS** —
- **PASS** on three-way SHA consistency, working-tree state, source-document availability, mode classification soundness, and canonical-rule alignment.
- **Findings (recorded; not actionable by this report):**
  - **F1.** The runtime design (`COMM-HUB-RELAY-RUNTIME-DESIGN.md`) describes a 25–35-file end-state. This design recommends splitting that into a lettered sequence (A–H) of small phases — A (now), then B, C, D, E, F, G, H — each with its own design-only spec, Codex review, and Victor approval. This pattern matches existing DASH-5 / DASH-6 letter-suffix discipline.
  - **F2.** Phase G (Discord gateway + publish path) is the first phase that escalates from SAFE IMPLEMENTATION to HIGH-RISK IMPLEMENTATION because it introduces external network behavior. Phases A–F and H remain SAFE.
  - **F3.** Operator-manual commits to `relentlessvic/agent-avila-relay` are the canonical pattern (Claude has no GitHub authority for that repo). This mirrors `COMM-HUB-INSTALL-DISCORD`-style operator-manual execution.
  - **F4.** `RUNTIME-DESIGN` §18.6 gates 1–5 are CLOSED; gate 6 (Victor approval to open implementation) remains OPEN and would be consumed by the operator's decision to open Phase A (or rejected/deferred).
  - **F5.** No precondition is *blocked*. The path to Phase A is open to operator decision.

The source design phase stopped after delivering the verdict (Mode 2 stop discipline). No file written by the design phase. No code generated.

---

## §21 — Codex review history

### Round 1 — procedural FAIL (not a design-substance rejection)

Codex DESIGN-ONLY review was submitted at HEAD `51662f3d1458c07b552ad0fafe0e5632182054e5` immediately after the source design phase produced the conversation-only report. Codex returned:

- **Item 13 (working-tree integrity check): PASS** — HEAD `51662f3d1458c07b552ad0fafe0e5632182054e5` confirmed; working tree clean except `position.json.snap.20260502T020154Z`; no edits or operational actions performed during the design phase.
- **Items 1–12: FAIL** — the design-report text (the immediately-prior assistant turn titled "COMM-HUB-RELAY-RUNTIME-IMPLEMENT-DESIGN — Design-Only Report" with 20 numbered sections) was not present as a file in the working tree and was not embedded in the prompt forwarded to Codex. Codex could read all canonical reference files (`COMM-HUB-RELAY-RUNTIME-DESIGN.md` 1080 lines, `PHASE-MODES.md`, `APPROVAL-GATES.md`, `PROTECTED-FILES.md`, `AUTOMATION-PERMISSIONS.md`, `CLAUDE.md`, `COMM-HUB-RELAY-RULES.md`, `COMM-HUB-INSTALL-RELAY-CHECKLIST.md`, `COMM-HUB-RELAY-STAGE5-PRECONDITIONS.md`, `COMM-HUB-HERMES-STAGE5-PARTIAL-INSTALL-RECORD.md`, `COMM-HUB-HERMES-DRY-RUN-DESIGN.md`) but had no report text to evaluate against them.
- **Overall verdict: FAIL** — not because the design is known to be wrong, but because the report artifact was absent from what Codex could inspect. Codex's resolution recommendation was: "the design report must be saved as a file in the working tree (e.g., `orchestrator/handoffs/COMM-HUB-RELAY-RUNTIME-IMPLEMENT-DESIGN.md`) before the Codex adversarial review is re-run, so Codex can read it alongside the canonical reference documents and return a grounded 14-item verdict."

The procedural FAIL is **not** a rejection of the design substance. The 14-item review checklist remains open and will be re-submitted in round 2 against this persisted file.

### Round 2 — pending

Will be submitted after this `COMM-HUB-RELAY-RUNTIME-IMPLEMENT-DESIGN-SPEC` codification commits and the persisted artifact is on disk at the post-commit HEAD. Round 2 will answer the same 14-item review checklist verbatim (mode classification, scope minimality, safety-boundary preservation, env allow-list / deny-list consistency, network allow-list correctness, canonical-future-design references, A–H sequence safety, Phase G HIGH-RISK identification, Victor approval gate completeness, Claude-no-GitHub-authority claim, naming-convention compliance, working-tree integrity, overall verdict).

---

## §22 — Authorization scope (explicit non-authorizations preserved)

This persisted codification phase **does NOT authorize** any of the following, regardless of any future Codex round-2 verdict:

- Writing Relay runtime code (defer to Phase A drafting + subsequent lettered phases).
- Cloning, writing, committing, or pushing to `relentlessvic/agent-avila-relay`.
- Opening `COMM-HUB-RELAY-RUNTIME-IMPLEMENT-A-BOOTSTRAP` (defer to a separate operator instruction with explicit mode + scope).
- Any Railway action; any deploy; any GitHub-tracked deploy trigger.
- Any Discord application / bot / token / permission / webhook / post action.
- Stage 5 install resumption; Stage 7 dry-run; Stages 8 / 9 / 10a / 10b.
- Any DB / Kraken / env / `MANUAL_LIVE_ARMED` / production action.
- DASH-6 smoke run; D-5.12f first-live-exercise; Migration 009+; autopilot Loop B/C/D activation.
- Memory-file edit; test-suite edit.
- External Hermes Agent (Nous / OpenRouter) setup.
- Modification of any other safety-policy doc, canonical Relay handoff record, or runtime / migration / script / deploy file.
- Any phase-mode promotion. Approvers remain `{Victor}`.

**Preservation invariant:** Migration 008 APPLIED at `189eb1be6ef6304d914671bdaedec44d389cf877`; N-3 CLOSED; Stage 5 Gate-10 install approval at `40f3137e842cd60acf1adf17ecc7fe2f0b1b8935` CONSUMED; Relay shelved (passive bot member of `Agent Avila Hub` with `System-Writer` role + canonical channel overrides; no runtime running); Autopilot DORMANT (verified at `eff4dd22b9b9af038c7ae45de301e60b3f45af98`); CEILING-PAUSE history (broken via `ARC-8-UNPAUSE` at `22ba4a7663e22df64b7cc8e3c0324cbffc0e28f6`; phase-loop counter 0 of 3); approvers exactly `{Victor}`; no live trading authorized.

---

## What this document is NOT

- **Not authorization to open `COMM-HUB-RELAY-RUNTIME-IMPLEMENT-A-BOOTSTRAP`.** Opening the implementation phase is a separate operator-approved RED-tier action (per AUTOMATION-PERMISSIONS Tier 3 phase-mode promotion + APPROVAL-GATES Gate 10 / Gate 16 automation widening discipline).
- **Not authorization to clone, write, commit, or push to `relentlessvic/agent-avila-relay`.** Claude has no GitHub authority for that repo. All commits / pushes are operator-manual.
- **Not authorization to draft Phase A file content.** Drafting is the first step of Phase A itself, not this codification.
- **Not authorization to install Relay further, register Discord applications, mint or rotate tokens, invite the bot to additional servers, grant additional permissions, install webhooks / schedulers / MCP triggers / cron jobs / Ruflo / background automation, post to Discord, run a Stage 7 dry-run, take a production action, take a trading action, or break CEILING-PAUSE.**
- **Not canonical over `orchestrator/COMM-HUB-RELAY-RULES.md`.** If this record diverges from the Relay spec, the spec wins.
- **Not canonical over `orchestrator/handoffs/COMM-HUB-RELAY-RUNTIME-DESIGN.md`.** If this record diverges from the runtime design, the runtime design wins.
- **Not canonical over `orchestrator/handoffs/COMM-HUB-INSTALL-RELAY-CHECKLIST.md`.** If this record diverges from the install checklist's 21-step canonical sequence, the install checklist wins.
- **Not canonical over `orchestrator/handoffs/COMM-HUB-HERMES-DRY-RUN-DESIGN.md`.** If this record diverges from the dry-run design, the dry-run design wins.
- **Not canonical over `orchestrator/handoffs/COMM-HUB-RELAY-STAGE5-PRECONDITIONS.md`.** If this record diverges from the preconditions doc, the preconditions doc wins.
- **Not canonical over `orchestrator/handoffs/COMM-HUB-HERMES-STAGE5-PARTIAL-INSTALL-RECORD.md`.** If this record diverges from the partial-install record, the partial-install record wins.
- **Not canonical over `orchestrator/COMM-HUB-RULES.md`, `orchestrator/handoffs/COMM-HUB-CHANNEL-LAYOUT.md`, `orchestrator/AUTOMATION-PERMISSIONS.md`, `orchestrator/APPROVAL-GATES.md`, `orchestrator/PHASE-MODES.md`, `orchestrator/PROTECTED-FILES.md`, `orchestrator/HANDOFF-RULES.md`, or `CLAUDE.md`.** Canonical files win on divergence; this record must be re-aligned in a follow-up DOCS-ONLY phase if any divergence is later detected.

**This codification phase (`COMM-HUB-RELAY-RUNTIME-IMPLEMENT-DESIGN-SPEC`) is DOCS-ONLY (Mode 3) and persists the source-design report. The implementation phase remains gated behind explicit Victor in-session approval; Phase A scope remains exactly README.md + LICENSE + .gitignore in `relentlessvic/agent-avila-relay`; Stage 5 Gate-10 install approval at `40f3137e842cd60acf1adf17ecc7fe2f0b1b8935` remains CONSUMED; Relay remains shelved; CEILING-PAUSE history preserved; Autopilot DORMANT preserved; Migration 008 APPLIED preserved; N-3 CLOSED preserved; approvers exactly `{Victor}` preserved.**
