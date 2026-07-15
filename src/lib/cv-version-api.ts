/**
 * CV version list — wraps the unified file API filtered by cv/generated category.
 * Prefer stable `meta.version_number` when BE provides it; otherwise show date as label
 * (avoid relative v1/v2/v3 that reshuffles when items are deleted).
 */
import { fetchUserFiles, getFileDownloadUrl } from '@/lib/file-api';
import type { ApiResponse } from '@/types';
import type { UserFile } from '@/types/user-files';

export interface CvVersion {
  file_id: string;
  /** Stable label: "v3" from meta, or formatted date when meta is absent. */
  label: string;
  filename: string;
  size_bytes: number;
  created_at: string;
  is_current: boolean;
  version_number: number | null;
}

export interface CvVersionListResponse {
  versions: CvVersion[];
}

function filesToVersions(files: UserFile[]): CvVersion[] {
  const sorted = [...files].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
  return sorted.map((f, i) => {
    const metaVersion =
      typeof f.meta?.version_number === 'number' ? f.meta.version_number : null;
    const dateLabel = new Date(f.created_at).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    return {
      file_id: f.file_id,
      label: metaVersion != null ? `v${metaVersion}` : dateLabel,
      filename: f.filename,
      size_bytes: f.size_bytes,
      created_at: f.created_at,
      is_current: i === 0,
      version_number: metaVersion,
    };
  });
}

export async function fetchCvVersions(): Promise<ApiResponse<CvVersionListResponse>> {
  const res = await fetchUserFiles('cv/generated');
  if (res.success && res.data) {
    return {
      success: true,
      data: { versions: filesToVersions(res.data.items) },
    };
  }
  return { success: false, error: res.error, errorCode: res.errorCode };
}

export async function getCvVersionDownloadUrl(
  fileId: string
): Promise<ApiResponse<{ download_url: string }>> {
  const res = await getFileDownloadUrl(fileId);
  if (res.success && res.data) {
    return { success: true, data: { download_url: res.data.download_url } };
  }
  return { success: false, error: res.error, errorCode: res.errorCode };
}
