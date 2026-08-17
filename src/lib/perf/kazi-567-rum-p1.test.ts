import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';

import { POST } from '@/app/api/rum/route';
import {
  RUM_INGEST_POLICY,
  allowRumIngest,
  isSameOriginRumRequest,
  readBodyCapped,
  rejectOversizedContentLength,
  resetRumIngestLimiterForTests,
  rumClientKey,
  rumIngestBucketCountForTests,
} from '@/lib/perf/rum-ingest';
import {
  RUM_REGION_POLICY,
  isAllowedRumEndpoint,
  resolveRumClientPolicy,
  shouldSampleRum,
} from '@/lib/region/rum-policy';
import rumIngest, {
  config as rumIngestEdgeConfig,
} from '../../../netlify/edge-functions/rum-ingest.js';

const root = path.resolve(__dirname, '../..');

function readRel(rel: string): string {
  return readFileSync(path.join(root, rel), 'utf8');
}

const validEvent = {
  name: 'INP',
  value: 80,
  rating: 'good',
  id: 'v4-inp',
  route: '/en/chat',
  session: 'rum_abc',
};

function rumPost(init?: {
  body?: BodyInit | null;
  headers?: Record<string, string>;
  url?: string;
}): Request {
  return new Request(init?.url ?? 'http://localhost/api/rum', {
    method: 'POST',
    headers: {
      origin: 'http://localhost',
      'content-type': 'application/json',
      ...init?.headers,
    },
    body: init?.body ?? JSON.stringify(validEvent),
  });
}

describe('KAZI-567 P1 rum ingest + region contract', () => {
  beforeEach(() => {
    resetRumIngestLimiterForTests();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.NEXT_PUBLIC_RUM_ENABLED;
  });

  it('rejects declared oversized Content-Length before reading', () => {
    const request = {
      headers: new Headers({ 'content-length': '99999' }),
    } as Request;
    expect(rejectOversizedContentLength(request)).toBe(true);
  });

  it('caps streamed bodies over the ingest max', async () => {
    const oversized = 'a'.repeat(RUM_INGEST_POLICY.max_body_bytes + 8);
    const result = await readBodyCapped(
      rumPost({
        headers: { origin: 'http://localhost' },
        body: oversized,
      })
    );
    expect(result).toEqual({ ok: false, reason: 'too-large' });
  });

  it('POST: 413 oversized, 403 cross-site, 429 after burst, 204 same-origin', async () => {
    const log = vi.spyOn(console, 'info').mockImplementation(() => undefined);

    const tooBig = await POST(
      rumPost({ body: 'a'.repeat(RUM_INGEST_POLICY.max_body_bytes + 8) })
    );
    expect(tooBig.status).toBe(413);

    const crossSite = await POST(
      rumPost({
        headers: { origin: 'https://evil.example' },
      })
    );
    expect(crossSite.status).toBe(403);

    resetRumIngestLimiterForTests();
    for (let i = 0; i < RUM_INGEST_POLICY.rate.burst; i += 1) {
      const ok = await POST(rumPost());
      expect(ok.status).toBe(204);
    }
    const limited = await POST(rumPost());
    expect(limited.status).toBe(429);

    const logged = JSON.parse(String(log.mock.calls[0][0]));
    expect(Object.keys(logged).sort()).toEqual(
      ['name', 'rating', 'route', 'session', 'type', 'value'].sort()
    );
    expect(logged.type).toBe('rum');
    log.mockRestore();
  });

  it('token bucket matches ingest policy burst', () => {
    const key = '10.0.0.1';
    const now = 1_000_000;
    for (let i = 0; i < RUM_INGEST_POLICY.rate.burst; i += 1) {
      expect(allowRumIngest(key, now)).toBe(true);
    }
    expect(allowRumIngest(key, now)).toBe(false);
  });

  it('same-origin ingest requires exact origin, not same-site', () => {
    expect(
      isSameOriginRumRequest(
        new Request('http://localhost/api/rum', {
          headers: { 'sec-fetch-site': 'same-origin' },
        })
      )
    ).toBe(true);
    expect(
      isSameOriginRumRequest(
        new Request('http://localhost/api/rum', {
          headers: { 'sec-fetch-site': 'same-site' },
        })
      )
    ).toBe(false);
    expect(
      isSameOriginRumRequest(
        rumPost({ headers: { origin: 'https://other.example' } })
      )
    ).toBe(false);
    expect(isSameOriginRumRequest(rumPost())).toBe(true);
  });

  it('missing / unknown region default-off; known intl session can enable', () => {
    expect(resolveRumClientPolicy(null)).toMatchObject({
      region_id: null,
      enabled: false,
    });

    expect(
      resolveRumClientPolicy({
        token: 't',
        home_api_base: 'https://api-cn.kazispace.ai',
        data_region: 'cn-mainland',
        directory_version: 4,
      })
    ).toMatchObject({
      region_id: 'cn-chengdu',
      enabled: false,
      endpoint: '',
    });

    expect(
      resolveRumClientPolicy({
        token: 't',
        home_api_base: 'https://unknown.example',
        data_region: 'global',
        directory_version: 4,
      })
    ).toMatchObject({ enabled: false, region_id: null });

    expect(
      resolveRumClientPolicy({
        token: 't',
        home_api_base: 'https://bot.kazispace.ai',
        data_region: 'global',
        directory_version: 4,
      })
    ).toMatchObject({
      region_id: 'us-west',
      enabled: true,
      endpoint: '/api/rum',
    });
  });

  it('ignores client XFF / X-Real-IP; only trusted proxy header is a key', () => {
    const spoofed = rumPost({
      headers: {
        'x-forwarded-for': '203.0.113.9',
        'x-real-ip': '198.51.100.7',
      },
    });
    expect(rumClientKey(spoofed)).toBe('unknown');

    const trusted = rumPost({
      headers: {
        'x-forwarded-for': '203.0.113.9',
        'x-rum-client-ip': '203.0.113.10',
      },
    });
    expect(rumClientKey(trusted)).toBe('203.0.113.10');
  });

  it('does not for-of iterate the bucket Map (Next typecheck target)', () => {
    const src = readRel('lib/perf/rum-ingest.ts');
    expect(src).toMatch(/buckets\.forEach\(/);
    expect(src).not.toMatch(/for \(const \[key, bucket\] of buckets\)/);
  });

  it('bounds the in-process bucket map (TTL + max, fail-closed)', () => {
    const now = 1_000_000;
    const tiny = {
      ...RUM_INGEST_POLICY,
      max_buckets: 2,
      bucket_ttl_seconds: 1,
    };
    expect(allowRumIngest('10.0.0.1', now, tiny)).toBe(true);
    expect(allowRumIngest('10.0.0.2', now, tiny)).toBe(true);
    expect(allowRumIngest('10.0.0.3', now, tiny)).toBe(false);
    expect(rumIngestBucketCountForTests()).toBe(2);

    expect(allowRumIngest('10.0.0.1', now + 2_000, tiny)).toBe(true);
    expect(rumIngestBucketCountForTests()).toBeLessThanOrEqual(2);
  });

  it('env can only force RUM off, not enable an undeclared CN endpoint', () => {
    process.env.NEXT_PUBLIC_RUM_ENABLED = '0';
    expect(resolveRumClientPolicy(null).enabled).toBe(false);

    process.env.NEXT_PUBLIC_RUM_ENABLED = '1';
    expect(
      resolveRumClientPolicy({
        token: 't',
        home_api_base: 'https://api-cn.kazispace.ai',
        data_region: 'cn-mainland',
        directory_version: 4,
      }).enabled
    ).toBe(false);
  });

  it('sample_rate 0 is off; 1 is on; fractional uses rng', () => {
    expect(shouldSampleRum(0)).toBe(false);
    expect(shouldSampleRum(1)).toBe(true);
    expect(shouldSampleRum(0.2, () => 0.9)).toBe(false);
    expect(shouldSampleRum(0.2, () => 0.1)).toBe(true);
  });

  it('only same-origin /api/rum or https …/api/rum endpoints are allowed', () => {
    expect(isAllowedRumEndpoint('/api/rum')).toBe(true);
    expect(isAllowedRumEndpoint('https://rum.cn.example/api/rum')).toBe(true);
    expect(isAllowedRumEndpoint('https://evil.example/hack')).toBe(false);
    expect(isAllowedRumEndpoint('http://localhost/api/rum')).toBe(false);
  });

  it('deploy ingest policy is wired on public-edge and Netlify', () => {
    const edgeNginx = readRel('../deploy/public-edge/nginx.conf');
    const rumNginx = readRel('../deploy/public-edge/rum-ingest.conf');
    const netlify = readRel('../netlify.toml');
    const edgeFn = readRel('../netlify/edge-functions/rum-ingest.js');
    expect(RUM_INGEST_POLICY.max_body_bytes).toBe(2048);
    expect(RUM_INGEST_POLICY.rate).toEqual({
      points: 30,
      period_seconds: 60,
      burst: 10,
    });
    expect(RUM_INGEST_POLICY.require_same_origin).toBe(true);
    expect(RUM_INGEST_POLICY.trusted_client_ip_header).toBe('x-rum-client-ip');
    expect(edgeNginx).toMatch(/include rum-ingest\.conf/);
    expect(rumNginx).toMatch(/client_max_body_size 2k/);
    expect(rumNginx).toMatch(/rate=30r\/m/);
    expect(rumNginx).toMatch(/burst=10/);
    expect(rumNginx).toMatch(/X-Rum-Client-Ip \$remote_addr/);
    expect(rumNginx).toMatch(/proxy_set_header X-Forwarded-For ""/);
    expect(netlify).toMatch(/function = "rum-ingest"/);
    expect(netlify).toMatch(/path = "\/api\/rum"/);
    expect(edgeFn).toMatch(/context\.next\(new Request\(/);
    expect(edgeFn).not.toMatch(/context\.next\(\s*\{\s*request:/);
    expect(RUM_REGION_POLICY.fail_closed).toBe(true);
    expect(RUM_REGION_POLICY.by_region_id['cn-chengdu']?.enabled).toBe(false);
    expect(RUM_REGION_POLICY.by_region_id['us-west']?.enabled).toBe(true);
  });

  it('Netlify edge handler forwards a Request with trusted IP', async () => {
    const next = vi.fn(async () => new Response(null, { status: 204 }));
    const request = new Request('https://kazispace.ai/api/rum', {
      method: 'POST',
      headers: {
        origin: 'https://kazispace.ai',
        'x-forwarded-for': '203.0.113.9',
        'x-real-ip': '198.51.100.7',
      },
      body: '{}',
    });

    await rumIngest(request, { ip: '203.0.113.10', next });

    expect(next).toHaveBeenCalledTimes(1);
    const forwarded = next.mock.calls[0][0];
    expect(forwarded).toBeInstanceOf(Request);
    expect(next.mock.calls[0][1]).toBeUndefined();
    expect(forwarded.headers.get('x-rum-client-ip')).toBe('203.0.113.10');
    expect(forwarded.headers.get('x-forwarded-for')).toBeNull();
    expect(forwarded.headers.get('x-real-ip')).toBeNull();
    expect(rumIngestEdgeConfig.rateLimit).toEqual({
      windowLimit: 30,
      windowSize: 60,
      aggregateBy: ['ip', 'domain'],
    });
  });

  it('RUM leaves do not import the region barrel or yaml', () => {
    const policy = readRel('lib/region/rum-policy.ts');
    const reporter = readRel('components/perf/web-vitals-reporter.tsx');
    const rum = readRel('lib/perf/rum.ts');
    expect(policy).not.toMatch(/from ['"]@\/lib\/region['"]/);
    expect(policy).not.toMatch(/from ['"]yaml['"]/);
    expect(reporter).toMatch(/resolveRumClientPolicy/);
    expect(reporter).toMatch(/@\/lib\/region\/rum-policy/);
    expect(rum).toMatch(/resolveRumClientPolicy/);
    expect(reporter + rum + policy).not.toMatch(/data_region === ['"]cn/);
  });
});
