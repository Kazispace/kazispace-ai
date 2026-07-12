import { openAgentSession } from '@/lib/agent-api';
import { publishActiveAgentSync } from '@/lib/active-agent-sync';
import { isCvBuilderAgent } from '@/lib/cv-agent-config';
import { setCvAgentHandoff } from '@/lib/cv-agent-handoff';
import { useAgentStore } from '@/lib/store';
import type { OpenAgentSessionOptions } from '@/types';

export type OpenHubAgentSessionResult =
  | {
      ok: true;
      sessionId: string;
      resumed: boolean;
      greeting: string;
    }
  | { ok: false; error?: string; errorCode?: string };

/**
 * Hub entry/resume via L4 `POST …/sessions/open` (ADR-005 MA-07).
 * Updates per-agent store slice; navigation remains URL-driven.
 */
export async function openHubAgentSession(
  agentId: string,
  locale: string,
  options?: OpenAgentSessionOptions
): Promise<OpenHubAgentSessionResult> {
  const res = await openAgentSession(agentId, locale, options);
  if (!res.success || !res.data) {
    return { ok: false, error: res.error, errorCode: res.errorCode };
  }

  const { session_id, greeting, resumed } = res.data;
  useAgentStore.getState().setAgentSession(agentId, session_id);

  if (isCvBuilderAgent(agentId)) {
    setCvAgentHandoff({ sessionId: session_id, greeting });
  }

  publishActiveAgentSync({
    type: 'activated',
    agentId,
    sessionId: session_id,
  });

  return {
    ok: true,
    sessionId: session_id,
    resumed: Boolean(resumed),
    greeting,
  };
}
