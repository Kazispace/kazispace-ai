import { activateAgent } from '@/lib/agent-api';
import { publishActiveAgentSync } from '@/lib/active-agent-sync';
import { isCvBuilderAgent } from '@/lib/cv-agent-config';
import { setCvAgentHandoff } from '@/lib/cv-agent-handoff';
import { isEnglishTutorAgent } from '@/lib/english-tutor-config';
import { isMockInterviewAgent } from '@/lib/mock-interview-config';
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

export type FollowEscalationDeps = {
  locale: string;
  switchToAgent: (
    agentId: string
  ) => Promise<{ ok: boolean; error?: string } | undefined>;
  routeCvBuilderPage: () => void;
  routeInterviewPage: () => void;
  routeEnglishPage: () => void;
};

/**
 * Path A (KAZI-121): after NL escalation exit, auto-activate the suggested expert.
 * Does not flash clinic history — uses agent switch overlay or hub navigation.
 */
export async function followAgentEscalation(
  escalation: AgentEscalation,
  deps: FollowEscalationDeps
): Promise<{ ok: boolean; error?: string }> {
  const { targetAgentId, exitedAgent } = escalation;
  const { locale, switchToAgent, routeCvBuilderPage, routeInterviewPage, routeEnglishPage } =
    deps;

  const current = useAgentStore.getState().activeAgentId;
  if (!current || current === exitedAgent) {
    useAgentStore.getState().setActiveAgent(null, null);
  }

  if (isCvBuilderAgent(targetAgentId)) {
    const res = await activateAgent(targetAgentId, locale);
    if (!res.success || !res.data) {
      return { ok: false, error: res.error };
    }
    setCvAgentHandoff({
      sessionId: res.data.session_id,
      greeting: res.data.greeting,
    });
    publishActiveAgentSync({
      type: 'activated',
      agentId: targetAgentId,
      sessionId: res.data.session_id,
    });
    routeCvBuilderPage();
    return { ok: true };
  }

  if (isMockInterviewAgent(targetAgentId)) {
    const res = await activateAgent(targetAgentId, locale);
    if (!res.success || !res.data) {
      return { ok: false, error: res.error };
    }
    publishActiveAgentSync({
      type: 'activated',
      agentId: targetAgentId,
      sessionId: res.data.session_id,
    });
    routeInterviewPage();
    return { ok: true };
  }

  if (isEnglishTutorAgent(targetAgentId)) {
    const res = await activateAgent(targetAgentId, locale);
    if (!res.success || !res.data) {
      return { ok: false, error: res.error };
    }
    publishActiveAgentSync({
      type: 'activated',
      agentId: targetAgentId,
      sessionId: res.data.session_id,
    });
    routeEnglishPage();
    return { ok: true };
  }

  const result = await switchToAgent(targetAgentId);
  if (!result?.ok) {
    return { ok: false, error: result?.error };
  }
  return { ok: true };
}
