'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';

import { fetchChatHistory } from '@/lib/api-client';
import { isLlmBusy } from '@/lib/api-errors';
import { sendSpaceTurn } from '@/lib/spaces-api';
import { isSpacesEnabled } from '@/lib/spaces/constants';
import {
  isPlaceholderReply,
  latestAssistantAfterLastUser,
  mapSpaceHistoryMessages,
  mergeSpaceMessagesAfterSend,
  resolveSpaceTurnReply,
  type SpaceChatMessage,
} from '@/lib/spaces/turn';

const HISTORY_RECOVERY_ATTEMPTS = 3;
const HISTORY_RECOVERY_DELAY_MS = 700;

export type SpaceSendResult =
  | { ok: true; pending?: false }
  | { ok: true; pending: true }
  | { ok: false; error: string; errorCode?: string; retryable?: boolean };

export type SpaceReplyNotice = {
  kind: 'error' | 'pending';
  message: string;
  retryable?: boolean;
  /** User message id to retry when retryable. */
  retryMessageId?: string;
};

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

/** Poll space master history until a trailing assistant reply appears (or give up). */
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
 * Space chat loop via POST /spaces/{id}/turn (KAZI-171).
 * History is the space `master_session_id` thread
 * (`GET /chat/sessions/{master}/messages`). Do **not** fall back to
 * POST /chat/messages — BE remaps that to Clinic `sess_{uid}_web`.
 *
 * KAZI-186: while `isSending`, SpaceChatPane mounts an empty streaming bubble
 * → MessageBubble shows 「处理中…」. History-poll recovery also runs under
 * `isSending` so Processing stays visible until the turn settles.
 */
export function useSpaceTurn(
  spaceId: string | null,
  masterSessionId: string | null,
  locale: string
) {
  const t = useTranslations('spaces');
  const tErrors = useTranslations('errors');
  const enabled = isSpacesEnabled() && Boolean(spaceId);
  const [messages, setMessages] = useState<SpaceChatMessage[]>([]);
  const [isHydrating, setIsHydrating] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [replyNotice, setReplyNotice] = useState<SpaceReplyNotice | null>(null);

  const refreshHistory = useCallback(async () => {
    const resolvedMasterId = resolveSpaceMasterSessionId(masterSessionId);
    if (!resolvedMasterId) return [];
    const next = await loadSpaceHistory(resolvedMasterId);
    setMessages(next);
    return next;
  }, [masterSessionId]);

  useEffect(() => {
    if (!enabled) {
      setMessages([]);
      return;
    }

    const resolvedMasterId = resolveSpaceMasterSessionId(masterSessionId);
    if (!resolvedMasterId) {
      setMessages([]);
      setIsHydrating(false);
      return;
    }

    let cancelled = false;
    setIsHydrating(true);
    // Do not clear replyNotice here — reload must not erase a failed/pending turn notice.

    void (async () => {
      const next = await loadSpaceHistory(resolvedMasterId);
      if (cancelled) return;
      setMessages(next);
      setIsHydrating(false);
    })();

    return () => {
      cancelled = true;
    };
    // spaceId: defensive — masterSessionId is 1:1 with space, but remounts can race.
  }, [enabled, masterSessionId, spaceId]);

  const sendMessage = useCallback(
    async (
      text: string,
      options?: { retryMessageId?: string }
    ): Promise<SpaceSendResult> => {
      if (!enabled || !spaceId || !text.trim()) {
        return { ok: false as const, error: 'Space not ready' };
      }

      const resolvedMasterId = resolveSpaceMasterSessionId(masterSessionId);
      if (!resolvedMasterId) {
        const err = 'Space not ready';
        setReplyNotice({ kind: 'error', message: err });
        return { ok: false as const, error: err };
      }

      const trimmed = text.trim();
      const userId = options?.retryMessageId ?? `user_${Date.now()}`;
      let nextMessages: SpaceChatMessage[] = [];

      if (options?.retryMessageId) {
        setMessages((prev) => {
          nextMessages = prev.map((message) =>
            message.id === userId
              ? { ...message, content: trimmed, status: 'sending' as const }
              : message
          );
          return nextMessages;
        });
      } else {
        setMessages((prev) => {
          nextMessages = [
            ...prev,
            { id: userId, role: 'user', content: trimmed, status: 'sending' },
          ];
          return nextMessages;
        });
      }
      setIsSending(true);
      setReplyNotice(null);

      try {
        // TODO(KAZI-74): drop `locale` once BE reads language_preference only.
        const res = await sendSpaceTurn(spaceId, {
          message: trimmed,
          locale,
          language_preference: locale,
        });

        if (!res.success) {
          const busy = isLlmBusy(res);
          const message = busy
            ? res.retryAfter && res.retryAfter > 0
              ? tErrors('llmBusyWithRetry', { seconds: res.retryAfter })
              : tErrors('llmBusy')
            : (res.error ?? 'Send failed');

          // Keep user bubble on all failures; mark failed for Retry (KAZI-186 P1/P2).
          setMessages((prev) =>
            prev.map((messageRow) =>
              messageRow.id === userId
                ? { ...messageRow, status: 'failed' as const }
                : messageRow
            )
          );
          setReplyNotice({
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
        let history: SpaceChatMessage[] = [];
        let recoveredFromHistory = false;

        if (isPlaceholderReply(reply)) {
          try {
            const recovered = await recoverReplyFromMasterHistory(resolvedMasterId);
            reply = recovered.reply;
            history = recovered.history;
            recoveredFromHistory = true;
          } catch (error) {
            console.warn('[useSpaceTurn] history recovery failed after send', error);
          }
        }

        if (isPlaceholderReply(reply)) {
          // Turn was accepted — L2 may still be writing. Keep user bubble; don't invite resend.
          setMessages((prev) =>
            prev.map((messageRow) =>
              messageRow.id === userId
                ? { ...messageRow, status: 'sent' as const }
                : messageRow
            )
          );
          setReplyNotice({
            kind: 'pending',
            message: t('replyStillGenerating'),
          });
          return { ok: true as const, pending: true as const };
        }

        nextMessages = [
          ...nextMessages.map((messageRow) =>
            messageRow.id === userId
              ? { ...messageRow, status: 'sent' as const }
              : messageRow
          ),
          { id: `assistant_${Date.now()}`, role: 'assistant', content: reply },
        ];
        setMessages(nextMessages);

        try {
          if (!recoveredFromHistory) {
            history = await loadSpaceHistory(resolvedMasterId);
          }
          if (history.length > 0) {
            setMessages(mergeSpaceMessagesAfterSend(nextMessages, history));
          }
        } catch (error) {
          console.warn('[useSpaceTurn] history refresh failed after send', error);
        }

        return { ok: true as const };
      } finally {
        setIsSending(false);
      }
    },
    [enabled, locale, masterSessionId, spaceId, t, tErrors]
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
    isSending,
    /** @deprecated Prefer replyNotice — kept as error-message string for older call sites. */
    sendError: replyNotice?.kind === 'error' ? replyNotice.message : null,
    replyNotice,
    sendMessage,
    retryMessage,
    refreshHistory,
    enabled,
  };
}

export type { SpaceChatMessage };
