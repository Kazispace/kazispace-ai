import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';

import { POST } from '@/app/api/rum/route';
import { PUBLIC_CLINIC_FIRST_JS_DECODED_BYTES, RUM_METRIC_NAMES } from '@/lib/perf/budgets';
import { resetRumIngestLimiterForTests } from '@/lib/perf/rum-ingest';
import { sanitizeRumEvent } from '@/lib/perf/rum';

describe('KAZI-567 RUM + budget gates', () => {
  it('accepts a valid LCP event and rejects junk', () => {
    expect(
      sanitizeRumEvent({
        name: 'LCP',
        value: 1200,
        rating: 'good',
        id: 'v4-lcp',
        route: '/en/chat',
        session: 'rum_abc',
      })
    ).toMatchObject({ name: 'LCP', value: 1200, route: '/en/chat' });

    expect(
      sanitizeRumEvent({ name: 'LCP', value: -1, rating: 'good', id: 'x', route: '/en' })
    ).toBeNull();
    expect(
      sanitizeRumEvent({ name: 'HACK', value: 1, rating: 'good', id: 'x', route: '/en' })
    ).toBeNull();
    expect(
      sanitizeRumEvent({ name: 'CLS', value: 0.01, rating: 'good', id: 'x', route: 'not-a-path' })
    ).toBeNull();
  });

  it('covers the audit metric set', () => {
    expect(RUM_METRIC_NAMES).toEqual(
      expect.arrayContaining(['LCP', 'INP', 'CLS', 'route-transition'])
    );
    expect(PUBLIC_CLINIC_FIRST_JS_DECODED_BYTES).toBe(1_200_000);
  });

  it('locale layout mounts WebVitalsReporter', () => {
    const src = readFileSync(
      path.resolve(__dirname, '../../app/[locale]/layout.tsx'),
      'utf8'
    );
    expect(src).toMatch(/WebVitalsReporter/);
  });

  it('keeps space request-count regression tests (562/563)', () => {
    const send = readFileSync(
      path.resolve(__dirname, '../spaces/space-send-history.test.ts'),
      'utf8'
    );
    const detail = readFileSync(
      path.resolve(__dirname, '../../hooks/kazi-562-space-data-plane.test.ts'),
      'utf8'
    );
    expect(send).toMatch(/0 history fetches/);
    expect(detail).toMatch(/dedupes concurrent history/);
  });

  it('accepts a sanitized RUM POST and rejects junk', async () => {
    resetRumIngestLimiterForTests();
    const log = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const headers = {
      origin: 'http://localhost',
      'content-type': 'application/json',
    };
    const ok = await POST(
      new Request('http://localhost/api/rum', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          name: 'INP',
          value: 80,
          rating: 'good',
          id: 'v4-inp',
          route: '/en/chat',
          session: 'rum_abc',
        }),
      })
    );
    expect(ok.status).toBe(204);
    expect(log).toHaveBeenCalled();

    const bad = await POST(
      new Request('http://localhost/api/rum', {
        method: 'POST',
        headers,
        body: JSON.stringify({ name: 'HACK', value: 1 }),
      })
    );
    expect(bad.status).toBe(400);
    log.mockRestore();
  });

  it('scopes the CI budget to public Clinic first-load pages', () => {
    const src = readFileSync(
      path.resolve(__dirname, '../../../scripts/check-clinic-js-budget.mjs'),
      'utf8'
    );
    expect(src).toMatch(/isClinicFirstLoadPage/);
    expect(src).toMatch(/\(workspace\)\/chat/);
    expect(src).toMatch(/PUBLIC_CLINIC_FIRST_JS_DECODED_BYTES = 1_200_000/);
  });

  it('registers web-vitals observers once', () => {
    const src = readFileSync(
      path.resolve(__dirname, '../../components/perf/web-vitals-reporter.tsx'),
      'utf8'
    );
    expect(src).toMatch(/onLCP\(report\)/);
    expect(src).toMatch(/Register once/);
    const afterOnLcp = src.slice(src.indexOf('onLCP(report)'));
    const observerBlock = afterOnLcp.slice(0, afterOnLcp.indexOf('useEffect'));
    expect(observerBlock).toMatch(/\},\s*\[\]\);/);
    expect(observerBlock).not.toMatch(/\[pathname\]/);
  });
});
