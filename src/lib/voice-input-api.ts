import { API_BASE_URL } from '@/lib/constants';
import { getAuthToken, getDeviceId } from '@/lib/auth';
import { getActiveLanguagePreference } from '@/lib/locale';
import { getTmaClientHeaders } from '@/lib/telegram';
import type { ApiResponse } from '@/types';

export interface VoiceInputResponse {
  input_id: number;
  input_mode: string;
  canonical_text: string;
  [key: string]: unknown;
}

function buildVoiceForm(audioBlob: Blob): FormData {
  const ext = audioBlob.type.includes('ogg') ? 'ogg' : 'webm';
  const form = new FormData();
  form.append('source_channel', 'web');
  form.append('input_mode', 'voice');
  form.append('device_id', getDeviceId());
  form.append('file', audioBlob, `voice_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`);
  return form;
}

function buildHeaders(): Record<string, string> {
  const lang = getActiveLanguagePreference(
    typeof window !== 'undefined' ? window.location.pathname : undefined,
  );
  const headers: Record<string, string> = {
    'X-Device-ID': getDeviceId(),
    'Accept-Language': lang,
    'X-Language-Preference': lang,
    'X-Locale': lang,
    ...getTmaClientHeaders(),
  };
  const token = getAuthToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

/**
 * POST audio blob to /api/v1/inputs (input_mode=voice).
 * Backend runs Whisper ASR and returns canonical_text.
 */
export async function transcribeVoice(
  audioBlob: Blob,
): Promise<ApiResponse<VoiceInputResponse>> {
  const url = `${API_BASE_URL}/api/v1/inputs`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: buildHeaders(),
      body: buildVoiceForm(audioBlob),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as Record<string, unknown>;
      const detail = err.detail;
      const msg =
        typeof detail === 'string'
          ? detail
          : typeof detail === 'object' && detail !== null
            ? (detail as { message?: string }).message
            : undefined;
      return {
        success: false,
        error: msg ?? `HTTP ${res.status}`,
        errorCode: res.status >= 500 ? 'SERVER_ERROR' : 'VOICE_ASR_FAILED',
      };
    }
    const data = (await res.json()) as VoiceInputResponse;
    if (!data.canonical_text?.trim()) {
      return { success: false, error: 'No speech detected', errorCode: 'EMPTY_TRANSCRIPTION' };
    }
    return { success: true, data };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Network error',
      errorCode: 'NETWORK_ERROR',
    };
  }
}
