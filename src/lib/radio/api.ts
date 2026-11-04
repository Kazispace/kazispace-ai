/**
 * Personal radio API (KAZI-1209). Every call goes through `apiRequest`, which adds the language
 * headers the server's audience check reads (D9: the radio is open to a Chinese interface), maps
 * `{detail: {error_code}}` to `errorCode`, and parses `Retry-After`.
 *
 * Contract: kazispace-ui `interfaces/openapi/client-api.json`, paths under `/api/v1/radio/`.
 */
import { apiRequest } from '@/lib/api-client';
import type { ApiResponse } from '@/types';
import type {
  RadioBand,
  RadioHome,
  RadioPlayerResponse,
  RadioPrefs,
  RadioPrefsResponse,
  RadioProgramDetail,
  RadioRenderAudio,
  RadioTurnInput,
} from '@/types/radio';

const BASE = '/api/v1/radio';

export const RADIO_CODE_NOT_IN_AUDIENCE = 'radio_not_in_audience';
export const RADIO_CODE_PRO_REQUIRED = 'radio_pro_required';

/** What [Who sees it] makes of an answer: open, switched off / not for this user, or unknown. */
export type RadioAccess = 'open' | 'closed' | 'unknown';

/**
 * kazispace-ui personal-radio.md, Data: `404` with no `error_code` = off; `403` with
 * `radio_not_in_audience` / `radio_pro_required` = not open to this user; anything else that
 * failed = the status cannot be read.
 */
export function radioAccessOf(res: ApiResponse<unknown>): RadioAccess {
  if (res.success) return 'open';
  // The radio's "off" is `404 {"detail": "Not Found"}`, which `apiRequest` relabels
  // `REGION_ACCOUNT_NOT_FOUND`. The radio never answers 404 with a code of its own, so any 404 is off.
  if (res.status === 404) return 'closed';
  if (
    res.status === 403 &&
    (res.errorCode === RADIO_CODE_NOT_IN_AUDIENCE || res.errorCode === RADIO_CODE_PRO_REQUIRED)
  ) {
    return 'closed';
  }
  return 'unknown';
}

/** A request id the server accepts: `^[A-Za-z0-9_-]{8,40}$`. */
export function newRadioRequestId(prefix: string): string {
  const raw =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().replace(/-/g, '')
      : `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
  return `${prefix}_${raw}`.slice(0, 40);
}

export function getRadioHome(): Promise<ApiResponse<RadioHome>> {
  return apiRequest<RadioHome>(`${BASE}/home`);
}

export function patchRadioPrefs(patch: RadioPrefs): Promise<ApiResponse<RadioPrefsResponse>> {
  return apiRequest<RadioPrefsResponse>(`${BASE}/prefs`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}

export function setRadioBand(band: RadioBand): Promise<ApiResponse<RadioPrefsResponse>> {
  return patchRadioPrefs({ band_override: band });
}

export function startRadioStory(
  storyId: string,
  requestId: string,
  overwriteSaveId?: string | null
): Promise<ApiResponse<RadioPlayerResponse>> {
  return apiRequest<RadioPlayerResponse>(`${BASE}/stories/${encodeURIComponent(storyId)}/saves`, {
    method: 'POST',
    body: JSON.stringify({ request_id: requestId, overwrite_save_id: overwriteSaveId ?? null }),
  });
}

export function getRadioSave(saveId: string): Promise<ApiResponse<RadioPlayerResponse>> {
  return apiRequest<RadioPlayerResponse>(`${BASE}/saves/${encodeURIComponent(saveId)}`);
}

export function postRadioTurn(
  saveId: string,
  turnId: string,
  saveVersion: number,
  input: RadioTurnInput
): Promise<ApiResponse<RadioPlayerResponse>> {
  return apiRequest<RadioPlayerResponse>(`${BASE}/saves/${encodeURIComponent(saveId)}/turn`, {
    method: 'POST',
    body: JSON.stringify({ turn_id: turnId, save_version: saveVersion, input }),
  });
}

export function getRadioRender(
  renderId: string,
  voiceId: string
): Promise<ApiResponse<RadioRenderAudio>> {
  const qs = new URLSearchParams({ voice_id: voiceId }).toString();
  return apiRequest<RadioRenderAudio>(`${BASE}/renders/${encodeURIComponent(renderId)}?${qs}`);
}

export function getRadioProgram(programId: string): Promise<ApiResponse<RadioProgramDetail>> {
  return apiRequest<RadioProgramDetail>(`${BASE}/programs/${encodeURIComponent(programId)}`);
}
