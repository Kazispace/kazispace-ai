import { SPACE_CHAT_VIRTUALIZE_AFTER } from '@/lib/spaces/perf-policy';

/** Long Space threads virtualize; short ones keep the existing map. */
export function shouldVirtualizeSpaceMessages(count: number): boolean {
  return count >= SPACE_CHAT_VIRTUALIZE_AFTER;
}
