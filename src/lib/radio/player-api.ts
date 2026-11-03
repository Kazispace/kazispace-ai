/**
 * Personal radio API calls used only inside the players (KAZI-1209 parts 2 and 3): spoken turns and
 * questions in a program. Kept apart from `api.ts` so Studio's radio section, which loads with the
 * CV rail chunk (KAZI-654 budget), does not carry them.
 */
import { apiRequest } from '@/lib/api-client';
import type { ApiResponse } from '@/types';
import type { RadioPlayerResponse, RadioPosition, RadioProgramAskResponse } from '@/types/radio';

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
