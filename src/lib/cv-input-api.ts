import { getAuthToken, getDeviceId } from '@/lib/auth';
import { getActiveLanguagePreference } from '@/lib/locale';
import { getTmaClientHeaders } from '@/lib/telegram';
import { getSession, regionAwareApiClient } from '@/lib/region';
import { CV_BUILDER_AGENT_ID } from '@/lib/cv-agent-config';
import type { AgentChatResponse, ApiResponse } from '@/types';

export const CV_UPLOAD_MAX_BYTES = 10 * 1024 * 1024;
/** Netlify serverless body limit ~6MB — use direct BE for larger files. */
export const CV_UPLOAD_PROXY_MAX_BYTES = 5 * 1024 * 1024;
export const CV_UPLOAD_ACCEPT =
  '.pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document';

const CV_UPLOAD_MIME_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

const NETWORK_ERROR_PATTERNS = [
  'load failed',
  'failed to fetch',
  'networkerror',
  'network error',
  'the operation was aborted',
];

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
    typeof detail === 'string'
      ? detail
      : typeof detail === 'object' && detail !== null
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

export type CvUploadValidationCode = 'UNSUPPORTED_FORMAT' | 'FILE_TOO_LARGE';

export function validateCvUploadFile(file: File): CvUploadValidationCode | null {
  const ext = file.name.split('.').pop()?.toLowerCase();
  const mimeOk = CV_UPLOAD_MIME_TYPES.has(file.type);
  const extOk = ext === 'pdf' || ext === 'docx';
  if (!mimeOk && !extOk) {
    return 'UNSUPPORTED_FORMAT';
  }
  if (file.size > CV_UPLOAD_MAX_BYTES) {
    return 'FILE_TOO_LARGE';
  }
  return null;
}

function isLegacyFileModeRejection(error?: string): boolean {
  if (!error) return false;
  return error.includes("input_mode must be") && !error.includes("'file'");
}

function isNetworkErrorMessage(error?: string): boolean {
  if (!error) return false;
  const lower = error.toLowerCase();
  return NETWORK_ERROR_PATTERNS.some((pattern) => lower.includes(pattern));
}

export function resolveCvUploadErrorMessage(
  error: string | undefined,
  errorCode: string | undefined,
  t: (key: string) => string
): string {
  if (isLegacyFileModeRejection(error)) {
    return t('uploadErrorBackendNotReady');
  }
  if (errorCode === 'NETWORK_ERROR' || isNetworkErrorMessage(error)) {
    return t('uploadErrorNetwork');
  }
  if (errorCode === 'PROXY_UNAVAILABLE' || errorCode === 'PROXY_PAYLOAD_TOO_LARGE') {
    return t('uploadErrorNetwork');
  }
  if (errorCode === 'SERVER_ERROR' || (error?.startsWith('HTTP 5') ?? false)) {
    return t('uploadErrorServer');
  }
  if (errorCode === 'AGENT_NOT_ACTIVE') {
    return error ?? t('uploadErrorAgentNotActive');
  }
  if (errorCode === 'UNSUPPORTED_FORMAT') {
    return t('uploadErrorFormat');
  }
  if (errorCode === 'FILE_TOO_LARGE') {
    return t('uploadErrorSize');
  }
  if (errorCode === 'VALIDATION_ERROR') {
    return error && !error.includes('input_mode must') ? error : t('uploadErrorValidation');
  }
  return error ?? t('uploadErrorGeneric');
}

function buildUploadForm(file: File): FormData {
  const form = new FormData();
  form.append('source_channel', 'web');
  form.append('input_mode', 'file');
  form.append('context_module', 'cv_builder');
  form.append('device_id', getDeviceId());
  form.append('file', file, file.name);
  return form;
}

function buildUploadHeaders(locale?: string): Record<string, string> {
  const languagePreference =
    locale ??
    getActiveLanguagePreference(
      typeof window !== 'undefined' ? window.location.pathname : undefined
    );

  return {
    'X-Device-ID': getDeviceId(),
    'Accept-Language': languagePreference,
    'X-Language-Preference': languagePreference,
    'X-Locale': languagePreference,
    ...getTmaClientHeaders(),
  };
}

type UploadTarget = 'proxy' | 'direct';

/**
 * Logged-in uploads always go direct via RegionAwareApiClient (JWT + home host).
 * Guest uploads may use same-origin BFF (bootstrap only, no Authorization).
 * @internal exported for unit tests
 */
export function resolveUploadTargets(file: File): UploadTarget[] {
  if (getAuthToken() || getSession()) {
    return ['direct'];
  }
  if (typeof window === 'undefined') {
    return ['direct'];
  }
  if (file.size > CV_UPLOAD_PROXY_MAX_BYTES) {
    return ['direct'];
  }
  return ['proxy', 'direct'];
}

async function postCvUpload(
  target: UploadTarget,
  form: FormData,
  headers: Record<string, string>
): Promise<ApiResponse<CvFileUploadResponse>> {
  try {
    const response =
      target === 'direct'
        ? await regionAwareApiClient.fetch('/api/v1/inputs', {
            method: 'POST',
            headers,
            body: form,
            requireSession: Boolean(getAuthToken() || getSession()),
          })
        : await fetch('/api/cv/upload', {
            method: 'POST',
            headers,
            body: form,
          });
    if (!response.ok) {
      const errorData = (await response.json().catch(() => ({}))) as Record<
        string,
        unknown
      >;
      const { error, errorCode } = parseFormError(errorData, response.status);
      // 401/403 are auth failures — never treat as proxy/network fallback.
      if (response.status === 401 || response.status === 403) {
        return {
          success: false,
          error,
          errorCode: errorCode ?? 'UNAUTHORIZED',
          status: response.status,
        };
      }
      const mappedCode =
        target === 'proxy' && response.status === 404
          ? 'PROXY_UNAVAILABLE'
          : response.status === 413
            ? 'PROXY_PAYLOAD_TOO_LARGE'
            : response.status >= 500
              ? 'SERVER_ERROR'
              : errorCode;
      return {
        success: false,
        error,
        errorCode: mappedCode,
        status: response.status,
      };
    }
    const data = (await response.json()) as CvFileUploadResponse;
    return { success: true, data };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Network error',
      errorCode: 'NETWORK_ERROR',
    };
  }
}

function shouldFallbackToDirectUpload(errorCode?: string): boolean {
  return (
    errorCode === 'PROXY_UNAVAILABLE' ||
    errorCode === 'NETWORK_ERROR' ||
    errorCode === 'PROXY_PAYLOAD_TOO_LARGE'
  );
}

export async function uploadCvResumeFile(
  file: File,
  locale?: string
): Promise<ApiResponse<CvFileUploadResponse>> {
  const validationCode = validateCvUploadFile(file);
  if (validationCode) {
    return { success: false, errorCode: validationCode };
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

  const headers = buildUploadHeaders(locale);
  const targets = resolveUploadTargets(file);

  let last: ApiResponse<CvFileUploadResponse> = {
    success: false,
    errorCode: 'NETWORK_ERROR',
  };

  for (const target of targets) {
    const res = await postCvUpload(target, buildUploadForm(file), headers);
    if (res.success) return res;
    last = res;
    if (!shouldFallbackToDirectUpload(res.errorCode)) {
      return res;
    }
  }

  return last;
}
