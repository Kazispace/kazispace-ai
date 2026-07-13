'use client';

import { useSpaceDetail } from '@/hooks/use-space-detail';
import { resolveSpaceLayout } from '@/lib/spaces/layout';

import { BlankConversationWorkspace } from '@/components/spaces/blank-conversation-workspace';
import { IeltsPrepWorkspace } from '@/components/spaces/ielts-prep-workspace';
import { JobSprintWorkspace } from '@/components/spaces/job-sprint-workspace';
import {
  SpaceWorkspaceError,
  SpaceWorkspaceLoading,
} from '@/components/spaces/space-workspace-states';

interface SpaceWorkspaceProps {
  spaceId: string;
}

export function SpaceWorkspace({ spaceId }: SpaceWorkspaceProps) {
  const { space, isLoading, error } = useSpaceDetail(spaceId);

  if (isLoading && !space) {
    return <SpaceWorkspaceLoading />;
  }

  if (error || !space) {
    return <SpaceWorkspaceError message={error} />;
  }

  const layout = resolveSpaceLayout(space);

  if (layout === 'chat_only') {
    return <BlankConversationWorkspace space={space} />;
  }

  if (space.template_id === 'job_sprint') {
    return <JobSprintWorkspace space={space} />;
  }

  if (space.template_id === 'ielts_prep') {
    return <IeltsPrepWorkspace space={space} />;
  }

  return <SpaceWorkspaceError message={null} />;
}
