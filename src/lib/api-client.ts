import { API_BASE_URL } from './constants';
import { getAuthToken, getDeviceId, clearAuthToken } from './auth';
import { mapUserFromApi } from './api-mappers';
import type {
  ApiResponse,
  OtpRequestResponse,
  OtpVerifyResponse,
  User,
  ChatMessage,
  CreditBalance,
  BillingSummary,
  CurrentPlan,
  LedgerEntry,
} from '@/types';

export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const url = `${API_BASE_URL}${endpoint}`;
  const token = getAuthToken();
  const deviceId = getDeviceId();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Device-ID': deviceId,
  };

  if (options.headers) {
    Object.assign(headers, options.headers as Record<string, string>);
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const response = await fetch(url, { ...options, headers });

    if (response.status === 401) {
      clearAuthToken();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('kazi:session-expired'));
      }
      return { success: false, error: 'Session expired' };
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const detail = errorData.detail;
      const detailMessage =
        typeof detail === 'object' && detail !== null
          ? detail.message ?? detail.error_code
          : undefined;
      return {
        success: false,
        error:
          detailMessage ||
          errorData.message ||
          errorData.error ||
          errorData.error_code ||
          `HTTP ${response.status}`,
      };
    }

    const data = await response.json();
    return { success: true, data: data as T };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Network error',
    };
  }
}

export async function requestOtp(
  phone: string
): Promise<ApiResponse<OtpRequestResponse>> {
  return apiRequest<OtpRequestResponse>('/api/v1/auth/otp/request', {
    method: 'POST',
    body: JSON.stringify({ phone }),
  });
}

export async function verifyOtp(
  phone: string,
  code: string
): Promise<ApiResponse<OtpVerifyResponse>> {
  const res = await apiRequest<Record<string, unknown>>('/api/v1/auth/otp/verify', {
    method: 'POST',
    body: JSON.stringify({ phone, code }),
  });

  if (!res.success || !res.data) {
    return { success: false, error: res.error };
  }

  const raw = res.data;
  const token = (raw.access_token ?? raw.token) as string | undefined;
  if (!token) {
    return { success: false, error: 'Invalid login response' };
  }

  const userRaw = (raw.user ?? {}) as Record<string, unknown>;
  return {
    success: true,
    data: {
      success: true,
      token,
      user: mapUserFromApi(userRaw),
    },
  };
}

export async function getMe(): Promise<ApiResponse<User>> {
  const res = await apiRequest<Record<string, unknown>>('/api/v1/me');
  if (!res.success || !res.data) {
    return { success: false, error: res.error };
  }
  return { success: true, data: mapUserFromApi(res.data) };
}

export interface ClinicChatResponse {
  reply?: string;
  response?: { text?: string };
  assistant_response?: { content?: string };
  message_id?: string;
  messageId?: string;
  intent?: string;
}

export async function sendChatMessage(
  sessionId: string,
  text: string
): Promise<ApiResponse<ClinicChatResponse>> {
  // Backend WebChatRequest: { session_id, content } — not `text`
  return apiRequest<ClinicChatResponse>('/api/v1/chat/messages', {
    method: 'POST',
    body: JSON.stringify({ session_id: sessionId, content: text }),
  });
}

export async function fetchChatHistory(
  sessionId: string
): Promise<ApiResponse<{ messages: ChatMessage[] } | ChatMessage[]>> {
  return apiRequest(`/api/v1/chat/sessions/${sessionId}/messages`);
}

/** @deprecated Use getBillingSummary */
export async function getCreditBalance(): Promise<ApiResponse<CreditBalance>> {
  const res = await getBillingSummary();
  if (!res.success || !res.data) {
    return { success: false, error: res.error };
  }
  const balance = res.data.credits?.balance ?? 0;
  return {
    success: true,
    data: { cvCredits: balance, interviewCredits: 0 },
  };
}

export async function getBillingSummary(): Promise<ApiResponse<BillingSummary>> {
  return apiRequest<BillingSummary>('/api/v1/billing/summary');
}

export async function getCurrentPlan(): Promise<ApiResponse<CurrentPlan>> {
  return apiRequest<CurrentPlan>('/api/v1/plans/current');
}

/** No ledger endpoint on backend yet — returns empty list */
export async function getLedger(
  _filter?: 'all' | 'consumption' | 'recharge'
): Promise<ApiResponse<{ entries: LedgerEntry[] }>> {
  return { success: true, data: { entries: [] } };
}

export function parseClinicReply(data: ClinicChatResponse | undefined): {
  reply: string;
  intent?: string;
} {
  if (!data) return { reply: '' };
  const reply =
    data.reply ??
    data.assistant_response?.content ??
    data.response?.text ??
    '';
  return { reply, intent: data.intent };
}
