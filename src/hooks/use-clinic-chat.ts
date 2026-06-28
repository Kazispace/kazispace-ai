'use client';

import { useCallback, useState } from 'react';
import { useChatStore } from '@/lib/store';
import {
  sendChatMessage,
  fetchChatHistory,
  parseClinicReply,
} from '@/lib/api-client';
import { getSessionId } from '@/lib/auth';
import type { ChatMessage } from '@/types';

function normalizeHistoryMessage(
  raw: Record<string, unknown>,
  sessionId: string
): ChatMessage {
  const roleRaw = (raw.role as string) ?? 'assistant';
  const role =
    roleRaw === 'user' ? 'user' : roleRaw === 'assistant' || roleRaw === 'ai' ? 'assistant' : 'assistant';
  return {
    id: (raw.id as string) ?? (raw.message_id as string) ?? crypto.randomUUID(),
    role,
    content: (raw.content as string) ?? (raw.text as string) ?? '',
    timestamp: (raw.timestamp as string) ?? (raw.created_at as string) ?? new Date().toISOString(),
    sessionId,
  };
}

export function useClinicChat() {
  const [isHistoryLoading, setIsHistoryLoading] = useState(true);
  const {
    messages,
    isStreaming,
    isSending,
    addMessage,
    setMessages,
    setStreaming,
    setSending,
    updateMessage,
  } = useChatStore();

  const loadHistory = useCallback(async () => {
    setIsHistoryLoading(true);
    try {
      const sessionId = getSessionId();
      const res = await fetchChatHistory(sessionId);
      if (!res.success || !res.data) return;

      const list = Array.isArray(res.data)
        ? res.data
        : (res.data as { messages: ChatMessage[] }).messages ?? [];

      setMessages(
        list.map((m) =>
          normalizeHistoryMessage(m as unknown as Record<string, unknown>, sessionId)
        )
      );
    } finally {
      setIsHistoryLoading(false);
    }
  }, [setMessages]);

  const sendMessage = useCallback(
    async (text: string) => {
      const sessionId = getSessionId();
      const userMsg: ChatMessage = {
        id: `user_${Date.now()}`,
        role: 'user',
        content: text,
        timestamp: new Date().toISOString(),
        sessionId,
      };

      addMessage(userMsg);
      setSending(true);

      const assistantId = `assistant_${Date.now()}`;
      addMessage({
        id: assistantId,
        role: 'assistant',
        content: '',
        timestamp: new Date().toISOString(),
        sessionId,
      });
      setStreaming(true);

      const res = await sendChatMessage(sessionId, text);
      setSending(false);
      setStreaming(false);

      if (!res.success || !res.data) {
        updateMessage(assistantId, {
          content: `⚠️ ${res.error ?? 'Something went wrong. Please try again.'}`,
        });
        return { ok: false as const, error: res.error };
      }

      const { reply, intent } = parseClinicReply(res.data);
      updateMessage(assistantId, {
        content: reply || '…',
        ...(intent ? { intent } : {}),
      });

      return { ok: true as const };
    },
    [addMessage, setSending, setStreaming, updateMessage]
  );

  return {
    messages,
    isStreaming,
    isSending,
    isHistoryLoading,
    loadHistory,
    sendMessage,
  };
}
