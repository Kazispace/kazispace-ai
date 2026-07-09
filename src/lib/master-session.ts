import { apiRequest } from '@/lib/api-client';
import { getAuthToken } from '@/lib/auth';
import { STORAGE_KEYS } from '@/lib/constants';
import type { ApiResponse } from '@/types';

export interface DefaultChatSession {
  session_id: string;
  channel: string;
  active_agent: string | null;
  created_at: string | null;
}

let syncPromise: Promise<string | null> | null = null;

export function readCachedMasterSessionId(): string | null {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem(STORAGE_KEYS.MASTER_SESSION);
}

export function cacheMasterSessionId(sessionId: string): void {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(STORAGE_KEYS.MASTER_SESSION, sessionId);
  // Mirror for legacy getSessionId() callers; cleared together on logout.
  localStorage.setItem(STORAGE_KEYS.SESSION_ID, sessionId);
}

export function clearMasterSession(): void {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(STORAGE_KEYS.MASTER_SESSION);
  localStorage.removeItem(STORAGE_KEYS.SESSION_ID);
}

export async function fetchDefaultChatSession(): Promise<ApiResponse<DefaultChatSession>> {
  return apiRequest<DefaultChatSession>('/api/v1/chat/sessions/default');
}

/** Fetch canonical `sess_{user_id}_web` from BE (KAZI-97 / Protocol v1.2). */
export async function syncMasterSession(): Promise<string | null> {
  if (!getAuthToken()) return null;
  if (syncPromise) return syncPromise;

  syncPromise = (async () => {
    try {
      const res = await fetchDefaultChatSession();
      if (res.success && res.data?.session_id) {
        cacheMasterSessionId(res.data.session_id);
        return res.data.session_id;
      }
      return readCachedMasterSessionId();
    } finally {
      syncPromise = null;
    }
  })();

  return syncPromise;
}

function getGuestSessionId(): string {
  if (typeof window === 'undefined') return '';
  let sessionId = localStorage.getItem(STORAGE_KEYS.SESSION_ID);
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    localStorage.setItem(STORAGE_KEYS.SESSION_ID, sessionId);
  }
  return sessionId;
}

/** Resolve master session id before clinic chat or agent activate. */
export async function ensureMasterSession(): Promise<string> {
  if (!getAuthToken()) {
    return getGuestSessionId();
  }
  const cached = readCachedMasterSessionId();
  if (cached) return cached;
  const synced = await syncMasterSession();
  if (synced) return synced;
  return getGuestSessionId();
}
