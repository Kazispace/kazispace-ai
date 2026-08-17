import {
  CLINIC_CHAT_VIRTUALIZE_AFTER,
  SPACE_CHAT_VIRTUALIZE_AFTER,
} from '@/lib/spaces/perf-policy';

/** Long Space threads virtualize; short ones keep the existing map. */
export function shouldVirtualizeSpaceMessages(count: number): boolean {
  return count >= SPACE_CHAT_VIRTUALIZE_AFTER;
}

/** Long Clinic threads virtualize; public welcome / short lists stay mapped. */
export function shouldVirtualizeClinicMessages(count: number): boolean {
  return count >= CLINIC_CHAT_VIRTUALIZE_AFTER;
}

/**
 * Re-apply the pre-swap scrollTop after static rows unmount.
 * No-op until the parent actually has overflow — otherwise the browser
 * clamps to 0 and we would lock that in.
 */
export function restoreSpaceChatScrollAfterVirtualize(
  el: Pick<HTMLElement, 'scrollHeight' | 'clientHeight' | 'scrollTop'>,
  initialScrollTop: number
): boolean {
  if (initialScrollTop <= 0) return false;
  if (el.scrollHeight <= el.clientHeight) return false;
  el.scrollTop = initialScrollTop;
  return true;
}
