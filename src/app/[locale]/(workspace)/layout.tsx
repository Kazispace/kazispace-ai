import { AgePrompt } from '@/components/age/age-prompt';
import { SessionNavShell } from '@/components/session-nav';
import { SpaceWorkspaceKeepAlive } from '@/components/spaces/space-workspace-keep-alive';

export default function WorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { locale: string };
}) {
  return (
    <SessionNavShell locale={params.locale}>
      <SpaceWorkspaceKeepAlive locale={params.locale}>
        {children}
      </SpaceWorkspaceKeepAlive>
      {/* KAZI-1436: asks once for the birth year-month while /me says needs_age. */}
      <AgePrompt />
    </SessionNavShell>
  );
}
