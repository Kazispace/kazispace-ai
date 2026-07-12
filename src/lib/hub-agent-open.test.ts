import { beforeEach, describe, expect, it, vi } from 'vitest';

const openAgentSession = vi.fn();
const setAgentSession = vi.fn();
const publishActiveAgentSync = vi.fn();
const setCvAgentHandoff = vi.fn();

vi.mock('@/lib/agent-api', () => ({
  openAgentSession: (...args: unknown[]) => openAgentSession(...args),
}));

vi.mock('@/lib/active-agent-sync', () => ({
  publishActiveAgentSync: (...args: unknown[]) => publishActiveAgentSync(...args),
}));

vi.mock('@/lib/cv-agent-handoff', () => ({
  setCvAgentHandoff: (...args: unknown[]) => setCvAgentHandoff(...args),
}));

vi.mock('@/lib/store', () => ({
  useAgentStore: {
    getState: () => ({ setAgentSession }),
  },
}));

import { openHubAgentSession } from '@/lib/hub-agent-open';
import { CV_BUILDER_AGENT_ID } from '@/lib/cv-agent-config';
import { MOCK_INTERVIEW_AGENT_ID } from '@/lib/mock-interview-config';

describe('openHubAgentSession (MA-07)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls sessions/open and updates per-agent store', async () => {
    openAgentSession.mockResolvedValue({
      success: true,
      data: {
        agent_id: CV_BUILDER_AGENT_ID,
        session_id: 'sess_cv_1',
        greeting: 'Hi',
        resumed: true,
      },
    });

    const result = await openHubAgentSession(CV_BUILDER_AGENT_ID, 'en');

    expect(openAgentSession).toHaveBeenCalledWith(CV_BUILDER_AGENT_ID, 'en', undefined);
    expect(setAgentSession).toHaveBeenCalledWith(CV_BUILDER_AGENT_ID, 'sess_cv_1');
    expect(setCvAgentHandoff).toHaveBeenCalledWith({
      sessionId: 'sess_cv_1',
      greeting: 'Hi',
    });
    expect(publishActiveAgentSync).toHaveBeenCalledWith({
      type: 'activated',
      agentId: CV_BUILDER_AGENT_ID,
      sessionId: 'sess_cv_1',
    });
    expect(result).toEqual({
      ok: true,
      sessionId: 'sess_cv_1',
      resumed: true,
      greeting: 'Hi',
    });
  });

  it('does not set CV handoff for non-CV agents', async () => {
    openAgentSession.mockResolvedValue({
      success: true,
      data: {
        agent_id: MOCK_INTERVIEW_AGENT_ID,
        session_id: 'sess_mi_1',
        greeting: 'Hello',
        resumed: false,
      },
    });

    await openHubAgentSession(MOCK_INTERVIEW_AGENT_ID, 'en');

    expect(setCvAgentHandoff).not.toHaveBeenCalled();
    expect(setAgentSession).toHaveBeenCalledWith(MOCK_INTERVIEW_AGENT_ID, 'sess_mi_1');
  });

  it('returns error when open fails', async () => {
    openAgentSession.mockResolvedValue({
      success: false,
      error: 'Server error',
      errorCode: 'INTERNAL',
    });

    const result = await openHubAgentSession(CV_BUILDER_AGENT_ID, 'en');

    expect(result).toEqual({
      ok: false,
      error: 'Server error',
      errorCode: 'INTERNAL',
    });
    expect(setAgentSession).not.toHaveBeenCalled();
  });
});
