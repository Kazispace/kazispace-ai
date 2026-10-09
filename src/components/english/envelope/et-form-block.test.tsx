/**
 * @vitest-environment jsdom
 *
 * KAZI-1041 · EtFormBlock: what the user can do with each `meta.form`, and
 * that a frozen (non-latest) form cannot submit.
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));
vi.mock('@/hooks/use-voice-to-chat', () => ({
  useVoiceToChat: () => ({ handleSendAudio: vi.fn(), isTranscribing: false }),
}));
vi.mock('@/components/chat/voice-record-button', () => ({
  VoiceRecordButton: ({ disabled }: { disabled?: boolean }) => (
    <button type="button" data-testid="mic" disabled={disabled}>
      mic
    </button>
  ),
}));

import { EtFormBlock } from '@/components/english/envelope/et-form-block';
import { parseEtForm, type EtForm } from '@/lib/english-tutor/form';

const EXAM = parseEtForm({
  form: {
    form_id: 'et:exam_select',
    kind: 'exam_select',
    presentation: 'inline',
    control: 'radio',
    title: 'Pick',
    options: [
      { id: 'cet4', label: 'CET4' },
      { id: 'ielts', label: 'IELTS' },
    ],
    submit_label: 'OK',
  },
}) as EtForm;
const WRITING = parseEtForm({
  form: {
    form_id: 'et:writing_draft:q1',
    kind: 'writing_draft',
    presentation: 'modal',
    control: 'textarea',
    title: 'Write',
    prompt: 'Discuss.',
    submit_label: 'Submit essay',
    constraints: { min_words: 40, max_chars: 4000 },
  },
}) as EtForm;
const SPEAKING = parseEtForm({
  form: {
    form_id: 'et:speaking_answer:q2',
    kind: 'speaking_answer',
    presentation: 'inline',
    control: 'audio',
    title: 'Speak',
    prompt: 'Describe a person.',
    submit_label: 'Send',
    allow_text: true,
  },
}) as EtForm;

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

function render(node: React.ReactNode) {
  act(() => root.render(node));
}

function click(el: Element | null) {
  if (!el) throw new Error('element not found');
  act(() => {
    (el as HTMLElement).click();
  });
}

function typeInto(el: Element | null, value: string) {
  if (!el) throw new Error('element not found');
  const input = el as HTMLInputElement | HTMLTextAreaElement;
  const proto = Object.getPrototypeOf(input);
  act(() => {
    Object.getOwnPropertyDescriptor(proto, 'value')?.set?.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

function buttonByText(text: string, scope: ParentNode = document): HTMLButtonElement | null {
  return (
    Array.from(scope.querySelectorAll('button')).find((b) => b.textContent?.includes(text)) ?? null
  );
}

describe('EtFormBlock · radio (exam_select)', () => {
  it('submits the chosen option with its id as payload', async () => {
    const onSubmit = vi.fn();
    render(<EtFormBlock form={EXAM} active onSubmit={onSubmit} />);
    click(container.querySelector('input[value="ielts"]'));
    await act(async () => {
      container.querySelector('form')?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
    expect(onSubmit).toHaveBeenCalledWith({
      display: 'IELTS',
      meta: { action_type: 'et_form_submit', form_id: 'et:exam_select', action_payload: 'ielts' },
    });
  });

  it('frozen (not the latest message): disabled, says so, cannot submit', () => {
    const onSubmit = vi.fn();
    render(<EtFormBlock form={EXAM} active={false} onSubmit={onSubmit} />);
    expect(container.querySelector('fieldset')?.disabled).toBe(true);
    expect(container.textContent).toContain('frozen');
    expect(container.querySelector('[data-et-form-active="false"]')).not.toBeNull();
  });

  it('active but no handler (e.g. send in flight): disabled, not marked frozen', () => {
    render(<EtFormBlock form={EXAM} active />);
    expect(container.querySelector('fieldset')?.disabled).toBe(true);
    expect(container.textContent).not.toContain('frozen');
  });
});

describe('EtFormBlock · modal (writing_draft)', () => {
  it('opens a portaled editor with the prompt and submits the essay text', async () => {
    const onSubmit = vi.fn();
    render(<EtFormBlock form={WRITING} active onSubmit={onSubmit} />);
    click(buttonByText('open', container));

    const dialog = document.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();
    // KAZI-652 / KAZI-664 convention: dialogs portal out of the message list.
    expect(container.contains(dialog)).toBe(false);
    expect(dialog?.textContent).toContain('Discuss.');

    typeInto(dialog!.querySelector('textarea'), 'One two three');
    await act(async () => {
      buttonByText('Submit essay', dialog!)?.click();
    });
    expect(onSubmit).toHaveBeenCalledWith({
      display: 'One two three',
      meta: { action_type: 'et_form_submit', form_id: 'et:writing_draft:q1' },
    });
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });

  it('frozen: the editor cannot be opened', () => {
    render(<EtFormBlock form={WRITING} active={false} onSubmit={vi.fn()} />);
    expect(buttonByText('open', container)?.disabled).toBe(true);
  });
});

describe('EtFormBlock · inline audio (speaking_answer)', () => {
  it('offers the mic, and typing as a fallback when allow_text', async () => {
    const onSubmit = vi.fn();
    render(<EtFormBlock form={SPEAKING} active onSubmit={onSubmit} />);
    expect(container.querySelector('[data-testid="mic"]')).not.toBeNull();

    click(buttonByText('typeInstead', container));
    typeInto(container.querySelector('input[type="text"]'), 'My mentor');
    await act(async () => {
      container.querySelector('form')?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
    expect(onSubmit).toHaveBeenCalledWith({
      display: 'My mentor',
      meta: { action_type: 'et_form_submit', form_id: 'et:speaking_answer:q2' },
    });
  });

  it('no typing fallback when allow_text is false', () => {
    render(<EtFormBlock form={{ ...SPEAKING, allow_text: false }} active onSubmit={vi.fn()} />);
    expect(buttonByText('typeInstead', container)).toBeNull();
  });
});

const REVISION = parseEtForm({
  form: {
    form_id: 'et:writing_revision:q1',
    kind: 'writing_revision',
    presentation: 'modal',
    control: 'textarea',
    title: 'Revise',
    prompt: 'Discuss.',
    submit_label: 'Resubmit essay',
    constraints: { min_words: 40, max_chars: 4000 },
  },
}) as EtForm;

describe('EtFormBlock · modal (writing_revision · KAZI-1044)', () => {
  it('opens the editor prefilled with the graded essay and resubmits through the form channel', async () => {
    const onSubmit = vi.fn();
    render(<EtFormBlock form={REVISION} active prefill="My first essay." onSubmit={onSubmit} />);
    // Prefilled ⇒ the button reads "revise and resubmit".
    click(buttonByText('reopen', container));

    const dialog = document.querySelector('[role="dialog"]');
    expect((dialog?.querySelector('textarea') as HTMLTextAreaElement).value).toBe('My first essay.');

    typeInto(dialog!.querySelector('textarea'), 'My better essay.');
    await act(async () => {
      buttonByText('Resubmit essay', dialog!)?.click();
    });
    expect(onSubmit).toHaveBeenCalledWith({
      display: 'My better essay.',
      meta: { action_type: 'et_form_submit', form_id: 'et:writing_revision:q1' },
    });
  });

  it('the prefill never leaks into a first-draft editor', () => {
    render(<EtFormBlock form={WRITING} active prefill="My first essay." onSubmit={vi.fn()} />);
    click(buttonByText('open', container));
    expect((document.querySelector('[role="dialog"] textarea') as HTMLTextAreaElement).value).toBe('');
  });

  it('frozen: the revision editor cannot be opened', () => {
    render(<EtFormBlock form={REVISION} active={false} prefill="x" onSubmit={vi.fn()} />);
    expect(buttonByText('reopen', container)?.disabled).toBe(true);
  });
});
