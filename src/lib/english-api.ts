import { API_BASE_URL } from '@/lib/constants';
import { getAuthToken, getDeviceId } from '@/lib/auth';
import { getTmaClientHeaders } from '@/lib/telegram';
import { normalizeEnglishCtaHints } from '@/lib/english-epp-cta';
import type {
  ApiResponse,
  EnglishAssessmentCompleteResult,
  EnglishAssessmentSession,
  EnglishOnboardingRequest,
  EnglishProfile,
  EnglishProfileHistory,
  EnglishSampleJobs,
  EnglishTrainingSession,
} from '@/types';

function parseEnglishFormError(errorData: Record<string, unknown>, status: number) {
  const detail = errorData.detail;
  const detailMessage =
    typeof detail === 'object' && detail !== null
      ? (detail as { message?: string }).message
      : undefined;
  const errorCode =
    (typeof detail === 'object' && detail !== null
      ? (detail as { error_code?: string }).error_code
      : undefined) ??
    (errorData.error_code as string | undefined) ??
    (typeof errorData.error === 'string' ? errorData.error : undefined);

  return {
    error:
      detailMessage ||
      (errorData.message as string | undefined) ||
      (errorData.error as string | undefined) ||
      `HTTP ${status}`,
    errorCode,
  };
}

async function englishJsonRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const url = `${API_BASE_URL}${endpoint}`;
  const token = getAuthToken();
  const deviceId = getDeviceId();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Device-ID': deviceId,
    ...getTmaClientHeaders(),
  };

  if (options.headers) {
    Object.assign(headers, options.headers as Record<string, string>);
  }
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  try {
    const response = await fetch(url, { ...options, headers });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        success: false,
        error:
          errorData.message ||
          errorData.error ||
          errorData.detail?.message ||
          `HTTP ${response.status}`,
        errorCode: errorData.error_code ?? errorData.detail?.error_code,
      };
    }
    const data = (await response.json()) as T;
    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error',
    };
  }
}

function normalizeProfile(profile: EnglishProfile): EnglishProfile {
  return {
    ...profile,
    cta_hints: normalizeEnglishCtaHints(profile.cta_hints),
  };
}

export async function getEnglishProfile(): Promise<ApiResponse<EnglishProfile>> {
  const res = await englishJsonRequest<EnglishProfile>('/api/v1/english/profile');
  if (res.success && res.data) {
    return { ...res, data: normalizeProfile(res.data) };
  }
  return res;
}

export async function getEnglishProfileHistory(params?: {
  limit?: number;
  before_version?: number;
}): Promise<ApiResponse<EnglishProfileHistory>> {
  const search = new URLSearchParams();
  if (params?.limit != null) search.set('limit', String(params.limit));
  if (params?.before_version != null) {
    search.set('before_version', String(params.before_version));
  }
  const qs = search.toString();
  return englishJsonRequest<EnglishProfileHistory>(
    `/api/v1/english/profile/history${qs ? `?${qs}` : ''}`
  );
}

export async function getEnglishSampleJobs(params?: {
  display_level?: number;
}): Promise<ApiResponse<EnglishSampleJobs>> {
  const search = new URLSearchParams();
  if (params?.display_level != null) {
    search.set('display_level', String(params.display_level));
  }
  const qs = search.toString();
  return englishJsonRequest<EnglishSampleJobs>(
    `/api/v1/english/sample-jobs${qs ? `?${qs}` : ''}`
  );
}

export async function postEnglishOnboarding(
  body: EnglishOnboardingRequest
): Promise<ApiResponse<{ ok: boolean }>> {
  return englishJsonRequest('/api/v1/english/onboarding', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function createEnglishAssessmentSession(body: {
  variant: 'quick' | 'standard';
  career_goal?: string;
  self_assessed_band?: string;
}): Promise<ApiResponse<EnglishAssessmentSession>> {
  return englishJsonRequest<EnglishAssessmentSession>(
    '/api/v1/english/assessment/sessions',
    { method: 'POST', body: JSON.stringify(body) }
  );
}

export async function getEnglishAssessmentSession(
  sessionId: string
): Promise<ApiResponse<EnglishAssessmentSession>> {
  return englishJsonRequest<EnglishAssessmentSession>(
    `/api/v1/english/assessment/sessions/${encodeURIComponent(sessionId)}`
  );
}

export async function submitEnglishAssessmentTextItem(
  sessionId: string,
  body: { item_index: number; answer_mode: 'text'; text: string }
): Promise<ApiResponse<{ ok: boolean }>> {
  return englishJsonRequest(
    `/api/v1/english/assessment/sessions/${encodeURIComponent(sessionId)}/items`,
    { method: 'POST', body: JSON.stringify(body) }
  );
}

export async function submitEnglishAssessmentAudioItem(
  sessionId: string,
  params: {
    item_index: number;
    audio: Blob;
    transcript?: string;
  }
): Promise<ApiResponse<{ ok: boolean }>> {
  const url = `${API_BASE_URL}/api/v1/english/assessment/sessions/${encodeURIComponent(sessionId)}/items`;
  const token = getAuthToken();
  const form = new FormData();
  form.append('item_index', String(params.item_index));
  form.append('answer_mode', 'audio');
  form.append('audio', params.audio, 'recording.webm');
  if (params.transcript?.trim()) {
    form.append('transcript', params.transcript.trim());
  }

  const headers: Record<string, string> = {
    'X-Device-ID': getDeviceId(),
    ...getTmaClientHeaders(),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  try {
    const response = await fetch(url, { method: 'POST', headers, body: form });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const { error, errorCode } = parseEnglishFormError(errorData, response.status);
      return { success: false, error, errorCode };
    }
    return { success: true, data: { ok: true } };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error',
    };
  }
}

export async function completeEnglishAssessment(
  sessionId: string
): Promise<ApiResponse<EnglishAssessmentCompleteResult>> {
  const res = await englishJsonRequest<EnglishAssessmentCompleteResult>(
    `/api/v1/english/assessment/sessions/${encodeURIComponent(sessionId)}/complete`,
    { method: 'POST', body: JSON.stringify({}) }
  );
  if (res.success && res.data?.profile) {
    return {
      ...res,
      data: { ...res.data, profile: normalizeProfile(res.data.profile) },
    };
  }
  return res;
}

export async function createEnglishTrainingSession(body: {
  scenario_id: string;
}): Promise<ApiResponse<EnglishTrainingSession>> {
  return englishJsonRequest<EnglishTrainingSession>(
    '/api/v1/english/training/sessions',
    { method: 'POST', body: JSON.stringify(body) }
  );
}

export async function getEnglishTrainingSession(
  sessionId: string
): Promise<ApiResponse<EnglishTrainingSession>> {
  const res = await englishJsonRequest<EnglishTrainingSession>(
    `/api/v1/english/training/sessions/${encodeURIComponent(sessionId)}`
  );
  if (res.success && res.data?.profile) {
    return {
      ...res,
      data: { ...res.data, profile: normalizeProfile(res.data.profile) },
    };
  }
  return res;
}

export async function submitEnglishTrainingTextItem(
  sessionId: string,
  body: { item_index: number; answer_mode: 'text'; text: string }
): Promise<ApiResponse<{ ok: boolean }>> {
  return englishJsonRequest(
    `/api/v1/english/training/sessions/${encodeURIComponent(sessionId)}/items`,
    { method: 'POST', body: JSON.stringify(body) }
  );
}

export async function submitEnglishTrainingAudioItem(
  sessionId: string,
  params: {
    item_index: number;
    audio: Blob;
    transcript?: string;
  }
): Promise<ApiResponse<{ ok: boolean }>> {
  const url = `${API_BASE_URL}/api/v1/english/training/sessions/${encodeURIComponent(sessionId)}/items`;
  const token = getAuthToken();
  const form = new FormData();
  form.append('item_index', String(params.item_index));
  form.append('answer_mode', 'audio');
  form.append('audio', params.audio, 'recording.webm');
  if (params.transcript?.trim()) {
    form.append('transcript', params.transcript.trim());
  }

  const headers: Record<string, string> = {
    'X-Device-ID': getDeviceId(),
    ...getTmaClientHeaders(),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  try {
    const response = await fetch(url, { method: 'POST', headers, body: form });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const { error, errorCode } = parseEnglishFormError(errorData, response.status);
      return { success: false, error, errorCode };
    }
    return { success: true, data: { ok: true } };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error',
    };
  }
}
