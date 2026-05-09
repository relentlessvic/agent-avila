# Railway Service Rename Hermes-to-Relay Design (canonical SAFE-class)

> **DOCS-ONLY ARTIFACT.** This document is the canonical SAFE-class record of the RAILWAY-SERVICE-RENAME-HERMES-TO-RELAY-DESIGN Phase 1 (DESIGN-ONLY conversation-only) and is persisted by Phase 2 RAILWAY-SERVICE-RENAME-HERMES-TO-RELAY-DESIGN-SPEC (DOCS-ONLY, Mode 3). It does **NOT** perform the Railway rename, does **NOT** authorize Railway commands, does **NOT** authorize deploy / DB / migrations / tests / live trading / `MANUAL_LIVE_ARMED` changes / Autopilot activation / Relay runtime activation / external Hermes Agent (Nous/OpenRouter) setup / Stage 5 Steps 14-21 install resumption / schedulers / cron / webhooks / MCP installs / Discord bot activation / background automation / memory-file edits / additional file changes.
>
> **Canonical authority:** `orchestrator/NEXT-ACTION.md` and `orchestrator/NEXT-ACTION-SELECTOR.md` (per `HANDOFF-RULES.md`). If this document ever conflicts with either canonical source, the canonical source wins.
>
> **No packet substitutes for in-session operator approval** (per `orchestrator/APPROVAL-GATES.md`).

**Codification phase:** `RAILWAY-SERVICE-RENAME-HERMES-TO-RELAY-DESIGN-SPEC` (Phase 2; DOCS-ONLY Mode 3)
**Source design phase:** `RAILWAY-SERVICE-RENAME-HERMES-TO-RELAY-DESIGN` (Phase 1; DESIGN-ONLY Mode 1; conversation-only; no commit by the design phase itself)
**Cycle name:** RAILWAY-SERVICE-RENAME-HERMES-TO-RELAY (operator-led infrastructure track; DESIGN-ONLY codification phase only — actual Railway rename remains separately gated)
**Cycle goal:** Plan the safe operator-led Railway service rename from `agent-avila-hermes` to `agent-avila-relay` without performing it
**Author:** Claude (Lead Engineer / Builder)
**Date:** 2026-05-09
**HEAD baseline at design time:** `eff4dd22b9b9af038c7ae45de301e60b3f45af98`
**Codex DESIGN-ONLY review:** Round-1 clean PASS on all 17 operator-supplied verification gates.
**Status:** DRAFT — pending Codex DOCS-ONLY review of this codification commit and explicit operator approval before commit.

## §1 — Phase scope and intent

This phase persists the Codex-cleared Phase 1 design as a permanent SAFE-class handoff record so future cycles can cite the rename plan without scanning chat transcripts. Mirrors the established RUN-D-DESIGN-SPEC / CYCLE-2-CLOSEOUT-SPEC / DASH-6-LIVE-BOUNDARY-SMOKE-DESIGN-SPEC / ARC-9-AUTOPILOT-VALIDATION-SPEC pattern (codify a conversation-only design as a durable SAFE-class record).

**In scope (this DOCS-ONLY codification phase):**
- Authoring this record at `orchestrator/handoffs/RAILWAY-SERVICE-RENAME-HERMES-TO-RELAY-DESIGN.md`
- Status doc updates at `orchestrator/STATUS.md`, `orchestrator/CHECKLIST.md`, `orchestrator/NEXT-ACTION.md`
- 4-file commit (1 new SAFE-class record + 3 status doc updates)

**Out of scope:**
- The actual Railway rename (operator-led; separately gated)
- Any Railway CLI / API / dashboard action by Claude
- Any deploy / Railway / production DB / migration / env / `MANUAL_LIVE_ARMED` / live trading / autopilot activation / Relay runtime activation / external Hermes Agent setup / Stage 5 Steps 14-21 resumption
- Any scheduler / cron / webhook / MCP / Discord bot activation / background automation
- Any memory-file edits
- Any safety-policy doc edits
- Any other handoff record edits

## §2 — Renamed object

The Railway service named **`agent-avila-hermes`** (currently an empty service shell on Railway) is the renamed object. Target name: **`agent-avila-relay`**.

**This service IS:**
- A Railway service shell (empty; no runtime running)
- Holds the `DISCORD_BOT_TOKEN` secret variable (Discord bot token; minted during Stage 5 Steps 1-13)
- Was provisioned during Stage 5 Steps 1-13 (recorded at `orchestrator/handoffs/COMM-HUB-HERMES-STAGE5-PARTIAL-INSTALL-RECORD.md`) to anticipate a future Relay runtime
- Sits in the same Railway project as `agent-avila-dashboard` (which is the live production service)

**This service is NOT (operator-required distinction):**
- The production dashboard service `agent-avila-dashboard` (separate service; not affected by this rename)
- The Discord application or bot account (already renamed to "Agent Avila Relay" on the Discord side at the COMM-HUB-RENAME-RELAY-CONTENT Phase A timeframe)
- A GitHub repository (the repo `relentlessvic/agent-avila-relay` was deferred and never created)
- The future Relay runtime (the runtime image / process binary does not yet exist; runtime authoring + Stages 14-21 install resumption remain separately gated)

## §3 — Affected and unaffected surfaces

| Surface | Affected by rename? | Notes |
|---|---|---|
| Railway service display name | YES | Visible name in Railway dashboard changes from `agent-avila-hermes` to `agent-avila-relay`. |
| Railway service URL / domain | LIKELY YES | Railway typically auto-generates service URLs based on the service name. The shell currently has no public traffic, so no consumer relies on the URL. |
| Service ID (internal Railway UUID) | NO | Railway service IDs are stable across rename. Internal references by service ID (e.g., from Railway API or webhooks) remain valid. |
| `DISCORD_BOT_TOKEN` secret value | NO | Railway preserves env / secret variables across service rename. The token value persists. |
| List of secret variables | NO | Variable names (`DISCORD_BOT_TOKEN`) and values preserved. |
| Build / deploy logs label | YES (cosmetic) | Logs from the renamed service show the new name going forward; pre-rename logs retain the old service-name label as historical record. |
| Project linkage | NO | The service stays in the same Railway project. |
| GitHub repo linkage | N/A | The service is not currently linked to a GitHub repo (no Relay runtime image exists). When Relay runtime is later authored at the deferred `relentlessvic/agent-avila-relay` (or renamed equivalent) repo, that linkage will be set up at that future phase. |
| Discord application name | NO | "Agent Avila Relay" Discord app was renamed at Phase A timeframe; Discord side already aligned. |
| Discord bot token validity | NO | Token is independent of Railway service name. Token remains valid post-rename. |
| `agent-avila-dashboard` production service | NO | Different service; unaffected by rename. |
| Production DB / Migration 008 state | NO | Unaffected. |

## §4 — Risks

| Risk | Severity | Mitigation |
|---|---|---|
| Hardcoded `agent-avila-hermes` in undocumented operator scripts/aliases | LOW (operator-side) | Operator audits local shell aliases / `.env.local` / personal scripts before rename |
| Forward-looking deploy commands referencing the old service name | LOW (no Relay runtime exists yet to deploy) | All forward-looking references would be updated in a post-rename docs phase if operator chooses to do so |
| Doc references creating ambiguity post-rename (73 occurrences across 8 .md files) | LOW | Post-rename docs phase can selectively update forward-looking references; SHA-anchored historical references preserve old name verbatim |
| Railway service URL change breaking external consumer | NONE | Service is empty shell; no public traffic |
| Discord bot token invalidation | NONE | Token value preserved across rename |
| `agent-avila-dashboard` production service collateral effect | NONE | Different service; not affected |
| Stage 5 Steps 14-21 deferred-but-eventual resumption confusion | LOW | Stage 5 Steps 14-21 are deferred separately; when resumed (with fresh Gate-10 approval), the deploy target would be the renamed service. The operator's fresh Gate-10 packet at that future time would name the new service explicitly. |
| Memory-file divergence | LOW (operator-side) | Memory file already partially renamed; operator can update post-rename per `MEMORY-RENAME-HERMES-TO-RELAY` precedent |
| Loss of historical context | NONE | Historical Stage 5 install record at `40f3137e842cd60acf1adf17ecc7fe2f0b1b8935` cites the old service name; that record stays preserved verbatim |

**Net risk: LOW.** No production-side dependency. Service is empty. Token preserved. Production dashboard unaffected.

## §5 — Pre-rename operator checklist (operator-side, manual)

Before performing the Railway rename, the operator should verify:

1. **Service state** — Railway dashboard → `agent-avila-hermes` service → confirm:
   - No active runtime / no pending deploys
   - Service shows as empty / idle
   - `DISCORD_BOT_TOKEN` secret variable present (record value masked; verify presence only)
   - No GitHub repo linkage active
   - Service ID captured (for cross-reference if needed)
2. **Production dashboard service unaffected** — verify `agent-avila-dashboard` is in the same Railway project and is a separate service; no shared linkage.
3. **Discord application alignment** — Discord developer portal → app name is "Agent Avila Relay"; bot user matches; no rename needed there.
4. **No undocumented operator aliases** — operator audits personal shell aliases / scripts / `.env.local` for hardcoded `agent-avila-hermes` references.
5. **Capture pre-rename evidence** — Railway dashboard screenshot showing current service name + URL + secret-variable-list (with values masked).

## §6 — Post-rename operator checklist (operator-side, manual)

After performing the Railway rename, the operator should verify:

1. **Service is now named `agent-avila-relay`** — Railway dashboard → confirm new name.
2. **`DISCORD_BOT_TOKEN` secret preserved** — variable still present; value unchanged (verify by checking variable name in dashboard; do NOT print value).
3. **Service URL updated** — if the service had a generated URL, confirm it now reflects new name (Railway auto-updates).
4. **`agent-avila-dashboard` production service still healthy** — open production dashboard URL; verify `/api/health` returns 200; verify Migration 008 state intact (no DB action by Claude; operator visual check only).
5. **Discord bot still valid** — operator can verify by checking the Discord developer portal that the bot user is still in `Agent Avila Hub` server with correct role; no token-rotation needed.
6. **Capture post-rename evidence** — Railway dashboard screenshot showing new service name; secret variable list (values masked).
7. **Decide on doc update scope** — operator decides whether to open a follow-on DOCS-ONLY phase to update forward-looking `agent-avila-hermes` references in the repo; historical / SHA-anchored references preserve verbatim.

## §7 — Rollback path

If the rename causes any confusion or unexpected behavior:

1. **Reverse the Railway rename** — Railway dashboard → service → rename back from `agent-avila-relay` to `agent-avila-hermes`. Railway preserves all secrets / variables / settings across rename in either direction.
2. **No data loss** — service is empty; no runtime running; no deploy artifacts to lose.
3. **Documentation revert** — if any post-rename doc commits landed, `git revert` those commits.
4. **Discord side unaffected** — no rollback needed there; bot user remains valid.

**Estimated rollback time:** under 5 minutes (a Railway dashboard rename + optional `git revert` of any post-rename doc commits). Low-risk reversibility.

## §8 — What must NOT change (preservation list)

- **Discord application name** — already "Agent Avila Relay"; no rename needed there
- **Discord bot token value** — preserved across Railway rename (Railway secret variable preserved)
- **Production `agent-avila-dashboard` Railway service** — separate service; unaffected
- **Production DB credentials** — unchanged
- **`MANUAL_LIVE_ARMED` env var** — unchanged
- **Migration 008 state** — APPLIED at `189eb1be6ef6304d914671bdaedec44d389cf877` preserved
- **N-3 closure** — preserved
- **Stage 5 Gate-10 install approval at `40f3137e842cd60acf1adf17ecc7fe2f0b1b8935`** — CONSUMED preserved
- **Carve-out `position.json.snap.20260502T020154Z`** — never staged, never modified
- **Historical / SHA-anchored references to `agent-avila-hermes` in Stage 5 Partial Install Record** (`COMM-HUB-HERMES-STAGE5-PARTIAL-INSTALL-RECORD.md`) — these are factual past-state references and stay verbatim
- **Phase identifiers committed to git history** (uppercase HERMES literals) — immutable, preserve
- **Self-modification HARD BLOCK** — no autopilot edit to safety-policy docs
- **Phase-loop counter** — remains 0 of 3
- **CEILING-PAUSE state** — broken via ARC-8-UNPAUSE; no re-pause

## §9 — Manual by Victor in Railway UI vs Claude

**Manual by Victor in Railway UI is the safer and recommended path.**

| Reason | Citation |
|---|---|
| Claude / automation cannot run Railway commands | `AUTOPILOT-RULES.md:103`; `AUTOMATION-PERMISSIONS.md:38`; `APPROVAL-GATES.md` Gate 10 |
| Claude / automation is RED-tier for any Railway-touching action | `AUTOMATION-PERMISSIONS.md` Tier 3 |
| Stage 5 Steps 1-13 (which provisioned this very service) were operator-manual; the precedent is established | `COMM-HUB-HERMES-STAGE5-PARTIAL-INSTALL-RECORD.md` (entire record is operator-manual install evidence) |
| Railway dashboard UI rename has clear user feedback (visual confirmation; immediate effect) — operator can verify pre/post state directly | n/a — UI affordance |
| Manual operator action keeps full audit trail in Railway dashboard activity log | Railway-side audit |

**What Claude can do:**
- ✅ Prepare a pre-rename checklist (this design)
- ✅ Document the rename plan + risks + rollback (this design)
- ✅ Draft any post-rename documentation updates (in a separate operator-authorized DOCS-ONLY phase)

**What Claude cannot do:**
- ❌ Execute the rename (Railway CLI / API / dashboard)
- ❌ Run `railway` CLI commands (RED tier)
- ❌ Modify Railway dashboard
- ❌ Touch Discord bot token in any way
- ❌ Touch production environment of any kind

## §10 — Doc-reference handling

The repo currently contains **73 occurrences of `agent-avila-hermes`** across 8 .md files. These split into 3 categories:

- **Historical / SHA-anchored** (the bulk) — describe Stage 5 Steps 1-13 install at `40f3137e842cd60acf1adf17ecc7fe2f0b1b8935` when the service was created under the old name. **Preserve verbatim** as factual past-state references.
- **Forward-looking** — describe future deploy targeting the service. **Update post-rename** to the new service name (in a follow-on DOCS-ONLY phase).
- **Naming-convention preserve** — the canonical Relay spec naming-convention preserve-list explicitly cites `agent-avila-hermes` as "Railway service literal preserved as factual current state" until the operator-led Railway phase. After the actual rename, this caveat updates to past-tense.

**Selective doc cleanup is operator-decision** at the post-rename phase; this Phase 2 SPEC does not perform any doc cleanup.

## §11 — Codex review history

| Round | Verdict | Required edits |
|---|---|---|
| Round-1 (DESIGN-ONLY) | **PASS — safe to request operator approval to either open Phase 2 SPEC or proceed to a separately gated operator-manual Railway rename phase** | None |

**Codex round-1 verdict (verbatim summary):** All 17 gates PASS — DESIGN-only scope explicit; renamed object correctly identified; service correctly distinguished from `agent-avila-dashboard` / Discord app/bot / GitHub repo / future Relay runtime; Railway-side assumptions match Stage 5 Partial Install Record; affected/unaffected surfaces table accurate; risk analysis not misleading; pre-rename and post-rename checklists sufficient; rollback path realistic for display-name-only Railway rename with no runtime artifacts; recommendation that Victor manually perform the Railway UI rename (not Claude/automation) is correct; actual rename treated as separate operator-led infrastructure action requiring explicit approval; Codex review correctly required for future SPEC/docs persistence phases but not for the Railway UI click itself; historical/SHA-anchored references preserved with selective post-rename forward-looking cleanup proposed; plan authorizes none of the 13 forbidden categories; preservation invariant intact; recommended phase structure safe; proposed SPEC path appropriate.

## §12 — Recommended phase structure

| # | Phase | Mode | Output | Gates |
|---|---|---|---|---|
| 1 | RAILWAY-SERVICE-RENAME-HERMES-TO-RELAY-DESIGN | DESIGN-ONLY (Mode 1) | This conversation-only design plan; Codex round-1 PASS | none (this output) |
| **2** | **RAILWAY-SERVICE-RENAME-HERMES-TO-RELAY-DESIGN-SPEC** | **DOCS-ONLY (Mode 3)** | **Persist this design as SAFE-class handoff record at `orchestrator/handoffs/RAILWAY-SERVICE-RENAME-HERMES-TO-RELAY-DESIGN.md` + 3 status doc updates** | **Codex DOCS-ONLY review + Victor commit + push (this codification phase)** |
| 3 | RAILWAY-SERVICE-RENAME (operator-manual) | OPERATOR-DIRECTED MANUAL | Victor renames the Railway service via dashboard | Pre-rename checklist; operator self-approval; post-rename verification; **NOT authorized by this SPEC** |
| 4 | RAILWAY-SERVICE-RENAME-CLOSEOUT-SPEC (optional) | DOCS-ONLY (Mode 3) | Persist the rename event as a SAFE-class record + selectively update forward-looking `agent-avila-hermes` references in repo (preserving historical / SHA-anchored references) | Codex DOCS-ONLY review + Victor commit + push; **NOT authorized by this SPEC** |

**Phases 3 and 4 are NOT authorized by this Phase 2 SPEC.** Phase 3 is the operator-led Railway dashboard action requiring its own explicit authorization. Phase 4 is the optional post-rename documentation cleanup.

## §13 — File-system delta

### This Phase 2 SPEC commit (this codification phase)

- `orchestrator/handoffs/RAILWAY-SERVICE-RENAME-HERMES-TO-RELAY-DESIGN.md` (NEW SAFE-class record — this file)
- `orchestrator/STATUS.md`
- `orchestrator/CHECKLIST.md`
- `orchestrator/NEXT-ACTION.md`

**Total: 4-file commit (1 new SAFE-class record + 3 status doc updates).** Mirrors RUN-D-DESIGN-SPEC / CYCLE-2-CLOSEOUT-SPEC / DASH-6-LIVE-BOUNDARY-SMOKE-DESIGN-SPEC / ARC-9-AUTOPILOT-VALIDATION-SPEC pattern.

### Future phases (each separately gated; not authorized by this SPEC)

- Phase 3: operator-manual Railway dashboard rename
- Phase 4 (optional): post-rename documentation cleanup of forward-looking references

## §14 — Out of scope (explicit non-authorizations)

This SPEC does **NOT** authorize:

- **Railway commands** — no `railway up`, `railway run`, `railway env`, `railway logs`, or any Railway CLI / API / dashboard action by Claude
- **Deploy** — no production deploy of any kind
- **DB commands** — no production DB query or mutation
- **Migrations** — no migration application; Migration 008 stays APPLIED; Migration 009+ remains separately gated
- **Tests** — no test execution
- **Live trading** — no live order placement, live cancel, live SL / TP / SELL_ALL action
- **`MANUAL_LIVE_ARMED` changes** — no env-var read or write
- **Autopilot activation** — Autopilot remains DORMANT
- **Relay activation** — Relay remains DORMANT; Stage 5 Steps 14-21 remain separately gated
- **External Hermes Agent (Nous/OpenRouter) setup** — reserved-term distinction only; no operational contract
- **Stage 5 Steps 14-21 install resumption** — separately gated; would require fresh Gate-10 approval at then-current HEAD plus Relay runtime image (which does not exist)
- **Schedulers / cron / webhooks / MCP installs / Discord bot activation / background automation** — none authorized
- **Memory-file edits** — separate operator-side action; not performed by this commit
- **Safety-policy doc edits** — `AUTOPILOT-RULES.md`, `AUTOMATION-PERMISSIONS.md`, `NEXT-ACTION-SELECTOR.md`, `PHASE-MODES.md`, `APPROVAL-GATES.md`, `PROTECTED-FILES.md`, `ROLE-HIERARCHY.md`, `HANDOFF-RULES.md` NOT touched
- **Other handoff record edits** — `CYCLE-2-CLOSEOUT.md`, `ARC-9-AUTOPILOT-VALIDATION.md`, `DASH-6-LIVE-BOUNDARY-SMOKE-DESIGN.md`, `COMM-HUB-RELAY-RULES.md`, etc. NOT touched
- **Additional file changes** beyond the 4 listed in §13

## §15 — Preservation invariants

Migration 008 applied; N-3 closed; Relay dormant; Autopilot dormant; approvers exactly {Victor}; no live trading authorized.

Plus carry-forward of all framework integrity checks from `orchestrator/handoffs/ARC-9-AUTOPILOT-VALIDATION.md` §4: 16 forbidden-action checks PASS; Autopilot framework verified DORMANT and certified READY for any future supervised cycle but runtime remains DORMANT.

Plus carry-forward from `orchestrator/handoffs/CYCLE-2-CLOSEOUT.md` §10: 14 deferred items remain separately gated and not authorized.

## §16 — References (SHA ledger)

- ARC-9 Phase 2 — `eff4dd22b9b9af038c7ae45de301e60b3f45af98` (HEAD baseline at design time)
- PROJECT-MEMORY-STALE-DOC-CLEANUP-B — `4602745703fd697d5cd6014e6b21654468ac9c46`
- CYCLE-2-CLOSEOUT-SPEC — `fe474d2d6b6d97a89b454d1dea1f9fd02ca20814`
- ARC-9-AUTOPILOT-VALIDATION-SPEC — `eff4dd22b9b9af038c7ae45de301e60b3f45af98` (most recent prior framework certification)
- DASH-6-LIVE-BOUNDARY-SMOKE-DESIGN-SPEC — `5e6f65cd80d71e1f8eca05a4df1e1da098d3a42b`
- COMM-HUB-RENAME-RELAY-FILES — `82310b52452cd799eb26ea43e64f936bd3baa974`
- COMM-HUB-RENAME-RELAY-CONTENT Phase A — `5541fb6f92d84028ac762b1c54ff32808868d2a9`
- RUN-D-DESIGN-SPEC — `aaf169e783415a160daf774db761d34aa705867c`
- ARC-8-UNPAUSE — `22ba4a7663e22df64b7cc8e3c0324cbffc0e28f6` (CEILING-PAUSE break)
- Stage 5 Gate-10 install approval CONSUMED at — `40f3137e842cd60acf1adf17ecc7fe2f0b1b8935` (Discord bot token mint + Railway service `agent-avila-hermes` provisioned in this commit's session — see `COMM-HUB-HERMES-STAGE5-PARTIAL-INSTALL-RECORD.md`)
- Migration 008 APPLIED — `189eb1be6ef6304d914671bdaedec44d389cf877`

## §17 — Change history

- RAILWAY-SERVICE-RENAME-HERMES-TO-RELAY-DESIGN-SPEC (2026-05-09): Initial SAFE-class record drafted as the codification of the conversation-only Phase 1 RAILWAY-SERVICE-RENAME-HERMES-TO-RELAY-DESIGN at HEAD `eff4dd22b9b9af038c7ae45de301e60b3f45af98`. Codex DESIGN-ONLY round-1 clean PASS on all 17 gates. The actual Railway rename remains operator-led and separately gated as a future Phase 3; optional post-rename documentation cleanup remains separately gated as a future Phase 4. Autopilot remains DORMANT; Relay runtime remains DORMANT.
