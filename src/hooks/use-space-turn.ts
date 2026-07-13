'use client';

import { useCallback, useState } from 'react';

import { handleAgentEnvelope } from '@/lib/handle-agent-envelope';
import { sendSpaceTurn } from '@/lib/spaces-api';
import { isSpacesEnabled } from '@/lib/spaces/constants';

export type SpaceChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
};

export function useSpaceTurn(spaceId: string | null) {
  const enabled = isSpacesEnabled() && Boolean(spaceId);
  const [messages, setMessages] = useState<SpaceChatMessage[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

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

  return { messages, isSending, sendError, sendMessage, enabled };
}
