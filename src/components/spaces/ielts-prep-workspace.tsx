'use client';

import type { SpaceDetail } from '@/types/spaces';

import { SpacePanelsWorkspace } from '@/components/spaces/space-panels-workspace';

interface IeltsPrepWorkspaceProps {
  space: SpaceDetail;
}

/** ADR-006 Phase B — 雅思备考: space chat + EPP panel. */
export function IeltsPrepWorkspace({ space }: IeltsPrepWorkspaceProps) {
  return <SpacePanelsWorkspace space={space} welcomeKey="ieltsWelcome" />;
}
