# N-2 Runbook — Migration 008 Production-Application Plan

> **DOCS-ONLY ARTIFACT.** This runbook is a planning document. It does NOT authorize any production action. Per `orchestrator/HANDOFF-RULES.md` and `orchestrator/APPROVAL-GATES.md` gate 4, applying Migration 008 to production is N-3 — a separate PRODUCTION ACTION phase that requires explicit, in-session, scoped Victor / CEO approval that is distinct from any N-2b commit-time approval and from any Codex PASS verdict.
>
> **Canonical authority:** `orchestrator/NEXT-ACTION.md` and `orchestrator/NEXT-ACTION-SELECTOR.md` (per `HANDOFF-RULES.md`). If this runbook ever conflicts with either, the canonical source wins and this runbook is stale.
>
> **No packet substitutes for in-session operator approval** (per `orchestrator/APPROVAL-GATES.md` "What is NOT operator approval"). This runbook describes the shape of an approval; the actual approval is Victor's in-session instruction.

Phase: N-2b — DOCS-ONLY runbook artifact
Last updated: 2026-05-03
Author: Claude (Lead Engineer / Builder)
Status: Committed at `e6c9189` (N-2b) → `9ae139d` (N-2c, HEAD-preflight correction). **One N-3 attempt was made and HALTED before any SQL executed** — see §1.1 N-3 attempt history below. N-2d is the connectivity-preflight runbook update phase. **Migration 008 remains NOT applied to production.** N-3 remains blocked pending Codex docs-only PASS on this N-2d update, fresh Codex N-3 preflight PASS on the updated runbook, fresh Victor explicit in-session production-action approval naming the exact current HEAD hash, all pre-flight checks (now including connectivity preflight) passing at execution time, and target Railway service / production database confirmation without exposing secrets.

## 1.1 N-3 attempt history (added in N-2d)

One N-3 attempt was made on 2026-05-03. It HALTED with **runner exit code 1** before any SQL executed. The runner's final log line reported a hostname-resolution failure for the Railway-internal Postgres hostname (`getaddrinfo ENOTFOUND` for the internal hostname). Per `scripts/run-migrations.js:152–154`, exit 1 is a fatal error caught before `pool.connect()` could complete the TLS / Postgres protocol handshake.

What this means concretely:

- **No `applying` log line** appeared in the runner output. The runner did not begin a transaction. No `BEGIN` was issued.
- **No SQL statement was executed** against any database. `schema_migrations` was not bootstrapped. `emergency_audit_log` was not created.
- **Production-DB state is unchanged.** Migration 008 is still NOT applied.
- **No partial state** exists; there is nothing to roll back, and no rollback DDL is authorized.
- **The prior Victor N-3 approval (which named exact HEAD `9ae139d…`) was consumed by this single attempt and cannot be reused.** Per the runbook §5 exact-HEAD-naming requirement, any retry requires a fresh Codex N-3 preflight PASS on the (now-updated) runbook plus a fresh Victor in-session production-action approval naming the exact current HEAD at retry time.
- **Captured runner output** exists as a local timestamped file on the operator's machine. Its contents may include partial environment diagnostics and must not be pasted into any handoff packet (per `HANDOFF-RULES.md` forbidden-content rule).

Root cause (diagnosis): the Railway-internal Postgres hostname resolves only from inside Railway's network (i.e., from a Railway service's runtime or a Railway-attached shell). DNS resolution from the operator's local machine fails immediately at the OS level before the runner can connect. The N-2c runbook did not document this execution-context requirement explicitly, so an operator following the runbook from a non-Railway-attached environment hit this failure mode. N-2d adds the missing connectivity preflight + execution-context guidance to prevent recurrence.

## 1. Phase and scope

- **N-2b — Migration 008 production plan runbook (DOCS-ONLY).** This phase produces a stable runbook artifact derived from the conversation-only N-2 design report, with five Codex-required tightening edits applied verbatim.
- **N-3 remains blocked.** Application of Migration 008 to production is a separate phase that requires Codex PASS on this runbook **and** explicit, in-session, scoped operator approval **and** successful pre-flight checks **and** operator confirmation of the target Railway service / production `DATABASE_URL`.
- **This runbook does NOT authorize production application.** It is planning material only.
- **No migration application, no deploy, no production-DB query, no Railway command, no Kraken action, no env / secret read or write, no `MANUAL_LIVE_ARMED` change, and no runtime edit is authorized by this runbook.**

## 2. Migration 008 summary

- **File:** `migrations/008_emergency_audit_log.sql` (47 lines, committed in D-5.12c `4ae3689`).
- **Classification:** **additive, forward-only, idempotent.**
- **What it creates:**
  - One table: `emergency_audit_log` (13 columns: `id BIGSERIAL PRIMARY KEY`, `event_id TEXT NOT NULL UNIQUE`, `timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()`, `mode TEXT NOT NULL CHECK (mode IN ('paper','live'))`, `source TEXT NOT NULL`, `kraken_order_id TEXT`, `failure_class TEXT NOT NULL`, `error_message TEXT`, `attempted_payload JSONB NOT NULL DEFAULT '{}'::jsonb`, `resolved_at TIMESTAMPTZ`, `resolved_by TEXT`, `resolution_notes TEXT`, `metadata JSONB NOT NULL DEFAULT '{}'::jsonb`).
  - Four explicit indexes (3 partial + 1 full): `emergency_audit_log_unresolved_idx`, `emergency_audit_log_kraken_order_id_idx`, `emergency_audit_log_source_timestamp_idx`, `emergency_audit_log_failure_class_timestamp_idx`.
  - Plus two implicit indexes derived from constraints: PK index on `id`, and the UNIQUE-derived index on `event_id`. **Total: six indexes.**
- **Does NOT touch existing data.** No `ALTER TABLE` on existing tables. No `UPDATE` / `DELETE` / `INSERT`. No reference to `positions`, `trade_events`, `strategy_signals`, or `bot_control`.
- **Does NOT itself contain secrets.** The migration declares schema only.
- **Runtime redaction is a separate contract** in `dashboard.js` (`_redactAttemptedPayload` and `_emergencyAuditWrite`, committed in D-5.12c and exercised in D-5.12d/e). That redaction strips patterns matching `/secret|key|token|cookie|auth|signature|password|credential|nonce/i` from `attempted_payload` before insert at runtime. Not relevant to the migration application itself; relevant only to subsequent live-exercise paths.
- **Reverse path is destructive.** `DROP TABLE emergency_audit_log` would drop historical incident rows. The migration file's header (lines 15–16) explicitly requires "explicit safety review" before any rollback. This runbook does **not** pre-authorize rollback.

## 3. Migration runner behavior

- **Runner:** `scripts/run-migrations.js` — 154 lines, committed in D-5.4.
- **Invocation forms** (per `package.json:11` and the runner's own usage block at line 14): the runner can be invoked locally through the package migrate script or directly with an explicit database URL. The production N-3 form would use the approved Railway runner invocation. This runbook intentionally omits the literal production command because `HANDOFF-RULES.md` forbids migration-apply commands or production Railway runner invocations inside packet artifacts.
- **Behavior:** reads every `migrations/NNN_*.sql` file matching `/^\d+_.+\.sql$/` (lines 49–51), string-sorts, looks up `schema_migrations` (lines 87–92), and applies every absent version in version order (lines 100–142).
- **Per-migration target?** **No.** The runner has no version-filter flag. **It applies all un-applied migrations sequentially.** This is the same behavior that caused Migration 006 to be applied as a side effect during Phase B.2a.
- **Filesystem-based, not git-tracked.** The runner reads `migrations/*.sql` from the working tree filesystem (lines 49–51), not from `git ls-files`. **Therefore a pre-flight `git ls-files` check alone is insufficient** — the runner would still pick up an untracked or dirty 009+ file. Pre-flight (§4) explicitly guards against this.
- **Safety properties (positive):** transactional per migration (`BEGIN`/`COMMIT`/`ROLLBACK`); checksum-locked (exit 3 on tampered already-applied migration); idempotent (re-runs are no-ops once applied).
- **Execution-context requirement (added in N-2d).** The production Postgres add-on is reachable from inside Railway's network via a Railway-internal hostname; that hostname does not resolve from environments outside Railway's network. The preferred N-3 execution context is therefore a Railway-attached runtime or shell session attached to the Railway project, where the internal Postgres hostname resolves correctly. Any alternative execution context (for example, an operator-local shell using a Railway-published external proxy URL) is permitted only after the operator has independently confirmed connectivity to the production Postgres target and has accepted the connectivity-path risk surface (TLS/SSL, rate limits, public exposure considerations). This runbook does NOT include literal commands, hostnames, ports, or URLs for either path; the operator chooses and invokes the approved execution context per their own Railway access procedures, with the connectivity preflight in §4(vii) confirming reachability before the runner is invoked.

## 4. Pre-flight checks (Codex Edit 1, applied verbatim)

> **Immediately before N-3 execution, verify all of the following in sequence; HALT on any failure:**
>
> (i) `git rev-parse HEAD` equals the exact commit hash named in Victor's explicit N-3 in-session production-action approval; that named hash must correspond to the latest committed runbook state (i.e., the HEAD that exists at approval time, after any N-2b/N-2c closeout commits). The runbook intentionally does not pin a hardcoded hash here, because committing a runbook that pins itself to its own pre-commit HEAD always produces a stale value the moment the commit lands. The approval-time exact-HEAD-naming rule (see §5) is the canonical source of the expected hash;
> (ii) `git branch --show-current` equals `main`;
> (iii) `git diff --name-status HEAD` is empty;
> (iv) `git status --short --untracked-files=all migrations/` is empty (no untracked migration files on disk);
> (v) `git ls-files migrations/` lists exactly `migrations/001_init.sql` through `migrations/008_emergency_audit_log.sql` and nothing else;
> (vi) operator verbally confirms the intended Railway service and production `DATABASE_URL` target without revealing the secret value.
> (vii) **Connectivity preflight (added in N-2d).** From the chosen N-3 execution context (Railway-attached runtime/shell, or an explicitly accepted alternative connectivity path), the operator confirms that the production Postgres target is reachable from that context **before** the migration runner is invoked. The confirmation is operator-driven, prose-only, and does not require pasting the production database hostname, port, URL, or any other secret value into chat or any handoff packet. If the execution context cannot resolve or reach the production Postgres target, HALT — do not invoke the runner. The N-2c HALTED attempt (see §1.1) is the canonical example: a non-Railway-attached execution context produced a hostname-resolution failure (runner exit 1) before any SQL executed; this preflight catches that class of failure proactively.
>
> **If any check differs from expected, HALT and re-request Codex review and operator approval before proceeding.**

**Note on the pre-existing untracked snapshot.** The known untracked file `position.json.snap.20260502T020154Z` lives at the repo root, **outside `migrations/`**. It is intentionally excluded from every prior commit. It does NOT cause check (iv) to fail, because that check is scoped to `migrations/` only. A non-empty `git status --short` (showing only that snap) at repo level is acceptable; a non-empty `git status --short --untracked-files=all migrations/` is NOT acceptable.

## 5. Operator-approval wording for N-3 (Codex Edit 2, applied verbatim)

> **Victor, approve Phase N-3 — Migration 008 production application only.**
>
> **Scope:** files `migrations/008_emergency_audit_log.sql` and `scripts/run-migrations.js`; action: applying Migration 008 to the confirmed production Railway Postgres service and then running the listed read-only verification queries.
>
> **This approval does not authorize commits, deploys, Migration 009 or later, live exercises, Kraken actions, `MANUAL_LIVE_ARMED` reads/writes, env/secret changes, rollback, or any other production action.**
>
> **This approval expires when the single N-3 application-and-verification action ends.**

**Exact-HEAD-naming requirement (N-2c addition).** The N-3 approval must include the exact commit hash returned by `git rev-parse HEAD` immediately before the operator types the approval. The named hash binds the approval to a specific runbook state and is the canonical input for pre-flight check (i). If HEAD changes after the approval is given (a new commit lands, a rebase, a fast-forward pull, etc.) the approval expires and N-3 must HALT pending fresh Codex review and a fresh Victor approval that names the new HEAD. This avoids the self-staling commit loop that occurs when a runbook tries to pin itself to its own pre-commit HEAD.

The above is the **shape** of an approval. It is NOT itself an approval — Victor's actual in-session instruction (typed in the chat) is the approval. Per `orchestrator/APPROVAL-GATES.md` "What is NOT operator approval", a runbook field cannot substitute.

## 6. Verification queries — post-application (Codex Edit 3, applied verbatim)

> **After runner exit 0, verify in order:**
>
> **(a)** `SELECT version, name, checksum FROM schema_migrations WHERE version = 8` returns exactly one row with the expected values;
> **(b)** `SELECT version FROM schema_migrations ORDER BY version` returns exactly 1, 2, 3, 4, 5, 6, 7, 8 and no other rows;
> **(c)** `SELECT 1 FROM emergency_audit_log LIMIT 1` succeeds;
> **(d)** column list of `emergency_audit_log` matches the 13 columns defined in the migration file;
> **(e)** `SELECT indexname FROM pg_indexes WHERE tablename = 'emergency_audit_log'` returns exactly six index names (four explicit, one PK-derived, one `event_id` UNIQUE-derived).
>
> **Any extra migration version, missing object, missing index, or unexpected row content is a HALT.**

The six expected index names are:
1. `emergency_audit_log_pkey` (PK-derived, on `id`)
2. `emergency_audit_log_event_id_key` (UNIQUE-derived, on `event_id`)
3. `emergency_audit_log_unresolved_idx`
4. `emergency_audit_log_kraken_order_id_idx`
5. `emergency_audit_log_source_timestamp_idx`
6. `emergency_audit_log_failure_class_timestamp_idx`

The 13 expected column names (verification (d)) are: `id`, `event_id`, `timestamp`, `mode`, `source`, `kraken_order_id`, `failure_class`, `error_message`, `attempted_payload`, `resolved_at`, `resolved_by`, `resolution_notes`, `metadata`.

## 7. Emergency stop conditions during N-3 (Codex Edit 4, applied verbatim plus original list)

If any of these occur during N-3, **STOP immediately, surface the situation to the operator, and do not retry without re-review:**

**Original conditions (from N-2 plan):**
- Runner reports `CHECKSUM MISMATCH` (exit code 3) — an applied migration was edited; this is a security signal.
- Runner exits with code 4 (SQL failure) — surface the error message verbatim.
- Runner cannot connect to the DB (exit code 1 or 2) — `DATABASE_URL` may be wrong target.
- Verification query returns unexpected `schema_migrations` content.
- Verification query reports `emergency_audit_log` table does not exist.
- Any other tool or process attempting to write to `schema_migrations` or `emergency_audit_log` concurrently.

**Codex Edit 4 additions:**
> **HALT** if the runner output contains any `applying` log line other than `008_emergency_audit_log.sql`. **HALT** if any verification query returns a result inconsistent with expected values. **HALT** if there is any evidence of a concurrent migration runner or concurrent writer to `schema_migrations` or `emergency_audit_log`.

**N-2d additions (connectivity-related):**
> **HALT** if the chosen N-3 execution context cannot resolve or reach the production Postgres target before the runner is invoked (per pre-flight §4(vii)). Do not invoke the runner. Do not retry from the same un-validated execution context. Do not loop on retry attempts. Surface the unreachable-target observation to the operator and await fresh operator instruction.
> **HALT** if the runner exits with a connection failure (exit 1 with hostname-resolution / connection-refused / TLS-handshake errors, or exit 2 for missing `DATABASE_URL` / missing migrations directory) — the prior Victor approval is consumed by the failed attempt and any retry requires a fresh Codex N-3 preflight PASS plus a fresh Victor in-session production-action approval naming the exact current HEAD. Do not retry automatically.
> **Do not retry automatically under any circumstance.** Every retry is a fresh execution attempt requiring its own fresh Codex review and fresh Victor approval. The runbook §11 N-3 gate must be re-satisfied from scratch on every retry.

## 8. Risk table (Codex Edit 5 additions integrated)

| Tier | Risk | Mitigation |
|---|---|---|
| **P0** | Runner applies an unintended migration (e.g., a tracked 009+ that lands later) | Pre-flight (v): `git ls-files migrations/` shows exactly 001..008. |
| **P0** | **Untracked or dirty `migrations/009+` file on disk at execution time** (filesystem-level, not git-level — runner reads filesystem at lines 49–51) | **Pre-flight (iv): `git status --short --untracked-files=all migrations/` is empty.** *(Codex Edit 5 addition.)* |
| **P0** | **Operator running from a non-`main` branch or wrong HEAD** where additional migrations exist, OR HEAD changes after Victor's approval (new commit, rebase, fast-forward pull) and approval becomes stale | **Pre-flight (i, ii): `git rev-parse HEAD` equals the exact hash named in Victor's N-3 approval (per §5 exact-HEAD-naming requirement); `git branch --show-current` equals `main`. If HEAD changes after approval, HALT pending fresh Codex review and fresh Victor approval naming the new HEAD.** *(Codex Edit 5 addition; reformulated in N-2c to avoid self-staling commit loop.)* |
| **P0** | Wrong production DB target (Railway points at staging, or `DATABASE_URL` is dev/staging) | Pre-flight (vi): operator verbally confirms target service / DB without revealing secret value. |
| **P0** | Network partition mid-application leaves partial schema | Per-migration `BEGIN`/`COMMIT`/`ROLLBACK`. Partial state cannot exist. |
| **P0** | Concurrent migration runner invocation | Pre-flight: operator confirms no concurrent invocation; Postgres also serializes via row-level locks on `schema_migrations`. |
| **P1** | **Operator treats Codex PASS, clean working tree, or successful pre-flight as production-action approval** (forbidden per `APPROVAL-GATES.md:102–112`) | **Explicit policy citation in §9 Safety Gates; approval-wording gate in §5.** *(Codex Edit 5 addition.)* |
| **P1** | **Operator-approval wording inadvertently containing real secrets, env values, `DATABASE_URL` contents, or live order details** (forbidden per `HANDOFF-RULES.md:59–67`) | **Approval wording must be reviewed before use; pre-flight (vi) explicitly says "without revealing the secret value".** *(Codex Edit 5 addition.)* |
| **P1** | Future `emergency_audit_log` writes contain a real secret (helper bug) | Runtime defense: `_redactAttemptedPayload` (committed D-5.12c, Codex-reviewed). Migration itself does not introduce risk. |
| **P1** | Operator confuses N-3 approval with broader live-exercise approval | One-time-scope wording in §5 explicitly excludes deploys, live exercises, `MANUAL_LIVE_ARMED`, env changes, rollback. |
| **P1** | `emergency_audit_log` payload growth without retention | Tracked in Codex v4 LOW note 9.b; deferred to D-5.12i operator playbook. Not a current risk; expected zero rows pre-incident. |
| **P1** | Railway log retention is finite | Operator captures runner stdout/stderr to a local timestamped file in N-3 (see §10). |
| **P0** | **Local execution context cannot resolve or reach the Railway-internal Postgres hostname** (e.g., a `getaddrinfo ENOTFOUND` for the internal hostname when running outside Railway's network) — runner exits 1 before any SQL executes (no transaction, no partial state, no rollback needed) | **Pre-flight (vii) connectivity preflight: confirm reachability from the chosen execution context before invoking the runner. Preferred path: a Railway-attached runtime / shell where the internal hostname resolves. Alternative paths must be operator-confirmed for connectivity AND must accept the corresponding risk surface.** *(N-2d addition; observed during the N-3 attempt on 2026-05-03 — see §1.1.)* |
| **P1** | **Operator retries N-3 reusing a consumed approval** (the prior Victor approval was bound to a single application-and-verification action; once that action ends — successfully or via HALT — the approval is consumed) | **Each retry requires a fresh Codex N-3 preflight PASS on the current runbook plus a fresh Victor in-session production-action approval naming the exact current HEAD at retry time. Per §5 exact-HEAD-naming requirement and §11 N-3 gate, the gate is re-satisfied from scratch on every retry.** *(N-2d addition.)* |
| **P2** | Index creation contention | NONE — empty table; index creation is instantaneous. |
| **P2** | Future schema migration depends on `emergency_audit_log` existing | Bounded; would be an explicit dependency in a future migration. |
| **P2** | Application of 008 negatively affects `bot.js` / `dashboard.js` runtime | LOW. D-5.12c/d/e helpers write to this table only on actual DB-failure paths (steady-state: zero rows expected pre-incident). |

## 9. Safety gates and approvals

Per `orchestrator/APPROVAL-GATES.md`:

| Action | Gate | Status |
|---|---|---|
| Migration 008 file commit (D-5.12c, `4ae3689`) | Gate 3 | **Already given** (Codex round-2 PASS + operator approval; scoped to D-5.12c) |
| **N-3: apply Migration 008 to production** | **Gate 4** (production migration application — separate from gate 3) | **Required, not yet granted** |
| Production Railway runner invocation against production target | Gate 5 (Railway deployment / production target) | **Required, not yet granted** |
| Production-DB schema mutation | Gate 12 (production-state mutation) | **Required, not yet granted** |

**Gate-4 separation rule.** Per `APPROVAL-GATES.md` "Production actions require separate explicit approval from code/doc commits": (a) any prior commit-time approval (D-5.12c, ARC-7) does NOT authorize gate 4; (b) any future N-2b commit-time approval will NOT authorize gate 4; (c) any Codex PASS — including a Codex PASS on this runbook — does NOT authorize gate 4. Per `AUTOMATION-PERMISSIONS.md` RED tier and `NEXT-ACTION-SELECTOR.md` rule 6, automation cannot grant gate 4. **Only Victor's explicit, in-session, scoped instruction authorizes N-3.**

## 10. Runner output capture (recommended for N-3)

Capture full runner stdout and stderr to a local timestamped file during N-3 execution. Railway log retention is finite (Codex v4 LOW note 9.d), and the runner output contains the per-migration `applying` log lines that the operator must verify against the §7 stop conditions ("HALT if the runner output contains any `applying` log line other than `008_emergency_audit_log.sql`").

Suggested form (operator-driven; not authorized by this runbook): during N-3, the operator should use the explicitly approved production runner invocation from Victor's in-session approval and redirect stdout and stderr to a local timestamped file outside the repository. This runbook intentionally omits the literal command because `HANDOFF-RULES.md` forbids production migration-apply commands inside packet artifacts.

The capture file is local to the operator's machine and outside the repository. It is read-only after capture; do not paste its contents into any handoff packet (`HANDOFF-RULES.md` forbids prod-DB content / log content in packets).

## 11. Final state — N-3 blocking conditions

**N-3 must remain blocked until ALL of the following are satisfied, in order:**

1. **Codex returns PASS on this N-2d docs-only runbook update.** Binding state is the latest PASS verdict on the N-2d artifact in `orchestrator/handoffs/CODEX-VERDICT.md`.
2. **Codex returns a fresh N-3 preflight PASS on the updated runbook before operator approval is requested.** Any prior N-3 preflight PASS issued against an earlier runbook revision is consumed / stale and cannot stand in for this fresh review.
3. **Victor / CEO gives explicit, in-session, scoped production-action approval** matching the §5 approval wording substance and naming the exact current HEAD hash (per the §5 exact-HEAD-naming requirement). The approval is the operator's typed in-session instruction, not a runbook field; it is bound to the named HEAD and expires if HEAD changes before execution.
4. **All pre-flight checks (§4 (i)–(vii)) pass** at the moment of N-3 execution, including the new (vii) connectivity preflight from the chosen execution context. If any check fails, HALT.
5. **Operator confirms the target Railway service and production `DATABASE_URL`** without exposing secret values.

Until all five conditions are satisfied simultaneously, **no migration runner is invoked against production, no production Railway runner command is executed, and no direct database-URL runner invocation is executed.** Per `AUTOMATION-PERMISSIONS.md` RED tier and `HANDOFF-RULES.md` forbidden-content rule, no automation may treat this runbook's existence, completeness, Codex verdict, or pre-flight passing as approval.

## 12. Cross-references

- `migrations/008_emergency_audit_log.sql` — the migration under review.
- `scripts/run-migrations.js` — the runner that would apply it (D-5.4).
- `orchestrator/HANDOFF-RULES.md` — packet rules (this runbook is a packet artifact).
- `orchestrator/APPROVAL-GATES.md` — 16-gate matrix and gate-4 separation rule.
- `orchestrator/PROTECTED-FILES.md` — per-path classification (Migration 008 is HARD BLOCK; this runbook is SAFE).
- `orchestrator/PHASE-MODES.md` — Mode 6 PRODUCTION ACTION precondition (plan/checklist/runbook before operator approval).
- `orchestrator/NEXT-ACTION-SELECTOR.md` — master order; canonical authority over packets.
- `orchestrator/ROLE-HIERARCHY.md` — Codex reviewer role (PASS necessary, not sufficient); Victor sole final approver.
- `orchestrator/AUTOMATION-PERMISSIONS.md` — RED tier for production migration application; blocked-commands list.
- `orchestrator/AUTOPILOT-RULES.md` — supervised-autopilot rules.
- `orchestrator/BLUEPRINT.md` — architectural blueprint and Safety Enforcement Layer.
- `CLAUDE.md` (repo root) — top-level role / safety / change-discipline rules.

## 13. What this runbook is NOT

- Not an approval.
- Not a commit.
- Not authorization for any production action.
- Not canonical over `orchestrator/NEXT-ACTION.md` / `orchestrator/NEXT-ACTION-SELECTOR.md`.
- Not a substitute for Codex review or for Victor's in-session approval.
- Not a script to be executed automatically. Every command shown is documentation; only Victor's explicit instruction at N-3 authorizes any execution.

## 14. Change history

- **N-2b (2026-05-03):** Initial runbook artifact derived from the N-2 conversation-only design report. Codex's five required tightening edits applied verbatim: (1) pre-flight expanded with branch / HEAD / untracked-files / dirty-tree checks; (2) operator-approval wording stabilized; (3) verification expanded to six indexes + full `schema_migrations` sequence + 13-column check; (4) emergency stop conditions extended with applying-log-line check; (5) risk table extended with two new P0 risks (untracked/dirty 009+; wrong branch/HEAD) and two new P1 risks (mistaking Codex PASS / clean tree as approval; approval wording leaking secrets). Three follow-up rounds of cleanup applied to remove literal production runner commands and reach full prose-only HANDOFF-RULES.md compliance. Committed at `e6c9189`.
- **N-2c (2026-05-03):** HEAD-preflight correction. Codex N-3 preflight review caught that pre-flight check (i) at line 47 still pinned HEAD to `8266db2…` (the pre-N-2b commit), while the runbook is now committed at `e6c9189`. Naively updating the pinned hash to `e6c9189…` would produce the same staleness the moment N-2c itself commits — a self-staling commit loop. N-2c instead replaces the in-runbook hardcoded pin with an approval-time exact-HEAD-naming rule: pre-flight check (i) now requires HEAD to equal the exact hash named in Victor's N-3 approval; §5 adds an "exact-HEAD-naming requirement" that binds Victor's approval to a specific HEAD and expires the approval if HEAD changes; the risk table is reformulated for the same. Committed at `9ae139d`.
- **N-3 attempt (2026-05-03):** Single attempt, HALTED before any SQL executed. Runner exit 1; final log line reported `getaddrinfo ENOTFOUND` for the Railway-internal Postgres hostname. No `applying` log line appeared. No `BEGIN` issued. No SQL executed. Production-DB state unchanged. Migration 008 still NOT applied. No partial state. No rollback needed. Prior Victor approval (which named exact HEAD `9ae139d…`) was consumed by the failed attempt and cannot be reused. Captured runner output preserved as a local timestamped file on the operator's machine. See §1.1 N-3 attempt history for the canonical record.
- **N-2d (2026-05-03):** Connectivity-preflight runbook update. Adds §1.1 N-3 attempt history; extends §3 with a Railway-attached execution-context requirement; adds pre-flight check (vii) connectivity preflight requiring the operator to confirm reachability of the production Postgres target from the chosen execution context before the runner is invoked; extends §7 emergency stop conditions with HALT-on-unreachable-target and HALT-on-connection-failure rules and a do-not-retry-automatically reminder; adds two new risk-table rows (P0 for local execution context cannot resolve Railway-internal hostname; P1 for retrying with a consumed approval). The runbook remains fully prose-only and HANDOFF-RULES.md compliant — no literal Railway runner commands, no `DATABASE_URL` examples, no hostname / port / URL values added. N-3 remains blocked pending Codex docs-only PASS on this N-2d update, fresh Codex N-3 preflight PASS on the updated runbook, fresh Victor explicit in-session production-action approval naming the exact current HEAD, all pre-flight checks (now seven, including connectivity preflight) passing at execution time, and target confirmation without exposing secrets. Pending Codex docs-only review and explicit operator approval before commit.
