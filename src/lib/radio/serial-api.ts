/**
 * Serial stories API (KAZI-1455). Contract: kazispace-ui `interfaces/openapi/client-api.json`, paths under
 * `/api/v1/radio/storylines/`. The routes answer `404` for everyone while serial stories are switched off;
 * the radio home then carries `storylines: null` and the app shows no serial section.
 */
import { apiRequest } from '@/lib/api-client';
import type { ApiResponse } from '@/types';
import type {
  RadioBand,
  RadioEpisode,
  RadioProgramAskResponse,
  RadioProgressResponse,
  RadioSerialMode,
  RadioStoryline,
} from '@/types/radio';

const BASE = '/api/v1/radio/storylines';

export const SERIAL_MODES: readonly RadioSerialMode[] = ['immersive', 'balanced', 'intensive'];

const line = (storylineId: string) => `${BASE}/${encodeURIComponent(storylineId)}`;
const episode = (storylineId: string, programId: string) =>
  `${line(storylineId)}/episodes/${encodeURIComponent(programId)}`;

export function getRadioStoryline(storylineId: string): Promise<ApiResponse<RadioStoryline>> {
  return apiRequest<RadioStoryline>(line(storylineId));
}

/** `mode` omitted ⇒ the mode of the listener's last progress on this story line, else balanced. */
export function getRadioEpisode(
  storylineId: string,
  programId: string,
  mode?: RadioSerialMode | null
): Promise<ApiResponse<RadioEpisode>> {
  const qs = mode ? `?${new URLSearchParams({ mode }).toString()}` : '';
  return apiRequest<RadioEpisode>(`${episode(storylineId, programId)}${qs}`);
}

/**
 * Where the listener is. `seq` is the last sentence heard (0 = nothing yet); `at` is the client's clock.
 * A write that is not newer than the stored one changes nothing (`applied: false`).
 */
export function putRadioProgress(
  storylineId: string,
  p: { programId: string; seq: number; band: RadioBand; mode: RadioSerialMode; at?: Date }
): Promise<ApiResponse<RadioProgressResponse>> {
  return apiRequest<RadioProgressResponse>(`${line(storylineId)}/progress`, {
    method: 'PUT',
    body: JSON.stringify({
      program_id: p.programId,
      seq: Math.max(0, Math.round(p.seq)),
      band: p.band,
      mode: p.mode,
      at: (p.at ?? new Date()).toISOString(),
    }),
    // Sent as the listener leaves too: the page may be gone before the answer.
    keepalive: true,
  });
}

/** A question during an episode. The answer uses nothing after `seq`. Same `request_id` rule as a program. */
export function askRadioEpisode(
  storylineId: string,
  programId: string,
  ask: { requestId: string; text: string; seq: number; mode: RadioSerialMode }
): Promise<ApiResponse<RadioProgramAskResponse>> {
  return apiRequest<RadioProgramAskResponse>(`${episode(storylineId, programId)}/ask`, {
    method: 'POST',
    body: JSON.stringify({ request_id: ask.requestId, text: ask.text, seq: Math.max(0, ask.seq), mode: ask.mode }),
  });
}

/** The same question by voice: `meta` `{request_id, seq, mode}` (no text), `duration_ms`, `audio`. */
export function askRadioEpisodeAudio(
  storylineId: string,
  programId: string,
  ask: { requestId: string; seq: number; mode: RadioSerialMode },
  audio: Blob,
  durationMs: number,
  fileName: string
): Promise<ApiResponse<RadioProgramAskResponse>> {
  const form = new FormData();
  form.append('meta', JSON.stringify({ request_id: ask.requestId, seq: Math.max(0, ask.seq), mode: ask.mode }));
  form.append('duration_ms', String(Math.max(1, Math.min(20000, Math.round(durationMs)))));
  form.append('audio', audio, fileName);
  return apiRequest<RadioProgramAskResponse>(`${episode(storylineId, programId)}/ask/audio`, {
    method: 'POST',
    body: form,
  });
}
