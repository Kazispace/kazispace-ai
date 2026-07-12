import { beforeEach, describe, expect, it, vi } from 'vitest';

const setActiveAgent = vi.fn();
const deactivateAgent = vi.fn();
let activeAgentId: string | null = 'cv_builder';

vi.mock('@/lib/agent-api', () => ({
  deactivateAgent: (...args: unknown[]) => deactivateAgent(...args),
}));

vi.mock('@/lib/store', () => ({
  useAgentStore: {
    getState: () => ({
      activeAgentId,
      setActiveAgent: (...args: unknown[]) => {
        setActiveAgent(...args);
        if (args[0] === null) activeAgentId = null;
        else if (typeof args[0] === 'string') activeAgentId = args[0];
      },
    }),
  },
}));

import { leaveDedicatedHubForClinic } from '@/lib/leave-dedicated-hub';
import { CV_BUILDER_AGENT_ID } from '@/lib/cv-agent-config';
import { MOCK_INTERVIEW_AGENT_ID } from '@/lib/mock-interview-config';

describe('leaveDedicatedHubForClinic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    activeAgentId = CV_BUILDER_AGENT_ID;
  });

  it('clears local UI focus without calling deactivate (MA-10)', () => {
    leaveDedicatedHubForClinic();

    expect(setActiveAgent).toHaveBeenCalledWith(null, null);
    expect(deactivateAgent).not.toHaveBeenCalled();
  });

  it('is idempotent on repeated calls', () => {
    leaveDedicatedHubForClinic();
    leaveDedicatedHubForClinic();
    leaveDedicatedHubForClinic();

    expect(setActiveAgent).toHaveBeenCalledTimes(3);
    expect(setActiveAgent).toHaveBeenCalledWith(null, null);
    expect(deactivateAgent).not.toHaveBeenCalled();
  });

  it('clears an existing active agent in store', () => {
    expect(activeAgentId).toBe(CV_BUILDER_AGENT_ID);

    leaveDedicatedHubForClinic();

    expect(activeAgentId).toBeNull();
    expect(setActiveAgent).toHaveBeenCalledWith(null, null);
  });

  it('does not throw regardless of prior store state', () => {
    activeAgentId = null;
    expect(() => leaveDedicatedHubForClinic()).not.toThrow();

    activeAgentId = MOCK_INTERVIEW_AGENT_ID;
    expect(() => leaveDedicatedHubForClinic()).not.toThrow();
    expect(setActiveAgent).toHaveBeenLastCalledWith(null, null);
  });
});
