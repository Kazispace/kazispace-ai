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
    </SessionNavShell>
  );
}
