import type { ApiResponse } from '@/types';

export type ApiErrorCode =
  | 'PROFILE_INCOMPLETE'
  | 'INSUFFICIENT_CREDITS'
  | 'PRO_FEATURE_LOCKED'
  | 'LLM_BUSY'
  | string;

type ErrorLike = Pick<ApiResponse<unknown>, 'errorCode' | 'error' | 'status'>;

export function isProfileIncomplete(res: ErrorLike): boolean {
  return res.errorCode === 'PROFILE_INCOMPLETE';
}

export function isPaywallError(res: ErrorLike): boolean {
  return (
    res.errorCode === 'INSUFFICIENT_CREDITS' ||
    res.errorCode === 'PRO_FEATURE_LOCKED'
  );
}

export function isAgentBlocked(res: ErrorLike): boolean {
  return res.errorCode === 'AGENT_BLOCKED';
}

export function isAgentSwitchRequiresClinic(res: ErrorLike): boolean {
  return res.errorCode === 'AGENT_SWITCH_REQUIRES_CLINIC';
}

/**
 * KAZI-186 / SDD §3.5 — LLM quota full or queue wait timeout.
 * Prefer `error_code=LLM_BUSY`.
 *
 * TODO(KAZI-186): drop bare-429 fallback once BE always returns `LLM_BUSY`
 * (other rate-limit 429s must not share this copy).
 */
export function isLlmBusy(res: ErrorLike): boolean {
  if (res.errorCode === 'LLM_BUSY') return true;
  if (res.status === 429 && (!res.errorCode || /llm_busy/i.test(res.errorCode))) {
    return true;
  }
  return false;
}

/**
 * Lifecycle-Park INV-P2 — another interactive Capability is still Current.
 * Prefer `error_code=INTERACTIVE_IN_PROGRESS` (M2+); tolerate legacy `SESSION_IN_PROGRESS`.
 * Do not treat bare HTTP 409 as a match (other codes e.g. FEEDBACK_NOT_READY also use 409).
 */
export function isInteractiveInProgress(res: ErrorLike): boolean {
  if (res.errorCode === 'INTERACTIVE_IN_PROGRESS') return true;
  if (res.errorCode === 'SESSION_IN_PROGRESS') return true;
  if (
    typeof res.error === 'string' &&
    (res.error.includes('INTERACTIVE_IN_PROGRESS') ||
      res.error.includes('SESSION_IN_PROGRESS'))
  ) {
    return true;
  }
  return false;
}
