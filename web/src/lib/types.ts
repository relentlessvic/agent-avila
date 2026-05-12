export interface SafetyGate {
  readonly name: string;
  readonly status: string;
}

export interface Phase {
  readonly sha: string;
  readonly name: string;
}

export interface PausedPhase {
  readonly name: string;
  readonly note: string;
}

export interface DesignedPhase {
  readonly name: string;
  readonly note: string;
}

export interface BacklogItem {
  readonly title: string;
  readonly stateBadge: string;
  readonly description: string;
}

export interface RepoAnchor {
  readonly label: string;
  readonly repo: string;
  readonly sha: string;
  readonly note: string;
}

export interface DormantVsActiveRow {
  readonly system: string;
  readonly state: string;
  readonly notes: string;
}

export interface DashboardMetadata {
  readonly generatedAt: string;
  readonly parentHead: string;
  readonly parentRepo: string;
  readonly parentRepoStatus: string;
  readonly relayHead: string;
  readonly relayRepo: string;
  readonly relayRepoStatus: string;
  readonly workingTree: string;
}

export interface WhereAreWeNow {
  readonly activePhase: string;
  readonly totalClosedCount: number;
}

export interface ActivePhase {
  readonly name: string;
  readonly detailsHint: string;
}

export interface DashboardData {
  readonly metadata: DashboardMetadata;
  readonly whereAreWeNow: WhereAreWeNow;
  readonly activePhase: ActivePhase;
  readonly safetyGates: readonly SafetyGate[];
  readonly completedPhases: readonly Phase[];
  readonly pausedPhases: readonly PausedPhase[];
  readonly designedNotOpened: readonly DesignedPhase[];
  readonly backlog: readonly BacklogItem[];
  readonly phaseTimeline: string;
  readonly repoAnchors: readonly RepoAnchor[];
  readonly dormantVsActive: readonly DormantVsActiveRow[];
  readonly nextSafeAction: string;
}

export class DashboardLoadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DashboardLoadError';
  }
}

export class DashboardParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DashboardParseError';
  }
}
