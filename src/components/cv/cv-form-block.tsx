'use client';

import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useLocale, useTranslations } from 'next-intl';
import { FileUp, Loader2, PenLine, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useDialogFocusTrap } from '@/hooks/use-dialog-focus-trap';
import { fetchCvDocumentResume } from '@/lib/cv-export-api';
import {
  buildCvArchiveSubmit,
  buildCvChoiceSubmit,
  buildCvPasteSubmit,
  buildCvWizardSubmit,
  checkCvFormUpload,
  clearCvWizardDraft,
  cvWizardDraftFromResume,
  emptyCvWizardDraft,
  firstInvalidCvWizardStep,
  readCvWizardDraft,
  validateCvWizardStep,
  writeCvWizardDraft,
  type CvForm,
  type CvWizardDraft,
  type CvWizardField,
  type CvWizardItem,
  type CvWizardStep,
} from '@/lib/cv-form';
import { resolveCvUploadErrorMessage, uploadCvResumeFile } from '@/lib/cv-input-api';
import type { ReplyFormSubmit, ReplyFormSubmitHandler } from '@/lib/reply-form';
import { cn } from '@/lib/utils';

export interface CvFormBlockProps {
  form: CvForm;
  /** Freeze rule (design §1, same as ET): only the latest message's form is interactive. */
  active: boolean;
  /** Reports back: `false` (or a throw) ⇒ not sent, the form keeps its input. */
  onSubmit?: ReplyFormSubmitHandler;
  /**
   * False on user-created spaces: `/api/v1/inputs` only reaches the Clinic CV
   * session and writes no message there, so `cv_upload` renders nothing (the
   * reply text still reads).
   */
  uploadEnabled?: boolean;
}

/** Runs one submit at a time; resolves true when the form was sent. Never rejects. */
type RunExclusive = (task: () => Promise<boolean>) => Promise<boolean>;
/** Hands a built answer to the surface; resolves true only when it went out. Never rejects. */
type Deliver = (submit: ReplyFormSubmit) => Promise<boolean>;

/**
 * KAZI-1145 · renders a cv_builder `meta.form` (design `kazi-cv-form-contract`
 * §2.2): inline radio / checkbox / paste / upload, and the modal wizard (or
 * the archive list when it has more than 8 resumes). Frozen forms stay
 * visible with whatever the user filled in, but disabled.
 */
export function CvFormBlock({ form, active, onSubmit, uploadEnabled = true }: CvFormBlockProps) {
  const t = useTranslations('cv.form');
  const tEt = useTranslations('english.form');
  const interactive = active && Boolean(onSubmit);
  const inFlightRef = useRef(false);
  const [submitting, setSubmitting] = useState(false);

  const runExclusive = useCallback<RunExclusive>(
    async (task) => {
      if (!interactive || inFlightRef.current) return false;
      inFlightRef.current = true;
      setSubmitting(true);
      try {
        return await task();
      } catch {
        return false;
      } finally {
        inFlightRef.current = false;
        setSubmitting(false);
      }
    },
    [interactive]
  );

  const deliver = useCallback<Deliver>(
    async (built) => {
      if (!onSubmit) return false;
      try {
        return (await onSubmit(built)) !== false;
      } catch {
        return false;
      }
    },
    [onSubmit]
  );

  const send = useCallback(
    (built: ReplyFormSubmit | null) => {
      if (!built) return Promise.resolve(false);
      return runExclusive(() => deliver(built));
    },
    [deliver, runExclusive]
  );

  if (form.control === 'upload' && !uploadEnabled) return null;

  const frozen = !interactive;
  const disabled = frozen || submitting;

  let body: ReactNode;
  switch (form.control) {
    case 'radio':
      body = <ChoiceForm form={form} disabled={disabled} onSubmit={(id) => send(buildCvChoiceSubmit(form, id))} />;
      break;
    case 'checkbox':
      body = (
        <ArchiveForm
          form={form}
          frozen={frozen}
          disabled={disabled}
          onSubmit={(ids) => send(buildCvArchiveSubmit(form, ids, t('archiveSent', { count: ids.length })))}
        />
      );
      break;
    case 'textarea':
      body = <PasteForm form={form} disabled={disabled} onSubmit={(text) => send(buildCvPasteSubmit(form, text))} />;
      break;
    case 'upload':
      body = <UploadForm form={form} disabled={disabled} runExclusive={runExclusive} deliver={deliver} />;
      break;
    case 'wizard':
      body = (
        <WizardForm
          form={form}
          frozen={frozen}
          submitting={submitting}
          onSubmit={(draft) => send(buildCvWizardSubmit(form, draft, t('wizardSent')))}
        />
      );
      break;
    default:
      body = null;
  }

  return (
    <div
      className={cn('mt-3 space-y-2 rounded-xl border border-gray-200 bg-white p-3', !active && 'opacity-60')}
      data-cv-form={form.kind}
      data-cv-form-active={active ? 'true' : 'false'}
    >
      {body}
      {!active ? <p className="text-[11px] text-workspace-muted">{tEt('frozen')}</p> : null}
    </div>
  );
}

function FormTitle({ form }: { form: CvForm }) {
  return form.title ? <p className="text-[13px] font-semibold text-workspace-text">{form.title}</p> : null;
}

function FormPrompt({ form }: { form: CvForm }) {
  return form.prompt ? <p className="whitespace-pre-wrap text-xs text-workspace-muted">{form.prompt}</p> : null;
}

// ---------------------------------------------------------------------------
// radio — cv_start / cv_pick
// ---------------------------------------------------------------------------

function ChoiceForm({
  form,
  disabled,
  onSubmit,
}: {
  form: CvForm;
  disabled: boolean;
  onSubmit: (optionId: string) => Promise<boolean>;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const name = `cv-form-${form.form_id}`;
  return (
    <form
      className="space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (selected) void onSubmit(selected).catch(() => false);
      }}
    >
      <fieldset className="flex flex-col gap-1.5" disabled={disabled}>
        <legend className="mb-1.5 text-[13px] font-semibold text-workspace-text">{form.title}</legend>
        <FormPrompt form={form} />
        {form.options.map((option) => (
          <label
            key={option.id}
            className={cn(
              'flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors',
              selected === option.id ? 'border-primary/50 bg-workspace-active' : 'border-gray-200 bg-white hover:bg-gray-50',
              disabled && 'cursor-not-allowed'
            )}
          >
            <input
              type="radio"
              name={name}
              value={option.id}
              checked={selected === option.id}
              onChange={() => setSelected(option.id)}
            />
            {option.label}
          </label>
        ))}
      </fieldset>
      <Button type="submit" size="sm" className="w-full" disabled={disabled || !selected}>
        {form.submit_label}
      </Button>
    </form>
  );
}

// ---------------------------------------------------------------------------
// checkbox — cv_archive (inline ≤ 8, dialog > 8)
// ---------------------------------------------------------------------------

function ArchiveForm({
  form,
  frozen,
  disabled,
  onSubmit,
}: {
  form: CvForm;
  /** Not the latest message (or no handler): the dialog can't be open. */
  frozen: boolean;
  /** Frozen, or a submit in flight. */
  disabled: boolean;
  onSubmit: (ids: string[]) => Promise<boolean>;
}) {
  const t = useTranslations('cv.form');
  const tEt = useTranslations('english.form');
  // Selection lives here, not in the dialog: closing it keeps the ticks.
  const [selected, setSelected] = useState<string[]>([]);
  const [showError, setShowError] = useState(false);
  const [open, setOpen] = useState(false);

  const toggle = (id: string) => {
    setShowError(false);
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };
  const submit = async () => {
    if (selected.length === 0) {
      setShowError(true);
      return;
    }
    if (await onSubmit(selected)) setOpen(false);
  };

  const list = (
    <ArchiveFieldset form={form} disabled={disabled} selected={selected} onToggle={toggle} showError={showError} />
  );
  const submitButton = (
    <Button type="button" size="sm" variant="destructive" className="flex-1" disabled={disabled} onClick={() => void submit()}>
      {form.submit_label}
    </Button>
  );

  if (form.presentation === 'inline') {
    return (
      <div className="space-y-2">
        {list}
        <div className="flex">{submitButton}</div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <FormTitle form={form} />
      <FormPrompt form={form} />
      <Button type="button" size="sm" variant="secondary" className="w-full" disabled={disabled} onClick={() => setOpen(true)}>
        <PenLine className="mr-1.5 h-4 w-4" aria-hidden />
        {selected.length > 0 ? t('reopen') : t('open')}
      </Button>
      <CvFormDialog
        open={open && !frozen}
        title={form.title}
        onClose={() => setOpen(false)}
        footer={
          <>
            <Button type="button" variant="ghost" className="flex-1" onClick={() => setOpen(false)}>
              {tEt('close')}
            </Button>
            {submitButton}
          </>
        }
      >
        {list}
      </CvFormDialog>
    </div>
  );
}

function ArchiveFieldset({
  form,
  disabled,
  selected,
  onToggle,
  showError,
}: {
  form: CvForm;
  disabled: boolean;
  selected: string[];
  onToggle: (id: string) => void;
  showError: boolean;
}) {
  const t = useTranslations('cv.form');
  const errorId = useId();
  return (
    <fieldset
      className="flex flex-col gap-1.5"
      disabled={disabled}
      aria-describedby={showError ? errorId : undefined}
    >
      <legend className="mb-1.5 text-[13px] font-semibold text-workspace-text">{form.title}</legend>
      <FormPrompt form={form} />
      {form.options.map((option) => (
        <label
          key={option.id}
          className={cn(
            'flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors',
            selected.includes(option.id) ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-white hover:bg-gray-50',
            disabled && 'cursor-not-allowed'
          )}
        >
          <input
            type="checkbox"
            value={option.id}
            checked={selected.includes(option.id)}
            onChange={() => onToggle(option.id)}
          />
          {option.label}
        </label>
      ))}
      {showError ? (
        <p id={errorId} role="alert" className="text-xs text-red-600">
          {t('selectAtLeastOne')}
        </p>
      ) : null}
    </fieldset>
  );
}

// ---------------------------------------------------------------------------
// textarea — cv_paste
// ---------------------------------------------------------------------------

function PasteForm({
  form,
  disabled,
  onSubmit,
}: {
  form: CvForm;
  disabled: boolean;
  onSubmit: (text: string) => Promise<boolean>;
}) {
  const t = useTranslations('cv.form');
  const tEt = useTranslations('english.form');
  const [text, setText] = useState('');
  const max = form.constraints?.max_chars;
  const count = text.trim().length;
  const tooLong = Boolean(max && count > max);
  return (
    <form
      className="space-y-2"
      onSubmit={async (e) => {
        e.preventDefault();
        // Only a real send clears the box; a skipped / failed one keeps it.
        if (await onSubmit(text).catch(() => false)) setText('');
      }}
    >
      <FormTitle form={form} />
      <FormPrompt form={form} />
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        disabled={disabled}
        placeholder={t('pastePlaceholder')}
        aria-label={form.title || t('pastePlaceholder')}
        className="min-h-[160px] w-full resize-y rounded-lg border border-gray-200 p-3 text-sm leading-relaxed"
      />
      <div className="flex items-center justify-between gap-3">
        {max ? (
          <span
            className={cn('text-xs', tooLong ? 'text-red-600' : 'text-workspace-muted')}
            aria-live="polite"
            data-cv-paste-count
          >
            {tEt('chars', { count, max })}
          </span>
        ) : (
          <span />
        )}
        <Button type="submit" size="sm" disabled={disabled || count === 0 || tooLong}>
          {form.submit_label}
        </Button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// upload — cv_upload (POST /api/v1/inputs, not the chat send)
// ---------------------------------------------------------------------------

function UploadForm({
  form,
  disabled,
  runExclusive,
  deliver,
}: {
  form: CvForm;
  disabled: boolean;
  runExclusive: RunExclusive;
  deliver: Deliver;
}) {
  const t = useTranslations('cv.form');
  const tCv = useTranslations('cv');
  const tStates = useTranslations('states');
  const locale = useLocale();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** The upload request failed (not the device check): offer "Try again". */
  const [canRetry, setCanRetry] = useState(false);
  const [uploading, setUploading] = useState(false);

  const pick = (picked: File | undefined) => {
    if (!picked) return;
    setCanRetry(false);
    const problem = checkCvFormUpload(form, picked);
    if (problem) {
      setFile(null);
      setError(tCv(problem === 'wrongType' ? 'uploadErrorFormat' : 'uploadErrorSize'));
      return;
    }
    setError(null);
    setFile(picked);
  };

  const upload = () => {
    if (!file) return;
    void runExclusive(async () => {
      setUploading(true);
      setError(null);
      setCanRetry(false);
      try {
        const res = await uploadCvResumeFile(file, locale).catch((err: unknown) => ({
          success: false as const,
          data: undefined,
          error: err instanceof Error ? err.message : undefined,
          errorCode: 'NETWORK_ERROR',
        }));
        if (!res.success || !res.data) {
          setError(resolveCvUploadErrorMessage(res.error, res.errorCode, (key) => tCv(key)));
          setCanRetry(true);
          return false;
        }
        const shown = await deliver({
          kind: 'answered',
          display: t('uploaded', { name: file.name }),
          response: res.data.response,
        });
        // The upload landed, but the surface had nowhere to show the reply.
        if (!shown) setError(tCv('uploadErrorGeneric'));
        return shown;
      } finally {
        setUploading(false);
      }
    });
  };

  return (
    <div
      className="space-y-2"
      onDragOver={(e) => {
        if (!disabled) e.preventDefault();
      }}
      onDrop={(e) => {
        if (disabled) return;
        e.preventDefault();
        pick(e.dataTransfer.files?.[0]);
      }}
    >
      <FormTitle form={form} />
      <FormPrompt form={form} />
      <input
        ref={inputRef}
        type="file"
        className="sr-only"
        tabIndex={-1}
        accept={(form.accept ?? []).join(',')}
        disabled={disabled}
        aria-label={t('chooseFile')}
        data-cv-upload-input
        onChange={(e) => {
          pick(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-gray-300 p-3">
        <Button type="button" size="sm" variant="outline" disabled={disabled} onClick={() => inputRef.current?.click()}>
          <FileUp className="mr-1.5 h-4 w-4" aria-hidden />
          {t('chooseFile')}
        </Button>
        {file ? <span className="min-w-0 truncate text-sm text-workspace-text">{file.name}</span> : null}
      </div>
      {uploading ? (
        <p className="inline-flex items-center gap-2 text-sm text-workspace-muted" role="status">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          {tCv('uploading')}
        </p>
      ) : null}
      {error ? (
        <div className="flex flex-wrap items-center gap-2">
          <p role="alert" className="text-xs text-red-600">
            {error}
          </p>
          {canRetry && file ? (
            <Button type="button" size="sm" variant="outline" disabled={disabled} onClick={upload}>
              {tStates('retry')}
            </Button>
          ) : null}
        </div>
      ) : null}
      <Button type="button" size="sm" className="w-full" disabled={disabled || !file} onClick={upload}>
        {form.submit_label}
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// wizard — cv_wizard (modal)
// ---------------------------------------------------------------------------

/** `elsewhere`: edit mode, `resume: null` — the CV was changed outside the form. */
type LoadState = 'idle' | 'loading' | 'error' | 'elsewhere';

/** DOM id of a wizard field (shared by the field and the blocked-Next focus move). */
function wizardFieldId(idBase: string, fieldId: string): string {
  return `cvw-${idBase}-${fieldId}`.replace(/[^A-Za-z0-9_-]/g, '-');
}

function wizardIdBase(form: CvForm, step: CvWizardStep, item?: number): string {
  return item === undefined ? `${form.form_id}-${step.step_id}` : `${form.form_id}-${step.step_id}-${item}`;
}

function WizardForm({
  form,
  frozen,
  submitting,
  onSubmit,
}: {
  form: CvForm;
  /** Not the latest message (or no handler): the dialog can't be opened. */
  frozen: boolean;
  /** A submit is in flight: the dialog stays open, Save shows progress. */
  submitting: boolean;
  onSubmit: (draft: CvWizardDraft) => Promise<boolean>;
}) {
  const t = useTranslations('cv.form');
  const locale = useLocale();
  const steps = useMemo(() => form.steps ?? [], [form.steps]);
  const editMode = Boolean(form.document_id);
  const [open, setOpen] = useState(false);
  // The draft lives outside the dialog (and outside this bubble, keyed by
  // form_id): closing — or the next turn re-offering the same wizard — keeps
  // both the step and what was typed. Edit mode stores it only once the user
  // edited a field, and only reuses it while the document version matches.
  const [draft, setDraftState] = useState<CvWizardDraft | undefined>(() => readCvWizardDraft(form.form_id));
  const [loadState, setLoadState] = useState<LoadState>('idle');
  const requestRef = useRef(0);

  const setDraft = useCallback(
    (next: CvWizardDraft) => {
      setDraftState(next);
      if (!editMode || next.dirty) writeCvWizardDraft(form.form_id, next);
    },
    [editMode, form.form_id]
  );

  // Every open refetches (a draft from an older version would revert newer content).
  const loadResume = useCallback(async () => {
    if (!form.document_id) return;
    const request = ++requestRef.current;
    setLoadState('loading');
    const res = await fetchCvDocumentResume(form.document_id, locale).catch(() => null);
    if (request !== requestRef.current) return;
    if (!res || !res.success || !res.data) {
      setLoadState('error');
      return;
    }
    const { resume, version } = res.data;
    if (!resume) {
      // Changed outside the form: nothing here may replace it.
      clearCvWizardDraft(form.form_id);
      setDraftState(undefined);
      setLoadState('elsewhere');
      return;
    }
    const stored = readCvWizardDraft(form.form_id);
    if (stored && (stored.version ?? null) === version) {
      setDraftState(stored);
    } else {
      if (stored) clearCvWizardDraft(form.form_id);
      setDraftState({ ...cvWizardDraftFromResume(steps, resume), version });
    }
    setLoadState('idle');
  }, [form.document_id, form.form_id, locale, steps]);

  const openDialog = () => {
    setOpen(true);
    if (editMode) {
      void loadResume();
      return;
    }
    setDraftState(readCvWizardDraft(form.form_id) ?? emptyCvWizardDraft());
  };

  return (
    <div className="space-y-2">
      <FormTitle form={form} />
      <FormPrompt form={form} />
      <Button type="button" size="sm" variant="secondary" className="w-full" disabled={frozen} onClick={openDialog}>
        <PenLine className="mr-1.5 h-4 w-4" aria-hidden />
        {draft?.dirty ? t('reopen') : t('open')}
      </Button>
      <WizardDialog
        open={open && !frozen}
        form={form}
        steps={steps}
        draft={editMode && loadState !== 'idle' ? undefined : draft}
        loadState={loadState}
        submitting={submitting}
        onRetry={() => void loadResume()}
        onDraftChange={setDraft}
        onClose={() => setOpen(false)}
        onSubmit={async (final) => {
          // Close only on a real send; a skipped / failed one keeps the
          // dialog and the draft.
          if (await onSubmit(final)) {
            clearCvWizardDraft(form.form_id);
            setDraftState(undefined);
            setOpen(false);
          }
        }}
      />
    </div>
  );
}

function WizardDialog({
  open,
  form,
  steps,
  draft,
  loadState,
  submitting,
  onRetry,
  onDraftChange,
  onClose,
  onSubmit,
}: {
  open: boolean;
  form: CvForm;
  steps: CvWizardStep[];
  draft: CvWizardDraft | undefined;
  loadState: LoadState;
  submitting: boolean;
  onRetry: () => void;
  onDraftChange: (draft: CvWizardDraft) => void;
  onClose: () => void;
  onSubmit: (draft: CvWizardDraft) => void | Promise<void>;
}) {
  const t = useTranslations('cv.form');
  const tStates = useTranslations('states');
  const [showErrors, setShowErrors] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  /** Field to focus after the next render (a blocked Next). */
  const [focusTarget, setFocusTarget] = useState<{ id: string; nonce: number } | null>(null);

  useEffect(() => {
    if (!focusTarget || !open) return;
    document.getElementById(focusTarget.id)?.focus();
  }, [focusTarget, open]);

  let content: ReactNode;
  let footer: ReactNode = null;
  if (loadState === 'elsewhere') {
    content = (
      <p className="text-sm text-workspace-text" role="status" data-cv-wizard-elsewhere>
        {t('editElsewhere')}
      </p>
    );
  } else if (!draft) {
    content =
      loadState === 'error' ? (
        <div className="space-y-2" role="alert">
          <p className="text-sm text-red-600">{t('loadFailed')}</p>
          <Button type="button" size="sm" variant="outline" onClick={onRetry}>
            {tStates('retry')}
          </Button>
        </div>
      ) : (
        <p className="inline-flex items-center gap-2 text-sm text-workspace-muted" role="status">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          {t('loadingResume')}
        </p>
      );
  } else {
    const index = Math.min(Math.max(draft.step, 0), steps.length - 1);
    const step = steps[index];
    const missing = validateCvWizardStep(step, draft);
    const last = index === steps.length - 1;
    const goTo = (target: number) => {
      setShowErrors(false);
      setAnnouncement('');
      onDraftChange({ ...draft, step: target });
    };
    // Blocked Next: show the errors, move focus to the first missing field
    // and say which one it is.
    const block = (target: CvWizardStep, gaps: ReturnType<typeof validateCvWizardStep>) => {
      setShowErrors(true);
      const first = gaps[0];
      const field = target.fields.find((f) => f.field_id === first?.field_id);
      if (!first || !field) return;
      setAnnouncement(`${field.label}: ${t('required')}`);
      setFocusTarget({
        id: wizardFieldId(wizardIdBase(form, target, first.item), field.field_id),
        nonce: Date.now(),
      });
    };
    const next = () => {
      if (submitting) return;
      if (missing.length > 0) {
        block(step, missing);
        return;
      }
      if (!last) {
        goTo(index + 1);
        return;
      }
      const invalid = firstInvalidCvWizardStep(steps, draft);
      if (invalid >= 0) {
        onDraftChange({ ...draft, step: invalid });
        block(steps[invalid], validateCvWizardStep(steps[invalid], draft));
        return;
      }
      setAnnouncement('');
      void onSubmit(draft);
    };

    content = (
      <div className="space-y-4">
        <WizardStepBar form={form} steps={steps} current={index} />
        {index === 0 && form.prompt ? (
          <p className="whitespace-pre-wrap text-xs text-workspace-muted">{form.prompt}</p>
        ) : null}
        <h3 className="text-sm font-semibold text-workspace-text">{step.title}</h3>
        <WizardStepFields
          form={form}
          step={step}
          draft={draft}
          disabled={submitting}
          missing={showErrors ? missing : []}
          // A field edit (unlike Back / Next) makes the draft worth keeping.
          onDraftChange={(edited) => onDraftChange({ ...edited, dirty: true })}
        />
        <p className="sr-only" aria-live="assertive" data-cv-wizard-announce>
          {announcement}
        </p>
      </div>
    );
    footer = (
      <>
        <Button
          type="button"
          variant="ghost"
          className="flex-1"
          disabled={index === 0 || submitting}
          onClick={() => goTo(index - 1)}
        >
          {t('back')}
        </Button>
        <Button
          type="button"
          className="flex-1"
          disabled={submitting}
          aria-busy={submitting || undefined}
          data-cv-wizard-submit={last ? '' : undefined}
          onClick={next}
        >
          {submitting ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden /> : null}
          {last ? form.submit_label : t('next')}
        </Button>
      </>
    );
  }

  return (
    <CvFormDialog open={open} title={form.title} onClose={onClose} footer={footer}>
      {content}
    </CvFormDialog>
  );
}

function WizardStepBar({ form, steps, current }: { form: CvForm; steps: CvWizardStep[]; current: number }) {
  const t = useTranslations('cv.form');
  return (
    <div className="space-y-1.5">
      <p className="text-xs text-workspace-muted" data-cv-wizard-progress>
        {t('stepOf', { current: current + 1, total: steps.length })}
      </p>
      <ol className="flex flex-wrap gap-1.5" aria-label={form.title}>
        {steps.map((step, i) => (
          <li
            key={step.step_id}
            aria-current={i === current ? 'step' : undefined}
            className={cn(
              'rounded-full px-2.5 py-1 text-[11px]',
              i === current
                ? 'bg-primary text-white'
                : i < current
                  ? 'bg-workspace-active text-workspace-text'
                  : 'bg-gray-100 text-workspace-muted'
            )}
          >
            {step.title}
          </li>
        ))}
      </ol>
    </div>
  );
}

function WizardStepFields({
  form,
  step,
  draft,
  disabled,
  missing,
  onDraftChange,
}: {
  form: CvForm;
  step: CvWizardStep;
  draft: CvWizardDraft;
  disabled: boolean;
  missing: ReturnType<typeof validateCvWizardStep>;
  onDraftChange: (draft: CvWizardDraft) => void;
}) {
  const t = useTranslations('cv.form');
  const isMissing = (fieldId: string, item?: number) =>
    missing.some((m) => m.field_id === fieldId && m.item === item);

  if (!step.repeatable) {
    const values = draft.values[step.step_id] ?? {};
    const setValue = (fieldId: string, value: string) =>
      onDraftChange({
        ...draft,
        values: { ...draft.values, [step.step_id]: { ...values, [fieldId]: value } },
      });
    return (
      <div className="space-y-3">
        {step.fields.map((field) => (
          <WizardField
            key={field.field_id}
            idBase={wizardIdBase(form, step)}
            disabled={disabled}
            field={field}
            value={values[field.field_id] ?? ''}
            invalid={isMissing(field.field_id)}
            onChange={(value) => setValue(field.field_id, value)}
          />
        ))}
      </div>
    );
  }

  const items = draft.items[step.step_id] ?? [];
  const setItems = (next: CvWizardItem[]) =>
    onDraftChange({ ...draft, items: { ...draft.items, [step.step_id]: next } });

  return (
    <div className="space-y-3">
      {items.map((item, index) => (
        <div
          key={index}
          className="space-y-3 rounded-lg border border-gray-200 p-3"
          data-cv-wizard-item={index}
        >
          {step.fields.map((field) => (
            <WizardField
              key={field.field_id}
              idBase={wizardIdBase(form, step, index)}
              disabled={disabled}
              field={field}
              value={item[field.field_id] ?? ''}
              invalid={isMissing(field.field_id, index)}
              onChange={(value) =>
                setItems(items.map((it, i) => (i === index ? { ...it, [field.field_id]: value } : it)))
              }
            />
          ))}
          <button
            type="button"
            className="text-xs text-red-600 underline-offset-2 hover:underline"
            disabled={disabled}
            onClick={() => setItems(items.filter((_, i) => i !== index))}
          >
            {t('removeItem')}
          </button>
        </div>
      ))}
      <Button type="button" size="sm" variant="outline" disabled={disabled} onClick={() => setItems([...items, {}])}>
        {t('addItem')}
      </Button>
    </div>
  );
}

function WizardField({
  idBase,
  field,
  value,
  invalid,
  disabled,
  onChange,
}: {
  idBase: string;
  field: CvWizardField;
  disabled: boolean;
  value: string;
  invalid: boolean;
  onChange: (value: string) => void;
}) {
  const t = useTranslations('cv.form');
  const id = wizardFieldId(idBase, field.field_id);
  const errorId = `${id}-error`;
  const common = {
    id,
    value,
    disabled,
    placeholder: field.placeholder,
    'aria-required': field.required || undefined,
    'aria-invalid': invalid || undefined,
    'aria-describedby': invalid ? errorId : undefined,
    className: cn(
      'w-full rounded-lg border px-3 py-2 text-sm',
      invalid ? 'border-red-400' : 'border-gray-200'
    ),
  };
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-xs font-medium text-workspace-text">
        {field.label}
        {field.required ? (
          <span className="ml-0.5 text-red-600" aria-hidden>
            *
          </span>
        ) : null}
      </label>
      {field.type === 'textarea' ? (
        <textarea {...common} rows={4} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input {...common} type="text" onChange={(e) => onChange(e.target.value)} />
      )}
      {invalid ? (
        <p id={errorId} className="text-xs text-red-600">
          {t('required')}
        </p>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared dialog shell (same layout as ET's essay editor)
// ---------------------------------------------------------------------------

function CvFormDialog({
  open,
  title,
  onClose,
  footer,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  footer: ReactNode;
  children: ReactNode;
}) {
  const t = useTranslations('english.form');
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  useDialogFocusTrap({ open, onClose, dialogRef, initialFocusRef: closeRef });

  if (!open || typeof document === 'undefined') return null;

  // Portal to <body> (KAZI-652 / KAZI-664): the bubble sits inside the
  // virtualized, overflow-hidden message list. Mobile: full screen (never
  // side by side). Desktop: right-hand panel, the chat stays visible.
  return createPortal(
    <div className="fixed inset-0 z-[60] flex justify-end bg-black/30" role="presentation">
      <button type="button" className="absolute inset-0" aria-label={t('close')} tabIndex={-1} onClick={onClose} />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative flex h-full w-full flex-col bg-white shadow-xl sm:w-[min(560px,50vw)]"
      >
        <div className="flex items-start justify-between gap-3 border-b border-gray-200 px-5 py-4">
          <h2 id={titleId} className="text-base font-semibold text-workspace-text">
            {title}
          </h2>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="text-workspace-muted hover:text-workspace-text"
            aria-label={t('close')}
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-5 py-4">{children}</div>
        {footer ? <div className="flex gap-2 border-t border-gray-200 px-5 py-3">{footer}</div> : null}
      </div>
    </div>,
    document.body
  );
}
