import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  getActiveAgent: vi.fn(),
  deactivate: vi.fn(async () => ({ ok: true, agentId: null })),
}));
vi.mock('@/lib/agent-api', () => ({ getActiveAgent: api.getActiveAgent }));
vi.mock('@/lib/deactivate-to-clinic', () => ({ deactivateToClinic: api.deactivate }));

import { leaveToMainChat } from '@/lib/leave-to-main-chat';
import { useAgentStore } from '@/lib/store';

/**
 * KAZI-1155 review of kazispace-ai #261: the Get started tap used to end
 * every current specialist on the server, so a running mock interview or
 * English tutor session stopped being current. "Back to Clinic" leaves
 * those by navigation only (navigation pattern, "Returning to the main
 * chat"), and Clinic opens the main chat while they or the CV builder are
 * current. Only a specialist Clinic would resume inline is left on the server.
 */
describe('KAZI-1155 leaveToMainChat', () => {
  beforeEach(() => {
    api.getActiveAgent.mockReset();
    api.deactivate.mockClear();
    useAgentStore.getState().setActiveAgent(null, null);
  });

  it.each(['mock_interview', 'english_tutor', 'cv_builder'])(
    '%s (current on the server) stays open: navigation only',
    async (agentId) => {
      api.getActiveAgent.mockResolvedValue({ success: true, data: { active_agent: agentId } });
      await leaveToMainChat('en');
      expect(api.deactivate).not.toHaveBeenCalled();
      expect(useAgentStore.getState().activeAgentId).toBeNull();
    }
  );

  it('a hub agent held locally is not ended either, and the server is not asked', async () => {
    useAgentStore.getState().setActiveAgent('mock_interview', 's1');
    await leaveToMainChat('en');
    expect(api.getActiveAgent).not.toHaveBeenCalled();
    expect(api.deactivate).not.toHaveBeenCalled();
    expect(useAgentStore.getState().activeAgentId).toBeNull();
  });

  it('an inline specialist is left on the server, best effort', async () => {
    useAgentStore.getState().setActiveAgent('job_search', 's2');
    await leaveToMainChat('zh');
    expect(api.deactivate).toHaveBeenCalledWith('zh', { agentId: 'job_search', bestEffort: true });
  });

  it('an inline specialist known only to the server is left too', async () => {
    api.getActiveAgent.mockResolvedValue({ success: true, data: { active_agent: 'career_sprint' } });
    await leaveToMainChat('en');
    expect(api.deactivate).toHaveBeenCalledWith('en', { agentId: 'career_sprint', bestEffort: true });
  });

  it('no current specialist: nothing to leave', async () => {
    api.getActiveAgent.mockResolvedValue({ success: true, data: { active_agent: null } });
    await leaveToMainChat('en');
    expect(api.deactivate).not.toHaveBeenCalled();
  });
});
