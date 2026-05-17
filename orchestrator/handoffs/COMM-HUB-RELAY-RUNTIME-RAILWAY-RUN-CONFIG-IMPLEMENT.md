# COMM-HUB-RELAY-RUNTIME-RAILWAY-RUN-CONFIG-IMPLEMENT

**Status:** Permanent attestation handoff record for the RAILWAY-RUN-CONFIG-IMPLEMENT phase. Records that Option A (paperwork-attestation only) was selected and verified.
**Phase mode:** Mode 5 / HIGH-RISK IMPLEMENTATION, non-activation, paperwork-attestation only.
**Approvers exactly `{Victor}`.** Codex review verdicts do NOT constitute operator approval.

---

## §0 Phase header and mode

- Phase: `COMM-HUB-RELAY-RUNTIME-RAILWAY-RUN-CONFIG-IMPLEMENT`
- Mode: Mode 5 / HIGH-RISK IMPLEMENTATION, non-activation, **paperwork-attestation only.**
- Goal: Attest that the sealed `COMM-HUB-RELAY-RUNTIME-RAILWAY-RUN-CONFIG-DESIGN` Option A conclusion holds against the current sealed Relay state, lifting the 4th and final deploy blocker.
- Authority: Approvers exactly `{Victor}`. Codex review verdicts do NOT constitute operator approval.

## §1 Sealed design reference

- Sealed `COMM-HUB-RELAY-RUNTIME-RAILWAY-RUN-CONFIG-DESIGN` at parent commit `3618e0e1d82935a7dd1d3589bae7d17aa9581f59`.
- Sealed §6.1 verdict: "No additional Railway/Nixpacks/Docker/Procfile/deployment manifest file is required if `package.json#scripts.start` is implemented and sealed."
- Sealed §6.2: "RAILWAY-RUN-CONFIG-IMPLEMENT phase has no Relay-side commits. It is parent-paperwork-only."
- Sealed §7.1: parent-repo paperwork scope = 1 NEW handoff (this file) + 3 status-doc updates = 4 files total. Zero Relay-side files.

## §2 Repo state baseline

- Parent HEAD (pre-paperwork): `175dd0dc448134a65b75495d0cf0ca93c06a6673` (post-EGRESS-ALLOWLIST-IMPLEMENT-SEAL).
- Relay HEAD: `f32be3a1a55c31b8587df745edc50cd3cf71b0ea` (post-EGRESS-ALLOWLIST-IMPLEMENT, the third of 4 deploy-blocker implementations).
- Relay working tree: clean.
- Relay ahead/behind origin/main: 0/0.
- Parent untracked carve-outs only: `orchestrator/handoffs/evidence/`, `position.json.snap.20260502T020154Z`.

## §3 Already sealed peer deploy-blocker implementations

1. START-SCRIPT-IMPLEMENT — Relay `8913f084a86dcb8aeedb5edbdcd43523b91c4fcd`; parent paperwork `d37448f25ca85a1498d2e5d3e885d75ba8b8582f`.
2. CONFIG-INJECTION-IMPLEMENT — Relay `acdafe87e363131598d698bb83cdc816aa5cf669`; parent paperwork `0a5e258b1cef8354dedff74ca4d15f9e677d3fb6`.
3. EGRESS-ALLOWLIST-IMPLEMENT — Relay `f32be3a1a55c31b8587df745edc50cd3cf71b0ea`; parent paperwork `175dd0dc448134a65b75495d0cf0ca93c06a6673`.

## §4 Attested preflight verification (read-only)

Preflight verification PASS (10/10) against immediate-prior Relay HEAD `f32be3a1a55c31b8587df745edc50cd3cf71b0ea`:

1. Relay HEAD: `f32be3a1a55c31b8587df745edc50cd3cf71b0ea`.
2. Relay working tree clean; ahead/behind origin/main = 0/0.
3. `package.json#scripts.start` === `"node src/index.js"`.
4. `package.json#main` === `"src/index.js"`.
5. `package.json#scripts` has exactly 1 key: `start`.
6. None of the 9 forbidden manifest files exist at Relay repo root: `railway.toml`, `railway.json`, `nixpacks.toml`, `Dockerfile`, `Procfile`, `.dockerignore`, `.railwayignore`, `.nvmrc`, `.npmrc`.
7. `package.json` SHA-256 = `161a35a7e79828b31f09171490cbc730222bc833b71c2ee4c55570b27fdd7151`.
8. `package-lock.json` SHA-256 = `95d62e374faa005012aafcd282e38d785ba863164cab44bbf0d8b5685be697ca`.
9. `src/index.js` SHA-256 = `31ffe9b408e1ae2372f15fb47c094c0c620f48d47c362a0874a5d29700c7569f`.
10. Parent HEAD = `175dd0dc448134a65b75495d0cf0ca93c06a6673` + 2 authorized untracked carve-outs only.

## §5 Option A attestation

Per the sealed RAILWAY-RUN-CONFIG-DESIGN §6.1 Option A:

- `package.json#scripts.start` is the **sealed, operator-attested run command** for this Relay service. Operator-attestation was sealed by START-SCRIPT-IMPLEMENT at Relay commit `8913f084a86dcb8aeedb5edbdcd43523b91c4fcd`.
- Railway/Railpack may infer a start command from `package.json`. This design does NOT rely on platform inference as authority; it treats `package.json#scripts.start` as the sealed, operator-attested run command. Any Railway/Railpack inference is treated as secondary behavior, not the governance source of truth.
- The runbook §3 item 5 OR-clause first half is **satisfied** by the sealed `scripts.start`. The second half (Railway-side config file) is intentionally NOT pursued per Option A.
- Zero Relay-side files modified by this phase. Zero Relay-side commits in this phase.

## §6 Scope this phase

- **Relay-side scope:** ZERO files modified. ZERO commits. Relay HEAD remains `f32be3a1a55c31b8587df745edc50cd3cf71b0ea`.
- **Parent-repo scope:** exactly 4 files — 1 NEW handoff (this file) + 3 status-doc updates (`orchestrator/STATUS.md`, `orchestrator/CHECKLIST.md`, `orchestrator/NEXT-ACTION.md`).
- **Strictly NOT in scope:** any Relay-side file; any sealed handoff edit; `APPROVAL-GATES.md`; `COMM-HUB-RELAY-RULES.md`; `COMM-HUB-RULES.md`; `AUTOPILOT-RULES.md`; any of the 9 forbidden manifest files; `package.json`/`package-lock.json`/`src/index.js` edits.

## §7 Non-authorization clauses

This phase does NOT authorize: editing any Relay-side file; modifying `package.json` or `package-lock.json`; adding any new dependency; adding any of the 9 forbidden manifest files; deploy / Railway / Railway CLI / Railway UI / Railway service config modification; Discord platform action / bot / token / IDENTIFY / REST / publish; starting Relay; `.login()`; DB / Kraken / `MANUAL_LIVE_ARMED` / trading; Autopilot / CEILING-PAUSE changes; Stage 5; Stages 7-10b; opening `RAILWAY-DEPLOY-PLAN`; real network reach; tests / `npm install` / `npm ci` / `node --check` / `node` / `npm start` / `node --test`.

**Approvers exactly `{Victor}`.** Codex review verdicts do NOT constitute operator approval.

## §8 Milestone

This phase resolves the **4th and final deploy blocker**: RAILWAY-RUN-CONFIG. All 4 deploy-blocker design phases were sealed earlier in this session; all 3 prior implementation phases (START-SCRIPT, CONFIG-INJECTION, EGRESS-ALLOWLIST) are Relay-side sealed and parent-paperwork sealed. With this attestation, all 4 deploy-blocker implementations are now substantively resolved. Deployment, Relay activation, Discord activation, Railway action, Stage 5, Stages 7-10b remain NOT authorized; sealed Gate 10 install approval at `40f3137e…` remains CONSUMED and non-reusable. Relay runtime DORMANT. Autopilot DORMANT.

## §9 Reference anchors

- Sealed RAILWAY-RUN-CONFIG-DESIGN: `orchestrator/handoffs/COMM-HUB-RELAY-RUNTIME-RAILWAY-RUN-CONFIG-DESIGN.md` (sealed at parent commit `3618e0e1d82935a7dd1d3589bae7d17aa9581f59`).
- Sealed START-SCRIPT-DESIGN: `orchestrator/handoffs/COMM-HUB-RELAY-RUNTIME-START-SCRIPT-DESIGN.md`.
- Sealed CONFIG-INJECTION-DESIGN: `orchestrator/handoffs/COMM-HUB-RELAY-RUNTIME-CONFIG-INJECTION-DESIGN.md`.
- Sealed EGRESS-ALLOWLIST-DESIGN: `orchestrator/handoffs/COMM-HUB-RELAY-RUNTIME-EGRESS-ALLOWLIST-DESIGN.md`.
- Sealed DEPLOYMENT-RUNBOOK-DESIGN: `orchestrator/handoffs/COMM-HUB-RELAY-RUNTIME-DEPLOYMENT-RUNBOOK-DESIGN.md`.
- APPROVAL-GATES: `orchestrator/APPROVAL-GATES.md` (out-of-scope; untouched).
- COMM-HUB-RELAY-RULES: `orchestrator/COMM-HUB-RELAY-RULES.md` (out-of-scope; untouched).

---

**End of permanent attestation handoff.**

This handoff is preserved verbatim after sealing. Approvers exactly `{Victor}`. Codex review verdicts do NOT constitute operator approval.
