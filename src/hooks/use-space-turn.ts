'use client';

import { useCallback, useEffect, useState } from 'react';

import { fetchChatHistory } from '@/lib/api-client';
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
 */
export function useSpaceTurn(
  spaceId: string | null,
  masterSessionId: string | null,
  locale: string
) {
  const enabled = isSpacesEnabled() && Boolean(spaceId);
  const [messages, setMessages] = useState<SpaceChatMessage[]>([]);
  const [isHydrating, setIsHydrating] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

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
    // Do not clear sendError here — reload must not erase a failed/pending turn notice.

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
    async (text: string) => {
      if (!enabled || !spaceId || !text.trim()) {
        return { ok: false as const, error: 'Space not ready' };
      }

      const resolvedMasterId = resolveSpaceMasterSessionId(masterSessionId);
      if (!resolvedMasterId) {
        const err = 'Space not ready';
        setSendError(err);
        return { ok: false as const, error: err };
      }

      const trimmed = text.trim();
      const userId = `user_${Date.now()}`;
      let nextMessages: SpaceChatMessage[] = [];

      setMessages((prev) => {
        nextMessages = [...prev, { id: userId, role: 'user', content: trimmed }];
        return nextMessages;
      });
      setIsSending(true);
      setSendError(null);

      try {
        // TODO(KAZI-74): drop `locale` once BE reads language_preference only.
        const res = await sendSpaceTurn(spaceId, {
          message: trimmed,
          locale,
          language_preference: locale,
        });

        if (!res.success) {
          const err = res.error ?? 'Send failed';
          setSendError(err);
          setMessages((prev) => prev.filter((message) => message.id !== userId));
          return { ok: false as const, error: err };
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
          const err =
            'Reply is still generating — reopen this space in a moment if it does not appear.';
          setSendError(err);
          return { ok: true as const, pending: true as const };
        }

        nextMessages = [
          ...nextMessages,
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
    [enabled, locale, masterSessionId, spaceId]
  );

  return {
    messages,
    isHydrating,
    isSending,
    sendError,
    sendMessage,
    refreshHistory,
    enabled,
  };
}

export type { SpaceChatMessage };
