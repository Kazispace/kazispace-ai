import { describe, expect, it } from 'vitest';

import {
  buildSessionNavRows,
  enrichSessionNavRows,
  resolveActiveNavRowId,
  resolveSessionNavBadge,
} from '@/lib/session-nav';
import type { AgentSessionSummary } from '@/types';

describe('session-nav', () => {
  it('builds clinic row first and disables job_search', () => {
    const rows = buildSessionNavRows('en', 'Clinic');
    expect(rows[0]?.id).toBe('clinic');
    expect(rows[0]?.href).toBe('/en/chat');
    const jobSearch = rows.find((r) => r.agentId === 'job_search');
    expect(jobSearch?.disabled).toBe(true);
    expect(rows.find((r) => r.agentId === 'cv_builder')?.href).toBe('/en/cv');
  });

  it('resolves active row from pathname', () => {
    expect(resolveActiveNavRowId('/en/chat')).toBe('clinic');
    expect(resolveActiveNavRowId('/en/cv')).toBe('cv_builder');
    expect(resolveActiveNavRowId('/en/interview')).toBe('mock_interview');
    expect(resolveActiveNavRowId('/zh/english')).toBe('english_tutor');
  });

  it('maps session status to panel badges', () => {
    expect(resolveSessionNavBadge(null)?.kind).toBe('notStarted');
    expect(
      resolveSessionNavBadge({
        session_id: 's1',
        agent_id: 'cv_builder',
        status: 'active',
        title: 'CV',
      })?.kind
    ).toBe('inProgress');
    expect(
      resolveSessionNavBadge({
        session_id: 's2',
        agent_id: 'cv_builder',
        status: 'exited',
        title: 'CV',
      })?.kind
    ).toBe('resumable');
    expect(
      resolveSessionNavBadge({
        session_id: 's3',
        agent_id: 'cv_builder',
        status: 'active',
        title: 'CV',
        pipeline_state: 'collecting',
      })
    ).toEqual({ kind: 'pipeline', detail: 'collecting' });
  });

  it('enriches registry rows with current session badges', () => {
    const rows = buildSessionNavRows('en', 'Clinic');
    const sessions = new Map<string, AgentSessionSummary>([
      [
        'cv_builder',
        {
          session_id: 'sess_cv',
          agent_id: 'cv_builder',
          status: 'active',
          title: 'Software Engineer CV',
          pipeline_state: 'collecting',
        },
      ],
    ]);

    const enriched = enrichSessionNavRows(rows, sessions);
    const cvRow = enriched.find((row) => row.agentId === 'cv_builder');
    expect(cvRow?.badge).toBe('pipeline');
    expect(cvRow?.badgeDetail).toBe('collecting');

    const interviewRow = enriched.find((row) => row.agentId === 'mock_interview');
    expect(interviewRow?.badge).toBe('notStarted');
  });
});
