// tools/dashboard-generate.js
//
// Read-only Project Progress Dashboard generator for Agent Avila.
// Emits markdown to stdout. Never writes files. No network calls.
// Node built-ins only.
//
// Designed per:
//   orchestrator/handoffs/PROJECT-PROGRESS-DASHBOARD-DESIGN.md
//     (sealed at f6aaa409889ec76632f8b80e9954d1cb38b178a9)
//   orchestrator/handoffs/PROJECT-PROGRESS-DASHBOARD-IMPLEMENT-DESIGN.md
//     (sealed at c8798ea94b1b7cf55a589a253e99e5d5476178de)
//
// Hard guarantees enforced by code structure:
//   - No write-side fs API imported (no writeFile / appendFile / createWriteStream
//     / mkdir / unlink / rename / rm)
//   - No network module imports (no http / https / fetch / net / tls / dgram)
//   - No child_process invocation beyond the 4 allowed read-only git commands
//   - No process.env reads at all
//
// Invocation: node tools/dashboard-generate.js
// Output:     markdown to stdout
// Failure:    exit non-zero with stderr structured error; no partial dashboard

import { readFileSync } from 'fs';
import { join, resolve, dirname } from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, '..');

// ---------------------------------------------------------------------------
// ENFORCEMENT: explicit read-path allowlist
// ---------------------------------------------------------------------------

const ALLOWED_PATHS = Object.freeze([
  'orchestrator/STATUS.md',
  'orchestrator/CHECKLIST.md',
  'orchestrator/NEXT-ACTION.md',
  'orchestrator/AUTOPILOT-RULES.md',
  'orchestrator/APPROVAL-GATES.md',
  'orchestrator/PHASE-MODES.md',
  'orchestrator/PROTECTED-FILES.md',
  'orchestrator/COMM-HUB-RULES.md',
  'orchestrator/COMM-HUB-RELAY-RULES.md',
  'orchestrator/COMM-HUB-RELAY-RUNTIME-DESIGN.md',
  'CLAUDE.md',
]);

// orchestrator/handoffs/*.md is glob-allowed via the prefix check below.
const HANDOFF_PREFIX = 'orchestrator/handoffs/';

class DashboardError extends Error {
  constructor(reason, context) {
    super(`DashboardError: ${reason}${context ? ` at ${context}` : ''}`);
    this.name = 'DashboardError';
    this.reason = reason;
    this.context = context;
  }
}

function isAllowedPath(relPath) {
  if (typeof relPath !== 'string' || relPath.length === 0) return false;
  if (relPath.includes('..')) return false;
  if (ALLOWED_PATHS.includes(relPath)) return true;
  // Handoff glob: orchestrator/handoffs/<single-name>.md only
  if (
    relPath.startsWith(HANDOFF_PREFIX) &&
    relPath.endsWith('.md') &&
    !relPath.slice(HANDOFF_PREFIX.length).includes('/')
  ) {
    return true;
  }
  return false;
}

function readAllowedFile(relPath) {
  if (!isAllowedPath(relPath)) {
    throw new DashboardError('path not in allowlist', relPath);
  }
  try {
    return readFileSync(join(REPO_ROOT, relPath), 'utf8');
  } catch (err) {
    throw new DashboardError(`fs read failed: ${err.message}`, relPath);
  }
}

// ---------------------------------------------------------------------------
// ENFORCEMENT: explicit git-command allowlist
// ---------------------------------------------------------------------------

function isAllowedGit(argv) {
  if (!Array.isArray(argv) || argv.length === 0) return false;
  // `log --oneline -<N>` where N is a positive integer
  if (
    argv.length === 3 &&
    argv[0] === 'log' &&
    argv[1] === '--oneline' &&
    /^-\d+$/.test(argv[2])
  ) {
    return true;
  }
  // Two-arg patterns
  if (argv.length === 2) {
    if (argv[0] === 'rev-parse' && (argv[1] === 'HEAD' || argv[1] === 'origin/main')) {
      return true;
    }
    if (argv[0] === 'status' && argv[1] === '--short') {
      return true;
    }
  }
  return false;
}

function runAllowedGit(argv) {
  if (!isAllowedGit(argv)) {
    throw new DashboardError('git command not in allowlist', argv.join(' '));
  }
  try {
    return execFileSync('git', argv, {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (err) {
    throw new DashboardError(`git command failed: ${err.message}`, argv.join(' '));
  }
}

// ---------------------------------------------------------------------------
// PARSE LAYER
// ---------------------------------------------------------------------------

function parseStatusPhases(statusContent) {
  const lines = statusContent.split(/\r?\n/);
  const headerRe = /^## ([A-Z][A-Z0-9\-§]+?) — (.+)$/;
  const closedRe = /^Closed at `([0-9a-f]{40})`$/;
  const phases = [];
  for (const line of lines) {
    const m = line.match(headerRe);
    if (!m) continue;
    const name = m[1].trim();
    const state = m[2].trim();
    if (state === 'IN PROGRESS') {
      phases.push({ name, state: 'IN_PROGRESS', sha: null });
    } else {
      const cm = state.match(closedRe);
      if (cm) {
        phases.push({ name, state: 'CLOSED', sha: cm[1] });
      }
    }
  }
  return phases;
}

// ---------------------------------------------------------------------------
// HARD-CODED CANONICAL DATA (per sealed handoffs)
// ---------------------------------------------------------------------------

const RELAY_HEAD = 'b8ab035034668fd53ea6efe64432f0868dfd2eb9';
const RELAY_HEAD_SHORT = RELAY_HEAD.slice(0, 7);
const RELAY_REPO = 'relentlessvic/agent-avila-relay';
const PARENT_REPO = 'relentlessvic/agent-avila';

const SAFETY_GATES = Object.freeze([
  ['Relay runtime', 'DORMANT'],
  ['Autopilot', 'DORMANT'],
  ['Discord posting', 'NOT ACTIVE'],
  ['Live trading authorization', 'NOT AUTHORIZED'],
  ['Manual live-armed flag', 'OPERATOR-ONLY'],
  ['Approvers', '{Victor}'],
  ['CEILING-PAUSE', 'broken via ARC-8-UNPAUSE; counter 0 of 3'],
  ['Migration 008', 'APPLIED'],
  ['Stage 5 Gate-10 install', 'CONSUMED'],
  ['N-3 deploy gate', 'CLOSED'],
]);

const BACKLOG_ITEMS = Object.freeze([
  ['Project Progress Dashboard', 'IMPLEMENT-IN-PROGRESS', 'Design + implement-design cascades CLOSED; this generator is the implementation'],
  ['Agentic OS / Dreaming Engine', 'BACKLOG-IDEA', 'No design yet'],
  ['new Agent Avila Command Center', 'BACKLOG-IDEA', 'Richer UI layer over this dashboard; deferred'],
  ['Relay Phase G', 'BACKLOG-DESIGNED', 'First HIGH-RISK / Mode 5 phase; introduces platform-network behavior'],
  ['Discord posting', 'BLOCKED-DEPENDENCY', 'Cascade through Phase G/H'],
  ['DASH-6', 'BLOCKED-DECISION', 'Separately gated per trading-safety rules'],
  ['Live SELL_ALL implementation (D-5.12f)', 'BLOCKED-DECISION', 'High-risk trading action; separately gated'],
  ['Inherited forbidden-content cleanup', 'BACKLOG', 'Inherited platform-credential env-var name literals across Tier-3 historical content'],
  ['Migration 009+', 'BLOCKED-DECISION', 'Per Migration 008 APPLIED + N-3 CLOSED preservation'],
  ['Relay Stage 5 Steps 14-21 / install resumption', 'BLOCKED-DECISION', 'Stage 5 Gate-10 install approval CONSUMED; Steps 14-21 deferred'],
  ['Phase F amendment / smoke follow-ons', 'BLOCKED-DEPENDENCY', 'F-HALT-AMENDMENT Mode 4 + closeout + paused F-HALT-SMOKE-DESIGN round-1 4 REs pending'],
  ['Railway / deploy actions', 'BLOCKED-DECISION', 'No deploy authorization in scope; separately gated'],
  ['Env / secret / permission widening', 'BLOCKED-DECISION', 'Approvers exactly {Victor} preserved'],
  ['Scheduler / cron / webhook / MCP automation install', 'BLOCKED-DECISION', 'No background automation; COMM-HUB-RULES Hard limits'],
]);

// ---------------------------------------------------------------------------
// RENDER LAYER
// ---------------------------------------------------------------------------

function renderHeader(parentHead, originSha, workingTree, timestamp) {
  const shortHead = parentHead.slice(0, 7);
  const drift = parentHead === originSha
    ? 'in sync with origin/main'
    : `DRIFT vs origin/main (origin=${originSha.slice(0, 7)})`;
  // Preserve leading whitespace on each line (git status --short uses 2-char status
  // codes; for unstaged-modified the leading char is space). Use trimEnd, then split
  // and filter empty lines.
  const wtLines = workingTree.replace(/\s+$/, '').split(/\r?\n/).filter((l) => l.length > 0);
  let wtNote;
  if (wtLines.length === 0) {
    wtNote = 'clean';
  } else {
    // Categorize entries by git status --short prefix:
    //   `?? <path>` = untracked; ` M <path>` / `M  ` / `MM` = modified; `A  ` = added; etc.
    // Prefix is exactly 3 chars (`XY ` where X = staged, Y = working-tree, then space).
    const untracked = [];
    const tracked = [];
    for (const line of wtLines) {
      if (line.startsWith('?? ')) {
        untracked.push(line.slice(3));
      } else if (line.length >= 3) {
        tracked.push(line.slice(3));
      }
    }
    const parts = [];
    if (tracked.length > 0) parts.push(`changed: ${tracked.join(', ')}`);
    if (untracked.length > 0) parts.push(`untracked: ${untracked.join(', ')}`);
    wtNote = parts.join('; ');
  }
  return [
    '# Project Progress Dashboard — Agent Avila',
    '',
    `Generated: ${timestamp}`,
    `Parent HEAD: ${shortHead} (${PARENT_REPO}) — ${drift}`,
    `Relay HEAD:  ${RELAY_HEAD_SHORT} (${RELAY_REPO}; Phase F sealed)`,
    `Working tree: ${wtNote}`,
    '',
  ].join('\n');
}

function renderWhereAreWeNow(phases) {
  const inProgress = phases.find((p) => p.state === 'IN_PROGRESS');
  const closedCount = phases.filter((p) => p.state === 'CLOSED').length;
  const sentence = inProgress
    ? `Active phase: \`${inProgress.name}\`. ${closedCount} phases CLOSED in STATUS.md.`
    : `No active phase in STATUS.md. ${closedCount} phases CLOSED.`;
  return ['## ⚪ Where Are We Now', '', sentence, ''].join('\n');
}

function renderActivePhase(phases) {
  const inProgress = phases.find((p) => p.state === 'IN_PROGRESS');
  if (!inProgress) {
    return ['## ⚡ Active Phase', '', '(none in STATUS.md)', ''].join('\n');
  }
  return [
    '## ⚡ Active Phase',
    '',
    `Phase: \`${inProgress.name}\``,
    'Details: see canonical STATUS.md + CHECKLIST.md + NEXT-ACTION.md',
    '',
  ].join('\n');
}

function renderSafetyGates() {
  const lines = ['## 🚦 Safety Gates', '', '| Gate | Status |', '|---|---|'];
  for (const [gate, status] of SAFETY_GATES) {
    lines.push(`| ${gate} | ${status} |`);
  }
  lines.push('');
  return lines.join('\n');
}

function renderCompletedPhases(phases) {
  const closed = phases.filter((p) => p.state === 'CLOSED');
  const lines = [
    '## ✅ Completed Phases (CLOSED in STATUS.md; most recent first)',
    '',
    '| SHA | Phase |',
    '|---|---|',
  ];
  // STATUS.md appends new closed entries chronologically; reverse for recent-first display.
  for (const p of closed.slice().reverse()) {
    lines.push(`| \`${p.sha.slice(0, 7)}\` | ${p.name} |`);
  }
  lines.push('');
  return lines.join('\n');
}

function renderPausedPhases() {
  return [
    '## ⏸️ Paused Phases',
    '',
    '- `COMM-HUB-RELAY-RUNTIME-IMPLEMENT-F-HALT-SMOKE-DESIGN` — round-1 with 4 REs pending; resumption deferred until F-HALT-AMENDMENT cascade completes',
    '',
  ].join('\n');
}

function renderDesignedNotOpened() {
  return [
    '## 🚧 Designed / Not-Opened (canonical handoffs sealed)',
    '',
    '- `COMM-HUB-RELAY-RUNTIME-IMPLEMENT-F-HALT-AMENDMENT` (Mode 4 SAFE IMPLEMENTATION) — handoff sealed at `f7d511c…`',
    '- `COMM-HUB-RELAY-RUNTIME-IMPLEMENT-F-HALT-AMENDMENT-CLOSEOUT` (Mode 3 DOCS-ONLY)',
    '- `PROJECT-PROGRESS-DASHBOARD-IMPLEMENT` (Mode 4 SAFE IMPLEMENTATION) — handoff sealed at `c8798ea…`',
    '- `COMM-HUB-RELAY-RUNTIME-IMPLEMENT-G-GATEWAY-DESIGN` (Mode 5 HIGH-RISK; first network phase) — canonical RUNTIME-DESIGN §G',
    '',
  ].join('\n');
}

function renderBacklog() {
  const lines = ['## 💡 Backlog / Future Ideas (14 items)', ''];
  for (const [item, status, note] of BACKLOG_ITEMS) {
    lines.push(`- **${item}** — \`${status}\` — ${note}`);
  }
  lines.push('');
  return lines.join('\n');
}

function renderTimeline() {
  return [
    '## 📅 Phase Timeline / Roadmap (committed-anchored only)',
    '',
    '```',
    'Relay repo:                              parent repo:',
    '  Phase A (fcfec48)                       A-BOOTSTRAP-CLOSEOUT (1b20628)',
    '  Phase B (f87faef)                       B-DEPS-DESIGN-SPEC / CLOSEOUT',
    '  Phase C (413a4fb)                       C-CONFIG-DESIGN-SPEC / CLOSEOUT',
    '  Phase D (0d0210a)                       D-STORE-DESIGN-SPEC / CLOSEOUT',
    '  Phase E (21896d6)                       E-VERIFY-DESIGN-SPEC / CLOSEOUT',
    '  Phase F (b8ab035) ← sealed              F-HALT-DESIGN-SPEC / CLOSEOUT',
    '                                          F-HALT-AMENDMENT-DESIGN cascade (closed)',
    '                                          PROJECT-PROGRESS-DASHBOARD-DESIGN cascade (closed)',
    '                                          PROJECT-PROGRESS-DASHBOARD-IMPLEMENT-DESIGN cascade (closed)',
    '  ↓                                       ↓',
    '  (future Phase G — first network)        (future PROJECT-PROGRESS-DASHBOARD-IMPLEMENT)',
    '```',
    '',
    'Future dates omitted; future phases are separately gated with no committed-anchored date.',
    '',
  ].join('\n');
}

function renderRepoAnchors(parentHead, originSha) {
  const drift = parentHead === originSha ? 'in sync' : 'DRIFT';
  return [
    '## 🔗 Repo Anchors',
    '',
    `- Parent: \`${PARENT_REPO}\` @ \`${parentHead.slice(0, 7)}\` (main; ${drift})`,
    `- Relay:  \`${RELAY_REPO}\` @ \`${RELAY_HEAD_SHORT}\` (main; Phase F sealed)`,
    '',
  ].join('\n');
}

function renderDormantVsActive() {
  return [
    '## 🛡️ Dormant vs Active Systems',
    '',
    '| System | State | Notes |',
    '|---|---|---|',
    '| Relay runtime | DORMANT | wired; not activated; fails closed |',
    '| Autopilot | DORMANT | phase-loop counter 0 of 3 |',
    '| Trading bot (bot.js) | OFF-SCOPE / NOT ASSESSED BY THIS DASHBOARD | path is HARD BLOCK per PROTECTED-FILES.md |',
    '| dashboard.js | OFF-SCOPE / NOT ASSESSED BY THIS DASHBOARD | path is RESTRICTED per PROTECTED-FILES.md |',
    '| Antigravity | INSTALLED | workspace config landed; not running |',
    '',
  ].join('\n');
}

function renderNextSafeAction(phases) {
  const inProgress = phases.find((p) => p.state === 'IN_PROGRESS');
  const sentence = inProgress
    ? `Continue the active phase \`${inProgress.name}\` per its NEXT-ACTION block, or pause and choose a backlog item.`
    : 'No active phase; choose a backlog item to open next, or pursue a previously paused phase.';
  return ['## 👉 Next Safe Action', '', sentence, ''].join('\n');
}

// ---------------------------------------------------------------------------
// MAIN
// ---------------------------------------------------------------------------

function main() {
  const parentHead = runAllowedGit(['rev-parse', 'HEAD']).trim();
  const originSha = runAllowedGit(['rev-parse', 'origin/main']).trim();
  const workingTree = runAllowedGit(['status', '--short']);
  // log output read for validation; not displayed in v1 layout but parsed to confirm command works
  runAllowedGit(['log', '--oneline', '-30']);

  const statusContent = readAllowedFile('orchestrator/STATUS.md');
  const phases = parseStatusPhases(statusContent);

  if (phases.length === 0) {
    throw new DashboardError('parsed zero phases from STATUS.md', 'orchestrator/STATUS.md');
  }

  const timestamp = new Date().toISOString();
  const parts = [
    renderHeader(parentHead, originSha, workingTree, timestamp),
    renderWhereAreWeNow(phases),
    renderActivePhase(phases),
    renderSafetyGates(),
    renderCompletedPhases(phases),
    renderPausedPhases(),
    renderDesignedNotOpened(),
    renderBacklog(),
    renderTimeline(),
    renderRepoAnchors(parentHead, originSha),
    renderDormantVsActive(),
    renderNextSafeAction(phases),
  ];

  process.stdout.write(parts.join('\n'));
}

try {
  main();
} catch (err) {
  if (err instanceof DashboardError) {
    process.stderr.write(`${err.message}\n`);
    process.exit(2);
  }
  process.stderr.write(`DashboardError: unexpected: ${err.message}\n`);
  process.exit(3);
}
