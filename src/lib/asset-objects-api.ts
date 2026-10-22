import { apiRequest } from '@/lib/api-client';
import type { ApiResponse } from '@/types';

/**
 * Studio objects by id (`/api/v1/asset-objects`, Core Assets §6.4.3). The id is
 * a workspace asset's `provenance.core_asset_id`. Only the owner can call these.
 */
export interface AssetObjectStatusResponse {
  id: string;
  status: 'active' | 'archived';
}

export interface AssetObjectViewResponse {
  view_count: number;
}

const base = (objectId: string) => `/api/v1/asset-objects/${encodeURIComponent(objectId)}`;

export function archiveAssetObject(objectId: string): Promise<ApiResponse<AssetObjectStatusResponse>> {
  return apiRequest<AssetObjectStatusResponse>(`${base(objectId)}/archive`, { method: 'POST' });
}

export function restoreAssetObject(objectId: string): Promise<ApiResponse<AssetObjectStatusResponse>> {
  return apiRequest<AssetObjectStatusResponse>(`${base(objectId)}/restore`, { method: 'POST' });
}

/** Record one open. Called when the user opens the object, never on list or download. */
export function recordAssetObjectView(objectId: string): Promise<ApiResponse<AssetObjectViewResponse>> {
  return apiRequest<AssetObjectViewResponse>(`${base(objectId)}/views`, { method: 'POST' });
}
