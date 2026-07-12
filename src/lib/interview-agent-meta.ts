import type { AgentChatResponse } from '@/types';

export type InterviewHubPhase =
  | 'role_select'
  | 'prep_review'
  | 'interview'
  | 'feedback_pending'
  | 'feedback_ready'
  | 'feedback_failed';

export type MockInterviewPatch = {
  interviewSessionId?: string;
  pipelineState?: string;
  targetRole?: string;
  escalationTarget?: string;
};

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

/** Read nested mock_interview fields from L4 agent_session_patch. */
export function parseMockInterviewPatch(meta: unknown): MockInterviewPatch {
  const root = asRecord(meta);
  if (!root) return {};

  const patch =
    asRecord(root.agent_session_patch) ??
    asRecord(root.agentSessionPatch) ??
    root;
  const nested =
    asRecord(patch.mock_interview) ??
    asRecord(patch.mockInterview) ??
    patch;

  const interviewSessionId =
    typeof nested.interview_session_id === 'string'
      ? nested.interview_session_id
      : typeof nested.interviewSessionId === 'string'
        ? nested.interviewSessionId
        : undefined;

  const pipelineState =
    typeof nested.pipeline_state === 'string'
      ? nested.pipeline_state
      : typeof nested.pipelineState === 'string'
        ? nested.pipelineState
        : typeof root.pipeline_state === 'string'
          ? root.pipeline_state
          : undefined;

  const targetRole =
    typeof nested.target_role === 'string'
      ? nested.target_role
      : typeof nested.targetRole === 'string'
        ? nested.targetRole
        : undefined;

  const escalationTarget =
    typeof nested.escalation_target === 'string'
      ? nested.escalation_target
      : typeof nested.escalationTarget === 'string'
        ? nested.escalationTarget
        : undefined;

  return { interviewSessionId, pipelineState, targetRole, escalationTarget };
}

export function resolveAgentChatMeta(data: AgentChatResponse | undefined): MockInterviewPatch {
  if (!data) return {};
  const meta = data.response?.meta ?? data.meta;
  const fromPatch = parseMockInterviewPatch(meta);
  const pipelineState =
    fromPatch.pipelineState ??
    (typeof data.response?.meta?.pipeline_state === 'string'
      ? data.response.meta.pipeline_state
      : undefined);
  return { ...fromPatch, pipelineState };
}

/** Map L4 pipeline_state (+ legacy REST statuses) to Hub UI phase. */
export function mapPipelineToInterviewPhase(
  pipelineState: string | undefined,
  opts?: { feedbackStatus?: string | null }
): InterviewHubPhase | null {
  const ps = (pipelineState ?? '').toLowerCase();
  if (ps === 'role_intake' || ps === 'entered' || ps === 'prep_card') {
    return 'role_select';
  }
  if (ps === 'answering' || ps === 'in_progress') {
    return 'interview';
  }
  if (ps === 'feedback_ready' || opts?.feedbackStatus === 'ready') {
    return 'feedback_ready';
  }
  if (ps === 'feedback_failed' || opts?.feedbackStatus === 'failed') {
    return 'feedback_failed';
  }
  if (ps === 'feedback_pending' || ps === 'completed') {
    return 'feedback_pending';
  }
  return null;
}

export function extractQuestionProgress(data: AgentChatResponse | undefined): {
  questionIndex?: number;
  questionCount?: number;
} {
  const workflow = data?.response?.meta;
  const wf = asRecord((data as Record<string, unknown> | undefined)?.response)?.workflow;
  const workflowMeta = asRecord(wf) ?? asRecord(workflow);
  const questionIndex =
    typeof workflowMeta?.question_index === 'number'
      ? workflowMeta.question_index
      : undefined;
  const questionCount =
    typeof workflowMeta?.question_count === 'number'
      ? workflowMeta.question_count
      : undefined;
  return { questionIndex, questionCount };
}
