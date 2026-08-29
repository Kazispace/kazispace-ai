'use client';

import type { ReactNode } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { MarkdownContent } from '@/components/clinic/markdown-content';
import { Button } from '@/components/ui/button';
import type { CvPreviewContent } from '@/lib/cv-api';
import { cn } from '@/lib/utils';

interface CvPreviewPaneProps {
  preview: CvPreviewContent | null;
  isLoading?: boolean;
  footer?: ReactNode;
  canDownload?: boolean;
  isExporting?: boolean;
  onDownload?: () => void;
  jobSubtitle?: string;
  panelId?: string;
  className?: string;
}

export function CvPreviewPane({
  preview,
  isLoading,
  footer,
  canDownload,
  isExporting,
  onDownload,
  jobSubtitle,
  panelId,
  className,
}: CvPreviewPaneProps) {
  const t = useTranslations('cv');

  return (
    <aside
      id={panelId}
      role="tabpanel"
      aria-labelledby={panelId ? 'cv-tab-resume' : undefined}
      className={cn(
        // KAZI-662: #ECEEF2 near-neighbor of workspace.hover (#F2F3F5), no exact token match — pending design confirmation.
        'flex flex-col min-h-0 min-w-0 bg-[#ECEEF2]',
        'lg:w-[min(440px,40vw)] lg:shrink-0 lg:border-l lg:border-gray-200/80',
        className
      )}
    >
      <div className="shrink-0 px-4 h-12 flex items-center justify-between bg-white border-b border-gray-200/80">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-kazi-navy">{t('previewTitle')}</h2>
          {jobSubtitle ? (
            <p className="text-[11px] text-gray-500 truncate">{jobSubtitle}</p>
          ) : null}
        </div>
        {canDownload && onDownload ? (
          <DownloadPdfButton
            isExporting={isExporting}
            onDownload={onDownload}
            className="hidden lg:inline-flex h-8 gap-1.5 text-xs"
            variant="outline"
            label="PDF"
          />
        ) : null}
      </div>

      <div className="flex-1 overflow-y-auto min-h-0 p-4 sm:p-6">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="h-7 w-7 text-primary animate-spin mb-3" />
            <p className="text-sm text-gray-500">{t('previewLoading')}</p>
          </div>
        ) : preview ? (
          <div
            className={cn(
              'mx-auto max-w-[480px] min-h-[640px] bg-white',
              'shadow-[0_2px_16px_rgba(13,27,42,0.08)] rounded-sm',
              'px-8 py-10 sm:px-10 sm:py-12',
              'prose prose-sm sm:prose-base max-w-none text-gray-800',
              'prose-headings:text-kazi-navy prose-headings:font-semibold'
            )}
          >
            {preview.format === 'html' ? (
              <div dangerouslySetInnerHTML={{ __html: preview.content }} />
            ) : (
              <MarkdownContent content={preview.content} />
            )}
          </div>
        ) : canDownload ? (
          <EmptyState
            message={t('previewPendingDownload')}
            action={
              onDownload ? (
                <DownloadPdfButton
                  isExporting={isExporting}
                  onDownload={onDownload}
                  className="mt-5 gap-2"
                  label={t('downloadPdf')}
                />
              ) : null
            }
          />
        ) : (
          <EmptyState message={t('previewEmpty')} hint={t('previewEmptyHint')} />
        )}
      </div>

      {footer}

      {canDownload && onDownload ? (
        <div className="lg:hidden shrink-0 p-4 bg-white border-t border-gray-200/80 safe-area-pb">
          <DownloadPdfButton
            isExporting={isExporting}
            onDownload={onDownload}
            className="w-full h-11 gap-2"
            label={t('downloadPdf')}
          />
        </div>
      ) : null}
    </aside>
  );
}

function DownloadPdfButton({
  isExporting,
  onDownload,
  label,
  className,
  variant = 'default',
}: {
  isExporting?: boolean;
  onDownload: () => void;
  label: string;
  className?: string;
  variant?: 'default' | 'outline';
}) {
  const t = useTranslations('cv');

  return (
    <Button
      variant={variant}
      disabled={isExporting}
      onClick={onDownload}
      className={className}
    >
      {isExporting ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Download className="h-4 w-4" />
      )}
      {isExporting ? t('exportingPdf') : label}
    </Button>
  );
}

function EmptyState({
  message,
  hint,
  action,
}: {
  message: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-[480px] flex flex-col items-center justify-center py-24 px-6 text-center">
      <div className="h-14 w-11 rounded border-2 border-gray-200 bg-white shadow-sm mb-4" aria-hidden />
      <p className="text-sm text-gray-700">{message}</p>
      {hint ? <p className="text-xs text-gray-500 mt-2 max-w-xs">{hint}</p> : null}
      {action}
    </div>
  );
}
