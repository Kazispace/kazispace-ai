/**
 * @vitest-environment jsdom
 *
 * KAZI-1145 · CvFormBlock: what the user can do with each cv_builder
 * `meta.form`, what it sends, and that a frozen (non-latest) form can't.
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next-intl', () => ({
  useTranslations: (ns?: string) => (key: string, values?: Record<string, unknown>) =>
    `${ns ? `${ns}.` : ''}${key}${values ? JSON.stringify(values) : ''}`,
  useLocale: () => 'en',
}));
const uploadCvResumeFile = vi.fn();
vi.mock('@/lib/cv-input-api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/cv-input-api')>()),
  uploadCvResumeFile: (...args: unknown[]) => uploadCvResumeFile(...args),
}));
const fetchCvDocumentResume = vi.fn();
vi.mock('@/lib/cv-export-api', () => ({
  fetchCvDocumentResume: (...args: unknown[]) => fetchCvDocumentResume(...args),
}));

import { CvFormBlock } from '@/components/cv/cv-form-block';
import {
  clearCvWizardDraft,
  emptyCvWizardDraft,
  parseCvForm,
  readCvWizardDraft,
  writeCvWizardDraft,
  type CvForm,
} from '@/lib/cv-form';
import { useAuthStore } from '@/lib/store';
import {
  CV_PASTE_META,
  CV_START_META,
  CV_UPLOAD_META,
  CV_WIZARD_EDIT_META,
  CV_WIZARD_META,
  cvArchiveMeta,
} from '@/lib/__fixtures__/kazi-1145-cv-forms';

const START = parseCvForm(CV_START_META) as CvForm;
const UPLOAD = parseCvForm(CV_UPLOAD_META) as CvForm;
const PASTE = parseCvForm(CV_PASTE_META) as CvForm;
const WIZARD = parseCvForm(CV_WIZARD_META) as CvForm;
const WIZARD_EDIT = parseCvForm(CV_WIZARD_EDIT_META) as CvForm;
const ARCHIVE = parseCvForm(cvArchiveMeta(3)) as CvForm;
const ARCHIVE_MODAL = parseCvForm(cvArchiveMeta(9)) as CvForm;

let container: HTMLDivElement;
let root: Root;

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});
beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  uploadCvResumeFile.mockReset();
  fetchCvDocumentResume.mockReset();
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  document.body.innerHTML = '';
  clearCvWizardDraft(WIZARD.form_id);
  clearCvWizardDraft(WIZARD_EDIT.form_id);
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

async function clickAsync(el: Element | null) {
  if (!el) throw new Error('element not found');
  await act(async () => {
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
  return Array.from(scope.querySelectorAll('button')).find((b) => b.textContent?.trim() === text) ?? null;
}

function dialog(): HTMLElement {
  const el = document.querySelector('[role="dialog"]');
  if (!el) throw new Error('dialog not open');
  return el as HTMLElement;
}

function fieldByLabel(label: string, scope: ParentNode = dialog()): HTMLInputElement | HTMLTextAreaElement {
  const labelEl = Array.from(scope.querySelectorAll('label')).find((l) => l.textContent?.replace('*', '').trim() === label);
  const id = labelEl?.getAttribute('for');
  const el = id ? (document.getElementById(id) as HTMLInputElement | null) : null;
  if (!el) throw new Error(`field ${label} not found`);
  return el;
}

function pickFile(file: File) {
  const input = container.querySelector('input[type="file"]') as HTMLInputElement;
  Object.defineProperty(input, 'files', { value: [file], configurable: true });
  act(() => {
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

function fileOf(name: string, size: number): File {
  const file = new File(['x'], name);
  Object.defineProperty(file, 'size', { value: size });
  return file;
}

describe('radio (cv_start / cv_pick)', () => {
  it('is a fieldset whose legend is the title, and submits label + option id', async () => {
    const onSubmit = vi.fn();
    render(<CvFormBlock form={START} active onSubmit={onSubmit} />);
    expect(container.querySelector('fieldset legend')?.textContent).toBe('How do you want to start?');
    click(container.querySelector('input[value="paste"]'));
    await clickAsync(buttonByText('Continue', container));
    expect(onSubmit).toHaveBeenCalledWith({
      display: 'Paste resume text',
      meta: { action_type: 'cv_form_submit', form_id: 'cv:cv_start', action_payload: 'paste' },
    });
  });

  it('frozen (not the latest message): disabled, says so, cannot submit', () => {
    const onSubmit = vi.fn();
    render(<CvFormBlock form={START} active={false} onSubmit={onSubmit} />);
    expect(container.querySelector('fieldset')?.disabled).toBe(true);
    expect(container.textContent).toContain('english.form.frozen');
    expect(container.querySelector('[data-cv-form-active="false"]')?.className).toContain('opacity-60');
    expect(buttonByText('Continue', container)?.disabled).toBe(true);
  });

  it('guards against a double submit while the first is in flight', async () => {
    let resolve: () => void = () => undefined;
    const onSubmit = vi.fn(() => new Promise<void>((r) => (resolve = r)));
    render(<CvFormBlock form={START} active onSubmit={onSubmit} />);
    click(container.querySelector('input[value="scratch"]'));
    const form = container.querySelector('form') as HTMLFormElement;
    await act(async () => {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
    expect(onSubmit).toHaveBeenCalledTimes(1);
    await act(async () => resolve());
  });
});

describe('checkbox (cv_archive)', () => {
  it('requires at least one, then sends {"archive": [ids]} with a destructive button', async () => {
    const onSubmit = vi.fn();
    render(<CvFormBlock form={ARCHIVE} active onSubmit={onSubmit} />);
    expect(container.querySelector('fieldset legend')?.textContent).toBe('Archive resumes');
    const archive = buttonByText('Archive', container);
    expect(archive?.className).toContain('bg-red-500');

    await clickAsync(archive);
    expect(onSubmit).not.toHaveBeenCalled();
    expect(container.querySelector('[role="alert"]')?.textContent).toBe('cv.form.selectAtLeastOne');

    click(container.querySelector('input[value="1"]'));
    click(container.querySelector('input[value="3"]'));
    await clickAsync(archive);
    expect(onSubmit).toHaveBeenCalledWith({
      display: 'cv.form.archiveSent{"count":2}',
      meta: { action_type: 'cv_form_submit', form_id: 'cv:cv_archive', action_payload: '{"archive":[1,3]}' },
    });
  });

  it('more than 8 resumes: the list opens in a portaled dialog and keeps ticks when closed', async () => {
    const onSubmit = vi.fn();
    render(<CvFormBlock form={ARCHIVE_MODAL} active onSubmit={onSubmit} />);
    expect(container.querySelector('input[type="checkbox"]')).toBeNull();
    click(buttonByText('cv.form.open', container));
    expect(container.contains(dialog())).toBe(false);
    expect(dialog().getAttribute('aria-labelledby')).toBeTruthy();
    click(dialog().querySelector('input[value="9"]'));
    click(buttonByText('english.form.close', dialog()));
    expect(document.querySelector('[role="dialog"]')).toBeNull();

    click(buttonByText('cv.form.reopen', container));
    expect((dialog().querySelector('input[value="9"]') as HTMLInputElement).checked).toBe(true);
    await clickAsync(buttonByText('Archive', dialog()));
    expect(JSON.parse(onSubmit.mock.calls[0][0].meta.action_payload)).toEqual({ archive: [9] });
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });
});

describe('textarea (cv_paste)', () => {
  it('shows the count against max_chars and sends the text without a payload', async () => {
    const onSubmit = vi.fn();
    render(<CvFormBlock form={PASTE} active onSubmit={onSubmit} />);
    typeInto(container.querySelector('textarea'), 'Jane Doe — barista');
    expect(container.querySelector('[data-cv-paste-count]')?.textContent).toBe(
      'english.form.chars{"count":18,"max":20000}'
    );
    await clickAsync(buttonByText('Send', container));
    expect(onSubmit).toHaveBeenCalledWith({
      display: 'Jane Doe — barista',
      meta: { action_type: 'cv_form_submit', form_id: 'cv:cv_paste' },
    });
  });

  it('over the limit: cannot send', () => {
    render(<CvFormBlock form={{ ...PASTE, constraints: { max_chars: 5 } }} active onSubmit={vi.fn()} />);
    typeInto(container.querySelector('textarea'), 'too long');
    expect(buttonByText('Send', container)?.disabled).toBe(true);
  });
});

describe('upload (cv_upload)', () => {
  it('rejects the wrong type and an oversized file on the device', () => {
    render(<CvFormBlock form={UPLOAD} active onSubmit={vi.fn()} />);
    expect(container.querySelector('input[type="file"]')?.getAttribute('accept')).toBe('.pdf,.docx');
    pickFile(fileOf('cv.png', 100));
    expect(container.querySelector('[role="alert"]')?.textContent).toBe('cv.uploadErrorFormat');
    pickFile(fileOf('cv.pdf', 10485761));
    expect(container.querySelector('[role="alert"]')?.textContent).toBe('cv.uploadErrorSize');
    // A device-side rejection is not a failed request: nothing to retry.
    expect(buttonByText('states.retry', container)).toBeNull();
    expect(buttonByText('Upload', container)?.disabled).toBe(true);
    expect(uploadCvResumeFile).not.toHaveBeenCalled();
  });

  it('uploads via /inputs and hands the reply over as an answered turn', async () => {
    const response = { text: 'Read it.', next_actions: [], meta: { pipeline_state: 'collecting' } };
    let resolve: (v: unknown) => void = () => undefined;
    uploadCvResumeFile.mockReturnValue(new Promise((r) => (resolve = r)));
    const onSubmit = vi.fn();
    render(<CvFormBlock form={UPLOAD} active onSubmit={onSubmit} />);
    pickFile(fileOf('cv.pdf', 2048));
    expect(container.textContent).toContain('cv.pdf');
    click(buttonByText('Upload', container));
    expect(container.textContent).toContain('cv.uploading');
    expect(uploadCvResumeFile).toHaveBeenCalledWith(expect.any(File), 'en');

    await act(async () => resolve({ success: true, data: { response } }));
    expect(onSubmit).toHaveBeenCalledWith({
      kind: 'answered',
      display: 'cv.form.uploaded{"name":"cv.pdf"}',
      response,
    });
    expect(container.textContent).not.toContain('cv.uploading');
  });

  it('a failed upload shows the shared upload error inline with "Try again", and sends nothing', async () => {
    uploadCvResumeFile.mockResolvedValueOnce({ success: false, errorCode: 'SERVER_ERROR' });
    const onSubmit = vi.fn();
    render(<CvFormBlock form={UPLOAD} active onSubmit={onSubmit} />);
    pickFile(fileOf('cv.docx', 2048));
    await clickAsync(buttonByText('Upload', container));
    expect(container.querySelector('[role="alert"]')?.textContent).toBe('cv.uploadErrorServer');
    expect(onSubmit).not.toHaveBeenCalled();

    uploadCvResumeFile.mockResolvedValueOnce({ success: false, error: 'Failed to fetch', errorCode: 'NETWORK_ERROR' });
    await clickAsync(buttonByText('states.retry', container));
    expect(uploadCvResumeFile).toHaveBeenCalledTimes(2);
    expect(container.querySelector('[role="alert"]')?.textContent).toBe('cv.uploadErrorNetwork');

    const response = { text: 'Read it.', next_actions: [] };
    uploadCvResumeFile.mockResolvedValueOnce({ success: true, data: { response } });
    await clickAsync(buttonByText('states.retry', container));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ kind: 'answered', response }));
    expect(container.querySelector('[role="alert"]')).toBeNull();
  });

  it('the surface has nowhere to show the reply (returns false): an inline error, no retry', async () => {
    uploadCvResumeFile.mockResolvedValue({ success: true, data: { response: { text: 'Read it.' } } });
    render(<CvFormBlock form={UPLOAD} active onSubmit={vi.fn(() => false)} />);
    pickFile(fileOf('cv.pdf', 2048));
    await clickAsync(buttonByText('Upload', container));
    expect(container.querySelector('[role="alert"]')?.textContent).toBe('cv.uploadErrorGeneric');
    expect(buttonByText('states.retry', container)).toBeNull();
  });

  it('user-created spaces (uploadEnabled=false): the upload form renders nothing', () => {
    render(<CvFormBlock form={UPLOAD} active onSubmit={vi.fn()} uploadEnabled={false} />);
    expect(container.innerHTML).toBe('');
    // Other CV forms still render there.
    render(<CvFormBlock form={PASTE} active onSubmit={vi.fn()} uploadEnabled={false} />);
    expect(container.querySelector('textarea')).not.toBeNull();
  });

  it('frozen: no picking, no upload', () => {
    render(<CvFormBlock form={UPLOAD} active={false} onSubmit={vi.fn()} />);
    expect(buttonByText('cv.form.chooseFile', container)?.disabled).toBe(true);
  });
});

describe('wizard (cv_wizard)', () => {
  it('step bar, required check, repeatable zero items, back/next, submit payload', async () => {
    const onSubmit = vi.fn();
    render(<CvFormBlock form={WIZARD} active onSubmit={onSubmit} />);
    click(buttonByText('cv.form.open', container));
    const d = dialog();
    expect(container.contains(d)).toBe(false);
    const titleId = d.getAttribute('aria-labelledby') as string;
    expect(document.getElementById(titleId)?.textContent).toBe('New resume');
    expect(d.textContent).toContain('cv.form.stepOf{"current":1,"total":6}');
    const items = d.querySelectorAll('ol li');
    expect(items).toHaveLength(6);
    expect(items[0].getAttribute('aria-current')).toBe('step');
    expect(items[1].getAttribute('aria-current')).toBeNull();

    // Required: can't leave Contact without a name.
    click(buttonByText('cv.form.next', d));
    expect(dialog().textContent).toContain('cv.form.stepOf{"current":1,"total":6}');
    expect(fieldByLabel('Full name').getAttribute('aria-invalid')).toBe('true');
    expect(dialog().textContent).toContain('cv.form.required');

    typeInto(fieldByLabel('Full name'), 'Jane Doe');
    click(buttonByText('cv.form.next', dialog()));
    typeInto(fieldByLabel("Role you're applying for"), 'Data Analyst');
    click(buttonByText('cv.form.next', dialog()));

    // Education (repeatable): zero items is fine.
    expect(dialog().textContent).toContain('cv.form.stepOf{"current":3,"total":6}');
    click(buttonByText('cv.form.next', dialog()));

    // Work experience: an item missing a required field blocks; Remove clears it.
    click(buttonByText('cv.form.addItem', dialog()));
    typeInto(fieldByLabel('Company'), 'Kaspi');
    click(buttonByText('cv.form.next', dialog()));
    expect(dialog().textContent).toContain('cv.form.stepOf{"current":4,"total":6}');
    typeInto(fieldByLabel('Position'), 'Intern');
    typeInto(fieldByLabel('What you did (one per line)'), 'Dashboards\nReports');
    click(buttonByText('cv.form.next', dialog()));

    // Projects: add one, then go back and forth.
    click(buttonByText('cv.form.addItem', dialog()));
    typeInto(fieldByLabel('Project name'), 'Churn model');
    click(buttonByText('cv.form.back', dialog()));
    expect(dialog().textContent).toContain('cv.form.stepOf{"current":4,"total":6}');
    expect((fieldByLabel('Company') as HTMLInputElement).value).toBe('Kaspi');
    click(buttonByText('cv.form.next', dialog()));
    click(buttonByText('cv.form.next', dialog()));

    // Last step shows submit_label.
    expect(buttonByText('cv.form.next', dialog())).toBeNull();
    typeInto(fieldByLabel('Skills (comma or one per line)'), 'SQL, Python\nExcel');
    await clickAsync(buttonByText('Save', dialog()));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const sent = onSubmit.mock.calls[0][0];
    expect(sent.display).toBe('cv.form.wizardSent');
    expect(sent.meta).toMatchObject({ action_type: 'cv_form_submit', form_id: 'cv:cv_wizard' });
    expect(JSON.parse(sent.meta.action_payload)).toEqual({
      resume: {
        contact: { full_name: 'Jane Doe' },
        target_role: 'Data Analyst',
        education: [],
        work_experience: [{ company: 'Kaspi', position: 'Intern', highlights: ['Dashboards', 'Reports'] }],
        projects: [{ name: 'Churn model' }],
        skills: ['SQL', 'Python', 'Excel'],
      },
    });
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });

  it('closing keeps the step and the input; the button then says "continue"', () => {
    render(<CvFormBlock form={WIZARD} active onSubmit={vi.fn()} />);
    click(buttonByText('cv.form.open', container));
    typeInto(fieldByLabel('Full name'), 'Jane');
    click(buttonByText('cv.form.next', dialog()));
    click(dialog().querySelector('button[aria-label="english.form.close"]'));
    expect(document.querySelector('[role="dialog"]')).toBeNull();

    click(buttonByText('cv.form.reopen', container));
    expect(dialog().textContent).toContain('cv.form.stepOf{"current":2,"total":6}');
    click(buttonByText('cv.form.back', dialog()));
    expect((fieldByLabel('Full name') as HTMLInputElement).value).toBe('Jane');
  });

  it('the draft survives the same wizard arriving on the next turn (keyed by form_id)', () => {
    render(<CvFormBlock form={WIZARD} active onSubmit={vi.fn()} />);
    click(buttonByText('cv.form.open', container));
    typeInto(fieldByLabel('Full name'), 'Jane');
    click(dialog().querySelector('button[aria-label="english.form.close"]'));
    act(() => root.unmount());
    root = createRoot(container);
    render(<CvFormBlock form={WIZARD} active onSubmit={vi.fn()} />);
    expect(buttonByText('cv.form.reopen', container)).not.toBeNull();
  });

  it('frozen: the wizard cannot be opened', () => {
    render(<CvFormBlock form={WIZARD} active={false} onSubmit={vi.fn()} />);
    expect(buttonByText('cv.form.open', container)?.disabled).toBe(true);
  });

  it('edit mode: loads the stored resume, with a retry on failure', async () => {
    let resolveFirst: (v: unknown) => void = () => undefined;
    fetchCvDocumentResume.mockReturnValueOnce(new Promise((r) => (resolveFirst = r)));
    render(<CvFormBlock form={WIZARD_EDIT} active onSubmit={vi.fn()} />);
    click(buttonByText('cv.form.open', container));
    expect(fetchCvDocumentResume).toHaveBeenCalledWith(42, 'en');
    expect(dialog().textContent).toContain('cv.form.loadingResume');

    await act(async () => resolveFirst({ success: false, errorCode: 'NETWORK_ERROR' }));
    expect(dialog().querySelector('[role="alert"]')?.textContent).toContain('cv.form.loadFailed');

    fetchCvDocumentResume.mockResolvedValueOnce({
      success: true,
      data: {
        resume: { contact: { full_name: 'Jane Doe' }, target_role: 'Data Analyst', skills: ['SQL'] },
        version: 3,
      },
    });
    await clickAsync(buttonByText('states.retry', dialog()));
    expect(fetchCvDocumentResume).toHaveBeenCalledTimes(2);
    expect((fieldByLabel('Full name') as HTMLInputElement).value).toBe('Jane Doe');
  });
});

describe('review #259 — a send that did not go out keeps what the user entered', () => {
  it('paste: a skipped send (false) and a rejected send keep the text; a real one clears it', async () => {
    const onSubmit = vi
      .fn()
      .mockReturnValueOnce(false)
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce(undefined);
    render(<CvFormBlock form={PASTE} active onSubmit={onSubmit} />);
    const textarea = () => container.querySelector('textarea') as HTMLTextAreaElement;
    typeInto(textarea(), 'Jane Doe');
    await clickAsync(buttonByText('Send', container));
    expect(textarea().value).toBe('Jane Doe');
    await clickAsync(buttonByText('Send', container));
    expect(textarea().value).toBe('Jane Doe');
    await clickAsync(buttonByText('Send', container));
    expect(onSubmit).toHaveBeenCalledTimes(3);
    expect(textarea().value).toBe('');
  });

  it('radio: a rejected send is caught (no unhandled rejection) and the form stays usable', async () => {
    const onSubmit = vi.fn().mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce(true);
    render(<CvFormBlock form={START} active onSubmit={onSubmit} />);
    click(container.querySelector('input[value="paste"]'));
    await clickAsync(buttonByText('Continue', container));
    expect(buttonByText('Continue', container)?.disabled).toBe(false);
    await clickAsync(buttonByText('Continue', container));
    expect(onSubmit).toHaveBeenCalledTimes(2);
  });

  it('wizard: Save stays in the open dialog, disabled with progress, until the send resolves; a failed send keeps dialog + draft', async () => {
    let resolveSend: (v: boolean) => void = () => undefined;
    const onSubmit = vi.fn(() => new Promise<boolean>((r) => (resolveSend = r)));
    const single = { ...WIZARD, steps: WIZARD.steps!.slice(0, 1) };
    render(<CvFormBlock form={single} active onSubmit={onSubmit} />);
    click(buttonByText('cv.form.open', container));
    typeInto(fieldByLabel('Full name'), 'Jane');
    await clickAsync(buttonByText('Save', dialog()));

    // In flight: still open, Save disabled and busy, fields locked.
    expect(onSubmit).toHaveBeenCalledTimes(1);
    const save = buttonByText('Save', dialog()) as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    expect(save.getAttribute('aria-busy')).toBe('true');
    expect(save.querySelector('.animate-spin')).not.toBeNull();
    expect(fieldByLabel('Full name').disabled).toBe(true);

    // Failed / skipped: the dialog and the draft stay.
    await act(async () => resolveSend(false));
    expect(buttonByText('Save', dialog())?.disabled).toBe(false);
    expect(fieldByLabel('Full name').value).toBe('Jane');
    expect(readCvWizardDraft(single.form_id)?.values.contact?.full_name).toBe('Jane');

    // Sent: closes and clears the draft.
    await clickAsync(buttonByText('Save', dialog()));
    await act(async () => resolveSend(true));
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(readCvWizardDraft(single.form_id)).toBeUndefined();
    expect(buttonByText('cv.form.open', container)).not.toBeNull();
  });

  it('wizard: a send that throws keeps the dialog and the draft', async () => {
    const single = { ...WIZARD, steps: WIZARD.steps!.slice(0, 1) };
    render(<CvFormBlock form={single} active onSubmit={vi.fn().mockRejectedValue(new Error('x'))} />);
    click(buttonByText('cv.form.open', container));
    typeInto(fieldByLabel('Full name'), 'Jane');
    await clickAsync(buttonByText('Save', dialog()));
    expect(fieldByLabel('Full name').value).toBe('Jane');
    expect(readCvWizardDraft(single.form_id)).toBeDefined();
  });
});

describe('review #259 — wizard accessibility', () => {
  it('a blocked Next focuses the first missing required field and announces it by label', () => {
    render(<CvFormBlock form={WIZARD} active onSubmit={vi.fn()} />);
    click(buttonByText('cv.form.open', container));
    click(buttonByText('cv.form.next', dialog()));
    expect(document.activeElement).toBe(fieldByLabel('Full name'));
    expect(dialog().querySelector('[data-cv-wizard-announce]')?.textContent).toBe('Full name: cv.form.required');
    expect(dialog().querySelector('[data-cv-wizard-announce]')?.getAttribute('aria-live')).toBe('assertive');
  });

  it('the paste counter is a polite live region', () => {
    render(<CvFormBlock form={PASTE} active onSubmit={vi.fn()} />);
    expect(container.querySelector('[data-cv-paste-count]')?.getAttribute('aria-live')).toBe('polite');
  });
});

describe('review #259 — edit mode', () => {
  const doc = (name: string, version: number) => ({
    success: true,
    data: { resume: { contact: { full_name: name }, target_role: 'Analyst' }, version },
  });

  it('opening without typing stores no draft; every open refetches and shows the fresh data', async () => {
    fetchCvDocumentResume.mockResolvedValueOnce(doc('Old Name', 1));
    render(<CvFormBlock form={WIZARD_EDIT} active onSubmit={vi.fn()} />);
    await clickAsync(buttonByText('cv.form.open', container));
    expect(fieldByLabel('Full name').value).toBe('Old Name');
    click(dialog().querySelector('button[aria-label="english.form.close"]'));
    expect(readCvWizardDraft(WIZARD_EDIT.form_id)).toBeUndefined();
    // Nothing typed ⇒ "Open form", not "Continue filling in".
    expect(buttonByText('cv.form.open', container)).not.toBeNull();

    // The next bubble (same form_id) reopens: refetch, newer content shown.
    act(() => root.unmount());
    root = createRoot(container);
    fetchCvDocumentResume.mockResolvedValueOnce(doc('New Name', 2));
    render(<CvFormBlock form={WIZARD_EDIT} active onSubmit={vi.fn()} />);
    await clickAsync(buttonByText('cv.form.open', container));
    expect(fetchCvDocumentResume).toHaveBeenCalledTimes(2);
    expect(fieldByLabel('Full name').value).toBe('New Name');
  });

  it('a typed draft is kept while the version matches, and dropped when it changed', async () => {
    fetchCvDocumentResume.mockResolvedValueOnce(doc('Jane', 1));
    const onSubmit = vi.fn();
    render(<CvFormBlock form={WIZARD_EDIT} active onSubmit={onSubmit} />);
    await clickAsync(buttonByText('cv.form.open', container));
    typeInto(fieldByLabel('Full name'), 'Jane Typed');
    expect(readCvWizardDraft(WIZARD_EDIT.form_id)).toMatchObject({ dirty: true, version: 1 });
    click(dialog().querySelector('button[aria-label="english.form.close"]'));
    expect(buttonByText('cv.form.reopen', container)).not.toBeNull();

    // Same version: the typed draft wins.
    fetchCvDocumentResume.mockResolvedValueOnce(doc('Jane', 1));
    await clickAsync(buttonByText('cv.form.reopen', container));
    expect(fetchCvDocumentResume).toHaveBeenCalledTimes(2);
    expect(fieldByLabel('Full name').value).toBe('Jane Typed');
    click(dialog().querySelector('button[aria-label="english.form.close"]'));

    // Changed elsewhere since: the draft is dropped, the fresh data shown.
    fetchCvDocumentResume.mockResolvedValueOnce(doc('Jane Newer', 2));
    await clickAsync(buttonByText('cv.form.reopen', container));
    expect(fieldByLabel('Full name').value).toBe('Jane Newer');
    expect(readCvWizardDraft(WIZARD_EDIT.form_id)).toBeUndefined();
  });

  it('resume: null ⇒ one line, no Save, no draft stored', async () => {
    writeCvWizardDraft(WIZARD_EDIT.form_id, { ...emptyCvWizardDraft(), dirty: true, version: 1 });
    fetchCvDocumentResume.mockResolvedValueOnce({ success: true, data: { resume: null, version: 2 } });
    render(<CvFormBlock form={WIZARD_EDIT} active onSubmit={vi.fn()} />);
    await clickAsync(buttonByText('cv.form.reopen', container));
    expect(dialog().querySelector('[data-cv-wizard-elsewhere]')?.textContent).toBe('cv.form.editElsewhere');
    expect(buttonByText('Save', dialog())).toBeNull();
    expect(buttonByText('cv.form.next', dialog())).toBeNull();
    expect(dialog().querySelector('input, textarea')).toBeNull();
    expect(readCvWizardDraft(WIZARD_EDIT.form_id)).toBeUndefined();
    expect(buttonByText('cv.form.open', container)).not.toBeNull();
  });
});

describe('review #259 — logout', () => {
  it('clears every CV form draft', () => {
    writeCvWizardDraft(WIZARD.form_id, { ...emptyCvWizardDraft(), dirty: true });
    writeCvWizardDraft(WIZARD_EDIT.form_id, { ...emptyCvWizardDraft(), dirty: true, version: 1 });
    act(() => useAuthStore.getState().logout());
    expect(readCvWizardDraft(WIZARD.form_id)).toBeUndefined();
    expect(readCvWizardDraft(WIZARD_EDIT.form_id)).toBeUndefined();
  });
});
