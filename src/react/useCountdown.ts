// ── Countdown timer hook ─────────────────────────────────────────────
// Counts down from a given number of seconds when active.
// Calls onComplete when reaching zero.

import { useState, useEffect, useRef, useCallback } from 'react';

export interface UseCountdownOptions {
  /** Total seconds to count down from. Default: 30. */
  from?: number;
  /** Whether the countdown is actively running. */
  active: boolean;
  /** Called when the countdown reaches 0. */
  onComplete: () => void;
}

export interface UseCountdownResult {
  secondsRemaining: number;
  reset: () => void;
}

export function useCountdown({
  from = 30,
  active,
  onComplete,
}: UseCountdownOptions): UseCountdownResult {
  const [seconds, setSeconds] = useState(from);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const reset = useCallback(() => setSeconds(from), [from]);

  // Reset when transitioning to active
  const wasActiveRef = useRef(false);
  useEffect(() => {
    if (active && !wasActiveRef.current) {
      reset();
    }
    wasActiveRef.current = active;
  }, [active, reset]);

  // Tick interval
  useEffect(() => {
    if (!active) return;

    const interval = setInterval(() => {
      setSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          onCompleteRef.current();
          return 0;
        }
        return prev - 1;
      });
    }, 1_000);

    return () => clearInterval(interval);
  }, [active]);

  return { secondsRemaining: seconds, reset };
}
