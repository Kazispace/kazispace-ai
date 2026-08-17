import { touchSpaceLruOrder } from '@/lib/space-slice';
import { SPACE_WORKSPACE_KEEPALIVE_LIMIT } from '@/lib/spaces/perf-policy';

export function sameSpaceIdList(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((id, index) => id === b[index]);
}

/**
 * Most-recent-first keep-alive ids. Visiting `activeId` inserts/moves it to
 * the front and drops the oldest when over `limit`.
 */
export function nextSpaceWorkspaceKeepAliveIds(
  current: string[],
  activeId: string,
  limit: number = SPACE_WORKSPACE_KEEPALIVE_LIMIT
): string[] {
  const id = activeId.trim();
  if (!id) return current;
  return touchSpaceLruOrder(current, id, limit);
}
