export const SECTION_IDS = {
  header: 'header',
  hero: 'hero',
  activePhase: 'active-phase',
  safetyGates: 'safety-gates',
  completedPhases: 'completed-phases',
  pausedPhases: 'paused-phases',
  designedNotOpened: 'designed-not-opened',
  backlog: 'backlog',
  phaseTimeline: 'phase-timeline',
  repoAnchors: 'repo-anchors',
  dormantVsActive: 'dormant-vs-active',
  nextSafeAction: 'next-safe-action'
} as const;

export type PillColor = 'cyan' | 'violet' | 'emerald' | 'amber' | 'coral' | 'slate';

export function getSafetyGateColor(status: string): PillColor {
  const upper = status.toUpperCase();
  if (upper.includes('DORMANT')) return 'cyan';
  if (upper.includes('NOT ACTIVE')) return 'slate';
  if (upper.includes('NOT AUTHORIZED')) return 'coral';
  if (upper.includes('OPERATOR-ONLY')) return 'amber';
  if (upper.includes('APPLIED') || upper.includes('CONSUMED') || upper.includes('CLOSED')) return 'emerald';
  if (upper.includes('BROKEN') || upper.includes('PAUSE')) return 'amber';
  if (upper.includes('{VICTOR}')) return 'cyan';
  return 'slate';
}

export function getBacklogStateColor(state: string): PillColor {
  if (state.includes('IMPLEMENT-IN-PROGRESS')) return 'cyan';
  if (state.includes('BACKLOG-DESIGNED')) return 'violet';
  if (state.includes('BACKLOG-IDEA')) return 'slate';
  if (state.includes('BLOCKED-DEPENDENCY')) return 'amber';
  if (state.includes('BLOCKED-DECISION')) return 'coral';
  if (state === 'BACKLOG') return 'slate';
  return 'slate';
}

export function getDormantVsActiveColor(state: string): PillColor {
  const upper = state.toUpperCase();
  if (upper.includes('OFF-SCOPE')) return 'slate';
  if (upper.includes('DORMANT')) return 'cyan';
  if (upper.includes('INSTALLED') || upper.includes('ACTIVE')) return 'emerald';
  return 'slate';
}
