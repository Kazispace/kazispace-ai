import { apiRequest } from '@/lib/api-client';
import type { ApiResponse } from '@/types';
import type {
  FetchWorkspaceAssetsParams,
  WorkspaceAsset,
  WorkspaceAssetDetail,
  WorkspaceAssetsResponse,
} from '@/types/workspace-asset';

function buildWorkspaceAssetsQuery(params?: FetchWorkspaceAssetsParams): string {
  const search = new URLSearchParams();
  if (params?.scope) search.set('scope', params.scope);
  if (params?.spaceId) search.set('space_id', params.spaceId);
  if (params?.category) search.set('category', params.category);
  if (params?.includeHistory) search.set('include_history', 'true');
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

export async function fetchWorkspaceAssets(
  params?: FetchWorkspaceAssetsParams
): Promise<ApiResponse<WorkspaceAssetsResponse>> {
  return apiRequest<WorkspaceAssetsResponse>(
    `/api/v1/workspace-assets${buildWorkspaceAssetsQuery(params)}`
  );
}

export async function fetchWorkspaceAssetDetail(
  assetId: string
): Promise<ApiResponse<WorkspaceAssetDetail>> {
  return apiRequest<WorkspaceAssetDetail>(
    `/api/v1/workspace-assets/${encodeURIComponent(assetId)}`
  );
}

export async function reindexWorkspaceAsset(
  assetId: string
): Promise<ApiResponse<WorkspaceAssetDetail>> {
  return apiRequest<WorkspaceAssetDetail>(
    `/api/v1/workspace-assets/${encodeURIComponent(assetId)}/reindex`,
    { method: 'POST' }
  );
}

/**
 * Load markdown body for rail preview.
 * BE #301 detail omits `content` — fall back to signed preview/download URL.
 */
export async function fetchWorkspaceAssetMarkdownContent(
  asset: WorkspaceAsset
): Promise<string> {
  const detailRes = await fetchWorkspaceAssetDetail(asset.asset_id);
  const inline = detailRes.success ? detailRes.data?.content : undefined;
  if (typeof inline === 'string' && inline.length > 0) {
    return inline;
  }

  const url = asset.preview_url ?? asset.download_url;
  if (!url) {
    throw new Error('No preview URL for markdown asset');
  }

  const blobRes = await fetch(url);
  if (!blobRes.ok) {
    throw new Error(`Preview fetch failed (${blobRes.status})`);
  }
  return blobRes.text();
}
