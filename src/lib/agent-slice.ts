import type { ChatMessage } from '@/types';

/** Per-agent client state (ADR-005 — multi-active sessions). */
export interface AgentSlice {
  sessionId: string | null;
  messages: ChatMessage[];
  isSending: boolean;
  isStreaming: boolean;
}

export function emptyAgentSlice(): AgentSlice {
  return {
    sessionId: null,
    messages: [],
    isSending: false,
    isStreaming: false,
  };
}

export function getAgentSliceFromRecord(
  agents: Record<string, AgentSlice>,
  agentId: string
): AgentSlice {
  return agents[agentId] ?? emptyAgentSlice();
}

export function patchAgentSlice(
  agents: Record<string, AgentSlice>,
  agentId: string,
  patch: Partial<AgentSlice>
): Record<string, AgentSlice> {
  const prev = agents[agentId] ?? emptyAgentSlice();
  return { ...agents, [agentId]: { ...prev, ...patch } };
}
