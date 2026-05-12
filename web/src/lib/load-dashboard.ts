import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { type DashboardData, DashboardLoadError } from './types';
import { parseDashboard } from './dashboard-parser';

const DASHBOARD_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
  'orchestrator',
  'DASHBOARD.md'
);

export function loadDashboard(): DashboardData {
  let markdown: string;
  try {
    markdown = readFileSync(DASHBOARD_PATH, 'utf8');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new DashboardLoadError(`Failed to read DASHBOARD.md at ${DASHBOARD_PATH}: ${message}`);
  }
  return parseDashboard(markdown);
}
