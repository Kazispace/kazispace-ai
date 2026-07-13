'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

import { useSpaceDetail } from '@/hooks/use-space-detail';
import { useSpaceTurn } from '@/hooks/use-space-turn';
import { TEMPLATE_EMOJI } from '@/lib/spaces/constants';
import { cn } from '@/lib/utils';

interface SpaceWorkspaceProps {
  spaceId: string;
}

export function SpaceWorkspace({ spaceId }: SpaceWorkspaceProps) {
  const t = useTranslations('spaces');
  const { space, isLoading, error } = useSpaceDetail(spaceId);
  const { messages, isHydrating, isSending, sendError, sendMessage } = useSpaceTurn(
    spaceId,
    space?.master_session_id ?? null
  );
  const [draft, setDraft] = useState('');

  if (isLoading && !space) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-[#86909C]">
        {t('loading')}
      </div>
    );
  }

  if (error || !space) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
        <p className="text-sm text-[#4E5969]">{error ?? t('loadFailed')}</p>
        <p className="text-xs text-[#86909C]">{t('apiNotReadyHint')}</p>
      </div>
    );
  }

  if (isHydrating && messages.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-[#86909C]">
        {t('loading')}
      </div>
    );
  }

  const emoji = TEMPLATE_EMOJI[space.template_id] ?? '✨';
  const layout =
    (space.config_snapshot?.rendering as { layout?: string } | undefined)?.layout ??
    'chat_only';

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text || isSending) return;
    setDraft('');
    await sendMessage(text);
  };

  return (
    <div className="flex h-full flex-col bg-white">
      <div className="border-b border-[#E5E6EB] px-4 py-3 md:px-6">
        <div className="flex items-center gap-2">
          <span className="text-lg" aria-hidden>
            {emoji}
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-base font-semibold text-[#1D2129]">{space.name}</h1>
            <p className="text-xs text-[#86909C]">
              {t('statusLabel', { status: space.status })}
              {layout === 'chat_with_panels' ? ` · ${t('panelsLayout')}` : ''}
            </p>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 md:px-6">
        {messages.length === 0 ? (
          <p className="text-sm text-[#86909C]">{t('emptyState')}</p>
        ) : (
          <ul className="space-y-3">
            {messages.map((message) => (
              <li
                key={message.id}
                className={cn(
                  'max-w-[85%] rounded-2xl px-4 py-2.5 text-sm',
                  message.role === 'user'
                    ? 'ml-auto bg-kazi-orange text-white'
                    : 'bg-[#F2F3F5] text-[#1D2129]'
                )}
              >
                {message.content}
              </li>
            ))}
          </ul>
        )}
        {sendError ? (
          <p className="mt-3 text-xs text-red-600">{sendError}</p>
        ) : null}
      </div>

      <form
        onSubmit={(event) => void handleSubmit(event)}
        className="border-t border-[#E5E6EB] p-4 md:px-6"
      >
        <div className="flex gap-2">
          <input
            type="text"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={t('composerPlaceholder')}
            disabled={isSending}
            className="min-w-0 flex-1 rounded-lg border border-[#E5E6EB] px-3 py-2.5 text-sm focus:border-kazi-orange focus:outline-none"
          />
          <button
            type="submit"
            disabled={isSending || !draft.trim()}
            className="rounded-lg bg-kazi-orange px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
          >
            {t('send')}
          </button>
        </div>
      </form>
    </div>
  );
}
