/**
 * @vitest-environment jsdom
 *
 * KAZI-1505 — Chat's Cancel on an answer card (kazispace-ui D46 · Reply form 0.4.1 "Cancel", Chat row; ET SSOT
 * §5.3.6.11). Owen, 2026-11-27, quoted as written: "一个建议： 答题卡末端除了提交键 还需要取消键" and, on charging,
 * "Decision waiting on me : 1. Yes, cost LLM credit."
 *
 * Through the real Chat row: after asking, Cancel sends the same form's `form_id` with `action_type =
 * et_form_cancel` and the bubble text `english.form.dropSent`, through the surface's form-answer channel (so the
 * bubble, "Not sent" and retry work as for any answer). Nothing is sent while actions are disabled.
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next-intl', () => ({
  useTranslations: (ns?: string) =>
    Object.assign((key: string) => (ns ? `${ns}.${key}` : key), { has: () => false }),
  useLocale: () => 'zh',
}));

import { SpaceMessageRow } from '@/components/spaces/space-message-row';
import { buildEtFormCancel, ET_FORM_CANCEL_ACTION, parseEtForm, type EtForm } from '@/lib/english-tutor/form';
import type { SpaceChatMessage } from '@/lib/spaces/turn';

const SET_META = {
  form: {
    form_id: 'et:objective_set:cet4_g_1',
    kind: 'objective_set',
    presentation: 'inline',
    control: 'objective_set',
    title: 'Set',
    submit_label: '提交答案',
    options: [],
    items: [{ item_id: 'cet4_g_1', item_kind: 'mcq', prompt_text: 'p', options: ['a', 'b'] }],
  },
};

let container: HTMLDivElement;
let root: Root;

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});
beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  document.body.innerHTML = '';
});

function row(onEtFormSubmit: ReturnType<typeof vi.fn>, actionsDisabled = false) {
  const noop = () => undefined;
  const message = {
    id: 'assistant_1',
    role: 'assistant',
    content: '这一组 5 道语法题。',
    assistantMeta: SET_META,
    streamComplete: true,
  } as SpaceChatMessage;
  act(() =>
    root.render(
      <SpaceMessageRow
        message={message}
        strategy={{ latestTurn: true }}
        locale="zh"
        actionsDisabled={actionsDisabled}
        onRetryById={noop}
        onNextAction={noop}
        onFocusComposer={noop}
        onExamSelect={noop}
        onEtFormSubmit={onEtFormSubmit}
        onJobCardClick={noop}
      />
    )
  );
}

const button = (text: string) =>
  Array.from(document.querySelectorAll('button')).find((b) => b.textContent?.includes(text)) ?? null;

describe('Chat: Cancel on the answer card (KAZI-1505)', () => {
  it('builds the cancel send: same form_id, et_form_cancel, no payload', () => {
    const form = parseEtForm(SET_META) as EtForm;
    expect(buildEtFormCancel(form, '不做这一组了')).toEqual({
      display: '不做这一组了',
      meta: { action_type: ET_FORM_CANCEL_ACTION, form_id: 'et:objective_set:cet4_g_1' },
    });
  });

  it('asks first, then sends the cancel through the form-answer channel', async () => {
    const onEtFormSubmit = vi.fn().mockResolvedValue(true);
    row(onEtFormSubmit);
    const cancel = container.querySelector('[data-et-form-cancel]') as HTMLButtonElement;
    expect(cancel).not.toBeNull();
    act(() => cancel.click());
    act(() => button('english.form.dropConfirmNo')!.click());
    expect(onEtFormSubmit).not.toHaveBeenCalled();
    act(() => cancel.click());
    await act(async () => {
      button('english.form.dropConfirmYes')!.click();
    });
    expect(onEtFormSubmit).toHaveBeenCalledTimes(1);
    expect(onEtFormSubmit).toHaveBeenCalledWith({
      display: 'english.form.dropSent',
      meta: { action_type: 'et_form_cancel', form_id: 'et:objective_set:cet4_g_1' },
    });
  });

  it('no Cancel while actions are disabled (a send in flight)', () => {
    row(vi.fn(), true);
    expect(container.querySelector('[data-et-form-cancel]')).toBeNull();
  });
});
