/**
 * @vitest-environment jsdom
 *
 * KAZI-1075 · the `objective_set` card (ET SSOT §5.3.6.7) driven by the
 * backend's real form (`__fixtures__/kazi1075_objective_set_form.json`, the
 * output of `form_schema.objective_set_form` at backend main `9957a9cb`) and
 * the real `zh.json` / `en.json` — ⛔ no hand-written shapes, no stubbed copy.
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { NextIntlClientProvider, type AbstractIntlMessages } from 'next-intl';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/hooks/use-voice-to-chat', () => ({
  useVoiceToChat: () => ({ handleSendAudio: vi.fn(), isTranscribing: false }),
}));

import { EtFormBlock } from '@/components/english/envelope/et-form-block';
import en from '@/lib/i18n/en.json';
import zh from '@/lib/i18n/zh.json';
import { mergeMessages } from '@/lib/i18n/merge-messages';
import { parseEtForm, type EtForm } from '@/lib/english-tutor/form';
import fixture from '@/lib/english-tutor/__fixtures__/kazi1075_objective_set_form.json';

const MESSAGES = {
  zh: mergeMessages(en, zh) as AbstractIntlMessages,
  en: en as unknown as AbstractIntlMessages,
};
const FORM = {
  zh: parseEtForm(fixture.zh) as EtForm,
  en: parseEtForm(fixture.en) as EtForm,
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
});

function render(locale: 'zh' | 'en', props: Partial<React.ComponentProps<typeof EtFormBlock>> = {}) {
  act(() => {
    root.render(
      <NextIntlClientProvider locale={locale} messages={MESSAGES[locale]} timeZone="UTC">
        <EtFormBlock form={FORM[locale]} active {...props} />
      </NextIntlClientProvider>
    );
  });
  return container;
}

function item(id: string) {
  const el = container.querySelector(`[data-et-objective-item="${id}"]`);
  if (!el) throw new Error(`item ${id} not rendered`);
  return el as HTMLElement;
}

function pick(id: string, option: string) {
  const input =
    (Array.from(item(id).querySelectorAll('input[type="radio"]')) as HTMLInputElement[]).find(
      (i) => i.value === option
    ) ?? null;
  if (!input) throw new Error(`option ${option} not found`);
  act(() => input.click());
}

function type(id: string, value: string) {
  const input = item(id).querySelector('input[type="text"]') as HTMLInputElement;
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

function submitButton() {
  return container.querySelector('button[type="submit"]') as HTMLButtonElement;
}

async function submit() {
  await act(async () => {
    container.querySelector('form')?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  });
}

describe('KAZI-1075 · objective_set card (real backend form, real copy)', () => {
  it('shows every question in the backend order, with the right control per kind', () => {
    render('zh');
    const ids = Array.from(container.querySelectorAll('[data-et-objective-item]')).map((el) =>
      el.getAttribute('data-et-objective-item')
    );
    expect(ids).toEqual(fixture.set_item_ids);
    expect(item('ielts_g_article_001').querySelectorAll('input[type="radio"]')).toHaveLength(4);
    expect(item('ielts_g_article_012').querySelector('input[type="text"]')).not.toBeNull();
    expect(item('ielts_g_article_016').querySelectorAll('input[type="radio"]')).toHaveLength(4);
  });

  it('uses the real copy: title, prompt, kind chips and submit label (zh and en)', () => {
    render('zh');
    expect(container.textContent).toContain('练习题');
    expect(container.textContent).toContain('逐题作答后一次提交');
    expect(item('ielts_g_article_001').textContent).toContain('选择');
    expect(item('ielts_g_article_012').textContent).toContain('填空');
    expect(item('ielts_g_article_016').textContent).toContain('改错');
    expect(submitButton().textContent).toBe('提交答案');
    expect(container.textContent).toContain('已作答 0/5');
    expect(container.textContent).not.toContain('english.form');

    render('en');
    expect(item('ielts_g_article_016').textContent).toContain('Find the error');
    expect(submitButton().textContent).toBe('Submit answers');
    expect(container.textContent).toContain('0 of 5 answered');
  });

  it('underlines the four parts of the error-correction sentence', () => {
    render('en');
    const underlined = Array.from(item('ielts_g_article_016').querySelectorAll('u')).map((u) => u.textContent);
    const ec = fixture.en.form.items.find((i) => i.item_id === 'ielts_g_article_016');
    expect(underlined).toEqual(ec?.options);
  });

  it('submits one JSON payload with only the answered questions', async () => {
    const onSubmit = vi.fn();
    render('zh', { onSubmit });
    expect(submitButton().disabled).toBe(true); // nothing answered yet
    pick('ielts_g_article_001', 'an');
    type('ielts_g_article_012', '  the ');
    pick('ielts_g_article_016', 'was the nurse');
    expect(container.textContent).toContain('已作答 3/5');
    expect(submitButton().disabled).toBe(false);
    await submit();

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const sent = onSubmit.mock.calls[0][0];
    expect(sent.meta).toMatchObject({ action_type: 'et_form_submit', form_id: fixture.zh.form.form_id });
    expect(JSON.parse(sent.meta.action_payload)).toEqual({
      answers: {
        ielts_g_article_001: 'an',
        ielts_g_article_012: 'the',
        ielts_g_article_016: 'was the nurse',
      },
    });
    expect(sent.display).toBe('1. an\n2. the\n3. was the nurse\n4. —\n5. —');
  });

  it('frozen (not the latest message): every control disabled, cannot submit', () => {
    render('zh', { active: false, onSubmit: vi.fn() });
    container.querySelectorAll('fieldset').forEach((f) => expect((f as HTMLFieldSetElement).disabled).toBe(true));
    container.querySelectorAll('input[type="text"]').forEach((i) => expect((i as HTMLInputElement).disabled).toBe(true));
    expect(submitButton().disabled).toBe(true);
    expect(container.querySelector('[data-et-form-active="false"]')).not.toBeNull();
  });

  it('a question kind this build does not know renders without a key-path chip', () => {
    const raw = structuredClone(fixture.en);
    raw.form.items[1] = { ...raw.form.items[1], item_kind: 'matching' };
    const form = parseEtForm(raw) as EtForm;
    act(() => {
      root.render(
        <NextIntlClientProvider locale="en" messages={MESSAGES.en} timeZone="UTC" onError={() => {}}>
          <EtFormBlock form={form} active />
        </NextIntlClientProvider>
      );
    });
    expect(item('ielts_g_article_012').textContent).not.toContain('objectiveKind');
    expect(item('ielts_g_article_012').querySelector('input[type="text"]')).not.toBeNull();
  });
});
