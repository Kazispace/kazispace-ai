import { describe, expect, it } from 'vitest';

import { buildSessionNavRows, resolveActiveNavRowId } from '@/lib/session-nav';

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
});
