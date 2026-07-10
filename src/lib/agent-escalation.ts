import { activateAgent } from '@/lib/agent-api';
import { publishActiveAgentSync } from '@/lib/active-agent-sync';
import { isCvBuilderAgent } from '@/lib/cv-agent-config';
import { setCvAgentHandoff } from '@/lib/cv-agent-handoff';
import { AGENT_REGISTRY } from '@/lib/agents/registry';
import { useAgentStore } from '@/lib/store';
import type { AgentChatResponse } from '@/types';

export type AgentEscalation = {
  exitedAgent?: string;
  exitReason?: string;
  targetAgentId: string;
  suggestedNextSteps: string[];
};

export function parseAgentEscalation(
  data: AgentChatResponse | undefined
): AgentEscalation | null {
  if (!data) return null;
  const raw = data as AgentChatResponse & {
    exited?: boolean;
    exited_agent?: string;
    exit_reason?: string;
    suggested_next_steps?: string[];
  };

  if (!raw.exited) return null;
  const steps = raw.suggested_next_steps;
  if (!Array.isArray(steps) || steps.length === 0) return null;

  const targetAgentId = steps.find(
    (step): step is string => typeof step === 'string' && step.length > 0
  );
  if (!targetAgentId) return null;

  const known = AGENT_REGISTRY.some((a) => a.agentId === targetAgentId);
  if (!known) return null;

  return {
    exitedAgent: raw.exited_agent ?? raw.agent_id ?? undefined,
    exitReason: raw.exit_reason,
    targetAgentId,
    suggestedNextSteps: steps,
  };
}

/** Activate hub agent session only — navigation is SSOT in planNavigation. */
export async function activateHubAgentSession(
  targetAgentId: string,
  locale: string
): Promise<{ ok: boolean; error?: string; errorCode?: string }> {
  const res = await activateAgent(targetAgentId, locale);
  if (!res.success || !res.data) {
    return { ok: false, error: res.error, errorCode: res.errorCode };
  }

  if (isCvBuilderAgent(targetAgentId)) {
    setCvAgentHandoff({
      sessionId: res.data.session_id,
      greeting: res.data.greeting,
    });
  }

  publishActiveAgentSync({
    type: 'activated',
    agentId: targetAgentId,
    sessionId: res.data.session_id,
  });
  return { ok: true };
}

export type FollowEscalationDeps = {
  /** Path A — skips confirm dialog, not activate or 4xx handling. */
  activateAgentWithoutPrecheck: (
    agentId: string
  ) => Promise<{ ok: boolean; error?: string } | undefined>;
};

/**
 * Path A (KAZI-121): after NL escalation exit, auto-activate via unified Execute.
 */
export async function followAgentEscalation(
  escalation: AgentEscalation,
  deps: FollowEscalationDeps
): Promise<{ ok: boolean; error?: string }> {
  const { targetAgentId, exitedAgent } = escalation;
  const { activateAgentWithoutPrecheck } = deps;

  const current = useAgentStore.getState().activeAgentId;
  if (!current || current === exitedAgent) {
    useAgentStore.getState().setActiveAgent(null, null);
  }

  const result = await activateAgentWithoutPrecheck(targetAgentId);
  if (!result?.ok) {
    return { ok: false, error: result?.error };
  }
  return { ok: true };
}
