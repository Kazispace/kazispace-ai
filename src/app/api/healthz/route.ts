import { NextResponse } from 'next/server';

/**
 * KAZI-1422 · liveness probe for the CN image on Aliyun SAE (`deploy/cn/README.md`).
 *
 * Cheap on purpose: no upstream call, no page render, and `/api/*` is outside the locale
 * middleware (`src/middleware.ts` matcher), so a 200 here means the Next server is up and
 * answering. It does not say the backend is healthy — that has its own `/health`.
 */
export const dynamic = 'force-dynamic';

export function GET() {
  return NextResponse.json({ ok: true }, { headers: { 'cache-control': 'no-store' } });
}
