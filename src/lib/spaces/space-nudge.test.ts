import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';

import { STORAGE_KEYS } from '@/lib/constants';
import {
  dismissSpaceNudge,
  extractSpaceNudge,
  isSpaceNudgeDismissed,
  parseSpaceNudgeComponent,
  SPACE_NUDGE_DISMISS_TTL_MS,
} from '@/lib/spaces/space-nudge';

describe('extractSpaceNudge', () => {
  it('reads components[].type space_nudge', () => {
    expect(
      extractSpaceNudge({
        reply: 'hi',
        components: [
          { type: 'text', text: 'hello' },
          {
            type: 'space_nudge',
            template_id: 'job_sprint',
            suggested_name: 'Q3 Jobs',
            cta_label: { en: 'Start Job Sprint', zh: '开启求职冲刺' },
          },
        ],
      })
    ).toEqual({
      templateId: 'job_sprint',
      suggestedName: 'Q3 Jobs',
      ctaLabel: 'Start Job Sprint',
    });
  });

  it('prefers CTA label for the active locale', () => {
    expect(
      extractSpaceNudge(
        {
          components: [
            {
              type: 'space_nudge',
              template_id: 'job_sprint',
              cta_label: { en: 'Start Job Sprint', ru: 'Начать спринт' },
            },
          ],
        },
        'ru'
      )?.ctaLabel
    ).toBe('Начать спринт');
  });

  it('reads nested envelope.components', () => {
    expect(
      extractSpaceNudge({
        envelope: {
          components: [{ type: 'space_nudge', template_id: 'ielts_prep' }],
        },
      })
    ).toEqual({ templateId: 'ielts_prep' });
  });

  it('reads assistant_response.components', () => {
    expect(
      extractSpaceNudge({
        assistant_response: {
          components: [{ type: 'space_nudge', template_id: 'job_sprint' }],
        },
      })
    ).toEqual({ templateId: 'job_sprint' });
  });

  it('reads response.components', () => {
    expect(
      extractSpaceNudge({
        response: {
          components: [{ type: 'space_nudge', template_id: 'blank_conversation' }],
        },
      })
    ).toEqual({ templateId: 'blank_conversation' });
  });

  it('reads root space_nudge object', () => {
    expect(
      extractSpaceNudge({
        space_nudge: { template_id: 'blank_conversation', reason: 'Deep dive' },
      })
    ).toEqual({
      templateId: 'blank_conversation',
      reason: 'Deep dive',
    });
  });

  it('rejects unsupported template ids', () => {
    expect(
      parseSpaceNudgeComponent({
        type: 'space_nudge',
        template_id: 'not_a_template',
      })
    ).toBeNull();
  });
});

describe('space nudge dismiss', () => {
  beforeEach(() => {
    const store: Record<string, string> = {};
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => {
        store[k] = v;
      },
      removeItem: (k: string) => {
        delete store[k];
      },
    });
    vi.stubGlobal('window', globalThis);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('respects 30d dismiss TTL', () => {
    expect(isSpaceNudgeDismissed('job_sprint')).toBe(false);
    dismissSpaceNudge('job_sprint');
    expect(isSpaceNudgeDismissed('job_sprint')).toBe(true);
    expect(localStorage.getItem(STORAGE_KEYS.SPACE_NUDGE_DISMISSED)).toBeTruthy();

    const map = JSON.parse(
      localStorage.getItem(STORAGE_KEYS.SPACE_NUDGE_DISMISSED)!
    ) as Record<string, number>;
    map.job_sprint = Date.now() - SPACE_NUDGE_DISMISS_TTL_MS - 1;
    localStorage.setItem(STORAGE_KEYS.SPACE_NUDGE_DISMISSED, JSON.stringify(map));
    expect(isSpaceNudgeDismissed('job_sprint')).toBe(false);
  });
});
