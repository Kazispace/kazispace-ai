import { describe, expect, it } from 'vitest';

import {
  getRecommendedStrategyId,
  isStrategySelectActions,
  resolveActiveStrategySelectActions,
  resolveStrategySelectSubmit,
  strategyIdFromPayload,
} from '@/lib/strategy-select';
import type { ChatNextAction } from '@/types/chat-envelope';

const strategyActions: ChatNextAction[] = [
  {
    type: 'strategy_select',
    label: { zh: '针对 JD 优化' },
    payload: '__strategy:jd_tailor',
  },
  {
    type: 'strategy_select',
    label: { zh: '精修当前版本' },
    payload: '__strategy:continue_current',
  },
];

describe('strategy-select', () => {
  it('detects strategy_select action sets', () => {
    expect(isStrategySelectActions(strategyActions)).toBe(true);
    expect(
      isStrategySelectActions([{ type: 'strategy_select' }, { type: 'confirm' }])
    ).toBe(false);
  });

  it('parses strategy id from payload', () => {
    expect(strategyIdFromPayload('__strategy:jd_tailor')).toBe('jd_tailor');
    expect(strategyIdFromPayload('confirm')).toBeNull();
  });

  it('reads recommended_strategy_id from assistant meta', () => {
    expect(
      getRecommendedStrategyId({ recommended_strategy_id: 'jd_tailor' })
    ).toBe('jd_tailor');
    expect(getRecommendedStrategyId({})).toBeUndefined();
  });

  it('hides strategy_select after a user reply', () => {
    const messages = [
      { role: 'assistant', nextActions: strategyActions },
      { role: 'user', content: 'picked' },
    ];
    expect(resolveActiveStrategySelectActions(messages, 0)).toBeUndefined();
    expect(resolveActiveStrategySelectActions([messages[0]], 0)).toEqual(
      strategyActions
    );
  });

  it('builds payload + display label for submit', () => {
    expect(resolveStrategySelectSubmit(strategyActions[0], 'zh')).toEqual({
      payload: '__strategy:jd_tailor',
      display: '针对 JD 优化',
    });
    expect(resolveStrategySelectSubmit({ type: 'confirm' }, 'zh')).toBeNull();
  });
});
