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
  require_same_origin: boolean;
  trusted_client_ip_header: string;
  max_buckets: number;
  bucket_ttl_seconds: number;
};

export const RUM_INGEST_POLICY: RumIngestPolicy = ingestPolicyJson;

const UNKNOWN_KEY = 'unknown';

type Bucket = { tokens: number; updatedAt: number; lastSeen: number };

const buckets = new Map<string, Bucket>();

export function resetRumIngestLimiterForTests(): void {
  buckets.clear();
}

export function rumIngestBucketCountForTests(): number {
  return buckets.size;
}

function isIpLiteral(value: string): boolean {
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(value)) {
    return value.split('.').every((octet) => Number(octet) <= 255);
  }
  if (value.includes(':') && /^[0-9a-fA-F:]+$/.test(value) && value.length <= 45) {
    return true;
  }
  return false;
}

/**
 * Only the proxy-injected trusted header. Client XFF / X-Real-IP are ignored.
 * Missing or non-IP values share the fixed `unknown` bucket.
 */
export function rumClientKey(request: Request): string {
  const header = RUM_INGEST_POLICY.trusted_client_ip_header;
  const raw = request.headers.get(header)?.trim() ?? '';
  if (raw && isIpLiteral(raw)) return raw;
  return UNKNOWN_KEY;
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

function requestHost(request: Request): string {
  try {
    return new URL(request.url).host;
  } catch {
    return request.headers.get('host') ?? '';
  }
}

function hostOf(raw: string | null): string | null {
  if (!raw) return null;
  try {
    return new URL(raw).host;
  } catch {
    return null;
  }
}

/** Exact same-origin only. `same-site` sibling hosts are rejected. */
export function isSameOriginRumRequest(request: Request): boolean {
  const site = request.headers.get('sec-fetch-site');
  if (site === 'same-origin') return true;
  if (site && site !== 'none') return false;

  const expected = requestHost(request);
  if (!expected) return false;
  const originHost = hostOf(request.headers.get('origin'));
  if (originHost) return originHost === expected;
  const refererHost = hostOf(request.headers.get('referer'));
  if (refererHost) return refererHost === expected;
  return false;
}

function sweepExpired(now: number, policy: RumIngestPolicy): void {
  const ttlMs = policy.bucket_ttl_seconds * 1000;
  for (const [key, bucket] of buckets) {
    if (now - bucket.lastSeen > ttlMs) buckets.delete(key);
  }
}

export function allowRumIngest(
  key: string,
  now: number = Date.now(),
  policy: RumIngestPolicy = RUM_INGEST_POLICY
): boolean {
  sweepExpired(now, policy);
  const { points, period_seconds, burst } = policy.rate;
  const refillPerMs = points / (period_seconds * 1000);
  let bucket = buckets.get(key);
  if (!bucket) {
    if (buckets.size >= policy.max_buckets) return false;
    bucket = { tokens: burst, updatedAt: now, lastSeen: now };
    buckets.set(key, bucket);
  }
  const elapsed = Math.max(0, now - bucket.updatedAt);
  bucket.tokens = Math.min(burst, bucket.tokens + elapsed * refillPerMs);
  bucket.updatedAt = now;
  bucket.lastSeen = now;
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
