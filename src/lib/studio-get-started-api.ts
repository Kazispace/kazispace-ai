import { apiRequest } from '@/lib/api-client';
import type { ApiResponse } from '@/types';

/**
 * Studio's Get started buttons (`GET /api/v1/studio/get-started`; kazispace-ui
 * Studio pattern, Get started; D25). The server picks the list for the user's
 * country and writes `label` and `text` in the request's language.
 */
export interface GetStartedGuide {
  id: string;
  label: string;
  /** Put in the main chat's composer on tap; never sent by the app. */
  text: string;
}

export interface GetStartedResponse {
  guides: GetStartedGuide[];
}

export function fetchStudioGetStarted(): Promise<ApiResponse<GetStartedResponse>> {
  return apiRequest<GetStartedResponse>('/api/v1/studio/get-started');
}
