'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Copy,
  FileDown,
  MessageSquareQuote,
  SmilePlus,
} from 'lucide-react';
import { useTranslations } from 'next-intl';

import {
  QUICK_REPLY_EMOJIS,
  copyTextToClipboard,
  downloadMessageAsMarkdown,
  formatQuotedMessage,
} from '@/lib/clinic/message-actions';
import { useUIStore } from '@/lib/store';
import { cn } from '@/lib/utils';

type MessageActionsProps = {
  content: string;
  disabled?: boolean;
  className?: string;
};

function ActionButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
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
      className={cn(
        'flex h-7 w-7 items-center justify-center rounded-md text-[#86909C]',
        'transition-colors hover:bg-gray-100 hover:text-[#1D2129]',
        'disabled:cursor-not-allowed disabled:opacity-40',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kazi-orange/40',
      )}
    >
      {children}
    </button>
  );
}

/**
 * Assistant bubble toolbar: quote · emoji quick-reply · copy · save as document.
 * Quote / emoji insert into the shared composer via UI store.
 */
export function MessageActions({
  content,
  disabled,
  className,
}: MessageActionsProps) {
  const t = useTranslations('chat');
  const showToast = useUIStore((s) => s.showToast);
  const requestComposerInsert = useUIStore((s) => s.requestComposerInsert);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!emojiOpen) return;
    const onPointer = (e: MouseEvent) => {
      if (!popoverRef.current?.contains(e.target as Node)) {
        setEmojiOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointer);
    return () => document.removeEventListener('mousedown', onPointer);
  }, [emojiOpen]);

  const text = content.trim();
  if (!text) return null;

  const handleQuote = () => {
    const quoted = formatQuotedMessage(text);
    if (!quoted) return;
    requestComposerInsert(quoted);
    showToast(t('messageActions.quoted'), 'info');
  };

  const handleEmoji = (emoji: string) => {
    requestComposerInsert(`${emoji} `);
    setEmojiOpen(false);
    showToast(t('messageActions.emojiInserted'), 'info');
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
    <div
      className={cn('relative flex items-center gap-0.5', className)}
      ref={popoverRef}
    >
      <ActionButton
        label={t('messageActions.quote')}
        disabled={disabled}
        onClick={handleQuote}
      >
        <MessageSquareQuote className="h-3.5 w-3.5" strokeWidth={2} />
      </ActionButton>

      <ActionButton
        label={t('messageActions.quickReply')}
        disabled={disabled}
        onClick={() => setEmojiOpen((v) => !v)}
      >
        <SmilePlus className="h-3.5 w-3.5" strokeWidth={2} />
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

      {emojiOpen ? (
        <div
          role="listbox"
          aria-label={t('messageActions.quickReply')}
          className="absolute bottom-full left-0 z-30 mb-1 flex gap-0.5 rounded-xl border border-gray-200 bg-white p-1 shadow-lg"
        >
          {QUICK_REPLY_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              role="option"
              disabled={disabled}
              onClick={() => handleEmoji(emoji)}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-base hover:bg-gray-50 disabled:opacity-40"
              aria-label={emoji}
            >
              {emoji}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
