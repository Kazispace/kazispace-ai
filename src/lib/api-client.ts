import { API_BASE_URL } from './constants';
import { getAuthToken, getDeviceId, clearAuthToken } from './auth';
import type { ApiResponse, OtpRequestResponse, OtpVerifyResponse, User, ChatMessage, CreditBalance, LedgerEntry } from '@/types';

/**
 * Core fetch wrapper with auth injection and error handling
 */
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const url = `${API_BASE_URL}${endpoint}`;
  const token = getAuthToken();
  const deviceId = getDeviceId();

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    'X-Device-ID': deviceId,
    ...options.headers,
  };

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
        error: errorData.message || errorData.error || `HTTP ${response.status}`,
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

// ---- Auth APIs ----

export async function requestOtp(phoneOrEmail: string): Promise<ApiResponse<OtpRequestResponse>> {
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

export async function bindWebUser(userData: Partial<User>): Promise<ApiResponse<User>> {
  return apiRequest<User>('/api/v1/user/bind', {
    method: 'POST',
    body: JSON.stringify(userData),
  });
}

// ---- Chat APIs ----

export async function sendChatMessage(
  sessionId: string,
  message: string
): Promise<ApiResponse<{ reply: string; messageId: string }>> {
  return apiRequest('/api/v1/chat/messages', {
    method: 'POST',
    body: JSON.stringify({ sessionId, message }),
  });
}

export async function fetchChatHistory(
  sessionId: string
): Promise<ApiResponse<{ messages: ChatMessage[] }>> {
  return apiRequest(`/api/v1/chat/sessions/${sessionId}/messages`);
}

// ---- Credits APIs ----

export async function getCreditBalance(): Promise<ApiResponse<CreditBalance>> {
  return apiRequest<CreditBalance>('/api/v1/credits/balance');
}

export async function getLedger(
  filter?: 'all' | 'consumption' | 'recharge'
): Promise<ApiResponse<{ entries: LedgerEntry[] }>> {
  const query = filter && filter !== 'all' ? `?filter=${filter}` : '';
  return apiRequest(`/api/v1/credits/ledger${query}`);
}
