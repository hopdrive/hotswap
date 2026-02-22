# @hopdrive/hotswap

Zero-config SPA update detection and notification system. Detects new deployments via version polling with leader election across tabs, manages service worker lifecycle, and shows customizable update toasts with idle-aware auto-reload.

Built for React + MUI + Vite apps.

## Install

```bash
npm install @hopdrive/hotswap
```

## Quick Start

### 1. Add the Vite plugin

```ts
// vite.config.ts
import { appUpdaterPlugin } from '@hopdrive/hotswap/vite';

export default defineConfig({
  plugins: [react(), appUpdaterPlugin()],
});
```

### 2. Wrap your app

```tsx
// App.tsx
import { UpdateProvider } from '@hopdrive/hotswap/react';
import { MuiUpdateToast } from '@hopdrive/hotswap/mui';

function App() {
  return (
    <UpdateProvider buildHash={__APP_UPDATER_BUILD_HASH__}>
      <Routes>...</Routes>
      <MuiUpdateToast />
    </UpdateProvider>
  );
}
```

### 3. Generate version.json on build

```json
{
  "scripts": {
    "build": "vite build && generate-version-json"
  }
}
```

## Subpath Exports

| Import | Contents |
|--------|----------|
| `@hopdrive/hotswap` | Framework-agnostic core (coordinator, poller, leader election, SW) |
| `@hopdrive/hotswap/react` | Headless React hooks (`useUpdateState`, `useUpdateToastState`, etc.) |
| `@hopdrive/hotswap/mui` | Optional MUI components (`MuiUpdateToast`, `UpdateToast`, etc.) |
| `@hopdrive/hotswap/vite` | Vite plugin (injects build hash, emits `sw.js`) |

## How It Works

1. **Leader election** — only one tab polls `/version.json` via BroadcastChannel coordination
2. **Version polling** — checks every 5 minutes (configurable) with jitter and exponential backoff
3. **Cross-tab broadcast** — leader notifies all tabs when a new version is detected
4. **Service worker lifecycle** — manages the install → waiting → activate → reload flow
5. **Idle detection** — starts a countdown when the user goes idle, auto-reloads at zero
6. **Background tabs** — hidden tabs with pending updates reload silently on visibility change
7. **Postpone** — users can defer the update; it applies silently when they go idle

## UpdateProvider Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `buildHash` | `string` | **required** | Build hash baked into this deployment |
| `pollInterval` | `number` | `300000` (5 min) | Polling interval in ms |
| `versionUrl` | `string` | `'/version.json'` | URL to fetch version metadata |
| `channelName` | `string` | `'app-updater'` | BroadcastChannel name |
| `logger` | `UpdateLogger` | console logger | Custom logger for observability |
| `idleTimeout` | `number` | `10000` (10s) | Idle timeout in ms |
| `countdownSeconds` | `number` | `30` | Countdown duration before auto-reload |
| `onNavigateToChangelog` | `() => void` | `undefined` | Callback for "See what's new" link |
| `debug` | `boolean` | `false` | Enable debug logging |

## License

MIT
