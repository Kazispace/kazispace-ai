import { API_BASE_URL } from '@/lib/constants';
import { getAuthToken, getDeviceId } from '@/lib/auth';
import { getActiveLanguagePreference } from '@/lib/locale';
import { getTmaClientHeaders } from '@/lib/telegram';
import type { ApiResponse } from '@/types';
import type { components } from '@/types/api.generated';

/** Chat mic ASR timeout — Whisper + network; keep UI responsive. */
export const VOICE_ASR_TIMEOUT_MS = 45_000;

/** Hold-to-talk cap for ordinary chat mic (not mock-interview long audio). */
export const MAX_VOICE_RECORDING_SECONDS = 60;

export type VoiceInputResponse = components['schemas']['CreateInputResponse'];

export type VoiceAsrErrorCode =
  | 'EMPTY_TRANSCRIPTION'
  | 'ASR_FALLBACK'
  | 'TIMEOUT'
  | 'TOO_LONG'
  | 'VOICE_ASR_FAILED'
  | 'SERVER_ERROR'
  | 'NETWORK_ERROR';

const MIME_TO_EXT: Record<string, string> = {
  'audio/webm': 'webm',
  'audio/webm;codecs=opus': 'webm',
  'audio/ogg': 'ogg',
  'audio/mpeg': 'mp3',
  'audio/mp4': 'm4a',
  'audio/aac': 'aac',
  'audio/wav': 'wav',
};

function resolveExt(mime: string): string {
  const base = mime.split(';')[0]?.trim() ?? mime;
  return MIME_TO_EXT[mime] ?? MIME_TO_EXT[base] ?? 'webm';
}

function buildVoiceForm(audioBlob: Blob): FormData {
  const ext = resolveExt(audioBlob.type);
  const form = new FormData();
  form.append('source_channel', 'web');
  form.append('input_mode', 'voice');
  form.append('device_id', getDeviceId());
  // Contract (KAZI-214): prefer a clear extension, e.g. voice.webm
  form.append('file', audioBlob, `voice.${ext}`);
  return form;
}

function buildHeaders(): Record<string, string> {
  const lang = getActiveLanguagePreference(
    typeof window !== 'undefined' ? window.location.pathname : undefined,
  );
  const headers: Record<string, string> = {
    'X-Device-ID': getDeviceId(),
    'X-Language-Preference': lang,
    ...getTmaClientHeaders(),
  };
  const token = getAuthToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

function parseErrorMessage(err: Record<string, unknown>): string | undefined {
  const detail = err.detail;
  if (typeof detail === 'string') return detail;
  if (typeof detail === 'object' && detail !== null) {
    return (detail as { message?: string }).message;
  }
  return undefined;
}

// TODO(KAZI-213): /api/v1/inputs does not accept spaceId yet.
// If space-scoped quotas / auditing are needed, add context_module or space_id param.

/**
 * POST audio blob to /api/v1/inputs (input_mode=voice).
 * Backend runs Whisper ASR and returns canonical_text.
 *
 * On asr_fallback_triggered or empty canonical_text → success:false
 * (caller must not send chat).
 */
export async function transcribeVoice(
  audioBlob: Blob,
): Promise<ApiResponse<VoiceInputResponse>> {
  const url = `${API_BASE_URL}/api/v1/inputs`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), VOICE_ASR_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: buildHeaders(),
      body: buildVoiceForm(audioBlob),
      signal: controller.signal,
    });
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      const msg = parseErrorMessage(err);
      if (res.status === 413) {
        return { success: false, error: msg, errorCode: 'TOO_LONG' };
      }
      if (res.status === 408 || res.status === 504) {
        return { success: false, error: msg, errorCode: 'TIMEOUT' };
      }
      return {
        success: false,
        error: msg ?? `HTTP ${res.status}`,
        errorCode: res.status >= 500 ? 'SERVER_ERROR' : 'VOICE_ASR_FAILED',
      };
    }
    const data = (await res.json()) as VoiceInputResponse;
    if (data.asr_fallback_triggered === true) {
      return { success: false, errorCode: 'ASR_FALLBACK' };
    }
    if (!data.canonical_text?.trim()) {
      return { success: false, errorCode: 'EMPTY_TRANSCRIPTION' };
    }
    return { success: true, data };
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      return { success: false, errorCode: 'TIMEOUT' };
    }
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Network error',
      errorCode: 'NETWORK_ERROR',
    };
  } finally {
    clearTimeout(timer);
  }
}
