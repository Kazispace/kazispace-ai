'use client';

import Link from 'next/link';
import { ChevronLeft, Download, FileText, Loader2, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { CvProgressTrack } from '@/components/cv/cv-progress-track';
import { cn } from '@/lib/utils';

interface CvHeaderProps {
  locale: string;
  canDownload?: boolean;
  isExporting?: boolean;
  onDownload?: () => void;
  onNewSession?: () => void;
  actionsDisabled?: boolean;
  pipelineState?: string | null;
  isWorking?: boolean;
  showPipeline?: boolean;
  className?: string;
}

export function CvHeader({
  locale,
  canDownload,
  isExporting,
  onDownload,
  onNewSession,
  actionsDisabled,
  pipelineState,
  isWorking,
  showPipeline,
  className,
}: CvHeaderProps) {
  const t = useTranslations('cv');

  return (
    <header
      className={cn(
        'shrink-0 bg-kazi-navy border-b border-white/5',
        className
      )}
    >
      <div className="flex items-center gap-3 px-4 py-3">
        <Link
          href={`/${locale}/mine`}
          className="flex h-9 w-9 items-center justify-center rounded-full text-white/60 hover:text-white hover:bg-white/10 transition-colors shrink-0"
          aria-label={t('backToMine')}
        >
          <ChevronLeft className="h-5 w-5" />
        </Link>

        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/10 shrink-0">
          <FileText className="h-5 w-5 text-kazi-orange" aria-hidden />
        </div>

        <div className="min-w-0 flex-1">
          <h1 className="text-sm font-semibold text-white truncate">{t('title')}</h1>
          <p className="text-xs text-white/50 truncate">{t('subtitle')}</p>
        </div>

        {showPipeline ? (
          <CvProgressTrack
            pipelineState={pipelineState}
            isWorking={isWorking}
            className="hidden md:flex"
          />
        ) : null}

        <div className="flex items-center gap-2 shrink-0">
          {canDownload && onDownload ? (
            <Button
              size="sm"
              disabled={actionsDisabled || isExporting}
              onClick={onDownload}
              className="h-9 gap-1.5 bg-kazi-orange hover:bg-kazi-orange-dark text-white border-0"
            >
              {isExporting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              <span className="hidden sm:inline">
                {isExporting ? t('exportingPdf') : t('downloadPdfShort')}
              </span>
            </Button>
          ) : null}
          {onNewSession ? (
            <Button
              size="sm"
              variant="ghost"
              disabled={actionsDisabled}
              onClick={onNewSession}
              className="h-9 text-white/70 hover:text-white hover:bg-white/10 gap-1"
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">{t('newCv')}</span>
            </Button>
          ) : null}
        </div>
      </div>

      {showPipeline ? (
        <div className="md:hidden px-4 pb-3">
          <CvProgressTrack pipelineState={pipelineState} isWorking={isWorking} />
        </div>
      ) : null}
    </header>
  );
}
