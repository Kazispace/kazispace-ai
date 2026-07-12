import { describe, expect, it } from 'vitest';

import { buildClinicActiveSessionEntries } from '@/lib/clinic-active-sessions';
import type { AgentSessionSummary } from '@/types';

describe('clinic-active-sessions', () => {
  it('lists resumable hub sessions sorted by updated_at', () => {
    const sessions = new Map<string, AgentSessionSummary>([
      [
        'mock_interview',
        {
          session_id: 'sess_mi',
          agent_id: 'mock_interview',
          status: 'active',
          title: 'PM interview',
          updated_at: '2026-07-10T10:00:00Z',
        },
      ],
      [
        'cv_builder',
        {
          session_id: 'sess_cv',
          agent_id: 'cv_builder',
          status: 'active',
          title: 'Software Engineer CV',
          pipeline_state: 'collecting',
          updated_at: '2026-07-12T10:00:00Z',
        },
      ],
      [
        'job_search',
        {
          session_id: 'sess_js',
          agent_id: 'job_search',
          status: 'active',
          title: 'Job search',
        },
      ],
    ]);

    const entries = buildClinicActiveSessionEntries('en', sessions);
    expect(entries).toHaveLength(2);
    expect(entries[0]?.agentId).toBe('cv_builder');
    expect(entries[0]?.badge).toBe('pipeline');
    expect(entries[0]?.href).toBe('/en/cv');
    expect(entries[1]?.agentId).toBe('mock_interview');
    expect(entries[1]?.href).toBe('/en/interview');
  });

  it('skips notStarted and archived sessions', () => {
    const sessions = new Map<string, AgentSessionSummary>([
      [
        'english_tutor',
        {
          session_id: 'sess_en',
          agent_id: 'english_tutor',
          status: 'archived',
          title: 'English',
        },
      ],
    ]);

    expect(buildClinicActiveSessionEntries('en', sessions)).toHaveLength(0);
  });
});
