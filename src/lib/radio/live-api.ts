/**
 * Live Room API (KAZI-1287; kazispace-ui live-room.md, Data). Every call goes through `apiRequest`,
 * like the rest of the radio, so the language headers the audience check reads are sent.
 *
 * Contract: kazispace-ui `interfaces/openapi/client-api.json`, paths under `/api/v1/radio/live`.
 */
import { apiRequest } from '@/lib/api-client';
import { RADIO_CODE_NOT_IN_AUDIENCE, RADIO_CODE_PRO_REQUIRED } from '@/lib/radio/api';
import type { ApiResponse } from '@/types';
import { recordingFileName } from '@/lib/radio/voice';
import type {
  LiveClientEvent,
  LiveClose,
  LiveEventsResult,
  LiveHome,
  LiveSession,
  LiveStartRequest,
  LiveTurn,
  LiveUpgrade,
} from '@/types/radio-live';

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

const sessionPath = (sessionId: string) => `${BASE}/sessions/${encodeURIComponent(sessionId)}`;

/**
 * One piece of a recording (live-room.md, Sending a recording): `202` for a piece that is not the last,
 * `200` with the host's answer for the last (`meta` `{"final": true}`). Sending a piece again with the
 * same `turn_id` and `seq` is safe: the last piece sent again returns the same answer.
 */
export function postLiveChunk({
  sessionId,
  turnId,
  seq,
  audio,
  durationMs,
  final,
  mime,
}: {
  sessionId: string;
  turnId: string;
  seq: number;
  audio: Blob;
  durationMs: number;
  final: boolean;
  mime: string;
}): Promise<ApiResponse<LiveTurn | { received: number }>> {
  const form = new FormData();
  form.append('audio', audio, recordingFileName(mime || audio.type));
  form.append('duration_ms', String(Math.max(1, Math.round(durationMs))));
  form.append('meta', JSON.stringify(final ? { final: true } : {}));
  return apiRequest<LiveTurn | { received: number }>(
    `${sessionPath(sessionId)}/turns/${encodeURIComponent(turnId)}/chunks/${seq}`,
    { method: 'POST', body: form }
  );
}

/** A turn's answer with every line's audio: asked once, when the first line of an answer with `pending` lines starts. */
export function getLiveTurn(sessionId: string, turnId: string): Promise<ApiResponse<LiveTurn>> {
  return apiRequest<LiveTurn>(`${sessionPath(sessionId)}/turns/${encodeURIComponent(turnId)}`);
}

/** The English part: `pending` (ask again after `retry_after_ms`), `ready` or `skipped`. */
export function getLiveUpgrade(sessionId: string): Promise<ApiResponse<LiveUpgrade>> {
  return apiRequest<LiveUpgrade>(`${sessionPath(sessionId)}/upgrade`);
}

/** The closing and the end card. Sending it again returns the same closing. */
export function postLiveClose(sessionId: string): Promise<ApiResponse<LiveClose>> {
  return apiRequest<LiveClose>(`${sessionPath(sessionId)}/close`, { method: 'POST' });
}

/**
 * Playback events (live-room.md, Playback events): 1 to 50 per batch. `keepalive` (not `sendBeacon`, which
 * cannot carry the auth header), because a batch is sent as the user leaves.
 */
export function postLiveEvents(sessionId: string, events: LiveClientEvent[]): Promise<ApiResponse<LiveEventsResult>> {
  return apiRequest<LiveEventsResult>(`${sessionPath(sessionId)}/events`, {
    method: 'POST',
    body: JSON.stringify({ events }),
    keepalive: true,
  });
}
