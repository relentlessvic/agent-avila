# COMM-HUB-RELAY-RUNTIME-DEPLOYMENT-RUNBOOK-DESIGN

**Status:** Permanent SAFE-class handoff record codified at parent commit `<DEPLOYMENT-RUNBOOK-DESIGN-SPEC commit SHA>` (set at codification seal).
**Phase mode (when authored):** Mode 2 DESIGN-ONLY (conversation-only).
**Phase mode (codification):** Mode 3 DOCS-ONLY (this handoff).
**Sealed grounding:** sealed DEPLOYMENT-READINESS-DESIGN at parent `02e0796…` + sealed DEPLOYMENT-PREFLIGHT-DESIGN at parent `a9d1a31…` + sealed G-DESIGN at `66af7df…` + sealed G-READINESS-DESIGN at `95da6ef…` + sealed G-3 DESIGN at `29ea5a4…` + sealed G-4 DESIGN at `705416e3…` + STAGE5-PRECONDITIONS + INSTALL-RELAY-CHECKLIST + HERMES-STAGE5-PARTIAL-INSTALL-RECORD + RAILWAY-SERVICE-RENAME-HERMES-TO-RELAY-DESIGN + APPROVAL-GATES + COMM-HUB-RELAY-RULES + sealed Relay `package.json` (engines.node `>=22 <23`; main `src/index.js`; no `scripts` section at Relay HEAD `f232c328…`) + sealed Relay `src/index.js` (operatorPhaseId NOT read from `process.env` per RE-9 + Phase F §9) + sealed Relay `src/runtime/boot.js` (Stage 13 rateLimitState fail-closed + Stage 15 G-3 default-wiring with `validateOnly: true` non-activation guard) + sealed Relay `src/config.js:72-139` (canonical forbidden-env blocklists) + `src/config.js:203+` (`isForbiddenEnvVar()` runtime detector).
**Pre-codification anchors:** parent HEAD `eb9cc28548d193d0d557fd06d2ebc994cdf25956` (DEPLOYMENT-PREFLIGHT-DESIGN-SPEC-CLOSEOUT-SYNC) + Relay HEAD `f232c328284e687511a794dc89358bbc0cd275d1` (G-5-RUN-10-REPAIR).
**Codex DESIGN-ONLY review chain:** round-1 PASS (33/33 review goals; no required edits; Codex agent ID `a5703410b6f1c0da3`). Operator accepted the verdict in lieu of a re-dispatch.
**Approvers exactly `{Victor}`.** Codex review verdicts do NOT constitute operator approval at any boundary.

This handoff is preserved verbatim through every subsequent deployment-runbook subphase and never edited after codification.

---

## §0 — Background

This DESIGN fits in the canonical paperwork chain after:

- `COMM-HUB-RELAY-RUNTIME-DEPLOYMENT-READINESS-DESIGN` (sealed at parent `02e0796…`, codified to `orchestrator/handoffs/COMM-HUB-RELAY-RUNTIME-DEPLOYMENT-READINESS-DESIGN.md`, 416 lines) — the readiness paperwork gate.
- `COMM-HUB-RELAY-RUNTIME-DEPLOYMENT-PREFLIGHT-DESIGN` (sealed at parent `a9d1a31…`, codified to `orchestrator/handoffs/COMM-HUB-RELAY-RUNTIME-DEPLOYMENT-PREFLIGHT-DESIGN.md`, 384 lines) — the paperwork-and-attestation STATE check, repeatable at every future deploy-related phase open.

This RUNBOOK design adds the **executable procedure layer**: the step-by-step deploy command sequence, the rollback procedure, the post-deploy verification, the evidence capture map, and the STOP table — none of which run today, but which must be codified before any `RAILWAY-DEPLOY-PLAN` or deploy-execution phase can be considered.

The runbook is to deploy what the preflight is to readiness: preflight checks state, runbook executes procedure. Runbook is **not** a STATE check — it is a procedure script that fires only after Gate 5 deploy approval, and only after a fresh preflight PASS, both for the named SHA pair.

**Critical pre-existing blockers discovered during inspection** (codified in §3 and §13):

1. Relay `package.json` has **no `scripts` section** — no `start` script. Railway has no inferred run command.
2. **No `railway.toml` / `railway.json` / `nixpacks.toml` / `Dockerfile` / `Procfile`** at Relay repo root.
3. Per RE-9 + `src/index.js` lines 10-18 + sealed Phase F §9: production boot via `src/index.js` will fail closed at boot Stage 13 with `rate-limit-state-missing-operator-phase-id` because `operatorPhaseId` is intentionally NOT read from `process.env`. A future canonical config source must provide `operatorPhaseId` via a non-env mechanism BEFORE deploy is even considered.
4. `runtimeConfig.allowlistedDiscordHostnames` is not populated by `src/index.js`. Without it, the Stage 15 G-3 auto-wire's `createEgressAllowlistHook` will fail with `phase-g-wiring-failed` (halt class 32).

These are not runbook bugs — they are sealed fail-closed invariants. The runbook must NOT attempt to deploy Relay until separately gated future phases introduce the non-env config-injection mechanism and the Discord-only hostname allowlist population that lift blockers 3 and 4 without violating the canonical forbidden-env policy. Until those phases seal and merge, the runbook explicitly STOPs.

---

## §1 — Repo baseline (inspection time)

- Parent repo: `/Users/victormercado/claude-tradingview-mcp-trading`
  - HEAD = origin/main = live remote `refs/heads/main` = `eb9cc28548d193d0d557fd06d2ebc994cdf25956` (DEPLOYMENT-PREFLIGHT-DESIGN-SPEC-CLOSEOUT-SYNC) at design authoring time.
  - Working tree: only the two authorized untracked carve-outs (`orchestrator/handoffs/evidence/` + `position.json.snap.20260502T020154Z`).
- Relay repo: `/Users/victormercado/code/agent-avila-relay`
  - HEAD = origin/main = live remote `refs/heads/main` = `f232c328284e687511a794dc89358bbc0cd275d1` (G-5-RUN-10-REPAIR).
  - Working tree: clean.
  - `package.json#engines.node`: `>=22.0.0 <23.0.0`.
  - `package.json#main`: `src/index.js`.
  - `package.json#scripts`: **missing** (blocker 1).
  - No `railway.toml` / `railway.json` / `nixpacks.toml` / `Dockerfile` / `Procfile` at repo root (blocker 2).
- Phase G code completion: ACHIEVED at terminal RUN-11 PASS `19/19/0/0`.
- Relay runtime: code sealed; no container/process deployed or running; **DORMANT**.
- Autopilot: **DORMANT** (verified at `eff4dd22…`).
- Discord activation: **NO**.
- Deployment: **NOT authorized**.
- Approvers exactly `{Victor}`.

---

## §2 — Runbook objective

Codify a **procedural script** that would, if and only if every gate cleared, walk an operator (Victor) through a single named Relay deploy from a named (parent SHA, Relay SHA) pair to the named Railway service `agent-avila-relay`, with byte-exact verification at every step, an authorized rollback path that requires zero new approval, and an evidence-capture map that is reproducible.

The runbook is:

- **Per-deploy** (not repeatable like preflight; each invocation consumes one Gate 5 approval naming one SHA pair).
- **Fail-closed at every step** (any verification failure halts the runbook and triggers the rollback procedure).
- **Names-only for env vars** (no value reads; no value prints; no value logs).
- **Local + read-only verification** (no production DB / Kraken / trading touch; no `MANUAL_LIVE_ARMED`; no Autopilot change; no CEILING-PAUSE change).
- **One Railway service** (`agent-avila-relay`; the historical `agent-avila-hermes` is excluded).
- **One direction** (forward = deploy; reverse = rollback to the last known-good Railway deployment ID, which is the prior deploy's ID or the "no deployment" empty-service state).
- **Operator-driven** (every Railway action is executed by Victor; Claude composes runbook commands but does not invoke them).

---

## §3 — Pre-deploy required state

Before the runbook's first command is allowed to run, the following must all be true. Each is verified once at runbook start (in addition to the preflight gate's STATE check that already cleared):

1. **Preflight gate PASS** (a fresh `COMM-HUB-RELAY-RUNTIME-DEPLOYMENT-PREFLIGHT-EXECUTE` phase has CLEARED in the same chat session, naming this same SHA pair, and no parent/Relay seal has advanced since).
2. **Gate 5 deploy approval** named: parent SHA, Relay SHA, Railway service (`agent-avila-relay`), env-var name list (no values), rollback target, verification steps. This approval is single-use.
3. **Three-way SHA consistency** for both parent and Relay: local HEAD = origin/main = live remote `refs/heads/main` for both repos, all three equal to the SHAs named in the Gate 5 approval.
4. **Sealed handoff byte-identity** for the deployment-readiness + deployment-preflight + deployment-runbook handoffs at their codified SHAs.
5. **`scripts.start` exists in Relay `package.json`** OR an equivalent declared run command exists in a sealed `railway.toml` / `nixpacks.toml` / `Procfile` at Relay HEAD. **Currently NOT satisfied.** A separately gated future phase must add this. The runbook's command-1 explicitly STOPs if this is absent.
6. **`operatorPhaseId` non-env injection mechanism** exists and is exercised by `src/index.js` (or whatever the deploy entry becomes). **Currently NOT satisfied** per `src/index.js:10-18` + RE-9 + sealed Phase F §9. The runbook STOPs.
7. **`runtimeConfig.allowlistedDiscordHostnames`** is populated with the canonical Discord-only hostname set (e.g. `discord.com`, `gateway.discord.gg` — exact list to be sealed by a `RELAY-RUNTIME-EGRESS-ALLOWLIST-DESIGN`). **Currently NOT satisfied.** The runbook STOPs.
8. **Gate 10 install approval** at `40f3137e…` is recorded as CONSUMED (does NOT itself authorize deploy; check is "Gate 10 prereq is recorded as honored, but the deploy approval is the separate Gate 5").
9. **Relay working tree clean** at the named Relay SHA.
10. **Parent working tree contains only authorized untracked carve-outs** at the named parent SHA.
11. **Autopilot remains DORMANT** at `eff4dd22…`.
12. **CEILING-PAUSE state is not in PAUSED state.**
13. **No Discord bot session is already running** (single-instance discipline). The runbook attests "no prior Relay container exists on Railway" before the first deploy, or "the prior container is the named rollback target" for re-deploy.

Pre-deploy required state is verified by Claude composing a single Bash command sequence (`git rev-parse`, `git status --short`, `git ls-files`, `git rev-list`, `git diff`, file existence checks via `test -f`, no Railway API calls) and presenting the output to Victor for inspection. **No Railway action.**

---

## §4 — Target service identity

- **Railway service name:** `agent-avila-relay` (renamed from historical `agent-avila-hermes` per sealed `RAILWAY-SERVICE-RENAME-HERMES-TO-RELAY-DESIGN`).
- **Project:** the operator's existing Railway project that hosts trading runtime + Relay (named in Gate 5 approval).
- **Environment:** `production` (or whatever the operator declares; default `production`).
- **GitHub source:** `relentlessvic/agent-avila-relay` `main`.
- **Service kind:** Node web service (will run a one-way Discord bot client; no inbound HTTP).

**Identity verification command (composed but not run by Claude):**

```
railway link --project <project-id> --service agent-avila-relay && railway status
```

The expected output must include `Service: agent-avila-relay` (exact name match). The runbook STOPs if the service name returned is `agent-avila-hermes` (means the rename has not been performed yet; rename is operator-led per sealed `RAILWAY-SERVICE-RENAME-HERMES-TO-RELAY-DESIGN`).

---

## §5 — Target commit / SHA requirements

- **Parent SHA target:** named in Gate 5 approval. Verified equal to parent local HEAD = origin/main = live remote `refs/heads/main`.
- **Relay SHA target:** named in Gate 5 approval. Verified equal to Relay local HEAD = origin/main = live remote `refs/heads/main`.
- **Deploy-target commit on Railway:** Relay's main branch HEAD on GitHub (Railway pulls from there). Verified by reading the Railway dashboard's "current deployment commit" after the deploy completes (`railway status` or the dashboard UI; operator-led inspection).
- **No re-deploy with the same SHA:** the runbook records the prior deploy's commit SHA on Railway. If the named Relay SHA equals the current Railway-deployed commit, the runbook STOPs (idempotency check; deploy was already performed).
- **No fast-forward bypass:** if the named Relay SHA is not reachable from `origin/main`, the runbook STOPs.

---

## §6 — Node/runtime requirements

- **Deploy-target Node version:** 22.x (must satisfy `engines.node = ">=22.0.0 <23.0.0"`).
- **Verification:** the Railway service's runtime Node version is verifiable via `railway logs --service agent-avila-relay` (look for the boot stage's Node version log line) OR by inspecting the Railway dashboard's environment runtime config. Operator-led.
- **Local Node mismatch is allowed** (Victor's local Node is v20.20.2; this is a pre-existing mismatch documented in the preflight design and does NOT block deploy because deploy runs on Railway's Node, not local Node).
- **STOP on Node mismatch on Railway:** if Railway's reported Node version is not 22.x (e.g. it falls back to a default that violates `engines.node`), the runbook halts and triggers rollback.

---

## §7 — Env/secrets inventory requirements

**Names only. Values never read, never logged, never printed. Inventory is composed by Claude from sealed `src/config.js` ground truth.**

### §7.1 Baseline always-required (8 names, per sealed PREFLIGHT-DESIGN §8.1)

- `DISCORD_BOT_TOKEN`
- `RELAY_MODE`
- `HERMES_VERSION`
- `LOG_LEVEL`
- `LOG_DESTINATION`
- `MESSAGE_STORE_PATH`
- `PUBLISH_LOG_PATH`
- `CEILING_PAUSE_SIGNAL_PATH`

### §7.2 Conditional (1 name)

- `DRY_RUN_LOG_PATH` — required only when `RELAY_MODE=dry_run`.

### §7.3 Forbidden inventory (canonical 3-layer)

Per `src/config.js:72-139` blocklists and override, as enforced by `isForbiddenEnvVar()` at `src/config.js:203+` (sealed runtime detector):

- **Layer 1 (22 exact names):**
  - Database: `DATABASE_URL`, `DATABASE_PUBLIC_URL`, `PGUSER`, `PGPASSWORD`, `PGHOST`, `PGPORT`, `PGDATABASE`.
  - Trading: `KRAKEN_API_KEY`, `KRAKEN_API_SECRET`, `MANUAL_LIVE_ARMED`.
  - Source-control / CI: `GITHUB_TOKEN`, `RAILWAY_TOKEN`, `CI`, `GITHUB_ACTIONS`, `GITLAB_CI`.
  - LLM providers: `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GOOGLE_API_KEY`, `GEMINI_API_KEY`.
  - Cloud providers: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `GOOGLE_APPLICATION_CREDENTIALS`.
- **Layer 2 (11 prefixes):** `POSTGRES_`, `KRAKEN_`, `BOT_`, `DASHBOARD_`, `CIRCLE_`, `TRAVIS_`, `GCP_`, `AZURE_`, `STRIPE_`, `TWILIO_`, `SENDGRID_`.
- **Layer 3 (4 credential markers):** `_KEY`, `_SECRET`, `_PASSWORD`, `_TOKEN`.
- **Sole override:** `DISCORD_BOT_TOKEN` (whitelisted by `ALLOWED_CREDENTIAL_NAME_OVERRIDES` at `src/config.js:133`).

### §7.4 Inventory composition rule

Claude composes the list of names from `src/config.js` + the Gate 5 approval text + the Railway service's env-var name listing (operator-pasted, sanitized: names only, no values). Claude does NOT request or accept values.

### §7.5 Verification rule

The Railway service's env-var name set, exactly:

- Includes all 8 baseline names.
- Includes `DRY_RUN_LOG_PATH` if and only if `RELAY_MODE=dry_run` (Claude reads only `RELAY_MODE`'s name presence, not its value; the value is operator-attested).
- Excludes every Layer 1 name.
- Excludes every Layer 2 prefix.
- Excludes every Layer 3 marker EXCEPT `DISCORD_BOT_TOKEN`.
- The Railway env-var name listing is operator-pasted into chat. Claude never queries Railway directly for env vars.

### §7.6 STOP conditions

- Any forbidden name present → STOP.
- Any baseline name missing → STOP.
- `DRY_RUN_LOG_PATH` missing while `RELAY_MODE=dry_run` → STOP.

---

## §8 — Runtime config prerequisites

These are sealed runtime invariants from `src/runtime/boot.js`:

1. **`operatorPhaseId` non-env injection** — currently a deploy-blocker. The runbook's command-0 (precondition check) verifies a sealed `RELAY-RUNTIME-CONFIG-INJECTION-DESIGN` (or equivalent) is merged at the named Relay SHA and that `src/index.js` (or its successor entry point) constructs `operatorPhaseId` via the new mechanism. If the check fails: STOP.
2. **`runtimeConfig.allowlistedDiscordHostnames`** — currently a deploy-blocker. The runbook verifies the new entry point passes a non-empty Discord-only hostname allowlist that satisfies `createEgressAllowlistHook` per-element non-empty-string validation. If the check fails: STOP.
3. **`phaseGStubMode: 'disabled'`** at production — must remain the default; `src/index.js` must not override.
4. **`validateOnly: true` Phase G non-activation guard** at Stage 15 default-wiring — the runbook explicitly verifies this guard is preserved at the named Relay SHA (`grep -n "validateOnly: true" src/runtime/boot.js` returns at least one match at the Stage 15 G-3 default-wiring block).
5. **Phase G hook reachability** — same as preflight §3 G-N reachability check (Phase G default-wiring is present at sealed `src/runtime/boot.js` Stage 15 lines 543-610).
6. **No new Discord clients on boot** beyond the single Stage 15-wired client.

---

## §9 — Future deployment procedure design

**This section codifies the procedure but does NOT authorize execution.** Every command in this section is composed-and-stopped: Claude prints the command, Victor inspects, Victor runs it himself (or instructs Claude to run it in a separately approved Bash invocation). No command runs by virtue of this design being committed.

### §9.1 Command sequence (composed; not executed)

| # | Command (template) | Run by | Verifies |
|---|---|---|---|
| 0 | `git rev-parse HEAD` (parent + Relay) | Claude (read-only) | local SHA matches Gate-5-named SHA |
| 1 | `git rev-list --count <SHA>..origin/main` (parent + Relay) | Claude (read-only) | SHA is reachable + at tip |
| 2 | `git status --short` (parent + Relay) | Claude (read-only) | clean trees |
| 3 | `test -f package.json && grep '"start"' package.json` (Relay) | Claude (read-only) | start script exists |
| 4 | `grep -n "operatorPhaseId" src/index.js` (Relay) | Claude (read-only) | non-env injection confirmed |
| 5 | `grep -n "allowlistedDiscordHostnames" src/index.js` (Relay) | Claude (read-only) | allowlist populated |
| 6 | `grep -n "validateOnly: true" src/runtime/boot.js` (Relay) | Claude (read-only) | Phase G non-activation guard preserved |
| 7 | `railway whoami && railway status` (operator workstation) | **Victor** | logged in, service `agent-avila-relay` reachable |
| 8 | `railway variables --kv` redacted to names only, then pasted into chat | **Victor** | env-name verification per §7 |
| 9 | `railway up --service agent-avila-relay` OR `git push railway main` (whichever the rename design specifies) | **Victor** | actual deploy |
| 10 | `railway logs --service agent-avila-relay --deployment <new-id>` | **Victor** | boot stages 1-15 reach "ready" without halt class != 0 |
| 11 | `railway status --service agent-avila-relay` | **Victor** | service is RUNNING; deployment ID captured |

### §9.2 Execution boundary

**Steps 0-6 are local read-only checks.** Steps 7-11 are Railway-side; **only Victor executes them**.

Claude's role is:

- Composing every command verbatim.
- Composing every `expected output` regex for verification.
- Reading the output Victor pastes back, comparing to expected, and emitting PASS/FAIL.
- On FAIL: stop the runbook, emit the rollback procedure from §11.

**Claude never executes steps 7-11. The runbook design forbids Claude from invoking `railway` CLI.**

---

## §10 — Future post-deploy verification design

After step 11 returns "service RUNNING", the post-deploy verification phase runs (also composed-and-stopped):

1. **Service identity check.** `railway status` returns `Service: agent-avila-relay` (exact).
2. **Commit SHA check.** Railway's "current deployment commit" equals the named Relay SHA from Gate 5.
3. **Node version check.** `railway logs` first line includes `node v22.x.x` (regex `node v22\.`).
4. **Boot stage completion check.** `railway logs` contains every boot stage transition log line from Stage 1 to Stage 15, in order, no halt class != 0.
5. **Discord gateway IDENTIFY check.** **NOT in this runbook.** The first real Discord IDENTIFY is itself a separately gated future event (Stage 7 dry-run + Stages 8-10b activation cascade). The post-deploy verification confirms only that the container is RUNNING with `validateOnly: true` semantics preserved; no actual Discord network reach occurs at this layer.
6. **Idempotency check.** Re-deploying the same Relay SHA must STOP (no-op); the runbook records the deploy ID so a subsequent re-attempt is blocked at command 0.
7. **Single-instance check.** No prior Relay container is RUNNING. If Railway shows two running deployments for `agent-avila-relay`, the runbook STOPs and rolls back the new one immediately.

**Evidence capture during verification:** see §12.

---

## §11 — Future rollback procedure design

**Rollback is authorized by the Gate 5 approval itself.** Victor does not need a new approval to rollback this deploy. Rollback is single-step and forward-only-reversible (it never deploys forward; only reverts to the last known-good state).

### §11.1 Rollback triggers (any of)

- Any §10 verification FAIL.
- Boot halt class != 0 in `railway logs`.
- Two running deployments for `agent-avila-relay`.
- Victor invokes "rollback" in chat for any reason.
- Discord-side anomaly (Relay is NOT supposed to be reading Discord, but if any halt-on-anomaly trigger fires, rollback applies).
- CEILING-PAUSE state changes from clear to PAUSED during deploy.

### §11.2 Rollback procedure (composed-and-stopped; Victor executes)

| # | Command | Verifies |
|---|---|---|
| R0 | `railway logs --service agent-avila-relay --deployment <new-id> > evidence/RUNBOOK-DEPLOY-FAIL-<ts>/railway-logs-failed.txt` | failure context captured |
| R1 | `railway status --service agent-avila-relay --json > evidence/RUNBOOK-DEPLOY-FAIL-<ts>/railway-status-pre-rollback.json` | pre-rollback state captured |
| R2 | `railway rollback --service agent-avila-relay --deployment <last-known-good-id>` OR `railway redeploy --service agent-avila-relay --deployment <last-known-good-id>` (exact command sealed by a sub-design after operator confirms Railway CLI semantics) | rollback executed |
| R3 | `railway status --service agent-avila-relay` | new active deployment ID = `<last-known-good-id>` |
| R4 | `railway logs --service agent-avila-relay --deployment <last-known-good-id>` | active container is the known-good one OR service is empty if there was no prior good deploy |

### §11.3 Special case — first-ever Relay deploy fails

There is no prior known-good deployment. The rollback is "delete the failed deployment so the service returns to the no-running-container state". The runbook records this as `ROLLBACK-TO-EMPTY-SERVICE` and STOPs all further automation until operator decides.

### §11.4 Post-rollback state

- Service identity preserved (`agent-avila-relay`).
- Relay HEAD on GitHub `main` unchanged (rollback is at Railway only; the runbook does not git-revert).
- Relay sealed handoffs unchanged.
- Parent sealed handoffs unchanged.
- Evidence captured at `orchestrator/handoffs/evidence/RUNBOOK-DEPLOY-FAIL-<ts>/` (untracked carve-out).
- A separate failure-investigation phase (`COMM-HUB-RELAY-RUNTIME-DEPLOYMENT-RUNBOOK-FAILURE-INVESTIGATION-DESIGN`) is required before any re-deploy attempt.

---

## §12 — Evidence capture design

**Evidence directory:** `orchestrator/handoffs/evidence/RUNBOOK-DEPLOY-<ts>/` (parent repo, untracked, pre-authorized carve-out per the sealed evidence-untracked rule).

### §12.1 Files captured per deploy attempt

| File | Source | Purpose |
|---|---|---|
| `parent-head-pre.txt` | `git rev-parse HEAD` (parent) | parent SHA at deploy start |
| `parent-head-post.txt` | `git rev-parse HEAD` (parent) | parent SHA at deploy end (must equal pre) |
| `relay-head-pre.txt` | `git rev-parse HEAD` (Relay) | Relay SHA at deploy start |
| `relay-head-post.txt` | `git rev-parse HEAD` (Relay) | Relay SHA at deploy end |
| `parent-status-pre.txt` | `git status --short` (parent) | parent working tree pre |
| `parent-status-post.txt` | `git status --short` (parent) | parent working tree post |
| `relay-status-pre.txt` | `git status --short` (Relay) | Relay working tree pre |
| `relay-status-post.txt` | `git status --short` (Relay) | Relay working tree post |
| `gate5-approval-text.txt` | operator-pasted | full text of Gate 5 approval |
| `preflight-clearance-record.txt` | operator-pasted | reference to fresh preflight PASS SHA |
| `env-name-inventory-railway.txt` | operator-pasted (Railway CLI output, names only) | Railway-side env-var name set |
| `env-name-inventory-expected.txt` | Claude-composed | expected names per §7 |
| `env-name-diff.txt` | `diff` of the two | name-set difference (empty if PASS) |
| `railway-status-pre.json` | `railway status --json` (operator-pasted) | Railway-side state pre |
| `railway-status-post.json` | `railway status --json` (operator-pasted) | Railway-side state post |
| `railway-logs-deploy.txt` | `railway logs --deployment <new-id>` (operator-pasted) | boot stages 1-15 trace |
| `railway-deploy-id.txt` | extracted from `railway status` | new deployment ID |
| `railway-rollback-target-id.txt` | extracted from prior `railway status` | last-known-good deployment ID (empty if first deploy) |
| `runbook-start.txt` | `date -u +%Y-%m-%dT%H:%M:%SZ` | UTC timestamp |
| `runbook-end.txt` | `date -u +%Y-%m-%dT%H:%M:%SZ` | UTC timestamp |
| `runbook-result.txt` | `PASS` / `FAIL-ROLLBACK-OK` / `FAIL-ROLLBACK-INCOMPLETE` | summary |
| `package-files-sha256-pre.txt` | `sha256sum package.json package-lock.json` (Relay) | byte-identity pre |
| `package-files-sha256-post.txt` | `sha256sum package.json package-lock.json` (Relay) | byte-identity post (must equal pre) |
| `src-touched-sha256-pre.txt` | `find src -type f -name "*.js" \| xargs sha256sum` (Relay) | byte-identity pre |
| `src-touched-sha256-post.txt` | same | byte-identity post (must equal pre) |

### §12.2 Evidence discipline

- **No secrets in evidence.** `gate5-approval-text.txt` quotes the approval (names only). `env-name-inventory-railway.txt` is names only (operator pre-redacts values before pasting). `DISCORD_BOT_TOKEN` is referenced by name only.
- **Evidence remains untracked and uncommitted.** A future closeout phase may reference the evidence directory path but must not stage or commit it.

---

## §13 — STOP conditions

Any one of these halts the runbook immediately and triggers rollback or pre-deploy-halt. Each is independent.

1. Pre-deploy state §3 check fails (any of 13 sub-checks).
2. Parent SHA != Gate-5-named parent SHA.
3. Relay SHA != Gate-5-named Relay SHA.
4. Three-way SHA inconsistency for parent OR Relay.
5. Sealed handoff byte-identity mismatch.
6. Relay `package.json#scripts.start` missing AND no equivalent Railway run config sealed.
7. `operatorPhaseId` non-env injection mechanism not merged at named Relay SHA.
8. `runtimeConfig.allowlistedDiscordHostnames` not populated by Relay entry point at named SHA.
9. `validateOnly: true` Phase G non-activation guard not present at named Relay SHA.
10. Railway service name != `agent-avila-relay`.
11. Project not the operator's named project.
12. Any Layer 1 / Layer 2 / Layer 3 forbidden env name is present in the Railway env-var name set (except `DISCORD_BOT_TOKEN` override).
13. Any baseline §7 env name is missing from the Railway env-var name set.
14. `DRY_RUN_LOG_PATH` missing while `RELAY_MODE=dry_run`.
15. Railway runtime Node version is not 22.x.
16. Two running Relay deployments observed.
17. Boot halt class != 0 in `railway logs`.
18. Any §10 post-deploy verification FAIL.
19. CEILING-PAUSE state changes from clear to PAUSED during deploy.
20. Autopilot state changes from DORMANT during deploy.
21. Discord bot token leaks into any log surface (any `_TOKEN` value appears in any captured evidence).
22. The named Relay SHA equals the current Railway-deployed commit (idempotency block).
23. The named Relay SHA is not reachable from `origin/main`.
24. Any sealed handoff is modified by the runbook itself.
25. The runbook attempts to execute any command not in its composed list.
26. The runbook attempts to read or print any env var value.
27. The runbook attempts to read or print `DISCORD_BOT_TOKEN`.
28. The runbook attempts to invoke Discord REST or gateway.
29. The runbook attempts to touch DB / Kraken / `MANUAL_LIVE_ARMED`.
30. The runbook attempts to modify Autopilot / CEILING-PAUSE.

---

## §14 — Non-authorization clauses

This DESIGN does NOT authorize:

- Deploy execution.
- Preflight execution.
- Any Railway CLI / API / dashboard action by Claude.
- Any `railway` command being run by Claude.
- Any Discord platform action (bot creation, token mint, server invite, channel post, REST send, gateway IDENTIFY).
- Reading or printing any secret, env var value, `.env` file, or Discord bot token.
- Starting Relay locally or remotely.
- Calling `.login()` on any Discord client.
- DB / Kraken / `MANUAL_LIVE_ARMED` / trading / Autopilot / CEILING-PAUSE / armed-trading flag changes.
- Stage 5 install resumption (CONSUMED at `40f3137e…`; separately gated; fresh Gate-10 RED-tier required if ever reopened).
- Stages 7-10b activation cascade.
- Any new handoff creation by this design phase (the codification SPEC creates this handoff; future closeout-sync does not).
- Editing any sealed handoff (including this one after it seals).
- Editing `APPROVAL-GATES.md` or `COMM-HUB-RELAY-RULES.md`.
- Editing `src/index.js` or `src/runtime/boot.js` or `src/config.js` or any sealed source.
- Committing or pushing any file (the codification SPEC commits this handoff; this DESIGN itself does not).
- Running tests / `node --test` / `npm install` / `npm ci`.
- Staging or committing RUN-10/RUN-11 evidence (or any other evidence).
- Opening any sub-design phase (e.g. `RELAY-RUNTIME-CONFIG-INJECTION-DESIGN`, `RELAY-RUNTIME-EGRESS-ALLOWLIST-DESIGN`) — those are separately operator-opened future phases.
- Authorizing the `RAILWAY-DEPLOY-PLAN` phase or any deploy-execution phase.
- Recursive paperwork beyond this design + its codification + optional Rule-1 seal-mirror.

**Approvers exactly `{Victor}`.** Codex review verdicts do NOT constitute operator approval.

---

## §15 — Codex DESIGN-ONLY review record

Codex DESIGN-ONLY review CLEARED: round-1 PASS (33/33 review goals; no required edits; Codex agent ID `a5703410b6f1c0da3`). Operator accepted the verdict in lieu of a re-dispatch.

The 33 review goals verified by Codex:

1. Conversation-only; no files written.
2. Relay DORMANT preserved.
3. Deployment NOT authorized preserved.
4. Stage 5 + Stages 7-10b preserved as separately gated.
5. Approvers exactly `{Victor}`.
6. §3 enumerates 13 pre-deploy required-state sub-checks.
7. §3 STOPs on all 4 current blockers (`scripts.start`; Railway run config; `operatorPhaseId` non-env injection; `allowlistedDiscordHostnames`).
8. §4 names Railway service exactly `agent-avila-relay`.
9. §4 excludes historical `agent-avila-hermes`.
10. §5 per-deploy single-use parent SHA + Relay SHA pair.
11. §5 idempotency block on redeploying same Relay SHA.
12. §6 Railway-side Node 22.x because `engines.node >=22.0.0 <23.0.0`.
13. §6 treats local Node v20.20.2 as documented, not deploy-blocking.
14. §7 cites `src/config.js:72-139` blocklists/override AND `isForbiddenEnvVar()` at `src/config.js:203+`.
15. §7 lists 8 baseline names.
16. §7 lists 1 conditional name (`DRY_RUN_LOG_PATH` only when `RELAY_MODE=dry_run`).
17. §7 names-only env inventory rule (no values read/printed/logged/requested).
18. §7 canonical forbidden-env: 22 Layer 1 + 11 Layer 2 + 4 Layer 3 + sole `DISCORD_BOT_TOKEN` override.
19. §8 codifies all 5 runtime config prerequisites.
20. §9 command table separates Claude-composed vs Victor-executed.
21. §9 forbids Claude from invoking Railway CLI.
22. §10 post-deploy explicitly EXCLUDES Discord gateway IDENTIFY (Stage 7+).
23. §11 rollback authorized by Gate 5 approval itself; no new approval needed.
24. §11 handles first-deploy-fails with rollback-to-empty-service.
25. §12 evidence map captures all required artifacts.
26. §12 evidence remains untracked and uncommitted.
27. §13 has 30 independent STOP conditions.
28. §13 STOPs cover all required categories (state, SHA, service identity, env policy, Node version, runtime invariants, single-instance, secret leaks, idempotency, scope discipline).
29. §14 non-authorization covers all required categories.
30. Next phase is DESIGN-SPEC only (`COMM-HUB-RELAY-RUNTIME-DEPLOYMENT-RUNBOOK-DESIGN-SPEC`, Mode 3 DOCS-ONLY).
31. Design does NOT authorize `RAILWAY-DEPLOY-PLAN`, deploy execution, runtime config implementation, egress allowlist implementation, Stage 5, Discord activation.
32. Unicode discipline note: `§` is acceptable in handoff `.md` (existing pattern); forbidden only in new `.js` source comments (none added by this paperwork phase). `→` (U+2192) and `§` (U+00A7) must not enter source comments by any downstream phase.
33. No required design edits identified.

---

## §16 — Recommended next step

If this DESIGN-SPEC seals successfully:

1. **Optional Rule-1 seal-mirror** `COMM-HUB-RELAY-RUNTIME-DEPLOYMENT-RUNBOOK-DESIGN-SPEC-CLOSEOUT-SYNC` (DOCS-ONLY / Mode 3) — 3 parent-repo status-doc updates only.

**Explicitly NOT the next step:**

- `RAILWAY-DEPLOY-PLAN` (separately gated; requires the runbook codified first AND the four §3 blockers all lifted by separately authorized future phases).
- Any deploy execution phase.
- Any `RELAY-RUNTIME-CONFIG-INJECTION-DESIGN` or `RELAY-RUNTIME-EGRESS-ALLOWLIST-DESIGN` (these are independent operator-led future phases that lift the §3 blockers; the runbook calls them out but does not open them).
- Any Railway CLI install / rename / config phase by Claude.

---

## §17 — Carry-forward state

- Phase G code completion remains ACHIEVED at terminal RUN-11 PASS `19/19/0/0`.
- F-HALT-SMOKE end-state preserved at Phase G terminal `19/19/0/0`.
- RUN-10 evidence + RUN-11 evidence remain untracked and uncommitted at `orchestrator/handoffs/evidence/F-HALT-SMOKE-RUN-10/` + `F-HALT-SMOKE-RUN-11/` respectively (18 files each).
- Relay HEAD preserved at `f232c328284e687511a794dc89358bbc0cd275d1` (G-5-RUN-10-REPAIR seal).
- Relay working tree clean.
- Relay runtime code exists and is sealed, but no Relay container or process is deployed or running; Relay remains DORMANT.
- Autopilot DORMANT (verified at `eff4dd22…`) preserved.
- Discord activation: NO.
- Deployment: NOT authorized.
- Sealed Gate 10 install approval at `40f3137e…` remains CONSUMED and non-reusable; fresh Gate-10 RED-tier required if ever reopened.
- Approvers exactly `{Victor}`.
- Carve-outs preserved untracked: `orchestrator/handoffs/evidence/` + `position.json.snap.20260502T020154Z`.

---

## §18 — Reference anchors

- Sealed DEPLOYMENT-READINESS-DESIGN: `orchestrator/handoffs/COMM-HUB-RELAY-RUNTIME-DEPLOYMENT-READINESS-DESIGN.md` (416 lines; sealed at parent `02e0796…`).
- Sealed DEPLOYMENT-PREFLIGHT-DESIGN: `orchestrator/handoffs/COMM-HUB-RELAY-RUNTIME-DEPLOYMENT-PREFLIGHT-DESIGN.md` (384 lines; sealed at parent `a9d1a31…`).
- Sealed G-DESIGN: `orchestrator/handoffs/COMM-HUB-RELAY-RUNTIME-G-DESIGN.md` (sealed at parent `66af7df…`).
- Sealed G-READINESS-DESIGN: sealed at parent `95da6ef…`.
- Sealed G-3 DESIGN: sealed at parent `29ea5a4…`.
- Sealed G-4 DESIGN: sealed at parent `705416e3…`.
- Sealed RAILWAY-SERVICE-RENAME-HERMES-TO-RELAY-DESIGN: `orchestrator/handoffs/RAILWAY-SERVICE-RENAME-HERMES-TO-RELAY-DESIGN.md`.
- Sealed STAGE5-PRECONDITIONS: `orchestrator/handoffs/COMM-HUB-RELAY-STAGE5-PRECONDITIONS.md`.
- Sealed INSTALL-RELAY-CHECKLIST: `orchestrator/handoffs/COMM-HUB-INSTALL-RELAY-CHECKLIST.md`.
- Sealed HERMES-STAGE5-PARTIAL-INSTALL-RECORD: `orchestrator/handoffs/COMM-HUB-HERMES-STAGE5-PARTIAL-INSTALL-RECORD.md`.
- APPROVAL-GATES: `orchestrator/APPROVAL-GATES.md` (out-of-scope for this design).
- COMM-HUB-RELAY-RULES: `orchestrator/COMM-HUB-RELAY-RULES.md` (out-of-scope for this design).
- Relay sealed source anchors: `package.json#engines.node`, `package.json#main`, `src/index.js` lines 10-18 (operatorPhaseId fail-closed), `src/runtime/boot.js` Stage 13 + Stage 15 default-wiring + `validateOnly: true` guard, `src/config.js:72-139` blocklists, `src/config.js:203+` `isForbiddenEnvVar()`.

---

**End of permanent SAFE-class handoff.**

This handoff is preserved verbatim through every subsequent deployment-runbook subphase and never edited after codification. Approvers exactly `{Victor}`. Codex review verdicts do NOT constitute operator approval.
