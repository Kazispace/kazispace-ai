'use client';

import { useSpaceDetail } from '@/hooks/use-space-detail';
import { isSupportedSpaceTemplate } from '@/lib/spaces/constants';

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

  if (!isSupportedSpaceTemplate(space.template_id)) {
    return <SpaceWorkspaceError reason="unsupportedTemplate" />;
  }

  switch (space.template_id) {
    case 'blank_conversation':
      return <BlankConversationWorkspace space={space} />;
    case 'job_sprint':
      return <JobSprintWorkspace space={space} />;
    case 'ielts_prep':
      return <IeltsPrepWorkspace space={space} />;
    default:
      return <SpaceWorkspaceError reason="unsupportedTemplate" />;
  }
}
