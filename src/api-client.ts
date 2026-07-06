const DEFAULT_BASE = 'https://bot.kazispace.ai';

export function getApiBase(): string {
  return process.env.KAZI_API_BASE_URL?.trim() || DEFAULT_BASE;
}

export function getOtpMockCode(): string {
  return process.env.KAZI_OTP_MOCK_CODE?.trim() || '123456';
}

export async function apiFetch<T = unknown>(
  path: string,
  options: {
    method?: string;
    token?: string;
    deviceId: string;
    body?: unknown;
  }
): Promise<{ ok: boolean; status: number; data?: T; error?: string; latencyMs: number }> {
  const started = Date.now();
  const url = `${getApiBase()}${path}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Device-ID': options.deviceId,
  };
  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }

  try {
    const response = await fetch(url, {
      method: options.method ?? 'GET',
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
    const latencyMs = Date.now() - started;
    const text = await response.text();
    let data: T | undefined;
    try {
      data = text ? (JSON.parse(text) as T) : undefined;
    } catch {
      data = undefined;
    }

    if (!response.ok) {
      const errObj = data as { detail?: { message?: string } | string; message?: string } | undefined;
      const detail = errObj?.detail;
      const message =
        (typeof detail === 'object' && detail?.message) ||
        (typeof detail === 'string' ? detail : undefined) ||
        errObj?.message ||
        text.slice(0, 200) ||
        `HTTP ${response.status}`;
      return { ok: false, status: response.status, error: message, latencyMs, data };
    }

    return { ok: true, status: response.status, data, latencyMs };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      error: err instanceof Error ? err.message : 'Network error',
      latencyMs: Date.now() - started,
    };
  }
}

export function extractCvMarkdown(data: Record<string, unknown> | undefined): string | null {
  if (!data) return null;
  const response = data.response as Record<string, unknown> | undefined;
  const responseMeta = response?.meta as Record<string, unknown> | undefined;
  const topMeta = data.meta as Record<string, unknown> | undefined;
  const merged = { ...responseMeta, ...topMeta };
  const markdown =
    (typeof merged.cv_preview_markdown === 'string' && merged.cv_preview_markdown) ||
    (typeof merged.cv_content === 'string' && merged.cv_content) ||
    (typeof data.cv_content === 'string' && data.cv_content) ||
    null;
  return markdown;
}

export function extractPipelineState(data: Record<string, unknown> | undefined): string | null {
  if (!data) return null;
  const nested = data.response as Record<string, unknown> | undefined;
  const meta = (nested?.meta ?? data.meta) as Record<string, unknown> | undefined;
  const state = meta?.pipeline_state;
  return typeof state === 'string' ? state : null;
}

export function extractSessionId(data: Record<string, unknown> | undefined): string | undefined {
  if (!data) return undefined;
  const sid = data.session_id ?? data.cv_session_id;
  return typeof sid === 'string' ? sid : undefined;
}
