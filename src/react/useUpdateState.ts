// ── React hook: useUpdateState ──────────────────────────────────────
// Reads coordinator from UpdateProvider context instead of managing a
// module-level singleton Map. Keeps useSyncExternalStore subscription
// and dismissed-hashes localStorage logic.

import { useSyncExternalStore } from 'react';
import type { UpdateState } from '../core/types';
import { dbg } from '../core/debugLog';
import { useUpdateContext } from './UpdateProvider';

const DISMISSED_STORAGE_PREFIX = 'app-updater:dismissed';

function dismissedStorageKey(channelName: string): string {
  return `${DISMISSED_STORAGE_PREFIX}:${channelName}`;
}

function loadDismissedHashes(channelName: string): Set<string> {
  try {
    const raw = localStorage.getItem(dismissedStorageKey(channelName));
    if (raw) return new Set(JSON.parse(raw) as string[]);
  } catch { /* corrupt storage — start fresh */ }
  return new Set();
}

function saveDismissedHashes(channelName: string, hashes: Set<string>) {
  try {
    localStorage.setItem(dismissedStorageKey(channelName), JSON.stringify([...hashes]));
  } catch { /* quota exceeded or private browsing — ignore */ }
}

// ── Hook ────────────────────────────────────────────────────────────

export interface UseUpdateStateResult {
  state: UpdateState;
  checkNow(): Promise<void>;
  applyUpdate(): void;
  dismissUpdate(): void;
}

export function useUpdateState(): UseUpdateStateResult {
  const { coordinator, config } = useUpdateContext();
  const { channelName } = config;

  // ── Subscribe to coordinator state via useSyncExternalStore ────
  const state = useSyncExternalStore(
    (onStoreChange) => coordinator.subscribe(onStoreChange),
    () => coordinator.getState(),
    () => coordinator.getState(), // server snapshot (SSR — same value)
  );

  // ── Actions ───────────────────────────────────────────────────
  function checkNow(): Promise<void> {
    return coordinator.checkNow();
  }

  function applyUpdate() {
    coordinator.applyUpdate();
  }

  function dismissUpdate() {
    const remote = state.remoteVersion;
    if (!remote) return;

    const dismissed = loadDismissedHashes(channelName);
    dismissed.add(remote.buildHash);
    saveDismissedHashes(channelName, dismissed);
  }

  // Merge persisted dismissals into the returned state so the UI can
  // gate notifications. We only show updates to visible tabs.
  const isVisible = typeof document !== 'undefined'
    ? document.visibilityState === 'visible'
    : false;

  const dismissed = loadDismissedHashes(channelName);
  const effectiveState: UpdateState = {
    ...state,
    dismissedHashes: dismissed,
  };

  // If the remote version has been dismissed, report as 'current' to the UI
  // so no notification is shown.
  const isDismissed = effectiveState.remoteVersion
    ? dismissed.has(effectiveState.remoteVersion.buildHash)
    : false;

  const visibleState: UpdateState = {
    ...effectiveState,
    status: (!isVisible || isDismissed)
      ? 'current'
      : effectiveState.status,
  };

  dbg('useUpdateState render', {
    coordinatorStatus: state.status,
    exposedStatus: visibleState.status,
    isVisible,
    isDismissed,
    remoteBuildHash: state.remoteVersion?.buildHash ?? null,
    currentBuildHash: state.currentBuildHash,
  });

  return { state: visibleState, checkNow, applyUpdate, dismissUpdate };
}
