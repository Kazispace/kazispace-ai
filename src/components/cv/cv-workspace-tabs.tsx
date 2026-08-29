'use client';

import { useCallback } from 'react';
import { useTranslations } from 'next-intl';

import { cn } from '@/lib/utils';

export type CvWorkspaceTab = 'resume' | 'chat';

export const CV_CHAT_PANEL_ID = 'cv-panel-chat';
export const CV_RESUME_PANEL_ID = 'cv-panel-resume';

interface CvWorkspaceTabsProps {
  active: CvWorkspaceTab;
  onChange: (tab: CvWorkspaceTab) => void;
  resumeDownloadReady?: boolean;
  resumeHasPreview?: boolean;
  className?: string;
}

export function CvWorkspaceTabs({
  active,
  onChange,
  resumeDownloadReady,
  resumeHasPreview,
  className,
}: CvWorkspaceTabsProps) {
  const t = useTranslations('cv');

  const tabs: {
    id: CvWorkspaceTab;
    label: string;
    panelId: string;
    indicator?: 'download' | 'preview';
  }[] = [
    { id: 'chat', label: t('tabChat'), panelId: CV_CHAT_PANEL_ID },
    {
      id: 'resume',
      label: t('tabResume'),
      panelId: CV_RESUME_PANEL_ID,
      indicator: resumeDownloadReady
        ? 'download'
        : resumeHasPreview
          ? 'preview'
          : undefined,
    },
  ];

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLButtonElement>, current: CvWorkspaceTab) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      e.preventDefault();
      const order: CvWorkspaceTab[] = ['chat', 'resume'];
      const index = order.indexOf(current);
      const next =
        e.key === 'ArrowRight'
          ? order[(index + 1) % order.length]
          : order[(index - 1 + order.length) % order.length];
      onChange(next);
    },
    [onChange]
  );

  return (
    <div
      className={cn('lg:hidden shrink-0 flex bg-white border-b border-gray-200/80', className)}
      role="tablist"
      aria-label={t('workspacePanels')}
    >
      {tabs.map(({ id, label, panelId, indicator }) => {
        const selected = active === id;
        return (
          <button
            key={id}
            type="button"
            role="tab"
            id={`cv-tab-${id}`}
            aria-selected={selected}
            aria-controls={panelId}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(id)}
            onKeyDown={(e) => handleKeyDown(e, id)}
            className={cn(
              'relative flex-1 py-3 text-sm font-medium transition-colors',
              selected ? 'text-kazi-navy' : 'text-gray-500'
            )}
          >
            <span className="inline-flex items-center gap-1.5">
              {label}
              {indicator === 'download' ? (
                <span
                  className="h-1.5 w-1.5 rounded-full bg-primary"
                  title={t('downloadPdfShort')}
                  aria-hidden
                />
              ) : indicator === 'preview' ? (
                <span
                  className="h-1.5 w-1.5 rounded-full bg-gray-400"
                  title={t('previewTitle')}
                  aria-hidden
                />
              ) : null}
            </span>
            {selected ? (
              <span className="absolute inset-x-4 bottom-0 h-0.5 rounded-full bg-primary" />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
