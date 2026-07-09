import { API_BASE_URL } from '@/lib/constants';
import { getAuthToken, getDeviceId } from '@/lib/auth';
import { getActiveLanguagePreference } from '@/lib/locale';
import { getTmaClientHeaders } from '@/lib/telegram';
import type { ApiResponse } from '@/types';

function buildExportHeaders(locale?: string): Record<string, string> {
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
  const token = getAuthToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

function parseContentDispositionFilename(header: string | null): string | null {
  if (!header) return null;
  const match = header.match(/filename\*?=(?:UTF-8''|")?([^";]+)/i);
  return match?.[1]?.trim() ?? null;
}

export function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function parseExportError(
  errorData: Record<string, unknown>,
  status: number
): { error: string; errorCode?: string } {
  const detail = errorData.detail;
  const detailMessage =
    typeof detail === 'string'
      ? detail
      : typeof detail === 'object' && detail !== null
        ? (detail as { message?: string }).message
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
      `HTTP ${status}`,
    errorCode,
  };
}

export function resolveCvExportErrorMessage(
  error: string | undefined,
  errorCode: string | undefined,
  t: (key: string) => string
): string {
  if (errorCode === 'NOT_FOUND') return t('exportErrorNotFound');
  if (errorCode === 'INTERNAL_SERVER_ERROR' || error?.includes('WeasyPrint')) {
    return t('exportErrorUnavailable');
  }
  return error ?? t('exportErrorGeneric');
}

/** POST /api/v1/cv/documents/{doc_id}/export → PDF download (KAZI-101). */
export async function exportCvDocumentPdf(
  docId: number,
  locale?: string
): Promise<ApiResponse<{ filename: string }>> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/cv/documents/${docId}/export`, {
      method: 'POST',
      headers: buildExportHeaders(locale),
    });

    if (!response.ok) {
      const errorData = (await response.json().catch(() => ({}))) as Record<string, unknown>;
      const { error, errorCode } = parseExportError(errorData, response.status);
      return { success: false, error, errorCode };
    }

    const blob = await response.blob();
    const filename =
      parseContentDispositionFilename(response.headers.get('Content-Disposition')) ??
      `cv-${docId}.pdf`;
    triggerBlobDownload(blob, filename);
    return { success: true, data: { filename } };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Network error',
      errorCode: 'NETWORK_ERROR',
    };
  }
}
