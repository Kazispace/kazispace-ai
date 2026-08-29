import { describe, expect, it } from 'vitest';

import { toLatestSessionsByAgent } from '@/lib/current-agent-sessions';
import type { AgentSessionSummary } from '@/types';

describe('current-agent-sessions', () => {
  it('returns empty map for empty input', () => {
    expect(toLatestSessionsByAgent([])).toEqual(new Map());
  });

  it('keeps latest updated_at per agent_id', () => {
    const sessions: AgentSessionSummary[] = [
      {
        session_id: 'old',
        title: 'Session old',
        agent_id: 'cv_builder',
        status: 'exited',
        updated_at: '2026-07-08T10:00:00Z',
      },
      {
        session_id: 'new',
        title: 'Session new',
        agent_id: 'cv_builder',
        status: 'exited',
        updated_at: '2026-07-11T07:31:26Z',
      },
      {
        session_id: 'mi',
        title: 'Session mi',
        agent_id: 'mock_interview',
        status: 'active',
        updated_at: '2026-07-12T09:42:32Z',
      },
    ];

    const map = toLatestSessionsByAgent(sessions);
    expect(map.get('cv_builder')?.session_id).toBe('new');
    expect(map.get('mock_interview')?.session_id).toBe('mi');
  });

  it('treats missing or invalid updated_at as oldest', () => {
    const sessions: AgentSessionSummary[] = [
      {
        session_id: 'invalid',
        title: 'Session invalid',
        agent_id: 'cv_builder',
        status: 'exited',
        updated_at: 'not-a-date',
      },
      {
        session_id: 'valid',
        title: 'Session valid',
        agent_id: 'cv_builder',
        status: 'exited',
        updated_at: '2026-07-11T07:31:26Z',
      },
      {
        session_id: 'missing',
        title: 'Session missing',
        agent_id: 'mock_interview',
        status: 'active',
      },
    ];

    const map = toLatestSessionsByAgent(sessions);
    expect(map.get('cv_builder')?.session_id).toBe('valid');
    expect(map.get('mock_interview')?.session_id).toBe('missing');
  });

  it('keeps first session when updated_at ties', () => {
    const sessions: AgentSessionSummary[] = [
      {
        session_id: 'first',
        title: 'Session first',
        agent_id: 'cv_builder',
        status: 'exited',
        updated_at: '2026-07-11T07:31:26Z',
      },
      {
        session_id: 'second',
        title: 'Session second',
        agent_id: 'cv_builder',
        status: 'exited',
        updated_at: '2026-07-11T07:31:26Z',
      },
    ];

    expect(toLatestSessionsByAgent(sessions).get('cv_builder')?.session_id).toBe(
      'first'
    );
  });

  it('skips rows without agent_id', () => {
    const map = toLatestSessionsByAgent([
      { session_id: 'x',
 title: 'Session x', agent_id: '', status: 'active' },
    ]);
    expect(map.size).toBe(0);
  });
});
