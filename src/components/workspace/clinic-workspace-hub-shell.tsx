'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';

import { WorkspaceAssetPreviewPanel } from '@/components/workspace/workspace-asset-preview-panel';
import { WorkspaceAssetRailHub } from '@/components/workspace/workspace-asset-rail-hub';
import { useWorkspaceAssetPreview } from '@/hooks/use-workspace-assets';
import { buildClinicChatHref } from '@/lib/cv-entry';
import {
  buildClinicHubHref,
  parseClinicHubAssetId,
  stripClinicHubAssetParam,
} from '@/lib/hub-entry';
import { fetchWorkspaceAssetDetail } from '@/lib/workspace-assets-api';
import type { WorkspaceAsset, WorkspaceAssetDetail } from '@/types/workspace-asset';

type HubView = 'grid' | 'preview';

interface ClinicWorkspaceHubShellProps {
  locale: string;
}

function detailToAsset(detail: WorkspaceAssetDetail): WorkspaceAsset {
  const { content: _content, ...asset } = detail;
  return asset;
}

function ClinicWorkspaceHubContent({ locale }: ClinicWorkspaceHubShellProps) {
  const t = useTranslations('cv.railHub');
  const tV2 = useTranslations('cv.railHub.assetV2');
  const router = useRouter();
  const searchParams = useSearchParams();
  const deepLinkAssetId = parseClinicHubAssetId(searchParams);

  const [view, setView] = useState<HubView>('grid');
  const [previewAsset, setPreviewAsset] = useState<WorkspaceAsset | null>(null);

  const deepLinkQuery = useQuery({
    queryKey: ['workspace-asset-detail', deepLinkAssetId],
    queryFn: async () => {
      if (!deepLinkAssetId) throw new Error('Missing asset id');
      const res = await fetchWorkspaceAssetDetail(deepLinkAssetId);
      if (!res.success || !res.data) {
        throw new Error(res.error ?? 'Failed to load asset');
      }
      return res.data;
    },
    enabled: Boolean(deepLinkAssetId),
    retry: false,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (!deepLinkAssetId) {
      setView('grid');
      setPreviewAsset(null);
      return;
    }
    if (deepLinkQuery.data) {
      setPreviewAsset(detailToAsset(deepLinkQuery.data));
      setView('preview');
    }
  }, [deepLinkAssetId, deepLinkQuery.data]);

  const previewQuery = useWorkspaceAssetPreview(
    previewAsset,
    view === 'preview'
  );

  const openAsset = useCallback(
    (asset: WorkspaceAsset) => {
      setPreviewAsset(asset);
      setView('preview');
      router.replace(buildClinicHubHref(locale, asset.asset_id));
    },
    [locale, router]
  );

  const backToGrid = useCallback(() => {
    setPreviewAsset(null);
    setView('grid');
    const q = stripClinicHubAssetParam(searchParams).toString();
    const href = buildClinicHubHref(locale);
    router.replace(q ? `${href}?${q}` : href);
  }, [locale, router, searchParams]);

  const handleNavigate = useCallback(
    (path: string) => {
      router.push(path);
    },
    [router]
  );

  const chatHref = buildClinicChatHref(locale);

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <header className="flex shrink-0 items-center gap-2 border-b border-gray-200/80 px-4 py-3">
        {view === 'preview' ? (
          <button
            type="button"
            onClick={backToGrid}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[#4E5969] hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kazi-orange/40"
            aria-label={t('backToHub')}
          >
            <ArrowLeft className="h-5 w-5" aria-hidden />
          </button>
        ) : (
          <Link
            href={chatHref}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[#4E5969] hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kazi-orange/40"
            aria-label={t('backToHub')}
          >
            <ArrowLeft className="h-5 w-5" aria-hidden />
          </Link>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-sm font-semibold text-[#1D2129]">
            {view === 'preview' && previewAsset
              ? previewAsset.display_name
              : t('title')}
          </h1>
          <p className="truncate text-xs text-[#86909C]">
            {view === 'preview' && previewAsset?.subtitle
              ? previewAsset.subtitle
              : t('subtitle')}
          </p>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-hidden">
        {view === 'preview' && previewAsset ? (
          <WorkspaceAssetPreviewPanel
            asset={previewAsset}
            content={previewQuery.data ?? undefined}
            isLoading={
              previewAsset.mime_type === 'text/markdown' &&
              previewQuery.isLoading
            }
            error={
              previewQuery.error instanceof Error
                ? previewQuery.error.message
                : deepLinkQuery.error instanceof Error
                  ? deepLinkQuery.error.message
                  : null
            }
            className="h-full"
          />
        ) : deepLinkAssetId && deepLinkQuery.isLoading ? (
          <div className="flex flex-1 items-center justify-center py-16 text-gray-500">
            <Loader2 className="h-6 w-6 animate-spin text-kazi-orange" aria-hidden />
          </div>
        ) : deepLinkAssetId && deepLinkQuery.isError ? (
          <div className="flex flex-col items-center justify-center gap-3 px-4 py-16 text-center">
            <p className="text-sm text-red-600">
              {deepLinkQuery.error instanceof Error
                ? deepLinkQuery.error.message
                : tV2('deepLinkFailed')}
            </p>
            <button
              type="button"
              onClick={() => router.replace(buildClinicHubHref(locale))}
              className="text-sm font-medium text-kazi-orange hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kazi-orange/40"
            >
              {t('backToHub')}
            </button>
          </div>
        ) : (
          <WorkspaceAssetRailHub
            locale={locale}
            showCloseButton={false}
            onOpenAsset={openAsset}
            onNavigate={handleNavigate}
            className="h-full"
          />
        )}
      </div>
    </div>
  );
}

function ClinicWorkspaceHubLoading() {
  return (
    <div className="flex flex-1 items-center justify-center py-16 text-gray-500">
      <Loader2 className="h-6 w-6 animate-spin text-kazi-orange" aria-hidden />
    </div>
  );
}

/** Full-page Clinic workspace hub — workspace-assets only (KAZI-490). */
export function ClinicWorkspaceHubShell({ locale }: ClinicWorkspaceHubShellProps) {
  return (
    <Suspense fallback={<ClinicWorkspaceHubLoading />}>
      <ClinicWorkspaceHubContent locale={locale} />
    </Suspense>
  );
}
