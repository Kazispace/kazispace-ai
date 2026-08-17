'use client';

import type { SpaceDetail } from '@/types/spaces';

import { SpacePanelsWorkspace } from '@/components/spaces/space-panels-workspace';

interface IeltsPrepWorkspaceProps {
  space: SpaceDetail;
  active?: boolean;
}

/** ADR-006 Phase B — 雅思备考: space chat + EPP panel. */
export function IeltsPrepWorkspace({ space, active = true }: IeltsPrepWorkspaceProps) {
  return (
    <SpacePanelsWorkspace space={space} welcomeKey="ieltsWelcome" active={active} />
  );
}
