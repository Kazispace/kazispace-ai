'use client';

import type { SpacePanelConfig } from '@/types/spaces';

import { IeltsPrepEppPanel } from '@/components/spaces/panels/ielts-prep-epp-panel';
import { JobSprintCvPanel } from '@/components/spaces/panels/job-sprint-cv-panel';
import { JobSprintInterviewPanel } from '@/components/spaces/panels/job-sprint-interview-panel';
import { SpacePanelUnavailable } from '@/components/spaces/panels/space-panel-unavailable';

interface SpacePanelHostProps {
  panel: SpacePanelConfig;
  locale: string;
  jobId?: string | null;
  className?: string;
}

/** Maps `rendering.panels[].surface` to template-internal panel components. */
export function SpacePanelHost({ panel, locale, jobId, className }: SpacePanelHostProps) {
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
