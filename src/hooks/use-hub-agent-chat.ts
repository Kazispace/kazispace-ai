'use client';

/**
 * Shared L4 open / hydrate / send loop for chat-first Hub agents (KAZI-164).
 *
 * **State design:** messages and send flags live in local React state, not
 * `useAgentStore` message slices. Remount re-hydrates from L4 `fetchAgentMessages`.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

import { fetchAgentMessages, sendAgentChat } from '@/lib/agent-api';
import { mapAgentHistoryToChatMessages, type RawAgentHistoryMessage } from '@/lib/agent-sessions';
import { handleAgentEnvelope } from '@/lib/handle-agent-envelope';
import { openHubAgentSession } from '@/lib/hub-agent-open';
import { useAuthStore } from '@/lib/store';

export type HubChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
};

export type HubAgentChatLabels = {
  openFailed: string;
  sendFailed: string;
  emptyReply: string;
};

export function useHubAgentChat(options: {
  agentId: string;
  locale: string;
  enabled: boolean;
  welcomeMessageId: string;
  seedWelcome: () => string;
  labels: HubAgentChatLabels;
}) {
  const { agentId, locale, enabled, welcomeMessageId, seedWelcome, labels } = options;
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);

  const [messages, setMessages] = useState<HubChatMessage[]>([]);
  const [agentSessionId, setAgentSessionId] = useState<string | null>(null);
  const [isOpening, setIsOpening] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [openError, setOpenError] = useState<string | null>(null);

  const sessionIdRef = useRef<string | null>(null);
  const openGenRef = useRef(0);
  const openInFlightRef = useRef<Promise<string | null> | null>(null);

  const needsLogin = !isLoggedIn;

  const syncSessionId = useCallback((sessionId: string | null) => {
    sessionIdRef.current = sessionId;
    setAgentSessionId(sessionId);
  }, []);

  const applyWelcome = useCallback(() => {
    setMessages((prev) => {
      if (prev.length > 0) return prev;
      return [{ id: welcomeMessageId, role: 'assistant', content: seedWelcome() }];
    });
  }, [seedWelcome, welcomeMessageId]);

  const hydrateHistory = useCallback(
    async (sessionId: string, greeting?: string) => {
      const res = await fetchAgentMessages(sessionId);
      if (res.success && res.data?.messages?.length) {
        const mapped = mapAgentHistoryToChatMessages(
          res.data.messages as RawAgentHistoryMessage[],
          sessionId
        );
        setMessages(
          mapped.map((m) => ({
            id: m.id,
            role: m.role === 'user' ? 'user' : 'assistant',
            content: m.content,
          }))
        );
        return;
      }

      if (greeting?.trim()) {
        setMessages([
          { id: welcomeMessageId, role: 'assistant', content: greeting.trim() },
        ]);
        return;
      }

      applyWelcome();
    },
    [applyWelcome, welcomeMessageId]
  );

  const ensureOpen = useCallback(async (): Promise<string | null> => {
    if (!isLoggedIn || !enabled) return null;
    if (sessionIdRef.current) return sessionIdRef.current;
    if (openInFlightRef.current) return openInFlightRef.current;

    const promise = (async (): Promise<string | null> => {
      const gen = ++openGenRef.current;
      setIsOpening(true);
      setOpenError(null);

      const open = await openHubAgentSession(agentId, locale);
      if (gen !== openGenRef.current) return null;

      setIsOpening(false);

      if (!open.ok) {
        setOpenError(open.error ?? labels.openFailed);
        applyWelcome();
        return null;
      }

      syncSessionId(open.sessionId);
      await hydrateHistory(open.sessionId, open.greeting);
      return open.sessionId;
    })();

    openInFlightRef.current = promise;
    try {
      return await promise;
    } finally {
      openInFlightRef.current = null;
    }
  }, [
    agentId,
    applyWelcome,
    enabled,
    hydrateHistory,
    isLoggedIn,
    labels.openFailed,
    locale,
    syncSessionId,
  ]);

  useEffect(() => {
    if (!isLoggedIn || !enabled) return;
    void ensureOpen();
  }, [ensureOpen, enabled, isLoggedIn]);

  useEffect(() => {
    if (!isLoggedIn) {
      setMessages([]);
      syncSessionId(null);
      setOpenError(null);
    }
  }, [isLoggedIn, syncSessionId]);

  const resyncSession = useCallback(async () => {
    openGenRef.current += 1;
    syncSessionId(null);
    setMessages([]);
    await ensureOpen();
  }, [ensureOpen, syncSessionId]);

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isSending) return;

      const sessionId = sessionIdRef.current ?? (await ensureOpen());
      if (!sessionId) {
        setOpenError((prev) => prev ?? labels.openFailed);
        return;
      }

      const assistantId = `assistant_${Date.now()}`;

      setMessages((prev) => [
        ...prev,
        { id: `user_${Date.now()}`, role: 'user', content: trimmed },
        { id: assistantId, role: 'assistant', content: '' },
      ]);

      setIsSending(true);
      const res = await sendAgentChat(agentId, trimmed, sessionId);
      setIsSending(false);

      if (!res.success || !res.data) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: `⚠️ ${res.error ?? labels.sendFailed}` }
              : m
          )
        );
        return;
      }

      const { assistant } = handleAgentEnvelope(res.data);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, content: assistant.content || labels.emptyReply }
            : m
        )
      );
    },
    [agentId, ensureOpen, isSending, labels.emptyReply, labels.openFailed, labels.sendFailed]
  );

  return {
    messages,
    agentSessionId,
    needsLogin,
    isOpening,
    isSending,
    openError,
    sendMessage,
    resyncSession,
  };
}
