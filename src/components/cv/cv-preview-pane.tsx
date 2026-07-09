'use client';

import type { ReactNode } from 'react';
import { Download } from 'lucide-react';
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
  /** Full-height mobile resume tab (sticky download at bottom). */
  mobileFullBleed?: boolean;
  className?: string;
}

export function CvPreviewPane({
  preview,
  isLoading,
  footer,
  canDownload,
  isExporting,
  onDownload,
  mobileFullBleed = false,
  className,
}: CvPreviewPaneProps) {
  const t = useTranslations('cv');

  return (
    <aside
      className={cn(
        'bg-slate-100 flex flex-col min-h-0',
        mobileFullBleed
          ? 'flex-1 w-full lg:w-[min(440px,40vw)] lg:shrink-0 lg:border-l lg:border-gray-200'
          : 'hidden lg:flex w-full lg:w-[min(440px,40vw)] shrink-0 border-t lg:border-t-0 lg:border-l border-gray-200',
        className
      )}
    >
      <div className="hidden lg:block px-4 py-3 bg-white border-b border-gray-100">
        <h2 className="font-semibold text-kazi-navy text-sm">{t('previewTitle')}</h2>
        <p className="text-xs text-gray-500 mt-0.5">{t('previewSubtitle')}</p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 lg:p-4 min-h-0">
        {isLoading ? (
          <p className="text-sm text-gray-500 text-center py-12">{t('previewLoading')}</p>
        ) : preview ? (
          <article className="mx-auto max-w-lg bg-white rounded-xl shadow-md border border-gray-200/80 px-5 py-6 sm:px-8 sm:py-8">
            <div className="prose prose-sm sm:prose-base max-w-none text-gray-800 prose-headings:text-kazi-navy">
              {preview.format === 'html' ? (
                <div dangerouslySetInnerHTML={{ __html: preview.content }} />
              ) : (
                <MarkdownContent content={preview.content} />
              )}
            </div>
          </article>
        ) : canDownload ? (
          <div className="mx-auto max-w-lg bg-white rounded-xl shadow-md border border-dashed border-gray-300 px-6 py-12 text-center">
            <FileTextPlaceholder />
            <p className="text-sm text-gray-600 mt-4">{t('previewPendingDownload')}</p>
          </div>
        ) : (
          <div className="mx-auto max-w-sm text-center py-16 px-4">
            <FileTextPlaceholder muted />
            <p className="text-sm text-gray-500 mt-4">{t('previewEmpty')}</p>
            <p className="text-xs text-gray-400 mt-2">{t('previewEmptyHint')}</p>
          </div>
        )}
      </div>

      {footer}

      {canDownload && onDownload ? (
        <div className="shrink-0 p-4 bg-white border-t border-gray-200 lg:hidden safe-area-pb">
          <Button
            size="lg"
            className="w-full h-12 text-base bg-kazi-orange hover:bg-kazi-orange/90 text-white shadow-md"
            disabled={isExporting}
            onClick={onDownload}
          >
            <Download className="h-5 w-5 mr-2" aria-hidden />
            {isExporting ? t('exportingPdf') : t('downloadPdf')}
          </Button>
        </div>
      ) : null}

      {canDownload && onDownload ? (
        <div className="hidden lg:block shrink-0 p-4 bg-white border-t border-gray-100">
          <Button
            size="sm"
            className="w-full bg-kazi-orange hover:bg-kazi-orange/90 text-white"
            disabled={isExporting}
            onClick={onDownload}
          >
            <Download className="h-4 w-4 mr-2" aria-hidden />
            {isExporting ? t('exportingPdf') : t('downloadPdf')}
          </Button>
        </div>
      ) : null}
    </aside>
  );
}

function FileTextPlaceholder({ muted }: { muted?: boolean }) {
  return (
    <div
      className={cn(
        'mx-auto h-16 w-12 rounded-lg border-2 flex items-end justify-center pb-2',
        muted ? 'border-gray-200 text-gray-300' : 'border-kazi-orange/40 text-kazi-orange/60'
      )}
      aria-hidden
    >
      <div className={cn('h-1 w-6 rounded', muted ? 'bg-gray-200' : 'bg-kazi-orange/30')} />
    </div>
  );
}
