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
import { mergeClinicMessagesAfterHistoryLoad } from '@/lib/clinic-chat-merge';
import { ensureMasterSession } from '@/lib/master-session';
import { publishSessionNavInvalidate } from '@/lib/session-nav-invalidate';
import { isPlaceholderReply, resolveSpaceTurnReply } from '@/lib/spaces/turn';
import type { ChatMessage } from '@/types';

function extractHistoryMessageContent(
  raw: Record<string, unknown>,
  role: 'user' | 'assistant'
): string {
  if (role === 'user') {
    return (
      (typeof raw.content === 'string' ? raw.content : '') ||
      (typeof raw.text === 'string' ? raw.text : '')
    ).trim();
  }

  const fromTurn = resolveSpaceTurnReply(raw).trim();
  if (!isPlaceholderReply(fromTurn)) return fromTurn;

  return (
    (typeof raw.content === 'string' ? raw.content : '') ||
    (typeof raw.text === 'string' ? raw.text : '')
  ).trim();
}

function normalizeHistoryMessage(
  raw: Record<string, unknown>,
  sessionId: string
): ChatMessage | null {
  const roleRaw = (raw.role as string) ?? 'assistant';
  const role: 'user' | 'assistant' =
    roleRaw === 'user' ? 'user' : roleRaw === 'assistant' || roleRaw === 'ai' ? 'assistant' : 'assistant';

  const content = extractHistoryMessageContent(raw, role);
  if (!content) return null;
  if (role === 'assistant' && isPlaceholderReply(content)) return null;

  return {
    id: (raw.id as string) ?? (raw.message_id as string) ?? crypto.randomUUID(),
    role,
    content,
    timestamp: (raw.timestamp as string) ?? (raw.created_at as string) ?? new Date().toISOString(),
    sessionId,
    status: 'sent',
    streamComplete: true,
  };
}

async function fetchNormalizedHistory(sessionId: string): Promise<ChatMessage[]> {
  const res = await fetchChatHistory(sessionId);
  if (!res.success || !res.data) return [];

  const list = Array.isArray(res.data)
    ? res.data
    : (res.data as { messages: ChatMessage[] }).messages ?? [];

  return list
    .map((m) =>
      normalizeHistoryMessage(m as unknown as Record<string, unknown>, sessionId)
    )
    .filter((message): message is ChatMessage => message != null);
}

function assistantAfterUserId(messages: ChatMessage[], userMsgId: string): string {
  const userIndex = messages.findIndex((message) => message.id === userMsgId);
  if (userIndex < 0) return '';

  for (let index = userIndex + 1; index < messages.length; index++) {
    const message = messages[index];
    if (message?.role === 'assistant' && !isPlaceholderReply(message.content)) {
      return message.content.trim();
    }
  }
  return '';
}

async function recoverPlaceholderReplyFromHistory(
  sessionId: string,
  userMsgId: string,
  setMessages: (messages: ChatMessage[]) => void
): Promise<string> {
  const refreshed = await fetchNormalizedHistory(sessionId);
  const reply = assistantAfterUserId(refreshed, userMsgId);
  if (!isPlaceholderReply(reply)) {
    setMessages(
      mergeClinicMessagesAfterHistoryLoad(useChatStore.getState().messages, refreshed)
    );
  }
  return reply;
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
    if (useChatStore.getState().isSending) return false;

    setIsHistoryLoading(true);
    try {
      const sessionId = await ensureMasterSession();
      const fromServer = await fetchNormalizedHistory(sessionId);
      const local = useChatStore.getState().messages;
      setMessages(mergeClinicMessagesAfterHistoryLoad(local, fromServer));
      return true;
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

      try {
        const res = await sendChatMessage(sessionId, text, locale, {
          routingMode: 'clinic',
          routingVersion: 2,
        });

        if (!res.success || !res.data) {
          removeMessage(assistantId);
          updateMessage(userMsgId, { status: 'failed' });
          handleApiFailure(res);
          return { ok: false as const, error: res.error, errorCode: res.errorCode };
        }

        let { reply, intent, referral, nextActions, cards, routedToAgent } =
          parseClinicReply(res.data);

        if (isPlaceholderReply(reply)) {
          try {
            reply = await recoverPlaceholderReplyFromHistory(
              sessionId,
              userMsgId,
              setMessages
            );
          } catch (error) {
            console.warn('[useClinicChat] history refresh failed after send', error);
          }
        }

        if (isPlaceholderReply(reply)) {
          removeMessage(assistantId);
          updateMessage(userMsgId, { status: 'failed' });
          return { ok: false as const, error: 'Assistant did not return a reply' };
        }

        updateMessage(userMsgId, { status: 'sent' });
        updateMessage(assistantId, {
          content: reply,
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
      } finally {
        setSending(false);
        setStreaming(false);
      }
    },
    [addMessage, setMessages, setSending, setStreaming, updateMessage, removeMessage, handleApiFailure, locale]
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
