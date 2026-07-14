'use client';

import { useCallback, useEffect, useState } from 'react';

import { fetchChatHistory } from '@/lib/api-client';
import { sendSpaceTurn } from '@/lib/spaces-api';
import { isSpacesEnabled } from '@/lib/spaces/constants';
import {
  isPlaceholderReply,
  latestAssistantAfterUser,
  mapSpaceHistoryMessages,
  mergeSpaceMessagesAfterSend,
  resolveSpaceTurnReply,
  type SpaceChatMessage,
} from '@/lib/spaces/turn';

function resolveSpaceMasterSessionId(
  spaceMasterSessionId: string | null | undefined
): string | null {
  const sessionId = spaceMasterSessionId?.trim();
  return sessionId || null;
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
 * Space chat loop via POST /spaces/{id}/turn (KAZI-171).
 * History is the space `master_session_id` thread
 * (`GET /chat/sessions/{master}/messages`). Do **not** fall back to
 * POST /chat/messages — BE remaps that to Clinic `sess_{uid}_web`.
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
    const sessionId = resolveSpaceMasterSessionId(masterSessionId);
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

    const sessionId = resolveSpaceMasterSessionId(masterSessionId);
    if (!sessionId) {
      setMessages([]);
      setIsHydrating(false);
      return;
    }

    let cancelled = false;
    setIsHydrating(true);
    setSendError(null);

    void (async () => {
      const next = await loadSpaceHistory(sessionId);
      if (cancelled) return;
      setMessages(next);
      setIsHydrating(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled, masterSessionId, spaceId]);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!enabled || !spaceId || !text.trim()) {
        return { ok: false as const, error: 'Space not ready' };
      }

      const sessionId = resolveSpaceMasterSessionId(masterSessionId);
      if (!sessionId) {
        const err = 'Space not ready';
        setSendError(err);
        return { ok: false as const, error: err };
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
        const res = await sendSpaceTurn(spaceId, {
          message: trimmed,
          locale,
          language_preference: locale,
        });

        if (!res.success) {
          const err = res.error ?? 'Send failed';
          setSendError(err);
          setMessages((prev) => prev.filter((message) => message.id !== userId));
          return { ok: false as const, error: err };
        }

        let reply = resolveSpaceTurnReply(res.data);
        let refreshed: SpaceChatMessage[] = [];

        if (isPlaceholderReply(reply)) {
          try {
            refreshed = await loadSpaceHistory(sessionId);
            reply = latestAssistantAfterUser(refreshed, trimmed);
          } catch (error) {
            console.warn('[useSpaceTurn] history recovery failed after send', error);
          }
        }

        if (isPlaceholderReply(reply)) {
          const err = 'Assistant did not return a reply';
          setSendError(err);
          return { ok: false as const, error: err };
        }

        nextMessages = [
          ...nextMessages,
          { id: `assistant_${Date.now()}`, role: 'assistant', content: reply },
        ];
        setMessages(nextMessages);

        try {
          if (refreshed.length === 0) {
            refreshed = await loadSpaceHistory(sessionId);
          }
          if (refreshed.length > 0) {
            setMessages(mergeSpaceMessagesAfterSend(nextMessages, refreshed));
          }
        } catch (error) {
          console.warn('[useSpaceTurn] history refresh failed after send', error);
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
