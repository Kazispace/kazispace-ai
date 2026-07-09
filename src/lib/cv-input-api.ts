import { API_BASE_URL } from '@/lib/constants';
import { getAuthToken, getDeviceId } from '@/lib/auth';
import { getActiveLanguagePreference } from '@/lib/locale';
import { getTmaClientHeaders } from '@/lib/telegram';
import { CV_BUILDER_AGENT_ID } from '@/lib/cv-agent-config';
import type { AgentChatResponse, ApiResponse } from '@/types';

export const CV_UPLOAD_MAX_BYTES = 10 * 1024 * 1024;
export const CV_UPLOAD_ACCEPT =
  '.pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document';

const CV_UPLOAD_MIME_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

export interface CvFileUploadResponse {
  input_id: number;
  input_mode: string;
  filename: string;
  mime_type: string;
  asset_ref: string;
  agent_id: string;
  assets?: { asset_type: string; ref: string }[];
  response: NonNullable<AgentChatResponse['response']>;
}

function parseFormError(
  errorData: Record<string, unknown>,
  status: number
): { error: string; errorCode?: string } {
  const detail = errorData.detail;
  const detailMessage =
    typeof detail === 'object' && detail !== null
      ? (detail as { message?: string; error_code?: string }).message ??
        (detail as { error_code?: string }).error_code
      : undefined;
  const errorCode =
    (typeof detail === 'object' && detail !== null
      ? (detail as { error_code?: string }).error_code
      : undefined) ??
    (typeof errorData.error_code === 'string' ? errorData.error_code : undefined);
  return {
    error:
      detailMessage ||
      (typeof errorData.message === 'string' ? errorData.message : undefined) ||
      (typeof errorData.error === 'string' ? errorData.error : undefined) ||
      `HTTP ${status}`,
    errorCode,
  };
}

export function validateCvUploadFile(file: File): string | null {
  const ext = file.name.split('.').pop()?.toLowerCase();
  const mimeOk = CV_UPLOAD_MIME_TYPES.has(file.type);
  const extOk = ext === 'pdf' || ext === 'docx';
  if (!mimeOk && !extOk) {
    return 'VALIDATION_ERROR';
  }
  if (file.size > CV_UPLOAD_MAX_BYTES) {
    return 'VALIDATION_ERROR';
  }
  return null;
}

export async function uploadCvResumeFile(
  file: File,
  locale?: string
): Promise<ApiResponse<CvFileUploadResponse>> {
  const validationCode = validateCvUploadFile(file);
  if (validationCode) {
    return { success: false, error: validationCode, errorCode: validationCode };
  }

  if (process.env.NEXT_PUBLIC_AGENT_API_MOCK === 'true') {
    return {
      success: true,
      data: {
        input_id: Date.now(),
        input_mode: 'file',
        filename: file.name,
        mime_type: file.type || 'application/pdf',
        asset_ref: `input_mock_${Date.now()}`,
        agent_id: CV_BUILDER_AGENT_ID,
        assets: [{ asset_type: 'cv_source', ref: `input_mock_${Date.now()}` }],
        response: {
          text: `📄 Received **${file.name}** — parsed summary (mock).\n\n- Target role: Software Engineer\n- Skills: React, Python`,
          next_actions: [
            {
              type: 'generate_now',
              label: 'Generate now',
              payload: '__action:generate_now',
            },
          ],
          meta: {
            pipeline_state: 'collecting',
            analysis: {
              cv_analysis: {
                parsed_sections: {
                  target_role: 'Software Engineer',
                  skills: 'React, Python, TypeScript',
                },
                parsed: true,
                skipped: false,
              },
            },
            event: 'cv_uploaded',
          },
        },
      },
    };
  }

  const url = `${API_BASE_URL}/api/v1/inputs`;
  const token = getAuthToken();
  const form = new FormData();
  form.append('source_channel', 'web');
  form.append('input_mode', 'file');
  form.append('context_module', 'cv_builder');
  form.append('file', file, file.name);

  const languagePreference =
    locale ??
    getActiveLanguagePreference(
      typeof window !== 'undefined' ? window.location.pathname : undefined
    );

  const headers: Record<string, string> = {
    'X-Device-ID': getDeviceId(),
    'Accept-Language': languagePreference,
    'X-Language-Preference': languagePreference,
    'X-Locale': languagePreference,
    ...getTmaClientHeaders(),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  try {
    const response = await fetch(url, { method: 'POST', headers, body: form });
    if (!response.ok) {
      const errorData = (await response.json().catch(() => ({}))) as Record<string, unknown>;
      const { error, errorCode } = parseFormError(errorData, response.status);
      return { success: false, error, errorCode };
    }
    const data = (await response.json()) as CvFileUploadResponse;
    return { success: true, data };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Network error',
    };
  }
}
