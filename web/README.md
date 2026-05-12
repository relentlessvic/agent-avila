# Agent Avila Web

Local-only static futuristic Project Progress Dashboard for Agent Avila.

**This is NOT the trading dashboard.** This web project is entirely separate
from the trading runtime `dashboard.js`. It does not modify, replace, or
supplement live trading functionality. Do not infer trading state from this UI.

## v1 scope (SCAFFOLD)

- Empty futuristic Astro + Tailwind shell
- `system-ui` and `ui-monospace` font stacks; vendored fonts are deferred to a
  separately justified future phase
- No DASHBOARD.md parser yet (CONTENT phase)
- No real data, no SHA values, no safety gates, no backlog, no runtime controls

## Boundary

- No backend
- No SSR
- No API routes
- No middleware
- No deploy
- No build-time network calls
- No client-side network calls
- No analytics
- No telemetry
- No service worker
- No external CDN, no external fonts
- No `process.env` reads in any `web/src/**` file
- No Node shell-process calls anywhere in web/
- No imports across boundary into root tree (no `bot.js`, no `dashboard.js`,
  no `db.js`, no `tools/*`, no Relay-repo paths, no sealed-file paths, no
  memory files, no test files)

## Dependencies

This project uses its own isolated `web/package.json` and (once generated)
`web/package-lock.json`. The root `package.json` and root `package-lock.json`
belong to the trading runtime and are untouched. Web dependencies live only
under `web/`.

## Operator-run only

There is no `deploy` script. There is no CI. Build is operator-run only:

```sh
cd web
npm install       # first install only (creates lockfile, runs once at SCAFFOLD)
npm ci            # for all subsequent builds (reproducible from lockfile)
npm run dev       # local development server (loopback only)
npm run build     # produces dist/ on operator's machine
```

The resulting `web/dist/` directory stays local; it is not published anywhere
by this project. A future deploy phase, if ever opened, is separately gated as
a Mode 5 HIGH-RISK IMPLEMENTATION phase.

## Phase cascade

This project is built across separately-gated phases per the sealed
`orchestrator/handoffs/PROJECT-PROGRESS-DASHBOARD-WEB-IMPLEMENT-DESIGN.md`
handoff. Each phase requires its own Codex review + explicit Victor approval.

Current v1 SCAFFOLD captures the empty futuristic shell only. CONTENT (the
DASHBOARD.md parser + 12 sections + 6 UI primitives) is a separate future
phase.
