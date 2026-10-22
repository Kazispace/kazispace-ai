/**
 * KAZI-1145 · cv_builder `meta.form` (design `kazi-cv-form-contract-v1.0.md`
 * §2–§4): parser, chat-send payloads, wizard validation, upload check.
 */
import { describe, expect, it } from 'vitest';

import {
  buildCvArchiveSubmit,
  buildCvChoiceSubmit,
  buildCvPasteSubmit,
  buildCvResume,
  buildCvWizardSubmit,
  checkCvFormUpload,
  cvWizardDraftFromResume,
  cvWizardDraftHasData,
  emptyCvWizardDraft,
  firstInvalidCvWizardStep,
  parseCvForm,
  splitCvLines,
  splitCvSkills,
  validateCvWizardStep,
  type CvForm,
  type CvWizardDraft,
} from '@/lib/cv-form';
import { parseEtForm } from '@/lib/english-tutor/form';
import { resolveActionSelectSubmit } from '@/lib/next-action-submit';
import {
  answeredTurnAgentMessages,
  answeredTurnSpaceMessages,
  isAnsweredTurn,
} from '@/lib/reply-form';
import {
  CV_PASTE_META,
  CV_PICK_META,
  CV_START_META,
  CV_UPLOAD_META,
  CV_WIZARD_EDIT_META,
  CV_WIZARD_META,
  cvArchiveMeta,
} from '@/lib/__fixtures__/kazi-1145-cv-forms';

const withForm = (meta: { form: Record<string, unknown> }, patch: Record<string, unknown>) => ({
  form: { ...meta.form, ...patch },
});

describe('parseCvForm — accepts every kind the backend sends', () => {
  it.each([
    ['cv_start', CV_START_META, 'inline', 'radio'],
    ['cv_upload', CV_UPLOAD_META, 'inline', 'upload'],
    ['cv_paste', CV_PASTE_META, 'inline', 'textarea'],
    ['cv_wizard', CV_WIZARD_META, 'modal', 'wizard'],
    ['cv_pick', CV_PICK_META, 'inline', 'radio'],
    ['cv_archive (≤ 8)', cvArchiveMeta(3), 'inline', 'checkbox'],
    ['cv_archive (> 8)', cvArchiveMeta(9), 'modal', 'checkbox'],
  ])('%s', (_name, meta, presentation, control) => {
    const form = parseCvForm(meta);
    expect(form).not.toBeNull();
    expect(form?.presentation).toBe(presentation);
    expect(form?.control).toBe(control);
  });

  it('keeps the kind-specific fields', () => {
    expect(parseCvForm(CV_UPLOAD_META)).toMatchObject({
      accept: ['.pdf', '.docx'],
      constraints: { max_bytes: 10485760 },
    });
    expect(parseCvForm(CV_PASTE_META)?.constraints).toEqual({ max_chars: 20000 });
    const wizard = parseCvForm(CV_WIZARD_META);
    expect(wizard?.steps?.map((s) => s.step_id)).toEqual([
      'contact',
      'target',
      'education',
      'work_experience',
      'projects',
      'skills',
    ]);
    expect(wizard?.steps?.[0].fields[0]).toEqual({
      field_id: 'full_name',
      label: 'Full name',
      type: 'input',
      required: true,
    });
    expect(wizard?.document_id).toBeUndefined();
    expect(parseCvForm(CV_WIZARD_EDIT_META)?.document_id).toBe(42);
    expect(parseCvForm(CV_START_META)?.prompt).toBeNull();
  });

  it('CV and ET forms never parse as each other', () => {
    expect(parseEtForm(CV_START_META)).toBeNull();
    expect(
      parseCvForm({
        form: {
          form_id: 'et:exam_select',
          kind: 'exam_select',
          presentation: 'inline',
          control: 'radio',
          title: 'Pick',
          options: [{ id: 'ielts', label: 'IELTS' }],
          submit_label: 'OK',
        },
      })
    ).toBeNull();
  });
});

describe('parseCvForm — rejects anything off-contract', () => {
  it.each([
    ['no form', {}],
    ['not cv: id', withForm(CV_START_META, { form_id: 'et:cv_start' })],
    ['id kind ≠ kind', withForm(CV_START_META, { form_id: 'cv:cv_pick' })],
    ['unknown kind', withForm(CV_START_META, { kind: 'cv_delete', form_id: 'cv:cv_delete' })],
    ['start as modal', withForm(CV_START_META, { presentation: 'modal' })],
    ['start as checkbox', withForm(CV_START_META, { control: 'checkbox' })],
    ['wizard inline', withForm(CV_WIZARD_META, { presentation: 'inline' })],
    ['wizard as textarea', withForm(CV_WIZARD_META, { control: 'textarea' })],
    ['upload as modal', withForm(CV_UPLOAD_META, { presentation: 'modal' })],
    ['archive as radio', withForm(cvArchiveMeta(2), { control: 'radio' })],
    ['radio without options', withForm(CV_PICK_META, { options: [] })],
    ['archive without options', withForm(cvArchiveMeta(2), { options: [] })],
    ['upload without accept', withForm(CV_UPLOAD_META, { accept: [] })],
    ['wizard without steps', withForm(CV_WIZARD_META, { steps: [] })],
    ['wizard step without fields', withForm(CV_WIZARD_META, { steps: [{ step_id: 'x', title: 'X', repeatable: false, fields: [] }] })],
    [
      'wizard field of unknown type',
      withForm(CV_WIZARD_META, {
        steps: [{ step_id: 'x', title: 'X', repeatable: false, fields: [{ field_id: 'a', label: 'A', type: 'select', required: false }] }],
      }),
    ],
    ['wizard bad document_id', withForm(CV_WIZARD_EDIT_META, { document_id: '42' })],
  ])('%s', (_name, meta) => {
    expect(parseCvForm(meta as Record<string, unknown>)).toBeNull();
  });
});

describe('radio / checkbox / textarea payloads', () => {
  it('radio: content = label, action_payload = option id', () => {
    const form = parseCvForm(CV_START_META) as CvForm;
    expect(buildCvChoiceSubmit(form, 'upload')).toEqual({
      display: 'Upload a PDF or Word file',
      meta: { action_type: 'cv_form_submit', form_id: 'cv:cv_start', action_payload: 'upload' },
    });
    expect(buildCvChoiceSubmit(form, 'nope')).toBeNull();
    const pick = parseCvForm(CV_PICK_META) as CvForm;
    expect(buildCvChoiceSubmit(pick, '12')?.meta.action_payload).toBe('12');
    expect(buildCvChoiceSubmit(pick, 'new')?.display).toBe('+ New resume');
  });

  it('checkbox: JSON {"archive": [numbers]}, at least one', () => {
    const form = parseCvForm(cvArchiveMeta(4)) as CvForm;
    const built = buildCvArchiveSubmit(form, ['3', '1'], 'Archive 2 resumes');
    expect(built?.display).toBe('Archive 2 resumes');
    expect(built?.meta.form_id).toBe('cv:cv_archive');
    expect(built?.meta.action_type).toBe('cv_form_submit');
    expect(JSON.parse(built?.meta.action_payload ?? '')).toEqual({ archive: [1, 3] });
    expect(buildCvArchiveSubmit(form, [], 'x')).toBeNull();
    expect(buildCvArchiveSubmit(form, ['99'], 'x')).toBeNull();
  });

  it('textarea: content = pasted text, no payload, max_chars respected', () => {
    const form = parseCvForm(CV_PASTE_META) as CvForm;
    expect(buildCvPasteSubmit(form, '  Jane Doe\nBarista  ')).toEqual({
      display: 'Jane Doe\nBarista',
      meta: { action_type: 'cv_form_submit', form_id: 'cv:cv_paste' },
    });
    expect(buildCvPasteSubmit(form, '   ')).toBeNull();
    expect(buildCvPasteSubmit(form, 'x'.repeat(20001))).toBeNull();
  });
});

function filledDraft(): CvWizardDraft {
  return {
    step: 5,
    values: {
      contact: { full_name: ' Jane Doe ', phone: '', email: 'jane@example.com', wechat: '' },
      target: { target_role: 'Data Analyst', summary: '' },
      skills: { skills: 'SQL, Python\nExcel，Tableau\n\n', english_level: '' },
    },
    items: {
      education: [{ institution: 'KBTU', degree: 'BSc', start_date: '', end_date: '2024' }],
      work_experience: [
        { company: 'Kaspi', position: 'Intern', highlights: 'Built dashboards\n\n  Cut report time  ' },
      ],
      projects: [{ name: 'Churn model', role: '', description: 'Logistic regression' }, { name: '', role: '' }],
    },
  };
}

describe('wizard', () => {
  const form = parseCvForm(CV_WIZARD_META) as CvForm;
  const steps = form.steps ?? [];

  it('builds a ResumeDocument-shaped resume: lists split, empties omitted, projects kept', () => {
    expect(buildCvResume(steps, filledDraft())).toEqual({
      contact: { full_name: 'Jane Doe', email: 'jane@example.com' },
      target_role: 'Data Analyst',
      education: [{ institution: 'KBTU', degree: 'BSc', end_date: '2024' }],
      work_experience: [
        { company: 'Kaspi', position: 'Intern', highlights: ['Built dashboards', 'Cut report time'] },
      ],
      projects: [{ name: 'Churn model', description: 'Logistic regression' }],
      skills: ['SQL', 'Python', 'Excel', 'Tableau'],
    });
  });

  it('splits skills on commas and newlines', () => {
    expect(splitCvSkills(' a, b\n c ,\n')).toEqual(['a', 'b', 'c']);
  });

  it('highlights: typed bullets ("- ", "• ", "* ") are stripped per line before sending', () => {
    expect(splitCvLines('- Built dashboards\n•Cut report time\n  * Led 3 people\n• \n-\nPlain line')).toEqual([
      'Built dashboards',
      'Cut report time',
      'Led 3 people',
      'Plain line',
    ]);
    // A hyphen inside the text (or a negative number) is not a bullet.
    expect(splitCvLines('Cut costs -20%\n-5% churn')).toEqual(['Cut costs -20%', '-5% churn']);
    const built = buildCvResume(
      [{ step_id: 'work_experience', title: 'Work', repeatable: true, fields: [
        { field_id: 'company', label: 'Company', type: 'input', required: true },
        { field_id: 'highlights', label: 'What you did', type: 'textarea', required: false },
      ] }],
      { step: 0, values: {}, items: { work_experience: [{ company: 'Kaspi', highlights: '- A\n• B\n* C' }] } }
    );
    expect(built.work_experience).toEqual([{ company: 'Kaspi', highlights: ['A', 'B', 'C'] }]);
  });

  it('submit: action_payload = JSON {"resume": R}, content = the summary line', () => {
    const built = buildCvWizardSubmit(form, filledDraft(), 'Submitted my resume details');
    expect(built?.display).toBe('Submitted my resume details');
    expect(built?.meta).toMatchObject({ action_type: 'cv_form_submit', form_id: 'cv:cv_wizard' });
    const payload = JSON.parse(built?.meta.action_payload ?? '');
    expect(Object.keys(payload)).toEqual(['resume']);
    expect(payload.resume.projects).toEqual([{ name: 'Churn model', description: 'Logistic regression' }]);
  });

  it('an empty new resume still has contact, lists and nothing else', () => {
    const draft = emptyCvWizardDraft();
    draft.values = { contact: { full_name: 'A' }, target: { target_role: 'B' } };
    expect(buildCvResume(steps, draft)).toEqual({
      contact: { full_name: 'A' },
      target_role: 'B',
      education: [],
      work_experience: [],
      projects: [],
      skills: [],
    });
  });

  it('step validation: single steps need their required fields', () => {
    const draft = emptyCvWizardDraft();
    expect(validateCvWizardStep(steps[0], draft)).toEqual([{ field_id: 'full_name' }]);
    draft.values.contact = { full_name: '  ' };
    expect(validateCvWizardStep(steps[0], draft)).toHaveLength(1);
    draft.values.contact = { full_name: 'Jane' };
    expect(validateCvWizardStep(steps[0], draft)).toEqual([]);
  });

  it('step validation: repeatable steps may have zero items, but each item needs its required fields', () => {
    const draft = emptyCvWizardDraft();
    const work = steps[3];
    expect(validateCvWizardStep(work, draft)).toEqual([]);
    draft.items.work_experience = [{ company: 'Kaspi' }, { company: 'X', position: 'Y' }];
    expect(validateCvWizardStep(work, draft)).toEqual([{ item: 0, field_id: 'position' }]);
    // A wholly blank item (just added, nothing typed) is dropped on submit, so it doesn't block.
    draft.items.work_experience = [{}, { company: ' ', position: '' }];
    expect(validateCvWizardStep(work, draft)).toEqual([]);
    draft.items.work_experience = [{ start_date: '2020' }];
    expect(validateCvWizardStep(work, draft)).toEqual([
      { item: 0, field_id: 'company' },
      { item: 0, field_id: 'position' },
    ]);
  });

  it('submit is refused while a step is invalid', () => {
    const draft = filledDraft();
    draft.values.target = { target_role: '' };
    expect(firstInvalidCvWizardStep(steps, draft)).toBe(1);
    expect(buildCvWizardSubmit(form, draft, 'x')).toBeNull();
  });

  it('edit-mode prefill maps the stored resume onto the steps and round-trips', () => {
    const resume = {
      target_role: 'Data Analyst',
      contact: { full_name: 'Jane Doe', phone: null, email: 'jane@example.com', wechat: null },
      summary: '',
      work_experience: [{ company: 'Kaspi', position: 'Intern', start_date: null, end_date: null, highlights: ['A', 'B'] }],
      education: [],
      projects: [{ name: 'Churn model', role: null, description: null }],
      skills: ['SQL', 'Python'],
      achievements: ['Dean’s list'],
      english_level: 'B2',
    };
    const draft = cvWizardDraftFromResume(steps, resume);
    expect(draft.step).toBe(0);
    expect(draft.values.contact).toEqual({ full_name: 'Jane Doe', email: 'jane@example.com' });
    expect(draft.values.skills).toEqual({ skills: 'SQL, Python', english_level: 'B2' });
    expect(draft.items.work_experience).toEqual([{ company: 'Kaspi', position: 'Intern', highlights: 'A\nB' }]);
    expect(cvWizardDraftHasData(draft)).toBe(true);
    // Fields the wizard doesn't show are carried back unchanged.
    expect(buildCvResume(steps, draft)).toEqual({
      achievements: ['Dean’s list'],
      contact: { full_name: 'Jane Doe', email: 'jane@example.com' },
      target_role: 'Data Analyst',
      education: [],
      work_experience: [{ company: 'Kaspi', position: 'Intern', highlights: ['A', 'B'] }],
      projects: [{ name: 'Churn model' }],
      skills: ['SQL', 'Python'],
      english_level: 'B2',
    });
    expect(cvWizardDraftFromResume(steps, null)).toEqual(emptyCvWizardDraft());
    expect(cvWizardDraftHasData(emptyCvWizardDraft())).toBe(false);
  });
});

describe('upload check (on device)', () => {
  const form = parseCvForm(CV_UPLOAD_META) as CvForm;
  it.each([
    ['cv.pdf', 1000, null],
    ['CV.DOCX', 1000, null],
    ['cv.doc', 1000, 'wrongType'],
    ['cv.png', 1000, 'wrongType'],
    ['cv.pdf', 10485760, null],
    ['cv.pdf', 10485761, 'tooLarge'],
  ])('%s (%i bytes) → %s', (name, size, expected) => {
    expect(checkCvFormUpload(form, { name, size })).toBe(expected);
  });
});

describe('answered turn (upload reply appended to the thread)', () => {
  const turn = {
    kind: 'answered' as const,
    display: 'Uploaded cv.pdf',
    response: {
      text: 'Got it — I read your resume.',
      next_actions: [{ type: 'generate_now', label: 'Generate now', payload: '__action:generate_now' }],
      meta: { pipeline_state: 'collecting' },
    },
  };

  it('is told apart from a chat send', () => {
    expect(isAnsweredTurn(turn)).toBe(true);
    expect(isAnsweredTurn({ display: 'x', meta: { action_type: 'cv_form_submit' } })).toBe(false);
  });

  it('space slice: a user bubble + the parsed reply', () => {
    const [user, assistant] = answeredTurnSpaceMessages(turn, 1000);
    expect(user).toMatchObject({ id: 'user_1000', role: 'user', content: 'Uploaded cv.pdf', status: 'sent' });
    expect(assistant).toMatchObject({
      id: 'assistant_1000',
      role: 'assistant',
      content: 'Got it — I read your resume.',
      nextActions: [{ type: 'generate_now', label: 'Generate now', payload: '__action:generate_now' }],
      assistantMeta: { pipeline_state: 'collecting' },
    });
  });

  it('agent mode: same, with the session id', () => {
    const [user, assistant] = answeredTurnAgentMessages(turn, 'sess-1', 1000);
    expect(user).toMatchObject({ role: 'user', sessionId: 'sess-1', content: 'Uploaded cv.pdf' });
    expect(assistant).toMatchObject({ role: 'assistant', sessionId: 'sess-1', content: 'Got it — I read your resume.' });
  });
});

describe('the two new CV next actions go out like other __action: CTAs', () => {
  it.each(['__action:manage_resumes', '__action:archive_resumes'])('%s', (payload) => {
    const type = payload.slice('__action:'.length);
    expect(resolveActionSelectSubmit({ type, label: 'My resumes', payload }, 'en')).toEqual({
      display: 'My resumes',
      meta: { action_type: type, action_payload: payload },
    });
  });
});
