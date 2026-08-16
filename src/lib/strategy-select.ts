import { resolveActionLabel } from '@/lib/chat-envelope';
import {
  isTransportPayload,
  isStrategyPayloadContent,
  strategyIdFromPayload,
} from '@/lib/action-payload';
import { resolveActionSelectSubmit } from '@/lib/next-action-submit';
import type { ChatNextAction } from '@/types/chat-envelope';

export const STRATEGY_SELECT_ACTION_TYPE = 'strategy_select';
export {
  STRATEGY_PAYLOAD_PREFIX,
  strategyIdFromPayload,
  isStrategyPayloadContent,
  isTransportPayload,
} from '@/lib/action-payload';

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

export function hasStrategySelectActions(
  actions?: ChatNextAction[]
): boolean {
  return Boolean(actions?.some(isStrategySelectAction));
}

export function actionSelectFallbackLabel(locale: string): string {
  switch (locale) {
    case 'zh':
      return '已选择';
    case 'ru':
      return 'Выбрано';
    case 'kk':
      return 'Таңдалды';
    default:
      return 'Selected';
  }
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

/** Normalize user/label text for loose strategy_select reply matching. */
export function normalizeStrategyMatchText(text: string): string {
  return text
    .trim()
    .replace(/[\s\u3000]+/g, ' ')
    .replace(/[.。!！?？,，;；:：'"''""]+$/, '');
}

function findFirstUserReplyAfter<T extends { role: string }>(
  messages: ReadonlyArray<T>,
  messageIndex: number
): T | null {
  for (let i = messageIndex + 1; i < messages.length; i++) {
    const message = messages[i];
    if (message?.role === 'assistant') return null;
    if (message?.role === 'user') return message;
  }
  return null;
}

function matchStrategySelectActionByUserContent(
  actions: ChatNextAction[],
  content: string,
  locale: string
): ChatNextAction | undefined {
  const trimmed = content.trim();
  if (!trimmed) return undefined;

  const byPayload = actions.find(
    (action) => action.payload?.trim() === trimmed
  );
  if (byPayload) return byPayload;

  if (isStrategyPayloadContent(trimmed)) {
    const strategyId = strategyIdFromPayload(trimmed);
    if (strategyId) {
      const byId = actions.find(
        (action) => strategyIdFromPayload(action.payload?.trim() ?? '') === strategyId
      );
      if (byId) return byId;
    }
  }

  const normalized = normalizeStrategyMatchText(trimmed);
  return actions.find((action) => {
    const label = normalizeStrategyMatchText(resolveActionLabel(action, locale));
    return label.length > 0 && label === normalized;
  });
}

/**
 * Payload the user chose for a historical `strategy_select` turn (if any).
 * Inspects only the first user reply below the assistant turn.
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

  const reply = findFirstUserReplyAfter(messages, messageIndex);
  if (!reply || !('content' in reply)) return null;

  const match = matchStrategySelectActionByUserContent(
    actions,
    reply.content,
    locale
  );
  return match?.payload?.trim() ?? null;
}

export type StrategySelectTurnContext = {
  activeNextActions?: ChatNextAction[];
  selectedStrategyPayload?: string;
};

/** Active vs historical strategy_select state for a rendered assistant turn. */
export function resolveStrategySelectTurnContext(
  messages: ReadonlyArray<{
    role: string;
    content: string;
    nextActions?: ChatNextAction[];
  }>,
  messageIndex: number,
  locale: string
): StrategySelectTurnContext {
  const activeNextActions = resolveActiveNextActions(messages, messageIndex);
  const selectedStrategyPayload = activeNextActions
    ? undefined
    : resolveStrategySelectReply(messages, messageIndex, locale) ?? undefined;
  return { activeNextActions, selectedStrategyPayload };
}

/**
 * KAZI-564: precompute strategy context once per list render.
 * Do not call resolveStrategySelectTurnContext inside each row map.
 */
export function mapStrategySelectTurnContexts(
  messages: ReadonlyArray<{
    role: string;
    content: string;
    nextActions?: ChatNextAction[];
  }>,
  locale: string
): StrategySelectTurnContext[] {
  return messages.map((_, index) =>
    resolveStrategySelectTurnContext(messages, index, locale)
  );
}

/**
 * Map persisted `__strategy:*` user rows back to the human label from the
 * preceding assistant `next_actions` (P2-5 history refresh).
 */
export function hydrateStrategyPayloadUserLabels<
  T extends { role: string; content: string; nextActions?: ChatNextAction[] },
>(messages: T[], locale: string): T[] {
  const fallback = actionSelectFallbackLabel(locale);
  return messages.map((message, index) => {
    if (message.role !== 'user' || !isTransportPayload(message.content)) {
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
    return { ...message, content: fallback };
  });
}

export function resolveStrategySelectSubmit(
  action: ChatNextAction,
  locale: string
): { payload: string; display: string } | null {
  const submit = resolveActionSelectSubmit(action, locale);
  if (!submit) return null;
  return {
    payload: submit.meta.action_payload,
    display: submit.display,
  };
}
