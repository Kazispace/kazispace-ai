'use client';

import { useState, type ReactNode } from 'react';
import {
  Copy,
  FileDown,
  MessageSquareQuote,
  ThumbsDown,
  ThumbsUp,
} from 'lucide-react';
import { useTranslations } from 'next-intl';

import {
  copyTextToClipboard,
  downloadMessageAsMarkdown,
  formatQuotedMessage,
} from '@/lib/clinic/message-actions';
import {
  FEEDBACK_REASONS,
  canSubmitDownFeedback,
  clearMessageFeedback,
  isFeedbackNotReady,
  normalizeFeedbackReasons,
  resolveFeedbackMessageId,
  upsertMessageFeedback,
  type FeedbackReason,
  type FeedbackSurface,
  type FeedbackVote,
} from '@/lib/clinic/message-feedback';
import { useUIStore, type ComposerInsertTarget } from '@/lib/store';
import { cn } from '@/lib/utils';

export type MessageFeedbackVote = FeedbackVote;

/** Session-local vote memory so remount after scroll keeps pressed state. */
const feedbackVotesByMessageId = new Map<string, MessageFeedbackVote>();

type MessageActionsProps = {
  content: string;
  messageId?: string;
  serverMessageId?: string;
  /** When false, quote/copy/save stay; thumbs are hidden (Agent Hub). */
  feedbackEnabled?: boolean;
  /** Which composer should receive quote inserts (clinic vs space). */
  composerTarget: ComposerInsertTarget;
  disabled?: boolean;
  className?: string;
};

function ActionButton({
  label,
  disabled,
  pressed,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  pressed?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      className={cn(
        'flex h-7 w-7 items-center justify-center rounded-md',
        'bg-transparent text-[#86909C]',
        'transition-colors hover:bg-gray-100 hover:text-[#1D2129]',
        'disabled:cursor-not-allowed disabled:opacity-40',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kazi-orange/40',
        pressed && 'bg-gray-100 text-[#1D2129]',
      )}
    >
      {children}
    </button>
  );
}

function surfaceFromTarget(target: ComposerInsertTarget): FeedbackSurface {
  return target === 'space' ? 'space' : 'clinic';
}

/**
 * Assistant bubble toolbar: quote · thumbs up/down · copy · save as document.
 * Thumbs → KAZI-254 feedback API when a persisted server message id is available.
 */
export function MessageActions({
  content,
  messageId,
  serverMessageId,
  feedbackEnabled = true,
  composerTarget,
  disabled,
  className,
}: MessageActionsProps) {
  const t = useTranslations('chat');
  const showToast = useUIStore((s) => s.showToast);
  const requestComposerInsert = useUIStore((s) => s.requestComposerInsert);

  const feedbackId = resolveFeedbackMessageId({ serverMessageId, messageId });
  const voteKey = feedbackId ?? messageId;
  const canSubmit = Boolean(feedbackId);

  const [vote, setVote] = useState<MessageFeedbackVote | null>(() =>
    voteKey ? feedbackVotesByMessageId.get(voteKey) ?? null : null,
  );
  const [downOpen, setDownOpen] = useState(false);
  const [reasons, setReasons] = useState<FeedbackReason[]>([]);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const text = content.trim();
  if (!text) return null;

  const persistVote = (next: MessageFeedbackVote | null) => {
    setVote(next);
    if (!voteKey) return;
    if (next) feedbackVotesByMessageId.set(voteKey, next);
    else feedbackVotesByMessageId.delete(voteKey);
  };

  const handleQuote = () => {
    const quoted = formatQuotedMessage(text);
    if (!quoted) return;
    requestComposerInsert(quoted, composerTarget);
    showToast(t('messageActions.quoted'), 'info');
  };

  const handleCopy = async () => {
    const ok = await copyTextToClipboard(text);
    showToast(
      ok ? t('messageActions.copied') : t('messageActions.copyFailed'),
      ok ? 'info' : 'error',
    );
  };

  const handleSaveDoc = () => {
    const ok = downloadMessageAsMarkdown(text);
    showToast(
      ok ? t('messageActions.savedDocument') : t('messageActions.saveFailed'),
      ok ? 'info' : 'error',
    );
  };

  const toggleReason = (reason: FeedbackReason) => {
    setReasons((prev) =>
      prev.includes(reason)
        ? prev.filter((item) => item !== reason)
        : [...prev, reason],
    );
  };

  const submitUp = async () => {
    if (!canSubmit || !feedbackId || submitting) {
      if (!canSubmit) showToast(t('messageActions.feedbackUnavailable'), 'info');
      return;
    }
    setSubmitting(true);
    setDownOpen(false);
    try {
      const res = await upsertMessageFeedback(feedbackId, {
        vote: 'up',
        reasons: [],
        surface: surfaceFromTarget(composerTarget),
        client_message_id: messageId ?? null,
      });
      if (!res.success) {
        if (isFeedbackNotReady(res)) {
          showToast(t('messageActions.feedbackNotReady'), 'info');
        } else {
          showToast(res.error ?? t('messageActions.feedbackFailed'), 'error');
        }
        return;
      }
      persistVote('up');
      setReasons([]);
      setNote('');
      showToast(
        res.data?.attribution_missing
          ? t('messageActions.feedbackRecorded')
          : t('messageActions.feedbackThanksUp'),
        'info',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const submitDown = async () => {
    if (!canSubmit || !feedbackId || submitting) {
      if (!canSubmit) showToast(t('messageActions.feedbackUnavailable'), 'info');
      return;
    }
    const selected = normalizeFeedbackReasons(reasons);
    if (!canSubmitDownFeedback(selected)) {
      showToast(t('messageActions.feedbackNeedReason'), 'info');
      return;
    }
    const trimmedNote = note.trim();
    if (trimmedNote.length > 500) {
      showToast(t('messageActions.feedbackNoteTooLong'), 'error');
      return;
    }
    setSubmitting(true);
    try {
      const res = await upsertMessageFeedback(feedbackId, {
        vote: 'down',
        reasons: selected,
        note: trimmedNote || null,
        surface: surfaceFromTarget(composerTarget),
        client_message_id: messageId ?? null,
      });
      if (!res.success) {
        if (isFeedbackNotReady(res)) {
          showToast(t('messageActions.feedbackNotReady'), 'info');
        } else {
          showToast(res.error ?? t('messageActions.feedbackFailed'), 'error');
        }
        return;
      }
      persistVote('down');
      setDownOpen(false);
      showToast(
        res.data?.attribution_missing
          ? t('messageActions.feedbackRecorded')
          : t('messageActions.feedbackThanksDown'),
        'info',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const clearVote = async () => {
    if (!canSubmit || !feedbackId || submitting) {
      persistVote(null);
      setDownOpen(false);
      setReasons([]);
      setNote('');
      return;
    }
    setSubmitting(true);
    try {
      const res = await clearMessageFeedback(feedbackId);
      if (!res.success) {
        showToast(res.error ?? t('messageActions.feedbackFailed'), 'error');
        return;
      }
      persistVote(null);
      setDownOpen(false);
      setReasons([]);
      setNote('');
    } finally {
      setSubmitting(false);
    }
  };

  const handleThumbsUp = () => {
    if (disabled || submitting) return;
    if (vote === 'up') {
      void clearVote();
      return;
    }
    void submitUp();
  };

  const handleThumbsDown = () => {
    if (disabled || submitting) return;
    if (vote === 'down' && !downOpen) {
      void clearVote();
      return;
    }
    if (!canSubmit) {
      showToast(t('messageActions.feedbackUnavailable'), 'info');
      return;
    }
    setDownOpen((open) => !open);
  };

  const thumbsDisabled = disabled || submitting;

  return (
    <div className={cn('relative flex flex-col gap-1.5', className)}>
      <div className="flex items-center gap-0.5">
        <ActionButton
          label={t('messageActions.quote')}
          disabled={disabled}
          onClick={handleQuote}
        >
          <MessageSquareQuote className="h-3.5 w-3.5" strokeWidth={2} />
        </ActionButton>

        {feedbackEnabled ? (
          <>
            <ActionButton
              label={t('messageActions.thumbsUp')}
              disabled={thumbsDisabled}
              pressed={vote === 'up'}
              onClick={handleThumbsUp}
            >
              <ThumbsUp className="h-3.5 w-3.5" strokeWidth={2} />
            </ActionButton>

            <ActionButton
              label={t('messageActions.thumbsDown')}
              disabled={thumbsDisabled}
              pressed={vote === 'down' || downOpen}
              onClick={handleThumbsDown}
            >
              <ThumbsDown className="h-3.5 w-3.5" strokeWidth={2} />
            </ActionButton>
          </>
        ) : null}

        <ActionButton
          label={t('messageActions.copy')}
          disabled={disabled}
          onClick={() => void handleCopy()}
        >
          <Copy className="h-3.5 w-3.5" strokeWidth={2} />
        </ActionButton>

        <ActionButton
          label={t('messageActions.saveDocument')}
          disabled={disabled}
          onClick={handleSaveDoc}
        >
          <FileDown className="h-3.5 w-3.5" strokeWidth={2} />
        </ActionButton>
      </div>

      {feedbackEnabled && downOpen ? (
        <div
          className="ml-0.5 flex max-w-md flex-col gap-2 rounded-md border border-[#E5E6EB] bg-[#FAFAFA] p-2"
          role="group"
          aria-label={t('messageActions.feedbackReasonsLabel')}
        >
          <p className="text-[11px] text-[#4E5969]">
            {t('messageActions.feedbackReasonsHint')}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {FEEDBACK_REASONS.map((reason) => {
              const selected = reasons.includes(reason);
              return (
                <button
                  key={reason}
                  type="button"
                  disabled={submitting}
                  aria-pressed={selected}
                  onClick={() => toggleReason(reason)}
                  className={cn(
                    'rounded-md px-2 py-1 text-[11px] transition-colors',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kazi-orange/40',
                    selected
                      ? 'bg-[#1D2129] text-white'
                      : 'bg-white text-[#4E5969] ring-1 ring-[#E5E6EB] hover:bg-gray-50',
                  )}
                >
                  {t(`messageActions.reasons.${reason}`)}
                </button>
              );
            })}
          </div>
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value.slice(0, 500))}
            disabled={submitting}
            rows={2}
            maxLength={500}
            placeholder={t('messageActions.feedbackNotePlaceholder')}
            className={cn(
              'w-full resize-none rounded-md border border-[#E5E6EB] bg-white px-2 py-1.5',
              'text-[11px] text-[#1D2129] placeholder:text-[#C9CDD4]',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kazi-orange/40',
            )}
          />
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              disabled={submitting}
              onClick={() => {
                setDownOpen(false);
                setReasons([]);
                setNote('');
              }}
              className="text-[11px] text-[#86909C] hover:text-[#1D2129]"
            >
              {t('messageActions.feedbackCancel')}
            </button>
            <button
              type="button"
              disabled={submitting || !canSubmitDownFeedback(reasons)}
              onClick={() => void submitDown()}
              className={cn(
                'rounded-md bg-kazi-orange px-2.5 py-1 text-[11px] font-medium text-white',
                'disabled:cursor-not-allowed disabled:opacity-40',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kazi-orange/40',
              )}
            >
              {t('messageActions.feedbackSubmit')}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
