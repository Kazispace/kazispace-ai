import ingestPolicyJson from './rum-ingest-policy.json';

export type RumIngestPolicy = {
  schema_version: string;
  path: string;
  methods: string[];
  max_body_bytes: number;
  rate: {
    points: number;
    period_seconds: number;
    burst: number;
  };
  same_site: boolean;
  require_same_origin: boolean;
};

export const RUM_INGEST_POLICY: RumIngestPolicy = ingestPolicyJson;

const buckets = new Map<string, { tokens: number; updatedAt: number }>();

export function resetRumIngestLimiterForTests(): void {
  buckets.clear();
}

export function rumClientKey(request: Request): string {
  const nf = request.headers.get('x-nf-client-connection-ip')?.trim();
  if (nf) return nf;
  const real = request.headers.get('x-real-ip')?.trim();
  if (real) return real;
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  return 'unknown';
}

export function declaredContentLength(request: Request): number | null {
  const raw = request.headers.get('content-length');
  if (raw == null || raw === '') return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return Number.POSITIVE_INFINITY;
  return n;
}

export function rejectOversizedContentLength(
  request: Request,
  maxBytes: number = RUM_INGEST_POLICY.max_body_bytes
): boolean {
  const length = declaredContentLength(request);
  return length != null && length > maxBytes;
}

export function isSameOriginRumRequest(request: Request): boolean {
  const site = request.headers.get('sec-fetch-site');
  if (site === 'same-origin' || site === 'same-site') return true;

  let expectedHost = '';
  try {
    expectedHost = new URL(request.url).host;
  } catch {
    expectedHost = request.headers.get('host') ?? '';
  }
  if (!expectedHost) return false;

  const origin = request.headers.get('origin');
  if (origin) {
    try {
      return new URL(origin).host === expectedHost;
    } catch {
      return false;
    }
  }

  const referer = request.headers.get('referer');
  if (referer) {
    try {
      return new URL(referer).host === expectedHost;
    } catch {
      return false;
    }
  }

  return false;
}

export function allowRumIngest(
  key: string,
  now: number = Date.now(),
  policy: RumIngestPolicy = RUM_INGEST_POLICY
): boolean {
  const { points, period_seconds, burst } = policy.rate;
  const refillPerMs = points / (period_seconds * 1000);
  let bucket = buckets.get(key);
  if (!bucket) {
    bucket = { tokens: burst, updatedAt: now };
    buckets.set(key, bucket);
  }
  const elapsed = Math.max(0, now - bucket.updatedAt);
  bucket.tokens = Math.min(burst, bucket.tokens + elapsed * refillPerMs);
  bucket.updatedAt = now;
  if (bucket.tokens < 1) return false;
  bucket.tokens -= 1;
  return true;
}

export async function readBodyCapped(
  request: Request,
  maxBytes: number = RUM_INGEST_POLICY.max_body_bytes
): Promise<{ ok: true; text: string } | { ok: false; reason: 'too-large' }> {
  if (rejectOversizedContentLength(request, maxBytes)) {
    return { ok: false, reason: 'too-large' };
  }

  const reader = request.body?.getReader();
  if (!reader) {
    return { ok: true, text: '' };
  }

  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      return { ok: false, reason: 'too-large' };
    }
    chunks.push(value);
  }

  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { ok: true, text: new TextDecoder().decode(merged) };
}
