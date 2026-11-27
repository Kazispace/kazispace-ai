/**
 * KAZI-1485 (Owen 2026-11-27, kazispace-ui D39): "简历求职类会Archive。 未来暂时不支持。 聚焦在英语学习。"
 * and "没有意义的space名字 需要换成可读的。" CV / job-search spaces count as archived; a name nobody
 * chose (the bare type name included) shows as the space type's name and a day; a name the user gave is kept.
 */
import { describe, expect, it } from 'vitest';

import { buildSpaceNavRowsFiltered, readableSpaceName } from '@/lib/space-nav';
import { isArchivedSpaceTemplate, isMeaninglessSpaceName } from '@/lib/spaces/constants';
import type { SpaceSummary } from '@/types/spaces';

const space = (id: string, template_id: string, extra: Partial<SpaceSummary> = {}): SpaceSummary => ({
  id,
  name: id,
  template_id,
  status: 'active',
  master_session_id: `sess_${id}`,
  last_active_at: '2026-11-26T00:00:00Z',
  ...extra,
});
const label = (templateId: string) => ({ ielts_prep: '雅思备考', blank_conversation: '空白对话' })[templateId] ?? null;

describe('archived templates (D39)', () => {
  it('job sprint is archived; the English and blank templates are not', () => {
    expect(isArchivedSpaceTemplate('job_sprint')).toBe(true);
    expect(isArchivedSpaceTemplate('ielts_prep')).toBe(false);
    expect(isArchivedSpaceTemplate('blank_conversation')).toBe(false);
  });

  it('the current list leaves job-search spaces out; the archived list has them', () => {
    const spaces = [
      space('__clinic__', 'clinic_default', { is_entry_point: true }),
      space('sp_en', 'ielts_prep'),
      space('sp_job', 'job_sprint'),
    ];
    expect(buildSpaceNavRowsFiltered(spaces, 'zh', '门诊', 'active').map((r) => r.id)).toEqual([
      '__clinic__',
      'sp_en',
    ]);
    expect(buildSpaceNavRowsFiltered(spaces, 'zh', '门诊', 'archived').map((r) => r.id)).toEqual([
      '__clinic__',
      'sp_job',
    ]);
  });
});

describe('readable space names (D39)', () => {
  it.each([
    ['ET-44 04:36:41', true],
    ['KAZI-1277 04:24:33', true],
    ['ET-5 9:05', true],
    ['', true],
    ['ielts_prep', true],
    // The bare type name was the default name before KAZI-1492 (kazispace-backend#1517 review 🟡2).
    ['雅思备考', true],
    ['IELTS prep', true],
    ['雅思备考 · 11月26日', false],
    ['My IELTS plan', false],
    ['ET-44 notes', false],
  ])('%j is meaningless: %s', (name, expected) => {
    expect(isMeaninglessSpaceName(name, 'ielts_prep')).toBe(expected);
  });

  it('a name nobody chose shows as the space type\'s name and the day; a name the user gave is kept', () => {
    expect(readableSpaceName(space('sp1', 'ielts_prep', { name: 'ET-44 04:36:41' }), label, 'zh')).toBe(
      '雅思备考 · 11月26日'
    );
    expect(readableSpaceName(space('sp2', 'ielts_prep', { name: '我的雅思计划' }), label, 'zh')).toBe('我的雅思计划');
    expect(
      readableSpaceName(
        space('sp3', 'ielts_prep', { name: 'ET-1 01:02:03', template_display_name: 'IELTS', last_active_at: null }),
        undefined,
        'en'
      )
    ).toBe('IELTS');
    expect(readableSpaceName(space('sp4', 'ielts_prep', { name: '' }), label, 'en')).toBe('雅思备考 · Nov 26');
  });

  it('the bare type name gets the day, in either language and whatever the viewer\'s label is', () => {
    expect(readableSpaceName(space('sp5', 'ielts_prep', { name: '雅思备考' }), label, 'zh')).toBe('雅思备考 · 11月26日');
    expect(readableSpaceName(space('sp6', 'ielts_prep', { name: 'IELTS prep' }), label, 'zh')).toBe('雅思备考 · 11月26日');
    expect(
      readableSpaceName(space('sp7', 'ielts_prep', { name: 'IELTS', template_display_name: 'IELTS' }), undefined, 'en')
    ).toBe('IELTS · Nov 26');
  });

  it('the list rows use the readable name', () => {
    const rows = buildSpaceNavRowsFiltered(
      [space('sp1', 'ielts_prep', { name: 'KAZI-1277 04:24:33' })],
      'zh',
      '门诊',
      'active',
      label
    );
    expect(rows[0]?.displayName).toBe('雅思备考 · 11月26日');
  });
});
