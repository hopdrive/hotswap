# @hopdrive/hotswap

Zero-config SPA update detection and notification system. Detects new deployments via version polling with leader election across tabs, manages service worker lifecycle, and shows customizable update toasts with idle-aware auto-reload.

Built for React + MUI + Vite apps.

## Quick Start

```bash
npx @hopdrive/hotswap init
```

This installs the package, adds the Vite plugin to your config, scaffolds type declarations in `vite-env.d.ts`, and creates a starter release in `releases/`. Then follow the printed instructions:

### 1. Wrap your app

```tsx
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

### 2. Add a changelog route

```tsx
import { ChangelogPage } from '@hopdrive/hotswap/changelog';

<Route path="/changelog" element={<ChangelogPage />} />
```

### 3. Update your build script

```json
{
  "scripts": {
    "build": "vite build && hotswap generate-version-json"
  }
}
```

## Shipping a Feature

After initial setup, here's how to ship a change that customers are notified about:

### 1. Build the feature

Develop normally — create components, update pages, write tests.

### 2. Author release notes

Create `releases/{version}.mdx` with YAML frontmatter:

```yaml
---
version: "1.4.0"
impact: minor
title: "Team Activity Feed"
summary: "Track what your team is doing in real-time."
features:
  - icon: Groups
    heading: "Live Activity Stream"
    description: "See deploys, merges, and config changes as they happen."
  - icon: Timeline
    heading: "Activity History"
    description: "Scroll back through your team's recent actions."
ctaLabel: "Try it now"
ctaUrl: "/team"
---

Optional MDX body content for the changelog page. Supports `<Video>`,
`<Screenshot>`, `<FeatureHighlight>`, and `<Callout>` components from
`@hopdrive/hotswap/mdx`.
```

### 3. Bump version

Update `version` in `package.json` to match. The MDX filename, frontmatter `version`, and `package.json` version should all agree.

### 4. Generate hero image (optional)

```bash
hotswap generate-hero
```

### 5. Build and verify

```bash
npm run build
```

This runs `tsc` → `vite build` (injects build hash, compiles MDX, emits `sw.js`) → `hotswap generate-version-json` (reads your MDX frontmatter, writes `dist/version.json`).

The CLI prints the generated JSON to stdout so you can verify the title, summary, and features before deploying.

### 6. Deploy

Push to your hosting provider. When customers' tabs poll `/version.json` and detect a new `buildHash`, they see the update notification.

### Frontmatter Reference

| Field | Required | Description |
|-------|----------|-------------|
| `version` | yes | Semver string — must match filename and `package.json` |
| `impact` | yes | `patch` \| `minor` \| `major` \| `critical` — controls notification style |
| `title` | yes | Short title shown in toast, modal, and changelog |
| `summary` | yes | 1-2 sentence summary shown in the toast body |
| `features` | no | Array of `{ icon, heading, description }` shown in the release modal |
| `ctaLabel` | no | Primary CTA button label (e.g. "Try it now") |
| `ctaUrl` | no | URL for the CTA button |

Feature `icon` values are MUI icon names (e.g. `RocketLaunch`, `Groups`, `Security`). See [@mui/icons-material](https://mui.com/material-ui/material-icons/) for the full list.

The full TypeScript type is exported as `ReleaseFrontmatter` from `@hopdrive/hotswap`.

### Impact Levels

Impact controls what the customer sees when a new version is detected:

| Impact | Notification | Behavior |
|--------|-------------|----------|
| `patch` | Toast: "Update available" | Dismissible. If postponed, silently reloads when user goes idle. |
| `minor` | Toast: "Update available" | Same as patch — toast with postpone/dismiss/reload options. |
| `major` | Toast: "Update recommended" | Same flow, stronger wording. |
| `critical` | Persistent red banner: "Security update available" | **Cannot dismiss.** Forces reload when user goes idle. |

In all cases: background/hidden tabs reload silently. Idle timeout (default 10s) triggers a countdown (default 30s) before auto-reload.

### Changesets

Hotswap does **not** consume changeset files. If your repo uses `@changesets/cli`, that workflow is independent — changesets manage version bumping and changelogs, while hotswap reads `releases/*.mdx` for structured release notes. You can use both side by side, or just one.

## Testing During Development

Use `simulateUpdate()` to preview the update toast without deploying:

```tsx
import { useUpdateToastState } from '@hopdrive/hotswap/react';

function DevTools() {
  const { simulateUpdate } = useUpdateToastState();
  return <button onClick={simulateUpdate}>Toggle update preview</button>;
}
```

This toggles a fake v99.0.0 update with sample release notes. The toast, countdown, and all buttons work normally — "Reload now" just clears the simulation instead of reloading.

You can also enable debug logging on the provider:

```tsx
<UpdateProvider buildHash={__APP_UPDATER_BUILD_HASH__} debug>
```

This logs all state transitions (phase changes, idle detection, polling) to the console.

## Changelog Route

Add a `/changelog` page to show release history:

```tsx
import { ChangelogPage } from '@hopdrive/hotswap/changelog';

// In your router:
<Route path="/changelog" element={<ChangelogPage />} />

// Wire the "See what's new" link in the toast:
<UpdateProvider
  buildHash={__APP_UPDATER_BUILD_HASH__}
  onNavigateToChangelog={() => navigate('/changelog')}
>
```

`ChangelogPage` automatically reads compiled MDX from `virtual:hotswap-releases`. It supports hash-based scrolling (e.g. `/changelog#v1.4.0`).

### MDX Body Components

These components are available in MDX release body content via `@hopdrive/hotswap/mdx`:

| Component | Props | Description |
|-----------|-------|-------------|
| `<Video>` | `src`, `poster` | Embedded video player |
| `<Screenshot>` | `src`, `alt`, `caption` | Image with optional caption |
| `<FeatureHighlight>` | `icon`, `title`, `children` | Icon + title + body block |
| `<Callout>` | `severity`, `children` | Colored alert box (info/warning/error/success) |

## Subpath Exports

| Import | Contents |
|--------|----------|
| `@hopdrive/hotswap` | Framework-agnostic core (coordinator, poller, leader election, SW) |
| `@hopdrive/hotswap/react` | Headless React hooks (`useUpdateState`, `useUpdateToastState`, etc.) |
| `@hopdrive/hotswap/mui` | Optional MUI components (`MuiUpdateToast`, `UpdateToast`, etc.) |
| `@hopdrive/hotswap/vite` | Vite plugin (injects build hash, emits `sw.js`, compiles MDX) |
| `@hopdrive/hotswap/changelog` | `ChangelogPage`, `ReleaseEntry`, `useReleases` |
| `@hopdrive/hotswap/mdx` | MDX body components (`Video`, `Screenshot`, `FeatureHighlight`, `Callout`) |

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
