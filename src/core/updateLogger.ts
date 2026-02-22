// ── Update event logger ─────────────────────────────────────────────
// Lightweight logger for the update system's lifecycle events.
// Default: console.log with [AppUpdate] prefix.
// Swap in Sentry / Datadog / etc. by passing a custom handler.

import type { UpdateLogHandler, UpdateLogger } from './types';

const RATE_LIMIT_MS = 60_000; // 1 per event type per 60 s for errors

const ERROR_EVENTS = new Set([
  'update_check_fail',
  'sw_registration_fail',
]);

/**
 * Create a logger for the update system.
 *
 * @param handler Optional custom handler. Receives every (non-rate-limited)
 *   event with structured data. Defaults to `console.log`.
 */
export function createUpdateLogger(handler?: UpdateLogHandler): UpdateLogger {
  const rateLimitMap = new Map<string, number>();

  const defaultHandler: UpdateLogHandler = (event, data) => {
    // eslint-disable-next-line no-console
    console.log(`${new Date().toISOString()} [AppUpdate] ${event}`, data);
  };

  const inner = handler ?? defaultHandler;

  return {
    log(event: string, data: Record<string, unknown>) {
      // Rate-limit repeated error events to avoid log spam.
      if (ERROR_EVENTS.has(event)) {
        const now = Date.now();
        const lastLogged = rateLimitMap.get(event) ?? 0;
        if (now - lastLogged < RATE_LIMIT_MS) return;
        rateLimitMap.set(event, now);
      }
      inner(event, data);
    },
  };
}
