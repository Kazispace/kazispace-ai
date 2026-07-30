'use client';

import { useCallback, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import {
  fetchWorkspaceAssetMarkdownContent,
  fetchWorkspaceAssets,
  reindexWorkspaceAsset,
} from '@/lib/workspace-assets-api';
import { WORKSPACE_ASSETS_INVALIDATE_EVENT } from '@/lib/workspace-assets-invalidate';
import type {
  FetchWorkspaceAssetsParams,
  WorkspaceAsset,
  WorkspaceAssetsResponse,
} from '@/types/workspace-asset';

const EMPTY_COUNTS = { resume: 0, english: 0, interview: 0 };

export function workspaceAssetsQueryKey(params?: FetchWorkspaceAssetsParams) {
  return [
    'workspace-assets',
    {
      scope: params?.scope ?? 'user',
      spaceId: params?.spaceId ?? null,
      category: params?.category ?? null,
      includeHistory: params?.includeHistory ?? false,
    },
  ] as const;
}

function normalizeResponse(data: unknown): WorkspaceAssetsResponse {
  if (!data || typeof data !== 'object') {
    return { items: [], categories: EMPTY_COUNTS, history_counts: EMPTY_COUNTS };
  }
  const raw = data as Partial<WorkspaceAssetsResponse>;
  return {
    items: Array.isArray(raw.items) ? raw.items : [],
    categories: { ...EMPTY_COUNTS, ...raw.categories },
    history_counts: { ...EMPTY_COUNTS, ...raw.history_counts },
  };
}

function useWorkspaceAssetsInvalidate(enabled: boolean) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled) return;
    const onInvalidate = () => {
      void queryClient.invalidateQueries({ queryKey: ['workspace-assets'] });
      void queryClient.invalidateQueries({ queryKey: ['workspace-asset-preview'] });
    };
    window.addEventListener(WORKSPACE_ASSETS_INVALIDATE_EVENT, onInvalidate);
    return () =>
      window.removeEventListener(WORKSPACE_ASSETS_INVALIDATE_EVENT, onInvalidate);
  }, [enabled, queryClient]);
}

export function useWorkspaceAssets(
  params?: FetchWorkspaceAssetsParams,
  enabled = true
) {
  const queryClient = useQueryClient();
  const queryKey = workspaceAssetsQueryKey(params);

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      const res = await fetchWorkspaceAssets(params);
      if (!res.success || !res.data) {
        throw new Error(res.error ?? 'Failed to load workspace assets');
      }
      return normalizeResponse(res.data);
    },
    enabled,
    staleTime: 30_000,
  });

  useWorkspaceAssetsInvalidate(enabled);

  const refresh = useCallback(
    () => queryClient.invalidateQueries({ queryKey }),
    [queryClient, queryKey]
  );

  return {
    items: query.data?.items ?? [],
    categories: query.data?.categories ?? EMPTY_COUNTS,
    historyCounts: query.data?.history_counts ?? EMPTY_COUNTS,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error instanceof Error ? query.error.message : null,
    refresh,
  };
}

/** Per-category history fold — fetches only when expanded (P2-2). */
export function useWorkspaceAssetCategoryHistory(
  params: FetchWorkspaceAssetsParams & { category: WorkspaceAsset['category'] },
  expanded: boolean,
  enabled = true
) {
  return useWorkspaceAssets(
    { ...params, includeHistory: true },
    enabled && expanded
  );
}

/** MD preview: detail `content` when present, else signed URL fetch (P1-1). */
export function useWorkspaceAssetPreview(
  asset: WorkspaceAsset | null,
  enabled = true
) {
  return useQuery({
    queryKey: [
      'workspace-asset-preview',
      asset?.asset_id,
      asset?.preview_url ?? asset?.download_url,
    ],
    queryFn: async () => {
      if (!asset) throw new Error('Missing asset');
      if (asset.mime_type !== 'text/markdown') {
        return null;
      }
      return fetchWorkspaceAssetMarkdownContent(asset);
    },
    enabled:
      enabled &&
      Boolean(asset) &&
      asset?.mime_type === 'text/markdown' &&
      asset.indexing_status === 'ready',
    staleTime: 60_000,
  });
}

export async function retryWorkspaceAssetIndexing(
  asset: WorkspaceAsset
): Promise<{ ok: boolean; error?: string }> {
  const res = await reindexWorkspaceAsset(asset.asset_id);
  if (!res.success) {
    return { ok: false, error: res.error ?? 'Reindex failed' };
  }
  return { ok: true };
}
