// ── Update system shared types ──────────────────────────────────────
// Framework-agnostic core of @hopdrive/hotswap.

/** How urgently the user should update. Drives messaging tone. */
export type Impact = 'patch' | 'minor' | 'major' | 'critical';

/** Lifecycle status of an available update. */
export type UpdateStatus = 'current' | 'available' | 'ready';

/** A single media attachment inside release notes. */
export interface MediaItem {
  type: 'image' | 'video';
  src: string;
  alt?: string;
  title?: string;
}

/** Structured release notes authored via changesets. */
export interface VersionNotes {
  title: string;
  summary: string;
  bullets: string[];
  learnMoreUrl?: string;
  media?: MediaItem[];
}

/** Shape of the deployed `/version.json` file. */
export interface VersionJson {
  version: string;
  buildHash: string;
  releasedAt: string;
  impact: Impact;
  notes: VersionNotes;
}

/** Immutable snapshot of the update system's state. */
export interface UpdateState {
  status: UpdateStatus;
  currentBuildHash: string;
  remoteVersion?: VersionJson;
  dismissedHashes: Set<string>;
}

/** Configuration for the update coordinator. */
export interface UpdateCoordinatorConfig {
  /** Polling interval in milliseconds. Default: 300 000 (5 min). */
  pollInterval?: number;
  /** URL to fetch version metadata from. Default: '/version.json'. */
  versionUrl?: string;
  /** BroadcastChannel name. Default: 'app-updater'. */
  channelName?: string;
  /** Build hash baked into this deployment (e.g. VITE_BUILD_HASH). */
  currentBuildHash: string;
  /** Called whenever UpdateState changes. */
  onStateChange?: (state: UpdateState) => void;
  /** Optional logger for observability. */
  logger?: UpdateLogger;
}

// ── Observability logger ─────────────────────────────────────────────

export type UpdateLogHandler = (event: string, data: Record<string, unknown>) => void;

export interface UpdateLogger {
  log: UpdateLogHandler;
}

// ── BroadcastChannel message protocol ───────────────────────────────

export type ChannelMessageType =
  | 'LEADER_CLAIM'
  | 'LEADER_HEARTBEAT'
  | 'LEADER_RESIGN'
  | 'UPDATE_AVAILABLE'
  | 'UPDATE_READY';

export interface ChannelMessage {
  type: ChannelMessageType;
  tabId: string;
  payload?: VersionJson;
}
