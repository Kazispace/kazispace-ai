import {
  API_BASE,
  FIXTURE_A_OTP,
  FIXTURE_A_PHONE,
  LOCALE,
} from './env';

export type StagingSession = {
  token: string;
  home_api_base: string;
  data_region: 'global' | 'cn-mainland';
  directory_version: number;
  user: Record<string, unknown>;
  phone: string;
};

let cached: StagingSession | null = null;
let lastOtpAt = 0;

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

/**
 * OTP login via API (deploy.md §2.2). Reuses one token per process to avoid
 * OTP retry_after_seconds (usually 60s) when many specs need auth.
 */
export async function loginFixtureA(): Promise<StagingSession> {
  if (cached) return cached;

  const since = Date.now() - lastOtpAt;
  if (lastOtpAt > 0 && since < 65_000) {
    await sleep(65_000 - since);
  }

  const requestRes = await fetch(`${API_BASE}/api/v1/auth/otp/request`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: FIXTURE_A_PHONE }),
  });
  const requestBody = (await requestRes.json()) as {
    otp_request_id?: number;
    _mock_code?: string;
    retry_after_seconds?: number;
    message?: string;
    error?: string;
  };
  if (!requestRes.ok) {
    throw new Error(
      `OTP request failed (${requestRes.status}): ${JSON.stringify(requestBody)}`
    );
  }
  lastOtpAt = Date.now();

  const otp =
    requestBody._mock_code ??
    FIXTURE_A_OTP;
  const verifyRes = await fetch(`${API_BASE}/api/v1/auth/otp/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      phone: FIXTURE_A_PHONE,
      otp_code: otp,
      otp_request_id: requestBody.otp_request_id,
      locale: LOCALE,
      country: 'CN',
    }),
  });
  const verifyBody = (await verifyRes.json()) as {
    access_token?: string;
    home_api_base?: string;
    data_region?: string;
    directory_version?: number;
    user?: Record<string, unknown>;
    message?: string;
  };
  if (!verifyRes.ok || !verifyBody.access_token) {
    throw new Error(
      `OTP verify failed (${verifyRes.status}): ${JSON.stringify(verifyBody)}`
    );
  }

  const token = verifyBody.access_token;
  const meRes = await fetch(`${API_BASE}/api/v1/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const meBody = (await meRes.json()) as Record<string, unknown>;
  if (!meRes.ok) {
    throw new Error(`GET /me failed (${meRes.status}): ${JSON.stringify(meBody)}`);
  }

  const dataRegion =
    verifyBody.data_region === 'cn-mainland' ? 'cn-mainland' : 'global';
  const home =
    typeof verifyBody.home_api_base === 'string' && verifyBody.home_api_base
      ? verifyBody.home_api_base.replace(/\/+$/, '')
      : API_BASE;

  cached = {
    token,
    home_api_base: home,
    data_region: dataRegion,
    directory_version:
      typeof verifyBody.directory_version === 'number'
        ? verifyBody.directory_version
        : 4,
    user: mapMeToFrontendUser(meBody, FIXTURE_A_PHONE),
    phone: FIXTURE_A_PHONE,
  };
  return cached;
}

function mapMeToFrontendUser(
  raw: Record<string, unknown>,
  phone: string
): Record<string, unknown> {
  const profile = (raw.profile ?? {}) as Record<string, unknown>;
  const userId = raw.user_id ?? raw.id ?? '';
  return {
    id: String(userId),
    displayName: String(
      raw.display_name ?? profile.display_name ?? `User ${userId}`
    ),
    phone,
    country: (raw.primary_country ?? profile.country) as string | undefined,
    primaryLocale: (raw.primary_locale ?? profile.primary_locale ?? 'zh') as
      | string
      | undefined,
    createdAt: String(raw.first_value_at ?? raw.created_at ?? ''),
    updatedAt: String(raw.hook_state_updated_at ?? raw.updated_at ?? ''),
  };
}
