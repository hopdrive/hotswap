// ── Version poller ──────────────────────────────────────────────────
// Fetches version.json on a configurable interval, with:
//   - Random jitter on the initial check (+/-15 s).
//   - Immediate check when the document becomes visible.
//   - Exponential backoff on fetch errors: 30 s -> 1 m -> 2 m -> 5 m -> 10 m -> 30 m.
//   - Backoff resets on a successful fetch.

import type { UpdateLogger, VersionJson } from './types';

const DEFAULT_POLL_MS = 5 * 60_000; // 5 minutes
const INITIAL_JITTER_MS = 15_000;
const BACKOFF_STEPS_MS = [30_000, 60_000, 120_000, 300_000, 600_000, 1_800_000];

export interface VersionPollerConfig {
  /** URL to fetch. Default: '/version.json'. */
  versionUrl?: string;
  /** Normal polling interval in ms. Default: 300 000 (5 min). */
  pollInterval?: number;
  /** Build hash of the running deployment. */
  currentBuildHash: string;
  /** Called when a new remote version is detected (different buildHash). */
  onNewVersion: (remote: VersionJson) => void;
  /** Called on every successful fetch (even if no change). */
  onCheckComplete?: () => void;
  /** Called when a fetch fails. */
  onError?: (error: unknown) => void;
  /** Optional logger for observability. */
  logger?: UpdateLogger;
}

export interface VersionPoller {
  /** Start polling (with initial jitter). */
  start(): void;
  /** Stop polling and cancel pending timers. */
  stop(): void;
  /** Trigger an immediate check, ignoring jitter. */
  checkNow(): Promise<void>;
  /** Stop + clean up event listeners. */
  destroy(): void;
}

export function createVersionPoller(config: VersionPollerConfig): VersionPoller {
  const {
    versionUrl = '/version.json',
    pollInterval = DEFAULT_POLL_MS,
    currentBuildHash,
    onNewVersion,
    onCheckComplete,
    onError,
    logger,
  } = config;

  let running = false;
  let destroyed = false;
  let pollTimer: ReturnType<typeof setTimeout> | undefined;
  let backoffIndex = -1; // -1 means "no errors, use normal interval"
  let fetching = false;

  // ── Core fetch ────────────────────────────────────────────────
  async function fetchVersion(): Promise<void> {
    if (destroyed || fetching) return;

    // Suppress fetch when offline — resume naturally on reconnect.
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;

    fetching = true;
    try {
      const res = await fetch(versionUrl, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: VersionJson = await res.json();

      // Reset backoff on success.
      backoffIndex = -1;

      logger?.log('update_check_success', {
        versionUrl,
        remoteBuildHash: data.buildHash,
        currentBuildHash,
      });

      if (data.buildHash && data.buildHash !== currentBuildHash) {
        onNewVersion(data);
      }

      onCheckComplete?.();
    } catch (err) {
      backoffIndex = Math.min(backoffIndex + 1, BACKOFF_STEPS_MS.length - 1);
      logger?.log('update_check_fail', {
        versionUrl,
        error: String(err),
        backoffIndex,
      });
      onError?.(err);
    } finally {
      fetching = false;
    }
  }

  // ── Scheduling ────────────────────────────────────────────────
  function nextDelay(): number {
    if (backoffIndex >= 0) return BACKOFF_STEPS_MS[backoffIndex];
    return pollInterval;
  }

  function scheduleNext() {
    if (!running || destroyed) return;
    pollTimer = setTimeout(async () => {
      if (!running || destroyed) return;
      await fetchVersion();
      scheduleNext();
    }, nextDelay());
  }

  function cancelTimer() {
    if (pollTimer !== undefined) {
      clearTimeout(pollTimer);
      pollTimer = undefined;
    }
  }

  // ── Visibility handler ────────────────────────────────────────
  function onVisibilityChange() {
    if (destroyed || !running) return;
    if (document.visibilityState === 'visible') {
      // Immediate check when tab becomes visible.
      cancelTimer();
      void fetchVersion().then(() => { scheduleNext(); });
    }
  }

  // ── Public API ────────────────────────────────────────────────
  function start() {
    if (running || destroyed) return;
    running = true;

    document.addEventListener('visibilitychange', onVisibilityChange);

    // Initial check with random jitter (0..30 s).
    const jitter = Math.floor(Math.random() * INITIAL_JITTER_MS * 2);
    pollTimer = setTimeout(async () => {
      if (!running || destroyed) return;
      await fetchVersion();
      scheduleNext();
    }, jitter);
  }

  function stop() {
    running = false;
    cancelTimer();
    document.removeEventListener('visibilitychange', onVisibilityChange);
  }

  async function checkNow(): Promise<void> {
    if (destroyed) return;
    cancelTimer();
    await fetchVersion();
    if (running) scheduleNext();
  }

  function destroy() {
    if (destroyed) return;
    destroyed = true;
    stop();
  }

  return { start, stop, checkNow, destroy };
}
