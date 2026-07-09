'use client';

import type { ReactNode } from 'react';
import { Download } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { MarkdownContent } from '@/components/clinic/markdown-content';
import { Button } from '@/components/ui/button';
import type { CvPreviewContent } from '@/lib/cv-api';

interface CvPreviewPaneProps {
  preview: CvPreviewContent | null;
  isLoading?: boolean;
  footer?: ReactNode;
  canDownload?: boolean;
  isExporting?: boolean;
  onDownload?: () => void;
}

export function CvPreviewPane({
  preview,
  isLoading,
  footer,
  canDownload,
  isExporting,
  onDownload,
}: CvPreviewPaneProps) {
  const t = useTranslations('cv');

  return (
    <aside className="w-full lg:w-[min(440px,40vw)] shrink-0 border-t lg:border-t-0 lg:border-l border-gray-200 bg-white flex flex-col min-h-[280px] lg:min-h-0 lg:h-full">
      <div className="px-4 py-3 border-b border-gray-100 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="font-semibold text-kazi-navy text-sm">{t('previewTitle')}</h2>
          <p className="text-xs text-gray-500 mt-0.5">{t('previewSubtitle')}</p>
        </div>
        {canDownload && onDownload ? (
          <Button
            size="sm"
            variant="outline"
            className="shrink-0 text-kazi-orange border-kazi-orange/40"
            disabled={isExporting}
            onClick={onDownload}
          >
            <Download className="h-3.5 w-3.5 mr-1" aria-hidden />
            {isExporting ? t('exportingPdf') : t('downloadPdfShort')}
          </Button>
        ) : null}
      </div>
      <div className="flex-1 overflow-y-auto p-4 min-h-[200px]">
        {isLoading ? (
          <p className="text-sm text-gray-500">{t('previewLoading')}</p>
        ) : preview ? (
          preview.format === 'html' ? (
            <div
              className="prose prose-sm max-w-none text-gray-800"
              dangerouslySetInnerHTML={{ __html: preview.content }}
            />
          ) : (
            <div className="prose prose-sm max-w-none text-gray-800">
              <MarkdownContent content={preview.content} />
            </div>
          )
        ) : canDownload ? (
          <p className="text-sm text-gray-600 text-center py-8">{t('previewPendingDownload')}</p>
        ) : (
          <p className="text-sm text-gray-400 text-center py-12">{t('previewEmpty')}</p>
        )}
      </div>
      {footer}
    </aside>
  );
}
