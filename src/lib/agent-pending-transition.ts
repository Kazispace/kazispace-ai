import type { AgentChatResponse } from '@/types';

export type PendingTransition = {
  kind: 'switch';
  fromAgentId: string;
  toAgentId: string;
  prompt?: string;
  triggerMessageId?: string;
};

export type PendingAgentSwitchRequest = {
  fromAgentId: string;
  toAgentId: string;
  triggerMessage?: string;
};

/** Path C: parse Gateway `pending_transition` from agent chat response. */
export function parsePendingTransition(
  data: AgentChatResponse
): PendingTransition | null {
  const raw = (data as AgentChatResponse & { pending_transition?: Record<string, unknown> })
    .pending_transition;
  if (!raw || raw.kind !== 'switch') return null;

  const fromAgentId = String(raw.from_agent_id ?? data.agent_id ?? '');
  const toAgentId = String(raw.to_agent_id ?? '');
  if (!fromAgentId || !toAgentId || fromAgentId === toAgentId) return null;

  return {
    kind: 'switch',
    fromAgentId,
    toAgentId,
    prompt: typeof raw.prompt === 'string' ? raw.prompt : undefined,
    triggerMessageId:
      typeof raw.trigger_message_id === 'string' ? raw.trigger_message_id : undefined,
  };
}

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
