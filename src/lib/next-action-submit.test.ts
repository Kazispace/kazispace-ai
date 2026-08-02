import { describe, expect, it } from 'vitest';

import {
  isTransportPayload,
  strategyIdFromPayload,
  taskIdFromPayload,
} from '@/lib/action-payload';
import { resolveActionSelectSubmit } from '@/lib/next-action-submit';
import type { ChatNextAction } from '@/types/chat-envelope';

describe('next-action-submit (KAZI-469)', () => {
  const strategyAction: ChatNextAction = {
    type: 'strategy_select',
    label: { zh: '能力画像驱动重塑', en: 'Capability profile' },
    payload: '__strategy:capability_profile',
  };

  it('builds display + meta for strategy_select', () => {
    expect(resolveActionSelectSubmit(strategyAction, 'zh')).toEqual({
      display: '能力画像驱动重塑',
      meta: {
        action_type: 'strategy_select',
        action_payload: '__strategy:capability_profile',
        strategy_id: 'capability_profile',
      },
    });
  });

  it('builds display + meta for task_select', () => {
    const taskAction: ChatNextAction = {
      type: 'task_select',
      label: { zh: '新建任务', en: 'New task' },
      payload: '__task:new',
    };
    expect(resolveActionSelectSubmit(taskAction, 'zh')).toEqual({
      display: '新建任务',
      meta: {
        action_type: 'task_select',
        action_payload: '__task:new',
        task_id: 'new',
      },
    });
  });

  it('ignores generic actions without transport payload', () => {
    expect(
      resolveActionSelectSubmit(
        { type: 'return_to_clinic', label: { zh: '返回' } },
        'zh'
      )
    ).toBeNull();
  });
});

describe('action-payload', () => {
  it('parses strategy and task ids', () => {
    expect(strategyIdFromPayload('__strategy:continue_current')).toBe(
      'continue_current'
    );
    expect(taskIdFromPayload('__task:new')).toBe('new');
    expect(isTransportPayload('__action:regenerate')).toBe(true);
  });
});
