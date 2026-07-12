import { beforeEach, describe, expect, it, vi } from 'vitest';

const setActiveAgent = vi.fn();
const deactivateAgent = vi.fn();

vi.mock('@/lib/agent-api', () => ({
  deactivateAgent: (...args: unknown[]) => deactivateAgent(...args),
}));

vi.mock('@/lib/store', () => ({
  useAgentStore: {
    getState: () => ({
      setActiveAgent,
    }),
  },
}));

import { leaveDedicatedHubForClinic } from '@/lib/leave-dedicated-hub';
import { CV_BUILDER_AGENT_ID } from '@/lib/cv-agent-config';

describe('leaveDedicatedHubForClinic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('clears local UI focus without calling deactivate (MA-10)', () => {
    leaveDedicatedHubForClinic('en', CV_BUILDER_AGENT_ID);

    expect(setActiveAgent).toHaveBeenCalledWith(null, null);
    expect(deactivateAgent).not.toHaveBeenCalled();
  });
});
