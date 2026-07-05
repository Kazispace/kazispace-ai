import { apiRequest } from '@/lib/api-client';
import type {
  ApiResponse,
  InterviewProfile,
  InterviewReadinessCheckRequest,
  InterviewReadinessResult,
  IrpProfileHistory,
} from '@/types';

export async function getInterviewProfile(): Promise<ApiResponse<InterviewProfile>> {
  return apiRequest<InterviewProfile>('/api/v1/interview/profile');
}

export async function getInterviewProfileHistory(params?: {
  limit?: number;
  before_version?: number;
}): Promise<ApiResponse<IrpProfileHistory>> {
  const search = new URLSearchParams();
  if (params?.limit != null) search.set('limit', String(params.limit));
  if (params?.before_version != null) {
    search.set('before_version', String(params.before_version));
  }
  const qs = search.toString();
  return apiRequest<IrpProfileHistory>(
    `/api/v1/interview/profile/history${qs ? `?${qs}` : ''}`
  );
}

export async function postInterviewReadinessCheck(
  body: InterviewReadinessCheckRequest
): Promise<ApiResponse<InterviewReadinessResult>> {
  return apiRequest<InterviewReadinessResult>('/api/v1/interview/readiness-check', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}
