import { apiRequest } from '@/lib/api-client';
import type { ApiResponse, NextBestActionResponse } from '@/types';

export async function getNextBestAction(
  userId: string | number
): Promise<ApiResponse<NextBestActionResponse>> {
  return apiRequest<NextBestActionResponse>(
    `/api/v1/users/${encodeURIComponent(String(userId))}/next-best-action`
  );
}
