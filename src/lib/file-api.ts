import { apiRequest } from '@/lib/api-client';
import type { ApiResponse } from '@/types';
import type {
  FileCategory,
  UserFile,
  UserFileListResponse,
  UserFileUrlResponse,
} from '@/types/user-files';

function useMockFallback(error?: string): boolean {
  if (process.env.NEXT_PUBLIC_AGENT_API_MOCK === 'true') return true;
  if (process.env.NODE_ENV === 'production') return false;
  if (!error) return false;
  return error.includes('404') || error.includes('Not Found');
}

const MOCK_FILES: UserFile[] = [
  {
    file_id: 'mock_cv_gen_1',
    filename: 'Resume_v3.pdf',
    category: 'cv/generated',
    mime_type: 'application/pdf',
    size_bytes: 245_760,
    tier: 'agent_output',
    space_id: null,
    created_at: '2026-07-12T10:00:00Z',
  },
  {
    file_id: 'mock_cv_upload_1',
    filename: 'Cover_Letter.docx',
    category: 'cv/uploads',
    mime_type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    size_bytes: 131_072,
    tier: 'asset',
    space_id: null,
    created_at: '2026-07-10T14:00:00Z',
  },
  {
    file_id: 'mock_doc_1',
    filename: 'Portfolio.pdf',
    category: 'documents',
    mime_type: 'application/pdf',
    size_bytes: 2_457_600,
    tier: 'asset',
    space_id: null,
    created_at: '2026-07-05T09:00:00Z',
  },
  {
    file_id: 'mock_audio_1',
    filename: 'interview_abc123_q0.webm',
    category: 'interview/audio',
    mime_type: 'audio/webm',
    size_bytes: 5_324_800,
    tier: 'agent_output',
    space_id: null,
    created_at: '2026-07-08T16:00:00Z',
  },
  {
    file_id: 'mock_doc_2',
    filename: 'References.pdf',
    category: 'documents',
    mime_type: 'application/pdf',
    size_bytes: 98_304,
    tier: 'asset',
    space_id: null,
    created_at: '2026-07-03T11:00:00Z',
  },
];

export async function fetchUserFiles(
  category?: FileCategory,
  spaceId?: string,
): Promise<ApiResponse<UserFileListResponse>> {
  const params = new URLSearchParams();
  if (category) params.set('category', category);
  if (spaceId) params.set('space_id', spaceId);
  const query = params.toString() ? `?${params.toString()}` : '';
  const res = await apiRequest<UserFileListResponse>(`/api/v1/files${query}`);
  if (res.success && res.data) return res;
  if (useMockFallback(res.error)) {
    const filtered = category
      ? MOCK_FILES.filter((f) => f.category === category)
      : MOCK_FILES;
    return {
      success: true,
      data: { items: filtered, total: filtered.length, has_more: false },
    };
  }
  return { success: false, error: res.error, errorCode: res.errorCode };
}

export async function getFileDownloadUrl(
  fileId: string
): Promise<ApiResponse<UserFileUrlResponse>> {
  const res = await apiRequest<UserFileUrlResponse>(
    `/api/v1/files/${encodeURIComponent(fileId)}/url`
  );
  if (res.success && res.data) return res;
  if (useMockFallback(res.error)) {
    return {
      success: true,
      data: {
        file_id: fileId,
        download_url: `https://example.com/mock-download/${fileId}`,
        expires_in: 900,
      },
    };
  }
  return { success: false, error: res.error, errorCode: res.errorCode };
}

export async function deleteUserFile(
  fileId: string
): Promise<ApiResponse<void>> {
  const res = await apiRequest<void>(
    `/api/v1/files/${encodeURIComponent(fileId)}`,
    { method: 'DELETE' }
  );
  if (res.success) return { success: true, data: undefined };
  if (useMockFallback(res.error)) {
    return { success: true, data: undefined };
  }
  return { success: false, error: res.error, errorCode: res.errorCode };
}

export async function uploadFile(
  file: File,
  category: FileCategory,
  options?: { tier?: string; spaceId?: string; metadata?: Record<string, unknown> },
): Promise<ApiResponse<UserFile>> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('category', category);
  if (options?.tier) formData.append('tier', options.tier);
  if (options?.spaceId) formData.append('space_id', options.spaceId);
  if (options?.metadata) formData.append('metadata', JSON.stringify(options.metadata));

  const res = await apiRequest<UserFile>('/api/v1/files/upload', {
    method: 'POST',
    body: formData as unknown as BodyInit,
  });
  if (res.success && res.data) return res;
  if (useMockFallback(res.error)) {
    return {
      success: true,
      data: {
        file_id: `mock_${Date.now()}`,
        filename: file.name,
        category,
        mime_type: file.type,
        size_bytes: file.size,
        tier: (options?.tier ?? 'asset') as UserFile['tier'],
        space_id: options?.spaceId ?? null,
        created_at: new Date().toISOString(),
      },
    };
  }
  return { success: false, error: res.error, errorCode: res.errorCode };
}
