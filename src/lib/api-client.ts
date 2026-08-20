import { getAuthToken, getDeviceId, clearAuthToken, setRegionAuthSession } from './auth';
import { getActiveLanguagePreference } from './locale';
import { mapUserFromApi } from './api-mappers';
import { parseAssistantEnvelope } from './chat-envelope';
import { isReferralDismissed } from './referral-dismiss';
import {
  extractSpaceNudge,
  isSpaceNudgeDismissed,
  type SpaceNudgePayload,
} from './spaces/space-nudge';
import { isSpacesEnabled } from './spaces/constants';
import { isPlaceholderReply, resolveSpaceTurnReply } from './spaces/turn';
import {
  buildChatHistoryQuery,
  windowedHistoryQuery,
} from '@/lib/chat/history-window';
import { extractAssistantMessageId } from './clinic/message-feedback';
import { getTmaClientHeaders } from './telegram';
import { parseRetryAfterSeconds } from './retry-after';
import { assertOtpAttempt, createOtpAttempt, type OtpAttempt } from './region/otp-attempt';
import {
  BUNDLED_DIRECTORY,
  bootstrapBase,
  ensureDirectoryLoaded,
  findRowByApiBase,
} from './region/directory';
import { buildSessionFromVerify } from './region/session';
import {
  RegionAccountFetchError,
  regionAwareApiClient,
} from './region/client';
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

export type ApiRequestOptions = RequestInit & {
  /** Explicit Language Preference for headers; avoids SSR defaulting to `ru`. */
  locale?: string;
  /** Pre-login OTP routing by phone (KAZI-533). */
  phone?: string;
  /** Pin to allowlisted pre-auth host (OtpAttempt). */
  apiBase?: string;
  /** Force bootstrap host (health / public). */
  bootstrap?: boolean;
  /** Require region session (account-scoped). */
  requireSession?: boolean;
};

export type OtpRequestResult = ApiResponse<OtpRequestResponse> & {
  attempt?: OtpAttempt;
};

export async function apiRequest<T>(
  endpoint: string,
  options: ApiRequestOptions = {}
): Promise<ApiResponse<T>> {
  const {
    locale: localeOverride,
    phone,
    apiBase,
    bootstrap,
    requireSession,
    ...fetchOptions
  } = options;
  const deviceId = getDeviceId();

  const isFormData =
    typeof FormData !== 'undefined' && fetchOptions.body instanceof FormData;
  const headers: Record<string, string> = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    'X-Device-ID': deviceId,
  };

  if (fetchOptions.headers) {
    Object.assign(headers, fetchOptions.headers as Record<string, string>);
  }

  Object.assign(headers, getTmaClientHeaders());

  const languagePreference =
    localeOverride ??
    getActiveLanguagePreference(
      typeof window !== 'undefined' ? window.location.pathname : undefined
    );
  headers['Accept-Language'] = languagePreference;
  // TODO(KAZI-74): remove X-Locale after backend reads X-Language-Preference only
  headers['X-Language-Preference'] = languagePreference;
  headers['X-Locale'] = languagePreference;

  try {
    const response = await regionAwareApiClient.fetch(endpoint, {
      ...fetchOptions,
      headers,
      phone,
      apiBase,
      bootstrap,
      requireSession:
        requireSession ??
        (!phone && !apiBase && !bootstrap && Boolean(getAuthToken())),
    });

    if (response.status === 401) {
      clearAuthToken();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('kazi:session-expired'));
      }
      return { success: false, error: 'Session expired', status: 401 };
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const detail = errorData.detail;
      const detailMessage =
        typeof detail === 'object' && detail !== null
          ? (detail as { message?: string; error_code?: string }).message ??
            (detail as { error_code?: string }).error_code
          : typeof detail === 'string'
            ? detail
            : undefined;
      const errorCode =
        (typeof detail === 'object' && detail !== null
          ? (detail as { error_code?: string }).error_code
          : undefined) ??
        errorData.error_code ??
        (typeof errorData.error === 'string' ? errorData.error : undefined);
      const retryAfter = parseRetryAfterSeconds(
        response.headers.get('Retry-After')
      );

      // T12 — region-local 404: do not probe the other cluster.
      const regionMissingAccount =
        response.status === 404 &&
        (errorCode === 'USER_NOT_FOUND' ||
          errorCode === 'ACCOUNT_NOT_FOUND' ||
          errorCode === 'NOT_FOUND' ||
          /no account|没有账号|not found/i.test(String(detailMessage ?? '')));

      return {
        success: false,
        error: regionMissingAccount
          ? '此区域没有账号'
          : detailMessage ||
            errorData.message ||
            errorData.error ||
            errorData.error_code ||
            `HTTP ${response.status}`,
        errorCode: regionMissingAccount
          ? 'REGION_ACCOUNT_NOT_FOUND'
          : errorCode,
        status: response.status,
        ...(retryAfter != null ? { retryAfter } : {}),
      };
    }

    if (response.status === 204) {
      return { success: true, data: undefined as T };
    }
    const data = await response.json();
    return { success: true, data: data as T };
  } catch (err) {
    if (err instanceof RegionAccountFetchError) {
      clearAuthToken();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('kazi:session-expired'));
      }
      return {
        success: false,
        error: err.message,
        errorCode: err.code,
      };
    }
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Network error',
      errorCode: 'NETWORK_ERROR',
    };
  }
}

export async function requestOtp(phone: string): Promise<OtpRequestResult> {
  // Bounded wait for public directory refresh so first-click OTP is deterministic.
  await Promise.race([
    ensureDirectoryLoaded(),
    new Promise<void>((resolve) => setTimeout(resolve, 1500)),
  ]);

  const apiBase = regionAwareApiClient.selectLiveApiBase(phone);
  const attempt = createOtpAttempt({
    phone,
    api_base: apiBase,
    directory_version: BUNDLED_DIRECTORY.directory_version,
  });
  if (!attempt) {
    return {
      success: false,
      error: 'Unable to resolve OTP region host',
      errorCode: 'UNKNOWN_API_BASE',
    };
  }

  const res = await apiRequest<OtpRequestResponse>('/api/v1/auth/otp/request', {
    method: 'POST',
    body: JSON.stringify({ phone }),
    apiBase: attempt.api_base,
  });

  return { ...res, attempt: res.success ? attempt : undefined };
}

export async function verifyOtp(
  phone: string,
  code: string,
  attempt?: OtpAttempt | null
): Promise<ApiResponse<OtpVerifyResponse>> {
  let pinned: OtpAttempt;
  try {
    pinned = assertOtpAttempt(attempt, phone);
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Invalid OTP attempt',
      errorCode: 'INVALID_OTP_ATTEMPT',
    };
  }

  const res = await apiRequest<Record<string, unknown>>(
    '/api/v1/auth/otp/verify',
    {
      method: 'POST',
      body: JSON.stringify({ phone, code }),
      apiBase: pinned.api_base,
    }
  );

  if (!res.success || !res.data) {
    return {
      success: false,
      error: res.error,
      errorCode: res.errorCode,
      status: res.status,
    };
  }

  const raw = res.data;
  const token = (raw.access_token ?? raw.token) as string | undefined;
  if (!token) {
    return { success: false, error: 'Invalid login response' };
  }

  // Token was issued by the pinned OTP host — session home MUST stay there.
  // Do not jump to BE home_api_base / resolveHome when it differs (issuer mismatch).
  // Advertise-driven cutover happens on the *next* OTP attempt via selectLiveApiBase.
  const pinnedBase = pinned.api_base;
  const row = findRowByApiBase(pinnedBase);
  const beRegion =
    raw.data_region === 'cn-mainland' || raw.data_region === 'global'
      ? raw.data_region
      : null;
  const dataRegion =
    beRegion && row && beRegion === row.data_region
      ? beRegion
      : row?.data_region ?? 'global';

  const session = buildSessionFromVerify({
    token,
    home_api_base: pinnedBase,
    data_region: dataRegion,
    directory_version:
      typeof raw.directory_version === 'number'
        ? raw.directory_version
        : pinned.directory_version,
    fallbackHome: {
      api_base: pinnedBase,
      data_region: row?.data_region ?? 'global',
    },
  });

  if (!session) {
    clearAuthToken();
    return {
      success: false,
      error: 'Invalid region session from login response',
      errorCode: 'INVALID_REGION_SESSION',
    };
  }

  // Persist before any follow-up account call (getMe).
  setRegionAuthSession(session);

  const userRaw = (raw.user ?? {}) as Record<string, unknown>;
  return {
    success: true,
    data: {
      success: true,
      token,
      user: mapUserFromApi(userRaw),
      home_api_base: session.home_api_base,
      data_region: session.data_region,
      directory_version: session.directory_version,
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
  weekly_hours_budget?: number | null;
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
  // TMA stays on intl this ticket (webhook on intl) — bootstrap host.
  // Ignore BE home_api_base if it differs; TMA→CN needs a separate Story.
  const res = await apiRequest<TelegramWebappResponse>(
    '/api/v1/auth/telegram-miniapp',
    {
      method: 'POST',
      body: JSON.stringify({ init_data: initData }),
      bootstrap: true,
    }
  );

  if (!res.success || !res.data?.access_token) {
    return res;
  }

  const liveBase = bootstrapBase();
  const row = findRowByApiBase(liveBase);
  const session = buildSessionFromVerify({
    token: res.data.access_token,
    home_api_base: liveBase,
    data_region: row?.data_region ?? 'global',
    directory_version: BUNDLED_DIRECTORY.directory_version,
    fallbackHome: {
      api_base: liveBase,
      data_region: row?.data_region ?? 'global',
    },
  });

  if (!session) {
    clearAuthToken();
    return {
      success: false,
      error: 'Invalid region session from Telegram auth',
      errorCode: 'INVALID_REGION_SESSION',
    };
  }

  setRegionAuthSession(session);
  return res;
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
  /** KAZI-254 — persisted assistant row id for feedback attribution. */
  assistant_message_id?: string;
  routing?: Record<string, unknown>;
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
  text: string,
  locale?: string,
  options?: {
    routingMode?: 'clinic';
    routingVersion?: number;
    /** INV-P2 — abandon Current interactive before Clinic NL activates another. */
    confirmAbandon?: boolean;
    /** Payload-based next_action transport (KAZI-469). */
    actionMeta?: import('@/types/chat-envelope').UserMessageActionMeta;
  }
): Promise<ApiResponse<ClinicChatResponse>> {
  // API v2.10.6: routing.mode applies to POST /chat/messages (Clinic) only.
  // Hub expert chat uses POST /agents/chat with agent_id in the body — no routing.mode.
  const languagePreference =
    locale ??
    getActiveLanguagePreference(
      typeof window !== 'undefined' ? window.location.pathname : undefined
    );
  const headers: Record<string, string> = {};
  if (options?.routingVersion != null) {
    headers['X-Kazi-Routing-Version'] = String(options.routingVersion);
  }
  return apiRequest<ClinicChatResponse>('/api/v1/chat/messages', {
    method: 'POST',
    ...(Object.keys(headers).length > 0 ? { headers } : {}),
    body: JSON.stringify({
      session_id: sessionId,
      content: text,
      // TODO(KAZI-74): remove locale after backend reads language_preference only
      locale: languagePreference,
      language_preference: languagePreference,
      ...(options?.routingMode
        ? { routing: { mode: options.routingMode } }
        : {}),
      ...(options?.confirmAbandon ? { confirm_abandon: true } : {}),
      ...(options?.actionMeta ? { meta: options.actionMeta } : {}),
    }),
  });
}

export async function fetchChatHistory(
  sessionId: string,
  options?: {
    signal?: AbortSignal;
    limit?: number;
    fields?: 'full' | 'ids';
    ids?: string;
    before?: string;
  }
): Promise<ApiResponse<{ messages: ChatMessage[] } | ChatMessage[]>> {
  const query = windowedHistoryQuery({
    limit: options?.limit,
    fields: options?.fields,
    ids: options?.ids,
    before: options?.before,
  });
  return apiRequest(
    `/api/v1/chat/sessions/${sessionId}/messages${buildChatHistoryQuery(query)}`,
    { signal: options?.signal }
  );
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

/** Extract clinic/agent reply fields; `reply` may be empty — callers must validate. */
export function parseClinicReply(data: ClinicChatResponse | undefined): {
  reply: string;
  intent?: string;
  referral?: { agentId: string; reason: string };
  spaceNudge?: SpaceNudgePayload;
  nextActions: ChatNextAction[];
  cards: ChatJobCard[];
  citations?: import('@/lib/clinic/citation-list').CitationItem[];
  upgradeCta?: import('@/lib/clinic/upgrade-cta').UpgradeCtaPayload;
  capabilityId?: import('@/lib/clinic/search-capability').SearchCapabilityId;
  playbookId?: string | null;
  assistantMeta?: Record<string, unknown>;
  customComponents?: import('@/types/english-tutor-envelope').EnglishTutorEnvelopeComponent[];
  routedToAgent?: { agentId: string; sessionId?: string };
  assistantMessageId?: string;
} {
  if (!data) {
    return { reply: '', nextActions: [], cards: [] };
  }

  const envelope = parseAssistantEnvelope(data);

  let reply = envelope.reply.trim();
  if (isPlaceholderReply(reply)) {
    reply = resolveSpaceTurnReply(data);
  }

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

  let spaceNudge: SpaceNudgePayload | undefined;
  if (isSpacesEnabled()) {
    const extracted = extractSpaceNudge(data, getActiveLanguagePreference());
    if (extracted && !isSpaceNudgeDismissed(extracted.templateId)) {
      spaceNudge = extracted;
    }
  }

  const assistantMessageId = extractAssistantMessageId(data);

  return {
    reply,
    intent: data.intent ?? envelope.intent,
    referral,
    ...(spaceNudge ? { spaceNudge } : {}),
    nextActions: envelope.nextActions,
    cards: envelope.cards,
    ...(envelope.citations?.length ? { citations: envelope.citations } : {}),
    ...(envelope.upgradeCta ? { upgradeCta: envelope.upgradeCta } : {}),
    ...(envelope.capabilityId ? { capabilityId: envelope.capabilityId } : {}),
    ...(envelope.playbookId !== undefined
      ? { playbookId: envelope.playbookId }
      : {}),
    ...(envelope.meta && Object.keys(envelope.meta).length > 0
      ? { assistantMeta: envelope.meta }
      : {}),
    ...(envelope.customComponents && envelope.customComponents.length > 0
      ? { customComponents: envelope.customComponents }
      : {}),
    routedToAgent,
    ...(assistantMessageId ? { assistantMessageId } : {}),
  };
}
