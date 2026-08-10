import { describe, expect, it } from 'vitest';

import {
  isEnglishTutorReviseAction,
  isLowConfidenceMeta,
  parseEnglishTutorCustomComponents,
} from '@/lib/english-tutor/custom-components';

describe('parseEnglishTutorCustomComponents', () => {
  it('parses essay_diff with span issues', () => {
    const parsed = parseEnglishTutorCustomComponents([
      {
        type: 'essay_diff',
        original: 'I go to school yesterday.',
        issues: [
          {
            start: 2,
            end: 4,
            category: 'grammar',
            message: 'Use past tense',
            rewrite_example: 'went',
          },
        ],
        rewrite: 'I went to school yesterday.',
      },
    ]);

    expect(parsed).toHaveLength(1);
    expect(parsed[0]?.type).toBe('essay_diff');
    if (parsed[0]?.type !== 'essay_diff') return;
    expect(parsed[0].issues[0]?.category).toBe('grammar');
    expect(parsed[0].rewrite).toContain('went');
  });

  it('parses writing_scorecard and speaking_radar', () => {
    const parsed = parseEnglishTutorCustomComponents([
      {
        type: 'writing_scorecard',
        overall: 6.5,
        dimensions: [{ key: 'grammar', score: 6, max: 9 }],
      },
      {
        type: 'speaking_radar',
        dimensions: [{ key: 'fluency', score: 7, max: 9 }],
        summary: 'Clear structure',
      },
    ]);

    expect(parsed.map((item) => item.type)).toEqual([
      'writing_scorecard',
      'speaking_radar',
    ]);
  });

  it('parses essay_prompt ai_synthetic disclaimer flag', () => {
    const parsed = parseEnglishTutorCustomComponents([
      {
        type: 'essay_prompt',
        prompt_id: 'p1',
        title: 'Remote work',
        body: 'Discuss advantages and disadvantages.',
        provenance: 'ai_synthetic',
      },
    ]);

    expect(parsed[0]?.type).toBe('essay_prompt');
    if (parsed[0]?.type !== 'essay_prompt') return;
    expect(parsed[0].ai_synthetic).toBe(true);
  });

  it('parses progress_summary object from BE (PR #420)', () => {
    const parsed = parseEnglishTutorCustomComponents([
      {
        type: 'progress_summary',
        trend: 'improving',
        window: { n: 5, from: 5.5, to: 6.5, delta: 1.0 },
        current_estimate: 6.5,
        resolved_tags: ['grammar.accuracy'],
      },
    ]);

    expect(parsed).toHaveLength(1);
    expect(parsed[0]?.type).toBe('progress_summary');
    if (parsed[0]?.type !== 'progress_summary') return;
    expect(parsed[0].trend).toBe('improving');
    expect(parsed[0].current_estimate).toBe(6.5);
    expect(parsed[0].window?.delta).toBe(1);
    expect(parsed[0].resolved_tags).toEqual(['grammar.accuracy']);
  });

  it('parses legacy progress_summary items array', () => {
    const parsed = parseEnglishTutorCustomComponents([
      {
        type: 'progress_summary',
        items: [{ label: 'Sessions', value: '5' }],
      },
    ]);

    expect(parsed[0]?.type).toBe('progress_summary');
    if (parsed[0]?.type !== 'progress_summary') return;
    expect(parsed[0].items).toEqual([{ label: 'Sessions', value: '5' }]);
  });

  it('skips citation_list and unknown types', () => {
    const parsed = parseEnglishTutorCustomComponents([
      { type: 'citation_list', items: [] },
      { type: 'unknown_widget' },
      {
        type: 'model_answer',
        text: 'Sample answer',
      },
    ]);

    expect(parsed).toHaveLength(1);
    expect(parsed[0]?.type).toBe('model_answer');
  });
});

describe('isLowConfidenceMeta', () => {
  it('returns true only for low confidence', () => {
    expect(isLowConfidenceMeta({ confidence: 'low' })).toBe(true);
    expect(isLowConfidenceMeta({ confidence: 'medium' })).toBe(false);
    expect(isLowConfidenceMeta(undefined)).toBe(false);
  });
});

describe('isEnglishTutorReviseAction', () => {
  it('matches revise CTA action types', () => {
    expect(isEnglishTutorReviseAction('submit_essay_revision')).toBe(true);
    expect(isEnglishTutorReviseAction('revise_essay')).toBe(true);
    expect(isEnglishTutorReviseAction('open_interview')).toBe(false);
  });
});
