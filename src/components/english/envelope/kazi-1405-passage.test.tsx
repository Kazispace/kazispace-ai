/**
 * @vitest-environment jsdom
 *
 * KAZI-1405 · the `passage` form (UI repo reply-form 0.3.0 "Passages"), driven
 * by the backend's real forms (`__fixtures__/kazi1405_passage_forms.json`,
 * the output of `form_schema.passage_form` at backend main `8147982a`) and the
 * real `zh.json` / `en.json` — ⛔ no hand-written shapes for the two shipped kinds.
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
import {
  buildEtFormSubmit,
  buildEtPassageSubmit,
  parseEtForm,
  splitPassageMarkers,
  type EtForm,
} from '@/lib/english-tutor/form';
import fixture from '@/lib/english-tutor/__fixtures__/kazi1405_passage_forms.json';

const MESSAGES = {
  zh: mergeMessages(en, zh) as AbstractIntlMessages,
  en: en as unknown as AbstractIntlMessages,
};
type Kind = 'passage_cloze' | 'grammar_fill';
const form = (kind: Kind, locale: 'zh' | 'en') => parseEtForm(fixture[kind][locale]) as EtForm;

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

function render(f: EtForm, locale: 'zh' | 'en', props: Partial<React.ComponentProps<typeof EtFormBlock>> = {}) {
  act(() => {
    root.render(
      <NextIntlClientProvider locale={locale} messages={MESSAGES[locale]} timeZone="UTC">
        <EtFormBlock form={f} active onSubmit={vi.fn()} {...props} />
      </NextIntlClientProvider>
    );
  });
}

function dialog() {
  return document.body.querySelector('[role="dialog"]') as HTMLElement | null;
}

function openDialog() {
  const button = container.querySelector('[data-et-passage] button') as HTMLButtonElement;
  act(() => button.click());
  const d = dialog();
  if (!d) throw new Error('dialog did not open');
  return d;
}

function blank(n: string) {
  const el = dialog()?.querySelector(`[data-et-passage-blank="${n}"]`);
  if (!el) throw new Error(`blank ${n} not rendered`);
  return el as HTMLElement;
}

function pick(n: string, option: string) {
  const input = (Array.from(blank(n).querySelectorAll('input[type="radio"]')) as HTMLInputElement[]).find(
    (i) => i.value === option
  );
  if (!input) throw new Error(`option ${option} not found`);
  act(() => input.click());
}

function type(n: string, value: string) {
  const input = blank(n).querySelector('input[type="text"]') as HTMLInputElement;
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

function submitButton() {
  const buttons = Array.from(dialog()?.querySelectorAll('button') ?? []) as HTMLButtonElement[];
  return buttons[buttons.length - 1];
}

describe('KAZI-1405 · parseEtForm reads the backend passage form', () => {
  it.each(['passage_cloze', 'grammar_fill'] as Kind[])('%s parses with every blank, in order', (kind) => {
    const f = form(kind, 'zh');
    const raw = fixture[kind].zh.form;
    expect(f).toMatchObject({ kind: 'passage', presentation: 'modal', control: 'passage', form_id: raw.form_id });
    expect(f.passage?.item_kind).toBe(kind);
    expect(f.passage?.blanks.map((b) => b.blank)).toEqual(raw.item.blanks.map((b) => b.blank));
    expect(f.passage?.blanks.length).toBe(kind === 'passage_cloze' ? 15 : 10);
  });

  it('a passage with no blanks, no text, or a repeated blank is dropped whole (⛔ half a passage)', () => {
    const base = fixture.passage_cloze.en;
    const without = (patch: Record<string, unknown>) =>
      parseEtForm({ form: { ...base.form, item: { ...base.form.item, ...patch } } });
    expect(without({ blanks: [] })).toBeNull();
    expect(without({ passage_text: '' })).toBeNull();
    expect(without({ blanks: [...base.form.item.blanks, base.form.item.blanks[0]] })).toBeNull();
    expect(parseEtForm({ form: { ...base.form, item: undefined } })).toBeNull();
    expect(parseEtForm({ form: { ...base.form, presentation: 'inline' } })).toBeNull();
  });

  it('marks only (n) that name a blank: "(go)" and other numbers stay text', () => {
    const parts = splitPassageMarkers('It (2) ___ (practise) for (1,500) years; (11) is not a blank.', ['1', '2']);
    expect(parts.filter((p) => p.blank).map((p) => p.text)).toEqual(['(2)']);
    expect(parts.map((p) => p.text).join('')).toBe('It (2) ___ (practise) for (1,500) years; (11) is not a blank.');
  });
});

describe('KAZI-1405 · passage_cloze (real backend form, real copy)', () => {
  it('the card names the kind and opens a dialog with the passage, 15 markers and 15 four-way choices', () => {
    render(form('passage_cloze', 'zh'), 'zh');
    expect(container.textContent).toContain('篇章练习');
    expect(container.textContent).toContain('完形填空');
    expect(container.textContent).toContain('已作答 0/15');
    expect(container.textContent).not.toContain('english.form');

    const d = openDialog();
    expect(d.getAttribute('aria-modal')).toBe('true');
    expect(d.querySelector('[data-et-passage-text]')?.textContent).toBe(fixture.passage_cloze.zh.form.item.passage_text);
    expect(d.querySelectorAll('[data-et-passage-marker]')).toHaveLength(15);
    const blanks = d.querySelectorAll('[data-et-passage-blank]');
    expect(blanks).toHaveLength(15);
    blanks.forEach((b) => expect(b.querySelectorAll('input[type="radio"]')).toHaveLength(4));
    expect(blank('1').textContent).toContain('第 1 空');
    expect(blank('1').textContent).toContain('B) volunteered');
  });

  it('sends the option text with its "A)" prefix, keyed by blank, unanswered blanks left out', async () => {
    const onSubmit = vi.fn();
    const f = form('passage_cloze', 'zh');
    render(f, 'zh', { onSubmit });
    openDialog();
    expect(submitButton().disabled).toBe(true);
    pick('1', 'B) volunteered');
    pick('3', fixture.passage_cloze.zh.form.item.blanks[2].options[0]);
    expect(dialog()?.textContent).toContain('已作答 2/15');
    expect(submitButton().textContent).toBe('提交答案');
    await act(async () => submitButton().click());

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const sent = onSubmit.mock.calls[0][0];
    expect(sent.meta).toMatchObject({ action_type: 'et_form_submit', form_id: f.form_id });
    expect(JSON.parse(sent.meta.action_payload)).toEqual({
      answers: { '1': 'B) volunteered', '3': fixture.passage_cloze.zh.form.item.blanks[2].options[0] },
    });
    expect(sent.display.split('\n')).toHaveLength(15);
    expect(sent.display.split('\n')[0]).toBe('(1) B) volunteered');
    expect(sent.display.split('\n')[1]).toBe('(2) —');
    expect(dialog()).toBeNull(); // closes after a send
  });

  it('answers survive closing the dialog; the card then says "continue"', () => {
    render(form('passage_cloze', 'en'), 'en');
    openDialog();
    pick('2', 'B) useful');
    const close = dialog()?.querySelector(`button[aria-label="Close"]:not(.absolute)`) as HTMLButtonElement;
    act(() => close.click());
    expect(dialog()).toBeNull();
    expect(container.textContent).toContain('1 of 15 answered');
    expect(container.textContent).toContain('Continue answering');
    openDialog();
    expect((blank('2').querySelector('input:checked') as HTMLInputElement).value).toBe('B) useful');
  });

  it('frozen (not the latest message): the dialog cannot be opened', () => {
    render(form('passage_cloze', 'zh'), 'zh', { active: false, onSubmit: vi.fn() });
    const button = container.querySelector('[data-et-passage] button') as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    act(() => button.click());
    expect(dialog()).toBeNull();
    expect(container.querySelector('[data-et-form-active="false"]')).not.toBeNull();
  });
});

describe('KAZI-1405 · grammar_fill (real backend form, real copy)', () => {
  it('one text box per blank, with the 1–3 words hint; typed words are sent trimmed', async () => {
    const onSubmit = vi.fn();
    render(form('grammar_fill', 'en'), 'en', { onSubmit });
    expect(container.textContent).toContain('Grammar fill-in');
    const d = openDialog();
    expect(d.querySelectorAll('[data-et-passage-blank] input[type="text"]')).toHaveLength(10);
    expect((blank('2').querySelector('input') as HTMLInputElement).placeholder).toBe('Type 1–3 words');
    type('1', ' the ');
    type('2', 'has been practised');
    await act(async () => submitButton().click());
    expect(JSON.parse(onSubmit.mock.calls[0][0].meta.action_payload)).toEqual({
      answers: { '1': 'the', '2': 'has been practised' },
    });
  });
});

describe('KAZI-1405 · step-2 kinds and unknown inputs (contract 0.3.0)', () => {
  const base = fixture.passage_cloze.en.form;

  it('seven_choose_five: the shared options are shown once and every gap picks from them', () => {
    const shared = ['A) one', 'B) two', 'C) three', 'D) four', 'E) five', 'F) six', 'G) seven'];
    const f = parseEtForm({
      form: {
        ...base,
        item: {
          item_id: 'x7',
          item_kind: 'seven_choose_five',
          passage_text: 'First (1). Then (2). Then (3). Then (4). Last (5).',
          shared_options: shared,
          blanks: ['1', '2', '3', '4', '5'].map((n) => ({ blank: n, input: 'choice' })),
        },
      },
    }) as EtForm;
    render(f, 'en');
    const d = openDialog();
    expect(d.querySelector('[data-et-passage-shared-options]')?.textContent).toContain('G) seven');
    expect(blank('5').querySelectorAll('input[type="radio"]')).toHaveLength(7);
    expect(container.textContent).toContain('Seven-choose-five');
  });

  it('reading_comprehension: each question shows its stem', () => {
    const f = parseEtForm({
      form: {
        ...base,
        item: {
          item_id: 'rc',
          item_kind: 'reading_comprehension',
          passage_text: 'A short passage.',
          blanks: [{ blank: 1, input: 'choice', stem: 'What is it about?', options: ['A) a', 'B) b', 'C) c', 'D) d'] }],
        },
      },
    }) as EtForm;
    expect(f.passage?.blanks[0].blank).toBe('1'); // a numeric blank number is read as its string
    render(f, 'en');
    openDialog();
    expect(blank('1').textContent).toContain('What is it about?');
    expect(blank('1').querySelectorAll('input[type="radio"]')).toHaveLength(4);
  });

  it('an unknown input, or a choice with nothing to pick from, is a plain text box (⛔ nothing)', () => {
    const f = parseEtForm({
      form: {
        ...base,
        item: {
          item_id: 'u',
          item_kind: 'matching',
          passage_text: 'Match (1) and (2).',
          blanks: [
            { blank: '1', input: 'drag' },
            { blank: '2', input: 'choice' },
          ],
        },
      },
    }) as EtForm;
    act(() => {
      root.render(
        <NextIntlClientProvider locale="en" messages={MESSAGES.en} timeZone="UTC" onError={() => {}}>
          <EtFormBlock form={f} active onSubmit={vi.fn()} />
        </NextIntlClientProvider>
      );
    });
    openDialog();
    expect(blank('1').querySelector('input[type="text"]')).not.toBeNull();
    expect(blank('2').querySelector('input[type="text"]')).not.toBeNull();
    expect(container.textContent).not.toContain('passageKind');
  });

  it('the text path never sends a passage as one typed string', () => {
    const f = form('passage_cloze', 'en');
    expect(buildEtFormSubmit(f, { text: 'B C A' })).toBeNull();
    expect(buildEtPassageSubmit(f, {})).toBeNull();
    expect(buildEtPassageSubmit(f, { '1': '   ' })).toBeNull();
  });
});
