'use client';

import { useEffect, useRef } from 'react';

import {
  subscribeActiveAgentSync,
  type ActiveAgentSyncMessage,
} from '@/lib/active-agent-sync';

const FOCUS_SYNC_DEBOUNCE_MS = 300;

export type ActiveAgentSyncReason = 'focus' | 'visibility' | 'broadcast';

export function useActiveAgentSync(
  enabled: boolean,
  onSync: (
    reason: ActiveAgentSyncReason,
    message?: ActiveAgentSyncMessage
  ) => void | Promise<void>
) {
  const onSyncRef = useRef(onSync);
  onSyncRef.current = onSync;
  const inFlightRef = useRef(false);

  useEffect(() => {
    if (!enabled) return;

    const runSync = async (
      reason: ActiveAgentSyncReason,
      message?: ActiveAgentSyncMessage
    ) => {
      if (inFlightRef.current) return;
      inFlightRef.current = true;
      try {
        await onSyncRef.current(reason, message);
      } finally {
        inFlightRef.current = false;
      }
    };

    let focusTimer: ReturnType<typeof setTimeout> | null = null;
    const scheduleSync = (reason: 'focus' | 'visibility') => {
      if (focusTimer) clearTimeout(focusTimer);
      focusTimer = setTimeout(() => void runSync(reason), FOCUS_SYNC_DEBOUNCE_MS);
    };

    const onFocus = () => scheduleSync('focus');
    const onVisibility = () => {
      if (document.visibilityState === 'visible') scheduleSync('visibility');
    };

    const unsub = subscribeActiveAgentSync((message) => {
      void runSync('broadcast', message);
    });

    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      if (focusTimer) clearTimeout(focusTimer);
      unsub();
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [enabled]);
}
