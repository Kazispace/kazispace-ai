'use client';

/**
 * Shared L4 open / hydrate / send loop for chat-first Hub agents (KAZI-164).
 *
 * **State design:** messages and send flags live in local React state, not
 * `useAgentStore` message slices. Remount re-hydrates from L4 `fetchAgentMessages`.
 *
 * **Intentionally plain-text only:** no preview/diff/pipeline side effects, streaming
 * tokens, or per-message envelope fields (nextActions, cards). CV and other rich Hub
 * agents keep bespoke hooks until envelope handlers can plug in via `onEnvelope`.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

import { fetchAgentMessages, sendAgentChat } from '@/lib/agent-api';
import { mapAgentHistoryToChatMessages, type RawAgentHistoryMessage } from '@/lib/agent-sessions';
import { handleAgentEnvelope } from '@/lib/handle-agent-envelope';
import { openHubAgentSession } from '@/lib/hub-agent-open';
import { takeHubSessionHandoff } from '@/lib/hub-session-handoff';
import {
  SESSION_NAV_SELECT_HISTORY_EVENT,
  type SessionNavSelectHistoryDetail,
} from '@/lib/session-nav-events';
import { useAuthStore, useAgentStore } from '@/lib/store';

export type HubChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  /** User messages only (D13): "failed" shows "Not sent" + "Try again". */
  status?: 'sending' | 'sent' | 'failed';
};

export type HubAgentChatLabels = {
  openFailed: string;
  emptyReply: string;
};

export function useHubAgentChat(options: {
  agentId: string;
  locale: string;
  enabled: boolean;
  welcomeMessageId: string;
  seedWelcome: () => string;
  labels: HubAgentChatLabels;
  /** Optional hook for envelope side effects (preview, escalation, etc.). */
  onEnvelope?: (data: unknown, result: ReturnType<typeof handleAgentEnvelope>) => void;
}) {
  const { agentId, locale, enabled, welcomeMessageId, seedWelcome, labels, onEnvelope } =
    options;
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

  const seedWelcomeIfEmpty = useCallback(() => {
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

      seedWelcomeIfEmpty();
    },
    [seedWelcomeIfEmpty, welcomeMessageId]
  );

  const ensureOpen = useCallback(async (): Promise<string | null> => {
    if (!isLoggedIn || !enabled) return null;
    if (sessionIdRef.current) return sessionIdRef.current;
    if (openInFlightRef.current) return openInFlightRef.current;

    const promise = (async (): Promise<string | null> => {
      const gen = ++openGenRef.current;
      setIsOpening(true);
      setOpenError(null);

      const handoffSessionId = takeHubSessionHandoff(agentId);
      if (handoffSessionId) {
        if (gen !== openGenRef.current) return null;
        setIsOpening(false);
        syncSessionId(handoffSessionId);
        await hydrateHistory(handoffSessionId);
        return handoffSessionId;
      }

      const open = await openHubAgentSession(agentId, locale);
      if (gen !== openGenRef.current) return null;

      setIsOpening(false);

      if (!open.ok) {
        setOpenError(open.error ?? labels.openFailed);
        seedWelcomeIfEmpty();
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
    enabled,
    hydrateHistory,
    isLoggedIn,
    labels.openFailed,
    locale,
    seedWelcomeIfEmpty,
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

  const selectSession = useCallback(
    async (sessionId: string) => {
      if (!isLoggedIn || !enabled || !sessionId.trim()) return;
      if (sessionIdRef.current === sessionId) return;
      openGenRef.current += 1;
      syncSessionId(sessionId);
      useAgentStore.getState().setAgentSession(agentId, sessionId);
      setMessages([]);
      await hydrateHistory(sessionId);
    },
    [agentId, enabled, hydrateHistory, isLoggedIn, syncSessionId]
  );

  const selectSessionRef = useRef(selectSession);
  useEffect(() => {
    selectSessionRef.current = selectSession;
  }, [selectSession]);

  useEffect(() => {
    if (!enabled) return;
    const onSelectHistory = (event: Event) => {
      const detail = (event as CustomEvent<SessionNavSelectHistoryDetail>).detail;
      if (detail.agentId !== agentId) return;
      void selectSessionRef.current(detail.sessionId);
    };
    window.addEventListener(SESSION_NAV_SELECT_HISTORY_EVENT, onSelectHistory);
    return () =>
      window.removeEventListener(SESSION_NAV_SELECT_HISTORY_EVENT, onSelectHistory);
  }, [agentId, enabled]);

  const resyncSession = useCallback(async () => {
    openGenRef.current += 1;
    syncSessionId(null);
    setMessages([]);
    await ensureOpen();
  }, [ensureOpen, syncSessionId]);

  const sendMessage = useCallback(
    async (text: string, opts?: { retryMessageId?: string }) => {
      const trimmed = text.trim();
      if (!trimmed || isSending) return;

      const sessionId = sessionIdRef.current ?? (await ensureOpen());
      if (!sessionId) {
        setOpenError((prev) => prev ?? labels.openFailed);
        return;
      }

      const assistantId = `assistant_${Date.now()}`;
      const userId = opts?.retryMessageId ?? `user_${Date.now()}`;

      setMessages((prev) => [
        ...(opts?.retryMessageId
          ? prev.map((m) =>
              m.id === userId ? { ...m, status: 'sending' as const } : m
            )
          : [
              ...prev,
              {
                id: userId,
                role: 'user' as const,
                content: trimmed,
                status: 'sending' as const,
              },
            ]),
        { id: assistantId, role: 'assistant', content: '' },
      ]);

      setIsSending(true);
      const res = await sendAgentChat(agentId, trimmed, sessionId);
      setIsSending(false);

      if (!res.success || !res.data) {
        // D13: keep the user's bubble, mark it "Not sent"; no warning reply.
        setMessages((prev) =>
          prev
            .filter((m) => m.id !== assistantId)
            .map((m) =>
              m.id === userId ? { ...m, status: 'failed' as const } : m
            )
        );
        return;
      }

      const envelopeResult = handleAgentEnvelope(res.data);
      onEnvelope?.(res.data, envelopeResult);
      const { assistant } = envelopeResult;
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, content: assistant.content || labels.emptyReply }
            : m.id === userId
              ? { ...m, status: 'sent' as const }
              : m
        )
      );
    },
    [
      agentId,
      ensureOpen,
      isSending,
      labels.emptyReply,
      labels.openFailed,
      onEnvelope,
    ]
  );

  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  const retryMessage = useCallback(
    (messageId: string) => {
      const msg = messagesRef.current.find((m) => m.id === messageId);
      if (!msg || msg.role !== 'user') return;
      void sendMessage(msg.content, { retryMessageId: messageId });
    },
    [sendMessage]
  );

  return {
    messages,
    agentSessionId,
    needsLogin,
    isOpening,
    isSending,
    openError,
    sendMessage,
    retryMessage,
    resyncSession,
  };
}
