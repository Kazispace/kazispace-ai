import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL =
  process.env.API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  'https://bot.kazispace.ai';

/** CV parser can take 30–90s; allow long-running upstream on Netlify/Node. */
export const maxDuration = 120;
export const dynamic = 'force-dynamic';

/** Same-origin proxy for CV resume upload → POST /api/v1/inputs (multipart). */
export async function POST(request: NextRequest) {
  try {
    const incoming = await request.formData();

    const outbound = new FormData();
    outbound.append('source_channel', String(incoming.get('source_channel') ?? 'web'));
    outbound.append('input_mode', 'file');
    outbound.append(
      'context_module',
      String(incoming.get('context_module') ?? 'cv_builder')
    );

    const file = incoming.get('file');
    if (!(file instanceof Blob)) {
      return NextResponse.json(
        {
          detail: {
            error_code: 'VALIDATION_ERROR',
            message: 'file is required when input_mode=file',
          },
        },
        { status: 422 }
      );
    }
    const filename =
      file instanceof File && file.name ? file.name : 'resume.pdf';
    outbound.append('file', file, filename);

    const deviceId = incoming.get('device_id');
    if (typeof deviceId === 'string' && deviceId.trim()) {
      outbound.append('device_id', deviceId.trim());
    }

    const headers: Record<string, string> = {};
    const auth = request.headers.get('authorization');
    if (auth) headers.Authorization = auth;

    const deviceHeader = request.headers.get('x-device-id');
    if (deviceHeader) headers['X-Device-ID'] = deviceHeader;

    for (const name of ['accept-language', 'x-language-preference', 'x-locale']) {
      const value = request.headers.get(name);
      if (value) {
        headers[name] = value;
        if (name === 'x-language-preference') {
          headers['Accept-Language'] = value;
          headers['X-Locale'] = value;
        }
      }
    }

    const upstream = await fetch(`${BACKEND_URL}/api/v1/inputs`, {
      method: 'POST',
      headers,
      body: outbound,
    });

    const body = await upstream.text();
    return new NextResponse(body, {
      status: upstream.status,
      headers: {
        'Content-Type': upstream.headers.get('content-type') ?? 'application/json',
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Upstream request failed';
    return NextResponse.json(
      {
        detail: {
          error_code: 'NETWORK_ERROR',
          message,
        },
      },
      { status: 502 }
    );
  }
}
