import type { AgentChatResponse } from '@/types';

export type PendingTransition = {
  kind: 'switch';
  fromAgentId: string;
  toAgentId: string;
  triggerMessageId?: string;
};

export type PendingAgentSwitchRequest = {
  fromAgentId: string;
  toAgentId: string;
  /** User text from the send that triggered Path C — not resolved from `trigger_message_id`. */
  triggerMessage?: string;
};

/** Path C: parse Gateway `pending_transition` from agent chat response. */
export function parsePendingTransition(
  data: AgentChatResponse
): PendingTransition | null {
  const raw = data.pending_transition;
  if (!raw || raw.kind !== 'switch') return null;

  const fromAgentId = String(raw.from_agent_id ?? data.agent_id ?? '');
  const toAgentId = String(raw.to_agent_id ?? '');
  if (!fromAgentId || !toAgentId || fromAgentId === toAgentId) return null;

  const confirmTarget = raw.confirm_action?.activate_agent;
  if (confirmTarget && confirmTarget !== toAgentId) {
    console.warn(
      '[Path C] confirm_action.activate_agent does not match to_agent_id',
      { confirmTarget, toAgentId }
    );
  }

  return {
    kind: 'switch',
    fromAgentId,
    toAgentId,
    triggerMessageId:
      typeof raw.trigger_message_id === 'string' ? raw.trigger_message_id : undefined,
  };
}

/**
 * Map parsed Path C envelope to store shape.
 * `triggerMessage` is always the just-sent user text (sync Path C); it is not
 * looked up from backend `trigger_message_id`.
 */
export function toPendingAgentSwitch(
  pending: PendingTransition,
  triggerMessage?: string
): PendingAgentSwitchRequest {
  return {
    fromAgentId: pending.fromAgentId,
    toAgentId: pending.toAgentId,
    triggerMessage,
  };
}
