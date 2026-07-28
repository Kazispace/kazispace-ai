import { describe, expect, it } from 'vitest';

import {
  buildSessionNavRows,
  buildSessionViewRows,
  enrichSessionNavRows,
  filterSessionNavRows,
  filterSessionViewRows,
  resolveActiveNavRowId,
  resolveContextHeaderSession,
  resolveRegistryAgentBadge,
  resolveSessionNavBadge,
} from '@/lib/session-nav';
import type { AgentSessionSummary } from '@/types';
import { AGENT_REGISTRY } from '@/lib/agents/registry';

describe('session-nav', () => {
  it('builds clinic row first and disables job_search', () => {
    const rows = buildSessionNavRows('en', 'Clinic');
    expect(rows[0]?.id).toBe('clinic');
    expect(rows[0]?.href).toBe('/en/chat');
    const jobSearch = rows.find((r) => r.agentId === 'job_search');
    expect(jobSearch?.disabled).toBe(true);
    expect(jobSearch?.badge).toBe('clinicInline');
    expect(rows.find((r) => r.agentId === 'cv_builder')?.href).toBe('/en/chat?cv=1');
  });

  it('resolves active row from pathname', () => {
    expect(resolveActiveNavRowId('/en/chat')).toBe('clinic');
    expect(resolveActiveNavRowId('/en/spaces/sp_abc')).toBe('sp_abc');
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
        session_id: 's4',
        agent_id: 'cv_builder',
        status: 'archived',
        title: 'CV',
      })?.kind
    ).toBe('archived');
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

  it('does not enrich clinicInline rows', () => {
    const rows = buildSessionNavRows('en', 'Clinic');
    const sessions = new Map<string, AgentSessionSummary>([
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

    const enriched = enrichSessionNavRows(rows, sessions);
    const jobSearch = enriched.find((row) => row.agentId === 'job_search');
    expect(jobSearch?.badge).toBe('clinicInline');
    expect(jobSearch?.disabledReason).toBe('clinicInline');
  });

  it('resolveRegistryAgentBadge maps static and session states', () => {
    const cv = AGENT_REGISTRY.find((a) => a.agentId === 'cv_builder')!;
    expect(resolveRegistryAgentBadge(cv, null)).toBeNull();
    expect(
      resolveRegistryAgentBadge(cv, {
        session_id: 's1',
        agent_id: 'cv_builder',
        status: 'active',
        title: 'CV',
        pipeline_state: 'collecting',
      })?.kind
    ).toBe('pipeline');

    const jobSearch = AGENT_REGISTRY.find((a) => a.agentId === 'job_search')!;
    expect(resolveRegistryAgentBadge(jobSearch)?.kind).toBe('clinicInline');
  });

  it('resolveContextHeaderSession returns null for non-hub paths', () => {
    expect(resolveContextHeaderSession('/en/chat', new Map())).toBeNull();
    expect(resolveContextHeaderSession('/en/jobs', new Map())).toBeNull();
    expect(
      resolveContextHeaderSession(
        '/en/cv',
        new Map([
          [
            'cv_builder',
            {
              session_id: 's1',
              agent_id: 'cv_builder',
              status: 'active',
              title: 'CV',
            },
          ],
        ])
      )?.agent_id
    ).toBe('cv_builder');
  });

  it('builds session view rows with clinic first and sorted agent sessions', () => {
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
          updated_at: '2026-07-12T10:00:00Z',
        },
      ],
    ]);

    const rows = buildSessionViewRows('en', 'Clinic', sessions);
    expect(rows[0]?.kind).toBe('clinic');
    expect(rows[1]?.agentId).toBe('cv_builder');
    expect(rows[2]?.agentId).toBe('mock_interview');
    expect(rows[1]?.sessionTitle).toBe('Software Engineer CV');
  });

  it('filters agent and session rows by list query', () => {
    const rows = buildSessionNavRows('en', 'Clinic');
    const sessions = new Map<string, AgentSessionSummary>([
      [
        'cv_builder',
        {
          session_id: 'sess_cv',
          agent_id: 'cv_builder',
          status: 'active',
          title: 'Software Engineer CV',
        },
      ],
    ]);
    const enriched = enrichSessionNavRows(rows, sessions);
    expect(filterSessionNavRows(enriched, 'software').some((r) => r.agentId === 'cv_builder')).toBe(
      true
    );
    expect(filterSessionNavRows(enriched, 'zzz')).toHaveLength(0);

    const sessionRows = buildSessionViewRows('en', 'Clinic', sessions);
    expect(filterSessionViewRows(sessionRows, 'clinic')).toHaveLength(1);
    expect(filterSessionViewRows(sessionRows, 'engineer')[0]?.agentId).toBe('cv_builder');
  });
});
