import { beforeEach, describe, expect, it, vi } from 'vitest';

const deactivateAgent = vi.fn();
const getActiveAgent = vi.fn();
const setActiveAgent = vi.fn();
const publishActiveAgentSync = vi.fn();

vi.mock('@/lib/agent-api', () => ({
  deactivateAgent: (...args: unknown[]) => deactivateAgent(...args),
  getActiveAgent: (...args: unknown[]) => getActiveAgent(...args),
}));

vi.mock('@/lib/active-agent-sync', () => ({
  publishActiveAgentSync: (...args: unknown[]) => publishActiveAgentSync(...args),
}));

vi.mock('@/lib/store', () => ({
  useAgentStore: {
    getState: () => ({
      activeAgentId: null,
      setActiveAgent,
    }),
  },
}));

import { deactivateToClinic } from '@/lib/deactivate-to-clinic';
import { MOCK_INTERVIEW_AGENT_ID } from '@/lib/mock-interview-config';

describe('deactivateToClinic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns ok without calling deactivate when no active agent', async () => {
    getActiveAgent.mockResolvedValue({
      success: true,
      data: { active_agent: null, session_id: null },
    });

    const result = await deactivateToClinic('en');

    expect(result).toEqual({ ok: true, agentId: null });
    expect(deactivateAgent).not.toHaveBeenCalled();
    expect(setActiveAgent).toHaveBeenCalledWith(null, null);
  });

  it('bestEffort succeeds when deactivate POST fails but server still reports agent', async () => {
    deactivateAgent.mockResolvedValue({
      success: false,
      error: 'Internal Server Error',
    });
    getActiveAgent.mockResolvedValue({
      success: true,
      data: {
        active_agent: MOCK_INTERVIEW_AGENT_ID,
        session_id: 'sess_1',
      },
    });

    const result = await deactivateToClinic('en', {
      agentId: MOCK_INTERVIEW_AGENT_ID,
      bestEffort: true,
    });

    expect(result).toEqual({ ok: true, agentId: MOCK_INTERVIEW_AGENT_ID });
    expect(setActiveAgent).toHaveBeenCalledWith(null, null);
    expect(publishActiveAgentSync).toHaveBeenCalledWith({
      type: 'deactivated',
      agentId: MOCK_INTERVIEW_AGENT_ID,
    });
  });

  it('strict mode fails when deactivate POST fails and server still reports agent', async () => {
    deactivateAgent.mockResolvedValue({
      success: false,
      error: 'Internal Server Error',
    });
    getActiveAgent.mockResolvedValue({
      success: true,
      data: {
        active_agent: MOCK_INTERVIEW_AGENT_ID,
        session_id: 'sess_1',
      },
    });

    const result = await deactivateToClinic('en', {
      agentId: MOCK_INTERVIEW_AGENT_ID,
    });

    expect(result).toEqual({ ok: false, error: 'Internal Server Error' });
    expect(setActiveAgent).not.toHaveBeenCalled();
  });
});
