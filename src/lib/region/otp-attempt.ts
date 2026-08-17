import { BUNDLED_DIRECTORY, isKnownApiBase } from './directory';
import { normalizePhone } from './phone';

/**
 * Pre-auth OTP attempt — pins request + verify to the same API host (KAZI-533 P1-3).
 * No JWT. Only valid for unauthenticated OTP request/verify.
 * Do not persist this object or the 6-digit code (KAZI-577).
 */
export interface OtpAttempt {
  phone: string;
  api_base: string;
  directory_version: number;
  request_id?: string;
}

function normalizeApiBase(raw: string): string {
  return raw.replace(/\/+$/, '');
}

export function createOtpAttempt(input: {
  phone: string;
  api_base: string;
  directory_version?: number;
  request_id?: string;
}): OtpAttempt | null {
  const phone = normalizePhone(input.phone);
  const apiBase = normalizeApiBase(input.api_base.trim());
  if (!phone || !apiBase || !isKnownApiBase(apiBase)) return null;
  return {
    phone,
    api_base: apiBase,
    directory_version:
      typeof input.directory_version === 'number' &&
      Number.isFinite(input.directory_version)
        ? input.directory_version
        : BUNDLED_DIRECTORY.directory_version,
    ...(input.request_id ? { request_id: input.request_id } : {}),
  };
}

/** Reject unknown / mismatched / expired-host attempts before verify. */
export function assertOtpAttempt(
  attempt: OtpAttempt | null | undefined,
  phone: string
): OtpAttempt {
  if (!attempt) {
    throw new Error('OTP attempt missing — request a new code');
  }
  const normalizedPhone = normalizePhone(phone);
  if (attempt.phone !== normalizedPhone) {
    throw new Error('OTP attempt phone mismatch');
  }
  if (!isKnownApiBase(attempt.api_base)) {
    throw new Error('OTP attempt host not in bundled directory');
  }
  return {
    ...attempt,
    phone: normalizedPhone,
    api_base: normalizeApiBase(attempt.api_base),
  };
}
