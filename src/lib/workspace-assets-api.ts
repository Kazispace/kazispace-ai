import { apiRequest } from '@/lib/api-client';
import type { ApiResponse } from '@/types';
import type {
  FetchWorkspaceAssetsParams,
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
