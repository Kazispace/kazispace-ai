import { describe, expect, it } from 'vitest';

import { buildClinicActiveSessionEntries } from '@/lib/clinic-active-sessions';
import type { AgentSessionSummary } from '@/types';

describe('clinic-active-sessions', () => {
  it('returns empty list when no resumable hub sessions', () => {
    expect(buildClinicActiveSessionEntries('en', new Map())).toEqual([]);
  });

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

  it('includes exited sessions as resumable', () => {
    const sessions = new Map<string, AgentSessionSummary>([
      [
        'english_tutor',
        {
          session_id: 'sess_en',
          agent_id: 'english_tutor',
          status: 'exited',
          title: 'English practice',
          updated_at: '2026-07-11T10:00:00Z',
        },
      ],
    ]);

    const entries = buildClinicActiveSessionEntries('en', sessions);
    expect(entries).toHaveLength(1);
    expect(entries[0]?.badge).toBe('resumable');
    expect(entries[0]?.href).toBe('/en/english');
  });

  it('skips archived and notStarted sessions', () => {
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

  it('sorts three sessions by updated_at descending', () => {
    const sessions = new Map<string, AgentSessionSummary>([
      [
        'cv_builder',
        {
          session_id: '1',
          agent_id: 'cv_builder',
          status: 'active',
          title: 'A',
          updated_at: '2026-07-08T10:00:00Z',
        },
      ],
      [
        'mock_interview',
        {
          session_id: '2',
          agent_id: 'mock_interview',
          status: 'active',
          title: 'B',
          updated_at: '2026-07-12T10:00:00Z',
        },
      ],
      [
        'english_tutor',
        {
          session_id: '3',
          agent_id: 'english_tutor',
          status: 'exited',
          title: 'C',
          updated_at: '2026-07-10T10:00:00Z',
        },
      ],
    ]);

    const ids = buildClinicActiveSessionEntries('en', sessions).map((e) => e.agentId);
    expect(ids).toEqual(['mock_interview', 'english_tutor', 'cv_builder']);
  });
});
