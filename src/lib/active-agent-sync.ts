/** Cross-tab active-agent events (v1.3 §8.4 — last activate wins, tabs resync on focus). */
export const ACTIVE_AGENT_SYNC_CHANNEL = 'kazispace-active-agent-v1';

export type ActiveAgentSyncPayload =
  | { type: 'deactivated'; agentId: string }
  | { type: 'activated'; agentId: string; sessionId: string };

export type ActiveAgentSyncMessage = ActiveAgentSyncPayload & { tabId: string };

function getTabId(): string {
  if (typeof window === 'undefined') return 'ssr';
  let id = sessionStorage.getItem('kazi-tab-id');
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem('kazi-tab-id', id);
  }
  return id;
}

export function publishActiveAgentSync(message: ActiveAgentSyncPayload): void {
  if (typeof window === 'undefined') return;
  const payload: ActiveAgentSyncMessage = { ...message, tabId: getTabId() };

  try {
    const channel = new BroadcastChannel(ACTIVE_AGENT_SYNC_CHANNEL);
    channel.postMessage(payload);
    channel.close();
  } catch {
    localStorage.setItem(
      'kazi-active-agent-sync',
      JSON.stringify({ ...payload, at: Date.now() })
    );
    localStorage.removeItem('kazi-active-agent-sync');
  }
}

export function subscribeActiveAgentSync(
  listener: (message: ActiveAgentSyncMessage) => void
): () => void {
  if (typeof window === 'undefined') return () => undefined;

  const tabId = getTabId();
  const handler = (message: ActiveAgentSyncMessage) => {
    if (message.tabId === tabId) return;
    listener(message);
  };

  let channel: BroadcastChannel | null = null;
  try {
    channel = new BroadcastChannel(ACTIVE_AGENT_SYNC_CHANNEL);
    channel.onmessage = (event) => handler(event.data as ActiveAgentSyncMessage);
  } catch {
    // BroadcastChannel unavailable — storage fallback below.
  }

  const onStorage = (event: StorageEvent) => {
    if (event.key !== 'kazi-active-agent-sync' || !event.newValue) return;
    try {
      handler(JSON.parse(event.newValue) as ActiveAgentSyncMessage);
    } catch {
      // ignore malformed payload
    }
  };
  window.addEventListener('storage', onStorage);

  return () => {
    channel?.close();
    window.removeEventListener('storage', onStorage);
  };
}
