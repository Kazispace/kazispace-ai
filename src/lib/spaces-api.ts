import { apiRequest } from '@/lib/api-client';
import type { ApiResponse } from '@/types';
import type {
  CreateSpaceRequest,
  PatchSpaceRequest,
  SpaceDetail,
  SpaceListResponse,
  SpaceSummary,
  SpaceTemplatesResponse,
  SpaceTurnRequest,
  SpaceTurnResponse,
} from '@/types/spaces';

/** Normalize BE `id` field (Spaces SDD §1.4 / BE serialize_space_summary). */
export function normalizeSpaceSummary(raw: Record<string, unknown>): SpaceSummary {
  const id = String(raw.id ?? '');
  return {
    id,
    name: String(raw.name ?? ''),
    template_id: String(raw.template_id ?? ''),
    status: (raw.status as SpaceSummary['status']) ?? 'active',
    is_entry_point: Boolean(raw.is_entry_point),
    is_system: Boolean(raw.is_system),
    master_session_id: String(raw.master_session_id ?? ''),
    last_active_at: raw.last_active_at ? String(raw.last_active_at) : null,
    template_icon: raw.template_icon ? String(raw.template_icon) : undefined,
    template_display_name: raw.template_display_name
      ? String(raw.template_display_name)
      : undefined,
  };
}

function normalizeSpaceDetail(raw: Record<string, unknown>): SpaceDetail {
  const base = normalizeSpaceSummary(raw);
  return {
    ...base,
    config_snapshot:
      raw.config_snapshot && typeof raw.config_snapshot === 'object'
        ? (raw.config_snapshot as Record<string, unknown>)
        : {},
    space_state:
      raw.space_state && typeof raw.space_state === 'object'
        ? (raw.space_state as Record<string, unknown>)
        : {},
    created_at: raw.created_at ? String(raw.created_at) : null,
    updated_at: raw.updated_at ? String(raw.updated_at) : null,
  };
}

function detailFromResponse(
  res: ApiResponse<Record<string, unknown>>
): ApiResponse<SpaceDetail> {
  if (!res.success || !res.data) {
    return {
      success: false,
      error: res.error,
      errorCode: res.errorCode,
      status: res.status,
    };
  }
  return { success: true, data: normalizeSpaceDetail(res.data) };
}

export async function listSpaces(): Promise<ApiResponse<SpaceListResponse>> {
  const res = await apiRequest<{ spaces?: Record<string, unknown>[] }>(
    '/api/v1/spaces'
  );
  if (!res.success || !res.data) {
    return {
      success: false,
      error: res.error,
      errorCode: res.errorCode,
      status: res.status,
    };
  }
  const spaces = (res.data.spaces ?? []).map(normalizeSpaceSummary);
  return { success: true, data: { spaces } };
}

export async function getSpace(
  spaceId: string
): Promise<ApiResponse<SpaceDetail>> {
  const res = await apiRequest<Record<string, unknown>>(
    `/api/v1/spaces/${encodeURIComponent(spaceId)}`
  );
  return detailFromResponse(res);
}

export async function createSpace(
  body: CreateSpaceRequest
): Promise<ApiResponse<SpaceDetail>> {
  const res = await apiRequest<Record<string, unknown>>('/api/v1/spaces', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  return detailFromResponse(res);
}

/** PATCH /spaces/{id} — rename (KAZI-176). */
export async function patchSpace(
  spaceId: string,
  body: PatchSpaceRequest
): Promise<ApiResponse<SpaceDetail>> {
  const res = await apiRequest<Record<string, unknown>>(
    `/api/v1/spaces/${encodeURIComponent(spaceId)}`,
    {
      method: 'PATCH',
      body: JSON.stringify(body),
    }
  );
  return detailFromResponse(res);
}

/** POST /spaces/{id}/complete */
export async function completeSpace(
  spaceId: string
): Promise<ApiResponse<SpaceDetail>> {
  const res = await apiRequest<Record<string, unknown>>(
    `/api/v1/spaces/${encodeURIComponent(spaceId)}/complete`,
    { method: 'POST' }
  );
  return detailFromResponse(res);
}

/** POST /spaces/{id}/archive */
export async function archiveSpace(
  spaceId: string
): Promise<ApiResponse<SpaceDetail>> {
  const res = await apiRequest<Record<string, unknown>>(
    `/api/v1/spaces/${encodeURIComponent(spaceId)}/archive`,
    { method: 'POST' }
  );
  return detailFromResponse(res);
}

/** POST /spaces/{id}/restore */
export async function restoreSpace(
  spaceId: string
): Promise<ApiResponse<SpaceDetail>> {
  const res = await apiRequest<Record<string, unknown>>(
    `/api/v1/spaces/${encodeURIComponent(spaceId)}/restore`,
    { method: 'POST' }
  );
  return detailFromResponse(res);
}

/** DELETE /spaces/{id} — soft-delete (7d). */
export async function deleteSpace(
  spaceId: string
): Promise<ApiResponse<SpaceDetail>> {
  const res = await apiRequest<Record<string, unknown>>(
    `/api/v1/spaces/${encodeURIComponent(spaceId)}`,
    { method: 'DELETE' }
  );
  return detailFromResponse(res);
}

export async function listSpaceTemplates(): Promise<
  ApiResponse<SpaceTemplatesResponse>
> {
  return apiRequest<SpaceTemplatesResponse>('/api/v1/space-templates');
}

export async function sendSpaceTurn(
  spaceId: string,
  body: SpaceTurnRequest
): Promise<ApiResponse<SpaceTurnResponse>> {
  return apiRequest<SpaceTurnResponse>(
    `/api/v1/spaces/${encodeURIComponent(spaceId)}/turn`,
    {
      method: 'POST',
      body: JSON.stringify(body),
    }
  );
}
