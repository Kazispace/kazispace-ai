import { apiRequest } from '@/lib/api-client';
import { normalizeIrpCtaHints } from '@/lib/interview-irp-cta';
import type {
  ApiResponse,
  InterviewProfile,
  InterviewReadinessCheckRequest,
  InterviewReadinessResult,
  IrpProfileHistory,
} from '@/types';

/** Sole profile+cta_hints entry — no other API returns InterviewProfile today. */
function normalizeInterviewProfile(profile: InterviewProfile): InterviewProfile {
  return {
    ...profile,
    cta_hints: normalizeIrpCtaHints(profile.cta_hints, {
      targetJobId: profile.target_job_id,
      profileStatus: profile.profile_status,
    }),
  };
}

export async function getInterviewProfile(): Promise<ApiResponse<InterviewProfile>> {
  const res = await apiRequest<InterviewProfile>('/api/v1/interview/profile');
  if (res.success && res.data) {
    return { ...res, data: normalizeInterviewProfile(res.data) };
  }
  return res;
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
