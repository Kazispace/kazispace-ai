/**
 * KAZI-567 Intl rum_ingest (Netlify Edge).
 * Platform rate limit + trusted client IP. Strips client XFF / X-Real-IP.
 * Numbers must match src/lib/perf/rum-ingest-policy.json.
 */
export default async (request, context) => {
  const headers = new Headers(request.headers);
  headers.delete('x-forwarded-for');
  headers.delete('x-real-ip');
  headers.set('x-rum-client-ip', context.ip || 'unknown');
  return context.next(new Request(request, { headers }));
};

export const config = {
  path: '/api/rum',
  method: 'POST',
  rateLimit: {
    windowLimit: 30,
    windowSize: 60,
    aggregateBy: ['ip', 'domain'],
  },
};
