import { describe, expect, it } from 'vitest';

import {
  isTransportPayload,
  strategyIdFromPayload,
  taskIdFromPayload,
} from '@/lib/action-payload';
import { parseAssistantEnvelope } from '@/lib/chat-envelope';
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

describe('et_next_practice (KAZI-1082)', () => {
  // The shape the BE emits (`next_practice.next_action`) inside `assistant_response`.
  const raw = {
    assistant_response: {
      content: '…\n\n下一步：冠词误用 / 缺失（语法）还比较弱，可以专门练一组。',
      next_actions: [
        {
          type: 'et_next_practice',
          label: { zh: '再来一组 · 冠词误用 / 缺失', en: 'New set · articles' },
          payload: '再来一组',
          meta: { focus_tag: 'grammar.article' },
        },
      ],
    },
  };

  it('survives parsing with its focus_tag', () => {
    const [action] = parseAssistantEnvelope(raw).nextActions;
    expect(action).toEqual(raw.assistant_response.next_actions[0]);
  });

  it('a click shows the label and sends the payload + focus_tag', () => {
    const [action] = parseAssistantEnvelope(raw).nextActions;
    expect(resolveActionSelectSubmit(action, 'zh')).toEqual({
      display: '再来一组 · 冠词误用 / 缺失',
      meta: {
        action_type: 'et_next_practice',
        action_payload: '再来一组',
        focus_tag: 'grammar.article',
      },
    });
    expect(resolveActionSelectSubmit(action, 'en')?.display).toBe('New set · articles');
  });

  it('a click without a focus_tag still sends the payload', () => {
    expect(
      resolveActionSelectSubmit(
        { type: 'et_next_practice', label: { zh: '练口语 · 发音' }, payload: '练口语' },
        'zh'
      )?.meta
    ).toEqual({ action_type: 'et_next_practice', action_payload: '练口语' });
  });

  it('other action types never forward a focus_tag', () => {
    const submit = resolveActionSelectSubmit(
      {
        type: 'strategy_select',
        label: { zh: 'x' },
        payload: '__strategy:continue_current',
        meta: { focus_tag: 'grammar.article' },
      },
      'zh'
    );
    expect(submit?.meta.focus_tag).toBeUndefined();
  });
});
