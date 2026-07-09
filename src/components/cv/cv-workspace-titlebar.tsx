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

/** Coze-style agent header: avatar + name + optional progress. */
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
        'h-14 shrink-0 flex items-center gap-3 px-3 sm:px-4',
        'bg-white border-b border-workspace-border shadow-sm',
        className
      )}
    >
      <Link
        href={`/${locale}/mine`}
        className="flex h-8 w-8 items-center justify-center rounded-lg text-workspace-muted hover:bg-workspace-hover hover:text-workspace-text transition-colors shrink-0"
        title={t('backToMine')}
        aria-label={t('backToMine')}
      >
        <ChevronLeft className="h-5 w-5" aria-hidden />
      </Link>

      <div className="flex items-center gap-2.5 min-w-0 shrink">
        <div
          className="h-9 w-9 rounded-xl bg-gradient-to-br from-kazi-orange to-amber-400 flex items-center justify-center text-lg shadow-sm shrink-0"
          aria-hidden
        >
          📄
        </div>
        <div className="min-w-0">
          <h1 className="text-sm font-semibold text-workspace-text truncate leading-tight">
            {t('title')}
          </h1>
          <p className="text-[11px] text-workspace-muted truncate">{t('subtitle')}</p>
        </div>
      </div>

      {center ? (
        <div className="hidden md:flex flex-1 min-w-0 justify-center px-4">{center}</div>
      ) : (
        <div className="flex-1 hidden md:block" />
      )}

      <div className="flex items-center gap-2 shrink-0 ml-auto">
        {canDownload && onDownload ? (
          <button
            type="button"
            disabled={actionsDisabled || isExporting}
            onClick={onDownload}
            className={cn(
              'flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium transition-colors',
              'bg-kazi-orange hover:bg-kazi-orange/90 text-white shadow-sm',
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
              'h-8 px-2.5 flex items-center gap-1 rounded-lg text-xs font-medium',
              'border border-workspace-border text-workspace-text',
              'hover:bg-workspace-hover disabled:opacity-50 transition-colors'
            )}
          >
            <Plus className="h-3.5 w-3.5" aria-hidden />
            <span className="hidden sm:inline">{t('newCv')}</span>
          </button>
        ) : null}
      </div>
    </header>
  );
}
