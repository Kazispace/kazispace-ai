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
} from '@/lib/perf/rum-ingest';
import {
  RUM_REGION_POLICY,
  isAllowedRumEndpoint,
  resolveRumClientPolicy,
  shouldSampleRum,
} from '@/lib/region/rum-policy';

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

  it('same-origin ingest accepts Sec-Fetch-Site and matching Origin', () => {
    expect(
      isSameOriginRumRequest(
        new Request('http://localhost/api/rum', {
          headers: { 'sec-fetch-site': 'same-origin' },
        })
      )
    ).toBe(true);
    expect(
      isSameOriginRumRequest(
        rumPost({ headers: { origin: 'https://other.example' } })
      )
    ).toBe(false);
  });

  it('CN / missing region default-off; intl guest default-on', () => {
    expect(resolveRumClientPolicy(null)).toMatchObject({
      region_id: 'us-west',
      enabled: true,
      endpoint: '/api/rum',
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

  it('deploy ingest policy is the single rate/body authority', () => {
    const nginx = readRel('../deploy/rum-ingest.nginx.conf');
    const netlify = readRel('../netlify.toml');
    expect(RUM_INGEST_POLICY.max_body_bytes).toBe(2048);
    expect(RUM_INGEST_POLICY.rate).toEqual({
      points: 30,
      period_seconds: 60,
      burst: 10,
    });
    expect(nginx).toMatch(/client_max_body_size 2k/);
    expect(nginx).toMatch(/rate=30r\/m/);
    expect(nginx).toMatch(/burst=10/);
    expect(netlify).toMatch(/rum-ingest-policy\.json/);
    expect(RUM_REGION_POLICY.fail_closed).toBe(true);
    expect(RUM_REGION_POLICY.by_region_id['cn-chengdu']?.enabled).toBe(false);
    expect(RUM_REGION_POLICY.by_region_id['us-west']?.enabled).toBe(true);
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
