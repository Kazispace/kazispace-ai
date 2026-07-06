import { apiFetch } from './api-client.js';
import type { AuthSession } from './types.js';
import { getOtpMockCode } from './api-client.js';

export async function loginWithOtp(phone: string, deviceId: string): Promise<AuthSession> {
  const request = await apiFetch<{ _mock_code?: string }>('/api/v1/auth/otp/request', {
    method: 'POST',
    deviceId,
    body: { phone },
  });
  if (!request.ok) {
    throw new Error(`OTP request failed: ${request.error}`);
  }

  const code = request.data?._mock_code ?? getOtpMockCode();
  const verify = await apiFetch<{
    access_token?: string;
    user?: { user_id?: number | string };
  }>('/api/v1/auth/otp/verify', {
    method: 'POST',
    deviceId,
    body: { phone, code },
  });

  if (!verify.ok || !verify.data?.access_token) {
    throw new Error(`OTP verify failed: ${verify.error}`);
  }

  return {
    phone,
    deviceId,
    token: verify.data.access_token,
    userId: String(verify.data.user?.user_id ?? 'unknown'),
  };
}

export async function activateAgent(
  session: AuthSession,
  agentId: string
): Promise<{ sessionId: string; greeting?: string }> {
  const res = await apiFetch<Record<string, unknown>>(`/api/v1/agents/${agentId}/activate`, {
    method: 'POST',
    deviceId: session.deviceId,
    token: session.token,
    body: {},
  });
  if (!res.ok || !res.data) {
    throw new Error(`Activate agent failed: ${res.error}`);
  }
  const sessionId = res.data.session_id;
  if (typeof sessionId !== 'string') {
    throw new Error('Activate agent: missing session_id');
  }
  const greeting = typeof res.data.greeting === 'string' ? res.data.greeting : undefined;
  return { sessionId, greeting };
}

export async function sendAgentMessage(
  session: AuthSession,
  agentId: string,
  message: string,
  sessionId?: string
) {
  return apiFetch<Record<string, unknown>>('/api/v1/agents/chat', {
    method: 'POST',
    deviceId: session.deviceId,
    token: session.token,
    body: {
      agent_id: agentId,
      message,
      ...(sessionId ? { session_id: sessionId } : {}),
    },
  });
}

export async function sendClinicMessage(
  session: AuthSession,
  sessionId: string,
  content: string
) {
  return apiFetch<Record<string, unknown>>('/api/v1/chat/messages', {
    method: 'POST',
    deviceId: session.deviceId,
    token: session.token,
    body: { session_id: sessionId, content },
  });
}

export async function getMe(session: AuthSession) {
  return apiFetch<Record<string, unknown>>('/api/v1/me', {
    deviceId: session.deviceId,
    token: session.token,
  });
}

export async function getBillingSummary(session: AuthSession) {
  return apiFetch<Record<string, unknown>>('/api/v1/billing/summary', {
    deviceId: session.deviceId,
    token: session.token,
  });
}

export async function deactivateAgent(session: AuthSession, agentId: string) {
  return apiFetch(`/api/v1/agents/${agentId}/deactivate`, {
    method: 'POST',
    deviceId: session.deviceId,
    token: session.token,
    body: {},
  });
}
