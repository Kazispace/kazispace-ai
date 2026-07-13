import { describe, expect, it } from 'vitest';

import {
  buildSpaceNavRows,
  filterSpaceNavRows,
  resolveActiveSpaceNavRowId,
  resolveSpaceIdFromPathname,
} from '@/lib/space-nav';
import { CLINIC_SPACE_ID } from '@/lib/spaces/constants';
import type { SpaceSummary } from '@/types/spaces';

const clinicSpace: SpaceSummary = {
  id: CLINIC_SPACE_ID,
  name: 'Clinic',
  template_id: 'clinic_default',
  status: 'active',
  is_entry_point: true,
  is_system: true,
  master_session_id: 'sess_1_web',
  last_active_at: '2026-07-13T10:00:00Z',
};

const jobSprint: SpaceSummary = {
  id: 'sp_abc123',
  name: '我的求职冲刺',
  template_id: 'job_sprint',
  status: 'active',
  master_session_id: 'sess_sp_abc123',
  last_active_at: '2026-07-12T10:00:00Z',
};

describe('space-nav', () => {
  it('builds rows from space list with clinic label override', () => {
    const rows = buildSpaceNavRows([clinicSpace, jobSprint], 'zh', '门诊');
    expect(rows).toHaveLength(2);
    expect(rows[0]?.id).toBe(CLINIC_SPACE_ID);
    expect(rows[0]?.displayName).toBe('门诊');
    expect(rows[0]?.href).toBe('/zh/chat');
    expect(rows[1]?.href).toBe('/zh/spaces/sp_abc123');
    expect(rows[1]?.emoji).toBe('🎯');
  });

  it('resolves active space from pathname', () => {
    expect(resolveSpaceIdFromPathname('/zh/spaces/sp_abc123')).toBe('sp_abc123');
    expect(resolveActiveSpaceNavRowId('/zh/chat')).toBe(CLINIC_SPACE_ID);
    expect(resolveActiveSpaceNavRowId('/zh/spaces/sp_abc123')).toBe('sp_abc123');
  });

  it('filters rows by name', () => {
    const rows = buildSpaceNavRows([clinicSpace, jobSprint], 'zh', '门诊');
    expect(filterSpaceNavRows(rows, '求职')).toHaveLength(1);
  });
});
