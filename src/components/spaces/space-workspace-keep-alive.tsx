'use client';

import dynamic from 'next/dynamic';
import { Suspense, useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { Loader2 } from 'lucide-react';

import { SpaceWorkspace } from '@/components/spaces/space-workspace';
import {
  isClinicChatPathname,
  resolveSpaceIdFromPathname,
} from '@/lib/space-nav';
import { SPACE_WORKSPACE_KEEPALIVE_LIMIT } from '@/lib/spaces/perf-policy';
import {
  nextSpaceWorkspaceKeepAliveIds,
  sameSpaceIdList,
} from '@/lib/spaces/space-workspace-keepalive';
import { cn } from '@/lib/utils';

function ClinicKeepAliveLoading() {
  return (
    <div className="flex flex-1 items-center justify-center py-16 text-gray-500">
      <Loader2 className="h-6 w-6 animate-spin text-primary" aria-hidden />
    </div>
  );
}

/**
 * KAZI-565: ClinicShell stays a dynamic chunk. Do not statically import it
 * from the workspace layout — that would pull CV/Job/YAML onto every first paint.
 */
const ClinicShell = dynamic(
  () =>
    import('@/components/clinic/clinic-shell').then((m) => m.ClinicShell),
  { loading: () => <ClinicKeepAliveLoading />, ssr: false }
);

/**
 * Persist the last N Space workspaces across Clinic/hub/`/spaces/{id}`
 * navigations so A→Clinic→A does not remount markdown bubbles (KAZI-588).
 * Clinic is hosted here too: Space→Clinic must not remount ClinicShell
 * (cold history + scrollTop=0). Inactive instances stay `hidden`.
 */
export function SpaceWorkspaceKeepAlive({
  children,
  locale,
}: {
  children: ReactNode;
  locale: string;
}) {
  const pathname = usePathname();
  const spaceId = resolveSpaceIdFromPathname(pathname);
  const isClinic = isClinicChatPathname(pathname);
  const [cachedIds, setCachedIds] = useState<string[]>(() =>
    spaceId ? [spaceId] : []
  );
  const [clinicCached, setClinicCached] = useState(() => isClinic);

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
  if (isClinic && !clinicCached) {
    setClinicCached(true);
  }

  const hideRouteChildren = Boolean(spaceId) || isClinic;

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
      {clinicCached ? (
        <div
          className={cn(
            'flex h-full min-h-0 min-w-0 flex-col',
            !isClinic && 'hidden'
          )}
          aria-hidden={!isClinic}
        >
          <Suspense fallback={<ClinicKeepAliveLoading />}>
            <ClinicShell locale={locale} active={isClinic} />
          </Suspense>
        </div>
      ) : null}
      <div
        className={cn(
          'flex h-full min-h-0 min-w-0 flex-col',
          hideRouteChildren && 'hidden'
        )}
        aria-hidden={hideRouteChildren}
      >
        {children}
      </div>
    </div>
  );
}
