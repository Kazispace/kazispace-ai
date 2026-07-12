import type {
  ActivateAgentResponse,
  ActiveAgentState,
  AgentChatResponse,
  AgentMessagesResponse,
  AgentSessionsListResponse,
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
import { ENGLISH_TUTOR_AGENT_ID } from '@/lib/english-tutor-config';
import { MOCK_INTERVIEW_AGENT_ID } from '@/lib/mock-interview-config';
import { apiRequest } from '@/lib/api-client';
import { getAuthToken } from '@/lib/auth';
import { ensureMasterSession } from '@/lib/master-session';
import { publishSessionNavInvalidate } from '@/lib/session-nav-invalidate';

const mockSessions = new Map<string, ActiveAgentState>();

type MockCvBuilderState = {
  jobId?: string;
};

const mockCvBuilderBySession = new Map<string, MockCvBuilderState>();

function mockCvBuilderDiff(variant: 'job' | 'regen' = 'job') {
  if (variant === 'regen') {
    return {
      added: ['Optimized keywords for ATS matching'],
      removed: ['Outdated toolchain references'],
      modified: [
        {
          path: 'Experience',
          before: 'Built scalable web apps',
          after: 'Delivered high-traffic React/Python services with measurable latency gains',
        },
      ],
    };
  }
  return {
    added: ['Tailored summary for target role'],
    removed: [],
    modified: [
      {
        path: 'Summary',
        before: 'Full-stack engineer with 5+ years of experience',
        after: 'Senior full-stack engineer aligned with the target job requirements',
      },
    ],
  };
}

const MOCK_CV_PREVIEW_SAVED =
  '# Alex Developer\n\n## Experience\n- Senior Engineer at Tech Co (2020–present)\n- Built scalable web apps with React & Python';

function useMockFallback(error?: string): boolean {
  if (process.env.NEXT_PUBLIC_AGENT_API_MOCK === 'true') return true;
  if (!error) return false;
  return error.includes('404') || error.includes('Not Found');
}

function withSessionNavRefresh<T extends { success: boolean }>(res: T): T {
  if (res.success) publishSessionNavInvalidate();
  return res;
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
  triggerMessage?: string,
  options?: { job_id?: string }
): ActivateAgentResponse {
  const entry = AGENT_REGISTRY.find((a) => a.agentId === agentId);
  const name = entry ? getAgentLabel(entry, locale, 'name') : agentId;
  const hint = entry ? getAgentLabel(entry, locale, 'promptHint') : '';
  const greeting = triggerMessage
    ? `${name}: "${triggerMessage}" — ${hint}`
    : options?.job_id
      ? `${name} — tailoring your CV for this role. ${hint}`
      : `${name} — ${hint}`;

  const sessionId = `mock_agent_${agentId}_${Date.now()}`;
  mockSessions.set(sessionId, {
    active_agent: agentId,
    session_id: sessionId,
    activated_at: new Date().toISOString(),
    context_module: agentId,
  });

  if (agentId === CV_BUILDER_AGENT_ID) {
    mockCvBuilderBySession.set(sessionId, { jobId: options?.job_id });
    return {
      agent_id: agentId,
      session_id: sessionId,
      greeting,
      response: {
        next_actions: [
          { type: 'developer', label: 'Software Engineer' },
          { type: 'manager', label: 'Product Manager' },
        ],
        ...(options?.job_id
          ? {
              meta: {
                pipeline_state: 'collecting',
                cv_preview_markdown:
                  '# Alex Developer\n\n## Summary\nJob-tailored CV draft for your target role.',
                diff: mockCvBuilderDiff('job'),
              },
            }
          : { meta: { pipeline_state: 'intake' } }),
      },
    };
  }

  return { agent_id: agentId, session_id: sessionId, greeting };
}

function mockDeactivate(agentId: string, locale: string): DeactivateAgentResponse {
  mockSessions.forEach((state, key) => {
    if (state.active_agent === agentId) {
      mockSessions.delete(key);
      mockCvBuilderBySession.delete(key);
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
  mockCvBuilderBySession.clear();
}

export type ActivateAgentOptions = {
  job_id?: string;
  master_session_id?: string;
  force_new_session?: boolean;
};

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
  options?: ActivateAgentOptions
): Promise<ApiResponse<ActivateAgentResponse>> {
  const masterSessionId =
    options?.master_session_id ??
    (getAuthToken() ? await ensureMasterSession() : undefined);

  const body: Record<string, string | boolean> = {};
  if (handoffMessage) body.handoff_message = handoffMessage;
  if (options?.job_id) body.job_id = options.job_id;
  if (masterSessionId) body.master_session_id = masterSessionId;
  if (options?.force_new_session) body.force_new_session = true;

  const res = await apiRequest<ActivateAgentResponse>(
    `/api/v1/agents/${agentId}/activate`,
    {
      method: 'POST',
      body: JSON.stringify(body),
    }
  );
  if (res.success) return res;

  const mockActive = getMockActive();
  const mockSimulateSwitch409 =
    process.env.NEXT_PUBLIC_AGENT_MOCK_SWITCH_409 === 'true';
  if (
    mockSimulateSwitch409 &&
    mockActive.active_agent &&
    mockActive.active_agent !== agentId &&
    useMockFallback(res.error)
  ) {
    return {
      success: false,
      error: `Return to clinic (${mockActive.active_agent}) before activating ${agentId}.`,
      errorCode: 'AGENT_SWITCH_REQUIRES_CLINIC',
    };
  }

  if (useMockFallback(res.error)) {
    return {
      success: true,
      data: {
        ...mockActivate(agentId, locale, handoffMessage, options),
        master_session_id: masterSessionId,
        resumed: false,
      },
    };
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

function mockAgentEscalationResponse(
  agentId: string,
  emoji: string,
  targetAgentId: string,
  text: string
): ApiResponse<AgentChatResponse> {
  return withSessionNavRefresh({
    success: true,
    data: {
      agent_id: agentId,
      exited: true,
      exited_agent: agentId,
      exit_reason: 'escalated',
      suggested_next_steps: [targetAgentId],
      message_id: `mock_${Date.now()}`,
      response: { text: `${emoji} ${text}` },
    },
  });
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
  if (res.success) return withSessionNavRefresh(res);
  if (useMockFallback(res.error)) {
    const entry = AGENT_REGISTRY.find((a) => a.agentId === agentId);
    const emoji = entry?.emoji ?? '🤖';

    if (agentId === 'job_search') {
      const trimmed = message.trim();
      const lower = message.toLowerCase();

      // Path C: fuzzy bare resume mention → pending_transition (not Path A auto-chain)
      if (/^简历$|^(cv|resume)$/i.test(trimmed)) {
        const responseId = `mock_resp_${Date.now()}`;
        const triggerId = `mock_trig_${Date.now() + 1}`;
        return withSessionNavRefresh({
          success: true,
          data: {
            agent_id: agentId,
            message_id: responseId,
            pending_transition: {
              kind: 'switch',
              from_agent_id: agentId,
              to_agent_id: CV_BUILDER_AGENT_ID,
              prompt: 'Leave Job Search and open CV Builder?',
              trigger_message_id: triggerId,
              confirm_action: { activate_agent: CV_BUILDER_AGENT_ID },
              cancel_action: { continue_agent: agentId },
            },
          },
        });
      }

      const wantsCv =
        /帮我.*简历|搞简历|写简历|optimiz.*resume|improve.*resume|modify.*resume|edit.*resume/.test(
          lower
        );
      const wantsInterview =
        /面试|interview|mock interview|practice interview/.test(lower);
      if (wantsCv || wantsInterview) {
        const target = wantsCv ? CV_BUILDER_AGENT_ID : MOCK_INTERVIEW_AGENT_ID;
        const targetEntry = AGENT_REGISTRY.find((a) => a.agentId === target);
        const targetName = targetEntry
          ? getAgentLabel(targetEntry, 'en', 'name')
          : target;
        return withSessionNavRefresh({
          success: true,
          data: {
            agent_id: agentId,
            exited: true,
            exited_agent: agentId,
            exit_reason: 'escalated',
            suggested_next_steps: [target],
            message_id: `mock_${Date.now()}`,
            response: {
              text: `${emoji} Returning to clinic to open ${targetName}.`,
            },
          },
        });
      }
    }

    if (agentId === CV_BUILDER_AGENT_ID) {
      const lower = message.toLowerCase();
      const wantsJobSearch =
        /推荐工作|找工作|job search|find (me )?(a )?job|recommend.*job/.test(
          lower
        );
      const wantsInterview =
        /面试|mock interview|practice interview|模拟面试/.test(lower);
      const wantsEnglish =
        /英语|english tutor|learn english|练英语|英语口语/.test(lower);

      if (wantsJobSearch) {
        return mockAgentEscalationResponse(
          agentId,
          emoji,
          'job_search',
          "Sure — let's return to clinic and open job search."
        );
      }
      if (wantsInterview) {
        return mockAgentEscalationResponse(
          agentId,
          emoji,
          MOCK_INTERVIEW_AGENT_ID,
          "Returning to clinic to open Mock Interview."
        );
      }
      if (wantsEnglish) {
        return mockAgentEscalationResponse(
          agentId,
          emoji,
          ENGLISH_TUTOR_AGENT_ID,
          "Returning to clinic to open English Tutor."
        );
      }

      const isRegenerate =
        message === '__action:regenerate' || message.toLowerCase() === 'regenerate';
      const isIntakeConfirm =
        message === '__action:confirm' || message === 'confirm';
      const isAcceptCv = message === '__action:accept_cv';
      const cvState = sessionId ? mockCvBuilderBySession.get(sessionId) : undefined;
      const hasJobContext = Boolean(cvState?.jobId);

      let meta: NonNullable<AgentChatResponse['response']>['meta'];
      let nextActions: ChatNextAction[] | undefined;
      if (isAcceptCv) {
        meta = {
          pipeline_state: 'generated',
          cv_preview_markdown: MOCK_CV_PREVIEW_SAVED,
          diff: null,
        };
      } else if (isIntakeConfirm) {
        meta = {
          pipeline_state: 'review_confirm',
          cv_preview_markdown: MOCK_CV_PREVIEW_SAVED,
          diff: hasJobContext ? mockCvBuilderDiff('job') : null,
        };
        if (hasJobContext) {
          nextActions = [
            { type: 'accept_cv', label: 'Accept CV' },
            { type: 'regenerate', label: 'Regenerate' },
          ];
        }
      } else if (isRegenerate) {
        meta = {
          pipeline_state: 'review_confirm',
          cv_preview_markdown: MOCK_CV_PREVIEW_SAVED,
          diff: mockCvBuilderDiff('regen'),
        };
        nextActions = [
          { type: 'accept_cv', label: 'Accept CV' },
          { type: 'regenerate', label: 'Regenerate' },
        ];
      } else if (hasJobContext) {
        meta = {
          pipeline_state: 'review_confirm',
          cv_preview_markdown:
            '# Alex Developer\n\n## Summary\nJob-tailored CV draft for your target role.\n\n## Skills\nReact, TypeScript, Python',
          diff: mockCvBuilderDiff('job'),
        };
        nextActions = [
          { type: 'accept_cv', label: 'Accept CV' },
          { type: 'regenerate', label: 'Regenerate' },
        ];
      } else {
        meta = {
          pipeline_state: 'collecting',
          cv_preview_markdown:
            '# Alex Developer\n\n## Summary\nFull-stack engineer with 5+ years of experience.\n\n## Skills\nReact, TypeScript, Python',
          buttons: ['Looks good', 'Add more detail'],
        };
      }

      return withSessionNavRefresh({
        success: true,
        data: {
          agent_id: agentId,
          message_id: `mock_${Date.now()}`,
          response: {
            text: `${emoji} (Mock) ${
              isAcceptCv
                ? 'CV accepted.'
                : isIntakeConfirm
                  ? 'CV draft generated.'
                  : isRegenerate
                    ? 'Regenerated job-specific edits.'
                    : 'Updated your CV preview.'
            }`,
            meta,
            ...(nextActions ? { next_actions: nextActions } : {}),
          },
        },
      });
    }
    return withSessionNavRefresh({
      success: true,
      data: {
        agent_id: agentId,
        message_id: `mock_${Date.now()}`,
        response: {
          text: `${emoji} (Mock) Received: "${message}"`,
        },
      },
    });
  }
  return res;
}

export async function fetchAgentSessions(
  agentId: string,
  limit = 20
): Promise<ApiResponse<AgentSessionsListResponse>> {
  const params = new URLSearchParams({ agent_id: agentId, limit: String(limit) });
  const res = await apiRequest<AgentSessionsListResponse>(
    `/api/v1/agents/sessions?${params}`
  );
  if (res.success) return res;
  if (useMockFallback(res.error)) {
    const active = getMockActive();
    const now = Date.now();
    const mockRows = [
      {
        session_id: active.session_id ?? `mock_sess_${now}`,
        agent_id: agentId,
        status: 'active' as const,
        pipeline_state: 'intake',
        title: 'Current session',
        updated_at: active.activated_at ?? new Date().toISOString(),
      },
      {
        session_id: `mock_sess_exited_${agentId}`,
        agent_id: agentId,
        status: 'exited' as const,
        pipeline_state: 'generated',
        title: 'Previous session (ended)',
        updated_at: new Date(now - 86400000 * 2).toISOString(),
      },
      {
        session_id: `mock_sess_archived_${agentId}`,
        agent_id: agentId,
        status: 'archived' as const,
        pipeline_state: 'generated',
        title: 'Archived session',
        updated_at: new Date(now - 86400000 * 14).toISOString(),
      },
    ];
    return { success: true, data: { sessions: mockRows } };
  }
  return res;
}

/** Cross-agent Current slots for Session Nav panel badges (P1). */
export async function fetchCurrentAgentSessions(): Promise<
  ApiResponse<AgentSessionsListResponse>
> {
  const res = await apiRequest<AgentSessionsListResponse>(
    '/api/v1/agents/sessions?status=current'
  );
  if (res.success) return res;
  if (useMockFallback(res.error)) {
    const now = Date.now();
    const seen = new Set<string>();
    const sessions: AgentSessionsListResponse['sessions'] = [];

    for (const state of Array.from(mockSessions.values())) {
      const agentId = state.active_agent;
      if (!agentId || seen.has(agentId)) continue;
      seen.add(agentId);
      const entry = AGENT_REGISTRY.find((a) => a.agentId === agentId);
      sessions.push({
        session_id: state.session_id ?? `mock_current_${agentId}`,
        agent_id: agentId,
        status: 'active',
        pipeline_state:
          agentId === CV_BUILDER_AGENT_ID ? 'collecting' : null,
        title:
          agentId === CV_BUILDER_AGENT_ID
            ? 'Software Engineer CV'
            : agentId === MOCK_INTERVIEW_AGENT_ID
              ? 'Product Manager mock'
              : agentId === ENGLISH_TUTOR_AGENT_ID
                ? 'English practice'
                : entry
                  ? getAgentLabel(entry, 'en', 'name')
                  : agentId,
        updated_at: state.activated_at ?? new Date(now).toISOString(),
      });
    }

    return { success: true, data: { sessions } };
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
  workflow?: import('@/types/chat-envelope').AssistantWorkflow;
} {
  if (!data) return { reply: '', nextActions: [], cards: [] };
  const envelope = parseAssistantEnvelope(data);
  return {
    reply: envelope.reply,
    nextActions: envelope.nextActions,
    cards: envelope.cards,
    workflow: envelope.workflow,
  };
}
