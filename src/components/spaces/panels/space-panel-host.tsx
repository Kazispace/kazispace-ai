'use client';

import type { SpacePanelConfig } from '@/types/spaces';

import { AgentTransitionProvider } from '@/components/agent-transition/agent-transition-provider';
import { IeltsPrepEppPanel } from '@/components/spaces/panels/ielts-prep-epp-panel';
import { JobSprintCvPanel } from '@/components/spaces/panels/job-sprint-cv-panel';
import { JobSprintInterviewPanel } from '@/components/spaces/panels/job-sprint-interview-panel';
import { SpacePanelUnavailable } from '@/components/spaces/panels/space-panel-unavailable';
import {
  getSpacePanelReturnHref,
  resolveSpacePanelAgentConfig,
} from '@/lib/spaces/panel-agent-config';
import { useAuthStore } from '@/lib/store';

interface SpacePanelHostProps {
  panel: SpacePanelConfig;
  locale: string;
  spaceId: string;
  jobId?: string | null;
  className?: string;
}

function renderSpacePanel({
  panel,
  locale,
  jobId,
  className,
}: Omit<SpacePanelHostProps, 'spaceId'>) {
  switch (panel.surface) {
    case 'cv_workspace':
      return (
        <JobSprintCvPanel locale={locale} jobId={jobId} className={className} />
      );
    case 'interview_irp':
      return <JobSprintInterviewPanel locale={locale} className={className} />;
    case 'english_epp':
      return <IeltsPrepEppPanel locale={locale} className={className} />;
    default:
      return (
        <SpacePanelUnavailable panelId={panel.panel_id} className={className} />
      );
  }
}

/** Maps `rendering.panels[].surface` to template-internal panel components. */
export function SpacePanelHost({
  panel,
  locale,
  spaceId,
  jobId,
  className,
}: SpacePanelHostProps) {
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const panelBody = renderSpacePanel({ panel, locale, jobId, className });

  if (
    panel.surface !== 'cv_workspace' &&
    panel.surface !== 'interview_irp' &&
    panel.surface !== 'english_epp'
  ) {
    return panelBody;
  }

  const { fromSurface, hubAgentId } = resolveSpacePanelAgentConfig(panel.surface);

  return (
    <AgentTransitionProvider
      locale={locale}
      fromSurface={fromSurface}
      hubAgentId={hubAgentId}
      isLoggedIn={isLoggedIn}
      returnToClinicHref={getSpacePanelReturnHref(locale, spaceId)}
    >
      {panelBody}
    </AgentTransitionProvider>
  );
}
