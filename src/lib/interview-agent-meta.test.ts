import { describe, expect, it } from 'vitest';

import {
  extractQuestionProgress,
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

  it('parses camelCase agentSessionPatch / mockInterview', () => {
    const patch = parseMockInterviewPatch({
      agentSessionPatch: {
        mockInterview: {
          interviewSessionId: 'int_camel',
          pipelineState: 'feedback_pending',
          targetRole: 'Engineer',
          escalationTarget: 'cv_builder',
        },
      },
    });
    expect(patch.interviewSessionId).toBe('int_camel');
    expect(patch.pipelineState).toBe('feedback_pending');
    expect(patch.targetRole).toBe('Engineer');
    expect(patch.escalationTarget).toBe('cv_builder');
  });

  it('maps pipeline states to hub phases', () => {
    expect(mapPipelineToInterviewPhase('role_intake')).toBe('role_select');
    expect(mapPipelineToInterviewPhase('answering')).toBe('interview');
    expect(mapPipelineToInterviewPhase('feedback_pending')).toBe('feedback_pending');
    expect(mapPipelineToInterviewPhase('completed')).toBe('feedback_pending');
    expect(mapPipelineToInterviewPhase('completed', { feedbackStatus: 'ready' })).toBe(
      'feedback_ready'
    );
    expect(mapPipelineToInterviewPhase(undefined)).toBeNull();
    expect(mapPipelineToInterviewPhase('')).toBeNull();
    expect(mapPipelineToInterviewPhase('unknown_state')).toBeNull();
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

  it('resolveAgentChatMeta reads top-level data.meta', () => {
    const data: AgentChatResponse = {
      meta: {
        pipeline_state: 'role_intake',
        agent_session_patch: {
          mock_interview: { interview_session_id: 'int_top' },
        },
      },
    };
    const meta = resolveAgentChatMeta(data);
    expect(meta.pipelineState).toBe('role_intake');
    expect(meta.interviewSessionId).toBe('int_top');
  });

  it('extractQuestionProgress reads response.meta.mock_interview', () => {
    const data: AgentChatResponse = {
      response: {
        meta: {
          mock_interview: { question_index: 2, question_count: 5 },
        },
      },
    };
    expect(extractQuestionProgress(data)).toEqual({
      questionIndex: 2,
      questionCount: 5,
    });
  });

  it('extractQuestionProgress falls back to meta root fields', () => {
    const data: AgentChatResponse = {
      response: {
        meta: { question_index: 1, question_count: 3 },
      },
    };
    expect(extractQuestionProgress(data)).toEqual({
      questionIndex: 1,
      questionCount: 3,
    });
  });
});
