# Communication Hub — Relay Dry-Run Design (template — COMM-HUB)

> **Author rule:** This file codifies the Stage 4 Relay dry-run design (`COMM-HUB-HERMES-DRY-RUN-DESIGN`) as a permanent on-disk specification. The original Stage 4 phase was DESIGN-ONLY conversation-only; this codification phase (`COMM-HUB-DOCS-E-HERMES-DRY-RUN-DESIGN-SPEC`) writes that approved design to disk so the dry-run plan is version-controlled before any Stage 7 dry-run execution. **This document is NOT authorization to install Relay, register a Discord application, mint a Discord bot token, invite a bot to the server, grant any permission, install a webhook / scheduler / MCP trigger / cron job / Ruflo / Relay runtime / background automation, post to Discord, run a Stage 7 dry-run, take a production action, take a trading action, or break CEILING-PAUSE.** Stage 5 install (`COMM-HUB-HERMES-INSTALL`) remains RED-tier Gate-10 per `orchestrator/APPROVAL-GATES.md`; Stage 7 dry-run execution (`COMM-HUB-HERMES-DRY-RUN`) is a separate operator-approved per-action phase that follows Stage 6 install closeout.
>
> **No Relay runtime, Discord application, bot, webhook, scheduler, MCP trigger, cron job, or background automation is installed by writing this file.**
>
> **Naming convention.** Internal Avila messenger references in this file's active forward-looking wording use "Relay" per `orchestrator/COMM-HUB-RELAY-RULES.md` "Naming convention" subsection. Phase identifiers (uppercase `HERMES` literals such as `COMM-HUB-DOCS-E-HERMES-DRY-RUN-DESIGN-SPEC`, `COMM-HUB-HERMES-DRY-RUN-DESIGN`, `COMM-HUB-HERMES-INSTALL`, `COMM-HUB-HERMES-DRY-RUN`) and the filename (`COMM-HUB-HERMES-DRY-RUN-DESIGN.md`) are preserved verbatim because they record historical / committed phase identifiers. Cycle 2 Phase 1 (`COMM-HUB-RENAME-RELAY-FILES`, 2026-05-09) renamed the four forward-looking SAFE-class filenames; this historical file's filename was excluded from that rename and is preserved permanently as a record of the past Stage 4 dry-run executed under the original "Hermes" name.

Author: Operator-driven manual planning (Claude as orchestrator; future installs Victor-only)
Last updated: 2026-05-05 (COMM-HUB-DOCS-E-HERMES-DRY-RUN-DESIGN-SPEC — DOCS-ONLY). 2026-05-08 COMM-HUB-RENAME-RELAY-CONTENT Batch 5: forward-looking internal-messenger wording renamed Hermes → Relay; phase identifiers + filename preserved.
Canonical references:
- `orchestrator/COMM-HUB-RELAY-RULES.md` — canonical Relay specification (SAFE-class)
- `orchestrator/COMM-HUB-RULES.md` — Communication Hub rulebook (SAFE-class)
- `orchestrator/handoffs/COMM-HUB-INSTALL-RELAY-CHECKLIST.md` — Relay Stage 5 install checklist
- `orchestrator/handoffs/COMM-HUB-CHANNEL-LAYOUT.md` — canonical channel/role/permission layout
- `orchestrator/handoffs/COMM-HUB-DAILY-SUMMARY.md`, `COMM-HUB-WEEKLY-SUMMARY.md`, `COMM-HUB-CODEX-WARNING.md`, `COMM-HUB-SYSTEM-ALERT.md` — message templates
- `orchestrator/AUTOPILOT-RULES.md` — ARC-8 phase-loop ceiling rule
- `orchestrator/APPROVAL-GATES.md` — Gate 10 automation install / upgrade
- `orchestrator/AUTOMATION-PERMISSIONS.md` — GREEN / YELLOW / RED tiers
- `orchestrator/PROTECTED-FILES.md` — SAFE / RESTRICTED / HARD BLOCK matrix
- `orchestrator/HANDOFF-RULES.md` — packet conventions and forbidden-content list
- `orchestrator/ROLE-HIERARCHY.md` — role boundaries

If any field below diverges from `orchestrator/COMM-HUB-RELAY-RULES.md`, `orchestrator/COMM-HUB-RULES.md`, `orchestrator/handoffs/COMM-HUB-CHANNEL-LAYOUT.md`, or `orchestrator/handoffs/COMM-HUB-INSTALL-RELAY-CHECKLIST.md`, the canonical files win and this design must be re-aligned in a follow-up DOCS-ONLY phase.

---

## Phase context

This document is the persistent on-disk codification of the conversation-only Stage 4 dry-run design (`COMM-HUB-HERMES-DRY-RUN-DESIGN`). The original Stage 4 design produced no commit; this codification phase (`COMM-HUB-DOCS-E-HERMES-DRY-RUN-DESIGN-SPEC`) is its codification step.

**Codex review history of the original Stage 4 design (4 review passes):**

- **Pass 1 (initial Codex docs-only review):** PASS WITH REQUIRED EDITS. Q2 raised count-vs-enumeration inconsistency in §7 dry-run-specific halts. EDIT-1 applied (made count explicit as "9 additional"). All other 19 questions PASS.
- **Pass 2 (Q2 re-review):** FAIL on Q2 sub-check 5. Caught that the original §7 incorrectly claimed (a) all 11 canonical halt classes were sourced from "Anti-execution boundaries item 7", and (b) included "Discord API authentication failure" which is not in the canonical Relay spec at all. EDIT-2 applied: removed the fabricated halt class; corrected canonical halt sourcing from single-section to multi-section sourcing; corrected total from 20 to 19.
- **Pass 3 (Q2 re-re-review):** FAIL on sub-checks 1 and 2 — criterion-precision findings (overly broad grep `'Discord API'` matched line 142 egress-allowlist clause; expanded idempotency wording valid under multi-section sourcing rule). Operator clarification packet narrowed the criteria.
- **Pass 4 (Q2 clarification re-review):** **PASS** on all 8 clarification checks. Final overall verdict: **PASS**.

The downstream Stage 7 dry-run execution (`COMM-HUB-HERMES-DRY-RUN`) will follow this design verbatim. That phase is **separately operator-approved** and is **operator-directed manual** (no automation; no autopilot involvement) and is gated by Stage 5 install completion + Stage 6 install closeout + a fresh Stage 7 per-action operator approval.

CEILING-PAUSE remains active and is not broken by writing this design or by following it later. Operator-directed manual phases do NOT advance the autopilot phase-loop counter and do NOT break CEILING-PAUSE.

**Relay remains DORMANT (zero members, zero permissions) throughout all stages prior to Stage 5 install completion. After install, Relay remains constrained by its capability allow-list (`Send Messages` + `View Channels` for the 3 allowed channels only) regardless of stage.**

---

## §1 — What a Relay dry-run is

A Relay dry-run is a **controlled, operator-initiated, end-to-end test of the Relay runtime pipeline that exercises every code path EXCEPT the actual Discord `Send Message` API call**. The Relay process boots in a special **`HERMES_MODE=dry_run`** configuration that:

1. Authenticates to the Discord gateway (read-only `IDENTIFY` opcode; **does NOT post**; authentication is verified by receiving a `READY` event with the bot's identity).
2. Resolves the 3 allowed channel ids via the `View Channels` permission (read-only channel-list inspection; **does NOT call `Get Channel Messages` or any read-history endpoint**).
3. Reads operator-drafted **test messages** with **test-only idempotency keys** from the source-of-truth message store.
4. Runs every pre-publish verification gate (Codex PASS metadata; operator authorization metadata; channel allow-list; idempotency-key check against Relay-private publish log; CEILING-PAUSE state check; allow-listed-placeholder substitution; character-limit check; forbidden-content scan).
5. Reaches the publish point and **branches to a `would_have_published` log writer instead of calling Discord's `Send Message` API**. The dry-run log is a separate operator-readable, append-only file distinct from the Relay-private publish log.
6. Tests halt-on-anomaly behavior by deliberately injecting one or more anomaly conditions (missing Codex PASS, missing operator authorization, channel-not-in-allow-list, idempotency-key collision, character-limit overflow, network-egress-violation simulation) and verifying Relay halts cleanly without retrying and without auto-resuming.
7. Exits cleanly when the test message queue is exhausted or a halt condition fires; **does NOT auto-restart**.

The dry-run produces no real Discord post in any channel. Real channels (`#status`, `#summaries`, `#system-health`) remain empty / unchanged before, during, and after the dry-run.

A dry-run is also a single-shot operator-initiated event: each dry-run requires a fresh Stage 7 per-action operator approval; the dry-run does NOT auto-progress to Stage 8 / 9 / 10a / 10b on success.

---

## §2 — What Relay is allowed to simulate (during dry-run)

| Pipeline step | Simulated? | Notes |
|---|---|---|
| Process boot from container/image | YES (real) | Real boot, real non-root user, real read-only filesystem |
| Discord gateway authentication | YES (real) | Real `IDENTIFY` + `READY` exchange; no message post |
| Channel-id resolution via `View Channels` | YES (real) | Read-only channel-list inspection on the 3 allowed channels |
| Forbidden-channel non-visibility check | YES (real) | Verify that `#approvals`, `#codex-warnings`, `#trading-alerts`, `#trading-summaries` are NOT in the bot's visible-channel list (per-channel deny overrides verified) |
| Source-of-truth message-store read | YES (real) | Read test messages with test-only idempotency keys |
| Codex PASS metadata verification | YES (real) | Real verification of metadata pointer; halt on missing/stale |
| Operator authorization metadata verification | YES (real) | Real verification of per-message Victor authorization metadata |
| Channel allow-list verification | YES (real) | Hard-coded `#status` / `#summaries` / `#system-health` check |
| Idempotency-key check | YES (real) | Real verification against Relay-private append-only publish log |
| CEILING-PAUSE state detection | YES (real) | Real check via controlled signal; halt during ACTIVE state |
| Allow-listed-placeholder substitution | YES (real) | Real substitution (e.g., `<UTC date>` → `2026-05-05T19:00:00Z`) |
| Character-limit check | YES (real) | Real length check (≤2000 Discord chars; per channel rate caps) |
| Forbidden-content scan | YES (real) | Real scan against `orchestrator/HANDOFF-RULES.md` + `orchestrator/COMM-HUB-RULES.md` forbidden lists |
| Discord `Send Message` API call | **NO — REPLACED with `would_have_published` log write** | Branch on `HERMES_MODE=dry_run`; no Discord-side state change |
| Relay-private append-only publish log write | NO during dry-run | The real publish log is NOT written to during dry-run; dry-run log is separate |
| Dry-run "would-have-published" log write | YES (dry-run-specific) | Append-only operator-readable file with idempotency key, channel id, timestamp, intended message body, "DRY-RUN" marker |
| Halt-on-anomaly | YES (real, including injected anomalies) | Halt logs go to a dry-run halt log, separate from real-mode halt logs |
| Single-instance discipline | YES (real) | Concurrent-Relay detection via lock file or equivalent; halt on collision |
| Process exit (clean, no auto-resume) | YES (real) | Real exit on queue drain or halt; container restart policy disabled per install checklist |

---

## §3 — What Relay must NOT do (during dry-run)

- Post any real message to any Discord channel (the dry-run branch replaces the publish call).
- Read message history from Discord on any channel — `Read Message History` permission remains OFF forever (canonical Relay spec non-listener clause).
- Call `Get Channel Messages`, `Get Channel`, `Get Reactions`, or any Discord-side read-content endpoint.
- Modify the real Relay-private append-only publish log (the real publish log records only real publishes; dry-run uses a separate dry-run log).
- Modify the source-of-truth message store (read-only during dry-run).
- Trigger any production action: no Railway, no production DB, no Kraken, no env change, no `MANUAL_LIVE_ARMED` change, no `position.json` write, no runtime-file modification.
- Auto-resume after halt (halt is permanent until operator action).
- Operate during CEILING-PAUSE ACTIVE (must detect and halt).
- Operate outside its allow-listed capability matrix (`Send Messages` + `View Channels` only on the 3 allowed channels).
- Run a real `Send Message` "by accident" (the dry-run branch is the FIRST decision in the publish path; if the branch is missed, that is itself a halt-on-anomaly condition with an immediate token-revocation rollback).
- Generate a Discord invite link.
- Add the bot to any other server.
- Mint a new bot token (token comes from the Stage 5 install host secret store; dry-run uses the same token in read-only / write-restricted mode).
- Touch any other repo file, env var, secret store, or non-Discord endpoint.
- Modify its own permissions, the Relay spec, the install checklist, the channel layout, or any orchestrator doc.
- Open or close any orchestrator phase.
- Grant or interpret any approval. (Relay has zero approval authority forever.)

---

## §4 — Sample dry-run messages (test fixtures only; never published)

Each test message carries:
- A test-only idempotency key prefixed `DRY-RUN-{stage}-{channel}-{counter}` (collision-free; flagged as dry-run-only in the metadata).
- An explicit `dry_run: true` flag in the metadata schema.
- A `Codex PASS` metadata pointer (real Codex sanity-check verdict on the test message wording).
- A real per-message Victor authorization metadata entry (operator must approve each test message exactly as a real per-message approval would work at Stage 9).
- An `intended_channel` field (one of the 3 allowed channels).
- An `allowed_placeholder_map` (e.g., `<UTC date>` → current UTC date at simulated-publish time).

### Sample test message for `#status`

Following the channel topic format ("ARC-8 followed by phase id then event"):

```
ARC-8: HERMES-DRY-RUN-001 PHASE_OPENED
Mode: DOCS-ONLY.
Phase: COMM-HUB-HERMES-DRY-RUN (Stage 7 test fixture; not a real phase).
Time: <UTC date> at <UTC time>.
This is a dry-run test message. It will NOT be published. Relay is in HERMES_MODE=dry_run; the publish call is replaced with a would_have_published log write. CEILING-PAUSE remains active. Autopilot runtime remains DORMANT. Relay remains within its capability allow-list (Send Messages + View Channels for #status, #summaries, #system-health only; no Read Message History; no approval authority; no trading authority). A reply, emoji, or reaction is NEVER an approval — only Victor's explicit in-session chat instruction grants approval.
```

Char count target: ≤500 (well under the 2000-char Discord limit and the 5-messages-per-phase rate cap).

### Sample test message for `#summaries`

Following the per `orchestrator/handoffs/COMM-HUB-DAILY-SUMMARY.md` template format (truncated for the dry-run):

```
Daily Summary — DRY-RUN test fixture (not a real summary).

Date: <UTC date>.
Phases active: COMM-HUB-HERMES-DRY-RUN (Stage 7 test fixture).
Commits landed: none (dry-run; no real activity).
Codex verdicts: dry-run pre-publish PASS for this test message only.
Discord posts: zero (dry-run; the publish call is replaced with a would_have_published log write).
N-3 state: CLOSED. Migration 008 APPLIED.
Autopilot state: DORMANT. CEILING-PAUSE active and not broken.
Relay state: dry-run mode; remains DORMANT for production publish authority.
Approvers: {Victor}.
Reminder: a reply, emoji, or reaction is NEVER an approval — only Victor's explicit in-session chat instruction grants approval.
```

### Sample test message for `#system-health`

Following the per `orchestrator/handoffs/COMM-HUB-SYSTEM-ALERT.md` template format with a fictitious test alert event:

```
SYSTEM-ALERT: HERMES-DRY-RUN-003 (test fixture — not a real alert).

Class: TEST-ONLY.
Detected: simulated working-tree drift (synthetic; not real).
Time: <UTC date> at <UTC time>.
Affected surface: none (test fixture).
Recommended action: none (test fixture).
Reminder: this dry-run alert exercises the #system-health publish path under HERMES_MODE=dry_run. The publish call is replaced with a would_have_published log write. CEILING-PAUSE active and not broken; autopilot runtime DORMANT; Relay remains within its capability allow-list. A reply, emoji, or reaction is NEVER an approval — only Victor's explicit in-session chat instruction grants approval.
```

### Sample anomaly-injection test messages (deliberately malformed)

To verify halt-on-anomaly behavior, the operator injects ONE-AT-A-TIME the following malformed test messages and verifies Relay halts cleanly without writing a `would_have_published` entry:

| Anomaly id | Injected fault | Expected Relay behavior |
|---|---|---|
| ANOMALY-001 | Missing Codex PASS metadata pointer | Halt before publish; halt log entry; no `would_have_published` entry |
| ANOMALY-002 | Missing operator-authorization metadata | Halt before publish |
| ANOMALY-003 | `intended_channel = #approvals` (forbidden) | Halt before publish |
| ANOMALY-004 | `intended_channel = #trading-alerts` (Category C) | Halt before publish |
| ANOMALY-005 | Idempotency-key collision (key reused from a prior real or dry-run entry) | Halt before publish |
| ANOMALY-006 | Character-limit overflow (body length > 2000 chars) | Halt before publish |
| ANOMALY-007 | CEILING-PAUSE state ACTIVE signal present | Halt before publish |
| ANOMALY-008 | Forbidden-content trip (e.g., body contains literal text `KRAKEN_API_KEY=` — synthetic test only; not a real key) | Halt before publish |
| ANOMALY-009 | `dry_run: true` flag missing while running in `HERMES_MODE=dry_run` | Halt before publish (defense-in-depth; if Relay is in dry-run mode, every test message must carry the flag) |
| ANOMALY-010 | Allow-listed-placeholder violation (un-allow-listed placeholder in body) | Halt before publish |

Each anomaly is captured in the dry-run halt log with timestamp, anomaly id, and root-cause field.

**No anomaly test message contains real secrets, real env values, real Kraken / Railway / production data, or real `position.json` content.** ANOMALY-008 uses a synthetic literal string that triggers the forbidden-content scanner without being a real credential.

---

## §5 — Message review pipeline (how messages are reviewed before posting)

Even though no real Discord post occurs, every test message goes through the full review pipeline before being added to the source-of-truth message store:

1. **Orchestrator drafts the test message** (Claude as builder). Each test message has a draft id (e.g., `DRY-RUN-001`).
2. **Codex pre-publish sanity-check review** — same canonical pre-publish Codex gate that applies at the Communication Hub level for every message. Codex returns PASS / PASS WITH REQUIRED EDITS / FAIL on each test message individually. Required edits are applied verbatim. Dry-run cannot start until every test message has a clean Codex PASS verdict.
3. **Operator (Victor) per-message review** — Victor reads each Codex-PASS test message and grants explicit in-session per-message authorization. Authorization metadata is appended to the source-of-truth message store. (This mirrors the Stage 9 per-message-approval rule applied here defensively at Stage 7.)
4. **Operator review of the source-of-truth message store** — Victor confirms the queued test messages match the approved set, with no unexpected entries.
5. **Operator runs the dry-run** — single Stage 7 per-action approval; dry-run executes through the queue.
6. **Pipeline-time re-verification** — Relay re-verifies Codex PASS metadata, operator-authorization metadata, channel allow-list, idempotency, CEILING-PAUSE, character limit, and forbidden-content for every message at simulated-publish time. Any mismatch halts before the `would_have_published` write.
7. **Post-dry-run operator review** — Victor reviews the dry-run log, the halt log, and the per-test-message verification log; confirms expected behavior.
8. **Codex dry-run-result review** — Codex reviews the dry-run log + halt log against the design and returns PASS / PASS WITH REQUIRED EDITS / FAIL.

The pre-publish review pipeline is identical in structure to the canonical Communication Hub per-message review; the only difference is that the actual Discord publish is replaced with a `would_have_published` log write.

**No real Discord post occurs at any stage of the dry-run review pipeline.**

---

## §6 — Evidence capture requirements

All evidence is captured locally on the operator's machine; **not committed to the repo**, **not posted to any Discord channel**, **not shared externally**. Tokens are always redacted.

### Pre-dry-run evidence

- [ ] Stage 5 install completion verification: install checklist verification-checklist screenshots (per the canonical install checklist §"Verification checklist").
- [ ] Stage 5 install closeout commit SHA (`COMM-HUB-HERMES-INSTALL-CLOSEOUT`) documented.
- [ ] Stage 4 dry-run-design Codex PASS verdict captured (4-pass review history; final PASS at Pass 4).
- [ ] Stage 7 per-action operator approval captured (in-session chat reference).
- [ ] All test messages Codex-PASS verdicts captured.
- [ ] Source-of-truth message-store contents (pre-dry-run state) captured.
- [ ] CEILING-PAUSE state confirmed ACTIVE (not broken by dry-run).
- [ ] Migration 008 APPLIED state confirmed.
- [ ] Three-way SHA consistency PASS captured at the HEAD referenced in the Stage 7 approval.

### During-dry-run evidence

- [ ] Relay process boot log (startup time, image digest, non-root user, runtime version).
- [ ] Discord gateway authentication log (`IDENTIFY` + `READY` exchange; no message post).
- [ ] Channel-id resolution log (3 allowed channel ids reachable; 4 forbidden channels NOT in visible-channel list).
- [ ] Per-test-message verification log (Codex PASS verified, operator auth verified, channel allow-list verified, idempotency verified, CEILING-PAUSE verified, placeholder substitution verified, character limit verified, forbidden-content scan verified).
- [ ] Dry-run log entries (one per test message; idempotency key, channel id, timestamp, intended message body, "DRY-RUN" marker).
- [ ] Halt-on-anomaly log entries (one per injected anomaly; anomaly id, root-cause field, halt timestamp).
- [ ] Network egress capture (only Discord API endpoints accessed; no Kraken / Railway / production-DB / GitHub / non-Discord endpoint contacted) — operator-side firewall log or equivalent.
- [ ] Relay process shutdown log (clean exit; no auto-restart attempted).

### Post-dry-run evidence

- [ ] Real Discord channel content visual check: `#status` / `#summaries` / `#system-health` confirmed unchanged by the dry-run (no message landed; channels remain in their pre-dry-run state).
- [ ] Relay-private publish log content check: confirmed UNCHANGED by the dry-run (real publish log is not written to during dry-run).
- [ ] Dry-run log content check: confirmed contains exactly the expected `would_have_published` entries.
- [ ] Halt log content check: confirmed contains exactly the expected halt entries.
- [ ] Source-of-truth message-store post-state check: confirmed contains the same pre-dry-run state (read-only during dry-run).
- [ ] Discord audit log: confirmed Relay did not generate any new audit-log entry (other than the gateway authentication event).
- [ ] Operator notes: any anomaly observed; recommended remediation; ready / not-ready for Stage 8 draft-only-mode.

All evidence is annotated locally with timestamp + dry-run id. Tokens redacted in every screenshot, log, and annotation.

---

## §7 — Halt conditions

Total halt classes for dry-run = **10 canonical** + **9 dry-run-specific** = **19 distinct halt classes**.

### Canonical halts (from `orchestrator/COMM-HUB-RELAY-RULES.md` — multi-section sourcing) — 10 classes

Sourced from:
- §"Anti-execution boundaries" item 7 at line 148 — halt classes 1–7
- §"Anti-execution boundaries" item 8 at line 149 — halt class 8
- §"Anti-execution boundaries" item 13 at line 154 — halt class 9
- §"Approval discipline" line 178, with bound 7 reference at line 176 — halt class 10

Canonical halt classes:

1. Missing or stale Codex PASS metadata. *(line 148)*
2. Missing, expired, exhausted, or out-of-scope operator authorization metadata. *(line 148)*
3. Channel not in allow-list. *(line 148)*
4. Character-limit exceeded. *(line 148)*
5. Rate-limit hit. *(line 148)*
6. Network anomaly (egress to non-allow-listed endpoint). *(line 148)*
7. Idempotency-key mismatch / collision / reuse / unverifiable. *(line 148; expanded wording also sourced from line 106 and lines 207–212 per multi-section sourcing)*
8. CEILING-PAUSE state ACTIVE detected via controlled signal. *(line 149)*
9. Concurrent-Relay-instance detection (single-instance discipline). *(line 154)*
10. Class-authorization bounds violation (Stage 10a/10b — including forbidden-content scan trip via bound 7 at line 176). *(line 178)*

**Removed as fabricated / not in canonical spec:** "Discord API authentication failure" — not present anywhere in `orchestrator/COMM-HUB-RELAY-RULES.md`. Removed by EDIT-2 during Codex review Pass 2.

### Dry-run-specific halts (9 additional)

1. `HERMES_MODE` is missing or set to a value other than `dry_run` while the operator expected dry-run.
2. A test message lacks the `dry_run: true` metadata flag while Relay is in dry-run mode.
3. The dry-run branch decision is bypassed (i.e., the publish path reaches the real `Send Message` call) — **IMMEDIATE HALT + ABORT** with operator notification + recommendation to revoke the bot token.
4. Dry-run log write failure (file-system error, permission error, lock contention).
5. An attempt to write to the real Relay-private publish log during dry-run mode.
6. An attempt to call `Get Channel Messages` or any Discord-side read-content endpoint (permission-impossible by design; halt class defined for defense-in-depth).
7. An attempt to modify the source-of-truth message store during dry-run.
8. An attempt to add reactions, edit messages, or delete messages in any channel.
9. An attempt to access any non-Discord endpoint (Kraken, Railway, production DB, GitHub, etc.).

### Halt behavior

- Each halt logs the anomaly id, timestamp, root-cause field, channel id (if applicable), idempotency key (if applicable), and the test message body (verbatim, before placeholder substitution; redacted of any sensitive content if forbidden-content scanner already flagged it).
- Relay does NOT auto-resume after halt. Operator must manually inspect, fix, and re-run.
- Halt does NOT auto-revoke the bot token. Operator may choose to revoke (per the canonical install-checklist "emergency immediate-revoke" pattern).
- Halt during dry-run does NOT advance to Stage 8 / 9 / 10a / 10b. Each subsequent stage requires its own per-action operator approval.

---

## §8 — Rollback / removal logic for a failed future dry-run

Mirrors the canonical install-checklist §"Rollback / removal steps" plus dry-run-specific:

1. **Stop the Relay process immediately.** Operator-chosen mechanism per host.
2. **Capture full evidence** (process logs, dry-run log, halt log, network captures if available, Discord audit log, channel content visual check).
3. **Inspect the halt log to identify root cause.** Decision branches:
   - **Branch A — config-only issue:** plan a remediation, document the fix, run a follow-up dry-run after fix is applied. No rollback of Stage 5 install state required.
   - **Branch B — Relay runtime code issue:** open a follow-up phase to design the fix; get Codex review on the fix design; get Victor approval; do NOT proceed to Stage 8 / 9 / 10a / 10b until issue resolved.
   - **Branch C — permission gap discovered during dry-run** (e.g., Relay accidentally sees a forbidden channel, or `Read Message History` is enabled when it should be off): immediately revert the role permissions per the install-checklist §"Rollback / removal steps" steps 5 and 11. Re-run the verification checklist. Re-run the dry-run from a clean state.
   - **Branch D — severe issue** (unexpected real publish, network egress to non-allow-listed endpoint, dry-run branch bypass, idempotency-store corruption, token leakage suspected, container escape, etc.):
     1. **Revoke the Discord bot token immediately** (Discord developer portal → Application → Bot → Reset Token; do NOT save the new token).
     2. **Kick the bot from `Agent Avila Hub`** (Server Settings → Members → kick).
     3. **Revert `System-Writer` role to DORMANT** (zero permissions, zero members).
     4. **Wipe host-side secrets.**
     5. **Tear down the host process / container / image.**
     6. **Archive all logs, evidence, and halt records locally.**
     7. **Re-evaluate whether Relay activation should pause indefinitely.**
4. **Document the failed dry-run** in a separate operator-approved closeout phase (an explicit `COMM-HUB-HERMES-DRY-RUN-FAILURE-CLOSEOUT` or equivalent) by updating STATUS / CHECKLIST / NEXT-ACTION docs. Recovery path is operator-decided.
5. **Update or close the dry-run id in the source-of-truth message store** so failed-dry-run idempotency keys cannot be reused on a later re-run.
6. **Operator decides retry / redesign / abandon.**

Rollback explicitly does NOT modify: the Relay spec, the install checklist, this dry-run design, any safety-policy doc, Migration 008 / N-3 state, CEILING-PAUSE state, autopilot runtime DORMANT state, Railway, production DB, Kraken, env, `MANUAL_LIVE_ARMED`, or any runtime file.

**Emergency immediate-revoke (any time during dry-run):** the operator may revoke the Discord bot token at any time via the developer portal (single click). Token revocation is the fastest single-step DORMANT-revert; the Relay process halts on next API call and stays halted.

---

## §9 — Stage 5 boundary

The Stage 7 dry-run cannot run until Stage 5 install is closed. The relevant gate sequence (mirroring the install checklist §"Required Victor approvals"):

| Gate | When | Class |
|---|---|---|
| Stage 1 closed | `COMM-HUB-DESIGN-HERMES` Codex 8/8 PASS (already closed; no commit) | Operator-directed manual; no commit |
| Stage 2 closed | `COMM-HUB-DOCS-C-HERMES-SPEC` closed/pushed at `96f56a4767cc96ddd8b78bcc3b309e8fd455c8a5` (already closed) | Commit-only + push |
| Stage 3 closed | `COMM-HUB-DOCS-D-HERMES-INSTALL-CHECKLIST` closed/pushed at `e18f2207eae4ab734beb6f29626de1a5e4cd5757` (already closed) | Commit-only + push |
| Stage 4 closed | `COMM-HUB-HERMES-DRY-RUN-DESIGN` Codex PASS (already closed Design-only PASS after 4 review passes; conversation-only) | Operator-directed manual; conversation-only; no commit |
| Stage 4 codification | `COMM-HUB-DOCS-E-HERMES-DRY-RUN-DESIGN-SPEC` (this phase) | Commit-only + push |
| Stage 5 preconditions | All 15 preconditions in `orchestrator/handoffs/COMM-HUB-INSTALL-RELAY-CHECKLIST.md` §"Preconditions before Relay install" satisfied | Operator-side fact-finding |
| Stage 5 install-readiness review | Fresh Codex install-readiness review at the relevant HEAD (10 questions per install checklist §"Codex review gate before any future install"); returns PASS | Codex review |
| **Stage 5 Gate-10 install approval** | Explicit Victor in-session approval naming the exact install scope at the relevant HEAD per `git rev-parse HEAD` | **RED-tier per `orchestrator/APPROVAL-GATES.md` Gate 10 (automation install / upgrade)** |
| Stage 6 closeout | `COMM-HUB-HERMES-INSTALL-CLOSEOUT` (records install complete in 3 status docs) | Commit-only + push |
| **Stage 7 dry-run approval** | Fresh per-action operator approval to execute this dry-run plan | RED-tier per-action |

**Stage 5 install (`COMM-HUB-HERMES-INSTALL`) remains RED-tier Gate-10 and requires:**
- Its own separately-approved phase.
- Stage 4 closure (this design Codex PASS — already achieved).
- Stage 4 codification (this `COMM-HUB-DOCS-E-HERMES-DRY-RUN-DESIGN-SPEC` phase).
- All 15 preconditions in the install checklist satisfied.
- Stage 5 install-readiness Codex review PASS at the relevant HEAD.
- Explicit Victor in-session Gate-10 approval naming the exact install scope.

**Stage 5 install approval does NOT include Stage 7 dry-run approval.** Stage 7 dry-run requires its own separate per-action operator approval after Stage 6 closeout. Stage 5 → Stage 6 → Stage 7 is a strict ordered sequence; each stage has its own approval gate.

**Stage 5 install approval explicitly does NOT authorize:**
- Stage 7 dry-run execution.
- Stage 8 draft-only-mode.
- Stage 9 first-auto-publish.
- Stage 10a / 10b expansion.
- Any auto-progression through stages.
- Any Discord post.
- Any Discord webhook creation.
- Any other server install of the Relay bot.
- Any production action.

---

## §10 — Codex review of this dry-run design

The original Stage 4 `COMM-HUB-HERMES-DRY-RUN-DESIGN` was reviewed in 4 Codex passes against 20 review questions. The final verdict was **PASS** on all 20 questions:

| Q | PASS basis |
|---|---|
| Q1 — no real Discord posts | §1, §2 (publish call replaced by `would_have_published` log write) |
| Q2 — halt conditions complete and aligned with safety rules | §7 (10 canonical + 9 dry-run-specific = 19 distinct halt classes; multi-section sourced; no fabricated classes) |
| Q3 — sample messages free of forbidden content | §4 (no real secrets, env, Kraken, Railway, production-DB, MANUAL_LIVE_ARMED, position.json, webhook URL, invite link; ANOMALY-008 uses synthetic literal only) |
| Q4 — anti-execution boundaries preserved | §3 (all 13 from canonical spec) |
| Q5 — Relay DORMANT-by-default before Stage 5 | §1, §11 (this design phase does not change DORMANT classification) |
| Q6 — Read Message History remains OFF | §3, §7 dry-run-specific halt 6 (Discord-side read-content endpoint attempt = halt) |
| Q7 — sufficient evidence captured | §6 (pre / during / post evidence enumerated) |
| Q8 — rollback steps complete | §8 (4-branch rollback A/B/C/D; emergency immediate-revoke) |
| Q9 — no production / runtime / Kraken / env / MANUAL_LIVE_ARMED / Railway / DB action | §3, §11, §12 |
| Q10 — CEILING-PAUSE preserved | §3, §7 canonical halt 8, §11 |
| Q11 — Stage 5 install and Stage 7 dry-run separate | §9 |
| Q12 — explicit Victor approval to start dry-run | §1, §5, §9 (Stage 7 per-action approval) |
| Q13 — explicit Victor per-message approval | §4, §5 |
| Q14 — Codex pre-publish PASS per test message | §1, §4, §5 |
| Q15 — idempotency integrity without Discord-side reads | §1, §2, §7 |
| Q16 — anomaly-injection cases complete and bounded | §4 (10 ANOMALY cases) |
| Q17 — single-instance discipline preserved | §2, §7 canonical halt 9 |
| Q18 — no auto-resume after halt | §1, §2, §3, §7 |
| Q19 — Stage 4 itself does not write files / commit / push / install / mint tokens / activate runtime | §11 of the original Stage 4 design (now codified by this `COMM-HUB-DOCS-E-HERMES-DRY-RUN-DESIGN-SPEC` phase, which is itself DOCS-ONLY) |
| Q20 — future codification = separate operator-approved DOCS-ONLY phase | The original Stage 4 design called for this codification step; this current `COMM-HUB-DOCS-E-HERMES-DRY-RUN-DESIGN-SPEC` IS that DOCS-ONLY codification phase, with its own Codex docs-only review gate before commit |

This document is reviewable by Codex in a docs-only review against the same 20 questions; required checks for the codification phase additionally verify the on-disk wording matches the conversation-only Stage 4 design.

---

## §11 — Explicit non-authorizations

Authorization scope of this Stage 4 codification phase: **only committing the 4-file scope (this template + 3 status docs)**.

This document and the codification phase do NOT authorize:

- Relay install (Stage 5).
- Relay runtime activation.
- Discord application registration.
- Discord bot creation.
- Discord bot token minting.
- Bot invite to `Agent Avila Hub` or any other server.
- Granting any Discord permission to any role.
- Changing any role's DORMANT classification.
- Webhook creation.
- Scheduler / MCP trigger / cron job / Ruflo / background-automation install.
- Discord post (including draft messages, test posts, or seed messages).
- Public Discord invite-link creation.
- Discord-to-Railway / Discord-to-GitHub / Discord-to-Kraken / Discord-to-production-DB connection.
- Trading-alert connection.
- Codex-Writer activation.
- Trading-Writer activation.
- Category C activation.
- Production action (Railway, production DB, Kraken, env, `MANUAL_LIVE_ARMED`, runtime edit, deploy, migration application).
- Live trading.
- Autopilot runtime activation.
- Autopilot CEILING-PAUSE break.
- ARC-8-RUN-C.
- Stage 5 / 6 / 7 / 8 / 9 / 10a / 10b execution.
- Modification of the canonical Relay spec, install checklist, channel layout, or any safety-policy doc.

---

## §12 — Preserved state

Writing this document and committing it preserves:

- **Relay DORMANT** (zero members, zero permissions).
- **CEILING-PAUSE active and not broken** (operator-directed manual codification phase does NOT advance autopilot phase-loop counter and does NOT break CEILING-PAUSE).
- **Autopilot runtime DORMANT.**
- **Migration 008 APPLIED** at HEAD `189eb1be6ef6304d914671bdaedec44d389cf877`.
- **N-3 CLOSED.**
- **Approvers exactly `{Victor}`.**
- **Stage 5 `COMM-HUB-HERMES-INSTALL` RED-tier Gate-10** per `orchestrator/APPROVAL-GATES.md`.
- **Discord server `Agent Avila Hub`** unchanged (channel structure, role hierarchy, permissions, audit log, integrations panel showing zero apps and zero webhooks).
- **No Relay runtime, Discord application, Discord bot, Discord bot token, bot invite, webhook, scheduler, MCP trigger, cron job, Ruflo, or background automation** installed or authorized.
- **No Discord post**, no Railway action, no production DB action, no Kraken action, no env change, no `MANUAL_LIVE_ARMED` change, no runtime edit, no deploy, no migration, no live trading action.

---

## What this document is NOT

- **Not authorization to install Relay.** Relay install is Stage 5 — Gate-10 RED-tier per `orchestrator/APPROVAL-GATES.md` and requires explicit Victor in-session approval at that future time.
- **Not authorization to register a Discord application or bot.** Application / bot registration is part of the future Stage 5 install phase.
- **Not authorization to mint, store, rotate, or use a Discord bot token.** Token operations are part of Stage 5.
- **Not authorization to grant any Discord permission to any role.** Permission grants are part of Stage 5.
- **Not authorization to invite a bot to the server.** Bot invite is part of Stage 5.
- **Not authorization to install a webhook.** Webhook install is a separately-gated future phase (not currently planned for Relay).
- **Not authorization to install a scheduler / MCP trigger / cron job / Ruflo / background automation.** Each is its own Gate-10 phase.
- **Not authorization to grant Relay any approval authority.** Relay has zero approval authority forever.
- **Not authorization to grant Relay any trading authority.** Relay has zero trading authority forever.
- **Not authorization to post to Discord.** Posting is operator-only manual action until Stage 9 lands; Stage 9 itself is RED-tier per-message.
- **Not authorization to take any production action, trading action, deploy action, env change, or RED-tier action.**
- **Not authorization to break CEILING-PAUSE.** Only an explicit operator direction-confirmation instruction breaks the ceiling.
- **Not authorization to expand Relay beyond the canonical capability matrix.** Capability matrix is canonical in `orchestrator/COMM-HUB-RELAY-RULES.md`.
- **Not authorization to grant `Read Message History` to Relay.** Forever forbidden unless a separately-scoped Gate-10 phase opens with its own design + Codex review + Victor approval; no such phase is currently planned.
- **Not authorization to execute Stage 7 dry-run.** Stage 7 dry-run requires its own separately-approved per-action phase after Stage 5 install + Stage 6 closeout.
- **Not canonical over `orchestrator/COMM-HUB-RELAY-RULES.md`.** If this document diverges from the Relay spec, the spec wins.
- **Not canonical over `orchestrator/COMM-HUB-RULES.md`.** If this document diverges from the rulebook, the rulebook wins.
- **Not canonical over `orchestrator/handoffs/COMM-HUB-CHANNEL-LAYOUT.md`.** If this document diverges from the channel layout, the channel layout wins.
- **Not canonical over `orchestrator/handoffs/COMM-HUB-INSTALL-RELAY-CHECKLIST.md`.** If this document diverges from the install checklist, the install checklist wins.
- **Not canonical over `orchestrator/AUTOMATION-PERMISSIONS.md`.** If this document diverges from the automation-permissions tiers, the tiers win.
- **Not canonical over `orchestrator/APPROVAL-GATES.md`.** If this document diverges from the gate matrix, the gate matrix wins.

**This codification phase (`COMM-HUB-DOCS-E-HERMES-DRY-RUN-DESIGN-SPEC`) is DOCS-ONLY and does NOT activate Relay. Relay remains DORMANT (zero members, zero permissions) at the end of this phase. Stage 5 install requires its own separately-approved Gate-10 phase. Stage 7 dry-run requires its own separately-approved per-action phase after Stage 6 closeout.**
