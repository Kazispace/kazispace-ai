'use client';

import { useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';

import { SpaceWorkspace } from '@/components/spaces/space-workspace';
import { resolveSpaceIdFromPathname } from '@/lib/space-nav';
import { SPACE_WORKSPACE_KEEPALIVE_LIMIT } from '@/lib/spaces/perf-policy';
import {
  nextSpaceWorkspaceKeepAliveIds,
  sameSpaceIdList,
} from '@/lib/spaces/space-workspace-keepalive';
import { cn } from '@/lib/utils';

/**
 * Persist the last N Space workspaces across Clinic/hub/`/spaces/{id}`
 * navigations so A→Clinic→A does not remount markdown bubbles (KAZI-588).
 * Inactive instances stay `hidden` and do not mount template panels.
 */
export function SpaceWorkspaceKeepAlive({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const spaceId = resolveSpaceIdFromPathname(pathname);
  const [cachedIds, setCachedIds] = useState<string[]>(() =>
    spaceId ? [spaceId] : []
  );

  const nextIds = spaceId
    ? nextSpaceWorkspaceKeepAliveIds(
        cachedIds,
        spaceId,
        SPACE_WORKSPACE_KEEPALIVE_LIMIT
      )
    : cachedIds;

  if (spaceId && !sameSpaceIdList(cachedIds, nextIds)) {
    setCachedIds(nextIds);
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {nextIds.map((id) => {
        const active = id === spaceId;
        return (
          <div
            key={id}
            className={cn(
              'flex h-full min-h-0 min-w-0 flex-col',
              !active && 'hidden'
            )}
            aria-hidden={!active}
          >
            <SpaceWorkspace spaceId={id} active={active} />
          </div>
        );
      })}
      <div
        className={cn(
          'flex h-full min-h-0 min-w-0 flex-col',
          spaceId && 'hidden'
        )}
        aria-hidden={Boolean(spaceId)}
      >
        {children}
      </div>
    </div>
  );
}
