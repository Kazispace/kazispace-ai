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
  /** False when keep-alive hides this instance — unmount template panels. */
  active?: boolean;
}

/** Ensures loading/error/template views share the same h-full flex chain as panels. */
function SpaceWorkspaceFrame({ children }: { children: React.ReactNode }) {
  return <div className="flex h-full min-h-0 flex-col">{children}</div>;
}

function renderTemplateWorkspace(space: SpaceDetail, active: boolean) {
  switch (space.template_id) {
    case 'blank_conversation':
      return <BlankConversationWorkspace space={space} active={active} />;
    case 'job_sprint':
      return <JobSprintWorkspace space={space} active={active} />;
    case 'ielts_prep':
      return <IeltsPrepWorkspace space={space} active={active} />;
    default:
      return <SpaceWorkspaceError reason="unsupportedTemplate" />;
  }
}

export function SpaceWorkspace({ spaceId, active = true }: SpaceWorkspaceProps) {
  const { space, isLoading, isPlaceholder, error } = useSpaceDetail(spaceId);

  // KAZI-1189: a list-row placeholder has no master session yet — show loading until the real
  // detail lands, ⛔ the chat pane's 「空间尚未就绪」 (that stays for a fetched Space without one).
  const waitingForDetail =
    !error && Boolean(space) && isPlaceholder && !space?.master_session_id?.trim();

  if ((isLoading && !space) || waitingForDetail) {
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
      {renderTemplateWorkspace(space, active)}
    </SpaceWorkspaceFrame>
  );
}
