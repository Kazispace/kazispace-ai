/**
 * CV version list — wraps the unified file API filtered by cv/generated category.
 * Each generated CV PDF is a "version" in the user's file library.
 */
import { fetchUserFiles, getFileDownloadUrl } from '@/lib/file-api';
import type { ApiResponse } from '@/types';
import type { UserFile } from '@/types/user-files';

export interface CvVersion {
  file_id: string;
  version_number: number;
  filename: string;
  size_bytes: number;
  created_at: string;
  is_current: boolean;
}

export interface CvVersionListResponse {
  versions: CvVersion[];
}

function filesToVersions(files: UserFile[]): CvVersion[] {
  const sorted = [...files].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
  return sorted.map((f, i) => ({
    file_id: f.file_id,
    version_number: sorted.length - i,
    filename: f.filename,
    size_bytes: f.size_bytes,
    created_at: f.created_at,
    is_current: i === 0,
  }));
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
