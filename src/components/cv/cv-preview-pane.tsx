'use client';

import type { ReactNode } from 'react';
import { Download, FileText, Loader2, Sparkles } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { MarkdownContent } from '@/components/clinic/markdown-content';
import type { CvPreviewContent } from '@/lib/cv-api';
import { cn } from '@/lib/utils';

interface CvPreviewPaneProps {
  preview: CvPreviewContent | null;
  isLoading?: boolean;
  footer?: ReactNode;
  canDownload?: boolean;
  isExporting?: boolean;
  onDownload?: () => void;
  className?: string;
}

/** Coze "预览与调试" right panel. */
export function CvPreviewPane({
  preview,
  isLoading,
  footer,
  canDownload,
  isExporting,
  onDownload,
  className,
}: CvPreviewPaneProps) {
  const t = useTranslations('cv');

  return (
    <aside
      className={cn(
        'flex flex-col min-h-0 min-w-0 bg-workspace-panel',
        'lg:w-[min(400px,36vw)] lg:shrink-0 lg:border-l lg:border-workspace-border',
        className
      )}
    >
      <div className="shrink-0 px-4 py-3 border-b border-workspace-border bg-workspace-header flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Sparkles className="h-4 w-4 text-kazi-orange shrink-0" aria-hidden />
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-workspace-text truncate">
              {t('previewDebugTitle')}
            </h2>
            <p className="text-[11px] text-workspace-muted truncate">{t('previewSubtitle')}</p>
          </div>
        </div>
        {canDownload && onDownload ? (
          <button
            type="button"
            disabled={isExporting}
            onClick={onDownload}
            title={t('downloadPdf')}
            className={cn(
              'hidden lg:flex items-center gap-1 h-7 px-2.5 rounded-lg text-xs font-medium shrink-0',
              'bg-kazi-orange/10 text-kazi-orange hover:bg-kazi-orange/15',
              'disabled:opacity-50 transition-colors'
            )}
          >
            {isExporting ? (
              <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
            ) : (
              <Download className="h-3 w-3" aria-hidden />
            )}
            PDF
          </button>
        ) : null}
      </div>

      <div className="flex-1 overflow-y-auto min-h-0 p-4">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Loader2 className="h-6 w-6 text-kazi-orange animate-spin mb-3" aria-hidden />
            <p className="text-xs text-workspace-muted">{t('previewLoading')}</p>
          </div>
        ) : preview ? (
          <article
            className={cn(
              'rounded-[10px] border border-slate-300 bg-white',
              'px-5 py-6 shadow-sm',
              'prose prose-sm max-w-none text-gray-800',
              'prose-headings:text-kazi-navy'
            )}
          >
            {preview.format === 'html' ? (
              <div dangerouslySetInnerHTML={{ __html: preview.content }} />
            ) : (
              <MarkdownContent content={preview.content} />
            )}
          </article>
        ) : canDownload ? (
          <EmptyState
            message={t('previewPendingDownload')}
            action={
              onDownload ? (
                <button
                  type="button"
                  disabled={isExporting}
                  onClick={onDownload}
                  className={cn(
                    'mt-4 inline-flex items-center gap-1.5 h-9 px-4 rounded-lg text-sm font-medium',
                    'bg-kazi-orange hover:bg-kazi-orange/90 text-white shadow-sm',
                    'disabled:opacity-50 transition-colors'
                  )}
                >
                  {isExporting ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  ) : (
                    <Download className="h-4 w-4" aria-hidden />
                  )}
                  {isExporting ? t('exportingPdf') : t('downloadPdf')}
                </button>
              ) : null
            }
          />
        ) : (
          <EmptyState message={t('previewEmpty')} hint={t('previewEmptyHint')} />
        )}
      </div>

      {footer}

      {canDownload && onDownload ? (
        <div className="lg:hidden shrink-0 p-3 border-t border-workspace-border bg-white safe-area-pb">
          <button
            type="button"
            disabled={isExporting}
            onClick={onDownload}
            className={cn(
              'w-full h-11 flex items-center justify-center gap-2 rounded-xl text-sm font-medium',
              'bg-kazi-orange hover:bg-kazi-orange/90 text-white shadow-sm',
              'disabled:opacity-50 transition-colors'
            )}
          >
            {isExporting ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Download className="h-4 w-4" aria-hidden />
            )}
            {isExporting ? t('exportingPdf') : t('downloadPdf')}
          </button>
        </div>
      ) : null}
    </aside>
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
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center rounded-[10px] border border-dashed border-workspace-border bg-workspace-header">
      <div className="h-12 w-12 rounded-2xl bg-workspace-hover flex items-center justify-center mb-3">
        <FileText className="h-6 w-6 text-workspace-muted" aria-hidden />
      </div>
      <p className="text-sm text-workspace-text max-w-[240px]">{message}</p>
      {hint ? (
        <p className="text-xs text-workspace-muted mt-2 max-w-[260px]">{hint}</p>
      ) : null}
      {action}
    </div>
  );
}
