import {
  type DashboardData,
  type DashboardMetadata,
  type WhereAreWeNow,
  type ActivePhase,
  type SafetyGate,
  type Phase,
  type PausedPhase,
  type DesignedPhase,
  type BacklogItem,
  type RepoAnchor,
  type DormantVsActiveRow,
  DashboardParseError
} from './types';

function normalizeHeading(line: string): string {
  const stripped = line.replace(/^##\s+/, '');
  return stripped.replace(/^[^\w]+/, '').trim();
}

function splitSections(markdown: string): Map<string, string> {
  const lines = markdown.split('\n');
  const sections = new Map<string, string>();
  let currentName: string | null = null;
  let currentBody: string[] = [];

  for (const line of lines) {
    if (line.startsWith('## ')) {
      if (currentName !== null) {
        sections.set(currentName, currentBody.join('\n').trim());
      }
      currentName = normalizeHeading(line);
      currentBody = [];
    } else if (currentName !== null) {
      currentBody.push(line);
    }
  }
  if (currentName !== null) {
    sections.set(currentName, currentBody.join('\n').trim());
  }
  return sections;
}

function findSectionByPrefix(sections: Map<string, string>, prefix: string): string {
  for (const [name, body] of sections.entries()) {
    if (name.startsWith(prefix)) return body;
  }
  throw new DashboardParseError(`Missing section starting with "${prefix}" in DASHBOARD.md`);
}

function parseMetadata(headerBlock: string): DashboardMetadata {
  let generatedAt = '';
  let parentHead = '';
  let parentRepo = '';
  let parentRepoStatus = '';
  let relayHead = '';
  let relayRepo = '';
  let relayRepoStatus = '';
  let workingTree = '';

  for (const line of headerBlock.split('\n')) {
    const genMatch = line.match(/^Generated:\s*(.+)$/);
    if (genMatch) {
      generatedAt = genMatch[1].trim();
      continue;
    }
    const parentMatch = line.match(/^Parent HEAD:\s+(\S+)\s+\(([^)]+)\)\s+—\s+(.+)$/);
    if (parentMatch) {
      parentHead = parentMatch[1];
      parentRepo = parentMatch[2];
      parentRepoStatus = parentMatch[3];
      continue;
    }
    const relayMatch = line.match(/^Relay HEAD:\s+(\S+)\s+\(([^;)]+)(?:;\s*([^)]+))?\)/);
    if (relayMatch) {
      relayHead = relayMatch[1];
      relayRepo = relayMatch[2].trim();
      relayRepoStatus = relayMatch[3]?.trim() ?? '';
      continue;
    }
    const wtMatch = line.match(/^Working tree:\s*(.+)$/);
    if (wtMatch) {
      workingTree = wtMatch[1].trim();
    }
  }

  if (!generatedAt) {
    throw new DashboardParseError('Missing "Generated:" line in DASHBOARD.md header');
  }
  if (!parentHead) {
    throw new DashboardParseError('Missing or malformed "Parent HEAD:" line in DASHBOARD.md header');
  }
  if (!relayHead) {
    throw new DashboardParseError('Missing or malformed "Relay HEAD:" line in DASHBOARD.md header');
  }

  return {
    generatedAt,
    parentHead,
    parentRepo,
    parentRepoStatus,
    relayHead,
    relayRepo,
    relayRepoStatus,
    workingTree
  };
}

function parseWhereAreWeNow(body: string): WhereAreWeNow {
  const match = body.match(/Active phase:\s*`([^`]+)`\.\s*(\d+)\s+phases\s+CLOSED/i);
  if (!match) {
    throw new DashboardParseError('Cannot parse "Where Are We Now" section: missing active phase or count');
  }
  return {
    activePhase: match[1],
    totalClosedCount: parseInt(match[2], 10)
  };
}

function parseActivePhase(body: string): ActivePhase {
  const phaseMatch = body.match(/Phase:\s*`([^`]+)`/);
  if (!phaseMatch) {
    throw new DashboardParseError('Cannot parse "Active Phase" section: missing phase name');
  }
  const detailsLine = body.split('\n').find(l => l.startsWith('Details:'))?.replace(/^Details:\s*/, '').trim() ?? '';
  return {
    name: phaseMatch[1],
    detailsHint: detailsLine
  };
}

function parseTableRows(body: string): readonly (readonly string[])[] {
  const lines = body.split('\n');
  const tableLines: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('|')) {
      tableLines.push(trimmed);
    } else if (tableLines.length > 0) {
      break;
    }
  }
  if (tableLines.length < 3) return [];
  const dataRows = tableLines.slice(2);
  return dataRows.map(line => line.split('|').slice(1, -1).map(c => c.trim()));
}

function parseSafetyGates(body: string): readonly SafetyGate[] {
  const rows = parseTableRows(body);
  if (rows.length === 0) {
    throw new DashboardParseError('Cannot parse "Safety Gates" table: no rows found');
  }
  return rows.map(row => ({ name: row[0] ?? '', status: row[1] ?? '' }));
}

function parseCompletedPhases(body: string): readonly Phase[] {
  const rows = parseTableRows(body);
  const phases = rows
    .map(row => ({
      sha: (row[0] ?? '').replace(/`/g, '').trim(),
      name: (row[1] ?? '').trim()
    }))
    .filter(p => p.sha.length > 0);
  if (phases.length === 0) {
    throw new DashboardParseError('Cannot parse "Completed Phases" table: no valid rows found');
  }
  return phases;
}

function parsePausedPhases(body: string): readonly PausedPhase[] {
  const items: PausedPhase[] = [];
  for (const line of body.split('\n')) {
    const match = line.match(/^-\s+`([^`]+)`\s*—\s*(.+)$/);
    if (match) {
      items.push({ name: match[1], note: match[2].trim() });
    }
  }
  return items;
}

function parseDesignedNotOpened(body: string): readonly DesignedPhase[] {
  const items: DesignedPhase[] = [];
  for (const line of body.split('\n')) {
    const match = line.match(/^-\s+`([^`]+)`\s*(.*)$/);
    if (match) {
      const note = match[2].replace(/^—\s*/, '').trim();
      items.push({ name: match[1], note });
    }
  }
  return items;
}

function parseBacklog(body: string): readonly BacklogItem[] {
  const items: BacklogItem[] = [];
  for (const line of body.split('\n')) {
    const match = line.match(/^-\s+\*\*([^*]+)\*\*\s*—\s*`([^`]+)`\s*—\s*(.+)$/);
    if (match) {
      items.push({
        title: match[1].trim(),
        stateBadge: match[2].trim(),
        description: match[3].trim()
      });
    }
  }
  if (items.length === 0) {
    throw new DashboardParseError('Cannot parse "Backlog" section: no items found');
  }
  return items;
}

function parsePhaseTimeline(body: string): string {
  const match = body.match(/```\n([\s\S]+?)\n```/);
  return match ? match[1] : body.trim();
}

function parseRepoAnchors(body: string): readonly RepoAnchor[] {
  const anchors: RepoAnchor[] = [];
  for (const line of body.split('\n')) {
    const match = line.match(/^-\s+(\w+):\s+`([^`]+)`\s+@\s+`([^`]+)`\s+\(([^)]+)\)/);
    if (match) {
      anchors.push({
        label: match[1],
        repo: match[2],
        sha: match[3],
        note: match[4].trim()
      });
    }
  }
  if (anchors.length === 0) {
    throw new DashboardParseError('Cannot parse "Repo Anchors" section: no anchors found');
  }
  return anchors;
}

function parseDormantVsActive(body: string): readonly DormantVsActiveRow[] {
  const rows = parseTableRows(body);
  if (rows.length === 0) {
    throw new DashboardParseError('Cannot parse "Dormant vs Active Systems" table: no rows found');
  }
  return rows.map(row => ({
    system: row[0] ?? '',
    state: row[1] ?? '',
    notes: row[2] ?? ''
  }));
}

function parseNextSafeAction(body: string): string {
  return body.trim();
}

export function parseDashboard(markdown: string): DashboardData {
  if (typeof markdown !== 'string' || markdown.length === 0) {
    throw new DashboardParseError('parseDashboard received empty or non-string input');
  }

  const firstSectionStart = markdown.indexOf('\n## ');
  const headerBlock = firstSectionStart === -1 ? markdown : markdown.substring(0, firstSectionStart);
  const metadata = parseMetadata(headerBlock);

  const sections = splitSections(markdown);

  return {
    metadata,
    whereAreWeNow: parseWhereAreWeNow(findSectionByPrefix(sections, 'Where Are We Now')),
    activePhase: parseActivePhase(findSectionByPrefix(sections, 'Active Phase')),
    safetyGates: parseSafetyGates(findSectionByPrefix(sections, 'Safety Gates')),
    completedPhases: parseCompletedPhases(findSectionByPrefix(sections, 'Completed Phases')),
    pausedPhases: parsePausedPhases(findSectionByPrefix(sections, 'Paused Phases')),
    designedNotOpened: parseDesignedNotOpened(findSectionByPrefix(sections, 'Designed')),
    backlog: parseBacklog(findSectionByPrefix(sections, 'Backlog')),
    phaseTimeline: parsePhaseTimeline(findSectionByPrefix(sections, 'Phase Timeline')),
    repoAnchors: parseRepoAnchors(findSectionByPrefix(sections, 'Repo Anchors')),
    dormantVsActive: parseDormantVsActive(findSectionByPrefix(sections, 'Dormant vs Active')),
    nextSafeAction: parseNextSafeAction(findSectionByPrefix(sections, 'Next Safe Action'))
  };
}
