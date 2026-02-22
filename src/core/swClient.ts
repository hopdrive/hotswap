// ── Service worker client ───────────────────────────────────────────
// Registers /sw.js and exposes lifecycle hooks:
//   - onUpdateFound — a new SW version started installing
//   - onWaiting     — the new SW is installed and waiting to activate
//   - skipWaitingAndReload — tells the waiting SW to activate, then reloads

export interface SWClient {
  /** Subscribe to the SW entering the "installing" state. */
  onUpdateFound(cb: () => void): () => void;
  /** Subscribe to the SW entering the "waiting" state (update ready). */
  onWaiting(cb: () => void): () => void;
  /** Tell the waiting SW to skipWaiting, then reload on controllerchange. */
  skipWaitingAndReload(): void;
  /** The underlying ServiceWorkerRegistration (null until registered). */
  readonly registration: ServiceWorkerRegistration | null;
  /** Tear down listeners. */
  destroy(): void;
}

export function registerSW(scriptUrl = '/sw.js'): SWClient {
  const updateFoundListeners = new Set<() => void>();
  const waitingListeners = new Set<() => void>();
  let registration: ServiceWorkerRegistration | null = null;
  let destroyed = false;
  let controllerChangeHandler: (() => void) | null = null;

  // ── Helpers ───────────────────────────────────────────────────
  function emitUpdateFound() {
    for (const cb of updateFoundListeners) {
      try { cb(); } catch { /* swallow */ }
    }
  }

  function emitWaiting() {
    for (const cb of waitingListeners) {
      try { cb(); } catch { /* swallow */ }
    }
  }

  function trackInstallingWorker(worker: ServiceWorker) {
    // When the installing worker reaches 'installed' it becomes the
    // waiting worker — that means the update is downloaded and ready.
    worker.addEventListener('statechange', () => {
      if (worker.state === 'installed' && registration?.waiting) {
        emitWaiting();
      }
    });
  }

  // ── Registration ──────────────────────────────────────────────
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker
      .register(scriptUrl)
      .then((reg) => {
        if (destroyed) return;
        registration = reg;

        // If there's already a waiting worker (e.g. from a previous visit
        // where the user didn't reload), fire immediately.
        if (reg.waiting) {
          emitWaiting();
        }

        reg.addEventListener('updatefound', () => {
          if (destroyed) return;
          emitUpdateFound();
          const installing = reg.installing;
          if (installing) {
            trackInstallingWorker(installing);
          }
        });
      })
      .catch(() => {
        // SW registration failed (insecure context, blocked, etc.).
        // The coordinator will degrade gracefully.
      });
  }

  // ── Public API ────────────────────────────────────────────────
  function onUpdateFound(cb: () => void): () => void {
    updateFoundListeners.add(cb);
    return () => { updateFoundListeners.delete(cb); };
  }

  function onWaiting(cb: () => void): () => void {
    waitingListeners.add(cb);
    return () => { waitingListeners.delete(cb); };
  }

  function skipWaitingAndReload() {
    const waiting = registration?.waiting;
    if (!waiting) {
      // No waiting SW — fall back to a plain reload.
      window.location.reload();
      return;
    }

    // Listen for the new SW to take control, then reload.
    if (!controllerChangeHandler) {
      controllerChangeHandler = () => {
        window.location.reload();
      };
      navigator.serviceWorker.addEventListener(
        'controllerchange',
        controllerChangeHandler,
      );
    }

    // Ask the waiting worker to activate.
    waiting.postMessage({ type: 'SKIP_WAITING' });
  }

  function destroy() {
    if (destroyed) return;
    destroyed = true;
    updateFoundListeners.clear();
    waitingListeners.clear();
    if (controllerChangeHandler) {
      navigator.serviceWorker.removeEventListener(
        'controllerchange',
        controllerChangeHandler,
      );
      controllerChangeHandler = null;
    }
  }

  return {
    onUpdateFound,
    onWaiting,
    skipWaitingAndReload,
    get registration() { return registration; },
    destroy,
  };
}
