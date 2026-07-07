import { API_BASE_URL } from './constants';
import { getAuthToken, getDeviceId, clearAuthToken } from './auth';
import { mapUserFromApi } from './api-mappers';
import { parseAssistantEnvelope } from './chat-envelope';
import { isReferralDismissed } from './referral-dismiss';
import { getTmaClientHeaders } from './telegram';
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
  ChatJobCard,
  ChatNextAction,
  TelegramWebappResponse,
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

  Object.assign(headers, getTmaClientHeaders());

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
          ? (detail as { message?: string; error_code?: string }).message ??
            (detail as { error_code?: string }).error_code
          : undefined;
      const errorCode =
        (typeof detail === 'object' && detail !== null
          ? (detail as { error_code?: string }).error_code
          : undefined) ??
        errorData.error_code ??
        (typeof errorData.error === 'string' ? errorData.error : undefined);
      return {
        success: false,
        error:
          detailMessage ||
          errorData.message ||
          errorData.error ||
          errorData.error_code ||
          `HTTP ${response.status}`,
        errorCode,
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

export interface PatchMeBody {
  primary_country?: string | null;
  primary_locale?: string | null;
  career_goal?: string | null;
  target_role?: string | null;
  english_level?: string | null;
  current_status?: string | null;
  education_text?: string | null;
  experience_text?: string | null;
}

export async function patchMe(body: PatchMeBody): Promise<ApiResponse<User>> {
  const res = await apiRequest<Record<string, unknown>>('/api/v1/me', {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
  if (!res.success || !res.data) {
    return { success: false, error: res.error, errorCode: res.errorCode };
  }
  return { success: true, data: mapUserFromApi(res.data) };
}

export async function authTelegramWebapp(
  initData: string
): Promise<ApiResponse<TelegramWebappResponse>> {
  return apiRequest<TelegramWebappResponse>('/api/v1/auth/telegram-miniapp', {
    method: 'POST',
    body: JSON.stringify({ init_data: initData }),
  });
}

export interface ClinicChatResponse {
  reply?: string;
  response?: {
    text?: string;
    next_actions?: ChatNextAction[];
    cards?: ChatJobCard[];
  };
  assistant_response?: {
    content?: string;
    next_actions?: ChatNextAction[];
    cards?: ChatJobCard[];
  };
  message_id?: string;
  messageId?: string;
  intent?: string;
  referral_agent_id?: string;
  referral_reason?: string;
  referral?: { agent_id?: string; reason?: string };
  routed_to_agent?: boolean;
  agent_id?: string;
  session_id?: string;
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

/** Ledger — falls back to empty when endpoint unavailable */
export async function getLedger(
  _filter?: 'all' | 'consumption' | 'recharge'
): Promise<ApiResponse<{ entries: LedgerEntry[] }>> {
  const res = await apiRequest<{ entries?: LedgerEntry[] } | LedgerEntry[]>(
    '/api/v1/billing/ledger'
  );
  if (res.success && res.data) {
    const entries = Array.isArray(res.data)
      ? res.data
      : (res.data.entries ?? []);
    return { success: true, data: { entries } };
  }
  if (res.error?.includes('404') || res.error?.includes('Not Found')) {
    return { success: true, data: { entries: [] } };
  }
  return { success: false, error: res.error, errorCode: res.errorCode };
}

export function parseClinicReply(data: ClinicChatResponse | undefined): {
  reply: string;
  intent?: string;
  referral?: { agentId: string; reason: string };
  nextActions: ChatNextAction[];
  cards: ChatJobCard[];
  routedToAgent?: { agentId: string; sessionId?: string };
} {
  if (!data) {
    return { reply: '', nextActions: [], cards: [] };
  }

  const envelope = parseAssistantEnvelope(data);

  let referralAgentId =
    data.referral_agent_id ?? data.referral?.agent_id;
  let referralReason = data.referral_reason ?? data.referral?.reason ?? '';

  if (!referralAgentId && data.intent?.startsWith('REFERRAL_')) {
    referralAgentId = data.intent.replace(/^REFERRAL_/, '');
  }

  const referral =
    referralAgentId && !isReferralDismissed(referralAgentId)
      ? { agentId: referralAgentId, reason: referralReason }
      : undefined;

  const routedToAgent =
    data.routed_to_agent && data.agent_id
      ? {
          agentId: data.agent_id,
          sessionId:
            typeof data.session_id === 'string' ? data.session_id : undefined,
        }
      : undefined;

  return {
    reply: envelope.reply,
    intent: data.intent ?? envelope.intent,
    referral,
    nextActions: envelope.nextActions,
    cards: envelope.cards,
    routedToAgent,
  };
}
