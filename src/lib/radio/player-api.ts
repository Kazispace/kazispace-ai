/**
 * Personal radio API calls used only on the radio's own screens (KAZI-1209 parts 2–4): spoken turns,
 * questions in a program, background music and clearing radio memory. Kept apart from `api.ts` so
 * Studio's radio section, which loads with the CV rail chunk (KAZI-654 budget), does not carry them.
 */
import { apiRequest } from '@/lib/api-client';
import type { ApiResponse } from '@/types';
import type {
  RadioBgmTrack,
  RadioClientEvent,
  RadioEventsResponse,
  RadioPlayerResponse,
  RadioPosition,
  RadioProgramAskResponse,
  RadioReplay,
  RadioSaveSummary,
} from '@/types/radio';

const BASE = '/api/v1/radio';

/**
 * A spoken turn (personal-radio.md, Data · A spoken turn): multipart `meta` (`turn_id`,
 * `save_version`, `input.position`), `duration_ms` and the `audio` file, named with its real
 * extension because the server reads the format from it. The answer is the same as a tapped turn's.
 */
export function postRadioTurnAudio(
  saveId: string,
  turn: { turnId: string; saveVersion: number; position?: RadioPosition | null },
  audio: Blob,
  durationMs: number,
  fileName: string
): Promise<ApiResponse<RadioPlayerResponse>> {
  const meta: Record<string, unknown> = { turn_id: turn.turnId, save_version: turn.saveVersion };
  if (turn.position) meta.input = { position: turn.position };
  const form = new FormData();
  form.append('meta', JSON.stringify(meta));
  form.append('duration_ms', String(Math.max(1, Math.min(20000, Math.round(durationMs)))));
  form.append('audio', audio, fileName);
  return apiRequest<RadioPlayerResponse>(`${BASE}/saves/${encodeURIComponent(saveId)}/turn/audio`, {
    method: 'POST',
    body: form,
  });
}

/**
 * A question during a program (Data · A program): `request_id` is made when the user asks and reused,
 * unchanged, for every resend; `text` is 1..200 characters; `position_ms` is where the program was.
 */
export function askRadioProgram(
  programId: string,
  requestId: string,
  text: string,
  positionMs: number
): Promise<ApiResponse<RadioProgramAskResponse>> {
  return apiRequest<RadioProgramAskResponse>(`${BASE}/programs/${encodeURIComponent(programId)}/ask`, {
    method: 'POST',
    body: JSON.stringify({ request_id: requestId, text, position_ms: Math.max(0, Math.round(positionMs)) }),
  });
}

/** The same question by voice: `meta` `{request_id, position_ms}` (no text), `duration_ms`, `audio`. */
export function askRadioProgramAudio(
  programId: string,
  ask: { requestId: string; positionMs: number },
  audio: Blob,
  durationMs: number,
  fileName: string
): Promise<ApiResponse<RadioProgramAskResponse>> {
  const form = new FormData();
  form.append('meta', JSON.stringify({ request_id: ask.requestId, position_ms: Math.max(0, Math.round(ask.positionMs)) }));
  form.append('duration_ms', String(Math.max(1, Math.min(20000, Math.round(durationMs)))));
  form.append('audio', audio, fileName);
  return apiRequest<RadioProgramAskResponse>(`${BASE}/programs/${encodeURIComponent(programId)}/ask/audio`, {
    method: 'POST',
    body: form,
  });
}

/** `GET bgm`: the background music tracks. None ⇒ the settings' music group is hidden. */
export function getRadioBgm(): Promise<ApiResponse<{ tracks: RadioBgmTrack[] }>> {
  return apiRequest<{ tracks: RadioBgmTrack[] }>(`${BASE}/bgm`);
}

/** `DELETE memory`: `204` with no body; a resend after a lost answer is safe. */
export function deleteRadioMemory(): Promise<ApiResponse<unknown>> {
  return apiRequest<unknown>(`${BASE}/memory`, { method: 'DELETE' });
}

/** `GET saves`: in progress, finished and replaced stories, the most recent first. */
export function getRadioSaves(): Promise<ApiResponse<{ saves: RadioSaveSummary[] }>> {
  return apiRequest<{ saves: RadioSaveSummary[] }>(`${BASE}/saves`);
}

/** `GET saves/{save_id}/replay`: every step as it was heard. Changes nothing. */
export function getRadioReplay(saveId: string): Promise<ApiResponse<RadioReplay>> {
  return apiRequest<RadioReplay>(`${BASE}/saves/${encodeURIComponent(saveId)}/replay`);
}

/** `DELETE saves/{save_id}`: `204`; sending it again, or for a story already gone, answers the same. */
export function deleteRadioSave(saveId: string): Promise<ApiResponse<unknown>> {
  return apiRequest<unknown>(`${BASE}/saves/${encodeURIComponent(saveId)}`, { method: 'DELETE' });
}

/**
 * `POST events`: 1 to 50 events. Sent with `keepalive: true` (not `sendBeacon`, which cannot carry the
 * auth header), so a batch sent while the page is being left still reaches the server.
 */
export function postRadioEvents(events: RadioClientEvent[]): Promise<ApiResponse<RadioEventsResponse>> {
  return apiRequest<RadioEventsResponse>(`${BASE}/events`, {
    method: 'POST',
    body: JSON.stringify({ events }),
    keepalive: true,
  });
}
