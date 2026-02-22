/** Timestamped debug logger for update system tracing. Off by default. */

let enabled = false;

/** Enable or disable debug logging. */
export function enableDebug(on = true) {
  enabled = on;
}

export const dbg = (msg: string, data?: unknown) => {
  if (!enabled) return;
  // eslint-disable-next-line no-console
  console.log(`${new Date().toISOString()} [AppUpdate] ${msg}`, data ?? '');
};
