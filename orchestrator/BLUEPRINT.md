# Agent Avila Orchestrator v1 — Blueprint

## Purpose
A controlled execution system that coordinates 3 AI brains to build, audit, and improve Agent Avila without risking trading logic or data integrity.

---

## 3-Brain Roles

### Claude (Builder)
- Implements features
- Writes code
- Executes tasks exactly as instructed
- Does NOT make assumptions outside instructions

### Codex (Safety Brain)
- Reviews all code changes
- Detects bugs, unsafe logic, and edge cases
- Blocks risky actions
- Has authority to STOP execution

### Gemini (Designer + Architect)
- Reviews UX, dashboard clarity, and operator experience
- Ensures clean structure and logical flow
- Validates assumptions and system design

Fallback:
- If Gemini unavailable → ChatGPT acts as Designer

---

## Core Rules

1. No direct modification of critical trading logic without approval
2. All changes must pass Codex safety review before execution
3. UI/Dashboard changes must pass Designer review
4. No automation touching live trading without explicit operator approval
5. All actions must be logged
6. Orchestrator must operate phase-by-phase only
7. Read-only audits must come before write actions

---

## Protected Components (HARD BLOCK)

The following cannot be modified automatically:

- bot.js
- live trading logic
- Kraken API integration
- stop loss / take profit / breakeven / trailing stop logic
- order execution system
- environment variables (.env)
- API keys
- database write operations

---

## Execution Flow

Task → Claude (build)
     → Codex (safety review)
     → Gemini (design review)
     → Operator approval
     → Execution

If Codex = FAIL → STOP immediately

---

## Orchestrator Phases

O-1: Blueprint (design only)
O-2: Project Attachment Audit (read-only)
O-3: 3-Brain CLI Verification
O-4: Safety Gate Implementation
O-5: Bug Audit System
O-6: Security Audit System
O-7: Resume Drift Forensics (Phase 2.5)
O-8: Performance & Reliability Upgrades

---

## Current Project Context

Agent Avila last known phase:
Phase 2.5 — Drift Forensics

Known Issues:
- Dashboard position mismatch
- Paper balance inconsistency
- Stream reliability / bot sleeping concerns

---

## Non-Negotiables

- Safety > Speed
- Accuracy > Automation
- No blind execution
- No assumptions on financial logic
- Operator always has final control

---

## Safety Enforcement Layer

The Orchestrator must enforce safety BEFORE execution, not after.

### Enforcement Rules

- No file changes are allowed without diff inspection
- All diffs must be reviewed by Codex before execution
- If Codex response contains:
  - "risk"
  - "unsafe"
  - "potential issue"
  → Execution MUST STOP

### Critical File Guard

Any attempt to modify these files must be blocked unless manually approved:

- bot.js
- db.js
- dashboard.js (write actions only)
- any file touching trade execution

### Read-Only First Rule

All audits MUST start as read-only:

- bug audits
- drift analysis
- dashboard checks
- balance validation

No write operations allowed during initial audit phase

---

## Task Classification System

Every task must be classified before execution:

### Task Types

- READ_ONLY
  → audits, logs, inspections, analysis

- SAFE_WRITE
  → UI updates, logs, non-critical files

- RESTRICTED_WRITE
  → anything touching trading logic, DB, or execution

### Behavior

- READ_ONLY → auto allowed
- SAFE_WRITE → requires Codex approval
- RESTRICTED_WRITE → requires Codex + Operator approval

---

## Bug Audit Protocol

Before fixing anything, the Orchestrator must:

1. Identify issue
2. Trace source of data
3. Compare all data sources
4. Confirm mismatch cause
5. Report findings

NO FIXES allowed until root cause is confirmed

---

## Security Audit Protocol

The Orchestrator must check for:

- exposed API keys
- unsafe environment variable usage
- direct DB writes without validation
- missing error handling
- unsafe async behavior

If any issue is detected:
→ Flag as HIGH PRIORITY
→ Do NOT auto-fix without approval

---

## Drift Forensics Rule

When resuming Phase 2.5:

- Compare:
  - Postgres positions
  - local position.json
  - (Kraken API only if read-only key is confirmed)

- No assumptions allowed
- No reconciliation logic allowed yet
- Only report mismatches and inconsistencies

Goal:
Identify truth source before making corrections
