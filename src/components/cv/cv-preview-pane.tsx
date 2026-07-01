'use client';

import { useTranslations } from 'next-intl';

interface CvPreviewPaneProps {
  html: string | null;
  isLoading?: boolean;
}

export function CvPreviewPane({ html, isLoading }: CvPreviewPaneProps) {
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
        ) : html ? (
          <div
            className="prose prose-sm max-w-none text-gray-800"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        ) : (
          <p className="text-sm text-gray-400 text-center py-12">{t('previewEmpty')}</p>
        )}
      </div>
    </aside>
  );
}
