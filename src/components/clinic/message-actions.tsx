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
import { useUIStore } from '@/lib/store';
import { cn } from '@/lib/utils';

export type MessageFeedbackVote = 'up' | 'down';

type MessageActionsProps = {
  content: string;
  /** Optional id for future feedback / corpus API. */
  messageId?: string;
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
        'flex h-7 w-7 items-center justify-center rounded-md text-[#86909C]',
        'transition-colors hover:bg-gray-100 hover:text-[#1D2129]',
        'disabled:cursor-not-allowed disabled:opacity-40',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kazi-orange/40',
        pressed && 'bg-orange-50 text-kazi-orange hover:bg-orange-50 hover:text-kazi-orange',
      )}
    >
      {children}
    </button>
  );
}

/**
 * Assistant bubble toolbar: quote · thumbs up/down · copy · save as document.
 * Thumbs feedback is local for now — TODO(corpus): POST rating for training data.
 */
export function MessageActions({
  content,
  messageId,
  disabled,
  className,
}: MessageActionsProps) {
  const t = useTranslations('chat');
  const showToast = useUIStore((s) => s.showToast);
  const requestComposerInsert = useUIStore((s) => s.requestComposerInsert);
  const [vote, setVote] = useState<MessageFeedbackVote | null>(null);

  const text = content.trim();
  if (!text) return null;

  const handleQuote = () => {
    const quoted = formatQuotedMessage(text);
    if (!quoted) return;
    requestComposerInsert(quoted);
    showToast(t('messageActions.quoted'), 'info');
  };

  const handleFeedback = (next: MessageFeedbackVote) => {
    const cleared = vote === next;
    const selected = cleared ? null : next;
    setVote(selected);
    // TODO(corpus): send { messageId, vote: selected, contentHash } to feedback API.
    void messageId;
    if (selected === 'up') {
      showToast(t('messageActions.feedbackThanksUp'), 'info');
    } else if (selected === 'down') {
      showToast(t('messageActions.feedbackThanksDown'), 'info');
    }
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

  return (
    <div className={cn('relative flex items-center gap-0.5', className)}>
      <ActionButton
        label={t('messageActions.quote')}
        disabled={disabled}
        onClick={handleQuote}
      >
        <MessageSquareQuote className="h-3.5 w-3.5" strokeWidth={2} />
      </ActionButton>

      <ActionButton
        label={t('messageActions.thumbsUp')}
        disabled={disabled}
        pressed={vote === 'up'}
        onClick={() => handleFeedback('up')}
      >
        <ThumbsUp className="h-3.5 w-3.5" strokeWidth={2} />
      </ActionButton>

      <ActionButton
        label={t('messageActions.thumbsDown')}
        disabled={disabled}
        pressed={vote === 'down'}
        onClick={() => handleFeedback('down')}
      >
        <ThumbsDown className="h-3.5 w-3.5" strokeWidth={2} />
      </ActionButton>

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
  );
}
