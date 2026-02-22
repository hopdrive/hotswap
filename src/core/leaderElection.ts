// ── BroadcastChannel leader election ────────────────────────────────
// Protocol:
//   1. On init, broadcast LEADER_CLAIM with a unique tabId.
//   2. Leader sends LEADER_HEARTBEAT every HEARTBEAT_MS.
//   3. If no heartbeat received for HEARTBEAT_TIMEOUT_MS, claim leadership.
//   4. On beforeunload the leader broadcasts LEADER_RESIGN.

import type { ChannelMessage, UpdateLogger } from './types';

const HEARTBEAT_MS = 5_000;
const HEARTBEAT_TIMEOUT_MS = 15_000;

export interface LeaderElection {
  /** Whether this tab is the current leader. */
  isLeader(): boolean;
  /** Subscribe to leadership changes. Returns an unsubscribe function. */
  onLeaderChange(cb: (isLeader: boolean) => void): () => void;
  /** Tear down timers, channel, and event listeners. */
  destroy(): void;
}

export function createLeaderElection(
  channelName: string,
  logger?: UpdateLogger,
): LeaderElection {
  const tabId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  let leader = false;
  let heartbeatTimer: ReturnType<typeof setInterval> | undefined;
  let timeoutTimer: ReturnType<typeof setTimeout> | undefined;
  let destroyed = false;

  const listeners = new Set<(isLeader: boolean) => void>();

  // ── BroadcastChannel (may not exist in some browsers) ─────────
  let channel: BroadcastChannel | null = null;
  try {
    channel = new BroadcastChannel(channelName);
  } catch {
    // BroadcastChannel not available — become permanent leader.
    setLeader(true);
  }

  // ── Helpers ───────────────────────────────────────────────────
  function setLeader(value: boolean) {
    if (value === leader) return;
    leader = value;
    logger?.log(value ? 'leader_elected' : 'leader_lost', { tabId, channelName });
    for (const cb of listeners) {
      try { cb(leader); } catch { /* subscriber error — swallow */ }
    }
  }

  function broadcast(msg: ChannelMessage) {
    try { channel?.postMessage(msg); } catch { /* channel closed */ }
  }

  function startHeartbeat() {
    stopHeartbeat();
    heartbeatTimer = setInterval(() => {
      broadcast({ type: 'LEADER_HEARTBEAT', tabId });
    }, HEARTBEAT_MS);
  }

  function stopHeartbeat() {
    if (heartbeatTimer !== undefined) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = undefined;
    }
  }

  function resetTimeout() {
    if (timeoutTimer !== undefined) clearTimeout(timeoutTimer);
    timeoutTimer = setTimeout(() => {
      claimLeadership();
    }, HEARTBEAT_TIMEOUT_MS);
  }

  function claimLeadership() {
    setLeader(true);
    broadcast({ type: 'LEADER_CLAIM', tabId });
    startHeartbeat();
    // Clear the timeout since we are now the leader
    if (timeoutTimer !== undefined) {
      clearTimeout(timeoutTimer);
      timeoutTimer = undefined;
    }
  }

  // ── Channel message handler ───────────────────────────────────
  function onMessage(event: MessageEvent<ChannelMessage>) {
    if (destroyed) return;
    const msg = event.data;
    if (!msg || !msg.type || msg.tabId === tabId) return;

    switch (msg.type) {
      case 'LEADER_CLAIM':
        // Another tab claimed leadership — yield.
        if (leader) {
          setLeader(false);
          stopHeartbeat();
        }
        resetTimeout();
        break;

      case 'LEADER_HEARTBEAT':
        // Leader is alive — reset takeover timer.
        if (leader) {
          // Another leader is also heartbeating — the earlier claim wins,
          // so yield if our tabId is lexicographically greater (simple tiebreak).
          if (tabId > msg.tabId) {
            setLeader(false);
            stopHeartbeat();
          }
        }
        resetTimeout();
        break;

      case 'LEADER_RESIGN':
        // Leader left — try to take over immediately.
        claimLeadership();
        break;
    }
  }

  // ── Cleanup on tab close ──────────────────────────────────────
  function onBeforeUnload() {
    if (leader) {
      broadcast({ type: 'LEADER_RESIGN', tabId });
    }
    destroy();
  }

  // ── Init ──────────────────────────────────────────────────────
  if (channel) {
    channel.addEventListener('message', onMessage);
    window.addEventListener('beforeunload', onBeforeUnload);

    // Attempt to claim leadership on startup.
    claimLeadership();
  }

  // ── Public API ────────────────────────────────────────────────
  function destroy() {
    if (destroyed) return;
    destroyed = true;
    stopHeartbeat();
    if (timeoutTimer !== undefined) clearTimeout(timeoutTimer);
    if (channel) {
      if (leader) {
        broadcast({ type: 'LEADER_RESIGN', tabId });
      }
      channel.removeEventListener('message', onMessage);
      channel.close();
      channel = null;
    }
    window.removeEventListener('beforeunload', onBeforeUnload);
    listeners.clear();
  }

  return {
    isLeader: () => leader,
    onLeaderChange(cb) {
      listeners.add(cb);
      return () => { listeners.delete(cb); };
    },
    destroy,
  };
}
