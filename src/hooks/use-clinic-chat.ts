'use client';

import { useCallback, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useChatStore, useUIStore } from '@/lib/store';
import {
  sendChatMessage,
  fetchChatHistory,
  parseClinicReply,
} from '@/lib/api-client';
import { isPaywallError, isProfileIncomplete } from '@/lib/api-errors';
import { ensureMasterSession } from '@/lib/master-session';
import { publishSessionNavInvalidate } from '@/lib/session-nav-invalidate';
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
    status: 'sent',
    streamComplete: true,
  };
}

export function useClinicChat(locale?: string) {
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
    removeMessage,
  } = useChatStore();
  const showToast = useUIStore((s) => s.showToast);
  const openPaywall = useUIStore((s) => s.openPaywall);
  const tErrors = useTranslations('errors');

  const handleApiFailure = useCallback(
    (res: { error?: string; errorCode?: string }) => {
      if (isProfileIncomplete(res)) {
        showToast(tErrors('profileIncomplete'), 'info');
        return;
      }
      if (isPaywallError(res) && res.errorCode) {
        openPaywall(res.errorCode);
      }
    },
    [showToast, openPaywall, tErrors]
  );

  const loadHistory = useCallback(async () => {
    setIsHistoryLoading(true);
    try {
      const sessionId = await ensureMasterSession();
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

  const skipHistoryLoad = useCallback(() => {
    setIsHistoryLoading(false);
  }, []);

  const sendMessage = useCallback(
    async (text: string, options?: { retryMessageId?: string }) => {
      const sessionId = await ensureMasterSession();
      const userMsgId = options?.retryMessageId ?? `user_${Date.now()}`;

      if (options?.retryMessageId) {
        updateMessage(userMsgId, { status: 'sending', content: text });
      } else {
        addMessage({
          id: userMsgId,
          role: 'user',
          content: text,
          timestamp: new Date().toISOString(),
          sessionId,
          status: 'sending',
        });
      }

      setSending(true);

      const assistantId = `assistant_${Date.now()}`;
      addMessage({
        id: assistantId,
        role: 'assistant',
        content: '',
        timestamp: new Date().toISOString(),
        sessionId,
        streamComplete: false,
      });
      setStreaming(true);

      const res = await sendChatMessage(sessionId, text, locale, {
        routingMode: 'clinic',
      });
      setSending(false);
      setStreaming(false);

      if (!res.success || !res.data) {
        removeMessage(assistantId);
        updateMessage(userMsgId, { status: 'failed' });
        handleApiFailure(res);
        return { ok: false as const, error: res.error, errorCode: res.errorCode };
      }

      const { reply, intent, referral, nextActions, cards, routedToAgent } =
        parseClinicReply(res.data);
      updateMessage(userMsgId, { status: 'sent' });
      updateMessage(assistantId, {
        content: reply || '…',
        ...(intent ? { intent } : {}),
        ...(referral ? { referral } : {}),
        ...(nextActions.length > 0 ? { nextActions } : {}),
        ...(cards.length > 0 ? { cards } : {}),
        streamComplete: false,
      });

      publishSessionNavInvalidate();

      return {
        ok: true as const,
        assistantId,
        ...(routedToAgent ? { routedToAgent } : {}),
      };
    },
    [addMessage, setSending, setStreaming, updateMessage, removeMessage, handleApiFailure, locale]
  );

  const markStreamComplete = useCallback(
    (messageId: string) => {
      updateMessage(messageId, { streamComplete: true });
    },
    [updateMessage]
  );

  const dismissMessageReferral = useCallback(
    (messageId: string) => {
      const msg = useChatStore.getState().messages.find((m) => m.id === messageId);
      if (!msg?.referral) return;
      updateMessage(messageId, {
        referral: { ...msg.referral, dismissed: true },
      });
    },
    [updateMessage]
  );

  const retryMessage = useCallback(
    async (messageId: string) => {
      const msg = useChatStore.getState().messages.find((m) => m.id === messageId);
      if (!msg || msg.role !== 'user') return { ok: false as const };
      return sendMessage(msg.content, { retryMessageId: messageId });
    },
    [sendMessage]
  );

  return {
    messages,
    isStreaming,
    isSending,
    isHistoryLoading,
    loadHistory,
    skipHistoryLoad,
    sendMessage,
    retryMessage,
    markStreamComplete,
    dismissMessageReferral,
  };
}
