/**
 * KAZI-1145 test fixtures: `meta.form` payloads exactly as the backend builds
 * them (`agents/cv_builder/form_schema.py`, English locale).
 */
const f = (field_id: string, label: string, opts: { type?: 'input' | 'textarea'; required?: boolean } = {}) => ({
  field_id,
  label,
  type: opts.type ?? 'input',
  required: opts.required ?? false,
});

export const CV_WIZARD_STEPS = [
  {
    step_id: 'contact',
    title: 'Contact',
    repeatable: false,
    fields: [f('full_name', 'Full name', { required: true }), f('phone', 'Phone'), f('email', 'Email'), f('wechat', 'WeChat')],
  },
  {
    step_id: 'target',
    title: 'Target role',
    repeatable: false,
    fields: [f('target_role', "Role you're applying for", { required: true }), f('summary', 'Short summary', { type: 'textarea' })],
  },
  {
    step_id: 'education',
    title: 'Education',
    repeatable: true,
    fields: [f('institution', 'School', { required: true }), f('degree', 'Degree / major'), f('start_date', 'Start'), f('end_date', 'End')],
  },
  {
    step_id: 'work_experience',
    title: 'Work experience',
    repeatable: true,
    fields: [
      f('company', 'Company', { required: true }),
      f('position', 'Position', { required: true }),
      f('start_date', 'Start'),
      f('end_date', 'End'),
      f('highlights', 'What you did (one per line)', { type: 'textarea' }),
    ],
  },
  {
    step_id: 'projects',
    title: 'Projects',
    repeatable: true,
    fields: [f('name', 'Project name', { required: true }), f('role', 'Your role'), f('description', 'Description', { type: 'textarea' })],
  },
  {
    step_id: 'skills',
    title: 'Skills',
    repeatable: false,
    fields: [f('skills', 'Skills (comma or one per line)', { type: 'textarea' }), f('english_level', 'English level')],
  },
];

export const CV_START_META = {
  form: {
    form_id: 'cv:cv_start',
    kind: 'cv_start',
    presentation: 'inline',
    control: 'radio',
    title: 'How do you want to start?',
    prompt: null,
    options: [
      { id: 'scratch', label: 'Start from scratch' },
      { id: 'upload', label: 'Upload a PDF or Word file' },
      { id: 'paste', label: 'Paste resume text' },
    ],
    submit_label: 'Continue',
  },
};

export const CV_UPLOAD_META = {
  form: {
    form_id: 'cv:cv_upload',
    kind: 'cv_upload',
    presentation: 'inline',
    control: 'upload',
    title: 'Upload your resume',
    prompt: 'PDF or Word (DOCX), up to 10 MB.',
    options: [],
    submit_label: 'Upload',
    accept: ['.pdf', '.docx'],
    constraints: { max_bytes: 10485760 },
  },
};

export const CV_PASTE_META = {
  form: {
    form_id: 'cv:cv_paste',
    kind: 'cv_paste',
    presentation: 'inline',
    control: 'textarea',
    title: 'Paste your resume',
    prompt: 'Paste the text of your current resume.',
    options: [],
    submit_label: 'Send',
    constraints: { max_chars: 20000 },
  },
};

export const CV_WIZARD_META = {
  form: {
    form_id: 'cv:cv_wizard',
    kind: 'cv_wizard',
    presentation: 'modal',
    control: 'wizard',
    title: 'New resume',
    prompt: 'Fill in what you have, step by step.',
    options: [],
    submit_label: 'Save',
    steps: CV_WIZARD_STEPS,
  },
};

export const CV_WIZARD_EDIT_META = {
  form: {
    ...CV_WIZARD_META.form,
    form_id: 'cv:cv_wizard:42',
    title: 'Edit resume',
    document_id: 42,
  },
};

export const CV_PICK_META = {
  form: {
    form_id: 'cv:cv_pick',
    kind: 'cv_pick',
    presentation: 'inline',
    control: 'radio',
    title: 'Which resume?',
    prompt: null,
    options: [
      { id: '12', label: 'Data Analyst · 2026-10-20' },
      { id: '9', label: 'Barista · 2026-09-01' },
      { id: 'new', label: '+ New resume' },
    ],
    submit_label: 'Open',
  },
};

export function cvArchiveMeta(count: number) {
  return {
    form: {
      form_id: 'cv:cv_archive',
      kind: 'cv_archive',
      presentation: count > 8 ? 'modal' : 'inline',
      control: 'checkbox',
      title: 'Archive resumes',
      prompt: 'Archived resumes leave this list.',
      options: Array.from({ length: count }, (_, i) => ({ id: String(i + 1), label: `Role ${i + 1} · 2026-10-0${(i % 9) + 1}` })),
      submit_label: 'Archive',
    },
  };
}
