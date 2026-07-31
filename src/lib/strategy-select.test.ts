import { describe, expect, it } from 'vitest';

import {
  getStrategySelectRationale,
  hydrateStrategyPayloadUserLabels,
  isStrategySelectActions,
  isStrategySelectRecommended,
  isStrategyStartCta,
  partitionNextActions,
  resolveActiveNextActions,
  resolveStrategySelectReply,
  resolveStrategySelectSubmit,
  strategyIdFromPayload,
} from '@/lib/strategy-select';
import type { ChatNextAction } from '@/types/chat-envelope';

/** Sample A — multi-candidate (#309 / T396-10). */
const sampleAActions: ChatNextAction[] = [
  {
    type: 'strategy_select',
    label: { zh: '在现有版本上精修', en: 'Refine current version' },
    payload: '__strategy:continue_current',
    meta: { rationale: '改动最小', recommended: true },
  },
  {
    type: 'strategy_select',
    label: { zh: 'ATS 友好化', en: 'ATS-friendly polish' },
    payload: '__strategy:ats_hardening',
    meta: { rationale: '提升 ATS 通过率' },
  },
];

/** Sample B — Start CTA (#309 / T396-11). */
const sampleBActions: ChatNextAction[] = [
  {
    type: 'strategy_select',
    label: { zh: '开始 — 精修', en: 'Refine' },
    payload: '__strategy:continue_current',
    meta: {
      confirm_skipped: true,
      recommended: true,
      rationale: '低改动',
    },
  },
];

describe('strategy-select', () => {
  it('partitions mixed strategy_select and generic actions (P2-1)', () => {
    const mixed: ChatNextAction[] = [
      ...sampleAActions,
      { type: 'return_to_clinic', label: { zh: '取消' } },
    ];
    expect(isStrategySelectActions(mixed)).toBe(false);
    expect(partitionNextActions(mixed)).toEqual({
      strategyActions: sampleAActions,
      genericActions: [{ type: 'return_to_clinic', label: { zh: '取消' } }],
    });
  });

  it('detects Start CTA shape (P2-2)', () => {
    expect(isStrategyStartCta(sampleBActions)).toBe(true);
    expect(isStrategyStartCta(sampleAActions)).toBe(false);
  });

  it('reads recommended and rationale from action.meta (#309)', () => {
    expect(isStrategySelectRecommended(sampleAActions[0]!)).toBe(true);
    expect(isStrategySelectRecommended(sampleAActions[1]!)).toBe(false);
    expect(getStrategySelectRationale(sampleAActions[0]!)).toBe('改动最小');
  });

  it('hydrates persisted strategy payload to label (P2-5)', () => {
    const messages = [
      {
        role: 'assistant',
        content: 'pick',
        nextActions: sampleAActions,
      },
      { role: 'user', content: '__strategy:continue_current' },
    ];
    const hydrated = hydrateStrategyPayloadUserLabels(messages, 'zh');
    expect(hydrated[1]?.content).toBe('在现有版本上精修');
  });

  it('deactivates pending CTAs after a user reply', () => {
    const messages = [
      { role: 'assistant', nextActions: sampleAActions },
      { role: 'user', content: 'picked' },
    ];
    expect(resolveActiveNextActions(messages, 0)).toBeUndefined();
    expect(resolveActiveNextActions([messages[0]], 0)).toEqual(sampleAActions);
  });

  it('resolves historical strategy_select reply by payload or label', () => {
    const messages = [
      { role: 'assistant', nextActions: sampleAActions },
      { role: 'user', content: '__strategy:continue_current' },
    ];
    expect(resolveStrategySelectReply(messages, 0, 'zh')).toBe(
      '__strategy:continue_current'
    );

    const hydrated = [
      { role: 'assistant', nextActions: sampleAActions },
      { role: 'user', content: '在现有版本上精修' },
    ];
    expect(resolveStrategySelectReply(hydrated, 0, 'zh')).toBe(
      '__strategy:continue_current'
    );
    expect(resolveStrategySelectReply(messages, 0, 'zh')).not.toBeNull();
    expect(resolveStrategySelectReply([messages[0]!], 0, 'zh')).toBeNull();
  });

  it('builds payload + display label for submit', () => {
    expect(resolveStrategySelectSubmit(sampleAActions[0]!, 'zh')).toEqual({
      payload: '__strategy:continue_current',
      display: '在现有版本上精修',
    });
  });

  it('parses strategy id from payload', () => {
    expect(strategyIdFromPayload('__strategy:jd_tailor')).toBe('jd_tailor');
  });
});
