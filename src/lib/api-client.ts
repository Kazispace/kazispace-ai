import { API_BASE_URL } from './constants';
import { getAuthToken, getDeviceId, clearAuthToken } from './auth';
import type {
  ApiResponse,
  OtpRequestResponse,
  OtpVerifyResponse,
  User,
  ChatMessage,
  CreditBalance,
  LedgerEntry,
} from '@/types';

async function apiRequest<T>(
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
      return {
        success: false,
        error:
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
  phoneOrEmail: string
): Promise<ApiResponse<OtpRequestResponse>> {
  return apiRequest<OtpRequestResponse>('/api/v1/auth/otp/request', {
    method: 'POST',
    body: JSON.stringify({ contact: phoneOrEmail }),
  });
}

export async function verifyOtp(
  phoneOrEmail: string,
  code: string
): Promise<ApiResponse<OtpVerifyResponse>> {
  return apiRequest<OtpVerifyResponse>('/api/v1/auth/otp/verify', {
    method: 'POST',
    body: JSON.stringify({ contact: phoneOrEmail, code }),
  });
}

export async function getMe(): Promise<ApiResponse<User>> {
  return apiRequest<User>('/api/v1/me');
}

export interface ClinicChatResponse {
  reply?: string;
  response?: { text?: string };
  message_id?: string;
  messageId?: string;
  intent?: string;
}

export async function sendChatMessage(
  sessionId: string,
  text: string
): Promise<ApiResponse<ClinicChatResponse>> {
  return apiRequest<ClinicChatResponse>('/api/v1/chat/messages', {
    method: 'POST',
    body: JSON.stringify({ session_id: sessionId, text }),
  });
}

export async function fetchChatHistory(
  sessionId: string
): Promise<ApiResponse<{ messages: ChatMessage[] } | ChatMessage[]>> {
  return apiRequest(`/api/v1/chat/sessions/${sessionId}/messages`);
}

export async function getCreditBalance(): Promise<ApiResponse<CreditBalance>> {
  return apiRequest<CreditBalance>('/api/v1/credits/balance');
}

export async function getLedger(
  filter?: 'all' | 'consumption' | 'recharge'
): Promise<ApiResponse<{ entries: LedgerEntry[] }>> {
  const query = filter && filter !== 'all' ? `?filter=${filter}` : '';
  return apiRequest(`/api/v1/credits/ledger${query}`);
}

export function parseClinicReply(data: ClinicChatResponse | undefined): {
  reply: string;
  intent?: string;
} {
  if (!data) return { reply: '' };
  const reply = data.reply ?? data.response?.text ?? '';
  return { reply, intent: data.intent };
}
