'use client';

import type { SpaceDetail } from '@/types/spaces';

import { SpacePanelsWorkspace } from '@/components/spaces/space-panels-workspace';

interface JobSprintWorkspaceProps {
  space: SpaceDetail;
}

/** ADR-006 Phase B — 求职冲刺: space chat + CV / Interview panels. */
export function JobSprintWorkspace({ space }: JobSprintWorkspaceProps) {
  return <SpacePanelsWorkspace space={space} welcomeKey="jobSprintWelcome" />;
}
