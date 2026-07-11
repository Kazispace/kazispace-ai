import { describe, expect, it } from 'vitest';

import { parseAssistantEnvelope } from '@/lib/chat-envelope';
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
