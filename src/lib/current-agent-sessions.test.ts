import { describe, expect, it } from 'vitest';

import { toLatestSessionsByAgent } from '@/lib/current-agent-sessions';
import type { AgentSessionSummary } from '@/types';

describe('current-agent-sessions', () => {
  it('keeps latest updated_at per agent_id', () => {
    const sessions: AgentSessionSummary[] = [
      {
        session_id: 'old',
        agent_id: 'cv_builder',
        status: 'exited',
        updated_at: '2026-07-08T10:00:00Z',
      },
      {
        session_id: 'new',
        agent_id: 'cv_builder',
        status: 'exited',
        updated_at: '2026-07-11T07:31:26Z',
      },
      {
        session_id: 'mi',
        agent_id: 'mock_interview',
        status: 'active',
        updated_at: '2026-07-12T09:42:32Z',
      },
    ];

    const map = toLatestSessionsByAgent(sessions);
    expect(map.get('cv_builder')?.session_id).toBe('new');
    expect(map.get('mock_interview')?.session_id).toBe('mi');
  });
});
