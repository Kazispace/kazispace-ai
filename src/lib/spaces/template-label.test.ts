import { describe, expect, it } from 'vitest';

import { resolveTemplateLabel } from '@/lib/spaces/template-label';
import type { SpaceTemplateItem } from '@/types/spaces';

const t = (key: string) => `i18n:${key}`;

function item(
  template_id: string,
  display_name?: SpaceTemplateItem['display_name']
): SpaceTemplateItem {
  return {
    template_id,
    display_name: display_name ?? template_id,
  };
}

describe('resolveTemplateLabel', () => {
  it('uses local title + desc for known MVP ids without rich display_name', () => {
    expect(resolveTemplateLabel(item('blank_conversation'), 'zh', t)).toEqual({
      title: 'i18n:templateBlank',
      desc: 'i18n:templateBlankDesc',
    });
  });

  it('treats display_name === template_id as unset (client / BE seed)', () => {
    expect(
      resolveTemplateLabel(item('job_sprint', 'job_sprint'), 'en', t)
    ).toEqual({
      title: 'i18n:templateJobSprint',
      desc: 'i18n:templateJobSprintDesc',
    });
  });

  it('keeps local desc when API provides localized display_name', () => {
    expect(
      resolveTemplateLabel(
        item('job_sprint', { zh: '求职冲刺', en: 'Job sprint' }),
        'zh',
        t
      )
    ).toEqual({
      title: '求职冲刺',
      desc: 'i18n:templateJobSprintDesc',
    });
  });

  it('falls back to en before zh for unsupported locale keys', () => {
    expect(
      resolveTemplateLabel(
        item('ielts_prep', { zh: '雅思备考', en: 'IELTS prep' }),
        'ru',
        t
      )
    ).toEqual({
      title: 'IELTS prep',
      desc: 'i18n:templateIeltsDesc',
    });
  });

  it('keeps local desc when API provides string display_name', () => {
    expect(
      resolveTemplateLabel(item('ielts_prep', 'IELTS Prep Pro'), 'en', t)
    ).toEqual({
      title: 'IELTS Prep Pro',
      desc: 'i18n:templateIeltsDesc',
    });
  });

  it('falls back to template_id for unknown templates', () => {
    expect(resolveTemplateLabel(item('stock_analysis'), 'en', t)).toEqual({
      title: 'stock_analysis',
      desc: '',
    });
  });
});
