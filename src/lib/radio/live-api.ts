/**
 * Live Room API (KAZI-1287; kazispace-ui live-room.md, Data). Every call goes through `apiRequest`,
 * like the rest of the radio, so the language headers the audience check reads are sent.
 *
 * Contract: kazispace-ui `interfaces/openapi/client-api.json`, paths under `/api/v1/radio/live`.
 */
import { apiRequest } from '@/lib/api-client';
import { RADIO_CODE_NOT_IN_AUDIENCE, RADIO_CODE_PRO_REQUIRED } from '@/lib/radio/api';
import type { ApiResponse } from '@/types';
import type { LiveHome, LiveSession, LiveStartRequest } from '@/types/radio-live';

const BASE = '/api/v1/radio/live';

/** `403` on `POST live/sessions`: Live Room is not open to this account yet, though the radio is. */
export const LIVE_CODE_REFUSED = 'live_refused';

/**
 * What the Live section makes of `GET live/home` (live-room.md, Who sees it):
 * - `shown`: Live Room is on and every part it needs (`asr`, `tts`, `llm`) is available here;
 * - `hidden`: switched off (`404`), not available in this region, or the radio is not open to the user
 *   (`403`; the radio home itself sends that user to Studio). Nothing says it exists;
 * - `error`: the section cannot be read (network or server error): an inline error with retry.
 */
export type LiveSectionAccess = 'shown' | 'hidden' | 'error';

export function liveSectionAccessOf(res: ApiResponse<LiveHome>): LiveSectionAccess {
  if (res.success && res.data) {
    const a = res.data.availability;
    return a.asr && a.tts && a.llm ? 'shown' : 'hidden';
  }
  if (res.status === 404) return 'hidden';
  if (res.status === 403 && isRadioAudienceCode(res.errorCode)) return 'hidden';
  return 'error';
}

/** The radio's own `403` codes (live-room.md, Data): they follow the radio's rules. */
export function isRadioAudienceCode(code: string | undefined | null): boolean {
  return code === RADIO_CODE_NOT_IN_AUDIENCE || code === RADIO_CODE_PRO_REQUIRED;
}

export function getLiveHome(): Promise<ApiResponse<LiveHome>> {
  return apiRequest<LiveHome>(`${BASE}/home`);
}

/** Agree on the disclaimer: `204`. Per account, on every device. */
export function ackLiveDisclaimer(): Promise<ApiResponse<unknown>> {
  return apiRequest<unknown>(`${BASE}/disclaimer`, { method: 'POST' });
}

/** Start a session. A resend with the same `request_id` returns the same session. */
export function startLiveSession(body: LiveStartRequest): Promise<ApiResponse<LiveSession>> {
  return apiRequest<LiveSession>(`${BASE}/sessions`, { method: 'POST', body: JSON.stringify(body) });
}

/**
 * End a session (live-room.md, Ending). Sent as the user leaves and never waited for: `204` for the
 * user's own session every time, `409 live_session_not_found` for an unknown one; the app ignores
 * both. `keepalive` so it still goes out while the page is being closed.
 */
export function sendLiveEnd(sessionId: string): void {
  void apiRequest<unknown>(`${BASE}/sessions/${encodeURIComponent(sessionId)}/end`, {
    method: 'POST',
    keepalive: true,
  }).catch(() => undefined);
}
