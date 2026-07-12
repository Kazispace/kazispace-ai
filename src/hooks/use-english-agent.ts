'use client';

/**
 * English Hub chat session (KAZI-162).
 *
 * **State design:** messages and send flags live in local React state, not
 * `useAgentStore` message slices. `/english` is a dedicated workspace URL;
 * remount re-hydrates from L4 `fetchAgentMessages`. Per-agent store unification
 * is tracked in KAZI-164 (`useHubAgentChat`).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';

import { fetchAgentMessages, sendAgentChat } from '@/lib/agent-api';
import { mapAgentHistoryToChatMessages, type RawAgentHistoryMessage } from '@/lib/agent-sessions';
import { ENGLISH_TUTOR_AGENT_ID } from '@/lib/english-tutor-config';
import { handleAgentEnvelope } from '@/lib/handle-agent-envelope';
import { openHubAgentSession } from '@/lib/hub-agent-open';
import { useAuthStore } from '@/lib/store';

/** Stable id for seeded welcome — namespaced per agent surface. */
const WELCOME_ID = 'english_chat_welcome';

export type EnglishChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
};

export function useEnglishAgent(locale: string, enabled: boolean) {
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const t = useTranslations('english');

  const [messages, setMessages] = useState<EnglishChatMessage[]>([]);
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

  const seedWelcome = useCallback(() => {
    setMessages((prev) => {
      if (prev.length > 0) return prev;
      return [{ id: WELCOME_ID, role: 'assistant', content: t('chatWelcome') }];
    });
  }, [t]);

  const hydrateHistory = useCallback(
    async (sessionId: string, greeting?: string) => {
      const res = await fetchAgentMessages(sessionId);
      if (res.success && res.data?.messages?.length) {
        // When history exists, sessions/open greeting duplicates the last turn — skip it.
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
        setMessages([{ id: WELCOME_ID, role: 'assistant', content: greeting.trim() }]);
        return;
      }

      seedWelcome();
    },
    [seedWelcome]
  );

  const ensureOpen = useCallback(async (): Promise<string | null> => {
    if (!isLoggedIn || !enabled) return null;
    if (sessionIdRef.current) return sessionIdRef.current;
    if (openInFlightRef.current) return openInFlightRef.current;

    const promise = (async (): Promise<string | null> => {
      const gen = ++openGenRef.current;
      setIsOpening(true);
      setOpenError(null);

      const open = await openHubAgentSession(ENGLISH_TUTOR_AGENT_ID, locale);
      if (gen !== openGenRef.current) return null;

      setIsOpening(false);

      if (!open.ok) {
        setOpenError(open.error ?? t('chatOpenFailed'));
        seedWelcome();
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
  }, [enabled, hydrateHistory, isLoggedIn, locale, seedWelcome, syncSessionId, t]);

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
        setOpenError((prev) => prev ?? t('chatOpenFailed'));
        return;
      }

      const assistantId = `assistant_${Date.now()}`;

      setMessages((prev) => [
        ...prev,
        { id: `user_${Date.now()}`, role: 'user', content: trimmed },
        { id: assistantId, role: 'assistant', content: '' },
      ]);

      setIsSending(true);
      const res = await sendAgentChat(ENGLISH_TUTOR_AGENT_ID, trimmed, sessionId);
      setIsSending(false);

      if (!res.success || !res.data) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: `⚠️ ${res.error ?? t('chatSendFailed')}` }
              : m
          )
        );
        return;
      }

      const { assistant } = handleAgentEnvelope(res.data);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId ? { ...m, content: assistant.content || t('chatEmptyReply') } : m
        )
      );
    },
    [ensureOpen, isSending, t]
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
