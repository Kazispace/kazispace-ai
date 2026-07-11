import { describe, expect, it } from 'vitest';

import {
  buildAssistantMessageFields,
  envelopeToEscalation,
  handleAgentEnvelope,
} from '@/lib/handle-agent-envelope';
import { parseAssistantEnvelope } from '@/lib/chat-envelope';
import { resolveWorkflowFromMessages } from '@/lib/agent-sessions';
import { buildMockInterviewWorkflow } from '@/lib/workflow-catalog';

describe('parseAssistantEnvelope workflow', () => {
  it('parses workflow from assistant_response', () => {
    const parsed = parseAssistantEnvelope({
      assistant_response: {
        content: 'Question 2',
        workflow: {
          agent_id: 'mock_interview',
          pipeline_state: 'q2',
          progress_pct: 40,
          steps: [
            { id: 'prep', label: 'Prep', status: 'done' },
            { id: 'q_group', label: 'Questions', status: 'current', detail: '2/3' },
            { id: 'feedback', label: 'Feedback', status: 'pending' },
          ],
        },
      },
    });

    expect(parsed.workflow?.agent_id).toBe('mock_interview');
    expect(parsed.workflow?.progress_pct).toBe(40);
    expect(parsed.workflow?.steps[1]?.status).toBe('current');
  });
});

describe('parseAssistantEnvelope next_actions and exit', () => {
  it('parses next_actions with extended CTA fields', () => {
    const parsed = parseAssistantEnvelope({
      assistant_response: {
        content: 'Done',
        next_actions: [
          {
            type: 'cv_builder',
            label: { en: 'Open CV Builder' },
            path: '/en/cv',
            job_id: 'job_1',
          },
        ],
      },
    });

    expect(parsed.nextActions).toHaveLength(1);
    expect(parsed.nextActions[0]?.type).toBe('cv_builder');
    expect(parsed.nextActions[0]?.path).toBe('/en/cv');
    expect(parsed.nextActions[0]?.job_id).toBe('job_1');
  });

  it('parses Path A exit fields', () => {
    const parsed = parseAssistantEnvelope({
      exited: true,
      exited_agent: 'mock_interview',
      exit_reason: 'escalated',
      suggested_next_steps: ['cv_builder'],
      assistant_response: { content: 'Switching to CV builder.' },
    });

    expect(parsed.exited).toBe(true);
    expect(parsed.exitedAgent).toBe('mock_interview');
    expect(parsed.exitReason).toBe('escalated');
    expect(parsed.suggestedNextSteps).toEqual(['cv_builder']);
  });

  it('falls back exitedAgent to top-level agent_id', () => {
    const parsed = parseAssistantEnvelope({
      exited: true,
      agent_id: 'mock_interview',
      suggested_next_steps: ['cv_builder'],
      assistant_response: { content: 'Switching.' },
    });

    expect(parsed.exitedAgent).toBe('mock_interview');
  });

  it('parses assistant_response.meta', () => {
    const parsed = parseAssistantEnvelope({
      assistant_response: {
        content: 'Session ended',
        meta: { interview_session_status: 'abandoned' },
      },
    });

    expect(parsed.meta?.interview_session_status).toBe('abandoned');
  });
});

describe('buildMockInterviewWorkflow', () => {
  const labels = {
    prep: 'Prep',
    questions: 'Questions',
    feedback: 'Feedback',
    report: 'Report',
    questionDetail: ({ current, total }: { current: number; total: number }) =>
      `${current}/${total}`,
  };

  it('marks q_group current during interview with detail', () => {
    const wf = buildMockInterviewWorkflow('interview', labels, 2, 3);
    expect(wf?.steps.find((s) => s.id === 'q_group')?.status).toBe('current');
    expect(wf?.steps.find((s) => s.id === 'q_group')?.detail).toBe('2/3');
  });

  it('returns undefined during role_select', () => {
    expect(buildMockInterviewWorkflow('role_select', labels)).toBeUndefined();
  });

  it('marks prep done (not skipped) once interview starts', () => {
    const wf = buildMockInterviewWorkflow('interview', labels, 1, 3);
    expect(wf?.steps.find((s) => s.id === 'prep')?.status).toBe('done');
  });
});

describe('handleAgentEnvelope', () => {
  it('builds assistant fields and escalation from a unified response', () => {
    const result = handleAgentEnvelope({
      exited: true,
      exit_reason: 'escalated',
      suggested_next_steps: ['cv_builder'],
      assistant_response: {
        content: 'Let me open the CV builder.',
        next_actions: [{ type: 'cv_builder', label: 'CV Builder' }],
        workflow: {
          agent_id: 'mock_interview',
          pipeline_state: 'escalated',
          steps: [{ id: 'prep', status: 'done' }],
        },
      },
    });

    expect(result.assistant.content).toBe('Let me open the CV builder.');
    expect(result.assistant.nextActions).toHaveLength(1);
    expect(result.assistant.workflow?.pipeline_state).toBe('escalated');
    expect(result.escalation?.targetAgentId).toBe('cv_builder');
  });

  it('returns null escalation when exited without suggested steps', () => {
    const result = handleAgentEnvelope({
      exited: true,
      assistant_response: { content: 'Bye' },
    });
    expect(result.escalation).toBeNull();
  });
});

describe('envelopeToEscalation', () => {
  it('ignores unknown agent ids in suggested_next_steps', () => {
    const envelope = parseAssistantEnvelope({
      exited: true,
      suggested_next_steps: ['unknown_agent'],
      assistant_response: { content: 'x' },
    });
    expect(envelopeToEscalation(envelope)).toBeNull();
  });
});

describe('resolveWorkflowFromMessages', () => {
  it('prefers the latest assistant message workflow', () => {
    const beWorkflow = {
      agent_id: 'cv_builder',
      pipeline_state: 'review',
      steps: [{ id: 'review', status: 'current' as const }],
    };
    const resolved = resolveWorkflowFromMessages(
      [
        { role: 'user' },
        { role: 'assistant', workflow: beWorkflow },
      ],
      () => ({ agent_id: 'cv_builder', pipeline_state: 'intake', steps: [] })
    );
    expect(resolved).toBe(beWorkflow);
  });
});

describe('buildAssistantMessageFields', () => {
  it('omits empty optional arrays', () => {
    const fields = buildAssistantMessageFields({
      reply: 'Hello',
      nextActions: [],
      cards: [],
    });
    expect(fields.content).toBe('Hello');
    expect(fields.nextActions).toBeUndefined();
    expect(fields.cards).toBeUndefined();
  });
});
