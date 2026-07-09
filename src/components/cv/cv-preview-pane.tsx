'use client';

import type { ReactNode } from 'react';
import { Download, FileText, Loader2 } from 'lucide-react';
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
        'flex flex-col min-h-0 min-w-0',
        'bg-workspace-panel border-l border-workspace-border',
        'lg:w-[min(420px,38vw)] lg:shrink-0',
        className
      )}
    >
      {/* Editor tab strip — Cursor-style */}
      <div className="h-9 shrink-0 flex items-stretch bg-workspace-header border-b border-workspace-border">
        <div
          className={cn(
            'flex items-center gap-1.5 px-3 text-[11px] border-r border-workspace-border',
            'bg-workspace-panel text-workspace-text'
          )}
        >
          <FileText className="h-3 w-3 text-workspace-muted shrink-0" aria-hidden />
          <span className="truncate">resume.md</span>
          {canDownload ? (
            <span className="h-1.5 w-1.5 rounded-full bg-kazi-orange shrink-0" aria-hidden />
          ) : null}
        </div>
        <div className="flex-1" />
        {canDownload && onDownload ? (
          <button
            type="button"
            disabled={isExporting}
            onClick={onDownload}
            title={t('downloadPdf')}
            className={cn(
              'hidden lg:flex items-center gap-1 px-2.5 text-[11px]',
              'text-workspace-muted hover:text-workspace-text hover:bg-workspace-hover',
              'disabled:opacity-50 transition-colors'
            )}
          >
            {isExporting ? (
              <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
            ) : (
              <Download className="h-3 w-3" aria-hidden />
            )}
            <span>{isExporting ? t('exportingPdf') : 'PDF'}</span>
          </button>
        ) : null}
      </div>

      <div className="flex-1 overflow-y-auto min-h-0">
        {isLoading ? (
          <p className="text-xs text-workspace-muted text-center py-16 px-4">
            {t('previewLoading')}
          </p>
        ) : preview ? (
          <div className="p-4">
            <article
              className={cn(
                'mx-auto max-w-none rounded-sm border border-workspace-border',
                'bg-[#1a1a1a] px-5 py-6 text-workspace-text',
                'prose prose-sm prose-invert max-w-none',
                'prose-headings:text-workspace-text prose-p:text-workspace-text/90',
                'prose-strong:text-workspace-text prose-li:text-workspace-text/90'
              )}
            >
              {preview.format === 'html' ? (
                <div dangerouslySetInnerHTML={{ __html: preview.content }} />
              ) : (
                <MarkdownContent content={preview.content} />
              )}
            </article>
          </div>
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
                    'mt-4 inline-flex items-center gap-1.5 h-8 px-3 rounded text-xs font-medium',
                    'bg-kazi-orange hover:bg-kazi-orange/90 text-white',
                    'disabled:opacity-50 transition-colors'
                  )}
                >
                  {isExporting ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                  ) : (
                    <Download className="h-3.5 w-3.5" aria-hidden />
                  )}
                  {isExporting ? t('exportingPdf') : t('downloadPdf')}
                </button>
              ) : null
            }
          />
        ) : (
          <EmptyState
            message={t('previewEmpty')}
            hint={t('previewEmptyHint')}
          />
        )}
      </div>

      {footer}

      {canDownload && onDownload ? (
        <div className="lg:hidden shrink-0 p-3 border-t border-workspace-border bg-workspace-header safe-area-pb">
          <button
            type="button"
            disabled={isExporting}
            onClick={onDownload}
            className={cn(
              'w-full h-10 flex items-center justify-center gap-2 rounded text-sm font-medium',
              'bg-kazi-orange hover:bg-kazi-orange/90 text-white',
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
    <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
      <FileText className="h-8 w-8 text-workspace-muted/40 mb-3" aria-hidden />
      <p className="text-xs text-workspace-muted max-w-[220px]">{message}</p>
      {hint ? (
        <p className="text-[10px] text-workspace-muted/70 mt-2 max-w-[240px]">{hint}</p>
      ) : null}
      {action}
    </div>
  );
}
