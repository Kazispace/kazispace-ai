'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';

import { fetchChatHistory } from '@/lib/api-client';
import { isLlmBusy } from '@/lib/api-errors';
import { sendSpaceTurn } from '@/lib/spaces-api';
import {
  extractAssistantMessageId,
  isServerAssistantMessageId,
} from '@/lib/clinic/message-feedback';
import { resolveActivePanelFromTurn } from '@/lib/spaces/active-panel';
import {
  resolveActiveCapability,
  resolveActiveCapabilityFromTurn,
} from '@/lib/spaces/capability';
import { isSpacesEnabled } from '@/lib/spaces/constants';
import {
  applyCachedSpaceJobCards,
  rehydrateSpaceMessagesWithCards,
  rememberSpaceJobCards,
} from '@/lib/spaces/space-job-cards-cache';
import {
  isPlaceholderReply,
  latestAssistantAfterLastUser,
  mapSpaceHistoryMessages,
  mergeSpaceMessagesAfterSend,
  resolveSpaceTurnCards,
  resolveSpaceTurnReply,
  type SpaceChatMessage,
} from '@/lib/spaces/turn';
import { useSpaceStore, type SpaceReplyNotice } from '@/lib/store';

const HISTORY_RECOVERY_ATTEMPTS = 3;
const HISTORY_RECOVERY_DELAY_MS = 700;

export type SpaceSendResult =
  | { ok: true; pending?: false }
  | { ok: true; pending: true }
  | { ok: false; error: string; errorCode?: string; retryable?: boolean };

export type { SpaceReplyNotice };

function resolveSpaceMasterSessionId(
  spaceMasterSessionId: string | null | undefined
): string | null {
  const masterSessionId = spaceMasterSessionId?.trim();
  return masterSessionId || null;
}

async function loadSpaceHistory(
  masterSessionId: string
): Promise<SpaceChatMessage[]> {
  const res = await fetchChatHistory(masterSessionId);
  if (!res.success || !res.data) return [];
  const list = Array.isArray(res.data) ? res.data : (res.data.messages ?? []);
  return mapSpaceHistoryMessages(list);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function recoverReplyFromMasterHistory(
  masterSessionId: string
): Promise<{ reply: string; history: SpaceChatMessage[] }> {
  let history: SpaceChatMessage[] = [];
  for (let attempt = 0; attempt < HISTORY_RECOVERY_ATTEMPTS; attempt++) {
    if (attempt > 0) await sleep(HISTORY_RECOVERY_DELAY_MS);
    history = await loadSpaceHistory(masterSessionId);
    const reply = latestAssistantAfterLastUser(history);
    if (!isPlaceholderReply(reply)) {
      return { reply, history };
    }
  }
  return { reply: '', history };
}

/**
 * Space chat loop via POST /spaces/{id}/turn.
 * State is per-`spaceId` in `useSpaceStore` (KAZI-178).
 */
export function useSpaceTurn(
  spaceId: string | null,
  masterSessionId: string | null,
  locale: string,
  spaceState: Record<string, unknown> | null = null
) {
  const t = useTranslations('spaces');
  const tErrors = useTranslations('errors');
  const enabled = isSpacesEnabled() && Boolean(spaceId);

  const slice = useSpaceStore((s) =>
    spaceId ? s.getSpaceSlice(spaceId) : null
  );
  const setActiveSpaceId = useSpaceStore((s) => s.setActiveSpaceId);
  const setSpaceMasterSessionId = useSpaceStore((s) => s.setSpaceMasterSessionId);
  const setSpaceMessages = useSpaceStore((s) => s.setSpaceMessages);
  const patchSpaceMessages = useSpaceStore((s) => s.patchSpaceMessages);
  const setSpaceHydrating = useSpaceStore((s) => s.setSpaceHydrating);
  const setSpaceSending = useSpaceStore((s) => s.setSpaceSending);
  const setSpaceReplyNotice = useSpaceStore((s) => s.setSpaceReplyNotice);
  const setSpaceActiveCapability = useSpaceStore((s) => s.setSpaceActiveCapability);
  const setSpaceActivePanelHint = useSpaceStore((s) => s.setSpaceActivePanelHint);

  /** Generation counter — skip stale async store writes when the user navigates away. */
  const sendGenerationRef = useRef(0);
  /**
   * Mount-local settle flag for scroll restore.
   * Store `isHydrating` can still be false on the first paint after remount (leftover from
   * the previous visit), which would restore against cached height and lock restoredRef.
   */
  const [historyReady, setHistoryReady] = useState(false);

  const messages = slice?.messages ?? [];
  const isHydrating = slice?.isHydrating ?? false;
  const isSending = slice?.isSending ?? false;
  const replyNotice = slice?.replyNotice ?? null;
  const capabilityFromSpaceState = resolveActiveCapability(spaceState);

  useEffect(() => {
    sendGenerationRef.current += 1;
  }, [spaceId]);

  useEffect(() => {
    if (!spaceId) {
      setActiveSpaceId(null);
      return;
    }
    setActiveSpaceId(spaceId);
    setSpaceMasterSessionId(spaceId, resolveSpaceMasterSessionId(masterSessionId));
    if (capabilityFromSpaceState) {
      setSpaceActiveCapability(spaceId, capabilityFromSpaceState);
    }
    return () => {
      setSpaceSending(spaceId, false);
    };
  }, [
    capabilityFromSpaceState,
    masterSessionId,
    setActiveSpaceId,
    setSpaceActiveCapability,
    setSpaceMasterSessionId,
    setSpaceSending,
    spaceId,
  ]);

  useEffect(() => {
    if (!enabled || !spaceId) {
      setHistoryReady(false);
      return;
    }

    const resolvedMasterId = resolveSpaceMasterSessionId(masterSessionId);
    if (!resolvedMasterId) {
      setSpaceMessages(spaceId, []);
      setSpaceHydrating(spaceId, false);
      setHistoryReady(true);
      return;
    }

    let cancelled = false;
    setHistoryReady(false);
    setSpaceHydrating(spaceId, true);

    void (async () => {
      // Capture before await — SPA switch-away must not lose in-memory cards.
      const previous =
        useSpaceStore.getState().getSpaceSlice(spaceId)?.messages ?? [];
      const next = await loadSpaceHistory(resolvedMasterId);
      if (cancelled) return;
      setSpaceMessages(
        spaceId,
        rehydrateSpaceMessagesWithCards(spaceId, next, previous)
      );
      setSpaceHydrating(spaceId, false);
      setHistoryReady(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [
    enabled,
    masterSessionId,
    setSpaceHydrating,
    setSpaceMessages,
    spaceId,
  ]);

  const sendMessage = useCallback(
    async (
      text: string,
      options?: { retryMessageId?: string }
    ): Promise<SpaceSendResult> => {
      if (!enabled || !spaceId || !text.trim()) {
        return { ok: false as const, error: 'Space not ready' };
      }

      const generation = sendGenerationRef.current;
      const isStale = () => generation !== sendGenerationRef.current;

      const resolvedMasterId = resolveSpaceMasterSessionId(masterSessionId);
      if (!resolvedMasterId) {
        const err = 'Space not ready';
        setSpaceReplyNotice(spaceId, { kind: 'error', message: err });
        return { ok: false as const, error: err };
      }

      const trimmed = text.trim();
      const userId = options?.retryMessageId ?? `user_${Date.now()}`;
      let nextMessages: SpaceChatMessage[] = [];

      if (options?.retryMessageId) {
        patchSpaceMessages(spaceId, (prev) => {
          nextMessages = prev.map((message) =>
            message.id === userId
              ? { ...message, content: trimmed, status: 'sending' as const }
              : message
          );
          return nextMessages;
        });
      } else {
        patchSpaceMessages(spaceId, (prev) => {
          nextMessages = [
            ...prev,
            { id: userId, role: 'user', content: trimmed, status: 'sending' },
          ];
          return nextMessages;
        });
      }
      setSpaceSending(spaceId, true);
      setSpaceReplyNotice(spaceId, null);

      try {
        const res = await sendSpaceTurn(spaceId, {
          message: trimmed,
          locale,
          language_preference: locale,
        });

        if (isStale()) {
          return { ok: false as const, error: 'Navigated away' };
        }

        if (!res.success) {
          const busy = isLlmBusy(res);
          const message = busy
            ? res.retryAfter && res.retryAfter > 0
              ? tErrors('llmBusyWithRetry', { seconds: res.retryAfter })
              : tErrors('llmBusy')
            : (res.error ?? 'Send failed');

          patchSpaceMessages(spaceId, (prev) =>
            prev.map((messageRow) =>
              messageRow.id === userId
                ? { ...messageRow, status: 'failed' as const }
                : messageRow
            )
          );
          setSpaceReplyNotice(spaceId, {
            kind: 'error',
            message,
            retryable: true,
            retryMessageId: userId,
          });
          return {
            ok: false as const,
            error: message,
            errorCode: busy ? 'LLM_BUSY' : res.errorCode,
            retryable: true,
          };
        }

        let reply = resolveSpaceTurnReply(res.data);
        const turnCards = resolveSpaceTurnCards(res.data);
        let history: SpaceChatMessage[] = [];
        let recoveredFromHistory = false;

        const nextCapability = resolveActiveCapabilityFromTurn(res.data);
        if (nextCapability) {
          setSpaceActiveCapability(spaceId, nextCapability);
        }

        const nextPanel = resolveActivePanelFromTurn(res.data);
        if (nextPanel) {
          setSpaceActivePanelHint(spaceId, nextPanel);
        }

        if (isPlaceholderReply(reply)) {
          try {
            const recovered = await recoverReplyFromMasterHistory(resolvedMasterId);
            if (isStale()) {
              return { ok: false as const, error: 'Navigated away' };
            }
            reply = recovered.reply;
            history = recovered.history;
            recoveredFromHistory = true;
          } catch (error) {
            console.warn('[useSpaceTurn] history recovery failed after send', error);
          }
        }

        if (isStale()) {
          return { ok: false as const, error: 'Navigated away' };
        }

        if (isPlaceholderReply(reply)) {
          patchSpaceMessages(spaceId, (prev) =>
            prev.map((messageRow) =>
              messageRow.id === userId
                ? { ...messageRow, status: 'sent' as const }
                : messageRow
            )
          );
          setSpaceReplyNotice(spaceId, {
            kind: 'pending',
            message: t('replyStillGenerating'),
          });
          return { ok: true as const, pending: true as const };
        }

        const assistantMessageId = extractAssistantMessageId(res.data);
        const localAssistantId = `assistant_${Date.now()}`;
        nextMessages = [
          ...nextMessages.map((messageRow) =>
            messageRow.id === userId
              ? { ...messageRow, status: 'sent' as const }
              : messageRow
          ),
          {
            id: localAssistantId,
            role: 'assistant',
            content: reply,
            ...(turnCards.length > 0 ? { cards: turnCards } : {}),
            ...(isServerAssistantMessageId(assistantMessageId)
              ? { serverMessageId: assistantMessageId }
              : {}),
          },
        ];
        setSpaceMessages(spaceId, nextMessages);
        rememberSpaceJobCards(spaceId, nextMessages);

        try {
          if (!recoveredFromHistory) {
            history = await loadSpaceHistory(resolvedMasterId);
          }
          if (isStale()) {
            return { ok: false as const, error: 'Navigated away' };
          }
          if (history.length > 0) {
            const merged = applyCachedSpaceJobCards(
              spaceId,
              mergeSpaceMessagesAfterSend(nextMessages, history)
            );
            rememberSpaceJobCards(spaceId, merged);
            setSpaceMessages(spaceId, merged);
          }
        } catch (error) {
          console.warn('[useSpaceTurn] history refresh failed after send', error);
        }

        return { ok: true as const };
      } finally {
        if (!isStale()) {
          setSpaceSending(spaceId, false);
        }
      }
    },
    [
      enabled,
      locale,
      masterSessionId,
      patchSpaceMessages,
      setSpaceActiveCapability,
      setSpaceActivePanelHint,
      setSpaceMessages,
      setSpaceReplyNotice,
      setSpaceSending,
      spaceId,
      t,
      tErrors,
    ]
  );

  const retryMessage = useCallback(
    async (messageId: string) => {
      const msg = messages.find((message) => message.id === messageId);
      if (!msg || msg.role !== 'user') {
        return { ok: false as const, error: 'Nothing to retry' };
      }
      return sendMessage(msg.content, { retryMessageId: messageId });
    },
    [messages, sendMessage]
  );

  return {
    messages,
    isHydrating,
    /** True only after this mount's history fetch settles — safer than `!isHydrating` for scroll. */
    historyReady,
    isSending,
    sendError: replyNotice?.kind === 'error' ? replyNotice.message : null,
    replyNotice,
    sendMessage,
    retryMessage,
    enabled,
  };
}

export type { SpaceChatMessage };
