import { resolveActionLabel } from '@/lib/chat-envelope';
import type { ChatNextAction } from '@/types/chat-envelope';

export const STRATEGY_SELECT_ACTION_TYPE = 'strategy_select';
export const STRATEGY_PAYLOAD_PREFIX = '__strategy:';

export function isStrategySelectAction(action: ChatNextAction): boolean {
  return action.type === STRATEGY_SELECT_ACTION_TYPE;
}

/** True when every action is a CV agentic strategy candidate (KAZI-400 §6.1). */
export function isStrategySelectActions(
  actions: ChatNextAction[] | undefined
): boolean {
  return Boolean(actions?.length && actions.every(isStrategySelectAction));
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

/** Hide strategy_select once the user has replied below this assistant turn. */
export function resolveActiveStrategySelectActions(
  messages: ReadonlyArray<{ role: string; nextActions?: ChatNextAction[] }>,
  messageIndex: number
): ChatNextAction[] | undefined {
  const actions = messages[messageIndex]?.nextActions;
  if (!actions?.length) return undefined;
  if (!isStrategySelectActions(actions)) return actions;

  for (let i = messageIndex + 1; i < messages.length; i++) {
    if (messages[i].role === 'user') return undefined;
  }
  return actions;
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
