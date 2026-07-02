import type {
  ActivateAgentResponse,
  ActiveAgentState,
  AgentChatResponse,
  AgentMessagesResponse,
  ApiResponse,
  ChatMessage,
  ChatJobCard,
  ChatNextAction,
  DeactivateAgentResponse,
} from '@/types';
import { parseAssistantEnvelope } from '@/lib/chat-envelope';
import {
  AGENT_REGISTRY,
  getAgentLabel,
} from '@/lib/agents/registry';
import { CV_BUILDER_AGENT_ID } from '@/lib/cv-agent-config';
import { apiRequest } from '@/lib/api-client';

const mockSessions = new Map<string, ActiveAgentState>();

function useMockFallback(error?: string): boolean {
  if (process.env.NEXT_PUBLIC_AGENT_API_MOCK === 'true') return true;
  if (!error) return false;
  return error.includes('404') || error.includes('Not Found');
}

function getMockActive(): ActiveAgentState {
  const states = Array.from(mockSessions.values());
  for (let i = 0; i < states.length; i++) {
    const state = states[i];
    if (state.active_agent) return state;
  }
  return { active_agent: null, session_id: null };
}

function mockActivate(
  agentId: string,
  locale: string,
  triggerMessage?: string
): ActivateAgentResponse {
  const entry = AGENT_REGISTRY.find((a) => a.agentId === agentId);
  const name = entry ? getAgentLabel(entry, locale, 'name') : agentId;
  const hint = entry ? getAgentLabel(entry, locale, 'promptHint') : '';
  const greeting = triggerMessage
    ? `${name}: "${triggerMessage}" — ${hint}`
    : `${name} — ${hint}`;

  const sessionId = `mock_agent_${agentId}_${Date.now()}`;
  mockSessions.set(sessionId, {
    active_agent: agentId,
    session_id: sessionId,
    activated_at: new Date().toISOString(),
    context_module: agentId,
  });

  if (agentId === CV_BUILDER_AGENT_ID) {
    return {
      agent_id: agentId,
      session_id: sessionId,
      greeting,
      response: {
        next_actions: [
          { type: 'developer', label: 'Software Engineer' },
          { type: 'manager', label: 'Product Manager' },
        ],
      },
    };
  }

  return { agent_id: agentId, session_id: sessionId, greeting };
}

function mockDeactivate(agentId: string, locale: string): DeactivateAgentResponse {
  mockSessions.forEach((state, key) => {
    if (state.active_agent === agentId) {
      mockSessions.delete(key);
    }
  });
  const entry = AGENT_REGISTRY.find((a) => a.agentId === agentId);
  const name = entry ? getAgentLabel(entry, locale, 'name') : agentId;
  return {
    deactivated_agent: agentId,
    return_message:
      locale === 'ru'
        ? `С возвращением в клинику! Сессия с ${name} завершена.`
        : `Welcome back to the clinic! Your session with ${name} is complete.`,
  };
}

export function clearMockAgentSessions(): void {
  mockSessions.clear();
}

export async function getActiveAgent(): Promise<ApiResponse<ActiveAgentState>> {
  const res = await apiRequest<ActiveAgentState>('/api/v1/agents/active');
  if (res.success) return res;
  if (useMockFallback(res.error)) {
    return { success: true, data: getMockActive() };
  }
  return res;
}

export async function activateAgent(
  agentId: string,
  locale: string,
  handoffMessage?: string,
  options?: { job_id?: string }
): Promise<ApiResponse<ActivateAgentResponse>> {
  const body: Record<string, string> = {};
  if (handoffMessage) body.handoff_message = handoffMessage;
  if (options?.job_id) body.job_id = options.job_id;

  const res = await apiRequest<ActivateAgentResponse>(
    `/api/v1/agents/${agentId}/activate`,
    {
      method: 'POST',
      body: JSON.stringify(body),
    }
  );
  if (res.success) return res;
  if (useMockFallback(res.error)) {
    return { success: true, data: mockActivate(agentId, locale, handoffMessage) };
  }
  return res;
}

export async function deactivateAgent(
  agentId: string,
  locale: string
): Promise<ApiResponse<DeactivateAgentResponse>> {
  const res = await apiRequest<DeactivateAgentResponse>(
    `/api/v1/agents/${agentId}/deactivate`,
    { method: 'POST', body: '{}' }
  );
  if (res.success) return res;
  if (useMockFallback(res.error)) {
    return { success: true, data: mockDeactivate(agentId, locale) };
  }
  return res;
}

export async function sendAgentChat(
  agentId: string,
  message: string,
  sessionId?: string
): Promise<ApiResponse<AgentChatResponse>> {
  const res = await apiRequest<AgentChatResponse>('/api/v1/agents/chat', {
    method: 'POST',
    body: JSON.stringify({
      agent_id: agentId,
      message,
      ...(sessionId ? { session_id: sessionId } : {}),
    }),
  });
  if (res.success) return res;
  if (useMockFallback(res.error)) {
    const entry = AGENT_REGISTRY.find((a) => a.agentId === agentId);
    const emoji = entry?.emoji ?? '🤖';
    if (agentId === CV_BUILDER_AGENT_ID) {
      const isRegenerate =
        message === '__action:regenerate' || message.toLowerCase() === 'regenerate';
      const meta =
        message === 'confirm' || isRegenerate
          ? {
              cv_preview_markdown:
                '# Alex Developer\n\n## Experience\n- Senior Engineer at Tech Co (2020–present)\n- Built scalable web apps with React & Python',
            }
          : {
              cv_preview_markdown:
                '# Alex Developer\n\n## Summary\nFull-stack engineer with 5+ years of experience.\n\n## Skills\nReact, TypeScript, Python',
              buttons: ['Looks good', 'Add more detail'],
            };
      return {
        success: true,
        data: {
          agent_id: agentId,
          message_id: `mock_${Date.now()}`,
          response: {
            text: `${emoji} (Mock) ${message === 'confirm' ? 'CV saved.' : 'Updated your CV preview.'}`,
          },
          meta,
        },
      };
    }
    return {
      success: true,
      data: {
        agent_id: agentId,
        message_id: `mock_${Date.now()}`,
        response: {
          text: `${emoji} (Mock) Received: "${message}"`,
        },
      },
    };
  }
  return res;
}

export async function fetchAgentMessages(
  sessionId: string
): Promise<ApiResponse<AgentMessagesResponse>> {
  const res = await apiRequest<AgentMessagesResponse>(
    `/api/v1/agents/sessions/${sessionId}/messages`
  );
  if (res.success) return res;
  if (useMockFallback(res.error)) {
    return {
      success: true,
      data: { session_id: sessionId, agent_id: '', messages: [] },
    };
  }
  return res;
}

export function parseAgentReply(data: AgentChatResponse | undefined): {
  reply: string;
  nextActions: ChatNextAction[];
  cards: ChatJobCard[];
} {
  if (!data) return { reply: '', nextActions: [], cards: [] };
  const envelope = parseAssistantEnvelope(data);
  return {
    reply: envelope.reply,
    nextActions: envelope.nextActions,
    cards: envelope.cards,
  };
}
