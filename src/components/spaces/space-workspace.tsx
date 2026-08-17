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
import type { SpaceDetail } from '@/types/spaces';

interface SpaceWorkspaceProps {
  spaceId: string;
}

/** Ensures loading/error/template views share the same h-full flex chain as panels. */
function SpaceWorkspaceFrame({ children }: { children: React.ReactNode }) {
  return <div className="flex h-full min-h-0 flex-col">{children}</div>;
}

function renderTemplateWorkspace(space: SpaceDetail) {
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

export function SpaceWorkspace({ spaceId }: SpaceWorkspaceProps) {
  const { space, isLoading, error } = useSpaceDetail(spaceId);

  if (isLoading && !space) {
    return (
      <SpaceWorkspaceFrame>
        <SpaceWorkspaceLoading />
      </SpaceWorkspaceFrame>
    );
  }

  if (error || !space) {
    return (
      <SpaceWorkspaceFrame>
        <SpaceWorkspaceError message={error} />
      </SpaceWorkspaceFrame>
    );
  }

  if (!isSupportedSpaceTemplate(space.template_id)) {
    return (
      <SpaceWorkspaceFrame>
        <SpaceWorkspaceError reason="unsupportedTemplate" />
      </SpaceWorkspaceFrame>
    );
  }

  return (
    <SpaceWorkspaceFrame key={space.id}>
      {renderTemplateWorkspace(space)}
    </SpaceWorkspaceFrame>
  );
}
