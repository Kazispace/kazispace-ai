'use client';

import { useCallback, useEffect, useState } from 'react';

import { fetchChatHistory } from '@/lib/api-client';
import { handleAgentEnvelope } from '@/lib/handle-agent-envelope';
import { sendSpaceTurn } from '@/lib/spaces-api';
import { isSpacesEnabled } from '@/lib/spaces/constants';
import type { ChatMessage } from '@/types';

export type SpaceChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
};

function mapHistoryToSpaceMessages(messages: ChatMessage[]): SpaceChatMessage[] {
  return messages
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => ({
      id: m.id,
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }))
    .filter((m) => m.content.trim().length > 0);
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

  useEffect(() => {
    if (!enabled || !masterSessionId) {
      setMessages([]);
      return;
    }

    let cancelled = false;
    setIsHydrating(true);

    void (async () => {
      const res = await fetchChatHistory(masterSessionId);
      if (cancelled) return;
      setIsHydrating(false);

      if (res.success && res.data) {
        const list = Array.isArray(res.data) ? res.data : (res.data.messages ?? []);
        setMessages(mapHistoryToSpaceMessages(list as ChatMessage[]));
      }
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

      const userId = `user_${Date.now()}`;
      setMessages((prev) => [
        ...prev,
        { id: userId, role: 'user', content: text.trim() },
      ]);
      setIsSending(true);
      setSendError(null);

      const res = await sendSpaceTurn(spaceId, { message: text.trim() });
      setIsSending(false);

      if (!res.success) {
        const err = res.error ?? 'Send failed';
        setSendError(err);
        return { ok: false as const, error: err };
      }

      const data = res.data;
      let reply = data?.reply_text?.trim() ?? '';

      if (data?.envelope) {
        const handled = handleAgentEnvelope(data.envelope);
        if (handled.assistant.content) {
          reply = handled.assistant.content;
        }
      }

      if (reply) {
        setMessages((prev) => [
          ...prev,
          { id: `assistant_${Date.now()}`, role: 'assistant', content: reply },
        ]);
      }

      return { ok: true as const };
    },
    [enabled, spaceId]
  );

  return {
    messages,
    isHydrating,
    isSending,
    sendError,
    sendMessage,
    enabled,
  };
}
