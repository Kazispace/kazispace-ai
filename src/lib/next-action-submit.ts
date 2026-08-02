import { resolveActionLabel } from '@/lib/chat-envelope';
import {
  isTransportPayload,
  strategyIdFromPayload,
  taskIdFromPayload,
} from '@/lib/action-payload';
import type { ChatNextAction, UserMessageActionMeta } from '@/types/chat-envelope';

export const ACTION_SELECT_TYPES = new Set([
  'strategy_select',
  'task_select',
  'select_role',
]);

export interface ActionSelectSubmit {
  display: string;
  meta: UserMessageActionMeta;
}

export function isActionSelectType(type: string): boolean {
  return ACTION_SELECT_TYPES.has(type);
}

/** Build display + meta for payload-based next_action clicks (KAZI-469). */
export function resolveActionSelectSubmit(
  action: ChatNextAction,
  locale: string
): ActionSelectSubmit | null {
  const payload = action.payload?.trim();
  if (!payload) return null;
  if (!isActionSelectType(action.type) && !isTransportPayload(payload)) {
    return null;
  }

  const meta: UserMessageActionMeta = {
    action_type: action.type,
    action_payload: payload,
  };

  const strategyId = strategyIdFromPayload(payload);
  if (strategyId) meta.strategy_id = strategyId;

  const taskId = taskIdFromPayload(payload);
  if (taskId) meta.task_id = taskId;

  return {
    display: resolveActionLabel(action, locale),
    meta,
  };
}
