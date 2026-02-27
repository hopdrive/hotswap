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

/** A structured feature row inside release notes. */
export interface Feature {
  icon?: string;       // MUI icon name, e.g. "PlayArrow", "AccountTree"
  heading: string;     // Bold subheading
  description: string; // 1-3 line description
}

/** Structured release notes authored via changesets. */
export interface VersionNotes {
  title: string;
  summary: string;
  bullets: string[];
  features?: Feature[];   // Structured feature rows
  ctaLabel?: string;      // Primary CTA button label
  ctaUrl?: string;        // Primary CTA button URL
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

// ── MDX release content types ────────────────────────────────────────

/**
 * Frontmatter extracted from a `releases/{version}.mdx` file.
 *
 * @example
 * ```yaml
 * ---
 * version: "1.4.0"
 * impact: minor
 * title: "Team Activity Feed"
 * summary: "Track what your team is doing in real-time."
 * features:
 *   - icon: Groups
 *     heading: "Live Activity Stream"
 *     description: "See deploys, merges, and config changes as they happen."
 *   - icon: Timeline
 *     heading: "Activity History"
 *     description: "Scroll back through your team's recent actions."
 * ctaLabel: "Try it now"
 * ctaUrl: "/team"
 * ---
 * ```
 */
export interface ReleaseFrontmatter {
  /** Semver version string. Must match the MDX filename (e.g. `1.4.0` → `releases/1.4.0.mdx`). */
  version: string;
  /** How urgently users should update. Controls notification style — see README for mapping. */
  impact: Impact;
  /** Short title shown in toast, modal heading, and changelog. */
  title: string;
  /** 1-2 sentence summary shown in the update toast body text. */
  summary: string;
  /** Structured feature rows shown in the release notes modal. Each needs a heading + description; icon is optional (MUI icon name). */
  features?: Feature[];
  /** Primary CTA button label in the release notes modal (e.g. "Try it now"). */
  ctaLabel?: string;
  /** URL for the primary CTA button. */
  ctaUrl?: string;
}

/** A compiled MDX release — frontmatter metadata + React component. */
export interface CompiledRelease {
  frontmatter: ReleaseFrontmatter;
  /** Pre-compiled MDX component for the release body content. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Component: (props: Record<string, any>) => any;
}
