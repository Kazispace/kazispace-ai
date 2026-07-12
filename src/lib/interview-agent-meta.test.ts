import { describe, expect, it } from 'vitest';

import {
  mapPipelineToInterviewPhase,
  parseMockInterviewPatch,
  resolveAgentChatMeta,
} from '@/lib/interview-agent-meta';
import type { AgentChatResponse } from '@/types';

describe('interview-agent-meta', () => {
  it('parses mock_interview patch from agent_session_patch', () => {
    const patch = parseMockInterviewPatch({
      agent_session_patch: {
        mock_interview: {
          interview_session_id: 'int_sess_1',
          pipeline_state: 'answering',
          target_role: 'PM',
        },
      },
    });
    expect(patch.interviewSessionId).toBe('int_sess_1');
    expect(patch.pipelineState).toBe('answering');
    expect(patch.targetRole).toBe('PM');
  });

  it('maps pipeline states to hub phases', () => {
    expect(mapPipelineToInterviewPhase('role_intake')).toBe('role_select');
    expect(mapPipelineToInterviewPhase('answering')).toBe('interview');
    expect(mapPipelineToInterviewPhase('feedback_pending')).toBe('feedback_pending');
    expect(mapPipelineToInterviewPhase('completed', { feedbackStatus: 'ready' })).toBe(
      'feedback_ready'
    );
  });

  it('resolveAgentChatMeta reads response.meta', () => {
    const data: AgentChatResponse = {
      response: {
        text: 'Q1',
        meta: {
          pipeline_state: 'answering',
          agent_session_patch: {
            mock_interview: { interview_session_id: 'int_2' },
          },
        },
      },
    };
    const meta = resolveAgentChatMeta(data);
    expect(meta.pipelineState).toBe('answering');
    expect(meta.interviewSessionId).toBe('int_2');
  });
});
