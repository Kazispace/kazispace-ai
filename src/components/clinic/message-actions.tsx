'use client';

import { useEffect, useState, type ReactNode } from 'react';
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
  getMessageFeedback,
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

type FeedbackDraft = {
  vote: MessageFeedbackVote | null;
  reasons: FeedbackReason[];
  note: string;
  /** Session already synced from GET or a successful mutate. */
  hydratedFromServer: boolean;
};

/** Session-local draft/vote memory so remount after scroll keeps state. */
const feedbackDraftByMessageId = new Map<string, FeedbackDraft>();

function readDraft(key: string | undefined): FeedbackDraft | undefined {
  if (!key) return undefined;
  return feedbackDraftByMessageId.get(key);
}

function writeDraft(key: string | undefined, draft: FeedbackDraft): void {
  if (!key) return;
  feedbackDraftByMessageId.set(key, draft);
}

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
        'bg-transparent text-workspace-muted',
        'transition-colors hover:bg-gray-100 hover:text-workspace-text',
        'disabled:cursor-not-allowed disabled:opacity-40',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
        pressed && 'bg-gray-100 text-workspace-text',
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
  const cached = readDraft(voteKey);

  const [vote, setVote] = useState<MessageFeedbackVote | null>(
    () => cached?.vote ?? null,
  );
  const [downOpen, setDownOpen] = useState(false);
  const [reasons, setReasons] = useState<FeedbackReason[]>(
    () => cached?.reasons ?? [],
  );
  const [note, setNote] = useState(() => cached?.note ?? '');
  const [submitting, setSubmitting] = useState(false);

  const persistDraft = (next: {
    vote: MessageFeedbackVote | null;
    reasons: FeedbackReason[];
    note: string;
    hydratedFromServer?: boolean;
  }) => {
    setVote(next.vote);
    setReasons(next.reasons);
    setNote(next.note);
    const prev = readDraft(voteKey);
    writeDraft(voteKey, {
      vote: next.vote,
      reasons: next.reasons,
      note: next.note,
      hydratedFromServer:
        next.hydratedFromServer ?? prev?.hydratedFromServer ?? false,
    });
  };

  // P2-1: hydrate vote from BE once per message id (viewport mount / refresh).
  useEffect(() => {
    if (!feedbackEnabled || !feedbackId || !voteKey) return;
    const existing = readDraft(voteKey);
    if (existing?.hydratedFromServer) return;

    let cancelled = false;
    void getMessageFeedback(feedbackId).then((res) => {
      if (cancelled) return;
      if (!res.success || !res.data) {
        writeDraft(voteKey, {
          vote: existing?.vote ?? null,
          reasons: existing?.reasons ?? [],
          note: existing?.note ?? '',
          hydratedFromServer: true,
        });
        return;
      }
      const nextVote = res.data.vote;
      const nextReasons = normalizeFeedbackReasons(res.data.reasons);
      const nextNote = res.data.note?.trim() ?? '';
      // Prefer in-progress local draft (reasons/note) if user already opened the panel.
      const preferLocalDraft =
        Boolean(existing) &&
        ((existing?.reasons.length ?? 0) > 0 || Boolean(existing?.note));
      const merged: FeedbackDraft = {
        vote: nextVote,
        reasons: preferLocalDraft ? (existing?.reasons ?? nextReasons) : nextReasons,
        note: preferLocalDraft ? (existing?.note ?? nextNote) : nextNote,
        hydratedFromServer: true,
      };
      writeDraft(voteKey, merged);
      setVote(merged.vote);
      if (!preferLocalDraft) {
        setReasons(merged.reasons);
        setNote(merged.note);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [feedbackEnabled, feedbackId, voteKey]);

  const text = content.trim();
  if (!text) return null;

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
    setReasons((prev) => {
      const next = prev.includes(reason)
        ? prev.filter((item) => item !== reason)
        : [...prev, reason];
      writeDraft(voteKey, {
        vote,
        reasons: next,
        note,
        hydratedFromServer: readDraft(voteKey)?.hydratedFromServer ?? false,
      });
      return next;
    });
  };

  const updateNote = (value: string) => {
    const next = value.slice(0, 500);
    setNote(next);
    writeDraft(voteKey, {
      vote,
      reasons,
      note: next,
      hydratedFromServer: readDraft(voteKey)?.hydratedFromServer ?? false,
    });
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
      persistDraft({
        vote: 'up',
        reasons: [],
        note: '',
        hydratedFromServer: true,
      });
      showToast(t('messageActions.feedbackThanksUp'), 'info');
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
      persistDraft({
        vote: 'down',
        reasons: [],
        note: '',
        hydratedFromServer: true,
      });
      setDownOpen(false);
      showToast(t('messageActions.feedbackThanksDown'), 'info');
    } finally {
      setSubmitting(false);
    }
  };

  const clearVote = async () => {
    if (!canSubmit || !feedbackId || submitting) {
      persistDraft({ vote: null, reasons: [], note: '' });
      setDownOpen(false);
      return;
    }
    setSubmitting(true);
    try {
      const res = await clearMessageFeedback(feedbackId);
      if (!res.success) {
        showToast(res.error ?? t('messageActions.feedbackFailed'), 'error');
        return;
      }
      persistDraft({
        vote: null,
        reasons: [],
        note: '',
        hydratedFromServer: true,
      });
      setDownOpen(false);
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
          // KAZI-662: was a bare #FAFAFA literal, a near-exact match (diff of
          // 0/1/2 per RGB channel) for workspace.header (#FAFBFC) — merged
          // rather than kept as a separate near-neighbor value.
          className="ml-0.5 flex max-w-md flex-col gap-2 rounded-md border border-workspace-border bg-workspace-header p-2"
          role="group"
          aria-label={t('messageActions.feedbackReasonsLabel')}
        >
          <p className="text-[11px] text-workspace-secondary">
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
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
                    selected
                      ? 'bg-workspace-text text-white'
                      : 'bg-white text-workspace-secondary ring-1 ring-workspace-border hover:bg-gray-50',
                  )}
                >
                  {t(`messageActions.reasons.${reason}`)}
                </button>
              );
            })}
          </div>
          <textarea
            value={note}
            onChange={(event) => updateNote(event.target.value)}
            disabled={submitting}
            rows={2}
            maxLength={500}
            placeholder={t('messageActions.feedbackNotePlaceholder')}
            className={cn(
              'w-full resize-none rounded-md border border-workspace-border bg-white px-2 py-1.5',
              'text-[11px] text-workspace-text placeholder:text-workspace-placeholder',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
            )}
          />
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              disabled={submitting}
              onClick={() => {
                setDownOpen(false);
                persistDraft({
                  vote,
                  reasons: [],
                  note: '',
                });
              }}
              className="text-[11px] text-workspace-muted hover:text-workspace-text"
            >
              {t('messageActions.feedbackCancel')}
            </button>
            <button
              type="button"
              disabled={submitting || !canSubmitDownFeedback(reasons)}
              onClick={() => void submitDown()}
              className={cn(
                'rounded-md bg-primary px-2.5 py-1 text-[11px] font-medium text-white',
                'disabled:cursor-not-allowed disabled:opacity-40',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
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
