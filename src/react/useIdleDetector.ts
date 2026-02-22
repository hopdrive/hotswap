// ── Idle detection hook ──────────────────────────────────────────────
// Tracks user activity (mouse, keyboard, scroll, touch) and reports
// idle after a configurable timeout. Hidden tabs are treated as idle.

import { useState, useEffect, useRef, useCallback } from 'react';

export interface UseIdleDetectorOptions {
  /** Milliseconds of inactivity before reporting idle. Default: 10 000 (10s). */
  timeout?: number;
  /** Whether detection is active. Default: true. */
  enabled?: boolean;
}

export interface UseIdleDetectorResult {
  /** True when the user has been inactive for >= timeout ms. */
  isIdle: boolean;
}

const ACTIVITY_EVENTS = [
  'mousemove',
  'keydown',
  'click',
  'scroll',
  'touchstart',
] as const;

const THROTTLE_MS = 200;

export function useIdleDetector(
  options: UseIdleDetectorOptions = {},
): UseIdleDetectorResult {
  const { timeout = 10_000, enabled = true } = options;
  const [isIdle, setIsIdle] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastActivityRef = useRef(Date.now());

  const resetTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setIsIdle(true), timeout);
  }, [timeout]);

  useEffect(() => {
    if (!enabled) {
      setIsIdle(false);
      if (timerRef.current) clearTimeout(timerRef.current);
      return;
    }

    const handleActivity = () => {
      const now = Date.now();
      if (now - lastActivityRef.current < THROTTLE_MS) return;
      lastActivityRef.current = now;
      setIsIdle(false);
      resetTimer();
    };

    const handleVisibility = () => {
      if (document.hidden) {
        // Hidden tab → treat as idle immediately
        if (timerRef.current) clearTimeout(timerRef.current);
        setIsIdle(true);
      } else {
        // Tab became visible → reset activity tracking
        handleActivity();
      }
    };

    // Start initial timer
    resetTimer();

    for (const event of ACTIVITY_EVENTS) {
      document.addEventListener(event, handleActivity, { passive: true });
    }
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      for (const event of ACTIVITY_EVENTS) {
        document.removeEventListener(event, handleActivity);
      }
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [enabled, resetTimer]);

  return { isIdle };
}
