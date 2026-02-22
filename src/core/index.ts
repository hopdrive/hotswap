// ── @hopdrive/hotswap — core barrel export ──────────────────────────

// Types
export type {
  Impact,
  UpdateStatus,
  MediaItem,
  VersionNotes,
  VersionJson,
  UpdateState,
  UpdateCoordinatorConfig,
  UpdateLogHandler,
  UpdateLogger,
  ChannelMessageType,
  ChannelMessage,
} from './types';

// Coordinator
export {
  createUpdateCoordinator,
  type UpdateCoordinator,
} from './updateCoordinator';

// Subsystems
export { createVersionPoller, type VersionPoller, type VersionPollerConfig } from './versionPoller';
export { createLeaderElection, type LeaderElection } from './leaderElection';
export { registerSW, type SWClient } from './swClient';
export { createUpdateLogger } from './updateLogger';
export { dbg, enableDebug } from './debugLog';
