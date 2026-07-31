import { describe, expect, it } from 'vitest';

import { parseAssistantEnvelope } from '@/lib/chat-envelope';
import {
  getStrategySelectRationale,
  isStrategySelectActions,
  isStrategySelectRecommended,
  resolveActiveStrategySelectActions,
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
  it('detects strategy_select action sets', () => {
    expect(isStrategySelectActions(sampleAActions)).toBe(true);
    expect(
      isStrategySelectActions([{ type: 'strategy_select' }, { type: 'confirm' }])
    ).toBe(false);
  });

  it('parses strategy id from payload', () => {
    expect(strategyIdFromPayload('__strategy:jd_tailor')).toBe('jd_tailor');
    expect(strategyIdFromPayload('confirm')).toBeNull();
  });

  it('reads recommended and rationale from action.meta (#309)', () => {
    expect(isStrategySelectRecommended(sampleAActions[0]!)).toBe(true);
    expect(isStrategySelectRecommended(sampleAActions[1]!)).toBe(false);
    expect(getStrategySelectRationale(sampleAActions[0]!)).toBe('改动最小');
    expect(getStrategySelectRationale(sampleAActions[1]!)).toBe('提升 ATS 通过率');
    expect(sampleBActions[0]?.meta?.confirm_skipped).toBe(true);
  });

  it('parses action.meta from assistant envelope', () => {
    const parsed = parseAssistantEnvelope({
      assistant_response: {
        content: 'Pick',
        next_actions: [
          {
            type: 'strategy_select',
            payload: '__strategy:continue_current',
            meta: { rationale: '改动最小', recommended: true },
          },
        ],
        meta: { workflow_phase: 'intent_confirm' },
      },
    });
    expect(parsed.nextActions[0]?.meta?.recommended).toBe(true);
    expect(parsed.nextActions[0]?.meta?.rationale).toBe('改动最小');
    expect(parsed.meta?.workflow_phase).toBe('intent_confirm');
    expect(parsed.meta?.recommended_strategy_id).toBeUndefined();
  });

  it('hides strategy_select after a user reply', () => {
    const messages = [
      { role: 'assistant', nextActions: sampleAActions },
      { role: 'user', content: 'picked' },
    ];
    expect(resolveActiveStrategySelectActions(messages, 0)).toBeUndefined();
    expect(resolveActiveStrategySelectActions([messages[0]], 0)).toEqual(
      sampleAActions
    );
  });

  it('builds payload + display label for submit', () => {
    expect(resolveStrategySelectSubmit(sampleAActions[0]!, 'zh')).toEqual({
      payload: '__strategy:continue_current',
      display: '在现有版本上精修',
    });
    expect(resolveStrategySelectSubmit({ type: 'confirm' }, 'zh')).toBeNull();
  });
});
