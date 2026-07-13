'use client';

import { useCallback, useEffect, useState } from 'react';

import { fetchChatHistory, parseClinicReply, sendChatMessage } from '@/lib/api-client';
import { ensureMasterSession } from '@/lib/master-session';
import { sendSpaceTurn } from '@/lib/spaces-api';
import { isSpacesEnabled } from '@/lib/spaces/constants';
import {
  isPlaceholderReply,
  mapSpaceHistoryMessages,
  mergeSpaceMessagesAfterSend,
  resolveSpaceTurnReply,
  type SpaceChatMessage,
} from '@/lib/spaces/turn';

async function resolveChatSessionId(
  spaceMasterSessionId: string | null | undefined
): Promise<string | null> {
  const fromSpace = spaceMasterSessionId?.trim();
  if (fromSpace) return fromSpace;
  const fallback = await ensureMasterSession();
  return fallback.trim() || null;
}

async function loadSpaceHistory(
  masterSessionId: string
): Promise<SpaceChatMessage[]> {
  const res = await fetchChatHistory(masterSessionId);
  if (!res.success || !res.data) return [];
  const list = Array.isArray(res.data) ? res.data : (res.data.messages ?? []);
  return mapSpaceHistoryMessages(list);
}

/**
 * Space chat loop. POST /spaces/{id}/turn when orchestrator replies; otherwise
 * falls back to master_session clinic chat (BE P0.5 stub).
 * TODO(KAZI-172): switch to GET /spaces/{id}/messages when BE exposes space-scoped history.
 */
export function useSpaceTurn(
  spaceId: string | null,
  masterSessionId: string | null,
  locale: string
) {
  const enabled = isSpacesEnabled() && Boolean(spaceId);
  const [messages, setMessages] = useState<SpaceChatMessage[]>([]);
  const [isHydrating, setIsHydrating] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  const refreshHistory = useCallback(async () => {
    const sessionId = await resolveChatSessionId(masterSessionId);
    if (!sessionId) return [];
    const next = await loadSpaceHistory(sessionId);
    setMessages(next);
    return next;
  }, [masterSessionId]);

  useEffect(() => {
    if (!enabled) {
      setMessages([]);
      return;
    }

    let cancelled = false;
    setIsHydrating(true);

    void (async () => {
      const sessionId = await resolveChatSessionId(masterSessionId);
      if (cancelled) return;
      if (!sessionId) {
        setMessages([]);
        setIsHydrating(false);
        return;
      }
      const next = await loadSpaceHistory(sessionId);
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
      let nextMessages: SpaceChatMessage[] = [];

      setMessages((prev) => {
        nextMessages = [...prev, { id: userId, role: 'user', content: trimmed }];
        return nextMessages;
      });
      setIsSending(true);
      setSendError(null);

      try {
        const sessionId = await resolveChatSessionId(masterSessionId);
        const res = await sendSpaceTurn(spaceId, { message: trimmed });

        if (!res.success) {
          const err = res.error ?? 'Send failed';
          setSendError(err);
          setMessages((prev) => prev.filter((message) => message.id !== userId));
          return { ok: false as const, error: err };
        }

        let reply = resolveSpaceTurnReply(res.data);

        if (!reply && sessionId) {
          const clinicRes = await sendChatMessage(sessionId, trimmed, locale, {
            routingMode: 'clinic',
          });
          if (!clinicRes.success) {
            const err = clinicRes.error ?? 'Send failed';
            setSendError(err);
            setMessages((prev) => prev.filter((message) => message.id !== userId));
            return { ok: false as const, error: err };
          }
          reply = parseClinicReply(clinicRes.data).reply.trim();
        }

        if (reply && !isPlaceholderReply(reply)) {
          nextMessages = [
            ...nextMessages,
            { id: `assistant_${Date.now()}`, role: 'assistant', content: reply },
          ];
          setMessages(nextMessages);
        } else {
          const err = sessionId ? 'Assistant did not return a reply' : 'Chat session not ready';
          setSendError(err);
          return { ok: false as const, error: err };
        }

        if (sessionId) {
          const refreshed = await loadSpaceHistory(sessionId);
          if (refreshed.length > 0) {
            setMessages(mergeSpaceMessagesAfterSend(nextMessages, refreshed));
          }
        }

        return { ok: true as const };
      } finally {
        setIsSending(false);
      }
    },
    [enabled, locale, masterSessionId, spaceId]
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
