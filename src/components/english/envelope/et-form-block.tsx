'use client';

import { useCallback, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslations } from 'next-intl';
import { Loader2, PenLine, X } from 'lucide-react';

import { VoiceRecordButton } from '@/components/chat/voice-record-button';
import { Button } from '@/components/ui/button';
import { useDialogFocusTrap } from '@/hooks/use-dialog-focus-trap';
import { useVoiceToChat } from '@/hooks/use-voice-to-chat';
import { ENGLISH_TUTOR_AGENT_ID } from '@/lib/english-tutor-config';
import {
  buildEtFormSubmit,
  countWords,
  type EtForm,
  type EtFormSubmit,
} from '@/lib/english-tutor/form';
import { cn } from '@/lib/utils';

export interface EtFormBlockProps {
  form: EtForm;
  /** Freeze rule (SSOT §5.3.6): only the latest message's form is interactive. */
  active: boolean;
  onSubmit?: (submit: EtFormSubmit) => void | Promise<void>;
}

/**
 * KAZI-1041 · renders `meta.form` (inline radio / inline audio / modal essay).
 * Frozen forms stay visible with whatever the user filled in, but disabled.
 */
export function EtFormBlock({ form, active, onSubmit }: EtFormBlockProps) {
  const t = useTranslations('english.form');
  const interactive = active && Boolean(onSubmit);
  const inFlightRef = useRef(false);
  const [submitting, setSubmitting] = useState(false);

  const submit = useCallback(
    async (answer: { optionId: string } | { text: string }) => {
      if (!interactive || inFlightRef.current) return false;
      const built = buildEtFormSubmit(form, answer);
      if (!built) return false;
      inFlightRef.current = true;
      setSubmitting(true);
      try {
        await onSubmit?.(built);
        return true;
      } finally {
        inFlightRef.current = false;
        setSubmitting(false);
      }
    },
    [form, interactive, onSubmit]
  );

  const disabled = !interactive || submitting;

  return (
    <div
      className={cn(
        'mt-3 space-y-2 rounded-xl border border-gray-200 bg-white p-3',
        !active && 'opacity-60'
      )}
      data-et-form={form.kind}
      data-et-form-active={active ? 'true' : 'false'}
    >
      {form.title ? (
        <p className="text-[13px] font-semibold text-workspace-text">{form.title}</p>
      ) : null}
      {form.control === 'radio' ? (
        <RadioForm form={form} disabled={disabled} onSubmit={submit} />
      ) : form.control === 'audio' ? (
        <AudioForm form={form} disabled={disabled} onSubmit={submit} />
      ) : (
        <EssayForm form={form} disabled={disabled} onSubmit={submit} />
      )}
      {!active ? <p className="text-[11px] text-workspace-muted">{t('frozen')}</p> : null}
    </div>
  );
}

type SubmitFn = (answer: { optionId: string } | { text: string }) => Promise<boolean>;

function RadioForm({ form, disabled, onSubmit }: { form: EtForm; disabled: boolean; onSubmit: SubmitFn }) {
  const [selected, setSelected] = useState<string | null>(null);
  const name = `et-form-${form.form_id}`;
  return (
    <form
      className="space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (selected) void onSubmit({ optionId: selected });
      }}
    >
      <fieldset className="flex flex-col gap-1.5" disabled={disabled}>
        <legend className="sr-only">{form.title}</legend>
        {form.options.map((option) => (
          <label
            key={option.id}
            className={cn(
              'flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors',
              selected === option.id
                ? 'border-primary/50 bg-workspace-active'
                : 'border-gray-200 bg-white hover:bg-gray-50',
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

function AudioForm({ form, disabled, onSubmit }: { form: EtForm; disabled: boolean; onSubmit: SubmitFn }) {
  const t = useTranslations('english.form');
  const [typing, setTyping] = useState(false);
  const [text, setText] = useState('');
  const { handleSendAudio, isTranscribing } = useVoiceToChat({
    onSendText: async (transcript) => {
      await onSubmit({ text: transcript });
    },
    contextModule: ENGLISH_TUTOR_AGENT_ID,
  });

  return (
    <div className="space-y-2">
      {form.prompt ? <p className="whitespace-pre-wrap text-sm text-workspace-text">{form.prompt}</p> : null}
      <div className="flex items-center gap-2">
        {isTranscribing ? (
          <span className="inline-flex items-center gap-2 text-sm text-workspace-muted">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            {t('transcribing')}
          </span>
        ) : (
          <>
            <VoiceRecordButton onRecordComplete={handleSendAudio} disabled={disabled} />
            <span className="text-sm text-workspace-muted">{t('record')}</span>
          </>
        )}
      </div>
      {form.allow_text ? (
        typing ? (
          <form
            className="flex gap-2"
            onSubmit={async (e) => {
              e.preventDefault();
              if (await onSubmit({ text })) setText('');
            }}
          >
            <input
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              disabled={disabled}
              placeholder={t('typePlaceholder')}
              aria-label={t('typePlaceholder')}
              className="min-w-0 flex-1 rounded-lg border border-gray-200 px-3 py-1.5 text-sm"
            />
            <Button type="submit" size="sm" disabled={disabled || !text.trim()}>
              {form.submit_label}
            </Button>
          </form>
        ) : (
          <button
            type="button"
            disabled={disabled}
            onClick={() => setTyping(true)}
            className="text-xs text-primary underline-offset-2 hover:underline disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t('typeInstead')}
          </button>
        )
      ) : null}
    </div>
  );
}

function EssayForm({ form, disabled, onSubmit }: { form: EtForm; disabled: boolean; onSubmit: SubmitFn }) {
  const t = useTranslations('english.form');
  const [open, setOpen] = useState(false);
  // Draft lives here, not in the dialog: closing the editor (or the form
  // freezing) keeps what the user typed for review.
  const [draft, setDraft] = useState('');
  return (
    <div className="space-y-2">
      {form.prompt ? (
        <p className="line-clamp-3 whitespace-pre-wrap text-sm text-workspace-text">{form.prompt}</p>
      ) : null}
      <Button
        type="button"
        size="sm"
        variant="secondary"
        className="w-full"
        disabled={disabled}
        onClick={() => setOpen(true)}
      >
        <PenLine className="mr-1.5 h-4 w-4" aria-hidden />
        {draft.trim() ? t('reopen') : t('open')}
      </Button>
      <EssayDialog
        open={open && !disabled}
        form={form}
        draft={draft}
        onDraftChange={setDraft}
        onClose={() => setOpen(false)}
        onSubmit={async () => {
          if (await onSubmit({ text: draft })) setOpen(false);
        }}
      />
    </div>
  );
}

function EssayDialog({
  open,
  form,
  draft,
  onDraftChange,
  onClose,
  onSubmit,
}: {
  open: boolean;
  form: EtForm;
  draft: string;
  onDraftChange: (value: string) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  const t = useTranslations('english.form');
  const dialogRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  useDialogFocusTrap({ open, onClose, dialogRef, initialFocusRef: textareaRef });

  if (!open || typeof document === 'undefined') return null;
  const words = countWords(draft);
  const minWords = form.constraints?.min_words;
  const maxChars = form.constraints?.max_chars;
  const titleId = `et-essay-title-${form.form_id}`;

  // Portal to <body> like every other dialog here (KAZI-652 / KAZI-664): the
  // bubble sits inside the virtualized, overflow-hidden message list.
  // Mobile: full screen. Desktop: right-hand panel, chat stays visible on the left.
  return createPortal(
    <div className="fixed inset-0 z-[60] flex justify-end bg-black/30" role="presentation">
      <button type="button" className="absolute inset-0" aria-label={t('close')} onClick={onClose} />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative flex h-full w-full flex-col bg-white shadow-xl sm:w-[min(560px,50vw)]"
      >
        <div className="flex items-start justify-between gap-3 border-b border-gray-200 px-5 py-4">
          <h2 id={titleId} className="text-base font-semibold text-workspace-text">
            {form.title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-workspace-muted hover:text-workspace-text"
            aria-label={t('close')}
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-5 py-4">
          {form.prompt ? (
            <p className="whitespace-pre-wrap rounded-lg bg-gray-50 p-3 text-sm leading-relaxed text-workspace-text">
              {form.prompt}
            </p>
          ) : null}
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={(e) => onDraftChange(e.target.value)}
            placeholder={t('essayPlaceholder')}
            aria-label={form.title}
            className="min-h-[240px] flex-1 resize-none rounded-lg border border-gray-200 p-3 text-[15px] leading-relaxed"
          />
          <div className="flex flex-wrap justify-between gap-2 text-xs text-workspace-muted">
            <span>
              {t('words', { count: words })}
              {minWords ? ` · ${t('minWords', { min: minWords })}` : ''}
            </span>
            {maxChars ? <span>{t('chars', { count: draft.length, max: maxChars })}</span> : null}
          </div>
        </div>
        <div className="flex gap-2 border-t border-gray-200 px-5 py-3">
          <Button type="button" variant="ghost" className="flex-1" onClick={onClose}>
            {t('cancel')}
          </Button>
          <Button type="button" className="flex-1" disabled={!draft.trim()} onClick={onSubmit}>
            {form.submit_label}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}
