'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';

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
import { applySpaceHistoryWindowRows } from '@/lib/spaces/space-history-query';
import { hydrateStrategyPayloadUserLabels } from '@/lib/strategy-select';
import {
  isPlaceholderReply,
  mergeSpaceMessagesAfterSend,
  resolveSpaceTurnCards,
  resolveSpaceTurnAssistantMeta,
  resolveSpaceTurnCapabilityId,
  resolveSpaceTurnCitations,
  resolveSpaceTurnCustomComponents,
  resolveSpaceTurnIntent,
  resolveSpaceTurnNextActions,
  resolveSpaceTurnPlaybookId,
  resolveSpaceTurnReferral,
  resolveSpaceTurnReply,
  resolveSpaceTurnUpgradeCta,
  type SpaceChatMessage,
} from '@/lib/spaces/turn';
import { resolveSpaceSendHistory } from '@/lib/spaces/space-send-history';
import {
  resolveSpaceHistoryReadyState,
  spaceHistoryReadyKey,
} from '@/lib/spaces/space-history-ready';
import { useFetchSpaceHistory, useHydrateSpaceHistory, useSpaceHistoryQuery } from '@/hooks/use-space-history';
import { useSpaceStore, type SpaceReplyNotice } from '@/lib/store';

export type SpaceSendResult =
  | { ok: true; pending?: false }
  | { ok: true; pending: true }
  | { ok: false; error: string; errorCode?: string; retryable?: boolean };

export type { SpaceReplyNotice };

/** Stable identity for the "no slice yet" case, so `messages` doesn't get a
 * fresh array (and bust downstream useCallback deps) on every render. */
const EMPTY_SPACE_MESSAGES: SpaceChatMessage[] = [];

function resolveSpaceMasterSessionId(
  spaceMasterSessionId: string | null | undefined
): string | null {
  const masterSessionId = spaceMasterSessionId?.trim();
  return masterSessionId || null;
}

/**
 * Space chat loop via POST /spaces/{id}/turn.
 * State is per-`spaceId` in `useSpaceStore` (KAZI-178).
 * History authority is TanStack Query `['space-history', masterSessionId]` (KAZI-562).
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
  const resolvedMasterId = resolveSpaceMasterSessionId(masterSessionId);
  const fetchSpaceHistory = useFetchSpaceHistory();
  const hydrateSpaceHistory = useHydrateSpaceHistory();

  const historyQuery = useSpaceHistoryQuery(resolvedMasterId, locale, {
    enabled,
  });

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
  /** Sync mutex — `isSending` store flag alone loses to double-click before re-render (KAZI-296). */
  const sendInFlightRef = useRef(false);
  /**
   * Keyed by (spaceId, masterSessionId). App Router reuses SpaceChatPane across
   * A→B; useState init alone would keep A's ready on B's first commit (KAZI-566).
   */
  const historyReadyKey = spaceHistoryReadyKey(spaceId, resolvedMasterId);
  const [historyReadyState, setHistoryReadyState] = useState(() =>
    resolveSpaceHistoryReadyState(
      spaceId,
      resolvedMasterId,
      spaceId ? useSpaceStore.getState().getSpaceSlice(spaceId) : null,
      null
    )
  );
  const historyReadyResolved = resolveSpaceHistoryReadyState(
    spaceId,
    resolvedMasterId,
    spaceId ? slice : null,
    historyReadyState
  );
  if (historyReadyState.key !== historyReadyResolved.key) {
    setHistoryReadyState(historyReadyResolved);
  }
  const historyReady = historyReadyResolved.ready;

  const messages = slice?.messages ?? EMPTY_SPACE_MESSAGES;
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
    setSpaceMasterSessionId(spaceId, resolvedMasterId);
    if (capabilityFromSpaceState) {
      setSpaceActiveCapability(spaceId, capabilityFromSpaceState);
    }
    return () => {
      setSpaceSending(spaceId, false);
    };
  }, [
    capabilityFromSpaceState,
    resolvedMasterId,
    setActiveSpaceId,
    setSpaceActiveCapability,
    setSpaceMasterSessionId,
    setSpaceSending,
    spaceId,
  ]);

  // Sync shared history query → Zustand slice (cards rehydrate; row identity preserved).
  useEffect(() => {
    if (!enabled || !spaceId) {
      setHistoryReadyState({ key: historyReadyKey, ready: false });
      return;
    }

    if (!resolvedMasterId) {
      const cached = useSpaceStore.getState().getSpaceSlice(spaceId);
      // Do not wipe a warm slice or claim the thread is empty while detail
      // still has no master id — that painted blank_conversation welcome.
      if (cached.messages.length > 0) {
        setSpaceHydrating(spaceId, false);
        setHistoryReadyState({ key: historyReadyKey, ready: true });
        return;
      }
      setSpaceHydrating(spaceId, true);
      setHistoryReadyState({ key: historyReadyKey, ready: false });
      return;
    }

    const cached = useSpaceStore.getState().getSpaceSlice(spaceId);
    const hasWarmCache =
      cached.masterSessionId === resolvedMasterId &&
      cached.messages.length > 0 &&
      !cached.isHydrating;

    if (hasWarmCache || historyQuery.isSuccess) {
      setHistoryReadyState({ key: historyReadyKey, ready: true });
      setSpaceHydrating(spaceId, false);
    } else if (historyQuery.isFetching && !historyQuery.data) {
      setHistoryReadyState({ key: historyReadyKey, ready: false });
      setSpaceHydrating(spaceId, true);
    } else if (historyQuery.isError) {
      setHistoryReadyState({ key: historyReadyKey, ready: false });
      setSpaceHydrating(spaceId, false);
    }

    if (!historyQuery.data) return;

    const previous =
      useSpaceStore.getState().getSpaceSlice(spaceId)?.messages ?? [];
    const hydrated = rehydrateSpaceMessagesWithCards(
      spaceId,
      resolvedMasterId,
      historyQuery.data,
      previous
    );
    const next = applySpaceHistoryWindowRows(previous, hydrated);
    if (next !== previous) {
      setSpaceMessages(spaceId, next);
    }
    setSpaceHydrating(spaceId, false);
    setHistoryReadyState({ key: historyReadyKey, ready: true });
  }, [
    enabled,
    historyQuery.data,
    historyQuery.isError,
    historyQuery.isFetching,
    historyQuery.isSuccess,
    historyReadyKey,
    resolvedMasterId,
    setSpaceHydrating,
    setSpaceMessages,
    spaceId,
  ]);

  const sendMessage = useCallback(
    async (
      text: string,
      options?: {
        retryMessageId?: string;
        displayContent?: string;
        actionMeta?: import('@/types/chat-envelope').UserMessageActionMeta;
      }
    ): Promise<SpaceSendResult> => {
      if (!enabled || !spaceId || !text.trim()) {
        return { ok: false as const, error: 'Space not ready' };
      }

      if (
        sendInFlightRef.current ||
        useSpaceStore.getState().getSpaceSlice(spaceId)?.isSending
      ) {
        return { ok: false as const, error: 'Send in progress' };
      }
      sendInFlightRef.current = true;

      const generation = sendGenerationRef.current;
      const isStale = () => generation !== sendGenerationRef.current;

      if (!resolvedMasterId) {
        sendInFlightRef.current = false;
        const err = 'Space not ready';
        setSpaceReplyNotice(spaceId, { kind: 'error', message: err });
        return { ok: false as const, error: err };
      }

      const trimmed = text.trim();
      const displayContent = options?.displayContent?.trim() || trimmed;
      const userId = options?.retryMessageId ?? `user_${Date.now()}`;
      let nextMessages: SpaceChatMessage[] = [];

      if (options?.retryMessageId) {
        patchSpaceMessages(spaceId, (prev) => {
          nextMessages = prev.map((message) =>
            message.id === userId
              ? { ...message, content: displayContent, status: 'sending' as const }
              : message
          );
          return nextMessages;
        });
      } else {
        patchSpaceMessages(spaceId, (prev) => {
          nextMessages = [
            ...prev,
            { id: userId, role: 'user', content: displayContent, status: 'sending' },
          ];
          return nextMessages;
        });
      }
      setSpaceSending(spaceId, true);
      setSpaceReplyNotice(spaceId, null);

      try {
        const res = await sendSpaceTurn(spaceId, {
          message: displayContent,
          locale,
          language_preference: locale,
          ...(options?.actionMeta ? { meta: options.actionMeta } : {}),
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
        const turnNextActions = resolveSpaceTurnNextActions(res.data);
        const turnAssistantMeta = resolveSpaceTurnAssistantMeta(res.data);
        const turnCustomComponents = resolveSpaceTurnCustomComponents(res.data);
        const turnReferral = resolveSpaceTurnReferral(res.data);
        const turnUpgradeCta = resolveSpaceTurnUpgradeCta(res.data);
        const turnIntent = resolveSpaceTurnIntent(res.data);
        const turnCitations = resolveSpaceTurnCitations(res.data);
        const turnCapabilityId = resolveSpaceTurnCapabilityId(res.data);
        const turnPlaybookId = resolveSpaceTurnPlaybookId(res.data);
        const assistantMessageId = extractAssistantMessageId(res.data);

        const nextCapability = resolveActiveCapabilityFromTurn(res.data);
        if (nextCapability) {
          setSpaceActiveCapability(spaceId, nextCapability);
        }

        const nextPanel = resolveActivePanelFromTurn(res.data);
        if (nextPanel) {
          setSpaceActivePanelHint(spaceId, nextPanel);
        }

        let historyOutcome;
        try {
          historyOutcome = await resolveSpaceSendHistory({
            reply,
            assistantMessageId,
            fetchHistory: () => fetchSpaceHistory(resolvedMasterId, locale),
          });
        } catch (error) {
          console.warn('[useSpaceTurn] history recovery failed after send', error);
          historyOutcome = {
            reply,
            history: [] as SpaceChatMessage[],
            recoveredFromHistory: false,
            pending: isPlaceholderReply(reply),
            skipHistoryRefresh: true,
          };
        }

        if (isStale()) {
          return { ok: false as const, error: 'Navigated away' };
        }

        reply = historyOutcome.reply;
        const history = historyOutcome.history;

        if (historyOutcome.pending) {
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
            ...(turnNextActions.length > 0
              ? { nextActions: turnNextActions }
              : {}),
            ...(turnAssistantMeta ? { assistantMeta: turnAssistantMeta } : {}),
            ...(turnCustomComponents.length > 0
              ? { customComponents: turnCustomComponents }
              : {}),
            ...(turnReferral ? { referral: turnReferral } : {}),
            ...(turnUpgradeCta ? { upgradeCta: turnUpgradeCta } : {}),
            ...(turnIntent ? { intent: turnIntent } : {}),
            ...(turnCitations && turnCitations.length > 0
              ? { citations: turnCitations }
              : {}),
            ...(turnCapabilityId ? { capabilityId: turnCapabilityId } : {}),
            ...(turnPlaybookId !== undefined ? { playbookId: turnPlaybookId } : {}),
            ...(isServerAssistantMessageId(assistantMessageId)
              ? { serverMessageId: assistantMessageId }
              : {}),
          },
        ];
        setSpaceMessages(spaceId, nextMessages);
        rememberSpaceJobCards(spaceId, resolvedMasterId, nextMessages);

        // KAZI-563: authoritative turn → skipHistoryRefresh (0 history reads).
        if (historyOutcome.skipHistoryRefresh) {
          return { ok: true as const };
        }

        try {
          if (isStale()) {
            return { ok: false as const, error: 'Navigated away' };
          }
          if (history.length > 0) {
            const merged = applyCachedSpaceJobCards(
              spaceId,
              resolvedMasterId,
              hydrateStrategyPayloadUserLabels(
                mergeSpaceMessagesAfterSend(nextMessages, history),
                locale
              )
            );
            rememberSpaceJobCards(spaceId, resolvedMasterId, merged);
            setSpaceMessages(spaceId, merged);
          }
        } catch (error) {
          console.warn('[useSpaceTurn] history refresh failed after send', error);
        }

        return { ok: true as const };
      } finally {
        sendInFlightRef.current = false;
        if (!isStale()) {
          setSpaceSending(spaceId, false);
        }
      }
    },
    [
      enabled,
      fetchSpaceHistory,
      locale,
      patchSpaceMessages,
      resolvedMasterId,
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

  const hydrateHistoryStubs = useCallback(
    async (ids: string[]) => {
      if (!enabled || !spaceId || !resolvedMasterId || ids.length === 0) return;
      await hydrateSpaceHistory(resolvedMasterId, locale, ids);
    },
    [enabled, hydrateSpaceHistory, locale, resolvedMasterId, spaceId]
  );

  const retryHistory = useCallback(async () => {
    if (!resolvedMasterId) return;
    await historyQuery.refetch();
  }, [historyQuery, resolvedMasterId]);

  return {
    messages,
    isHydrating,
    isHistoryFetching: historyQuery.isFetching,
    historyError: historyQuery.isError,
    /** True only after this mount's history fetch settles — safer than `!isHydrating` for scroll. */
    historyReady,
    isSending,
    sendError: replyNotice?.kind === 'error' ? replyNotice.message : null,
    replyNotice,
    sendMessage,
    retryMessage,
    retryHistory,
    hydrateHistoryStubs,
    enabled,
  };
}

export type { SpaceChatMessage };
