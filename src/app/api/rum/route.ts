import { NextResponse } from 'next/server';

import {
  RUM_INGEST_POLICY,
  allowRumIngest,
  isSameOriginRumRequest,
  readBodyCapped,
  rumClientKey,
} from '@/lib/perf/rum-ingest';
import { sanitizeRumEvent } from '@/lib/perf/rum';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * First-party RUM intake (KAZI-567).
 * Fail-closed ingest: Content-Length + capped read, same-origin, token bucket.
 * No PII. 204 on success. Does not replace Langfuse LLM traces.
 */
export async function POST(request: Request) {
  if (!RUM_INGEST_POLICY.methods.includes('POST')) {
    return NextResponse.json({ error: 'method not allowed' }, { status: 405 });
  }
  if (
    RUM_INGEST_POLICY.require_same_origin &&
    !isSameOriginRumRequest(request)
  ) {
    return NextResponse.json({ error: 'origin required' }, { status: 403 });
  }
  if (!allowRumIngest(rumClientKey(request))) {
    return NextResponse.json({ error: 'rate limited' }, { status: 429 });
  }

  const body = await readBodyCapped(request);
  if (!body.ok) {
    return NextResponse.json({ error: 'payload too large' }, { status: 413 });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(body.text);
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }
  const event = sanitizeRumEvent(parsed);
  if (!event) {
    return NextResponse.json({ error: 'invalid rum event' }, { status: 400 });
  }
  // Structured, no-PII line for first-party 对账 (route + session + metric).
  console.info(
    JSON.stringify({
      type: 'rum',
      name: event.name,
      value: event.value,
      rating: event.rating,
      route: event.route,
      session: event.session ?? null,
    })
  );
  return new NextResponse(null, { status: 204 });
}
