import {
  isPlaceholderReply,
  latestAssistantAfterLastUser,
  type SpaceChatMessage,
} from '@/lib/spaces/turn';
import { isServerAssistantMessageId } from '@/lib/clinic/message-feedback';
import { SPACE_HISTORY_RECOVERY_ATTEMPTS } from '@/lib/spaces/perf-policy';

export type SpaceSendHistoryOutcome = {
  reply: string;
  history: SpaceChatMessage[];
  recoveredFromHistory: boolean;
  /** True when caller should show pending UI and stop. */
  pending: boolean;
  /**
   * True when turn response is authoritative — caller must NOT fetch history.
   * (KAZI-563 acceptance: 0 history reads on normal success.)
   */
  skipHistoryRefresh: boolean;
};

/**
 * Post-turn history policy for Space send (KAZI-563).
 * Extracted for runtime request-count tests without mounting React.
 */
export async function resolveSpaceSendHistory(input: {
  reply: string;
  assistantMessageId: string | null | undefined;
  fetchHistory: () => Promise<SpaceChatMessage[]>;
  recoveryAttempts?: number;
}): Promise<SpaceSendHistoryOutcome> {
  let reply = input.reply;
  let history: SpaceChatMessage[] = [];
  let recoveredFromHistory = false;
  const attempts = input.recoveryAttempts ?? SPACE_HISTORY_RECOVERY_ATTEMPTS;

  if (isPlaceholderReply(reply)) {
    for (let attempt = 0; attempt < attempts; attempt++) {
      history = await input.fetchHistory();
      reply = latestAssistantAfterLastUser(history);
      if (!isPlaceholderReply(reply)) {
        recoveredFromHistory = true;
        break;
      }
    }
  }

  if (isPlaceholderReply(reply)) {
    return {
      reply,
      history,
      recoveredFromHistory,
      pending: true,
      skipHistoryRefresh: true,
    };
  }

  const turnAuthoritative =
    !recoveredFromHistory &&
    isServerAssistantMessageId(input.assistantMessageId);

  if (turnAuthoritative) {
    return {
      reply,
      history,
      recoveredFromHistory: false,
      pending: false,
      skipHistoryRefresh: true,
    };
  }

  if (!recoveredFromHistory) {
    history = await input.fetchHistory();
  }

  return {
    reply,
    history,
    recoveredFromHistory,
    pending: false,
    skipHistoryRefresh: false,
  };
}
