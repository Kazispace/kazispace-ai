import { resolveActionLabel } from '@/lib/chat-envelope';
import type { ChatNextAction } from '@/types/chat-envelope';

export const STRATEGY_SELECT_ACTION_TYPE = 'strategy_select';
export const STRATEGY_PAYLOAD_PREFIX = '__strategy:';

export function isStrategySelectAction(action: ChatNextAction): boolean {
  return action.type === STRATEGY_SELECT_ACTION_TYPE;
}

/** @deprecated Prefer {@link partitionNextActions} for mixed CTA rows. */
export function isStrategySelectActions(
  actions: ChatNextAction[] | undefined
): boolean {
  return Boolean(actions?.length && actions.every(isStrategySelectAction));
}

export function partitionNextActions(actions?: ChatNextAction[]): {
  strategyActions: ChatNextAction[];
  genericActions: ChatNextAction[];
} {
  if (!actions?.length) {
    return { strategyActions: [], genericActions: [] };
  }
  return {
    strategyActions: actions.filter(isStrategySelectAction),
    genericActions: actions.filter((action) => !isStrategySelectAction(action)),
  };
}

export function isStrategyPayloadContent(content: string): boolean {
  return strategyIdFromPayload(content.trim()) !== null;
}

export function strategyIdFromPayload(payload: string): string | null {
  const trimmed = payload.trim();
  if (!trimmed.startsWith(STRATEGY_PAYLOAD_PREFIX)) return null;
  const id = trimmed.slice(STRATEGY_PAYLOAD_PREFIX.length).trim();
  return id || null;
}

/** BE #309: recommended flag lives on each action, not turn meta. */
export function isStrategySelectRecommended(action: ChatNextAction): boolean {
  return action.meta?.recommended === true;
}

/** BE #309: optional subtitle under the strategy label. */
export function getStrategySelectRationale(action: ChatNextAction): string | undefined {
  const rationale = action.meta?.rationale?.trim();
  return rationale || undefined;
}

/** Sample B — single Start CTA (`confirm_skipped` on action). */
export function isStrategyStartCta(actions: ChatNextAction[]): boolean {
  return (
    actions.length === 1 &&
    isStrategySelectAction(actions[0]!) &&
    actions[0]!.meta?.confirm_skipped === true
  );
}

/** Pending CTAs are interactive only until the user replies below this turn. */
export function resolveActiveNextActions(
  messages: ReadonlyArray<{ role: string; nextActions?: ChatNextAction[] }>,
  messageIndex: number
): ChatNextAction[] | undefined {
  const actions = messages[messageIndex]?.nextActions;
  if (!actions?.length) return undefined;

  for (let i = messageIndex + 1; i < messages.length; i++) {
    if (messages[i].role === 'user') return undefined;
  }
  return actions;
}

/**
 * Payload the user chose for a historical `strategy_select` turn (if any).
 * Matches `__strategy:*` content or hydrated label against action payloads.
 */
export function resolveStrategySelectReply(
  messages: ReadonlyArray<{
    role: string;
    content: string;
    nextActions?: ChatNextAction[];
  }>,
  messageIndex: number,
  locale: string
): string | null {
  const actions = messages[messageIndex]?.nextActions;
  if (!actions?.length || !actions.every(isStrategySelectAction)) return null;

  for (let i = messageIndex + 1; i < messages.length; i++) {
    const message = messages[i];
    if (message.role === 'assistant') break;
    if (message.role !== 'user') continue;

    const content = message.content.trim();
    const byPayload = actions.find(
      (action) => action.payload?.trim() === content
    );
    if (byPayload?.payload) return byPayload.payload.trim();

    const byLabel = actions.find(
      (action) => resolveActionLabel(action, locale) === content
    );
    if (byLabel?.payload) return byLabel.payload.trim();

    return null;
  }
  return null;
}

/** @deprecated Use {@link resolveActiveNextActions}. */
export function resolveActiveStrategySelectActions(
  messages: ReadonlyArray<{ role: string; nextActions?: ChatNextAction[] }>,
  messageIndex: number
): ChatNextAction[] | undefined {
  return resolveActiveNextActions(messages, messageIndex);
}

/**
 * Map persisted `__strategy:*` user rows back to the human label from the
 * preceding assistant `next_actions` (P2-5 history refresh).
 */
export function hydrateStrategyPayloadUserLabels<
  T extends { role: string; content: string; nextActions?: ChatNextAction[] },
>(messages: T[], locale: string): T[] {
  return messages.map((message, index) => {
    if (message.role !== 'user' || !isStrategyPayloadContent(message.content)) {
      return message;
    }

    const payload = message.content.trim();
    for (let i = index - 1; i >= 0; i--) {
      const prior = messages[i];
      if (!prior || prior.role !== 'assistant') continue;
      const match = prior.nextActions?.find(
        (action) => action.payload?.trim() === payload
      );
      if (match) {
        return { ...message, content: resolveActionLabel(match, locale) };
      }
      break;
    }
    return message;
  });
}

export function resolveStrategySelectSubmit(
  action: ChatNextAction,
  locale: string
): { payload: string; display: string } | null {
  if (!isStrategySelectAction(action)) return null;
  const payload = action.payload?.trim();
  if (!payload) return null;
  return {
    payload,
    display: resolveActionLabel(action, locale),
  };
}
