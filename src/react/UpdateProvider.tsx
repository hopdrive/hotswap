// ── UpdateProvider ──────────────────────────────────────────────────
// React Context provider — single integration point for consumers.
// Creates and owns the UpdateCoordinator singleton. Provides coordinator
// + config to all child hooks via context. Cleans up on unmount.

import { createContext, useContext, useEffect, useRef, type ReactNode } from 'react';
import {
  createUpdateCoordinator,
  type UpdateCoordinator,
} from '../core/updateCoordinator';
import { createUpdateLogger } from '../core/updateLogger';
import { enableDebug } from '../core/debugLog';
import type { UpdateLogger } from '../core/types';

// ── Context shape ───────────────────────────────────────────────────

export interface UpdateProviderConfig {
  /** Idle timeout in ms before auto-countdown starts. */
  idleTimeout: number;
  /** Countdown duration in seconds before auto-reload. */
  countdownSeconds: number;
  /** Callback when the user clicks "See what's new". */
  onNavigateToChangelog?: () => void;
  /** BroadcastChannel name (used for localStorage key derivation). */
  channelName: string;
}

export interface UpdateContextValue {
  coordinator: UpdateCoordinator;
  config: UpdateProviderConfig;
}

const UpdateContext = createContext<UpdateContextValue | null>(null);

// ── Hook to consume the context ─────────────────────────────────────

export function useUpdateContext(): UpdateContextValue {
  const ctx = useContext(UpdateContext);
  if (!ctx) {
    throw new Error(
      'useUpdateContext must be used within an <UpdateProvider>. ' +
      'Wrap your app with <UpdateProvider buildHash={...}>.',
    );
  }
  return ctx;
}

// ── Provider props ──────────────────────────────────────────────────

export interface UpdateProviderProps {
  /** Build hash baked into this deployment. Required. */
  buildHash: string;
  children: ReactNode;
  /** Polling interval in ms. Default: 300_000 (5 min). */
  pollInterval?: number;
  /** URL to fetch version metadata from. Default: '/version.json'. */
  versionUrl?: string;
  /** BroadcastChannel name. Default: 'app-updater'. */
  channelName?: string;
  /** Optional logger for observability. Default: createUpdateLogger(). */
  logger?: UpdateLogger;
  /** Idle timeout in ms. Default: 10_000. */
  idleTimeout?: number;
  /** Countdown duration in seconds. Default: 30. */
  countdownSeconds?: number;
  /** Callback for "See what's new" link. Default: undefined (link not shown). */
  onNavigateToChangelog?: () => void;
  /** Enable debug logging. Default: false. */
  debug?: boolean;
}

// ── Provider component ──────────────────────────────────────────────

export function UpdateProvider({
  buildHash,
  children,
  pollInterval,
  versionUrl,
  channelName = 'app-updater',
  logger,
  idleTimeout = 10_000,
  countdownSeconds = 30,
  onNavigateToChangelog,
  debug = false,
}: UpdateProviderProps) {
  // Enable debug logging if requested.
  if (debug) enableDebug(true);

  const resolvedLogger = logger ?? createUpdateLogger();

  // Create coordinator once and keep it stable across re-renders.
  const coordinatorRef = useRef<UpdateCoordinator | null>(null);

  if (coordinatorRef.current === null) {
    coordinatorRef.current = createUpdateCoordinator({
      currentBuildHash: buildHash,
      pollInterval,
      versionUrl,
      channelName,
      logger: resolvedLogger,
    });
  }

  // Clean up on unmount.
  useEffect(() => {
    return () => {
      coordinatorRef.current?.destroy();
      coordinatorRef.current = null;
    };
  }, []);

  const contextValue: UpdateContextValue = {
    coordinator: coordinatorRef.current,
    config: {
      idleTimeout,
      countdownSeconds,
      onNavigateToChangelog,
      channelName,
    },
  };

  return (
    <UpdateContext.Provider value={contextValue}>
      {children}
    </UpdateContext.Provider>
  );
}
