'use client';

import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';

import { MarkdownContent } from '@/components/clinic/markdown-content';
import type { CvPreviewContent } from '@/lib/cv-api';

interface CvPreviewPaneProps {
  preview: CvPreviewContent | null;
  isLoading?: boolean;
  footer?: ReactNode;
}

export function CvPreviewPane({ preview, isLoading, footer }: CvPreviewPaneProps) {
  const t = useTranslations('cv');

  return (
    <aside className="w-full lg:w-[420px] shrink-0 border-l border-gray-200 bg-white flex flex-col min-h-[320px] lg:min-h-0 lg:h-full">
      <div className="px-4 py-3 border-b border-gray-100">
        <h2 className="font-semibold text-kazi-navy text-sm">{t('previewTitle')}</h2>
        <p className="text-xs text-gray-500 mt-0.5">{t('previewSubtitle')}</p>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
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
        ) : (
          <p className="text-sm text-gray-400 text-center py-12">{t('previewEmpty')}</p>
        )}
      </div>
      {footer}
    </aside>
  );
}
