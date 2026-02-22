// ── Update toast state machine ───────────────────────────────────────
// Orchestrates idle detection, countdown timer, and update state into
// a single state machine that drives the UpdateToast and
// CriticalUpdateBanner components.
//
// Decoupled from:
//   - React Router: onNavigateToChangelog from provider context (optional)
//   - Build hash global: reads from provider context
//   - Timing constants: idleTimeout / countdownSeconds from provider context

import { useState, useCallback, useEffect, useRef } from 'react';
import { useUpdateState } from './useUpdateState';
import { useIdleDetector } from './useIdleDetector';
import { useCountdown } from './useCountdown';
import { useUpdateContext } from './UpdateProvider';
import type { VersionJson, UpdateStatus } from '../core/types';
import { dbg } from '../core/debugLog';

export type ToastPhase =
  | 'hidden'
  | 'toast_visible'
  | 'countdown'
  | 'postponed'
  | 'refreshing';

const POSTPONED_KEY = 'app-updater:postponed';

// ── Postponed persistence ────────────────────────────────────────────

interface PostponedData {
  buildHash: string;
  postponedAt: number;
}

function loadPostponed(): PostponedData | null {
  try {
    const raw = localStorage.getItem(POSTPONED_KEY);
    return raw ? (JSON.parse(raw) as PostponedData) : null;
  } catch {
    return null;
  }
}

function savePostponed(data: PostponedData | null) {
  try {
    if (data) localStorage.setItem(POSTPONED_KEY, JSON.stringify(data));
    else localStorage.removeItem(POSTPONED_KEY);
  } catch {
    /* quota exceeded or private browsing */
  }
}

// ── Hook ─────────────────────────────────────────────────────────────

export interface UseUpdateToastStateResult {
  phase: ToastPhase;
  secondsRemaining: number;
  remoteVersion: VersionJson | null;
  status: UpdateStatus;
  isCritical: boolean;
  onViewChangelog: () => void;
  onPostpone: () => void;
  onReloadNow: () => void;
  onDismiss: () => void;
  simulateUpdate: () => void;
}

export function useUpdateToastState(): UseUpdateToastStateResult {
  const { config } = useUpdateContext();
  const { idleTimeout, countdownSeconds, onNavigateToChangelog } = config;

  // ── Update coordinator ───────────────────────────────────────────
  const { state, applyUpdate, dismissUpdate } = useUpdateState();

  // ── Simulation override ────────────────────────────────────────
  const [simulatedVersion, setSimulatedVersion] = useState<VersionJson | null>(null);

  const simulateUpdate = useCallback(() => {
    setSimulatedVersion((prev) => {
      if (prev) return null; // toggle off
      const hash = Math.random().toString(36).slice(2, 10);
      return {
        version: '99.0.0',
        buildHash: hash,
        releasedAt: new Date().toISOString(),
        impact: 'minor',
        notes: {
          title: 'Simulated Update',
          summary: 'This is a fake update for design preview.',
          bullets: [
            'New dashboard layout',
            'Improved accessibility',
            'Bug fixes and performance improvements',
          ],
        },
      };
    });
  }, []);

  const isSimulating = simulatedVersion != null;
  const remote = isSimulating ? simulatedVersion : (state.remoteVersion ?? null);
  const hasUpdate = isSimulating || (state.status !== 'current' && remote != null);
  const isCritical = remote?.impact === 'critical' && hasUpdate;

  // ── Postpone tracking ────────────────────────────────────────────
  const [userPostponed, setUserPostponed] = useState(() => {
    if (!remote) return false;
    const postponed = loadPostponed();
    return postponed?.buildHash === remote.buildHash;
  });

  // Re-check when remote version changes
  useEffect(() => {
    if (!remote) {
      setUserPostponed(false);
      return;
    }
    const postponed = loadPostponed();
    setUserPostponed(postponed?.buildHash === remote.buildHash);
  }, [remote?.buildHash]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Idle detection ───────────────────────────────────────────────
  const { isIdle } = useIdleDetector({
    timeout: idleTimeout,
    enabled: hasUpdate,
  });

  // ── Compute phase ────────────────────────────────────────────────
  const refreshingRef = useRef(false);

  let phase: ToastPhase = 'hidden';
  if (!hasUpdate || refreshingRef.current) {
    phase = refreshingRef.current ? 'refreshing' : 'hidden';
  } else if (userPostponed) {
    phase = 'postponed';
  } else if (isIdle) {
    phase = 'countdown';
  } else {
    phase = 'toast_visible';
  }

  // Debug: log phase changes
  const prevPhaseRef = useRef<ToastPhase>('hidden');
  if (phase !== prevPhaseRef.current) {
    dbg('phase changed: ' + prevPhaseRef.current + ' → ' + phase, {
      hasUpdate, isIdle, userPostponed, isSimulating,
      refreshing: refreshingRef.current,
      status: state.status,
      remoteBuildHash: remote?.buildHash,
      visibilityState: typeof document !== 'undefined' ? document.visibilityState : 'unknown',
    });
    prevPhaseRef.current = phase;
  }

  // ── Countdown ────────────────────────────────────────────────────
  const handleCountdownComplete = useCallback(() => {
    dbg('countdown complete — auto-reloading');
    if (refreshingRef.current) return;
    refreshingRef.current = true;
    applyUpdate();
  }, [applyUpdate]);

  const { secondsRemaining } = useCountdown({
    from: countdownSeconds,
    active: phase === 'countdown',
    onComplete: handleCountdownComplete,
  });

  // ── Postponed + idle → silent refresh ────────────────────────────
  useEffect(() => {
    if (phase === 'postponed' && isIdle && !refreshingRef.current) {
      dbg('postponed + idle → silent refresh');
      refreshingRef.current = true;
      savePostponed(null);
      applyUpdate();
    }
  }, [phase, isIdle, applyUpdate]);

  // ── Actions ──────────────────────────────────────────────────────
  const onViewChangelog = useCallback(() => {
    onNavigateToChangelog?.();
  }, [onNavigateToChangelog]);

  const onPostpone = useCallback(() => {
    dbg('onPostpone clicked', { buildHash: remote?.buildHash });
    if (remote) {
      savePostponed({
        buildHash: remote.buildHash,
        postponedAt: Date.now(),
      });
      setUserPostponed(true);
    }
  }, [remote]);

  const onReloadNow = useCallback(() => {
    dbg('onReloadNow clicked', { isSimulating, refreshing: refreshingRef.current });
    if (isSimulating) {
      setSimulatedVersion(null);
      return;
    }
    if (refreshingRef.current) return;
    refreshingRef.current = true;
    savePostponed(null);
    applyUpdate();
  }, [applyUpdate, isSimulating]);

  const onDismiss = useCallback(() => {
    dismissUpdate();
  }, [dismissUpdate]);

  return {
    phase,
    secondsRemaining,
    remoteVersion: remote,
    status: isSimulating ? 'available' : state.status,
    isCritical,
    onViewChangelog,
    onPostpone,
    onReloadNow,
    onDismiss,
    simulateUpdate,
  };
}
