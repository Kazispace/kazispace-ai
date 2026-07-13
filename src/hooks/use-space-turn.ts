'use client';

import { useCallback, useEffect, useState } from 'react';

import { fetchChatHistory } from '@/lib/api-client';
import { sendSpaceTurn } from '@/lib/spaces-api';
import { isSpacesEnabled } from '@/lib/spaces/constants';
import {
  mapSpaceHistoryMessages,
  resolveSpaceTurnReply,
  type SpaceChatMessage,
} from '@/lib/spaces/turn';

async function loadSpaceHistory(
  masterSessionId: string
): Promise<SpaceChatMessage[]> {
  const res = await fetchChatHistory(masterSessionId);
  if (!res.success || !res.data) return [];
  const list = Array.isArray(res.data) ? res.data : (res.data.messages ?? []);
  return mapSpaceHistoryMessages(list);
}

/**
 * Space chat loop. Phase A hydrates via `master_session_id` → clinic messages API.
 * TODO(KAZI-172): switch to `GET /spaces/{id}/messages` when BE exposes space-scoped history.
 */
export function useSpaceTurn(spaceId: string | null, masterSessionId: string | null) {
  const enabled = isSpacesEnabled() && Boolean(spaceId);
  const [messages, setMessages] = useState<SpaceChatMessage[]>([]);
  const [isHydrating, setIsHydrating] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  const refreshHistory = useCallback(async () => {
    if (!masterSessionId) return [];
    const next = await loadSpaceHistory(masterSessionId);
    setMessages(next);
    return next;
  }, [masterSessionId]);

  useEffect(() => {
    if (!enabled || !masterSessionId) {
      setMessages([]);
      return;
    }

    let cancelled = false;
    setIsHydrating(true);

    void (async () => {
      const next = await loadSpaceHistory(masterSessionId);
      if (cancelled) return;
      setMessages(next);
      setIsHydrating(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled, masterSessionId]);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!enabled || !spaceId || !text.trim()) {
        return { ok: false as const, error: 'Space not ready' };
      }

      const trimmed = text.trim();
      const userId = `user_${Date.now()}`;
      setMessages((prev) => [...prev, { id: userId, role: 'user', content: trimmed }]);
      setIsSending(true);
      setSendError(null);

      try {
        const res = await sendSpaceTurn(spaceId, { message: trimmed });

        if (!res.success) {
          const err = res.error ?? 'Send failed';
          setSendError(err);
          return { ok: false as const, error: err };
        }

        const reply = resolveSpaceTurnReply(res.data);

        if (reply) {
          setMessages((prev) => [
            ...prev,
            { id: `assistant_${Date.now()}`, role: 'assistant', content: reply },
          ]);
        }

        if (masterSessionId) {
          const refreshed = await loadSpaceHistory(masterSessionId);
          if (refreshed.length > 0) {
            setMessages(refreshed);
          }
        }

        return { ok: true as const };
      } finally {
        setIsSending(false);
      }
    },
    [enabled, masterSessionId, spaceId]
  );

  return {
    messages,
    isHydrating,
    isSending,
    sendError,
    sendMessage,
    refreshHistory,
    enabled,
  };
}

export type { SpaceChatMessage };
