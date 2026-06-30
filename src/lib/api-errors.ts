import type { ApiResponse } from '@/types';

export type ApiErrorCode =
  | 'PROFILE_INCOMPLETE'
  | 'INSUFFICIENT_CREDITS'
  | 'PRO_FEATURE_LOCKED'
  | string;

type ErrorLike = Pick<ApiResponse<unknown>, 'errorCode' | 'error'>;

export function isProfileIncomplete(res: ErrorLike): boolean {
  return res.errorCode === 'PROFILE_INCOMPLETE';
}

export function isPaywallError(res: ErrorLike): boolean {
  return (
    res.errorCode === 'INSUFFICIENT_CREDITS' ||
    res.errorCode === 'PRO_FEATURE_LOCKED'
  );
}
