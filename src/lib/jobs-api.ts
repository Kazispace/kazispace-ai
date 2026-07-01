import { apiRequest } from '@/lib/api-client';
import type { ApiResponse, JobDetailResponse, JobRecommendationsResponse } from '@/types';

export async function listJobRecommendations(
  page = 1,
  limit = 10
): Promise<ApiResponse<JobRecommendationsResponse>> {
  const qs = new URLSearchParams({ page: String(page), limit: String(limit) });
  return apiRequest<JobRecommendationsResponse>(
    `/api/v1/job-recommendations?${qs.toString()}`
  );
}

export async function getJobDetail(
  jobId: string
): Promise<ApiResponse<JobDetailResponse>> {
  return apiRequest<JobDetailResponse>(
    `/api/v1/jobs/${encodeURIComponent(jobId)}`
  );
}
