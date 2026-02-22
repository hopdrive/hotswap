// ── Vite plugin for @hopdrive/hotswap ───────────────────────────────
// Injects build-time constants and emits sw.js into the build output.

import type { Plugin } from 'vite';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

export interface AppUpdaterViteOptions {
  /** Override the build hash. Default: git short SHA. */
  buildHash?: string;
  /** Override the app version. Default: package.json version. */
  version?: string;
  /** Override the build timestamp. Default: new Date().toISOString(). */
  buildTime?: string;
  /** Custom service worker source. Default: built-in minimal SW. */
  swSource?: string;
  /** Disable SW emission (e.g. if you manage your own SW). Default: false. */
  disableSW?: boolean;
}

function gitSha(): string {
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
  } catch {
    return 'unknown';
  }
}

function pkgVersion(): string {
  try {
    return JSON.parse(readFileSync('package.json', 'utf8')).version || '0.0.0';
  } catch {
    return '0.0.0';
  }
}

const DEFAULT_SW_SOURCE = `// ── Minimal service worker for @hopdrive/hotswap ──────────────────────
// No custom caching. This SW exists solely to provide the
// "waiting worker → skipWaiting → controllerchange → reload" lifecycle.

self.addEventListener('install', (_event) => {
  // Activate immediately on first install (no prior controller).
  if (!self.registration.active) {
    self.skipWaiting();
  }
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
`;

export function appUpdaterPlugin(options: AppUpdaterViteOptions = {}): Plugin {
  const hash = options.buildHash ?? gitSha();
  const version = options.version ?? pkgVersion();
  const buildTime = options.buildTime ?? new Date().toISOString();
  const swSource = options.swSource ?? DEFAULT_SW_SOURCE;
  const disableSW = options.disableSW ?? false;

  return {
    name: 'hotswap',

    config() {
      return {
        define: {
          __APP_UPDATER_BUILD_HASH__: JSON.stringify(hash),
          __APP_UPDATER_VERSION__: JSON.stringify(version),
          __APP_UPDATER_BUILD_TIME__: JSON.stringify(buildTime),
        },
      };
    },

    generateBundle() {
      if (disableSW) return;
      this.emitFile({
        type: 'asset',
        fileName: 'sw.js',
        source: swSource,
      });
    },
  };
}
