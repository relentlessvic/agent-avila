# Fix Plan — Single Source of Truth

## Problem
Dashboard writes to position.json and Postgres separately, causing drift.

## Goal
Use Postgres as the ONLY source of truth.

## Plan

1. Stop dashboard from writing to position.json
2. Ensure all position updates go through Postgres
3. Keep position.json only as optional snapshot/log (not used by dashboard)
4. Update dashboard to read ONLY from Postgres
5. Validate no trading logic is affected

## Safety Rules

- Do NOT modify bot.js yet
- Do NOT change trading execution logic
- All changes must be reviewed before execution

---

## Mode Handling (Critical)

### Paper Mode
- Postgres is authoritative
- Dashboard must NOT write to position.json
- position.json is auto-rehydrated from DB

### Live Mode
- position.json remains authoritative UNTIL Phase D-5.12
- Dashboard must continue writing to position.json for live mode
- Do NOT remove JSON writes for live mode yet

### Rule
- All fixes apply to PAPER mode immediately
- LIVE mode changes are gated and must be implemented later

---

## Failure Handling (Critical)

If database write fails in paper mode:

- Do NOT write to position.json
- Do NOT silently continue
- Surface error to operator (UI / API response)
- Trade must be considered NOT executed

Rule:
- Postgres is the ONLY source of truth
- No fallback to JSON (ephemeral on Railway)
