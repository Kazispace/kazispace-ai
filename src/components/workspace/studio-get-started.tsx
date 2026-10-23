'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

import { buildClinicChatHref } from '@/lib/cv-entry';
import { useUIStore } from '@/lib/store';
import { cn } from '@/lib/utils';
import type { GetStartedGuide } from '@/lib/studio-get-started-api';

/**
 * Studio's Get started row (kazispace-ui Studio pattern, Get started; D25).
 * A tap opens the main chat with the guide's text in the composer; the user
 * confirms, can edit, and sends it. Nothing is sent from here.
 */
export function StudioGetStarted({
  locale,
  guides,
  isLoading,
  onNavigate,
}: {
  locale: string;
  guides: GetStartedGuide[];
  isLoading: boolean;
  onNavigate?: (path: string) => void;
}) {
  const t = useTranslations('studio');
  const requestComposerInsert = useUIStore((s) => s.requestComposerInsert);
  const [tapped, setTapped] = useState(false);

  if (isLoading && guides.length === 0) {
    return (
      <section data-testid="studio-get-started-loading" aria-busy="true" className="px-3 pb-1 pt-2 pr-10">
        <h2 className="mb-2 text-xs font-semibold text-workspace-secondary">{t('start.title')}</h2>
        <div className="flex gap-2">
          {[0, 1, 2].map((i) => (
            <span key={i} className="h-8 w-24 animate-pulse rounded-lg bg-gray-100" />
          ))}
        </div>
      </section>
    );
  }
  if (guides.length === 0) return null;

  const open = (guide: GetStartedGuide) => {
    if (tapped) return;
    setTapped(true);
    requestComposerInsert(guide.text, 'clinic', 'replace', t('start.draftReplaced'));
    onNavigate?.(buildClinicChatHref(locale));
  };

  return (
    <section
      data-testid="studio-get-started"
      aria-label={t('start.title')}
      className="px-3 pb-1 pt-2 pr-10"
    >
      <h2 className="mb-2 text-xs font-semibold text-workspace-secondary">{t('start.title')}</h2>
      <div className="flex gap-2 overflow-x-auto pb-1 md:flex-wrap md:overflow-visible">
        {guides.map((guide) => (
          <button
            key={guide.id}
            type="button"
            disabled={tapped}
            aria-disabled={tapped}
            title={guide.text}
            onClick={() => open(guide)}
            className={cn(
              'shrink-0 rounded-lg border border-workspace-border bg-white px-3 py-1.5 text-sm text-workspace-text',
              'hover:border-primary/40 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
              'disabled:opacity-50'
            )}
          >
            {guide.label}
            <span className="sr-only">: {guide.text}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
