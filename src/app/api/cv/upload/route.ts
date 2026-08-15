import { NextRequest, NextResponse } from 'next/server';

import { bootstrapBase } from '@/lib/region';

const UPSTREAM_TIMEOUT_MS = 110_000;

/**
 * Guest-only same-origin BFF for CV upload (CORS / preview).
 * Logged-in uploads must use RegionAwareApiClient direct to session home —
 * this proxy never accepts client-claimed home hosts or Authorization
 * (KAZI-533 P1-1/P1-2).
 */
const UPSTREAM_FORWARD_HEADERS = [
  'x-device-id',
  'accept-language',
  'x-language-preference',
  'x-locale',
  'x-client-variant',
  'x-telegram-platform',
] as const;

/** CV parser can take 30–90s; allow long-running upstream on Netlify/Node. */
export const maxDuration = 120;
export const dynamic = 'force-dynamic';

function buildUpstreamHeaders(request: NextRequest): Record<string, string> {
  const headers: Record<string, string> = {};

  for (const name of UPSTREAM_FORWARD_HEADERS) {
    const value = request.headers.get(name);
    if (value) headers[name] = value;
  }

  // Language: X-Language-Preference is SSOT; mirror to legacy headers BE may read.
  const languagePreference =
    request.headers.get('x-language-preference') ??
    request.headers.get('accept-language') ??
    request.headers.get('x-locale');
  if (languagePreference) {
    headers['X-Language-Preference'] = languagePreference;
    headers['Accept-Language'] = languagePreference;
    headers['X-Locale'] = languagePreference;
  }

  return headers;
}

/** Same-origin proxy for guest CV resume upload → POST /api/v1/inputs (multipart). */
export async function POST(request: NextRequest) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  // Always bootstrap — never trust client-claimed home hosts or Authorization.
  const backendUrl = bootstrapBase();

  try {
    const incoming = await request.formData();

    const outbound = new FormData();
    outbound.append('source_channel', 'web');
    outbound.append('input_mode', 'file');
    outbound.append('context_module', 'cv_builder');

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

    const deviceHeader = request.headers.get('x-device-id');
    if (deviceHeader?.trim()) {
      outbound.append('device_id', deviceHeader.trim());
    }

    const upstream = await fetch(`${backendUrl}/api/v1/inputs`, {
      method: 'POST',
      headers: buildUpstreamHeaders(request),
      body: outbound,
      signal: controller.signal,
    });

    const body = await upstream.text();
    return new NextResponse(body, {
      status: upstream.status,
      headers: {
        'Content-Type': upstream.headers.get('content-type') ?? 'application/json',
      },
    });
  } catch (err) {
    const aborted = err instanceof Error && err.name === 'AbortError';
    const message = aborted
      ? 'CV upload timed out while waiting for the server'
      : err instanceof Error
        ? err.message
        : 'Upstream request failed';
    return NextResponse.json(
      {
        detail: {
          error_code: 'NETWORK_ERROR',
          message,
        },
      },
      { status: aborted ? 504 : 502 }
    );
  } finally {
    clearTimeout(timeout);
  }
}
