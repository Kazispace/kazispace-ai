'use client';

import Link from 'next/link';
import { ChevronLeft, Download, Loader2, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { cn } from '@/lib/utils';

interface CvWorkspaceTitlebarProps {
  locale: string;
  canDownload?: boolean;
  isExporting?: boolean;
  onDownload?: () => void;
  onNewSession?: () => void;
  actionsDisabled?: boolean;
  center?: React.ReactNode;
  className?: string;
}

export function CvWorkspaceTitlebar({
  locale,
  canDownload,
  isExporting,
  onDownload,
  onNewSession,
  actionsDisabled,
  center,
  className,
}: CvWorkspaceTitlebarProps) {
  const t = useTranslations('cv');

  return (
    <header
      className={cn(
        'h-11 shrink-0 flex items-center gap-2 px-2 sm:px-3',
        'bg-workspace-sidebar border-b border-workspace-border',
        className
      )}
    >
      <Link
        href={`/${locale}/mine`}
        className="flex items-center gap-0.5 text-workspace-muted hover:text-workspace-text transition-colors shrink-0"
        title={t('backToMine')}
      >
        <ChevronLeft className="h-4 w-4" aria-hidden />
        <span className="hidden sm:inline text-xs">{t('backToMine')}</span>
      </Link>

      <div className="h-4 w-px bg-workspace-border shrink-0" aria-hidden />

      <h1 className="text-xs font-medium text-workspace-text truncate shrink-0">
        {t('title')}
      </h1>

      {center ? (
        <div className="flex-1 min-w-0 flex justify-center px-2">{center}</div>
      ) : (
        <div className="flex-1" />
      )}

      <div className="flex items-center gap-1 shrink-0">
        {canDownload && onDownload ? (
          <button
            type="button"
            disabled={actionsDisabled || isExporting}
            onClick={onDownload}
            className={cn(
              'flex items-center gap-1.5 h-7 px-2.5 rounded text-xs font-medium transition-colors',
              'bg-kazi-orange/90 hover:bg-kazi-orange text-white',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          >
            {isExporting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : (
              <Download className="h-3.5 w-3.5" aria-hidden />
            )}
            <span className="hidden sm:inline">
              {isExporting ? t('exportingPdf') : t('downloadPdfShort')}
            </span>
          </button>
        ) : null}
        {onNewSession ? (
          <button
            type="button"
            disabled={actionsDisabled}
            onClick={onNewSession}
            title={t('newCv')}
            aria-label={t('newCv')}
            className={cn(
              'h-7 w-7 flex items-center justify-center rounded',
              'text-workspace-muted hover:text-workspace-text hover:bg-workspace-hover',
              'disabled:opacity-50 disabled:cursor-not-allowed transition-colors'
            )}
          >
            <Plus className="h-4 w-4" aria-hidden />
          </button>
        ) : null}
      </div>
    </header>
  );
}
