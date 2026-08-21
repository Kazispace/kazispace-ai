'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useAuthStore, useChatStore, useUIStore } from '@/lib/store';
import {
  sendChatMessage,
  fetchChatHistory,
  parseClinicReply,
} from '@/lib/api-client';
import { isPaywallError, isProfileIncomplete, isLlmBusy } from '@/lib/api-errors';
import { mergeClinicMessagesAfterHistoryLoad } from '@/lib/clinic-chat-merge';
import { getAuthToken } from '@/lib/auth';
import { ensureMasterSession, syncMasterSession } from '@/lib/master-session';
import { publishSessionNavInvalidate } from '@/lib/session-nav-invalidate';
import { looksLikeResearchRequest } from '@/lib/clinic/upgrade-cta';
import { isPlaceholderReply, resolveSpaceTurnReply } from '@/lib/spaces/turn';
import { isServerAssistantMessageId } from '@/lib/clinic/message-feedback';
import { parseAssistantEnvelope } from '@/lib/chat-envelope';
import {
  applyHistoryWindowRows,
  capHistoryHydrateIds,
  mergeHydratedHistoryRows,
  parseChatHistoryResponse,
} from '@/lib/chat/history-window';
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
  const rawId =
    (typeof raw.id === 'string' && raw.id) ||
    (typeof raw.message_id === 'string' && raw.message_id) ||
    (typeof raw.id === 'number' ? String(raw.id) : '') ||
    (typeof raw.message_id === 'number' ? String(raw.message_id) : '');
  if (raw.content_pending === true && rawId) {
    return {
      id: rawId,
      role,
      content: '',
      timestamp:
        (raw.timestamp as string) ??
        (raw.created_at as string) ??
        new Date().toISOString(),
      sessionId,
      status: 'sent',
      streamComplete: true,
      contentPending: true,
    };
  }
  if (!content) return null;
  if (role === 'assistant' && isPlaceholderReply(content)) return null;

  const id =
    rawId ||
    crypto.randomUUID();

  const envelope =
    role === 'assistant' ? parseAssistantEnvelope(raw) : null;

  return {
    id,
    role,
    content,
    timestamp: (raw.timestamp as string) ?? (raw.created_at as string) ?? new Date().toISOString(),
    sessionId,
    status: 'sent',
    streamComplete: true,
    ...(envelope?.intent ? { intent: envelope.intent } : {}),
    ...(envelope && envelope.nextActions.length > 0
      ? { nextActions: envelope.nextActions }
      : {}),
    ...(envelope && envelope.cards.length > 0 ? { cards: envelope.cards } : {}),
    ...(envelope?.citations && envelope.citations.length > 0
      ? { citations: envelope.citations }
      : {}),
    ...(envelope?.upgradeCta ? { upgradeCta: envelope.upgradeCta } : {}),
    ...(envelope?.capabilityId ? { capabilityId: envelope.capabilityId } : {}),
    ...(envelope?.playbookId !== undefined ? { playbookId: envelope.playbookId } : {}),
    ...(envelope?.meta && Object.keys(envelope.meta).length > 0
      ? { assistantMeta: envelope.meta }
      : {}),
    ...(envelope?.customComponents && envelope.customComponents.length > 0
      ? { customComponents: envelope.customComponents }
      : {}),
    ...(role === 'assistant' && isServerAssistantMessageId(id)
      ? { serverMessageId: id }
      : {}),
  };
}

function clinicHistoryFingerprint(message: ChatMessage): string {
  return [
    message.id,
    message.content,
    message.contentPending ? 'pending' : '',
    String(message.cards?.length ?? 0),
  ].join('\0');
}

/** Throws on transport/envelope failure so callers cannot treat it as empty success. */
export async function fetchNormalizedClinicHistory(
  sessionId: string
): Promise<ChatMessage[]> {
  const res = await fetchChatHistory(sessionId);
  if (!res.success || res.data == null) {
    throw new Error(res.error ?? 'Failed to load clinic history');
  }

  const parsed = parseChatHistoryResponse(res.data);

  return parsed.rows
    .map((m) => normalizeHistoryMessage(m, sessionId))
    .filter((message): message is ChatMessage => message != null);
}

async function hydrateNormalizedHistory(
  sessionId: string,
  ids: string[]
): Promise<ChatMessage[]> {
  const capped = capHistoryHydrateIds(ids);
  if (capped.length === 0) return [];
  const res = await fetchChatHistory(sessionId, { ids: capped.join(',') });
  if (!res.success || !res.data) return [];
  const parsed = parseChatHistoryResponse(res.data);
  return parsed.rows
    .filter((row) => row.content_pending !== true)
    .map((m) => normalizeHistoryMessage(m, sessionId))
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
  let refreshed: ChatMessage[];
  try {
    refreshed = await fetchNormalizedClinicHistory(sessionId);
  } catch {
    return '';
  }
  const reply = assistantAfterUserId(refreshed, userMsgId);
  if (!isPlaceholderReply(reply)) {
    const local = useChatStore.getState().messages;
    const mergedWindow = applyHistoryWindowRows(
      local,
      refreshed,
      clinicHistoryFingerprint
    );
    setMessages(mergeClinicMessagesAfterHistoryLoad(local, mergedWindow));
  }
  return reply;
}

export function useClinicChat(locale?: string) {
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const masterSessionSyncedRef = useRef(false);
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

  useEffect(() => {
    if (!isLoggedIn) {
      masterSessionSyncedRef.current = false;
    }
  }, [isLoggedIn]);

  const handleApiFailure = useCallback(
    (res: {
      error?: string;
      errorCode?: string;
      status?: number;
      retryAfter?: number;
    }) => {
      if (isLlmBusy(res)) {
        const message =
          res.retryAfter && res.retryAfter > 0
            ? tErrors('llmBusyWithRetry', { seconds: res.retryAfter })
            : tErrors('llmBusy');
        showToast(message, 'error');
        return;
      }
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
      if (getAuthToken() && !masterSessionSyncedRef.current) {
        await syncMasterSession();
        masterSessionSyncedRef.current = true;
      }
      const sessionId = await ensureMasterSession();
      const fromServer = await fetchNormalizedClinicHistory(sessionId);
      const local = useChatStore.getState().messages;
      const mergedWindow = applyHistoryWindowRows(
        local,
        fromServer,
        clinicHistoryFingerprint
      );
      setMessages(mergeClinicMessagesAfterHistoryLoad(local, mergedWindow));
      return true;
    } catch (error) {
      console.error('[useClinicChat] loadHistory failed', error);
      return false;
    } finally {
      setIsHistoryLoading(false);
    }
  }, [setMessages]);

  const hydrateHistoryStubs = useCallback(
    async (ids: string[]) => {
      const sessionId = await ensureMasterSession();
      const hydrated = await hydrateNormalizedHistory(sessionId, ids);
      if (hydrated.length === 0) return;
      const local = useChatStore.getState().messages;
      setMessages(mergeHydratedHistoryRows(local, hydrated));
    },
    [setMessages]
  );

  const skipHistoryLoad = useCallback(() => {
    setIsHistoryLoading(false);
  }, []);

  const sendMessage = useCallback(
    async (
      text: string,
      options?: {
        retryMessageId?: string;
        /** Prefer research waiting copy (CTA handoff / explicit research). */
        pendingCapability?: 'web_search' | 'research';
        /** Bubble copy when transport uses action meta (KAZI-469). */
        displayContent?: string;
        actionMeta?: import('@/types/chat-envelope').UserMessageActionMeta;
      }
    ) => {
      // Clinic Phase 1 path is a single long HTTP POST (not mid-stream SSE).
      // LLM_BUSY surfaces on the response envelope via handleApiFailure + toastShown.
      const sessionId = await ensureMasterSession();
      const userMsgId = options?.retryMessageId ?? `user_${Date.now()}`;
      const pendingCapability =
        options?.pendingCapability ??
        (looksLikeResearchRequest(text) ? 'research' : undefined);
      const displayContent = options?.displayContent?.trim() || text.trim();

      if (options?.retryMessageId) {
        updateMessage(userMsgId, { status: 'sending', content: displayContent });
      } else {
        addMessage({
          id: userMsgId,
          role: 'user',
          content: displayContent,
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
        pendingCapability,
      });
      setStreaming(true);

      try {
        const res = await sendChatMessage(sessionId, displayContent, locale, {
          routingMode: 'clinic',
          routingVersion: 2,
          ...(options?.actionMeta ? { actionMeta: options.actionMeta } : {}),
        });

        if (!res.success || !res.data) {
          removeMessage(assistantId);
          updateMessage(userMsgId, { status: 'failed' });
          handleApiFailure(res);
          const busy = isLlmBusy(res);
          return {
            ok: false as const,
            error: busy
              ? res.retryAfter && res.retryAfter > 0
                ? tErrors('llmBusyWithRetry', { seconds: res.retryAfter })
                : tErrors('llmBusy')
              : res.error,
            errorCode: res.errorCode ?? (busy ? 'LLM_BUSY' : undefined),
            retryMessageId: userMsgId,
            // Explicit contract: caller must not toast again when true (KAZI-186 review).
            toastShown: busy || isProfileIncomplete(res) || isPaywallError(res),
          };
        }

        let {
          reply,
          intent,
          referral,
          spaceNudge,
          nextActions,
          cards,
          citations,
          upgradeCta,
          capabilityId,
          playbookId,
          assistantMeta,
          customComponents,
          routedToAgent,
          assistantMessageId,
        } = parseClinicReply(res.data);

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
          ...(spaceNudge ? { spaceNudge } : {}),
          ...(nextActions.length > 0 ? { nextActions } : {}),
          ...(cards.length > 0 ? { cards } : {}),
          ...(citations && citations.length > 0 ? { citations } : {}),
          ...(upgradeCta ? { upgradeCta } : {}),
          ...(capabilityId ? { capabilityId } : {}),
          ...(playbookId !== undefined ? { playbookId } : {}),
          ...(assistantMeta ? { assistantMeta } : {}),
          ...(customComponents && customComponents.length > 0
            ? { customComponents }
            : {}),
          ...(isServerAssistantMessageId(assistantMessageId)
            ? { serverMessageId: assistantMessageId }
            : {}),
          pendingCapability: undefined,
          // Full HTTP reply — render Markdown immediately (KAZI-561).
          // Never leave streamComplete=false for a complete string (fake typewriter).
          streamComplete: true,
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
    [addMessage, setMessages, setSending, setStreaming, updateMessage, removeMessage, handleApiFailure, locale, tErrors]
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

  const dismissMessageSpaceNudge = useCallback(
    (messageId: string) => {
      const msg = useChatStore.getState().messages.find((m) => m.id === messageId);
      if (!msg?.spaceNudge) return;
      updateMessage(messageId, {
        spaceNudge: { ...msg.spaceNudge, dismissed: true },
      });
    },
    [updateMessage]
  );

  const dismissMessageUpgradeCta = useCallback(
    (messageId: string) => {
      const msg = useChatStore.getState().messages.find((m) => m.id === messageId);
      if (!msg?.upgradeCta) return;
      updateMessage(messageId, {
        upgradeCta: { ...msg.upgradeCta, dismissed: true },
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
    hydrateHistoryStubs,
    sendMessage,
    retryMessage,
    markStreamComplete,
    dismissMessageReferral,
    dismissMessageSpaceNudge,
    dismissMessageUpgradeCta,
  };
}
