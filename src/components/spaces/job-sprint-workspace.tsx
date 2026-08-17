'use client';

import type { SpaceDetail } from '@/types/spaces';

import { SpacePanelsWorkspace } from '@/components/spaces/space-panels-workspace';

interface JobSprintWorkspaceProps {
  space: SpaceDetail;
  active?: boolean;
}

/** ADR-006 Phase B — 求职冲刺: space chat + CV / Interview panels. */
export function JobSprintWorkspace({ space, active = true }: JobSprintWorkspaceProps) {
  return (
    <SpacePanelsWorkspace
      space={space}
      welcomeKey="jobSprintWelcome"
      active={active}
    />
  );
}
