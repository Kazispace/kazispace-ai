import { ClinicWorkspaceHubShell } from '@/components/workspace/clinic-workspace-hub-shell';

interface ClinicHubPageProps {
  params: { locale: string };
}

/** Clinic v2 workspace hub — career assets from GET /workspace-assets (KAZI-490). */
export default function ClinicHubPage({ params }: ClinicHubPageProps) {
  return <ClinicWorkspaceHubShell locale={params.locale} />;
}
