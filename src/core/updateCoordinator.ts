// ── Update coordinator ──────────────────────────────────────────────
// Ties leader election, version polling, and service worker together:
//   - Only the leader tab polls for updates.
//   - When a new version is detected the leader broadcasts UPDATE_AVAILABLE.
//   - When the SW enters "waiting" state, broadcasts UPDATE_READY.
//   - Follower tabs receive broadcasts and update their local state.
//   - All tabs maintain an UpdateState and notify subscribers.

import type {
  ChannelMessage,
  UpdateCoordinatorConfig,
  UpdateState,
  VersionJson,
} from './types';
import { createLeaderElection, type LeaderElection } from './leaderElection';
import { createVersionPoller, type VersionPoller } from './versionPoller';
import { registerSW, type SWClient } from './swClient';
import { dbg } from './debugLog';

const DEFAULT_POLL_MS = 5 * 60_000;
const DEFAULT_VERSION_URL = '/version.json';
const DEFAULT_CHANNEL_NAME = 'app-updater';

export interface UpdateCoordinator {
  /** Current snapshot of update state. */
  getState(): UpdateState;
  /** Subscribe to state changes. Returns an unsubscribe function. */
  subscribe(cb: (state: UpdateState) => void): () => void;
  /** Trigger an immediate version check (leader only — no-op for followers). */
  checkNow(): Promise<void>;
  /** Tell the waiting SW to activate and reload the page. */
  applyUpdate(): void;
  /** Tear down all internal resources. */
  destroy(): void;
}

export function createUpdateCoordinator(
  config: UpdateCoordinatorConfig,
): UpdateCoordinator {
  const {
    pollInterval = DEFAULT_POLL_MS,
    versionUrl = DEFAULT_VERSION_URL,
    channelName = DEFAULT_CHANNEL_NAME,
    currentBuildHash,
    onStateChange,
    logger,
  } = config;

  dbg('coordinator init', { currentBuildHash, pollInterval, versionUrl });
  let destroyed = false;

  // ── State ─────────────────────────────────────────────────────
  let state: UpdateState = {
    status: 'current',
    currentBuildHash,
    dismissedHashes: new Set<string>(),
  };

  const subscribers = new Set<(s: UpdateState) => void>();

  function setState(partial: Partial<UpdateState>) {
    state = { ...state, ...partial };
    onStateChange?.(state);
    for (const cb of subscribers) {
      try { cb(state); } catch { /* swallow subscriber errors */ }
    }
  }

  // ── Cross-tab channel for update broadcasts ───────────────────
  let updateChannel: BroadcastChannel | null = null;
  try {
    updateChannel = new BroadcastChannel(channelName + ':updates');
  } catch { /* no BroadcastChannel */ }

  function broadcastMsg(type: 'UPDATE_AVAILABLE' | 'UPDATE_READY', remote?: VersionJson) {
    const msg: ChannelMessage = {
      type,
      tabId: '', // not relevant for update messages
      payload: remote,
    };
    dbg('broadcasting', { type, buildHash: remote?.buildHash });
    try { updateChannel?.postMessage(msg); } catch { /* closed */ }
  }

  function onUpdateMessage(event: MessageEvent<ChannelMessage>) {
    if (destroyed) return;
    const msg = event.data;
    if (!msg?.type) return;
    dbg('broadcast received', { type: msg.type, buildHash: msg.payload?.buildHash });

    if (msg.type === 'UPDATE_AVAILABLE' && msg.payload) {
      handleNewVersion(msg.payload);
      reloadIfHidden();
    } else if (msg.type === 'UPDATE_READY') {
      handleUpdateReady();
      reloadIfHidden();
    }
  }

  updateChannel?.addEventListener('message', onUpdateMessage);

  // ── Shared version handler ────────────────────────────────────
  function handleNewVersion(remote: VersionJson) {
    if (remote.buildHash === currentBuildHash) {
      dbg('handleNewVersion: hash matches current, ignoring', { remote: remote.buildHash, current: currentBuildHash });
      return;
    }
    if (state.remoteVersion?.buildHash === remote.buildHash && state.status !== 'current') {
      dbg('handleNewVersion: already tracking this version, ignoring', { hash: remote.buildHash, status: state.status });
      return;
    }
    dbg('handleNewVersion: NEW version detected', { current: currentBuildHash, remote: remote.buildHash, version: remote.version });
    logger?.log('update_available_detected', {
      oldBuildHash: currentBuildHash,
      newBuildHash: remote.buildHash,
      version: remote.version,
      impact: remote.impact,
    });
    setState({ status: 'available', remoteVersion: remote });
  }

  function handleUpdateReady() {
    if (state.status === 'current' && !state.remoteVersion) {
      dbg('handleUpdateReady: no known remote version, ignoring');
      return;
    }
    if (state.status === 'ready') {
      dbg('handleUpdateReady: already ready, ignoring');
      return;
    }
    dbg('handleUpdateReady: transitioning to READY');
    logger?.log('sw_waiting_detected', {
      currentBuildHash,
      remoteBuildHash: state.remoteVersion?.buildHash,
    });
    setState({ status: 'ready' });
  }

  /** If the tab is hidden, reload immediately — nobody is watching. */
  function reloadIfHidden() {
    const vis = typeof document !== 'undefined' ? document.visibilityState : 'unknown';
    dbg('reloadIfHidden', { visibilityState: vis });
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
      dbg('reloadIfHidden: TAB IS HIDDEN — reloading now');
      window.location.reload();
    }
  }

  // ── Leader election ───────────────────────────────────────────
  const election: LeaderElection = createLeaderElection(channelName, logger);

  // ── Version poller ────────────────────────────────────────────
  const poller: VersionPoller = createVersionPoller({
    versionUrl,
    pollInterval,
    currentBuildHash,
    logger,
    onNewVersion(remote) {
      handleNewVersion(remote);
      broadcastMsg('UPDATE_AVAILABLE', remote);
      reloadIfHidden();
    },
  });

  // Start/stop poller based on leadership.
  function syncPollerToLeadership(isLeader: boolean) {
    if (destroyed) return;
    if (isLeader) {
      poller.start();
    } else {
      poller.stop();
    }
  }

  election.onLeaderChange(syncPollerToLeadership);
  // Kick off if we are already leader (init race).
  if (election.isLeader()) {
    poller.start();
  }

  // ── Service worker ────────────────────────────────────────────
  let sw: SWClient | null = null;

  if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
    sw = registerSW();

    sw.onWaiting(() => {
      if (destroyed) return;
      handleUpdateReady();
      broadcastMsg('UPDATE_READY');
    });
  } else {
    // SW not supported — degrade to reload-only mode.
    logger?.log('sw_unsupported', { degradedMode: 'reload-only' });
  }

  // ── Reload when tab goes hidden with a pending update ────────
  function onVisibilityChange() {
    if (destroyed) return;
    if (document.visibilityState === 'hidden' && state.status !== 'current') {
      dbg('visibilitychange: tab went hidden with pending update — reloading', { status: state.status });
      window.location.reload();
    }
  }

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', onVisibilityChange);
  }

  // ── Public API ────────────────────────────────────────────────
  function getState(): UpdateState {
    return state;
  }

  function subscribe(cb: (s: UpdateState) => void): () => void {
    subscribers.add(cb);
    return () => { subscribers.delete(cb); };
  }

  async function checkNow(): Promise<void> {
    if (destroyed) return;
    await poller.checkNow();
  }

  function applyUpdate() {
    dbg('applyUpdate called', { currentBuildHash, remoteBuildHash: state.remoteVersion?.buildHash, hasSW: !!sw });
    logger?.log('reload_clicked', {
      currentBuildHash,
      remoteBuildHash: state.remoteVersion?.buildHash,
      hasSW: !!sw,
    });
    if (sw) {
      sw.skipWaitingAndReload();
    } else {
      // No SW — plain reload picks up the new deployment.
      window.location.reload();
    }
  }

  function destroy() {
    if (destroyed) return;
    destroyed = true;
    poller.destroy();
    election.destroy();
    sw?.destroy();
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', onVisibilityChange);
    }
    if (updateChannel) {
      updateChannel.removeEventListener('message', onUpdateMessage);
      updateChannel.close();
      updateChannel = null;
    }
    subscribers.clear();
  }

  return { getState, subscribe, checkNow, applyUpdate, destroy };
}
