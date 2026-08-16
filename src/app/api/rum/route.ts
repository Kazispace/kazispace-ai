import { NextResponse } from 'next/server';

import { sanitizeRumEvent } from '@/lib/perf/rum';

/**
 * First-party RUM intake (KAZI-567).
 * Accepts web-vitals + route-transition beacons. No PII. 204 on success.
 */
export async function POST(request: Request) {
  const text = await request.text();
  if (text.length > 2048) {
    return NextResponse.json({ error: 'payload too large' }, { status: 413 });
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }
  const event = sanitizeRumEvent(parsed);
  if (!event) {
    return NextResponse.json({ error: 'invalid rum event' }, { status: 400 });
  }
  return new NextResponse(null, { status: 204 });
}
