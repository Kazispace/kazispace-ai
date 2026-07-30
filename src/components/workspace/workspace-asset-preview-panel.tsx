'use client';

import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { MarkdownContent } from '@/components/clinic/markdown-content';
import { cn } from '@/lib/utils';
import type { WorkspaceAsset } from '@/types/workspace-asset';

interface WorkspaceAssetPreviewPanelProps {
  asset: WorkspaceAsset;
  content?: string | null;
  isLoading?: boolean;
  error?: string | null;
  className?: string;
}

/** Rail-inline preview for a single WorkspaceAsset (MD or PDF). */
export function WorkspaceAssetPreviewPanel({
  asset,
  content,
  isLoading,
  error,
  className,
}: WorkspaceAssetPreviewPanelProps) {
  const t = useTranslations('cv.railHub.assetV2');

  return (
    <div className={cn('flex min-h-0 flex-1 flex-col', className)}>
      <div className="shrink-0 border-b border-gray-200/80 px-4 py-3">
        <p className="truncate text-sm font-semibold text-[#1D2129]">
          {asset.display_name}
        </p>
        {asset.subtitle ? (
          <p className="truncate text-xs text-[#86909C]">{asset.subtitle}</p>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Loader2 className="mb-3 h-7 w-7 animate-spin text-kazi-orange" />
            <p className="text-sm text-gray-500">{t('previewLoading')}</p>
          </div>
        ) : error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : asset.mime_type === 'application/pdf' ? (
          <iframe
            title={asset.display_name}
            src={asset.preview_url ?? asset.download_url}
            className="h-[min(70vh,640px)] w-full rounded-md border border-gray-200 bg-white"
          />
        ) : content ? (
          <div
            className={cn(
              'mx-auto max-w-[480px] min-h-[320px] bg-white',
              'shadow-[0_2px_16px_rgba(13,27,42,0.08)] rounded-sm',
              'px-8 py-10 sm:px-10 sm:py-12',
              'prose prose-sm sm:prose-base max-w-none text-gray-800',
              'prose-headings:text-kazi-navy prose-headings:font-semibold'
            )}
          >
            <MarkdownContent content={content} />
          </div>
        ) : (
          <p className="text-sm text-gray-500">{t('previewUnavailable')}</p>
        )}
      </div>
    </div>
  );
}
