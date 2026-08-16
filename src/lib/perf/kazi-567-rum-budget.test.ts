import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';

import { PUBLIC_CLINIC_FIRST_JS_DECODED_BYTES, RUM_METRIC_NAMES } from '@/lib/perf/budgets';
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
});
